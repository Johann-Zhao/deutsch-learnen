# S7 听力模块 实施计划

> **For agentic workers:** 本计划由 tower 工作流执行：M1/M2/M3 三个任务分支，每个 worker 只读自己的任务段落。设计依据：`docs/superpowers/specs/2026-09-21-listening-module-design.md`（下称「规格」），冲突时以规格为准。

**Goal:** 新增「听力」Tab：20 组小对话理解（LLM 草稿 + SLA 视角智能体审核 + edge-tts 分角色音频）+ 听写强化，对话错题进 FSRS。

**Architecture:** 与词汇/语法同构——内容在 `data/listening.js`（index.html 静态加载），音频预生成到 `audio/dialog/`（清单入 `audio/manifest.js` 的 `AUDIO_DIALOGS`），前端新增 `src/listen.js` 模块，SRS 复用现有 `store.state.srs`（卡 id `listen-{dialogueId}#{qIndex}`）。

**Tech Stack:** 原生 HTML/CSS/JS（ESM → esbuild 单文件 IIFE）、Node 原生 assert 单测、Python + edge-tts 内容管道。

## Global Constraints

- 提交信息格式：`类型(范围): 描述`（类型 feat/fix/refactor/test/docs/chore/build/assets，描述为中文陈述句）。
- **`js/bundle.js` 构建产物只有 M3 允许提交**；M1/M2 一律不碰（避免二进制冲突）。
- `npm test` 必须全程绿色；`npm run build` 必须成功。
- UI 遵守 `DESIGN.md`：muted zine 纸感令牌（米纸 `#F2EDE3`、装饰金 `#A88C4A`、词性三色仅小面积使用）；不用渐变/阴影堆叠；动效 ≤300ms 且尊重 `prefers-reduced-motion`；响应式 375px 可用、焦点可见、WCAG AA。
- 数据文件命名约定（AGENTS.md §7 扩展）：对话 id 必须 `dl-` 前缀并含级别段（`dl-a1-…` / `dl-a2-…` / `dl-b1-…`）；听力 SRS 卡 id 为 `listen-{dialogueId}#{qIndex}`。
- `audio/manifest.js`、`data/ipa.js` 等自动生成文件**只由脚本维护**，不手改（新增 `AUDIO_DIALOGS` 行同样如此）。
- 音频要求（用户原话）："生成的音频要原生、地道，发音清晰"。

---

## M1 — 对话内容与音频管道（分支 feat/listen-content）

**Files:**
- Create: `data/listening.js`、`tools/generate_dialog_audio.py`、`audio/dialog/*.mp3`
- Modify: `tools/README.md`、`audio/manifest.js`（仅由脚本写入）
- Test: 数据完整性测试在 M3；本任务自查用 node 快速 eval 校验（见 Task 2 步骤）

**Interfaces（Produces，供 M2/M3 依赖）:**
- `window.LISTEN_DIALOGS`：数组，元素结构见规格 §2（`{ id, title, level, theme, lines:[{sp,de,zh}], questions:[{type:'choice',q,opts,a,tip}] }`）。
- `window.AUDIO_DIALOGS`：`{ [dialogueId]: 行数 }`；行音频路径固定为 `audio/dialog/<dialogueId>-<lineIndex>.mp3`（lineIndex 从 0 起）。
- 角色音色：A = `de-DE-KatjaNeural`，B = `de-DE-ConradNeural`，全部 20 组一致。

### Task M1-1: 20 组对话草稿（4 批 × 5 组）

- [ ] **步骤 1：写第 1 批（A1，5 组）**。场景从现有 A1 主题取（问候/餐饮/购物/时间/家庭）。严格按规格 §2 格式写入 `data/listening.js`（文件头注释 `/* 听力小对话：S7，LLM 草稿经 SLA 视角审核 */`）。每组：3–5 行 lines（sp 仅 'A'/'B'）、每行带 zh；2–3 题 questions（至少 1 主旨 + 1 细节，`opts` 2–4 项，`a` 合法，`tip` 中文解析）。i+1 原则：词汇句型以该级别已学内容为主，超纲词 ≤5% 且能语境猜出。
- [ ] **步骤 2：自查脚本**（每批写完必跑）：

