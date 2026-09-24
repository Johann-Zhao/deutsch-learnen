/* 语法模块：专题列表、讲解页、交互练习与判分（含错题本 Mistakes） */

import { store } from './store.js';
import { today } from './storage.js';
import * as SRS from './srs.js';
import { UI } from './ui.js';
import {
  getGrammar, grammarLevels, themeLevels, getListenDialogs,
  loadLevelData, isLevelLoaded, inferLevelFromId, grammarOfLevel, wordById, isGrammarCardId
} from './data.js';
import { Vocab } from './vocabulary.js';
import { render } from './app.js';

/* 变格专项（S9 M8）：dc- 题目的数据读取。DECLENSION 由 index.html 静态加载
   （M9 加标签），缺失时按空数组处理——到期 dc- 卡因解析不到题目被过滤，不报错。 */
function getDeclension() {
  return (typeof window !== 'undefined' && window.DECLENSION) || [];
}

// 复习/错题共用的题目解析：g- 前缀查 GRAMMAR，dc- 前缀查 DECLENSION
function findGrammarLikeExercise(topicId, idx) {
  const g = getGrammar().find(function (t) { return t.id === topicId; });
  const src = g || getDeclension().find(function (t) { return t.id === topicId; });
  return src ? src.exercises[idx] || null : null;
}

// 渲染单道语法题（choice/fill），供专题练习与语法复习共用
// onAnswer(ok) 在答题后被调用；nextText 为下一题按钮文案
// 听力对话理解题（同为 choice 型）也复用本函数，保证答题版式与 a11y 一致
export function renderExerciseItem(ex, number, onAnswer, nextText) {
  const item = UI.el('div');
  item.appendChild(UI.el('div', 'quiz-prompt', '第 ' + number + ' 题：' + UI.esc(ex.q)));
  const fb = UI.el('div');
  const next = UI.el('button', 'btn', nextText);
  next.style.display = 'none';
  let answered = false;
  let input;

  function finishAnswer(ok) {
    if (answered) return;
    answered = true;
    onAnswer(ok);
    fb.innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'bad') + '">' +
      (ok ? '正确 · ' : '不对。') + UI.esc(ex.tip || '') + '</div>';
    next.style.display = 'inline-block';
    next.focus();
  }

  if (ex.type === 'choice') {
    const opts = UI.el('div', 'opts');
    ex.opts.forEach(function (text, i) {
      const b = UI.el('button', 'opt', UI.esc(text));
      b.onclick = function () {
        if (answered) return;
        if (i === ex.a) { b.classList.add('correct'); finishAnswer(true); }
        else { b.classList.add('wrong'); opts.children[ex.a].classList.add('correct'); finishAnswer(false); }
      };
      opts.appendChild(b);
    });
    item.appendChild(opts);
  } else {
    input = UI.el('input');
    input.type = 'text'; input.autocomplete = 'off';
    input.className = 'spell-input';
    input.placeholder = '输入答案（不区分大小写）';
    item.appendChild(input);
    const check = UI.el('button', 'btn btn-sm', '检查答案');
    check.style.cssText = 'margin-top:12px;margin-left:0;display:block';
    check.onclick = function () {
      if (answered) return;
      if (!input.value.trim()) { input.focus(); return; }
      const ok = SRS.matches(input.value, ex.a);
      input.disabled = true;
      finishAnswer(ok);
      if (!ok) input.style.borderColor = 'var(--bad)';
    };
    input.onkeydown = function (ev) { if (ev.key === 'Enter') { answered ? next.click() : check.click(); } };
    item.appendChild(check);
  }

  item.appendChild(fb);
  item.appendChild(next);
  return { element: item, next: next, focus: function () { if (input) input.focus(); } };
}

