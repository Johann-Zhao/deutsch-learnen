/* 听力模块（S7）：对话首页、三级交互对话页（盲听→答题→精听）、听写强化页、听力错题复习页。
   数据来自 index.html 静态加载的 data/listening.js（window.LISTEN_DIALOGS）与 audio/manifest.js 的
   AUDIO_DIALOGS；两者缺失时一律按空值处理并显示空状态，不报错。
   对话理解错题复用语法错题卡机制进 FSRS，卡 id 为 listen-{dialogueId}#{qIndex}。 */

import { store } from './store.js';
import { today } from './storage.js';
import * as SRS from './srs.js';
import { UI, slowBtn } from './ui.js';
import { audio, stop as stopAudio } from './audio.js';
import { getListenDialogs, getAudioDialogs, wordsOfLevel, currentLevel, LEVELS } from './data.js';
import { maskWord, maskWordHalf, makeRequeue } from './vocabulary.js';
import { renderExerciseItem } from './grammar.js';
import { Cloze } from './cloze.js';
import { render } from './app.js';

const LINE_GAP_MS = 600;      // 整组连播的行间停顿
const DICTATION_LIMIT = 20;   // 听写强化每次抽题上限
const CARD_PREFIX = 'listen-';

/* 纯函数：对话题卡 id（含 #，与语法卡 g-…#n 同风格，与词汇卡 id 天然区分） */
export function dialogueCardId(dialogueId, qIndex) {
  return CARD_PREFIX + dialogueId + '#' + qIndex;
}

/* 纯函数：由听力卡 id 反解 { dialogueId, qIndex }；非听力卡返回 null */
export function parseDialogueCardId(cardId) {
  const s = String(cardId || '');
  if (s.indexOf(CARD_PREFIX) !== 0) return null;
  const parts = s.slice(CARD_PREFIX.length).split('#');
  if (parts.length !== 2 || !parts[0] || !/^\d+$/.test(parts[1])) return null;
  return { dialogueId: parts[0], qIndex: parseInt(parts[1], 10) };
}

/* 纯函数：听写抽题——到期词优先，其次已有卡的非到期词（含错词），保持原顺序、去重、上限 limit */
export function pickDictationQueue(words, srs, todayStr, limit) {
  const pool = words || [];
  const map = srs || {};
  const cap = limit || DICTATION_LIMIT;
  const due = pool.filter(function (w) {
    return map[w.id] && !map[w.id].sealed && SRS.isDue(map[w.id], todayStr);
  });
  const rest = pool.filter(function (w) {
    return due.indexOf(w) === -1 && map[w.id] && !map[w.id].sealed;
  });
  return due.concat(rest).slice(0, cap);
}

export function listenDueCount() {
  const srs = store.state.srs, todayStr = today();
  return Object.keys(srs).filter(function (id) {
    return !!parseDialogueCardId(id) && SRS.isDue(srs[id], todayStr);
  }).length;
}

export function dialogById(id) {
  return getListenDialogs().find(function (d) { return d.id === id; }) || null;
}

/* 整组连播：逐行播放，行间停顿 LINE_GAP_MS 再播下一行；
   音频与合成引擎都不可用时按文本长度估算兜底，保证不会卡在第 1 行。
   返回控制器 { stop() }，stop 同时中断当前音频。 */
function playDialogue(dial, onLine, onDone) {
  const lines = (dial && dial.lines) || [];
  let i = 0, cancelled = false, timer = null;
  function cleanup() { if (timer) { clearTimeout(timer); timer = null; } }
  function step() {
    if (cancelled) return;
    if (i >= lines.length) { if (onDone) onDone(); return; }
    const line = lines[i];
    if (onLine) onLine(i, lines.length);
    let finished = false, guard = null;
    function finish() {
      if (finished || cancelled) return;
      finished = true;
      if (guard) clearTimeout(guard);
      i++;
      timer = setTimeout(step, LINE_GAP_MS);
    }
    guard = setTimeout(finish, Math.max(2200, String(line.de || '').length * 120 + 1200));
    audio.playDialog(dial.id, i, line.de, { onEnd: finish });
  }
  step();
  return {
    stop: function () { cancelled = true; cleanup(); stopAudio(); }
  };
}

