/* 间隔重复调度（FSRS-4.5 核心实现，默认参数，纯逻辑，Node 可测试）
   对外接口与旧版 SM-2 保持一致：
   - newCard(today) / review(card, quality 0|1|2, today) / isDue(card, today)
   quality: 0=不认识(rating 1 Again) 1=模糊(rating 2 Hard) 2=认识(rating 3 Good)
   参考 github.com/open-spaced-repetition/fsrs4anki */

export const MASTERED_STABILITY = 21; // 稳定度≥21天视为"掌握"

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const MAX_S = 36500;

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

export function addDays(dateStr, n) {
  const p = dateStr.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function daysBetween(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  const da = new Date(pa[0], pa[1] - 1, pa[2]), db = new Date(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}

function initialStability(rating) { return W[rating - 1]; }
function initialDifficulty(rating) { return clamp(W[4] - (rating - 3) * W[5], 1, 10); }

// 可提取性（遗忘曲线）：t 天后还能记住的概率
export function retrievability(s, tDays) {
  return Math.pow(1 + FACTOR * tDays / s, DECAY);
}

export function newCard(todayStr) {
  return { stability: 0, difficulty: 0, reps: 0, lapses: 0, due: todayStr, learned: todayStr, last: null };
}

export function review(card, quality, todayStr) {
  const rating = quality + 1; // 1 Again / 2 Hard / 3 Good
  if (!card || card.reps === 0 || !card.last) {
    // 首次评分
    card = card || newCard(todayStr);
    card.stability = initialStability(rating);
    card.difficulty = initialDifficulty(rating);
    card.reps = 1;
    card.lapses = rating === 1 ? 1 : 0;
    card.last = todayStr;
  } else {
    const t = Math.max(0, daysBetween(card.last, todayStr));
    const R = retrievability(card.stability, t);
    // 难度更新 + 均值回归
    const d1 = clamp(card.difficulty - W[6] * (rating - 3), 1, 10);
    card.difficulty = clamp(W[7] * W[4] + (1 - W[7]) * d1, 1, 10);
    // 稳定度增长
    function w10(x) { return W[10] * x; }
    let inc = 1 + Math.exp(W[8]) * (11 - card.difficulty) *
      Math.pow(card.stability, -W[9]) * (Math.exp(w10(1 - R)) - 1);
    if (rating === 2) inc *= W[15];        // Hard 惩罚
    if (rating === 4) inc *= W[16];        // Easy 奖励（本站未用）
    card.stability = clamp(card.stability * inc, 0.1, MAX_S);
    card.reps += 1;
    if (rating === 1) card.lapses += 1;
    card.last = todayStr;
  }
  // 到期日：稳定度不足 1 天 → 当天再见
  const waitDays = card.stability < 1 ? 0 : Math.round(card.stability);
  card.due = addDays(todayStr, waitDays);
  card.mastered = card.stability >= MASTERED_STABILITY;
  return card;
}

export function isDue(card, todayStr) {
  return !!card && !!card.due && card.due <= todayStr;
}

// 旧版 SM-2 盒子进度迁移：box → 稳定度
const OLD_INTERVALS = [0, 1, 3, 7, 16, 35];
export function migrate(card) {
  if (card && card.box !== undefined && card.stability === undefined) {
    card.stability = OLD_INTERVALS[card.box] || 1;
    card.difficulty = 6;
    card.last = card.learned || card.due;
    if (!card.last) card.last = card.due;
    delete card.box;
  }
  return card;
}

// 德语答案匹配：忽略大小写与多余空格，ß≈ss，ä/ö/ü≈ae/oe/ue，
// 名词作答时可写可不写冠词（写错冠词不算对）
export function normalize(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');
}

export function stripArticle(s) {
  return normalize(s).replace(/^(der|die|das|ein|eine|einen) /, '');
}

export function hasArticle(s) {
  return /^(der|die|das|ein|eine|einen)\s/.test(normalize(s));
}

export function matches(input, answer) {
  if (normalize(input) === normalize(answer)) return true;
  if (hasArticle(input) !== hasArticle(answer)) {
    return stripArticle(input) === stripArticle(answer);
  }
  return false;
}

export const SRS = {
  review, isDue, newCard, migrate,
  addDays, daysBetween,
  retrievability,
  normalize, stripArticle, matches,
  MASTERED_STABILITY
};
