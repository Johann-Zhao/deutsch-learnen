# -*- coding: utf-8 -*-
"""把人工审核后的候选图落盘：应用 images/candidates/choices.json 的审核结论。

用法：python tools/finalize_images.py
- 读 images/candidates/choices.json，格式 {"<id>": <候选序号k整数> 或 "none"}
- 值为 k：把 images/candidates/<id>/<k>.jpg 覆盖到 images/words/<id>.jpg，
  按该候选 meta 写 credits.json 条目，清理该 id 的候选目录
- 值为 "none"：删除 images/words/<id>.jpg（若存在）并删除 credits.json 中该 id 条目，
  清理候选目录（前端白名单将不含它，学习卡不再显示图）
- 全部处理完后按磁盘实况重建 images/manifest.js 的 IMAGE_WORDS（IMAGE_COVERS 保留）
- 完成后 choices.json 改名为 choices.done.json 防重复执行

前置：先跑 python tools/fetch_images.py --ids <id...> --candidates N 生成候选。
"""
import json
import pathlib
import shutil
import sys

from fetch_images import ROOT, load_nouns, update_manifest

CANDIDATES = ROOT / 'images' / 'candidates'


def main():
    choices_path = CANDIDATES / 'choices.json'
    if not choices_path.exists():
        print(f'未找到 {choices_path}，先运行 fetch_images.py --candidates 并人工审核')
        return
    choices = json.loads(choices_path.read_text(encoding='utf-8'))

    words_dir = ROOT / 'images' / 'words'
    words_dir.mkdir(parents=True, exist_ok=True)
    credits_path = ROOT / 'images' / 'credits.json'
    credits = json.loads(credits_path.read_text(encoding='utf-8')) if credits_path.exists() else {}
    nouns = dict((w, (word, zh)) for w, _, word, zh in load_nouns())

    for wid, val in choices.items():
        cand_dir = CANDIDATES / wid
        meta_path = cand_dir / 'meta.json'
        metas = {}
        if meta_path.exists():
            metas = {m['k']: m for m in json.loads(
                meta_path.read_text(encoding='utf-8')).get('candidates', [])}
        if val == 'none':
            gone = words_dir / f'{wid}.jpg'
            if gone.exists():
                gone.unlink()
            credits.pop(wid, None)
            print(f'{wid}：none，已删除配图与 credits 条目', flush=True)
        elif isinstance(val, int) and val in metas:
            src = cand_dir / f'{val}.jpg'
            if not src.exists() or src.stat().st_size == 0:
                print(f'{wid}：候选 {val} 文件缺失，跳过', flush=True)
                continue
            shutil.move(str(src), str(words_dir / f'{wid}.jpg'))
            m = metas[val]
            word, zh = nouns.get(wid, (m.get('word', ''), m.get('zh', '')))
            credits[wid] = {'word': word, 'zh': zh, **{
                k: m[k] for k in ('source', 'file', 'author', 'license', 'page') if k in m}}
            print(f'{wid}：已采用候选 {val}（{m.get("file", "")}）', flush=True)
        else:
            print(f'{wid}：无法识别的选择 {val!r}，跳过', flush=True)
            continue
        if cand_dir.exists():
            shutil.rmtree(cand_dir)

    credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding='utf-8')
    done = [p.stem for p in words_dir.glob('*.jpg') if p.stat().st_size > 0]
    update_manifest(done)
    shutil.move(str(choices_path), str(CANDIDATES / 'choices.done.json'))
    print(f'完成：manifest 已按磁盘实况重建（共 {len(done)}）；choices.json → choices.done.json')


if __name__ == '__main__':
    sys.exit(main())
