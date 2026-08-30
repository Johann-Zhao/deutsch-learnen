/* Node 单元测试：node tests/run.js */
'use strict';
var assert = require('assert');
var DeSRS = require('../js/srs.js');
var DeStorage = require('../js/storage.js');

var passed = 0, failed = 0;
var asyncQueue = [];
function test(name, fn) {
  try {
    var r = fn();
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
  var c = DeSRS.newCard('2026-08-01');
  DeSRS.review(c, 0, '2026-08-01');
  assert.strictEqual(c.due, '2026-08-01'); // 稳定度 <1 天 → 当天到期
  assert.ok(c.stability < 1);
  assert.strictEqual(c.lapses, 1);
});
test('首次"认识"：约 4 天后再复习', function () {
  var c = DeSRS.newCard('2026-08-01');
  DeSRS.review(c, 2, '2026-08-01');
  assert.strictEqual(c.due, '2026-08-05'); // S0=3.71 → 4 天
});
test('重复答对稳定度递增（间隔越拉越长）', function () {
  var c = DeSRS.newCard('2026-08-01');
  DeSRS.review(c, 2, '2026-08-01');
  var s1 = c.stability, due1 = c.due;
  DeSRS.review(c, 2, due1); // 到期日按时复习再答对
  assert.ok(c.stability > s1, '稳定度应增长: ' + s1 + ' -> ' + c.stability);
  assert.ok(c.due > due1);
});
test('"模糊"比"认识"增长少', function () {
  var a = DeSRS.newCard('2026-08-01'); DeSRS.review(a, 2, '2026-08-01');
  DeSRS.review(a, 2, a.due);
  var b = DeSRS.newCard('2026-08-01'); DeSRS.review(b, 2, '2026-08-01');
  DeSRS.review(b, 1, b.due); // 同样第二次，但答"模糊"
  assert.ok(b.stability <= a.stability);
});
test('难度随评分调整且有界（1-10）', function () {
  var c = DeSRS.newCard('2026-08-01');
  DeSRS.review(c, 0, '2026-08-01'); // 不认识 → 难度高
  var d1 = c.difficulty;
  for (var i = 0; i < 20; i++) DeSRS.review(c, 0, c.due);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  assert.ok(c.difficulty >= d1 - 0.01, '连错难度不应下降');
});
test('稳定度 ≥21 天视为掌握', function () {
  var c = DeSRS.newCard('2026-08-01');
  DeSRS.review(c, 2, '2026-08-01');
  for (var i = 0; i < 5 && !c.mastered; i++) DeSRS.review(c, 2, c.due);
  assert.ok(c.stability >= DeSRS.MASTERED_STABILITY);
  assert.strictEqual(c.mastered, true);
});
test('旧版 SM-2 盒子迁移', function () {
  var migrated = DeSRS.migrate({ box: 3, reps: 2, due: '2026-08-10', learned: '2026-08-01' });
  assert.strictEqual(migrated.stability, 7);
  assert.strictEqual(migrated.box, undefined);
});
test('isDue 判断当天到期', function () {
  assert.ok(DeSRS.isDue({ due: '2026-08-01' }, '2026-08-01'));
  assert.ok(DeSRS.isDue({ due: '2026-07-31' }, '2026-08-01'));
  assert.ok(!DeSRS.isDue({ due: '2026-08-02' }, '2026-08-01'));
  assert.ok(!DeSRS.isDue({}, '2026-08-01'));
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
  assert.ok(!DeSRS.matches('Hause', 'zu Hause'));
  assert.ok(DeSRS.matches('Kind', 'das Kind'));
  assert.ok(!DeSRS.matches('die Kind', 'das Kind'));
  assert.ok(DeSRS.matches('nach Hause', 'nach Hause'));
});
test('不同词不匹配', function () {
  assert.ok(!DeSRS.matches('Birne', 'Apfel'));
});

