/* 变格/词尾专项训练数据（S9 M8，LLM 草稿 → SLA 视角审核闭环定稿）。
   与语法专题互补：语法课讲规则，本模块专门「练词尾」——业内罕见的可训练词尾模块。
   window.DECLENSION（index.html 静态加载；文件缺失时前端按空数组处理显示空状态）。
   专题 id：dc- 前缀唯一；卡 id：dc-{topicId}#{exerciseIndex}（复用语法 SRS 队列）。
   exercises: { type: 'choice'(单选) | 'fill'(输入), q, opts?(choice 选项), a(choice 为索引 / fill 为字符串), tip(解析) }
   干扰项取学习者真实常错项（dem/den 互换、-e/-en 混淆、mir/mich 混用等）。 */
window.DECLENSION = [
{
  id: 'dc-article', title: '定冠词四格变化', level: 'A1', topic: 'article',
  summary: 'der/die/das 在四个格里的变化：关键只有一处——阳性第四格 der→den。',
  exercises: [
    { type: 'choice', q: 'Mein Vater kauft ___ Wagen. (der Wagen)', opts: ['den', 'der', 'dem'], a: 0, tip: 'kaufen 接第四格，阳性 der→den：den Wagen。' },
    { type: 'choice', q: '___ Frau am Fenster ist meine Lehrerin. (die)', opts: ['Der', 'Die', 'Den'], a: 1, tip: '句首的 Frau 是主语，用第一格 die；阴性第四格也一样是 die，先判断格再选词。' },
    { type: 'fill', q: 'Kannst du ___ Kind helfen? (das Kind)', a: 'dem', tip: 'helfen 接第三格，das→dem：dem Kind。' },
    { type: 'choice', q: 'Wir machen ___ Kindern ein Geschenk. (die Kinder)', opts: ['die', 'den', 'der'], a: 1, tip: '复数第三格 die→den，而且名词本身要加 -n：den Kindern。' },
    { type: 'fill', q: 'Ich besuche ___ Frau. (die Frau)', a: 'die', tip: '第四格阴性不变：die。变来变去的主要就是阳性。' },
    { type: 'choice', q: 'Das Buch liegt auf ___ Tisch. (der Tisch)', opts: ['dem', 'den', 'der'], a: 0, tip: 'auf 表位置用第三格：auf dem Tisch。' },
    { type: 'fill', q: 'Er kennt ___ Mädchen. (das Mädchen)', a: 'das', tip: '第四格中性不变：das。Mädchen 是中性名词。' },
    { type: 'choice', q: 'Wem dankst du? — Ich danke ___ Lehrerin. (die)', opts: ['der', 'die', 'den'], a: 0, tip: 'danken 接第三格，die→der：der Lehrerin。' }
  ]
},
{
  id: 'dc-indefinite', title: '不定冠词与否定冠词', level: 'A1', topic: 'article',
  summary: 'ein-/kein- 跟着 der/die/das 变：阳四 einen，否定名词一律用 kein-。',
  exercises: [
    { type: 'choice', q: 'Hast du ___ Stift für mich? (ein Stift)', opts: ['einen', 'einem', 'ein'], a: 0, tip: '第四格阳性 ein→einen：einen Stift。' },
    { type: 'choice', q: 'Ich trinke lieber Tee, ich trinke ___ Kaffee. (否定 ein Kaffee)', opts: ['keinen', 'keinem', 'kein'], a: 0, tip: '否定带冠词的名词用 kein-：四格阳性 keinen Kaffee。' },
    { type: 'fill', q: 'Sie wohnt bei ___ Freundin. (eine Freundin)', a: 'einer', tip: 'bei 接第三格，eine→einer。' },
    { type: 'choice', q: 'Heute habe ich leider ___ Zeit. (kein, die Zeit)', opts: ['keine', 'keiner', 'keinen'], a: 0, tip: 'Zeit 是阴性：keine Zeit，第四格也还是 keine。' },
    { type: 'choice', q: 'Sie hat ___ Geschwister. (kein，复数)', opts: ['keine', 'keinen', 'keiner'], a: 0, tip: 'Geschwister 是复数：keine Geschwister。复数否定一律 keine（第三格才变 keinen）。' },
    { type: 'choice', q: 'In diesem Dorf gibt es ___ Supermarkt. (否定)', opts: ['keinen', 'keinem', 'kein'], a: 0, tip: 'es gibt 接第四格：keinen Supermarkt。' },
    { type: 'fill', q: 'Wir helfen ___ kleinen Kind. (ein kleines Kind)', a: 'einem', tip: 'helfen 接第三格；ein→einem，形容词词尾也跟着是 -en：einem kleinen Kind。' },
    { type: 'choice', q: 'Er liest gerade ___ Buch. (否定 ein Buch)', opts: ['kein', 'keine', 'keinen'], a: 0, tip: 'Buch 是中性，第一格/第四格都是 kein Buch。' }
  ]
},
{
  id: 'dc-adjective', title: '形容词词尾（强·弱·混合）', level: 'A2', topic: 'adjective',
  summary: '定冠词后 -e/-en，不定冠词后混合变化，无冠词时形容词自己扛词尾。',
  exercises: [
    { type: 'choice', q: '___ Wein schmeckt mir sehr gut. (der + gut)', opts: ['Der gute', 'Der guter', 'Den guten'], a: 0, tip: '定冠词后弱变化：第一格一律 -e（der gute Wein）。' },
    { type: 'choice', q: 'Das ist ein ___ Auto. (gut，中性第一格)', opts: ['gutes', 'gute', 'guten'], a: 0, tip: '不定冠词后混合变化：中性第一格 -es（ein gutes Auto）。' },
    { type: 'choice', q: 'Wir besuchen den ___ Kollegen. (krank)', opts: ['kranken', 'kranke', 'kranker'], a: 0, tip: '定冠词第四格阳性 -en：den kranken Kollegen。弱变化形容词只有 -e 和 -en 两种形式。' },
    { type: 'fill', q: 'Sie kauft einen ___ Rock. (neu)', a: 'neuen', tip: '不定冠词第四格阳性同弱变化：einen neuen Rock。' },
    { type: 'choice', q: '___ Wetter ist heute wirklich schön. (gut，无冠词)', opts: ['Gutes', 'Gute', 'Guter'], a: 0, tip: '无冠词强变化：形容词自己带定冠词词尾，das 的位置用 -es：Gutes Wetter。' },
    { type: 'fill', q: 'Wir fahren mit dem ___ Wagen in den Urlaub. (neu)', a: 'neuen', tip: '第三格定冠词后全部 -en：mit dem neuen Wagen。' },
    { type: 'choice', q: 'Sie trinkt Kaffee mit ___ Milch. (frisch，无冠词)', opts: ['frischer', 'frische', 'frischen'], a: 0, tip: '无冠词第三格阴性 -er：mit frischer Milch。' },
    { type: 'fill', q: 'Die Farbe der ___ Bluse gefällt mir sehr. (blau)', a: 'blauen', tip: 'der 后的第二格阴性也属弱变化：-en（der blauen Bluse）。' }
  ]
},
{
  id: 'dc-pronoun', title: '人称代词三四格', level: 'A1', topic: 'pronoun',
  summary: 'mich/mir、ihn/ihm……动词和介词说了算：für mich， aber mit mir。',
  exercises: [
    { type: 'choice', q: 'Kannst du ___ gut hören? (ich)', opts: ['mich', 'mir', 'ich'], a: 0, tip: 'hören 接第四格：mich。' },
    { type: 'choice', q: 'Meine Mutter backt ___ einen Kuchen. (ich)', opts: ['mir', 'mich', 'ich'], a: 0, tip: 'backen 双宾语：直接宾语是 einen Kuchen，"人"用第三格（mir）。' },
    { type: 'fill', q: 'Ich verstehe ___ nicht. (er)', a: 'ihn', tip: 'er 的第四格是 ihn：Ich verstehe ihn nicht.' },
    { type: 'choice', q: 'Wir danken ___ herzlich. (du)', opts: ['dir', 'dich', 'du'], a: 0, tip: 'danken 接第三格：dir。' },
    { type: 'choice', q: 'Das Geschenk ist für ___. (ich)', opts: ['mich', 'mir', 'ich'], a: 0, tip: 'für 永远第四格——mir/mich 的经典陷阱：für mich。' },
    { type: 'fill', q: 'Der Lehrer erklärt ___ die Regel. (wir)', a: 'uns', tip: 'erklären 双宾语，人三物四：erklärt uns die Regel。' },
    { type: 'fill', q: 'Wir fahren nächste Woche zu ___. (er)', a: 'ihm', tip: 'zu 永远第三格：zu ihm。' },
    { type: 'choice', q: 'Er hilft ___, wenn sie krank ist. (sie，她)', opts: ['ihr', 'sie', 'ihn'], a: 0, tip: 'helfen 接第三格；sie（她）的第三格是 ihr。' },
    { type: 'choice', q: 'Ich sehe ___ jeden Tag im Bus. (du)', opts: ['dich', 'dir', 'du'], a: 0, tip: 'sehen 接第四格：dich。' }
  ]
},
{
  id: 'dc-weak-noun', title: '名词弱变化（N-变格）', level: 'A2', topic: 'noun',
  summary: 'der Junge → den Jungen：阳性指人/动物的名词，其余格加 -n/-en。',
  exercises: [
    { type: 'choice', q: 'Ich grüße ___ Studenten am Tor. (der Student)', opts: ['den', 'dem', 'der'], a: 0, tip: '四格且弱变化双重变化：der→den，Student 再加 -en：den Studenten。' },
    { type: 'fill', q: 'Wir helfen dem ___. (der Mensch)', a: 'Menschen', tip: 'helfen 第三格 + 弱变化：dem Menschen。' },
    { type: 'choice', q: 'Kennst du den ___ dort am Tisch? (der Junge)', opts: ['Jungen', 'Junge', 'Junges'], a: 0, tip: 'den Jungen：以 -e 结尾的阳性名词大多是弱变化。' },
    { type: 'choice', q: 'Mein ___ ist lang: Michael Schmidt. (der Name，第一格)', opts: ['Name', 'Namen', 'Names'], a: 0, tip: '第一格不加 -n：der Name。弱变化只影响其余三个格。' },
    { type: 'fill', q: 'Er erinnert sich oft an den ___. (der Kollege)', a: 'Kollegen', tip: 'an 接第四格 + 弱变化：an den Kollegen。' },
    { type: 'choice', q: '___ Studentin kommt aus Japan. (die，第一格)', opts: ['Die', 'Der', 'Den'], a: 0, tip: 'die Studentin 是阴性名词，没有弱变化：第一格 Die Studentin。' },
    { type: 'fill', q: 'Die Kinder spielen mit dem ___ von nebenan. (der Nachbar)', a: 'Nachbarn', tip: 'der Nachbar 弱变化，第三格：dem Nachbarn（-bar 后只加 -n）。' },
    { type: 'choice', q: 'Ich schreibe mit dem ___ einen Brief. (der Stift)', opts: ['Stift', 'Stiften', 'Stifte'], a: 0, tip: 'der Stift 是普通阳性名词：第三格仍是 dem Stift——不是阳性就加 -n。' }
  ]
},
{
  id: 'dc-prep', title: '介词配格', level: 'A1', topic: 'preposition',
  summary: 'mit/für/in…… 介词决定后面的格；in/an/auf 等双向介词看「在哪」还是「去哪」。',
  exercises: [
    { type: 'choice', q: 'Wohin gehst du am Nachmittag? — Ich gehe ___ Park. (in)', opts: ['in den', 'im', 'in die'], a: 0, tip: '问 Wohin（去哪）→第四格：in den Park。im 来自 in dem，是「在哪」的答案。' },
    { type: 'choice', q: 'Wo bist du? — Ich bin ___ Schule. (in)', opts: ['in der', 'in die', 'in dem'], a: 0, tip: '问 Wo（在哪）→第三格：in der Schule。' },
    { type: 'fill', q: 'Der Bus kommt gleich. Wir warten schon auf ___ Bus. (der)', a: 'den', tip: 'warten auf 是固定动介搭配，永远第四格：auf den Bus。动介搭配的格要整体记。' },
    { type: 'choice', q: 'Wir fahren lieber mit ___ Zug. (der)', opts: ['dem', 'den', 'der'], a: 0, tip: 'mit 永远第三格：mit dem Zug。' },
    { type: 'fill', q: 'Das Geschenk ist für ___ kleine Mädchen. (das)', a: 'das', tip: 'für 永远第四格，中性不变：für das kleine Mädchen。' },
    { type: 'choice', q: 'Meine Eltern kommen ___ der Schweiz. (aus/von/nach 选一个)', opts: ['aus', 'von', 'nach'], a: 0, tip: 'aus 永远第三格：aus der Schweiz（国家/地区名词前用 aus）。' },
    { type: 'fill', q: 'Ich gehe morgen ___ Arzt. (zu + dem)', a: 'zum', tip: 'zu 永远第三格；阳性/中性第三格是 dem，zu dem 缩合为 zum：zum Arzt。对比：zu der → zur（如 zur Post）。' },
    { type: 'choice', q: 'Er wirft den Ball in ___ Korb. (der，Wohin)', opts: ['in den', 'im', 'in die'], a: 0, tip: '扔进篮筐是方向（Wohin）→第四格：in den Korb。' },
    { type: 'choice', q: 'Jetzt liegt der Ball ___ Korb. (der，Wo)', opts: ['im', 'in den', 'in die'], a: 0, tip: '躺在那里是位置（Wo）→第三格：im Korb（im = in dem）。' }
  ]
}
];
