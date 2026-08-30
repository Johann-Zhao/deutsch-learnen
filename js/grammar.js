/* 语法模块：专题列表、讲解页、交互练习与判分 */
var Grammar = (function () {
  'use strict';

  // 渲染单道语法题（choice/fill），供专题练习与语法复习共用
  // onAnswer(ok) 在答题后被调用；nextText 为下一题按钮文案
  function renderExerciseItem(ex, number, onAnswer, nextText) {
    var item = UI.el('div');
    item.appendChild(UI.el('div', 'quiz-prompt', '第 ' + number + ' 题：' + UI.esc(ex.q)));
    var fb = UI.el('div');
    var next = UI.el('button', 'btn', nextText);
    next.style.display = 'none';
    var answered = false;
    var input;

    function finishAnswer(ok) {
      if (answered) return;
      answered = true;
      onAnswer(ok);
      fb.innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'bad') + '">' +
        (ok ? '正确 · ' : '不对。') + UI.esc(ex.tip || '') + '</div>';
      next.style.display = 'inline-block';
      next.focus();
    }

    if (ex.type === 'choice') {
      var opts = UI.el('div', 'opts');
      ex.opts.forEach(function (text, i) {
        var b = UI.el('button', 'opt', UI.esc(text));
        b.onclick = function () {
          if (answered) return;
          if (i === ex.a) { b.classList.add('correct'); finishAnswer(true); }
          else { b.classList.add('wrong'); opts.children[ex.a].classList.add('correct'); finishAnswer(false); }
        };
        opts.appendChild(b);
      });
      item.appendChild(opts);
    } else {
      input = UI.el('input');
      input.type = 'text'; input.autocomplete = 'off';
      input.style.cssText = 'font-size:17px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;width:100%;max-width:380px;font-family:inherit;background:var(--card);color:var(--ink)';
      input.placeholder = '输入答案（不区分大小写）';
      item.appendChild(input);
      var check = UI.el('button', 'btn btn-sm', '检查答案');
      check.style.cssText = 'margin-top:12px;margin-left:0;display:block';
      check.onclick = function () {
        if (answered) return;
        if (!input.value.trim()) { input.focus(); return; }
        var ok = DeSRS.matches(input.value, ex.a);
        input.disabled = true;
        finishAnswer(ok);
        if (!ok) input.style.borderColor = 'var(--bad)';
      };
      input.onkeydown = function (ev) { if (ev.key === 'Enter') { answered ? next.click() : check.click(); } };
      item.appendChild(check);
    }

    item.appendChild(fb);
    item.appendChild(next);
    return { element: item, next: next, focus: function () { if (input) input.focus(); } };
  }

  function listPage() {
    var s = store.state;
    var lv = window.currentLevel();
    var topics = GRAMMAR.filter(function (t) { return (t.level || 'A1') === lv; });
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '语法 · ' + lv));
    v.appendChild(UI.el('p', 'page-sub', topics.length + ' 个 ' + lv + ' 专题，每个专题 = 讲解 + 交互练习。做错的题会进入错题本。'));
    topics.forEach(function (t) {
      var done = s.grammarDone[t.id];
      var a = UI.el('a', 'topic-item');
      a.href = '#/topic/' + t.id;
      a.innerHTML = '<div class="t-name">' + UI.esc(t.title) +
        (done ? ' <span class="badge">最佳 ' + done + '/' + t.exercises.length + '</span>' : '') + '</div>' +
        '<div class="t-desc">' + UI.esc(t.summary) + '</div>';
      v.appendChild(a);
    });
    return v;
  }

  function topicPage(id) {
    var topic = GRAMMAR.find(function (t) { return t.id === id; });
    var today = DeStorage.today();
    var v = UI.el('div');
    if (!topic) {
      // 跨级别防御：若专题属于尚未加载的级别，先懒加载
      var lv = (window.GRAMMAR_LEVELS && window.GRAMMAR_LEVELS[id]) || (window.inferLevelFromId && window.inferLevelFromId(id));
      if (lv && lv !== 'A1' && window.isLevelLoaded && !window.isLevelLoaded(lv) && window.loadLevelData) {
        var loading = UI.el('div', 'card', '<p>加载 ' + lv + ' 语法数据...</p>');
        window.loadLevelData(lv).then(function () { if (window.render) window.render(); }).catch(function (e) {
          console.error(e);
          loading.innerHTML = '<p>加载失败，请重试。</p>';
        });
        return loading;
      }
      location.hash = '#/grammar';
      return v;
    }
    v.appendChild(UI.el('h1', 'page-title', UI.esc(topic.title)));
    v.appendChild(UI.el('p', 'page-sub', UI.esc(topic.summary)));

    var lesson = UI.el('div', 'card lesson');
    lesson.innerHTML = topic.lesson;
    v.appendChild(lesson);

    var sec = UI.el('div', 'card');
    sec.appendChild(UI.el('h3', null, '练习（' + topic.exercises.length + ' 题）'));
    var startRow = UI.el('div', null); startRow.style.marginTop = '12px';
    var startBtn = UI.el('button', 'btn', '开始练习');
    var stage = UI.el('div');
    startBtn.onclick = function () { startBtn.style.display = 'none'; runExercises(); };
    startRow.appendChild(startBtn);
    sec.appendChild(startRow);
    sec.appendChild(stage);
    v.appendChild(sec);

    function runExercises() {
      var idx = 0, right = 0;
      var dots = UI.el('div', 'progress-dots');
      topic.exercises.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
      stage.innerHTML = '';
      stage.appendChild(dots);
      var box = UI.el('div');
      stage.appendChild(box);

      function show() {
        box.innerHTML = '';
        dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
        var ex = topic.exercises[idx];

        function onAnswer(ok) {
          var mid = topic.id + '#' + idx;
          // 无论对错都进入 FSRS 调度，卡片 id 复用错题 key 格式
          store.state.srs[mid] = DeSRS.review(store.state.srs[mid] || null, ok ? 2 : 0, today);
          if (ok) {
            right++;
            store.removeMistake(mid);
          } else {
            store.addMistake('grammar', mid);
          }
          store.save();
        }

        var built = renderExerciseItem(ex, idx + 1, onAnswer, idx < topic.exercises.length - 1 ? '下一题' : '看结果');
        built.next.onclick = function () { idx++; if (idx < topic.exercises.length) show(); else finish(); };
        box.appendChild(built.element);
        built.focus();
      }

      function finish() {
        dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
        var prev = store.state.grammarDone[topic.id] || 0;
        store.state.grammarDone[topic.id] = Math.max(prev, right);
        store.save();
        box.innerHTML = '';
        var done = UI.el('div');
        done.appendChild(UI.el('div', 'result-num', right + ' / ' + topic.exercises.length));
        var msg = right === topic.exercises.length ? '全对！这个专题可以放心进入下一个。' :
          '答对 ' + right + ' 题。做错的题在错题本里，建议明天再来做一遍。';
        done.appendChild(UI.el('p', 'stat-label', msg));
        var row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
        var redo = UI.el('button', 'btn', '再做一遍');
        redo.onclick = function () { runExercises(); };
        row.appendChild(redo);
        var back = UI.el('button', 'btn btn-ghost', '回到语法列表');
        back.onclick = function () { location.hash = '#/grammar'; };
        row.appendChild(back);
        done.appendChild(row);
        box.appendChild(done);
      }
      show();
    }
    return v;
  }

  function reviewPage() {
    var s = store.state;
    var today = DeStorage.today();
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '语法复习'));

    // 跨级别防御：到期语法卡若属于未加载级别，先懒加载
    var needed = {};
    Object.keys(s.srs).forEach(function (id) {
      if (id.indexOf('#') === -1 || !DeSRS.isDue(s.srs[id], today)) return;
      var topicId = id.split('#')[0];
      var lv = (window.GRAMMAR_LEVELS && window.GRAMMAR_LEVELS[topicId]) || (window.inferLevelFromId && window.inferLevelFromId(topicId));
      if (lv && lv !== 'A1' && window.isLevelLoaded && !window.isLevelLoaded(lv)) needed[lv] = true;
    });
    var levels = Object.keys(needed);
    if (levels.length && window.loadLevelData) {
      var loading = UI.el('div', 'card', '<p>加载语法复习数据...</p>');
      Promise.all(levels.map(window.loadLevelData)).then(function () { if (window.render) window.render(); }).catch(function (e) {
        console.error(e);
        loading.innerHTML = '<p>加载失败，请重试。</p>';
      });
      return loading;
    }

    // 取 store.state.srs 中 key 含 # 且到期的语法卡，按 due 升序
    var queue = Object.keys(s.srs).filter(function (id) {
      return id.indexOf('#') >= 0 && DeSRS.isDue(s.srs[id], today);
    }).map(function (id) {
      var parts = id.split('#');
      var t = GRAMMAR.find(function (g) { return g.id === parts[0]; });
      var ex = t && t.exercises[+parts[1]];
      return { id: id, card: s.srs[id], ex: ex, due: s.srs[id].due };
    }).filter(function (item) { return item.ex; }).sort(function (a, b) { return a.due.localeCompare(b.due); });

    if (!queue.length) {
      var empty = UI.el('div', 'card empty');
      empty.innerHTML = '<p>今天没有到期的语法复习。</p>';
      var b = UI.el('button', 'btn', '去语法专题');
      b.onclick = function () { location.hash = '#/grammar'; };
      empty.appendChild(b);
      v.appendChild(empty);
      return v;
    }

    v.appendChild(UI.el('p', 'page-sub', queue.length + ' 道语法题到期，答对会安排更久的间隔。'));

    var idx = 0, right = 0;
    var dots = UI.el('div', 'progress-dots');
    queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    v.appendChild(dots);
    var stage = UI.el('div');
    v.appendChild(stage);

    function show() {
      stage.innerHTML = '';
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
      var item = queue[idx];

      function onAnswer(ok) {
        store.state.srs[item.id] = DeSRS.review(store.state.srs[item.id], ok ? 2 : 0, today);
        if (ok) {
          right++;
          store.removeMistake(item.id);
        } else {
          store.addMistake('grammar', item.id);
        }
        store.touchToday('reviewed', 1);
        if (ok) store.touchToday('correct', 1);
        store.save();
      }

      var built = renderExerciseItem(item.ex, idx + 1, onAnswer, idx < queue.length - 1 ? '下一题' : '看结果');
      built.next.onclick = function () { idx++; if (idx < queue.length) show(); else finish(); };
      stage.appendChild(built.element);
      built.focus();
    }

    function finish() {
      dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
      stage.innerHTML = '';
      var done = UI.el('div', 'card');
      done.appendChild(UI.el('div', 'result-num', right + ' / ' + queue.length));
      var rate = Math.round(right / queue.length * 100);
      done.appendChild(UI.el('p', 'stat-label', '答对率 ' + rate + '%'));

      var dist = {};
      queue.forEach(function (item) {
        var c = s.srs[item.id];
        if (c && c.due) dist[c.due] = (dist[c.due] || 0) + 1;
      });
      var dueList = Object.keys(dist).sort().map(function (d) { return d + '：' + dist[d] + ' 题'; }).join(' · ');
      done.appendChild(UI.el('p', 'stat-label', '下次到期分布：' + (dueList || '—')));

      var row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
      var b1 = UI.el('button', 'btn btn-ghost', '回首页');
      b1.onclick = function () { location.hash = '#/'; };
      row.appendChild(b1);
      done.appendChild(row);
      stage.appendChild(done);
    }

    show();
    return v;
  }

  return { listPage: listPage, topicPage: topicPage, reviewPage: reviewPage };
})();

