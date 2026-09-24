# S9 语境填空 + 变格专项 + PWA 实施计划

> **For agentic workers:** tower 工作流执行：M7/M8/M9 并行、M10 收尾，每个 worker 只读自己的任务段。设计依据：`docs/superpowers/specs/2026-09-24-cloze-declension-pwa-design.md`（下称「规格」），冲突时以规格为准。

**Goal:** ①语境填空题型（零新内容，复用现有句库）；②变格/词尾专项训练（LLM 草稿 + SLA 审核闭环）；③PWA（manifest + SW + 图标，可安装可离线）。

**Tech Stack:** 原生 HTML/CSS/JS（ESM → esbuild）、Node assert 单测、Python 内容管道。

## Global Constraints

- 提交信息 `类型(范围): 描述`；**`js/bundle.js` 只有 M10 允许提交**。
- `npm test` 全程绿（当前基线 77）、`npm run build` 通过。
- UI 遵 DESIGN.md；tabbar 已是 7 项，本阶段不加新 tab。
- 命名：变格专题 id `dc-` 前缀；变格 SRS 卡 id `dc-{topicId}#{exerciseIndex}`（复用语法队列，isGrammarCardId 已命中，无需改谓词）。
- 自动生成文件（manifest 等）只由脚本维护。

---

## M7 — 语境填空（分支 feat/cloze）

**Files:** Create: `src/cloze.js`；Modify: `src/vocabulary.js`、`src/data.js`、`src/srs.js`（如需）、`src/reader.js`、`src/listen.js`

**Interfaces（Produces）:** `src/cloze.js` 导出纯函数 `buildClozePool(level)` / `pickCloze(pool, srs, todayStr, n)` / `pickClozeDistractors(item, pool, n)`，与组件 `Cloze.quizCard(item, onAnswer)`（或融入既有题型渲染）。

- [ ] **步骤 1：句源汇集纯函数**（`src/cloze.js`）。读 `allWords`（词例句）、`getListenDialogs()`（对话行）、`getReadingTexts()`（按句切分：按 `.?!` 切 + 去引号）；每句产出 `{ sent, sentZh, target, vid, source }`：词例句 target=该卡词（vid=卡 id）；对话/阅读句 target=该句中已学（有 srs 卡）且最长的词库词（lemma 匹配 vid 取 vid；无则跳过）。`vid` 仅当目标词属当前或更低级别。
- [ ] **步骤 2：抽题与干扰项**。`pickCloze`：到期词优先 → 学习中 → 新词，去重，上限 n。`pickClozeDistractors`：同词性 + 同主题优先，按释义去重，不含答案（参照 imgquiz.js 的做法）。
- [ ] **步骤 3：题型渲染**。题干德语句（target 替换为 `___`）+ 中文翻译 + 四选一；渐进提示：错 1 给词性+首字母遮罩、错 2 高亮答案（对齐现有选择题提示规范）。答对/答错回调 `onAnswer(ok, vid)`。
- [ ] **步骤 4：挂复习题型池**（`src/vocabulary.js` 复习会话题型混排，cloze 概率约 25%；有图词仍以图片题优先，cloze 不挤占图片题）与「练一练」入口：阅读页、听力对话页底部各加入口（本篇/本组句源出 5 题；句源不足 5 时有几道出几道，为 0 不显示入口）。判分：答错目标词卡 `SRS.review(card, 0, today)`、答对 `review(card, 2, today)`（无卡时不建卡——复习池里的词本来有卡；阅读/听力入口只对有卡词出题）。
- [ ] **步骤 5**：冒烟（控制台/种子数据）+ `npm test` 绿 + build 通过（不提交 bundle）；提交 `feat(cloze): 语境填空题型（句库挖空/四选一/复习池与读听入口）`；TowerSend review-request。

---

## M8 — 变格/词尾专项（分支 feat/declension）

**Files:** Create: `data/declension.js`、`src/declension.js`；Modify: `src/app.js`、`src/grammar.js`、`src/views.js`、`css/style.css`

**Interfaces:** `window.DECLENSION`（格式见规格 §2.1）；`src/declension.js` 导出 `Declension.listPage/topicPage`；语法 reviewPage 解析 `dc-` 卡（grammar.js 改动属本任务）。

