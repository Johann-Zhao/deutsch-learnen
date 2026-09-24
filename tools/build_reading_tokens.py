# -*- coding: utf-8 -*-
"""阅读短文分词与词形归并管道（S8 阅读模块）。

用法：python tools/build_reading_tokens.py
- 读 data/reading_texts.src.js（作者手写层：id/title/level/theme + 纯文本段落）
- 分词：按空白切分，剥离标点为独立 {w} token；德语名词大写保留
- 词形归并（变位/变格/复合词 → lemma）后匹配词库（data/vocabulary*.js，1945 词）：
  1. LEXICON_OVERRIDES 人工兜底（脚本头部，最高优先级，质量优先）
  2. 原形直接命中（键 = 去冠词 lemma 小写）
  3. 规则还原：动词词尾 / 过去分词 / 名词复数 / 形容词词尾
  4. dewikt.py 查 de.wiktionary（磁盘缓存）取词形表与释义
- 命中词库 → token {w, lemma, vid}；库外词 → {w, lemma, g}（g = 中文释义）
- 输出 data/reading.js（头注释「自动生成，勿手改」）与映射报告
  未决词（既无 vid 也无 g）> 0 时退出码 1；words 字段 = 实际词 token 数
"""
import json
import pathlib
import re
import sys

import dewikt

# Windows 控制台默认 GBK，打印含变元音/中文的映射报告会炸；强制 UTF-8 输出
sys.stdout.reconfigure(encoding="utf-8")