```bash
node -e "const w={};new Function('window',require('fs').readFileSync('data/listening.js','utf8'))(w);\
const d=w.LISTEN_DIALOGS;const ids=new Set();\
d.forEach(x=>{if(!/^dl-(a1|a2|b1)-/.test(x.id))throw new Error('id 非法 '+x.id);\
if(ids.has(x.id))throw new Error('id 重复 '+x.id);ids.add(x.id);\
if(x.lines.length<3||x.lines.length>5)throw new Error('lines 数非法 '+x.id);\
x.lines.forEach(l=>{if(!/^[AB]$/.test(l.sp)||!l.de||!l.zh)throw new Error('行非法 '+x.id)});\
if(x.questions.length<2||x.questions.length>3)throw new Error('题数非法 '+x.id);\
x.questions.forEach(q=>{if(q.type!=='choice'||!q.opts||q.opts.length<2||q.opts.length>4||!(q.a>=0&&q.a<q.opts.length)||!q.tip)throw new Error('题非法 '+x.id)})});\
console.log('OK', d.length)"
```

- [ ] **步骤 3：提交**：`git add data/listening.js && git commit -m "feat(data): 听力小对话草稿第 1 批（A1×5）"`
- [ ] **步骤 4：重复步骤 1–3 完成第 2 批（A1×3 + A2×2）、第 3 批（A2×5）、第 4 批（B1×5）**，累计 A1 8 / A2 7 / B1 5 = 20 组，场景互不重复。
- [ ] **步骤 5：TowerSend 给 tower**：`action: content-review-request`，正文列出 20 组 id 清单与场景，请求 SLA 内容审核。

### Task M1-2: SLA 审核迭代（与 reviewer 智能体往返）

- [ ] **步骤 1：收到审核意见**（tower 会以 reviewer 身份复审本分支，视角 = 高级学习者 + 二语习得研究者；检查单见规格 §3：级别适配/自然地道/文化准确/教学价值/中德对照）。
- [ ] **步骤 2：逐条修复**被打回的对话组，每组修复后单独提交（`fix(data): 听力对话 <id> 按审核意见修改：…`）。
- [ ] **步骤 3：重跑 M1-1 步骤 2 自查脚本**，再次请求审核，直至全部通过。
- [ ] **步骤 4：审核通过前不得开始 Task M1-3 的音频生成**（音频以定稿文本为准）。

### Task M1-3: 音频生成脚本 `tools/generate_dialog_audio.py`

- [ ] **步骤 1：写脚本**。要求：
  - 读 `data/listening.js`（正则提取 `window.LISTEN_DIALOGS` 数组体，或复用 `tools/generate_audio.py` 里已有的数据文件解析做法——先读该文件对齐风格）。
  - 对每行生成 `audio/dialog/<dialogueId>-<lineIndex>.mp3`：`sp=='A'` 用 `de-DE-KatjaNeural`，`sp=='B'` 用 `de-DE-ConradNeural`，edge-tts 默认语速（不加减速参数，保清晰原生）。
  - 已存在文件跳过（断点续跑）；请求间隔 ≥1s；失败重试 2 次，最终失败的行打印汇总。
  - 结束后重写 `audio/manifest.js`：保留既有 `AUDIO_WORDS / AUDIO_SENTS / AUDIO_CONJ / AUDIO_NATIVE` 各行内容不变（读旧文件按行保留），新增/更新 `AUDIO_DIALOGS` 行：`window.AUDIO_DIALOGS = { "<id>": <行数>, ... };`。**参照 `tools/generate_audio.py` 保留 `AUDIO_NATIVE` 行的做法实现。**
  - 文件头注释写明用途/用法/产物（与 tools/ 其他脚本一致）。
