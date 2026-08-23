/* 存储层：localStorage 读写封装（纯逻辑，Node 可测试） */
(function (global) {
  'use strict';

  var KEY = 'deA1.progress.v1';
  var DEFAULT_SETTINGS = { dailyNew: 10, ttsRate: 1.0 };

  function emptyState() {
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      // wordId -> { box: 0-5, due: 'YYYY-MM-DD', reps, lapses, learned: 'YYYY-MM-DD' }
      srs: {},
      // 每日记录 date -> { new: n, reviewed: n, correct: n }
      daily: {},
      // 错题本: itemId -> { type: 'vocab'|'grammar', wrong: n, last: date }
      mistakes: {},
      // 已完成的语法专题练习 id 列表 -> 最佳正确率
      grammarDone: {},
      streak: { last: null, count: 0 }
    };
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function Storage(backend) {
    this.backend = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.state = this._load();
  }

  Storage.prototype._load = function () {
    if (!this.backend) return emptyState();
    try {
      var raw = this.backend.getItem(KEY);
      if (!raw) return emptyState();
      var s = JSON.parse(raw);
      var base = emptyState();
      s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
      return Object.assign(base, s);
    } catch (e) {
      return emptyState();
    }
  };

  Storage.prototype.save = function () {
    if (this.backend) this.backend.setItem(KEY, JSON.stringify(this.state));
  };

  Storage.prototype.reset = function () {
    this.state = emptyState();
    this.save();
  };

  Storage.prototype.replaceState = function (newState) {
    var base = emptyState();
    base.settings = Object.assign({}, DEFAULT_SETTINGS, newState.settings || {});
    this.state = Object.assign(base, newState);
    this.save();
  };

  // 记录一次学习活动，并维护连续打卡
  Storage.prototype.touchToday = function (field, n) {
    var t = today();
    var d = this.state.daily[t] || (this.state.daily[t] = { new: 0, reviewed: 0, correct: 0 });
    d[field] = (d[field] || 0) + (n || 0);
    var st = this.state.streak;
    if (st.last !== t) {
      // 若昨天有记录则连续 +1，否则重新从 1 开始
      var y = new Date(); y.setDate(y.getDate() - 1);
      var ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      st.count = (st.last === ys) ? st.count + 1 : 1;
      st.last = t;
    }
    this.save();
  };

  Storage.prototype.addMistake = function (type, itemId) {
    var m = this.state.mistakes[itemId];
    if (!m) m = this.state.mistakes[itemId] = { type: type, wrong: 0, last: null };
    m.wrong += 1;
    m.last = today();
    this.save();
  };

  Storage.prototype.removeMistake = function (itemId) {
    delete this.state.mistakes[itemId];
    this.save();
  };

  var api = { Storage: Storage, today: today, emptyState: emptyState, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.DeStorage = api;
})(typeof window !== 'undefined' ? window : this);
