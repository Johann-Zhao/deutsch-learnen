/* Node 单元测试：node tests/run.js（ESM） */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as SRS from '../src/srs.js';
import { Storage, today, KEY, isQuotaError } from '../src/storage.js';
import {
  serializeBackup, serializeBackupText, validateBackup, parseBackup, backupFilename,
  summarizeState, hasLearningData, mergeStates, mergePreview, daysSinceExport,
  shouldRemindBackup, snoozeUntil, formatBytes, BACKUP_FORMAT, BACKUP_VERSION, BACKUP_REMIND_DAYS
} from '../src/backup.js';
import { buildWordIndex, isGrammarCardId, isListenCardId, rebuildWordIndex, allWords } from '../src/data.js';
import { store } from '../src/store.js';
import { lookup } from '../src/conjugate.js';
import { pickImageDistractors, hasImage, orderImageChoices } from '../src/imgquiz.js';
import { maskWord, maskWordHalf, orderReviewQueue, makeRequeue, posLabel, genderTag, canAskGender, Vocab } from '../src/vocabulary.js';
import { buildClozePool, pickCloze, pickClozeDistractors, blankSentence, itemsFromDialogue } from '../src/cloze.js';
import { esc as escHtml } from '../src/ui.js';
import { pickWordSrc, pickDialogSrc, pickReadingSrc, resolveRate } from '../src/audio.js';
import * as AudioLayer from '../src/audio.js';
import { dialogueCardId, parseDialogueCardId, pickDictationQueue } from '../src/listen.js';
import { classifyToken, newWordRate, isWordToken } from '../src/reader.js';
import { getWordIpa } from '../src/data.js';

let passed = 0, failed = 0;
const asyncQueue = [];
function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      asyncQueue.push(r.then(function () { passed++; console.log('  ✓ ' + name); },
        function (e) { failed++; console.error('  ✗ ' + name + '\n    ' + (e.message || e)); }));
    } else {
      passed++; console.log('  ✓ ' + name);
    }
  }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('DeSRS（FSRS）：');
test('首次"不认识"：当天就会再见到', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 0, '2026-08-01');
  assert.strictEqual(c.due, '2026-08-01'); // 稳定度 <1 天 → 当天到期
  assert.ok(c.stability < 1);
  assert.strictEqual(c.lapses, 1);
});
test('首次"认识"：约 4 天后再复习', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 2, '2026-08-01');
  assert.strictEqual(c.due, '2026-08-05'); // S0=3.71 → 4 天
});
test('重复答对稳定度递增（间隔越拉越长）', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 2, '2026-08-01');
  const s1 = c.stability, due1 = c.due;
  SRS.review(c, 2, due1); // 到期日按时复习再答对
  assert.ok(c.stability > s1, '稳定度应增长: ' + s1 + ' -> ' + c.stability);
  assert.ok(c.due > due1);
});
test('"模糊"比"认识"增长少', function () {
  const a = SRS.newCard('2026-08-01'); SRS.review(a, 2, '2026-08-01');
  SRS.review(a, 2, a.due);
  const b = SRS.newCard('2026-08-01'); SRS.review(b, 2, '2026-08-01');
  SRS.review(b, 1, b.due); // 同样第二次，但答"模糊"
  assert.ok(b.stability <= a.stability);
});
test('难度随评分调整且有界（1-10）', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 0, '2026-08-01'); // 不认识 → 难度高
  const d1 = c.difficulty;
  for (let i = 0; i < 20; i++) SRS.review(c, 0, c.due);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  assert.ok(c.difficulty >= d1 - 0.01, '连错难度不应下降');
});
test('稳定度 ≥21 天视为掌握', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 2, '2026-08-01');
  for (let i = 0; i < 5 && !c.mastered; i++) SRS.review(c, 2, c.due);
  assert.ok(c.stability >= SRS.MASTERED_STABILITY);
  assert.strictEqual(c.mastered, true);
});
test('旧版 SM-2 盒子迁移', function () {
  const migrated = SRS.migrate({ box: 3, reps: 2, due: '2026-08-10', learned: '2026-08-01' });
  assert.strictEqual(migrated.stability, 7);
  assert.strictEqual(migrated.box, undefined);
});
test('isDue 判断当天到期', function () {
  assert.ok(SRS.isDue({ due: '2026-08-01' }, '2026-08-01'));
  assert.ok(SRS.isDue({ due: '2026-07-31' }, '2026-08-01'));
  assert.ok(!SRS.isDue({ due: '2026-08-02' }, '2026-08-01'));
  assert.ok(!SRS.isDue({}, '2026-08-01'));
});
test('isDue 对已斩（sealed）卡返回 false', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 0, '2026-08-01');
  assert.ok(SRS.isDue(c, '2026-08-01'));
  SRS.seal(c);
  assert.strictEqual(c.sealed, true);
  assert.strictEqual(c.mastered, true);
  assert.ok(!SRS.isDue(c, '2026-08-01'), 'sealed 卡即使到期也不应再安排复习');
});
test('seal 置位后 review 不清除 sealed/verify 标记', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 2, '2026-08-01');
  c.verify = true;
  SRS.seal(c);
  delete c.verify; // 复习转正时删除 verify
  SRS.review(c, 2, '2026-08-02');
  assert.strictEqual(c.sealed, true, 'review 不应清除 sealed');
  assert.strictEqual(c.verify, undefined, 'review 不应恢复 verify');
});
test('newCard 不含 sealed/verify 字段', function () {
  const c = SRS.newCard('2026-08-01');
  assert.ok(!('sealed' in c));
  assert.ok(!('verify' in c));
});

/* ---------- FSRS 遗忘分支（4.6.1）----------
   缺陷：review() 对所有评分共用「回忆成功」的增长公式，已有卡答错时 stability 反向变大
   （实测 3.71 → 13.20）、due 被推后 13 天，与「答错明天再见」的产品语义相反。 */
console.log('DeSRS 遗忘分支（4.6.1）：');
test('已有卡答错：稳定度下降、次日再见、lapses+1', function () {
  const c = SRS.newCard('2026-09-20');
  SRS.review(c, 2, '2026-09-20');           // S0 = W[2] = 3.7145，due = 2026-09-24
  const sBefore = c.stability;
  assert.strictEqual(c.due, '2026-09-24');
  SRS.review(c, 0, '2026-09-25');           // t=5, R≈0.87
  assert.ok(c.stability < sBefore, '答错后稳定度必须下降: ' + sBefore + ' -> ' + c.stability);
  // 日期先钉格式再比大小：坏值 'NaN-NaN-NaN' 在字符串比较里反而「大于」真实日期，会让下一条断言空转
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.due), '答错后到期日必须是合法日期：' + c.due);
  assert.ok(c.due <= '2026-09-26', '答错后不应晚于次日再见，实际：' + c.due);
  assert.strictEqual(c.lapses, 1, '答错应累计 lapses');
  assert.strictEqual(c.reps, 2);
  assert.ok(c.stability >= 0.1 && c.stability <= 36500, '稳定度应落在 clamp 区间：' + c.stability);
});
test('答错走 FSRS-4.5 遗忘公式（独立 oracle 复算，防参数错位到 W[15]）', function () {
  const c = SRS.newCard('2026-09-20');
  SRS.review(c, 2, '2026-09-20');
  const S0 = c.stability;                    // 3.7145
  SRS.review(c, 0, '2026-09-25');
  // 独立复算（不引用源码常量）：D 均值回归 → S' = w11·D^-w12·((S+1)^w13−1)·e^(w14·(1−R))
  const R = SRS.retrievability(S0, 5);
  const d1 = Math.min(10, Math.max(1, 5.1618 - 0.8975 * (1 - 3)));
  const D = Math.min(10, Math.max(1, 0.031 * 5.1618 + (1 - 0.031) * d1));
  const expect = 2.1072 * Math.pow(D, -0.0793) * (Math.pow(S0 + 1, 0.3246) - 1) * Math.exp(1.587 * (1 - R));
  assert.ok(Math.abs(c.stability - expect) < 1e-9, '遗忘公式复算不符: ' + c.stability + ' vs ' + expect);
  // 本仓库 W 是 0 基数组，论文 1 基的 w11..w14 = W[11..14]；docs 里那份 finding 按 1 基写，
  // 错抄成 (0.0793, 0.3246, 1.587, 0.2272) 会算出 ≈0.468——同样「变小」故只靠大小断言抓不住，这里显式排除
  const wrongShift = 0.0793 * Math.pow(D, -0.3246) * (Math.pow(S0 + 1, 1.587) - 1) * Math.exp(0.2272 * (1 - R));
  assert.ok(Math.abs(c.stability - wrongShift) > 0.1, '不得与 1 基错抄的映射吻合（错抄值 ' + wrongShift + '）');
});
test('评分分支 oracle：rating 2/3/4 仍走增长公式（Hard 惩罚 / Easy 奖励不变）', function () {
  // S0=3.7145（rating 3 首评）、D0=5.1618；隔 4 天重评 → t=4
  function grown(rating) {
    const S0 = 3.7145, D0 = 5.1618, t = 4;
    const R = SRS.retrievability(S0, t);
    const d1 = Math.min(10, Math.max(1, D0 - 0.8975 * (rating - 3)));
    const D = Math.min(10, Math.max(1, 0.031 * 5.1618 + (1 - 0.031) * d1));
    let inc = 1 + Math.exp(1.6474) * (11 - D) * Math.pow(S0, -0.1367) * (Math.exp(1.0461 * (1 - R)) - 1);
    if (rating === 2) inc *= 0.2272;   // Hard 惩罚
    if (rating === 4) inc *= 2.8755;   // Easy 奖励
    return S0 * inc;
  }
  [[2, 1], [3, 2], [4, 3]].forEach(function (pair) {
    const rating = pair[0], quality = pair[1]; // rating = quality + 1
    const c = SRS.newCard('2026-09-20');
    SRS.review(c, 2, '2026-09-20');
    SRS.review(c, quality, '2026-09-24');
    const expect = grown(rating);
    assert.ok(Math.abs(c.stability - expect) < 1e-9,
      'rating ' + rating + '（quality ' + quality + '）增长公式不再吻合: ' + c.stability + ' vs ' + expect);
  });
});
test('首评（含 reps 缺失/NaN 的卡）落回首评分支，不再算出 NaN 日期', function () {
  // 无 reps/difficulty 的卡：原判定 `reps === 0` 为假会走非首评分支 → stability/due 全 NaN
  const c = { due: '2026-09-01', stability: 2, last: '2026-09-01' };
  SRS.review(c, 2, '2026-09-01');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.due), 'due 必须是合法日期：' + c.due);
  assert.ok(Number.isFinite(c.stability) && Number.isFinite(c.difficulty), '稳定度/难度必须有限：' + c.stability + '/' + c.difficulty);
  assert.strictEqual(c.stability, 3.7145, '应走首评（Good 初始稳定度 W[2]）');
  assert.strictEqual(c.reps, 1);
  // reps 为 NaN 同理：`!(NaN > 0)` 为真 → 首评分支
  const n = { due: '2026-09-01', stability: 2, difficulty: 5, reps: NaN, lapses: NaN, last: '2026-09-01' };
  SRS.review(n, 2, '2026-09-01');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(n.due), 'reps=NaN 的卡也必须是合法日期：' + n.due);
  assert.strictEqual(n.reps, 1, 'NaN reps 应被首评分支重置为 1');
});
test('迁移卡的 reps/lapses 不再变 NaN（SM-2 遗留卡）', function () {
  const c = SRS.migrate({ box: 3, learned: '2026-08-01', due: '2026-08-04' });
  assert.strictEqual(c.reps, 1, '迁移来的卡视为已复习过 1 次');
  assert.strictEqual(c.lapses, 0);
  SRS.review(c, 2, '2026-08-04');
  assert.ok(Number.isFinite(c.reps), 'reps 必须有限：' + c.reps);
  assert.ok(Number.isFinite(c.lapses), 'lapses 必须有限：' + c.lapses);
  assert.ok(c.reps >= 1);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.due), 'due 必须合法：' + c.due);
  // 已有计数器的旧卡不得被兜底覆盖
  const keep = SRS.migrate({ box: 2, reps: 5, lapses: 3, learned: '2026-08-01', due: '2026-08-04' });
  assert.strictEqual(keep.reps, 5);
  assert.strictEqual(keep.lapses, 3);
});
test('t>0 连错：难度不下降、稳定度不反弹成「已掌握」（绕开 t=0 的 R=1 退化）', function () {
  const c = SRS.newCard('2026-08-01');
  SRS.review(c, 0, '2026-08-01');            // 首评 Again → 难度高
  const d1 = c.difficulty;
  let tPos = 0;
  for (let i = 0; i < 20; i++) {
    const next = SRS.addDays(c.last, 5);     // 每次隔 5 天重评，确保 t>0
    if (SRS.daysBetween(c.last, next) > 0) tPos++;
    SRS.review(c, 0, next);
    assert.ok(Number.isFinite(c.stability), '第 ' + (i + 1) + ' 次答错后 stability 非有限：' + c.stability);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.due), '第 ' + (i + 1) + ' 次答错后到期日非法：' + c.due);
    // 本循环落在高难度（D→9.85）+ 低稳定度区间，遗忘公式给出的 S' ≪ 1 天 → 当天再见。
    // （不是普适定律：FSRS 的遗忘后稳定度随 D 减小/请求延迟增大而升高，这里锁的是本场景。）
    assert.ok(c.due <= SRS.addDays(next, 1), '第 ' + (i + 1) + ' 次答错后 due 被推后超过 1 天：' + c.due);
  }
  assert.strictEqual(tPos, 20, '20 次重评都必须走 t>0 路径（否则本测试会退化成 t=0 空转）');
  assert.ok(c.difficulty >= d1 - 0.01, '连错难度不应下降: ' + d1 + ' -> ' + c.difficulty);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  assert.ok(c.stability < SRS.MASTERED_STABILITY, '连错不该被判定为已掌握：' + c.stability);
  assert.strictEqual(c.mastered, false);
});
test('答错使「已掌握」回落为未掌握（连带效果），已斩卡仍不受影响', function () {
  // 消费方 reader.js:27 用 `sealed || mastered` 判三态着色、:346 出「已掌握 ✓」标签，views.js:22 统计已掌握数
  const c = { stability: 30, difficulty: 5, reps: 5, lapses: 0, last: '2026-08-01', due: '2026-08-31', mastered: true };
  SRS.review(c, 0, '2026-08-31');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.due), '到期日必须是合法日期：' + c.due);
  assert.ok(c.stability < SRS.MASTERED_STABILITY, '答错后稳定度应跌破掌握阈值：' + c.stability);
  assert.strictEqual(c.mastered, false, '忘了就不算掌握');
  // 已斩的卡永不到期：review 不清 sealed，isDue 仍为 false
  const sealed = SRS.seal({ stability: 30, difficulty: 5, reps: 5, lapses: 0, last: '2026-08-01', due: '2026-08-31' });
  SRS.review(sealed, 0, '2026-08-31');
  assert.strictEqual(sealed.sealed, true, 'review 不应清除 sealed');
  assert.ok(!SRS.isDue(sealed, '2026-12-31'), '已斩卡永不到期');
});

