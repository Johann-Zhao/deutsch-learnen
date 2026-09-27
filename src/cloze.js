/* 语境填空（S9/M7）：从现有句库汇集挖空题源——词例句（挖空词=该卡词）、
   听力对话行与阅读短文句（挖空词=句中已学且最长的词库词，无则跳过）。
   复习题型池与阅读/听力页「练一练」入口共用；零新内容。
   纯函数（buildClozePool/pickCloze/pickClozeDistractors 等）Node 可测试。 */

import { allWords, wordById, getListenDialogs, getReadingTexts } from './data.js';
import * as SRS from './srs.js';
import { store } from './store.js';
import { today } from './storage.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { TTS } from './tts.js';
import { genderTag, maskWord } from './vocabulary.js';
import { isWordToken } from './reader.js';

const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2 };

function levelVisible(wordLevel, current) {
  const a = LEVEL_ORDER[wordLevel], b = LEVEL_ORDER[current];
  return a !== undefined && b !== undefined && a <= b;
}

// 形态匹配：小写 + äöü→aou、ß→ss，供 token 与词形比较
function fold(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}

// token 是否为词形的形态变体（fold 后比较，äöüß 已折叠）：
//   精确相等；
//   派生尾：token = 词形 + 尾（词形 ≥3 字母）——覆盖名词复数/变格（Tag→Tage/Tags、
//     Kind→Kinder、Haus→Häuser）与形容词变尾（rot→rote）；
//   词干：token = 词形去 en/ern（Trink→trinken、Probier→probieren，多为祈使句省 -en）。
// 全量 1945 条例句实测命中：精确 1581 / 派生尾 116 / 词干 4，其余 244 条（12.5%）无匹配。
// 不覆盖动词 -en 的 e/es/t/st 变位：wohne/wohnt/arbeite→wohnen、arbeiten 均不命中，
// blankSentence 返回 null → 该例句不出题（复习池该词回退为看德语选中文）。
// 短词（<3 字母）只认精确，防 in→innen、ab→aber 误配。
// 已知误配（本次未修，形态引擎增强另立项）：派生尾含裸 -n，token=neu+n=neun 会命中，
// 实测 'Es kostet neun Euro.' + {de:'neu'} → 'Es kostet ___ Euro.'（误挖 neun 标答 neu）；
// 变体轮只在全句无精确命中时才启用，句含 arbeite 而词库有 die Arbeit 时会挖掉 arbeite
// 标答 die Arbeit（形近异义，见评审 r1 P2-2）
const INFLECT_SUFFIX = ['e', 'st', 't', 'en', 'er', 'es', 'em', 'n', 's', 'te', 'ten', 'test', 'tet', 'ern'];
const INFLECT_PREFIX = ['en', 'ern'];
function isInflection(tok, form) {
  if (tok === form) return true;
  if (form.length >= 3) {
    for (let i = 0; i < INFLECT_SUFFIX.length; i++) if (tok === form + INFLECT_SUFFIX[i]) return true;
  }
  if (tok.length >= 3) {
    for (let i = 0; i < INFLECT_PREFIX.length; i++) if (form === tok + INFLECT_PREFIX[i]) return true;
  }
  return false;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 带德语字母边界的整词定位（\b 不认 äöüß，会漏 »Äpfel« 这类词首），返回原大小写文本
function wordMatch(sent, form) {
  const re = new RegExp('(^|[^A-Za-zÄÖÜäöüß])(' + escapeRe(form) + ')(?![A-Za-zÄÖÜäöüß])', 'i');
  const m = re.exec(sent);
  return m ? { index: m.index + m[1].length, text: m[2] } : null;
}

/* 挖空：目标词首个匹配形替换为 ___；名词优先整词组（der Tag→___），句中无冠词时
   只挖名词部分（冠词留在句中作格提示）；形态变体按上方 isInflection 的实际边界
   （精确、词形+派生尾，如 Grüße→Gruß），不覆盖动词 -en 的 e/es/t/st 变位
   （wohne→wohnen、geht→gehen 均返回 null）。
   找不到匹配返回 null（该句不出题） */
export function blankSentence(sent, target) {
  if (!sent || !target || !target.de) return null;
  const forms = [];
  const de = target.de.trim();
  forms.push(de);
  const noArt = de.replace(/^(der|die|das) /, '');
  if (noArt !== de) forms.push(noArt);
  for (let i = 0; i < forms.length; i++) {
    const hit = wordMatch(sent, forms[i]);
    if (hit) return sent.slice(0, hit.index) + '___' + sent.slice(hit.index + hit.text.length);
  }
  // 两轮扫描：先精确匹配（句中真出现该词），再形态变体。
  // 精确轮只在该词真出现在句中时才拦得住（neu→neun 这类误配只在句中无精确形时发生，
  // 裸 -n 派生尾实测会误挖 neun，见上方 isInflection 注释）
  const segs = sent.split(/([A-Za-zÄÖÜäöüß]+)/);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < segs.length; i++) {
      if (!/^[A-Za-zÄÖÜäöüß]/.test(segs[i])) continue;
      const f = fold(segs[i]);
      for (let j = 0; j < forms.length; j++) {
        const hit = pass === 0 ? f === fold(forms[j]) : isInflection(f, fold(forms[j]));
        if (hit) return segs.slice(0, i).join('') + '___' + segs.slice(i + 1).join('');
      }
    }
  }
  return null;
}