/* 整组播放控制条（对话页盲听与听力复习页共用）：按钮随状态在播放/停止/重听间切换 */
function playBar(dial, autoPlay) {
  const bar = UI.el('div', 'play-bar');
  const btn = UI.el('button', 'btn btn-sm', '▶ 播放整组对话');
  const status = UI.el('span', 'stat-label', '');
  bar.appendChild(btn);
  bar.appendChild(status);
  let seq = null;

  function stop() {
    if (seq) { seq.stop(); seq = null; }
    btn.textContent = '▶ 重听整组';
  }
  function start() {
    if (seq) return;
    status.textContent = '';
    btn.textContent = '■ 停止播放';
    seq = playDialogue(dial, function (i, total) {
      status.textContent = '第 ' + (i + 1) + ' / ' + total + ' 行…';
    }, function () {
      seq = null;
      btn.textContent = '▶ 重听整组';
      status.textContent = '播完了。';
    });
  }
  function toggle() {
    if (seq) { stop(); status.textContent = '已停止。'; } else start();
  }
  btn.onclick = toggle;
  if (autoPlay) start();
  return { bar: bar, start: start, stop: stop, toggle: toggle };
}

/* ---------- 听力首页 ---------- */

function homePage() {
  const dialogs = getListenDialogs();
  const todayStr = today();
  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('p', 'micro', 'HÖREN · 听力'));
  v.appendChild(UI.el('h1', 'page-title', '听力'));
  v.appendChild(UI.el('p', 'page-sub', dialogs.length
    ? dialogs.length + ' 组小对话：先盲听、再答题、最后逐句精听。答错的题会进 FSRS 复习。'
    : '用真实语速的小对话练耳朵，答错的题会进 FSRS 复习。'));

  const dueCount = listenDueCount();
  const reviewCard = UI.el('div', 'card');
  if (dueCount) {
    reviewCard.appendChild(UI.el('p', 'micro', 'WIEDERHOLUNG'));
    reviewCard.appendChild(UI.el('h3', null, '听力复习 ' + dueCount + ' 题'));
    reviewCard.appendChild(UI.el('p', 'stat-label', '答错的对话理解题到期了，重听一遍再答一次。'));
    const b = UI.el('button', 'btn', '开始听力复习（' + dueCount + ' 题）');
    b.onclick = function () { location.hash = '#/listen-review'; };
    reviewCard.appendChild(b);
  } else {
    reviewCard.appendChild(UI.el('p', 'micro', 'WIEDERHOLUNG'));
    reviewCard.appendChild(UI.el('h3', null, '听力复习'));
    reviewCard.appendChild(UI.el('p', 'stat-label', '还没有到期的听力错题。答错的对话理解题会自动排进这里。'));
  }
  v.appendChild(reviewCard);

  // 听写强化入口（零新内容成本：用本级已学词汇做听音拼写）
  const queue = pickDictationQueue(wordsOfLevel(currentLevel()), store.state.srs, todayStr, DICTATION_LIMIT);
  const dictCard = UI.el('div', 'card');
  dictCard.appendChild(UI.el('p', 'micro', 'DIKTAT · 听写强化'));
  dictCard.appendChild(UI.el('h3', null, '听写强化'));
  if (queue.length) {
    dictCard.appendChild(UI.el('p', 'stat-label', '听音频拼写已学的词，到期词优先，每次最多 ' + DICTATION_LIMIT + ' 个。'));
    const b = UI.el('button', 'btn', '开始听写（' + queue.length + ' 词）');
    b.onclick = function () { location.hash = '#/listen/dictation'; };
    dictCard.appendChild(b);
  } else {
    dictCard.appendChild(UI.el('p', 'stat-label', '本级还没有可练的词，先去学几个新词再来。'));
    const b = UI.el('button', 'btn btn-ghost', '去学新词');
    b.onclick = function () { location.hash = '#/learn'; };
    dictCard.appendChild(b);
  }
  v.appendChild(dictCard);

  if (!dialogs.length) {
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '对话内容建设中，敬请期待。'));
    const b = UI.el('button', 'btn', '回今日页');
    b.onclick = function () { location.hash = '#/'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }

  LEVELS.forEach(function (lv) {
    const group = dialogs.filter(function (d) { return (d.level || 'A1') === lv; });
    if (!group.length) return;
    const band = UI.el('div', 'level-band');
    band.appendChild(UI.el('span', 'micro', 'AUSGABE ' + lv + ' · ' + group.length + ' 组'));
    v.appendChild(band);
    group.forEach(function (d) { v.appendChild(dialogItem(d)); });
  });
  return v;
}