console.log('DeSRS.matches（判分）：');
test('忽略大小写与首尾空格', function () {
  assert.ok(SRS.matches('  Apfel ', 'Apfel'));
});
test('变元音等价输入', function () {
  assert.ok(SRS.matches('uebung', 'Übung'));
  assert.ok(SRS.matches('strasse', 'Straße'));
  assert.ok(SRS.matches('schoen', 'schön'));
});
// 输入法鲁棒性实测：界面提示写了「ä 可输 ae，ö 输 oe，ü 输 ue，ß 输 ss」，
// 四个方向必须**双向**等价（自动更正可能把 ue 换成 ü，也可能反过来）。
test('变元音四方向双向等价：ä/ö/ü/ß ↔ ae/oe/ue/ss 都判对', function () {
  const pairs = [
    ['Bär', 'Baer'], ['Baer', 'Bär'],
    ['schön', 'schoen'], ['schoen', 'schön'],
    ['Übung', 'uebung'], ['uebung', 'Übung'],
    ['Straße', 'Strasse'], ['Strasse', 'Straße']
  ];
  pairs.forEach(function (p) {
    assert.ok(SRS.matches(p[0], p[1]), '应判对：输入 ' + p[0] + ' / 答案 ' + p[1]);
    assert.ok(SRS.matches(p[1], p[0]), '应判对（反向）：输入 ' + p[1] + ' / 答案 ' + p[0]);
  });
  // 大小写在变元音上同样不敏感（Ä→ae、ß→ss 后仍等价）
  assert.ok(SRS.matches('AEPFEL', 'Äpfel'), '大写转写也应判对');
  assert.ok(SRS.matches('Öl', 'oel'), 'Ö→oe 双向');
  // 带冠词时同样走这条归一化
  assert.ok(SRS.matches('die Strasse', 'die Straße'));
  assert.ok(SRS.matches('die Übung', 'die Uebung'));
  // 但真的拼错仍必须判错，别把等价放宽成模糊匹配
  assert.ok(!SRS.matches('Baum', 'Bär'));
  assert.ok(!SRS.matches('strase', 'Straße'));
});
test('名词可不带冠词', function () {
  assert.ok(SRS.matches('Apfel', 'der Apfel'));
  assert.ok(SRS.matches('der Apfel', 'Apfel'));
  assert.ok(!SRS.matches('die Apfel', 'der Apfel'));
  assert.ok(!SRS.matches('Hause', 'zu Hause'));
  assert.ok(SRS.matches('Kind', 'das Kind'));
  assert.ok(!SRS.matches('die Kind', 'das Kind'));
  assert.ok(SRS.matches('nach Hause', 'nach Hause'));
});
test('不同词不匹配', function () {
  assert.ok(!SRS.matches('Birne', 'Apfel'));
});

console.log('语法 SRS 调度：');
test('语法卡生命周期：首错当天到期，隔天再对推后', function () {
  let c = SRS.review(null, 0, '2026-08-01');
  assert.strictEqual(c.due, '2026-08-01', '首错应今天到期');
  assert.ok(SRS.isDue(c, '2026-08-01'));
  c = SRS.review(c, 2, '2026-08-02');
  assert.ok(c.due > '2026-08-02', '答对后到期日应推后: ' + c.due);
  assert.ok(!SRS.isDue(c, '2026-08-02'));
  assert.ok(SRS.isDue(c, c.due));
});

console.log('DeStorage：');
function mockBackend() {
  const m = {};
  return { getItem: function (k) { return m[k] || null; }, setItem: function (k, v) { m[k] = v; }, removeItem: function (k) { delete m[k]; }, _m: m };
}
test('空后端返回默认状态', function () {
  const s = new Storage(mockBackend());
  assert.strictEqual(Object.keys(s.state.srs).length, 0);
  assert.strictEqual(s.state.settings.dailyNew, 10);
});
test('save/load 往返', function () {
  const b = mockBackend();
  const s = new Storage(b);
  s.state.srs['x'] = { box: 2 };
  s.save();
  const s2 = new Storage(b);
  assert.deepStrictEqual(s2.state.srs['x'], { box: 2 });
});
test('坏数据容错', function () {
  const b = mockBackend();
  b.setItem(KEY, '{broken json');
  const s = new Storage(b);
  assert.strictEqual(s.state.settings.dailyNew, 10);
});
test('touchToday 连续打卡', function () {
  const s = new Storage(mockBackend());
  s.state.streak.last = null;
  s.touchToday('new', 2);
  assert.strictEqual(s.state.streak.count, 1);
  s.touchToday('reviewed', 1); // 同一天不重复计
  assert.strictEqual(s.state.streak.count, 1);
  assert.strictEqual(s.state.daily[today()].new, 2);
});
test('冻结券：漏一天不清零并消耗一张', function () {
  const s = new Storage(mockBackend());
  // 模拟前天学过
  const d = new Date(); d.setDate(d.getDate() - 2);
  const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.state.daily[key] = { new: 5, reviewed: 0, correct: 0 };
  s.state.streak = { last: key, count: 3, freezes: 1, protected: [] };
  s.touchToday('new', 1);
  assert.strictEqual(s.state.streak.count, 4, '应消耗冻结券保持连胜');
  assert.strictEqual(s.state.streak.freezes, 0);
  assert.strictEqual(s.state.streak.protected.length, 1);
});
test('无冻结券时断卡重新计数', function () {
  const s = new Storage(mockBackend());
  const d = new Date(); d.setDate(d.getDate() - 2);
  const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.state.streak = { last: key, count: 5, freezes: 0, protected: [] };
  s.touchToday('new', 1);
  assert.strictEqual(s.state.streak.count, 1);
});
test('每满 7 天补发冻结券（上限 2）', function () {
  const s = new Storage(mockBackend());
  const d = new Date(); d.setDate(d.getDate() - 1);
  const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.state.streak = { last: key, count: 6, freezes: 0, protected: [] };
  s.touchToday('new', 1);
  assert.strictEqual(s.state.streak.count, 7);
  assert.strictEqual(s.state.streak.freezes, 1);
});
test('migrateCards 迁移旧卡片', function () {
  const s = new Storage(mockBackend());
  s.state.srs['old'] = { box: 2, reps: 1, due: '2026-08-01' };
  s.migrateCards(SRS.migrate);
  assert.strictEqual(s.state.srs['old'].stability, 3);
});
test('错题记录与移除', function () {
  const s = new Storage(mockBackend());
  s.addMistake('grammar', 'g1#0');
  s.addMistake('grammar', 'g1#0');
  assert.strictEqual(s.state.mistakes['g1#0'].wrong, 2);
  s.removeMistake('g1#0');
  assert.ok(!s.state.mistakes['g1#0']);
});
test('replaceState 导入合并默认设置', function () {
  const s = new Storage(mockBackend());
  s.replaceState({ srs: { a: { box: 1 } } });
  assert.strictEqual(s.state.settings.dailyNew, 10);
  assert.ok(s.state.srs.a);
});

// 内存版 fake 异步 KV 后端，用于验证 IndexedDB 路径逻辑而不依赖真实 indexedDB
function fakeAsyncBackend() {
  let mem = null, sets = 0, opens = 0;
  return {
    type: 'indexedDB',
    open: function () { opens++; return Promise.resolve(); },
    get: function () { return Promise.resolve(mem); },
    set: function (v) { sets++; mem = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
    _preload: function (v) { mem = JSON.parse(JSON.stringify(v)); },
    _mem: function () { return mem; },
    _sets: function () { return sets; },
    _opens: function () { return opens; }
  };
}

console.log('DeStorage（IndexedDB 路径，fake 异步后端）：');
test('Node/无 IDB 路径 ready() 立即 resolve', function () {
  const s = new Storage();
  return s.ready().then(function () { assert.ok(true); });
});
test('异步就绪：IDB 空时从 localStorage 迁移旧数据', function () {
  const b = mockBackend();
  const old = { srs: { 'a-1': { stability: 3, due: '2026-08-01' } }, settings: { dailyNew: 15 } };
  b.setItem(KEY, JSON.stringify(old));
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    assert.strictEqual(s.state.srs['a-1'].stability, 3);
    assert.strictEqual(s.state.settings.dailyNew, 15);
    assert.ok(asyncBE._mem(), '迁移后应写入 IDB');
    assert.strictEqual(asyncBE._mem().srs['a-1'].stability, 3);
    assert.ok(b.getItem(KEY), 'localStorage 原记录应保留');
  });
});
test('ready 使用 IDB 数据覆盖内存初始状态', function () {
  const b = mockBackend();
  b.setItem(KEY, JSON.stringify({ srs: { a: { stability: 1 } } }));
  const asyncBE = fakeAsyncBackend();
  asyncBE._preload({ srs: { a: { stability: 9 } } });
  const s = new Storage(b, asyncBE);
  assert.strictEqual(s.state.srs.a.stability, 1, '构造时仍读 localStorage');
  return s.ready().then(function () {
    assert.strictEqual(s.state.srs.a.stability, 9, 'ready 后改用 IDB 数据');
  });
});
test('ready 前 save 不直接落盘，ready 后统一触发', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  s.state.srs['x'] = { stability: 1 };
  s.save();
  s.save();
  assert.strictEqual(asyncBE._sets(), 0, 'ready 完成前不应落盘');
  return s.ready().then(function () {
    s.flush();
    assert.strictEqual(asyncBE._sets(), 1, 'ready 后应统一落盘 1 次');
    assert.strictEqual(asyncBE._mem().srs['x'].stability, 1);
  });
});
test('防抖合并：连续 3 次 save 只落盘 1 次', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 1 };
    s.save();
    s.state.srs['y'] = { stability: 2 };
    s.save();
    s.state.srs['z'] = { stability: 3 };
    s.save();
    assert.strictEqual(asyncBE._sets(), 0, '防抖期间不应落盘');
    s.flush();
    assert.strictEqual(asyncBE._sets(), 1, 'flush 后应只落盘 1 次');
    assert.strictEqual(asyncBE._mem().srs['z'].stability, 3);
  });
});
test('flush 立即落盘', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 5 };
    s.save();
    s.flush();
    assert.strictEqual(asyncBE._sets(), 1);
    assert.strictEqual(asyncBE._mem().srs['x'].stability, 5);
  });
});
test('IDB 落盘同时写 localStorage 镜像', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 7 };
    s.flush();
    const mirrored = JSON.parse(b.getItem(KEY));
    assert.strictEqual(mirrored.srs['x'].stability, 7);
  });
});
test('防抖 300ms 到期后自动落盘', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 8 };
    s.save();
    assert.strictEqual(asyncBE._sets(), 0, '定时器触发前不应落盘');
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.strictEqual(asyncBE._sets(), 1, '300ms 后应自动落盘且仅 1 次');
        assert.strictEqual(asyncBE._mem().srs['x'].stability, 8);
        resolve();
      }, 350);
    });
  });
});

console.log('\n学习进度导出 / 导入（backup.js 纯函数）：');

/* navigator.storage 的打桩说明：Node 21+ 的 globalThis.navigator 是**只有 getter** 的属性，
   直接赋值会抛「Cannot set property navigator」。因此持久化/配额测试不走全局打桩，
   改为把 navigator.storage 句柄**注入** Storage 的第三个构造参数（src/storage.js 的
   storageManager()），既避开该限制，又不会与本文件里并发跑的异步用例互相踩。 */

// 一份内容完整的样例存档，供各用例复用
function sampleState(over) {
  return Object.assign({
    settings: { dailyNew: 10, ttsRate: 1.0, level: 'A1', lastExport: '2026-09-20' },
    srs: { 'greet-0': { stability: 3, difficulty: 5, reps: 2, lapses: 0, due: '2026-09-25', last: '2026-09-22' } },
    daily: { '2026-09-22': { new: 5, reviewed: 3, correct: 7 } },
    mistakes: { 'g-praesens#1': { type: 'grammar', wrong: 2, last: '2026-09-22' } },
    grammarDone: { 'g-praesens': 80 },
    listen: { 'dl-a1-greet': { right: 3, total: 4, at: '2026-09-21' } },
    reading: { 'rd-a1-park': { finished: '2026-09-21', added: 4 } },
    streak: { last: '2026-09-22', count: 4, freezes: 1, protected: [] }
  }, over || {});
}

test('导出信封带 format/version/exportedAt，state 是整份存档', function () {
  const env = serializeBackup(sampleState(), new Date(2026, 8, 27));
  assert.strictEqual(env.format, BACKUP_FORMAT);
  assert.strictEqual(env.version, BACKUP_VERSION);
  assert.strictEqual(env.exportedAt, '2026-09-27');
  assert.strictEqual(env.state.srs['greet-0'].stability, 3);
  assert.strictEqual(env.state.streak.count, 4);
});
test('文件名带日期：deutsch-progress-YYYY-MM-DD.json', function () {
  assert.strictEqual(backupFilename(new Date(2026, 8, 27)), 'deutsch-progress-2026-09-27.json');
  assert.strictEqual(backupFilename(new Date(2026, 0, 5)), 'deutsch-progress-2026-01-05.json');
});
test('序列化往返：导出文本 → 解析 → 校验 → 合并结果与原状态一致', function () {
  const st = sampleState();
  const text = serializeBackupText(st, new Date(2026, 8, 27));
  assert.strictEqual(typeof text, 'string');
  const res = parseBackup(text);
  assert.ok(res.ok, '往返后应校验通过：' + res.error);
  assert.deepStrictEqual(res.state.srs, st.srs);
  assert.deepStrictEqual(res.state.daily, st.daily);
  assert.deepStrictEqual(res.state.streak, st.streak);
  assert.deepStrictEqual(mergeStates(st, res.state), mergeStates(st, st));
});

// ---- 坏输入必须被拒绝，且给出可读理由（绝不能写坏存档）----
test('坏输入：空文本 / 空文件', function () {
  assert.ok(!parseBackup('').ok);
  assert.ok(!parseBackup('   ').ok);
  assert.ok(!parseBackup(null).ok);
  assert.ok(/空/.test(parseBackup('').error), '错误文案应说明文件为空：' + parseBackup('').error);
});
test('坏输入：截断或语法错误的 JSON', function () {
  const cut = serializeBackupText(sampleState()).slice(0, 40); // 故意截断
  const r = parseBackup(cut);
  assert.ok(!r.ok, '截断的 JSON 必须被拒绝');
  assert.ok(/JSON/.test(r.error), '错误文案应提示 JSON 无效：' + r.error);
  assert.ok(!parseBackup('{broken json').ok);
  assert.ok(!parseBackup('<html>not json</html>').ok);
});
test('坏输入：顶层是数组 / 数字 / null', function () {
  assert.ok(!parseBackup('[]').ok);
  assert.ok(!parseBackup('[1,2,3]').ok);
  assert.ok(!parseBackup('42').ok);
  assert.ok(!parseBackup('null').ok);
  assert.ok(!parseBackup('"a string"').ok);
});
test('坏输入：JSON 合法但不是本应用的备份（format 不符）', function () {
  const r = validateBackup({ format: 'something-else', version: 1, state: sampleState() });
  assert.ok(!r.ok);
  assert.ok(/format/.test(r.error), '应指出 format 不符：' + r.error);
});
test('坏输入：version 高于本应用支持的版本（拒绝而不是猜着读）', function () {
  const r = validateBackup({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, state: sampleState() });
  assert.ok(!r.ok);
  assert.ok(/更新/.test(r.error), '应说明来自更新的版本：' + r.error);
});
test('坏输入：缺少 version / state', function () {
  assert.ok(!validateBackup({ format: BACKUP_FORMAT, state: sampleState() }).ok, '缺 version 应拒绝');
  const r = validateBackup({ format: BACKUP_FORMAT, version: 1 });
  assert.ok(!r.ok);
  assert.ok(/state/.test(r.error), '应指出 state 无效：' + r.error);
});
test('坏输入：state 不是对象 / 只有数字没有学习进度字段', function () {
  assert.ok(!validateBackup({ format: BACKUP_FORMAT, version: 1, state: 'x' }).ok);
  assert.ok(!validateBackup({ format: BACKUP_FORMAT, version: 1, state: [1, 2] }).ok);
  const r = validateBackup({ format: BACKUP_FORMAT, version: 1, state: { srs: 5, daily: 7 } });
  assert.ok(!r.ok, 'srs/daily 是数字时不算学习进度，应拒绝');
});
test('字段缺失容错：裸 store.state（旧版导出）仍可导入', function () {
  const bare = sampleState();
  const r = validateBackup(bare);
  assert.ok(r.ok, '旧版裸存档应兼容：' + r.error);
  // 只有 settings + 一个字段也应通过
  assert.ok(validateBackup({ settings: { dailyNew: 10 }, srs: {} }).ok);
});
test('字段缺失容错：只有 settings 的裸存档被拒绝（不是学习进度）', function () {
  assert.ok(!validateBackup({ settings: { dailyNew: 10 } }).ok);
});
test('字段缺失容错：缺 daily/mistakes/listen/reading 的备份能合并出完整结构', function () {
  const res = validateBackup({ settings: { dailyNew: 10 }, srs: { 'a-1': { stability: 1 } } });
  assert.ok(res.ok);
  const merged = mergeStates({ settings: { dailyNew: 10 }, srs: {} }, res.state);
  ['srs', 'daily', 'mistakes', 'grammarDone', 'listen', 'reading', 'streak', 'settings'].forEach(function (k) {
    assert.ok(merged[k] && typeof merged[k] === 'object', k + ' 应被补成对象');
  });
  assert.strictEqual(merged.settings.dailyNew, 10);
});