# dewikt.py 默认 2s 礼貌间隔；阅读管道首次全量抓取词形较多，放宽到 4s 降低 429 限流
#（只调运行时行为，不改 dewikt.py 本体；wikitext 有磁盘缓存，重跑便宜）
dewikt.DELAY = 4.0

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# 人工兜底表：值 = {"lemma": …, "vid": …}（词库词）或 {"lemma": …, "g": …}（库外词，
# g = 中文释义）。键默认词形小写（大小写通用）；需要区分大小写时用精确词形作键
# （如 "Essen"/"essen"、"Weg"/"weg"，精确键优先于小写键命中）。
# 条目可带 "texts": [篇目 id] 按篇限定（同形异义词，如姓氏只在出现该姓的篇目生效，
# 其余篇目走词库直命中）。只放需要人工保证质量的条目：专有名词、不规则映射、
# 机器释义不可靠的词、词库同键不同义的消歧。最高优先级。
# ---------------------------------------------------------------------------
LEXICON_OVERRIDES = {
    # 专有名词：只读释义，不进 SRS（不映射 vid）
    "paula": {"lemma": "Paula", "g": "人名（猫名）"},
    "bello": {"lemma": "Bello", "g": "人名（狗名）"},
    "balu": {"lemma": "Balu", "g": "人名（狗名）"},
    "jonas": {"lemma": "Jonas", "g": "人名"},
    "maria": {"lemma": "Maria", "g": "人名"},
    "emma": {"lemma": "Emma", "g": "人名"},
    "leo": {"lemma": "Leo", "g": "人名"},
    "nora": {"lemma": "Nora", "g": "人名"},
    "clara": {"lemma": "Clara", "g": "人名"},
    "lina": {"lemma": "Lina", "g": "人名"},
    "tom": {"lemma": "Tom", "g": "人名"},
    "aylin": {"lemma": "Aylin", "g": "人名"},
    "sabine": {"lemma": "Sabine", "g": "人名"},
    "markus": {"lemma": "Markus", "g": "人名"},
    "ben": {"lemma": "Ben", "g": "人名"},
    "jana": {"lemma": "Jana", "g": "人名"},
    "sommer": {"lemma": "Sommer", "g": "姓（Familie Sommer）", "texts": ["rd-a1-aushang"]},
    "brandt": {"lemma": "Brandt", "g": "姓（Familie Brandt）"},
    "bergmann": {"lemma": "Bergmann", "g": "姓"},
    "lena": {"lemma": "Lena", "g": "人名"},
    "winter": {"lemma": "Winter", "g": "姓（Lena Winter）", "texts": ["rd-b1-buch"]},
    "bayern": {"lemma": "Bayern", "g": "拜仁（德国联邦州）"},
    "berlin": {"lemma": "Berlin", "g": "柏林"},
    "brandenburg": {"lemma": "Brandenburg", "g": "勃兰登堡（德国联邦州）"},
    "ostsee": {"lemma": "Ostsee", "g": "波罗的海"},
    "neustadt": {"lemma": "Neustadt", "g": "新城（城区名）"},
    "bergstraße": {"lemma": "Bergstraße", "g": "街道名（虚构）"},
    "blau-weiß": {"lemma": "Blau-Weiß", "g": "蓝白（足球俱乐部名）"},
    "mathe": {"lemma": "Mathe", "g": "数学（口）"},
    "deutsch": {"lemma": "das Deutsch", "vid": "greet-20"},
    "englisch": {"lemma": "Englisch", "g": "英语"},
    # 功能词/语法词：词库不收，人工释义（覆盖句首大写同词形）
    "dann": {"lemma": "dann", "g": "然后；那么"},
    "ein": {"lemma": "ein", "g": "一（个）"},
    "nicht": {"lemma": "nicht", "g": "不；没有"},
    "nach": {"lemma": "nach", "g": "往；在…之后"},
    "im": {"lemma": "im", "g": "在…里（in dem）"},
    "kein": {"lemma": "kein", "g": "无…的；不是"},
    "welche": {"lemma": "welch", "g": "哪个；哪些"},
    "unser": {"lemma": "unser", "g": "我们的"},
    "unsere": {"lemma": "unser", "g": "我们的"},
    "nächste": {"lemma": "nächst", "g": "下一个的"},
    "oben": {"lemma": "oben", "g": "上面"},
    "unten": {"lemma": "unten", "g": "下面"},
    "draußen": {"lemma": "draußen", "g": "在外面"},
    "drinnen": {"lemma": "drinnen", "g": "在里面"},
    "überall": {"lemma": "überall", "g": "到处"},
    "vielleicht": {"lemma": "vielleicht", "g": "也许；可能"},
    "trotzdem": {"lemma": "trotzdem", "g": "尽管如此"},
    "deshalb": {"lemma": "deshalb", "g": "因此"},
    "danach": {"lemma": "danach", "g": "之后；随后"},
    "automatisch": {"lemma": "automatisch", "g": "自动地；不由自主地"},
    "zwar": {"lemma": "zwar", "g": "虽然（und zwar 即；的确）"},
    "wer": {"lemma": "wer", "g": "谁"},
    "diesen": {"lemma": "dies", "g": "这个（第四格）"},
    "achtung": {"lemma": "Achtung", "g": "注意！"},
    "verkaufe": {"lemma": "verkaufen", "vid": "shop-15"},
    "schreib": {"lemma": "schreiben", "vid": "work-44"},
    "probiert": {"lemma": "probieren", "vid": "clothes-51"},
    "scrollen": {"lemma": "scrollen", "g": "刷（屏）；滚动"},
    "tagsüber": {"lemma": "tagsüber", "g": "白天"},
    "einhundertfünfzig": {"lemma": "einhundertfünfzig", "g": "一百五十"},
    "frei": {"lemma": "frei", "g": "（口号 SPORT FREI）开练吧！"},
    # 复合词/其他库外词
    "aufstehen": {"lemma": "aufstehen", "g": "起床"},
    "schlafengehen": {"lemma": "schlafengehen", "g": "去睡觉"},
    "feel-good-buch": {"lemma": "Feel-Good-Buch", "g": "治愈系书籍"},
    "team-chat": {"lemma": "Team-Chat", "g": "团队聊天群"},
    "teammeeting": {"lemma": "Teammeeting", "g": "团队会议"},
    "lernplan": {"lemma": "Lernplan", "g": "学习计划"},
    "lerneinheit": {"lemma": "Lerneinheit", "g": "学习单元"},
    "nebenfiguren": {"lemma": "Nebenfigur", "g": "配角"},
    "rezeptbuch": {"lemma": "Rezeptbuch", "g": "食谱"},
    "wasserkosten": {"lemma": "Wasserkosten", "g": "水费"},
    # 功能词/语法词（词库不收；覆盖句首大写同词形）
    "das": {"lemma": "das", "g": "这（中性冠词/代词）"},
    "der": {"lemma": "der", "g": "这（阳性冠词）"},
    "die": {"lemma": "die", "g": "这（阴性/复数冠词）"},
    "dem": {"lemma": "der", "g": "这（第三格阳/中）"},
    "den": {"lemma": "der", "g": "这（第四格阳性/复数第三格）"},
    "dein": {"lemma": "dein", "g": "你的"},
    "deine": {"lemma": "dein", "g": "你的"},
    "denn": {"lemma": "denn", "g": "因为；到底"},
    "dass": {"lemma": "dass", "g": "连词，引出从句"},
    "dies": {"lemma": "dies", "g": "这个"},
    "dieser": {"lemma": "dieser", "g": "这个"},
    "dieses": {"lemma": "dieser", "g": "这个"},
    "eine": {"lemma": "ein", "g": "一（个）"},
    "einen": {"lemma": "ein", "g": "一（个，第四格）"},
    "es": {"lemma": "es", "g": "它"},
    "er": {"lemma": "er", "g": "他"},
    "euch": {"lemma": "euch", "g": "你们（第三/四格）"},
    "ihr": {"lemma": "ihr", "g": "她/他们的；你们"},
    "ihre": {"lemma": "ihr", "g": "她/他们的"},
    "ihrem": {"lemma": "ihr", "g": "她/他们的"},
    "ihren": {"lemma": "ihr", "g": "她/他们的"},
    "ihrer": {"lemma": "ihr", "g": "她/他们的"},
    "ich": {"lemma": "ich", "g": "我"},
    "ihm": {"lemma": "ihm", "g": "他（第三格）"},
    "ihn": {"lemma": "ihn", "g": "他（第四格）"},
    "immer": {"lemma": "immer", "g": "总是"},
    "ins": {"lemma": "ins", "g": "到…里（in das）"},
    "inzwischen": {"lemma": "inzwischen", "g": "在此期间"},
    "kann": {"lemma": "kann", "g": "能"},
    "kaum": {"lemma": "kaum", "g": "几乎不"},
    "keine": {"lemma": "kein", "g": "没有…的"},
    "könnten": {"lemma": "könnten", "g": "可能（können 的虚拟式）"},
    "mich": {"lemma": "mich", "g": "我（第四格）"},
    "mir": {"lemma": "mir", "g": "我（第三格）"},
    "mit": {"lemma": "mit", "g": "和…一起"},
    "möchte": {"lemma": "möchten", "g": "想要"},
    "möchtet": {"lemma": "möchten", "g": "想要"},
    "müssen": {"lemma": "müssen", "g": "必须"},
    "noch": {"lemma": "noch", "g": "还"},
    "ob": {"lemma": "ob", "g": "是否"},
    "oder": {"lemma": "oder", "g": "或者"},
    "oft": {"lemma": "oft", "g": "经常"},
    "ohne": {"lemma": "ohne", "g": "没有"},
    "pro": {"lemma": "pro", "g": "每"},
    "so": {"lemma": "so", "g": "如此；这样"},
    "sogar": {"lemma": "sogar", "g": "甚至"},
    "sollte": {"lemma": "sollen", "g": "应该（过去时）"},
    "sondern": {"lemma": "sondern", "g": "而是"},
    "um": {"lemma": "um", "g": "围绕；在…点"},
    "uns": {"lemma": "uns", "g": "我们（第三/四格）"},
    "von": {"lemma": "von", "g": "从；…的"},
    "vor": {"lemma": "vor", "g": "在…之前"},
    "vorbei": {"lemma": "vorbei", "g": "经过"},
    "wann": {"lemma": "wann", "g": "何时"},
    "weil": {"lemma": "weil", "g": "因为"},
    "wenn": {"lemma": "wenn", "g": "如果；当…时"},
    "weniger": {"lemma": "weniger", "g": "更少"},
    "wie": {"lemma": "wie", "g": "怎样；像"},
    "wo": {"lemma": "wo", "g": "哪里"},
    "zu": {"lemma": "zu", "g": "到；向"},
    "zum": {"lemma": "zum", "g": "到（zu dem）"},
    "zur": {"lemma": "zur", "g": "到（zu der）"},
    "über": {"lemma": "über", "g": "关于；越过"},
    "ans": {"lemma": "ans", "g": "到…上（an das）"},
    "auf": {"lemma": "auf", "g": "在…上；向…"},
    "aufs": {"lemma": "aufs", "g": "到…上（auf das）"},
    "aus": {"lemma": "aus", "g": "从…出来；来自"},
    "bei": {"lemma": "bei", "g": "在…处；对于"},
    "beim": {"lemma": "beim", "g": "在…时（bei dem）"},
    "bis": {"lemma": "bis", "g": "直到"},
    "durch": {"lemma": "durch", "g": "穿过；通过"},
    "für": {"lemma": "für", "g": "为了"},
    "gegen": {"lemma": "gegen", "g": "对着；反对"},
    "ab": {"lemma": "ab", "g": "从…起；离开"},
    "am": {"lemma": "am", "g": "在（an dem）"},
    "an": {"lemma": "an", "g": "在…旁；到…"},
    "als": {"lemma": "als", "g": "比；作为；当…时"},
    "auch": {"lemma": "auch", "g": "也"},
    # 库外副词/形容词
    "bald": {"lemma": "bald", "g": "不久"},
    "dafür": {"lemma": "dafür", "g": "为此"},
    "damit": {"lemma": "damit", "g": "以便；对此"},
    "dazu": {"lemma": "dazu", "g": "此外；对此"},
    "deutlich": {"lemma": "deutlich", "g": "明显地"},
    "direkt": {"lemma": "direkt", "g": "直接地"},
    "direkten": {"lemma": "direkt", "g": "直接的"},
    "durchweg": {"lemma": "durchweg", "g": "完全；始终"},
    "egal": {"lemma": "egal", "g": "无所谓"},
    "fair": {"lemma": "fair", "g": "公平地"},
    "fast": {"lemma": "fast", "g": "几乎"},
    "fertig": {"lemma": "fertig", "g": "完成的"},
    "fremd": {"lemma": "fremd", "g": "陌生的"},
    "frisch": {"lemma": "frisch", "g": "新鲜的"},
    "frische": {"lemma": "frisch", "g": "新鲜的"},
    "frischen": {"lemma": "frisch", "g": "新鲜的"},
    "ganz": {"lemma": "ganz", "g": "整个；很"},
    "ganze": {"lemma": "ganz", "g": "整个的"},
    "ganzes": {"lemma": "ganz", "g": "整个的"},
    "gar": {"lemma": "gar", "g": "完全（gar nicht 根本不）"},
    "genug": {"lemma": "genug", "g": "足够"},
    "gleich": {"lemma": "gleich", "g": "马上；同样"},
    "gleichzeitig": {"lemma": "gleichzeitig", "g": "同时"},
    "herzlich": {"lemma": "herzlich", "g": "衷心地"},
    "hierher": {"lemma": "hierher", "g": "到这里"},
    "lange": {"lemma": "lange", "g": "很久"},
    "mehr": {"lemma": "mehr", "g": "更多"},
    "meistens": {"lemma": "meistens", "g": "大多"},
    "manchmal": {"lemma": "manchmal", "g": "有时"},
    "natürlich": {"lemma": "natürlich", "g": "当然"},
    "positiv": {"lemma": "positiv", "g": "积极的"},
    "praktische": {"lemma": "praktisch", "g": "实际的"},
    "raus": {"lemma": "raus", "g": "出去"},
    "regelrecht": {"lemma": "regelrecht", "g": "真正地"},
    "richtig": {"lemma": "richtig", "g": "正确的"},
    "schnell": {"lemma": "schnell", "g": "快地"},
    "schnelle": {"lemma": "schnell", "g": "快的"},
    "stark": {"lemma": "stark", "g": "强烈地"},
    "stundenlang": {"lemma": "stundenlang", "g": "数小时地"},
    "tief": {"lemma": "tief", "g": "深地"},
    "unglaublich": {"lemma": "unglaublich", "g": "难以置信地"},
    "unterwegs": {"lemma": "unterwegs", "g": "在路上"},
    "viel": {"lemma": "viel", "g": "多"},
    "viele": {"lemma": "viele", "g": "许多"},
    "wirklich": {"lemma": "wirklich", "g": "真地"},
    "wunderbar": {"lemma": "wunderbar", "g": "美妙地"},
    "wunderbare": {"lemma": "wunderbar", "g": "美妙的"},
    "wunderbarer": {"lemma": "wunderbar", "g": "美妙的"},
    "zuerst": {"lemma": "zuerst", "g": "首先"},
    "wohler": {"lemma": "wohl", "g": "更自在（sich wohler fühlen）"},
    # 库外动词/动词词形
    "abgeschlossen": {"lemma": "abschließen", "g": "完成（过）"},
    "abschaffen": {"lemma": "abschaffen", "g": "废除；取消"},
    "angeschaut": {"lemma": "anschauen", "g": "看过"},
    "antwortet": {"lemma": "antworten", "g": "回答"},
    "ausweiten": {"lemma": "ausweiten", "g": "扩大"},
    "backt": {"lemma": "backen", "g": "烤"},
    "beginnt": {"lemma": "beginnen", "g": "开始"},
    "bekommt": {"lemma": "bekommen", "g": "得到"},
    "bereit": {"lemma": "bereit", "g": "准备好的"},
    "bereite": {"lemma": "bereiten", "g": "（我）准备"},
    "bietet": {"lemma": "bieten", "g": "提供"},
    "billig": {"lemma": "billig", "g": "便宜的"},
    "billiger": {"lemma": "billig", "g": "更便宜的"},
    "blühen": {"lemma": "blühen", "g": "开花"},
    "entdeckt": {"lemma": "entdecken", "g": "发现"},
    "entspannter": {"lemma": "entspannt", "g": "更放松的"},
    "entsteht": {"lemma": "entstehen", "g": "产生；形成"},
    "erbt": {"lemma": "erben", "g": "继承"},
    "erzählt": {"lemma": "erzählen", "g": "讲述"},
    "fährt": {"lemma": "fahren", "vid": "traffic-40"},
    "fängt": {"lemma": "fangen", "g": "开始（es fängt an）"},
    "finden": {"lemma": "finden", "g": "找到；认为"},
    "findet": {"lemma": "finden", "g": "找到；认为"},
    "frage": {"lemma": "fragen", "vid": "traffic-50"},
    "gärtnern": {"lemma": "gärtnern", "g": "做园艺"},
    "habe": {"lemma": "haben", "g": "（我）有"},
    "haben": {"lemma": "haben", "g": "有"},
    "hast": {"lemma": "haben", "g": "（你）有"},
    "hat": {"lemma": "haben", "g": "有"},
    "hatten": {"lemma": "haben", "g": "有（过去时）"},
    "halten": {"lemma": "halten", "g": "认为；看待"},
    "herkommt": {"lemma": "herkommen", "g": "来自"},
    "isst": {"lemma": "essen", "vid": "food-50"},
    "esse": {"lemma": "essen", "vid": "food-50"},
    "essen": {"lemma": "essen", "vid": "food-50"},
    "Essen": {"lemma": "das Essen", "vid": "food-0"},  # 精确键：名词餐食
    "gegessen": {"lemma": "essen", "vid": "food-50"},
    "kühlt": {"lemma": "kühlen", "g": "使凉爽"},
    "lade": {"lemma": "einladen", "vid": "a2-festival-41"},
    "lauschen": {"lemma": "lauschen", "g": "倾听"},
    "leisten": {"lemma": "leisten", "g": "作出（Beitrag leisten）"},
    "leuchten": {"lemma": "leuchten", "g": "发光"},
    "liegt": {"lemma": "liegen", "g": "放着；位于"},
    "losließ": {"lemma": "loslassen", "g": "放开（过）"},
    "mag": {"lemma": "mögen", "g": "喜欢"},
    "magst": {"lemma": "mögen", "g": "喜欢"},
    "meint": {"lemma": "meinen", "g": "认为"},
    "nickt": {"lemma": "nicken", "g": "点头"},
    "nutzen": {"lemma": "nutzen", "g": "使用"},
    "passierte": {"lemma": "passieren", "g": "发生（过）"},
    "planen": {"lemma": "planen", "g": "计划"},
    "riecht": {"lemma": "riechen", "g": "闻；闻起来"},
    "rufen": {"lemma": "rufen", "g": "喊；打电话"},
    "rührt": {"lemma": "rühren", "g": "搅拌"},
    "schlage": {"lemma": "schlagen", "g": "（我）打；提议"},
    "sitzen": {"lemma": "sitzen", "g": "坐"},
    "sitzt": {"lemma": "sitzen", "g": "坐"},
    "stattfinden": {"lemma": "stattfinden", "g": "举行"},
    "stehe": {"lemma": "stehen", "g": "（我）站"},
    "steht": {"lemma": "stehen", "g": "站；写着"},
    "steigt": {"lemma": "steigen", "g": "登上"},
    "steiler": {"lemma": "steil", "g": "更陡的"},
    "stelle": {"lemma": "stellen", "g": "放置；提出"},
    "streiten": {"lemma": "streiten", "g": "争吵"},
    "testweise": {"lemma": "testweise", "g": "试行地"},
    "unterbrochen": {"lemma": "unterbrechen", "g": "被打断"},
    "unterhielten": {"lemma": "unterhalten", "g": "交谈（过）"},
    "unterstützt": {"lemma": "unterstützen", "g": "支持"},
    "verbessert": {"lemma": "verbessern", "g": "改善（过）"},
    "vermisse": {"lemma": "vermissen", "g": "想念"},
    "vermisste": {"lemma": "vermissen", "g": "想念（过）"},
    "wachsen": {"lemma": "wachsen", "g": "生长"},
    "wächst": {"lemma": "wachsen", "g": "生长"},
    "winkt": {"lemma": "winken", "g": "挥手"},
    "wünschen": {"lemma": "wünschen", "g": "希望"},
    "zeige": {"lemma": "zeigen", "g": "（我）展示"},
    "zugreifen": {"lemma": "zugreifen", "g": "抓住；抢购"},
    "ändern": {"lemma": "ändern", "g": "改变"},
    "zusammengearbeitet": {"lemma": "zusammenarbeiten", "g": "合作（过）"},
    "gezogen": {"lemma": "ziehen", "g": "搬家（过）"},
    "gezeltet": {"lemma": "zelten", "g": "搭帐篷（过）"},
    "gegrüßt": {"lemma": "grüßen", "g": "问候（过）"},
    "grüßt": {"lemma": "grüßen", "g": "问候"},
    "griff": {"lemma": "greifen", "g": "抓（过）"},
    "gebrannte": {"lemma": "brennen", "g": "烤的（gebrannt）"},
    "gehöre": {"lemma": "gehören", "g": "（我）属于"},
    "gepolsterten": {"lemma": "gepolstert", "g": "有软垫的"},
    "handschriftlichen": {"lemma": "handschriftlich", "g": "手写的"},
    "interessantes": {"lemma": "interessant", "vid": "free-36"},
    "ernsthafte": {"lemma": "ernsthaft", "g": "认真的"},
    "erreichbar": {"lemma": "erreichbar", "g": "可联系到的"},
    "erste": {"lemma": "erst", "g": "第一的"},
    "ersten": {"lemma": "erst", "g": "第一的"},
    "konzentriert": {"lemma": "konzentrieren", "g": "专注（过）"},
    "leerer": {"lemma": "leer", "g": "更空的"},
    "neue": {"lemma": "neu", "g": "新的"},
    "neues": {"lemma": "neu", "g": "新的"},
    "nervös": {"lemma": "nervös", "g": "紧张的"},
    "nass": {"lemma": "nass", "g": "湿的"},
    "möglich": {"lemma": "möglich", "g": "可能的"},
    "halb": {"lemma": "halb", "g": "半"},
    "halbem": {"lemma": "halb", "g": "半的"},
    "bergauf": {"lemma": "bergauf", "g": "上坡（地）"},
    "los": {"lemma": "los", "g": "出发（losrennen）；离开"},
    "besonderen": {"lemma": "besonders", "g": "特别的"},
    "besonders": {"lemma": "besonders", "g": "特别"},
    "schlimm": {"lemma": "schlimm", "g": "糟糕的"},
    "schlimmer": {"lemma": "schlimm", "g": "更糟"},
    "scheu": {"lemma": "scheu", "g": "胆怯的"},
    "lieb": {"lemma": "lieb", "g": "亲爱的；乖"},
    "liebsten": {"lemma": "lieb", "g": "最喜欢（am liebsten）"},
    "wichtiges": {"lemma": "wichtig", "g": "重要的"},
    "selbst": {"lemma": "selbst", "g": "自己；甚至"},
    "sich": {"lemma": "sich", "g": "自己（反身代词）"},
    "man": {"lemma": "man", "g": "人们；有人"},
    "manche": {"lemma": "manche", "g": "有些"},
    "mal": {"lemma": "mal", "g": "（一）次；…吧（口语）"},
    "solcher": {"lemma": "solch", "g": "这样的"},
    # 库外名词（复合词与常用名词）
    "alm": {"lemma": "Alm", "g": "高山牧场"},
    "apfelkuchen": {"lemma": "Apfelkuchen", "g": "苹果蛋糕"},
    "apfelmus": {"lemma": "Apfelmus", "g": "苹果泥"},
    "aufgaben": {"lemma": "Aufgabe", "g": "任务"},
    "aussicht": {"lemma": "Aussicht", "g": "景色"},
    "autorin": {"lemma": "Autorin", "g": "女作家"},
    "bahnsteig": {"lemma": "Bahnsteig", "g": "站台"},
    "begleiter": {"lemma": "Begleiter", "g": "陪伴者；随身好物"},
    "beratung": {"lemma": "Beratung", "g": "咨询"},
    "blick": {"lemma": "Blick", "g": "目光"},
    "butterbrot": {"lemma": "Butterbrot", "g": "黄油面包"},
    "butterbrote": {"lemma": "Butterbrot", "g": "黄油面包（复数）"},
    "chor": {"lemma": "Chor", "g": "合唱团"},
    "damenfahrrad": {"lemma": "Damenfahrrad", "g": "女士自行车"},
    "dank": {"lemma": "Dank", "g": "感谢"},
    "display": {"lemma": "Display", "g": "屏幕"},
    "ende": {"lemma": "Ende", "g": "结束"},
    "ernte": {"lemma": "Ernte", "g": "收获"},
    "fahrt": {"lemma": "Fahrt", "g": "车程"},
    "familiengeschichten": {"lemma": "Familiengeschichte", "g": "家族故事"},
    "fazit": {"lemma": "Fazit", "g": "结论；总结"},
    "fußballverein": {"lemma": "Fußballverein", "g": "足球俱乐部"},
    "gedanken": {"lemma": "Gedanke", "g": "想法"},
    "gemeinschaftsgarten": {"lemma": "Gemeinschaftsgarten", "g": "社区花园"},
    "gepäckträger": {"lemma": "Gepäckträger", "g": "（自行车）行李架"},
    "gleis": {"lemma": "Gleis", "g": "（铁轨）站台"},
    "gänge": {"lemma": "Gang", "g": "挡位；齿轮级"},
    "hallo": {"lemma": "Hallo", "g": "你好"},
    "hochhäusern": {"lemma": "Hochhaus", "g": "高楼"},
    "honig": {"lemma": "Honig", "g": "蜂蜜"},
    "idee": {"lemma": "Idee", "g": "主意"},
    "informationen": {"lemma": "Information", "g": "信息"},
    "interesse": {"lemma": "Interesse", "g": "兴趣"},
    "interessenten": {"lemma": "Interessent", "g": "有意者"},
    "karteikarten": {"lemma": "Karteikarte", "g": "抽认卡"},
    "kartoffelpuffer": {"lemma": "Kartoffelpuffer", "g": "土豆饼"},
    "klasse": {"lemma": "Klasse", "g": "班级；（口）太棒了"},
    "kontakt": {"lemma": "Kontakt", "g": "联系"},
    "kostprobe": {"lemma": "Kostprobe", "g": "品尝样品"},
    "kühe": {"lemma": "Kuh", "g": "奶牛"},
    "letzte": {"lemma": "letzt", "g": "最后的"},
    "letzten": {"lemma": "letzt", "g": "最后的"},
    "letzter": {"lemma": "letzt", "g": "最后的"},
    "lichter": {"lemma": "Licht", "g": "灯光"},
    "lust": {"lemma": "Lust", "g": "兴致"},
    "mannschaften": {"lemma": "Mannschaft", "g": "球队"},
    "meetings": {"lemma": "Meeting", "g": "会议"},
    "mehl": {"lemma": "Mehl", "g": "面粉"},
    "mensa": {"lemma": "Mensa", "g": "（大学/学校）食堂"},
    "mitarbeiter": {"lemma": "Mitarbeiter", "g": "员工"},
    "mittag": {"lemma": "Mittag", "g": "中午"},
    "modell": {"lemma": "Modell", "g": "型号；模型"},
    "nachbarschaft": {"lemma": "Nachbarschaft", "g": "邻里"},
    "notizen": {"lemma": "Notiz", "g": "笔记"},
    "ofen": {"lemma": "Ofen", "g": "烤箱"},
    "oma": {"lemma": "Oma", "g": "奶奶；外婆"},
    "opa": {"lemma": "Opa", "g": "爷爷；外公"},
    "ort": {"lemma": "Ort", "g": "地点"},
    "pendler": {"lemma": "Pendler", "g": "通勤者"},
    "platz": {"lemma": "Platz", "g": "座位；广场"},
    "probefahrt": {"lemma": "Probefahrt", "g": "试骑"},
    "regeln": {"lemma": "Regel", "g": "规则"},
    "rentner": {"lemma": "Rentner", "g": "退休者"},
    "samstagmorgen": {"lemma": "Samstagmorgen", "g": "周六早晨"},
    "schlaf": {"lemma": "Schlaf", "g": "睡眠"},
    "schule": {"lemma": "Schule", "g": "学校"},
    "sitz": {"lemma": "Sitz", "g": "座位"},
    "sonnenblumen": {"lemma": "Sonnenblume", "g": "向日葵"},
    "sonnenuntergang": {"lemma": "Sonnenuntergang", "g": "日落"},
    "sportplatz": {"lemma": "Sportplatz", "g": "运动场"},
    "sportschuhe": {"lemma": "Sportschuh", "g": "运动鞋"},
    "stand": {"lemma": "Stand", "g": "摊位"},
    "strauß": {"lemma": "Strauß", "g": "花束"},
    "süßes": {"lemma": "Süßes", "g": "甜点"},
    "trainingseinheiten": {"lemma": "Trainingseinheit", "g": "训练（单元）"},
    "treffpunkt": {"lemma": "Treffpunkt", "g": "集合点"},
    "unterricht": {"lemma": "Unterricht", "g": "课程"},
    "viertel": {"lemma": "Viertel", "g": "一刻钟"},
    "vorteile": {"lemma": "Vorteil", "g": "好处"},
    "wanderung": {"lemma": "Wanderung", "g": "徒步"},
    "was": {"lemma": "was", "g": "什么"},
    "wasserflasche": {"lemma": "Wasserflasche", "g": "水瓶"},
    "weihnachtslieder": {"lemma": "Weihnachtslied", "g": "圣诞歌曲"},
    "wiesen": {"lemma": "Wiese", "g": "草地"},
    "winterabende": {"lemma": "Winterabend", "g": "冬夜"},
    "zimt": {"lemma": "Zimt", "g": "肉桂"},
    # 自动映射的纠错（专名/词类误判/机器释义不可靠——逐词核对后的修正）
    "anfänger": {"lemma": "Anfänger", "g": "初学者"},
    "bitte": {"lemma": "bitte", "vid": "greet-41"},
    "gelaufen": {"lemma": "laufen", "g": "跑；进行（过）"},
    "geschwommen": {"lemma": "schwimmen", "vid": "a2-sport-42"},
    "junge": {"lemma": "jung", "vid": "family-40"},
    "mandeln": {"lemma": "Mandel", "g": "杏仁"},
    "nächsten": {"lemma": "nächst", "g": "下一个的"},
    "pilze": {"lemma": "Pilz", "g": "蘑菇"},
    "profi": {"lemma": "Profi", "g": "专业人士"},
    "schwer": {"lemma": "schwer", "g": "难的；重的"},
    "schweren": {"lemma": "schwer", "g": "难的"},
    "seine": {"lemma": "sein", "g": "他的"},
    "seinen": {"lemma": "sein", "g": "他的"},
    "seiner": {"lemma": "sein", "g": "他的"},
    "sie": {"lemma": "sie", "g": "她/他们；（尊称 Sie）您"},
    "sein": {"lemma": "sein", "g": "他的；（动词 sein）是"},
    "stock": {"lemma": "Stock", "g": "棍；枝条"},
    "waren": {"lemma": "sein", "g": "是（过去时）"},
    "weiter": {"lemma": "weiter", "g": "继续；进一步的"},
    "weitere": {"lemma": "weiter", "g": "更多的"},
    "wollen": {"lemma": "wollen", "g": "想要"},
    "zelt": {"lemma": "Zelt", "g": "帐篷"},
    "obst": {"lemma": "Obst", "g": "水果"},
    "jahreszeit": {"lemma": "Jahreszeit", "g": "季节"},
    "kakao": {"lemma": "Kakao", "g": "可可"},
    "weber": {"lemma": "Weber", "g": "韦伯（姓）"},
    "jeder": {"lemma": "jeder", "g": "每个（的）"},
    "jedem": {"lemma": "jeder", "g": "每个（的，第三格）"},
    "jeden": {"lemma": "jeder", "g": "每个（的，第四格）"},
    "kette": {"lemma": "Kette", "g": "链条"},
    "mechaniker": {"lemma": "Mechaniker", "g": "机械师"},
    "navigation": {"lemma": "Navigation", "g": "导航"},
    "weg": {"lemma": "weg", "g": "不在；离开（weg sein）"},
    "Weg": {"lemma": "der Weg", "vid": "traffic-33"},  # 精确键：名词路,
    # P2-1 错义项纠正：词库同键不同义，按语境消歧
    "bank": {"lemma": "Bank", "g": "长椅"},  # 语境长椅，非银行（shop-35 银行）
    "stolz": {"lemma": "stolz", "vid": "a2-feelings-47"},  # 形容词骄傲，非名词 der Stolz
    "voll": {"lemma": "voll", "g": "满的；充实的"},  # 语境「满」，非口语「超」（b1-colloquial-10）
    "recht": {"lemma": "Recht", "g": "对的（recht haben）"},  # 非法律（b1-law-6）
    # P2-2：ein 的变格形式（wiktionary 锚点 ein#Artikel/ein#Numerale 已剥除）
    "einem": {"lemma": "ein", "g": "一（个，第三格）"},
    "einer": {"lemma": "ein", "g": "一（个，阴性）"},
    "alle": {"lemma": "alle", "g": "全部；所有人"},
    "allen": {"lemma": "alle", "g": "全部（第三格）"},
    "andere": {"lemma": "anderer", "g": "其他的"},
    "dort": {"lemma": "dort", "g": "那里"},
    "echtes": {"lemma": "echt", "g": "真正的"},
    "hart": {"lemma": "hart", "g": "艰难的；硬的"},
    "spaß": {"lemma": "Spaß", "g": "乐趣"},
    "mein": {"lemma": "mein", "g": "我的"},
    "meine": {"lemma": "mein", "g": "我的"},
    "meinem": {"lemma": "mein", "g": "我的"},
    "meinen": {"lemma": "mein", "g": "我的"},
    "meiner": {"lemma": "mein", "g": "我的"},
    "e-bike": {"lemma": "E-Bike", "g": "电助力自行车"},
}

