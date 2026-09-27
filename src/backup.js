/* 学习进度导出 / 导入（纯逻辑，Node 可测试；UI 只负责触发与展示）
   背景：iOS Safari 的 ITP 会把 IndexedDB / localStorage / Service Worker 缓存在
   7 天无交互后整体清除（WebKit Bug 232302，Apple 明确「Safari 里无法获得豁免」，
   只有以 standalone 主屏 Web App 启动才豁免）；鸿蒙侧另有省电清理与 SW 缓存卡死的报告。
   → 导出/导入 JSON 是唯一能一处兜住 iOS / 鸿蒙 / Android 三端的真兜底。

   导入策略 = **合并（merge），不覆盖**：
   本应用的使用场景是「浏览器把我的存档清了，我用备份救回来」。此时用户手上已有的
   进度（可能是清除后重新学的几个词）不该被备份抹掉，备份里的旧进度也不该丢——
   两边取并集是唯一没有数据损失的策略。逐字段理由见 mergeStates 注释。 */

import { store } from './store.js';
import { emptyState, today } from './storage.js';

export const BACKUP_FORMAT = 'deutsch-lernen-progress';
export const BACKUP_VERSION = 1;

export const DAY_MS = 86400000;

/* 备份提醒阈值：距上次导出 ≥5 天（或从未导出）且已有学习数据时提示一次。
   取 5 天而不是 7 天：ITP 按「7 天无交互」清除，留 2 天余量让用户来得及导出。 */
export const BACKUP_REMIND_DAYS = 5;

export function pad2(n) { return String(n).padStart(2, '0'); }

export function dateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/* 今天（本地时区，YYYY-MM-DD） */
export function todayStr(d) { return dateStr(d || new Date()); }

/* 备份文件名：带日期，便于用户自己按时间排序留档 */
export function backupFilename(d) {
  return 'deutsch-progress-' + todayStr(d) + '.json';
}

/* 导出信封：整个 store 状态 + format / version / exportedAt
   format 与 version 是校验与未来迁移的锚点——没有它们就无法区分
   「本应用的备份」与「碰巧也是 JSON 的别的东西」。 */
export function serializeBackup(state, now) {
  const t = todayStr(now);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: t,
    app: '德语学习志',
    state: state || {}
  };
}

export function serializeBackupText(state, now) {
  return JSON.stringify(serializeBackup(state, now), null, 2);
}

/* 统计一份状态里的学习数据量（导入预览与提醒都用到；纯函数） */
export function summarizeState(state) {
  const s = state || {};
  function size(o) { return o && typeof o === 'object' ? Object.keys(o).length : 0; }
  const daily = s.daily || {};
  let days = 0;
  Object.keys(daily).forEach(function (k) {
    const d = daily[k] || {};
    if ((d.new || 0) + (d.reviewed || 0) > 0) days++;
  });
  const streak = s.streak || {};
  return {
    srs: size(s.srs),
    daily: days,
    mistakes: size(s.mistakes),
    grammarDone: size(s.grammarDone),
    listen: size(s.listen),
    reading: size(s.reading),
    streak: streak.count || 0
  };
}

/* 是否有任何值得备份的学习数据（决定要不要显示提醒、要不要提示「备份是空的」） */
export function hasLearningData(state) {
  const c = summarizeState(state);
  return (c.srs + c.daily + c.mistakes + c.grammarDone + c.listen + c.reading) > 0;
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function looksLikeState(v) {
  if (!isPlainObject(v)) return false;
  // 至少要有 settings（本应用存档的固定字段）与一个学习进度集合，
  // 否则「碰巧有 settings 键的随机 JSON」会被当成备份放进来。
  if (!isPlainObject(v.settings)) return false;
  return ['srs', 'daily', 'mistakes', 'grammarDone', 'listen', 'reading', 'streak']
    .some(function (k) { return isPlainObject(v[k]); });
}

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '数组';
  return typeof v;
}

/* 安全地把任意值转成可读文本：`String({toString:1})` 会抛 TypeError，
   而本模块的契约是「绝不抛异常」——校验器自己抛错会被上层吞成『读取文件失败』，
   把真正的原因盖掉。 */