// ---- 合并策略 ----
test('合并：卡片取并集，同 id 取复习更晚的一方', function () {
  const cur = { settings: {}, srs: { a: { reps: 1, last: '2026-09-20', stability: 1 } } };
  const inc = { settings: {}, srs: { b: { reps: 9, last: '2026-01-01', stability: 40 } } };
  const m = mergeStates(cur, inc);
  assert.strictEqual(Object.keys(m.srs).length, 2);
  assert.strictEqual(m.srs.b.stability, 40, '备份独有的卡应并入');
  // 同一天两边都有：取 reps 更大的
  const m2 = mergeStates({ settings: {}, srs: { a: { reps: 1, last: '2026-09-20' } } },
    { settings: {}, srs: { a: { reps: 5, last: '2026-09-20' } } });
  assert.strictEqual(m2.srs.a.reps, 5);
  // 当前卡片复习时间更晚：不能被备份里的旧卡拉回去
  const m3 = mergeStates({ settings: {}, srs: { a: { reps: 2, last: '2026-09-25', stability: 9 } } },
    { settings: {}, srs: { a: { reps: 8, last: '2026-09-01', stability: 30 } } });
  assert.strictEqual(m3.srs.a.stability, 9, '复习更晚的当前卡应保留');
  assert.strictEqual(m3.srs.a.last, '2026-09-25');
  // 备份卡片复习时间更晚：必须取备份那一方（否则「换设备后导入旧备份」会把新进度抹掉）。
  // 这一条原先缺失——独立复审用变异证实：删掉「备份更晚→取备份」整段，整套测试仍然全绿。
  // 注意数据要**让 last 与 reps 指向相反方向**，否则删掉「比 last」的分支后会回退到「比 reps」
  // 仍然选中备份侧，断言照样通过 —— 那就是一条不具判别力的用例。
  const m4 = mergeStates({ settings: {}, srs: { a: { reps: 5, last: '2026-09-10', stability: 9 } } },
    { settings: {}, srs: { a: { reps: 1, last: '2026-09-26', stability: 41 } } });
  assert.strictEqual(m4.srs.a.stability, 41, '备份侧复习更晚时应取备份侧（reps 更少也不例外）');
  assert.strictEqual(m4.srs.a.last, '2026-09-26');
  assert.strictEqual(m4.srs.a.reps, 1);
});
test('合并：已斩 / 已掌握标记不因「取更晚的一方」而丢失', function () {
  // 当前卡更晚但未斩，备份卡更早但已斩 → 合并后必须仍是已斩（否则已斩的卡会退回复习队列）
  const m = mergeStates(
    { settings: {}, srs: { a: { reps: 3, last: '2026-09-26', stability: 12 } } },
    { settings: {}, srs: { a: { reps: 9, last: '2026-09-01', stability: 80, sealed: true, sealedAt: '2026-09-01' } } });
  assert.strictEqual(m.srs.a.sealed, true, '已斩是永久成就，不能被「取更晚」丢掉');
  assert.strictEqual(m.srs.a.sealedAt, '2026-09-01');
  assert.strictEqual(m.srs.a.last, '2026-09-26', '复习时间仍应取更晚的一方');
  // 反向：当前已斩、备份更晚 → 同样保留已斩
  const m2 = mergeStates(
    { settings: {}, srs: { a: { reps: 1, last: '2026-09-01', sealed: true, sealedAt: '2026-09-01' } } },
    { settings: {}, srs: { a: { reps: 4, last: '2026-09-26' } } });
  assert.strictEqual(m2.srs.a.sealed, true);
  assert.strictEqual(m2.srs.a.last, '2026-09-26');
});
test('导入校验：坏值被清洗掉，绝不写进存档（P1 回归）', function () {
  // 这一组直接对应独立复审实测的四个崩溃：srs 值为 null → 设置页白屏（且已落盘、重载仍崩）
  const bad = {
    format: 'deutsch-lernen-progress', version: 1,
    state: {
      settings: { dailyNew: 10 },
      srs: { ok: { reps: 1, last: '2026-09-20', stability: 3 }, 'zz-0': null, 'zz-1': 'oops', 'zz-2': [] },
      daily: { '2026-09-22': { new: 1 }, '2026-09-24': null },
      mistakes: { ok: { wrong: 1, type: 'vocab' }, 'zz-0': null },
      // grammarDone 的值是**数字**（最佳正确率），不是对象——这里必须带上它，
      // 否则这个用例对 grammarDone 一无所知，清洗器把它整个丢掉也测不出来（r2 复审的 P1）
      grammarDone: { 'g-praesens': 5, 'g-kasus': 4, 'dc-article': 6, bad: 'x', bad2: null, bad3: [] },
      streak: { last: '2026-09-20', count: 2, protected: 'oops' }
    }
  };
  const v = validateBackup(bad);
  assert.strictEqual(v.ok, true, '有可用内容时应接受（丢弃坏条目而不是整份拒绝）');
  assert.ok(v.dropped && v.dropped.length > 0, '必须上报丢了什么，不能静默');
  assert.strictEqual(v.state.srs['zz-0'], undefined, 'null 卡必须被丢弃');
  assert.strictEqual(v.state.srs['zz-1'], undefined, '字符串卡必须被丢弃');
  assert.strictEqual(v.state.srs['zz-2'], undefined, '数组卡必须被丢弃');
  assert.ok(v.state.srs.ok, '良构的卡必须保留');
  assert.strictEqual(v.state.daily['2026-09-24'], undefined, 'null 日条目必须被丢弃');
  assert.ok(Array.isArray(v.state.streak.protected), 'protected 必须是数组（views 会对它 forEach）');
  /* protected 的**元素**也必须是日期字符串——只判「是不是数组」不够：
     `['2026-09-23', null, 42, {a:1}]` 不会崩，但坏值不该进存档。 */
  const v3 = validateBackup({
    format: 'deutsch-lernen-progress', version: 1,
    state: {
      settings: {}, srs: {},
      streak: { last: '2026-09-20', count: 1, protected: ['2026-09-23', null, 42, { a: 1 }, 'not-a-date', ''] }
    }
  });
  assert.strictEqual(v3.ok, true, '有可用内容时应接受');
  assert.deepStrictEqual(v3.state.streak.protected, ['2026-09-23'],
    'protected 只保留合法的日期字符串，实际 ' + JSON.stringify(v3.state.streak.protected));
  assert.ok(v3.dropped.some(function (s) { return /protected/.test(s); }), '丢弃 protected 坏元素必须上报');
  // grammarDone 是数字 map：良构的必须**原样保留**（这是 r2 复审的 P1——清洗器曾把它整片丢掉）
  assert.strictEqual(v.state.grammarDone['g-praesens'], 5, '语法完成数必须保留');
  assert.strictEqual(v.state.grammarDone['g-kasus'], 4);
  assert.strictEqual(v.state.grammarDone['dc-article'], 6, '变格专题也走同一个 map');
  assert.strictEqual(v.state.grammarDone.bad, undefined, '字符串值必须被丢弃');
  assert.strictEqual(v.state.grammarDone.bad2, undefined, 'null 值必须被丢弃');
  assert.strictEqual(v.state.grammarDone.bad3, undefined, '数组值必须被丢弃');
  // 合并进当前存档后，也不能出现任何非对象值
  const m = mergeStates({ settings: { dailyNew: 10 }, srs: {} }, v.state);
  Object.keys(m.srs).forEach(function (id) {
    assert.ok(m.srs[id] && typeof m.srs[id] === 'object' && !Array.isArray(m.srs[id]),
      '合并结果里 srs.' + id + ' 必须是对象，实际 ' + JSON.stringify(m.srs[id]));
  });
  // 注意：grammarDone 不在这个循环里——它的值是数字，把它当对象断言会把错误的契约固化进测试
  ['daily', 'mistakes', 'listen', 'reading'].forEach(function (k) {
    Object.keys(m[k] || {}).forEach(function (id) {
      assert.ok(m[k][id] && typeof m[k][id] === 'object' && !Array.isArray(m[k][id]),
        '合并结果里 ' + k + '.' + id + ' 必须是对象');
    });
  });
});
test('导入校验：本应用自己导出的备份必须原样往返（尤其 grammarDone 的数字）', function () {  const state = {
    settings: { dailyNew: 10, ttsRate: 1, level: 'A1' },
    srs: {
      'greet-0': { stability: 3.7, difficulty: 5.1, reps: 2, lapses: 1, due: '2026-09-30', last: '2026-09-26', sealed: true, sealedAt: '2026-09-26' },
      'greet-1': { stability: 1.2, difficulty: 6, reps: 1, lapses: 0, due: '2026-09-29', last: '2026-09-28' }
    },
    daily: { '2026-09-26': { new: 3, reviewed: 5, correct: 7 } },
    mistakes: { 'greet-1': { wrong: 1, type: 'vocab', last: '2026-09-28' } },
    grammarDone: { 'g-praesens': 5, 'g-kasus': 4, 'dc-article': 6 },
    listen: { 'dl-a1-greet': { right: 3, total: 4, finished: '2026-09-26' } },
    reading: { 'rd-a1-park': { right: 2, total: 3, at: '2026-09-26' } },
    streak: { last: '2026-09-28', count: 3, freezes: 1, protected: ['2026-09-23'] }
  };
  const res = parseBackup(serializeBackupText(state, new Date('2026-09-28T10:00:00')));
  assert.strictEqual(res.ok, true, '应用自己导出的备份必须能导入：' + (res.error || ''));
  assert.strictEqual(res.dropped.length, 0, '自己导出的备份不该有任何条目被丢弃：' + JSON.stringify(res.dropped));
  assert.deepStrictEqual(res.state.grammarDone, state.grammarDone,
    'grammarDone（数字 map）必须原样往返，不能被清洗器当对象 map 丢掉');
  assert.strictEqual(res.summary.grammarDone, 3, '统计里语法完成数应仍是 3');
  Object.keys(state.srs).forEach(function (id) {
    assert.deepStrictEqual(res.state.srs[id], state.srs[id], 'SRS 卡 ' + id + ' 应原样往返');
  });
  assert.deepStrictEqual(res.state.streak.protected, state.streak.protected);
  // 合并回一份空存档：所有进度都必须救回来（这是「存档被清后用备份救回」的核心场景）
  const m = mergeStates({ settings: { dailyNew: 10, ttsRate: 1, level: 'A1' } }, res.state);
  assert.strictEqual(Object.keys(m.grammarDone).length, 3, '导入空存档后语法完成数不应丢失');
  assert.strictEqual(m.grammarDone['g-praesens'], 5);
  assert.strictEqual(m.srs['greet-0'].sealed, true);
  assert.strictEqual(Object.keys(m.srs).length, 2);
});
test('导入校验：绝不抛异常（违反契约的值形状也不能抛）', function () {
  // P2-1：原实现对 {toString:1} 调 String() 抛 TypeError，被上层吞成「读取文件失败」，原因误导
  const cases = [
    { format: { toString: 1 } },
    { format: 'x', version: 1, state: { settings: {}, srs: {} } },
    { format: 'deutsch-lernen-progress', version: 1, state: { settings: {}, srs: {}, streak: { protected: 42 } } },
    { format: 'deutsch-lernen-progress', version: 1, state: { settings: {}, srs: {}, streak: { protected: { a: 1 } } } },
    { format: 'deutsch-lernen-progress', version: 1, state: { settings: {}, srs: {} } },
    { format: 'deutsch-lernen-progress', version: 1, state: { settings: {}, srs: [], daily: 'x' } },
    { format: 'deutsch-lernen-progress', version: 1, state: { settings: null, srs: { a: { reps: 1 } } } }
  ];
  cases.forEach(function (c, i) {
    let r = null;
    assert.doesNotThrow(function () { r = validateBackup(c); }, '第 ' + i + ' 类输入不得抛异常');
    assert.strictEqual(typeof r.ok, 'boolean', '第 ' + i + ' 类必须返回 ok 布尔');
    if (!r.ok) assert.ok(typeof r.error === 'string' && r.error.length > 0, '第 ' + i + ' 类拒绝时须给可读原因');
  });
  // 坏值不能被写进存档：mergeStates 对 protected 为数字也不能抛
  assert.doesNotThrow(function () {
    mergeStates({ settings: {}, streak: { protected: [] } }, { settings: {}, streak: { protected: 42 } });
  }, 'mergeStates 对非数组 protected 不得抛');
});
test('合并：每日统计取并集且同日取较大值（不清零、不覆盖）', function () {
  const m = mergeStates(
    { settings: {}, daily: { '2026-09-22': { new: 2, reviewed: 1, correct: 3 } } },
    { settings: {}, daily: { '2026-09-22': { new: 5, reviewed: 0, correct: 7 }, '2026-09-01': { new: 9, reviewed: 4, correct: 13 } } });
  assert.strictEqual(m.daily['2026-09-22'].new, 5);
  assert.strictEqual(m.daily['2026-09-22'].correct, 7);
  assert.strictEqual(m.daily['2026-09-01'].new, 9);
  assert.strictEqual(Object.keys(m.daily).length, 2);
});
test('合并：错题次数取较大值，last 取更晚', function () {
  const m = mergeStates(
    { settings: {}, mistakes: { 'g-1#0': { type: 'grammar', wrong: 5, last: '2026-09-22' } } },
    { settings: {}, mistakes: { 'g-1#0': { type: 'grammar', wrong: 2, last: '2026-09-25' }, 'g-1#1': { type: 'grammar', wrong: 1, last: '2026-09-10' } } });
  assert.strictEqual(m.mistakes['g-1#0'].wrong, 5);
  assert.strictEqual(m.mistakes['g-1#0'].last, '2026-09-25');
  assert.strictEqual(m.mistakes['g-1#1'].wrong, 1);
});
test('合并：grammarDone / listen / reading 取并集，完成度不倒退', function () {
  const m = mergeStates(
    { settings: {}, grammarDone: { 'g-1': 90 }, listen: { 'dl-a1-greet': { right: 4, total: 4, at: '2026-09-25' } }, reading: { 'rd-a1-park': { finished: '2026-09-20', added: 5 } } },
    { settings: {}, grammarDone: { 'g-1': 60, 'g-2': 100 }, listen: { 'dl-a1-greet': { right: 1, total: 4, at: '2026-09-01' } }, reading: { 'rd-a1-park': { finished: '2026-09-27', added: 2 }, 'rd-a2-camping': { finished: '2026-09-10', added: 3 } } });
  assert.strictEqual(m.grammarDone['g-1'], 90, '语法完成度取较大值');
  assert.strictEqual(m.grammarDone['g-2'], 100, '备份独有专题应并入');
  assert.strictEqual(m.listen['dl-a1-greet'].right, 4, '听力取完成更晚的一方');
  assert.strictEqual(m.reading['rd-a1-park'].finished, '2026-09-27', '阅读取完成更晚的一方');
  assert.strictEqual(m.reading['rd-a1-park'].added, 2);
  assert.ok(m.reading['rd-a2-camping'], '备份独有短文应并入');
});
test('合并：连胜取 last 更晚的一份（不拼出假连胜）', function () {
  const m = mergeStates(
    { settings: {}, streak: { last: '2026-09-22', count: 4, freezes: 1, protected: [] } },
    { settings: {}, streak: { last: '2026-09-27', count: 11, freezes: 2, protected: ['2026-09-26'] } });
  assert.strictEqual(m.streak.count, 11);
  assert.strictEqual(m.streak.last, '2026-09-27');
  assert.deepStrictEqual(m.streak.protected, ['2026-09-26']);
  const m2 = mergeStates(
    { settings: {}, streak: { last: '2026-09-27', count: 11, freezes: 2, protected: [] } },
    { settings: {}, streak: { last: '2026-09-01', count: 99, freezes: 2, protected: [] } });
  assert.strictEqual(m2.streak.count, 11, '更早的备份连胜不应覆盖当前连胜');
});
test('合并：设置完全保留当前值（不被备份改掉）', function () {
  const m = mergeStates({ settings: { dailyNew: 20, ttsRate: 0.75, level: 'B1' } },
    { settings: { dailyNew: 5, ttsRate: 1.0, level: 'A1' } });
  assert.strictEqual(m.settings.dailyNew, 20);
  assert.strictEqual(m.settings.ttsRate, 0.75);
  assert.strictEqual(m.settings.level, 'B1');
});
test('合并幂等：同一份备份导入两次结果相同', function () {
  const cur = sampleState();
  const once = mergeStates(cur, sampleState());
  const twice = mergeStates(once, sampleState());
  assert.deepStrictEqual(twice, once);
});
test('合并不修改入参（当前存档与备份都不被就地改写）', function () {
  const cur = sampleState(), inc = sampleState({ srs: { 'greet-9': { stability: 1 } } });
  const curSnap = JSON.stringify(cur), incSnap = JSON.stringify(inc);
  mergeStates(cur, inc);
  assert.strictEqual(JSON.stringify(cur), curSnap);
  assert.strictEqual(JSON.stringify(inc), incSnap);
});
test('导入预览：合并后总数 = 并集，新增数正确', function () {
  const cur = sampleState({ srs: { a: { reps: 1, last: '2026-09-20' } }, mistakes: {}, daily: {} });
  const inc = sampleState({ srs: { b: { reps: 1, last: '2026-09-20' } }, mistakes: { 'g#0': { wrong: 1 } }, daily: {} });
  const pv = mergePreview(cur, inc);
  assert.strictEqual(pv.before.srs, 1);
  assert.strictEqual(pv.incoming.srs, 1);
  assert.strictEqual(pv.after.srs, 2);
  assert.strictEqual(pv.addedCards, 1);
  assert.strictEqual(pv.addedMistakes, 1);
});
test('summary / hasLearningData：空存档没有学习数据，有卡片就有', function () {
  assert.strictEqual(hasLearningData({ settings: {}, srs: {}, daily: {}, mistakes: {}, grammarDone: {}, listen: {}, reading: {} }), false);
  assert.ok(hasLearningData(sampleState()));
  assert.strictEqual(hasLearningData(null), false);
  const c = summarizeState(sampleState());
  assert.strictEqual(c.srs, 1);
  assert.strictEqual(c.daily, 1);
  assert.strictEqual(c.streak, 4);
  // daily 里全是 0 的一天不算打卡日
  assert.strictEqual(summarizeState({ daily: { '2026-09-22': { new: 0, reviewed: 0 } } }).daily, 0);
});