# 词 token：字母（含变元音）与内部连字符
WORD_RE = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
ARTICLES = re.compile(r"^(?:der|die|das|ein|eine|einen|sich)\s+", re.IGNORECASE)
# 规则还原候选后缀（长在前）
VERB_SUFFIXES = ("est", "et", "st", "en", "t", "e", "n")
NOUN_SUFFIXES = ("ern", "en", "er", "n", "e", "s")
ADJ_SUFFIXES = ("en", "er", "es", "em", "e")
UMLAUT = str.maketrans("äöüÄÖÜ", "aouAOU")


def parse_src():
    """解析 data/reading_texts.src.js → [{id,title,level,theme,text}]"""
    text = (ROOT / "data" / "reading_texts.src.js").read_text(encoding="utf-8")
    blocks = re.split(r"id:\s*'(rd-[\w-]+)'", text)  # [前言, id1, 块1, ...]
    items = []
    for i in range(1, len(blocks) - 1, 2):
        rid, chunk = blocks[i], blocks[i + 1]
        title = re.search(r"title:\s*'((?:[^'\\]|\\.)*)'", chunk)
        level = re.search(r"level:\s*'(A1|A2|B1)'", chunk)
        theme = re.search(r"theme:\s*'((?:[^'\\]|\\.)*)'", chunk)
        body = re.search(r"text:\s*'((?:[^'\\]|\\.)*)'", chunk)
        if not (title and level and theme and body):
            print(f"✗ 解析失败 {rid}：字段缺失")
            sys.exit(1)
        raw = body.group(1).replace("\\n", "\n")
        items.append({"id": rid, "title": title.group(1),
                      "level": level.group(1), "theme": theme.group(1),
                      "text": raw})
    return items


