/* 听力小对话：S7 听力模块，LLM 草稿，待 SLA 视角审核定稿。
   格式：{ id: 'dl-<级别>-<场景>', title, level, theme, lines: [{ sp, de, zh }],
          questions: [{ type: 'choice', q, opts, a, tip }] }
   角色约定：sp 'A' 固定女声（de-DE-KatjaNeural），sp 'B' 固定男声（de-DE-ConradNeural）；
   题目里的 die Frau / der Mann 分别指角色 A / B。 */
window.LISTEN_DIALOGS = [
  {
    id: 'dl-a1-greet', title: '新邻居', level: 'A1', theme: '问候与自我介绍',
    lines: [
      { sp: 'A', de: 'Hallo! Sind Sie neu hier im Haus?', zh: '你好！您是新搬来这栋楼的吗？' },
      { sp: 'B', de: 'Ja, genau. Ich heiße Thomas Weber. Und Sie?', zh: '是的，没错。我叫托马斯·韦伯。您呢？' },
      { sp: 'A', de: 'Anna Klein, freut mich. Ich wohne im ersten Stock.', zh: '安娜·克莱因，很高兴认识您。我住在二楼。' },
      { sp: 'B', de: 'Freut mich auch. Ich wohne jetzt im Erdgeschoss.', zh: '我也很高兴。我现在住在一楼。' },
      { sp: 'A', de: 'Schön! Dann sind wir ja Nachbarn.', zh: '太好了！那我们就是邻居啦。' }
    ],
    questions: [
      { type: 'choice', q: 'Wo sprechen die beiden?', opts: ['Im Bus', 'Im Supermarkt', 'Im Haus'], a: 2,
        tip: '两人初次见面、说住在哪一层，是邻居在楼里碰面的典型场景。' },
      { type: 'choice', q: 'Wo wohnt Anna?', opts: ['Im ersten Stock', 'Im Erdgeschoss', 'Im dritten Stock'], a: 0,
        tip: 'Anna 说自己住在 erster Stock。德语里 Erdgeschoss 是地面层（中文一楼），erster Stock 是它上面的一层（中文二楼）。' },
      { type: 'choice', q: 'Was sind Anna und Thomas jetzt?', opts: ['Kollegen', 'Nachbarn', 'Freunde'], a: 1,
        tip: '最后一句 Dann sind wir ja Nachbarn——从现在起两人是同一栋楼的邻居。' }
    ]
  },
  {
    id: 'dl-a1-food', title: '在咖啡馆', level: 'A1', theme: '饮食',
    lines: [
      { sp: 'A', de: 'Guten Tag! Was möchten Sie?', zh: '您好！您要点什么？' },
      { sp: 'B', de: 'Guten Tag. Ich möchte einen Kaffee, bitte.', zh: '您好。我要一杯咖啡。' },
      { sp: 'A', de: 'Mit Milch und Zucker?', zh: '要加牛奶和糖吗？' },
      { sp: 'B', de: 'Nur Milch, danke. Und ein Käsebrötchen, bitte.', zh: '只要牛奶，谢谢。再要一个奶酪小面包。' },
      { sp: 'A', de: 'Gern. Das macht zusammen drei Euro fünfzig.', zh: '好的。一共三欧五。' }
    ],
    questions: [
      { type: 'choice', q: 'Wo sind die beiden?', opts: ['Im Café', 'Im Büro', 'In der Schule'], a: 0,
        tip: '点咖啡和 Brötchen、当场结账，是咖啡馆或面包房的早晨场景。' },
      { type: 'choice', q: 'Was möchte der Mann trinken?', opts: ['Tee mit Milch', 'Wasser', 'Kaffee mit Milch'], a: 2,
        tip: '他要的是 Kaffee，而且 Nur Milch——只加奶，不加糖。' },
      { type: 'choice', q: 'Was kostet alles zusammen?', opts: ['Vier Euro fünfzehn', 'Drei Euro fünfzig', 'Fünf Euro dreißig'], a: 1,
        tip: 'Das macht zusammen drei Euro fünfzig：一共 3.5 欧。德语价格习惯说 drei Euro fünfzig，不说 Komma。' }
    ]
  },
  {
    id: 'dl-a1-shop', title: '买礼物', level: 'A1', theme: '购物与金钱',
    lines: [
      { sp: 'A', de: 'Guten Tag! Kann ich Ihnen helfen?', zh: '您好！需要我帮忙吗？' },
      { sp: 'B', de: 'Ja, gern. Ich suche ein Geschenk für meine Schwester.', zh: '好啊。我在给我妹妹找一件礼物。' },
      { sp: 'A', de: 'Wie gefällt Ihnen dieser Schal? Er kostet nur zwölf Euro.', zh: '您觉得这条围巾怎么样？只要十二欧。' },
      { sp: 'B', de: 'Der ist schön. Haben Sie ihn auch in Blau?', zh: '挺好看的。这条有蓝色的吗？' },
      { sp: 'A', de: 'Ja, hier in Blau, bitte. Ihre Schwester freut sich bestimmt!', zh: '有的，这条蓝色的。您妹妹一定会喜欢的！' }
    ],
    questions: [
      { type: 'choice', q: 'Wo findet der Dialog statt?', opts: ['Im Restaurant', 'Im Kino', 'Im Geschäft'], a: 2,
        tip: '售货员问 Kann ich Ihnen helfen?，又谈价格——是在商店里。' },
      { type: 'choice', q: 'Welche Farbe möchte der Mann?', opts: ['Blau', 'Rot', 'Braun'], a: 0,
        tip: 'Haben Sie ihn auch in Blau?——他想要蓝色。' },
      { type: 'choice', q: 'Wie viel kostet der Schal?', opts: ['Zehn Euro', 'Zwölf Euro', 'Zwanzig Euro'], a: 1,
        tip: 'Er kostet nur zwölf Euro——12 欧。' }
    ]
  },
  {
    id: 'dl-a1-time', title: '周末计划', level: 'A1', theme: '数字、时间与日期',
    lines: [
      { sp: 'A', de: 'Hallo Ben! Hast du am Samstag Zeit?', zh: '嗨，本！周六你有空吗？' },
      { sp: 'B', de: 'Hallo! Am Samstag arbeite ich leider. Aber am Sonntag habe ich Zeit.', zh: '嗨！周六我要上班，可惜没空。不过周日有空。' },
      { sp: 'A', de: 'Sonntag ist gut. Was machen wir?', zh: '周日可以。那我们做什么呢？' },
      { sp: 'B', de: 'Wir können ins Schwimmbad gehen. Um drei?', zh: '我们可以去游泳馆。三点怎么样？' },
      { sp: 'A', de: 'Super, um drei. Bis Sonntag!', zh: '太好了，三点。周日见！' }
    ],
    questions: [
      { type: 'choice', q: 'Wann treffen sich die beiden?', opts: ['Am Samstag', 'Am Sonntag', 'Am Montag'], a: 1,
        tip: 'Samstag 要上班，最后约在 Sonntag。' },
      { type: 'choice', q: 'Warum geht es am Samstag nicht?', opts: ['Anna ist krank', 'Anna ist im Urlaub', 'Ben arbeitet'], a: 2,
        tip: 'Am Samstag arbeite ich leider——周六 Ben 要工作。' },
      { type: 'choice', q: 'Was möchten sie machen?', opts: ['Ins Schwimmbad gehen', 'Ins Kino gehen', 'Fußball spielen'], a: 0,
        tip: 'Wir können ins Schwimmbad gehen——去游泳馆。' }
    ]
  },
  {
    id: 'dl-a1-traffic', title: '问路', level: 'A1', theme: '交通与旅行',
    lines: [
      { sp: 'A', de: 'Entschuldigung, wie komme ich zum Bahnhof?', zh: '请问，去火车站怎么走？' },
      { sp: 'B', de: 'Gehen Sie geradeaus, dann die erste Straße links.', zh: '您一直往前走，然后第一条街左转。' },
      { sp: 'A', de: 'Danke. Und wie lange dauert das?', zh: '谢谢。那要走多久呢？' },
      { sp: 'B', de: 'Etwa zehn Minuten zu Fuß. Oder Sie nehmen den Bus.', zh: '步行大约十分钟。您也可以坐公交车。' },
      { sp: 'A', de: 'Vielen Dank, dann nehme ich den Bus!', zh: '非常感谢，那我就坐公交！' }
    ],
    questions: [
      { type: 'choice', q: 'Wo möchte die Frau hin?', opts: ['Zum Hotel', 'Zum Bahnhof', 'Zur Apotheke'], a: 1,
        tip: 'wie komme ich zum Bahnhof——她在问去火车站的路。' },
      { type: 'choice', q: 'Wie lange dauert der Weg zu Fuß?', opts: ['Zehn Minuten', 'Fünf Minuten', 'Zwanzig Minuten'], a: 0,
        tip: 'Etwa zehn Minuten zu Fuß——步行大约十分钟。' },
      { type: 'choice', q: 'Wie kommt die Frau zum Bahnhof?', opts: ['Zu Fuß', 'Mit dem Taxi', 'Mit dem Bus'], a: 2,
        tip: '她最后说 dann nehme ich den Bus——决定坐公交车。' }
    ]
  }
];