/* 句中已学词库词的最长命中：candidates = [{word, form}]（已按级别过滤、去冠词小写形式）。
   两轮扫描：先精确匹配类内取最长，再无精确命中时形态变体类内取最长 */
function findTargetInSentence(sent, candidates) {
  const segs = sent.split(/([A-Za-zÄÖÜäöüß]+)/);
  let bestExact = null, bestFlex = null;
  for (let i = 0; i < segs.length; i++) {
    if (!/^[A-Za-zÄÖÜäöüß]/.test(segs[i])) continue;
    const f = fold(segs[i]);
    for (let j = 0; j < candidates.length; j++) {
      const c = candidates[j];
      if (f === fold(c.form)) {
        if (!bestExact || c.form.length > bestExact.form.length) bestExact = { word: c.word, form: c.form };
      } else if (isInflection(f, fold(c.form))) {
        if (!bestFlex || c.form.length > bestFlex.form.length) bestFlex = { word: c.word, form: c.form };
      }
    }
  }
  return bestExact || bestFlex;
}

// 有卡且属当前或更低级别的词库词（对话句挖空目标候选）
function learnedCandidates(srs, level) {
  const out = [];
  Object.keys(srs || {}).forEach(function (id) {
    const w = wordById(id);
    if (!w || !levelVisible(w.level, level)) return;
    out.push({ word: w, form: w.de.replace(/^(der|die|das) /, '').toLowerCase() });
  });
  return out;
}

/* ---------- 句源汇集 ---------- */

// 对话句源：每行取已学且最长的词库词挖空，无命中跳过该行
export function itemsFromDialogue(dial, level, srs) {
  const cands = learnedCandidates(srs, level);
  const items = [];
  (dial.lines || []).forEach(function (line, i) {
    if (!line.de || !line.zh) return;
    const hit = findTargetInSentence(line.de, cands);
    if (!hit) return;
    const blanked = blankSentence(line.de, hit.word);
    if (!blanked) return;
    items.push({
      sent: line.de, sentZh: line.zh, blanked: blanked,
      target: hit.word, vid: hit.word.id, source: 'dialog',
      ref: { dialogueId: dial.id, lineIndex: i }
    });
  });
  return items;
}

