/* 页面级视图：仪表盘、设置页 */

import { UI } from './ui.js';
import { store } from './store.js';
import { today } from './storage.js';
import {
  backupFilename, exportProgress, parseBackup, readFileText, applyImport, mergePreview,
  summarizeState, shouldRemindBackup, daysSinceExport, snoozeUntil, formatBytes
} from './backup.js';
import * as SRS from './srs.js';
import { currentLevel, wordsOfLevel, getGrammar, isGrammarCardId, isListenCardId } from './data.js';
import { TTS } from './tts.js';
import { audio } from './audio.js';
import { render } from './app.js';

// 卡 id 谓词由 data.js 单点定义，这里再导出供测试与其他模块引用
export { isGrammarCardId, isListenCardId };

/* ---------- 仪表盘 ---------- */
export function dashboard() {
  const todayStr = today();
  const s = store.state;
  const cur = currentLevel();
  const pool = wordsOfLevel(cur);
  const learned = pool.filter(function (w) { return s.srs[w.id]; }).length;
  const mastered = pool.filter(function (w) { return s.srs[w.id] && s.srs[w.id].mastered; }).length;
  const due = Object.keys(s.srs).filter(function (id) { return id.indexOf('#') === -1 && SRS.isDue(s.srs[id], todayStr); }).length;
  const grammarDue = Object.keys(s.srs).filter(function (id) { return isGrammarCardId(id) && SRS.isDue(s.srs[id], todayStr); }).length;
  const listenDue = Object.keys(s.srs).filter(function (id) { return isListenCardId(id) && SRS.isDue(s.srs[id], todayStr); }).length;
  const t = s.daily[todayStr] || { new: 0, reviewed: 0, correct: 0 };

  const v = UI.el('div');
  // 刊头：打字机德语日期 + 衬线大标题
  const deDate = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  v.appendChild(UI.el('p', 'micro', deDate + ' · Tagesausgabe'));
  v.appendChild(UI.el('h1', 'page-title', '今日'));
  v.appendChild(UI.el('p', 'page-sub', new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })));

  const hero = UI.el('img', 'hero-zine');
  hero.src = 'images/zine/hero.png';
  hero.alt = '德语学习志 · 今日刊头插画';
  hero.loading = 'lazy';
  v.appendChild(hero);

  // 本期导读（今日任务）
  const card = UI.el('div', 'card');
  card.appendChild(UI.el('p', 'micro', 'INHALT · 本期导读'));
  card.appendChild(UI.el('h3', null, '今日任务'));
  if (t.new + t.reviewed === 0 && due === 0) {
    card.appendChild(UI.el('p', null, '还没有开始。从 ' + s.settings.dailyNew + ' 个新词开始？'));
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
  const lRow = UI.el('div', null);
  lRow.style.cssText = 'margin-top:10px';
  const bListen = UI.el('button', 'btn btn-sm ' + (listenDue ? '' : 'btn-ghost'), listenDue ? '听力复习 ' + listenDue + ' 题' : '无到期听力复习');
  bListen.disabled = !listenDue;
  bListen.onclick = function () { location.hash = '#/listen-review'; };
  lRow.appendChild(bListen);
  card.appendChild(lRow);
  const remain = pool.filter(function (w) { return !s.srs[w.id]; }).length;
  card.appendChild(UI.el('p', 'stat-label', remain === 0
    ? '本级词已全部学过了'
    : '按每天 ' + s.settings.dailyNew + ' 个新词，预计 ' + Math.ceil(remain / s.settings.dailyNew) + ' 天学完本级剩余 ' + remain + ' 个词'));
  v.appendChild(card);

  // 备份提醒：一行克制提示 + 两个按钮（导出 / 推迟）。不弹窗、不阻塞，可关。
  const remind = shouldRemindBackup(s, s.settings && s.settings.lastExport);
  if (remind) {
    const rRow = UI.el('div', 'notice');
    rRow.appendChild(UI.el('span', null, remind.never
      ? '还没有导出过学习进度。换设备、清缓存或系统自动清理都会丢掉它。'
      : '距上次导出已经 ' + remind.days + ' 天。浏览器长期不访问可能清掉学习记录。'));
    const rBtns = UI.el('span');
    rBtns.style.cssText = 'display:flex;gap:8px;flex-shrink:0';
    const bGo = UI.el('button', 'btn btn-sm', '导出学习进度');
    bGo.onclick = function () {
      const r = exportProgress(store.state);
      // 无论成功失败都跳到设置页并给出可读结果（导出按钮在那里有完整文案）
      store._pendingNotice = r.ok
        ? '已导出 ' + r.filename + '。请把这个文件保存到浏览器之外（网盘 / 发给自己）。'
        : '导出失败：' + r.error;
      store._pendingNoticeKind = r.ok ? 'ok' : 'bad';
      location.hash = '#/settings';
      render();
    };
    rBtns.appendChild(bGo);
    const bLater = UI.el('button', 'btn btn-ghost btn-sm', '5 天后再提醒');
    bLater.onclick = function () {
      s.settings.backupSnoozeUntil = snoozeUntil(null, 5);
      store.save();
      render();
    };
    rBtns.appendChild(bLater);
    rRow.appendChild(rBtns);
    v.appendChild(rRow);
  }

  // 档案式统计栏
  const stats = UI.el('div', 'grid grid-3');
  [['已学 / ' + cur + ' 词量', learned + ' / ' + pool.length], ['已掌握', mastered], ['连续打卡', s.streak.count + ' 天']].forEach(function (x) {
    const c = UI.el('div', 'card');
    c.appendChild(UI.el('div', 'stat-num', String(x[1])));
    c.appendChild(UI.el('div', 'micro', x[0]));
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

  // 连胜日历（纸格点阵）+ 冻结券
  const cal = UI.el('div', 'card');
  const calHead = UI.el('div', 'chapter-head');
  const orn = UI.el('img', 'ornament');
  orn.src = 'images/ornaments/constellation-heart.png'; orn.alt = ''; orn.loading = 'lazy';
  calHead.appendChild(orn);
  const calTitle = UI.el('div');
  calTitle.appendChild(UI.el('h3', null, '连胜 ' + s.streak.count + ' 天 · 冻结券 × ' + (s.streak.freezes || 0)));
  calTitle.appendChild(UI.el('p', 'stat-label', '漏卡一天会自动用冻结券保住连胜（每满 7 天补 1 张，最多 2 张）。'));
  calHead.appendChild(calTitle);
  cal.appendChild(calHead);
  const grid = UI.el('div', 'cal-grid');
  const protectedDays = {};
  (s.streak.protected || []).forEach(function (d) { protectedDays[d] = 1; });
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

  // 成就（金色印章）
  const ach = UI.el('div', 'card');
  ach.appendChild(UI.el('p', 'micro', 'AUSZEICHNUNGEN · 成就'));
  let totalReviewed = 0;
  Object.keys(s.daily).forEach(function (k) { totalReviewed += (s.daily[k].reviewed || 0); });
  // grammarDone 同时记录 dc- 变格专题的完成度，成就统计只数真语法专题（M8 集成点）
  const grammarIds = {};
  getGrammar().forEach(function (g) { grammarIds[g.id] = 1; });
  const topicsDone = Object.keys(s.grammarDone).filter(function (id) { return grammarIds[id]; }).length;
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
  rowAch.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:10px';
  ACHV.forEach(function (a, i) {
    const b = UI.el('span', 'badge-seal' + (a[1] ? '' : ' locked'), a[0]);
    if (a[1]) b.style.animationDelay = (i * 30) + 'ms';
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
  v.appendChild(UI.el('p', 'micro', 'EINSTELLUNGEN'));
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

  const c0 = UI.el('div', 'card');
  c0.appendChild(UI.el('h3', null, '错题本'));
  c0.appendChild(UI.el('p', 'stat-label', '做错的词汇与语法题都收在这里，可以集中重练。'));
  const bmRow = UI.el('div', null); bmRow.style.cssText = 'margin-top:12px';
  const bMistake = UI.el('button', 'btn btn-ghost btn-sm', '打开错题本');
  bMistake.onclick = function () { location.hash = '#/mistakes'; };
  bmRow.appendChild(bMistake);
  c0.appendChild(bmRow);
  v.appendChild(c0);

  const cStat = UI.el('div', 'card');
  cStat.appendChild(UI.el('h3', null, '学习统计'));
  const sealedCount = Object.keys(s.srs).filter(function (id) { return id.indexOf('#') === -1 && s.srs[id].sealed; }).length;
  const rSeal = UI.el('div', 'setting-row');
  rSeal.appendChild(UI.el('label', null, '已斩词汇（已经很熟，永不再复习）'));
  rSeal.appendChild(UI.el('span', null, String(sealedCount)));
  cStat.appendChild(rSeal);
  v.appendChild(cStat);

  const cCredits = UI.el('div', 'card');
  cCredits.appendChild(UI.el('h3', null, '音频与音标来源'));
  cCredits.appendChild(UI.el('p', 'stat-label',
    '真人发音：Wikimedia Commons / Lingua Libre 贡献者（CC BY-SA，逐词署名见 audio/credits_native.json）。' +
    '音标：de.wiktionary.org（CC BY-SA）。合成语音：Microsoft edge-tts（个人自用）。'));
  v.appendChild(cCredits);

  const c2 = UI.el('div', 'card');
  c2.appendChild(UI.el('h3', null, '数据备份'));
  c2.appendChild(UI.el('p', 'stat-label',
    '学习进度只存在这台设备的浏览器里。iOS 与鸿蒙都会在长期不访问时清理站点数据，' +
    '导出 JSON 是唯一能把进度带走的办法。导出后请把文件存到网盘或发给自己。'));

  // 上次导出时间（如实呈现，未导出就直说）
  const lastExp = s.settings && s.settings.lastExport;
  const dSince = daysSinceExport(lastExp);
  const rExp = UI.el('div', 'setting-row');
  rExp.appendChild(UI.el('label', null, '上次导出'));
  rExp.appendChild(UI.el('span', null, lastExp
    ? lastExp + (dSince === null ? '' : '（' + dSince + ' 天前）')
    : '从未导出'));
  c2.appendChild(rExp);

  const row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
  const bExp = UI.el('button', 'btn btn-sm', '导出学习进度（下载 JSON）');
  row.appendChild(bExp);

  const bImp = UI.el('button', 'btn btn-ghost btn-sm', '选择备份文件并导入');
  const file = UI.el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
  row.appendChild(bImp); row.appendChild(file);
  c2.appendChild(row);

  const msg = UI.el('div'); msg.style.cssText = 'margin-top:12px'; msg.hidden = true;
  c2.appendChild(msg);

  function say(kind, text) {
    msg.hidden = false;
    msg.className = kind === 'bad' ? 'notice bad' : 'notice';
    msg.textContent = text;
  }
  function clearSay() { msg.hidden = true; msg.textContent = ''; }
  // 跨重渲染保留一句提示（导出后要刷新「上次导出」这一行，重渲染会清空 DOM）
  if (store._pendingNotice) {
    say(store._pendingNoticeKind === 'bad' ? 'bad' : 'ok', store._pendingNotice);
    store._pendingNotice = null;
    store._pendingNoticeKind = null;
  }

  bExp.onclick = function () {
    const r = exportProgress(store.state);
    if (!r.ok) { say('bad', r.error); return; }
    // 重新渲染以刷新「上次导出」这一行，并把成功提示带过去
    store._pendingNotice = '已导出 ' + r.filename + '。请把这个文件保存到浏览器之外（网盘 / 发给自己）。';
    render();
  };

  bImp.onclick = function () { clearSay(); file.click(); };

  // 导入：读文件 → 校验 → **二次确认** → 合并写入。
  // 任何一步失败都只显示可读原因，不碰存档。
  file.onchange = function () {
    const f = file.files && file.files[0];
    if (!f) return;
    file.value = ''; // 允许重复选同一个文件
    readFileText(f).then(function (text) {
      const res = parseBackup(text);
      if (!res.ok) {
        say('bad', '导入失败：' + res.error + ' 已取消导入，当前进度没有任何改动。');
        return;
      }
      const pv = mergePreview(store.state, res.state);
      const inc = pv.incoming;
      const lines = [
        '把「' + f.name + '」并入当前进度。确认后会发生：',
        '· 学习卡片：备份 ' + inc.srs + ' 张，现有 ' + pv.before.srs + ' 张 → 合并后 ' + pv.after.srs + ' 张（新增 ' + pv.addedCards + ' 张）',
        '· 打卡记录：备份 ' + inc.daily + ' 天，现有 ' + pv.before.daily + ' 天 → 合并后 ' + pv.after.daily + ' 天',
        '· 错题本：备份 ' + inc.mistakes + ' 条，现有 ' + pv.before.mistakes + ' 条 → 合并后 ' + pv.after.mistakes + ' 条',
        '· 语法完成 ' + inc.grammarDone + ' 个 · 听力 ' + inc.listen + ' 个 · 阅读 ' + inc.reading + ' 篇',
        '',
        '两边都有的卡片按「复习时间更晚」的一方保留；当天记录与错题次数取两边的较大值。',
        '设置（每天新词数 / 语速 / 级别）保持现在的，不会被备份改掉。',
        '当前进度不会被清空。'
      ];
      /* 被跳过的内容必须写在脸上：清洗器会丢弃无法识别的条目，
         如果这里不说，用户就只看到「导入完成」，而部分数据已经悄悄没进来。 */
      if (res.dropped && res.dropped.length) {
        lines.splice(lines.indexOf(''), 0,
          '⚠ 文件里有 ' + res.dropped.length + ' 处无法识别的内容会被跳过：' + res.dropped.join('；'));
      }
      if (!confirm(lines.join('\n'))) {
        say('ok', '已取消导入，当前进度没有任何改动。');
        return;
      }
      const out = applyImport(store.state, res.state);
      const sum = out.summary;
      store._pendingNotice = '导入完成：现有 ' + sum.srs + ' 张学习卡片、' + sum.daily +
        ' 天打卡记录、' + sum.mistakes + ' 条错题。' +
        (res.dropped && res.dropped.length
          ? '另有 ' + res.dropped.length + ' 处无法识别的记录已跳过（' + res.dropped.join('；') + '）。'
          : '');
      render();
    }).catch(function () {
      say('bad', '读取文件失败，已取消导入，当前进度没有任何改动。');
    });
  };
  v.appendChild(c2);

  const cStore = UI.el('div', 'card');
  cStore.appendChild(UI.el('h3', null, '存储状态'));
  const werr = store.writeError && store.writeError();
  if (werr) {
    cStore.appendChild(UI.el('p', 'stat-label',
      werr.kind === 'quota'
        ? '保存失败：浏览器存储配额已满，新的学习记录可能没有落盘。请先在上一张卡片导出备份，再清除本站数据或删除不用的离线缓存后重试。'
        : '保存失败：浏览器拒绝了写入。请先在上一张卡片导出备份，避免进度丢失。'));
  }
  const rPersist = UI.el('div', 'setting-row');
  rPersist.appendChild(UI.el('label', null, '持久化存储'));
  rPersist.appendChild(UI.el('span', null,
    store.persistGranted === null
      ? '当前环境不支持查询（不影响使用，但请定期导出备份）'
      : (store.persistGranted
        ? '已授予：浏览器不会因空间不足自动清理本站数据'
        : '未授予：系统仍可能在空间紧张或长期不访问时清理本站数据，请定期导出备份')));
  cStore.appendChild(rPersist);
  if (store.persistInfo) {
    const rQuota = UI.el('div', 'setting-row');
    rQuota.appendChild(UI.el('label', null, '已用 / 配额'));
    rQuota.appendChild(UI.el('span', null,
      formatBytes(store.persistInfo.usage) + ' / ' + formatBytes(store.persistInfo.quota)));
    cStore.appendChild(rQuota);
  }
  if (store.persistGranted !== true) {
    cStore.appendChild(UI.el('p', 'stat-label',
      'iPhone / iPad：只有通过「分享 → 添加到主屏幕」并以独立窗口打开（iOS 26 起保持「Open as Web App」打开），' +
      '存储才会免于 7 天自动清理。仅加书签不生效。'));
  }
  v.appendChild(cStore);

  const c3 = UI.el('div', 'card');
  c3.appendChild(UI.el('h3', null, '重置'));
  c3.appendChild(UI.el('p', 'stat-label', '清空全部学习进度、错题本和打卡记录，不可恢复。'));
  const bReset = UI.el('button', 'btn btn-sm', '重置全部进度');
  bReset.style.background = 'var(--f)'; bReset.style.borderColor = 'var(--f)';
  bReset.onclick = function () {
    if (confirm('确定要清空全部学习进度吗？此操作不可恢复。\n建议先「导出学习进度」留一份备份。')) {
      store.reset(); render();
    }
  };
  c3.appendChild(bReset);
  v.appendChild(c3);

  const foot = UI.el('img', 'ornament');
  foot.src = 'images/zine/settings-foot.png'; foot.alt = ''; foot.loading = 'lazy';
  foot.style.cssText = 'width:120px;margin:24px auto 0;opacity:.9';
  v.appendChild(foot);
  return v;
}
