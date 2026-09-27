/* 音频播放层：真人发音（audio/native/，Wikimedia Commons）优先，
   其次 edge-tts 预生成 mp3（audio/word|sent|conj/），
   清单都没有的词回退浏览器 speechSynthesis */

import { TTS } from './tts.js';
import { getAudioWords, getAudioSents, getAudioConj, getAudioNative, getAudioDialogs, getAudioReading } from './data.js';

let wordSet = null, sentSet = null, conjSet = null, nativeMap = null, dialogMap = null, readingSet = null, current = null, rate = 1;

/* ---------- 音频元素池 + 手势解锁（iOS 必需） ----------
   iOS Safari 只允许在事件处理函数的**同步作用域**里调用 play()：
   WebKit Bug 259925（https://bugs.webkit.org/show_bug.cgi?id=259925 ，2025-01 仍为 NEW）原文——
   "unlike other browser engines, Safari will only permit the play() call from the synchronous
    scope of an event handler"。本应用大量「卡片渲染后自动朗读」发生在 setTimeout 之后（脱离手势）
   → 必然被拒；被拒后回退 speechSynthesis，而它**同受手势门控**
   （WebKit 源码 RequireUserGestureForSpeechStartRestriction）→ 整条链静默哑掉。
   对策（官方报告里点名的绕法）：**复用**固定数量的音频元素，首次用户手势时用一段静音把它们
   「预热解锁」，之后在同一元素上换 src 播放即可通过。 */
const POOL_SIZE = 2;   // 依据：任意时刻至多「当前播放 + 下一个」（对话连播、切卡），2 个足够；池小则解锁成本低

/* 运行时生成 0.1 秒静音 WAV（8kHz / 8bit / mono，844 字节）作为解锁素材：
   解锁必须播「真实但无声」的音频——用 muted 播放是否算数没有权威依据，故不用 muted；
   在源码里塞一大段 base64 既难维护又容易拷错，改为运行时构造 Blob URL。 */
