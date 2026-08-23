/* 音频播放层：优先播放 edge-tts 预生成的标准德语音频（audio/ 目录），
   清单中没有的词回退到浏览器 speechSynthesis */
(function (global) {
  'use strict';
  var wordSet = null, sentSet = null, conjSet = null, current = null, rate = 1;

  function buildSets() {
    if (global.AUDIO_WORDS) wordSet = new Set(global.AUDIO_WORDS);
    if (global.AUDIO_SENTS) sentSet = new Set(global.AUDIO_SENTS);
    if (global.AUDIO_CONJ) conjSet = new Set(global.AUDIO_CONJ);
  }

  function play(kind, id, fallbackText) {
    var set = kind === 'word' ? wordSet : (kind === 'sent' ? sentSet : conjSet);
    var dir = kind === 'conj' ? 'conj' : kind;
    if (set && set.has(id)) {
      stop();
      var a = new Audio('audio/' + dir + '/' + id + '.mp3');
      a.playbackRate = rate;
      current = a;
      a.play().catch(function () { DeTTS.speak(fallbackText); });
      return true;
    }
    DeTTS.speak(fallbackText);
    return false;
  }

  function stop() {
    if (current) { try { current.pause(); } catch (e) {} current = null; }
    DeTTS.stop();
  }

  var DeAudio = {
    init: buildSets,
    hasWord: function (id) { return !!(wordSet && wordSet.has(id)); },
    hasSentence: function (id) { return !!(sentSet && sentSet.has(id)); },
    hasConj: function (id) { return !!(conjSet && conjSet.has(id)); },
    playWord: function (id, fallbackText) { return play('word', id, fallbackText); },
    playSentence: function (id, fallbackText) { return play('sent', id, fallbackText); },
    playConj: function (id, fallbackText) { return play('conj', id, fallbackText); },
    setRate: function (r) { rate = r; },
    stop: stop
  };
  global.DeAudio = DeAudio;
  if (typeof document !== 'undefined' && document.readyState !== 'loading') buildSets();
  else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', buildSets);
})(typeof window !== 'undefined' ? window : this);
