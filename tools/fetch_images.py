# -*- coding: utf-8 -*-
"""为具体名词从 Wikimedia Commons（主）/ Openverse（备）抓取配图。

用法：python tools/fetch_images.py [--limit 800]
- 只处理名词（m/f/n），跳过动词/形容词/副词与明显抽象的词
- 下载 640px 缩略图到 images/words/<id>.jpg，授权信息写入 images/credits.json
- 更新 images/manifest.js 的 IMAGE_WORDS
- 已存在文件自动跳过（可断点续跑）
"""
import json
import pathlib
import re
import sys
import time

import httpx

ROOT = pathlib.Path(__file__).resolve().parent.parent
UA = "GermanLearningSite/1.0 (personal local study app; educational use)"

# 中文释义包含这些词的视为抽象概念，跳过搜图
ABSTRACT = ['感觉', '情感', '概念', '关系', '社会', '经济', '法律', '政治', '文化', '理论',
            '方法', '过程', '状态', '质量', '可能', '原因', '结果', '意义', '价值', '观点',
            '自由', '责任', '义务', '影响', '发展', '变化', '制度', '体系', '原则', '规律',
            '思想', '精神', '道德', '幸福', '尊严', '正义', '传统', '现代', '未来', '过去',
            '内容', '形式', '问题', '目的', '条件', '情况', '机会', '风险', '能力', '态度',
            '兴趣', '印象', '记忆', '想象', '梦想', '希望', '恐惧', '愤怒', '悲伤', '惊讶',
            '表达', '说法', '词语', '语言', '文字', '消息', '信息', '数据', '知识', '经验']

LEVEL_ORDER = {'A1': 0, 'A2': 1, 'B1': 2}


def load_nouns():
    """返回 [(id, level, de, zh)]，只取名词且优先低级别"""
    items = []
    theme = None
    theme_level = None
    index = 0
    for vf in sorted((ROOT / 'data').glob('vocabulary*.js')):
        for line in vf.read_text(encoding='utf-8').splitlines():
            m = re.search(r"id:\s*'([\w-]+)',\s*name:\s*'([^']+)',\s*level:\s*'(\w+)'", line)
            if m:
                theme, theme_level, index = m.group(1), m.group(3), 0
                continue
            if theme and line.lstrip().startswith("['"):
                parts = re.findall(r"'((?:[^'\\]|\\.)*)'", line)
                if len(parts) >= 5 and parts[1] in ('m', 'f', 'n', 'pl'):
                    de, zh = parts[0], parts[2]
                    word = re.sub(r'^(der|die|das) ', '', de)
                    if len(word) < 3 or any(a in zh for a in ABSTRACT):
                        continue
                    items.append((f'{theme}-{index}', theme_level, word, zh))
                if len(parts) >= 5:
                    index += 1
    items.sort(key=lambda x: (LEVEL_ORDER.get(x[1], 9), x[0]))
    return items


def openverse_search(client, word):
    """Openverse 搜索（缩略图经 api.openverse.org 代理，可达性好），返回 (url, credit)"""
    try:
        r = client.get(
            'https://api.openverse.org/v1/images/',
            params={'q': word, 'page_size': 8},
            headers={'User-Agent': UA}, timeout=20)
        if r.status_code != 200:
            return None
        for item in (r.json().get('results') or []):
            w = item.get('width') or 0
            thumb = item.get('thumbnail') or item.get('url')
            if not thumb or w < 400:
                continue
            lic = (item.get('license') or '').upper()
            if lic in ('', 'UNKNOWN'):
                continue
            return thumb, {
                'source': 'Openverse/' + (item.get('source') or ''),
                'file': (item.get('title') or '')[:80],
                'author': (item.get('creator') or 'unknown')[:80],
                'license': 'CC ' + lic if lic.startswith(('BY', 'CC0', 'PDM')) else lic,
                'page': item.get('foreign_landing_url') or '',
            }
    except Exception:
        return None
    return None