// 阅读句源：token 流按句末标点切句（引号/破折号 token 丢弃），
// 每句取已学且表面形最长的词库词；中文为逐词 gloss 链（阅读数据无整句翻译，零新内容）
function splitSentences(paragraphs) {
  const sents = [];
  let cur = [];
  (paragraphs || []).forEach(function (p) {
    p.forEach(function (t) {
      const w = t.w || '';
      if (!t.lemma) {
        if (/^[.!?]/.test(w)) { cur.push({ w: w.charAt(0) }); sents.push(cur); cur = []; return; }
        if (/^[„“”«»"‚‘’…—–.,;:!?]+$/.test(w)) return;
      }
      cur.push(t);
    });
    if (cur.length) { sents.push(cur); cur = []; }
  });
  if (cur.length) sents.push(cur);
  return sents.filter(function (s) { return s.length > 0; });
}

function joinTokens(tokens) {
  let out = '', afterOpen = false;
  tokens.forEach(function (t) {
    const w = t.w || '';
    if (!w) return;
    if (!out) out = w;
    else if (afterOpen || /^[.!?,;:“”»’]/.test(w)) out += w;
    else out += ' ' + w;
    afterOpen = /^[„«"(]$/.test(w);
  });
  return out;
}

function glossOfSentence(tokens) {
  const parts = [];
  tokens.forEach(function (t) {
    if (!isWordToken(t)) return;
    const w = t.vid ? wordById(t.vid) : null;
    const g = w ? w.zh : t.g;
    if (g) parts.push(g);
  });
  return parts.join(' ');
}

export function itemsFromText(text, level, srs) {
  const map = srs || {};
  const items = [];
  splitSentences(text.paragraphs).forEach(function (tokens) {
    let bestTok = null, bestW = null;
    tokens.forEach(function (t) {
      if (!isWordToken(t) || !t.vid || !map[t.vid]) return;
      const w = wordById(t.vid);
      if (!w || !levelVisible(w.level, level)) return;
      if (!bestTok || t.w.length > bestTok.w.length) { bestTok = t; bestW = w; }
    });
    if (!bestW) return;
    const sent = joinTokens(tokens);
    const blanked = blankSentence(sent, bestW);
    if (!blanked) return;
    items.push({
      sent: sent, sentZh: glossOfSentence(tokens), blanked: blanked,
      target: bestW, vid: bestW.id, source: 'reading',
      ref: { textId: text.id }
    });
  });
  return items;
}

/* 纯函数：汇集三级句源为 { sent, sentZh, blanked, target, vid, source, ref } 列表。
   vid 仅含当前或更低级别词；srs 缺省时只出词例句（对话/阅读句需「已学」判定） */
export function buildClozePool(level, srs) {
  let items = [];
  allWords.forEach(function (w) {
    if (!levelVisible(w.level, level) || !w.ex || !w.exZh) return;
    const blanked = blankSentence(w.ex, w);
    if (!blanked) return;
    items.push({
      sent: w.ex, sentZh: w.exZh, blanked: blanked,
      target: w, vid: w.id, source: 'word', ref: null
    });
  });
  getListenDialogs().forEach(function (d) {
    items = items.concat(itemsFromDialogue(d, level, srs));
  });
  getReadingTexts().forEach(function (t) {
    items = items.concat(itemsFromText(t, level, srs));
  });
  return items;
}

/* 纯函数：抽 n 题——到期词优先 → 学习中（有卡未到期，含已斩）→ 新词；按 vid 去重，保持池内顺序 */
export function pickCloze(pool, srs, todayStr, n) {
  const map = srs || {};
  const cap = n || 1;
  const seen = {}, due = [], learning = [], fresh = [];
  (pool || []).forEach(function (it) {
    if (seen[it.vid]) return;
    seen[it.vid] = 1;
    const c = map[it.vid];
    if (c && SRS.isDue(c, todayStr)) due.push(it);
    else if (c) learning.push(it);
    else fresh.push(it);
  });
  return due.concat(learning, fresh).slice(0, cap);
}

function uniquePoolWords(pool) {
  const seen = {}, out = [];
  (pool || []).forEach(function (it) {
    const w = it.target;
    if (!w || seen[w.id]) return;
    seen[w.id] = 1;
    out.push(w);
  });
  return out;
}

// 干扰项分层：同主题同词性 → 同词性 → 同主题 → 其余（释义去重、不含答案由 take 保证）
function tierWords(list, target) {
  const sameThemePos = [], samePos = [], sameTheme = [], rest = [];
  list.forEach(function (x) {
    if (x.id === target.id || x.zh === target.zh) return;
    if (x.theme === target.theme && x.g === target.g) sameThemePos.push(x);
    else if (x.g === target.g) samePos.push(x);
    else if (x.theme === target.theme) sameTheme.push(x);
    else rest.push(x);
  });
  return sameThemePos.concat(samePos, sameTheme, rest);
}

/* 纯函数：n 个干扰项（默认 3）——池内句库词优先，不足时全词库补足；
   按释义去重、不含答案（id 与 zh 双重排除） */
export function pickClozeDistractors(item, pool, n) {
  const cap = n || 3;
  const target = item.target;
  const out = [];
  const used = {};
  function take(list) {
    for (let i = 0; i < list.length && out.length < cap; i++) {
      const x = list[i];
      if (used[x.id] || x.id === target.id || x.zh === target.zh) continue;
      used[x.id] = 1;
      out.push(x);
    }
  }
  const poolWords = uniquePoolWords(pool);
  take(tierWords(poolWords, target));
  if (out.length < cap) {
    const inPool = {};
    poolWords.forEach(function (x) { inPool[x.id] = 1; });
    take(tierWords(allWords.filter(function (x) { return !inPool[x.id]; }), target));
  }
  return out;
}

/* 复习题型池用：词 w 的语境填空项——优先自身例句，其次句库中该词出现的对话/阅读句 */
export function itemForWord(w, pool) {
  if (w.ex && w.exZh) {
    const blanked = blankSentence(w.ex, w);
    if (blanked) {
      return { sent: w.ex, sentZh: w.exZh, blanked: blanked, target: w, vid: w.id, source: 'word', ref: null };
    }
  }
  const list = pool || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].vid === w.id && list[i].source !== 'word') return list[i];
  }
  return null;
}

