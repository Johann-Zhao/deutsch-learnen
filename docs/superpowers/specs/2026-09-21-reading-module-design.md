# S8 阅读模块（路线图 S4）— 设计规格

> 上位文档：`docs/技术调研与开发规划.md`（§5 差距分析「阅读=第二大空白」、§10.2 阅读模块、§8.3 词汇网络、§12 许可红线）。
> 决策记录（2026-09-21，auto 模式下由 tower 依路线图与 S7 惯例裁定，用户可随时推翻）：
> - **范围**：阅读 Tab = 20 篇分级短文 + 三态着色 + 点词卡片 + 一键入 SRS + 生词率 + 整篇朗读音频；**v1 不做阅读理解题**。
> - **内容生产**：沿用 S7 闭环——LLM 草稿（worker）+「高级学习者 + 二语习得研究者」视角审核（reviewer），过审后才生成音频。
> - **词典策略**：运行时零网络；管道期预分词 + 词形归并；**仅词库内词可「加入学习」**进 SRS，库外词只读释义。
> - **入口**：tabbar 第 7 项「阅读」；375px 不溢出为验收标准，放不下则回退「听力」Tab 改名「听读」合并。
> - 版本：4.5.0。

## 1. 目标与范围

补上「阅读」输入维度：

1. 内置 20 篇分级短文（A1×8 / A2×7 / B1×5），题材多样（故事/邮件/博客/通知/广告等，与听力 20 组对话场景不重复）。
2. 正文逐词三态着色：已掌握（无色）/ 学习中（琥珀）/ 生词（蓝）；点词弹卡（释义/词性/发音/例句）；词库词一键加入 SRS。
3. 每篇整篇朗读音频（edge-tts），阅读可听读。
4. 篇内生词率统计，>10% 提示偏难。

**明确不做**：阅读理解题；用户粘贴自定义文本（v2 候选）；库外词进 SRS；RSS/新闻抓取（许可红线 §12.2）。

## 2. 数据格式（`data/reading.js`，新增，index.html 静态加载）

```javascript
window.READING_TEXTS = [
  {
    id: 'rd-a1-neighbors',        // rd- 前缀 + 级别段（rd-a1-/rd-a2-/rd-b1-），唯一
    title: '新邻居',               // 中文题名
    level: 'A1', theme: '问候与自我介绍', // theme 对齐现有词汇主题名（可复用，不要求与听力的 20 组错开，但同题材内容不得雷同）
    words: 96,                     // 词 token 数（校验用）
    paragraphs: [                  // 段落数组，每段为 token 数组
      [
        { w: '!' },                                        // 标点 token：仅 w
        { w: 'ging', lemma: 'gehen', vid: '...' },         // 词库词：lemma + vid（词汇卡 id）
        { w: 'Spaziergang', lemma: 'der Spaziergang', g: '散步' }  // 库外词：lemma + 内联中文 gloss
      ]
    ]
  }
];
```

- **i+1 原则**：篇幅 A1 60–90 词、A2 80–120 词、B1 120–150 词；以该级别已学词汇为主，超纲词 ≤10%。
- token 规则：标点 token 仅 `{w}`；词 token 必有 `lemma`；`vid` 仅当 lemma 命中本项目词库（1945 词）时存在；库外词必有 `g`（中文 gloss）。
- 词形归并：变位/变格/复合词由管道归并到 lemma 再匹配词库（如 `ging → gehen`、`des Hauses → das Haus`）。

## 3. 内容生产与审核闭环（沿用 S7 机制）

```
worker 写 20 篇草稿（4 批 × 5 篇，A1 8 / A2 7 / B1 5）
  → tower spawn reviewer（SLA 视角）审内容：级别适配/自然地道/文化准确/题材多样/篇幅合规
  → 迭代至 clean → 才允许跑分词与音频管道
```

管道（worker 执行，产物全部入库）：

1. `tools/build_reading_tokens.py`（新增）：读 `data/reading_texts.src.js`（作者手写层：id/title/level/theme + 纯文本段落）→ 分词 → lemma 归并（规则 + de.wiktionary 经 `tools/dewikt.py` 缓存补形态）→ 匹配词库得 `vid`；库外词经 dewikt 取释义作 `g` → 输出 `data/reading.js`（含 tokens）。**lemma 映射质量是关键**：脚本输出映射报告（未匹配词表），worker 逐词核对后修正（可用 `LEXICON_OVERRIDES` 人工表兜底）。
2. `tools/generate_reading_audio.py`（新增）：每篇整篇一个 mp3 → `audio/reading/<id>.mp3`；edge-tts `de-DE-KatjaNeural`（单声部叙述，与听力对话音色体系一致），默认语速；断点续跑；重写 `audio/manifest.js` 新增 `AUDIO_READING = ["<id>", …]` 行。
3. **manifest 保留通用化**（本任务必修）：`tools/generate_audio.py` 与 `tools/generate_dialog_audio.py` 的「保留行」逻辑从逐行枚举（AUDIO_NATIVE / AUDIO_DIALOGS）改为**保留所有本脚本不管理的行**（解析旧 manifest 全部 `window.X = …` 行，只重建自己负责的键，其余原样保留）。S7 的教训：每加一类音频就要改所有旧脚本。