function describe(v) {
  if (v === null || typeof v !== 'object') return String(v);
  try { return JSON.stringify(v); } catch (e) { return typeName(v); }
}

const MAP_KEYS = ['srs', 'daily', 'mistakes', 'grammarDone', 'listen', 'reading'];

/* 值形状清洗：只保留「容器里每个值都是 plain object」的条目。
   **这是 P1 修复**。只校验容器层（`srs` 是对象）远远不够——实测
   `"srs":{"zz-0":null}` 会被原样并入并**持久化**，随后设置页在 `null.sealed` 上抛错白屏，
   而导出/导入/重置三个自救入口**全在那一屏**（用户把自己唯一的出路打掉了），重载依旧崩。

   策略选择：**丢弃坏条目 + 计数上报**，而不是整份拒绝。备份模块存在的意义就是救回进度，
   因为一条坏记录拒绝整份文件，等于让用户丢掉其余几百条好数据。
   清洗保证「进入写存档那一步的每一个值都是良构的」。 */
export function sanitizeState(state) {
  const src = isPlainObject(state) ? state : {};
  const out = Object.assign({}, src);
  const dropped = [];
  MAP_KEYS.forEach(function (k) {
    if (src[k] === undefined) { delete out[k]; return; }
    if (!isPlainObject(src[k])) {
      delete out[k];
      dropped.push(k + '（整体不是对象）');
      return;
    }
    const clean = {};
    let bad = 0;
    Object.keys(src[k]).forEach(function (id) {
      if (isPlainObject(src[k][id])) clean[id] = src[k][id];
      else bad++;
    });
    if (bad) dropped.push(k + '（' + bad + ' 条值不是对象）');
    out[k] = clean;
  });
  if (src.streak !== undefined) {
    if (!isPlainObject(src.streak)) {
      delete out.streak;
      dropped.push('streak（不是对象）');
    } else if (src.streak.protected !== undefined && !Array.isArray(src.streak.protected)) {
      // protected 必须是数组（views 里对它 forEach），坏值换成空数组而不是丢掉整份 streak
      out.streak = Object.assign({}, src.streak, { protected: [] });
      dropped.push('streak.protected（不是数组）');
    }
  }
  if (out.settings !== undefined && !isPlainObject(out.settings)) {
    delete out.settings;
    dropped.push('settings（不是对象）');
  }
  return { state: out, dropped: dropped };
}

/* 是否含学习进度结构（值形状校验之后再看，只看容器类型） */
function hasProgressShape(v) {
  if (!isPlainObject(v)) return false;
  return ['srs', 'daily', 'mistakes', 'grammarDone', 'listen', 'reading', 'streak']
    .some(function (k) { return isPlainObject(v[k]); });
}

/* 校验一份备份。返回 { ok, error, data, state, summary, dropped }，**绝不抛异常**。
   设计原则：宁可给出可读的原因让用户重选文件，也不能让坏文件进到写存档那一步。 */
export function validateBackup(parsed) {
  const fail = function (msg) { return { ok: false, error: msg }; };

  if (parsed === undefined || parsed === null) return fail('文件是空的，没有可导入的内容。');
  if (typeof parsed === 'string') {
    // 允许「别人把 JSON 文本又套了一层字符串」这种导出事故
    let inner = null;
    try { inner = JSON.parse(parsed); } catch (e) {
      return fail('文件内容不是 JSON 文本。请选择由「导出学习进度」生成的 .json 文件。');
    }
    return validateBackup(inner);
  }
  if (!isPlainObject(parsed)) {
    return fail('备份的顶层必须是 JSON 对象，实际读到' + typeName(parsed) + '。请选择由「导出学习进度」生成的 .json 文件。');
  }

  // 未带 format 的裸存档（旧版设置页导出的就是裸 store.state）仍然接受——
  // 但要求它能被识别成学习进度结构，否则拒绝。
  let inner;
  if (parsed.format === undefined) {
    if (!looksLikeState(parsed) || !isPlainObject(parsed.settings)) {
      return fail('这个 JSON 里没有学习进度（缺少 srs / daily / settings 等字段）。请选择「导出学习进度」生成的文件。');
    }
    inner = parsed;
  } else {
    if (parsed.format !== BACKUP_FORMAT) {
      return fail('不是本应用的备份文件（format 是「' + describe(parsed.format) + '」，应为「' + BACKUP_FORMAT + '」）。');
    }
    const version = Number(parsed.version);
    if (!isFinite(version) || version < 1) {
      return fail('备份文件缺少有效的 version 字段，无法确认能不能安全读取。');
    }
    if (version > BACKUP_VERSION) {
      return fail('备份来自更新的版本（备份 v' + version + '，本应用支持到 v' + BACKUP_VERSION +
        '）。请先刷新页面或更新应用再导入，以免丢字段。');
    }
    if (!looksLikeState(parsed.state) || !isPlainObject(parsed.state.settings)) {
      return fail('备份文件里没有有效的 state 字段（或它不含学习进度）。文件可能已损坏。');
    }
    inner = parsed.state;
  }

  // 值形状清洗：坏值绝不能进到写存档那一步（见 sanitizeState 注释）
  const clean = sanitizeState(inner);
  if (!hasProgressShape(clean.state)) {
    return fail('备份里的学习进度内容无法识别（字段结构不完整），没有可安全导入的内容。');
  }
  return {
    ok: true, data: parsed, state: clean.state,
    summary: summarizeState(clean.state), dropped: clean.dropped
  };
}