/* ---------- 渲染 ---------- */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function playSentenceAudio(item) {
  if (item.source === 'dialog' && item.ref) audio.playDialog(item.ref.dialogueId, item.ref.lineIndex, item.sent);
  else if (item.source === 'word') audio.playSentence(item.vid, item.sent);
  else TTS.speak(item.sent);
}

// 朗读题干句的小喇叭（对话行走逐行音频，词例句走例句音频，阅读句走系统语音）
export function sentenceSpeakBtn(item) {
  const b = UI.el('button', 'speak-btn', '🔊');
  b.title = '朗读句子';
  b.setAttribute('aria-label', '朗读句子');
  b.onclick = function (e) { e.stopPropagation(); playSentenceAudio(item); };
  return b;
}

/* 一道语境填空四选一：挖空句 + 中文 + 四选项；渐进提示对齐现有选择题规范
  （错 1：词性+首字母遮罩，可重选；错 2：揭示答案）；判毕回调 onAnswer(首答对, vid)
  ——首答对 true（review 2），先错后对/连错两次 false（review 0），与复习池「首错即错」口径一致 */
export function quizCard(item, onAnswer, pool) {
  const card = UI.el('div');
  let resolved = false, wrongs = 0;

  const prompt = UI.el('div', 'quiz-prompt');
  prompt.innerHTML = UI.esc(item.blanked) + '<br><span class="stat-label">' + UI.esc(item.sentZh) + '</span>';
  const sp = sentenceSpeakBtn(item);
  sp.style.marginLeft = '8px';
  prompt.appendChild(sp);
  card.appendChild(prompt);

  const fb = UI.el('div');
  const box = UI.el('div', 'opts');
  const options = shuffle([item.target].concat(pickClozeDistractors(item, pool, 3)));

  function resolve(ok) {
    if (resolved) return;
    resolved = true;
    setTimeout(function () { onAnswer(ok, item.vid); }, 700);
  }
  function markCorrect() {
    box.querySelectorAll('.opt').forEach(function (x) {
      x.disabled = true;
      if (x.__optId === item.vid) x.classList.add('correct');
    });
  }

  options.forEach(function (o) {
    const b = UI.el('button', 'opt', UI.esc(o.de));
    b.__optId = o.id;
    b.onclick = function () {
      if (b.disabled || resolved) return;
      if (o.id === item.vid) {
        b.classList.add('correct');
        box.querySelectorAll('.opt').forEach(function (x) { x.disabled = true; });
        fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(item.target.de) + ' = ' + UI.esc(item.target.zh) + '</div>';
        audio.playWord(item.vid, item.target.de);
        // 首答对才计分（review 2）；先错后对按「首错即错」计（review 0），与复习池口径一致
        resolve(wrongs === 0);
      } else if (wrongs === 0) {
        wrongs++;
        b.classList.add('wrong'); b.disabled = true;
        fb.innerHTML = '<div class="feedback">提示：' + genderTag(item.target.g) + ' ' + UI.esc(maskWord(item.target.de)) + '（再选一次）</div>';
      } else {
        wrongs++;
        b.classList.add('wrong'); b.disabled = true;
        markCorrect();
        fb.innerHTML = '<div class="feedback bad">再记一次：' + UI.esc(item.target.de) + ' = ' + UI.esc(item.target.zh) + '</div>';
        audio.playWord(item.vid, item.target.de);
        resolve(false);
      }
    };
    box.appendChild(b);
  });
  card.appendChild(box);
  card.appendChild(fb);
  /* 自动朗读放在**同步作用域**里：本卡片由「开始 / 下一题」等点击直接渲染，
     同步播放才能落在 iOS 的手势窗口内（WebKit Bug 259925 只允许同步作用域调用 play()）。
     原先这里是 setTimeout(…, 80)，脱离手势 → iOS 上必然被拒。
     若浏览器仍然拦截（例如卡片是路由切换渲染的、根本没有手势），给**可见**提示而不是静默。 */
  playSentenceAudio(item);
  setTimeout(function () {
    if (!audio.lastBlockError()) return;
    if (card.querySelector('.speak-hint')) return;
    const hint = UI.el('div', 'speak-hint stat-label', '自动朗读被浏览器拦截了，点上面的 🔊 播放');
    hint.style.marginTop = '4px';
    card.insertBefore(hint, fb);
  }, 150);
  return card;
}