def load_lexicon():
    """解析 data/vocabulary*.js → {词形键: (vid, 词, 词性, 中文)}；键 = 去冠词 lemma 小写"""
    lex = {}
    theme_id = None
    index = 0
    for vf in sorted((ROOT / "data").glob("vocabulary*.js")):
        for line in vf.read_text(encoding="utf-8").splitlines():
            m = re.search(r"id:\s*'([\w-]+)'", line)
            if m:
                theme_id, index = m.group(1), 0
                continue
            if theme_id and line.lstrip().startswith("['"):
                parts = re.findall(r"'((?:[^'\\]|\\.)*)'", line)
                if len(parts) >= 3:
                    word, pos, zh = parts[0], parts[1], parts[2]
                    key = ARTICLES.sub("", word).strip().lower()
                    if key and key not in lex:
                        lex[key] = (f"{theme_id}-{index}", word, pos, zh)
                    index += 1
    return lex


def tokenize(text):
    """纯文本 → [('p', 标点) | ('w', 词)]，保持顺序；\n\n 分段"""
    tokens = []
    for raw in text.split():
        m = WORD_RE.search(raw)
        if not m:
            tokens.append(("p", raw))
            continue
        if m.start() > 0:
            tokens.append(("p", raw[:m.start()]))
        tokens.append(("w", m.group(0)))
        if m.end() < len(raw):
            tokens.append(("p", raw[m.end():]))
    return tokens