## 4. 前端（`src/reader.js` 新增）

### 4.1 路由与导航

- 路由 `#/read`、`#/read/<id>`；桌面侧栏与移动 tabbar 第 7 项「阅读」。
- **375px 验收**：tabbar 七项不溢出（优先收紧字号/间距）；实测放不下则回退：`#/listen` 改名「听读」、`#/read` 并入其分区——M2 实测决定，reviewer 复核。
- `index.html` 静态加载 `data/reading.js`；缺失时防御性空状态（同听力模块做法）。

### 4.2 文库首页

按级别分组的卡片列表：标题、级别/theme 徽章、词数、**按当前用户 SRS 状态实时计算的生词率**、完成状态（`state.reading[id]`）。空状态文案为行动邀请。

### 4.3 阅读页

- 顶部：整篇朗读条（`audio.playReading`；缺音频回退 TTS 全文）。
- 正文：逐 token 渲染，三态着色（下划线/浅底，≤10% 透明度，遵 DESIGN.md 小面积原则）：
  - 已掌握（srs 卡 `mastered`）→ 无色；
  - 学习中（有 srs 卡未掌握）→ 琥珀；
  - 其余 → 蓝（生词）。
- 点词弹卡（复用 zine 卡片语言）：词形、lemma、词性、中文释义（vid 词用词库释义+例句+IPA+发音按钮；库外词用 `g` + TTS 发音）；vid 词显示「加入学习」按钮——尚无 srs 卡时 `SRS.newCard(today)` + `review(card, 1, today)`（「模糊」档，近期到期），`touchToday('new', 1)`，按钮变为「已加入 ✓」；库外词按钮位置显示「超出本课程词库」说明。
- 底部统计条：生词率 x%（>10% 提示「这篇对你可能偏难，建议先看低一级」）、本篇已加入 N 词、标「读完」按钮（写 `state.reading[id] = { finished: today, added: n }`）。

### 4.4 新增纯函数（供测试）

`src/reader.js` 导出：`classifyToken(token, srs)` → `'mastered'|'learning'|'new'`；`newWordRate(tokens, srs)` → 0–100；`src/audio.js` 增加 `pickReadingSrc(id, readingSet)` 与 `audio.playReading(id, fallbackText, opts)`（回退链同既有模式）；`src/data.js` 增加 `getReadingTexts()`/`getAudioReading()`；`src/storage.js` `emptyState()` 增加 `reading: {}` 并兼容旧存档。

## 5. DESIGN.md 增补（M3 负责）

- §3 功能性色彩扩展：新增「学习中」琥珀（低饱和，建议 `#A88C4A` 同族派生为独立令牌 `--learn`）与「生词」蓝（直接复用 `--m`）；强调仅下划线/浅底小面积使用。
- §导航「五个主入口」更新为当前实际的七项（含 S7 已上的「听力」——补齐 S7 的文档漂移）。

## 6. SRS 与存储

- 「加入学习」复用词汇卡 id（vid），不新增卡类型；阅读不产生错题卡。
- `state.reading = { [textId]: { finished, added } }`，走现有 IndexedDB。

## 7. 测试与验收

- `tests/run.js` 新增：数据完整性（恰好 20 篇、id 合法唯一、级别分布、token 规则：词必有 lemma、vid 或 g 必居其一、words 字段与 token 数一致）；`classifyToken` 三态；`newWordRate` 计算；`pickReadingSrc` 边界；`AUDIO_READING` 清单与文本 id 一一对应。
- `npm test` 全绿；`npm run build` 通过（bundle 仅 M3 提交）。
- `tools/shot.mjs` 双端截图：`#/read`、`#/read/<第一篇>`、`#/`；目视确认三态着色可读性（WCAG AA）与 zine 风格一致。

## 8. 文档与收尾（M3）

CHANGELOG `[4.5.0]`；package.json → 4.5.0；README 功能清单/内容规模/测试数；AGENTS.md 目录与命名约定补 `rd-` 前缀、`data/reading.js`、`audio/reading/`、两个新 tools 脚本及 SOP；DESIGN.md 按 §5 增补；tools/README.md 补两个新脚本条目（M1 写）。

## 9. 任务拆分（tower 执行）

| 任务 | 范围 | 依赖 |
|---|---|---|
| M1 短文内容与管道 | `data/reading_texts.src.js`、`data/reading.js`、`tools/build_reading_tokens.py`、`tools/generate_reading_audio.py`、`tools/generate_audio.py`、`tools/generate_dialog_audio.py`、`tools/README.md`、`audio/reading/**`、`audio/manifest.js` | 无 |
| M2 前端阅读 Tab | `src/**`、`css/**`、`index.html` | 无（按 §2 契约开发，缺数据走空状态） |
| M3 测试/文档/构建收尾 | `tests/**`、`README.md`、`CHANGELOG.md`、`AGENTS.md`、`DESIGN.md`、`package.json`、`js/bundle.js`、`js/bundle.js.map`、`shots/**` | M1 + M2 |
