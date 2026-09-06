# S5 百词斩式单词学习 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。逐步实现，每任务结束提交。步骤用 checkbox 跟踪。

**Goal:** 按 `docs/superpowers/specs/2026-09-06-baicizhan-learning-design.md` 改造单词学习：图片四选一贯穿、渐进提示、详情抽屉、错词再练、进度可见、遗忘曲线复习排序。

**Architecture:** 新增 `src/imgquiz.js`（图片题型 + 选题纯逻辑，学新词与复习共用）；`src/vocabulary.js` 编排接入；`src/views.js` 进度展示；`css/style.css` 样式。SRS/存储零改动。

**Tech Stack:** 原生 ESM JS（src/ → esbuild → js/bundle.js）、Node 原生 assert 单测（tests/run.js）、Playwright E2E（shots/audit/test_flow.mjs）。

## Global Constraints

- 提交规范：`类型(范围): 中文描述`；分支 `phase/s5-baicizhan-learning`。
- `npm test` 必须全绿；改 `src/` 后由主代理统一 `npm run build`（子代理不跑 build）。
- UI 遵守 DESIGN.md：zine 纸感、词性三色仅小面积、无渐变/阴影堆叠、动效 ≤300ms、按钮写明结果。
- 词图白名单：`getImageWords()`（来自 `src/data.js`），图路径 `images/words/<id>.jpg`。
- 答案判定一律走 `SRS.matches`；播音用 `audio.playWord(id, de)`；按钮组件 `UI.el` / `speakBtn`（`src/ui.js`）。
- 子代理只做本任务文件，不动 README/CHANGELOG/AGENTS.md，不 git commit（主代理统一提交）。

## 现状锚点（已核实）

- `src/vocabulary.js`：`runSteps(w, steps, done)`（L257-394）支持步型 `trans/reverse/listen/spell`；加强编排 `startStrengthen`（L245-254）现为 `[pick('trans'), pick('reverse'), 'spell']`；`finishWord` quality 公式 L397-405；复习 `reviewSession`（L476+）内 `buildQuestion`（types 数组随机）与 `correct()/wrongFn()`（含 verify→seal 转正）。
- `src/srs.js`：`retrievability(stability, tDays)` 已导出；`seal`、`isDue`（sealed 拦截）S4 已加。
- `src/conjugate.js`：`export function lookup(input)` 返回 `{verb, forms[6], pp:[aux,part]}` 或 null（供详情抽屉变位小表）。
- 拼写提示 `maskWord(de)`（vocabulary.js:77）只露首字母。

---

### Task 1: 图片四选一模块 `src/imgquiz.js`

**Files:**
- Create: `src/imgquiz.js`
- Test: `tests/run.js`（追加用例）

**Interfaces:**
- Produces:
  - `pickImageDistractors(w, imageIds, pool) → [word, word, word]`：纯函数。`imageIds` 为 `getImageWords()` 返回的 id 数组；`pool` 为词数组（元素含 id/de/zh/theme/level）。规则：候选须 `id ∈ imageIds`、`id !== w.id`、`zh !== w.zh`；先取与 `w.theme` 同主题者，不足 3 个再补同级别（`w.level`）者，再不足补全池；返回恰好 3 个（池不足则有几个返回几个）。
  - `hasImage(w, imageIds) → boolean`：`imageIds.indexOf(w.id) >= 0`。
  - `renderImageChoice(container, w, ctx) → void`：渲染 2×2 图片选择题。`ctx = { imageIds, pool, speak(id, de), onDone(firstTry:boolean) }`。行为：题干「w.de 是哪个？」+ 自动 `ctx.speak`；4 图（正确图 `images/words/<w.id>.jpg` + `pickImageDistractors` 的 3 张，`shuffle` 后渲染 `<button class="img-opt"><img src=...></button>`）。渐进提示：第 1 次选错 → 该选项加 `.wrong` 置灰禁用 + 提示条显示「提示：中文释义」（不显示答案图）；第 2 次选错 → 再随机排除 1 个错误选项（变 2 选 1）+ 提示「再排除一个，二选一」；第 3 次选错 → 高亮正确图并提示「正确答案已标出，点它记住」；选对 → 正确图加 `.correct`，提示「正确 · de = zh」，延迟 600ms 调 `ctx.onDone(是否首次选对)`。图片 `onerror`：该选项直接隐藏且若 4 图不足则从池再补（仍不足则保证正确图在其中即可）。

