/* 阅读短文（S8 阅读模块）——作者手写层。
   由 tools/build_reading_tokens.py 加工为 data/reading.js（含 tokens），本文件为唯一手改入口。
   约定：
   - id：rd- 前缀 + 级别段（rd-a1-/rd-a2-/rd-b1-），全局唯一
   - 篇幅：A1 60–90 词 / A2 80–120 词 / B1 120–150 词（词 = 含字母的空白切分单位）
   - i+1：以该级别已学词汇为主，超纲词 ≤10%
   - text：纯德文，\n\n 分段；数字一律拼写为单词（利于 TTS 与分级阅读）
   - 题材与听力 20 组对话场景不雷同 */
window.READING_TEXTS_SRC = [
  {
    id: 'rd-a1-park', title: '公园里的星期六', level: 'A1', theme: '空闲活动与爱好',
    text: 'Am Samstag ist das Wetter schön. Die Sonne scheint und es ist warm. Maria geht mit ihrem Hund in den Park. Der Hund heißt Bello. Er ist braun und sehr freundlich. Im Park sind viele Leute. Kinder spielen mit einem Ball, und zwei alte Männer sitzen auf einer Bank. Maria wirft einen Stock, und Bello rennt los. Nach einer Stunde sind Maria und Bello müde. Sie gehen nach Hause und trinken Wasser. Maria lacht: „Der Park ist immer eine gute Idee!“'
  },
  {
    id: 'rd-a1-kueche', title: '和奶奶烤蛋糕', level: 'A1', theme: '饮食',
    text: 'Am Sonntag backt Leo mit seiner Oma einen Kuchen. Sie brauchen Mehl, Eier, Zucker und Milch. Oma erklärt alles langsam. Leo rührt die Eier in einer Schüssel. Dann kommt das Mehl dazu. „Nicht zu schnell!“, sagt Oma und lacht. Leo hat etwas Mehl auf dem T-Shirt – das sieht lustig aus! Nach vierzig Minuten ist der Kuchen fertig. Er riecht gut. Die Familie isst den Kuchen zusammen beim Kaffee. Leo findet: Selbst gemacht schmeckt am besten.'
  },
  {
    id: 'rd-a1-zugfahrt', title: '第一次独自坐火车', level: 'A1', theme: '交通与旅行',
    text: 'Jonas fährt zum ersten Mal allein mit dem Zug zu seinen Großeltern. Am Bahnhof kauft er eine Fahrkarte. Sein Zug kommt um neun Uhr auf Gleis drei. Jonas findet seinen Platz und sitzt ans Fenster. Draußen sieht er Wiesen, Häuser und Kühe. Nach einer Stunde steigt er aus. Opa wartet schon auf dem Bahnsteig und winkt. „Alles gut gelaufen?“, fragt er. Jonas nickt stolz. Die Fahrt war gar nicht schwer – sie macht sogar Spaß!'
  },
  {
    id: 'rd-a1-wetter', title: '四季与我', level: 'A1', theme: '天气与季节',
    text: 'Hallo! Ich heiße Emma und ich schreibe über das Wetter. Im Frühling ist es oft kühl, aber die Blumen kommen. Im Sommer ist es heiß. Dann fahren viele Leute an den See oder in den Wald. Im Herbst regnet es viel und die Blätter sind bunt. Im Winter schneit es manchmal. Ich mag den Winter, weil die Welt dann so ruhig ist. Und du? Welche Jahreszeit magst du am liebsten? Schreib mir!'
  },
  {
    id: 'rd-a1-aushang', title: '寻猫启事', level: 'A1', theme: '居住与家居',
    text: 'ACHTUNG! Unsere Katze Paula ist weg! Sie ist grau und weiß und hat große grüne Augen. Paula ist etwas scheu, aber ganz lieb. Sie wohnt mit uns in der Bergstraße zwölf. Vielleicht sehen Sie sie im Garten, im Keller oder auf der Straße. Bitte rufen Sie Jonas an. Wer Paula findet, bekommt eine große Schokolade als Dank. Bitte helfen Sie uns! Familie Sommer'
  }
];
