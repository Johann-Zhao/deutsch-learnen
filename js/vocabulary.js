/* 词汇模块：主题列表、学新词、SRS 复习（词性/听音/翻译/例句填空） */
var Vocab = (function () {
  'use strict';
  var GENDER_LABEL = { m: ['der', 'm'], f: ['die', 'f'], n: ['das', 'n'], pl: ['die', 'pl'] };
  var gClass = { m: 'g-m', f: 'g-f', n: 'g-n', pl: '' };

  function genderTag(g) {
    return '<span class="gender-tag ' + g + '">' + GENDER_LABEL[g][0] + '</span>';
  }

  // 例句中高亮目标词（按词性染色）
  function highlightEx(word) {
    var de = word.de.replace(/^(der|die|das) /, '');
    var re = new RegExp('\\b(' + de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'i');
    return UI.esc(word.ex).replace(re, '<b class="hl-' + word.g + '">$1</b>');
  }

  function wordCard(w) {
    var c = UI.el('div', 'card word-card g-' + w.g);
    c.appendChild(UI.el('div', null, genderTag(w.g) + '<span class="stat-label">' + w.themeName + '</span>'));
    var de = UI.el('div', 'word-de');
    de.innerHTML = UI.esc(w.de);
    de.appendChild(speakBtn(w.de));
    c.appendChild(de);
    c.appendChild(UI.el('div', 'word-zh', UI.esc(w.zh)));
    var ex = UI.el('div', 'word-ex');
    ex.innerHTML = highlightEx(w) + '<br><span>' + UI.esc(w.exZh) + '</span>';
    var sp = speakBtn(w.ex, ''); sp.title = '朗读例句';
    ex.insertBefore(sp, ex.firstChild);
    c.appendChild(ex);
    return c;
  }

  /* ---------- 主题列表 ---------- */
  function themesPage() {
    var s = store.state, today = DeStorage.today();
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '词汇'));
    v.appendChild(UI.el('p', 'page-sub', '12 个主题 · ' + ALL_WORDS.length + ' 个 A1 核心词。点进主题学习，或从「今日」开始每日计划。'));
    var list = UI.el('div', 'theme-list');
    VOCAB_THEMES.forEach(function (t) {
      var learned = 0;
      t.words.forEach(function (w, i) { if (s.srs[t.id + '-' + i]) learned++; });
      var a = UI.el('a', 'theme-item');
      a.href = '#/theme/' + t.id;
      a.innerHTML = '<span class="t-name">' + UI.esc(t.name) + '</span>' +
        '<span class="t-meta">' + learned + ' / ' + t.words.length + ' 已学</span>';
      list.appendChild(a);
    });
    v.appendChild(list);
    return v;
  }

  /* ---------- 学新词 ---------- */
  function pickNewWords(themeId, limit) {
    var s = store.state;
    var pool = ALL_WORDS.filter(function (w) {
      return (!themeId || w.theme === themeId) && !s.srs[w.id];
    });
    return pool.slice(0, limit);
  }

  function learnSession(themeId) {
    var s = store.state;
    var today = DeStorage.today();
    var queue = pickNewWords(themeId, s.settings.dailyNew);
    var themeName = themeId ? (VOCAB_THEMES.find(function (t) { return t.id === themeId; }) || {}).name : '每日计划';

    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '学新词' + (themeId ? ' · ' + themeName : '')));

    if (!queue.length) {
      var empty = UI.el('div', 'card empty');
      if (themeId) {
        empty.innerHTML = '<p>这个主题的词都学过了。</p>';
        var b = UI.el('button', 'btn', '回到词汇主题');
        b.onclick = function () { location.hash = '#/vocab'; };
        empty.appendChild(b);
      } else {
        empty.innerHTML = '<p>所有词都至少学过一遍了！接下来靠复习巩固。</p>';
        var b2 = UI.el('button', 'btn', '去复习');
        b2.onclick = function () { location.hash = '#/review'; };
        empty.appendChild(b2);
      }
      v.appendChild(empty);
      return v;
    }

    var idx = 0;
    var dots = UI.el('div', 'progress-dots');
    queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    v.appendChild(dots);
    var stage = UI.el('div');
    v.appendChild(stage);

    function show() {
      stage.innerHTML = '';
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
      var w = queue[idx];
      stage.appendChild(wordCard(w));
      DeTTS.speak(w.de);
      var rate = UI.el('div', 'self-rate');
      [['rate-no', '不认识', 0], ['rate-mid btn-ghost', '有点模糊', 1], ['rate-yes', '认识', 2]].forEach(function (x) {
        var b = UI.el('button', 'btn ' + x[0], x[1]);
        b.onclick = function () { grade(w, x[2]); };
        rate.appendChild(b);
      });
      stage.appendChild(rate);
    }

    function grade(w, quality) {
      var card = store.state.srs[w.id];
      if (!card) { card = DeSRS.newCard(today); store.state.srs[w.id] = card; store.touchToday('new', 1); }
      DeSRS.review(card, quality, today);
      store.save();
      idx++;
      if (idx < queue.length) show();
      else {
        stage.innerHTML = ''; dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
        var done = UI.el('div', 'card');
        done.appendChild(UI.el('h3', null, '这组学完了'));
        done.appendChild(UI.el('p', 'stat-label', queue.length + ' 个新词已加入复习计划。首次复习最快明天到期。'));
        var row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
        var b1 = UI.el('button', 'btn', '再学一组');
        b1.onclick = function () { render(); };
        row.appendChild(b1);
        var more = pickNewWords(themeId, 1);
        if (!more.length) b1.disabled = true;
        var b2 = UI.el('button', 'btn btn-ghost', '回到词汇主题');
        b2.onclick = function () { location.hash = themeId ? '#/vocab' : '#/'; };
        row.appendChild(b2);
        done.appendChild(row);
        stage.appendChild(done);
      }
    }
    show();
    return v;
  }

  /* ---------- 复习（SRS） ---------- */
  function dueWords(onlyMistakes) {
    var s = store.state, today = DeStorage.today();
    var ids;
    if (onlyMistakes) {
      ids = Object.keys(s.mistakes).filter(function (id) { return s.mistakes[id].type === 'vocab' && s.srs[id]; });
    } else {
      ids = Object.keys(s.srs).filter(function (id) { return DeSRS.isDue(s.srs[id], today); });
    }
    return ids.map(window.wordById).filter(Boolean);
      }

  function reviewSession(onlyMistakes) {
    var s = store.state, today = DeStorage.today();
    var queue = dueWords(onlyMistakes).slice(0, 30);
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', onlyMistakes ? '错词重练' : '今日复习'));
    if (!queue.length) {
      var e = UI.el('div', 'card empty');
      e.innerHTML = '<p>' + (onlyMistakes ? '错题本是空的，保持！' : '今天没有到期的复习。学几个新词？') + '</p>';
      var b = UI.el('button', 'btn', '学新词');
      b.onclick = function () { location.hash = '#/learn'; };
      e.appendChild(b);
      v.appendChild(e);
      return v;
    }
    v.appendChild(UI.el('p', 'page-sub', queue.length + ' 个词 · 答对了会安排更久的间隔，答错明天再见'));

    var idx = 0, right = 0;
    var dots = UI.el('div', 'progress-dots');
    queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    v.appendChild(dots);
    var stage = UI.el('div');
    v.appendChild(stage);

    function wrongOptions(w, getKey) {
      var pool = ALL_WORDS.filter(function (x) { return x.id !== w.id && x.zh !== w.zh; });
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      var seen = {}, opts = [];
      for (var k = 0; k < pool.length && opts.length < 3; k++) {
        var key = getKey(pool[k]);
        if (!seen[key]) { seen[key] = 1; opts.push(pool[k]); }
      }
      return opts;
    }

    // 为每个词生成一种题型
    function buildQuestion(w) {
      var types = ['gender', 'trans', 'listen', 'cloze'];
      var type = types[Math.floor(Math.random() * types.length)];
      if (type === 'cloze' && !w.ex) type = 'trans';
      var q = { w: w, type: type, answered: false };

      if (type === 'gender') {
        q.prompt = UI.esc(w.de.replace(/^(der|die|das) /, '')) + ' —— ' + UI.esc(w.zh) + '<br>这个词的词性是？';
        q.opts = ['der（阳性）', 'die（阴性）', 'das（中性）'];
        q.answerIdx = { m: 0, f: 1, n: 2, pl: 1 }[w.g];
        q.explain = w.de + '（' + w.zh + '）';
      } else if (type === 'trans') {
        q.prompt = UI.esc(w.de) + ' 的意思是？';
        var wrong = wrongOptions(w, function (x) { return x.zh; });
        q.options = shuffle([w].concat(wrong)).map(function (x) { return { word: x, text: x.zh }; });
        q.explain = w.de + ' = ' + w.zh;
      } else if (type === 'listen') {
        q.prompt = '听音频，选出你听到的词 🔊（点喇叭可重听）';
        var wrongL = wrongOptions(w, function (x) { return x.de; });
        q.options = shuffle([w].concat(wrongL)).map(function (x) { return { word: x, text: x.de }; });
        q.explain = w.de + ' = ' + w.zh;
      } else {
        var blank = w.ex.replace(new RegExp('\\b' + w.de.replace(/^(der|die|das) /, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '＿＿＿');
        q.prompt = '填空：' + UI.esc(blank) + '<br><span class="stat-label">' + UI.esc(w.exZh) + '</span>' +
          '<br><input id="cloze-input" autocomplete="off" placeholder="输入缺少的德语词">';
        q.answerText = w.de.replace(/^(der|die|das) /, '');
        q.explain = w.ex + '（' + w.exZh + '）';
      }
      return q;
    }

    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function show() {
      stage.innerHTML = '';
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
      var w = queue[idx];
      var q = buildQuestion(w);
      var card = UI.el('div', 'card');
      if (q.type === 'listen') {
        var play = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
        play.onclick = function () { DeTTS.speak(w.de); };
        play.style.marginBottom = '12px';
        card.appendChild(play);
        DeTTS.speak(w.de);
      }
      var p = UI.el('div', 'quiz-prompt');
      p.innerHTML = q.prompt;
      card.appendChild(p);

      var fb = UI.el('div');
      var next = UI.el('button', 'btn', '下一个');
      next.style.display = 'none';
      next.onclick = function () { idx++; if (idx < queue.length) show(); else finish(); };

      function correct() {
        if (q.answered) return;
        q.answered = true; right++;
        store.touchToday('reviewed', 1); store.touchToday('correct', 1);
        var c = s.srs[w.id]; DeSRS.review(c, 2, today); store.save();
        if (s.mistakes[w.id]) store.removeMistake(w.id);
        fb.innerHTML = '<div class="feedback ok">正确 · ' + UI.esc(q.explain) + '</div>';
        reveal();
      }
      function wrongFn() {
        if (q.answered) return;
        q.answered = true;
        store.touchToday('reviewed', 1);
        var c = s.srs[w.id]; DeSRS.review(c, 0, today); store.save();
        store.addMistake('vocab', w.id);
        fb.innerHTML = '<div class="feedback bad">再记一次：' + UI.esc(q.explain) + '</div>';
        reveal();
      }
      function reveal() {
        DeTTS.speak(w.de);
        next.style.display = 'inline-block';
        next.focus();
      }

      if (q.opts) { // 词性三选一
        var box = UI.el('div', 'opts');
        q.opts.forEach(function (text, i) {
          var b = UI.el('button', 'opt', text);
          b.onclick = function () {
            if (q.answered) return;
            if (i === q.answerIdx) { b.classList.add('correct'); correct(); }
            else { b.classList.add('wrong'); box.children[q.answerIdx].classList.add('correct'); wrongFn(); }
          };
          box.appendChild(b);
        });
        card.appendChild(box);
      } else if (q.options) { // 选择题
        var box2 = UI.el('div', 'opts');
        q.options.forEach(function (o) {
          var b = UI.el('button', 'opt', UI.esc(o.text));
          b.onclick = function () {
            if (q.answered) return;
            if (o.word.id === w.id) { b.classList.add('correct'); correct(); }
            else {
              b.classList.add('wrong');
              box2.querySelectorAll('.opt').forEach(function (x, i) {
                if (q.options[i].word.id === w.id) x.classList.add('correct');
              });
              wrongFn();
            }
          };
          box2.appendChild(b);
        });
        card.appendChild(box2);
      } else { // 填空
        var check = UI.el('button', 'btn', '检查答案');
        check.style.marginTop = '12px';
        var input;
        check.onclick = function () {
          if (q.answered) return;
          input = document.getElementById('cloze-input');
          if (!input.value.trim()) { input.focus(); return; }
          if (DeSRS.matches(input.value, q.answerText)) correct();
          else wrongFn();
          if (input) input.disabled = true;
        };
        card.appendChild(check);
        card.appendChild(UI.el('p', 'stat-label', '输入时可不带冠词；ä 可输 ae，ö 输 oe，ü 输 ue，ß 输 ss'));
        card.onkeydown = function (ev) { if (ev.key === 'Enter' && !q.answered) check.click(); else if (ev.key === 'Enter') next.click(); };
      }
      card.appendChild(fb);
      card.appendChild(next);
      stage.appendChild(card);
      var inp = document.getElementById('cloze-input');
      if (inp) inp.focus();
    }

    function finish() {
      dots.querySelectorAll('.dot').forEach(function (d) { d.classList.add('done'); });
      stage.innerHTML = '';
      var done = UI.el('div', 'card');
      done.appendChild(UI.el('div', 'result-num', right + ' / ' + queue.length));
      done.appendChild(UI.el('p', 'stat-label', '答对 ' + right + ' 个 · 答错的词已加入错题本，明天还会再见到它们'));
      var row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
      var still = dueWords(onlyMistakes).length;
      if (still > 0) {
        var b0 = UI.el('button', 'btn', '继续复习剩下 ' + still + ' 个');
        b0.onclick = function () { render(); };
        row.appendChild(b0);
      }
      var b1 = UI.el('button', 'btn btn-ghost', '回首页');
      b1.onclick = function () { location.hash = '#/'; };
      row.appendChild(b1);
      done.appendChild(row);
      stage.appendChild(done);
    }

    show();
    return v;
  }

  return {
    themesPage: themesPage,
    learnSession: learnSession,
    reviewSession: reviewSession,
    dueWords: dueWords,
    genderTag: genderTag,
    highlightEx: highlightEx
  };
})();