function listPage() {
  const s = store.state;
  const lv = currentLevelFromStore();
  const topics = grammarOfLevel(lv);
  const v = UI.el('div');
  const head = UI.el('div', 'chapter-head');
  const win = UI.el('img', 'ornament');
  win.src = 'images/ornaments/gothic-window.png'; win.alt = ''; win.loading = 'lazy';
  head.appendChild(win);
  const headTxt = UI.el('div');
  headTxt.appendChild(UI.el('p', 'micro', 'GRAMMATIK · ' + lv));
  head.appendChild(headTxt);
  v.appendChild(head);
  const hero = UI.el('img', 'hero-zine');
  hero.src = 'images/zine/grammar-head.png'; hero.alt = '语法章节刊头插画'; hero.loading = 'lazy';
  v.appendChild(hero);
  v.appendChild(UI.el('h1', 'page-title', '语法 · ' + lv));
  v.appendChild(UI.el('p', 'page-sub', topics.length + ' 个 ' + lv + ' 专题，每个专题 = 讲解 + 交互练习。做错的题会进入错题本。'));

  // S9 M8：变格/词尾专项训练入口（置顶专项卡；数据缺失时显示建设中，仍可进入空状态页）
  const dc = getDeclension();
  const dcCard = UI.el('a', 'card dc-entry');
  dcCard.href = '#/declension';
  dcCard.appendChild(UI.el('p', 'micro', 'DEKLINATION · 变格专项'));
  const dcHead = UI.el('h3', null, '变格训练');
  dcHead.appendChild(UI.el('span', 'badge', dc.length ? dc.length + ' 专题' : '建设中'));
  dcCard.appendChild(dcHead);
  const dcDone = dc.filter(function (t) { return s.grammarDone[t.id]; }).length;
  dcCard.appendChild(UI.el('p', 'stat-label', dc.length
    ? '冠词、代词、形容词、名词的词尾选择专项——可训练的词尾模块。已完成 ' + dcDone + ' / ' + dc.length + ' 专题。'
    : '冠词、代词、形容词、名词的词尾选择专项，内容建设中。'));
  if (dc.length) {
    const dcRow = UI.el('div', 'dc-badges');
    dc.forEach(function (t) {
      const done = s.grammarDone[t.id];
      const b = UI.el('span', 'badge' + (done ? ' badge-on' : ''));
      b.textContent = t.title + (done ? ' ' + done + '/' + t.exercises.length : '');
      dcRow.appendChild(b);
    });
    dcCard.appendChild(dcRow);
  }
  v.appendChild(dcCard);

  topics.forEach(function (t) {
    const done = s.grammarDone[t.id];
    const a = UI.el('a', 'topic-item');
    a.href = '#/topic/' + t.id;
    a.innerHTML = '<div class="t-name">' + UI.esc(t.title) +
      (done ? ' <span class="badge">最佳 ' + done + '/' + t.exercises.length + '</span>' : '') + '</div>' +
      '<div class="t-desc">' + UI.esc(t.summary) + '</div>';
    v.appendChild(a);
  });
  return v;
}

function currentLevelFromStore() {
  return store.state.settings.level || 'A1';
}