- [ ] **步骤 2： `--limit` 支持**：`--limit N` 只处理前 N 组（调试与分批用），`--ids id1,id2` 定向生成（对齐 `fetch_native_audio.py` 的参数风格）。
- [ ] **步骤 3：小样本验证**：`python tools/generate_dialog_audio.py --limit 1`，确认生成 `audio/dialog/<第1组id>-0.mp3 …` 且 manifest 出现 `AUDIO_DIALOGS` 行、其余行不变。试听一个文件确认分角色音色正确。
- [ ] **步骤 4：提交**：`feat(tools): 听力小对话音频生成脚本（分角色 edge-tts + AUDIO_DIALOGS 清单）`。
- [ ] **步骤 5：`tools/README.md` 补条目**（用途/依赖/用法/产物，对齐现有条目格式），同一提交或单独 `docs(tools)` 提交。

### Task M1-4: 全量生成音频并校验

- [ ] **步骤 1：`python tools/generate_dialog_audio.py`** 全量跑（耗时长，耐心；断点续跑）。
- [ ] **步骤 2：校验产物**：`ls audio/dialog | wc -l` 应等于全部对话行数之和；抽查每组首尾行文件存在且大小 >5KB。
- [ ] **步骤 3：提交**：`assets(audio): 听力小对话全量音频（20 组）与 AUDIO_DIALOGS 清单`。
- [ ] **步骤 4：TowerSend 报告完成**（20 组已过审 id 清单 + 音频文件总数 + 自查脚本输出）。

---

## M2 — 前端听力 Tab 与 SRS 接线（分支 feat/listen-ui）

**Files:**
- Create: `src/listen.js`
- Modify: `src/app.js`、`src/data.js`、`src/audio.js`、`src/storage.js`、`src/views.js`、`src/grammar.js:226-234`、`css/style.css`、`index.html`
- Test: 纯函数测试在 M3（`tests/run.js` 是 M3 范围）；本任务把可测逻辑导出为纯函数。

**Interfaces:**
- Consumes（M1 产物，本任务开发时 `window.LISTEN_DIALOGS` 可能不存在——必须防御性按空数组处理）: `window.LISTEN_DIALOGS`、`window.AUDIO_DIALOGS`、`audio/dialog/<id>-<i>.mp3`。
- Produces（M3 测试依赖这些导出名）:
  - `src/data.js`: `getListenDialogs()` 返回数组（缺省 `[]`）；`getAudioDialogs()` 返回对象（缺省 `{}`）。
  - `src/audio.js`: `pickDialogSrc(dialogueId, lineIndex, dialogMap)` 纯函数（有 → `'audio/dialog/<id>-<i>.mp3'`，无 → `null`）；`audio.playDialog(dialogueId, lineIndex, fallbackText, opts)`。
  - `src/listen.js`: `export const Listen = { homePage, dialogPage, dictationPage, reviewPage }`；纯函数 `dialogueCardId(dialogueId, qIndex)` 返回 `'listen-' + dialogueId + '#' + qIndex`；`pickDictationQueue(words, srs, todayStr, limit)`（到期词 + 错词优先，去重，上限 limit）。
  - `src/storage.js`: `emptyState()` 含 `listen: {}`。

### Task M2-1: 数据/存储/音频底座

- [ ] **步骤 1：`src/storage.js`** — `emptyState()` 增加 `listen: {}`（注释：`listen: { [dialogueId]: { right, total, at } }` 完成记录）。检查加载路径（`Storage.ready`/normalize 处），确保旧存档缺 `listen` 字段时补默认值（对齐 `grammarDone` 等既有字段的处理方式）。
- [ ] **步骤 2：`src/data.js`** — 仿 `getAudioNative()` 增加：

```javascript
export function getListenDialogs() {
  return (typeof window !== 'undefined' && window.LISTEN_DIALOGS) || [];
}

export function getAudioDialogs() {
  return (typeof window !== 'undefined' && window.AUDIO_DIALOGS) || {};
}
```

- [ ] **步骤 3：`src/audio.js`** — 增加纯函数与播放方法（复用现有 `playUrl`/`TTS.speak` 回退）：