function dialogItem(dial) {
  const rec = store.state.listen[dial.id];
  const lines = dial.lines || [];
  const questions = dial.questions || [];
  const a = UI.el('a', 'topic-item');
  a.href = '#/listen/dialog/' + dial.id;
  const name = UI.el('div', 't-name', UI.esc(dial.title));
  name.appendChild(UI.el('span', 'badge', dial.level || 'A1'));
  if (rec) name.appendChild(UI.el('span', 'badge badge-on', '答对 ' + rec.right + '/' + rec.total));
  a.appendChild(name);
  a.appendChild(UI.el('div', 't-desc', UI.esc(dial.theme || '对话') + ' · ' + lines.length + ' 行 · ' +
    questions.length + ' 题 · ' + (rec ? '上次 ' + rec.at : '未学')));
  return a;
}

/* ---------- 对话页（三级交互） ---------- */

const PHASES = ['① 盲听', '② 答题', '③ 精听'];

function dialogPage(id) {
  const dial = dialogById(id);
  const v = UI.el('div', 'sheet');
  if (!dial) {
    v.appendChild(UI.el('p', 'micro', 'HÖREN'));
    v.appendChild(UI.el('h1', 'page-title', '找不到这组对话'));
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '这组对话暂时没有内容（可能还没生成）。'));
    const b = UI.el('button', 'btn', '回听力首页');
    b.onclick = function () { location.hash = '#/listen'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }

  const todayStr = today();
  const lines = dial.lines || [];
  const questions = dial.questions || [];
  const hasAudio = !!getAudioDialogs()[dial.id];

  v.appendChild(UI.el('p', 'micro', 'HÖREN · ' + (dial.level || 'A1') + ' · ' + String(dial.id).toUpperCase()));
  v.appendChild(UI.el('h1', 'page-title', UI.esc(dial.title)));
  v.appendChild(UI.el('p', 'page-sub', UI.esc(dial.theme || '对话') + ' · ' + lines.length + ' 行 · ' + questions.length + ' 题'));
  if (!hasAudio) {
    v.appendChild(UI.el('p', 'stat-label', '这组对话的音频还没生成，将用系统语音朗读代替。'));
  }

  const steps = UI.el('div', 'listen-steps');
  PHASES.forEach(function (name) { steps.appendChild(UI.el('span', 'listen-step', name)); });
  v.appendChild(steps);
  const stage = UI.el('div');
  v.appendChild(stage);

  let phase = 1, curBar = null;
  let qIdx = 0, right = 0, asked = 0;

  function stopBar() { if (curBar) { curBar.stop(); curBar = null; } }

  function paintSteps() {
    Array.prototype.forEach.call(steps.children, function (el, i) {
      el.classList.toggle('on', i + 1 === phase);
      el.classList.toggle('done', i + 1 < phase);
    });
  }

  function goPhase(p) {
    phase = p;
    if (p === 2) { qIdx = 0; right = 0; asked = 0; }
    show();
  }

  function show() {
    stopBar();
    stage.innerHTML = '';
    if (phase === 1) stage.appendChild(blindStage());
    else if (phase === 2) stage.appendChild(questionStage());
    else stage.appendChild(intensiveStage());
    paintSteps();
  }

  function blindStage() {
    const card = UI.el('div', 'card');
    card.appendChild(UI.el('p', 'micro', 'SCHRITT 1 · 盲听'));
    card.appendChild(UI.el('h3', null, '先不看原文，听完整组对话'));
    card.appendChild(UI.el('p', 'stat-label', '共 ' + lines.length + ' 行，行间停顿 0.6 秒。先抓大意，听不懂也没关系。'));
    curBar = playBar(dial, false);
    card.appendChild(curBar.bar);
    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap';
    const go = UI.el('button', 'btn', '我听完，开始答题');
    go.onclick = function () { goPhase(2); };
    row.appendChild(go);
    card.appendChild(row);
    return card;
  }

  function questionStage() {
    const card = UI.el('div', 'card');
    card.appendChild(UI.el('p', 'micro', 'SCHRITT 2 · 看题作答'));
    const dots = UI.el('div', 'progress-dots');
    questions.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    card.appendChild(dots);
    const replay = UI.el('button', 'btn btn-ghost btn-sm', '🔊 重听整组对话');
    replay.style.marginBottom = '14px';
    // 重听不回到阶段 1，就地重播：复用同一条播放控制条，避免反复插入堆积
    let bar = null;
    replay.onclick = function () {
      if (bar) { bar.toggle(); return; }
      bar = playBar(dial, true);
      bar.bar.style.marginBottom = '14px';
      curBar = bar;
      card.insertBefore(bar.bar, replay);
    };
    card.appendChild(replay);
    const box = UI.el('div');
    card.appendChild(box);

    function finishQuestions() {
      dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
      store.state.listen[dial.id] = { right: right, total: questions.length, at: todayStr };
      store.save();
      store.touchToday('reviewed', questions.length);
      if (right) store.touchToday('correct', right);
      box.innerHTML = '';
      const done = UI.el('div');
      done.appendChild(UI.el('div', 'result-num', right + ' / ' + questions.length));
      done.appendChild(UI.el('p', 'stat-label', right === questions.length
        ? '全对！这组对话可以放心进下一组了。'
        : '答对 ' + right + ' 题。做错的题进了错题本，明天会在听力复习里再见到。'));
      const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
      const next = UI.el('button', 'btn', '逐句精听');
      next.onclick = function () { goPhase(3); };
      row.appendChild(next);
      done.appendChild(row);
      box.appendChild(done);
    }

    function showQuestion() {
      box.innerHTML = '';
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < qIdx); });
      if (qIdx >= questions.length) { finishQuestions(); return; }
      const q = questions[qIdx];
      const built = renderExerciseItem(q, qIdx + 1, function (ok) {
        const cardId = dialogueCardId(dial.id, qIdx);
        // 无论对错都进 FSRS 调度；卡 id 与语法错题卡同风格（含 #）
        store.state.srs[cardId] = SRS.review(store.state.srs[cardId] || null, ok ? 2 : 0, todayStr);
        if (ok) {
          right++;
          store.removeMistake(cardId);
        } else {
          store.addMistake('listen', cardId);
        }
        store.save();
      }, qIdx < questions.length - 1 ? '下一题' : '看结果');
      built.next.onclick = function () { qIdx++; showQuestion(); };
      box.appendChild(built.element);
      built.focus();
    }

    showQuestion();
    return card;
  }

  function intensiveStage() {
    const card = UI.el('div', 'card');
    card.appendChild(UI.el('p', 'micro', 'SCHRITT 3 · 精听'));
    card.appendChild(UI.el('h3', null, '逐句对照，点任意一句重播'));
    const rec = store.state.listen[dial.id];
    lines.forEach(function (line, i) {
      const row = UI.el('div', 'dialog-line');
      row.appendChild(UI.el('span', 'sp-tag', line.sp));
      const body = UI.el('div', 'dl-body');
      body.appendChild(UI.el('div', 'dl-de', UI.esc(line.de)));
      body.appendChild(UI.el('div', 'dl-zh', UI.esc(line.zh)));
      row.appendChild(body);
      const b = UI.el('button', 'speak-btn', '🔊');
      b.title = '重播这一句';
      b.setAttribute('aria-label', '重播：' + line.de);
      b.onclick = function (e) {
        e.stopPropagation();
        audio.playDialog(dial.id, i, line.de);
      };
      row.appendChild(b);
      row.onclick = function () { audio.playDialog(dial.id, i, line.de); };
      card.appendChild(row);
    });
    if (rec) card.appendChild(UI.el('p', 'stat-label', '上次答对 ' + rec.right + '/' + rec.total + '（' + rec.at + '）。'));
    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap';
    const again = UI.el('button', 'btn btn-ghost btn-sm', '再答一次');
    again.onclick = function () { goPhase(2); };
    row.appendChild(again);
    const back = UI.el('button', 'btn btn-ghost btn-sm', '回听力首页');
    back.onclick = function () { location.hash = '#/listen'; };
    row.appendChild(back);
    card.appendChild(row);
    return card;
  }

  /* 练一练：本组对话句源出语境填空（目标限已学词，5 题封顶；可出题数为 0 时不显示入口）。
     判分回写目标词卡 SRS，不新建卡。 */
  const clozeItems = Cloze.pick(
    Cloze.itemsFromDialogue(dial, currentLevel(), store.state.srs),
    store.state.srs, todayStr, 5);
  const practice = Cloze.practiceCard(clozeItems, {
    micro: 'HÖREN · ÜBEN',
    desc: '用本组对话里学过的词做语境填空，共 ' + clozeItems.length + ' 题。',
    scopeLabel: dial.title
  });
  if (practice) v.appendChild(practice);

  show();
  return v;
}

