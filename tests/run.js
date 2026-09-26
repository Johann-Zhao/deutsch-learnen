/* Node 单元测试：node tests/run.js（ESM） */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as SRS from '../src/srs.js';
import { Storage, today, KEY } from '../src/storage.js';
import { buildWordIndex, isGrammarCardId, isListenCardId, rebuildWordIndex, allWords } from '../src/data.js';
import { store } from '../src/store.js';
import { lookup } from '../src/conjugate.js';
import { pickImageDistractors, hasImage, orderImageChoices } from '../src/imgquiz.js';
import { maskWord, maskWordHalf, orderReviewQueue, makeRequeue, posLabel, genderTag, canAskGender, Vocab } from '../src/vocabulary.js';
import { buildClozePool, pickCloze, pickClozeDistractors, blankSentence, itemsFromDialogue } from '../src/cloze.js';
import { esc as escHtml } from '../src/ui.js';
import { pickWordSrc, pickDialogSrc, pickReadingSrc, resolveRate } from '../src/audio.js';
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

console.log('DeSRS.matches（判分）：');
test('忽略大小写与首尾空格', function () {
  assert.ok(SRS.matches('  Apfel ', 'Apfel'));
});
test('变元音等价输入', function () {
  assert.ok(SRS.matches('uebung', 'Übung'));
  assert.ok(SRS.matches('strasse', 'Straße'));
  assert.ok(SRS.matches('schoen', 'schön'));
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

Promise.all(asyncQueue).then(function () {
  console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
  process.exit(failed ? 1 : 0);
});
