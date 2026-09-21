/* 语音合成封装：德语 TTS + 语速控制 */

let voice = null;
let rate = 1.0;

function globalSynth() {
  return (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis : null;
}

function pickVoice() {
  const synth = globalSynth();
  if (!synth) return;
  const vs = synth.getVoices();
  voice = vs.find(function (v) { return v.lang === 'de-DE'; }) ||
          vs.find(function (v) { return (v.lang || '').indexOf('de') === 0; }) || null;
}

const synth = globalSynth();
if (synth) {
  pickVoice();
  synth.onvoiceschanged = pickVoice;
}

export const TTS = {
  available: function () { return !!globalSynth(); },
  setRate: function (r) { rate = r; },
  speak: function (text, r, onEnd) {
    const synth = globalSynth();
    if (!synth || !text) {
      // 无合成引擎时也要通知调用方，避免整组连播卡住
      if (typeof onEnd === 'function') onEnd();
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    if (voice) u.voice = voice;
    u.rate = typeof r === 'number' ? r : rate;
    if (typeof onEnd === 'function') { u.onend = onEnd; u.onerror = onEnd; }
    synth.speak(u);
  },
  stop: function () { const synth = globalSynth(); if (synth) synth.cancel(); }
};
