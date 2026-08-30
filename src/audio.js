/* 音频播放层：优先播放 edge-tts 预生成的标准德语音频（audio/ 目录），
   清单中没有的词回退到浏览器 speechSynthesis */

import { TTS } from './tts.js';

let wordSet = null, sentSet = null, conjSet = null, current = null, rate = 1;

function globalWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function buildSets() {
  const w = globalWindow();
  if (!w) return;
  if (w.AUDIO_WORDS) wordSet = new Set(w.AUDIO_WORDS);
  if (w.AUDIO_SENTS) sentSet = new Set(w.AUDIO_SENTS);
  if (w.AUDIO_CONJ) conjSet = new Set(w.AUDIO_CONJ);
}

function play(kind, id, fallbackText) {
  const set = kind === 'word' ? wordSet : (kind === 'sent' ? sentSet : conjSet);
  const dir = kind === 'conj' ? 'conj' : kind;
  if (set && set.has(id)) {
    stop();
    const a = new Audio('audio/' + dir + '/' + id + '.mp3');
    a.playbackRate = rate;
    current = a;
    a.play().catch(function () { TTS.speak(fallbackText); });
    return true;
  }
  TTS.speak(fallbackText);
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
  hasWord: function (id) { return !!(wordSet && wordSet.has(id)); },
  hasSentence: function (id) { return !!(sentSet && sentSet.has(id)); },
  hasConj: function (id) { return !!(conjSet && conjSet.has(id)); },
  playWord: function (id, fallbackText) { return play('word', id, fallbackText); },
  playSentence: function (id, fallbackText) { return play('sent', id, fallbackText); },
  playConj: function (id, fallbackText) { return play('conj', id, fallbackText); },
  setRate: function (r) { rate = r; },
  stop: stop
};

if (typeof document !== 'undefined' && document.readyState !== 'loading') buildSets();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', buildSets);
