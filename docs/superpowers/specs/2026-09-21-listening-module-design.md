# S7 听力模块（路线图 S3）— 设计规格

> 上位文档：`docs/技术调研与开发规划.md`（§5 差距分析「听力=最大空白」、§6 P1 第 5 项、§10.1 听力模块设计、§12 许可红线）。
> 决策记录（2026-09-21 与用户确认）：
> - **范围**：第一版 = 听写强化 + 小对话 20 组；慢速短文留到下一迭代。
> - **内容生产**：LLM 写草稿，**另一个智能体以「高级学习者 + 二语习得研究者」视角审核**，迭代至通过后才生成音频。
> - **音频要求**（用户原话）："生成的音频要原生、地道，发音清晰"。
> - **入口**：独立「听力」Tab（桌面侧栏 + 移动端 tab bar 第 6 项）。
> - **SRS**：对话理解错题进 FSRS（复用语法错题卡机制）；听写强化本就走词卡 SRS，无需改动。

## 1. 目标与范围

为应用补上「听力」这一最大空白维度：

1. 新增「听力」Tab，含两个子模块：**小对话理解**（20 组新内容）与**听写强化**（重组现有能力，零新内容成本）。
2. 对话理解错题纳入 FSRS 间隔重复，与词汇/语法错题同一调度体系。

**明确不做**：慢速短文（下一迭代）；口语跟读（路线图 §10.3，P3）；真人对话配音（无可行合规来源）；对话内容不抓 DW/Nicos Weg（许可红线 §12.2）。

## 2. 数据格式（`data/listening.js`，新增）

懒加载数据文件，与 `vocabulary*.js` / `grammar*.js` 同模式：

```javascript
window.LISTEN_DIALOGS = [
  {
    id: 'dl-a2-cafe',              // 必须 dl- 前缀 + 级别段（dl-a1-/dl-a2-/dl-b1-），与词汇/语法卡 id 天然区分
    title: '在咖啡馆',
    level: 'A2',                   // A1 / A2 / B1
    theme: '餐饮',                  // 场景标签，对齐现有 38 主题语境
    lines: [                       // 3–5 轮对话
      { sp: 'A', de: 'Guten Tag! Was darf es sein?', zh: '您好！要点什么？' },
      { sp: 'B', de: 'Ich hätte gern einen Kaffee.', zh: '我想要一杯咖啡。' }
    ],
    questions: [                   // 2–3 题，至少 1 题主旨 + 1 题细节
      { type: 'choice', q: 'Wo spielt der Dialog?', opts: ['Im Restaurant', 'Im Café', 'Zu Hause'], a: 1, tip: 'Kaffee bestellen 的典型场景。' }
    ]
  }
];
```

- **20 组分布**：A1 8 组 / A2 7 组 / B1 5 组；场景对齐现有 38 主题（问候、餐厅、购物、旅行、租房、求职、就医……），同主题不重复。
- **可理解输入 i+1**：每组以该级别已学词汇为主，超纲词 ≤5% 且须能从语境猜出。
- 题目均为 `choice` 型（听力理解不适合填空判分），`opts` 2–4 项，`a` 为合法索引，`tip` 必填。

## 3. 内容生产与审核闭环（用户指定机制）

```
worker 智能体按 §2 规格逐批写草稿（每批 5 组）
  → tower spawn 独立内容审核智能体，视角 =「高级学习者 + 二语习得研究者」
  → 审核检查单：
      ① 级别适配：词汇/句型符合 CEFR 该级别，i+1 不超纲
      ② 自然地道：是母语者真实会说的对话，无教科书腔/中式德语
      ③ 文化准确：场景、称谓（Sie/du）、礼仪符合德语区实际
      ④ 教学价值：题目确实考理解（主旨/细节），干扰项有区分度
      ⑤ 中德对照：翻译准确、自然
  → 不通过：标注问题组打回，worker 改稿后复审（同组可多轮）
  → 全部通过：才允许进入 §4 音频生成
```

审核迭代全程走 tower 的 reviewer 机制（`TowerSpawn kind=reviewer` + briefing 注入上述视角与检查单），审核意见留痕于 `.tower/comms/`。

## 4. 音频管道（`tools/generate_dialog_audio.py`，新增）

- **音色**：edge-tts 德语神经音色，角色 A/B 固定两种对比明显的音色（如 `de-DE-KatjaNeural` / `de-DE-ConradNeural`），全 20 组一致，保证「角色感」。
- **清晰度**：默认语速 1.0（不用全局 ttsRate 减速），保「原生、地道、清晰」；前端播放时才按用户语速设置变速。
- **产物**：逐行一个 mp3，`audio/dialog/<dialogueId>-<lineIndex>.mp3`（lineIndex 从 0 起）；全文连播由前端按行顺序播放实现，不生成合并文件。
- **manifest**：`audio/manifest.js` 新增 `AUDIO_DIALOGS = { dialogueId: 行数 }` 行（脚本自动维护，勿手改；重跑 `generate_audio.py` 时也须保留该行——参照 `AUDIO_NATIVE` 的保留做法）。
- **断点续跑**：已存在文件自动跳过；礼貌延迟 ≥1s；失败重试 2 次并记录。
- **质量把关说明**：管道保证生成参数（音色/语速/逐行完整）；「原生地道」的最终听感抽验由人耳把关（脚本打印逐组清单供抽查）。

