# S9 语境填空 + 变格专项 + PWA — 设计规格

> 上位文档：`docs/技术调研与开发规划.md`（§7.3 PWA、§8.3 词汇网络、§10）与竞品调研报告（2026-09-21，用户提供的《语言学习软件调研报告》：Clozemaster 语境填空治「认得出说不出」；「冠词/形容词词尾可训练模块」为 22 款产品的全行业空白；PWA 离线包最佳实践）。
> 决策记录（2026-09-24，auto 模式下由 tower 裁定，用户可推翻）：
> - 语境填空：**零新内容**（句源 = 1945 词例句 + 100 行对话 + 20 篇阅读），四选一 + 渐进提示，挂复习题型池与阅读/听力页「练一练」入口。
> - 变格专项：数据复用语法练习格式（复用 `renderExerciseItem` 与语法错题 SRS 队列，id `dc-` 前缀）；入口 = 语法页置顶专项卡，**不加第 8 个 tab**（7 项已在 375px 满员）。
> - PWA：manifest + Service Worker + 图标派生；核心壳预缓存、媒体运行时 CacheFirst；`file://` 防御；不做每日推送（需服务器）。
> - 版本：4.6.0。

## 1. 语境填空（cloze）

### 1.1 句源与抽题

- 词例句：1945 条（挖空词 = 该卡目标词；只挖词库词）。
- 对话行：100 行（挖空词 = 该行中当前级别已学且最长的词库词，无则跳过该行）。
- 阅读句：20 篇按句切分（同上规则）。
- 纯函数 `buildClozePool(level)`（src/cloze.js）：从已加载数据汇集 `{sent, sentZh, targetWord, vid, source}`，仅含当前级别可见词（vid 归当前或更低级别）；`pickCloze(srs, today)` 优先到期/学习中词。
- 干扰项 3 个：同主题优先 + 同词性（复用 imgquiz 的干扰逻辑风格），按释义去重。

### 1.2 呈现与判分

- 题干：德语句子中目标词替换为 `___`，下方给中文翻译；四选一（复用选择题样式与渐进提示：错 1 给词性+首字母遮罩、错 2 揭示）。
- 判分复用 `SRS.matches` 语义（选项题判对错）。答错 → 目标词卡 `review(card, 0)`；答对 → `review(card, 2)`（仅复习池语境下写 SRS；阅读/听力「练一练」入口同样写目标词卡）。
- 挂载：复习题型池加入 cloze（概率约 25%，与既有题型混排）；阅读页与听力对话页底部「练一练」入口（用本篇/本组句子出 5 题）。

## 2. 变格/词尾专项训练（declension）

### 2.1 数据（`data/declension.js`，LLM 草稿 + SLA 审核闭环）

```javascript
window.DECLENSION = [
  { id: 'dc-article-akku', title: '定冠词第四格', level: 'A1', topic: 'article',
    exercises: [
      { type: 'choice', q: 'Ich sehe ___ Mann. (der)', opts: ['der', 'den', 'dem'], a: 1, tip: '第四格阳性 den。' },
      { type: 'fill', q: 'Ich gebe ___ Mann das Buch. (der)', a: 'dem', tip: '第三格阳性 dem。' }
    ] }
];
```

- 专题清单（6 个）：定冠词四格、不定冠词/否定冠词、形容词词尾（强/弱/混合）、人称代词三四格、名词弱变化（-n 变化）、介词配格（mit/dat, für/akku, 双向介词 in/an/auf…）。
- 每专题 ≥6 题（choice 为主，fill 为辅）；级别标注该题点首次出现的级别（A1/A2/B1）。
- 内容生产：worker 草稿 → SLA 视角 reviewer 审核（检查单：语法正确、语境自然、干扰项是「真实错误」（学习者常犯）、tip 讲清规则）→ 过审定稿。

### 2.2 前端（`src/declension.js`）