// ---- 备份提醒 ----
test('提醒：没有学习数据时从不提示', function () {
  assert.strictEqual(shouldRemindBackup({ srs: {}, daily: {} }, null, new Date(2026, 8, 27)), null);
  assert.strictEqual(shouldRemindBackup(sampleState(), null, new Date(2026, 8, 27)) === null, false, '有数据且从未导出应提示');
});
test('提醒：从未导出 → 提示；导出后 4 天不提示，5 天起提示', function () {
  const st = sampleState();
  const now = new Date(2026, 8, 27);
  assert.strictEqual(shouldRemindBackup(st, null, now).never, true);
  assert.strictEqual(daysSinceExport('2026-09-27', now), 0);
  assert.strictEqual(daysSinceExport('2026-09-23', now), 4);
  assert.strictEqual(shouldRemindBackup(st, '2026-09-23', now), null, '4 天不提示');
  assert.strictEqual(daysSinceExport('2026-09-22', now), 5);
  assert.strictEqual(shouldRemindBackup(st, '2026-09-22', now).days, 5, '第 5 天应提示');
  assert.strictEqual(BACKUP_REMIND_DAYS, 5);
  assert.strictEqual(daysSinceExport(null, now), null);
  assert.strictEqual(daysSinceExport('not-a-date', now), null);
});
test('提醒：可推迟 5 天，推迟期内不提示，导出后重新计时', function () {
  const st = sampleState();
  const now = new Date(2026, 8, 27);
  st.settings.backupSnoozeUntil = snoozeUntil(now, 5);
  assert.strictEqual(st.settings.backupSnoozeUntil, '2026-10-02');
  assert.strictEqual(shouldRemindBackup(st, '2026-09-01', now), null, '推迟期内不提示');
  // 推迟期一过又开始提示
  assert.ok(shouldRemindBackup(st, '2026-09-01', new Date(2026, 9, 3)), '推迟期结束后应恢复提示');
  // 导出会清掉推迟标记（exportProgress 里 delete），这里验证时间戳归零
  st.settings.lastExport = '2026-09-27';
  delete st.settings.backupSnoozeUntil;
  assert.strictEqual(shouldRemindBackup(st, st.settings.lastExport, now), null);
});
test('formatBytes：估算不可用时返回 null，避免显示 NaN', function () {
  assert.strictEqual(formatBytes(undefined), null);
  assert.strictEqual(formatBytes(NaN), null);
  assert.strictEqual(formatBytes(-1), null);
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(2048), '2 KB');
  assert.strictEqual(formatBytes(5 * 1024 * 1024), '5 MB');
});

// ---- 配额与持久化（storage.js） ----
test('isQuotaError：识别 name / legacy code 两种写法', function () {
  assert.ok(isQuotaError({ name: 'QuotaExceededError' }));
  assert.ok(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }));
  assert.ok(isQuotaError({ code: 22 }));
  assert.ok(isQuotaError({ code: 1014 }));
  assert.ok(!isQuotaError({ name: 'AbortError' }));
  assert.ok(!isQuotaError(null));
});
test('落盘配额写满：localStorage 路径明确上报，不静默失败', function () {
  const b = mockBackend();
  const s = new Storage(b);
  s.state.srs['x'] = { stability: 1 };
  s.flush();
  assert.strictEqual(s.writeError(), null, '正常写入不应有错误');
  b.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
  s.state.srs['y'] = { stability: 1 };
  s.flush();
  const err = s.writeError();
  assert.ok(err, '配额写满必须被捕获并保留，不能静默');
  assert.strictEqual(err.kind, 'quota');
  s.clearWriteError();
  assert.strictEqual(s.writeError(), null);
});
test('写入失败会通知订阅者（UI 据此把「保存失败」刷出来），且只通知一次进入失败态', function () {
  const b = mockBackend();
  const s = new Storage(b);
  s.state.srs['x'] = { stability: 1 };
  s.flush();
  const seen = [];
  const off = s.onWriteError(function (e) { seen.push(e && e.kind); });
  b.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
  s.flush();
  s.flush();
  assert.deepStrictEqual(seen, ['quota'], '进入失败态只通知一次（防抖期间不刷屏），实际 ' + JSON.stringify(seen));
  assert.strictEqual(s.writeError().kind, 'quota');
  off();
  s.flush();
  assert.deepStrictEqual(seen, ['quota'], '取消订阅后不再通知');
  // 普通写错误不应把已报过的配额错误降级
  s._noteWriteError({ name: 'UnknownError' });
  assert.strictEqual(s.writeError().kind, 'quota', '已报配额错误时不被普通写错误覆盖');
});
test('镜像写失败但主存成功：也保留错误记录（配额写满时镜像先被拒）', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    b.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
    s.state.srs['x'] = { stability: 1 };
    s.flush();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(s.writeError(), '镜像被拒也要留痕');
        assert.strictEqual(s.writeError().kind, 'quota');
        resolve();
      }, 0);
    });
  });
});
test('落盘配额写满：IndexedDB 路径同样上报（并用 localStorage 镜像兜底）', function () {
  const b = mockBackend();
  const asyncBE = fakeAsyncBackend();
  asyncBE.set = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; return Promise.reject(e); };
  const s = new Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 1 };
    s.flush();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(s.writeError(), 'IDB 配额错误应被捕获');
        assert.strictEqual(s.writeError().kind, 'quota');
        assert.ok(b.getItem(KEY), 'IDB 写失败时应仍有 localStorage 镜像');
        assert.strictEqual(JSON.parse(b.getItem(KEY)).srs.x.stability, 1);
        resolve();
      }, 0);
    });
  });
});
test('持久化：未授予时才申请 persist()，结果如实记录', function () {
  const calls = { persisted: 0, persist: 0, estimate: 0 };
  const granted = { v: false };
  const sm = {
    persisted: function () { calls.persisted++; return Promise.resolve(granted.v); },
    persist: function () { calls.persist++; granted.v = true; return Promise.resolve(true); },
    estimate: function () { calls.estimate++; return Promise.resolve({ usage: 1234, quota: 5678 }); }
  };
  // 句柄按实例注入（并发跑的异步用例不会互相踩 navigator.storage）
  const s = new Storage(mockBackend(), null, sm);
  return s.initPersistence().then(function (ok) {
    assert.strictEqual(calls.persisted, 1, '应查一次 persisted()');
    assert.strictEqual(calls.persist, 1, '未持久化时应申请一次');
    assert.strictEqual(ok, true);
    assert.strictEqual(s.persistGranted, true);
    // 已持久化：不再申请
    const s2 = new Storage(mockBackend(), null, sm);
    return s2.initPersistence();
  }).then(function () {
    assert.strictEqual(calls.persisted, 2, '第二次也应查一次 persisted()');
    assert.strictEqual(calls.persist, 1, '已持久化就不应重复申请');
    return s.refreshQuota();
  }).then(function (info) {
    assert.deepStrictEqual(info, { usage: 1234, quota: 5678 });
    assert.strictEqual(formatBytes(info.usage), '1.2 KB');
  });
});
test('持久化：被拒 persist() 不是错误，如实记为未授予', function () {
  const sm = {
    persisted: function () { return Promise.resolve(false); },
    persist: function () { return Promise.resolve(false); }, // iOS 常见结果
    estimate: function () { return Promise.resolve({}); }
  };
  const s = new Storage(mockBackend(), null, sm);
  return s.initPersistence().then(function (ok) {
    assert.strictEqual(ok, false);
    assert.strictEqual(s.persistGranted, false, '被拒应如实记为 false，不抛错');
    return s.refreshQuota();
  }).then(function (info) {
    assert.strictEqual(info, null, 'estimate 缺字段时不显示用量');
    assert.strictEqual(s.persistInfo, null);
  });
});
test('持久化：API 不存在（老内核 / Node）时不抛错并标记未知', function () {
  const s = new Storage(mockBackend(), null, null); // 显式「没有 navigator.storage」
  return s.initPersistence().then(function (ok) {
    assert.strictEqual(ok, null);
    assert.strictEqual(s.persistGranted, null, '不支持时应为「未查询」而不是 false');
    return s.refreshQuota();
  }).then(function (info) {
    assert.strictEqual(info, null);
  });
});
test('持久化：persisted() 抛错时降级为「未查询」，不影响启动', function () {
  const sm = {
    persisted: function () { throw new Error('security error'); },
    persist: function () { return Promise.resolve(true); },
    estimate: function () { return Promise.reject(new Error('nope')); }
  };
  const s = new Storage(mockBackend(), null, sm);
  return s.initPersistence().then(function (ok) {
    assert.strictEqual(ok, null, '查询失败不应抛到启动链上');
    return s.refreshQuota();
  }).then(function (info) { assert.strictEqual(info, null); });
});

console.log('\n词汇索引 buildWordIndex：');
test('展平 id 唯一性', function () {
  const idx = buildWordIndex([
    { id: 'greet', name: '问候', level: 'A1', words: [['der Tag', 'm', '白天', 'Guten Tag!', '你好！'], ['die Nacht', 'f', '夜晚', 'Gute Nacht!', '晚安！']] },
    { id: 'a2-travel', name: '旅行', level: 'A2', words: [['die Reise', 'f', '旅行', 'Die Reise.', '旅行。']] }
  ]);
  const ids = idx.map(function (w) { return w.id; });
  const dup = ids.filter(function (x, i) { return ids.indexOf(x) !== i; });
  assert.strictEqual(dup.length, 0);
  assert.ok(idx.every(function (w) { return w.level && w.de && w.g && w.zh; }));
});
test('重复调用幂等', function () {
  const themes = [{ id: 'greet', name: '问候', level: 'A1', words: [['der Tag', 'm', '白天', 'Guten Tag!', '你好！']] }];
  const a = buildWordIndex(themes);
  const b = buildWordIndex(themes);
  assert.deepStrictEqual(a, b);
});
test('增量级别数据合并后查找正确', function () {
  const a1 = [{ id: 'greet', name: '问候', level: 'A1', words: [['der Tag', 'm', '白天', 'Guten Tag!', '你好！']] }];
  const a2 = [{ id: 'a2-travel', name: '旅行', level: 'A2', words: [['die Reise', 'f', '旅行', 'Die Reise.', '旅行。']] }];
  const idx = buildWordIndex(a1.concat(a2));
  const w1 = idx.find(function (w) { return w.id === 'greet-0'; });
  const w2 = idx.find(function (w) { return w.id === 'a2-travel-0'; });
  assert.ok(w1 && w2);
  assert.strictEqual(w1.level, 'A1');
  assert.strictEqual(w2.level, 'A2');
  assert.strictEqual(w1.themeName, '问候');
  assert.strictEqual(w2.de, 'die Reise');
});
test('空数组返回空索引', function () {
  assert.deepStrictEqual(buildWordIndex([]), []);
  assert.deepStrictEqual(buildWordIndex(null), []);
});