- [ ] **Step 1: 写失败测试**（tests/run.js 追加）

```js
console.log('\n图片题选题逻辑：');
test('pickImageDistractors 同主题优先、去重、排除答案', function () {
  const img = ['a-0','a-1','a-2','a-3','b-0','b-1'];
  const pool = [
    {id:'a-0',zh:'苹果',theme:'a',level:'A1'},{id:'a-1',zh:'香蕉',theme:'a',level:'A1'},
    {id:'a-2',zh:'橙子',theme:'a',level:'A1'},{id:'a-3',zh:'葡萄',theme:'a',level:'A1'},
    {id:'b-0',zh:'桌子',theme:'b',level:'A1'},{id:'b-1',zh:'苹果',theme:'b',level:'A1'} // 同释义应排除
  ];
  const w = pool[0];
  const ds = pickImageDistractors(w, img, pool);
  assert.strictEqual(ds.length, 3);
  assert.ok(ds.every(function (d) { return d.id !== 'a-0' && d.zh !== '苹果'; }));
  assert.ok(ds.filter(function (d) { return d.theme === 'a'; }).length >= 2, '应优先同主题');
});
test('pickImageDistractors 同主题不足时跨主题补足', function () {
  const img = ['a-0','b-0','b-1','b-2'];
  const pool = [
    {id:'a-0',zh:'苹果',theme:'a',level:'A1'},
    {id:'b-0',zh:'香蕉',theme:'b',level:'A1'},{id:'b-1',zh:'橙子',theme:'b',level:'A1'},{id:'b-2',zh:'葡萄',theme:'b',level:'A1'}
  ];
  assert.strictEqual(pickImageDistractors(pool[0], img, pool).length, 3);
});
test('无图词 hasImage 为 false', function () {
  assert.strictEqual(hasImage({id:'x-0'}, ['a-0']), false);
  assert.strictEqual(hasImage({id:'a-0'}, ['a-0']), true);
});
```

- [ ] **Step 2: 跑测试确认失败** `npm test` → 报 `pickImageDistractors is not defined`
- [ ] **Step 3: 实现 `src/imgquiz.js`**（导出 `pickImageDistractors/hasImage/renderImageChoice`；tests/run.js 顶部 import）。UI 样式类：`img-grid`（2×2 grid）、`img-opt`（按钮包图，img 宽 100%）、`.img-opt.correct/.wrong`、提示条复用 `.feedback`。
- [ ] **Step 4: `npm test` 全绿**（原 47 项 + 新 3 项）
- [ ] **Step 5: `css/style.css` 加样式**（zine 风：`img-opt` 墨线边框 1px var(--line)、圆角按现有 token、hover 微动效 ≤200ms、`.wrong` 降透明 + 红细边 var(--f)、`.correct` 绿细边 var(--n)）

---

### Task 2: 加强阶段编排 + 选择/拼写渐进提示

**Files:**
- Modify: `src/vocabulary.js`（`startStrengthen` L245-254、`runSteps` L257-394）
- Test: `tests/run.js`

**Interfaces:**
- Consumes: Task 1 的 `hasImage/renderImageChoice`、`SRS.matches`、`maskWord`。
- Produces: `maskWordHalf(de) → string`（export）：每词元前半字母可见、后半 `·`（`der Tag → der Ta·`；冠词照拼）；步型新增 `'image'`。

- [ ] **Step 1: 失败测试**

