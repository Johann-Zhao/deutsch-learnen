/* 存储层：IndexedDB 主存 + localStorage 镜像/回退（纯逻辑，Node 可测试） */
(function (global) {
  'use strict';

  var KEY = 'deA1.progress.v1';
  var DEFAULT_SETTINGS = { dailyNew: 10, ttsRate: 1.0, level: 'A1' };
  var DEBOUNCE_MS = 300;

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

  function makeMemoryBackend() {
    var m = {};
    return {
      getItem: function (k) { return m[k] || null; },
      setItem: function (k, v) { m[k] = v; },
      removeItem: function (k) { delete m[k]; }
    };
  }

  function makeLocalStorageBackend(ls) {
    return {
      getItem: function (k) { try { return ls.getItem(k); } catch (e) { return null; } },
      setItem: function (k, v) { try { ls.setItem(k, v); } catch (e) { /* QuotaExceeded 等吞掉 */ } },
      removeItem: function (k) { try { ls.removeItem(k); } catch (e) { } }
    };
  }

  // 原生 IndexedDB 封装，不依赖任何库
  function idbBackend() {
    var db = null;
    var DB_NAME = 'deutsch-lernen';
    var STORE = 'kv';
    var STATE_KEY = 'state';
    return {
      type: 'indexedDB',
      open: function () {
        return new Promise(function (resolve, reject) {
          var req = indexedDB.open(DB_NAME, 1);
          req.onerror = function () { reject(req.error); };
          req.onblocked = function () { reject(new Error('indexedDB blocked')); };
          req.onsuccess = function () { db = req.result; resolve(); };
          req.onupgradeneeded = function (e) {
            var d = e.target.result;
            if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
          };
        });
      },
      get: function () {
        return new Promise(function (resolve, reject) {
          if (!db) { resolve(null); return; }
          var tx = db.transaction(STORE, 'readonly');
          var store = tx.objectStore(STORE);
          var req = store.get(STATE_KEY);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { reject(req.error); };
        });
      },
      set: function (state) {
        return new Promise(function (resolve, reject) {
          if (!db) { reject(new Error('indexedDB not open')); return; }
          var tx = db.transaction(STORE, 'readwrite');
          var store = tx.objectStore(STORE);
          var req = store.put(state, STATE_KEY);
          req.onsuccess = function () { resolve(); };
          req.onerror = function () { reject(req.error); };
        });
      }
    };
  }

  function Storage(syncBackend, asyncBackend) {
    this._saveTimer = null;
    this._readyPromise = null;
    this._readyResolve = null;
    this._readyDone = false;
    this._async = asyncBackend || null;

    if (syncBackend) {
      this.backend = syncBackend;
    } else if (typeof localStorage !== 'undefined') {
      this.backend = makeLocalStorageBackend(localStorage);
    } else {
      this.backend = makeMemoryBackend();
    }

    // 同步初始化内存 state：app.js 仍可在脚本加载后立即读取 store.state
    this.state = this._load();

    var self = this;
    this._readyPromise = new Promise(function (resolve) { self._readyResolve = resolve; });

    if (this._async) {
      this._initAsync();
    } else if (!syncBackend && typeof indexedDB !== 'undefined' && typeof localStorage !== 'undefined') {
      // 浏览器环境且未注入测试后端：使用 IndexedDB
      this._async = idbBackend();
      this._initAsync();
    } else {
      // Node、隐私模式或 IDB 不可用：localStorage/内存路径，行为与旧版一致
      this._resolveReady();
    }
  }

  Storage.prototype._mergeState = function (s) {
    var base = emptyState();
    if (s && typeof s === 'object') Object.assign(base, s);
    base.settings = Object.assign({}, DEFAULT_SETTINGS, base.settings || {});
    return base;
  };

  Storage.prototype._load = function () {
    var raw = null;
    try {
      raw = this.backend ? this.backend.getItem(KEY) : null;
    } catch (e) { raw = null; }
    if (!raw) return emptyState();
    try {
      return this._mergeState(JSON.parse(raw));
    } catch (e) {
      return emptyState();
    }
  };

  Storage.prototype._resolveReady = function () {
    if (!this._readyDone) {
      this._readyDone = true;
      if (this._readyResolve) this._readyResolve();
    }
  };

  Storage.prototype._initAsync = function () {
    var self = this;
    self._async.open()
      .then(function () { return self._async.get(); })
      .then(function (idbState) {
        if (idbState) {
          // IDB 有数据：用 IDB 数据替换内存中的初始状态
          self.state = self._mergeState(idbState);
        } else {
          // IDB 为空但 localStorage 有旧数据：迁移进 IDB，保留 localStorage 作为回退
          var raw = self.backend.getItem(KEY);
          if (raw) {
            try {
              var lsState = JSON.parse(raw);
              self.state = self._mergeState(lsState);
              return self._async.set(self.state);
            } catch (e) { /* 解析失败则保留默认状态 */ }
          }
        }
      })
      .then(function () { self._resolveReady(); }, function () {
        // IDB 打开或读写失败：退回到同步后端
        self._async = null;
        self._resolveReady();
      });
  };

  Storage.prototype.ready = function () {
    return this._readyPromise;
  };

  Storage.prototype._persist = function () {
    if (!this.backend && !this._async) return;
    var data = JSON.stringify(this.state);
    if (this.backend) {
      try { this.backend.setItem(KEY, data); } catch (e) { /* 镜像写入失败忽略 */ }
    }
    if (this._async) {
      this._async.set(this.state).catch(function () {});
    }
  };

  // 防抖落盘：内存 state 立即更新，只有存在异步后端时才延迟落盘
  Storage.prototype.save = function () {
    if (this._async) {
      var self = this;
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(function () { self.flush(); }, DEBOUNCE_MS);
    } else {
      this._persist();
    }
  };

  Storage.prototype.flush = function () {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._persist();
  };

  Storage.prototype.reset = function () {
    this.state = emptyState();
    this.save();
  };

  Storage.prototype.replaceState = function (newState) {
    this.state = this._mergeState(newState);
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