console.log('\n数据完整性：');
const dataWindow = {};
function loadDataFile(rel) {
  const code = readFileSync(new URL(rel, import.meta.url), 'utf8');
  new Function('window', code)(dataWindow);
}
test('词汇 ≥36 主题、≥1900 词、id 全局唯一、level 合法', function () {
  loadDataFile('../data/vocabulary.js');
  loadDataFile('../data/vocabulary_a2.js');
  loadDataFile('../data/vocabulary_b1.js');
  const t = dataWindow.VOCAB_THEMES;
  assert.ok(t.length >= 36, '主题数应≥36，实际 ' + t.length);
  let total = 0, ids = [], levels = {};
  t.forEach(function (th) {
    assert.ok(['A1', 'A2', 'B1'].indexOf(th.level) >= 0, th.id + ' 缺少合法 level');
    levels[th.level] = (levels[th.level] || 0) + th.words.length;
    th.words.forEach(function (w, i) {
      assert.strictEqual(w.length, 5, th.id + ' 存在异常词条');
      assert.ok(['m', 'f', 'n', 'pl', 'v', 'adj', 'adv', 'num', 'pron', 'phrase', 'conj', 'part'].indexOf(w[1]) >= 0, w[0] + ' 词性标注异常');
      ids.push(th.id + '-' + i);
      total++;
    });
  });
  assert.ok(total >= 1900, '词数应≥1900，实际 ' + total);
  assert.ok(levels.A1 > 500 && levels.A2 > 500 && levels.B1 > 600, '各级别词量异常: ' + JSON.stringify(levels));
  const dup = ids.filter(function (x, i) { return ids.indexOf(x) !== i; });
  assert.strictEqual(dup.length, 0, '存在重复词条 id: ' + dup.slice(0, 3));
  assert.ok(ids.every(function (id) { return id.indexOf('#') === -1; }), '词汇 id 不应含 #，否则会与语法卡 id 冲突');
});
test('语法 ≥34 专题、id 唯一、练习结构合法', function () {
  loadDataFile('../data/grammar.js');
  loadDataFile('../data/grammar_a2.js');
  loadDataFile('../data/grammar_b1.js');
  const g = dataWindow.GRAMMAR;
  assert.ok(g.length >= 34, '语法专题应≥34，实际 ' + g.length);
  const ids = g.map(function (t) { return t.id; });
  const dup = ids.filter(function (x, i) { return ids.indexOf(x) !== i; });
  assert.strictEqual(dup.length, 0, '存在重复语法 id');
  const byLevel = {};
  g.forEach(function (t) {
    assert.ok(['A1', 'A2', 'B1'].indexOf(t.level) >= 0, t.id + ' 缺少 level');
    byLevel[t.level] = (byLevel[t.level] || 0) + 1;
    assert.ok(t.exercises.length >= 5, t.id + ' 练习不足 5 题');
    t.exercises.forEach(function (e) {
      if (e.type === 'choice') { assert.ok(e.opts && e.a >= 0 && e.a < e.opts.length, t.id + ' 选择题参数异常'); }
      else { assert.ok(e.a, t.id + ' 填空题缺答案'); }
    });
  });
  assert.ok(byLevel.A1 === 10 && byLevel.A2 >= 12 && byLevel.B1 >= 14, '各级专题数异常: ' + JSON.stringify(byLevel));
});
test('听力对话：恰好 20 组、id 合法唯一、字段完整', function () {
  loadDataFile('../data/listening.js');
  const d = dataWindow.LISTEN_DIALOGS;
  assert.strictEqual(d.length, 20, '应为 20 组，实际 ' + d.length);
  const ids = new Set(); const lv = { A1: 0, A2: 0, B1: 0 };
  d.forEach(function (x) {
    assert.ok(/^dl-(a1|a2|b1)-[\w-]+$/.test(x.id), 'id 非法: ' + x.id);
    assert.ok(!ids.has(x.id), 'id 重复: ' + x.id); ids.add(x.id);
    assert.ok(['A1', 'A2', 'B1'].indexOf(x.level) >= 0, x.id + ' 缺少合法 level');
    lv[x.level]++;
    assert.ok(x.title && x.theme, x.id + ' 缺 title/theme');
    assert.ok(x.lines.length >= 3 && x.lines.length <= 5, x.id + ' lines 应为 3–5');
    x.lines.forEach(function (l) {
      assert.ok(/^[AB]$/.test(l.sp) && l.de && l.zh, x.id + ' 行字段缺失');
    });
    assert.ok(x.questions.length >= 2 && x.questions.length <= 3, x.id + ' 题数应为 2–3');
    x.questions.forEach(function (q) {
      assert.strictEqual(q.type, 'choice', x.id + ' 题目类型应为 choice');
      assert.ok(q.opts.length >= 2 && q.opts.length <= 4, x.id + ' opts 数非法');
      assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.opts.length, x.id + ' a 索引非法');
      assert.ok(q.tip, x.id + ' 缺 tip');
    });
  });
  assert.deepStrictEqual(lv, { A1: 8, A2: 7, B1: 5 }, '级别分布应为 A1×8/A2×7/B1×5: ' + JSON.stringify(lv));
});
test('听力对话：AUDIO_DIALOGS 清单与对话行数一一对应', function () {
  loadDataFile('../data/listening.js');
  loadDataFile('../audio/manifest.js');
  const d = dataWindow.LISTEN_DIALOGS;
  const m = dataWindow.AUDIO_DIALOGS;
  const ids = d.map(function (x) { return x.id; }).sort();
  assert.deepStrictEqual(Object.keys(m).sort(), ids, 'AUDIO_DIALOGS 键应与对话 id 一致');
  d.forEach(function (x) {
    assert.strictEqual(m[x.id], x.lines.length, x.id + ' 清单行数与 lines 不符');
  });
});
test('阅读短文：恰好 20 篇、id 合法唯一、级别分布 A1×8/A2×7/B1×5', function () {
  loadDataFile('../data/reading.js');
  const d = dataWindow.READING_TEXTS;
  assert.strictEqual(d.length, 20, '应为 20 篇，实际 ' + d.length);
  const ids = new Set(); const lv = { A1: 0, A2: 0, B1: 0 };
  d.forEach(function (x) {
    assert.ok(/^rd-(a1|a2|b1)-[\w-]+$/.test(x.id), 'id 非法: ' + x.id);
    assert.ok(!ids.has(x.id), 'id 重复: ' + x.id); ids.add(x.id);
    assert.ok(['A1', 'A2', 'B1'].indexOf(x.level) >= 0, x.id + ' 缺少合法 level');
    lv[x.level]++;
    assert.ok(x.title && x.theme, x.id + ' 缺 title/theme');
  });
  assert.deepStrictEqual(lv, { A1: 8, A2: 7, B1: 5 }, '级别分布应为 A1×8/A2×7/B1×5: ' + JSON.stringify(lv));
});
test('阅读短文：token 规则（标点仅 w；词必有 lemma 且 vid/g 必居其一）、words 与实际词数一致', function () {
  loadDataFile('../data/reading.js');
  dataWindow.READING_TEXTS.forEach(function (x) {
    let n = 0;
    x.paragraphs.forEach(function (p) {
      assert.ok(p.length > 0, x.id + ' 存在空段落');
      p.forEach(function (t) {
        if (t.lemma === undefined) {
          assert.deepStrictEqual(Object.keys(t).sort(), ['w'], x.id + ' 标点 token 应仅含 w: ' + JSON.stringify(t));
          return;
        }
        n++;
        assert.ok(t.lemma, x.id + ' 词 token 缺 lemma: ' + t.w);
        assert.ok(!!t.vid || !!t.g, x.id + ' 词 token 须 vid 或 g 居其一: ' + t.w);
      });
    });
    assert.strictEqual(x.words, n, x.id + ' words 字段与实际词 token 数不符');
  });
});
test('阅读短文：词库词 vid 全部可在词汇索引解析（跨级别懒加载防御）', function () {
  loadDataFile('../data/vocabulary.js');
  loadDataFile('../data/vocabulary_a2.js');
  loadDataFile('../data/vocabulary_b1.js');
  loadDataFile('../data/reading.js');
  const idset = new Set(buildWordIndex(dataWindow.VOCAB_THEMES).map(function (w) { return w.id; }));
  const missing = [];
  dataWindow.READING_TEXTS.forEach(function (x) {
    x.paragraphs.forEach(function (p) {
      p.forEach(function (t) {
        if (t.vid && !idset.has(t.vid)) missing.push(x.id + ':' + t.vid);
      });
    });
  });
  assert.strictEqual(missing.length, 0, '存在未解析 vid: ' + missing.slice(0, 5).join(', '));
});
test('阅读短文：AUDIO_READING 清单与 20 篇 id 一一对应', function () {
  loadDataFile('../data/reading.js');
  loadDataFile('../audio/manifest.js');
  const ids = dataWindow.READING_TEXTS.map(function (x) { return x.id; }).sort();
  assert.deepStrictEqual((dataWindow.AUDIO_READING || []).slice().sort(), ids, 'AUDIO_READING 应与文本 id 一一对应');
});

console.log('\n听力模块（S7）：');
test('听力卡 id 与词汇/语法卡互不冲突', function () {
  const id = dialogueCardId('dl-a1-greet', 0);
  assert.ok(id.indexOf('listen-') === 0);
  assert.ok(id.indexOf('#') >= 0);
  assert.ok(!/^g-/.test(id), '不得与语法卡 g- 前缀冲突');
  // 词汇卡 id 形如 greet-0 不含 #；语法卡 g-…#n；听力卡 listen-…#n 含 # 但非 g- 前缀
  assert.ok(isListenCardId(id));
  assert.ok(!isGrammarCardId(id), '听力卡不得被判定为语法卡');
  assert.ok(!isListenCardId('greet-0') && !isGrammarCardId('greet-0'), '词汇卡两类都不是');
  assert.ok(isGrammarCardId('g-praesens#2') && !isListenCardId('g-praesens#2'), '语法卡判定不受影响');
});
test('parseDialogueCardId 与 dialogueCardId 互逆，非听力卡返回 null', function () {
  assert.deepStrictEqual(parseDialogueCardId('listen-dl-a1-greet#2'), { dialogueId: 'dl-a1-greet', qIndex: 2 });
  assert.strictEqual(parseDialogueCardId(dialogueCardId('dl-b1-health', 1)).qIndex, 1);
  assert.strictEqual(parseDialogueCardId('g-praesens#2'), null, '语法卡不是听力卡');
  assert.strictEqual(parseDialogueCardId('greet-0'), null, '词汇卡不是听力卡');
  assert.strictEqual(parseDialogueCardId('listen-dl-a1-greet#x'), null, '题号非数字');
  assert.strictEqual(parseDialogueCardId('listen-#2'), null, '对话 id 为空');
});
test('语法/听力卡判定谓词互斥且按前缀收窄（S7 关键集成点回归）', function () {
  const ids = ['greet-0', 'g-praesens#2', 'listen-dl-a1-greet#0', 'listen-dl-b1-health#1'];
  assert.deepStrictEqual(ids.filter(isGrammarCardId), ['g-praesens#2']);
  assert.deepStrictEqual(ids.filter(isListenCardId), ['listen-dl-a1-greet#0', 'listen-dl-b1-health#1']);
  assert.ok(ids.every(function (id) { return !(isGrammarCardId(id) && isListenCardId(id)); }), '两类谓词必须互斥');
});
test('听写抽题：到期词优先、去重、上限生效', function () {
  const words = [{ id: 'a-0' }, { id: 'a-1' }, { id: 'a-2' }];
  const srs = {
    'a-0': { due: '2026-09-01' },              // 到期
    'a-1': { due: '2099-01-01' },              // 未到期但有卡
    'a-2': { due: '2026-09-01', sealed: true } // 已斩排除
  };
  const q = pickDictationQueue(words, srs, '2026-09-21', 20);
  assert.deepStrictEqual(q.map(function (w) { return w.id; }), ['a-0', 'a-1']);
  assert.strictEqual(pickDictationQueue(words, srs, '2026-09-21', 1).length, 1);
  assert.strictEqual(pickDictationQueue(words, {}, '2026-09-21', 20).length, 0, '无卡词不入队');
});
test('对话行音频选源：清单内给路径，越界/缺失给 null', function () {
  assert.strictEqual(pickDialogSrc('dl-a1-greet', 1, { 'dl-a1-greet': 4 }), 'audio/dialog/dl-a1-greet-1.mp3');
  assert.strictEqual(pickDialogSrc('dl-a1-greet', 4, { 'dl-a1-greet': 4 }), null);
  assert.strictEqual(pickDialogSrc('dl-a1-greet', 0, {}), null);
});

console.log('\n阅读模块（S8）：三态着色与生词率：');
test('classifyToken：标点 null、库外词/无卡 new', function () {
  assert.strictEqual(classifyToken({ w: '.' }, {}), null, '标点不是词 token');
  assert.ok(!isWordToken({ w: '.' }));
  assert.strictEqual(classifyToken({ w: 'ging', lemma: 'gehen', g: '去' }, {}), 'new', '库外词（无 vid）恒为 new');
  assert.strictEqual(classifyToken({ w: 'der Tag', lemma: 'der Tag', vid: 'greet-0' }, {}), 'new', '词库词无卡为 new');
});
test('classifyToken：有卡未掌握 learning；mastered/sealed 归 mastered', function () {
  const tok = { w: 'der Tag', lemma: 'der Tag', vid: 'greet-0' };
  assert.strictEqual(classifyToken(tok, { 'greet-0': { due: '2026-09-25' } }), 'learning');
  assert.strictEqual(classifyToken(tok, { 'greet-0': { due: '2026-09-25', mastered: true } }), 'mastered');
  assert.strictEqual(classifyToken(tok, { 'greet-0': { due: '2026-09-25', sealed: true } }), 'mastered');
  assert.strictEqual(classifyToken(null, {}), null);
});
test('newWordRate：空 → 0、全新 → 100、混合按词 token 取整', function () {
  assert.strictEqual(newWordRate([], {}), 0);
  assert.strictEqual(newWordRate(null, {}), 0);
  const allNew = [[{ w: 'a', lemma: 'a', g: 'x' }, { w: 'b', lemma: 'b', g: 'y' }]];
  assert.strictEqual(newWordRate(allNew, {}), 100, '全部无卡应 100');
  const mixed = [[
    { w: 'a', lemma: 'a', g: 'x' },                              // new
    { w: 'b', lemma: 'b', vid: 'greet-0' },                      // learning
    { w: 'c', lemma: 'c', vid: 'greet-1', mastered: true },      // mastered（卡态看 srs，不在 token）
    { w: '.' }                                                   // 标点不计
  ]];
  const srs = { 'greet-0': { due: '2026-09-25' }, 'greet-1': { due: '2026-09-25', mastered: true } };
  assert.strictEqual(newWordRate(mixed, srs), 33, '1/3 词为 new，应取整 33');
  assert.strictEqual(newWordRate(mixed, {}), 100, '空 srs 下全部词无卡');
});
test('pickReadingSrc：清单内给路径，缺失/空清单给 null', function () {
  assert.strictEqual(pickReadingSrc('rd-a1-park', new Set(['rd-a1-park'])), 'audio/reading/rd-a1-park.mp3');
  assert.strictEqual(pickReadingSrc('rd-a1-park', new Set()), null);
  assert.strictEqual(pickReadingSrc('rd-a1-park', null), null);
});

/* ---------- 语境填空（M7/S9）纯函数 ----------
   cloze 的句源汇集读的是 src/data.js 的模块级索引 allWords，而 data/*.js 是 window.X=… 形态。
   这里按既有 dataWindow 手法注入全局 window 后 rebuildWordIndex()（不改源码）；
   用 try/finally 还原，避免影响其它分组。数据只加载一次。 */
const browserWindow = {};
let browserDataLoaded = false;
function ensureBrowserData() {
  if (browserDataLoaded) return;
  ['../data/vocabulary.js', '../data/vocabulary_a2.js', '../data/vocabulary_b1.js',
    '../data/listening.js', '../data/reading.js'].forEach(function (f) {
    new Function('window', readFileSync(new URL(f, import.meta.url), 'utf8'))(browserWindow);
  });
  browserDataLoaded = true;
}
function withBrowserData(fn) {
  ensureBrowserData();
  const prev = globalThis.window;
  globalThis.window = browserWindow;
  rebuildWordIndex();
  try { return fn(); }
  finally {
    if (prev === undefined) delete globalThis.window; else globalThis.window = prev;
    rebuildWordIndex();
  }
}
// 独立 oracle：按 cloze 注释里写明的形态规则（精确 / 词形+派生尾 / 词干）复算「句中是否出现该词」
function clozeFold(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}
const CLOZE_SUFFIX = ['e', 'st', 't', 'en', 'er', 'es', 'em', 'n', 's', 'te', 'ten', 'test', 'tet', 'ern'];
function clozeTokenTier(sent, form) {
  const f = clozeFold(form);
  // 连字符复合词（T-Shirt）在 cloze 里是整词 token，这里两种切法都认
  const toks = String(sent || '').split(/[^A-Za-zÄÖÜäöüß-]+/).filter(Boolean)
    .concat(String(sent || '').split(/[^A-Za-zÄÖÜäöüß]+/).filter(Boolean))
    .map(clozeFold);
  if (toks.indexOf(f) >= 0) return 'exact';
  const flex = toks.some(function (t) {
    if (f.length >= 3 && t.indexOf(f) === 0 && CLOZE_SUFFIX.indexOf(t.slice(f.length)) >= 0) return true;
    return t.length >= 3 && (f === t + 'en' || f === t + 'ern');
  });
  return flex ? 'flex' : null;
}

