/* 阅读模块（S8）：文库首页、阅读页（整篇朗读 + 逐词三态着色 + 点词弹卡 + 一键入 SRS）。
   数据来自 index.html 静态加载的 data/reading.js（window.READING_TEXTS）与 audio/manifest.js 的
   AUDIO_READING；两者缺失时一律按空值处理并显示空状态，不报错（同听力模块做法）。
   「加入学习」复用词汇卡 id（vid），不新增卡类型；阅读不产生错题卡。 */

import { store } from './store.js';
import { today } from './storage.js';
import * as SRS from './srs.js';
import { UI } from './ui.js';
import { audio, stop as stopAudio } from './audio.js';
import { TTS } from './tts.js';
import { getReadingTexts, wordById, getWordIpa, LEVELS, loadLevelData, isLevelLoaded, inferLevelFromId, currentLevel } from './data.js';
import { genderTag } from './vocabulary.js';
import { Cloze } from './cloze.js';
import { render } from './app.js';

/* 纯函数：是否词 token（标点 token 只有 w） */
export function isWordToken(t) {
  return !!t && typeof t.w === 'string' && !!t.lemma;
}

/* 纯函数：三态——有 vid 且有卡 → mastered/learning；无卡或非词库词 → new */
export function classifyToken(token, srs) {
  if (!isWordToken(token)) return null;
  const c = token.vid && srs[token.vid];
  if (!c) return 'new';
  if (c.sealed || c.mastered) return 'mastered';
  return 'learning';
}

/* 纯函数：生词率 = new 词 token / 全部词 token，0–100 整数；无词 token 时 0 */
export function newWordRate(paragraphs, srs) {
  let total = 0, fresh = 0;
  (paragraphs || []).forEach(function (p) {
    p.forEach(function (t) {
      if (!isWordToken(t)) return;
      total++;
      if (classifyToken(t, srs) === 'new') fresh++;
    });
  });
  return total ? Math.round(fresh / total * 100) : 0;
}

export function textById(id) {
  return getReadingTexts().find(function (t) { return t.id === id; }) || null;
}

/* tokens → 纯文本（段落内空格连接、段落间空行），供整篇朗读 TTS 回退 */
function tokensToPlain(text) {
  return (text.paragraphs || []).map(function (p) {
    return p.map(function (t) { return t.w; }).join(' ');
  }).join('\n\n');
}

/* ---------- 文库首页 ---------- */

function homePage() {
  const texts = getReadingTexts();
  const srs = store.state.srs;
  const v = UI.el('div', 'sheet');
  v.appendChild(UI.el('p', 'micro', 'LESEN · 阅读'));
  v.appendChild(UI.el('h1', 'page-title', '阅读'));
  v.appendChild(UI.el('p', 'page-sub', texts.length
    ? texts.length + ' 篇分级短文：整篇朗读、逐词点读，生词一键加入学习计划。'
    : '用分级短文把学过的词读起来，生词一键加入学习计划。'));

  if (!texts.length) {
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '阅读短文正在筹备中。先去今日页学几个新词，读的时候就更顺了。'));
    const b = UI.el('button', 'btn', '回今日页');
    b.onclick = function () { location.hash = '#/'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }

  LEVELS.forEach(function (lv) {
    const group = texts.filter(function (t) { return (t.level || 'A1') === lv; });
    if (!group.length) return;
    const band = UI.el('div', 'level-band');
    band.appendChild(UI.el('span', 'micro', 'AUSGABE ' + lv + ' · ' + group.length + ' 篇'));
    v.appendChild(band);
    group.forEach(function (t) { v.appendChild(textItem(t, srs)); });
  });
  return v;
}

function textItem(text, srs) {
  const rec = store.state.reading[text.id];
  const rate = newWordRate(text.paragraphs, srs);
  const a = UI.el('a', 'topic-item');
  a.href = '#/read/' + text.id;
  const name = UI.el('div', 't-name', UI.esc(text.title));
  name.appendChild(UI.el('span', 'badge', text.level || 'A1'));
  if (rec) name.appendChild(UI.el('span', 'badge badge-on', '已读完'));
  a.appendChild(name);
  const desc = UI.el('div', 't-desc',
    UI.esc(text.theme || '短文') + ' · ' + (text.words || 0) + ' 词 · 生词率 ' + rate + '%' +
    (rec ? ' · ' + rec.finished + ' 读完' : ' · 未读'));
  if (rate > 10) desc.appendChild(UI.el('span', 'read-hard', ' · 可能偏难'));
  a.appendChild(desc);
  return a;
}

