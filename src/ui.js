/* UI 基础辅助函数：DOM 创建、HTML 转义、朗读按钮 */

import { audio } from './audio.js';
import { TTS } from './tts.js';

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export const UI = { el, esc };

export function speakBtn(text, kind, id, cls) {
  const b = el('button', 'speak-btn ' + (cls || ''), '🔊');
  b.title = '朗读';
  b.setAttribute('aria-label', '朗读 ' + text);
  b.onclick = function (e) {
    e.stopPropagation();
    if (kind === 'word' && id) audio.playWord(id, text);
    else if (kind === 'sent' && id) audio.playSentence(id, text);
    else if (kind === 'conj' && id) audio.playConj(id, text);
    else TTS.speak(text);
  };
  return b;
}
