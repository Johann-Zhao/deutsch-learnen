/* 图片四选一模块：学新词与复习共用的看图选词题（百词斩式） */

import { UI } from './ui.js';

export function hasImage(w, imageIds) {
  return imageIds.indexOf(w.id) >= 0;
}

// 干扰项：候选须 id ∈ imageIds、id/zh 与目标词不同；同主题优先 → 同级别补足 → 全池补足
export function pickImageDistractors(w, imageIds, pool) {
  const eligible = pool.filter(function (x) {
    return x.id !== w.id && x.zh !== w.zh && imageIds.indexOf(x.id) >= 0;
  });
  const seen = {};
  function dedupe(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      if (!seen[list[i].zh]) { seen[list[i].zh] = 1; out.push(list[i]); }
    }
    return out;
  }
  const sameTheme = dedupe(eligible.filter(function (x) { return x.theme === w.theme; }));
  const sameLevel = dedupe(eligible.filter(function (x) { return x.theme !== w.theme && x.level === w.level; }));
  const rest = dedupe(eligible.filter(function (x) { return x.theme !== w.theme && x.level !== w.level; }));
  return sameTheme.concat(sameLevel, rest).slice(0, 3);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// 正确图与干扰项一起洗牌，决定 2×2 格子中的渲染顺序（纯函数，供测试采样位置）
export function orderImageChoices(correct, distractors) {
  return shuffle([correct].concat(distractors));
}

// 渲染 2×2 图片选择题；ctx = { imageIds, pool, speak(id, de), onDone(firstTry) }
export function renderImageChoice(container, w, ctx) {
  container.innerHTML = '';
  let wrongTries = 0, done = false;
  const used = [w.id];
  const wrongBtns = []; // 当前在屏的错误选项（可被淘汰/排除）

  const head = UI.el('div', 'quiz-prompt');
  head.innerHTML = UI.esc(w.de) + ' 是哪个？';
  container.appendChild(head);
  ctx.speak(w.id, w.de);

  const fb = UI.el('div');
  container.appendChild(fb);
  function showFb(cls, msg) {
    fb.innerHTML = '<div class="feedback ' + cls + '">' + msg + '</div>';
  }

  const grid = UI.el('div', 'img-grid');
  container.appendChild(grid);

  function spareDistractors() {
    return pickImageDistractors(w, ctx.imageIds, ctx.pool).filter(function (d) {
      return used.indexOf(d.id) < 0;
    });
  }

  function buildOpt(word, isCorrect) {
    used.push(word.id);
    const b = UI.el('button', 'img-opt');
    b.type = 'button';
    const img = UI.el('img');
    img.src = 'images/words/' + word.id + '.jpg';
    img.alt = word.zh;
    b.appendChild(img);
    b.onclick = function () { pick(b, isCorrect); };
    img.onerror = function () {
      b.style.display = 'none';
      b.disabled = true;
      if (done) return;
      if (isCorrect) {
        // 正确图缺失：题目无法作答，按答错处理
        done = true;
        eliminate();
        showFb('bad', '图片加载失败，按答错处理');
        setTimeout(function () { ctx.onDone(false); }, 600);
        return;
      }
      const i = wrongBtns.indexOf(b);
      if (i >= 0) wrongBtns.splice(i, 1);
      refill();
    };
    return b;
  }

  // 某张图加载失败：从池再补一个干扰项（正确图始终在屏）
  function refill() {
    if (done) return;
    const spare = spareDistractors();
    if (!spare.length) return;
    const nb = buildOpt(spare[0], false);
    wrongBtns.push(nb);
    grid.appendChild(nb);
  }

  function eliminate() {
    wrongBtns.forEach(function (b) { b.disabled = true; });
  }

  function pick(b, isCorrect) {
    if (done || b.disabled) return;
    if (isCorrect) {
      done = true;
      b.classList.add('correct');
      eliminate();
      showFb('ok', '正确 · ' + UI.esc(w.de) + ' = ' + UI.esc(w.zh));
      const firstTry = wrongTries === 0;
      setTimeout(function () { ctx.onDone(firstTry); }, 600);
      return;
    }
    wrongTries++;
    b.classList.add('wrong');
    b.disabled = true;
    const i = wrongBtns.indexOf(b);
    if (i >= 0) wrongBtns.splice(i, 1);
    if (wrongTries === 1) {
      showFb('', '提示：' + UI.esc(w.zh));
    } else if (wrongTries === 2) {
      // 再随机排除 1 个错误选项（变 2 选 1；只剩 1 个时不再排除）
      if (wrongBtns.length >= 2) {
        const k = Math.floor(Math.random() * wrongBtns.length);
        wrongBtns[k].classList.add('wrong');
        wrongBtns[k].disabled = true;
        wrongBtns.splice(k, 1);
      }
      showFb('', '再排除一个，二选一');
    } else {
      correctBtn.classList.add('correct');
      showFb('', '正确答案已标出，点它记住');
    }
  }

  const correctBtn = buildOpt(w, true);
  const ds = pickImageDistractors(w, ctx.imageIds, ctx.pool).map(function (d) {
    const b = buildOpt(d, false);
    wrongBtns.push(b);
    return b;
  });
  orderImageChoices(correctBtn, ds).forEach(function (b) { grid.appendChild(b); });
}