- 入口：语法页置顶专项卡「变格训练」（说明文案 + 各专题进度徽章）；今日页不加（避免任务膨胀）。
- 路由 `#/declension`、`#/declension/<topicId>`；专题页 = 复用 `Grammar.renderExerciseItem` 的答题流（选择/填空 + tip 反馈）。
- 错题进既有语法 SRS 队列：卡 id `dc-{topicId}#{exerciseIndex}`——`isGrammarCardId`（含 # 且非 listen-）天然命中，今日页「语法复习 N 题」自动计数；`Grammar.reviewPage` 的题目解析需扩展：`g-` 前缀查 GRAMMAR，`dc-` 前缀查 DECLENSION（其余行为不变）。
- 完成记录复用 `state.grammarDone`（键为 dc- 专题 id），语法页徽章统计不受影响（语法页统计用 getGrammar() 数量，dc 不混入）。

## 3. PWA

### 3.1 文件

- `manifest.webmanifest`：name「德语学习志 · Deutsch Zine」、short_name「德语学习」、display `standalone`、theme/background `#F2EDE3`、start_url/scope `./`、`icons` 192/512（any + maskable 各一）。
- 图标：`images/icons/`（新增目录），由 `images/zine/hero.png` 派生 192/512（PIL/ffmpeg 本地处理，maskable 版加纸色内边距）；授权无问题（自产素材）。
- `sw.js`：
  - `const CACHE = 'deutsch-zine-v4.6.0'`（版本号手工随发布递增，AGENTS.md SOP 注明）；
  - install 预缓存核心壳：`./`、`index.html`、`css/style.css`、`js/bundle.js`、`data/*.js`（全部数据文件）、`audio/manifest.js`、`images/manifest.js`；
  - fetch：同源 GET → CacheFirst（命中即返，未命中走网络并写入缓存）；**不预缓存** `audio/`、`images/words/` 等大体积目录（按需缓存，听过/看过即离线可用——对齐报告的「打开即缓存」实践）；跨域请求放行。
  - activate 清旧版本缓存。
- `index.html`：`<link rel="manifest">` + 注册脚本：`if (location.protocol !== 'file:' && 'serviceWorker' in navigator)` 才注册（双击 file:// 场景不受影响）。

### 3.2 验证

- Playwright：http 服务下 manifest 200、SW 注册成功、断网（context.setOffline）后首页与一次复习流程可用；
- 375px 双端截图含安装提示场景不破坏布局。
- 不做：每日提醒推送（需推送服务器）、音频批量重压缩（记入 backlog，PWA 缓存按需即可）。

## 4. 测试与验收

- `tests/run.js` 新增：cloze 抽题池（句源齐全、挖空词在句中、干扰项去重且不含答案）；declension 数据完整性（6 专题、id dc- 前缀、exercises 字段合法、a 索引合法）；`dc-…#n` 卡被 `isGrammarCardId` 命中且 reviewPage 可解析。
- PWA 无单测（浏览器行为由截图 + Playwright 验证覆盖）。
- `npm test` 全绿、`npm run build` 通过（bundle 仅收尾任务提交）。

## 5. 文档与收尾

CHANGELOG `[4.6.0]`；package.json → 4.6.0；README（功能清单 + PWA 安装说明）；AGENTS.md（新文件/命名约定 dc-/cloze/SOP）；DESIGN.md 无需改动（无新视觉元素）。

## 6. 任务拆分（tower 执行）

| 任务 | 范围 | 依赖 |
|---|---|---|
| M7 语境填空 | `src/cloze.js`、`src/vocabulary.js`、`src/data.js`、`src/srs.js`、`src/reader.js`、`src/listen.js` | 无 |
| M8 变格专项 | `data/declension.js`、`src/declension.js`、`src/app.js`、`src/grammar.js`、`src/views.js`、`css/style.css` | 无 |
| M9 PWA | `manifest.webmanifest`、`sw.js`、`index.html`、`images/icons/**`、`tools/**`（图标派生脚本，可选） | 无 |
| M10 收尾 | `tests/**`、`README.md`、`CHANGELOG.md`、`AGENTS.md`、`package.json`、`js/bundle.js`、`js/bundle.js.map`、`shots/**` | M7+M8+M9 |
