/* 听力小对话：S7 听力模块，LLM 草稿经 SLA 视角审核（高级学习者 + 二语习得研究者视角），
   R1 审核意见（dl-a1-family 题干/选项、中文译文润色、答案位置分布）已修复。
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
      { type: 'choice', q: 'Wo wohnt Anna?', opts: ['Im Erdgeschoss', 'Im dritten Stock', 'Im ersten Stock'], a: 2,
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
      { sp: 'A', de: 'Gern. Das macht zusammen drei Euro fünfzig.', zh: '好的。一共三块五欧。' }
    ],
    questions: [
      { type: 'choice', q: 'Wo sind die beiden?', opts: ['Im Café', 'Im Büro', 'In der Schule'], a: 0,
        tip: '点咖啡和 Brötchen、当场结账，是咖啡馆或面包房的早晨场景。' },
      { type: 'choice', q: 'Was möchte der Mann trinken?', opts: ['Tee mit Milch', 'Wasser', 'Kaffee mit Milch'], a: 2,
        tip: '他要的是 Kaffee，而且 Nur Milch——只加奶，不加糖。' },
      { type: 'choice', q: 'Was kostet alles zusammen?', opts: ['Vier Euro fünfzehn', 'Drei Euro fünfzig', 'Fünf Euro dreißig'], a: 1,
        tip: 'Das macht zusammen drei Euro fünfzig：一共 3.5 欧。德语价格习惯说 drei Euro fünfzig，口语也常说 drei fünfzig。' }
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
      { type: 'choice', q: 'Wo findet der Dialog statt?', opts: ['Im Geschäft', 'Im Restaurant', 'Im Kino'], a: 0,
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
      { type: 'choice', q: 'Warum treffen sie sich nicht am Samstag?', opts: ['Ben ist krank', 'Ben ist im Urlaub', 'Ben arbeitet'], a: 2,
        tip: 'Am Samstag arbeite ich leider——周六 Ben 要工作，所以只能约周日。' },
      { type: 'choice', q: 'Was möchten sie machen?', opts: ['Ins Kino gehen', 'Fußball spielen', 'Ins Schwimmbad gehen'], a: 2,
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
  },
  {
    id: 'dl-a1-health', title: '预约就诊', level: 'A1', theme: '身体与健康',
    lines: [
      { sp: 'A', de: 'Praxis Doktor Vogel, guten Tag. Was kann ich für Sie tun?', zh: '福格尔医生诊所，您好。请问需要什么帮助？' },
      { sp: 'B', de: 'Guten Tag. Ich brauche einen Termin. Mein Hals tut weh und ich habe Husten.', zh: '您好。我需要预约。我嗓子疼，还咳嗽。' },
      { sp: 'A', de: 'Haben Sie auch Fieber?', zh: '您发烧吗？' },
      { sp: 'B', de: 'Ja, achtunddreißig Grad.', zh: '是的，三十八度。' },
      { sp: 'A', de: 'Dann kommen Sie bitte heute um vier Uhr, und bringen Sie Ihre Karte mit.', zh: '那请您今天四点来，记得带上您的医保卡。' }
    ],
    questions: [
      { type: 'choice', q: 'Was möchte der Mann?', opts: ['Ein Medikament', 'Einen Arzttermin', 'Eine Fahrkarte'], a: 1,
        tip: 'Ich brauche einen Termin——他打电话是要预约看病。' },
      { type: 'choice', q: 'Was hat der Mann?', opts: ['Husten und Fieber', 'Zahnschmerzen', 'Bauchschmerzen'], a: 0,
        tip: 'Mein Hals tut weh、Husten，再加上 achtunddreißig Grad 的 Fieber——嗓子疼、咳嗽和发烧。' },
      { type: 'choice', q: 'Wann ist der Termin?', opts: ['Heute um zehn Uhr', 'Morgen um vier Uhr', 'Heute um vier Uhr'], a: 2,
        tip: 'heute um vier Uhr——今天四点。德国看病一般要先打电话约 Termin，并带上医保卡。' }
    ]
  },
  {
    id: 'dl-a1-family', title: '家庭照片', level: 'A1', theme: '家庭与人',
    lines: [
      { sp: 'A', de: 'Ist das deine Familie auf dem Foto?', zh: '照片上是你的家人吗？' },
      { sp: 'B', de: 'Ja. Das sind meine Eltern und meine Schwester.', zh: '是的。这是我父母和我妹妹。' },
      { sp: 'A', de: 'Und wer ist die Frau da?', zh: '那这位女士是谁？' },
      { sp: 'B', de: 'Das ist meine Großmutter. Sie ist fünfundachtzig.', zh: '这是我奶奶。她八十五岁了。' },
      { sp: 'A', de: 'Sie sieht jung aus!', zh: '她看起来真年轻！' }
    ],
    questions: [
      { type: 'choice', q: 'Was machen die beiden?', opts: ['Sie kochen zusammen', 'Sie sehen ein Foto an', 'Sie spielen Fußball'], a: 1,
        tip: '两人在看照片：Ist das deine Familie auf dem Foto?' },
      { type: 'choice', q: 'Wer ist außer der Großmutter noch auf dem Foto?', opts: ['Die Eltern und die Schwester', 'Die Eltern und der Bruder', 'Nur die Schwester'], a: 0,
        tip: 'Das sind meine Eltern und meine Schwester——照片上除奶奶外还有父母和妹妹。' },
      { type: 'choice', q: 'Wie alt ist die Großmutter?', opts: ['Fünfundachtzig', 'Fünfundsiebzig', 'Fünfundneunzig'], a: 0,
        tip: 'Sie ist fünfundachtzig——85 岁，注意 -und- 结构数字的听辨。' }
    ]
  },
  {
    id: 'dl-a1-free', title: '周末爱好', level: 'A1', theme: '空闲活动与爱好',
    lines: [
      { sp: 'A', de: 'Was machst du am Wochenende?', zh: '你周末做什么？' },
      { sp: 'B', de: 'Ich spiele Fußball. Am Samstag habe ich ein Spiel.', zh: '我踢足球。周六我有一场比赛。' },
      { sp: 'A', de: 'Und am Sonntag?', zh: '那周日呢？' },
      { sp: 'B', de: 'Am Sonntag bin ich oft müde. Dann lese ich oder höre Musik. Und du?', zh: '周日我常常很累。那时我就看看书、听听音乐。你呢？' },
      { sp: 'A', de: 'Ich gehe ins Schwimmbad. Schwimmen ist mein Hobby.', zh: '我去游泳馆。游泳是我的爱好。' }
    ],
    questions: [
      { type: 'choice', q: 'Was machen die beiden?', opts: ['Sie machen Hausaufgaben', 'Sie sprechen über Hobbys', 'Sie kaufen ein Auto'], a: 1,
        tip: '两人互问周末做什么、有什么爱好——聊的是业余活动。' },
      { type: 'choice', q: 'Was macht der Mann am Samstag?', opts: ['Er spielt Fußball', 'Er geht schwimmen', 'Er liest ein Buch'], a: 0,
        tip: 'Am Samstag habe ich ein Spiel——周六踢比赛。' },
      { type: 'choice', q: 'Was macht die Frau am Sonntag?', opts: ['Sie spielt Tennis', 'Sie arbeitet', 'Sie geht ins Schwimmbad'], a: 2,
        tip: '她说 Ich gehe ins Schwimmbad——周日去游泳馆。' }
    ]
  },
  {
    id: 'dl-a2-travel', title: '酒店入住', level: 'A2', theme: '旅行与假期',
    lines: [
      { sp: 'A', de: 'Guten Abend! Haben Sie eine Reservierung?', zh: '晚上好！您有预订吗？' },
      { sp: 'B', de: 'Ja, ein Einzelzimmer für drei Nächte. Der Name ist Weber.', zh: '有，一间单人间，住三晚。姓韦伯。' },
      { sp: 'A', de: 'Zimmer zweihundertvierzehn, mit Frühstück. Hier ist Ihr Schlüssel.', zh: '214 房间，含早餐。这是您的钥匙。' },
      { sp: 'B', de: 'Danke. Wann gibt es Frühstück?', zh: '谢谢。早餐几点开始？' },
      { sp: 'A', de: 'Von sieben bis zehn Uhr. Der Frühstücksraum ist im Erdgeschoss.', zh: '早上七点到十点。早餐厅在一楼。' }
    ],
    questions: [
      { type: 'choice', q: 'Wo findet der Dialog statt?', opts: ['Am Flughafen', 'Im Hotel', 'Im Restaurant'], a: 1,
        tip: 'Reservierung、Zimmer、Schlüssel——是酒店入住场景。' },
      { type: 'choice', q: 'Wie lange bleibt der Mann im Hotel?', opts: ['Eine Nacht', 'Eine Woche', 'Drei Nächte'], a: 2,
        tip: 'ein Einzelzimmer für drei Nächte——单人间住三晚。' },
      { type: 'choice', q: 'Wann beginnt das Frühstück?', opts: ['Um sieben Uhr', 'Um acht Uhr', 'Um zehn Uhr'], a: 0,
        tip: 'Von sieben bis zehn Uhr——早餐七点到十点，开始时间是七点。' }
    ]
  },
  {
    id: 'dl-a2-housing', title: '看房', level: 'A2', theme: '住房与搬家',
    lines: [
      { sp: 'A', de: 'Willkommen! Die Wohnung liegt im ersten Stock und hat einen Balkon.', zh: '欢迎！房子在二楼，带一个阳台。' },
      { sp: 'B', de: 'Sehr schön. Wie groß ist die Wohnung?', zh: '真不错。房子有多大？' },
      { sp: 'A', de: 'Sechzig Quadratmeter, zwei Zimmer, Küche und Bad.', zh: '六十平米，两个房间，加上厨房和浴室。' },
      { sp: 'B', de: 'Und was kostet die Miete?', zh: '那租金多少钱？' },
      { sp: 'A', de: 'Achthundert Euro warm, die Nebenkosten sind schon drin.', zh: '暖租八百欧，附加费用已经包含在内。' }
    ],
    questions: [
      { type: 'choice', q: 'Was machen die beiden?', opts: ['Sie sehen sich eine Wohnung an', 'Sie machen Urlaub', 'Sie kaufen Möbel'], a: 0,
        tip: '看房场景：问面积、房间数和租金——德语叫 Wohnungsbesichtigung。' },
      { type: 'choice', q: 'Wie viele Zimmer hat die Wohnung?', opts: ['Drei Zimmer', 'Zwei Zimmer', 'Vier Zimmer'], a: 1,
        tip: 'zwei Zimmer, Küche und Bad——两个房间，厨房和浴室另算。' },
      { type: 'choice', q: 'Was kostet die Wohnung?', opts: ['Sechshundert Euro', 'Eintausend Euro', 'Achthundert Euro'], a: 2,
        tip: 'Achthundert Euro warm, die Nebenkosten sind schon drin——暖租 800 欧。德语房租 warm 指含附加费，kalt 不含。' }
    ]
  },
  {
    id: 'dl-a2-city', title: '市民登记', level: 'A2', theme: '城市与公共设施',
    lines: [
      { sp: 'A', de: 'Guten Morgen! Was kann ich für Sie tun?', zh: '早上好！请问您办什么业务？' },
      { sp: 'B', de: 'Guten Morgen. Ich bin neu in der Stadt und möchte mich anmelden.', zh: '早上好。我刚搬来这座城市，想办迁入登记。' },
      { sp: 'A', de: 'Haben Sie Ihren Ausweis und die Bestätigung von Ihrem Vermieter dabei?', zh: '您带证件和房东的确认单了吗？' },
      { sp: 'B', de: 'Ja, hier bitte. Muss ich noch ein Formular ausfüllen?', zh: '带了，给您。我还需要填表格吗？' },
      { sp: 'A', de: 'Nein, das mache ich. Ich brauche nur Ihre Unterschrift hier unten.', zh: '不用，我来填。我只需要您在这里签个名。' }
    ],
    questions: [
      { type: 'choice', q: 'Wo findet der Dialog statt?', opts: ['In der Bibliothek', 'Im Supermarkt', 'Im Rathaus'], a: 2,
        tip: 'anmelden、Ausweis、Unterschrift——在市政厅（Bürgeramt）办迁入登记。' },
      { type: 'choice', q: 'Was möchte der Mann machen?', opts: ['Ein Auto kaufen', 'Sich anmelden', 'Einen Kurs besuchen'], a: 1,
        tip: 'Ich bin neu in der Stadt und möchte mich anmelden——新迁入要登记。' },
      { type: 'choice', q: 'Was braucht die Frau von dem Mann?', opts: ['Seine Unterschrift', 'Sein Geld', 'Seine Fahrkarte'], a: 0,
        tip: '最后一句 Ich brauche nur Ihre Unterschrift hier unten——只需要他签名。' }
    ]
  },
  {
    id: 'dl-a2-office', title: '打电话请病假', level: 'A2', theme: '职业与办公室',
    lines: [
      { sp: 'A', de: 'Guten Morgen, Herr Berger. Ich kann heute nicht zur Arbeit kommen.', zh: '早上好，贝格尔先生。我今天不能来上班了。' },
      { sp: 'B', de: 'Guten Morgen, Frau Lang. Das tut mir leid. Was haben Sie denn?', zh: '早上好，朗女士。哦，那太遗憾了。您怎么了？' },
      { sp: 'A', de: 'Fieber und starke Kopfschmerzen. Ich war schon beim Arzt.', zh: '发烧，头疼得厉害。我已经去看过医生了。' },
      { sp: 'B', de: 'Dann bleiben Sie zu Hause. Ich sage den Kollegen Bescheid.', zh: '那您就在家休息吧。我跟同事们说一声。' },
      { sp: 'A', de: 'Danke. Ich schreibe Ihnen später eine E-Mail.', zh: '谢谢。我晚点给您写邮件。' }
    ],
    questions: [
      { type: 'choice', q: 'Warum ruft die Frau an?', opts: ['Sie möchte Urlaub machen', 'Sie sucht ein Büro', 'Sie ist krank'], a: 2,
        tip: 'Ich kann heute nicht zur Arbeit kommen，还说明了症状——打电话请病假，德语叫 sich krankmelden。' },
      { type: 'choice', q: 'Was hat die Frau?', opts: ['Fieber und Kopfschmerzen', 'Bauchschmerzen', 'Rückenschmerzen'], a: 0,
        tip: 'Fieber und starke Kopfschmerzen——发烧和剧烈头痛。' },
      { type: 'choice', q: 'Was macht die Frau später?', opts: ['Sie kommt ins Büro', 'Sie ruft den Arzt an', 'Sie schreibt eine E-Mail'], a: 2,
        tip: 'Ich schreibe Ihnen später eine E-Mail；她已看过医生，不用再打电话。' }
    ]
  },
  {
    id: 'dl-a2-bank', title: '开银行账户', level: 'A2', theme: '银行与信件往来',
    lines: [
      { sp: 'A', de: 'Guten Tag! Möchten Sie ein Konto eröffnen?', zh: '您好！您想开个账户吗？' },
      { sp: 'B', de: 'Ja, genau. Ein Girokonto. Was brauchen Sie von mir?', zh: '对。一个转账账户。您需要我提供什么？' },
      { sp: 'A', de: 'Nur Ihren Ausweis und ein Formular von uns.', zh: '只需要您的证件和我们的一份表格。' },
      { sp: 'B', de: 'Kein Problem. Und was kostet das Konto?', zh: '没问题。那账户要收费用吗？' },
      { sp: 'A', de: 'Nichts, wenn Ihr Gehalt auf das Konto kommt. Sonst drei Euro im Monat.', zh: '如果您的工资打进这个账户就免费，否则每月三欧。' }
    ],
    questions: [
      { type: 'choice', q: 'Was möchte der Mann?', opts: ['Geld abheben', 'Eine Überweisung machen', 'Ein Konto eröffnen'], a: 2,
        tip: 'Möchten Sie ein Konto eröffnen?——他想开一个银行账户。' },
      { type: 'choice', q: 'Was braucht die Beraterin von ihm?', opts: ['Den Ausweis', 'Die Kreditkarte', 'Das Bargeld'], a: 0,
        tip: 'Nur Ihren Ausweis und ein Formular von uns——只要证件和表格。' },
      { type: 'choice', q: 'Wann kostet das Konto nichts?', opts: ['Wenn viel Geld auf dem Konto liegt', 'Wenn das Gehalt auf das Konto kommt', 'Wenn man die Karte verliert'], a: 1,
        tip: 'Nichts, wenn Ihr Gehalt auf das Konto kommt——工资入账就免费。' }
    ]
  },
  {
    id: 'dl-a2-festival', title: '生日邀请', level: 'A2', theme: '节日与习俗',
    lines: [
      { sp: 'A', de: 'Hallo Timo! Ich feiere am Samstag meinen Geburtstag. Kommst du?', zh: '嗨，蒂莫！周六我过生日，你来吗？' },
      { sp: 'B', de: 'Oh, schön! Wie alt wirst du denn?', zh: '哦，太好了！你要过几岁生日？' },
      { sp: 'A', de: 'Dreißig. Wir feiern im Garten und beginnen um sechs.', zh: '三十岁。我们在花园里庆祝，六点开始。' },
      { sp: 'B', de: 'Klingt gut! Soll ich etwas mitbringen?', zh: '听起来不错！我要带点什么吗？' },
      { sp: 'A', de: 'Bring gern einen Salat mit. Getränke haben wir genug.', zh: '带一份沙拉来吧。饮料我们准备得够多了。' }
    ],
    questions: [
      { type: 'choice', q: 'Was feiert die Frau?', opts: ['Ihre Hochzeit', 'Ihren Geburtstag', 'Weihnachten'], a: 1,
        tip: 'Ich feiere am Samstag meinen Geburtstag——过生日。' },
      { type: 'choice', q: 'Wann beginnt die Feier?', opts: ['Um sieben Uhr', 'Um halb sechs', 'Um sechs Uhr'], a: 2,
        tip: 'beginnen um sechs——六点开始。' },
      { type: 'choice', q: 'Was soll der Mann mitbringen?', opts: ['Einen Salat', 'Getränke', 'Einen Kuchen'], a: 0,
        tip: 'Bring gern einen Salat mit——带一份沙拉；主人说饮料已经够了。' }
    ]
  },
  {
    id: 'dl-a2-education', title: '报名语言班', level: 'A2', theme: '教育与培训',
    lines: [
      { sp: 'A', de: 'Guten Tag! Suchen Sie einen Kurs?', zh: '您好！您想找课程吗？' },
      { sp: 'B', de: 'Ja, einen Deutschkurs. Ich lerne schon seit einem Jahr.', zh: '是的，想找一个德语课程。我已经学了一年了。' },
      { sp: 'A', de: 'Dann ist der Fortgeschrittenenkurs genau richtig. Er beginnt im Oktober.', zh: '那提高班正合适，十月开课。' },
      { sp: 'B', de: 'Und wie oft ist der Unterricht?', zh: '那多久上一次课？' },
      { sp: 'A', de: 'Zweimal pro Woche, abends von sechs bis acht. Zweihundert Euro im Monat.', zh: '每周两次，晚上六点到八点。每月两百欧。' }
    ],
    questions: [
      { type: 'choice', q: 'Was sucht der Mann?', opts: ['Eine Wohnung', 'Eine Arbeit', 'Einen Deutschkurs'], a: 2,
        tip: 'einen Deutschkurs——他要找德语课程。' },
      { type: 'choice', q: 'Wann beginnt der Kurs?', opts: ['Im August', 'Im Oktober', 'Im Dezember'], a: 1,
        tip: 'Er beginnt im Oktober——十月开课。' },
      { type: 'choice', q: 'Wie oft ist der Unterricht?', opts: ['Zweimal pro Woche', 'Jeden Tag', 'Einmal im Monat'], a: 0,
        tip: 'Zweimal pro Woche, abends von sechs bis acht——每周两次，晚上六点到八点。' }
    ]
  },
  {
    id: 'dl-b1-career', title: '面试通知电话', level: 'B1', theme: '工作与职业发展',
    lines: [
      { sp: 'A', de: 'Guten Tag, hier ist Sandra Keller von der Firma Lehmann. Ich rufe wegen Ihrer Bewerbung an.', zh: '您好，我是莱曼公司的桑德拉·凯勒。我打电话是为了您的求职申请。' },
      { sp: 'B', de: 'Guten Tag, Frau Keller. Schön, dass Sie sich melden.', zh: '您好，凯勒女士。很高兴您联系我。' },
      { sp: 'A', de: 'Wir möchten Sie gern kennenlernen. Passt Ihnen Mittwoch um zehn Uhr?', zh: '我们很想认识您。周三上午十点您方便吗？' },
      { sp: 'B', de: 'Mittwoch habe ich leider einen Termin. Ginge es auch am Donnerstag?', zh: '真不巧，周三我有个安排。周四可以吗？' },
      { sp: 'A', de: 'Donnerstag um elf ist notiert. Die Einladung schicken wir Ihnen per E-Mail.', zh: '记下了，周四十一点。邀请函我们会通过邮件发给您。' }
    ],
    questions: [
      { type: 'choice', q: 'Warum ruft die Frau an?', opts: ['Wegen einer Rechnung', 'Wegen eines Urlaubs', 'Wegen der Bewerbung des Mannes'], a: 2,
        tip: 'Ich rufe wegen Ihrer Bewerbung an——因为他的求职申请。' },
      { type: 'choice', q: 'Wann findet das Gespräch statt?', opts: ['Am Donnerstag', 'Am Mittwoch', 'Am Freitag'], a: 0,
        tip: 'Mittwoch 他有约，最后定在 Donnerstag um elf。' },
      { type: 'choice', q: 'Wie bekommt der Mann die Einladung?', opts: ['Per Post', 'Per E-Mail', 'Per Telefon'], a: 1,
        tip: 'Die Einladung schicken wir Ihnen per E-Mail——通过邮件发送。' }
    ]
  },
  {
    id: 'dl-b1-health', title: '压力与睡眠', level: 'B1', theme: '健康与心理',
    lines: [
      { sp: 'A', de: 'Sag mal, du siehst müde aus. Schläfst du schlecht?', zh: '我说，你看起来很累。睡得不好吗？' },
      { sp: 'B', de: 'Ja, im Moment kaum. Ich bin total erschöpft, aber abends komme ich nicht zur Ruhe.', zh: '是啊，最近几乎睡不着。我累得不行，可晚上就是静不下来。' },
      { sp: 'A', de: 'Das kenne ich. Machst du nach der Arbeit noch Sport?', zh: '我懂。你下班后还运动吗？' },
      { sp: 'B', de: 'Ehrlich gesagt sitze ich abends nur am Handy. Ich weiß, dass das nicht gut ist.', zh: '说实话，我晚上就坐在那儿玩手机。我知道这样不好。' },
      { sp: 'A', de: 'Dann probier es mal mit einem Spaziergang. Und leg das Handy eine Stunde vorher weg.', zh: '那你不妨试试散散步，睡前一小时把手机放到一边。' }
    ],
    questions: [
      { type: 'choice', q: 'Worum geht es im Gespräch?', opts: ['Um Stress und schlechten Schlaf', 'Um ein neues Projekt', 'Um Sport im Verein'], a: 0,
        tip: 'erschöpft、nicht zur Ruhe kommen、abends am Handy——聊的是压力和失眠。' },
      { type: 'choice', q: 'Was macht der Mann abends?', opts: ['Er geht spazieren', 'Er sitzt am Handy', 'Er macht Sport'], a: 1,
        tip: 'Ehrlich gesagt sitze ich abends nur am Handy——晚上一直看手机。' },
      { type: 'choice', q: 'Was empfiehlt die Frau?', opts: ['Mehr Kaffee am Abend', 'Früher zur Arbeit gehen', 'Vor dem Schlafen spazieren und weniger Handy'], a: 2,
        tip: '建议：睡前散步，并把手机提前一小时放下。' }
    ]
  },
  {
    id: 'dl-b1-environment', title: '骑车上班？', level: 'B1', theme: '环境与能源',
    lines: [
      { sp: 'A', de: 'Sag mal, fährst du immer noch mit dem Auto zur Arbeit?', zh: '我说，你还一直开车上班吗？' },
      { sp: 'B', de: 'Ja, leider. Mit dem Bus brauche ich fast eine Stunde.', zh: '是啊，没办法。坐公交我要将近一个小时。' },
      { sp: 'A', de: 'Und mit dem Fahrrad? Es gibt doch jetzt diesen neuen Radweg.', zh: '那骑自行车呢？现在不是新修了那条自行车道嘛。' },
      { sp: 'B', de: 'Stimmt. Im Sommer könnte ich das mal ausprobieren.', zh: '对哦。夏天我可以试试。' },
      { sp: 'A', de: 'Mach das! Das ist besser fürs Klima, und morgens bist du gleich wacher.', zh: '试吧！这样对气候更友好，而且早上人一下就清醒了。' }
    ],
    questions: [
      { type: 'choice', q: 'Worüber sprechen die beiden?', opts: ['Über den Urlaub', 'Über den Weg zur Arbeit', 'Über das Wetter'], a: 1,
        tip: '谈的是上班通勤：开车、公交还是骑车。' },
      { type: 'choice', q: 'Wie fährt der Mann zur Arbeit?', opts: ['Mit dem Auto', 'Mit dem Fahrrad', 'Mit dem Bus'], a: 0,
        tip: 'immer noch mit dem Auto——他一直开车上班。' },
      { type: 'choice', q: 'Warum fährt er nicht mit dem Bus?', opts: ['Der Bus ist zu teuer', 'Er braucht zu lange', 'Der Bus fährt nicht'], a: 1,
        tip: 'Mit dem Bus brauche ich fast eine Stunde——坐公交要将近一小时，太久了。' }
    ]
  },
  {
    id: 'dl-b1-digital', title: '办公室里的 AI', level: 'B1', theme: '数字化与人工智能',
    lines: [
      { sp: 'A', de: 'Sag mal, benutzt du diese neuen Programme mit künstlicher Intelligenz für die Arbeit?', zh: '我说，你工作里用那些带人工智能的新程序吗？' },
      { sp: 'B', de: 'Ja, für E-Mails und Berichte. Das spart mir jeden Tag bestimmt eine Stunde.', zh: '用，写邮件和报告。每天肯定能给我省一个小时。' },
      { sp: 'A', de: 'Ehrlich? Ich bin da skeptisch. Ich weiß nicht, was mit unseren Daten passiert.', zh: '真的吗？我可有点怀疑。我不知道我们的数据会被怎么处理。' },
      { sp: 'B', de: 'Ein gutes Argument. Wir dürfen keine Kundendaten eingeben, das ist klar.', zh: '这个理由很充分。我们当然不能输入客户数据，这很清楚。' },
      { sp: 'A', de: 'Genau. Ohne Kundendaten ist es für mich in Ordnung.', zh: '对。不涉及客户数据的话，我可以接受。' }
    ],
    questions: [
      { type: 'choice', q: 'Worüber sprechen die beiden?', opts: ['Über Programme mit künstlicher Intelligenz', 'Über den Urlaubsplan', 'Über ein neues Büro'], a: 0,
        tip: '开头就点题：diese neuen Programme mit künstlicher Intelligenz。' },
      { type: 'choice', q: 'Wofür benutzt der Mann die Programme?', opts: ['Für Fotos und Videos', 'Für E-Mails und Berichte', 'Für Musik'], a: 1,
        tip: 'für E-Mails und Berichte——写邮件和报告。' },
      { type: 'choice', q: 'Was ist der Frau wichtig?', opts: ['Die Geschwindigkeit', 'Der Preis', 'Der Schutz der Daten'], a: 2,
        tip: '她担心 Ich weiß nicht, was mit unseren Daten passiert——最在意数据安全。' }
    ]
  },
  {
    id: 'dl-b1-culture', title: '剧院之约', level: 'B1', theme: '文化与艺术',
    lines: [
      { sp: 'A', de: 'Hast du am Freitag schon etwas vor? Ich habe zwei Karten fürs Theater.', zh: '你周五有安排了吗？我有两张剧院的票。' },
      { sp: 'B', de: 'Fürs Theater? Was wird denn gespielt?', zh: '剧院？演什么呀？' },
      { sp: 'A', de: 'Ein Klassiker, aber eine moderne Inszenierung. Die Kritiken waren richtig gut.', zh: '一部经典作品，不过是现代版演绎。评论都很不错。' },
      { sp: 'B', de: 'Klingt spannend. Wann fängt es an?', zh: '听起来很有意思。几点开始？' },
      { sp: 'A', de: 'Um halb acht. Wir treffen uns vorher am Eingang.', zh: '七点半。我们提前在入口碰面。' }
    ],
    questions: [
      { type: 'choice', q: 'Was möchte die Frau mit dem Mann machen?', opts: ['Ins Kino gehen', 'Ins Theater gehen', 'Ins Museum gehen'], a: 1,
        tip: 'zwei Karten fürs Theater——去看戏。' },
      { type: 'choice', q: 'Wann beginnt die Vorstellung?', opts: ['Um halb acht', 'Um acht', 'Um halb neun'], a: 0,
        tip: '德语 um halb acht 是七点半（差半小时到八点），不是八点半。' },
      { type: 'choice', q: 'Wo treffen sich die beiden?', opts: ['Im Café', 'An der Haltestelle', 'Am Eingang'], a: 2,
        tip: 'Wir treffen uns vorher am Eingang——在入口碰面。' }
    ]
  }
];
