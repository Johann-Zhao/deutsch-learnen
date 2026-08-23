/* Node 单元测试：node tests/run.js */
'use strict';
var assert = require('assert');
var DeSRS = require('../js/srs.js');
var DeStorage = require('../js/storage.js');

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('DeSRS.review：');
test('答对（quality 2）盒子递增', function () {
  var c = DeSRS.newCard('2026-08-01');
  DeSRS.review(c, 2, '2026-08-01');
  assert.strictEqual(c.box, 1);
  assert.strictEqual(c.due, '2026-08-02');
});
test('连对五次后掌握', function () {
  var c = DeSRS.newCard('2026-08-01');
  for (var i = 0; i < 5; i++) DeSRS.review(c, 2, c.due);
  assert.strictEqual(c.box, 5);
  assert.strictEqual(c.mastered, true);
  assert.strictEqual(c.due, '2026-10-02'); // 最后一次在 08-28，+35 天
});
test('答错（quality 0）回盒子 0 且次日到期', function () {
  var c = { box: 4, reps: 5 };
  DeSRS.review(c, 0, '2026-08-01');
  assert.strictEqual(c.box, 0);
  assert.strictEqual(c.due, '2026-08-01'); // 盒子 0 当天/次日再见
  assert.strictEqual(c.lapses, 1);
});
test('模糊（quality 1）降一级但不低于 1', function () {
  var c = { box: 3, reps: 3 };
  DeSRS.review(c, 1, '2026-08-01');
  assert.strictEqual(c.box, 2);
  var c2 = { box: 1, reps: 2 };
  DeSRS.review(c2, 1, '2026-08-01');
  assert.strictEqual(c2.box, 1);
});
test('isDue 判断当天到期', function () {
  assert.ok(DeSRS.isDue({ due: '2026-08-01' }, '2026-08-01'));
  assert.ok(DeSRS.isDue({ due: '2026-07-31' }, '2026-08-01'));
  assert.ok(!DeSRS.isDue({ due: '2026-08-02' }, '2026-08-01'));
  assert.ok(!DeSRS.isDue({}, '2026-08-01'));
});
test('addDays 跨月', function () {
  assert.strictEqual(DeSRS.addDays('2026-08-31', 1), '2026-09-01');
  assert.strictEqual(DeSRS.addDays('2026-12-31', 1), '2027-01-01');
});

console.log('DeSRS.matches（判分）：');
test('忽略大小写与首尾空格', function () {
  assert.ok(DeSRS.matches('  Apfel ', 'Apfel'));
});
test('变元音等价输入', function () {
  assert.ok(DeSRS.matches('uebung', 'Übung'));
  assert.ok(DeSRS.matches('strasse', 'Straße'));
  assert.ok(DeSRS.matches('schoen', 'schön'));
});
test('名词可不带冠词', function () {
  assert.ok(DeSRS.matches('Apfel', 'der Apfel'));
  assert.ok(DeSRS.matches('der Apfel', 'Apfel'));
  assert.ok(!DeSRS.matches('die Apfel', 'der Apfel'));
});
test('不同词不匹配', function () {
  assert.ok(!DeSRS.matches('Birne', 'Apfel'));
});

console.log('DeStorage：');
function mockBackend() {
  var m = {};
  return { getItem: function (k) { return m[k] || null; }, setItem: function (k, v) { m[k] = v; }, removeItem: function (k) { delete m[k]; }, _m: m };
}
test('空后端返回默认状态', function () {
  var s = new DeStorage.Storage(mockBackend());
  assert.strictEqual(Object.keys(s.state.srs).length, 0);
  assert.strictEqual(s.state.settings.dailyNew, 10);
});
test('save/load 往返', function () {
  var b = mockBackend();
  var s = new DeStorage.Storage(b);
  s.state.srs['x'] = { box: 2 };
  s.save();
  var s2 = new DeStorage.Storage(b);
  assert.deepStrictEqual(s2.state.srs['x'], { box: 2 });
});
test('坏数据容错', function () {
  var b = mockBackend();
  b.setItem(DeStorage.KEY, '{broken json');
  var s = new DeStorage.Storage(b);
  assert.strictEqual(s.state.settings.dailyNew, 10);
});
test('touchToday 连续打卡', function () {
  var s = new DeStorage.Storage(mockBackend());
  s.state.streak.last = null;
  s.touchToday('new', 2);
  assert.strictEqual(s.state.streak.count, 1);
  s.touchToday('reviewed', 1); // 同一天不重复计
  assert.strictEqual(s.state.streak.count, 1);
  assert.strictEqual(s.state.daily[DeStorage.today()].new, 2);
});
test('错题记录与移除', function () {
  var s = new DeStorage.Storage(mockBackend());
  s.addMistake('grammar', 'g1#0');
  s.addMistake('grammar', 'g1#0');
  assert.strictEqual(s.state.mistakes['g1#0'].wrong, 2);
  s.removeMistake('g1#0');
  assert.ok(!s.state.mistakes['g1#0']);
});
test('replaceState 导入合并默认设置', function () {
  var s = new DeStorage.Storage(mockBackend());
  s.replaceState({ srs: { a: { box: 1 } } });
  assert.strictEqual(s.state.settings.dailyNew, 10);
  assert.ok(s.state.srs.a);
});

console.log('\n数据完整性：');
test('词汇 12 主题、每条 5 元素', function () {
  global.window = {};
  require('../data/vocabulary.js');
  var t = window.VOCAB_THEMES;
  assert.strictEqual(t.length, 12);
  var total = 0;
  t.forEach(function (th) {
    th.words.forEach(function (w) {
      assert.strictEqual(w.length, 5, th.id + ' 存在异常词条');
      assert.ok(['m', 'f', 'n', 'pl', 'v', 'adj', 'adv', 'num', 'pron'].indexOf(w[1]) >= 0, w[0] + ' 词性标注异常');
    });
    total += th.words.length;
  });
  assert.ok(total >= 500, '词数应≥500，实际 ' + total);
});
test('语法 10 专题、练习结构合法', function () {
  global.window = {};
  require('../data/grammar.js');
  var g = window.GRAMMAR;
  assert.strictEqual(g.length, 10);
  g.forEach(function (t) {
    assert.ok(t.exercises.length >= 5, t.id + ' 练习不足 5 题');
    t.exercises.forEach(function (e) {
      if (e.type === 'choice') { assert.ok(e.opts && e.a >= 0 && e.a < e.opts.length, t.id + ' 选择题参数异常'); }
      else { assert.ok(e.a, t.id + ' 填空题缺答案'); }
    });
  });
});

console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed ? 1 : 0);
