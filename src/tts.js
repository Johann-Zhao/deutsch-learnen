/* 语音合成封装：德语 TTS + 语速控制。
   注意 iOS Safari 的 `speechSynthesis` **同样受「用户手势」门控**
   （WebKit 源码 RequireUserGestureForSpeechStartRestriction）——它只是音频链的回退，
   不是绕开自动播放限制的办法。 */

let voice = null;
let rate = 1.0;

function globalSynth() {
  return (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis : null;
}

function pickVoice() {
  const synth = globalSynth();
  if (!synth) return false;
  const vs = synth.getVoices() || [];
  voice = vs.find(function (v) { return v.lang === 'de-DE'; }) ||
          vs.find(function (v) { return (v.lang || '').indexOf('de') === 0; }) || null;
  return !!voice;
}

const boot = globalSynth();
if (boot) {
  pickVoice();
  boot.onvoiceschanged = pickVoice;
  /* iOS 上 getVoices() 首次常返回空数组，且 voiceschanged 往往要等到用户交互后才触发
     → 先做几次指数退避重试，一旦拿到德语语音就停。 */
  let tries = 0;
  const retry = function () {
    if (voice || tries >= 6) return;
    tries++;
    pickVoice();
    if (!voice) setTimeout(retry, 300 * tries);
  };
  setTimeout(retry, 300);
}

export const TTS = {
  available: function () { return !!globalSynth(); },
  /* 是否已找到德语语音。找不到时仍会朗读，但用默认语音念德语，发音会不准。 */
  hasGermanVoice: function () { return !!voice; },
  voiceName: function () { return voice ? (voice.name + ' / ' + voice.lang) : null; },
  setRate: function (r) { rate = r; },
  speak: function (text, r, onEnd) {
    const synth = globalSynth();
    if (!synth || !text) {
      // 无合成引擎时也要通知调用方，避免整组连播卡住
      if (typeof onEnd === 'function') onEnd();
      return;
    }
    const utter = function () {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      if (voice) u.voice = voice;
      u.rate = typeof r === 'number' ? r : rate;
      if (typeof onEnd === 'function') { u.onend = onEnd; u.onerror = onEnd; }
      try { synth.speak(u); } catch (e) { if (typeof onEnd === 'function') onEnd(); }
    };
    /* 只在确实有内容在播时才 cancel + 延迟：iOS 上「cancel 后立刻 speak」会把这一次朗读吞掉。
       本来没在说时就不 cancel、不延迟 —— 保持同步调用，手势内才有效。 */
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(utter, 60);
    } else {
      utter();
    }
  },
  stop: function () { const synth = globalSynth(); if (synth) synth.cancel(); }
};
