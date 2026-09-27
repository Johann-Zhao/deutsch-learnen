/* 动词变位查询：现在时变位表 + Perfekt（常用不规则动词内置，其余按规则推导） */

import { UI, speakBtn } from './ui.js';
import { audio } from './audio.js';

const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];

// 常用不规则/重要动词：present 六个人称 + [助动词, Partizip II]
const IRR = {
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

const COMMON = ['sein', 'haben', 'werden', 'möchten', 'können', 'müssen', 'essen', 'fahren', 'sprechen', 'lesen', 'gehen', 'aufstehen', 'anrufen', 'lernen', 'arbeiten', 'wohnen'];
// 额外为这些规则动词也预生成音频
const REGULAR_WITH_AUDIO = ['lernen', 'arbeiten', 'wohnen', 'machen', 'kaufen', 'spielen'];

function regularForms(inf) {
  const stem = inf.replace(/en$/, '');
  if (stem === inf) return null; // 不是 -en 结尾
  const endsTd = /[td]$/.test(stem);
  const endsS = /(s|ß|z|x)$/.test(stem);
  let duEnd = endsTd ? 'est' : (endsS ? 'st' : 'st');
  const erEnd = endsTd ? 'et' : 't';
  // du: stem + st（词干以 s/ß 结尾时直接 + t，如 reisen → du reist）
  if (endsS) duEnd = 't';
  return [stem + 'e', stem + duEnd, stem + erEnd, inf, stem + erEnd, inf];
}

function regularPP(inf) {
  if (/ieren$/.test(inf)) return ['hat', inf.replace(/ieren$/, 'iert')];
  const stem = inf.replace(/en$/, '');
  return ['hat', 'ge' + (/[td]$/.test(stem) ? stem + 'et' : stem + 't')];
}

export function lookup(input) {
  const key = input.trim().toLowerCase();
  if (IRR[key]) {
    return { verb: key, forms: IRR[key].f, pp: IRR[key].pp, note: '不规则变化' };
  }
  const forms = regularForms(key);
  if (!forms) return null;
  return { verb: key, forms: forms, pp: regularPP(key), note: '规则变化' };
}

export function page() {
  const v = UI.el('div');
  v.appendChild(UI.el('p', 'micro', 'KONJUGATION · VERBTABELLE'));
  v.appendChild(UI.el('h1', 'page-title', '动词变位'));
  v.appendChild(UI.el('p', 'page-sub', '输入动词原形（如 lernen、fahren、sein），生成现在时变位表和完成时形式。常用不规则动词已内置。'));

  const card = UI.el('div', 'card');
  const input = UI.el('input');
  input.type = 'text'; input.autocomplete = 'off';
  // 德语拼写：关掉输入法的自动大写/自动更正/拼写检查（iOS 会按用户词典把
  // ue/ae/oe/ss 替换成 ü/ä/ö/ß 或反之——见 findings A5，判分另有等价归一化兜底）
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('lang', 'de');
  input.placeholder = '动词原形，如 fahren';
  input.className = 'spell-input'; input.style.maxWidth = '320px';
  card.appendChild(input);
  const btn = UI.el('button', 'btn btn-sm', '查询');
  btn.style.marginLeft = '8px';
  card.appendChild(btn);
  const result = UI.el('div');
  result.style.marginTop = '16px';
  card.appendChild(result);

  // 常用动词快捷入口
  const chips = UI.el('div', null);
  chips.style.cssText = 'margin-top:14px;display:flex;gap:8px;flex-wrap:wrap';
  COMMON.forEach(function (name) {
    const c = UI.el('button', 'btn btn-ghost btn-sm', name);
    c.onclick = function () { input.value = name; run(); };
    chips.appendChild(c);
  });
  card.appendChild(chips);
  v.appendChild(card);

  function run() {
    result.innerHTML = '';
    const q = input.value.trim();
    if (!q) return;
    const data = lookup(q);
    if (!data) {
      result.innerHTML = '<div class="feedback bad">没有识别这个动词。请输入 -en 结尾的动词原形（如 lernen）。</div>';
      return;
    }
    const t = UI.el('table', 'archive-table');
    let html = '<tr><th>人称</th><th>' + UI.esc(data.verb) + '（' + data.note + '）</th></tr>';
    PERSONS.forEach(function (p, i) {
      html += '<tr><td>' + p + '</td><td>' + UI.esc(data.forms[i]) + '</td></tr>';
    });
    if (data.pp) {
      html += '<tr><td>Perfekt</td><td>' + UI.esc(data.pp[0] + ' ' + data.pp[1]) + '</td></tr>';
    }
    t.innerHTML = html;
    result.appendChild(t);
    // 每行朗读按钮（有预生成音频用标准音频，否则回退系统朗读）
    const rows = t.querySelectorAll('tr');
    rows.forEach(function (row, i) {
      if (i === 0) return;
      const cell = row.children[1];
      const speakIdx = i - 1; // 0-5 人称，6 = Perfekt
      // 干净文本：人称行用变位形式，Perfekt 行用 助动词 + Partizip II
      const formText = speakIdx < 6 ? data.forms[speakIdx] : data.pp[0] + ' ' + data.pp[1];
      const sp = speakBtn(formText, 'conj', data.verb + '-' + speakIdx);
      sp.style.marginLeft = '8px';
      cell.appendChild(sp);
    });
    // 自动朗读第三人称单数
    audio.playConj(data.verb + '-2', data.forms[2]);
    if (!audio.hasConj(data.verb + '-2')) {
      const note = UI.el('p', 'stat-label', '这个动词暂无预生成的标准音频，朗读使用系统语音（质量取决于系统德语语音包）。');
      note.style.marginTop = '8px';
      result.appendChild(note);
    }
  }
  btn.onclick = run;
  input.onkeydown = function (e) { if (e.key === 'Enter') run(); };
  return v;
}

export const Conjugate = { page: page, lookup: lookup, irr: IRR, regularAudio: REGULAR_WITH_AUDIO, persons: PERSONS };