console.log('语法 SRS 调度：');
test('语法卡生命周期：首错当天到期，隔天再对推后', function () {
  var c = DeSRS.review(null, 0, '2026-08-01');
  assert.strictEqual(c.due, '2026-08-01', '首错应今天到期');
  assert.ok(DeSRS.isDue(c, '2026-08-01'));
  c = DeSRS.review(c, 2, '2026-08-02');
  assert.ok(c.due > '2026-08-02', '答对后到期日应推后: ' + c.due);
  assert.ok(!DeSRS.isDue(c, '2026-08-02'));
  assert.ok(DeSRS.isDue(c, c.due));
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
test('冻结券：漏一天不清零并消耗一张', function () {
  var s = new DeStorage.Storage(mockBackend());
  var t = DeStorage.today();
  // 模拟前天学过
  var d = new Date(); d.setDate(d.getDate() - 2);
  var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.state.daily[key] = { new: 5, reviewed: 0, correct: 0 };
  s.state.streak = { last: key, count: 3, freezes: 1, protected: [] };
  s.touchToday('new', 1);
  assert.strictEqual(s.state.streak.count, 4, '应消耗冻结券保持连胜');
  assert.strictEqual(s.state.streak.freezes, 0);
  assert.strictEqual(s.state.streak.protected.length, 1);
});
test('无冻结券时断卡重新计数', function () {
  var s = new DeStorage.Storage(mockBackend());
  var d = new Date(); d.setDate(d.getDate() - 2);
  var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.state.streak = { last: key, count: 5, freezes: 0, protected: [] };
  s.touchToday('new', 1);
  assert.strictEqual(s.state.streak.count, 1);
});
test('每满 7 天补发冻结券（上限 2）', function () {
  var s = new DeStorage.Storage(mockBackend());
  var d = new Date(); d.setDate(d.getDate() - 1);
  var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  s.state.streak = { last: key, count: 6, freezes: 0, protected: [] };
  s.touchToday('new', 1);
  assert.strictEqual(s.state.streak.count, 7);
  assert.strictEqual(s.state.streak.freezes, 1);
});
test('migrateCards 迁移旧卡片', function () {
  var s = new DeStorage.Storage(mockBackend());
  s.state.srs['old'] = { box: 2, reps: 1, due: '2026-08-01' };
  s.migrateCards(DeSRS.migrate);
  assert.strictEqual(s.state.srs['old'].stability, 3);
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

// 内存版 fake 异步 KV 后端，用于验证 IndexedDB 路径逻辑而不依赖真实 indexedDB
function fakeAsyncBackend() {
  var mem = null, sets = 0, opens = 0;
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
  var s = new DeStorage.Storage();
  return s.ready().then(function () { assert.ok(true); });
});
test('异步就绪：IDB 空时从 localStorage 迁移旧数据', function () {
  var b = mockBackend();
  var old = { srs: { 'a-1': { stability: 3, due: '2026-08-01' } }, settings: { dailyNew: 15 } };
  b.setItem(DeStorage.KEY, JSON.stringify(old));
  var asyncBE = fakeAsyncBackend();
  var s = new DeStorage.Storage(b, asyncBE);
  return s.ready().then(function () {
    assert.strictEqual(s.state.srs['a-1'].stability, 3);
    assert.strictEqual(s.state.settings.dailyNew, 15);
    assert.ok(asyncBE._mem(), '迁移后应写入 IDB');
    assert.strictEqual(asyncBE._mem().srs['a-1'].stability, 3);
    assert.ok(b.getItem(DeStorage.KEY), 'localStorage 原记录应保留');
  });
});
test('ready 使用 IDB 数据覆盖内存初始状态', function () {
  var b = mockBackend();
  b.setItem(DeStorage.KEY, JSON.stringify({ srs: { a: { stability: 1 } } }));
  var asyncBE = fakeAsyncBackend();
  asyncBE._preload({ srs: { a: { stability: 9 } } });
  var s = new DeStorage.Storage(b, asyncBE);
  assert.strictEqual(s.state.srs.a.stability, 1, '构造时仍读 localStorage');
  return s.ready().then(function () {
    assert.strictEqual(s.state.srs.a.stability, 9, 'ready 后改用 IDB 数据');
  });
});
test('ready 前 save 不直接落盘，ready 后统一触发', function () {
  var b = mockBackend();
  var asyncBE = fakeAsyncBackend();
  var s = new DeStorage.Storage(b, asyncBE);
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
  var b = mockBackend();
  var asyncBE = fakeAsyncBackend();
  var s = new DeStorage.Storage(b, asyncBE);
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
  var b = mockBackend();
  var asyncBE = fakeAsyncBackend();
  var s = new DeStorage.Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 5 };
    s.save();
    s.flush();
    assert.strictEqual(asyncBE._sets(), 1);
    assert.strictEqual(asyncBE._mem().srs['x'].stability, 5);
  });
});
test('IDB 落盘同时写 localStorage 镜像', function () {
  var b = mockBackend();
  var asyncBE = fakeAsyncBackend();
  var s = new DeStorage.Storage(b, asyncBE);
  return s.ready().then(function () {
    s.state.srs['x'] = { stability: 7 };
    s.flush();
    var mirrored = JSON.parse(b.getItem(DeStorage.KEY));
    assert.strictEqual(mirrored.srs['x'].stability, 7);
  });
});
test('防抖 300ms 到期后自动落盘', function () {
  var b = mockBackend();
  var asyncBE = fakeAsyncBackend();
  var s = new DeStorage.Storage(b, asyncBE);
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
(function () {
  var DeVocabIndex = require('../js/vocabulary.js');
  test('展平 id 唯一性', function () {
    var idx = DeVocabIndex.buildWordIndex([
      { id: 'greet', name: '问候', level: 'A1', words: [['der Tag', 'm', '白天', 'Guten Tag!', '你好！'], ['die Nacht', 'f', '夜晚', 'Gute Nacht!', '晚安！']] },
      { id: 'a2-travel', name: '旅行', level: 'A2', words: [['die Reise', 'f', '旅行', 'Die Reise.', '旅行。']] }
    ]);
    var ids = idx.map(function (w) { return w.id; });
    var dup = ids.filter(function (x, i) { return ids.indexOf(x) !== i; });
    assert.strictEqual(dup.length, 0);
    assert.ok(idx.every(function (w) { return w.level && w.de && w.g && w.zh; }));
  });
  test('重复调用幂等', function () {
    var themes = [{ id: 'greet', name: '问候', level: 'A1', words: [['der Tag', 'm', '白天', 'Guten Tag!', '你好！']] }];
    var a = DeVocabIndex.buildWordIndex(themes);
    var b = DeVocabIndex.buildWordIndex(themes);
    assert.deepStrictEqual(a, b);
  });
  test('增量级别数据合并后查找正确', function () {
    var a1 = [{ id: 'greet', name: '问候', level: 'A1', words: [['der Tag', 'm', '白天', 'Guten Tag!', '你好！']] }];
    var a2 = [{ id: 'a2-travel', name: '旅行', level: 'A2', words: [['die Reise', 'f', '旅行', 'Die Reise.', '旅行。']] }];
    var idx = DeVocabIndex.buildWordIndex(a1.concat(a2));
    var w1 = idx.find(function (w) { return w.id === 'greet-0'; });
    var w2 = idx.find(function (w) { return w.id === 'a2-travel-0'; });
    assert.ok(w1 && w2);
    assert.strictEqual(w1.level, 'A1');
    assert.strictEqual(w2.level, 'A2');
    assert.strictEqual(w1.themeName, '问候');
    assert.strictEqual(w2.de, 'die Reise');
  });
  test('空数组返回空索引', function () {
    assert.deepStrictEqual(DeVocabIndex.buildWordIndex([]), []);
    assert.deepStrictEqual(DeVocabIndex.buildWordIndex(null), []);
  });
})();

console.log('\n数据完整性：');
test('词汇 ≥36 主题、≥1900 词、id 全局唯一、level 合法', function () {
  global.window = {};
  require('../data/vocabulary.js');
  require('../data/vocabulary_a2.js');
  require('../data/vocabulary_b1.js');
  var t = window.VOCAB_THEMES;
  assert.ok(t.length >= 36, '主题数应≥36，实际 ' + t.length);
  var total = 0, ids = [], levels = {};
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
  var dup = ids.filter(function (x, i) { return ids.indexOf(x) !== i; });
  assert.strictEqual(dup.length, 0, '存在重复词条 id: ' + dup.slice(0, 3));
  assert.ok(ids.every(function (id) { return id.indexOf('#') === -1; }), '词汇 id 不应含 #，否则会与语法卡 id 冲突');
});
test('语法 ≥34 专题、id 唯一、练习结构合法', function () {
  global.window = {};
  require('../data/grammar.js');
  require('../data/grammar_a2.js');
  require('../data/grammar_b1.js');
  var g = window.GRAMMAR;
  assert.ok(g.length >= 34, '语法专题应≥34，实际 ' + g.length);
  var ids = g.map(function (t) { return t.id; });
  var dup = ids.filter(function (x, i) { return ids.indexOf(x) !== i; });
  assert.strictEqual(dup.length, 0, '存在重复语法 id');
  var byLevel = {};
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

console.log('变位查询（conjugate.js）：');
(function () {
  var fs = require('fs');
  var src = fs.readFileSync(__dirname + '/../js/conjugate.js', 'utf8');
  global.window = global.window || {};
  var C = new Function(src + '\nreturn Conjugate;')();
  test('不规则动词 fahren', function () {
    var d = C.lookup('fahren');
    assert.deepStrictEqual(d.forms.slice(0, 3), ['fahre', 'fährst', 'fährt']);
    assert.strictEqual(d.pp[1], 'gefahren');
  });
  test('规则动词 lernen', function () {
    var d = C.lookup('lernen');
    assert.deepStrictEqual(d.forms, ['lerne', 'lernst', 'lernt', 'lernen', 'lernt', 'lernen']);
  });
  test('词干以 t 结尾：arbeiten → du arbeitest', function () {
    var d = C.lookup('arbeiten');
    assert.strictEqual(d.forms[1], 'arbeitest');
    assert.strictEqual(d.forms[2], 'arbeitet');
  });
  test('词干以 s 结尾：reisen → du reist', function () {
    assert.strictEqual(C.lookup('reisen').forms[1], 'reist');
  });
  test('-ieren 动词分词不加 ge', function () {
    assert.strictEqual(C.lookup('studieren').pp[1], 'studiert');
  });
  test('可分动词 aufstehen', function () {
    var d = C.lookup('aufstehen');
    assert.strictEqual(d.forms[2], 'steht auf');
    assert.strictEqual(d.pp[1], 'aufgestanden');
  });
  test('非动词输入返回 null', function () {
    assert.strictEqual(C.lookup(''), null);
  });
})();

Promise.all(asyncQueue).then(function () {
  console.log('\n结果：' + passed + ' 通过，' + failed + ' 失败');
  process.exit(failed ? 1 : 0);
});
