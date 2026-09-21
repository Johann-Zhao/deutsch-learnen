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
  },
  {
    id: 'rd-a1-markt', title: '周六集市', level: 'A1', theme: '购物与金钱',
    text: 'Am Samstagmorgen geht Nora mit ihrer Mutter auf den Markt. Der Markt ist groß und bunt. Es gibt Obst, Gemüse, Käse und Blumen. Mutter kauft Äpfel und Tomaten. Nora riecht an frischen Erdbeeren und kauft einen kleinen Strauß für die Oma. Ein Mann verkauft Honig und gibt allen eine kleine Probe. Alles ist frisch und nicht teuer. Am Ende trinken Nora und ihre Mutter einen Kakao auf dem Marktplatz. „Nächste Woche kommen wir wieder“, sagt Nora.'
  },
  {
    id: 'rd-a1-familie', title: '一封笔友邮件', level: 'A1', theme: '家庭与人',
    text: 'Hallo Clara! Danke für deine E-Mail. Du fragst nach meiner Familie – gern! Ich wohne mit meinen Eltern und meiner kleinen Schwester Lina in einem Haus. Mein Vater ist Mechaniker und meine Mutter arbeitet in einer Bäckerei. Lina ist sechs Jahre alt und geht in die erste Klasse. Wir haben auch einen Hund. Er heißt Balu und schläft gern auf dem Sofa. Am Abend essen wir immer zusammen, und am Wochenende besuchen wir oft die Großeltern. Das ist meine Familie. Und deine? Schreib mir bald! Liebe Grüße, Tom'
  },
  {
    id: 'rd-a1-tag', title: '我的一天', level: 'A1', theme: '数字、时间与日期',
    text: 'Hallo! Ich bin Aylin und heute zeige ich euch meinen Tag. Ich stehe um halb sieben auf und frühstücke mit meiner Familie. Um Viertel nach acht fahre ich mit dem Bus zur Schule. Der Unterricht beginnt um acht Uhr. Am Mittag esse ich in der Mensa, manchmal auch ein Butterbrot von zu Hause. Nachmittags mache ich Hausaufgaben und treffe meine Freundin. Abends koche ich mit meinem Bruder, und um zehn gehe ich ins Bett. Mein Tag ist voll, aber schön. Und wie sieht dein Tag aus?'
  },
  {
    id: 'rd-a2-camping', title: '海边露营记', level: 'A2', theme: '旅行与假期',
    text: 'Letzten Sommer bin ich mit meiner besten Freundin eine Woche an die Ostsee gefahren. Wir haben nicht im Hotel übernachtet, sondern direkt am Strand gezeltet. Unser Zelt war alt, und in der ersten Nacht hat es stark geregnet. Drinnen war alles nass! Trotzdem hatten wir viel Spaß. Tagsüber sind wir geschwommen und haben Fahrräder gemietet. Abends haben wir Fisch gegessen und den Sonnenuntergang am Strand gesehen. Am letzten Abend sind wir zum Leuchtturm gelaufen und haben viele Fotos gemacht. Ein solcher Urlaub ist einfach und billig, aber wunderbar. Diesen Sommer fahren wir wieder ans Meer. Dann nehmen wir ein neues Zelt mit!'
  },
  {
    id: 'rd-a2-anzeige', title: '二手自行车出售', level: 'A2', theme: '购物与金钱',
    text: 'VERKAUFE: Fahrrad in gutem Zustand! Ich verkaufe mein blaues Damenfahrrad, weil ich mir bald ein E-Bike kaufen möchte. Das Fahrrad ist drei Jahre alt, aber es fährt noch sehr gut. Es hat sieben Gänge, eine neue Kette und einen gepolsterten Sitz. Es gibt auch zwei Taschen am Gepäckträger – perfekt für den Einkauf! Der Preis: einhundertfünfzig Euro. Das ist viel billiger als im Geschäft. Wer Interesse hat, kann mich am Wochenende anrufen oder eine E-Mail schreiben. Eine Probefahrt ist natürlich möglich. Bitte nur ernsthafte Interessenten! Sabine'
  },
  {
    id: 'rd-a2-wanderung', title: '山间徒步', level: 'A2', theme: '自然与环境',
    text: 'Am Wochenende macht Familie Brandt eine Wanderung in den Bergen. Am Anfang geht es leicht bergauf durch einen Wald. Die Kinder finden Pilze und einen kleinen Bach. Auf der Hälfte machen alle eine Pause auf einer Alm und essen Butterbrote und Äpfel. Danach wird der Weg steiler, und es fängt an zu regnen. Vater meint: „Wir gehen weiter, das Wetter wird gleich besser!“ Und er hat Recht. Oben wartet eine wunderbare Aussicht auf das Tal. Unten in der Stadt war es noch heiß, hier oben ist die Luft frisch und kühl. Müde, aber glücklich, fahren sie am Abend nach Hause. „Das war die beste Wanderung dieses Jahr!“, sagt die Tochter.'
  },
  {
    id: 'rd-a2-weihnachten', title: '圣诞市场之夜', level: 'A2', theme: '节日与习俗',
    text: 'An einem kalten Abend im Dezember gehen Jana und ihr Bruder auf den Weihnachtsmarkt. Überall leuchten bunte Lichter, und man riecht Zimt und gebrannte Mandeln. Jana kauft ein Geschenk für ihre Mutter, und ihr Bruder trinkt heiße Schokolade. Sie essen auch Kartoffelpuffer – leider ohne Apfelmus, denn der Stand hat schon geschlossen. Danach singt ein Chor Weihnachtslieder, und alle Menschen auf dem Marktplatz lauschen. Auf dem Weg nach Hause schneit es leicht. „Weihnachten ist noch zwei Wochen weg“, sagt der Bruder. „Aber die schönste Zeit fängt jetzt schon an“, antwortet Jana.'
  },
  {
    id: 'rd-a2-fussball', title: '足球俱乐部招新', level: 'A2', theme: '运动与健身',
    text: 'SPORT FREI! Fußballverein Blau-Weiß sucht neue Mitglieder! Du spielst gern Fußball und hast Zeit am Wochenende? Dann komm zu uns! Wir trainieren jeden Dienstag und Donnerstag von siebzehn bis achtzehn Uhr auf dem Sportplatz am See. Jeden Samstag spielen wir ein Spiel gegen andere Mannschaften aus der Stadt. Es ist egal, ob du Anfänger oder Profi bist – bei uns ist jeder willkommen. Die ersten zwei Trainingseinheiten sind kostenlos. Bitte bring Sportschuhe und eine Wasserflasche mit. Komm einfach vorbei und probiere es aus! Wir sehen uns auf dem Platz! Dein Verein Blau-Weiß'
  },
  {
    id: 'rd-a2-email-kollegen', title: '办公室早餐邀请', level: 'A2', theme: '职业与办公室',
    text: 'Hallo zusammen! Nächste Woche haben wir unser wichtiges Projekt abgeschlossen – das wollen wir feiern! Ich lade euch alle herzlich zum Frühstück im Büro ein. Am Donnerstag ist um neun Uhr alles bereit. Es gibt frische Brötchen, Obst, Käse und Kaffee. Wenn ihr möchtet, bringt bitte etwas Süßes mit, zum Beispiel einen Kuchen. Nach dem Essen machen wir eine kurze Pause auf der Terrasse. Bitte schreibt mir bis Dienstag, ob ihr kommt, damit ich genug einkaufen kann. Ich freue mich auf euch! Liebe Grüße, Markus'
  },
  {
    id: 'rd-a2-pruefung', title: '考试周', level: 'A2', theme: '教育与培训',
    text: 'Nächste Woche schreibt Ben seine erste große Prüfung, und er ist etwas nervös. Deshalb macht er einen Lernplan: Am Montag lernt er Mathe, am Dienstag Englisch, am Mittwoch Deutsch. Nach jeder Lerneinheit macht er eine Pause und geht mit dem Hund raus. Sein Bruder hilft ihm bei den schweren Aufgaben und prüft ihn mit Karteikarten. Am Abend vor der Prüfung packt Ben seine Tasche und geht früh ins Bett. Am nächsten Morgen steht er früh auf und isst ein gutes Frühstück. In der Schule atmet er tief ein und liest zuerst alle Aufgaben durch. Nach zwei Stunden ist alles vorbei. „Gar nicht schlimm“, sagt Ben und lächelt. Die Angst vor der Prüfung ist manchmal schlimmer als die Prüfung selbst.'
  }
];
