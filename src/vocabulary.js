/* 词汇模块：主题列表、学新词（百词斩式：预览分流→选择→拼写→小结）、SRS 复习 */

import { store } from './store.js';
import { today } from './storage.js';
import * as SRS from './srs.js';
import { audio } from './audio.js';
import { UI, speakBtn, slowBtn } from './ui.js';
import {
  currentLevel, getVocabThemes, allWords, wordsOfLevel, wordById,
  loadLevelData, isLevelLoaded, inferLevelFromId, themeLevels, getImageWords, getImageCovers,
  getWordIpa
} from './data.js';
import { render } from './app.js';
import { hasImage, renderImageChoice } from './imgquiz.js';
import { lookup, Conjugate } from './conjugate.js';

const GENDER_LABEL = { m: ['der', 'm'], f: ['die', 'f'], n: ['das', 'n'], pl: ['die', 'pl'] };
// 非名词词性的中文标签（genderTag 降级为纯文本角标时使用）
const POS_LABEL = { v: '动词', adj: '形容词', adv: '副词', num: '数词', pron: '代词', phrase: '短语', conj: '连词', part: '小品词' };

// 词性标签文本：名词四格用 der/die/das/die，其余词性用中文名；未知标记原样返回
export function posLabel(g) {
  if (GENDER_LABEL[g]) return GENDER_LABEL[g][0];
  return POS_LABEL[g] || g || '';
}

export function genderTag(g) {
  if (GENDER_LABEL[g]) {
    return '<span class="gender-tag ' + g + '">' + GENDER_LABEL[g][0] + '</span>';
  }
  return '<span class="pos-tag">' + UI.esc(posLabel(g)) + '</span>';
}

// 例句中高亮目标词（按词性染色）
function highlightEx(word) {
  const de = word.de.replace(/^(der|die|das) /, '');
  const re = new RegExp('\\b(' + de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'i');
  return UI.esc(word.ex).replace(re, '<b class="hl-' + word.g + '">$1</b>');
}

function wordCard(w) {
  const c = UI.el('div', 'card word-card g-' + w.g);
  c.appendChild(UI.el('p', 'micro', 'WORT DES TAGES'));
  c.appendChild(UI.el('div', null, genderTag(w.g) + '<span class="stat-label">' + w.themeName + ' · ' + (w.level || 'A1') + '</span>'));
  const imageWords = getImageWords();
  const hasImg = !!(imageWords.indexOf && imageWords.indexOf(w.id) >= 0);
  if (hasImg) {
    const img = UI.el('img', 'word-img');
    img.src = 'images/words/' + w.id + '.jpg';
    img.alt = w.zh;
    img.loading = 'lazy';
    c.appendChild(img);
  }
  const de = UI.el('div', 'word-de');
  de.innerHTML = UI.esc(w.de);
  de.appendChild(speakBtn(w.de, 'word', w.id));
  const slowC = slowBtn(w.de, w.id); slowC.style.marginLeft = '6px';
  de.appendChild(slowC);
  c.appendChild(de);
  const ipa = getWordIpa(w.id);
  if (ipa) c.appendChild(UI.el('div', 'word-ipa stat-label', '/' + UI.esc(ipa) + '/'));
  c.appendChild(UI.el('div', 'word-zh', UI.esc(w.zh)));
  const ex = UI.el('div', 'word-ex');
  ex.innerHTML = highlightEx(w) + '<br><span>' + UI.esc(w.exZh) + '</span>';
  const sp = speakBtn(w.ex, 'sent', w.id); sp.title = '朗读例句';
  ex.insertBefore(sp, ex.firstChild);
  c.appendChild(ex);
  c.appendChild(detailDrawer(w));
  return c;
}

/* ---------- 单词详情抽屉（百词斩式下拉：释义 / 例句 / 变位） ----------
   仅当 w.de 是单个词（无空格、非 der/die/das 名词）且 lookup 命中时才附变位小表 */
function verbForms(w) {
  const de = w.de.trim();
  if (/^(der|die|das) /.test(de)) return null;
  if (/\s/.test(de)) return null;
  return lookup(de.toLowerCase());
}

function detailDrawer(w, showIpa) {
  const conj = verbForms(w);
  const d = UI.el('details', 'word-detail');
  d.appendChild(UI.el('summary', null, conj ? '详情 · 释义 / 例句 / 变位' : '详情 · 释义 / 例句'));
  const body = UI.el('div', 'word-detail-body');
  body.appendChild(UI.el('div', 'word-detail-row',
    genderTag(w.g) + '<span class="stat-label">' + UI.esc(w.level || 'A1') + '</span>　<span>' + UI.esc(w.zh) + '</span>'));
  const ipaRow = getWordIpa(w.id);
  if (showIpa !== false && ipaRow) body.appendChild(UI.el('div', 'word-detail-row',
    '<span class="stat-label">音标</span>　<span>/' + UI.esc(ipaRow) + '/</span>'));
  if (w.ex) {
    const ex = UI.el('div', 'word-detail-row');
    ex.innerHTML = highlightEx(w) + '<br><span>' + UI.esc(w.exZh || '') + '</span>';
    const sp = speakBtn(w.ex, 'sent', w.id); sp.title = '朗读例句';
    ex.insertBefore(sp, ex.firstChild);
    body.appendChild(ex);
  }
  if (conj) {
    // 复用变位页同款档案表格（.archive-table）
    const t = UI.el('table', 'archive-table');
    let html = '<tr><th>人称</th><th>' + UI.esc(conj.verb) + '（' + conj.note + '）</th></tr>';
    Conjugate.persons.forEach(function (p, i) {
      html += '<tr><td>' + p + '</td><td>' + UI.esc(conj.forms[i]) + '</td></tr>';
    });
    t.innerHTML = html;
    body.appendChild(t);
  }
  d.appendChild(body);
  return d;
}

