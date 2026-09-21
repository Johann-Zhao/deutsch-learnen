# S8 阅读模块 实施计划

> **For agentic workers:** 本计划由 tower 工作流执行：M1/M2/M3 三个任务分支，每个 worker 只读自己的任务段落。设计依据：`docs/superpowers/specs/2026-09-21-reading-module-design.md`（下称「规格」），冲突时以规格为准。

**Goal:** 新增「阅读」Tab：20 篇分级短文（LLM 草稿 + SLA 审核 + 分词管道 + edge-tts 整篇音频），正文三态着色、点词弹卡、词库词一键入 SRS、生词率统计。

**Architecture:** 与词汇/听力同构——内容在 `data/reading.js`（index.html 静态加载；作者手写层 `data/reading_texts.src.js` 经 `tools/build_reading_tokens.py` 生成含 token 的最终数据），音频预生成 `audio/reading/`（清单 `AUDIO_READING`），前端新增 `src/reader.js`。不产生新 SRS 卡类型；「加入学习」复用词汇卡 id。

**Tech Stack:** 原生 HTML/CSS/JS（ESM → esbuild）、Node assert 单测、Python + edge-tts + dewikt 内容管道。

## Global Constraints

- 提交信息 `类型(范围): 描述`；**`js/bundle.js` 只有 M3 允许提交**。
- `npm test` 全程绿、`npm run build` 通过。
- UI 遵 `DESIGN.md`：新样式只引用令牌；三态着色仅下划线/浅底（≤10% 透明度），WCAG AA；动效 ≤300ms；375px 可用。
- 命名：短文 id 必须 `rd-` 前缀含级别段（`rd-a1-…`）；不产生新 SRS 卡 id 类型。
- `audio/manifest.js` 只由脚本维护（新增 `AUDIO_READING` 行）。

---

## M1 — 短文内容与管道（分支 feat/read-content）

**Files:**
- Create: `data/reading_texts.src.js`、`data/reading.js`（生成物）、`tools/build_reading_tokens.py`、`tools/generate_reading_audio.py`、`audio/reading/*.mp3`
- Modify: `tools/generate_audio.py`、`tools/generate_dialog_audio.py`（manifest 保留通用化）、`tools/README.md`、`audio/manifest.js`（仅脚本写入）

**Interfaces（Produces，供 M2/M3 依赖）:**
- `window.READING_TEXTS`：`[{ id, title, level, theme, words, paragraphs: [[token,…],…] }]`；token：`{w}`（标点）/ `{w, lemma, vid}`（词库词）/ `{w, lemma, g}`（库外词）。
- `window.AUDIO_READING`：`["<textId>", …]`（数组，与 AUDIO_WORDS 同形态）；音频路径 `audio/reading/<id>.mp3`。

### Task M1-1: 20 篇短文草稿（4 批 × 5 篇）

- [ ] **步骤 1**：建 `data/reading_texts.src.js`（作者手写层，文件头注释说明「由 build_reading_tokens.py 加工为 data/reading.js」）：

```javascript
window.READING_TEXTS_SRC = [
  { id: 'rd-a1-...', title: '…', level: 'A1', theme: '…（对齐现有词汇主题名）',
    text: '段落一。\n\n段落二。' }   // \n\n 分段
];
```

- [ ] **步骤 2**：第 1 批 A1×5。题材从故事/邮件/博客/通知/广告等多样化选择，与听力 20 组对话的场景不雷同。篇幅 A1 60–90 词 / A2 80–120 / B1 120–150；i+1：超纲词 ≤10%。
- [ ] **步骤 3**：每批跑自查（词数、id 前缀、级别分布、无阿拉伯数字以外的格式问题）：