def candidates_umlaut(bases):
    """同一词基的变元音还原变体"""
    out = []
    for b in bases:
        v = b.translate(UMLAUT)
        if v != b:
            out.append(v)
    return out


def rule_lemma(word, lex):
    """规则还原：返回 (lemma, src)。lemma 为命中词库的键，未命中返回 (None, None)。"""
    w = word
    lower = w.lower()
    # 动词：-est/-et/-st/-t/-en/-e/-n → 词干 + en
    if not w[0].isupper():
        for suf in VERB_SUFFIXES:
            if lower.endswith(suf) and len(lower) - len(suf) >= 3:
                cand = [lower[:-len(suf)] + "en"]
                cand += candidates_umlaut(cand)
                for c in cand:
                    if c in lex:
                        return c, f"rule-verb-{suf}"
        # 过去分词：ge…t/en → 词干 + en；含可分/不可分前缀时在 ge 处切开再还原
        parts = None
        if lower.startswith("ge"):
            parts = ["", lower[2:]]
        elif "ge" in lower and (lower.endswith("en") or lower.endswith("et")):
            pre, rest = lower.rsplit("ge", 1)
            parts = [pre, rest]
        if parts:
            rest = parts[1]
            tails = ("en", "et", "t") if rest.endswith(("en", "et")) else ("t",)
            for suf in tails:
                if rest.endswith(suf) and len(rest) - len(suf) >= 3:
                    cand = [parts[0] + rest[:-len(suf)] + "en"]
                    cand += candidates_umlaut(cand)
                    for c in cand:
                        if c in lex:
                            return c, "rule-partizip"
    # 形容词词尾：-en/-er/-es/-em/-e
    if not w[0].isupper():
        for suf in ADJ_SUFFIXES:
            if lower.endswith(suf) and len(lower) - len(suf) >= 3:
                cand = [lower[:-len(suf)]]
                cand += candidates_umlaut(cand)
                for c in cand:
                    if c in lex:
                        return c, f"rule-adj-{suf}"
    # 名词复数/变格：-ern/-en/-er/-n/-e/-s
    for suf in NOUN_SUFFIXES:
        if lower.endswith(suf) and len(lower) - len(suf) >= 3:
            cand = [lower[:-len(suf)]]
            cand += candidates_umlaut(cand)
            for c in cand:
                if c in lex:
                    return c, f"rule-noun-{suf}"
    return None, None