// 干扰项：取 3 个不同词条（keyFn 用于去重，如同义中文）
function distractors(w, keyFn) {
  const pool = allWords.filter(function (x) { return x.id !== w.id && x.zh !== w.zh; });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  const seen = {}, opts = [];
  for (let k = 0; k < pool.length && opts.length < 3; k++) {
    const key = keyFn(pool[k]);
    if (!seen[key]) { seen[key] = 1; opts.push(pool[k]); }
  }
  return opts;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// 拼写提示：除首字母外全部遮住（der Tag → d·· T·g）
export function maskWord(de) {
  return de.split(' ').map(function (tok) {
    if (/^(der|die|das)$/i.test(tok)) return tok[0] + '··';
    return tok[0] + '·'.repeat(Math.max(1, tok.length - 1));
  }).join(' ');
}

// 拼写提示第二档：每词元露前半（ceil(len/2)），后半遮（lernen → ler···；der Tag → der Ta·）
export function maskWordHalf(de) {
  return de.split(' ').map(function (tok) {
    if (/^(der|die|das)$/i.test(tok)) return tok;
    const n = Math.ceil(tok.length / 2);
    return tok.slice(0, n) + '·'.repeat(Math.max(1, tok.length - n));
  }).join(' ');
}

/* ---------- 主题列表 ---------- */
function themesPage() {
  const s = store.state;
  const lv = currentLevel();
  const themes = getVocabThemes().filter(function (t) { return (t.level || 'A1') === lv; });
  const total = themes.reduce(function (n, t) { return n + t.words.length; }, 0);
  const v = UI.el('div');
  v.appendChild(UI.el('p', 'micro', 'WORTSCHATZ · ' + lv));
  v.appendChild(UI.el('h1', 'page-title', '词汇 · ' + lv));
  v.appendChild(UI.el('p', 'page-sub', themes.length + ' 个主题 · ' + total + ' 个核心词。点封面进主题学习，或从「今日」开始每日计划。'));
  const band = UI.el('div', 'level-band');
  band.appendChild(UI.el('span', 'micro', 'AUSGABE ' + lv));
  v.appendChild(band);
  const wall = UI.el('div', 'cover-wall');
  const imageCovers = getImageCovers();
  themes.forEach(function (t) {
    let learned = 0;
    t.words.forEach(function (w, i) { if (s.srs[t.id + '-' + i]) learned++; });
    const a = UI.el('a', 'cover-cell');
    a.href = '#/theme/' + t.id;
    const hasCover = imageCovers.indexOf && imageCovers.indexOf(t.id) >= 0;
    const imgHtml = hasCover
      ? '<img class="cover-img" loading="lazy" src="images/covers/' + t.id + '.png" alt="">'
      : '<div class="cover-img"></div>';
    a.innerHTML = imgHtml +
      '<span class="cover-cap"><span class="t-name">' + UI.esc(t.name) + '</span>' +
      '<span class="t-meta">' + learned + ' / ' + t.words.length + ' · ' + t.words.length + ' WÖRTER</span></span>';
    wall.appendChild(a);
  });
  v.appendChild(wall);
  return v;
}

/* ---------- 学新词（5 词一批：集中介绍三按钮分流 → 加强练习 → 组末小结） ----------
   一批 5 词（最后一批可不满）：逐词 wordCard 介绍，每张三个按钮——
     不认识 → 进本批加强名单（选择×2 + 拼写检验）
     认识   → 直接入 SRS（quality 2），标记 verify，待复习答对转正
     斩     → 封印卡片（sealed + mastered），永不再复习
   加强名单每词：看德语选中文 + 看中文选德语（各有 1/3 概率换成听音选词）+ 拼写检验
   一批结束组末小结，再进下一批，直到队列耗尽 */
const BATCH = 5;
function pickNewWords(themeId, limit) {
  const s = store.state;
  const lv = currentLevel();
  const pool = allWords.filter(function (w) {
    return w.level === lv && (!themeId || w.theme === themeId) && !s.srs[w.id];
  });
  return pool.slice(0, limit);
}

function learnSession(themeId) {
  // 跨级别防御：若主题属于尚未加载的级别，先懒加载
  if (themeId) {
    const lv = themeLevels[themeId] || inferLevelFromId(themeId);
    if (lv && lv !== 'A1' && !isLevelLoaded(lv)) {
      const loading = UI.el('div', 'card', '<p>加载 ' + lv + ' 词汇数据...</p>');
      loadLevelData(lv).then(function () { render(); }).catch(function (e) {
        console.error(e);
        loading.innerHTML = '<p>加载失败，请重试。</p>';
      });
      return loading;
    }
  }
  const s = store.state;
  const todayStr = today();
  const queue = pickNewWords(themeId, s.settings.dailyNew);
  const themeName = themeId ? (getVocabThemes().find(function (t) { return t.id === themeId; }) || {}).name : '每日计划';

  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('h1', 'page-title', '学新词' + (themeId ? ' · ' + themeName : '')));

  if (!queue.length) {
    const empty = UI.el('div', 'card empty');
    if (themeId) {
      empty.innerHTML = '<p>这个主题的词都学过了。</p>';
      const b = UI.el('button', 'btn', '回到词汇主题');
      b.onclick = function () { location.hash = '#/vocab'; };
      empty.appendChild(b);
    } else {
      empty.innerHTML = '<p>所有词都至少学过一遍了！接下来靠复习巩固。</p>';
      const b2 = UI.el('button', 'btn', '去复习');
      b2.onclick = function () { location.hash = '#/review'; };
      empty.appendChild(b2);
    }
    v.appendChild(empty);
    return v;
  }

  // 标题下进度行：今日新词 x/N · 本组第 k/5 个（介绍推进时更新）
  const sub = UI.el('p', 'page-sub');
  v.appendChild(sub);
  function paintSub() {
    const t = s.daily[todayStr] || {};
    sub.textContent = '今日新词 ' + (t.new || 0) + ' / ' + s.settings.dailyNew +
      ' · 本组第 ' + (pos - groupStart + 1) + ' / ' + BATCH + ' 个';
  }

  let groupStart = 0;          // 当前批起点（queue 下标）
  let pos = 0;                 // 当前介绍到的词（queue 下标）
  let lit = 0;                 // 已点亮的词数（介绍即点亮）
  let strengthen = [];         // 本批加强名单
  let rq = makeRequeue(2);     // 本批错词再练队列
  let doneCount = 0;           // 加强阶段已完成词数（含再练词），驱动 take 节奏
  const results = [];          // 本批结果（小结展示）
  const dots = UI.el('div', 'progress-dots');
  queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
  v.appendChild(dots);
  const stage = UI.el('div');
  v.appendChild(stage);

  function groupEnd() { return Math.min(groupStart + BATCH, queue.length); }

  function paintDots() {
    dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < lit); });
  }

  /* --- 介绍阶段：逐词 wordCard + 三按钮分流 --- */
  function showIntro() {
    paintDots();
    paintSub();
    stage.innerHTML = '';
    const w = queue[pos];
    stage.appendChild(UI.el('p', 'micro', 'WORT ' + (pos + 1) + ' / ' + queue.length +
      (queue.length > BATCH ? ' · GRUPPE ' + (Math.floor(pos / BATCH) + 1) : '')));
    stage.appendChild(wordCard(w));
    audio.playWord(w.id, w.de);
    const hint = UI.el('p', 'micro', '「不认识」加入本组加强练习；「认识」今天不再练习，明天安排一次验证复习；「斩」已经很熟，永久移出复习。');
    hint.style.cssText = 'margin:10px 0 0;text-transform:none;letter-spacing:0.06em';
    stage.appendChild(hint);
    const rate = UI.el('div', 'self-rate');
    const bNo = UI.el('button', 'btn rate-no', '不认识');
    bNo.onclick = function () { strengthen.push(w); advanceIntro(); };
    rate.appendChild(bNo);
    const bYes = UI.el('button', 'btn btn-ghost', '认识');
    bYes.onclick = function () { knowWord(w); };
    rate.appendChild(bYes);
    const bSeal = UI.el('button', 'btn btn-ghost', '斩');
    bSeal.style.cssText = 'color:var(--f);border-color:var(--f)';
    bSeal.onclick = function () { sealWord(w); };
    rate.appendChild(bSeal);
    stage.appendChild(rate);
  }

  function advanceIntro() {
    lit++;
    pos++;
    if (pos < groupEnd()) showIntro();
    else if (strengthen.length) startStrengthen(0);
    else showGroupSummary();
  }

  // 认识：直接入 SRS（quality 2），标记 verify，复习答对后转正（斩）
  function knowWord(w) {
    const card = SRS.newCard(todayStr);
    SRS.review(card, 2, todayStr);
    card.verify = true;
    store.state.srs[w.id] = card;
    store.touchToday('new', 1);
    store.save();
    results.push({ w: w, status: 'verify' });
    advanceIntro();
  }

  // 斩：已经很熟，封印卡片，永远不再复习
  function sealWord(w) {
    store.state.srs[w.id] = Object.assign(SRS.newCard(todayStr), { sealed: true, mastered: true });
    store.touchToday('new', 1);
    store.save();
    results.push({ w: w, status: 'sealed' });
    advanceIntro();
  }

  /* --- 加强阶段：本批加强名单逐词过题 --- */
  function startStrengthen(i) {
    if (i >= strengthen.length) { drainStrengthen(); return; }
    const w = strengthen[i];
    runSteps(w, stepsFor(w), function (wrongs, spellFails) {
      finishWord(w, wrongs, spellFails);
      if (wrongs > 0 || spellFails > 0) rq.push(w);
      doneCount++;
      strengthenNext(i);
    });
  }

  // 名单耗尽后 drain 再练队列：批末答错的词不再等下一个 3 的倍数
  function drainStrengthen() {
    const rw = rq.drain();
    if (!rw) { showGroupSummary(); return; }
    runSteps(rw, stepsFor(rw), function (wrongs, spellFails) {
      finishWord(rw, wrongs, spellFails);
      if (wrongs > 0 || spellFails > 0) rq.push(rw);
      doneCount++;
      drainStrengthen();
    }, true);
  }

  // 每完成一个词（含再练词）先检查再练队列：取到错词立即插练，否则推进名单
  function strengthenNext(i) {
    const rw = rq.take(doneCount);
    if (!rw) { startStrengthen(i + 1); return; }
    runSteps(rw, stepsFor(rw), function (wrongs, spellFails) {
      // 再练轮：FSRS 正常推进，但不重复 addMistake（第一次错已记）
      finishWord(rw, wrongs, spellFails);
      if (wrongs > 0 || spellFails > 0) rq.push(rw);
      doneCount++;
      strengthenNext(i);
    }, true);
  }

  // 步型配置：有配图的词图片四选一 + 选择 + 拼写；否则两道选择各约 1/3 概率换成听音选词
  function stepsFor(w) {
    function pick(base) { return Math.random() < 1 / 3 ? 'listen' : base; }
    const choiceStep = pick(Math.random() < 0.5 ? 'trans' : 'reverse');
    return hasImage(w, getImageWords())
      ? ['image', choiceStep, 'spell']
      : [pick('trans'), pick('reverse'), 'spell'];
  }

  /* --- 单词练习步骤（image / trans / reverse / listen / spell） --- */
  function runSteps(w, steps, done, isRetry) {
    let si = 0, wrongs = 0, spellFails = 0;

    function wrongAnswer() {
      wrongs++;
      if (!isRetry) store.addMistake('vocab', w.id);
    }

    function nextStep() {
      si++;
      if (si >= steps.length) done(wrongs, spellFails);
      else renderStep();
    }

    function renderStep() {
      stage.innerHTML = '';
      const kind = steps[si];
      const card = UI.el('div', 'card');
      const stepLabel = UI.el('p', 'micro', 'WORT ' + (queue.indexOf(w) + 1) + ' · SCHRITT ' + (si + 1) + '/' + steps.length);
      card.appendChild(stepLabel);
      const fb = UI.el('div');
      const next = UI.el('button', 'btn', '继续');
      next.style.display = 'none';
      next.onclick = nextStep;

      function reveal(msg) {
        audio.playWord(w.id, w.de);
        fb.innerHTML = '<div class="feedback ' + (msg.indexOf('正确') === 0 ? 'ok' : 'bad') + '">' + msg + '</div>';
        next.style.display = 'inline-block';
        next.focus();
      }

      // 提示条（不阻断重选）
      function hint(msg) {
        fb.innerHTML = '<div class="feedback">' + msg + '</div>';
      }

      if (kind === 'image') {
        // 看图选词（百词斩式）：答错一次记 wrongs，随后进入下一题
        renderImageChoice(card, w, {
          imageIds: getImageWords(),
          pool: allWords,
          speak: audio.playWord,
          onDone: function (firstTry) {
            if (firstTry === false) wrongAnswer();
            nextStep();
          }
        });
        card.appendChild(detailDrawer(w));
        stage.appendChild(card);
        return;
      }

      if (kind === 'trans') {
        // 看德语选中文：第 1 次错给提示允许重选，第 2 次错揭示答案
        card.appendChild(UI.el('div', 'quiz-prompt', UI.esc(w.de) + ' 的意思是？'));
        const opts = shuffle([w].concat(distractors(w, function (x) { return x.zh; })));
        const box = UI.el('div', 'opts');
        let missed = false;
        opts.forEach(function (o) {
          const b = UI.el('button', 'opt', UI.esc(o.zh));
          b.onclick = function () {
            if (b.disabled) return;
            if (o.id === w.id) { b.classList.add('correct'); reveal('正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh)); }
            else if (!missed) {
              missed = true;
              b.classList.add('wrong'); b.disabled = true;
              wrongAnswer();
              hint('提示：' + genderTag(w.g) + ' ' + UI.esc(maskWord(w.de)) + '（再选一次）');
            } else {
              b.classList.add('wrong');
              box.querySelectorAll('.opt').forEach(function (x, i) { x.disabled = true; if (opts[i].id === w.id) x.classList.add('correct'); });
              reveal('再记一次：' + UI.esc(w.de) + ' = ' + UI.esc(w.zh));
            }
          };
          box.appendChild(b);
        });
        card.appendChild(box);
      } else if (kind === 'reverse') {
        // 看中文选德语：第 1 次错给提示允许重选，第 2 次错揭示答案
        card.appendChild(UI.el('div', 'quiz-prompt', '「' + UI.esc(w.zh) + '」对应的德语是？'));
        const optsR = shuffle([w].concat(distractors(w, function (x) { return x.de; })));
        const boxR = UI.el('div', 'opts');
        let missedR = false;
        optsR.forEach(function (o) {
          const b = UI.el('button', 'opt', UI.esc(o.de));
          b.onclick = function () {
            if (b.disabled) return;
            if (o.id === w.id) { b.classList.add('correct'); reveal('正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh)); }
            else if (!missedR) {
              missedR = true;
              b.classList.add('wrong'); b.disabled = true;
              wrongAnswer();
              hint('提示：' + genderTag(w.g) + ' ' + UI.esc(maskWord(w.de)) + '（再选一次）');
            } else {
              b.classList.add('wrong');
              boxR.querySelectorAll('.opt').forEach(function (x, i) { x.disabled = true; if (optsR[i].id === w.id) x.classList.add('correct'); });
              reveal('再记一次：' + UI.esc(w.de) + ' = ' + UI.esc(w.zh));
            }
          };
          boxR.appendChild(b);
        });
        card.appendChild(boxR);
      } else if (kind === 'listen') {
        // 听音选词
        const play = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
        play.style.marginBottom = '12px';
        play.onclick = function () { audio.playWord(w.id, w.de); };
        card.appendChild(play);
        const slow1 = slowBtn(w.de, w.id); slow1.style.marginLeft = '6px';
        card.appendChild(slow1);
        audio.playWord(w.id, w.de);
        card.appendChild(UI.el('div', 'quiz-prompt', '听音频，选出你听到的词'));
        const optsL = shuffle([w].concat(distractors(w, function (x) { return x.de; })));
        const boxL = UI.el('div', 'opts');
        let missedL = false;
        optsL.forEach(function (o) {
          const b = UI.el('button', 'opt', UI.esc(o.de));
          b.onclick = function () {
            if (b.disabled) return;
            if (o.id === w.id) { b.classList.add('correct'); reveal('正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh)); }
            else if (!missedL) {
              missedL = true;
              b.classList.add('wrong'); b.disabled = true;
              wrongAnswer();
              hint('提示：' + genderTag(w.g) + ' ' + UI.esc(w.zh) + '（再选一次）');
            } else {
              b.classList.add('wrong');
              boxL.querySelectorAll('.opt').forEach(function (x, i) { x.disabled = true; if (optsL[i].id === w.id) x.classList.add('correct'); });
              reveal('正确答案：' + UI.esc(w.de) + '（' + UI.esc(w.zh) + '）');
            }
          };
          boxL.appendChild(b);
        });
        card.appendChild(boxL);
      } else {
        // 拼写检验：根据中文释义（+可听音频）拼写
        const isNoun = /^(der|die|das) /.test(w.de);
        const head = UI.el('div', 'quiz-prompt');
        head.innerHTML = '拼写这个单词：' + UI.esc(w.zh) +
          (isNoun ? ' ' + genderTag(w.g) + '<span class="stat-label">（冠词可写可不写）</span>' : '');
        card.appendChild(head);
        const play2 = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
        play2.style.margin = '0 0 12px';
        play2.onclick = function () { audio.playWord(w.id, w.de); };
        card.appendChild(play2);
        const slow2 = slowBtn(w.de, w.id); slow2.style.marginLeft = '6px';
        card.appendChild(slow2);
        const input = UI.el('input');
        input.type = 'text'; input.autocomplete = 'off';
        input.className = 'spell-input';
        input.placeholder = '输入德语单词';
        card.appendChild(input);
        const check = UI.el('button', 'btn btn-sm', '检查拼写');
        check.style.marginTop = '12px';
        let attempts = 0, spellDone = false;
        check.onclick = function () {
          if (spellDone) return;
          if (!input.value.trim()) { input.focus(); return; }
          attempts++;
          if (SRS.matches(input.value, w.de)) {
            spellDone = true;
            reveal('正确！拼写通过');
          } else if (attempts === 1) {
            // 第 1 次错：露首字母提示，再试
            hint('不对。提示：' + UI.esc(maskWord(w.de)) + '（再试一次）');
            input.value = ''; input.focus();
            wrongAnswer();
            return;
          } else if (attempts === 2) {
            // 第 2 次错：露前半提示，再试
            hint('不对。提示：' + UI.esc(maskWordHalf(w.de)) + '（再试一次）');
            input.value = ''; input.focus();
            return;
          } else {
            // 第 3 次错：揭示完整答案，spellFails 只记 1 次
            spellDone = true;
            spellFails++;
            reveal('正确拼写是：<b>' + UI.esc(w.de) + '</b>（' + UI.esc(w.zh) + '），明天复习还会见到它');
          }
        };
        input.onkeydown = function (ev) { if (ev.key === 'Enter') { next.style.display === 'none' ? check.click() : next.click(); } };
        card.appendChild(check);
        card.appendChild(UI.el('p', 'stat-label', 'ä 可输 ae，ö 输 oe，ü 输 ue，ß 输 ss'));
        input.focus();
      }
      card.appendChild(detailDrawer(w));
      card.appendChild(fb);
      card.appendChild(next);
      stage.appendChild(card);
    }
    renderStep();
  }

  /* --- 单词完成，记入 FSRS（仅加强名单的词走到这里） --- */
  function finishWord(w, wrongs, spellFails) {
    const quality = (wrongs === 0 && spellFails === 0) ? 2 : (spellFails >= 2 ? 0 : 1);
    let card = store.state.srs[w.id];
    if (!card) { card = SRS.newCard(todayStr); store.state.srs[w.id] = card; store.touchToday('new', 1); }
    SRS.review(card, quality, todayStr);
    store.save();
    if (spellFails === 0 && store.state.mistakes[w.id]) store.removeMistake(w.id);
    // 再练词会第二次走到这里：同一词只保留最后一次状态，避免小结 pass 计数超分母、重复列两行
    for (let ri = results.length - 1; ri >= 0; ri--) {
      if (results[ri].w.id === w.id) results.splice(ri, 1);
    }
    results.push({ w: w, status: spellFails === 0 ? 'pass' : 'fail' });
  }

  /* --- 组末小结 --- */
  function showGroupSummary() {
    paintDots();
    stage.innerHTML = '';
    const isLast = groupEnd() >= queue.length;
    const groupN = groupEnd() - groupStart;
    const pass = results.filter(function (r) { return r.status === 'pass'; }).length;
    const BADGE = {
      sealed: ['已斩', ' badge-on'],
      verify: ['待验证', ''],
      pass: ['拼写通过', ' badge-on'],
      fail: ['需巩固', '']
    };
    const done = UI.el('div', 'card');
    done.appendChild(UI.el('h3', null, '这批学完了'));
    done.appendChild(UI.el('div', 'result-num', pass + ' / ' + groupN));
    done.appendChild(UI.el('p', 'stat-label', '已斩的词永不再复习；待验证的词明天复习答对后转正；拼写未一次通过的词已重点标记，复习时优先安排。'));
    const list = UI.el('div', null);
    list.style.margin = '12px 0';
    results.forEach(function (r) {
      const item = UI.el('div', 'mistake-item');
      item.innerHTML = '<div class="m-body">' + genderTag(r.w.g) + ' <b>' + UI.esc(r.w.de) + '</b> — ' + UI.esc(r.w.zh) + '</div>' +
        '<span class="badge' + BADGE[r.status][1] + '">' + BADGE[r.status][0] + '</span>';
      item.appendChild(speakBtn(r.w.de, 'word', r.w.id));
      list.appendChild(item);
    });
    done.appendChild(list);
    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    if (!isLast) {
      const bNext = UI.el('button', 'btn', '下一组（还有 ' + (queue.length - groupEnd()) + ' 个）');
      bNext.onclick = function () {
        groupStart = groupEnd();
        pos = groupStart;
        strengthen = [];
        rq = makeRequeue(2);
        doneCount = 0;
        results.length = 0;
        showIntro();
      };
      row.appendChild(bNext);
    } else {
      const b1 = UI.el('button', 'btn', '再学一组');
      b1.onclick = function () { render(); };
      if (!pickNewWords(themeId, 1).length) b1.disabled = true;
      row.appendChild(b1);
    }
    const b2 = UI.el('button', 'btn btn-ghost', '回到词汇主题');
    b2.onclick = function () { location.hash = themeId ? '#/vocab' : '#/'; };
    row.appendChild(b2);
    done.appendChild(row);
    stage.appendChild(done);
  }

  showIntro();
  return v;
}

/* ---------- 复习（SRS） ---------- */

// 百词斩式错词再练队列：push 记录再练次数（超 maxRounds 忽略），
// take(idx) 在每完成 3 题（idx % 3 === 0 且 idx > 0）时取出队首错词复现；
// drain() 在名单/队列耗尽时无视 %3 闸直接出队（批末/会话末追加复现）
export function makeRequeue(maxRounds) {
  const queue = [];
  const counts = {};
  return {
    push: function (w) {
      const n = counts[w.id] || 0;
      if (n >= maxRounds) return;
      counts[w.id] = n + 1;
      queue.push(w);
    },
    take: function (idx) {
      if (idx % 3 !== 0 || idx <= 0 || !queue.length) return null;
      return queue.shift();
    },
    // 队尾追加：名单/队列耗尽时无视 %3 闸直接出队（push 仍受 maxRounds 封顶，不会死循环）
    drain: function () {
      if (!queue.length) return null;
      return queue.shift();
    },
    countOf: function (id) {
      return counts[id] || 0;
    }
  };
}

// 复习队列排序：verify 卡与错词排最前，其余按可提取度（遗忘曲线）升序；
// 优先级组内仍按可提取度升序；可提取度相同保持原顺序（稳定排序）
export function orderReviewQueue(words, srsMap, todayStr) {
  const mistakes = store.state.mistakes;
  function retrievabilityOf(id) {
    const card = srsMap[id];
    if (!card) return 1; // 无卡视为最易提取，排最后
    const base = card.last || card.due || todayStr;
    return SRS.retrievability(card.stability || 0.1, SRS.daysBetween(base, todayStr));
  }
  function priority(id) {
    const card = srsMap[id];
    if ((card && card.verify) || mistakes[id]) return 0;
    return 1;
  }
  return words.map(function (w, i) {
    return { w: w, i: i, p: priority(w.id), r: retrievabilityOf(w.id) };
  }).sort(function (a, b) {
    if (a.p !== b.p) return a.p - b.p;
    if (a.r !== b.r) return a.r - b.r;
    return a.i - b.i;
  }).map(function (x) { return x.w; });
}

export function dueWords(onlyMistakes) {
  const s = store.state, todayStr = today();
  let ids;
  if (onlyMistakes) {
    // 错题重练路径不经过 isDue，这里显式排除已斩的词
    ids = Object.keys(s.mistakes).filter(function (id) { return s.mistakes[id].type === 'vocab' && s.srs[id] && !s.srs[id].sealed; });
  } else {
    ids = Object.keys(s.srs).filter(function (id) { return SRS.isDue(s.srs[id], todayStr); });
  }
  // 语法卡 id 含 '#'（如 g-praesens#2），wordById 返回 undefined，被 filter(Boolean) 天然排除
  return ids.map(wordById).filter(Boolean);
}

function reviewSession(onlyMistakes) {
  const s = store.state, todayStr = today();
  // 跨级别防御：到期/错词卡若属于未加载级别，先懒加载
  let ids;
  if (onlyMistakes) {
    ids = Object.keys(s.mistakes).filter(function (id) { return s.mistakes[id].type === 'vocab' && s.srs[id]; });
  } else {
    ids = Object.keys(s.srs).filter(function (id) { return SRS.isDue(s.srs[id], todayStr) && id.indexOf('#') === -1; });
  }
  const needed = {};
  ids.forEach(function (id) {
    const dash = id.lastIndexOf('-');
    const themeId = dash > 0 ? id.substring(0, dash) : id;
    const lv = themeLevels[themeId] || inferLevelFromId(themeId);
    if (lv && lv !== 'A1' && !isLevelLoaded(lv)) needed[lv] = true;
  });
  const levels = Object.keys(needed);
  if (levels.length) {
    const loading = UI.el('div', 'card', '<p>加载复习数据...</p>');
    Promise.all(levels.map(loadLevelData)).then(function () { render(); }).catch(function (e) {
      console.error(e);
      loading.innerHTML = '<p>加载失败，请重试。</p>';
    });
    return loading;
  }
  const queue = orderReviewQueue(dueWords(onlyMistakes), s.srs, todayStr).slice(0, 30);
  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('h1', 'page-title', onlyMistakes ? '错词重练' : '今日复习'));
  if (!queue.length) {
    const e = UI.el('div', 'card empty');
    e.innerHTML = '<p>' + (onlyMistakes ? '错题本是空的，保持！' : '今天没有到期的复习。学几个新词？') + '</p>';
    const art = UI.el('img', 'empty-art');
    art.src = 'images/zine/empty-review.png'; art.alt = ''; art.loading = 'lazy';
    e.insertBefore(art, e.firstChild);
    const b = UI.el('button', 'btn', '学新词');
    b.onclick = function () { location.hash = '#/learn'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }
  v.appendChild(UI.el('p', 'page-sub', queue.length + ' 个词 · 答对了会安排更久的间隔，答错明天再见'));

  let idx = 0, right = 0;
  const rq = makeRequeue(2);   // 错词再练队列：每答完 3 题复现一次
  let answeredCount = 0;       // 已答题数（含再练题），驱动 take 节奏
  const dots = UI.el('div', 'progress-dots');
  queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
  v.appendChild(dots);
  const stage = UI.el('div');
  v.appendChild(stage);

  // 为每个词生成一种题型
  function buildQuestion(w) {
    let type;
    if (hasImage(w, getImageWords()) && Math.random() < 0.4) type = 'image';
    else {
      const types = ['gender', 'trans', 'listen', 'cloze', 'dict'];
      type = types[Math.floor(Math.random() * types.length)];
      if (type === 'cloze' && !w.ex) type = 'trans';
    }
    const q = { w: w, type: type, answered: false };

    if (type === 'image') {
      // 图片四选一：renderImageChoice 自带题干、渐进提示与反馈，这里只补 explain 供评分文案
      q.explain = w.de + ' = ' + w.zh;
    } else if (type === 'gender') {
      q.prompt = UI.esc(w.de.replace(/^(der|die|das) /, '')) + ' —— ' + UI.esc(w.zh) + '<br>这个词的词性是？';
      q.opts = ['der（阳性）', 'die（阴性）', 'das（中性）'];
      q.answerIdx = { m: 0, f: 1, n: 2, pl: 1 }[w.g];
      q.explain = w.de + '（' + w.zh + '）';
    } else if (type === 'trans') {
      q.prompt = UI.esc(w.de) + ' 的意思是？';
      const wrong = distractors(w, function (x) { return x.zh; });
      q.options = shuffle([w].concat(wrong)).map(function (x) { return { word: x, text: x.zh }; });
      q.explain = w.de + ' = ' + w.zh;
    } else if (type === 'listen') {
      q.prompt = '听音频，选出你听到的词 🔊（点喇叭可重听）';
      const wrongL = distractors(w, function (x) { return x.de; });
      q.options = shuffle([w].concat(wrongL)).map(function (x) { return { word: x, text: x.de }; });
      q.explain = w.de + ' = ' + w.zh;
    } else if (type === 'dict') {
      // 听写：听音频拼写整个词（名词建议带冠词）
      q.prompt = '听音频，拼写出这个词' + (/^(der|die|das) /.test(w.de) ? '（含冠词，如 der Tag）' : '') +
        '<br><input id="cloze-input" autocomplete="off" placeholder="输入德语单词">';
      q.answerText = w.de;
      q.explain = w.de + ' = ' + w.zh;
    } else {
      const blank = w.ex.replace(new RegExp('\\b' + w.de.replace(/^(der|die|das) /, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '＿＿＿');
      q.prompt = '填空：' + UI.esc(blank) + '<br><span class="stat-label">' + UI.esc(w.exZh) + '</span>' +
        '<br><input id="cloze-input" autocomplete="off" placeholder="输入缺少的德语词">';
      q.answerText = w.de.replace(/^(der|die|das) /, '');
      q.explain = w.ex + '（' + w.exZh + '）';
    }
    return q;
  }

  function show(w, isRetry) {
    stage.innerHTML = '';
    dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
    if (w === undefined) { w = queue[idx]; isRetry = false; }
    const q = buildQuestion(w);
    q.retry = !!isRetry;
    const card = UI.el('div', 'card');
    if (q.type === 'listen' || q.type === 'dict') {
      const play = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
      play.onclick = function () { audio.playWord(w.id, w.de); };
      play.style.marginBottom = '12px';
      card.appendChild(play);
      const slowR = slowBtn(w.de, w.id); slowR.style.marginLeft = '6px';
      card.appendChild(slowR);
      audio.playWord(w.id, w.de);
    }
    if (q.type !== 'image') {
      const p = UI.el('div', 'quiz-prompt');
      p.innerHTML = q.prompt;
      card.appendChild(p);
    }

    const fb = UI.el('div');
    const next = UI.el('button', 'btn', '下一个');
    next.style.display = 'none';
    next.onclick = advance;

    function correct() {
      if (q.answered) return;
      q.answered = true; right++;
      store.touchToday('reviewed', 1); store.touchToday('correct', 1);
      const c = s.srs[w.id];
      let sealedNow = false;
      if (c && c.verify && !c.sealed) { SRS.seal(c); delete c.verify; sealedNow = true; }
      if (c && !c.sealed) SRS.review(c, 2, todayStr);
      store.save();
      if (s.mistakes[w.id]) store.removeMistake(w.id);
      if (q.type !== 'image') fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(q.explain) +
        (sealedNow ? ' · 已通过验证，斩掉此词，不再安排复习' : '') + '</div>';
      reveal();
    }
    function wrongFn() {
      if (q.answered) return;
      q.answered = true;
      store.touchToday('reviewed', 1);
      const c = s.srs[w.id];
      if (c) {
        if (c.verify) delete c.verify; // 验证未通过：回正常调度
        if (!c.sealed) SRS.review(c, 0, todayStr);
      }
      store.save();
      if (!q.retry) store.addMistake('vocab', w.id); // 再练轮不重复记错题
      rq.push(w); // 答错的词隔 3 题复现（受 maxRounds 上限约束）
      if (q.type !== 'image') fb.innerHTML = '<div class="feedback bad">再记一次：' + UI.esc(q.explain) + '</div>';
      reveal();
    }
    function reveal() {
      audio.playWord(w.id, w.de);
      next.style.display = 'inline-block';
      next.focus();
    }

    // 选择题首次错提示：听音题给词性+释义，其余给词性+拼写遮罩
    function choiceHint(q2) {
      if (q2.type === 'listen') return genderTag(q2.w.g) + ' ' + UI.esc(q2.w.zh);
      return genderTag(q2.w.g) + ' ' + UI.esc(maskWord(q2.w.de));
    }

    if (q.type === 'image') {
      // 图片四选一：自带渐进提示与 600ms 延迟反馈，onDone 后进入评分
      const holder = UI.el('div');
      card.appendChild(holder);
      renderImageChoice(holder, w, {
        imageIds: getImageWords(),
        pool: allWords,
        speak: audio.playWord,
        onDone: function (firstTry) {
          if (firstTry === true) correct(); else wrongFn();
          // 图片题正确时 renderImageChoice 的反馈条会被后续 DOM 覆盖，
          // 答对/转正的关键反馈（尤其斩转正）必须仍写进 fb
          if (firstTry === true) fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(q.explain) +
            (s.srs[w.id] && s.srs[w.id].sealed ? ' · 已通过验证，斩掉此词，不再安排复习' : '') + '</div>';
        }
      });
    } else if (q.opts) { // 词性三选一
      const box = UI.el('div', 'opts');
      let missedG = false;
      q.opts.forEach(function (text, i) {
        const b = UI.el('button', 'opt', text);
        b.onclick = function () {
          if (q.answered || b.disabled) return;
          if (i === q.answerIdx) {
            b.classList.add('correct');
            box.querySelectorAll('.opt').forEach(function (x) { x.disabled = true; });
            if (!missedG) correct();
            else fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(q.explain) + '</div>';
          } else if (!missedG) {
            // 第 1 次错：计分并给提示，允许重选
            missedG = true;
            b.classList.add('wrong'); b.disabled = true;
            wrongFn();
            fb.innerHTML = '<div class="feedback">提示：' + UI.esc(w.zh) + '（再选一次）</div>';
          } else {
            // 第 2 次错：揭示答案
            b.classList.add('wrong'); b.disabled = true;
            box.querySelectorAll('.opt').forEach(function (x, j) { x.disabled = true; if (j === q.answerIdx) x.classList.add('correct'); });
            fb.innerHTML = '<div class="feedback bad">再记一次：' + UI.esc(q.explain) + '</div>';
          }
        };
        box.appendChild(b);
      });
      card.appendChild(box);
    } else if (q.options) { // 选择题
      const box2 = UI.el('div', 'opts');
      let missed = false;
      q.options.forEach(function (o) {
        const b = UI.el('button', 'opt', UI.esc(o.text));
        b.onclick = function () {
          if (q.answered || b.disabled) return;
          if (o.word.id === w.id) {
            b.classList.add('correct');
            box2.querySelectorAll('.opt').forEach(function (x) { x.disabled = true; });
            if (!missed) correct();
            else fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(q.explain) + '</div>';
          } else if (!missed) {
            // 第 1 次错：计分并给提示，允许重选
            missed = true;
            b.classList.add('wrong'); b.disabled = true;
            wrongFn();
            fb.innerHTML = '<div class="feedback">提示：' + choiceHint(q) + '（再选一次）</div>';
          } else {
            // 第 2 次错：揭示答案
            b.classList.add('wrong'); b.disabled = true;
            box2.querySelectorAll('.opt').forEach(function (x, i) {
              x.disabled = true;
              if (q.options[i].word.id === w.id) x.classList.add('correct');
            });
            fb.innerHTML = '<div class="feedback bad">再记一次：' + UI.esc(q.explain) + '</div>';
          }
        };
        box2.appendChild(b);
      });
      card.appendChild(box2);
    } else { // 填空/听写
      const check = UI.el('button', 'btn', '检查答案');
      check.style.marginTop = '12px';
      let input, attempts = 0;
      check.onclick = function () {
        if (q.answered) return;
        input = document.getElementById('cloze-input');
        if (!input.value.trim()) { input.focus(); return; }
        if (SRS.matches(input.value, q.answerText)) {
          correct();
          input.disabled = true;
        } else if (attempts === 0) {
          // 第 1 次错：露首字母提示，再试（不计分）
          attempts++;
          fb.innerHTML = '<div class="feedback">提示：' + UI.esc(maskWord(q.answerText)) + '（再试一次）</div>';
          input.value = ''; input.focus();
        } else {
          // 第 2 次错：判错
          wrongFn();
          input.disabled = true;
        }
      };
      card.appendChild(check);
      card.appendChild(UI.el('p', 'stat-label', '输入时可不带冠词；ä 可输 ae，ö 输 oe，ü 输 ue，ß 输 ss'));
      card.onkeydown = function (ev) { if (ev.key === 'Enter' && !q.answered) check.click(); else if (ev.key === 'Enter') next.click(); };
    }
    card.appendChild(detailDrawer(w, false));
    card.appendChild(fb);
    card.appendChild(next);
    stage.appendChild(card);
    const inp = document.getElementById('cloze-input');
    if (inp) inp.focus();
  }

  // 每答完一题先检查再练队列：取到错词立即复现（不推进队列），否则推进 idx
  function advance() {
    answeredCount++;
    const rw = rq.take(answeredCount);
    if (rw) { show(rw, true); return; }
    idx++;
    if (idx < queue.length) show();
    else drainReview();
  }

  // 会话末 drain 再练队列：队尾答错的词不再等下一个 3 的倍数
  function drainReview() {
    const rw = rq.drain();
    if (!rw) { finish(); return; }
    show(rw, true);
  }

  function finish() {
    dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
    stage.innerHTML = '';
    const done = UI.el('div', 'card');
    done.appendChild(UI.el('div', 'result-num', right + ' / ' + queue.length));
    done.appendChild(UI.el('p', 'stat-label', '答对 ' + right + ' 个 · 答错的词已加入错题本，明天还会再见到它们'));
    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    const still = dueWords(onlyMistakes).length;
    if (still > 0) {
      const b0 = UI.el('button', 'btn', '继续复习剩下 ' + still + ' 个');
      b0.onclick = function () { render(); };
      row.appendChild(b0);
    }
    const b1 = UI.el('button', 'btn btn-ghost', '回首页');
    b1.onclick = function () { location.hash = '#/'; };
    row.appendChild(b1);
    done.appendChild(row);
    stage.appendChild(done);
  }

  show();
  return v;
}

export const Vocab = {
  themesPage: themesPage,
  learnSession: learnSession,
  reviewSession: reviewSession,
  dueWords: dueWords,
  orderReviewQueue: orderReviewQueue,
  genderTag: genderTag,
  highlightEx: highlightEx,
  maskWord: maskWord,
  maskWordHalf: maskWordHalf,
  makeRequeue: makeRequeue
};