let silentSrcCache = null;
function silentSrc() {
  if (silentSrcCache !== null) return silentSrcCache;
  silentSrcCache = '';
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return silentSrcCache;
  try {
    const sr = 8000, samples = 800;      // 0.1s
    const buf = new ArrayBuffer(44 + samples);
    const v = new DataView(buf);
    const put = function (off, s) { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    put(0, 'RIFF'); v.setUint32(4, 36 + samples, true); put(8, 'WAVE');
    put(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    put(36, 'data'); v.setUint32(40, samples, true);
    const bytes = new Uint8Array(buf);
    for (let i = 44; i < bytes.length; i++) bytes[i] = 0x80;   // 8-bit PCM 的静音电平
    silentSrcCache = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  } catch (e) { /* 环境不支持则退化为「不解锁」，真正播放时仍会上报失败 */ }
  return silentSrcCache;
}

let pool = [];
let poolIdx = 0;
let unlocked = false;
let lastBlocked = null;
const blockHandlers = [];

function els() {
  if (!pool.length && typeof Audio !== 'undefined') {
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new Audio();
      a.preload = 'auto';
      pool.push(a);
    }
  }
  return pool;
}

function nextEl() {
  const p = els();
  if (!p.length) return null;
  const el = p[poolIdx % p.length];
  poolIdx++;
  return el;
}

/* 在用户手势的**同步作用域**内调用：用静音把池内元素预热，取得播放许可。
   注意：`play()` 返回 Promise **不等于**解锁成功——WebKit 在手势外会以 NotAllowedError
   reject。所以只有 Promise **resolve** 后才把 unlocked 置真，否则 isUnlocked() 会撒谎，
   调用方会据此跳过「点一下播放」的提示，又退回静默。重复调用安全。 */
export function unlock() {
  const p = els();
  if (!p.length) return false;
  if (unlocked) return true;
  const src = silentSrc();
  if (!src) return false;
  let attempted = false;
  p.forEach(function (a) {
    try {
      a.src = src;
      const pr = a.play();
      attempted = true;
      if (pr && pr.then) {
        pr.then(function () {
          markUnlocked();
          try { a.pause(); a.currentTime = 0; } catch (e) {}
        }).catch(function (err) {
          notifyBlocked(err, 'unlock');
        });
      }
    } catch (e) { attempted = true; /* 单个元素失败不影响其它元素 */ }
  });
  return attempted;
}

/* 播放被拒时记录 + 通知（供 UI 给出**可见**提示，避免静默失败） */
function notifyBlocked(err, url) {
  lastBlocked = {
    name: (err && err.name) || 'UnknownError',
    message: (err && err.message) || '',
    url: url || '',
    at: Date.now()
  };
  if (typeof document !== 'undefined' && document.body) document.body.classList.add('audio-blocked');
  blockHandlers.forEach(function (fn) { try { fn(lastBlocked); } catch (e) {} });
}

export function onBlocked(fn) {
  if (typeof fn !== 'function') return function () {};
  blockHandlers.push(fn);
  return function () {
    const i = blockHandlers.indexOf(fn);
    if (i >= 0) blockHandlers.splice(i, 1);
  };
}

export function lastBlockError() { return lastBlocked; }

export function clearBlockError() {
  lastBlocked = null;
  if (typeof document !== 'undefined' && document.body) document.body.classList.remove('audio-blocked');
}

export function isUnlocked() { return unlocked; }

/* 真正解锁成功后才把监听摘掉：否则首个手势若是浏览器不认的那种（或解锁失败），
   监听一旦移除就再也不会重试 → 永久哑。 */
let unlockHandler = null;
function markUnlocked() {
  if (unlocked) return;
  unlocked = true;
  if (typeof document !== 'undefined' && unlockHandler) {
    GESTURES.forEach(function (t) { document.removeEventListener(t, unlockHandler, true); });
  }
}

/* 测试用：复位池与解锁状态（生产代码不调用） */
export function _resetPool() {
  stop();
  pool = [];
  poolIdx = 0;
  unlocked = false;
  lastBlocked = null;
  blockHandlers.length = 0;
  if (typeof document !== 'undefined' && document.body) document.body.classList.remove('audio-blocked');
  if (typeof document !== 'undefined' && unlockHandler) {
    GESTURES.forEach(function (t) { document.removeEventListener(t, unlockHandler, true); });
  }
  unlockHandler = null;
  unlockWired = false;
}

function buildSets() {
  const words = getAudioWords();
  const sents = getAudioSents();
  const conjs = getAudioConj();
  const native = getAudioNative();
  const dialogs = getAudioDialogs();
  const reading = getAudioReading();
  if (words.length) wordSet = new Set(words);
  if (sents.length) sentSet = new Set(sents);
  if (conjs.length) conjSet = new Set(conjs);
  if (Object.keys(native).length) nativeMap = native;
  if (Object.keys(dialogs).length) dialogMap = dialogs;
  if (reading.length) readingSet = new Set(reading);
}

/* 纯函数：决定单词音频播放来源（真人发音 > TTS 预生成 > null=交给 TTS 引擎） */
export function pickWordSrc(id, native, wordSet) {
  if (native && native[id]) return 'audio/' + native[id];
  if (wordSet && wordSet.has(id)) return 'audio/word/' + id + '.mp3';
  return null;
}

/* 纯函数：一次性语速覆盖全局语速 */
export function resolveRate(oneShot, global) {
  return typeof oneShot === 'number' ? oneShot : global;
}

/* 纯函数：对话行音频来源（清单里有该组且行号在范围内 → 文件路径；否则 null 交给 TTS） */
export function pickDialogSrc(dialogueId, lineIndex, dialogMap) {
  const n = dialogMap && dialogMap[dialogueId];
  if (typeof n === 'number' && lineIndex >= 0 && lineIndex < n) {
    return 'audio/dialog/' + dialogueId + '-' + lineIndex + '.mp3';
  }
  return null;
}

/* 纯函数：整篇朗读音频来源（清单内 → 文件路径；否则 null 交给 TTS） */
export function pickReadingSrc(id, readingSet) {
  if (readingSet && readingSet.has(id)) return 'audio/reading/' + id + '.mp3';
  return null;
}

/* 统一走元素池播放。onEnd 仅在「真的播完了」时触发；回退 TTS 时由 TTS 的 onEnd 接力。 */
function playUrlWith(url, r, fallbackText, onEnd) {
  stop();
  const a = nextEl();
  if (!a) { TTS.speak(fallbackText, r, onEnd); return false; }
  a.playbackRate = r;
  a.src = url;
  current = a;
  if (typeof onEnd === 'function') {
    a.addEventListener('ended', function onEnded() {
      a.removeEventListener('ended', onEnded);
      if (current === a) { current = null; onEnd(); }
    });
  }
  const pr = a.play();
  if (pr && pr.catch) {
    pr.catch(function (err) {
      // 播放被拒：先上报（UI 据此给可见提示），再回退系统朗读
      notifyBlocked(err, url);
      if (current === a) current = null;
      TTS.speak(fallbackText, r, onEnd);
    });
  }
  return true;
}

function playUrl(url, r, fallbackText) {
  return playUrlWith(url, r, fallbackText, null);
}

// 对话行播放：与 playUrl 同构，但支持播完/回退时回调 onEnd（整组连播靠它推进到下一行）
function playDialogUrl(url, r, fallbackText, onEnd) {
  return playUrlWith(url, r, fallbackText, onEnd);
}

function play(kind, id, fallbackText, oneShotRate) {
  const r = resolveRate(oneShotRate, rate);
  if (kind === 'word') {
    const url = pickWordSrc(id, nativeMap, wordSet);
    if (url) return playUrl(url, r, fallbackText);
    TTS.speak(fallbackText, r);
    return false;
  }
  const set = kind === 'sent' ? sentSet : conjSet;
  const dir = kind === 'conj' ? 'conj' : kind;
  if (set && set.has(id)) return playUrl('audio/' + dir + '/' + id + '.mp3', r, fallbackText);
  TTS.speak(fallbackText, r);
  return false;
}

// 听力对话：按行播放预生成 mp3；音频缺失（未生成/加载失败）回退 speechSynthesis 朗读该行德文。
// opts.onEnd 在整行播完（或回退朗读结束）后触发，供整组连播使用；opts.rate 一次性覆盖语速。
function playDialog(dialogueId, lineIndex, fallbackText, opts) {
  const r = resolveRate(opts && opts.rate, rate);
  const onEnd = opts && opts.onEnd;
  const url = pickDialogSrc(dialogueId, lineIndex, dialogMap);
  if (url) return playDialogUrl(url, r, fallbackText, onEnd);
  TTS.speak(fallbackText, r, onEnd);
  return false;
}

// 整篇朗读：清单内播预生成 mp3，缺失回退 speechSynthesis 朗读全文
function playReading(id, fallbackText, opts) {
  const r = resolveRate(opts && opts.rate, rate);
  const onEnd = opts && opts.onEnd;
  const url = pickReadingSrc(id, readingSet);
  if (url) return playDialogUrl(url, r, fallbackText, onEnd);
  TTS.speak(fallbackText, r, onEnd);
  return false;
}

export function stop() {
  if (current) { try { current.pause(); } catch (e) {} current = null; }
  TTS.stop();
}

/* 首次用户手势时自动解锁。捕获阶段监听，确保早于应用自身的点击处理函数——
   解锁必须发生在手势的同步作用域内，晚一步就白做。
   手势名单用 WebKit 官方认定的那组（touchend / click / doubleclick / keydown）：
   `pointerdown` 不在 WebKit 的名单里，用它可能在 iOS 上「监听了但没解锁」。 */
let unlockWired = false;
const GESTURES = ['touchend', 'click', 'doubleclick', 'keydown'];
export function wireFirstGestureUnlock() {
  if (unlockWired || typeof document === 'undefined' || !document.addEventListener) return false;
  unlockWired = true;
  unlockHandler = function () {
    unlock();
    // 不在这里摘监听：只有 markUnlocked()（Promise resolve）才摘，
    // 否则解锁失败就再也没有重试机会。
    if (isUnlocked()) GESTURES.forEach(function (t) { document.removeEventListener(t, unlockHandler, true); });
  };
  GESTURES.forEach(function (t) { document.addEventListener(t, unlockHandler, true); });
  return true;
}

export function init() {
  buildSets();
  wireFirstGestureUnlock();
}

export const audio = {
  init: init,
  hasWord: function (id) { return !!((nativeMap && nativeMap[id]) || (wordSet && wordSet.has(id))); },
  hasSentence: function (id) { return !!(sentSet && sentSet.has(id)); },
  hasConj: function (id) { return !!(conjSet && conjSet.has(id)); },
  playWord: function (id, fallbackText, opts) { return play('word', id, fallbackText, opts && opts.rate); },
  playSentence: function (id, fallbackText, opts) { return play('sent', id, fallbackText, opts && opts.rate); },
  playConj: function (id, fallbackText, opts) { return play('conj', id, fallbackText, opts && opts.rate); },
  playDialog: playDialog,
  hasDialog: function (dialogueId) { return !!pickDialogSrc(dialogueId, 0, dialogMap); },
  playReading: playReading,
  hasReading: function (id) { return !!pickReadingSrc(id, readingSet); },
  setRate: function (r) { rate = r; },
  stop: stop,
  /* 手势解锁与失败可见 —— iOS 需要（见文件头注释） */
  unlock: unlock,
  isUnlocked: isUnlocked,
  onBlocked: onBlocked,
  lastBlockError: lastBlockError,
  clearBlockError: clearBlockError
};

if (typeof document !== 'undefined' && document.readyState !== 'loading') init();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