- [ ] **步骤 1：6 专题练习草稿**（`data/declension.js`，文件头注释）：定冠词四格 / 不定冠词与否定冠词 / 形容词词尾（强·弱·混合）/ 人称代词三四格 / 名词弱变化 / 介词配格（含双向介词）。每专题 ≥6 题（choice 为主 fill 为辅），标注级别（该知识点首现级别）。干扰项必须是学习者真实常错项（如 dem/den 互换、词尾 -e/-en 混淆）。写自查脚本（id 前缀/题数/opts/a 合法/tip 非空）跑绿。
- [ ] **步骤 2**：TowerSend 给 tower（subject 含 content-review-request）请求 SLA 审核；按意见修复至 clean（检查单：语法正确/语境自然/干扰项=真实错误/tip 讲清规则）。
- [ ] **步骤 3：前端**。`src/declension.js`：listPage（6 专题卡片：标题/级别徽章/进度/最佳正确率）+ topicPage（复用 `Grammar` 的 `renderExerciseItem` 答题流；若其未导出则从 grammar.js 导出）。答错 `SRS.review('dc-'+topicId+'#'+i, 0)` 并入错题本（`store.addMistake('declension', …)` 前先确认错题本对未知 type 的渲染——参照 S7 听力做法加分支或映射为 grammar 类）。`grammar.js` reviewPage 题目解析扩展：`dc-` 前缀查 DECLENSION（其余不变）。`app.js` 路由 + navActive 归 `/grammar`（不占新 tab）。`grammar.js` listPage 顶部加「变格训练」专项卡。`views.js` 今日页不加入口（避免任务膨胀）。
- [ ] **步骤 4**：冒烟 + `npm test` 绿 + build 通过（不提交 bundle）。注意：`index.html` 属 M9 scope，本任务**不改**——`data/declension.js` 的静态加载标签由 M9 顺手加入；M8 一律防御式读取 `window.DECLENSION || []`，数据缺失时显示「内容建设中」空状态。
- [ ] **步骤 5**：提交（feat(data)/feat(declension)/…）；TowerSend review-request。

---

## M9 — PWA（分支 feat/pwa）

**Files:** Create: `manifest.webmanifest`、`sw.js`、`images/icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`；Modify: `index.html`；Create（可选）: `tools/gen_icons.py`

- [ ] **步骤 1：图标**。从 `images/zine/hero.png`（或更方正的封面素材）派生 192/512 + maskable（纸色 #F2EDE3 内边距 ≥10%）；本地 PIL/ffmpeg 处理，不调 API。
- [ ] **步骤 2：manifest.webmanifest**（规格 §3.1 字段；start_url `./index.html`、scope `./`、display standalone、theme_color/background_color `#F2EDE3`、lang zh-CN）。
- [ ] **步骤 3：sw.js**。`CACHE = 'deutsch-zine-v4.6.0'`；install 预缓存壳（`./`、`index.html`、`css/style.css`、`js/bundle.js`、`data/` 全部数据 js、两个 manifest.js）；fetch 同源 GET CacheFirst（未命中走网络并写缓存）；activate 清旧版缓存；**不拦截跨域**；不对 `audio/`、`images/` 做预缓存（运行时缓存即可）。注意 SW 作用域 = 部署目录，文件路径全部相对。
- [ ] **步骤 4：index.html**。`<link rel="manifest" href="manifest.webmanifest">` + 注册脚本（`location.protocol !== 'file:' && 'serviceWorker' in navigator` 守卫，注册失败静默 console.warn）；**顺手加 `<script src="data/declension.js">`**（加在 data/reading.js 之后——M8 的数据文件，404 无害、前端防御式读取）。
- [ ] **步骤 5：验证**。起 http.server 后用 Playwright：manifest 可解析、SW 注册成功、`context.setOffline(true)` 后刷新首页 + 进 `#/vocab` 可用、听过一个词后离线重播该词音频命中缓存。375px 布局无回归。
- [ ] **步骤 6**：提交（`feat(pwa): manifest 与 Service Worker 离线壳` + assets(images) 图标）；TowerSend review-request。

---

## M10 — 测试/文档/收尾（分支 feat/release-4-6-0，依赖 M7+M8+M9）

**Files:** Modify: `tests/run.js`、`README.md`、`CHANGELOG.md`、`AGENTS.md`、`package.json`；Create: `js/bundle.js`(+map)（重建）、`shots/**`

- [ ] 测试：cloze 纯函数（池构建/pickCloze 到期优先/干扰项去重且不含答案）；declension 数据完整性（6 专题/字段/索引合法）+ `dc-x#0` 被 isGrammarCardId 命中且语法 reviewPage 可解析；`npm test` 全绿。
- [ ] CHANGELOG `[4.6.0] - <合并日>`；package.json → 4.6.0；README（功能清单 + PWA 安装说明：http 服务或部署后浏览器「添加到主屏幕」）；AGENTS.md（新文件、dc- 命名、sw.js 版本号随发布递增的 SOP、declension/cloze 内容 SOP）。
- [ ] `npm run build` 提交 bundle；tools/shot.mjs 双端截图：语法页（变格入口）、`#/declension/<首专题>`、复习页（含 cloze 的会话可用注入 srs 种子）、`#/`（今日页）。
- [ ] TowerSend review-request。

---

## Self-Review 记录

- 规格覆盖：§1→M7；§2→M8；§3→M9；§4/§5→M10。✓
- scope 无重叠：css 仅 M8；index.html 仅 M9（顺手加 declension.js 静态加载标签，404 无害）；src/app.js 仅 M8；src/vocabulary.js 仅 M7。✓
- 类型一致：cloze 三函数与 DECLENSION 数据格式在 M7/M8 产出、M10 测试引用一致。✓
- 已知中间态：M9 先合并时 data/declension.js 可能不存在——M8 防御式读取 + script 404 无害；M8 先合并时 declension 页走空状态，M9 合并后自动生效。✓
