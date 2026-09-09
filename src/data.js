/* 数据注册表：封装 window 全局数据脚本读取、词汇索引、级别懒加载 */

import { store } from './store.js';

function globalWindow() {
  return typeof window !== 'undefined' ? window : null;
}

export function getVocabThemes() {
  const w = globalWindow();
  return (w && w.VOCAB_THEMES) || [];
}

export function getGrammar() {
  const w = globalWindow();
  return (w && w.GRAMMAR) || [];
}

export function getAudioWords() {
  const w = globalWindow();
  return (w && w.AUDIO_WORDS) || [];
}

export function getAudioSents() {
  const w = globalWindow();
  return (w && w.AUDIO_SENTS) || [];
}

export function getAudioConj() {
  const w = globalWindow();
  return (w && w.AUDIO_CONJ) || [];
}

export function getAudioNative() {
  return (typeof window !== 'undefined' && window.AUDIO_NATIVE) || {};
}

export function getWordIpa(id) {
  const m = (typeof window !== 'undefined' && window.WORD_IPA) || {};
  return m[id] || null;
}

export function getImageWords() {
  const w = globalWindow();
  return (w && w.IMAGE_WORDS) || [];
}

export function getImageCovers() {
  const w = globalWindow();
  return (w && w.IMAGE_COVERS) || [];
}

export const LEVELS = ['A1', 'A2', 'B1'];

export let allWords = [];
export const themeLevels = {};
export const grammarLevels = {};

export function buildWordIndex(themes) {
  const words = [];
  (themes || []).forEach(function (t) {
    const level = t.level || 'A1';
    t.words.forEach(function (w, i) {
      words.push({ id: t.id + '-' + i, theme: t.id, themeName: t.name, level: level, de: w[0], g: w[1], zh: w[2], ex: w[3], exZh: w[4] });
    });
  });
  return words;
}

export function rebuildWordIndex() {
  allWords = buildWordIndex(getVocabThemes());
  Object.keys(themeLevels).forEach(function (k) { delete themeLevels[k]; });
  allWords.forEach(function (w) { themeLevels[w.theme] = w.level; });
}

export function rebuildGrammarLevels() {
  Object.keys(grammarLevels).forEach(function (k) { delete grammarLevels[k]; });
  getGrammar().forEach(function (t) { grammarLevels[t.id] = t.level || 'A1'; });
}

export function wordById(id) {
  return allWords.find(function (w) { return w.id === id; });
}

export function wordsOfLevel(lv) {
  return allWords.filter(function (w) { return w.level === lv; });
}

export function grammarOfLevel(lv) {
  return getGrammar().filter(function (t) { return (t.level || 'A1') === lv; });
}

export function currentLevel() {
  return store.state.settings.level || 'A1';
}

export function inferLevelFromId(id) {
  if (/^(b1-|g-b1-)/i.test(id)) return 'B1';
  if (/^(a2-|g-a2-)/i.test(id)) return 'A2';
  return 'A1';
}

const loaded = new Set(['A1']);
const inflight = {};
const LEVEL_FILES = {
  A2: ['data/vocabulary_a2.js', 'data/grammar_a2.js'],
  B1: ['data/vocabulary_b1.js', 'data/grammar_b1.js']
};

export function isLevelLoaded(level) {
  return loaded.has((level || 'A1').toUpperCase());
}

export function loadLevelData(level) {
  level = (level || 'A1').toUpperCase();
  if (level === 'A1' || loaded.has(level)) return Promise.resolve();
  if (inflight[level]) return inflight[level];
  const files = LEVEL_FILES[level];
  if (!files) return Promise.reject(new Error('未知级别: ' + level));

  if (typeof document === 'undefined') {
    return Promise.reject(new Error('懒加载需要浏览器 document 环境'));
  }

  inflight[level] = Promise.all(files.map(function (src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        console.error('加载失败: ' + src);
        reject(new Error('加载失败: ' + src));
      };
      document.head.appendChild(s);
    });
  })).then(function () {
    loaded.add(level);
    delete inflight[level];
    rebuildWordIndex();
    rebuildGrammarLevels();
  }).catch(function (e) {
    delete inflight[level];
    console.error(e);
    return Promise.reject(e);
  });
  return inflight[level];
}

// 页面初始时 A1 数据已由 index.html 静态加载，立即建立索引
rebuildWordIndex();
rebuildGrammarLevels();