function topicPage(id) {
  const topic = getGrammar().find(function (t) { return t.id === id; });
  const todayStr = today();
  const v = UI.el('div');
  if (!topic) {
    // 跨级别防御：若专题属于尚未加载的级别，先懒加载
    const lv = grammarLevels[id] || inferLevelFromId(id);
    if (lv && lv !== 'A1' && !isLevelLoaded(lv)) {
      const loading = UI.el('div', 'card', '<p>加载 ' + lv + ' 语法数据...</p>');
      loadLevelData(lv).then(function () { render(); }).catch(function (e) {
        console.error(e);
        loading.innerHTML = '<p>加载失败，请重试。</p>';
      });
      return loading;
    }
    location.hash = '#/grammar';
    return v;
  }
  v.appendChild(UI.el('p', 'micro', 'KAPITEL · ' + (topic.level || 'A1') + ' · ' + topic.id.toUpperCase()));
  v.appendChild(UI.el('h1', 'page-title', UI.esc(topic.title)));
  v.appendChild(UI.el('p', 'page-sub', UI.esc(topic.summary)));

  const lesson = UI.el('div', 'card lesson sheet');
  lesson.innerHTML = topic.lesson;
  v.appendChild(lesson);

  const sec = UI.el('div', 'card');
  sec.appendChild(UI.el('h3', null, '练习（' + topic.exercises.length + ' 题）'));
  const startRow = UI.el('div', null); startRow.style.marginTop = '12px';
  const startBtn = UI.el('button', 'btn', '开始练习');
  const stage = UI.el('div');
  startBtn.onclick = function () { startBtn.style.display = 'none'; runExercises(); };
  startRow.appendChild(startBtn);
  sec.appendChild(startRow);
  sec.appendChild(stage);
  v.appendChild(sec);

  function runExercises() {
    let idx = 0, right = 0;
    const dots = UI.el('div', 'progress-dots');
    topic.exercises.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    stage.innerHTML = '';
    stage.appendChild(dots);
    const box = UI.el('div');
    stage.appendChild(box);

    function show() {
      box.innerHTML = '';
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
      const ex = topic.exercises[idx];

      function onAnswer(ok) {
        const mid = topic.id + '#' + idx;
        // 无论对错都进入 FSRS 调度，卡片 id 复用错题 key 格式
        store.state.srs[mid] = SRS.review(store.state.srs[mid] || null, ok ? 2 : 0, todayStr);
        if (ok) {
          right++;
          store.removeMistake(mid);
        } else {
          store.addMistake('grammar', mid);
        }
        store.save();
      }

      const built = renderExerciseItem(ex, idx + 1, onAnswer, idx < topic.exercises.length - 1 ? '下一题' : '看结果');
      built.next.onclick = function () { idx++; if (idx < topic.exercises.length) show(); else finish(); };
      box.appendChild(built.element);
      built.focus();
    }

    function finish() {
      dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
      const prev = store.state.grammarDone[topic.id] || 0;
      store.state.grammarDone[topic.id] = Math.max(prev, right);
      store.save();
      box.innerHTML = '';
      const done = UI.el('div');
      done.appendChild(UI.el('div', 'result-num', right + ' / ' + topic.exercises.length));
      const msg = right === topic.exercises.length ? '全对！这个专题可以放心进入下一个。' :
        '答对 ' + right + ' 题。做错的题在错题本里，建议明天再来做一遍。';
      done.appendChild(UI.el('p', 'stat-label', msg));
      const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
      const redo = UI.el('button', 'btn', '再做一遍');
      redo.onclick = function () { runExercises(); };
      row.appendChild(redo);
      const back = UI.el('button', 'btn btn-ghost', '回到语法列表');
      back.onclick = function () { location.hash = '#/grammar'; };
      row.appendChild(back);
      done.appendChild(row);
      box.appendChild(done);
    }
    show();
  }
  return v;
}