## 5. 前端改动

### 5.1 导航与路由

- 路由 `#/listen`（听力首页）、`#/listen-review`（听力错题复习）；桌面侧栏与移动端 tab bar（≤768px）新增第 6 项「听力」，图标/文案/排版遵 `DESIGN.md` muted zine 规范。
- `src/data.js` 注册 `data/listening.js` 懒加载（进入听力相关路由时按需注入，与 A2/B1 数据同机制）。

### 5.2 听力首页（对话列表）

- 沿用 zine 封面墙/档案卡语言：按级别分组列出 20 组对话，卡片显示标题、场景标签、级别徽章、完成状态与历史正确率。
- 页面上部为「听写强化」入口卡（说明文案：用已学词汇做听音拼写训练）。

### 5.3 对话页（三级交互，对应路线图 §10.1）

1. **盲听**：不显示原文，按行自动连播整组对话（行间 0.6s 停顿）；可整组重播。
2. **看题作答**：显示 2–3 道选择题（题干中文/德文混排遵现有练习样式），即时反馈 + `tip` 解析；答错进入 SRS（§6）。
3. **精听**：逐句显示原文 + 中文对照，点句重播该句音频；播放按钮复用 `audio.js` 回退链。

### 5.4 听写强化子页

- 复用现有复习的听音/拼写题型与渐进提示，不新造题型。
- 抽题来源：当前级别的到期词 + 错词优先（复用复习队列逻辑，上限 20 词/次）。
- 本模块只是「专项训练入口」，评分照旧写词卡 SRS，不新增卡类型。

### 5.5 音频回退

对话行音频缺失（未生成/加载失败）→ 回退 speechSynthesis 朗读该行德文（现有 `audio.js` 回退模式），并在控制台 warn；不卡死流程。

## 6. SRS 接线

- 对话题卡 id：`listen-{dialogueId}#{qIndex}`（含 `#`，与语法错题卡 `g-...#n` 同风格，与词汇卡 id 天然区分）。
- 答错 → `DeSRS.review(cardId, 0)`；答对 → `quality=2`。
- **关键集成点**：现有语法到期判定以「id 含 `#`」过滤（`src/views.js:21` 的 `grammarDue`、`src/grammar.js:226` 的到期语法卡查询）。听力卡 id 同样含 `#`，若不改会被误计入语法复习。必须把这处过滤收窄为「`g-` 前缀且含 `#`」，并为听力卡加对称的 `listen-` 前缀过滤。
- 复习入口与语法卡同模式（独立入口，不混入词汇复习队列）：今日页按钮区新增「听力复习 N 题」（参照 `src/views.js` 语法复习按钮），路由 `#/listen-review`；听力首页同步显示到期数。
- 复习呈现：重播该对话音频后重答该题（题干/选项已在 `LISTEN_DIALOGS` 数据里，零新内容成本），标「听力」徽章。
- 完成状态（整组做过/正确率）存 `state.listen` 子树，走现有 IndexedDB 存储。

## 7. 测试与验收

- `tests/run.js` 新增：
  - 数据完整性：恰好 20 组；id 全部 `dl-` 前缀且唯一；level/theme/lines/questions 字段齐全；lines 3–5 行且 sp 仅 A/B；questions 2–3 题、`opts` 2–4 项、`a` 索引合法、`tip` 非空。
  - SRS 卡 id：`listen-...#n` 格式与语法/词汇卡互不冲突。
  - 听写抽题：到期/错词优先、上限生效。
- `npm test` 全程绿色（提交前底线，AGENTS.md §3）。
- `tools/shot.mjs` 双端（1280 / 375）截图验收：`#/listen` 列表、对话页三态、听写页；无 overflowX、无 jsErrors。

## 8. 文档与收尾

- `README.md` 功能清单与内容规模（+20 组对话音频）；`CHANGELOG.md` [Unreleased] 记录 S7；`AGENTS.md` 补目录结构 / 命名约定（`dl-` 前缀、`listen-...#n` 卡 id）/ 音频 SOP；`tools/README.md` 补 `generate_dialog_audio.py` 条目。
- 顺带还账：`package.json` 版本号对齐 CHANGELOG（当前 4.2.0 → 4.3.0）。
- `js/bundle.js` 构建产物由收尾任务统一重建，各功能任务分支**不提交** bundle（避免二进制冲突）。

## 9. 任务拆分（tower 执行）

| 任务 | 范围 | 依赖 |
|---|---|---|
| M1 对话内容与音频管道 | `data/listening.js`、`tools/generate_dialog_audio.py`、`tools/README.md`、`audio/dialog/**`、`audio/manifest.js` | 无 |
| M2 前端听力 Tab 与 SRS 接线 | `src/**`、`css/**`、`index.html` | 无（按 §2 格式契约先造样例数据开发） |
| M3 测试/文档/构建收尾 | `tests/**`、`README.md`、`CHANGELOG.md`、`AGENTS.md`、`package.json`、`js/bundle.js`、`shots/**` | M1 + M2 |

M1 内部先走 §3 的草稿→SLA 审核迭代，通过后生成音频；M1/M2 并行开工，M3 待两者合并后启动。
