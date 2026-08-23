/* 语音合成封装：德语 TTS + 语速控制 */
(function (global) {
  'use strict';
  var voice = null;
  var rate = 1.0;

  function pickVoice() {
    if (!('speechSynthesis' in global)) return;
    var vs = global.speechSynthesis.getVoices();
    voice = vs.find(function (v) { return v.lang === 'de-DE'; }) ||
            vs.find(function (v) { return (v.lang || '').indexOf('de') === 0; }) || null;
  }
  if ('speechSynthesis' in global) {
    pickVoice();
    global.speechSynthesis.onvoiceschanged = pickVoice;
  }

  var TTS = {
    available: function () { return 'speechSynthesis' in global; },
    setRate: function (r) { rate = r; },
    speak: function (text) {
      if (!this.available() || !text) return;
      global.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      if (voice) u.voice = voice;
      u.rate = rate;
      global.speechSynthesis.speak(u);
    },
    stop: function () { if (this.available()) global.speechSynthesis.cancel(); }
  };
  global.DeTTS = TTS;
})(typeof window !== 'undefined' ? window : this);