```javascript
/* 纯函数：对话行音频来源（有清单且行号在范围内 → 文件路径；否则 null 交给 TTS） */
export function pickDialogSrc(dialogueId, lineIndex, dialogMap) {
  const n = dialogMap && dialogMap[dialogueId];
  if (typeof n === 'number' && lineIndex >= 0 && lineIndex < n) {
    return 'audio/dialog/' + dialogueId + '-' + lineIndex + '.mp3';
  }
  return null;
}
```

`audio` 对象加方法：`playDialog: function (dialogueId, lineIndex, fallbackText, opts) { const r = resolveRate(opts && opts.rate, rate); const url = pickDialogSrc(dialogueId, lineIndex, dialogMap); if (url) return playUrl(url, r, fallbackText); TTS.speak(fallbackText, r); return false; }`（`dialogMap` 在 `buildSets()` 里由 `getAudioDialogs()` 建立，参照 `nativeMap`）。

- [ ] **步骤 4：`npm run build && npm test` 全绿**（底座改动不破坏现有行为）。
- [ ] **步骤 5：提交** `feat(listen): 听力数据/存储/音频底座`。

### Task M2-2: `src/listen.js` — 首页与对话页

- [ ] **步骤 1：模块骨架**。参照 `src/grammar.js` 的模块写法（`UI.el` 构造 DOM、sheet/page-title/page-sub 版式、`store`/`SRS`/`audio` 导入）。导出 `dialogueCardId` 与 `pickDictationQueue` 纯函数：

```javascript
export function dialogueCardId(dialogueId, qIndex) {
  return 'listen-' + dialogueId + '#' + qIndex;
}

/* 听写抽题：到期词优先，其次有错题记录的词，去重，上限 limit */
export function pickDictationQueue(words, srs, todayStr, limit) {
  const due = words.filter(function (w) { return srs[w.id] && !srs[w.id].sealed && SRS.isDue(srs[w.id], todayStr); });
  const rest = words.filter(function (w) { return due.indexOf(w) === -1 && srs[w.id] && !srs[w.id].sealed; });
  return due.concat(rest).slice(0, limit || 20);
}
```

- [ ] **步骤 2：`homePage()`（听力首页）**：
  - 刊头 micro 文案 `HÖREN · 听力` + `page-title`「听力」+ page-sub 简介。
  - 「听写强化」入口卡：说明文案「听音频拼写已学的词，到期词优先」，按钮进 `#/listen/dictation`（按钮写明结果，如「开始听写（约 20 词）」）；到期数实时显示。
  - 「小对话」分区：按级别分组（A1/A2/B1 小节标题），每组一张卡片：标题、theme 场景徽章、level 徽章、行数/题数、完成状态（来自 `store.state.listen[id]`：未学 / 已答对 x/y）。空数据时显示空状态卡「对话内容建设中，敬请期待。」（行动邀请式文案，按钮回今日页）。
  - 卡片点击进 `#/listen/dialog/<id>`。
- [ ] **步骤 3：`dialogPage(id)`（三级交互）**：
  - **阶段 1 盲听**：不显示原文；「▶ 播放整组对话」按钮，按行顺序连播（行间 600ms 停顿，`audio.playDialog(id, i, line.de)`，行音频缺失自动回退 TTS）；播放中显示当前第 x/共 n 行；播完或点「我听完，开始答题」进阶段 2。
  - **阶段 2 答题**：逐题呈现 choice（样式复用语法练习的选项按钮），即时判分：答对 `SRS.review(card, 2, today)`，答错 `SRS.review(card, 0, today)` 且 `store.addMistake('listen', dialogueCardId(id, qi))`；每题显示 `tip` 解析；可点「重听」回阶段 1。全部答完写 `store.state.listen[id] = { right, total, at: today() }` 并 `store.save()`，`store.touchToday('reviewed', 题数)`。
  - **阶段 3 精听**：逐行显示 `de` + `zh`，每行一个播放按钮（`audio.playDialog(id, i, line.de)`）；底部「再答一次」/「回听力首页」按钮。
  - id 找不到对应对话时显示空状态卡并给回首页按钮。
- [ ] **步骤 4：`npm run build` 通过；提交** `feat(listen): 听力首页与对话页三态交互`。

