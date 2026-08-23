/* 应用入口：hash 路由、仪表盘、设置页 */
(function () {
  'use strict';
  var store = new DeStorage.Storage();
  window.store = store; // 各模块共用同一实例

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  window.UI = { el: el, esc: esc };

  // 全站词汇展开成带 id 的列表
  var WORDS = [];
  window.VOCAB_THEMES.forEach(function (t) {
    t.words.forEach(function (w, i) {
      WORDS.push({ id: t.id + '-' + i, theme: t.id, themeName: t.name, de: w[0], g: w[1], zh: w[2], ex: w[3], exZh: w[4] });
    });
  });
  window.ALL_WORDS = WORDS;
  window.wordById = function (id) { return WORDS.find(function (w) { return w.id === id; }); };

  window.speakBtn = function (text, cls) {
    var b = el('button', 'speak-btn ' + (cls || ''), '🔊');
    b.title = '朗读';
    b.setAttribute('aria-label', '朗读 ' + text);
    b.onclick = function (e) { e.stopPropagation(); DeTTS.speak(text); };
    return b;
  };

  /* ---------- 仪表盘 ---------- */
  function dashboard() {
    var today = DeStorage.today();
    var s = store.state;
    var learned = Object.keys(s.srs).length;
    var mastered = Object.keys(s.srs).filter(function (id) { return s.srs[id].mastered; }).length;
    var due = Object.keys(s.srs).filter(function (id) { return DeSRS.isDue(s.srs[id], today); }).length;
    var t = s.daily[today] || { new: 0, reviewed: 0, correct: 0 };

    var v = el('div');
    v.appendChild(el('h1', 'page-title', '今天'));
    v.appendChild(el('p', 'page-sub', new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })));

    var card = el('div', 'card');
    card.appendChild(el('h3', null, '今日任务'));
    if (t.new + t.reviewed === 0 && due === 0) {
      var empty = el('p', null, '还没有开始。从 10 个新词开始？');
      card.appendChild(empty);
    } else {
      card.appendChild(el('p', null, '已学新词 ' + t.new + ' 个 · 已复习 ' + t.reviewed + ' 个'));
    }
    var row = el('div', null);
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px';
    var bNew = el('button', 'btn', '学 ' + s.settings.dailyNew + ' 个新词');
    bNew.onclick = function () { location.hash = '#/learn'; };
    row.appendChild(bNew);
    var bRev = el('button', 'btn ' + (due ? '' : 'btn-ghost'), due ? '复习 ' + due + ' 个到期词' : '没有到期复习');
    bRev.disabled = !due;
    bRev.onclick = function () { location.hash = '#/review'; };
    row.appendChild(bRev);
    card.appendChild(row);
    v.appendChild(card);

    var stats = el('div', 'grid grid-3');
    [['已学 / 总词数', learned + ' / ' + WORDS.length], ['已掌握', mastered], ['连续打卡', s.streak.count + ' 天']].forEach(function (x) {
      var c = el('div', 'card');
      c.appendChild(el('div', 'stat-num', String(x[1])));
      c.appendChild(el('div', 'stat-label', x[0]));
      stats.appendChild(c);
    });
    v.appendChild(stats);

    var pc = Math.round(learned / WORDS.length * 100);
    var prog = el('div', 'card');
    prog.appendChild(el('h3', null, 'A1 词汇进度'));
    var bar = el('div', 'bar');
    var fill = el('div', 'bar-fill'); fill.style.width = pc + '%';
    bar.appendChild(fill); prog.appendChild(bar);
    prog.appendChild(el('p', 'stat-label', pc + '%（' + learned + ' / ' + WORDS.length + '）'));

    // 最近 7 天活动
    var chart = el('div', 'week-chart');
    var max = 1;
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var rec = s.daily[key] || { new: 0, reviewed: 0 };
      var n = rec.new + rec.reviewed;
      max = Math.max(max, n);
      days.push({ label: '日一二三四五六'[d.getDay()], n: n, today: i === 0 });
    }
    days.forEach(function (d) {
      var col = el('div', 'week-col');
      var b = el('div', 'week-bar'); b.style.height = Math.round(d.n / max * 68) + 'px';
      if (d.today) b.style.background = 'var(--m)';
      col.appendChild(b);
      col.appendChild(el('span', 'day', d.label));
      chart.appendChild(col);
    });
    prog.appendChild(chart);
    v.appendChild(prog);
    return v;
  }

  /* ---------- 设置 ---------- */
  function settingsPage() {
    var s = store.state;
    var v = el('div');
    v.appendChild(el('h1', 'page-title', '设置'));

    var c1 = el('div', 'card');
    var r1 = el('div', 'setting-row');
    r1.appendChild(el('label', null, '每天学习新词数量'));
    var num = el('input'); num.type = 'number'; num.min = 5; num.max = 30; num.value = s.settings.dailyNew;
    num.onchange = function () {
      s.settings.dailyNew = Math.max(5, Math.min(30, parseInt(num.value, 10) || 10));
      num.value = s.settings.dailyNew; store.save();
    };
    r1.appendChild(num); c1.appendChild(r1);

    var r2 = el('div', 'setting-row');
    r2.appendChild(el('label', null, '朗读语速'));
    var sel = el('select');
    [['0.75', '慢速（0.75x）'], ['1', '正常（1x）'], ['0.9', '稍慢（0.9x）']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; sel.appendChild(op);
    });
    sel.value = String(s.settings.ttsRate);
    if (!sel.value) sel.value = '1';
    sel.onchange = function () { s.settings.ttsRate = parseFloat(sel.value); DeTTS.setRate(s.settings.ttsRate); store.save(); };
    r2.appendChild(sel); c1.appendChild(r2);

    if (!DeTTS.available()) {
      c1.appendChild(el('p', 'stat-label', '当前浏览器不支持语音朗读，建议使用 Chrome 或 Edge。'));
    }
    v.appendChild(c1);

    var c2 = el('div', 'card');
    c2.appendChild(el('h3', null, '数据备份'));
    c2.appendChild(el('p', 'stat-label', '学习进度保存在本浏览器中。换电脑或清缓存前，请先导出备份。'));
    var row = el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    var bExp = el('button', 'btn btn-ghost btn-sm', '导出进度（JSON）');
    bExp.onclick = function () {
      var blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'de-a1-backup-' + DeStorage.today() + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    };
    row.appendChild(bExp);
    var bImp = el('button', 'btn btn-ghost btn-sm', '导入进度');
    var file = el('input'); file.type = 'file'; file.accept = '.json'; file.style.display = 'none';
    bImp.onclick = function () { file.click(); };
    file.onchange = function () {
      var f = file.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          store.replaceState(JSON.parse(fr.result));
          alert('导入成功。');
          render();
        } catch (e) { alert('导入失败：文件不是有效的备份 JSON。'); }
      };
      fr.readAsText(f);
    };
    row.appendChild(bImp); row.appendChild(file);
    c2.appendChild(row);
    v.appendChild(c2);

    var c3 = el('div', 'card');
    c3.appendChild(el('h3', null, '重置'));
    c3.appendChild(el('p', 'stat-label', '清空全部学习进度、错题本和打卡记录，不可恢复。'));
    var bReset = el('button', 'btn btn-sm', '重置全部进度');
    bReset.style.background = 'var(--f)'; bReset.style.borderColor = 'var(--f)';
    bReset.onclick = function () {
      if (confirm('确定要清空全部学习进度吗？此操作不可恢复。')) {
        store.reset(); render();
      }
    };
    c3.appendChild(bReset);
    v.appendChild(c3);
    return v;
  }

  /* ---------- 路由 ---------- */
  function render() {
    var hash = location.hash || '#/';
    var view = document.getElementById('view');
    view.innerHTML = '';
    var cur = navActive(hash);
    document.querySelectorAll('#nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === cur);
    });

    var m;
    if (hash === '#/' || hash === '') view.appendChild(dashboard());
    else if (hash === '#/vocab') view.appendChild(Vocab.themesPage());
    else if (hash === '#/learn') view.appendChild(Vocab.learnSession());
    else if (hash === '#/review') view.appendChild(Vocab.reviewSession());
    else if (hash === '#/review-mistakes') view.appendChild(Vocab.reviewSession(true));
    else if ((m = hash.match(/^#\/theme\/([\w-]+)$/))) view.appendChild(Vocab.learnSession(m[1]));
    else if (hash === '#/grammar') view.appendChild(Grammar.listPage());
    else if ((m = hash.match(/^#\/topic\/([\w-]+)$/))) view.appendChild(Grammar.topicPage(m[1]));
    else if (hash === '#/mistakes') view.appendChild(Mistakes.page());
    else if (hash === '#/settings') view.appendChild(settingsPage());
    else view.appendChild(dashboard());
    window.scrollTo(0, 0);
  }

  function navActive(hash) {
    if (hash.indexOf('#/vocab') === 0 || hash.indexOf('#/learn') === 0 || hash.indexOf('#/review') === 0 || hash.indexOf('#/theme') === 0) return '/vocab';
    if (hash.indexOf('#/grammar') === 0 || hash.indexOf('#/topic') === 0) return '/grammar';
    if (hash.indexOf('#/mistakes') === 0) return '/mistakes';
    if (hash.indexOf('#/settings') === 0) return '/settings';
    return '/';
  }

  window.addEventListener('hashchange', render);
  DeTTS.setRate(store.state.settings.ttsRate);
  render();
})();