function reviewPage() {
  const s = store.state;
  const todayStr = today();
  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('h1', 'page-title', '语法复习'));

  // 跨级别防御：到期语法卡若属于未加载级别，先懒加载
  const needed = {};
  Object.keys(s.srs).forEach(function (id) {
    if (!isGrammarCardId(id) || !SRS.isDue(s.srs[id], todayStr)) return;
    const topicId = id.split('#')[0];
    const lv = grammarLevels[topicId] || inferLevelFromId(topicId);
    if (lv && lv !== 'A1' && !isLevelLoaded(lv)) needed[lv] = true;
  });
  const levels = Object.keys(needed);
  if (levels.length) {
    const loading = UI.el('div', 'card', '<p>加载语法复习数据...</p>');
    Promise.all(levels.map(loadLevelData)).then(function () { render(); }).catch(function (e) {
      console.error(e);
      loading.innerHTML = '<p>加载失败，请重试。</p>';
    });
    return loading;
  }

  // 取 store.state.srs 中到期的语法卡（g-…#n 与 dc-…#n 变格卡），按 due 升序；听力卡 listen-…#n 归听力复习页
  const queue = Object.keys(s.srs).filter(function (id) {
    return isGrammarCardId(id) && SRS.isDue(s.srs[id], todayStr);
  }).map(function (id) {
    const parts = id.split('#');
    const ex = findGrammarLikeExercise(parts[0], +parts[1]);
    return { id: id, card: s.srs[id], ex: ex, due: s.srs[id].due };
  }).filter(function (item) { return item.ex; }).sort(function (a, b) { return a.due.localeCompare(b.due); });

  if (!queue.length) {
    const empty = UI.el('div', 'card empty');
    empty.innerHTML = '<p>今天没有到期的语法复习。</p>';
    const b = UI.el('button', 'btn', '去语法专题');
    b.onclick = function () { location.hash = '#/grammar'; };
    empty.appendChild(b);
    v.appendChild(empty);
    return v;
  }

  v.appendChild(UI.el('p', 'page-sub', queue.length + ' 道语法题到期，答对会安排更久的间隔。'));

  let idx = 0, right = 0;
  const dots = UI.el('div', 'progress-dots');
  queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
  v.appendChild(dots);
  const stage = UI.el('div');
  v.appendChild(stage);

  function show() {
    stage.innerHTML = '';
    dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
    const item = queue[idx];

    function onAnswer(ok) {
      store.state.srs[item.id] = SRS.review(store.state.srs[item.id], ok ? 2 : 0, todayStr);
      if (ok) {
        right++;
        store.removeMistake(item.id);
      } else {
        store.addMistake('grammar', item.id);
      }
      store.touchToday('reviewed', 1);
      if (ok) store.touchToday('correct', 1);
      store.save();
    }

    const built = renderExerciseItem(item.ex, idx + 1, onAnswer, idx < queue.length - 1 ? '下一题' : '看结果');
    built.next.onclick = function () { idx++; if (idx < queue.length) show(); else finish(); };
    stage.appendChild(built.element);
    built.focus();
  }

  function finish() {
    dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
    stage.innerHTML = '';
    const done = UI.el('div', 'card');
    done.appendChild(UI.el('div', 'result-num', right + ' / ' + queue.length));
    const rate = Math.round(right / queue.length * 100);
    done.appendChild(UI.el('p', 'stat-label', '答对率 ' + rate + '%'));

    const dist = {};
    queue.forEach(function (item) {
      const c = s.srs[item.id];
      if (c && c.due) dist[c.due] = (dist[c.due] || 0) + 1;
    });
    const dueList = Object.keys(dist).sort().map(function (d) { return d + '：' + dist[d] + ' 题'; }).join(' · ');
    done.appendChild(UI.el('p', 'stat-label', '下次到期分布：' + (dueList || '—')));

    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    const b1 = UI.el('button', 'btn btn-ghost', '回首页');
    b1.onclick = function () { location.hash = '#/'; };
    row.appendChild(b1);
    done.appendChild(row);
    stage.appendChild(done);
  }

  show();
  return v;
}

export const Grammar = { listPage: listPage, topicPage: topicPage, reviewPage: reviewPage };