### Task M2-3: 听写强化页 `dictationPage()`

- [ ] **步骤 1**：用 `pickDictationQueue(wordsOfLevel(currentLevel()), store.state.srs, today(), 20)` 抽题；空队列显示空状态（「没有可练的词，先去学新词」+ 按钮）。
- [ ] **步骤 2：听写循环**：每词播放音频（`audio.playWord`）→ 输入框拼写 → `SRS.matches(input, w.de)` 判定 → 评分写 SRS（对 `quality=2` / 错 `quality=0`，错词入本队尾隔 3 题再来，上限 2 轮——复用 `makeRequeue`，已从 `src/vocabulary.js` 导出）→ 渐进提示复用 `maskWord`/`maskWordHalf`（错 1 首字母、错 2 半词、错 3 完整）。版式对齐复习页。
- [ ] **步骤 3：小结页**：答对 x/y、错词清单、回听力首页按钮。
- [ ] **步骤 4：构建通过；提交** `feat(listen): 听写强化页（复用拼写题型与渐进提示）`。

### Task M2-4: 错题复习页 `reviewPage()` + 语法过滤收窄

- [ ] **步骤 1：`src/listen.js` 的 `reviewPage()`**：仿 `src/grammar.js:202-305` 的 `reviewPage()`，但队列过滤为 `id.indexOf('listen-') === 0 && SRS.isDue(...)`，题目解析：由 `dialogueCardId` 反解 `dialogueId`/`qIndex`，从 `getListenDialogs()` 找对话与题目；呈现 = 重播该组对话音频按钮 + 重答该题；`onAnswer` 逻辑同语法复习页（`SRS.review` / `removeMistake` / `addMistake('listen', id)` / `touchToday`）。数据缺失（对话被删）的卡跳过并在小结提示。
- [ ] **步骤 2：收窄语法过滤（关键集成点，规格 §6）**：
  - `src/views.js:21`：`grammarDue` 过滤改为 `id.indexOf('#') >= 0 && id.indexOf('listen-') !== 0 && SRS.isDue(...)`。
  - `src/grammar.js` reviewPage 两处（约 211、227-228 行）的 `id.indexOf('#') === -1` / `id.indexOf('#') >= 0` 判断同样排除 `listen-` 前缀。
  - `src/views.js:20` 词汇 `due` 过滤（`id.indexOf('#') === -1`）不受影响，不动。
- [ ] **步骤 3：`src/views.js` 仪表盘**：在语法复习按钮（58-61 行）后加「听力复习 N 题」按钮（无到期时 `btn-ghost` 且 disabled，文案「无到期听力复习」），跳转 `#/listen-review`；`listenDue` 计算 = `id.indexOf('listen-') === 0 && SRS.isDue(...)`。
- [ ] **步骤 4：构建通过；提交** `feat(listen): 听力错题复习页与今日页入口，语法到期过滤收窄`。

### Task M2-5: 路由、导航与静态加载

- [ ] **步骤 1：`index.html`** — `<nav id="nav">` 在「变位」后加 `<a href="#/listen" data-route="/listen">听力</a>`；`#tabbar` 在「变位」后加 `<a href="#/listen" data-route="/listen"><span class="tab-ic">♪</span>听力</a>`；`<script src="data/listening.js"></script>` 加在 `data/grammar.js` 之后（若文件暂缺浏览器仅 404 不阻塞，前端已防御）。
- [ ] **步骤 2：`src/app.js`** — 路由分发加：

```javascript
else if (hash === '#/listen') view.appendChild(Listen.homePage());
else if (hash === '#/listen/dictation') view.appendChild(Listen.dictationPage());
else if (hash === '#/listen-review') view.appendChild(Listen.reviewPage());
else if ((m = hash.match(/^#\/listen\/dialog\/([\w-]+)$/))) view.appendChild(Listen.dialogPage(m[1]));
```

