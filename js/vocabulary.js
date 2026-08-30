/* 词汇模块：主题列表、学新词（百词斩式：预览分流→选择→拼写→小结）、SRS 复习 */
var Vocab = (function () {
  'use strict';
  var GENDER_LABEL = { m: ['der', 'm'], f: ['die', 'f'], n: ['das', 'n'], pl: ['die', 'pl'] };

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
    c.appendChild(UI.el('div', null, genderTag(w.g) + '<span class="stat-label">' + w.themeName + ' · ' + (w.level || 'A1') + '</span>'));
    var hasImg = !!(window.IMAGE_WORDS && window.IMAGE_WORDS.indexOf && window.IMAGE_WORDS.indexOf(w.id) >= 0);
    if (hasImg) {
      var img = UI.el('img', 'word-img');
      img.src = 'images/words/' + w.id + '.jpg';
      img.alt = w.zh;
      img.loading = 'lazy';
      c.appendChild(img);
    }
    var de = UI.el('div', 'word-de');
    de.innerHTML = UI.esc(w.de);
    de.appendChild(speakBtn(w.de, 'word', w.id));
    c.appendChild(de);
    c.appendChild(UI.el('div', 'word-zh', UI.esc(w.zh)));
    var ex = UI.el('div', 'word-ex');
    ex.innerHTML = highlightEx(w) + '<br><span>' + UI.esc(w.exZh) + '</span>';
    var sp = speakBtn(w.ex, 'sent', w.id); sp.title = '朗读例句';
    ex.insertBefore(sp, ex.firstChild);
    c.appendChild(ex);
    return c;
  }

  // 干扰项：取 3 个不同词条（keyFn 用于去重，如同义中文）
  function distractors(w, keyFn) {
    var pool = ALL_WORDS.filter(function (x) { return x.id !== w.id && x.zh !== w.zh; });
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var seen = {}, opts = [];
    for (var k = 0; k < pool.length && opts.length < 3; k++) {
      var key = keyFn(pool[k]);
      if (!seen[key]) { seen[key] = 1; opts.push(pool[k]); }
    }
    return opts;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // 拼写提示：除首字母外全部遮住（der Tag → d·· T·g）
  function maskWord(de) {
    return de.split(' ').map(function (tok) {
      if (/^(der|die|das)$/i.test(tok)) return tok[0] + '··';
      return tok[0] + '·'.repeat(Math.max(1, tok.length - 1));
    }).join(' ');
  }

  /* ---------- 主题列表 ---------- */
  function themesPage() {
    var s = store.state;
    var lv = window.currentLevel();
    var themes = VOCAB_THEMES.filter(function (t) { return (t.level || 'A1') === lv; });
    var total = themes.reduce(function (n, t) { return n + t.words.length; }, 0);
    var v = UI.el('div');
    v.appendChild(UI.el('h1', 'page-title', '词汇 · ' + lv));
    v.appendChild(UI.el('p', 'page-sub', themes.length + ' 个主题 · ' + total + ' 个核心词。点进主题学习，或从「今日」开始每日计划。'));
    var list = UI.el('div', 'theme-list');
    themes.forEach(function (t) {
      var learned = 0;
      t.words.forEach(function (w, i) { if (s.srs[t.id + '-' + i]) learned++; });
      var a = UI.el('a', 'theme-item');
      a.href = '#/theme/' + t.id;
      var cover = (window.IMAGE_COVERS && window.IMAGE_COVERS.indexOf(t.id) >= 0)
        ? '<img class="theme-cover" loading="lazy" src="images/covers/' + t.id + '.png" alt="">'
        : '<div class="theme-cover theme-cover-empty"></div>';
      a.innerHTML = cover + '<span class="t-name">' + UI.esc(t.name) + '</span>' +
        '<span class="t-meta">' + learned + ' / ' + t.words.length + ' 已学</span>';
      list.appendChild(a);
    });
    v.appendChild(list);
    return v;
  }

  /* ---------- 学新词（百词斩式流程） ----------
     每词：预览分流 →（不认识）看词选义 → 听音选词 → 拼写检验
           （认识）直接拼写检验
     拼写：中文释义+音频，输错一次给首字母提示，两次错显示答案
     全部完成后组末小结 */
  function pickNewWords(themeId, limit) {
    var s = store.state;
    var lv = window.currentLevel();
    var pool = ALL_WORDS.filter(function (w) {
      return w.level === lv && (!themeId || w.theme === themeId) && !s.srs[w.id];
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

    var idx = 0, results = [];
    var dots = UI.el('div', 'progress-dots');
    queue.forEach(function () { dots.appendChild(UI.el('div', 'dot')); });
    v.appendChild(dots);
    var stage = UI.el('div');
    v.appendChild(stage);

    function paintDots() {
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
    }

    /* --- 第一步：预览分流 --- */
    function showPreview() {
      paintDots();
      stage.innerHTML = '';
      var w = queue[idx];
      stage.appendChild(wordCard(w));
      DeAudio.playWord(w.id, w.de);
      var hint = UI.el('p', 'stat-label', '认识吗？认识的词直接进入拼写检验，不认识的词走完整练习。');
      hint.style.margin = '10px 0 0';
      stage.appendChild(hint);
      var rate = UI.el('div', 'self-rate');
      var bNo = UI.el('button', 'btn rate-no', '不认识');
      bNo.onclick = function () { startSteps(w, false); };
      rate.appendChild(bNo);
      var bYes = UI.el('button', 'btn btn-ghost', '认识');
      bYes.onclick = function () { startSteps(w, true); };
      rate.appendChild(bYes);
      stage.appendChild(rate);
    }

    /* --- 后续步骤 --- */
    function startSteps(w, knows) {
      var steps = knows ? ['spell'] : ['trans', 'listen', 'spell'];
      var si = 0, wrongs = 0, spellFails = 0;

      function nextStep() {
        si++;
        if (si >= steps.length) finishWord(w, wrongs, spellFails);
        else renderStep();
      }

      function renderStep() {
        stage.innerHTML = '';
        var kind = steps[si];
        var card = UI.el('div', 'card');
        var stepLabel = UI.el('p', 'stat-label', '第 ' + (idx + 1) + ' 词 · 步骤 ' + (si + 1) + '/' + steps.length);
        card.appendChild(stepLabel);
        var fb = UI.el('div');
        var next = UI.el('button', 'btn', '继续');
        next.style.display = 'none';
        next.onclick = nextStep;

        function wrongAnswer() {
          wrongs++;
          store.addMistake('vocab', w.id);
        }
        function reveal(msg) {
          DeAudio.playWord(w.id, w.de);
          fb.innerHTML = '<div class="feedback ' + (msg.indexOf('正确') === 0 ? 'ok' : 'bad') + '">' + msg + '</div>';
          next.style.display = 'inline-block';
          next.focus();
        }

        if (kind === 'trans') {
          // 看德语选中文
          card.appendChild(UI.el('div', 'quiz-prompt', UI.esc(w.de) + ' 的意思是？'));
          var opts = shuffle([w].concat(distractors(w, function (x) { return x.zh; })));
          var box = UI.el('div', 'opts');
          opts.forEach(function (o) {
            var b = UI.el('button', 'opt', UI.esc(o.zh));
            b.onclick = function () {
              if (o.id === w.id) { b.classList.add('correct'); reveal('正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh)); }
              else {
                b.classList.add('wrong'); wrongAnswer();
                box.querySelectorAll('.opt').forEach(function (x, i) { if (opts[i].id === w.id) x.classList.add('correct'); });
                reveal('再记一次：' + UI.esc(w.de) + ' = ' + UI.esc(w.zh));
              }
            };
            box.appendChild(b);
          });
          card.appendChild(box);
        } else if (kind === 'listen') {
          // 听音选词
          var play = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
          play.style.marginBottom = '12px';
          play.onclick = function () { DeAudio.playWord(w.id, w.de); };
          card.appendChild(play);
          DeAudio.playWord(w.id, w.de);
          card.appendChild(UI.el('div', 'quiz-prompt', '听音频，选出你听到的词'));
          var optsL = shuffle([w].concat(distractors(w, function (x) { return x.de; })));
          var boxL = UI.el('div', 'opts');
          optsL.forEach(function (o) {
            var b = UI.el('button', 'opt', UI.esc(o.de));
            b.onclick = function () {
              if (o.id === w.id) { b.classList.add('correct'); reveal('正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh)); }
              else {
                b.classList.add('wrong'); wrongAnswer();
                boxL.querySelectorAll('.opt').forEach(function (x, i) { if (optsL[i].id === w.id) x.classList.add('correct'); });
                reveal('正确答案：' + UI.esc(w.de) + '（' + UI.esc(w.zh) + '）');
              }
            };
            boxL.appendChild(b);
          });
          card.appendChild(boxL);
        } else {
          // 拼写检验：根据中文释义（+可听音频）拼写
          var isNoun = /^(der|die|das) /.test(w.de);
          var head = UI.el('div', 'quiz-prompt');
          head.innerHTML = '拼写这个单词：' + UI.esc(w.zh) +
            (isNoun ? ' ' + genderTag(w.g) + '<span class="stat-label">（冠词可写可不写）</span>' : '');
          card.appendChild(head);
          var play2 = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
          play2.style.margin = '0 0 12px';
          play2.onclick = function () { DeAudio.playWord(w.id, w.de); };
          card.appendChild(play2);
          var input = UI.el('input');
          input.type = 'text'; input.autocomplete = 'off';
          input.style.cssText = 'font-size:18px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;width:100%;max-width:380px;font-family:inherit;background:var(--card);color:var(--ink)';
          input.placeholder = '输入德语单词';
          card.appendChild(input);
          var check = UI.el('button', 'btn btn-sm', '检查拼写');
          check.style.marginTop = '12px';
          var attempts = 0;
          check.onclick = function () {
            if (!input.value.trim()) { input.focus(); return; }
            attempts++;
            if (DeSRS.matches(input.value, w.de)) {
              if (attempts === 1 && wrongs === 0) { /* 一次通过 */ }
              reveal('正确！拼写通过');
            } else if (attempts === 1) {
              // 第一次错：给提示再试一次
              var tip = UI.el('div', 'feedback bad', '不对。提示：' + UI.esc(maskWord(w.de)) + '（再试一次）');
              fb.innerHTML = ''; fb.appendChild(tip);
              input.value = ''; input.focus();
              wrongAnswer();
              return;
            } else {
              spellFails++;
              reveal('正确拼写是：<b>' + UI.esc(w.de) + '</b>（' + UI.esc(w.zh) + '），明天复习还会见到它');
            }
          };
          input.onkeydown = function (ev) { if (ev.key === 'Enter') { next.style.display === 'none' ? check.click() : next.click(); } };
          card.appendChild(check);
          card.appendChild(UI.el('p', 'stat-label', 'ä 可输 ae，ö 输 oe，ü 输 ue，ß 输 ss'));
          input.focus();
        }
        card.appendChild(fb);
        card.appendChild(next);
        stage.appendChild(card);
      }
      renderStep();
    }

    /* --- 单词完成，记入 FSRS --- */
    function finishWord(w, wrongs, spellFails) {
      var quality = (wrongs === 0 && spellFails === 0) ? 2 : (spellFails >= 2 ? 0 : 1);
      var card = store.state.srs[w.id];
      if (!card) { card = DeSRS.newCard(today); store.state.srs[w.id] = card; store.touchToday('new', 1); }
      DeSRS.review(card, quality, today);
      store.save();
      if (spellFails === 0 && store.state.mistakes[w.id]) store.removeMistake(w.id);
      results.push({ w: w, ok: spellFails === 0 });
      idx++;
      if (idx < queue.length) showPreview();
      else showSummary();
    }

    /* --- 组末小结 --- */
    function showSummary() {
      paintDots();
      stage.innerHTML = '';
      var pass = results.filter(function (r) { return r.ok; }).length;
      var done = UI.el('div', 'card');
      done.appendChild(UI.el('h3', null, '这组学完了'));
      done.appendChild(UI.el('div', 'result-num', pass + ' / ' + queue.length));
      done.appendChild(UI.el('p', 'stat-label', pass === queue.length ? '全部拼写通过，掌握得不错！' : '拼写未一次通过的词已重点标记，复习时优先安排。'));
      var list = UI.el('div', null);
      list.style.margin = '12px 0';
      results.forEach(function (r) {
        var item = UI.el('div', 'mistake-item');
        item.innerHTML = '<div class="m-body">' + genderTag(r.w.g) + ' <b>' + UI.esc(r.w.de) + '</b> — ' + UI.esc(r.w.zh) + '</div>' +
          '<span class="badge' + (r.ok ? ' badge-on' : '') + '">' + (r.ok ? '拼写通过' : '需巩固') + '</span>';
        item.appendChild(speakBtn(r.w.de, 'word', r.w.id));
        list.appendChild(item);
      });
      done.appendChild(list);
      var row = UI.el('div', null); row.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap';
      var b1 = UI.el('button', 'btn', '再学一组');
      b1.onclick = function () { render(); };
      if (!pickNewWords(themeId, 1).length) b1.disabled = true;
      row.appendChild(b1);
      var b2 = UI.el('button', 'btn btn-ghost', '回到词汇主题');
      b2.onclick = function () { location.hash = themeId ? '#/vocab' : '#/'; };
      row.appendChild(b2);
      done.appendChild(row);
      stage.appendChild(done);
    }

    showPreview();
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
    // 语法卡 id 含 '#'（如 g-praesens#2），wordById 返回 undefined，被 filter(Boolean) 天然排除
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

    // 为每个词生成一种题型
    function buildQuestion(w) {
      var types = ['gender', 'trans', 'listen', 'cloze', 'dict'];
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
        var wrong = distractors(w, function (x) { return x.zh; });
        q.options = shuffle([w].concat(wrong)).map(function (x) { return { word: x, text: x.zh }; });
        q.explain = w.de + ' = ' + w.zh;
      } else if (type === 'listen') {
        q.prompt = '听音频，选出你听到的词 🔊（点喇叭可重听）';
        var wrongL = distractors(w, function (x) { return x.de; });
        q.options = shuffle([w].concat(wrongL)).map(function (x) { return { word: x, text: x.de }; });
        q.explain = w.de + ' = ' + w.zh;
      } else if (type === 'dict') {
        // 听写：听音频拼写整个词（名词建议带冠词）
        q.prompt = '听音频，拼写出这个词' + (/^(der|die|das) /.test(w.de) ? '（含冠词，如 der Tag）' : '') +
          '<br><input id="cloze-input" autocomplete="off" placeholder="输入德语单词">';
        q.answerText = w.de;
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

    function show() {
      stage.innerHTML = '';
      dots.querySelectorAll('.dot').forEach(function (d, i) { d.classList.toggle('done', i < idx); });
      var w = queue[idx];
      var q = buildQuestion(w);
      var card = UI.el('div', 'card');
      if (q.type === 'listen' || q.type === 'dict') {
        var play = UI.el('button', 'btn btn-ghost btn-sm', '🔊 播放读音');
        play.onclick = function () { DeAudio.playWord(w.id, w.de); };
        play.style.marginBottom = '12px';
        card.appendChild(play);
        DeAudio.playWord(w.id, w.de);
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
        DeAudio.playWord(w.id, w.de);
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
      } else { // 填空/听写
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
    highlightEx: highlightEx,
    maskWord: maskWord
  };
})();
