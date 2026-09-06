# -*- coding: utf-8 -*-
"""为具体名词从 Openverse（主）/ Wikimedia Commons（备）抓取配图。

用法：python tools/fetch_images.py [--limit 800] [--ids id1,id2,...] [--candidates N]
- 只处理名词（m/f/n），跳过动词/形容词/副词与明显抽象的词
- 默认模式：下载 640px 缩略图到 images/words/<id>.jpg，授权信息写入 images/credits.json
- 更新 images/manifest.js 的 IMAGE_WORDS
- 已存在文件自动跳过（可断点续跑）
- --ids：只处理指定词条 id（如 clothes-18），忽略「已存在则跳过」，强制重抓
- --candidates N：候选模式，每个词抓至多 N 个候选到 images/candidates/<id>/<k>.jpg
  并写 meta.json（含 credit 与查询词），不触碰 words/、credits.json、manifest.js；
  候选查询合并「纯德语词」与「德语词 + 中文释义」两路，按 url 去重
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


def openverse_results(client, word):
    """Openverse 搜索（缩略图经 api.openverse.org 代理，可达性好），返回 [(url, credit)]"""
    try:
        r = client.get(
            'https://api.openverse.org/v1/images/',
            params={'q': word, 'page_size': 8},
            headers={'User-Agent': UA}, timeout=20)
        if r.status_code != 200:
            return []
        out = []
        for item in (r.json().get('results') or []):
            w = item.get('width') or 0
            thumb = item.get('thumbnail') or item.get('url')
            if not thumb or w < 400:
                continue
            lic = (item.get('license') or '').upper()
            if lic in ('', 'UNKNOWN'):
                continue
            out.append((thumb, {
                'source': 'Openverse/' + (item.get('source') or ''),
                'file': (item.get('title') or '')[:80],
                'author': (item.get('creator') or 'unknown')[:80],
                'license': 'CC ' + lic if lic.startswith(('BY', 'CC0', 'PDM')) else lic,
                'page': item.get('foreign_landing_url') or '',
            }))
        return out
    except Exception:
        return []


def openverse_search(client, word):
    """取 Openverse 首个合格结果，返回 (url, credit) 或 None"""
    res = openverse_results(client, word)
    return res[0] if res else None


def commons_results(client, word):
    """Wikimedia Commons 搜索（在部分网络下被 403，作为备选），返回 [(thumb_url, credit)]"""
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
            return []
        pages = (r.json().get('query') or {}).get('pages') or {}
        out = []
        # 按搜索排序号依次取尺寸合格的位图
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
            out.append((info.get('thumburl'), credit))
        return out
    except Exception:
        return []


def commons_search(client, word):
    """取 Wikimedia Commons 首个合格结果，返回 (thumb_url, credit) 或 None"""
    res = commons_results(client, word)
    return res[0] if res else None


def update_manifest(word_ids):
    mp = ROOT / 'images' / 'manifest.js'
    text = mp.read_text(encoding='utf-8') if mp.exists() else ''
    m = re.search(r'window\.IMAGE_COVERS = \[(.*?)\];', text, re.S)
    covers = json.loads('[' + m.group(1) + ']') if m else []
    mp.write_text(
        '// 由 tools/gen_zine_covers.py 与 tools/fetch_images.py 自动更新，勿手改\n'
        'window.IMAGE_WORDS = ' + json.dumps(sorted(word_ids), ensure_ascii=False) + ';\n'
        'window.IMAGE_COVERS = ' + json.dumps(covers, ensure_ascii=False) + ';\n',
        encoding='utf-8')


def parse_args():
    limit = 800
    ids = None
    candidates = None
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])
    if '--ids' in sys.argv:
        ids = set(sys.argv[sys.argv.index('--ids') + 1].split(','))
    if '--candidates' in sys.argv:
        candidates = int(sys.argv[sys.argv.index('--candidates') + 1])
    return limit, ids, candidates


def collect_candidates(client, word, zh, n):
    """合并「纯德语词」与「德语词 + 中文释义」两路查询，按 url 去重，返回至多 n 个 (url, credit, query)"""
    seen = set()
    out = []
    for query in (word, f'{word} {zh}'):
        for results in (openverse_results(client, query), commons_results(client, query)):
            for url, credit in results:
                if not url or url in seen:
                    continue
                seen.add(url)
                out.append((url, credit, query))
                if len(out) >= n:
                    return out
        time.sleep(0.3)
    return out


def run_candidates(client, items, n):
    """候选模式：每词下载至多 n 个候选到 images/candidates/<id>/<k>.jpg，写 meta.json"""
    base = ROOT / 'images' / 'candidates'
    for wid, lv, word, zh in items:
        target = base / wid
        target.mkdir(parents=True, exist_ok=True)
        cands = collect_candidates(client, word, zh, n)
        metas = []
        k = 0
        for url, credit, query in cands:
            try:
                data = client.get(url, headers={'User-Agent': UA}).content
            except Exception:
                continue
            if len(data) <= 8 * 1024:  # 太小的多半是占位图
                continue
            (target / f'{k}.jpg').write_bytes(data)
            metas.append({'k': k, 'file': f'{k}.jpg', 'query': query,
                          'url': url, **credit})
            k += 1
        (target / 'meta.json').write_text(
            json.dumps({'id': wid, 'word': word, 'zh': zh, 'candidates': metas},
                       ensure_ascii=False, indent=1),
            encoding='utf-8')
        print(f'{wid} ({word}/{zh})：{len(metas)} 个候选', flush=True)
        time.sleep(0.3)


def main():
    limit, ids, candidates = parse_args()
    nouns = load_nouns()
    if ids is not None:
        known = {w for w, *_ in nouns}
        unknown = ids - known
        if unknown:
            print(f'警告：以下 id 未在词汇表中匹配到（已忽略）：{sorted(unknown)}', flush=True)
        nouns = [it for it in nouns if it[0] in ids]
        if not nouns:
            print('没有匹配的词条，退出')
            return
    if candidates is not None:
        with httpx.Client(timeout=30, trust_env=True, follow_redirects=True) as client:
            run_candidates(client, nouns, candidates)
        print('候选模式完成：未触碰 images/words、credits.json、manifest.js')
        return
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
            if ids is None and out.exists() and out.stat().st_size > 0:
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