```bash
node -e "const w={};new Function('window',require('fs').readFileSync('data/reading_texts.src.js','utf8'))(w);\
const d=w.READING_TEXTS_SRC;const ids=new Set();const lv={A1:0,A2:0,B1:0};\
d.forEach(x=>{if(!/^rd-(a1|a2|b1)-[\w-]+$/.test(x.id))throw new Error('id '+x.id);\
if(ids.has(x.id))throw new Error('dup '+x.id);ids.add(x.id);lv[x.level]++;\
const n=x.text.split(/\s+/).filter(t=>/[\p{L}]/u.test(t)).length;\
const lim={A1:[60,90],A2:[80,120],B1:[120,150]}[x.level];\
if(n<lim[0]||n>lim[1])throw new Error(x.id+' 词数 '+n+' 超出 '+lim)});\
console.log('OK',d.length,JSON.stringify(lv))"
```

- [ ] **步骤 4**：提交 `feat(data): 阅读短文草稿第 N 批`。完成 4 批（累计 A1×8/A2×7/B1×5）后 TowerSend 给 tower（subject 含 content-review-request）请求 SLA 审核。
- [ ] **步骤 5（审核迭代）**：按 reviewer 意见修复（每处单独 `fix(data):` 提交），复审至 clean。**过审前不得跑音频生成。**

### Task M1-2: 分词管道 `tools/build_reading_tokens.py`

- [ ] **步骤 1**：读 `data/reading_texts.src.js`（正则/JSON 提取，风格对齐 tools 现有脚本）；分词：按空白切分、剥离标点为独立 `{w}` token；德语名词大写保留。
- [ ] **步骤 2：lemma 归并与词库匹配**。词库索引来源：`data/vocabulary*.js`（复用 `tools/generate_audio.py` 的 load_items 或同等解析），键 = 去冠词的 lemma 小写。匹配策略按序：
  1. 原形直接命中（大小写敏感名词 → 小写归一）；
  2. 规则还原：动词词尾（-st/-t/-en/-est/-et → 词干 + en）、过去分词（ge…t/en → 词干）、名词复数常见尾（-e/-er/-n/-en/-s 剥除）、形容词词尾剥除；
  3. 仍不命中：经 `tools/dewikt.py` 查 de.wiktionary（有磁盘缓存）取词形表与释义；
  4. 人工兜底：脚本头部 `LEXICON_OVERRIDES = { "词形小写": {"lemma": …, "vid": …} 或 {"lemma": …, "g": …} }`，worker 审映射报告时补充。
- [ ] **步骤 3**：库外词的 `g`：dewikt 释义取首条中文可解释义（机器提取若不可靠，worker 人工补入 OVERRIDES——质量优先）。
- [ ] **步骤 4**：输出 `data/reading.js`（头注释「由 tools/build_reading_tokens.py 自动生成，勿手改」）：含 tokens、`words`（词 token 计数）。打印映射报告：总词形数、命中 vid 数、库外词数、未决词数（未决 >0 则退出码 1）。
- [ ] **步骤 5**：worker 逐词审映射报告（重点：不规则动词 ging→gehen 类、复合词、专有名词不映射 vid）；补 OVERRIDES 至零未决。SLA reviewer 复审时抽查映射。
- [ ] **步骤 6**：提交 `feat(tools): 阅读分词与词形归并管道` + `feat(data): 阅读 20 篇分词数据`。

### Task M1-3: manifest 保留通用化（fix 两个旧脚本）

- [ ] **步骤 1**：`tools/generate_audio.py` 与 `tools/generate_dialog_audio.py`：把「保留 AUDIO_NATIVE / AUDIO_DIALOGS 行」的逐行枚举改为——解析旧 manifest 全部 `window.<NAME> =` 行，仅丢弃本脚本负责重建的键，其余原样按序保留（自己的键写在最后）。注释说明该约定。
- [ ] **步骤 2**：验证：构造含 `AUDIO_NATIVE`/`AUDIO_DIALOGS`/`AUDIO_READING` 假行的旧 manifest，跑两脚本的最小样本（generate_audio 用临时目录小样本法，参照 S7 的验证方式，不触发真实 TTS），断言三个保留行均在。
- [ ] **步骤 3**：提交 `fix(tools): manifest 保留逻辑通用化（保留所有非本脚本管理的行）`。