/* ---------- 听写强化页 ---------- */

function dictationPage() {
  const s = store.state, todayStr = today();
  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('p', 'micro', 'DIKTAT · 听力'));
  v.appendChild(UI.el('h1', 'page-title', '听写强化'));

  const queue = pickDictationQueue(wordsOfLevel(currentLevel()), s.srs, todayStr, DICTATION_LIMIT);
  if (!queue.length) {
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '还没有可以听写的词。先去学几个新词，明天就能听写了。'));
    const b = UI.el('button', 'btn', '去学新词');
    b.onclick = function () { location.hash = '#/learn'; };
    e.appendChild(b);
    const back = UI.el('button', 'btn btn-ghost', '回听力首页');
    back.style.marginLeft = '10px';
    back.onclick = function () { location.hash = '#/listen'; };
    e.appendChild(back);
    v.appendChild(e);
    return v;
  }

  v.appendChild(UI.el('p', 'page-sub', queue.length + ' 个词 · 听音频拼写，答错的词隔 3 题再出现一次（最多 2 轮）。'));

  let idx = 0, right = 0, answeredCount = 0;
  const rq = makeRequeue(2);    // 错词再练队列，复用词汇复习的节奏
  const wrongList = [];
  const dots = UI.el('div', 'progress-dots');
  queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
  v.appendChild(dots);
  const stage = UI.el('div');
  v.appendChild(stage);

  function show(w, isRetry) {
    stage.innerHTML = '';
    dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
    const card = UI.el('div', 'card');
    const play = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
    play.onclick = function () { audio.playWord(w.id, w.de); };
    card.appendChild(play);
    const slow = slowBtn(w.de, w.id);
    slow.style.marginLeft = '6px';
    card.appendChild(slow);
    audio.playWord(w.id, w.de);

    const prompt = UI.el('div', 'quiz-prompt');
    prompt.innerHTML = '听音频，拼写出这个词' + (/^(der|die|das) /.test(w.de) ? '（含冠词，如 der Tag）' : '') +
      '<br><input id="cloze-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="de" placeholder="输入德语单词">';
    card.appendChild(prompt);
    card.appendChild(UI.el('p', 'stat-label', '输入时可不带冠词；ä 可输 ae，ö 输 oe，ü 输 ue，ß 输 ss'));

    const fb = UI.el('div');
    const next = UI.el('button', 'btn', '下一个');
    next.style.display = 'none';
    const check = UI.el('button', 'btn btn-sm', '检查答案');
    check.style.cssText = 'margin-top:12px;display:block';
    let attempts = 0, done = false;

    function reveal() {
      audio.playWord(w.id, w.de);
      check.disabled = true;
      next.style.display = 'inline-block';
      next.focus();
    }
    function correct() {
      right++;
      store.touchToday('reviewed', 1);
      store.touchToday('correct', 1);
      const c = s.srs[w.id];
      if (c && !c.sealed) SRS.review(c, 2, todayStr);
      store.save();
      if (s.mistakes[w.id]) store.removeMistake(w.id);
      fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh) + '</div>';
      reveal();
    }
    function wrongFn() {
      store.touchToday('reviewed', 1);
      const c = s.srs[w.id];
      if (c && !c.sealed) SRS.review(c, 0, todayStr);
      store.save();
      // 再练轮不重复记错题/错词清单
      if (!isRetry) {
        store.addMistake('vocab', w.id);
        if (wrongList.indexOf(w) === -1) wrongList.push(w);
      }
      rq.push(w);
      fb.innerHTML = '<div class="feedback bad">再记一次：' + UI.esc(w.de) + ' —— ' + UI.esc(w.zh) + '</div>';
      reveal();
    }

    check.onclick = function () {
      if (done) return;
      const input = document.getElementById('cloze-input');
      if (!input || !input.value.trim()) { if (input) input.focus(); return; }
      if (SRS.matches(input.value, w.de)) {
        done = true;
        input.disabled = true;
        correct();
      } else if (attempts === 0) {
        // 错 1：只露首字母
        attempts++;
        fb.innerHTML = '<div class="feedback">提示：' + UI.esc(maskWord(w.de)) + '（再试一次）</div>';
        input.value = ''; input.focus();
      } else if (attempts === 1) {
        // 错 2：露前半
        attempts++;
        fb.innerHTML = '<div class="feedback">提示：' + UI.esc(maskWordHalf(w.de)) + '（再试一次）</div>';
        input.value = ''; input.focus();
      } else {
        // 错 3：给出完整答案并判错
        done = true;
        input.disabled = true;
        wrongFn();
      }
    };
    card.onkeydown = function (ev) {
      if (ev.key !== 'Enter') return;
      if (done) next.click(); else check.click();
    };
    next.onclick = advance;

    card.appendChild(check);
    card.appendChild(fb);
    card.appendChild(next);
    stage.appendChild(card);
    const inp = document.getElementById('cloze-input');
    if (inp) inp.focus();
  }

  function advance() {
    answeredCount++;
    const rw = rq.take(answeredCount);   // 每答完 3 题复现一个错词
    if (rw) { show(rw, true); return; }
    idx++;
    if (idx < queue.length) show(queue[idx], false);
    else drainQueue();
  }

  function drainQueue() {
    const rw = rq.drain();
    if (!rw) { finish(); return; }
    show(rw, true);
  }

  function finish() {
    dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
    stage.innerHTML = '';
    const done = UI.el('div', 'card');
    done.appendChild(UI.el('div', 'result-num', right + ' / ' + queue.length));
    done.appendChild(UI.el('p', 'stat-label', '答对 ' + right + ' 个 · 答错的词进了错题本，明天还会再见到它们。'));
    if (wrongList.length) {
      done.appendChild(UI.el('p', 'stat-label', '错词：' + wrongList.map(function (w) { return UI.esc(w.de); }).join(' · ')));
    }
    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    const again = UI.el('button', 'btn', '再练一批');
    again.onclick = function () { render(); };
    row.appendChild(again);
    const back = UI.el('button', 'btn btn-ghost', '回听力首页');
    back.onclick = function () { location.hash = '#/listen'; };
    row.appendChild(back);
    done.appendChild(row);
    stage.appendChild(done);
  }

  show(queue[0], false);
  return v;
}