`navActive()` 加：`if (hash.indexOf('#/listen') === 0) return '/listen';`（注意放在 `#/review` 判断之前无效冲突检查——`#/listen-review` 以 `#/listen` 开头但不含 `#/review` 前缀，现有 `#/review` 判断是 `hash.indexOf('#/review') === 0`，`#/listen-review` 不匹配，安全）。`import { Listen } from './listen.js';`。
- [ ] **步骤 3：`css/style.css`** — 对话页所需新样式（对话行、播放控制条、级别分组小节标题），只用 DESIGN.md 既有令牌（`var(--paper)` 等），不加渐变/阴影堆叠；375px 下 tab bar 六项不溢出（必要时缩小字号/间距）。
- [ ] **步骤 4：手工冒烟**：`npm run dev` 构建后开 `index.html`，走通 `#/listen`（空数据空状态）→ 手工在控制台 `window.LISTEN_DIALOGS = […一条样例…]` 注入样例 → 对话页三态走通 → 答错一题 → 今日页出现「听力复习」→ `#/listen-review` 重答通过。
- [ ] **步骤 5：`npm test` 全绿；提交** `feat(app): 听力路由、导航第 6 项与样式`。

---

## M3 — 测试 / 文档 / 构建收尾（分支 feat/listen-release，依赖 M1+M2 合并）

**Files:**
- Modify: `tests/run.js`、`README.md`、`CHANGELOG.md`、`AGENTS.md`、`package.json`
- Create: `js/bundle.js`（重新构建）、`shots/` 验收截图

### Task M3-1: 单元测试

- [ ] **步骤 1：数据完整性**（放「数据完整性：」段，复用 `loadDataFile`/`dataWindow` 模式）：

```javascript
test('听力对话：恰好 20 组、id 合法唯一、字段完整', function () {
  loadDataFile('../data/listening.js');
  const d = dataWindow.LISTEN_DIALOGS;
  assert.strictEqual(d.length, 20, '应为 20 组，实际 ' + d.length);
  const ids = new Set(); const lv = { A1: 0, A2: 0, B1: 0 };
  d.forEach(function (x) {
    assert.ok(/^dl-(a1|a2|b1)-[\w-]+$/.test(x.id), 'id 非法: ' + x.id);
    assert.ok(!ids.has(x.id), 'id 重复: ' + x.id); ids.add(x.id);
    lv[x.level]++;
    assert.ok(x.title && x.theme, x.id + ' 缺 title/theme');
    assert.ok(x.lines.length >= 3 && x.lines.length <= 5, x.id + ' lines 应为 3–5');
    x.lines.forEach(function (l) {
      assert.ok(/^[AB]$/.test(l.sp) && l.de && l.zh, x.id + ' 行字段缺失');
    });
    assert.ok(x.questions.length >= 2 && x.questions.length <= 3, x.id + ' 题数应为 2–3');
    x.questions.forEach(function (q) {
      assert.strictEqual(q.type, 'choice');
      assert.ok(q.opts.length >= 2 && q.opts.length <= 4, x.id + ' opts 数非法');
      assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.opts.length, x.id + ' a 索引非法');
      assert.ok(q.tip, x.id + ' 缺 tip');
    });
  });
  assert.deepStrictEqual(lv, { A1: 8, A2: 7, B1: 5 }, '级别分布应为 A1×8/A2×7/B1×5: ' + JSON.stringify(lv));
});

test('听力卡 id 与词汇/语法卡互不冲突', function () {
  assert.ok(dialogueCardId('dl-a1-greet', 0).indexOf('#') >= 0);
  assert.ok(dialogueCardId('dl-a1-greet', 0).indexOf('listen-') === 0);
  // 词汇卡 id 形如 greet-0 不含 #；语法卡 g- 前缀含 #
  assert.ok(!/^g-/.test(dialogueCardId('dl-a1-greet', 0)));
});

test('听写抽题：到期词优先、去重、上限生效', function () {
  const words = [{ id: 'a-0' }, { id: 'a-1' }, { id: 'a-2' }];
  const srs = {
    'a-0': { due: '2026-09-01' },              // 到期
    'a-1': { due: '2099-01-01' },              // 未到期
    'a-2': { due: '2026-09-01', sealed: true } // 已斩排除
  };
  const q = pickDictationQueue(words, srs, '2026-09-21', 20);
  assert.deepStrictEqual(q.map(function (w) { return w.id; }), ['a-0', 'a-1']);
  assert.strictEqual(pickDictationQueue(words, srs, '2026-09-21', 1).length, 1);
});

test('对话行音频选源：清单内给路径，越界/缺失给 null', function () {
  assert.strictEqual(pickDialogSrc('dl-a1-greet', 1, { 'dl-a1-greet': 4 }), 'audio/dialog/dl-a1-greet-1.mp3');
  assert.strictEqual(pickDialogSrc('dl-a1-greet', 4, { 'dl-a1-greet': 4 }), null);
  assert.strictEqual(pickDialogSrc('dl-a1-greet', 0, {}), null);
});
```