/* ---------- 错题本 ---------- */
var Mistakes = (function () {
  'use strict';
  function page() {
    var s = store.state;
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '错题本'));

    // 跨级别防御：错题若属于未加载级别，先懒加载
    var needed = {};
    Object.keys(s.mistakes).forEach(function (id) {
      var m = s.mistakes[id];
      var lv;
      if (m.type === 'vocab') {
        var dash = id.lastIndexOf('-');
        var themeId = dash > 0 ? id.substring(0, dash) : id;
        lv = (window.THEME_LEVELS && window.THEME_LEVELS[themeId]) || (window.inferLevelFromId && window.inferLevelFromId(themeId));
      } else {
        var topicId = id.split('#')[0];
        lv = (window.GRAMMAR_LEVELS && window.GRAMMAR_LEVELS[topicId]) || (window.inferLevelFromId && window.inferLevelFromId(topicId));
      }
      if (lv && lv !== 'A1' && window.isLevelLoaded && !window.isLevelLoaded(lv)) needed[lv] = true;
    });
    var levels = Object.keys(needed);
    if (levels.length && window.loadLevelData) {
      var loading = UI.el('div', 'card', '<p>加载错题数据...</p>');
      Promise.all(levels.map(window.loadLevelData)).then(function () { if (window.render) window.render(); }).catch(function (e) {
        console.error(e);
        loading.innerHTML = '<p>加载失败，请重试。</p>';
      });
      return loading;
    }

    var entries = Object.keys(s.mistakes).map(function (id) {
      return { id: id, m: s.mistakes[id] };
    });
    if (!entries.length) {
      var e = UI.el('div', 'card empty');
      e.innerHTML = '<p>还没有错题。做错了题会自动收进来，方便集中攻克。</p>';
      var b = UI.el('button', 'btn', '去练习');
      b.onclick = function () { location.hash = '#/grammar'; };
      e.appendChild(b);
      v.appendChild(e);
      return v;
    }
    // 按错误次数排序
    entries.sort(function (a, b) { return b.m.wrong - a.m.wrong; });
    var vocabN = entries.filter(function (x) { return x.m.type === 'vocab'; }).length;

    var bar = UI.el('div', 'card');
    bar.appendChild(UI.el('h3', null, '共 ' + entries.length + ' 条（词汇 ' + vocabN + ' · 语法 ' + (entries.length - vocabN) + '）'));
    var row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
    if (vocabN) {
      var b1 = UI.el('button', 'btn btn-sm', '重练错词');
      b1.onclick = function () { location.hash = '#/review-mistakes'; };
      row.appendChild(b1);
    }
    var b2 = UI.el('button', 'btn btn-sm btn-ghost', '清空错题本');
    b2.onclick = function () {
      if (confirm('确定清空错题本吗？（只是移出记录，不影响学习进度）')) {
        s.mistakes = {}; store.save(); render();
      }
    };
    row.appendChild(b2);
    bar.appendChild(row);
    v.appendChild(bar);

    var list = UI.el('div', 'card');
    entries.forEach(function (x) {
      var item = UI.el('div', 'mistake-item');
      var body;
      if (x.m.type === 'vocab') {
        var w = window.wordById(x.id);
        body = w ? Vocab.genderTag(w.g) + ' <b>' + UI.esc(w.de) + '</b> — ' + UI.esc(w.zh) : x.id;
      } else {
        var parts = x.id.split('#');
        var t = GRAMMAR.find(function (g) { return g.id === parts[0]; });
        var ex = t && t.exercises[+parts[1]];
        body = '<span class="badge">语法</span> ' + (t ? UI.esc(t.title) + '：' : '') + (ex ? UI.esc(ex.q) : x.id);
      }
      var dueLabel = '';
      if (x.m.type === 'grammar' && s.srs[x.id] && s.srs[x.id].due) {
        dueLabel = ' <span class="badge">下次 ' + s.srs[x.id].due + '</span>';
      }
      item.innerHTML = '<div class="m-body">' + body + '</div><span class="badge">错 ' + x.m.wrong + ' 次</span>' +
        (x.m.type === 'vocab' ? '' : ' <a class="btn btn-ghost btn-sm" href="#/topic/' + x.id.split('#')[0] + '">重练</a>') + dueLabel;
      list.appendChild(item);
    });
    v.appendChild(list);
    return v;
  }
  return { page: page };
})();