### Task M1-4: 朗读音频 `tools/generate_reading_audio.py` + 全量生成

- [ ] **步骤 1**：脚本：读 `data/reading.js`，每篇纯文本（tokens 的 w 以空格连接、去标点多余空格）→ edge-tts `de-DE-KatjaNeural` 默认语速 → `audio/reading/<id>.mp3`；断点续跑；间隔 ≥1s；失败重试 2 次；支持 `--limit/--ids`；结束重写 `audio/manifest.js` 加 `AUDIO_READING` 行（用 M1-3 的通用保留逻辑）。
- [ ] **步骤 2**：`--limit 1` 小样本验证 → 全量 20 篇。校验：20 个 mp3 存在、无 <5KB、时长与词数相符（约 词数/2.5 秒 ±50%）。
- [ ] **步骤 3**：`tools/README.md` 补两个新脚本条目 + 运行顺序。
- [ ] **步骤 4**：提交 `assets(audio): 阅读 20 篇整篇朗读` 等；TowerSend review-request（附 20 篇 id 清单、映射报告摘要、音频校验结果）。

---

## M2 — 前端阅读 Tab（分支 feat/read-ui）

**Files:**
- Create: `src/reader.js`
- Modify: `src/app.js`、`src/data.js`、`src/audio.js`、`src/storage.js`、`css/style.css`、`index.html`
- Test: 纯函数导出供 M3；本任务期间 npm test 保持 69 绿。

**Interfaces:**
- Consumes（M1 产物，开发期可能不存在——防御性空值 + 空状态）：`window.READING_TEXTS`、`window.AUDIO_READING`、`audio/reading/<id>.mp3`。
- Produces（M3 测试依赖）：
  - `src/data.js`: `getReadingTexts()` → 数组（缺省 `[]`）；`getAudioReading()` → 数组（缺省 `[]`）。
  - `src/audio.js`: `pickReadingSrc(id, readingSet)` 纯函数；`audio.playReading(id, fallbackText, opts)`。
  - `src/storage.js`: `emptyState()` 含 `reading: {}`，旧存档补默认。
  - `src/reader.js`: `export const Reader = { homePage, readPage }`；纯函数 `classifyToken(token, srs)` → `'mastered'|'learning'|'new'`；`newWordRate(paragraphs, srs)` → 0–100 整数；`isWordToken(t)`。

### Task M2-1: 底座（data/audio/storage）

- [ ] **步骤 1**：`src/data.js` 加 `getReadingTexts`/`getAudioReading`（仿 `getListenDialogs`/`getAudioNative`，注意 AUDIO_READING 是数组）。
- [ ] **步骤 2**：`src/audio.js` 加：

```javascript
/* 纯函数：整篇朗读音频来源（清单内 → 文件路径；否则 null 交给 TTS） */
export function pickReadingSrc(id, readingSet) {
  if (readingSet && readingSet.has(id)) return 'audio/reading/' + id + '.mp3';
  return null;
}
```

`buildSets()` 建 `readingSet`；`audio.playReading(id, fallbackText, opts)` 复用 `playUrl`/`TTS.speak` 回退（仿 playDialog）。

- [ ] **步骤 3**：`src/storage.js` `emptyState()` 加 `reading: {}`（注释：`{ [textId]: { finished, added } }`），`_mergeState` 对齐补默认。
- [ ] **步骤 4**：`npm run build && npm test` 绿；提交 `feat(read): 阅读数据/音频/存储底座`。

### Task M2-2: `src/reader.js` 纯函数与文库首页

- [ ] **步骤 1**：纯函数（导出名与上面一致，供 M3 测试）：