console.log('\n语境填空（cloze）纯函数：');
test('blankSentence：整词边界精确挖空，名词句中无冠词时只挖名词部分', function () {
  assert.strictEqual(blankSentence('Der Tag war lang.', { de: 'der Tag' }), '___ war lang.');
  assert.strictEqual(blankSentence('Guten Tag!', { de: 'der Tag' }), 'Guten ___!');
  // 派生尾（复数/变格）命中：Tag→Tage，句中冠词保留作格提示
  assert.strictEqual(blankSentence('Die Tage sind kurz.', { de: 'der Tag' }), 'Die ___ sind kurz.');
  // 目标词不在句中 → null（该句不出题）
  assert.strictEqual(blankSentence('Der Tag war lang.', { de: 'die Nacht' }), null);
  assert.strictEqual(blankSentence('', { de: 'der Tag' }), null);
  assert.strictEqual(blankSentence('Der Tag war lang.', null), null);
  assert.strictEqual(blankSentence('Der Tag war lang.', {}), null);
});
test('blankSentence：动词 -en 变位不覆盖（评审 r1 P2-2 已知边界，wohne→wohnen 返回 null）', function () {
  // 本断言锁定的是「当前已知边界」而非期望行为：将来改进 isInflection 覆盖 -e/-t/-st 变位后本断言会变红，
  // 届时请连同 src/cloze.js 顶部注释与评审 r1 P2-2 结论一起更新，不要默默放宽或删掉。
  assert.strictEqual(blankSentence('Ich wohne im ersten Stock.', { de: 'wohnen' }), null);
  assert.strictEqual(blankSentence('Ich wohne in Berlin.', { de: 'wohnen' }), null);
  // 句中是真·精确形时仍能挖空：证明不是整体失效，只是变位不覆盖
  assert.strictEqual(blankSentence('Wo willst du wohnen?', { de: 'wohnen' }), 'Wo willst du ___?');
});
test('buildClozePool：词例句 target=卡词本身；无 SRS 时不产生对话/阅读句源', function () {
  withBrowserData(function () {
    const pool = buildClozePool('A1', {});
    assert.ok(pool.length > 300, 'A1 词例句池应足够大，实际 ' + pool.length);
    const idx = {};
    allWords.forEach(function (w) { idx[w.id] = w; });
    pool.forEach(function (it) {
      assert.strictEqual(it.source, 'word', '无 SRS 时不应有对话/阅读句源，实际 ' + it.source);
      assert.strictEqual(it.target.id, it.vid, '词例句 target 必须是卡词本身');
      assert.strictEqual(idx[it.vid], it.target, 'vid 必须解析回同一词条：' + it.vid);
      assert.strictEqual(it.sent, it.target.ex);
      assert.ok(it.sentZh);
      assert.ok(it.blanked.indexOf('___') >= 0, '挖空句必须含 ___：' + it.blanked);
      assert.strictEqual(it.ref, null);
      assert.strictEqual(it.target.level, 'A1');
    });
  });
});
test('itemsFromDialogue：对话句 target 是句中「已学且最长」的词库词（受控句）', function () {
  withBrowserData(function () {
    const nacht = allWords.find(function (w) { return w.level === 'A1' && w.de === 'die Nacht'; });
    const haus = allWords.find(function (w) { return w.level === 'A1' && w.de === 'das Haus'; });
    assert.ok(nacht && haus, '测试数据依赖：A1 词库应含 die Nacht / das Haus');
    const dial = { id: 'dl-a1-m10', lines: [{ de: 'Die Nacht war kalt und das Haus alt.', zh: '夜里很冷，房子很旧。' }] };
    const both = itemsFromDialogue(dial, 'A1',
      { [nacht.id]: { due: '2026-09-27' }, [haus.id]: { due: '2026-09-27' } });
    assert.strictEqual(both.length, 1);
    assert.strictEqual(both[0].target.id, nacht.id, '应取已学且最长的词（Nacht 5 > Haus 4）');
    assert.strictEqual(both[0].blanked, '___ war kalt und das Haus alt.');
    assert.strictEqual(both[0].vid, nacht.id);
    assert.strictEqual(both[0].source, 'dialog');
    assert.strictEqual(both[0].sentZh, '夜里很冷，房子很旧。');
    assert.deepStrictEqual(both[0].ref, { dialogueId: 'dl-a1-m10', lineIndex: 0 });
    // 只学 Haus：未学（无卡）的 Nacht 不进候选
    const onlyHaus = itemsFromDialogue(dial, 'A1', { [haus.id]: { due: '2026-09-27' } });
    assert.strictEqual(onlyHaus.length, 1);
    assert.strictEqual(onlyHaus[0].target.id, haus.id);
    assert.strictEqual(onlyHaus[0].blanked, 'Die Nacht war kalt und ___ alt.');
    // 全无卡：该行不出题
    assert.strictEqual(itemsFromDialogue(dial, 'A1', {}).length, 0);
    assert.strictEqual(itemsFromDialogue(dial, 'A1', null).length, 0);
  });
});
test('buildClozePool：全 A1 有卡时并入对话/阅读句源，vid 均为已学且可解析的 A1 词', function () {
  withBrowserData(function () {
    const srs = {};
    allWords.filter(function (w) { return w.level === 'A1'; }).forEach(function (w) { srs[w.id] = { due: today() }; });
    const pool = buildClozePool('A1', srs);
    const by = { word: 0, dialog: 0, reading: 0 };
    pool.forEach(function (it) { by[it.source] = (by[it.source] || 0) + 1; });
    assert.ok(by.dialog > 0 && by.reading > 0, '应有对话/阅读句源：' + JSON.stringify(by));
    const idx = {};
    allWords.forEach(function (w) { idx[w.id] = w; });
    pool.forEach(function (it) {
      assert.ok(idx[it.vid], 'vid 必须能解析：' + it.vid);
      assert.strictEqual(it.target.id, it.vid);
      assert.ok(it.blanked.indexOf('___') >= 0, '挖空句必须含 ___：' + it.blanked);
      if (it.source === 'word') return;
      assert.ok(srs[it.vid], it.source + ' 句源的 target 必须是已学（有卡）词：' + it.vid);
      assert.strictEqual(idx[it.vid].level, 'A1');
      assert.ok(it.sentZh, it.source + ' 句源应有中文：' + it.sent);
      assert.ok(clozeTokenTier(it.sent, it.target.de.replace(/^(der|die|das) /, '')),
        'target 必须真的出现在句中：' + it.target.de + ' || ' + it.sent);
    });
  });
});
test('buildClozePool：对话句 target 是句中「已学最长」词（20 组对话全量 + 独立 oracle 复算）', function () {
  withBrowserData(function () {
    const srs = {};
    const forms = [];
    allWords.filter(function (w) { return w.level === 'A1'; }).forEach(function (w) {
      srs[w.id] = { due: today() };
      forms.push(w.de.replace(/^(der|die|das) /, ''));
    });
    const items = buildClozePool('A1', srs).filter(function (it) { return it.source === 'dialog'; });
    assert.ok(items.length > 20, '对话句源应足够多，实际 ' + items.length);
    items.forEach(function (it) {
      const exact = forms.filter(function (f) { return clozeTokenTier(it.sent, f) === 'exact'; });
      const flex = forms.filter(function (f) { return clozeTokenTier(it.sent, f) === 'flex'; });
      const inTier = exact.length ? exact : flex; // 与 cloze 同款分层：先精确类，无精确命中才用形态变体类
      const maxLen = Math.max.apply(null, inTier.map(function (f) { return clozeFold(f).length; }));
      const len = clozeFold(it.target.de.replace(/^(der|die|das) /, '')).length;
      assert.strictEqual(len, maxLen, '应选中句中已学最长的词（实际 ' + it.target.de + '，上界 ' + maxLen + '）：' + it.sent);
    });
  });
});
test('buildClozePool：级别过滤——A1 池不出现 a2-/b1- vid；A2 池含 a2- 且不混入 b1-', function () {
  withBrowserData(function () {
    const srs = {};
    allWords.forEach(function (w) { srs[w.id] = { due: today() }; }); // 全库有卡，最严苛
    const a1 = buildClozePool('A1', srs);
    const leak = a1.filter(function (it) { return /^(a2-|b1-)/.test(it.vid); });
    assert.strictEqual(leak.length, 0, 'A1 池混入高级别词：' + leak.slice(0, 3).map(function (x) { return x.vid; }).join(','));
    assert.ok(a1.every(function (it) { return it.target.level === 'A1'; }));
    const a2 = buildClozePool('A2', srs);
    assert.ok(a2.some(function (it) { return /^a2-/.test(it.vid); }), 'A2 池应含 a2- 词');
    assert.strictEqual(a2.filter(function (it) { return /^b1-/.test(it.vid); }).length, 0, 'A2 池不应混入 b1- 词');
    assert.ok(a2.every(function (it) { return it.target.level === 'A1' || it.target.level === 'A2'; }));
  });
});
test('pickCloze：到期 → 学习中 → 新词，vid 去重、上限 n 生效', function () {
  const mk = function (vid) { return { vid: vid, sent: 'x', sentZh: 'x', blanked: '___', target: { id: vid }, source: 'word', ref: null }; };
  const srs = {
    'due-1': { due: '2026-09-27' },
    'due-2': { due: '2026-09-20' },
    'learn-1': { due: '2099-01-01' },
    'sealed-1': { due: '2026-09-27', sealed: true }, // 已斩：不算到期，落到「学习中」
    'verify-1': { due: '2099-01-01', verify: true }
  };
  const pool = [mk('new-1'), mk('due-1'), mk('learn-1'), mk('new-2'), mk('due-1'), mk('sealed-1'), mk('verify-1'), mk('due-2')];
  const idsOf = function (arr) { return arr.map(function (x) { return x.vid; }); };
  const all = idsOf(pickCloze(pool, srs, '2026-09-27', 99));
  assert.deepStrictEqual(all, ['due-1', 'due-2', 'learn-1', 'sealed-1', 'verify-1', 'new-1', 'new-2']);
  assert.strictEqual(all.filter(function (x) { return x === 'due-1'; }).length, 1, 'vid 必须去重');
  assert.deepStrictEqual(idsOf(pickCloze(pool, srs, '2026-09-27', 2)), ['due-1', 'due-2'], '上限 n 生效');
  assert.deepStrictEqual(idsOf(pickCloze(pool, srs, '2026-09-27')), ['due-1'], 'n 缺省为 1');
  assert.deepStrictEqual(idsOf(pickCloze(pool, {}, '2026-09-27', 99)),
    ['new-1', 'due-1', 'learn-1', 'new-2', 'sealed-1', 'verify-1', 'due-2'], '无卡全为新词且保持池内顺序');
  assert.deepStrictEqual(idsOf(pickCloze(null, srs, '2026-09-27', 5)), []);
});
test('pickClozeDistractors：不含答案（id/释义双向去重）、同主题同词性优先、样本不足时全库补足', function () {
  const target = { id: 'g-0', zh: '苹果', g: 'n', theme: 'a' };
  const words = [
    { id: 'a-1', zh: '香蕉', g: 'n', theme: 'a' },
    { id: 'a-2', zh: '橙子', g: 'n', theme: 'a' },
    { id: 'b-1', zh: '梨', g: 'n', theme: 'b' },
    { id: 'a-3', zh: '跑步', g: 'v', theme: 'a' },
    { id: 'c-1', zh: '桌子', g: 'm', theme: 'c' },
    { id: 'd-1', zh: '苹果', g: 'n', theme: 'd' }, // 与答案同释义：必须排除
    { id: 'g-0', zh: '苹果', g: 'n', theme: 'a' }   // 与答案同 id：必须排除
  ];
  const pool = words.map(function (x) { return { vid: x.id, target: x }; });
  const item = { vid: target.id, target: target };
  const ds = pickClozeDistractors(item, pool, 3);
  assert.deepStrictEqual(ds.map(function (x) { return x.id; }), ['a-1', 'a-2', 'b-1'],
    '分层应为 同主题同词性 → 同词性 → 同主题 → 其余');
  assert.ok(ds.every(function (x) { return x.id !== target.id && x.zh !== target.zh; }), '干扰项不得含答案或同释义');
  assert.strictEqual(pickClozeDistractors(item, pool, 1).length, 1);
  withBrowserData(function () {
    const real = allWords.find(function (w) { return w.level === 'A1' && w.g === 'm' && w.de === 'der Tag'; }) ||
      allWords.find(function (w) { return w.level === 'A1' && w.g === 'm'; });
    assert.ok(real, '测试数据依赖：A1 词库应有阳性名词');
    const full = pickClozeDistractors({ vid: real.id, target: real }, [], 3);
    assert.strictEqual(full.length, 3, '池内样本不足时应由全词库补足 n 个');
    assert.strictEqual(new Set(full.map(function (x) { return x.id; })).size, 3);
    assert.ok(full.every(function (x) { return x.id !== real.id && x.zh !== real.zh; }));
  });
});

/* ---------- 变格专项（M8/S9）数据完整性 + dc- 卡 id ---------- */

console.log('\n变格专项（M8）数据完整性：');
test('变格专项：恰好 6 专题、id 为 dc- 前缀且唯一、每专题 ≥6 题、总数 50', function () {
  loadDataFile('../data/declension.js');
  const d = dataWindow.DECLENSION;
  assert.ok(Array.isArray(d), 'window.DECLENSION 应为数组');
  assert.strictEqual(d.length, 6, '应为恰好 6 个专题，实际 ' + d.length);
  const ids = d.map(function (t) { return t.id; });
  assert.strictEqual(new Set(ids).size, ids.length, '专题 id 必须唯一');
  ids.forEach(function (id) {
    assert.ok(/^dc-[\w-]+$/.test(id), 'id 必须以 dc- 开头且不含 #：' + id);
  });
  let total = 0;
  d.forEach(function (t) {
    assert.ok(t.id && t.title && t.level, t.id + ' 缺 id/title/level');
    assert.ok(['A1', 'A2', 'B1'].indexOf(t.level) >= 0, t.id + ' level 非法：' + t.level);
    assert.ok(t.exercises.length >= 6, t.id + ' 题目不足 6 题：' + t.exercises.length);
    total += t.exercises.length;
  });
  assert.strictEqual(total, 50, '题目总数应为 50，实际 ' + total);
});
test('变格专项：choice 的 opts/a 合法、fill 的 a 非空、题干与 tip 非空、选项不重复', function () {
  loadDataFile('../data/declension.js');
  dataWindow.DECLENSION.forEach(function (t) {
    t.exercises.forEach(function (e, i) {
      const at = t.id + '#' + i;
      assert.ok(['choice', 'fill'].indexOf(e.type) >= 0, at + ' 题型非法：' + e.type);
      assert.ok(e.q && String(e.q).trim(), at + ' 题干为空');
      assert.ok(e.tip && String(e.tip).trim(), at + ' 解析（tip）为空');
      if (e.type === 'choice') {
        assert.ok(Array.isArray(e.opts) && e.opts.length >= 2, at + ' choice 缺 opts');
        assert.ok(Number.isInteger(e.a) && e.a >= 0 && e.a < e.opts.length, at + ' a 索引非法：' + e.a);
        assert.strictEqual(new Set(e.opts).size, e.opts.length, at + ' 选项重复');
        assert.ok(e.opts.every(function (o) { return o && String(o).trim(); }), at + ' 存在空选项');
      } else {
        assert.ok(typeof e.a === 'string' && e.a.trim(), at + ' fill 缺非空答案');
      }
    });
  });
});

console.log('\n卡 id 谓词（变格卡 dc-…#n）：');
test('dc-<topicId>#<i> 命中语法卡谓词、不被听力卡谓词命中（与 g-/listen- 互斥不回归）', function () {
  loadDataFile('../data/declension.js');
  const d = dataWindow.DECLENSION;
  const ids = [];
  d.forEach(function (t) {
    t.exercises.forEach(function (e, i) { ids.push(t.id + '#' + i); });
  });
  assert.strictEqual(ids.length, 50);
  assert.strictEqual(new Set(ids).size, 50, '变格卡 id 必须全局唯一');
  ids.forEach(function (id) {
    assert.ok(isGrammarCardId(id), id + ' 必须进语法复习队列（到期过滤与语法复习页共用）');
    assert.ok(!isListenCardId(id), id + ' 不得被误判为听力卡');
  });
  // 反例：听力卡仍只被听力谓词命中；语法卡仍只被语法谓词命中；词汇卡两类都不是
  assert.ok(isListenCardId('listen-dl-a1-greet#0') && !isGrammarCardId('listen-dl-a1-greet#0'));
  assert.ok(isGrammarCardId('g-praesens#2') && !isListenCardId('g-praesens#2'));
  assert.ok(!isGrammarCardId('greet-0') && !isListenCardId('greet-0'));
  // 专题 id 本身不含 #，不是卡
  assert.ok(!isGrammarCardId(d[0].id) && !isListenCardId(d[0].id));
});

/* ---------- 内容残留黑名单（4.6.0 发布防回归） ----------
   本次发布修掉了两处「编辑残留渲染给学习者」的缺陷（grammar_a2.js 的 der Neighbor→Nachbar、
   grammar_b1.js 题干里作者起草时的自问批注）。既有测试只校验语法专题的结构与题量，不校验文本，
   所以这里补有限黑名单：用具体残留词，不做「禁止长串 ASCII 字母」这类激进规则（会误伤德语词与 HTML）。 */
function forEachContentField(fn) {
  loadDataFile('../data/grammar.js');
  loadDataFile('../data/grammar_a2.js');
  loadDataFile('../data/grammar_b1.js');
  loadDataFile('../data/declension.js');
  const topics = (dataWindow.GRAMMAR || []).concat(dataWindow.DECLENSION || []);
  topics.forEach(function (t) {
    ['id', 'title', 'summary', 'lesson'].forEach(function (k) {
      if (t[k] !== undefined && t[k] !== null) fn(t.id + '.' + k, t[k]);
    });
    (t.exercises || []).forEach(function (e, i) {
      const at = t.id + '#' + i;
      ['q', 'tip'].forEach(function (k) {
        if (e[k] !== undefined && e[k] !== null) fn(at + '.' + k, e[k]);
      });
      if (e.type === 'choice') {
        (e.opts || []).forEach(function (o, j) { fn(at + '.opts[' + j + ']', o); });
      } else if (e.a !== undefined && e.a !== null) {
        fn(at + '.a', e.a);
      }
    });
  });
}