/* ---------- 错题本 ---------- */
const Mistakes = (function () {
  function page() {
    const s = store.state;
    const v = UI.el('div');
    v.appendChild(UI.el('p', 'micro', 'FEHLERBUCH'));
    v.appendChild(UI.el('h1', 'page-title', '错题本'));

    // 跨级别防御：错题若属于未加载级别，先懒加载
    const needed = {};
    Object.keys(s.mistakes).forEach(function (id) {
      const m = s.mistakes[id];
      let lv;
      if (m.type === 'vocab') {
        const dash = id.lastIndexOf('-');
        const themeId = dash > 0 ? id.substring(0, dash) : id;
        lv = themeLevels[themeId] || inferLevelFromId(themeId);
      } else if (m.type === 'listen') {
        lv = null; // 听力对话随 index.html 静态加载，不需要懒加载
      } else {
        const topicId = id.split('#')[0];
        lv = grammarLevels[topicId] || inferLevelFromId(topicId);
      }
      if (lv && lv !== 'A1' && !isLevelLoaded(lv)) needed[lv] = true;
    });
    const levels = Object.keys(needed);
    if (levels.length) {
      const loading = UI.el('div', 'card', '<p>加载错题数据...</p>');
      Promise.all(levels.map(loadLevelData)).then(function () { render(); }).catch(function (e) {
        console.error(e);
        loading.innerHTML = '<p>加载失败，请重试。</p>';
      });
      return loading;
    }

    const entries = Object.keys(s.mistakes).map(function (id) {
      return { id: id, m: s.mistakes[id] };
    });
    if (!entries.length) {
      const e = UI.el('div', 'card empty');
      e.innerHTML = '<p>还没有错题。做错了题会自动收进来，方便集中攻克。</p>';
      const art = UI.el('img', 'empty-art');
      art.src = 'images/zine/empty-mistakes.png'; art.alt = ''; art.loading = 'lazy';
      e.insertBefore(art, e.firstChild);
      const b = UI.el('button', 'btn', '去练习');
      b.onclick = function () { location.hash = '#/grammar'; };
      e.appendChild(b);
      v.appendChild(e);
      return v;
    }
    // 按错误次数排序
    entries.sort(function (a, b) { return b.m.wrong - a.m.wrong; });
    const vocabN = entries.filter(function (x) { return x.m.type === 'vocab'; }).length;
    const listenN = entries.filter(function (x) { return x.m.type === 'listen'; }).length;
    const declN = entries.filter(function (x) { return x.m.type === 'declension'; }).length;
    const gramN = entries.length - vocabN - listenN - declN;
    const countTxt = [['词汇', vocabN], ['语法', gramN], ['听力', listenN], ['变格', declN]]
      .filter(function (x) { return x[1] > 0; })
      .map(function (x) { return x[0] + ' ' + x[1]; }).join(' · ');

    const bar = UI.el('div', 'card');
    bar.appendChild(UI.el('h3', null, '共 ' + entries.length + ' 条（' + countTxt + '）'));
    const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    if (vocabN) {
      const b1 = UI.el('button', 'btn btn-sm', '重练错词');
      b1.onclick = function () { location.hash = '#/review-mistakes'; };
      row.appendChild(b1);
    }
    if (listenN) {
      const bl = UI.el('button', 'btn btn-sm', '去听力复习');
      bl.onclick = function () { location.hash = '#/listen-review'; };
      row.appendChild(bl);
    }
    const b2 = UI.el('button', 'btn btn-sm btn-ghost', '清空错题本');
    b2.onclick = function () {
      if (confirm('确定清空错题本吗？（只是移出记录，不影响学习进度）')) {
        s.mistakes = {}; store.save(); render();
      }
    };
    row.appendChild(b2);
    bar.appendChild(row);
    v.appendChild(bar);

    const list = UI.el('div', 'card');
    entries.forEach(function (x) {
      const item = UI.el('div', 'mistake-item');
      let body, redo;
      if (x.m.type === 'vocab') {
        const w = wordById(x.id);
        body = w ? Vocab.genderTag(w.g) + ' <b>' + UI.esc(w.de) + '</b> — ' + UI.esc(w.zh) : x.id;
      } else if (x.m.type === 'listen') {
        const parts = x.id.slice('listen-'.length).split('#');
        const dial = getListenDialogs().find(function (d) { return d.id === parts[0]; });
        const q = dial && dial.questions ? dial.questions[+parts[1]] : null;
        body = '<span class="badge">听力</span> ' + (dial ? UI.esc(dial.title) + '：' : '') + (q ? UI.esc(q.q) : UI.esc(x.id));
        redo = ' <a class="btn btn-ghost btn-sm" href="#/listen-review">重练</a>';
      } else if (x.m.type === 'declension') {
        const parts = x.id.split('#');
        const t = getDeclension().find(function (g) { return g.id === parts[0]; });
        const ex = t && t.exercises[+parts[1]];
        body = '<span class="badge">变格</span> ' + (t ? UI.esc(t.title) + '：' : '') + (ex ? UI.esc(ex.q) : UI.esc(x.id));
        redo = ' <a class="btn btn-ghost btn-sm" href="#/declension/' + parts[0] + '">重练</a>';
      } else {
        const parts = x.id.split('#');
        const t = getGrammar().find(function (g) { return g.id === parts[0]; });
        const ex = t && t.exercises[+parts[1]];
        body = '<span class="badge">语法</span> ' + (t ? UI.esc(t.title) + '：' : '') + (ex ? UI.esc(ex.q) : x.id);
        redo = ' <a class="btn btn-ghost btn-sm" href="#/topic/' + parts[0] + '">重练</a>';
      }
      let dueLabel = '';
      if (x.m.type !== 'vocab' && s.srs[x.id] && s.srs[x.id].due) {
        dueLabel = ' <span class="badge">下次 ' + s.srs[x.id].due + '</span>';
      }
      item.innerHTML = '<div class="m-body">' + body + '</div><span class="badge">错 ' + x.m.wrong + ' 次</span>' +
        (redo || '') + dueLabel;
      list.appendChild(item);
    });
    v.appendChild(list);
    return v;
  }
  return { page: page };
})();

export { Mistakes };