```javascript
export function isWordToken(t) { return !!t && typeof t.w === 'string' && !!t.lemma; }

/* 三态：有 vid 且有卡 → mastered/learning；无卡或非词库词 → new */
export function classifyToken(token, srs) {
  if (!isWordToken(token)) return null;
  const c = token.vid && srs[token.vid];
  if (!c) return 'new';
  if (c.sealed || c.mastered) return 'mastered';
  return 'learning';
}

/* 生词率：new 词 token / 全部词 token，0–100 整数 */
export function newWordRate(paragraphs, srs) {
  let total = 0, fresh = 0;
  (paragraphs || []).forEach(function (p) {
    p.forEach(function (t) {
      if (!isWordToken(t)) return;
      total++;
      if (classifyToken(t, srs) === 'new') fresh++;
    });
  });
  return total ? Math.round(fresh / total * 100) : 0;
}
```

- [ ] **步骤 2**：`homePage()`：刊头 micro `LESEN · 阅读` + page-title；按级别分组卡片（标题、级别/theme 徽章、词数、按当前 srs 实算的生词率徽标、完成状态 from `state.reading`）；生词率 >10% 的卡显示「可能偏难」提示；空数据 → 空状态卡（行动邀请文案）。卡片进 `#/read/<id>`。
- [ ] **步骤 3**：提交 `feat(read): 文库首页与三态纯函数`。

### Task M2-3: 阅读页 `readPage(id)`

- [ ] **步骤 1**：顶部朗读条：「▶ 朗读全文」（`audio.playReading(id, 全文纯文本)`，全文由 tokens 连接；缺清单回退 TTS）；播放中可停止。
- [ ] **步骤 2**：正文渲染：逐段逐 token；词 token 按 `classifyToken` 加 class（`rt-w rt-mastered/rt-learning/rt-new`），标点原样；`tabindex=0` + 键盘 Enter/Space 也可点词（焦点可见，WCAG）。
- [ ] **步骤 3**：点词弹卡（zine 卡片，同一时间最多一张，再点他处/ESC 关闭）：词形 + lemma、vid 词 → 词库释义/词性角标/IPA（`getWordIpa`）/发音按钮（`audio.playWord`）/例句（词库数据）；库外词 → `g` + TTS 发音（`TTS.speak(token.w)`）。
- [ ] **步骤 4**：「加入学习」：vid 词且无 srs 卡 → `srs[vid] = SRS.review(SRS.newCard(today()), 1, today())`，`store.touchToday('new', 1)`，`store.save()`，按钮变「已加入 ✓」，该词在正文即时变为 learning 态；已有卡 → 显示「已在学习计划」。库外词位置显示「超出本课程词库，暂不支持加入」。
- [ ] **步骤 5**：底部统计条：生词率 x%（>10% 显示偏难提示）、本篇已加入 N 词（统计本次会话新增）、「标为读完」按钮写 `state.reading[id] = { finished: today(), added: n }`；已读完显示完成日期。
- [ ] **步骤 6**：id 无效 → 空状态 + 回文库按钮。提交 `feat(read): 阅读页三态着色/点词弹卡/一键入 SRS`。

### Task M2-4: 路由、导航、样式

- [ ] **步骤 1**：`src/app.js`：`else if (hash === '#/read') view.appendChild(Reader.homePage());`、`else if ((m = hash.match(/^#\/read\/([\w-]+)$/))) view.appendChild(Reader.readPage(m[1]));`；`navActive` 加 `if (hash.indexOf('#/read') === 0) return '/read';`；import Reader。
- [ ] **步骤 2**：`index.html`：nav 与 tabbar 加第 7 项「阅读」（tabbar 图标 ✎ 或 ♪ 之外的字符，与现有字形风格一致）；`<script src="data/reading.js">` 加在 listening.js 之后。
- [ ] **步骤 3**：`css/style.css`：`.rt-*` 三态（learning=琥珀浅底下划线、new=蓝浅底下划线、mastered=无色；透明度 ≤10%，仅用令牌，无新色值——琥珀暂用 `--gold` 低透明度实现，待 M3 在 DESIGN.md 立 `--learn` 令牌后如已落地则改引用）、`.read-*` 布局；**tabbar 七项 375px 实测**：收紧字号/padding 至不溢出；若实测仍溢出，执行规格 §4.1 回退（「听力」改「听读」合并分区），并在完成报告里说明取舍。
- [ ] **步骤 4**：冒烟（控制台注入样例 READING_TEXTS）：三态渲染、点词弹卡、加入学习后正文变色 + srs 落库、生词率正确、375px 无溢出。
- [ ] **步骤 5**：提交 `feat(app): 阅读路由与第 7 项导航`。

