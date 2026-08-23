/* A2 语法数据。lesson 为 HTML 字符串，exercises: {type:'choice'|'fill', q, opts?, a, tip} */
window.GRAMMAR = window.GRAMMAR || [];
window.GRAMMAR.push(
{
  id: 'g-a2-praeteritum', title: '过去时 Präteritum', level: 'A2',
  summary: 'war/hatte 与规则动词过去时：书面讲故事的时态。',
  lesson: `
<p>Perfekt（haben/sein + 分词）用于<b>口语</b>谈过去；<b>Präteritum（过去时）</b>主要用于<b>书面</b>叙述，以及情态动词和 sein/haben（口语也用过去时）。</p>
<h3>sein / haben / werden 过去时（必背）</h3>
<table><tr><th></th><th>sein</th><th>haben</th><th>werden</th></tr>
<tr><td>ich</td><td>war</td><td>hatte</td><td>wurde</td></tr>
<tr><td>du</td><td>warst</td><td>hattest</td><td>wurdest</td></tr>
<tr><td>er/sie/es</td><td>war</td><td>hatte</td><td>wurde</td></tr>
<tr><td>wir</td><td>waren</td><td>hatten</td><td>wurden</td></tr>
<tr><td>ihr</td><td>wart</td><td>hattet</td><td>wurdet</td></tr>
<tr><td>sie/Sie</td><td>waren</td><td>hatten</td><td>wurden</td></tr></table>
<h3>规则动词：词干 + te + 人称词尾</h3>
<p>lernen → ich lernte, du lerntest, er lernte, wir lernten, ihr lerntet, sie lernten</p>
<p>arbeiten → ich arbeit<b>ete</b>（词干以 t/d 结尾加 ete）</p>
<h3>常用不规则过去式</h3>
<table><tr><th>原形</th><th>过去时（er）</th><th>原形</th><th>过去时（er）</th></tr>
<tr><td>gehen</td><td>ging</td><td>kommen</td><td>kam</td></tr>
<tr><td>sehen</td><td>sah</td><td>geben</td><td>gab</td></tr>
<tr><td>nehmen</td><td>nahm</td><td>finden</td><td>fand</td></tr>
<tr><td>essen</td><td>aß</td><td>trinken</td><td>trank</td></tr>
<tr><td>sprechen</td><td>sprach</td><td>bleiben</td><td>blieb</td></tr>
<tr><td>schreiben</td><td>schrieb</td><td>fahren</td><td>fuhr</td></tr>
<tr><td>lesen</td><td>las</td><td>denken</td><td>dachte</td></tr></table>
<h3>情态动词过去时（口语常用！）</h3>
<p>können → <b>konnte</b>；müssen → <b>musste</b>；wollen → <b>wollte</b>；dürfen → <b>durfte</b>；sollen → <b>sollte</b></p>
<p>Als Kind <b>konnte</b> ich nicht schwimmen.（小时候我不会游泳。）</p>`,
  exercises: [
    { type: 'fill', q: 'Ich ___ gestern in Berlin. (sein)', a: 'war', tip: 'sein 的 ich 过去时是 war。' },
    { type: 'fill', q: 'Wir ___ keine Zeit. (haben)', a: 'hatten', tip: 'haben 的 wir 过去时是 hatten。' },
    { type: 'fill', q: 'Er ___ gestern krank. (sein)', a: 'war', tip: 'er war。' },
    { type: 'fill', q: 'Du ___ als Kind sehr lustig. (sein)', a: 'warst', tip: 'du warst。' },
    { type: 'fill', q: 'Ich ___ von 2015 bis 2018 in Bonn. (wohnen)', a: 'wohnte', tip: '规则动词：wohnte。' },
    { type: 'choice', q: 'Er ___ nach Hause. (gehen，过去时)', opts: ['geht', 'ging', 'ist gegangen（这是 Perfekt，题要 Präteritum）'], a: 1, tip: 'gehen 过去时 ging。' },
    { type: 'choice', q: 'Als Kind ___ ich kein Deutsch. (können，过去时)', opts: ['kann', 'konnte', 'gekannnt'], a: 1, tip: 'können 过去时 konnte。' },
    { type: 'fill', q: 'Wir ___ den Film gestern. (sehen，过去时，er-form 格式同 wir)', a: 'sahen', tip: 'sehen 过去时：wir sahen。' },
    { type: 'choice', q: '哪种场合更常用 Präteritum？', opts: ['朋友间聊天讲昨天的事', '写故事、新闻报道', '点餐'], a: 1, tip: '口语谈过去用 Perfekt；书面叙述用 Präteritum（情态动词和 sein/haben 例外，口语也常用过去时）。' }
  ]
},
{
  id: 'g-a2-adjektive', title: '形容词词尾', level: 'A2',
  summary: '冠词后面和没有冠词时，形容词如何变尾。',
  lesson: `
<p>形容词放在名词前时必须加词尾。词尾取决于：<b>冠词类型</b> + <b>格</b> + <b>性</b>。</p>
<h3>定冠词后（弱变化）—— 记一张表</h3>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th><th>pl</th></tr>
<tr><td>Nom.</td><td>-e</td><td>-e</td><td>-e</td><td>-en</td></tr>
<tr><td>Akk.</td><td>-en</td><td>-e</td><td>-e</td><td>-en</td></tr>
<tr><td>Dat.</td><td>-en</td><td>-en</td><td>-en</td><td>-en</td></tr></table>
<p>der alt<b>e</b> Mann → den alt<b>en</b> Mann → dem alt<b>en</b> Mann</p>
<h3>不定冠词后（混合变化）</h3>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th></tr>
<tr><td>Nom.</td><td>ein alt<b>er</b></td><td>eine alt<b>e</b></td><td>ein alt<b>es</b></td></tr>
<tr><td>Akk.</td><td>einen alt<b>en</b></td><td>eine alt<b>e</b></td><td>ein alt<b>es</b></td></tr>
<tr><td>Dat.</td><td>einem alt<b>en</b></td><td>einer alt<b>en</b></td><td>einem alt<b>en</b></td></tr></table>
<h3>无冠词（强变化）—— 形容词自己带冠词的词尾</h3>
<p>alter Wein, alte Milch, altes Brot；guten Wein（第四格）</p>
<h3>口诀</h3>
<ul>
<li>定冠词后：第一格全 -e，其余全 -en</li>
<li>不定冠词后：不定冠词"露出"什么（ein/-es/-en），形容词就补什么</li>
<li>无冠词：形容词词尾 = 定冠词词尾（-er/-e/-es/-en…）</li>
</ul>`,
  exercises: [
    { type: 'fill', q: 'der jung___ Mann（第一格）', a: 'e', tip: '定冠词第一格：-e。der junge Mann。' },
    { type: 'fill', q: 'Ich sehe den alt___ Mann.（第四格）', a: 'en', tip: '定冠词第四格阳性：-en。' },
    { type: 'fill', q: 'mit dem neu___ Auto（第三格）', a: 'en', tip: '定冠词第三格：全 -en。' },
    { type: 'fill', q: 'ein klein___ Kind（第一格，中性）', a: 'es', tip: '不定冠词中性第一格：-es。' },
    { type: 'fill', q: 'Ich trinke einen frisch___ Kaffee.（第四格）', a: 'en', tip: '不定冠词阳性第四格：-en。' },
    { type: 'fill', q: 'eine schön___ Stadt（第一格）', a: 'e', tip: '阴性第一格：-e。' },
    { type: 'choice', q: 'kalt___ Wasser ist gesund.（无冠词，第一格中性）', opts: ['kaltes', 'kalte', 'kalter'], a: 0, tip: '无冠词时形容词带定冠词词尾：das → -es。' },
    { type: 'choice', q: 'die alt___ Häuser（复数第一格，定冠词）', opts: ['alte', 'alten', 'altes'], a: 1, tip: '定冠词复数全部 -en。' },
    { type: 'fill', q: 'Wir wohnen in einer klein___ Wohnung.（第三格）', a: 'en', tip: '不定冠词第三格：-en。' }
  ]
},
{
  id: 'g-a2-komparativ', title: '比较级与最高级', level: 'A2',
  summary: 'groß – größer – am größten，以及 als / wie 的用法。',
  lesson: `
<h3>构成</h3>
<ul>
<li>规则：原级 + <b>er</b>；最高级 am <b>sten</b>（辅音后常加 umlaut）</li>
<li>klein – klein<b>er</b> – am klein<b>sten</b></li>
<li>alt – <b>ä</b>lt<b>er</b> – am <b>ä</b>lt<b>esten</b></li>
<li>以 -el / -er 结尾去 e：dunkel – dunkl<b>er</b>；teuer – teur<b>er</b></li>
</ul>
<h3>句型</h3>
<ul>
<li>比较：<b>als</b>（比）：Berlin ist größer <b>als</b> Bonn.</li>
<li>同级：<b>so … wie</b>（和…一样）：Er ist so groß <b>wie</b> ich.</li>
<li>最高级：Der Everest ist <b>am höchsten</b>. / der höchste Berg.</li>
</ul>
<h3>不规则（必背）</h3>
<table><tr><th>原级</th><th>比较级</th><th>最高级</th></tr>
<tr><td>gut</td><td>besser</td><td>am besten</td></tr>
<tr><td>viel</td><td>mehr</td><td>am meisten</td></tr>
<tr><td>gern</td><td>lieber</td><td>am liebsten</td></tr>
<tr><td>hoch</td><td>höher</td><td>am höchsten</td></tr>
<tr><td>groß</td><td>größer</td><td>am größten</td></tr></table>
<p>注意：gern 的比较级 lieber 常用于偏好：Ich trinke <b>lieber</b> Tee.</p>`,
  exercises: [
    { type: 'fill', q: 'Berlin ist ___ als Bonn. (groß)', a: 'größer', tip: 'groß → größer（加变元音 + er）。' },
    { type: 'fill', q: 'Er ist so alt ___ ich.', a: 'wie', tip: '同级比较 so … wie。' },
    { type: 'fill', q: 'Ich trinke ___ Tee. (gern 的比较级：更偏好)', a: 'lieber', tip: 'gern – lieber – am liebsten。' },
    { type: 'fill', q: 'Das ist die ___ Lösung. (gut 的最高级作定语，die ___ Lösung)', a: 'beste', tip: 'gut → besser → die beste（作定语时 best + 词尾 e）。' },
    { type: 'choice', q: 'am ___ (viel)', opts: ['vielen', 'meisten', 'mehrsten'], a: 1, tip: 'viel – mehr – am meisten。' },
    { type: 'fill', q: 'Mein Bruder ist ___ als ich. ( jung)', a: 'jünger', tip: 'jung → jünger。' },
    { type: 'choice', q: '比较级用哪个连词？', opts: ['wie', 'als', 'wenn'], a: 1, tip: '比较级 + als；同级 so … wie。' },
    { type: 'fill', q: 'Dieses Hotel ist am ___. (gut)', a: 'besten', tip: 'am besten。' }
  ]
},
{
  id: 'g-a2-reflexiv', title: '反身代词 sich', level: 'A2',
  summary: 'sich freuen, sich waschen —— 动词回指自己。',
  lesson: `
<p>反身动词的动作作用于主语自己，必须带反身代词：</p>
<table><tr><th>人称</th><th>Akk.</th><th>Dat.</th></tr>
<tr><td>ich</td><td>mich</td><td>mir</td></tr>
<tr><td>du</td><td>dich</td><td>dir</td></tr>
<tr><td>er/sie/es</td><td><b>sich</b></td><td><b>sich</b></td></tr>
<tr><td>wir</td><td>uns</td><td>uns</td></tr>
<tr><td>ihr</td><td>euch</td><td>euch</td></tr>
<tr><td>sie/Sie</td><td><b>sich</b></td><td><b>sich</b></td></tr></table>
<h3>常用反身动词（Akk.）</h3>
<ul>
<li>sich freu<b>en</b>（高兴）：Ich freue mich.</li>
<li>sich waschen / duschen / anziehen（洗/淋浴/穿衣）</li>
<li>sich interessieren für（对…感兴趣）</li>
<li>sich erinnern an（想起）</li>
<li>sich treffen（见面）：Wir treffen uns um acht.</li>
<li>sich fühlen（感觉）：Wie fühlst du dich?</li>
</ul>
<h3>常见真反身动词（必须带 sich）</h3>
<p>sich beeilen（赶紧）、sich erholen（休养）、sich bedanken（致谢）、sich irren（弄错）</p>
<h3>带介词的反身动词</h3>
<p>Ich freue mich <b>auf</b> den Urlaub.（期待）／Ich freue mich <b>über</b> das Geschenk.（为…高兴）</p>`,
  exercises: [
    { type: 'fill', q: 'Ich freue ___ über das Geschenk.', a: 'mich', tip: 'ich 的第四格反身代词 mich。' },
    { type: 'fill', q: 'Er wäscht ___ jeden Morgen.', a: 'sich', tip: 'er → sich。' },
    { type: 'fill', q: 'Wir treffen ___ um acht Uhr.', a: 'uns', tip: 'wir → uns。' },
    { type: 'fill', q: 'Beeil ___! Wir sind spät! (du)', a: 'dich', tip: 'sich beeilen：Beeile dich! 命令式。答案不区分 Beeile/Beeil。' },
    { type: 'choice', q: 'Ich interessiere mich ___ Musik.', opts: ['über', 'für', 'an'], a: 1, tip: 'sich interessieren für + 第四格。' },
    { type: 'choice', q: 'Ich freue mich ___ das Wochenende.（期待即将到来的）', opts: ['auf', 'über', 'von'], a: 0, tip: '期待将来的事用 auf。' },
    { type: 'fill', q: 'Wie fühlst du ___?', a: 'dich', tip: 'du → dich。' },
    { type: 'choice', q: '哪个是真反身动词（必须带 sich）？', opts: ['kaufen', 'sich erholen', 'lesen'], a: 1, tip: 'sich erholen 不能没有 sich。' }
  ]
},
{
  id: 'g-a2-dativ', title: '第三格动词与双宾语', level: 'A2',
  summary: 'helfen, gefallen, gehören… 以及"人三物四"句型。',
  lesson: `
<h3>只接第三格的动词（宾语是人/对象）</h3>
<p><b>helfen, danken, gefallen, gehören, passen, antworten, gratulieren, zuhören, vertrauen, schmecken</b></p>
<ul>
<li>Ich helfe <b>dem</b> Kind.（我帮助孩子）</li>
<li>Der Film gefällt <b>mir</b>.（我喜欢这部电影）</li>
<li>Danke <b>dir</b>!（谢谢你！）</li>
<li>Das Buch gehört <b>der</b> Frau.（这本书是这位女士的）</li>
<li>Der Pullover passt <b>dir</b> gut.（这件毛衣很合你的身）</li>
</ul>
<h3>双宾语：人三物四</h3>
<p>geben, schenken, zeigen, bringen, leihen, erklären, senden</p>
<p>Ich gebe <b>dem Mann</b>（三格·人）<b>den Schlüssel</b>（四格·物）.</p>
<p>Er schenkt <b>ihr</b> eine Blume.</p>
<h3>位置口诀</h3>
<p>名词：三格在前四格在后（dem Mann den Schlüssel）；<b>代词</b>时四格在前（Ich gebe <b>ihn</b> dem Mann）。</p>`,
  exercises: [
    { type: 'fill', q: 'Ich helfe ___ Kind. (das)', a: 'dem', tip: 'helfen 接第三格：das → dem。' },
    { type: 'fill', q: 'Der Film gefällt ___. (ich)', a: 'mir', tip: 'ich 第三格 mir。' },
    { type: 'fill', q: 'Das Auto gehört ___ Nachbarn. (der Nachbar)', a: 'dem', tip: 'gehören 第三格。' },
    { type: 'fill', q: 'Ich gebe ___ Frau den Brief. (die)', a: 'der', tip: '双宾语：人三（die → der）物四。' },
    { type: 'choice', q: 'Er schenkt ___ eine Blume. (sie)', opts: ['ihr', 'sie', 'ihre'], a: 0, tip: '人第三格：ihr。' },
    { type: 'choice', q: '"Ich gebe ___ das Buch." 用代词指 den Schlüssel 时正确语序是？', opts: ['Ich gebe dem Mann ihn', 'Ich gebe ihn dem Mann'], a: 1, tip: '代词宾语在前，名词宾语在后。' },
    { type: 'fill', q: 'Schmeckt ___ die Suppe? (du)', a: 'dir', tip: 'schmecken 接第三格：dir。' },
    { type: 'fill', q: 'Ich danke ___ für alles. (Sie)', a: 'Ihnen', tip: 'Sie 的第三格是 Ihnen。' }
  ]
},
{
  id: 'g-a2-nebensaetze', title: 'weil / dass / ob 从句', level: 'A2',
  summary: '动词跑到句尾的三种常见从句。',
  lesson: `
<p>从句 = 引导词 + … + <b>变位动词放最后</b>。</p>
<h3>weil（因为）—— 回答 warum</h3>
<p>Ich lerne Deutsch, <b>weil</b> ich in Deutschland arbeiten <b>will</b>.</p>
<p>Warum bist du müde? — <b>Weil</b> ich wenig geschlafen <b>habe</b>.</p>
<h3>dass（那个）—— 陈述内容</h3>
<p>Ich glaube, <b>dass</b> er recht <b>hat</b>.（我认为他是对的）</p>
<p>Es tut mir leid, <b>dass</b> ich spät <b>bin</b>.</p>
<h3>ob（是否）—— 嵌入一般疑问句</h3>
<p>Ich weiß nicht, <b>ob</b> er morgen <b>kommt</b>.（我不知道他明天来不来）</p>
<p>Kannst du mir sagen, <b>ob</b> der Laden offen <b>ist</b>?</p>
<h3>对比：直陈 vs 从句</h3>
<p>Er hat keine Zeit. → Ich denke, <b>dass</b> er keine Zeit <b>hat</b>.</p>
<p>Kommt er? → Weißt du, <b>ob</b> er <b>kommt</b>?</p>`,
  exercises: [
    { type: 'fill', q: 'Ich lerne Deutsch, weil ich in Berlin ___ . (arbeiten)', a: 'arbeite', tip: 'weil 从句动词放尾：arbeite。' },
    { type: 'choice', q: '___ er kommt, weiß ich nicht.（是否）', opts: ['Dass', 'Ob', 'Weil'], a: 1, tip: '"是否"用 ob。' },
    { type: 'fill', q: 'Ich glaube, dass sie recht ___. (haben)', a: 'hat', tip: '动词句尾：hat。' },
    { type: 'choice', q: 'Ich bin müde, ___ ich wenig geschlafen habe.', opts: ['dass', 'weil', 'ob'], a: 1, tip: '原因用 weil。' },
    { type: 'fill', q: 'Weißt du, ob der Laden heute ___ hat?（营业（开门）用哪个可分动词核心：auf/zu）', a: 'auf', tip: 'aufhaben = 营业：Hat der Laden heute auf? 反之 zuhaben = 歇业。' },
    { type: 'choice', q: '下面哪句正确？', opts: ['Weil ich habe keine Zeit.', 'Ich komme nicht, weil ich keine Zeit habe.', 'Ich komme nicht, weil ich habe keine Zeit.'], a: 1, tip: 'weil 从句中动词 habe 必须放句尾。' },
    { type: 'fill', q: 'Es tut mir leid, dass ich so spät ___ . (sein)', a: 'bin', tip: 'dass 从句：bin 放尾。' }
  ]
},
{
  id: 'g-a2-relativ', title: '关系从句（基础）', level: 'A2',
  summary: 'der / die / das 引导的关系从句，给名词加说明。',
  lesson: `
<p>关系代词 = 定冠词的变形，性数看<b>先行词</b>，格看它在从句里的角色。</p>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th><th>pl</th></tr>
<tr><td>Nom.</td><td class="g-m">der</td><td class="g-f">die</td><td class="g-n">das</td><td>die</td></tr>
<tr><td>Akk.</td><td class="g-m">den</td><td class="g-f">die</td><td class="g-n">das</td><td>die</td></tr>
<tr><td>Dat.</td><td class="g-m">dem</td><td class="g-f">der</td><td class="g-n">dem</td><td>denen</td></tr></table>
<h3>例句</h3>
<ul>
<li>Das ist der Mann, <b>der</b> neben mir wohnt.（住我隔壁的那位先生）</li>
<li>Die Frau, <b>die</b> dort steht, ist meine Lehrerin.</li>
<li>Das Buch, <b>das</b> ich lese, ist spannend.（第四格：das 不变）</li>
<li>Der Film, <b>den</b> wir gestern gesehen haben, war toll.（第四格：der → den）</li>
<li>Die Kollegin, <b>der</b> ich helfe, ist neu.（第三格）</li>
</ul>
<h3>要点</h3>
<ul><li>关系代词紧贴先行词（德语不怕重复）</li>
<li>从句动词照旧放句尾</li></ul>`,
  exercises: [
    { type: 'fill', q: 'Das ist der Mann, ___ neben mir wohnt.', a: 'der', tip: '关系代词作主语，阳性第一格 der。' },
    { type: 'fill', q: 'Der Film, ___ wir gestern gesehen haben, war toll.', a: 'den', tip: 'sehen 的宾语（第四格）：der → den。' },
    { type: 'fill', q: 'Die Frau, ___ dort steht, ist Ärztin.', a: 'die', tip: '阴性第一格 die。' },
    { type: 'fill', q: 'Das Kind, ___ ich helfe, ist sechs.（das Kind）', a: 'dem', tip: 'helfen 第三格：das → dem。' },
    { type: 'choice', q: 'Das Buch, ___ ich lese, ist neu.（das Buch）', opts: ['das', 'den', 'dem'], a: 0, tip: 'lesen 第四格，中性 das 不变。' },
    { type: 'choice', q: '关系代词的性和数由什么决定？', opts: ['从句动词', '先行词（被说明的名词）', '主句主语'], a: 1, tip: '看先行词；格才看从句角色。' }
  ]
},
{
  id: 'g-a2-futur', title: '将来时 Futur I', level: 'A2',
  summary: 'werden + 动词原形：计划和预测。',
  lesson: `
<h3>构成</h3>
<p><b>werden（变位）+ 动词原形（句尾）</b></p>
<table><tr><th>ich werde</th><th>wir werden</th></tr>
<tr><td>du wirst</td><td>ihr werdet</td></tr>
<tr><td>er/sie/es wird</td><td>sie/Sie werden</td></tr></table>
<h3>用法</h3>
<ul>
<li><b>计划/打算</b>：Ich <b>werde</b> nächstes Jahr nach Deutschland <b>fahren</b>.</li>
<li><b>预测</b>：Es <b>wird</b> morgen <b>regnen</b>.</li>
<li><b>承诺</b>：Ich <b>werde</b> dir <b>helfen</b>.</li>
</ul>
<h3>口语替代</h3>
<p>口语里"计划"常用现在时 + 时间词：Ich fahre morgen nach Berlin.（效果一样）</p>
<p>预测也常用：Morgen regnet es wahrscheinlich.</p>`,
  exercises: [
    { type: 'fill', q: 'Ich ___ nächstes Jahr nach Japan fahren. (werden)', a: 'werde', tip: 'ich werde。' },
    { type: 'fill', q: 'Du ___ es nicht glauben! (werden)', a: 'wirst', tip: 'du wirst。' },
    { type: 'choice', q: 'Es ___ morgen regnen.', opts: ['wird', 'will', 'hat'], a: 0, tip: 'es wird regnen。' },
    { type: 'choice', q: 'Futur I 的结构是？', opts: ['werden + 分词', 'werden + 原形（句尾）', 'sein + 原形'], a: 1, tip: 'werden 变位 + 原形放句尾。' },
    { type: 'fill', q: 'Wir ___ dich am Bahnhof abholen. (werden)', a: 'werden', tip: 'wir werden。' },
    { type: 'choice', q: '口语里表达明天计划，更常见的是？', opts: ['Ich werde morgen arbeiten.', 'Ich arbeite morgen.（现在时+时间词）'], a: 1, tip: '口语常用现在时 + 时间状语表达计划。' }
  ]
},
{
  id: 'g-a2-ndekl', title: 'N-变格（弱变化名词）', level: 'A2',
  summary: 'der Junge → den Jungen：以 -e 结尾的阳性"生物"名词。',
  lesson: `
<p>一批<b>阳性、指人或动物的名词</b>（多以 -e 结尾）在第一格以外<b>全部加 -n / -en</b>：</p>
<table><tr><th></th><th>der Junge</th><th>der Student</th><th>der Name</th></tr>
<tr><td>Nom.</td><td>der Junge</td><td>der Student</td><td>der Name</td></tr>
<tr><td>Akk.</td><td>den Jung<b>en</b></td><td>den Student<b>en</b></td><td>den Nam<b>en</b></td></tr>
<tr><td>Dat.</td><td>dem Jung<b>en</b></td><td>dem Student<b>en</b></td><td>dem Nam<b>en</b></td></tr></table>
<h3>常见 N-变格名词</h3>
<p>der Junge, der Kollege, der Kunde, der Neighbor→Nachbar（加 -n：Nachbarn）, der Herr（den Herrn）, der Student, der Mensch, der Löwe, der Affe, der Name, der Gedanke</p>
<h3>例句</h3>
<ul>
<li>Ich sehe den Jung<b>en</b>.</li>
<li>Wir helfen dem Kolleg<b>en</b>.</li>
<li>Der Mensch<b>en</b>（复数）sind sozial.</li>
</ul>`,
  exercises: [
    { type: 'fill', q: 'Ich sehe den ___. (der Junge)', a: 'Jungen', tip: 'N-变格：den Jungen。' },
    { type: 'fill', q: 'Wir helfen dem ___. (der Kollege)', a: 'Kollegen', tip: 'dem Kollegen。' },
    { type: 'fill', q: 'Der ___ nebenan ist freundlich. (der Mensch，第一格)', a: 'Mensch', tip: '第一格不变：der Mensch。' },
    { type: 'choice', q: 'Ich frage den ___. (der Herr)', opts: ['Herr', 'Herrn', 'Herren'], a: 1, tip: 'den Herrn。' },
    { type: 'choice', q: '哪些名词需要 N-变格？', opts: ['所有阳性名词', '阳性指人/动物名词（多 -e 结尾）', '所有中性名词'], a: 1, tip: '阳性生物名词，第四/三格加 -n/-en。' }
  ]
},
{
  id: 'g-a2-wechsel', title: '静三动四深化', level: 'A2',
  summary: 'in / an / auf / über 等：位置用三格，方向用四格。',
  lesson: `
<p>九个"身兼两职"的介词：<b>in, an, auf, über, unter, vor, hinter, neben, zwischen</b></p>
<h3>判断法则：问哪里 vs 问哪里去</h3>
<ul>
<li><b>Wo?</b>（在哪）→ Dativ：Das Buch liegt <b>auf dem</b> Tisch.</li>
<li><b>Wohin?</b>（去哪）→ Akkusativ：Ich lege das Buch <b>auf den</b> Tisch.</li>
<li><b>Woher?</b>（从哪）→ 固定 von + Dat.</li>
</ul>
<h3>成对动词</h3>
<table><tr><th>位置（三格）</th><th>方向（四格）</th></tr>
<tr><td>stehen（站着）</td><td>stellen（竖放）</td></tr>
<tr><td>liegen（平放）</td><td>legen（平放动作）</td></tr>
<tr><td>hängen（挂着）</td><td>hängen（挂上）</td></tr></table>
<p>Die Lampe hängt <b>an der</b> Decke. → Ich hänge die Lampe <b>an die</b> Decke.</p>
<h3>时间用法（只接三格）</h3>
<p>am Montag, im Mai, vor dem Essen, nach der Arbeit</p>`,
  exercises: [
    { type: 'fill', q: 'Das Buch liegt ___ Tisch. (auf + der)', a: 'auf dem', tip: '位置（liegen）→ 第三格。' },
    { type: 'fill', q: 'Ich lege das Buch ___ Tisch. (auf + der)', a: 'auf den', tip: '方向（legen）→ 第四格：den。' },
    { type: 'fill', q: 'Wir fahren ___ Stadt. (in + die)', a: 'in die', tip: 'fahren 方向 → in die Stadt。' },
    { type: 'fill', q: 'Wir sind ___ Stadt. (in + die)', a: 'in der', tip: 'sein 位置 → in der Stadt。' },
    { type: 'choice', q: 'Die Lampe hängt ___ Wand. (an + die)', opts: ['an der', 'an die'], a: 0, tip: 'hängen（挂着，状态）→ 三格 an der。' },
    { type: 'choice', q: 'Er hängt das Bild ___ Wand.（把画挂上墙）', opts: ['an die', 'an der'], a: 0, tip: '挂上（动作）→ 四格 an die。' },
    { type: 'fill', q: 'Ich komme gerade ___ Küche. (aus + die)', a: 'aus der', tip: 'aus 固定第三格。' },
    { type: 'choice', q: 'am Montag 中的 an 接第几格？', opts: ['第四格', '第三格', '第二格'], a: 1, tip: '时间表达用第三格。' }
  ]
},
{
  id: 'g-a2-pronomen2', title: '不定代词 man / jemand / niemand', level: 'A2',
  summary: '泛指人：man 说规矩，jemand/niemand 说有没有人。',
  lesson: `
<h3>man（人们/有人）—— 永远单数，像 er 变位</h3>
<ul>
<li><b>Man</b> spricht hier Deutsch.（这里说德语）</li>
<li>Wie schreibt <b>man</b> das?（这个怎么写？）</li>
<li>Hier darf <b>man</b> nicht rauchen.</li>
</ul>
<h3>jemand（某人）/ niemand（没有人）</h3>
<ul>
<li><b>Jemand</b> hat an der Tür geklingelt.</li>
<li><b>Niemand</b> weiß die Antwort.（没人知道答案）</li>
<li>Ich habe <b>niemanden</b> gesehen.（第四格）</li>
</ul>
<h3>etwas / nichts（某物/什么都没有）</h3>
<p>Möchtest du <b>etwas</b> trinken? — Nein, danke, <b>nichts</b>.</p>
<h3>jed-/alle（每个/所有）</h3>
<p><b>Jeder</b> Student muss kommen. / <b>Alle</b> kommen.</p>`,
  exercises: [
    { type: 'fill', q: '___ spricht hier Deutsch.（人们）', a: 'Man', tip: '泛指"人们"用 man。' },
    { type: 'choice', q: 'Wie schreibt ___ das?', opts: ['man', 'men', 'man(n)'], a: 0, tip: 'man（无 n 结尾）。' },
    { type: 'fill', q: '___ hat an der Tür geklingelt.（有人）', a: 'Jemand', tip: '某人 = jemand。' },
    { type: 'choice', q: 'Ich habe ___ gesehen.（没有人，第四格）', opts: ['niemanden', 'niemandem', 'kein'], a: 0, tip: '第四格 niemanden；第三格才是 niemandem。' },
    { type: 'fill', q: 'Möchtest du ___ trinken?（一些东西）', a: 'etwas', tip: 'etwas trinken。' },
    { type: 'choice', q: 'man 变位按哪个人称？', opts: ['ich', 'er/sie/es', 'sie 复数'], a: 1, tip: 'man + 动词像 er/sie/es 变位。' }
  ]
},
{
  id: 'g-a2-adverb', title: '时间副词与表达', level: 'A2',
  summary: 'schon / noch / noch nicht / damals —— 把时间说清楚。',
  lesson: `
<h3>schon / noch / noch nicht / nicht mehr</h3>
<ul>
<li>Ich bin <b>schon</b> fertig.（已经完成了）</li>
<li>Ich bin <b>noch</b> müde.（还累着）</li>
<li>Ich bin <b>noch nicht</b> fertig.（还没完成）</li>
<li>Ich rauche <b>nicht mehr</b>.（不再抽了）</li>
</ul>
<h3>过去的时间标志</h3>
<ul>
<li><b>damals</b>（当时）、früher（以前）、damals im Jahr 2000</li>
<li>Als Kind…（小时候）</li>
</ul>
<h3>常搭配 Präteritum 的语境</h3>
<p><b>Früher</b> wohnten wir in Wien. <b>Damals</b> war ich noch klein.</p>
<h3>其他高频时间副词</h3>
<table><tr><th>gerade</th><td>正在</td></tr>
<tr><th>sofort</th><td>立刻</td></tr>
<tr><th>plötzlich</th><td>突然</td></tr>
<tr><th>endlich</th><td>终于</td></tr>
<tr><th>ab und zu</th><td>偶尔</td></tr>
<tr><th>seitdem</th><td>从那以后</td></tr></table>`,
  exercises: [
    { type: 'choice', q: 'Ich bin ___ fertig.（已经）', opts: ['noch', 'schon', 'nicht mehr'], a: 1, tip: 'schon = 已经。' },
    { type: 'choice', q: 'Ich rauche ___ .（不再）', opts: ['noch nicht', 'nicht mehr', 'schon'], a: 1, tip: 'nicht mehr = 不再。' },
    { type: 'fill', q: '___ habe ich in Wien gewohnt.（当时）', a: 'Damals', tip: 'damals = 当时。' },
    { type: 'choice', q: 'Der Zug kommt ___ an.（终于）', opts: ['plötzlich', 'endlich', 'sofort'], a: 1, tip: 'endlich = 终于。' },
    { type: 'choice', q: 'Ich bin ___ müde.（还）', opts: ['schon', 'noch', 'gerade'], a: 1, tip: 'noch = 还。' },
    { type: 'fill', q: '___ war alles besser.（以前）', a: 'Früher', tip: 'früher = 以前。' }
  ]
}
);
