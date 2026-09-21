/* 存储层：IndexedDB 主存 + localStorage 镜像/回退（纯逻辑，Node 可测试） */

export const KEY = 'deA1.progress.v1';
const DEFAULT_SETTINGS = { dailyNew: 10, ttsRate: 1.0, level: 'A1' };
const DEBOUNCE_MS = 300;

export function emptyState() {
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
    // 听力对话完成记录: dialogueId -> { right, total, at: 'YYYY-MM-DD' }
    listen: {},
    // 阅读短文完成记录: textId -> { finished: 'YYYY-MM-DD', added: n }
    reading: {},
    // streak: last 最后学习日 / count 连续天数 / freezes 冻结券数量 / protected 使用冻结保住的日子
    streak: { last: null, count: 0, freezes: 1, protected: [] }
  };
}

export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function makeMemoryBackend() {
  const m = {};
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
  let db = null;
  const DB_NAME = 'deutsch-lernen';
  const STORE = 'kv';
  const STATE_KEY = 'state';
  return {
    type: 'indexedDB',
    open: function () {
      return new Promise(function (resolve, reject) {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('indexedDB blocked')); };
        req.onsuccess = function () { db = req.result; resolve(); };
        req.onupgradeneeded = function (e) {
          const d = e.target.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
        };
      });
    },
    get: function () {
      return new Promise(function (resolve, reject) {
        if (!db) { resolve(null); return; }
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.get(STATE_KEY);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    },
    set: function (state) {
      return new Promise(function (resolve, reject) {
        if (!db) { reject(new Error('indexedDB not open')); return; }
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.put(state, STATE_KEY);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    }
  };
}

export function Storage(syncBackend, asyncBackend) {
  this._saveTimer = null;
  this._readyPromise = null;
  this._readyResolve = null;
  this._readyDone = false;
  this._pendingSave = false; // ready 完成前调用 save() 会先标记，就绪后统一触发
  this._async = asyncBackend || null;

  if (syncBackend) {
    this.backend = syncBackend;
  } else if (typeof localStorage !== 'undefined') {
    this.backend = makeLocalStorageBackend(localStorage);
  } else {
    this.backend = makeMemoryBackend();
  }

  // 同步初始化内存 state：业务层可在脚本加载后立即读取 store.state
  this.state = this._load();

  const self = this;
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
  const base = emptyState();
  if (s && typeof s === 'object') Object.assign(base, s);
  base.settings = Object.assign({}, DEFAULT_SETTINGS, base.settings || {});
  // 旧存档缺 listen 子树（或值非法）时补默认值，避免听力页读 undefined
  if (!base.listen || typeof base.listen !== 'object') base.listen = {};
  // 旧存档缺 reading 子树（或值非法）时补默认值，避免阅读页读 undefined
  if (!base.reading || typeof base.reading !== 'object') base.reading = {};
  return base;
};

Storage.prototype._load = function () {
  let raw = null;
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
    // ready 前被 save() 标记的待落盘请求，在异步后端就绪后统一触发一次防抖落盘。
    // 这避免了迁移写与早期 save() 的定时器写发生库级竞态。
    if (this._pendingSave) {
      this._pendingSave = false;
      this.save();
    }
  }
};

Storage.prototype._initAsync = function () {
  const self = this;
  self._async.open()
    .then(function () { return self._async.get(); })
    .then(function (idbState) {
      if (idbState) {
        // IDB 有数据：用 IDB 数据替换内存中的初始状态
        self.state = self._mergeState(idbState);
      } else {
        // IDB 为空但 localStorage 有旧数据：迁移进 IDB，保留 localStorage 作为回退
        const raw = self.backend.getItem(KEY);
        if (raw) {
          try {
            const lsState = JSON.parse(raw);
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
  // 一旦真正开始落盘，清除待落盘标记，避免 ready 后重复触发。
  this._pendingSave = false;
  const data = JSON.stringify(this.state);
  if (this.backend) {
    try { this.backend.setItem(KEY, data); } catch (e) { /* 镜像写入失败忽略 */ }
  }
  if (this._async) {
    this._async.set(this.state).catch(function () {});
  }
};

// 防抖落盘：内存 state 立即更新。
// 异步后端就绪前不会直接落盘，而是标记 _pendingSave，等 ready() 后统一触发，
// 避免与 _initAsync 中的迁移/初始写入产生竞态。
Storage.prototype.save = function () {
  if (this._async) {
    if (!this._readyDone) {
      this._pendingSave = true;
      return;
    }
    const self = this;
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

function addDaysStr(dateStr, n) {
  const p = dateStr.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 记录一次学习活动，并维护连续打卡（含冻结券：漏一天不清零，每满 7 天补 1 张，上限 2）
Storage.prototype.touchToday = function (field, n) {
  const t = today();
  const d = this.state.daily[t] || (this.state.daily[t] = { new: 0, reviewed: 0, correct: 0 });
  d[field] = (d[field] || 0) + (n || 0);
  const st = this.state.streak;
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

// 旧版 SM-2 卡片迁移为 FSRS 字段
Storage.prototype.migrateCards = function (fn) {
  const srs = this.state.srs;
  let changed = false;
  Object.keys(srs).forEach(function (id) {
    const before = JSON.stringify(srs[id]);
    fn(srs[id]);
    if (JSON.stringify(srs[id]) !== before) changed = true;
  });
  if (!this.state.streak.freezes) this.state.streak.freezes = 1;
  if (!this.state.streak.protected) this.state.streak.protected = [];
  if (changed) this.save();
};

Storage.prototype.addMistake = function (type, itemId) {
  let m = this.state.mistakes[itemId];
  if (!m) m = this.state.mistakes[itemId] = { type: type, wrong: 0, last: null };
  m.wrong += 1;
  m.last = today();
  this.save();
};

Storage.prototype.removeMistake = function (itemId) {
  delete this.state.mistakes[itemId];
  this.save();
};
