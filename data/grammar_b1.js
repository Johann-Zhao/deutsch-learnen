/* B1 语法数据 */
window.GRAMMAR = window.GRAMMAR || [];
window.GRAMMAR.push(
{
  id: 'g-b1-konjunktiv2', title: '虚拟式 Konjunktiv II', level: 'B1',
  summary: 'würde + 原形、hätte/wäre/wüsste：礼貌、假设与愿望。',
  lesson: `
<h3>构成（两种）</h3>
<ul>
<li>würde + 动词原形（通用）：Ich <b>würde</b> gern <b>reisen</b>.</li>
<li>少数动词用自身形式：<b>wäre</b>（sein）、<b>hätte</b>（haben）、<b>wüsste</b>（wissen）、<b>käme</b>、<b>ginge</b>、<b>wäre</b> 等</li>
</ul>
<h3>三大用法</h3>
<ul>
<li><b>礼貌请求</b>（比直陈式更客气）：Könnten Sie mir bitte helfen? / Ich hätte gern einen Kaffee.</li>
<li><b>非现实假设</b>：Wenn ich Zeit <b>hätte</b>, <b>würde</b> ich kommen.（如果我有时间，我会来——实际没有）</li>
<li><b>愿望/遗憾</b>：Wenn er doch nur pünktlich <b>wäre</b>! / Ich <b>wäre</b> gern dort <b>gewesen</b>.</li>
</ul>
<h3>wenn 从句中的结构</h3>
<p>Wenn ich reich <b>wäre</b>（过去：wäre … geworden / hätte … gehabt）, <b>würde</b> ich vieles ändern.</p>
<table><tr><th>直陈</th><th>虚拟</th></tr>
<tr><td>ich habe</td><td>ich <b>hätte</b></td></tr>
<tr><td>ich bin</td><td>ich <b>wäre</b></td></tr>
<tr><td>ich kann</td><td>ich <b>könnte</b></td></tr>
<tr><td>ich muss</td><td>ich <b>müsste</b></td></tr>
<tr><td>ich werde kommen</td><td>ich <b>würde kommen</b></td></tr></table>
<h3>非现实过去（对过去的事假设）</h3>
<p>Wenn ich das <b>gewusst hätte</b>, wäre ich früher gekommen.（hätte/wäre + 过去分词）</p>`,
  exercises: [
    { type: 'fill', q: 'Wenn ich Zeit ___ , würde ich kommen. (haben)', a: 'hätte', tip: 'haben 的 Konjunktiv II 是 hätte。' },
    { type: 'fill', q: 'Wenn ich reich ___ , würde ich viel reisen. (sein)', a: 'wäre', tip: 'sein → wäre。' },
    { type: 'choice', q: '更礼貌的说法？', opts: ['Gib mir Wasser!', 'Könntest du mir Wasser geben?'], a: 1, tip: 'Könntest du …? 是虚拟式，更礼貌。' },
    { type: 'fill', q: 'Ich ___ gern einen Kaffee. (haben，点餐礼貌)', a: 'hätte', tip: 'Ich hätte gern … 固定表达。' },
    { type: 'choice', q: 'Wenn ich das ___ , wäre ich früher gekommen. (wissen，非现实过去)', opts: ['wüsste', 'gewusst hätte', 'weiß'], a: 1, tip: '非现实过去：hätte + 分词。' },
    { type: 'fill', q: '___ Sie mir bitte helfen? (können，礼貌)', a: 'Könnten', tip: 'Könnten Sie …? 礼貌请求。' },
    { type: 'choice', q: '"Wenn ich doch ein Auto hätte!" 表达的是？', opts: ['事实陈述', '愿望（现实没有车）', '计划'], a: 1, tip: '虚拟式表达非现实愿望。' },
    { type: 'fill', q: 'Wenn ich in Berlin ___ (wohnen，假设), würde ich oft ins Museum gehen.', a: 'wohnte', tip: '老式虚拟式 wohnte 或 würde wohnen 都对；填 wohnte（würde wohnen 也接受）。' }
  ]
},
{
  id: 'g-b1-passiv', title: '被动态 Passiv', level: 'B1',
  summary: 'wird + Partizip II：强调动作本身，不强调谁做。',
  lesson: `
<h3>构成：werden + Partizip II</h3>
<ul>
<li>现在：Das Haus <b>wird gebaut</b>.（房子正在被建）</li>
<li>过去：Das Haus <b>wurde gebaut</b>.（当时被建）</li>
<li>完成时：Das Haus <b>ist gebaut worden</b>.（已经被建好）</li>
<li>带情态：Das Haus <b>muss gebaut werden</b>.</li>
</ul>
<h3>主动 → 被动</h3>
<p>主动：Man <b>baut</b> das Haus. → 被动：Das Haus <b>wird gebaut</b>.（man 消失）</p>
<p>带人的主动：Der Architekt baut das Haus. → Das Haus <b>wird vom Architekten gebaut</b>.（三格 von …）</p>
<h3>von / durch</h3>
<ul><li>von + Dativ：动作执行者（人）</li><li>durch + Akkusativ：手段、原因（durch einen Fehler）</li></ul>
<h3>无人称被动（动作无人称也行）</h3>
<p>Ihm <b>wird geholfen</b>.（他得到了帮助）</p>
<h3>状态被动 sein + Partizip II</h3>
<p>Das Geschäft <b>ist geöffnet</b>.（开着——状态）vs. Das Geschäft <b>wird geöffnet</b>.（正在开门——动作）</p>`,
  exercises: [
    { type: 'fill', q: 'Das Haus ___ gerade gebaut. (werden，现在)', a: 'wird', tip: '现在被动：wird gebaut。' },
    { type: 'fill', q: 'Die Brücke ___ 1995 gebaut. (werden，过去)', a: 'wurde', tip: '过去被动：wurde gebaut。' },
    { type: 'choice', q: 'Die E-Mail ___ morgen geschickt werden.（情态被动缺 werden 形式：muss）', opts: ['muss', 'musste', 'müssen'], a: 0, tip: '第三人称单数：muss geschickt werden。' },
    { type: 'choice', q: 'Der Brief wurde ___ ihm geschrieben.（由他写）', opts: ['von', 'durch', 'mit'], a: 0, tip: '动作执行者用 von + 三格。' },
    { type: 'choice', q: '"Das Geschäft ist geöffnet." 中的 sein+分词表示？', opts: ['正在开门（动作）', '开着（状态）', '将被打开'], a: 1, tip: 'sein-被动表状态，werden-被动表动作。' },
    { type: 'fill', q: 'Man renoviert die Schule. → Die Schule ___ renoviert. (werden)', a: 'wird', tip: 'man 句变被动：wird renoviert。' },
    { type: 'choice', q: '主动句 "Der Mechaniker repariert das Auto." 的正确被动句？', opts: ['Das Auto wird von dem Mechaniker repariert.', 'Das Auto wird durch den Mechaniker repariert.（工具/手段才用 durch）', 'Das Auto hat repariert.'], a: 0, tip: '人做执行者用 von + 三格（von dem = vom）。' },
    { type: 'fill', q: 'Zustandspassiv: Der Laden ist heute ___ . (schließen 的分词作状态)', a: 'geschlossen', tip: 'ist geschlossen = 关着。' }
  ]
},
{
  id: 'g-b1-konditional', title: '条件与让步从句', level: 'B1',
  summary: 'wenn / falls / obwohl / auch wenn 的分工。',
  lesson: `
<h3>wenn（如果/当）与 falls（万一）</h3>
<p><b>Wenn</b> es morgen regnet, bleiben wir zu Hause.（常规条件）</p>
<p><b>Falls</b> ich dich nicht erreiche, ruf ich an.（万一，可能性更低）</p>
<h3>obwohl（尽管）—— 让步</h3>
<p><b>Obwohl</b> es regnete, sind wir gewandert.（尽管下雨我们还是去徒步了）</p>
<h3>auch wenn（即使）</h3>
<p><b>Auch wenn</b> es schwer ist, gebe ich nicht auf.（即使很难我也不放弃）</p>
<h3>其他重要连接词</h3>
<table><tr><th>连接词</th><th>意思</th><th>例</th></tr>
<tr><td>damit</td><td>为了（新主语）</td><td>Ich spare, <b>damit</b> ich reisen kann.</td></tr>
<tr><td>um … zu</td><td>为了（同主语）</td><td>Ich spare, <b>um</b> zu reisen.</td></tr>
<tr><td>bevor</td><td>在…之前</td><td>Wasche die Hände, <b>bevor</b> du isst.</td></tr>
<tr><td>nachdem</td><td>在…之后</td><td><b>Nachdem</b> ich gegessen hatte, ging ich.</td></tr>
<tr><td>seit / seitdem</td><td>自从</td><td><b>Seitdem</b> ich sport mache, fühle ich mich besser.</td></tr>
<tr><td>bis</td><td>直到</td><td>Warte, <b>bis</b> ich komme.</td></tr>
<tr><td>sodass</td><td>以至于</td><td>Es war heiß, <b>sodass</b> wir schwitzen.</td></tr>
<tr><td>während</td><td>当…期间/而</td><td><b>Während</b> er kocht, räume ich auf.</td></tr></table>
<h3>nachdem 的时态</h3>
<p>主句过去/现在完成时，nachdem 从句用<b>过去完成时</b>（hatte … gemacht）。</p>`,
  exercises: [
    { type: 'choice', q: '___ es regnet, bleiben wir zu Hause.（如果）', opts: ['Obwohl', 'Wenn', 'Damit'], a: 1, tip: '条件用 wenn。' },
    { type: 'choice', q: '___ ich dich nicht erreiche, schreibe ich eine Mail.（万一）', opts: ['Falls', 'Obwohl', 'Bevor'], a: 0, tip: '可能性低的"万一"用 falls。' },
    { type: 'choice', q: '___ es kalt war, sind wir schwimmen gegangen.', opts: ['Obwohl', 'Wenn', 'Damit'], a: 0, tip: '让步"尽管"用 obwohl。' },
    { type: 'choice', q: 'Ich lerne Deutsch, ___ ich in Berlin studieren will.（新主语 ich→ich 相同？"ich lerne"与"ich studieren"同主语）', opts: ['damit', 'um … zu', 'obwohl'], a: 1, tip: '同主语用 um … zu：um in Berlin zu studieren。' },
    { type: 'choice', q: 'Wasche die Hände, ___ du isst.', opts: ['nachdem', 'bevor', 'seitdem'], a: 1, tip: '吃饭前洗手：bevor。' },
    { type: 'choice', q: '___ er gegessen hatte, ging er spazieren.', opts: ['Bevor', 'Nachdem', 'Bis'], a: 1, tip: '饭后散步：nachdem + 过去完成时。' },
    { type: 'fill', q: 'Seitdem ich Sport ___ (machen), fühle ich mich besser.', a: 'mache', tip: 'seitdem 从句动词尾：mache。' },
    { type: 'choice', q: 'Es regnete, ___ wir nass wurden.（以至于）', opts: ['sodass', 'obwohl', 'falls'], a: 0, tip: '结果从句 sodass。' }
  ]
},
{
  id: 'g-b1-relativ2', title: '关系从句（进阶）', level: 'B1',
  summary: '介词 + 关系代词、wer/was/wo 的用法。',
  lesson: `
<h3>复习基础</h3>
<p>关系代词性数看先行词，格看从句角色：Der Mann, <b>den</b> ich kenne …</p>
<h3>介词 + 关系代词（B1 重点）</h3>
<p>介词跟着从句里的动词走，放在关系代词<b>前面</b>：</p>
<ul>
<li>Das ist die Kollegin, <b>mit der</b> ich arbeite.（mit + 三格）</li>
<li>Der Tisch, <b>an dem</b> ich sitze, ist alt.</li>
<li>Der Termin, <b>über den</b> wir sprechen, …（sprechen über + 四格）</li>
<li>Die Stadt, <b>in der</b> ich wohne, …</li>
</ul>
<h3>was / wo</h3>
<ul>
<li>先行词是事物不定代词/整句时用 <b>was</b>：Alles, <b>was</b> du sagst, stimmt. / Er kam zu spät, <b>was</b> mich ärgerte.</li>
<li>地名可用 <b>wo</b>：Berlin, <b>wo</b> ich lebe, …（= in dem）</li>
</ul>
<h3>wer（谁…的人）</h3>
<p><b>Wer</b> viel arbeitet, verdient viel.（谁多干谁多挣）</p>
<h3>deren / dessen（谁的）</h3>
<p>Der Mann, <b>dessen</b> Auto gestohlen wurde …（他的车被偷的那个男人）</p>
<p>Die Frau, <b>deren</b> Kind krank ist …</p>`,
  exercises: [
    { type: 'fill', q: 'Die Kollegin, mit ___ ich arbeite, ist nett.', a: 'der', tip: 'mit + 第三格阴性 → der。' },
    { type: 'fill', q: 'Der Tisch, an ___ ich sitze, ist alt.', a: 'dem', tip: 'an + 三格阳性 → dem。' },
    { type: 'fill', q: 'Der Termin, über ___ wir sprechen, ist wichtig.', a: 'den', tip: 'sprechen über + 第四格 → den。' },
    { type: 'choice', q: 'Alles, ___ du sagst, stimmt.', opts: ['was', 'dass', 'wo'], a: 0, tip: '不定代词 alles 的关系代词用 was。' },
    { type: 'choice', q: 'Der Mann, ___ Auto gestohlen wurde, ruft die Polizei.', opts: ['dessen', 'deren', 'den'], a: 0, tip: '阳性属格关系代词 dessen。' },
    { type: 'fill', q: 'Die Frau, ___ Kind krank ist, kommt später.', a: 'deren', tip: '阴性属格 deren。' },
    { type: 'choice', q: 'Berlin, ___ ich lebe, ist teuer.', opts: ['wo', 'was', 'wen'], a: 0, tip: '地名可用 wo（= in dem）。' },
    { type: 'choice', q: '___ viel arbeitet, verdient viel.', opts: ['Wer', 'Was', 'Der'], a: 0, tip: 'wer 关系从句泛指"谁"。' }
  ]
},
{
  id: 'g-b1-genitiv', title: '第二格 Genitiv', level: 'B1',
  summary: 'des Mannes / der Frau：归属关系与书面语标志。',
  lesson: `
<h3>属格冠词</h3>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th><th>pl</th></tr>
<tr><td>Genitiv</td><td class="g-m">des/eines</td><td class="g-f">der/einer</td><td class="g-n">des/eines</td><td>der</td></tr></table>
<ul>
<li>阳性和中性名词通常加 <b>-s / -es</b>：des Mann<b>es</b>, des Kind<b>es</b></li>
<li>阴性、复数不加：der Frau, der Kinder</li>
</ul>
<h3>用法 1：归属（书面）</h3>
<p>Das Auto <b>des Nachbarn</b>.（邻居的车）／Das ist die Meinung <b>der Chefin</b>.</p>
<h3>用法 2：属格介词（固定接二格）</h3>
<p><b>wegen, trotz, während, wegen, anlässlich, aufgrund, außerhalb, innerhalb, statt, oberhalb, unterhalb</b></p>
<ul>
<li><b>Wegen</b> des Regens bleiben wir da.（由于下雨）</li>
<li><b>Trotz</b> der Kälte gehen wir raus.（尽管冷）</li>
<li><b>Während</b> der Pause essen wir.（在休息期间）</li>
<li><b>Außerhalb</b> der Öffnungszeiten.（营业时间之外）</li>
</ul>
<h3>口语替代</h3>
<p>口语常用 von + 三格替代属格：das Auto <b>vom Nachbarn</b>；wegen 也常接三格（口语）。</p>`,
  exercises: [
    { type: 'fill', q: 'Das ist das Auto ___ Nachbarn. (der Nachbar，属格冠词)', a: 'des', tip: '阳性属格 des Nachbarn。' },
    { type: 'fill', q: 'Das ist die Tasche ___ Mutter. (die)', a: 'der', tip: '阴性属格 der。' },
    { type: 'fill', q: '___ des Regens bleiben wir zu Hause. (由于)', a: 'Wegen', tip: 'wegen + 属格。' },
    { type: 'choice', q: '___ der Kälte gehen wir spazieren.（尽管）', opts: ['Wegen', 'Trotz', 'Während'], a: 1, tip: 'trotz + 属格：尽管。' },
    { type: 'choice', q: '阳性和中性属格名词通常加什么？', opts: ['-n / -en', '-s / -es', '不加'], a: 1, tip: 'des Mannes, des Kindes。' },
    { type: 'fill', q: 'Innerhalb ___ Woche（die Woche）muss er antworten.', a: 'der', tip: 'innerhalb + 属格：der Woche。' },
    { type: 'choice', q: '口语里替代第二格的常用说法？', opts: ['von + 第三格', 'an + 第四格', 'für + 第四格'], a: 0, tip: 'das Auto vom Nachbarn。' }
  ]
},
{
  id: 'g-b1-verbprap', title: '动介搭配', level: 'B1',
  summary: 'sich freuen auf/über、wagen an、teilen in……动词与介词是固定搭档。',
  lesson: `
<p>德语动词常常"绑定"一个介词，介词决定后面的格。B1 必须成对记忆：</p>
<table><tr><th>搭配</th><th>格</th><th>例</th></tr>
<tr><td>sich freuen auf</td><td>Akk.</td><td>Ich freue mich <b>auf den</b> Urlaub.（期待）</td></tr>
<tr><td>sich freuen über</td><td>Akk.</td><td>Ich freue mich <b>über das</b> Geschenk.（为已发生的事高兴）</td></tr>
<tr><td>sich interessieren für</td><td>Akk.</td><td>Ich interessiere mich <b>für</b> Musik.</td></tr>
<tr><td>sich ärgern über</td><td>Akk.</td><td>Er ärgert sich <b>über den</b> Lärm.</td></tr>
<tr><td>sich erinnern an</td><td>Akk.</td><td>Ich erinnere mich <b>an</b> dich.</td></tr>
<tr><td>denken an</td><td>Akk.</td><td>Ich denke <b>an</b> dich.</td></tr>
<tr><td>teilnehmen an</td><td>Dat.</td><td>Sie nimmt <b>an der</b> Prüfung teil.</td></tr>
<tr><td>helfen bei</td><td>Dat.</td><td>Er hilft <b>bei der</b> Arbeit.</td></tr>
<tr><td>achten auf</td><td>Akk.</td><td>Achte <b>auf den</b> Verkehr!</td></tr>
<tr><td>verzichten auf</td><td>Akk.</td><td>Wir verzichten <b>auf Fleisch</b>.</td></tr>
<tr><td>leiden an/unter</td><td>Dat.</td><td>Sie leidet <b>an einer</b> Krankheit.</td></tr>
<tr><td>hören auf</td><td>Akk.</td><td>Hör <b>auf mich</b>!</td></tr>
<tr><td>warten auf</td><td>Akk.</td><td>Ich warte <b>auf den</b> Bus.</td></tr>
<tr><td>sich bewerben um</td><td>Akk.</td><td>Ich bewerbe mich <b>um die</b> Stelle.</td></tr></table>
<h3>da- 副词替代</h3>
<p>指代事物时用<b>daran/darauf/dafür…</b>：Worauf freust du dich? — Ich freue mich <b>darauf</b>.</p>`,
  exercises: [
    { type: 'choice', q: 'Ich freue mich ___ das Wochenende.（期待将来）', opts: ['auf', 'über', 'an'], a: 0, tip: '期待将来的事：sich freuen auf。' },
    { type: 'choice', q: 'Ich freue mich ___ das Geschenk.（已收到）', opts: ['auf', 'über', 'von'], a: 1, tip: '为已发生的事高兴：über。' },
    { type: 'choice', q: 'Ich interessiere mich ___ Politik.', opts: ['für', 'an', 'über'], a: 0, tip: 'sich interessieren für。' },
    { type: 'choice', q: 'Ich erinnere mich ___ unseren ersten Tag.', opts: ['an', 'auf', 'über'], a: 0, tip: 'sich erinnern an。' },
    { type: 'fill', q: 'Sie nimmt an ___ Prüfung teil. (die)', a: 'der', tip: 'teilnehmen an + 三格：an der Prüfung。' },
    { type: 'choice', q: 'Ich bewerbe mich ___ die Stelle.', opts: ['für', 'um', 'über'], a: 1, tip: 'sich bewerben um + 四格。' },
    { type: 'choice', q: 'Worauf wartest du? — Ich warte ___ .（指代事物）', opts: ['darauf', 'auf das', 'davon'], a: 0, tip: 'da- 副词 darauf 回答 worauf。' },
    { type: 'choice', q: 'Er leidet ___ einer Allergie. (leiden)', opts: ['an', 'für', 'über'], a: 0, tip: 'leiden an/unter + 三格。' }
  ]
},
{
  id: 'g-b1-indirekte', title: '间接引语', level: 'B1',
  summary: 'sagen, dass… / ob / 疑问词：转述别人的话。',
  lesson: `
<h3>转述陈述句 → dass</h3>
<p>原话：„Ich bin müde." → Er sagt, <b>dass</b> er müde <b>sei</b>（虚拟）/<b>ist</b>（口语）。B1 阶段用直陈式即可：Er sagt, dass er müde ist.</p>
<h3>转述一般疑问句 → ob</h3>
<p>原话：„Kommst du?" → Sie fragt, <b>ob</b> ich komme.</p>
<h3>转述 W-疑问句 → 保留疑问词</h3>
<p>原话：„Wo wohnst du?" → Er fragt, <b>wo</b> ich wohne.（注意：动词还是放尾，du→ich）</p>
<h3>命令句转述</h3>
<ul>
<li>bat/auffordern zu + 不定式：Er sagt, ich soll <b>kommen</b>. / Sie bittet mich, <b>leiser zu sein</b>.</li>
</ul>
<h3>常用引述动词</h3>
<p>sagen, behaupten（声称）、erzählen、meinen、erklären、versprechen、bestreiten（否认）、fragen、antworten、bitten、warnen</p>
<h3>虚拟式 Konjunktiv I（认识即可）</h3>
<p>Er sagt, er <b>habe</b> keine Zeit. / Sie sagt, sie <b>sei</b> krank.（书面转述用 KI：sein→sei, haben→habe）</p>`,
  exercises: [
    { type: 'fill', q: 'Er sagt, ___ er müde ist.', a: 'dass', tip: '转述陈述用 dass。' },
    { type: 'fill', q: 'Sie fragt, ___ ich komme.（一般疑问）', a: 'ob', tip: '转述一般疑问用 ob。' },
    { type: 'fill', q: 'Er fragt, ___ ich wohne.（哪里）', a: 'wo', tip: '保留疑问词 wo，动词放尾。' },
    { type: 'choice', q: '„Kommst du morgen?" → Sie fragt, ...', opts: ['ob ich morgen komme', 'dass ich morgen komme', 'wo ich morgen komme'], a: 0, tip: '一般疑问 → ob。' },
    { type: 'choice', q: '书面转述 „Ich bin krank" 的 Konjunktiv I 形式？', opts: ['sie ist krank', 'sie sei krank', 'sie wäre krank'], a: 1, tip: 'KI：sein → sei。' },
    { type: 'choice', q: '„Bitte leiser!" → Sie bittet mich, ...', opts: ['leiser sein', 'leiser zu sein', 'dass leiser'], a: 1, tip: 'bitten + zu + 不定式。' },
    { type: 'choice', q: '哪个动词表示"否认"？', opts: ['behaupten', 'bestreiten', 'versprechen'], a: 1, tip: 'bestreiten = 否认；behaupten 声称；versprechen 承诺。' }
  ]
},
{
  id: 'g-b1-nominal', title: '名词化与形容词名词化', level: 'B1',
  summary: 'beim Lesen / das Gute：动词和形容词摇身变名词。',
  lesson: `
<h3>动词名词化（das + 大写 + en）</h3>
<p>lesen → <b>das Lesen</b>：beim <b>Lesen</b>（阅读时）、nach dem <b>Essen</b>（饭后）</p>
<p>常用搭配：beim/zum/nach dem/vom + 动名词</p>
<h3>形容词名词化（按形容词变格 + 大写）</h3>
<table><tr><th></th><th class="g-m">m</th><th class="g-f">f</th><th class="g-n">n</th></tr>
<tr><td>Nom.</td><td>deralte</td><td>die Alte</td><td>das Alte</td></tr>
<tr><td>Akk.</td><td>den alten</td><td>die Alte</td><td>das Alte</td></tr>
<tr><td>Dat.</td><td>dem alten</td><td>der Alten</td><td>dem Alten</td></tr></table>
<ul>
<li><b>der Deutsche</b>（德国男人）/ <b>die Deutsche</b>（德国女人）</li>
<li>ein Berliner / eine Berlinerin（加 -in 表女性）</li>
<li><b>etwas Neues</b>（新东西）/ <b>nichts Besonderes</b>（没什么特别的）—— etwas/nichts 后加弱变化词尾</li>
<li>Das <b>Wichtigste</b> ist …（最重要的是……）</li>
</ul>
<h3>zu + 形容词名词化</h3>
<p>im <b>Grünen</b>（在绿地里）／unter <b>den Armen</b>（在穷人中）</p>`,
  exercises: [
    { type: 'fill', q: 'Nach ___ Essen gehen wir spazieren. (essen 的名词化，冠词按 zu/nach)', a: 'dem Essen', tip: 'nach + 三格 + 动名词：nach dem Essen。' },
    { type: 'choice', q: 'etwas ___ , bitte!（新的东西）', opts: ['Neue', 'Neues', 'Neuer'], a: 1, tip: 'etwas/nichts + 形容词弱词尾 -es：etwas Neues。' },
    { type: 'choice', q: 'nichts ___ （没什么特别的）', opts: ['Besonderes', 'Besondere', 'Besonderen'], a: 0, tip: 'nichts Besonderes。' },
    { type: 'choice', q: '德国女人怎么表达？', opts: ['der Deutsche', 'die Deutsche', 'das Deutsche'], a: 1, tip: '形容词名词化阴性：die Deutsche（男性 der Deutsche）。' },
    { type: 'fill', q: 'Das ___ ist, pünktlich zu sein. (wichtig 的最高级名词化)', a: 'Wichtigste', tip: 'das Wichtigste = 最重要的事。' },
    { type: 'choice', q: 'beim ___ (lesen)', opts: ['Lesen', 'Lese', 'Lesung（指朗读会，词义不同）'], a: 0, tip: 'beim Lesen。' }
  ]
},
{
  id: 'g-b1-partizip', title: '分词作定语', level: 'B1',
  summary: 'das weinende Kind / der reparierte Wagen：一句顶一句从句。',
  lesson: `
<h3>Partizip I（现在分词）：主动、正在进行</h3>
<p>= 动词原形 + d，像形容词一样变格</p>
<ul>
<li>das <b>weinende</b> Kind = das Kind, <b>das weint</b>（正在哭的孩子）</li>
<li>ein <b>lächelnder</b> Mann = ein Mann, der lächelt</li>
</ul>
<h3>Partizip II（过去分词）：被动/完成</h3>
<ul>
<li>der <b>reparierte</b> Wagen = der Wagen, <b>der repariert wurde</b>（修好的车）</li>
<li>die <b>gestohlene</b> Tasche（被偷的包）</li>
<li>ein <b>gut bezahlter</b> Job（薪水好的工作）</li>
</ul>
<h3>扩展分词定语（书面）</h3>
<p>die <b>von der Kommission vorgeschlagene</b> Regel = die Regel, die von der Kommission vorgeschlagen wurde（委员会建议的规则）</p>
<p>die <b>seit Jahren diskutierte</b> Frage（讨论多年的问题）</p>
<h3>zu + Partizip I：需要被做的</h3>
<p>die <b>zu lösende</b> Aufgabe（待解决的任务 = die Aufgabe, die gelöst werden muss）</p>`,
  exercises: [
    { type: 'choice', q: 'das ___ Kind（正在哭的）', opts: ['weinende', 'geweinte', 'weinte'], a: 0, tip: 'Partizip I 主动进行：weinende。' },
    { type: 'choice', q: 'der ___ Wagen（被修好的车）', opts: ['reparierender', 'reparierte', 'repariert'], a: 1, tip: 'Partizip II 表被动完成：reparierte。' },
    { type: 'choice', q: 'die ___ Tasche（被偷的）', opts: ['stehlende', 'gestohlene', 'stiehlende'], a: 1, tip: '被动用 Partizip II：gestohlene。' },
    { type: 'choice', q: 'die ___ Aufgabe（待解决的任务）', opts: ['lösende', 'zu lösende', 'gelöste（已解决的，词义不同）'], a: 1, tip: 'zu + Partizip I = 需要/必须被……的。' },
    { type: 'choice', q: '"ein gut bezahlter Job" 展开成关系从句是？', opts: ['ein Job, der gut bezahlt', 'ein Job, der gut bezahlt wird', 'ein Job, der gut bezahlt hat'], a: 1, tip: '被动关系：der gut bezahlt wird。' }
  ]
},
{
  id: 'g-b1-konnektoren', title: '逻辑连接词', level: 'B1',
  summary: 'zwar…aber / entweder…oder：把句子连成篇。',
  lesson: `
<h3>成对连词</h3>
<ul>
<li><b>zwar … aber</b>：Zwar ist es teuer, <b>aber</b> es lohnt sich.（确实贵，但值得）</li>
<li><b>entweder … oder</b>：Entweder fahren wir, oder wir bleiben.</li>
<li><b>weder … noch</b>：Ich mag <b>weder</b> Fisch <b>noch</b> Fleisch.</li>
<li><b>nicht nur … sondern auch</b>：Er spricht <b>nicht nur</b> Deutsch, <b>sondern auch</b> Chinesisch.</li>
<li><b>sowohl … als auch</b>：Sie ist <b>sowohl</b> klug <b>als auch</b> fleißig.</li>
</ul>
<h3>副词性连接词（占位，动词仍第二位）</h3>
<table><tr><th>词</th><th>意思</th><th>例</th></tr>
<tr><td>deshalb</td><td>因此</td><td>Es regnet, <b>deshalb</b> bleiben wir da.</td></tr>
<tr><td>dennoch</td><td>然而</td><td>Es war spät, <b>dennoch</b> ging er.</td></tr>
<tr><td>außerdem</td><td>此外</td><td><b>Außerdem</b> ist es teuer.</td></tr>
<tr><td>allerdings</td><td>不过</td><td>Das stimmt, <b>allerdings</b> …</td></tr>
<tr><td>stattdessen</td><td>取而代之</td><td>Wir fliegen nicht, <b>stattdessen</b> fahren wir.</td></tr>
<tr><td>folglich</td><td>从而</td><td><b>Folglich</b> müssen wir handeln.</td></tr></table>
<h3>aber vs sondern</h3>
<p>前句<b>否定</b>时用 <b>sondern</b>：Ich trinke keinen Kaffee, <b>sondern</b> Tee.（不是 A 而是 B）<br>否则用 aber：Der Kaffee ist teuer, <b>aber</b> lecker.</p>`,
  exercises: [
    { type: 'choice', q: 'Zwar ist es teuer, ___ es lohnt sich.', opts: ['und', 'aber', 'oder'], a: 1, tip: 'zwar … aber 固定搭配。' },
    { type: 'choice', q: 'Ich trinke keinen Kaffee, ___ Tee.', opts: ['aber', 'sondern', 'doch'], a: 1, tip: '前句否定 → sondern（不是…而是）。' },
    { type: 'choice', q: 'Er spricht nicht nur Deutsch, ___ auch Chinesisch.', opts: ['sondern', 'sondern', 'und'], a: 0, tip: 'nicht nur … sondern auch。' },
    { type: 'fill', q: 'Es regnet, ___ bleiben wir zu Hause.（因此）', a: 'deshalb', tip: 'deshalb 占第一位，动词第二位。' },
    { type: 'choice', q: 'Ich mag ___ Fisch ___ Fleisch.（都不）', opts: ['weder … noch', 'entweder … oder', 'zwar … aber'], a: 0, tip: 'neither … nor = weder … noch。' },
    { type: 'choice', q: 'Sie ist sowohl klug ___ fleißig.', opts: ['als auch', 'sondern auch', 'wie auch'], a: 0, tip: 'sowohl … als auch。' },
    { type: 'choice', q: '"deshalb" 在句中的位置？', opts: ['不影响动词位置', '占第一位，动词第二位', '占句尾'], a: 1, tip: '它是副词性连接词，占位但动词保持第二位。' }
  ]
},
{
  id: 'g-b1-wortbildung', title: '构词法', level: 'B1',
  summary: '前缀、后缀、复合词：词汇量翻倍的捷径。',
  lesson: `
<h3>不可分前缀（重音在词干，无 ge-）</h3>
<p><b>be-, ge-, er-, ver-, zer-, ent-, emp-, miss-</b></p>
<ul>
<li>be<b>suchen</b>（拜访）、<b>er</b>klären（解释）、<b>ver</b>stehen（理解）、<b>ent</b>halten（包含）、<b>miss</b>verstehen（误会）</li>
<li>Partizip II 无 ge：besucht, erklärt, verstanden</li>
</ul>
<h3>可分前缀（重音在前缀，分词 ge 插中间）</h3>
<p><b>ab-, an-, auf-, aus-, ein-, mit-, vor-, zu-, nach-</b></p>
<ul>
<li>ab|fahren → Partizip II: <b>ab</b>ge<b>fahren</b></li>
<li>mit|bringen → hat <b>mit</b>gebracht</li>
</ul>
<h3>名词后缀（判断词性）</h3>
<table><tr><th>-ung</th><td>die（die Lösung）</td></tr>
<tr><th>-heit / -keit</th><td>die（die Freiheit）</td></tr>
<tr><th>-schaft</th><td>die（die Freundschaft）</td></tr>
<tr><th>-tion / -tät</th><td>die（die Nation, Universität）</td></tr>
<tr><th>-er / -ler</th><td>der（der Lehrer）</td></tr>
<tr><th>-chen / -lein</th><td>das（das Mädchen）</td></tr>
<tr><th>-nis</th><td>das（das Ergebnis）</td></tr>
<tr><th>-tum</th><td>das（das Eigentum）</td></tr></table>
<h3>复合词（最后一个词决定词性和意思）</h3>
<p>Arbeit + Markt = der <b>Arbeitsmarkt</b>（劳动力市场；中间常加连接符 -s-）</p>
<p>Fahrrad = Fahr + Rad；Umweltschutz = Umwelt + Schutz</p>
<h3>形容词后缀</h3>
<p>-bar（machbar 可行的）、-los（arbeitslos 失业的）、-voll（liebevoll 充满爱的）、-ig（witzig 有趣的）</p>`,
  exercises: [
    { type: 'choice', q: 'besuchen 的 Partizip II 是？', opts: ['besucht', 'gebesucht', 'besuchen'], a: 0, tip: 'be- 不可分前缀，不加 ge。' },
    { type: 'choice', q: 'mitbringen 的 Partizip II 是？', opts: ['gebracht mit', 'mitgebracht', 'gemittbracht'], a: 1, tip: '可分动词：ge 插在中间 → mitgebracht。' },
    { type: 'choice', q: '以 -ung 结尾的名词词性？', opts: ['der', 'die', 'das'], a: 1, tip: '-ung 恒为阴性。' },
    { type: 'choice', q: '以 -chen 结尾的名词词性？', opts: ['der', 'die', 'das'], a: 2, tip: '-chen 恒为中性：das Mädchen。' },
    { type: 'fill', q: 'Arbeit + Markt = der ___（劳动力市场，注意连接 s）', a: 'Arbeitsmarkt', tip: '复合词常加 -s- 连接：Arbeitsmarkt。' },
    { type: 'choice', q: '复合词的词性由什么决定？', opts: ['第一个词', '最后一个词', '音节数'], a: 1, tip: '最后一个基本词决定词性。' },
    { type: 'choice', q: '"machbar" 中 -bar 的意思是？', opts: ['没有…的', '可…的', '充满…的'], a: 1, tip: '-bar = 可……的；-los = 没有……的。' }
  ]
},
{
  id: 'g-b1-starke', title: '强变化动词速查', level: 'B1',
  summary: '高频不规则动词三态总表：现在、过去、完成。',
  lesson: `
<p>背熟三态是 B1 的硬功夫。高频动词按"换音规律"分组记忆：</p>
<h3>ie – o – o 组</h3>
<table><tr><th>原形</th><th>过去(Prät.)</th><th>完成(Partizip II)</th></tr>
<tr><td>sprechen</td><td>sprach</td><td>gesprochen</td></tr>
<tr><td>nehmen</td><td>nahm</td><td>genommen</td></tr>
<tr><td>stoßen</td><td>stieß</td><td>gestoßen</td></tr></table>
<h3>e/i – a – o 组</h3>
<table><tr><th>原形</th><th>过去</th><th>完成</th></tr>
<tr><td>geben</td><td>gab</td><td>gegeben</td></tr>
<tr><td>sehen</td><td>sah</td><td>gesehen</td></tr>
<tr><td>lesen</td><td>las</td><td>gelesen</td></tr>
<tr><td>fahren</td><td>fuhr</td><td>gefahren (ist)</td></tr>
<tr><td>tragen</td><td>trug</td><td>getragen</td></tr>
<tr><td>schlafen</td><td>schlief</td><td>geschlafen</td></tr>
<tr><td>waschen</td><td>wusch</td><td>gewaschen</td></tr></table>
<h3>i – a – u 组</h3>
<table><tr><th>原形</th><th>过去</th><th>完成</th></tr>
<tr><td>finden</td><td>fand</td><td>gefunden</td></tr>
<tr><td>trinken</td><td>trank</td><td>getrunken</td></tr>
<tr><td>singen</td><td>sang</td><td>gesungen</td></tr>
<tr><td>schwimmen</td><td>schwamm</td><td>geschwommen (ist)</td></tr></table>
<h3>特殊但高频</h3>
<table><tr><th>原形</th><th>过去</th><th>完成</th></tr>
<tr><td>gehen</td><td>ging</td><td>ist gegangen</td></tr>
<tr><td>kommen</td><td>kam</td><td>ist gekommen</td></tr>
<tr><td>wissen</td><td>wusste</td><td>gewusst</td></tr>
<tr><td>denken</td><td>dachte</td><td>gedacht</td></tr>
<tr><td>bringen</td><td>brachte</td><td>gebracht</td></tr>
<tr><td>bleiben</td><td>blieb</td><td>ist geblieben</td></tr>
<tr><td>laufen</td><td>lief</td><td>ist gelaufen</td></tr>
<tr><td>essen</td><td>aß</td><td>gegessen</td></tr></table>
<p>提示：本站「变位」页可查现在时变位；此专题专注过去与完成。</p>`,
  exercises: [
    { type: 'fill', q: 'sprechen – sprach – ___', a: 'gesprochen', tip: 'gesprochen。' },
    { type: 'fill', q: 'nehmen – ___ – genommen（过去时）', a: 'nahm', tip: 'nahm。' },
    { type: 'fill', q: 'fahren – fuhr – ___', a: 'gefahren', tip: 'ist/hat gefahren。' },
    { type: 'fill', q: 'trinken – ___ – getrunken', a: 'trank', tip: 'trank。' },
    { type: 'choice', q: 'gehen 的完成时？', opts: ['hat gegangen', 'ist gegangen', 'ist gegangen worden'], a: 1, tip: '位移动词用 sein：ist gegangen。' },
    { type: 'fill', q: 'denken – ___ – gedacht', a: 'dachte', tip: 'denken 过去时 dachte（混合变化）。' },
    { type: 'fill', q: 'wissen – wusste – ___', a: 'gewusst', tip: 'gewusst。' },
    { type: 'choice', q: '哪个动词用 sein 构成完成时？', opts: ['trinken', 'bleiben', 'finden'], a: 1, tip: 'bleiben → ist geblieben。' }
  ]
},
{
  id: 'g-b1-infinitiv', title: 'zu 不定式', level: 'B1',
  summary: 'um … zu / ohne … zu / anstatt … zu：不定式从句三件套。',
  lesson: `
<h3>什么时候必须有 zu</h3>
<p>大部分动词接另一动词时直接用原形（ modal、lassen、gehen、sehen、hören 等），其余多数要 <b>zu + 不定式</b>：</p>
<ul>
<li>Ich habe vor, nächstes Jahr <b>zu reisen</b>.（vorhaben + zu）</li>
<li>Er beginnt, Deutsch <b>zu lernen</b>.</li>
<li>Es macht Spaß, Sprachen <b>zu lernen</b>.( Spaß machen )</li>
<li>Vergiss nicht, die Tür <b>zuzumachen</b>!（可分动词 zu 插中间：zu|machen → zu<b>zu</b>machen）</li>
</ul>
<h3>三件套（主从同主语时替代 damit/dass）</h3>
<ul>
<li><b>um … zu</b>（为了）：Ich lerne Deutsch, <b>um</b> in Berlin <b>zu arbeiten</b>.</li>
<li><b>ohne … zu</b>（没有…就）：Er ging, <b>ohne</b> sich <b>zu verabschieden</b>.</li>
<li><b>anstatt … zu</b>（而不）：Sie bleibt, <b>anstatt</b> <b>zu gehen</b>.</li>
</ul>
<h3>常用带 zu 的结构</h3>
<p>versuchen / vorhaben / anfangen / aufhören / vergessen / beginnen + zu；Es ist wichtig/schwer/leicht, … zu …；Ich habe (keine) Zeit/Lust/Angst, … zu …</p>
<h3>注意</h3>
<ul><li>主从主语不同时不能用 um…zu，要用 damit：Ich erkläre es langsam, <b>damit</b> du es verstehst.</li>
<li>可分动词：zu 放前缀和词干之间（auf|machen → auf<b>zu</b>machen）</li></ul>`,
  exercises: [
    { type: 'fill', q: 'Ich lerne Deutsch, ___ in Berlin zu arbeiten.（为了）', a: 'um', tip: 'um … zu 表目的。' },
    { type: 'choice', q: 'Er ging, ___ sich zu verabschieden.（没有告别就走了）', opts: ['um', 'ohne', 'anstatt'], a: 1, tip: 'ohne … zu = 没有……就。' },
    { type: 'choice', q: 'Sie bleibt zu Hause, ___ ins Kino zu gehen.（而不去看电影）', opts: ['um', 'ohne', 'anstatt'], a: 2, tip: 'anstatt … zu = 而不。' },
    { type: 'fill', q: 'Vergiss nicht, die Tür ___ . (aufmachen 的 zu 不定式)', a: 'aufzumachen', tip: 'zu 插中间：aufzumachen。' },
    { type: 'choice', q: 'Ich erkläre es langsam, ___ du es verstehst.（主语不同）', opts: ['um zu', 'damit', 'ohne zu'], a: 1, tip: '主从主语不同必须用 damit。' },
    { type: 'choice', q: '下面哪个动词直接接原形（无 zu）？', opts: ['versuchen', 'möchten', 'anfangen'], a: 1, tip: '情态动词 möchten + 原形；versuchen/anfangen 要 zu。' },
    { type: 'fill', q: 'Es macht Spaß, Sprachen ___ lernen. (zu)', a: 'zu', tip: 'Es macht Spaß, zu lernen。' }
  ]
},
{
  id: 'g-b1-vermutung', title: '猜测与推断', level: 'B1',
  summary: 'wohl / wahrscheinlich / dürfte：把"我觉得"说清楚。',
  lesson: `
<h3>猜测副词（按确定程度排序）</h3>
<ul>
<li>bestimmt / sicher（100%）：Er ist <b>bestimmt</b> schon da.</li>
<li>wahrscheinlich（大概率）：Es regnet <b>wahrscheinlich</b> morgen.</li>
<li>wohl（八成，语气轻）：Sie ist <b>wohl</b> krank.</li>
<li>vielleicht（也许，50%）</li>
<li>möglicherweise / eventuell（有可能）</li>
<li>kaum（几乎不可能）：Er hat <b>kaum</b> Zeit.（他几乎没空）</li>
</ul>
<h3>表达猜测的句型</h3>
<ul>
<li>Ich <b>glaube / denke / vermute</b>, dass …（我认为/推测）</li>
<li>Ich bin sicher, dass … / Ich bin mir nicht sicher, ob …</li>
<li>Es <b>kann sein</b>, dass …（有可能）</li>
<li><b>Anscheinend / Offenbar</b> hat er verschlafen.（看来/显然他睡过头了）</li>
<li>Das <b>kann nicht sein</b>!（不可能！）</li>
</ul>
<h3>mögen 的让步用法</h3>
<p>Er <b>mag</b> klug sein, aber …（他也许聪明，但是……）</p>
<h3>Futur II 表对过去的猜测</h3>
<p>Er <b>wird wohl schon angekommen sein</b>.（他八成已经到了）= werden + Partizip II + infinitiv sein</p>`,
  exercises: [
    { type: 'choice', q: '确定程度最高的是？', opts: ['vielleicht', 'bestimmt', 'kaum'], a: 1, tip: 'bestimmt = 一定。' },
    { type: 'fill', q: 'Sie ist ___ krank.（八成，语气副词）', a: 'wohl', tip: 'wohl 表示较有把握的推测。' },
    { type: 'choice', q: '___ hat er verschlafen.（看来）', opts: ['Anscheinend', 'Bestimmt', 'Kaum'], a: 0, tip: 'anscheinend = 看起来/似乎。' },
    { type: 'fill', q: 'Es ___ sein, dass er krank ist.（有可能）', a: 'kann', tip: 'Es kann sein, dass …。' },
    { type: 'choice', q: '"Er wird wohl schon angekommen sein." 是对什么的猜测？', opts: ['将来', '过去/已完成', '习惯'], a: 1, tip: 'Futur II 表对过去的推测。' },
    { type: 'choice', q: '哪个词表示"几乎不可能"？', opts: ['eventuell', 'möglicherweise', 'kaum'], a: 2, tip: 'kaum = 几乎不。' }
  ]
}
);
