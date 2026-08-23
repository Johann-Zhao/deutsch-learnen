/* 存储层：localStorage 读写封装（纯逻辑，Node 可测试） */
(function (global) {
  'use strict';

  var KEY = 'deA1.progress.v1';
  var DEFAULT_SETTINGS = { dailyNew: 10, ttsRate: 1.0, level: 'A1' };

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
      // streak: last 最后学习日 / count 连续天数 / freezes 冻结券数量 / protected 使用冻结保住的日子
      streak: { last: null, count: 0, freezes: 1, protected: [] }
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

  // 记录一次学习活动，并维护连续打卡（含冻结券：漏一天不清零，每满 7 天补 1 张，上限 2）
  Storage.prototype.touchToday = function (field, n) {
    var t = today();
    var d = this.state.daily[t] || (this.state.daily[t] = { new: 0, reviewed: 0, correct: 0 });
    d[field] = (d[field] || 0) + (n || 0);
    var st = this.state.streak;
    if (st.last !== t) {
      if (st.last === addDaysStr(t, -1)) {
        st.count += 1;
      } else if (st.freezes > 0 && st.last === addDaysStr(t, -2)) {
        // 昨天 missed，用冻结券补上
        st.freezes -= 1;
        if (!st.protected) st.protected = [];
        st.protected.push(addDaysStr(t, -1));
        st.count += 1;
      } else {
        st.count = 1;
      }
      st.last = t;
      if (st.count > 0 && st.count % 7 === 0) {
        st.freezes = Math.min(2, (st.freezes || 0) + 1);
      }
    }
    this.save();
  };

  function addDaysStr(dateStr, n) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 旧版 SM-2 卡片迁移为 FSRS 字段
  Storage.prototype.migrateCards = function (fn) {
    var srs = this.state.srs, changed = false;
    Object.keys(srs).forEach(function (id) {
      var before = JSON.stringify(srs[id]);
      fn(srs[id]);
      if (JSON.stringify(srs[id]) !== before) changed = true;
    });
    if (!this.state.streak.freezes) this.state.streak.freezes = 1;
    if (!this.state.streak.protected) this.state.streak.protected = [];
    if (changed) this.save();
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
