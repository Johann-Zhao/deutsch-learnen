/* 变格/词尾专项训练（S9 M8）：列表页 + 专题练习页。
   数据 window.DECLENSION（data/declension.js；index.html 的静态加载标签由 M9 加入，
   缺失时一律按空数组处理并显示空状态）。
   答题流复用 Grammar 的 renderExerciseItem；错题与复习复用语法机制：
   卡 id dc-{topicId}#{exerciseIndex}（isGrammarCardId 天然命中语法复习队列），
   完成记录复用 state.grammarDone（键为 dc- 专题 id，不混入语法专题统计）。 */

import { store } from './store.js';
import { today } from './storage.js';
import * as SRS from './srs.js';
import { UI } from './ui.js';
import { renderExerciseItem } from './grammar.js';

export function getDeclension() {
  return (typeof window !== 'undefined' && window.DECLENSION) || [];
}

export function declTopicById(id) {
  return getDeclension().find(function (t) { return t.id === id; }) || null;
}

function listPage() {
  const s = store.state;
  const topics = getDeclension();
  const v = UI.el('div');
  const head = UI.el('div', 'chapter-head');
  const win = UI.el('img', 'ornament');
  win.src = 'images/ornaments/gothic-window.png'; win.alt = ''; win.loading = 'lazy';
  head.appendChild(win);
  const headTxt = UI.el('div');
  headTxt.appendChild(UI.el('p', 'micro', 'DEKLINATION · 词尾专项'));
  head.appendChild(headTxt);
  v.appendChild(head);
  const hero = UI.el('img', 'hero-zine');
  hero.src = 'images/zine/grammar-head.png'; hero.alt = '变格训练刊头插画'; hero.loading = 'lazy';
  v.appendChild(hero);
  v.appendChild(UI.el('h1', 'page-title', '变格训练'));
  v.appendChild(UI.el('p', 'page-sub', topics.length
    ? topics.length + ' 个专题，专攻冠词、代词、形容词、名词的词尾选择。答错自动进语法复习队列。'
    : '冠词、代词、形容词、名词词尾的专项选择训练。'));

  if (!topics.length) {
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '变格训练内容建设中，敬请期待。'));
    const b = UI.el('button', 'btn', '回到语法');
    b.onclick = function () { location.hash = '#/grammar'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }

  topics.forEach(function (t) {
    const done = s.grammarDone[t.id];
    const a = UI.el('a', 'topic-item');
    a.href = '#/declension/' + t.id;
    const name = UI.el('div', 't-name', UI.esc(t.title));
    name.appendChild(UI.el('span', 'badge', t.level || 'A1'));
    if (done) name.appendChild(UI.el('span', 'badge badge-on', '最佳 ' + done + '/' + t.exercises.length));
    a.appendChild(name);
    a.appendChild(UI.el('div', 't-desc', UI.esc(t.summary)));
    v.appendChild(a);
  });
  return v;
}

function topicPage(id) {
  const topic = declTopicById(id);
  const todayStr = today();
  const v = UI.el('div');
  if (!topic) {
    v.appendChild(UI.el('p', 'micro', 'DEKLINATION'));
    v.appendChild(UI.el('h1', 'page-title', '找不到这个变格专题'));
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '这个专题暂时没有内容（可能还未生成）。'));
    const b = UI.el('button', 'btn', '回到变格列表');
    b.onclick = function () { location.hash = '#/declension'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }
  v.appendChild(UI.el('p', 'micro', 'DEKLINATION · ' + (topic.level || 'A1') + ' · ' + topic.id.toUpperCase()));
  v.appendChild(UI.el('h1', 'page-title', UI.esc(topic.title)));
  v.appendChild(UI.el('p', 'page-sub', UI.esc(topic.summary)));

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
          store.addMistake('declension', mid);
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
      const msg = right === topic.exercises.length ? '全对！这个词尾专题可以放心了。' :
        '答对 ' + right + ' 题。做错的题进错题本，也会自动排进语法复习。';
      done.appendChild(UI.el('p', 'stat-label', msg));
      const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
      const redo = UI.el('button', 'btn', '再做一遍');
      redo.onclick = function () { runExercises(); };
      row.appendChild(redo);
      const back = UI.el('button', 'btn btn-ghost', '回到变格列表');
      back.onclick = function () { location.hash = '#/declension'; };
      row.appendChild(back);
      done.appendChild(row);
      box.appendChild(done);
    }
    show();
  }
  return v;
}

export const Declension = { listPage: listPage, topicPage: topicPage };
