# -*- coding: utf-8 -*-
"""为全部词汇主题生成统一风格的插画封面（Seedream）。

用法：python tools/gen_covers.py [--force]
输出 images/covers/<themeId>.png，并更新 images/manifest.js 的 IMAGE_COVERS。
"""
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from seedream_client import generate

ROOT = pathlib.Path(__file__).resolve().parent.parent

THEME_PROMPTS = {
  'greet': '问候与自我介绍：两个人友好握手打招呼，城市街景',
  'time': '数字、时间与日期：一个大挂钟、日历与数字飘带',
  'family': '家庭：三代同堂的一家人在花园里喝茶',
  'food': '饮食：摆满面包水果和饮料的早餐餐桌',
  'shop': '购物：街边小店与购物袋、价签',
  'home': '居住与家居：温馨的客厅，沙发台灯书架',
  'traffic': '交通与旅行：火车、公交车与行李箱',
  'work': '职业与工作：办公桌、笔记本电脑与同事交流',
  'free': '空闲活动：阅读、音乐、足球和画架',
  'health': '身体与健康：听诊器、药瓶与爱心',
  'clothes': '颜色与服装：挂满彩色衣服的衣橱',
  'weather': '天气与四季：四季变化的小树与太阳雨云',
  'a2-travel': '旅行与假期：行李箱、飞机、地图与海滩',
  'a2-office': '职业与办公室：会议室与图表展示',
  'a2-city': '城市与公共设施：市政厅广场与街道',
  'a2-media': '媒体与网络：报纸、电视与聊天气泡',
  'a2-feelings': '情感与性格：表达喜怒哀乐的表情气球',
  'a2-nature': '自然与环境：森林、风车与太阳光伏板',
  'a2-festival': '节日与习俗：圣诞树、烟花与彩带',
  'a2-tech': '科技与家电：家用电器与机器人吸尘器',
  'a2-bank': '银行与信件：银行大楼、银行卡与信封',
  'a2-education': '教育与培训：教室黑板与书本',
  'a2-sport': '运动与健身：跑步、哑铃与瑜伽垫',
  'a2-housing': '住房与搬家：搬家纸箱与钥匙',
  'b1-career': '工作与职业发展：职场阶梯与目标旗帜',
  'b1-economy': '经济与消费：上升的图表与购物车',
  'b1-media': '媒体与舆论：话筒、报纸与放大镜',
  'b1-environment': '环境与能源：风力发电机与绿色地球',
  'b1-university': '大学与研究：实验烧瓶、书本与毕业帽',
  'b1-health': '健康与心理：冥想的人与爱心',
  'b1-society': '社会与移民：不同肤色的人手拉手',
  'b1-digital': '数字化与人工智能：神经网络与机器人',
  'b1-culture': '文化与艺术：画廊、雕塑与剧院面具',
  'b1-europe': '欧洲与国际：欧盟星旗与地球仪',
  'b1-writing': '文学与写作：钢笔、稿纸与台灯',
  'b1-law': '法律与秩序：天平法槌与法律书',
  'b1-colloquial': '日常地道表达：聊天气泡与咖啡馆对话',
  'b1-formal': '正式书面表达：印章、信函与文件夹',
}


def load_themes():
    themes = []
    for vf in sorted((ROOT / 'data').glob('vocabulary*.js')):
        text = vf.read_text(encoding='utf-8')
        for m in re.finditer(r"id:\s*'([\w-]+)',\s*name:\s*'([^']+)'", text):
            themes.append((m.group(1), m.group(2)))
    return themes


def update_manifest(cover_ids, word_ids=None):
    mp = ROOT / 'images' / 'manifest.js'
    existing = mp.read_text(encoding='utf-8') if mp.exists() else ''
    words = word_ids
    if words is None:
        m = re.search(r'window\.IMAGE_WORDS = \[(.*?)\];', existing, re.S)
        words = json.loads('[' + m.group(1) + ']') if m else []
    mp.write_text(
        '// 由 tools/gen_covers.py 与 tools/fetch_images.py 自动更新，勿手改\n'
        'window.IMAGE_WORDS = ' + json.dumps(words, ensure_ascii=False) + ';\n'
        'window.IMAGE_COVERS = ' + json.dumps(sorted(cover_ids), ensure_ascii=False) + ';\n',
        encoding='utf-8')


def main():
    force = '--force' in sys.argv
    themes = load_themes()
    out_dir = ROOT / 'images' / 'covers'
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f'共 {len(themes)} 个主题封面')
    ok, fail = 0, []
    for tid, name in themes:
        out = out_dir / f'{tid}.png'
        if out.exists() and out.stat().st_size > 0 and not force:
            ok += 1
            continue
        prompt = THEME_PROMPTS.get(tid, name + '主题的象征场景')
        print(f'生成 {tid}（{name}）…')
        success, _, note = generate(prompt, out, sizes=('1024x1024',), verbose=False)
        if success:
            ok += 1
            print(f'  ✓ {note}')
        else:
            fail.append(tid)
            print('  ✗ 失败')
        time.sleep(1.5)  # 防限流
    done = [tid for tid, _ in themes if (out_dir / f'{tid}.png').exists()]
    update_manifest(done)
    print(f'完成 {ok}/{len(themes)}，失败：{fail if fail else "无"}，manifest 已更新')


if __name__ == '__main__':
    main()