DEWIKT_CACHE = {}


def german_section(wt, word):
    """截取 de.wiktionary 页面的德语节（== word ({{Sprache|Deutsch}}) == 起，
    到下一个语言节标题止）。多语言词条若全文匹配会抓到拉丁/索布等语节，必须截断。"""
    m = re.search(r"^==\s*" + re.escape(word) +
                  r"\s*\(\{\{Sprache\|Deutsch\}\}\)\s*==\s*$", wt, re.M)
    if not m:
        m = re.search(r"^==\s*[^\n(]+\s*\(\{\{Sprache\|Deutsch\}\}\)\s*==\s*$",
                      wt, re.M)
    if not m:
        return None
    start = m.end()
    nxt = re.search(r"^==[^=\n][^\n]*?==\s*$", wt[start:], re.M)
    return wt[start:start + nxt.start()] if nxt else wt[start:]


def dewikt_lemma(word):
    """de.wiktionary：词形页 → (lemma, 中文释义或 None)。带内存+磁盘缓存。

    lemma 提取（按序）：重定向页 → 德语节内 Grundformverweis(Konj/Dekl) →
    「des Verbs/Substantivs/Adjektivs [[X]]」形态说明 → 词形自身（独立词条）。
    """
    if word in DEWIKT_CACHE:
        return DEWIKT_CACHE[word]
    lemma, gloss = None, None
    wt = dewikt.fetch_wikitext(word)
    if wt:
        m = re.search(r"\{\{Weiterleitung\|([^}|]+)", wt)
        if m:
            lemma = m.group(1).strip()
        else:
            de = german_section(wt, word)
            if de:
                # 仅当德语节首词类是「词形」（变位/变格/分词等）时才取 Grundform；
                # 独立词条（连词/副词/名词等基础词类）以自身为 lemma，
                # 否则后面的「Konjugierte Form」小节会劫持 lemma（如 aber→abern）
                first_wa = re.search(r"===\s*\{\{Wortart\|([^|}]+)", de)
                is_form = first_wa and any(
                    t in first_wa.group(1) for t in
                    ("Konjugierte Form", "Deklinierte Form", "Partizip",
                     "Komparativ", "Superlativ", "Gerundivum", "Imperativ"))
                if is_form:
                    m = re.search(r"\{\{Grundformverweis[^|}]*\|([^}|]+)", de)
                    if not m:
                        m = re.search(
                            r"des (?:Verbs|Substantivs|Adjektivs)[^\n]*?'''?\[\[([^\]|]+)",
                            de)
                    lemma = m.group(1).strip() if m else word
                else:
                    lemma = word
                gloss = extract_zh(de)
        if lemma:
            lemma = lemma.split("#")[0].strip()  # 剥 wiktionary 锚点（ein#Artikel → ein）
        if lemma and lemma != word and gloss is None:
            wt2 = dewikt.fetch_wikitext(lemma)
            if wt2:
                gloss = extract_zh(wt2)
                if gloss is None:
                    de2 = german_section(wt2, lemma)
                    if de2:
                        gloss = extract_zh(de2)
    DEWIKT_CACHE[word] = (lemma, gloss)
    return lemma, gloss