/* 「练一练」卡片（阅读页/听力对话页底部）：入口 → 逐题 quizCard → 小结。
   判分回写目标词卡 SRS（答对 review 2 / 答错 review 0；只练有卡词，不新建卡、不进错题本）；
   items 为空返回 null（调用处不渲染入口） */
export function practiceCard(items, opts) {
  if (!items || !items.length) return null;
  opts = opts || {};
  const card = UI.el('div', 'card');
  let results = [];

  function paintEntry() {
    card.innerHTML = '';
    card.appendChild(UI.el('p', 'micro', opts.micro || 'ÜBEN · 练一练'));
    card.appendChild(UI.el('h3', null, opts.title || '练一练'));
    card.appendChild(UI.el('p', 'stat-label',
      opts.desc || ('用这里学过的词做语境填空，共 ' + items.length + ' 题。')));
    const b = UI.el('button', 'btn', '开始练一练（' + items.length + ' 题）');
    b.onclick = paintQuiz;
    card.appendChild(b);
  }

  function paintQuiz() {
    results = [];
    let pos = 0;
    const todayStr = today();
    card.innerHTML = '';
    card.appendChild(UI.el('p', 'micro', 'ÜBEN · 练一练' + (opts.scopeLabel ? ' · ' + UI.esc(opts.scopeLabel) : '')));
    const dots = UI.el('div', 'progress-dots');
    items.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    card.appendChild(dots);
    const stage = UI.el('div');
    card.appendChild(stage);

    function show() {
      Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('done', i < pos); });
      if (pos >= items.length) { paintSummary(); return; }
      stage.innerHTML = '';
      stage.appendChild(quizCard(items[pos], function (ok, vid) {
        store.touchToday('reviewed', 1);
        if (ok) store.touchToday('correct', 1);
        const c = store.state.srs[vid];
        if (c && !c.sealed) SRS.review(c, ok ? 2 : 0, todayStr);
        store.save();
        results.push({ ok: ok, item: items[pos] });
        pos++;
        show();
      }, items));
    }
    show();
  }

  function paintSummary() {
    const right = results.filter(function (r) { return r.ok; }).length;
    const wrong = results.filter(function (r) { return !r.ok; });
    card.innerHTML = '';
    card.appendChild(UI.el('div', 'result-num', right + ' / ' + items.length));
    card.appendChild(UI.el('p', 'stat-label', right === items.length
      ? '全对！这些词在句子里活起来了。'
      : '答错 ' + wrong.length + ' 题，相关词卡已按答错重新安排复习。'));
    if (wrong.length) {
      const list = UI.el('div');
      list.style.margin = '12px 0';
      wrong.forEach(function (r) {
        const row = UI.el('div', 'mistake-item');
        row.innerHTML = '<div class="m-body">' + genderTag(r.item.target.g) + ' <b>' +
          UI.esc(r.item.target.de) + '</b> — ' + UI.esc(r.item.target.zh) + '</div>';
        row.appendChild(sentenceSpeakBtn(r.item));
        list.appendChild(row);
      });
      card.appendChild(list);
    }
    const row = UI.el('div');
    row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    const again = UI.el('button', 'btn', '再练一遍');
    again.onclick = paintQuiz;
    row.appendChild(again);
    card.appendChild(row);
  }

  paintEntry();
  return card;
}

export const Cloze = {
  buildPool: buildClozePool,
  pick: pickCloze,
  pickDistractors: pickClozeDistractors,
  itemForWord: itemForWord,
  itemsFromDialogue: itemsFromDialogue,
  itemsFromText: itemsFromText,
  quizCard: quizCard,
  practiceCard: practiceCard,
  speakBtn: sentenceSpeakBtn,
  blankSentence: blankSentence
};