---

## M3 — 测试/文档/收尾（分支 feat/read-release，依赖 M1+M2）

**Files:** Modify: `tests/run.js`、`README.md`、`CHANGELOG.md`、`AGENTS.md`、`DESIGN.md`、`package.json`；Create: `js/bundle.js`（重建）、`shots/` 新截图

### Task M3-1: 测试

- [ ] 数据完整性：`loadDataFile('../data/reading.js')`；恰好 20 篇；id `^rd-(a1|a2|b1)-` 唯一；级别分布 A1×8/A2×7/B1×5；每篇 `words` == 实际词 token 数；词 token 必有 lemma 且 vid/g 必居其一；vid 都能在词库索引解析；AUDIO_READING 与 20 篇 id 一一对应。
- [ ] `classifyToken` 三态（无卡 new / 有卡 learning / mastered 或 sealed mastered）与 `newWordRate`（空→0、全新→100、混合比例）；`pickReadingSrc` 边界。
- [ ] `npm test` 全绿（预期 69 + 新增）。

### Task M3-2: 文档与版本

- [ ] CHANGELOG `[4.5.0] - <合并日>`（Added 阅读 Tab/20 篇短文/三态着色/一键入 SRS/整篇朗读；Changed manifest 保留通用化）。
- [ ] package.json → `4.5.0`。
- [ ] README 功能清单 + 内容规模表（+20 篇阅读 + 20 音频）、测试数更新。
- [ ] AGENTS.md：目录补 data/reading_texts.src.js、data/reading.js、audio/reading/、tools 两新脚本；§7 命名约定补 `rd-` 前缀；§8 SOP 补阅读内容生产流程（src.js 手写 → build_reading_tokens.py → generate_reading_audio.py）。
- [ ] DESIGN.md：§3 功能性色彩补「学习中/生词」两态（立 `--learn` 令牌、生词复用 `--m`，强调 ≤10% 透明度小面积）；§导航「五个主入口」更正为当前实际（今日/词汇/语法/变位/听力/阅读/我的，或 M2 回退后的实际形态）。**S7 的文档漂移（第 6 项听力）一并修。**

### Task M3-3: 构建与截图验收

- [ ] `npm run build` 提交 bundle（+map）。
- [ ] `tools/shot.mjs` 双端 1280/375：`#/read`、`#/read/<第一篇 id>`、`#/`；无 overflowX/jsErrors；人工过目：三态着色可读、zine 风格一致、tabbar 形态正确。
- [ ] TowerSend review-request。

---

## Self-Review 记录

- 规格覆盖：§2→M1-1/M1-2；§3→M1-1~M1-4；§4→M2-1~M2-4；§5→M3-2；§6→M2-3；§7→M3-1/M3-3；§8→M3-2。✓
- 类型一致：`getReadingTexts/getAudioReading/pickReadingSrc/playReading/classifyToken/newWordRate/isWordToken` 定义与测试引用一致；AUDIO_READING 为数组（与 AUDIO_WORDS 同形态），M2 的 readingSet 与 M3 的清单测试口径一致。✓
- 先后约束：M3 数据测试依赖 M1 合并；M2 缺数据走空状态。✓
