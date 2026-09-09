/* 音频播放层：真人发音（audio/native/，Wikimedia Commons）优先，
   其次 edge-tts 预生成 mp3（audio/word|sent|conj/），
   清单都没有的词回退浏览器 speechSynthesis */

import { TTS } from './tts.js';
import { getAudioWords, getAudioSents, getAudioConj, getAudioNative } from './data.js';

let wordSet = null, sentSet = null, conjSet = null, nativeMap = null, current = null, rate = 1;

function buildSets() {
  const words = getAudioWords();
  const sents = getAudioSents();
  const conjs = getAudioConj();
  const native = getAudioNative();
  if (words.length) wordSet = new Set(words);
  if (sents.length) sentSet = new Set(sents);
  if (conjs.length) conjSet = new Set(conjs);
  if (Object.keys(native).length) nativeMap = native;
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

function playUrl(url, r, fallbackText) {
  stop();
  const a = new Audio(url);
  a.playbackRate = r;
  current = a;
  a.play().catch(function () { TTS.speak(fallbackText, r); });
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
  setRate: function (r) { rate = r; },
  stop: stop
};

if (typeof document !== 'undefined' && document.readyState !== 'loading') buildSets();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', buildSets);
