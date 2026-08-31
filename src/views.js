/* 页面级视图：仪表盘、设置页 */

import { UI } from './ui.js';
import { store } from './store.js';
import { today } from './storage.js';
import * as SRS from './srs.js';
import { currentLevel, wordsOfLevel, getGrammar } from './data.js';
import { TTS } from './tts.js';
import { audio } from './audio.js';
import { render } from './app.js';

/* ---------- 仪表盘 ---------- */
export function dashboard() {
  const todayStr = today();
  const s = store.state;
  const cur = currentLevel();
  const pool = wordsOfLevel(cur);
  const learned = pool.filter(function (w) { return s.srs[w.id]; }).length;
  const mastered = pool.filter(function (w) { return s.srs[w.id] && s.srs[w.id].mastered; }).length;
  const due = Object.keys(s.srs).filter(function (id) { return id.indexOf('#') === -1 && SRS.isDue(s.srs[id], todayStr); }).length;
  const grammarDue = Object.keys(s.srs).filter(function (id) { return id.indexOf('#') >= 0 && SRS.isDue(s.srs[id], todayStr); }).length;
  const t = s.daily[todayStr] || { new: 0, reviewed: 0, correct: 0 };

  const v = UI.el('div');
  v.appendChild(UI.el('h1', 'page-title', '今天'));
  v.appendChild(UI.el('p', 'page-sub', new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })));

  const card = UI.el('div', 'card');
  card.appendChild(UI.el('h3', null, '今日任务'));
  if (t.new + t.reviewed === 0 && due === 0) {
    const empty = UI.el('p', null, '还没有开始。从 10 个新词开始？');
    card.appendChild(empty);
  } else {
    card.appendChild(UI.el('p', null, '已学新词 ' + t.new + ' 个 · 已复习 ' + t.reviewed + ' 个'));
  }
  const row = UI.el('div', null);
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px';
  const bNew = UI.el('button', 'btn', '学 ' + s.settings.dailyNew + ' 个新词');
  bNew.onclick = function () { location.hash = '#/learn'; };
  row.appendChild(bNew);
  const bRev = UI.el('button', 'btn ' + (due ? '' : 'btn-ghost'), due ? '复习 ' + due + ' 个到期词' : '没有到期复习');
  bRev.disabled = !due;
  bRev.onclick = function () { location.hash = '#/review'; };
  row.appendChild(bRev);
  card.appendChild(row);

  const gRow = UI.el('div', null);
  gRow.style.cssText = 'margin-top:10px';
  const bGram = UI.el('button', 'btn btn-sm ' + (grammarDue ? '' : 'btn-ghost'), grammarDue ? '语法复习 ' + grammarDue + ' 题' : '无到期语法复习');
  bGram.disabled = !grammarDue;
  bGram.onclick = function () { location.hash = '#/review-grammar'; };
  gRow.appendChild(bGram);
  card.appendChild(gRow);

  v.appendChild(card);

  const stats = UI.el('div', 'grid grid-3');
  [['已学 / ' + cur + ' 词量', learned + ' / ' + pool.length], ['已掌握', mastered], ['连续打卡', s.streak.count + ' 天']].forEach(function (x) {
    const c = UI.el('div', 'card');
    c.appendChild(UI.el('div', 'stat-num', String(x[1])));
    c.appendChild(UI.el('div', 'stat-label', x[0]));
    stats.appendChild(c);
  });
  v.appendChild(stats);

  const pc = Math.round(learned / pool.length * 100) || 0;
  const prog = UI.el('div', 'card');
  prog.appendChild(UI.el('h3', null, cur + ' 词汇进度'));
  const bar = UI.el('div', 'bar');
  const fill = UI.el('div', 'bar-fill'); fill.style.width = pc + '%';
  bar.appendChild(fill); prog.appendChild(bar);
  prog.appendChild(UI.el('p', 'stat-label', pc + '%（' + learned + ' / ' + pool.length + '）'));
  v.appendChild(prog);

  // 连胜日历（最近 5 周）+ 冻结券
  const cal = UI.el('div', 'card');
  cal.appendChild(UI.el('h3', null, '连胜 ' + s.streak.count + ' 天 · 冻结券 × ' + (s.streak.freezes || 0)));
  cal.appendChild(UI.el('p', 'stat-label', '漏卡一天会自动用冻结券保住连胜（每满 7 天补 1 张，最多 2 张）。'));
  const grid = UI.el('div', 'cal-grid');
  const protectedDays = {};
  (s.streak.protected || []).forEach(function (d) { protectedDays[d] = 1; });
  // 从上周日开始排 35 格
  const start = new Date(); start.setDate(start.getDate() - 6 - start.getDay());
  for (let ci = 0; ci < 35; ci++) {
    const day = new Date(start); day.setDate(start.getDate() + ci);
    const key = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    const cell = UI.el('div', 'cal-cell');
    if (s.daily[key] && (s.daily[key].new + s.daily[key].reviewed) > 0) cell.classList.add('cal-on');
    else if (protectedDays[key]) { cell.classList.add('cal-protected'); cell.title = '冻结券保住'; }
    if (key === todayStr) cell.classList.add('cal-today');
    cell.title = cell.title || key;
    grid.appendChild(cell);
  }
  cal.appendChild(grid);
  cal.appendChild(UI.el('p', 'stat-label', '■ 已学习 · ▨ 冻结保护 · □ 空缺'));
  v.appendChild(cal);

  // 成就
  const ach = UI.el('div', 'card');
  ach.appendChild(UI.el('h3', null, '成就'));
  let totalReviewed = 0;
  Object.keys(s.daily).forEach(function (k) { totalReviewed += (s.daily[k].reviewed || 0); });
  const topicsDone = Object.keys(s.grammarDone).length;
  const grammarCount = getGrammar().length;
  const ACHV = [
    ['第一个单词', learned >= 1],
    [cur + ' 词汇 50', learned >= 50],
    [cur + ' 词汇 200', learned >= 200],
    [cur + ' 全词汇', learned >= pool.length],
    ['连续 3 天', s.streak.count >= 3],
    ['连续 7 天', s.streak.count >= 7],
    ['连续 30 天', s.streak.count >= 30],
    ['语法第一课', topicsDone >= 1],
    ['语法过半', topicsDone >= Math.ceil(grammarCount / 2)],
    ['语法全通', topicsDone >= grammarCount],
    ['复习 100 题', totalReviewed >= 100]
  ];
  const rowAch = UI.el('div', null);
  rowAch.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
  ACHV.forEach(function (a) {
    const b = UI.el('span', 'badge' + (a[1] ? ' badge-on' : ''), a[0]);
    if (!a[1]) b.style.opacity = '.45';
    rowAch.appendChild(b);
  });
  ach.appendChild(rowAch);
  v.appendChild(ach);
  return v;
}

