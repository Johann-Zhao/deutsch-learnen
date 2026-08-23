/* 动词变位查询：现在时变位表 + Perfekt（常用不规则动词内置，其余按规则推导） */
var Conjugate = (function () {
  'use strict';
  var PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];

  // 常用不规则/重要动词：present 六个人称 + [助动词, Partizip II]
  var IRR = {
    'sein':       { f: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'], pp: ['ist', 'gewesen'] },
    'haben':      { f: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'], pp: ['hat', 'gehabt'] },
    'werden':     { f: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'], pp: ['ist', 'geworden'] },
    'können':     { f: ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'], pp: ['hat', 'gekonnt'] },
    'müssen':     { f: ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'], pp: ['hat', 'gemusst'] },
    'wollen':     { f: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'], pp: ['hat', 'gewollt'] },
    'dürfen':     { f: ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'], pp: ['hat', 'gedurft'] },
    'sollen':     { f: ['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen'], pp: ['hat', 'gesollt'] },
    'möchten':    { f: ['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten'], pp: null },
    'essen':      { f: ['esse', 'isst', 'isst', 'essen', 'esst', 'essen'], pp: ['hat', 'gegessen'] },
    'fahren':     { f: ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren'], pp: ['ist/hat', 'gefahren'] },
    'geben':      { f: ['gebe', 'gibst', 'gibt', 'geben', 'gebt', 'geben'], pp: ['hat', 'gegeben'] },
    'nehmen':     { f: ['nehme', 'nimmst', 'nimmt', 'nehmen', 'nehmt', 'nehmen'], pp: ['hat', 'genommen'] },
    'sprechen':   { f: ['spreche', 'sprichst', 'spricht', 'sprechen', 'sprecht', 'sprechen'], pp: ['hat', 'gesprochen'] },
    'lesen':      { f: ['lese', 'liest', 'liest', 'lesen', 'lest', 'lesen'], pp: ['hat', 'gelesen'] },
    'sehen':      { f: ['sehe', 'siehst', 'sieht', 'sehen', 'seht', 'sehen'], pp: ['hat', 'gesehen'] },
    'laufen':     { f: ['laufe', 'läufst', 'läuft', 'laufen', 'lauft', 'laufen'], pp: ['ist', 'gelaufen'] },
    'schlafen':   { f: ['schlafe', 'schläfst', 'schläft', 'schlafen', 'schlaft', 'schlafen'], pp: ['hat', 'geschlafen'] },
    'helfen':     { f: ['helfe', 'hilfst', 'hilft', 'helfen', 'helft', 'helfen'], pp: ['hat', 'geholfen'] },
    'treffen':    { f: ['treffe', 'triffst', 'trifft', 'treffen', 'trefft', 'treffen'], pp: ['hat', 'getroffen'] },
    'tragen':     { f: ['trage', 'trägst', 'trägt', 'tragen', 'tragt', 'tragen'], pp: ['hat', 'getragen'] },
    'waschen':    { f: ['wasche', 'wäschst', 'wäscht', 'waschen', 'wascht', 'waschen'], pp: ['hat', 'gewaschen'] },
    'gehen':      { f: ['gehe', 'gehst', 'geht', 'gehen', 'geht', 'gehen'], pp: ['ist', 'gegangen'] },
    'kommen':     { f: ['komme', 'kommst', 'kommt', 'kommen', 'kommt', 'kommen'], pp: ['ist', 'gekommen'] },
    'bleiben':    { f: ['bleibe', 'bleibst', 'bleibt', 'bleiben', 'bleibt', 'bleiben'], pp: ['ist', 'geblieben'] },
    'trinken':    { f: ['trinke', 'trinkst', 'trinkt', 'trinken', 'trinkt', 'trinken'], pp: ['hat', 'getrunken'] },
    'schreiben':  { f: ['schreibe', 'schreibst', 'schreibt', 'schreiben', 'schreibt', 'schreiben'], pp: ['hat', 'geschrieben'] },
    'aufstehen':  { f: ['stehe auf', 'stehst auf', 'steht auf', 'stehen auf', 'steht auf', 'stehen auf'], pp: ['ist', 'aufgestanden'] },
    'anrufen':    { f: ['rufe an', 'rufst an', 'ruft an', 'rufen an', 'ruft an', 'rufen an'], pp: ['hat', 'angerufen'] },
    'einkaufen':  { f: ['kaufe ein', 'kaufst ein', 'kauft ein', 'kaufen ein', 'kauft ein', 'kaufen ein'], pp: ['hat', 'eingekauft'] }
  };

  var COMMON = ['sein', 'haben', 'werden', 'möchten', 'können', 'müssen', 'essen', 'fahren', 'sprechen', 'lesen', 'gehen', 'aufstehen', 'anrufen', 'lernen', 'arbeiten', 'wohnen'];

  function regularForms(inf) {
    var stem = inf.replace(/en$/, '');
    if (stem === inf) return null; // 不是 -en 结尾
    var endsTd = /[td]$/.test(stem);
    var endsS = /(s|ß|z|x)$/.test(stem);
    var duEnd = endsTd ? 'est' : (endsS ? 'st' : 'st');
    var erEnd = endsTd ? 'et' : 't';
    // du: stem + st（词干以 s/ß 结尾时直接 + t，如 reisen → du reist）
    if (endsS) duEnd = 't';
    return [stem + 'e', stem + duEnd, stem + erEnd, inf, stem + erEnd, inf];
  }

  function regularPP(inf) {
    if (/ieren$/.test(inf)) return ['hat', inf.replace(/ieren$/, 'iert')];
    var stem = inf.replace(/en$/, '');
    return ['hat', 'ge' + (/[td]$/.test(stem) ? stem + 'et' : stem + 't')];
  }

  function lookup(input) {
    var key = input.trim().toLowerCase();
    if (IRR[key]) {
      return { verb: key, forms: IRR[key].f, pp: IRR[key].pp, note: key === 'sein' || key === 'haben' || key === 'werden' || key === 'bleiben' || key === 'gehen' || key === 'kommen' || key === 'fahren' || key === 'laufen' || key === 'aufstehen' ? '不规则变化' : '不规则变化' };
    }
    var forms = regularForms(key);
    if (!forms) return null;
    return { verb: key, forms: forms, pp: regularPP(key), note: '规则变化' };
  }

  function page() {
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '动词变位'));
    v.appendChild(UI.el('p', 'page-sub', '输入动词原形（如 lernen、fahren、sein），生成现在时变位表和完成时形式。常用不规则动词已内置。'));

    var card = UI.el('div', 'card');
    var input = UI.el('input');
    input.type = 'text'; input.autocomplete = 'off';
    input.placeholder = '动词原形，如 fahren';
    input.style.cssText = 'font-size:17px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;width:100%;max-width:320px;font-family:inherit;background:var(--card);color:var(--ink)';
    card.appendChild(input);
    var btn = UI.el('button', 'btn btn-sm', '查询');
    btn.style.marginLeft = '8px';
    card.appendChild(btn);
    var result = UI.el('div');
    result.style.marginTop = '16px';
    card.appendChild(result);

    // 常用动词快捷入口
    var chips = UI.el('div', null);
    chips.style.cssText = 'margin-top:14px;display:flex;gap:8px;flex-wrap:wrap';
    COMMON.forEach(function (name) {
      var c = UI.el('button', 'btn btn-ghost btn-sm', name);
      c.onclick = function () { input.value = name; run(); };
      chips.appendChild(c);
    });
    card.appendChild(chips);
    v.appendChild(card);

    function run() {
      result.innerHTML = '';
      var q = input.value.trim();
      if (!q) return;
      var data = lookup(q);
      if (!data) {
        result.innerHTML = '<div class="feedback bad">没有识别这个动词。请输入 -en 结尾的动词原形（如 lernen）。</div>';
        return;
      }
      var t = UI.el('table', null);
      t.style.cssText = 'border-collapse:collapse;width:100%;font-size:15px';
      var html = '<tr><th style="text-align:left;padding:6px 12px;border:1px solid var(--line);background:var(--bg)">人称</th><th style="text-align:left;padding:6px 12px;border:1px solid var(--line);background:var(--bg)">' + UI.esc(data.verb) + '（' + data.note + '）</th></tr>';
      PERSONS.forEach(function (p, i) {
        html += '<tr><td style="padding:6px 12px;border:1px solid var(--line);color:var(--ink-2)">' + p + '</td><td style="padding:6px 12px;border:1px solid var(--line);font-weight:600">' + UI.esc(data.forms[i]) + '</td></tr>';
      });
      if (data.pp) {
        html += '<tr><td style="padding:6px 12px;border:1px solid var(--line);color:var(--ink-2)">Perfekt</td><td style="padding:6px 12px;border:1px solid var(--line);font-weight:600">' + UI.esc(data.pp[0] + ' ' + data.pp[1]) + '</td></tr>';
      }
      t.innerHTML = html;
      result.appendChild(t);
      DeTTS.speak(data.forms[2]);
    }
    btn.onclick = run;
    input.onkeydown = function (e) { if (e.key === 'Enter') run(); };
    return v;
  }

  return { page: page, lookup: lookup };
})();
