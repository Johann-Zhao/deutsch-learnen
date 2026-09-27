/* 存储层：IndexedDB 主存 + localStorage 镜像/回退（纯逻辑，Node 可测试） */

export const KEY = 'deA1.progress.v1';
const DEFAULT_SETTINGS = { dailyNew: 10, ttsRate: 1.0, level: 'A1' };
const DEBOUNCE_MS = 300;

/* QuotaExceededError 判定：Chrome 用 name，旧 Firefox 用 code 22，
   WebKit 明确要求「必须处理」这个错误（见 findings A2/A7）。
   配额写满时**不能让保存静默失败**——上层据此提示用户导出后清理。 */
export function isQuotaError(e) {
  if (!e) return false;
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  const code = e.code;
  return code === 22 || code === 1014;
}

/* 可用时返回 navigator.storage，否则 null（Node / 老内核 / 隐私模式）。
   第三个参数 storageMgr 供测试注入；传入 null 表示「显式没有」，undefined 表示「自己去查」。 */
function storageManager(storageMgr) {
  if (storageMgr !== undefined) return storageMgr;
  if (typeof navigator === 'undefined' || !navigator || !navigator.storage) return null;
  return navigator.storage;
}

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
    // 写入失败**不再吞掉**：_persist 需要拿到 QuotaExceededError 才能提示用户
    setItem: function (k, v) { ls.setItem(k, v); },
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

export function Storage(syncBackend, asyncBackend, storageMgr) {
  this._saveTimer = null;
  this._readyPromise = null;
  this._readyResolve = null;
  this._readyDone = false;
  this._pendingSave = false; // ready 完成前调用 save() 会先标记，就绪后统一触发
  this._async = asyncBackend || null;
  this.lastError = null;     // 最近一次落盘失败（QuotaExceededError 等），供 UI 提示
  // 存储持久化状态（运行时字段，不写进 state，避免污染导出/导入的存档格式）
  this.persistGranted = null;   // null=未查询 true/false=查询结果
  this.persistInfo = null;      // { usage, quota } 或 null
  // Storage API 句柄：构造时能取到就取（可测、可注入）；取不到时延迟到首次查询再取，
  // 避免「脚本比 navigator.storage 更早就绪」的环境永远显示「不支持」
  this._storageManager = storageManager(storageMgr);
  this._storageManagerChecked = storageMgr !== undefined;

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
  let failed = null;
  if (this.backend) {
    try { this.backend.setItem(KEY, data); } catch (e) { failed = e; }
  }
  // localStorage 镜像先写：主存（IDB）成功不代表镜像成功。镜像写失败也要如实记下来，
  // 否则配额写满（镜像被拒、主存仍可写）时用户看不到任何提示。
  if (failed) this._noteWriteError(failed);
  if (this._async) {
    const self = this;
    this._async.set(this.state).then(function () {
      // 主存成功：镜像的错误保留，成功则清掉
      if (!failed) self.lastError = null;
    }, function (e) {
      self._noteWriteError(e);
    });
  }
};

Storage.prototype._noteWriteError = function (e) {
  const kind = isQuotaError(e) ? 'quota' : 'write';
  // 已经因为配额报过警就不再降级成普通写错误
  if (this.lastError && this.lastError.kind === 'quota' && kind !== 'quota') return;
  const changed = !this.lastError || this.lastError.kind !== kind;
  this.lastError = { kind: kind, error: e };
  // 首次进入失败态时通知一次（UI 据此重渲染，保证「保存失败」对用户可见）
  if (changed) this._emitWriteError();
};

/* 写入状态变化订阅：返回取消订阅函数。UI 层用它把「保存失败」刷到界面上，
   否则用户设置完就直接离开，永远不会看到提示。 */
Storage.prototype.onWriteError = function (fn) {
  if (!this._writeErrorSubs) this._writeErrorSubs = [];
  this._writeErrorSubs.push(fn);
  const self = this;
  return function () {
    const i = self._writeErrorSubs.indexOf(fn);
    if (i >= 0) self._writeErrorSubs.splice(i, 1);
  };
};

Storage.prototype._emitWriteError = function () {
  if (!this._writeErrorSubs) return;
  const self = this;
  this._writeErrorSubs.slice().forEach(function (fn) {
    try { fn(self.lastError); } catch (e) { /* 订阅者自己出错不影响落盘 */ }
  });
};

/* 落盘是否处于失败状态（配额写满 / 后端不可写）。UI 据此显示提示，避免静默失败。 */
Storage.prototype.writeError = function () { return this.lastError; };

Storage.prototype.clearWriteError = function () { this.lastError = null; };

/* 惰性取一次 Storage API 句柄（构造时没取到才走这里） */
Storage.prototype._sm = function () {
  if (!this._storageManagerChecked) {
    this._storageManager = storageManager(undefined);
    this._storageManagerChecked = true;
  }
  return this._storageManager;
};

/* 启动时查一次持久化状态：已持久化就不重复申请。
   iOS 通常**拒绝** persist()（授予与否是 WebKit 的启发式，与是否以主屏幕
   Web App 打开强相关）——这是正常结果，不是错误，调用方文案要如实呈现。 */
Storage.prototype.initPersistence = function () {
  const self = this;
  const sm = this._sm();
  if (!sm || typeof sm.persisted !== 'function') {
    self.persistGranted = null;
    return Promise.resolve(null);
  }
  return Promise.resolve()
    .then(function () { return sm.persisted(); })
    .then(function (granted) {
      self.persistGranted = !!granted;
      if (granted || typeof sm.persist !== 'function') return self.persistGranted;
      return Promise.resolve(sm.persist()).then(function (ok) {
        self.persistGranted = !!ok;
        return self.persistGranted;
      }, function () { return self.persistGranted; });
    })
    .catch(function () { return self.persistGranted; });
};

/* 存储用量/配额。API 不存在（老内核/隐私模式）时返回 null，调用方就不显示这一行。 */
Storage.prototype.refreshQuota = function () {
  const self = this;
  const sm = this._sm();
  if (!sm || typeof sm.estimate !== 'function') {
    self.persistInfo = null;
    return Promise.resolve(null);
  }
  return Promise.resolve()
    .then(function () { return sm.estimate(); })
    .then(function (est) {
      if (!est || typeof est.usage !== 'number' || typeof est.quota !== 'number') {
        self.persistInfo = null;
        return null;
      }
      self.persistInfo = { usage: est.usage, quota: est.quota };
      return self.persistInfo;
    })
    .catch(function () { self.persistInfo = null; return null; });
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