def commons_search(client, word):
    """Wikimedia Commons 搜索（在部分网络下被 403，作为备选），返回 (thumb_url, credit) 或 None"""
    try:
        r = client.get(
            'https://commons.wikimedia.org/w/api.php',
            params={
                'action': 'query', 'format': 'json',
                'generator': 'search',
                'gsrsearch': f'{word} filetype:bitmap',
                'gsrnamespace': 6, 'gsrlimit': 8,
                'prop': 'imageinfo', 'iiprop': 'url|mime|size|extmetadata',
                'iiurlwidth': 640,
            }, headers={'User-Agent': UA}, timeout=20)
        if r.status_code != 200:
            return None
        pages = (r.json().get('query') or {}).get('pages') or {}
        # 按搜索排序号取第一个尺寸合格的位图
        for p in sorted(pages.values(), key=lambda x: x.get('index', 99)):
            info = (p.get('imageinfo') or [{}])[0]
            if info.get('mime') not in ('image/jpeg', 'image/png'):
                continue
            if (info.get('width') or 0) < 400 or (info.get('height') or 0) < 300:
                continue
            meta = info.get('extmetadata') or {}
            def md(k):
                return (meta.get(k, {}).get('value') or '').strip()
            license_ = md('LicenseShortName') or 'unknown'
            # 排除明显有第三方权利的
            if 'fair use' in license_.lower() or 'non-free' in license_.lower():
                continue
            title = p.get('title', '')
            author = re.sub(r'<[^>]+>', '', md('Artist') or 'unknown')[:80]
            credit = {
                'source': 'Wikimedia Commons',
                'file': title,
                'author': author,
                'license': license_,
                'page': 'https://commons.wikimedia.org/wiki/' + title.replace(' ', '_'),
            }
            return info.get('thumburl'), credit
    except Exception:
        return None
    return None


def update_manifest(word_ids):
    mp = ROOT / 'images' / 'manifest.js'
    text = mp.read_text(encoding='utf-8') if mp.exists() else ''
    m = re.search(r'window\.IMAGE_COVERS = \[(.*?)\];', text, re.S)
    covers = json.loads('[' + m.group(1) + ']') if m else []
    mp.write_text(
        '// 由 tools/gen_covers.py 与 tools/fetch_images.py 自动更新，勿手改\n'
        'window.IMAGE_WORDS = ' + json.dumps(sorted(word_ids), ensure_ascii=False) + ';\n'
        'window.IMAGE_COVERS = ' + json.dumps(covers, ensure_ascii=False) + ';\n',
        encoding='utf-8')


def main():
    limit = 800
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])
    nouns = load_nouns()
    out_dir = ROOT / 'images' / 'words'
    out_dir.mkdir(parents=True, exist_ok=True)
    credits_path = ROOT / 'images' / 'credits.json'
    credits = json.loads(credits_path.read_text(encoding='utf-8')) if credits_path.exists() else {}
    print(f'候选名词 {len(nouns)} 个，上限 {limit}')

    ok, miss = 0, 0
    with httpx.Client(timeout=30, trust_env=True, follow_redirects=True) as client:
        for i, (wid, lv, word, zh) in enumerate(nouns):
            if ok >= limit:
                break
            out = out_dir / f'{wid}.jpg'
            if out.exists() and out.stat().st_size > 0:
                ok += 1
                continue
            hit = openverse_search(client, word) or commons_search(client, word)
            if not hit:
                miss += 1
            else:
                url, credit = hit
                try:
                    data = client.get(url, headers={'User-Agent': UA}).content
                    if len(data) > 8 * 1024:  # 太小的多半是占位图
                        out.write_bytes(data)
                        credits[wid] = {'word': word, 'zh': zh, **credit}
                        ok += 1
                except Exception:
                    miss += 1
            if (i + 1) % 100 == 0:
                print(f'  进度 {i+1}/{len(nouns)}，已获 {ok}，未命中 {miss}', flush=True)
                credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding='utf-8')
            time.sleep(0.3)

    credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding='utf-8')
    done = [p.stem for p in out_dir.glob('*.jpg') if p.stat().st_size > 0]
    update_manifest(done)
    print(f'完成：下载 {ok} 张，未命中 {miss}；manifest 已更新（共 {len(done)}）')


if __name__ == '__main__':
    main()