```js
test('maskWordHalf 揭示前半', function () {
  assert.strictEqual(maskWordHalf('lernen'), 'ler···');
  assert.strictEqual(maskWordHalf('der Tag'), 'der Ta·');
});
```

- [ ] **Step 2: 确认失败 → Step 3 实现**：
  - `maskWordHalf`：按 token 处理，非冠词 token 露前 `ceil(len/2)` 个字母。
  - `startStrengthen` 步型改为：`hasImage(w) ? ['image', choiceStep, 'spell'] : [pick('trans'), pick('reverse'), 'spell']`，其中 `choiceStep = pick(Math.random() < 0.5 ? 'trans' : 'reverse')`；`'image'` 步调用 `renderImageChoice(stage 容器, w, { imageIds, pool: allWords, speak: audio.playWord, onDone })`，`onDone(firstTry)`：`firstTry===false` 记 wrongs++ 并进再练逻辑（Task 4 接），随后下一步。
  - 选择题（trans/reverse/listen）渐进提示改造：第 1 次选错不再直接揭示答案——错误项标错 + 提示「词性 + maskWord(w.de)」（listen 题提示中文释义首字）并允许重选；第 2 次错 → 揭示正确项。首次错才 wrongs++。
  - 拼写提示加深一档：错 1 → `maskWord`；错 2 → `maskWordHalf`；错 3 → 显示完整答案（`spellFails++` 仍在最终失败时记 1 次）。
- [ ] **Step 4: `npm test` 全绿**

---

### Task 3: 复习接入图片题 + 遗忘曲线排序

**Files:**
- Modify: `src/vocabulary.js`（`dueWords` L463-474、`reviewSession` 队列构建 L501 与 `buildQuestion`）
- Test: `tests/run.js`

**Interfaces:**
- Produces: `orderReviewQueue(words, srsMap, todayStr) → words 重排`（export 纯函数）：按 `SRS.retrievability(card.stability, daysBetween(card.last||card.due, todayStr))` 升序；`card.verify` 与在 mistakes 中的词排最前（稳定排序：优先级组内仍按可提取度升序）。

- [ ] **Step 1: 失败测试**

```js
test('orderReviewQueue：verify/错词优先，其余按可提取度升序', function () {
  const todayStr = '2026-09-06';
  const mk = function (id, s, last) { return { id: id, de: id, zh: id, ex: '', exZh: '', g: 'm' }; };
  const words = [mk('a', 0, ''), mk('b'), mk('c')];
  const srsMap = {
    a: { stability: 10, last: '2026-09-01' },
    b: { stability: 2, last: '2026-09-01' },
    c: { stability: 50, last: '2026-09-01', verify: true }
  };
  const ordered = orderReviewQueue(words, srsMap, todayStr);
  assert.strictEqual(ordered[0].id, 'c', 'verify 卡最优先');
  assert.strictEqual(ordered[1].id, 'b', '低稳定度优先于高稳定度');
});
```

- [ ] **Step 2-3 实现**：`dueWords`/`reviewSession` 用 `orderReviewQueue` 排序后再 `.slice(0, 30)`；`buildQuestion` 题型池：若 `hasImage(w)` 则以约 40% 概率出图片题（用 `renderImageChoice` 渲染进卡片，`onDone(firstTry)` 接 `correct()/wrongFn()`：`firstTry` 才走 `correct()`），无图词保持现有五题型。复习选择题同样接入渐进提示（同 Task 2 行为）。
- [ ] **Step 4: `npm test` 全绿**

---

### Task 4: 错词再练队列（加强 + 复习）

**Files:**
- Modify: `src/vocabulary.js`（`startStrengthen`、`reviewSession`）
- Test: `tests/run.js`

**Interfaces:**
- Produces: `makeRequeue(maxRounds) → { push(w), take(idx), countOf(id) }`（export 纯逻辑小工厂）：`push(w)` 记录该词再练次数（超过 maxRounds 忽略）；`take(idx)` 当 `idx % 3 === 0` 且队列非空时返回队首词，否则 null。