def extract_zh(wt):
    """de.wiktionary {{Übersetzungen}} 里的中文释义（简体优先，首条）。

    实际格式是列表项：「**{{zh-cn}}: {{Üt|zh-cn|面包师|miànbāoshī}}」。
    """
    m = (re.search(r"\{\{zh-cn\}\}\s*:\s*\{\{Üt?\|[^|}]+\|([^|}]+)", wt)
         or re.search(r"\{\{zh\}\}\s*:\s*\{\{Üt?\|[^|}]+\|([^|}]+)", wt))
    return m.group(1).strip() if m else None


def resolve(form, text_id, lex):
    """词形 → (token dict 增量, 来源)。优先级：OVERRIDES > 直接 > 规则 > dewikt。

    OVERRIDES 键：精确词形（区分大小写，如 Essen/Weg）优先于小写词形；
    条目可带 "texts": [篇目 id] 按篇限定（同形异义词，如姓氏 Sommer 只在
    rd-a1-aushang 生效，其余篇目季节义走词库直命中）。
    """
    ov = LEXICON_OVERRIDES.get(form) or LEXICON_OVERRIDES.get(form.lower())
    if ov and text_id in ov.get("texts", [text_id]):
        return {k: ov[k] for k in ("lemma", "vid", "g") if k in ov}, "override"
    lower = form.lower()
    if lower in lex:
        vid, word, _, _ = lex[lower]
        return {"lemma": word, "vid": vid}, "direct"
    lemma, src = rule_lemma(form, lex)
    if lemma:
        vid, word, _, _ = lex[lemma]
        return {"lemma": word, "vid": vid}, src
    dlemma, gloss = dewikt_lemma(form)
    if dlemma:
        key = dlemma.lower()
        if key in lex:
            vid, word, _, _ = lex[key]
            return {"lemma": word, "vid": vid}, "dewikt-vid"
        if gloss:
            return {"lemma": dlemma, "g": gloss}, "dewikt-g"
        return {"lemma": dlemma, "g": ""}, "dewikt-nozh"  # 待人工补 g
    return {}, "unresolved"