（import 行相应补 `dialogueCardId, pickDictationQueue` from `../src/listen.js`、`pickDialogSrc` from `../src/audio.js`。）

- [ ] **步骤 2：语法过滤收窄回归**：构造含 `g-x#0` 与 `listen-dl-x#0` 两类卡的 srs 对象，断言仪表盘 grammarDue 逻辑（若抽出纯函数则测之；否则把过滤条件抽成 `src/views.js` 导出的 `isGrammarCardId(id)` / `isListenCardId(id)` 纯函数再测）。
- [ ] **步骤 3：`npm test` 全绿；提交** `test(listen): 听力数据完整性/卡 id/抽题/音频选源测试`。

### Task M3-2: 文档与版本

- [ ] **步骤 1：`CHANGELOG.md`** — `[Unreleased]` 下新增 `## [4.4.0] - <合并日>` 条目：Added 听力 Tab（20 组小对话 + 听写强化 + 错题进 FSRS）、`tools/generate_dialog_audio.py`；Changed 语法到期过滤收窄排除听力卡。
- [ ] **步骤 2：`package.json`** — `version` → `4.4.0`。
- [ ] **步骤 3：`README.md`** — 学习系统列表加听力条目；内容规模表加「小对话 20 组（A1×8/A2×7/B1×5）+ 分角色音频」。
- [ ] **步骤 4：`AGENTS.md`** — 目录结构补 `data/listening.js`、`audio/dialog/`、`tools/generate_dialog_audio.py`；§7 命名约定补「听力对话 id：`dl-` 前缀含级别段；听力 SRS 卡 id：`listen-{dialogueId}#{qIndex}`」；§8.3 音频段补 `generate_dialog_audio.py` 一行。
- [ ] **步骤 5：提交** `docs: S7 听力模块文档与版本 4.4.0`。

### Task M3-3: 构建与截图验收

- [ ] **步骤 1：`npm run build`**，提交 `js/bundle.js`（`build: S7 听力模块 bundle 重建`）。
- [ ] **步骤 2：`node tools/shot.mjs` 双端截图**：`#/listen`、`#/listen/dialog/<第 1 组 id>`、`#/listen/dictation`、`#/`（新按钮）各 1280 + 375，断言无 overflowX / 无 jsErrors；截图入 `shots/`。
- [ ] **步骤 3：人工过一遍截图**（ReadMediaFile），确认 zine 风格一致、移动端 tab bar 6 项不溢出。
- [ ] **步骤 4：提交** `test(shots): S7 听力模块验收截图`，并 TowerSend 报告完成。

---

## Self-Review 记录

- 规格覆盖：§2 数据格式→M1-1；§3 审核闭环→M1-2；§4 音频管道→M1-3/M1-4；§5 前端→M2-1…M2-5；§6 SRS→M2-2/M2-4；§7 测试验收→M3-1/M3-3；§8 文档收尾→M3-2。✓
- 类型一致性：`pickDialogSrc / dialogueCardId / pickDictationQueue / getListenDialogs / getAudioDialogs / audio.playDialog` 在 M2 定义、M3 测试引用，签名一致。✓
- 已知的先后约束：M3-1 的数据完整性测试要求 `data/listening.js` 已合并（deps M1）；M2 开发期数据缺失走防御性空状态。✓