/* ---------- 设置 ---------- */
export function settingsPage() {
  const s = store.state;
  const v = UI.el('div');
  v.appendChild(UI.el('h1', 'page-title', '设置'));

  const c1 = UI.el('div', 'card');
  const r1 = UI.el('div', 'setting-row');
  r1.appendChild(UI.el('label', null, '每天学习新词数量'));
  const num = UI.el('input'); num.type = 'number'; num.min = 5; num.max = 30; num.value = s.settings.dailyNew;
  num.onchange = function () {
    s.settings.dailyNew = Math.max(5, Math.min(30, parseInt(num.value, 10) || 10));
    num.value = s.settings.dailyNew; store.save();
  };
  r1.appendChild(num); c1.appendChild(r1);

  const r2 = UI.el('div', 'setting-row');
  r2.appendChild(UI.el('label', null, '朗读语速'));
  const sel = UI.el('select');
  [['0.75', '慢速（0.75x）'], ['1', '正常（1x）'], ['0.9', '稍慢（0.9x）']].forEach(function (o) {
    const op = UI.el('option', null, o[1]); op.value = o[0]; sel.appendChild(op);
  });
  sel.value = String(s.settings.ttsRate);
  if (!sel.value) sel.value = '1';
  sel.onchange = function () { s.settings.ttsRate = parseFloat(sel.value); TTS.setRate(s.settings.ttsRate); audio.setRate(s.settings.ttsRate); store.save(); };
  r2.appendChild(sel); c1.appendChild(r2);

  if (!TTS.available()) {
    c1.appendChild(UI.el('p', 'stat-label', '当前浏览器不支持语音朗读，建议使用 Chrome 或 Edge。'));
  }
  v.appendChild(c1);

  const c2 = UI.el('div', 'card');
  c2.appendChild(UI.el('h3', null, '数据备份'));
  c2.appendChild(UI.el('p', 'stat-label', '学习进度保存在本浏览器中。换电脑或清缓存前，请先导出备份。'));
  const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
  const bExp = UI.el('button', 'btn btn-ghost btn-sm', '导出进度（JSON）');
  bExp.onclick = function () {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'de-learn-backup-' + today() + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  };
  row.appendChild(bExp);
  const bImp = UI.el('button', 'btn btn-ghost btn-sm', '导入进度');
  const file = UI.el('input'); file.type = 'file'; file.accept = '.json'; file.style.display = 'none';
  bImp.onclick = function () { file.click(); };
  file.onchange = function () {
    const f = file.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = function () {
      try {
        store.replaceState(JSON.parse(fr.result));
        alert('导入成功。');
        render();
      } catch (e) { alert('导入失败：文件不是有效的备份 JSON。'); }
    };
    fr.readAsText(f);
  };
  row.appendChild(bImp); row.appendChild(file);
  c2.appendChild(row);
  v.appendChild(c2);

  const c3 = UI.el('div', 'card');
  c3.appendChild(UI.el('h3', null, '重置'));
  c3.appendChild(UI.el('p', 'stat-label', '清空全部学习进度、错题本和打卡记录，不可恢复。'));
  const bReset = UI.el('button', 'btn btn-sm', '重置全部进度');
  bReset.style.background = 'var(--f)'; bReset.style.borderColor = 'var(--f)';
  bReset.onclick = function () {
    if (confirm('确定要清空全部学习进度吗？此操作不可恢复。')) {
      store.reset(); render();
    }
  };
  c3.appendChild(bReset);
  v.appendChild(c3);
  return v;
}