/* ---------- 阅读页 ---------- */

function readPage(id) {
  const text = textById(id);
  const v = UI.el('div', 'sheet');
  if (!text) {
    v.appendChild(UI.el('p', 'micro', 'LESEN'));
    v.appendChild(UI.el('h1', 'page-title', '找不到这篇短文'));
    const e = UI.el('div', 'card empty');
    e.appendChild(UI.el('p', null, '这篇短文暂时没有内容（可能还没生成）。回文库看看别的篇目吧。'));
    const b = UI.el('button', 'btn', '回文库');
    b.onclick = function () { location.hash = '#/read'; };
    e.appendChild(b);
    v.appendChild(e);
    return v;
  }

  const todayStr = today();
  const srs = store.state.srs;
  const rate = newWordRate(text.paragraphs, srs);
  const fullText = tokensToPlain(text);
  const hasAudio = audio.hasReading(text.id);
  let addedHere = 0;
  let pop = null, popTokenEl = null, playSeq = null;

  /* 跨级别防御：正文 vid 涉及的未加载级别先懒加载，避免词库词被误标「库外词」
     （参照 grammar.js reviewPage 的模式：loading 卡 → loadLevelData → render） */
  const needed = {};
  (text.paragraphs || []).forEach(function (p) {
    p.forEach(function (t) {
      if (!isWordToken(t) || !t.vid) return;
      const lv = inferLevelFromId(t.vid);
      if (lv && lv !== 'A1' && !isLevelLoaded(lv)) needed[lv] = true;
    });
  });
  const levels = Object.keys(needed);
  if (levels.length) {
    const loading = UI.el('div', 'card', '<p>加载本篇词汇数据（' + levels.join(' / ') + '）...</p>');
    Promise.all(levels.map(loadLevelData)).then(function () { render(); }).catch(function (e) {
      console.error(e);
      loading.innerHTML = '<p>加载失败，请检查网络后重试。</p>';
    });
    return loading;
  }

  v.appendChild(UI.el('p', 'micro', 'LESEN · ' + (text.level || 'A1') + ' · ' + String(text.id).toUpperCase()));
  v.appendChild(UI.el('h1', 'page-title', UI.esc(text.title)));
  v.appendChild(UI.el('p', 'page-sub',
    UI.esc(text.theme || '短文') + ' · ' + (text.words || 0) + ' 词 · 生词率 ' + rate + '%'));
  if (!hasAudio) {
    v.appendChild(UI.el('p', 'stat-label', '这篇的朗读音频还没生成，将用系统语音朗读全文。'));
  }

  /* 整篇朗读条：播放中可停止；离开本页自动停止 */
  const bar = UI.el('div', 'play-bar read-bar');
  const playBtn = UI.el('button', 'btn btn-sm', '▶ 朗读全文');
  const playStatus = UI.el('span', 'stat-label', '');
  bar.appendChild(playBtn);
  bar.appendChild(playStatus);
  v.appendChild(bar);

  function stopPlay(silent) {
    if (playSeq) { playSeq = null; stopAudio(); }
    playBtn.textContent = '▶ 朗读全文';
    if (!silent) playStatus.textContent = '已停止。';
  }
  playBtn.onclick = function () {
    if (playSeq) { stopPlay(false); return; }
    playStatus.textContent = hasAudio ? '朗读中…' : '系统语音朗读中…';
    playBtn.textContent = '■ 停止朗读';
    playSeq = {};
    audio.playReading(text.id, fullText, {
      onEnd: function () {
        if (!playSeq) return;
        playSeq = null;
        playBtn.textContent = '▶ 重读全文';
        playStatus.textContent = '读完了。';
      }
    });
  };
  window.addEventListener('hashchange', function onLeave() {
    window.removeEventListener('hashchange', onLeave);
    stopAudio();
  });

  /* 正文：逐段逐 token 三态着色 */
  const body = UI.el('div', 'card read-text');
  (text.paragraphs || []).forEach(function (para) {
    const p = UI.el('p', 'read-p');
    para.forEach(function (t) {
      if (!isWordToken(t)) {
        p.appendChild(document.createTextNode(t.w + ' '));
        return;
      }
      const cls = classifyToken(t, store.state.srs);
      const span = UI.el('span', 'rt-w rt-' + cls, UI.esc(t.w));
      span.__rtToken = t;
      span.tabIndex = 0;
      span.setAttribute('role', 'button');
      span.setAttribute('aria-label', t.w + '：查看词卡');
      span.onclick = function () { openPop(span, t); };
      span.onkeydown = function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        openPop(span, t);
      };
      p.appendChild(span);
      p.appendChild(document.createTextNode(' '));
    });
    body.appendChild(p);
  });
  v.appendChild(body);

  /* srs 变化后重刷正文全部 token 的三态着色（同一 vid 在篇内可能重复出现） */
  function refreshTokenClasses() {
    Array.prototype.forEach.call(body.querySelectorAll('.rt-w'), function (el) {
      const t = el.__rtToken;
      if (t) el.className = 'rt-w rt-' + classifyToken(t, store.state.srs);
    });
  }

  /* 底部统计条 */
  const stats = UI.el('div', 'card read-stats');
  v.appendChild(stats);
  function paintStats() {
    const rec = store.state.reading[text.id];
    stats.innerHTML = '';
    const row = UI.el('div', 'read-stats-row');
    const rateLine = UI.el('span', 'stat-label', '生词率 ' +
      newWordRate(text.paragraphs, store.state.srs) + '%');
    row.appendChild(rateLine);
    row.appendChild(UI.el('span', 'stat-label', '本次已加入 ' + addedHere + ' 词'));
    const done = UI.el('button', 'btn btn-sm', rec ? '更新读完记录' : '标为读完');
    done.onclick = function () {
      store.state.reading[text.id] = { finished: todayStr, added: addedHere };
      store.save();
      paintStats();
    };
    row.appendChild(done);
    stats.appendChild(row);
    const cur = store.state.reading[text.id];
    if (cur) {
      stats.appendChild(UI.el('p', 'stat-label',
        '已于 ' + cur.finished + ' 读完' + (cur.added ? '，当天加入 ' + cur.added + ' 词' : '') + '。'));
    }
    if (rate > 10) {
      stats.appendChild(UI.el('p', 'stat-label read-hard-note',
        '生词率超过 10%，这篇对你可能偏难，建议先看低一级的篇目。'));
    }
  }
  paintStats();

  /* 点词弹卡：单例；ESC / 点他处关闭 */
  function closePop(refocus) {
    if (!pop) return;
    pop.remove();
    pop = null;
    if (refocus && popTokenEl) popTokenEl.focus();
    popTokenEl = null;
    document.removeEventListener('keydown', onDocKey, true);
    document.removeEventListener('click', onDocClick, true);
  }
  function onDocKey(ev) {
    if (ev.key === 'Escape') { ev.stopPropagation(); closePop(true); }
  }
  function onDocClick(ev) {
    if (pop && !pop.contains(ev.target) && ev.target !== popTokenEl) closePop(false);
  }

  function openPop(spanEl, token) {
    if (pop && popTokenEl === spanEl) { closePop(true); return; }
    closePop(false);
    popTokenEl = spanEl;

    const card = UI.el('div', 'read-pop');
    card.tabIndex = -1;
    const w = token.vid ? wordById(token.vid) : null;

    const head = UI.el('div', 'read-pop-head');
    head.innerHTML = (w ? genderTag(w.g) : '<span class="pos-tag">库外词</span>') +
      '<span class="stat-label">' + UI.esc(token.lemma) + '</span>';
    card.appendChild(head);
    const de = UI.el('div', 'word-de', UI.esc(token.w));
    card.appendChild(de);

    if (w) {
      const ipa = getWordIpa(w.id);
      if (ipa) card.appendChild(UI.el('div', 'word-ipa stat-label', '/' + UI.esc(ipa) + '/'));
      const zhRow = UI.el('div', 'word-zh');
      zhRow.appendChild(document.createTextNode(w.zh + ' '));
      const sp = UI.el('button', 'speak-btn', '🔊');
      sp.title = '朗读单词';
      sp.setAttribute('aria-label', '朗读 ' + token.w);
      sp.onclick = function (e) { e.stopPropagation(); audio.playWord(w.id, w.de); };
      zhRow.appendChild(sp);
      card.appendChild(zhRow);
      const ex = UI.el('div', 'word-ex');
      ex.innerHTML = UI.esc(w.ex) + '<br><span>' + UI.esc(w.exZh) + '</span>';
      const spEx = UI.el('button', 'speak-btn', '🔊');
      spEx.title = '朗读例句';
      spEx.setAttribute('aria-label', '朗读例句');
      spEx.onclick = function (e) { e.stopPropagation(); audio.playSentence(w.id, w.ex); };
      ex.insertBefore(spEx, ex.firstChild);
      card.appendChild(ex);
    } else {
      const zhRow = UI.el('div', 'word-zh');
      if (token.g) zhRow.appendChild(document.createTextNode(token.g + ' '));
      const sp = UI.el('button', 'speak-btn', '🔊');
      sp.title = '朗读单词';
      sp.setAttribute('aria-label', '朗读 ' + token.w);
      sp.onclick = function (e) { e.stopPropagation(); TTS.speak(token.w); };
      zhRow.appendChild(sp);
      card.appendChild(zhRow);
      if (!token.g) {
        card.appendChild(UI.el('p', 'stat-label', '词条数据未加载，切换级别后再试。'));
      }
    }

    const act = UI.el('div', 'read-pop-act');
    card.appendChild(act);
    paintPopAct(act, token, w);

    body.appendChild(card);
    pop = card;
    // 定位到词下方，水平方向不溢出正文卡片
    const left = Math.min(spanEl.offsetLeft, Math.max(8, body.clientWidth - card.offsetWidth - 8));
    card.style.left = Math.max(8, left) + 'px';
    card.style.top = (spanEl.offsetTop + spanEl.offsetHeight + 6) + 'px';
    card.focus();
    document.addEventListener('keydown', onDocKey, true);
    document.addEventListener('click', onDocClick, true);
  }

  function paintPopAct(act, token, w) {
    act.innerHTML = '';
    if (!token.vid) {
      act.appendChild(UI.el('span', 'stat-label', '超出本课程词库，暂不支持加入。'));
      return;
    }
    const c = store.state.srs[token.vid];
    if (c) {
      const done = UI.el('span', 'read-added', (c.sealed || c.mastered) ? '已掌握 ✓' : '已在学习计划 ✓');
      act.appendChild(done);
      return;
    }
    const b = UI.el('button', 'btn btn-sm', '加入学习');
    b.onclick = function () {
      const todayStr2 = today();
      store.state.srs[token.vid] = SRS.review(SRS.newCard(todayStr2), 1, todayStr2);
      store.touchToday('new', 1);
      store.save();
      addedHere++;
      refreshTokenClasses();
      paintStats();
      const done = UI.el('span', 'read-added', '已加入 ✓');
      b.replaceWith(done);
    };
    act.appendChild(b);
  }

  /* 练一练：本篇句源出语境填空（目标限已学词，5 题封顶；可出题数为 0 时不显示入口）。
     判分回写目标词卡 SRS，不新建卡。 */
  const clozeItems = Cloze.pick(
    Cloze.itemsFromText(text, currentLevel(), store.state.srs),
    store.state.srs, todayStr, 5);
  const practice = Cloze.practiceCard(clozeItems, {
    micro: 'LESEN · ÜBEN',
    desc: '用本篇学过的词做语境填空，共 ' + clozeItems.length + ' 题。',
    scopeLabel: text.title
  });
  if (practice) v.appendChild(practice);

  return v;
}

export const Reader = {
  homePage: homePage,
  readPage: readPage
};