console.log('\n内容残留黑名单（发布防回归）：');
test('语法/变格专题文本不得含编辑残留词（Neighbor/TODO/FIXME/TBD/WIP/placeholder）', function () {
  const RX = /Neighbor|Neighbour|TODO|FIXME|TBD|WIP|placeholder/i;
  const hits = [];
  let checked = 0;
  forEachContentField(function (at, text) {
    checked++;
    if (RX.test(String(text))) hits.push(at);
  });
  assert.ok(checked > 500, '应扫描到足够多的文本字段，实际 ' + checked);
  assert.strictEqual(hits.length, 0, '发现编辑残留词：' + hits.slice(0, 5).join(', '));
});
test('语法/变格题干不得含括号内自问批注（作者起草残留）', function () {
  const RX = /（[^）]*[？?][^）]*）/;
  const hits = [];
  let checked = 0;
  // 只查题干 q：lesson 里「Wie schreibt man das?（这个怎么写？）」是德语句 + 中文译文的正常教学内容
  forEachContentField(function (at, text) {
    if (!/#\d+\.q$/.test(at)) return;
    checked++;
    if (RX.test(String(text))) hits.push(at + ' :: ' + String(text).slice(0, 60));
  });
  assert.ok(checked > 200, '应扫描到足够多的题干，实际 ' + checked);
  assert.strictEqual(hits.length, 0, '题干含括号内自问批注（起草残留）：' + hits.join(' | '));
});

console.log('变位查询（conjugate.js）：');
test('不规则动词 fahren', function () {
  const d = lookup('fahren');
  assert.deepStrictEqual(d.forms.slice(0, 3), ['fahre', 'fährst', 'fährt']);
  assert.strictEqual(d.pp[1], 'gefahren');
});
test('规则动词 lernen', function () {
  const d = lookup('lernen');
  assert.deepStrictEqual(d.forms, ['lerne', 'lernst', 'lernt', 'lernen', 'lernt', 'lernen']);
});
test('词干以 t 结尾：arbeiten → du arbeitest', function () {
  const d = lookup('arbeiten');
  assert.strictEqual(d.forms[1], 'arbeitest');
  assert.strictEqual(d.forms[2], 'arbeitet');
});
test('词干以 s 结尾：reisen → du reist', function () {
  assert.strictEqual(lookup('reisen').forms[1], 'reist');
});
test('-ieren 动词分词不加 ge', function () {
  assert.strictEqual(lookup('studieren').pp[1], 'studiert');
});
test('可分动词 aufstehen', function () {
  const d = lookup('aufstehen');
  assert.strictEqual(d.forms[2], 'steht auf');
  assert.strictEqual(d.pp[1], 'aufgestanden');
});
test('非动词输入返回 null', function () {
  assert.strictEqual(lookup(''), null);
});

console.log('\n图片题选题逻辑：');
test('pickImageDistractors 同主题优先、去重、排除答案', function () {
  const img = ['a-0','a-1','a-2','a-3','b-0','b-1'];
  const pool = [
    {id:'a-0',zh:'苹果',theme:'a',level:'A1'},{id:'a-1',zh:'香蕉',theme:'a',level:'A1'},
    {id:'a-2',zh:'橙子',theme:'a',level:'A1'},{id:'a-3',zh:'葡萄',theme:'a',level:'A1'},
    {id:'b-0',zh:'桌子',theme:'b',level:'A1'},{id:'b-1',zh:'苹果',theme:'b',level:'A1'} // 同释义应排除
  ];
  const w = pool[0];
  const ds = pickImageDistractors(w, img, pool);
  assert.strictEqual(ds.length, 3);
  assert.ok(ds.every(function (d) { return d.id !== 'a-0' && d.zh !== '苹果'; }));
  assert.ok(ds.filter(function (d) { return d.theme === 'a'; }).length >= 2, '应优先同主题');
});
test('pickImageDistractors 同主题不足时跨主题补足', function () {
  const img = ['a-0','b-0','b-1','b-2'];
  const pool = [
    {id:'a-0',zh:'苹果',theme:'a',level:'A1'},
    {id:'b-0',zh:'香蕉',theme:'b',level:'A1'},{id:'b-1',zh:'橙子',theme:'b',level:'A1'},{id:'b-2',zh:'葡萄',theme:'b',level:'A1'}
  ];
  assert.strictEqual(pickImageDistractors(pool[0], img, pool).length, 3);
});
test('无图词 hasImage 为 false', function () {
  assert.strictEqual(hasImage({id:'x-0'}, ['a-0']), false);
  assert.strictEqual(hasImage({id:'a-0'}, ['a-0']), true);
});
test('正确图位置参与洗牌（不固定在第 4 格）', function () {
  let pos3 = 0;
  const seen = {};
  for (let i = 0; i < 100; i++) {
    const order = orderImageChoices('c', ['a', 'b', 'd']);
    assert.strictEqual(order.length, 4);
    assert.strictEqual(order.slice().sort().join(''), 'abcd');
    seen[order.indexOf('c')] = 1;
    if (order.indexOf('c') === 3) pos3++;
  }
  assert.ok(Object.keys(seen).length > 1, '正确图位置应随洗牌变化，实际只出现: ' + Object.keys(seen).join(','));
  assert.ok(pos3 < 100, '正确图不应永远在第 4 格');
});

console.log('\n复习队列排序（遗忘曲线）：');
test('orderReviewQueue：verify/错词优先，其余按可提取度升序', function () {
  const todayStr = '2026-09-06';
  const mk = function (id, s, last) { return { id: id, de: id, zh: id, ex: '', exZh: '', g: 'm' }; };
  const words = [mk('a', 0, ''), mk('b'), mk('c')];
  const srsMap = {
    a: { stability: 10, last: '2026-09-01' },
    b: { stability: 2, last: '2026-09-01' },
    c: { stability: 50, last: '2026-09-01', verify: true }
  };
  const ordered = orderReviewQueue(words, srsMap, todayStr);
  assert.strictEqual(ordered[0].id, 'c', 'verify 卡最优先');
  assert.strictEqual(ordered[1].id, 'b', '低稳定度优先于高稳定度');
});

console.log('\n拼写提示遮罩：');
test('maskWordHalf 揭示前半', function () {
  assert.strictEqual(maskWordHalf('lernen'), 'ler···');
  assert.strictEqual(maskWordHalf('der Tag'), 'der Ta·');
});

console.log('\n词性标签（detailDrawer 词性行依赖）：');
test('posLabel：名词四格用冠词，动词/副词等用中文名，不抛错', function () {
  assert.strictEqual(posLabel('m'), 'der');
  assert.strictEqual(posLabel('f'), 'die');
  assert.strictEqual(posLabel('n'), 'das');
  assert.strictEqual(posLabel('pl'), 'die');
  assert.strictEqual(posLabel('v'), '动词');
  assert.strictEqual(posLabel('adj'), '形容词');
  assert.strictEqual(posLabel('adv'), '副词');
  assert.strictEqual(posLabel('num'), '数词');
  assert.strictEqual(posLabel('pron'), '代词');
  assert.strictEqual(posLabel('phrase'), '短语');
  assert.strictEqual(posLabel('conj'), '连词');
  assert.strictEqual(posLabel('part'), '小品词');
});
test('genderTag：名词保留三色角标，非名词降级纯文本 pos-tag，不抛错', function () {
  assert.ok(genderTag('m').indexOf('gender-tag m') > 0);
  assert.ok(genderTag('m').indexOf('der') > 0);
  assert.ok(genderTag('pl').indexOf('gender-tag pl') > 0);
  const v = genderTag('v');
  assert.ok(v.indexOf('pos-tag') > 0);
  assert.ok(v.indexOf('动词') > 0);
  assert.ok(v.indexOf('gender-tag') === -1, '动词不应使用 gender-tag 类');
  assert.ok(genderTag('adv').indexOf('副词') > 0);
  assert.strictEqual(genderTag('xyz'), '<span class="pos-tag">xyz</span>', '未知标记原样返回');
});

console.log('\n词性题守卫（canAskGender / gender 题型）：');
test('canAskGender：仅名词类（m/f/n/pl）为真，非名词为假；m 的答案下标是 0，不能用真值判断', function () {
  ['m', 'f', 'n', 'pl'].forEach(function (g) {
    assert.strictEqual(canAskGender({ g: g }), true, g + ' 可以出词性题');
  });
  ['v', 'adj', 'adv', 'num', 'pron', 'phrase', 'part', 'conj'].forEach(function (g) {
    assert.strictEqual(canAskGender({ g: g }), false, g + ' 没有词性题正确答案');
  });
  // GENDER_IDX.m === 0：若把谓词写成 if (GENDER_IDX[w.g]) / 真值判断，阳性名词会被误判为「不能出题」
  assert.strictEqual(canAskGender({ g: 'm' }), true, 'm 映射下标 0，谓词必须用 !== undefined 判断');
  assert.strictEqual(canAskGender(null), false);
  assert.strictEqual(canAskGender(undefined), false);
  assert.strictEqual(canAskGender({}), false);
  assert.strictEqual(canAskGender({ g: 'xyz' }), false);
  assert.strictEqual(canAskGender({ g: '' }), false);
});
test('数据不变量：凡 canAskGender 为真的词条，词性题答案下标均存在（全库逐词核对）', function () {
  loadDataFile('../data/vocabulary.js');
  loadDataFile('../data/vocabulary_a2.js');
  loadDataFile('../data/vocabulary_b1.js');
  const GENDER_IDX = { m: 0, f: 1, n: 2, pl: 1 };
  const seen = {};
  let askable = 0, nonNoun = 0;
  dataWindow.VOCAB_THEMES.forEach(function (th) {
    th.words.forEach(function (w) {
      seen[w[1]] = (seen[w[1]] || 0) + 1;
      if (!canAskGender({ g: w[1] })) { nonNoun++; return; }
      askable++;
      assert.notStrictEqual(GENDER_IDX[w[1]], undefined, w[0] + '（' + w[1] + '）会出词性题但没有正确答案');
      assert.ok(GENDER_IDX[w[1]] >= 0 && GENDER_IDX[w[1]] < 3, w[0] + ' 答案下标越界');
    });
  });
  ['m', 'f', 'n', 'pl'].forEach(function (g) {
    assert.ok(seen[g] > 0, '词库应含 ' + g + ' 词条（否则该分支没被真实数据覆盖）');
  });
  assert.ok(askable >= 1000 && nonNoun >= 400, '词库构成异常：名词类 ' + askable + ' / 非名词 ' + nonNoun);
});

/* 最小 DOM stub：只覆盖 Vocab.reviewSession 渲染路径用到的 API（不引第三方依赖）。
   仅在这些行为级测试内挂到 globalThis.document 上，测试结束还原。 */
function makeFakeDom() {
  function El(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this._html = '';
    this.style = {};
    this.attrs = {};
    this.disabled = false;
    this.title = '';
    this.value = '';
    this.onclick = null;
    const self = this;
    this.classList = {
      add: function (c) { const s = self._cls(); if (s.indexOf(c) < 0) { s.push(c); self.className = s.join(' '); } },
      remove: function (c) { self.className = self._cls().filter(function (x) { return x !== c; }).join(' '); },
      contains: function (c) { return self._cls().indexOf(c) >= 0; },
      toggle: function (c, on) {
        const want = on === undefined ? self._cls().indexOf(c) < 0 : !!on;
        if (want) self.classList.add(c); else self.classList.remove(c);
        return want;
      }
    };
  }
  El.prototype._cls = function () { return String(this.className || '').split(/\s+/).filter(Boolean); };
  El.prototype.appendChild = function (c) { this.children.push(c); if (c) c.parentNode = this; return c; };
  El.prototype.insertBefore = function (c, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    if (c) c.parentNode = this;
    return c;
  };
  El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
  El.prototype.getAttribute = function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; };
  El.prototype.focus = function () { this.focused = true; };
  El.prototype.querySelectorAll = function (sel) {
    const cls = String(sel).replace(/^\./, '');
    const out = [];
    (function walk(n) {
      (n.children || []).forEach(function (c) {
        if (c._cls().indexOf(cls) >= 0) out.push(c);
        walk(c);
      });
    })(this);
    return out;
  };
  Object.defineProperty(El.prototype, 'innerHTML', {
    get: function () { return this._html; },
    set: function (v) { this._html = String(v); this.children = []; }
  });
  Object.defineProperty(El.prototype, 'firstChild', { get: function () { return this.children[0] || null; } });
  Object.defineProperty(El.prototype, 'textContent', {
    get: function () { return this._html.replace(/<[^>]*>/g, ''); },
    set: function (v) { this._html = String(v); }
  });
  return {
    createElement: function (t) { return new El(t); },
    getElementById: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  };
}
function domDescendants(root) {
  const out = [];
  (function walk(n) { (n.children || []).forEach(function (c) { out.push(c); walk(c); }); })(root);
  return out;
}
function domHasClass(e, c) { return String(e.className || '').split(/\s+/).indexOf(c) >= 0; }
function promptText(root) {
  const p = domDescendants(root).filter(function (e) { return domHasClass(e, 'quiz-prompt'); })[0];
  return p ? p.innerHTML : '';
}
function optionEls(root) {
  return domDescendants(root).filter(function (e) { return domHasClass(e, 'opt'); });
}
function feedbackHtml(root) {
  const list = domDescendants(root).filter(function (e) { return String(e._html).indexOf('class="feedback') >= 0; });
  return list.length ? list[list.length - 1]._html : '';
}
/* 驱动生产路径 Vocab.reviewSession：
   - 注入真实词库数据（rebuildWordIndex）；
   - 注入最小 DOM；
   - 打桩 Math.random 成 [0.9, 0.0] 循环：① 0.9 ≥ 0.25 跳过 ctxcloze ② floor(0.0*5)=0 → 'gender'。
     （不注入 IMAGE_WORDS，图片题分支 hasImage(...) 为假短路、不消耗随机数，故每道题恰好消耗 2 个随机数） */
function withReviewEnv(fn) {
  ensureBrowserData();
  const prevWin = globalThis.window, prevDoc = globalThis.document, prevRandom = Math.random;
  const prevSrs = store.state.srs, prevMistakes = store.state.mistakes;
  globalThis.window = browserWindow;
  globalThis.document = makeFakeDom();
  const seq = [0.9, 0.0];
  let i = 0;
  Math.random = function () { const v = seq[i % seq.length]; i++; return v; };
  rebuildWordIndex();
  try { return fn(); }
  finally {
    Math.random = prevRandom;
    store.state.srs = prevSrs;
    store.state.mistakes = prevMistakes;
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    rebuildWordIndex();
  }
}
function reviewFirstQuestion(word) {
  store.state.srs = {};
  store.state.mistakes = {};
  // 必须是完整的「已学卡」：缺 reps/difficulty 会让 SRS.review 走非首次分支却算出 NaN 稳定度，
  // due 变成 'NaN-NaN-NaN'——而 'NaN-…' > '2026-…' 字符串比较恒真，断言会静默空转
  store.state.srs[word.id] = Object.assign(SRS.newCard(today()), {
    stability: 2, difficulty: 5, reps: 3, last: today()
  });
  return Vocab.reviewSession();
}