- [ ] **Step 1: 失败测试**

```js
test('再练队列：答错词隔 3 张复现，超上限不再出现', function () {
  const rq = makeRequeue(2);
  rq.push({ id: 'a-0' });
  assert.strictEqual(rq.take(1), null);
  assert.strictEqual(rq.take(3).id, 'a-0');
  rq.push({ id: 'a-0' }); rq.push({ id: 'a-0' }); // 第 3、4 次 push 超上限被忽略
  assert.strictEqual(rq.countOf('a-0'), 2);
  rq.take(3);
  assert.strictEqual(rq.take(3), null, '达到上限后队列为空');
});
```

- [ ] **Step 2-3 实现**：加强阶段每词 `finishWord` 时若 `wrongs>0 || spellFails>0` 则 `rq.push(w)`；`startStrengthen` 的主循环每推进一个词先 `rq.take(doneCount)`，取到则插练该词（步型相同）。复习会话同理（wrongFn → push；每答 3 题检查 take）。再练产生的答题不再重复 addMistake（第一次已记），但答对可正常走 `correct()` 的 FSRS 调度。
- [ ] **Step 4: `npm test` 全绿**

---

### Task 5: 单词详情抽屉

**Files:**
- Modify: `src/vocabulary.js`（`wordCard` L27-51、问题卡片）、`css/style.css`
- 依赖 `src/conjugate.js` 的 `lookup`

**Interfaces:**
- Produces: `detailDrawer(w) → HTMLElement`（vocabulary.js 内部函数）：`<details class="word-detail">`，摘要行「详情 · 释义 / 例句 / 变位」；内容：词性标签 + 中文释义、例句 + 翻译（含朗读按钮）、若为动词且 `lookup(去前缀小写)` 命中则渲染 6 人称变位小表（ich/du/er/sie/es/wir/ihr/sie/Sie 行，复用 conjugate 页同款表格样式类）。

- [ ] **Step 1**：`wordCard` 与复习/加强的问题卡底部挂 `detailDrawer(w)`；展开不收起答题区、不影响判定。
- [ ] **Step 2**：CSS：`.word-detail`（墨线上边框、衬线小字、summary 手型光标、展开动效 ≤200ms）。
- [ ] **Step 3**：`node --check` 通过 + 手动截图验证（主代理验收时做）。

---

### Task 6: 进度可见（学习页 + 今日页）

**Files:**
- Modify: `src/vocabulary.js`（learnSession 标题区）、`src/views.js`（dashboard）

**Interfaces:**
- 学新词页标题下加一行 `.page-sub`：「今日新词 x/N · 本组第 k/5 个」（x=今日 `s.daily[todayStr].new`）。今日页任务卡区加一行：「按每天 N 个新词，预计 X 天学完本级剩余 M 个词」（X = ceil(M/dailyNew)，M=当前级别未入 SRS 词数）。

- [ ] **Step 1-2**：实现 + `node --check` 通过（纯展示，无新测试）。

---

### Task 7（主代理执行，不派子代理）: 验收与收尾

- E2E 扩展 `shots/audit/test_flow.mjs`：断言图片题出现、选错→提示→重选、详情抽屉展开、再练复现；双端截图 learn/review。
- `npm run build`、`npm test` 全绿、`tools/shot.mjs` 全路由双端截图。
- CHANGELOG [4.2.0]、README/AGENTS.md 如涉流程描述同步、合并 main + tag v4.2.0。

## Self-Review 记录

- 规格覆盖：F1→Task1/2/3，F2→Task2/3，F3→Task5，F4→Task4，F5→Task6，F6→Task3。✓
- 类型一致性：`pickImageDistractors/hasImage/renderImageChoice/maskWordHalf/orderReviewQueue/makeRequeue` 在任务间签名一致。✓
- 无占位符。✓
