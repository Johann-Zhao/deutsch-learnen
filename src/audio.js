/* 音频播放层：真人发音（audio/native/，Wikimedia Commons）优先，
   其次 edge-tts 预生成 mp3（audio/word|sent|conj/），
   清单都没有的词回退浏览器 speechSynthesis */

import { TTS } from './tts.js';
import { getAudioWords, getAudioSents, getAudioConj, getAudioNative, getAudioDialogs } from './data.js';

let wordSet = null, sentSet = null, conjSet = null, nativeMap = null, dialogMap = null, current = null, rate = 1;

function buildSets() {
  const words = getAudioWords();
  const sents = getAudioSents();
  const conjs = getAudioConj();
  const native = getAudioNative();
  const dialogs = getAudioDialogs();
  if (words.length) wordSet = new Set(words);
  if (sents.length) sentSet = new Set(sents);
  if (conjs.length) conjSet = new Set(conjs);
  if (Object.keys(native).length) nativeMap = native;
  if (Object.keys(dialogs).length) dialogMap = dialogs;
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

function playUrl(url, r, fallbackText) {
  stop();
  const a = new Audio(url);
  a.playbackRate = r;
  current = a;
  a.play().catch(function () { TTS.speak(fallbackText, r); });
  return true;
}

// 对话行播放：与 playUrl 同构，但支持播完/回退时回调 onEnd（整组连播靠它推进到下一行）
function playDialogUrl(url, r, fallbackText, onEnd) {
  stop();
  const a = new Audio(url);
  a.playbackRate = r;
  current = a;
  if (typeof onEnd === 'function') {
    a.addEventListener('ended', function () {
      if (current === a) { current = null; onEnd(); }
    });
  }
  a.play().catch(function () {
    console.warn('对话音频播放失败，回退朗读：' + url);
    if (current === a) current = null;
    TTS.speak(fallbackText, r, onEnd);
  });
  return true;
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

export function stop() {
  if (current) { try { current.pause(); } catch (e) {} current = null; }
  TTS.stop();
}

export function init() {
  buildSets();
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
  setRate: function (r) { rate = r; },
  stop: stop
};

if (typeof document !== 'undefined' && document.readyState !== 'loading') buildSets();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', buildSets);