test('行为级：非名词词条不出词性题（生产路径 Vocab.reviewSession + DOM stub + Math.random 打桩）', function () {
  withReviewEnv(function () {
    const verb = allWords.find(function (w) { return w.level === 'A1' && w.g === 'v' && w.de === 'wohnen'; }) ||
      allWords.find(function (w) { return w.level === 'A1' && w.g === 'v'; });
    assert.ok(verb, '测试数据依赖：A1 词库应有动词');
    assert.strictEqual(canAskGender(verb), false);
    const v = reviewFirstQuestion(verb);
    const prompt = promptText(v);
    assert.strictEqual(prompt.indexOf('这个词的词性是？'), -1,
      '非名词不得出词性题（answerIdx 会是 undefined，三个选项全错）：' + prompt);
    const opts = optionEls(v);
    assert.strictEqual(opts.length, 4, '应回退为四选一（看德语选中文），实际 ' + opts.length + ' 个：' +
      opts.map(function (o) { return o.innerHTML; }).join(' | '));
    const right = opts.filter(function (o) { return o.innerHTML === escHtml(verb.zh); });
    assert.strictEqual(right.length, 1, '选项里必须恰好有一个正确答案（' + verb.zh + '）：' +
      opts.map(function (o) { return o.innerHTML; }).join(' | '));
    right[0].onclick(); // 真点一次：必须判对并 review(2)
    assert.ok(feedbackHtml(v).indexOf('正确') >= 0, '点击正确答案应给正确反馈：' + feedbackHtml(v));
    const after = store.state.srs[verb.id];
    // 先钉住日期合法：坏掉的日期（如 'NaN-NaN-NaN'）在字符串比较里反而「大于」今天，会让下一条断言空转
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(after.due), '答对后到期日必须是合法日期：' + after.due);
    assert.ok(after.due > today(), '答对后应推后到期日：' + after.due);
  });
});
test('行为级：名词词条仍出词性三选一，且阳性名词点 der 判对（GENDER_IDX.m === 0）', function () {
  withReviewEnv(function () {
    const noun = allWords.find(function (w) { return w.level === 'A1' && w.g === 'm' && w.de === 'der Tag'; }) ||
      allWords.find(function (w) { return w.level === 'A1' && w.g === 'm'; });
    assert.ok(noun, '测试数据依赖：A1 词库应有阳性名词');
    assert.strictEqual(canAskGender(noun), true);
    const v = reviewFirstQuestion(noun);
    assert.ok(promptText(v).indexOf('这个词的词性是？') >= 0, '名词应出词性题：' + promptText(v));
    const opts = optionEls(v);
    assert.deepStrictEqual(opts.map(function (o) { return o.innerHTML; }), ['der（阳性）', 'die（阴性）', 'das（中性）']);
    assert.ok(opts[0].innerHTML.indexOf('der') >= 0);
    opts[0].onclick(); // m → 下标 0 = der
    assert.ok(feedbackHtml(v).indexOf('正确') >= 0,
      '阳性名词点「der（阳性）」必须判对（m 的答案下标是 0）：' + feedbackHtml(v));
  });
});

console.log('\n再练队列（百词斩式错词复现）：');
test('再练队列：答错词隔 3 张复现，超上限不再出现', function () {
  const rq = makeRequeue(2);
  rq.push({ id: 'a-0' });
  assert.strictEqual(rq.take(1), null);
  assert.strictEqual(rq.take(3).id, 'a-0');
  rq.push({ id: 'a-0' }); rq.push({ id: 'a-0' }); // 第 3、4 次 push 超上限被忽略
  assert.strictEqual(rq.countOf('a-0'), 2);
  rq.take(3);
  assert.strictEqual(rq.take(3), null, '达到上限后队列为空');
});

test('再练队列 drain：非 3 倍数位置可取、取空返回 null、超 maxRounds 不再出现', function () {
  const rq = makeRequeue(2);
  rq.push({ id: 'b-0' });
  assert.strictEqual(rq.take(1), null, '非 3 倍数 take 仍被闸住');
  const w = rq.drain();
  assert.strictEqual(w.id, 'b-0', 'drain 无视 %3 闸取出队首');
  assert.strictEqual(rq.drain(), null, '取空后返回 null');
  rq.push({ id: 'b-1' }); rq.push({ id: 'b-1' }); rq.push({ id: 'b-1' }); // 第 3 次 push 超上限被忽略
  assert.strictEqual(rq.countOf('b-1'), 2);
  assert.strictEqual(rq.drain().id, 'b-1');
  assert.strictEqual(rq.drain().id, 'b-1');
  assert.strictEqual(rq.drain(), null, '超 maxRounds 的词不再出现');
});

console.log('\n真人发音回退链与一次性语速：');
test('pickWordSrc：真人发音优先于 TTS 预生成', function () {
  const native = { 'greet-0': 'native/greet-0.ogg' };
  const words = new Set(['greet-0', 'greet-1']);
  assert.strictEqual(pickWordSrc('greet-0', native, words), 'audio/native/greet-0.ogg');
});
test('pickWordSrc：无真人发音回退到 word mp3', function () {
  const words = new Set(['greet-1']);
  assert.strictEqual(pickWordSrc('greet-1', {}, words), 'audio/word/greet-1.mp3');
  assert.strictEqual(pickWordSrc('greet-1', null, words), 'audio/word/greet-1.mp3');
});
test('pickWordSrc：都没有返回 null', function () {
  assert.strictEqual(pickWordSrc('x-9', {}, new Set()), null);
});
test('resolveRate：一次性 rate 覆盖全局，缺省用全局', function () {
  assert.strictEqual(resolveRate(0.5, 1), 0.5);
  assert.strictEqual(resolveRate(undefined, 0.9), 0.9);
  assert.strictEqual(resolveRate(null, 0.75), 0.75);
});
test('getWordIpa：命中返回音标，缺失返回 null', function () {
  globalThis.window = { WORD_IPA: { 'greet-0': 'ˈtaːk' } };
  try {
    assert.strictEqual(getWordIpa('greet-0'), 'ˈtaːk');
    assert.strictEqual(getWordIpa('greet-9'), null);
  } finally {
    delete globalThis.window;
  }
});

console.log('\n音频元素池与手势解锁（iOS 需要手势，见 src/audio.js 头部注释）：');

/* 音频层需要 Audio / Blob / URL / document，用最小桩把真实生产代码跑起来。
   state.impl 决定 play() 成功还是被拒（NotAllowedError 模拟 iOS 手势外的情况）。 */
function withAudioEnv(state, fn) {
  const prev = {
    Audio: globalThis.Audio, Blob: globalThis.Blob, URL: globalThis.URL,
    document: globalThis.document, window: globalThis.window
  };
  const created = [];
  const listeners = {};
  const bodyClasses = [];
  const blobs = [];
  function FakeAudio() {
    created.push(this);
    this.paused = true; this.currentTime = 0; this.playbackRate = 1; this.src = '';
    this.handlers = {}; this.playCalls = 0;
  }
  FakeAudio.prototype.play = function () { this.playCalls++; this.paused = false; return state.impl(this); };
  FakeAudio.prototype.pause = function () { this.paused = true; };
  FakeAudio.prototype.addEventListener = function (t, h) { (this.handlers[t] = this.handlers[t] || []).push(h); };
  FakeAudio.prototype.removeEventListener = function (t, h) {
    const a = this.handlers[t] || []; const i = a.indexOf(h); if (i >= 0) a.splice(i, 1);
  };
  globalThis.Audio = FakeAudio;
  // 记录 Blob 的原始字节，供「静音 WAV 是不是合法 RIFF」的断言取回校验
  globalThis.Blob = function (parts) { blobs.push(parts); };
  globalThis.URL = { createObjectURL: function () { return 'blob:silent'; }, revokeObjectURL: function () {} };
  globalThis.document = {
    body: { classList: { add: function (c) { bodyClasses.push(c); }, remove: function () {} } },
    addEventListener: function (t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener: function (t, h) { const a = listeners[t] || []; const i = a.indexOf(h); if (i >= 0) a.splice(i, 1); },
    readyState: 'complete'
  };
  globalThis.window = { AUDIO_WORDS: ['greet-0', 'greet-1'] };
  AudioLayer._resetPool();

  const env = {
    created: created, listeners: listeners, bodyClasses: bodyClasses, blobs: blobs,
    fire: function (type) { (listeners[type] || []).slice().forEach(function (h) { h({ type: type }); }); }
  };
  const cleanup = function () {
    AudioLayer._resetPool();
    globalThis.Audio = prev.Audio; globalThis.Blob = prev.Blob; globalThis.URL = prev.URL;
    if (prev.document === undefined) delete globalThis.document; else globalThis.document = prev.document;
    if (prev.window === undefined) delete globalThis.window; else globalThis.window = prev.window;
  };
  let out;
  try { out = fn(env); } catch (e) { cleanup(); throw e; }
  if (out && typeof out.then === 'function') {
    return out.then(function (v) { cleanup(); return v; }, function (e) { cleanup(); throw e; });
  }
  cleanup();
  return out;
}
function rejectNotAllowed() {
  const e = new Error('play() failed because the user did not interact');
  e.name = 'NotAllowedError';
  return Promise.reject(e);
}

test('音频元素被复用：连续播放不新建元素（iOS 解锁要求复用同一元素）', function () {
  return withAudioEnv({ impl: function () { return Promise.resolve(); } }, function (env) {
    AudioLayer.init();
    assert.strictEqual(AudioLayer.audio.playWord('greet-0', 'der Tag'), true);
    assert.strictEqual(AudioLayer.audio.playWord('greet-1', 'die Nacht'), true);
    assert.strictEqual(AudioLayer.audio.playWord('greet-0', 'der Tag'), true);
    assert.strictEqual(env.created.length, 2,
      '三次播放应只用池里已有的 2 个元素，实际新建了 ' + env.created.length + ' 个');
  });
});

test('手势监听：用 WebKit 认定的四种手势，不含 pointerdown', function () {
  return withAudioEnv({ impl: function () { return Promise.resolve(); } }, function (env) {
    AudioLayer.init();
    assert.deepStrictEqual(Object.keys(env.listeners).sort(), ['click', 'doubleclick', 'keydown', 'touchend'],
      'WebKit 只认 touchend/click/doubleclick/keydown 的处理函数；pointerdown 不在名单里');
    assert.strictEqual(env.listeners.pointerdown, undefined, '不得依赖 pointerdown 解锁');
  });
});

/* 解锁/失败上报涉及时序，必须**顺序执行**：本测试框架同步跑完所有 test 体、
   异步断言稍后才执行，若拆成多个测试，模块级状态会被后面的测试改掉（第一版就栽在这）。 */
test('解锁与播放失败上报（顺序断言：拒绝 / 成功 / 手势重试 / 失败可见 / 清除 / 静音素材 / 选元素）', async function () {
  // ① play() 被拒 → 不得谎报已解锁，且失败必须可见可查
  await withAudioEnv({ impl: rejectNotAllowed }, function (env) {
    AudioLayer.init();
    assert.strictEqual(AudioLayer.unlock(), true, 'unlock 应发起预热尝试');
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.strictEqual(AudioLayer.isUnlocked(), false,
          'play() reject 时 unlocked 必须保持 false（WebKit 在手势外会拒）');
        assert.ok(AudioLayer.lastBlockError(), '解锁失败必须上报，不能静默');
        assert.strictEqual(AudioLayer.lastBlockError().name, 'NotAllowedError');
        assert.ok(env.bodyClasses.indexOf('audio-blocked') >= 0, '应加 body 类，让提示真的可见');
        resolve();
      }, 20);
    });
  });

  // ② play() 成功 → 才置为已解锁，且不留失败记录
  await withAudioEnv({ impl: function () { return Promise.resolve(); } }, function () {
    AudioLayer.init();
    AudioLayer.unlock();
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.strictEqual(AudioLayer.isUnlocked(), true, 'resolve 后应已解锁');
        assert.strictEqual(AudioLayer.lastBlockError(), null, '成功路径不应留下失败记录');
        resolve();
      }, 20);
    });
  });

  // ③ 手势触发解锁成功 → 摘掉监听（不再重复预热）
  await withAudioEnv({ impl: function () { return Promise.resolve(); } }, function (env) {
    AudioLayer.init();
    env.fire('touchend');
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.strictEqual(AudioLayer.isUnlocked(), true, '手势内发起 + resolve 后应已解锁');
        assert.strictEqual((env.listeners.touchend || []).length, 0, '解锁成功后应摘掉监听');
        resolve();
      }, 20);
    });
  });

  // ④ 手势触发解锁失败 → 保留监听，等下一次手势重试（否则永久哑）
  await withAudioEnv({ impl: rejectNotAllowed }, function (env) {
    AudioLayer.init();
    const before = (env.listeners.touchend || []).length;
    assert.ok(before > 0, '初次应已注册手势监听');
    env.fire('touchend');
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.strictEqual(AudioLayer.isUnlocked(), false);
        assert.strictEqual((env.listeners.touchend || []).length, before,
          '解锁失败后监听必须保留，否则后续真正的手势再也不重试');
        resolve();
      }, 20);
    });
  });

  // ⑤ 播放被拒 → 可订阅、可查询、带出错 url（供 UI 给可见提示）
  await withAudioEnv({ impl: rejectNotAllowed }, function () {
    AudioLayer.init();
    let seen = null;
    const off = AudioLayer.onBlocked(function (info) { seen = info; });
    AudioLayer.audio.playWord('greet-0', 'der Tag');
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.ok(seen, 'onBlocked 订阅者应被通知');
        assert.strictEqual(seen.name, 'NotAllowedError');
        assert.ok(/greet-0/.test(seen.url), '应带上出错的 url 便于排查，实际：' + seen.url);
        assert.ok(AudioLayer.lastBlockError(), 'lastBlockError() 应可查询');
        off();
        AudioLayer.clearBlockError();
        assert.strictEqual(AudioLayer.lastBlockError(), null, 'clearBlockError 应能清掉');
        resolve();
      }, 20);
    });
  });

  // ⑥ 失败后一旦播放**成功**，必须自动清掉「被拦截」状态
  //    （否则：历史上失败过一次 → 此后每张卡都弹假提示、全站喇叭永久描金边）
  {
    let mode = 'reject';
    await withAudioEnv({
      impl: function () { return mode === 'reject' ? rejectNotAllowed() : Promise.resolve(); }
    }, function (env) {
      AudioLayer.init();
      AudioLayer.audio.playWord('greet-0', 'der Tag');
      return new Promise(function (resolve) {
        setTimeout(function () {
          assert.ok(AudioLayer.lastBlockError(), '先制造一次失败');
          assert.ok(env.bodyClasses.indexOf('audio-blocked') >= 0, '失败时应有可见标记');
          mode = 'resolve';
          AudioLayer.audio.playWord('greet-0', 'der Tag');
          setTimeout(function () {
            assert.strictEqual(AudioLayer.lastBlockError(), null,
              '播放成功后必须自动清掉失败状态，否则历史上失败过一次就会永久弹假提示、喇叭永久描金边');
            resolve();
          }, 20);
        }, 20);
      });
    });
  }

  // ⑦ 解锁素材：运行时生成的静音 WAV 必须是合法 RIFF（iOS 上非法音频换不来播放许可）
  await withAudioEnv({ impl: function () { return Promise.resolve(); } }, function (env) {
    AudioLayer.init();
    AudioLayer.unlock();
    assert.strictEqual(env.blobs.length >= 1, true, '解锁应构造了静音 Blob');
    const bytes = new Uint8Array(env.blobs[0][0]);
    const tag = function (o) { return String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]); };
    assert.strictEqual(bytes.length, 844, '静音 WAV 应为 44 字节头 + 800 采样 = 844 字节');
    assert.strictEqual(tag(0), 'RIFF', '应以 RIFF 开头');
    assert.strictEqual(tag(8), 'WAVE', '应为 WAVE');
    assert.strictEqual(tag(12), 'fmt ', '应含 fmt 块');
    assert.strictEqual(tag(36), 'data', '应含 data 块');
    assert.strictEqual(bytes[44], 0x80, '8-bit PCM 的静音电平应为 0x80');
    assert.strictEqual(bytes[843], 0x80, '末尾采样也应是静音');
    assert.strictEqual(env.created.length, 2, '池应为 2 个元素');
    env.created.forEach(function (a, i) {
      assert.strictEqual(a.src, 'blob:silent', '第 ' + i + ' 个元素应被指向静音源');
    });
  });

  // ⑧ 播放选元素：优先复用**已预热成功**的元素，不轮转到预热失败的（否则又被拒一次）
  {
    let n = 0;
    await withAudioEnv({
      impl: function () { n++; return n === 1 ? Promise.resolve() : rejectNotAllowed(); }
    }, function (env) {
      AudioLayer.init();
      AudioLayer.unlock();
      return new Promise(function (resolve) {
        setTimeout(function () {
          AudioLayer.audio.playWord('greet-0', 'der Tag');
          AudioLayer.audio.playWord('greet-1', 'die Nacht');
          setTimeout(function () {
            // 元素 0：1 次预热 + 2 次业务播放；元素 1：只有 1 次（失败的）预热
            assert.strictEqual(env.created[0].playCalls, 3,
              '业务播放应都落在已预热的元素 0 上，实际 playCalls=' + env.created[0].playCalls);
            assert.strictEqual(env.created[1].playCalls, 1,
              '预热失败的元素 1 不应再被业务播放选中（否则又被拒一次），实际 playCalls=' + env.created[1].playCalls);
            resolve();
          }, 20);
        }, 20);
      });
    });
  }
});

Promise.all(asyncQueue).then(function () {
  console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
  process.exit(failed ? 1 : 0);
});