/* 从文件文本解析并校验；parse 失败也走同一条可读错误通道 */
export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: '文件是空的，没有可导入的内容。' };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: '文件不是有效的 JSON（' + (e && e.message ? e.message : '解析失败') + '）。请确认选中的是导出得到的 .json 文件。' };
  }
  return validateBackup(parsed);
}

/* ---------- 合并 ---------- */

function maxNum(a, b) { return Math.max(Number(a) || 0, Number(b) || 0); }

function keepMaxNumEntry(cur, inc) {
  if (!isPlainObject(cur)) return inc;
  if (!isPlainObject(inc)) return cur;
  const out = Object.assign({}, cur);
  Object.keys(inc).forEach(function (k) {
    if (typeof inc[k] === 'number' && typeof out[k] === 'number') out[k] = maxNum(out[k], inc[k]);
    else if (out[k] === undefined) out[k] = inc[k];
  });
  return out;
}

/* 同一张卡两边的进度取「更靠后」的那份：
   先比 last（最后一次复习日），再比 reps（复习次数）。这样合并结果既不会让
   用户刚复习完的卡倒退，也不会丢掉备份里更长的复习历史。
   但**「已斩」是永久成就，不能跟着被丢掉**——否则已斩的卡会退回复习队列。 */
function keepAdvancedCard(cur, inc) {
  if (!isPlainObject(cur)) return inc;
  if (!isPlainObject(inc)) return cur;
  const curLast = String(cur.last || '');
  const incLast = String(inc.last || '');
  let pick;
  if (incLast > curLast) pick = inc;
  else if (incLast < curLast) pick = cur;
  // 同一天：取复习次数更多的一方（reps 可能缺失，按 0 处理）
  else pick = maxNum(inc.reps, 0) > maxNum(cur.reps, 0) ? inc : cur;

  const sealed = !!(cur.sealed || inc.sealed);
  const mastered = !!(cur.mastered || inc.mastered);
  if (!sealed && !mastered) return pick;
  const out = Object.assign({}, pick);
  if (sealed) {
    out.sealed = true;
    out.sealedAt = pick.sealedAt || cur.sealedAt || inc.sealedAt || null;
  }
  if (mastered) out.mastered = true;
  return out;
}

/* 合并两份 store 状态：cur 为当前存档（保留方），inc 为备份（并入方）。
   逐字段策略：
   - srs          并集；同 id 取更靠后的卡（见 keepAdvancedCard）
   - daily        并集；同一天各项取最大值（两边各自记过的新词/复习数都不丢）
   - mistakes     并集；同 id 错题次数取最大值（错题本只增不减，重数没有意义）
   - grammarDone  并集；同一专题取更高正确率
   - listen/reading 并集；同一对话/短文取更晚的完成日
   - streak       取 last 更晚的一份（连胜天数与冻结券跟随那份，避免把两条
                  不连续的打卡史拼成一条假的连胜）
   - settings     **完全保留当前设置**：新词量/语速/级别是设备偏好，
                  换设备导入时用备份里的值覆盖会让用户莫名其妙被改设置 */