/* ---------- 听力错题复习页 ---------- */

function reviewPage() {
  const s = store.state, todayStr = today();
  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('p', 'micro', 'HÖREN · WIEDERHOLUNG'));
  v.appendChild(UI.el('h1', 'page-title', '听力复习'));

  const byId = {};
  getListenDialogs().forEach(function (d) { byId[d.id] = d; });

  const all = Object.keys(s.srs).filter(function (id) {
    return !!parseDialogueCardId(id) && SRS.isDue(s.srs[id], todayStr);
  }).map(function (id) {
    const p = parseDialogueCardId(id);
    const dial = byId[p.dialogueId] || null;
    const q = (dial && dial.questions) ? dial.questions[p.qIndex] : null;
    return { id: id, dial: dial, q: q, qIndex: p.qIndex, due: s.srs[id].due };
  });
  // 对话数据缺失（内容被删）的卡跳过，不在队列里报错
  const queue = all.filter(function (x) { return x.q; })
    .sort(function (a, b) { return a.due.localeCompare(b.due); });
  const skipped = all.length - queue.length;

  if (!queue.length) {
    const empty = UI.el('div', 'card empty');
    empty.appendChild(UI.el('p', null, skipped
      ? '到期的听力卡找不到对应对话，已跳过 ' + skipped + ' 题。'
      : '今天没有到期的听力复习。做错的对话理解题会排到这里。'));
    const b = UI.el('button', 'btn', '回听力首页');
    b.onclick = function () { location.hash = '#/listen'; };
    empty.appendChild(b);
    v.appendChild(empty);
    return v;
  }

  v.appendChild(UI.el('p', 'page-sub', queue.length + ' 道听力题到期，先重听整组对话再答一次；答对会安排更久的间隔。'));

  let idx = 0, right = 0, curBar = null;
  const dots = UI.el('div', 'progress-dots');
  queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
  v.appendChild(dots);
  const stage = UI.el('div');
  v.appendChild(stage);

  function stopBar() { if (curBar) { curBar.stop(); curBar = null; } }

  function show() {
    stopBar();
    stage.innerHTML = '';
    dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
    const item = queue[idx];
    const dial = item.dial;
    const card = UI.el('div', 'card');
    const head = UI.el('div');
    head.innerHTML = '<span class="badge">听力</span> <span class="badge">' + UI.esc(dial.level || 'A1') + '</span> ' +
      UI.esc(dial.title) + (dial.theme ? ' · ' + UI.esc(dial.theme) : '');
    card.appendChild(head);
    curBar = playBar(dial, true);
    curBar.bar.style.marginTop = '12px';
    card.appendChild(curBar.bar);

    const built = renderExerciseItem(item.q, idx + 1, function (ok) {
      s.srs[item.id] = SRS.review(s.srs[item.id], ok ? 2 : 0, todayStr);
      if (ok) {
        right++;
        store.removeMistake(item.id);
      } else {
        store.addMistake('listen', item.id);
      }
      store.touchToday('reviewed', 1);
      if (ok) store.touchToday('correct', 1);
      store.save();
    }, idx < queue.length - 1 ? '下一题' : '看结果');
    built.next.onclick = function () { idx++; if (idx < queue.length) show(); else finish(); };
    card.appendChild(built.element);
    stage.appendChild(card);
    built.focus();
  }

  function finish() {
    stopBar();
    dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
    stage.innerHTML = '';
    const done = UI.el('div', 'card');
    done.appendChild(UI.el('div', 'result-num', right + ' / ' + queue.length));
    done.appendChild(UI.el('p', 'stat-label', '答对率 ' + Math.round(right / queue.length * 100) + '%'));

    const dist = {};
    queue.forEach(function (item) {
      const c = s.srs[item.id];
      if (c && c.due) dist[c.due] = (dist[c.due] || 0) + 1;
    });
    const dueList = Object.keys(dist).sort().map(function (d) { return d + '：' + dist[d] + ' 题'; }).join(' · ');
    done.appendChild(UI.el('p', 'stat-label', '下次到期分布：' + (dueList || '—')));
    if (skipped) done.appendChild(UI.el('p', 'stat-label', '另有 ' + skipped + ' 题因对话数据缺失被跳过。'));

    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    const back = UI.el('button', 'btn', '回听力首页');
    back.onclick = function () { location.hash = '#/listen'; };
    row.appendChild(back);
    const home = UI.el('button', 'btn btn-ghost', '回首页');
    home.onclick = function () { location.hash = '#/'; };
    row.appendChild(home);
    done.appendChild(row);
    stage.appendChild(done);
  }

  show();
  return v;
}

export const Listen = {
  homePage: homePage,
  dialogPage: dialogPage,
  dictationPage: dictationPage,
  reviewPage: reviewPage
};
