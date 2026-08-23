/* A1 语法数据。
   lesson: HTML 字符串（讲解）
   exercises: { type: 'choice'(单选) | 'fill'(输入), q, opts?(choice 选项), a(答案), tip(解析) } */
window.GRAMMAR = [
{
  id: 'g-aussprache', title: '字母与发音', level: 'A1',
  summary: '德语字母表、变元音 ä ö ü、ß 的读法，以及拼读基本规则。',
  lesson: `
<p>德语共有 30 个字母：26 个基本字母 + 变元音 <b>ä、ö、ü</b> 和 <b>ß</b>（Eszett，读作 /ɛsˈtsɛt/）。ß 等同于双写 ss，永远小写。</p>
<h3>变元音</h3>
<table><tr><th>字母</th><th>近似读音</th><th>例词</th></tr>
<tr><td>ä</td><td>类似"唉"（e 的开口音）</td><td>Mädchen, spät</td></tr>
<tr><td>ö</td><td>嘴唇说 o，舌头说 e</td><td>schön, zwölf</td></tr>
<tr><td>ü</td><td>嘴唇说 u，舌头说 i</td><td>über, Tür</td></tr></table>
<h3>关键拼读规则</h3>
<ul>
<li><b>ei</b> 读作"爱"：eins, zwei, mein</li>
<li><b>ie</b> 读作长"衣"：vier, Bier, Liebe</li>
<li><b>eu / äu</b> 读作"奥伊"：neun, Deutsch, Häuser</li>
<li><b>sch</b> 读作"施"：Schule, schön</li>
<li><b>ch</b> 在 a/o/u 后读"赫"（Buch），其余读"希"（ich）</li>
<li><b>v</b> 读作 f 音：Vater, vier</li>
<li><b>w</b> 读作 v 音：Wasser, was</li>
<li><b>z</b> 读作"茨"：zehn, Zeit</li>
<li>词尾 <b>-er</b> 常读作"啊"：Mutter ≈ "穆塔"</li>
</ul>
<p>注意：德语名词永远大写，这是铁律，包括句子中间的名词。</p>`,
  exercises: [
    { type: 'choice', q: 'ie 组合发什么音？', opts: ['类似"爱"（如英语 ice）', '长音"衣"', '类似"哎啊"两个音'], a: 1, tip: 'ie 是长 i 音，如 vier、Bier。读"爱"的是 ei，如 eins、mein。' },
    { type: 'choice', q: 'ei 组合发什么音？', opts: ['长音"衣"', '类似"爱"', '类似"奥伊"'], a: 1, tip: 'ei 读"爱"：eins, zwei, mein, Wein。' },
    { type: 'choice', q: '单词 zehn 中 z 的读音是？', opts: ['英语 z 音', '"茨"音', '"斯"音'], a: 1, tip: 'z 读作"茨"（ts），如 zehn, Zeit, Zeit。' },
    { type: 'choice', q: '单词 Vater 中 v 的读音是？', opts: ['英语 v 音', 'f 音', 'w 音'], a: 1, tip: '德语 v 通常读 f 音：Vater, vier, viel。w 才读 v 音：Wasser。' },
    { type: 'choice', q: 'eu / äu 组合发什么音？', opts: ['"奥伊"', '"欧"', '"乌"'], a: 0, tip: 'eu 和 äu 都读"奥伊"：neun, Deutsch, Häuser。' },
    { type: 'choice', q: 'sch 读什么音？', opts: ['"什克"', '"施"', '"斯赫"两个音'], a: 1, tip: 'sch 是一个整体，读"施"：Schule, schön, schreiben。' }
  ]
},
{
  id: 'g-praesens', title: '动词现在时变位', level: 'A1',
  summary: '规则动词词尾、不规则变化动词，以及 sein / haben / werden 三巨头。',
  lesson: `
<p>德语动词原形（Infinitiv）多以 <b>-en</b> 结尾。去掉词尾 -en 得到词干，再加人称词尾：</p>
<table><tr><th>人称</th><th>词尾</th><th>lernen（学习）</th></tr>
<tr><td>ich</td><td>-e</td><td>lern<b>e</b></td></tr>
<tr><td>du</td><td>-st</td><td>lern<b>st</b></td></tr>
<tr><td>er/sie/es</td><td>-t</td><td>lern<b>t</b></td></tr>
<tr><td>wir</td><td>-en</td><td>lern<b>en</b></td></tr>
<tr><td>ihr</td><td>-t</td><td>lern<b>t</b></td></tr>
<tr><td>sie/Sie</td><td>-en</td><td>lern<b>en</b></td></tr></table>
<h3>词干以 -t / -d 结尾时，du 加 -est，er/ihr 加 -et</h3>
<p>arbeiten → du arbeit<b>est</b>, er arbeit<b>et</b>, ihr arbeit<b>et</b></p>
<h3>常用不规则动词（换元音，只换 du 和 er/sie/es）</h3>
<table><tr><th>原形</th><th>du</th><th>er/sie/es</th><th>意思</th></tr>
<tr><td>fahren</td><td>fähr<b>st</b></td><td>fähr<b>t</b></td><td>行驶</td></tr>
<tr><td>essen</td><td>iss<b>t</b></td><td>iss<b>t</b></td><td>吃</td></tr>
<tr><td>sprechen</td><td>sprich<b>st</b></td><td>sprich<b>t</b></td><td>说</td></tr>
<tr><td>lesen</td><td>lies<b>t</b></td><td>lies<b>t</b></td><td>读</td></tr>
<tr><td>nehmen</td><td>nimm<b>st</b></td><td>nimm<b>t</b></td><td>拿</td></tr></table>
<h3>三巨头：sein / haben / werden（必须背熟）</h3>
<table><tr><th></th><th>sein（是）</th><th>haben（有）</th><th>werden（成为）</th></tr>
<tr><td>ich</td><td>bin</td><td>habe</td><td>werde</td></tr>
<tr><td>du</td><td>bist</td><td>hast</td><td>wirst</td></tr>
<tr><td>er/sie/es</td><td>ist</td><td>hat</td><td>wird</td></tr>
<tr><td>wir</td><td>sind</td><td>haben</td><td>werden</td></tr>
<tr><td>ihr</td><td>seid</td><td>habt</td><td>werdet</td></tr>
<tr><td>sie/Sie</td><td>sind</td><td>haben</td><td>werden</td></tr></table>`,
  exercises: [
    { type: 'fill', q: 'ich ___ (lernen) Deutsch.', a: 'lerne', tip: 'ich 加词尾 -e。' },
    { type: 'fill', q: 'Du ___ (kommen) aus China.', a: 'kommst', tip: 'du 加 -st：kommst。' },
    { type: 'fill', q: 'Er ___ (arbeiten) in Bonn.', a: 'arbeitet', tip: '词干以 t 结尾，er 加 -et：arbeitet。' },
    { type: 'fill', q: 'Ihr ___ (wohnen) in München.', a: 'wohnt', tip: 'ihr 加 -t：wohnt。' },
    { type: 'fill', q: 'Du ___ (sprechen) sehr gut Deutsch.', a: 'sprichst', tip: 'sprechen 是不规则动词：du sprichst。' },
    { type: 'fill', q: 'Er ___ (essen) einen Apfel.', a: 'isst', tip: 'essen：er isst。' },
    { type: 'fill', q: 'Wir ___ (sein) Studenten.', a: 'sind', tip: 'sein 的 wir 形式是 sind。' },
    { type: 'fill', q: 'Ihr ___ (haben) viel Zeit.', a: 'habt', tip: 'haben 的 ihr 形式是 habt。' },
    { type: 'choice', q: 'Sie（您）___ Lehrer. （sein）', opts: ['sind', 'seid', 'bin'], a: 0, tip: 'Sie（您）与 sie/they 一样用 sind。' },
    { type: 'fill', q: 'Das Kind ___ (nehmen) das Buch.', a: 'nimmt', tip: 'nehmen 不规则：es nimmt。' }
  ]
},
{
  id: 'g-kasus', title: '名词与四个格', level: 'A1',
  summary: '名词词性、Nominativ / Akkusativ / Dativ 冠词变化。',
  lesson: `
<p>每个德语名词都有词性：<span class="g-m">der（阳性 m）</span>、<span class="g-f">die（阴性 f）</span>、<span class="g-n">das（中性 n）</span>。词性没有绝对规律，必须和单词一起记（本站用颜色帮你记：<span class="g-m">蓝=der</span>，<span class="g-f">红=die</span>，<span class="g-n">绿=das</span>）。</p>
<h3>四个格（A1 掌握前三格即可）</h3>
<ul>
<li><b>Nominativ（第一格）</b>：主语 —— <u>Der</u> Mann schläft.</li>
<li><b>Akkusativ（第四格）</b>：直接宾语 —— Ich sehe <u>den</u> Mann. 只有<b>阳性</b>变化！</li>
<li><b>Dativ（第三格）</b>：间接宾语 —— Ich helfe <u>dem</u> Mann.</li>
</ul>
<h3>定冠词变格表</h3>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th><th>pl</th></tr>
<tr><td>Nom.</td><td class="g-m">der</td><td class="g-f">die</td><td class="g-n">das</td><td>die</td></tr>
<tr><td>Akk.</td><td class="g-m">den</td><td class="g-f">die</td><td class="g-n">das</td><td>die</td></tr>
<tr><td>Dat.</td><td class="g-m">dem</td><td class="g-f">der</td><td class="g-n">dem</td><td>den + n</td></tr></table>
<h3>不定冠词（ein-）变格</h3>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th></tr>
<tr><td>Nom.</td><td class="g-m">ein</td><td class="g-f">eine</td><td class="g-n">ein</td></tr>
<tr><td>Akk.</td><td class="g-m">einen</td><td class="g-f">eine</td><td class="g-n">ein</td></tr>
<tr><td>Dat.</td><td class="g-m">einem</td><td class="g-f">einer</td><td class="g-n">einem</td></tr></table>
<p><b>记忆要点</b>：只有阳性宾语才把 der→den、ein→einen，其余词性第四格不变。这是 A1 最重要的语法点。</p>
<h3>常用格的信号词</h3>
<ul><li>第四格动词：haben, brauchen, kaufen, sehen, essen, trinken, nehmen, besuchen</li>
<li>第三格动词：helfen, danken, gefallen, gehören, antworten</li></ul>`,
  exercises: [
    { type: 'fill', q: 'Ich sehe ___ Mann. (der Mann)', a: 'den', tip: 'sehen 接第四格，阳性 der→den。' },
    { type: 'fill', q: 'Ich kaufe ___ Apfel. (ein / der Apfel，用不定冠词)', a: 'einen', tip: 'kaufen 第四格，ein Apfel → einen Apfel。' },
    { type: 'fill', q: 'Ich sehe ___ Frau. (die Frau)', a: 'die', tip: '阴性第四格不变，仍是 die。' },
    { type: 'fill', q: 'Er hilft ___ Kind. (das Kind)', a: 'dem', tip: 'helfen 接第三格，das→dem。' },
    { type: 'fill', q: 'Wir trinken ___ Kaffee. (der Kaffee，用定冠词)', a: 'den', tip: 'trinken 第四格：der→den。' },
    { type: 'choice', q: 'Sie besucht ___ Freundin. （不定冠词）', opts: ['eine', 'einen', 'ein'], a: 0, tip: 'Freundin 是阴性，第四格阴性不变：eine。' },
    { type: 'choice', q: 'Ich habe ___ Auto. （不定冠词）', opts: ['ein', 'einen', 'eine'], a: 0, tip: 'Auto 是中性，第四格中性不变：ein Auto。' },
    { type: 'fill', q: 'Das Buch gehört ___ Lehrer. (der Lehrer)', a: 'dem', tip: 'gehören 接第三格：der→dem。' },
    { type: 'choice', q: '"第几格只有阳性发生变化？"（指冠词）', opts: ['第四格 Akkusativ', '第一格 Nominativ', '所有格都只有阳性变'], a: 0, tip: '第四格只有阳性 der→den。' }
  ]
},
{
  id: 'g-pronomen', title: '人称代词与物主代词', level: 'A1',
  summary: 'ich–du–er… 与 mein, dein, sein 等物主冠词。',
  lesson: `
<h3>人称代词（第一格）</h3>
<table><tr><th>中文</th><th>Nom.</th><th>Akk.</th><th>Dat.</th></tr>
<tr><td>我</td><td>ich</td><td>mich</td><td>mir</td></tr>
<tr><td>你</td><td>du</td><td>dich</td><td>dir</td></tr>
<tr><td>他/它/她</td><td>er/es/sie</td><td>ihn/es/sie</td><td>ihm/ihm/ihr</td></tr>
<tr><td>我们</td><td>wir</td><td>uns</td><td>uns</td></tr>
<tr><td>你们</td><td>ihr</td><td>euch</td><td>euch</td></tr>
<tr><td>他们/您</td><td>sie/Sie</td><td>sie/Sie</td><td>ihnen/Ihnen</td></tr></table>
<h3>物主冠词（= 英文 my, your…）</h3>
<table><tr><th>人称</th><th>物主词</th><th>例</th></tr>
<tr><td>ich</td><td>mein</td><td>mein Vater</td></tr>
<tr><td>du</td><td>dein</td><td>dein Buch</td></tr>
<tr><td>er</td><td>sein</td><td>sein Auto</td></tr>
<tr><td>sie</td><td>ihr</td><td>ihr Bruder</td></tr>
<tr><td>wir</td><td>unser</td><td>unser Haus</td></tr>
<tr><td>ihr</td><td>euer</td><td>euer Lehrer</td></tr>
<tr><td>sie/Sie</td><td>Ihr (您的要大写!)</td><td>Ihr Name</td></tr></table>
<p>物主词像 ein 一样变格：阳性第四格加 -en（mein→meinen）。阴性/复数加 -e（meine Mutter）。</p>`,
  exercises: [
    { type: 'fill', q: 'Wie heißt ___? (du 的物主词) ___ Bruder', a: 'dein', tip: 'du 的物主词是 dein。' },
    { type: 'fill', q: 'Das ist ___ Lehrerin. (wir)', a: 'unsere', tip: 'wir 的物主词 unser，阴性加 -e：unsere。' },
    { type: 'choice', q: 'Sie liebt ___ Bruder. （er 的物主词）', opts: ['sein', 'ihren', 'ihr'], a: 1, tip: 'sie（她）的物主词是 ihr；Bruder 阳性第四格加 -en → ihren。' },
    { type: 'fill', q: 'Ich sehe ___ (du，第四格).', a: 'dich', tip: 'du 的第四格是 dich。' },
    { type: 'fill', q: 'Er gibt ___ (ich，第三格) das Buch.', a: 'mir', tip: 'ich 的第三格是 mir。' },
    { type: 'choice', q: 'Wie ist ___ Name?（问对方"您的名字"，用敬称）', opts: ['Ihr', 'ihre', 'dein'], a: 0, tip: '敬称 Sie 的物主词 Ihr 首字母大写。' },
    { type: 'fill', q: 'Wir besuchen ___ (sie = they，第四格).', a: 'sie', tip: 'sie（他们）第四格不变。' }
  ]
},
{
  id: 'g-frage', title: '疑问词与疑问句', level: 'A1',
  summary: 'wer, was, wo, wohin, wann, wie, warum 以及 ja/nein 问句。',
  lesson: `
<h3>常用疑问词</h3>
<table><tr><th>疑问词</th><th>意思</th><th>例句</th></tr>
<tr><td>wer</td><td>谁</td><td>Wer ist das?</td></tr>
<tr><td>was</td><td>什么</td><td>Was machst du?</td></tr>
<tr><td>wo</td><td>哪里（静止）</td><td>Wo wohnst du?</td></tr>
<tr><td>wohin</td><td>去哪里（方向）</td><td>Wohin gehst du?</td></tr>
<tr><td>woher</td><td>从哪来</td><td>Woher kommst du?</td></tr>
<tr><td>wann</td><td>什么时候</td><td>Wann beginnt der Film?</td></tr>
<tr><td>wie</td><td>怎样</td><td>Wie geht es dir?</td></tr>
<tr><td>wie viel / wie viele</td><td>多少（量/数）</td><td>Wie viel kostet das?</td></tr>
<tr><td>warum</td><td>为什么</td><td>Warum lernst du Deutsch?</td></tr>
<tr><td>welcher/welche/welches</td><td>哪个</td><td>Welchen Bus nehmen Sie?</td></tr></table>
<h3>两种问句结构</h3>
<ul>
<li><b>W-Frage</b>：疑问词 + 动词 + 主语 —— <u>Wo</u> <u>wohnst</u> <u>du</u>?</li>
<li><b>ja/nein-Frage</b>：动词放第一位 —— <u>Kommst</u> <u>du</u> aus China?</li>
</ul>
<p>回答 ja/nein 问句：<b>Ja</b>, ich komme aus China. / <b>Nein</b>, ich komme aus Japan.</p>`,
  exercises: [
    { type: 'fill', q: '___ wohnst du? — In Berlin.', a: 'wo', tip: '问居住地（静止）用 wo。' },
    { type: 'fill', q: '___ kommst du? — Aus China.', a: 'woher', tip: '问来源用 woher。' },
    { type: 'fill', q: '___ kostet das Buch? — 12 Euro.', a: 'wie viel', tip: '问价格用 wie viel（也可写作 wieviel）。' },
    { type: 'choice', q: '___ gehst du? — Zum Bahnhof.（问方向）', opts: ['wo', 'wohin', 'woher'], a: 1, tip: '方向用 wohin。' },
    { type: 'choice', q: '下面哪句是正确的 ja/nein 问句？', opts: ['Du kommst aus China?', 'Kommst du aus China?', 'Aus China kommst du?（口语语序，但非标准问句）'], a: 1, tip: '标准问句动词放第一位。' },
    { type: 'fill', q: '___ beginnt der Film? — Um acht Uhr.', a: 'wann', tip: '问时间点用 wann。' },
    { type: 'fill', q: '___ lernst du Deutsch? — Weil ich in Deutschland studieren will.', a: 'warum', tip: '问原因用 warum。' }
  ]
},
{
  id: 'g-satzbau', title: '语序与可分动词', level: 'A1',
  summary: '动词第二位、框架结构、可分动词（aufstehen, anrufen…）。',
  lesson: `
<h3>规则一：变位动词永远在第二位</h3>
<p><u>Heute</u> <u>gehe</u> ich ins Kino.（今天　去　我　看电影）</p>
<p>不管第一位放什么，动词都在第二位。第一位只能是<b>一个</b>成分，主语若不在第一位就退到动词后面。</p>
<h3>规则二：第二动词（不定式/分词）放句尾 → 框架结构</h3>
<p>Ich <u>will</u> heute ins Kino <u>gehen</u>.</p>
<p>Ich <u>habe</u> gestern einen Film <u>gesehen</u>.</p>
<h3>可分动词</h3>
<p>很多动词带前缀（auf-, an-, ein-, aus-, mit-, zu-…），变位时<b>前缀分离，甩到句尾</b>：</p>
<ul>
<li>auf|stehen → Ich <u>stehe</u> um 6 Uhr <u>auf</u>.</li>
<li>an|rufen → Ich <u>rufe</u> dich später <u>an</u>.</li>
<li>ein|kaufen → Wir <u>kaufen</u> im Supermarkt <u>ein</u>.</li>
<li>mit|kommen → <u>Kommst</u> du <u>mit</u>?</li>
<li>fern|sehen → Am Abend <u>sehen</u> wir <u>fern</u>.</li>
</ul>
<p>重音在前缀上（ÁNrufen）即为可分；重音在词干（studíeren）则为不可分（ich studiere，不分离）。</p>`,
  exercises: [
    { type: 'fill', q: 'Heute ___ ich um 7 Uhr ___. (aufstehen，两个空按顺序写，如：stehe auf)', a: 'stehe auf', tip: '可分动词：Heute stehe ich um 7 Uhr auf.（stehe / auf）' },
    { type: 'fill', q: 'Ich ___ dich später ___. (anrufen)', a: 'rufe an', tip: 'Ich rufe dich später an.' },
    { type: 'choice', q: '哪句语序正确？', opts: ['Ich will heute ins Kino gehen.', 'Ich will gehen heute ins Kino.', 'Ich heute will ins Kino gehen.'], a: 0, tip: '情态动词第二位，不定式扔到句尾。' },
    { type: 'fill', q: '___ du mit? (mitkommen，命令式疑问只需填一个词)', a: 'kommst', tip: 'Kommst du mit? —— kommst 第二位，mit 甩尾。' },
    { type: 'choice', q: '"Morgen ___ ich Fußball ___."（spielen 不是可分动词，这句话该怎么填？）', opts: ['spielen / —', 'spiele / —', '— / spiele'], a: 1, tip: 'spielen 不可分：Morgen spiele ich Fußball. 第二位填 spiele。' },
    { type: 'choice', q: '下面哪个动词是可分动词？', opts: ['studieren', 'einkaufen', 'verstehen'], a: 1, tip: '重音在前缀 ein- 上，可分；ver-、be- 等前缀不可分。' }
  ]
},
{
  id: 'g-negation', title: '否定：nicht 与 kein', level: 'A1',
  summary: '什么时候用 nicht，什么时候用 kein。',
  lesson: `
<h3>kein- ：否定带不定冠词或无冠词的名词</h3>
<p>kein = ein 的否定形式，同样变格：</p>
<ul>
<li>Ich habe <b>kein</b> Auto.（↔ Ich habe ein Auto.）</li>
<li>Ich habe <b>keine</b> Zeit.（↔ Ich habe Zeit.）</li>
<li>Er trinkt <b>keinen</b> Kaffee.（阳性第四格 -en）</li>
</ul>
<h3>nicht：否定其余一切</h3>
<ul>
<li>否定动词/整句：Ich schlafe <b>nicht</b>.</li>
<li>否定带定冠词的名词：Das ist <b>nicht</b> mein Auto. / Ich kenne <b>den</b> Mann <b>nicht</b>.</li>
<li>否定形容词：Das ist <b>nicht</b> teuer.</li>
<li>否定地点/方向：Ich gehe <b>nicht</b> ins Kino.</li>
</ul>
<h3>位置口诀</h3>
<p>nicht 尽量靠近被否定的东西；否定整句时放句尾（可分动词/不定式之前）。</p>
<p>Ich kann heute <b>nicht</b> kommen.（在不定式前）</p>`,
  exercises: [
    { type: 'fill', q: 'Ich habe ___ Auto.（否定"我有一辆车"）', a: 'kein', tip: 'Auto 中性 + 不定冠词语义 → kein。' },
    { type: 'fill', q: 'Ich habe ___ Zeit.（否定"我有时间"）', a: 'keine', tip: 'Zeit 阴性无冠词 → keine。' },
    { type: 'choice', q: 'Das ist ___ mein Buch.', opts: ['kein', 'nicht', 'nichts'], a: 1, tip: ' mein 是物主冠词（类似定冠词），用 nicht 否定。' },
    { type: 'choice', q: 'Er trinkt ___ Tee.（他喝茶→否定）', opts: ['nicht Tee', 'keinen Tee', 'kein Tee'], a: 1, tip: 'Tee 阳性第四格 → keinen。' },
    { type: 'fill', q: 'Ich komme heute ___. （否定整句"我今天不来"）', a: 'nicht', tip: '否定动词用 nicht，放句尾（不定式前）。' },
    { type: 'choice', q: 'Das ist ___ teuer.', opts: ['kein', 'nicht'], a: 1, tip: '否定形容词用 nicht。' }
  ]
},
{
  id: 'g-modal', title: '情态动词', level: 'A1',
  summary: 'möchten, können, müssen, wollen, dürfen —— 句子里的第二把交椅。',
  lesson: `
<p>情态动词表示"想要/能够/必须/允许"，与动词原形搭配：情态动词变位放第二位，原形扔句尾。</p>
<h3>变位表（注意单数形式不规则）</h3>
<table><tr><th></th><th>können<br>能</th><th>müssen<br>必须</th><th>wollen<br>想要</th><th>dürfen<br>允许</th><th>möchten<br>想要(礼貌)</th></tr>
<tr><td>ich</td><td>kann</td><td>muss</td><td>will</td><td>darf</td><td>möchte</td></tr>
<tr><td>du</td><td>kannst</td><td>musst</td><td>willst</td><td>darfst</td><td>möchtest</td></tr>
<tr><td>er/sie/es</td><td>kann</td><td>muss</td><td>will</td><td>darf</td><td>möchte</td></tr>
<tr><td>wir</td><td>können</td><td>müssen</td><td>wollen</td><td>dürfen</td><td>möchten</td></tr>
<tr><td>ihr</td><td>könnt</td><td>müsst</td><td>wollt</td><td>dürft</td><td>möchtet</td></tr>
<tr><td>sie/Sie</td><td>können</td><td>müssen</td><td>wollen</td><td>dürfen</td><td>möchten</td></tr></table>
<p>要点：单数 ich 和 er 形式相同、不加词尾；möchten 没有不定式词尾，最常用于点餐购物。</p>
<h3>例句</h3>
<ul>
<li>Ich <b>möchte</b> einen Kaffee, bitte.（我想要一杯咖啡。）</li>
<li>Kannst du mir <b>helfen</b>?</li>
<li>Ich <b>muss</b> heute arbeiten.</li>
<li>Hier <b>darf</b> man nicht rauchen.</li>
<li>Wir <b>wollen</b> im Sommer nach Deutschland <b>fahren</b>.</li>
</ul>`,
  exercises: [
    { type: 'fill', q: 'Ich ___ einen Kaffee, bitte. (möchten)', a: 'möchte', tip: 'ich 形式：möchte。' },
    { type: 'fill', q: 'Du ___ sehr gut Deutsch sprechen. (können)', a: 'kannst', tip: 'du kannst。' },
    { type: 'fill', q: 'Er ___ heute arbeiten. (müssen)', a: 'muss', tip: 'er muss，不加词尾。' },
    { type: 'choice', q: 'Ihr ___ leise sein. （dürfen，否定：你们必须保持安静 → 不允许吵）', opts: ['dürft nicht', 'darf nicht', 'dürfen nicht'], a: 0, tip: 'ihr 形式 dürft + nicht。' },
    { type: 'fill', q: 'Wir ___ im Sommer nach Deutschland fahren. (wollen)', a: 'wollen', tip: 'wir wollen，情态动词正常变位。' },
    { type: 'choice', q: '哪句正确？', opts: ['Ich möchte kaufen ein Buch.', 'Ich möchte ein Buch kaufen.', 'Ich ein Buch kaufen möchte.'], a: 1, tip: '情态动词第二位，原形 kaufen 句尾。' },
    { type: 'fill', q: '___ Sie mir helfen? (können，敬称)', a: 'Können', tip: 'Sie（您）用复数形式 können。' }
  ]
},
{
  id: 'g-perfekt', title: '现在完成时 Perfekt', level: 'A1',
  summary: 'haben/sein + Partizip II，德语口语里讲过去就用它。',
  lesson: `
<p>口语中谈论过去，德语几乎只用 Perfekt：<b>haben/sein（变位）+ 第二分词（句尾）</b>。</p>
<p>Ich <u>habe</u> gestern einen Film <u>gesehen</u>.</p>
<h3>第二分词（Partizip II）的构成</h3>
<p><b>规则动词</b>：ge + 词干 + t　　lernen → ge|lern|t　　arbeiten → ge|arbeit|et</p>
<p><b>不规则动词</b>：ge + 变化词干 + en　　sehen → <b>ge</b>se<b>hen</b>　　trinken → <b>ge</b>tr<b>unken</b></p>
<h3>什么时候用 sein？</h3>
<p>表示<b>位移或状态变化</b>的不及物动词用 sein：</p>
<ul>
<li>Ich <b>bin</b> nach Berlin <b>gefahren</b>.</li>
<li>Er <b>ist</b> um 6 Uhr <b>aufgestanden</b>.</li>
<li>Sie <b>ist</b> Lehrerin <b>geworden</b>.</li>
</ul>
<p>其余（及物动词、反身、持续状态）用 haben：Ich <b>habe</b> Deutsch <b>gelernt</b>.</p>
<h3>可分动词：ge 插在中间</h3>
<p>auf|stehen → <b>aufge</b>standen　　ein|kaufen → <b>einge</b>kauft</p>
<h3>-ieren 动词不加 ge</h3>
<p>studieren → studiert　　telefonieren → telefoniert</p>
<h3>A1 必背不规则分词</h3>
<table><tr><th>原形</th><th>Partizip II</th><th>原形</th><th>Partizip II</th></tr>
<tr><td>sein</td><td>ist gewesen</td><td>haben</td><td>hat gehabt</td></tr>
<tr><td>essen</td><td>gegessen</td><td>trinken</td><td>getrunken</td></tr>
<tr><td>sprechen</td><td>gesprochen</td><td>lesen</td><td>gelesen</td></tr>
<tr><td>sehen</td><td>gesehen</td><td>kommen</td><td>ist gekommen</td></tr>
<tr><td>gehen</td><td>ist gegangen</td><td>fahren</td><td>ist gefahren</td></tr>
<tr><td>schreiben</td><td>geschrieben</td><td>nehmen</td><td>genommen</td></tr></table>`,
  exercises: [
    { type: 'fill', q: 'Ich ___ Deutsch ___. (lernen, Perfekt，如：habe gelernt)', a: 'habe gelernt', tip: 'haben + gelernt。' },
    { type: 'fill', q: 'Er ___ nach Berlin ___. (fahren)', a: 'ist gefahren', tip: '位移动词用 sein：ist gefahren。' },
    { type: 'fill', q: 'Wir ___ Pizza ___. (essen)', a: 'haben gegessen', tip: 'haben + gegessen。' },
    { type: 'fill', q: 'Sie ___ um 6 Uhr ___. (aufstehen)', a: 'ist aufgestanden', tip: '状态变化用 sein；ge 插中间：aufgestanden。' },
    { type: 'choice', q: 'telefonieren 的 Partizip II 是？', opts: ['getelefoniert', 'telefoniert', 'telefonieren gehabt'], a: 1, tip: '-ieren 动词不加 ge。' },
    { type: 'fill', q: '___ du den Film ___? (sehen)', a: 'Hast gesehen', tip: 'Hast du den Film gesehen? 大小写不敏感也可。' },
    { type: 'choice', q: '哪句正确？', opts: ['Ich habe gestern ein Buch gelesen.', 'Ich habe gelesen ein Buch gestern.', 'Ich ein Buch gelesen habe gestern.'], a: 0, tip: 'haben 第二位，分词和句子成分按框架排布。' }
  ]
},
{
  id: 'g-praep', title: '介词', level: 'A1',
  summary: 'in, an, auf, mit, für, nach, bei…… 与格的搭配。',
  lesson: `
<h3>第三格介词（静三动四里"静"的那批，永远 Dat.）</h3>
<p><b>mit, nach, aus, bei, seit, von, zu</b> —— 口诀：mnabs vz（"静三"）</p>
<ul>
<li>mit（和…一起/乘坐）：Ich fahre <b>mit dem</b> Bus.</li>
<li>nach（去…之后/接城市名）：nach Berlin, nach dem Essen</li>
<li>aus（从…出来）：Ich komme <b>aus</b> China.</li>
<li>bei（在…那里/在进行）：Ich wohne <b>bei</b> meinen Eltern.</li>
<li>seit（自从）：Ich lerne <b>seit</b> einem Jahr Deutsch.</li>
<li>von（从…/属于）：<b>von</b> Montag <b>bis</b> Freitag</li>
<li>zu（到…去）：Ich gehe <b>zum</b> Arzt.（zu dem = zum）</li>
</ul>
<h3>第四格介词</h3>
<p><b>für, gegen, ohne, um, bis</b> —— 口诀：fogo ub（"动四"）</p>
<ul>
<li>Das Geschenk ist <b>für</b> <b>meine</b> Mutter.</li>
<li><b>ohne</b> Zucker, bitte.（不加糖）</li>
<li><b>um</b> acht Uhr（在八点）</li>
</ul>
<h3>静三动四：in / an / auf</h3>
<table><tr><th></th><th>位置（Dat.）</th><th>方向（Akk.）</th></tr>
<tr><td>in</td><td>in der Stadt</td><td>in die Stadt</td></tr>
<tr><td>an</td><td>an der Wand</td><td>an die Wand</td></tr>
<tr><td>auf</td><td>auf dem Tisch</td><td>auf den Tisch</td></tr></table>
<p>Ich bin <b>in der</b> Schule.（我在学校。）→ Ich gehe <b>in die</b> Schule.（我去学校。）</p>
<h3>常用搭配</h3>
<ul>
<li>am Montag（am = an dem），im Mai（im = in dem）</li>
<li>zu Hause（在家）/ nach Hause（回家）—— 固定用法！</li>
</ul>`,
  exercises: [
    { type: 'fill', q: 'Ich fahre ___ Bus zur Arbeit. (mit)', a: 'mit dem', tip: 'mit 永远第三格：mit dem Bus。' },
    { type: 'choice', q: 'Das Geschenk ist ___ meine Mutter. (für)', opts: ['für meine', 'für meiner', 'für meinen'], a: 0, tip: 'für 接第四格，Mutter 阴性不变：meine。' },
    { type: 'fill', q: 'Ich gehe ___ Arzt. (zu + der Arzt → 缩写)', a: 'zum', tip: 'zu dem = zum：zum Arzt。' },
    { type: 'choice', q: 'Ich bin ___ Hause. （在家）', opts: ['zu', 'nach', 'in'], a: 0, tip: '在家是 zu Hause，回家是 nach Hause。' },
    { type: 'fill', q: 'Das Buch liegt ___ Tisch. (auf + der Tisch，第三格)', a: 'auf dem', tip: '位置（躺着不动）用第三格：auf dem Tisch。' },
    { type: 'fill', q: 'Ich gehe ___ Schule. (in + die Schule，第四格)', a: 'in die', tip: '方向用第四格：in die Schule。' },
    { type: 'choice', q: 'Ich komme ___ China.', opts: ['aus', 'von', 'nach'], a: 0, tip: '来自某国家用 aus。' },
    { type: 'choice', q: '___ acht Uhr beginnt der Kurs.', opts: ['Um', 'Am', 'Im'], a: 0, tip: '时间点用 um；am 用于星期（am Montag），im 用于月份。' }
  ]
}
];