export function mergeStates(cur, inc) {
  const base = Object.assign(emptyState(), isPlainObject(cur) ? cur : {});
  const add = isPlainObject(inc) ? inc : {};

  base.srs = Object.assign({}, base.srs);
  if (isPlainObject(add.srs)) {
    Object.keys(add.srs).forEach(function (id) {
      const merged = keepAdvancedCard(base.srs[id], add.srs[id]);
      // 只写良构的值：坏值绝不能进存档（否则页面会崩，见 sanitizeState 注释）
      if (isPlainObject(merged)) base.srs[id] = merged;
    });
  }

  base.daily = Object.assign({}, base.daily);
  if (isPlainObject(add.daily)) {
    Object.keys(add.daily).forEach(function (k) {
      base.daily[k] = keepMaxNumEntry(base.daily[k], add.daily[k]);
    });
  }

  base.mistakes = Object.assign({}, base.mistakes);
  if (isPlainObject(add.mistakes)) {
    Object.keys(add.mistakes).forEach(function (id) {
      const c = base.mistakes[id], i = add.mistakes[id];
      if (!isPlainObject(c)) { if (isPlainObject(i)) base.mistakes[id] = i; return; }
      if (!isPlainObject(i)) return;
      const out = Object.assign({}, c);
      out.wrong = maxNum(c.wrong, i.wrong);
      if (String(i.last || '') > String(out.last || '')) out.last = i.last;
      if (!out.type && i.type) out.type = i.type;
      base.mistakes[id] = out;
    });
  }

  base.grammarDone = Object.assign({}, base.grammarDone);
  if (isPlainObject(add.grammarDone)) {
    Object.keys(add.grammarDone).forEach(function (id) {
      const c = base.grammarDone[id], i = add.grammarDone[id];
      base.grammarDone[id] = maxNum(c, i);
    });
  }

  ['listen', 'reading'].forEach(function (key) {
    base[key] = Object.assign({}, base[key]);
    if (!isPlainObject(add[key])) return;
    Object.keys(add[key]).forEach(function (id) {
      const c = base[key][id], i = add[key][id];
      if (!isPlainObject(c)) { if (isPlainObject(i)) base[key][id] = i; return; }
      if (!isPlainObject(i)) return;
      const cf = String(c.finished || c.at || '');
      const inf = String(i.finished || i.at || '');
      if (inf > cf) { base[key][id] = i; return; }
      // 完成日相同则把计数取最大值，避免「读到一半」的进度被覆盖
      const out = Object.assign({}, c);
      ['right', 'total', 'added'].forEach(function (k) {
        if (typeof i[k] === 'number') out[k] = maxNum(out[k], i[k]);
      });
      base[key][id] = out;
    });
  });

  if (isPlainObject(add.streak)) {
    const cs = base.streak || {};
    const incStreak = add.streak;
    const incProt = Array.isArray(incStreak.protected) ? incStreak.protected.slice() : [];
    const curProt = Array.isArray(cs.protected) ? cs.protected : [];
    if (String(incStreak.last || '') > String(cs.last || '')) {
      base.streak = {
        last: incStreak.last || null,
        count: incStreak.count || 0,
        freezes: incStreak.freezes || 0,
        protected: incProt
      };
    } else if (!cs.protected && incProt.length) {
      base.streak = Object.assign({}, cs, { protected: incProt });
    } else if (curProt.length !== (cs.protected || []).length) {
      base.streak = Object.assign({}, cs, { protected: curProt });
    }
  }

  // settings 完全保留当前值（设备偏好），但坏值要换回空对象，避免写进存档
  if (!isPlainObject(base.settings)) base.settings = emptyState().settings;

  return base;
}

/* 产生一份「导入预览」文案数据：告诉用户这次会并入多少东西。
   纯函数，UI 只负责渲染。 */
export function mergePreview(cur, inc) {
  const before = summarizeState(cur);
  const merged = mergeStates(cur, inc);
  const after = summarizeState(merged);
  const from = summarizeState(inc);
  return {
    before: before,
    incoming: from,
    after: after,
    addedCards: after.srs - before.srs,
    addedDays: after.daily - before.daily,
    addedMistakes: after.mistakes - before.mistakes
  };
}

