/* 间隔重复调度（简化 SM-2，5 个记忆盒子，纯逻辑，Node 可测试）
   间隔天数：盒子 0-4 -> [0(当天再见), 1, 3, 7, 16, 35] */
(function (global) {
  'use strict';

  var INTERVALS = [0, 1, 3, 7, 16, 35];

  function addDays(dateStr, n) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // quality: 2=认识 1=模糊 0=不认识
  function review(card, quality, todayStr) {
    card = card || { box: 0, reps: 0, lapses: 0 };
    card.reps = (card.reps || 0) + 1;
    if (quality === 2) {
      card.box = Math.min(5, (card.box || 0) + 1);
    } else if (quality === 1) {
      // 模糊：降一级但不低于盒子 1（次日还会见到）
      card.box = Math.max(1, (card.box || 0) - 1);
    } else {
      card.box = 0;
      card.lapses = (card.lapses || 0) + 1;
    }
    card.due = addDays(todayStr, INTERVALS[card.box]);
    card.mastered = card.box >= 5;
    return card;
  }

  function isDue(card, todayStr) {
    return !!card && !!card.due && card.due <= todayStr;
  }

  function newCard(todayStr) {
    return { box: 0, reps: 0, lapses: 0, due: todayStr, learned: todayStr };
  }

  // 德语答案匹配：忽略大小写与多余空格，ß≈ss，ä/ö/ü≈ae/oe/ue，
  // 名词作答时可写可不写冠词
  function normalize(s) {
    return String(s || '').trim().toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/\s+/g, ' ');
  }

  function stripArticle(s) {
    return normalize(s).replace(/^(der|die|das|ein|eine|einen|to|zu) /, '');
  }

  function hasArticle(s) {
    return /^(der|die|das|ein|eine|einen)\s/.test(normalize(s));
  }

  function matches(input, answer) {
    if (normalize(input) === normalize(answer)) return true;
    // 未写冠词 → 只比名词本身；写了冠词但写错 → 不算对
    if (hasArticle(input) || hasArticle(answer)) {
      if (hasArticle(input) !== hasArticle(answer)) {
        return stripArticle(input) === stripArticle(answer);
      }
      return false;
    }
    return normalize(input) === normalize(answer);
  }

  var api = { review: review, isDue: isDue, newCard: newCard, INTERVALS: INTERVALS, addDays: addDays, normalize: normalize, stripArticle: stripArticle, matches: matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.DeSRS = api;
})(typeof window !== 'undefined' ? window : this);
