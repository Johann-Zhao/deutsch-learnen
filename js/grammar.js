/* 语法模块：专题列表、讲解页、交互练习与判分 */
var Grammar = (function () {
  'use strict';

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
    var v = UI.el('div');
    if (!topic) { location.hash = '#/grammar'; return v; }
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
        var item = UI.el('div');
        item.appendChild(UI.el('div', 'quiz-prompt', '第 ' + (idx + 1) + ' 题：' + UI.esc(ex.q)));
        var fb = UI.el('div');
        var next = UI.el('button', 'btn', idx < topic.exercises.length - 1 ? '下一题' : '看结果');
        next.style.display = 'none';
        var answered = false;

        function onAnswer(ok) {
          if (answered) return;
          answered = true;
          var mid = topic.id + '#' + idx;
          if (ok) {
            right++;
            store.removeMistake(mid);
            fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(ex.tip) + '</div>';
          } else {
            store.addMistake('grammar', mid);
            fb.innerHTML = '<div class="feedback bad">不对。' + UI.esc(ex.tip) + '</div>';
          }
          store.save();
          next.style.display = 'inline-block';
          next.focus();
        }
        next.onclick = function () { idx++; if (idx < topic.exercises.length) show(); else finish(); };

        if (ex.type === 'choice') {
          var opts = UI.el('div', 'opts');
          ex.opts.forEach(function (text, i) {
            var b = UI.el('button', 'opt', UI.esc(text));
            b.onclick = function () {
              if (answered) return;
              if (i === ex.a) { b.classList.add('correct'); onAnswer(true); }
              else { b.classList.add('wrong'); opts.children[ex.a].classList.add('correct'); onAnswer(false); }
            };
            opts.appendChild(b);
          });
          item.appendChild(opts);
        } else {
          var input = UI.el('input');
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
            onAnswer(ok);
            if (!ok) input.style.borderColor = 'var(--bad)';
          };
          input.onkeydown = function (ev) { if (ev.key === 'Enter') { answered ? next.click() : check.click(); } };
          item.appendChild(check);
        }
        item.appendChild(fb);
        item.appendChild(next);
        box.appendChild(item);
        if (input) input.focus();
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

  return { listPage: listPage, topicPage: topicPage };
})();

/* ---------- 错题本 ---------- */
var Mistakes = (function () {
  'use strict';
  function page() {
    var s = store.state;
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '错题本'));
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
      item.innerHTML = '<div class="m-body">' + body + '</div><span class="badge">错 ' + x.m.wrong + ' 次</span>' +
        (x.m.type === 'vocab' ? '' : ' <a class="btn btn-ghost btn-sm" href="#/topic/' + x.id.split('#')[0] + '">重练</a>');
      list.appendChild(item);
    });
    v.appendChild(list);
    return v;
  }
  return { page: page };
})();