/* ---------- 备份提醒 ---------- */

/* 距上次导出的天数；从未导出返回 null */
export function daysSinceExport(lastExport, now) {
  if (!lastExport || !/^\d{4}-\d{2}-\d{2}$/.test(String(lastExport))) return null;
  const p = String(lastExport).split('-').map(Number);
  const a = new Date(p[0], p[1] - 1, p[2]).getTime();
  const b = now ? now.getTime() : Date.now();
  return Math.floor((b - a) / DAY_MS);
}

/* 要不要显示备份提醒：有学习数据 且（从未导出 或 距上次导出 ≥5 天）。
   返回 null（不提示）或 { days, never }。 */
export function shouldRemindBackup(state, lastExport, now) {
  const t = now ? dateStr(now) : today();
  if (!hasLearningData(state)) return null;
  if (state && state.settings && state.settings.backupSnoozeUntil &&
    String(state.settings.backupSnoozeUntil) > t) return null;
  const days = daysSinceExport(lastExport, now);
  if (days === null) return { days: null, never: true };
  if (days >= BACKUP_REMIND_DAYS) return { days: days, never: false };
  return null;
}

/* 推迟提醒：把提醒静音到指定日期（默认 5 天后），不改变「上次导出时间」 */
export function snoozeUntil(now, days) {
  const d = now ? new Date(now.getTime()) : new Date();
  d.setDate(d.getDate() + (days === undefined ? BACKUP_REMIND_DAYS : days));
  return dateStr(d);
}

/* ---------- 副作用（浏览器侧，Node 导入本模块不会执行） ---------- */

/* 触发下载。文件名带日期，便于用户自己留档多份。 */
export function downloadBackup(text, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || backupFilename();
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  return true;
}

/* 导出并记录时间戳。返回 { ok, filename, error }。 */
export function exportProgress(state, now) {
  try {
    const text = serializeBackupText(state, now);
    const name = backupFilename(now);
    const ok = downloadBackup(text, name);
    if (!ok) return { ok: false, error: '当前环境不支持下载文件。' };
    if (state && state.settings) {
      state.settings.lastExport = todayStr(now);
      // 导出即完成备份，清掉推迟标记
      delete state.settings.backupSnoozeUntil;
      store.save();
    }
    return { ok: true, filename: name };
  } catch (e) {
    return { ok: false, error: '导出失败：' + (e && e.message ? e.message : '未知错误') };
  }
}

/* 读文件为文本（Promise 化 FileReader，便于 UI 顺序处理） */
export function readFileText(file) {
  return new Promise(function (resolve, reject) {
    const fr = new FileReader();
    fr.onload = function () { resolve(String(fr.result)); };
    fr.onerror = function () { reject(new Error('读取文件失败。')); };
    fr.readAsText(file);
  });
}

/* 写入导入结果：只做「合并 + 立即落盘」，绝不直接替换整个 state */
export function applyImport(state, incoming, now) {
  const merged = mergeStates(state, incoming);
  store.replaceState(merged);
  store.flush();
  return {
    ok: true,
    summary: summarizeState(merged),
    at: todayStr(now)
  };
}

/* 字节数人类可读（存储用量展示；estimate() 缺字段时返回 null） */
export function formatBytes(n) {
  if (typeof n !== 'number' || !isFinite(n) || n < 0) return null;
  if (n < 1024) return n + ' B';
  const kb = n / 1024;
  if (kb < 1024) return (Math.round(kb * 10) / 10) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return (Math.round(mb * 10) / 10) + ' MB';
  return (Math.round(mb / 1024 * 100) / 100) + ' GB';
}

export const Backup = {
  BACKUP_FORMAT, BACKUP_VERSION, BACKUP_REMIND_DAYS,
  backupFilename, todayStr,
  serializeBackup, serializeBackupText,
  validateBackup, parseBackup, sanitizeState,
  summarizeState, hasLearningData,
  mergeStates, mergePreview,
  daysSinceExport, shouldRemindBackup, snoozeUntil,
  downloadBackup, exportProgress, readFileText, applyImport,
  formatBytes
};