def main():
    items = parse_src()
    lex = load_lexicon()
    print(f"词库 {len(lex)} 词；短文 {len(items)} 篇")

    report = {}       # form -> (info, src)
    unresolved = []
    out_texts = []
    for it in items:
        paragraphs = []
        n_words = 0
        for para in re.split(r"\n\s*\n", it["text"].strip()):
            toks = []
            for kind, val in tokenize(para):
                if kind == "p":
                    toks.append({"w": val})
                    continue
                n_words += 1
                info, src = resolve(val, it["id"], lex)
                if (not info or (("vid" not in info) and ("g" not in info))
                        or not info.get("lemma")
                        or ("g" in info and not info["g"])):
                    unresolved.append((it["id"], val))
                    info = {"lemma": val.lower()}
                    src = "UNRESOLVED"
                report[val] = (info, src)
                tok = {"w": val}
                tok.update(info)
                toks.append(tok)
            paragraphs.append(toks)
        out_texts.append({"id": it["id"], "title": it["title"],
                          "level": it["level"], "theme": it["theme"],
                          "words": n_words, "paragraphs": paragraphs})

    n_vid = sum(1 for i, _ in report.values() if "vid" in i)
    n_g = sum(1 for i, _ in report.values() if "g" in i)
    print(f"\n=== 映射报告 ===\n词形总数（unique）{len(report)}；命中词库 vid {n_vid}；"
          f"库外词 g {n_g}；未决 {len(unresolved)}")
    print("--- 逐词映射（核对此表：不规则动词与复合词为重点） ---")
    for form in sorted(report, key=str.lower):
        info, src = report[form]
        if "vid" in info:
            detail = f"vid={info['vid']}"
        elif info.get("g"):
            detail = f"g={info['g']}"
        else:
            detail = "g=〈缺中文，待人工〉"
        print(f"  {form:<24} -> {info.get('lemma','?'):<24} [{src}] {detail}")

    if unresolved:
        print(f"\n✗ 未决词 {len(unresolved)}（须补 LEXICON_OVERRIDES 或修数据）：")
        for rid, val in unresolved:
            print(f"  {rid}: {val}")
        sys.exit(1)

    header = ("/* 由 tools/build_reading_tokens.py 自动生成，勿手改。\n"
              "   作者手写层：data/reading_texts.src.js（改内容改那里，重跑本脚本） */\n")
    body = json.dumps(out_texts, ensure_ascii=False, indent=1)
    (ROOT / "data" / "reading.js").write_text(header + "window.READING_TEXTS = " +
                                              body + ";\n", encoding="utf-8")
    print(f"\n完成：data/reading.js（{len(out_texts)} 篇，未决 0）")


if __name__ == "__main__":
    main()
