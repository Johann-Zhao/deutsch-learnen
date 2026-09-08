# -*- coding: utf-8 -*-
"""从 de.wiktionary 抓取全部词汇的 IPA 音标，生成 data/ipa.js。

用法：python tools/fetch_ipa.py [--limit N]
- 复用 generate_audio.load_items() 取得全部 (wordId, word, sentence)
- 查不到的词不写条目（前端不显示，宁缺毋滥）；wikitext 经 dewikt 磁盘缓存，可断点续跑
"""
import json
import sys

from dewikt import ROOT, query_word, fetch_wikitext, extract_ipa
from generate_audio import load_items


def write_ipa_js(mapping):
    lines = ["// 由 tools/fetch_ipa.py 自动生成，勿手改",
             "window.WORD_IPA = window.WORD_IPA || {};",
             "Object.assign(window.WORD_IPA, {"]
    for wid in sorted(mapping):
        lines.append("  %s: %s," % (json.dumps(wid), json.dumps(mapping[wid], ensure_ascii=False)))
    lines.append("});")
    out = ROOT / "data" / "ipa.js"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def main():
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    items = load_items()
    if limit:
        items = items[:limit]
    print(f"共 {len(items)} 词待查 IPA")
    mapping = {}
    miss = []
    for i, (wid, word, _sent) in enumerate(items):
        wt = fetch_wikitext(query_word(word))
        ipa = extract_ipa(wt) if wt else None
        if ipa:
            mapping[wid] = ipa
        else:
            miss.append(wid)
        if (i + 1) % 100 == 0:
            print(f"  进度 {i + 1}/{len(items)}，命中 {len(mapping)}", flush=True)
    out = write_ipa_js(mapping)
    print(f"完成：{len(mapping)}/{len(items)} 词有 IPA → {out}")
    print(f"未命中 {len(miss)} 个：{' '.join(miss[:20])}{' ...' if len(miss) > 20 else ''}")


if __name__ == "__main__":
    main()
