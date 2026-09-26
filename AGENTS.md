# AGENTS.md — 项目约定速查

> 面向未来维护本项目的人类或 AI 开发者。在做任何改动前，先读本文件；UI 细节以 `DESIGN.md` 为准。

## 1. 目录结构

```
德语学习项目/
├── index.html              # 应用入口（引用 js/bundle.js；静态加载 data/*.js 与两份 manifest）
├── css/style.css           # 全站样式
├── sw.js                   # Service Worker 离线壳（核心壳预缓存 + 媒体运行时 CacheFirst；CACHE 版本号随发布递增）
├── manifest.webmanifest    # PWA 清单（standalone、theme/background #F2EDE3、start_url/scope ./）
├── js/                     # 浏览器可直接运行的脚本 + 构建产物
│   └── bundle.js           # esbuild 输出（IIFE，单文件）
├── src/                    # ESM 源码（构建入口 src/main.js）
│   ├── cloze.js            # 语境填空（S9/M7）：句库挖空四选一 + 阅读/听力「练一练」入口
│   └── declension.js       # 变格词尾专项（S9/M8）：专题列表与练习页（#/declension）
├── data/                   # 内容数据（按级别分文件）
│   ├── vocabulary.js       # A1 词汇主题
│   ├── vocabulary_a2.js    # A2 词汇主题
│   ├── vocabulary_b1.js    # B1 词汇主题
│   ├── grammar.js          # A1 语法专题
│   ├── grammar_a2.js       # A2 语法专题
│   ├── grammar_b1.js       # B1 语法专题
│   ├── listening.js        # 听力小对话 20 组（S7；index.html 静态加载，跨级别复习需全量）
│   ├── reading_texts.src.js # 阅读短文作者手写层（S8；由 build_reading_tokens.py 加工为 reading.js）
│   ├── reading.js          # 阅读分词短文 20 篇（S8；自动生成，勿手改）
│   ├── declension.js       # 变格/词尾专项 6 专题 50 题（S9/M8；window.DECLENSION，index.html 静态加载）
│   └── ipa.js              # 自动生成：WORD_IPA 音标（fetch_ipa.py）
├── audio/                  # 预生成音频与清单
│   ├── word/               # 单词音频（edge-tts）
│   ├── sent/               # 例句音频（edge-tts）
│   ├── conj/               # 变位音频（edge-tts）
│   ├── dialog/             # 对话行音频（分角色 edge-tts，generate_dialog_audio.py）
│   ├── reading/            # 阅读整篇朗读（edge-tts，generate_reading_audio.py）
│   ├── native/             # 真人发音 ogg（Wikimedia Commons，CC BY-SA/CC0）
│   ├── credits_native.json # 自动生成：真人发音逐词署名（file/speaker/license/url）
│   └── manifest.js         # 自动生成：AUDIO_WORDS / AUDIO_SENTS / AUDIO_CONJ / AUDIO_NATIVE / AUDIO_DIALOGS / AUDIO_READING
├── images/                 # 配图与封面
│   ├── covers/             # 38 张主题 zine 纸感封面
│   ├── zine/               # 装饰刊头插画（hero / 空状态，zine 纸感）
│   ├── ornaments/          # Cove 提取的装饰素材（哥特花窗等章头装饰）
│   ├── words/              # 词条配图
│   ├── icons/              # PWA 安装图标 192 / 512 / maskable-512（gen_icons.py 派生，勿手改）
│   ├── credits.json        # 图片来源与授权信息
│   └── manifest.js         # 自动生成：IMAGE_WORDS / IMAGE_COVERS
├── tools/                  # 内容生产管道（Python / Node）
│   ├── requirements.txt
│   ├── README.md
│   ├── generate_audio.py
│   ├── generate_dialog_audio.py # 对话行音频：分角色 edge-tts → audio/dialog/ + AUDIO_DIALOGS 清单
│   ├── build_reading_tokens.py # 阅读分词管道：reading_texts.src.js → 分词/词形归并/词库匹配 → data/reading.js
│   ├── generate_reading_audio.py # 阅读整篇朗读：edge-tts → audio/reading/<id>.mp3 + AUDIO_READING 清单
│   ├── dewikt.py           # de.wiktionary 共享访问（wikitext 缓存 tools/.cache/）
│   ├── fetch_ipa.py        # IPA 抓取 → data/ipa.js
│   ├── fetch_native_audio.py # 真人发音抓取 → audio/native/ + credits + manifest
│   ├── fetch_images.py
│   ├── finalize_images.py
│   ├── gen_zine_covers.py
│   ├── extract_ornaments.py
│   ├── gen_icons.py        # 从 images/zine/hero.png 派生 PWA 图标 → images/icons/（PIL，不调 API）
│   ├── shot.mjs            # Playwright 双端截图验收（node tools/shot.mjs <route> <outfile> <width> [height]）
│   ├── seedream_client.py
│   └── dump_conj.js
├── scripts/                # 构建脚本
│   └── build.mjs           # esbuild 配置
├── tests/                  # Node 单元测试
│   └── run.js
├── docs/                   # 技术文档
│   ├── 技术调研与开发规划.md
│   └── plans/              # 阶段实施计划
├── DESIGN.md               # UI/UX 设计规范（有约束力）
├── CHANGELOG.md            # 版本历史
├── README.md               # 用户与开发者入口
├── .env.example            # 内容脚本配置模板
└── package.json
```

## 2. 数据文件格式样例

### 词汇主题（`window.VOCAB_THEMES`）

```javascript
{
  id: 'greet',                    // 见下文命名约定
  name: '问候与自我介绍',
  level: 'A1',                    // A1 / A2 / B1
  words: [
    // [德语, 词性, 中文, 例句, 例句中文]
    ['der Tag', 'm', '白天；天', 'Guten Tag!', '你好！'],
    ['die Nacht', 'f', '夜晚', 'Gute Nacht!', '晚安！'],
    ['heißen', 'v', '名叫', 'Wie heißen Sie?', '您叫什么名字？']
  ]
}
```

词性标记：`m / f / n / pl / v / adj / adv / num / pron / phrase / conj / part`。

### 语法专题（`window.GRAMMAR`）

```javascript
{
  id: 'g-praesens',               // 见下文命名约定
  title: '动词现在时变位',
  level: 'A1',
  summary: '规则动词词尾、不规则变化动词，以及 sein / haben / werden。',
  lesson: `<p>HTML 讲解字符串……</p>`,
  exercises: [
    { type: 'choice', q: 'ie 组合发什么音？',
      opts: ['…', '长音"衣"', '…'], a: 1, tip: 'ie 是长 i 音。' },
    { type: 'fill', q: 'ich ___ (lernen) Deutsch.', a: 'lerne', tip: 'ich 加 -e。' }
  ]
}
```

### 变格/词尾专项（`window.DECLENSION`）

```javascript
{
  id: 'dc-article',               // dc- 前缀，见下文命名约定
  title: '定冠词四格变化',
  level: 'A1',                    // A1 / A2 / B1
  topic: 'article',               // 分组标签：article / adjective / pronoun / noun / preposition
  summary: '一句话说明本专题训练哪种词尾。',
  exercises: [
    // choice 与语法专题同构：a 为正确项下标；fill 的 a 为字符串答案
    { type: 'choice', q: 'Mein Vater kauft ___ Wagen. (der Wagen)',
      opts: ['den', 'der', 'dem'], a: 0, tip: 'kaufen 接第四格：den Wagen。' },
    { type: 'fill', q: 'Kannst du ___ Kind helfen? (das Kind)', a: 'dem', tip: 'helfen 接第三格。' }
  ]
}
```

## 3. 构建与测试命令

```bash
npm install         # 仅安装 esbuild 等 devDependencies
npm run dev         # watch 模式：src/main.js → js/bundle.js
npm run build       # 生产构建：IIFE + ES2018 + sourcemap + minify
npm test            # 运行 Node 单元测试（算法、判分、数据完整性）
```

**测试底线**：`npm test` 必须全程绿色。提交前必跑。

## 4. 提交规范

格式：`类型(范围): 描述`

- 类型：`feat / fix / refactor / test / docs / chore / build`
- 范围：可选，如 `(app)`、`(storage)`、`(tools)`、`(docs)`
- 描述：中文，陈述句，说明改动的真实意图

示例：

```
feat(storage): IndexedDB 主存并保留 localStorage 镜像迁移
fix(srs): stripArticle 不再把 zu/to 当冠词剥离
docs(tools): 新增 README 与 requirements.txt
```

## 5. 分支与里程碑 Tag 模型

- `main`：稳定分支，仅接收评审后的合并。
- `phase/*`：阶段分支，如 `phase/s1-fixes`、`phase/s2-tooling`。
- 里程碑 tag：
  - `v1.0`：A1 初始版本
  - `v1.1`、`v1.2`：功能迭代
  - `v2.0`：A2/B1 全量扩展 + 图片 + 全站音频
  - `v2.1`：S1 修补（语法 SRS / IndexedDB / 懒加载）
  - `v3.0`：S2 工程化（esbuild + ESM + 工具化）

每个 Task 结束时，优先提交到当前 `phase/*` 分支；阶段收尾后合并回 `main` 并打 tag。

## 6. DESIGN.md 的约束力

`DESIGN.md` 是 UI/UX 决策的最高依据，不可随意覆盖：

- **词性低饱和三色系统**：der 蓝 `#4A6FA5`、die 红 `#A85B6E`、das 绿 `#4E7D5E`；唯一功能性色彩，仅小面积使用。
- **视觉方向**：muted zine 纸感——米色旧纸 `#F2EDE3` + 纸纹噪点、衬线标题、打字机微文本、装饰金 `#A88C4A`；词性三色外无彩色大色块，不用渐变/阴影堆叠。
- **动效**：仅卡片翻面与答题反馈，≤300ms，尊重 `prefers-reduced-motion`。
- **文案**：按钮写明结果；空状态是行动邀请；错误提示直接说明问题与解决方式。
- **质量底线**：响应式 375px、焦点可见、WCAG AA 对比度、答案判定不区分大小写且正确处理变元音。

## 7. 命名约定（防御跨级别懒加载的关键）

**必须严格遵守**，否则按级别懒加载会导致复习队列找不到对应数据。

- **A1 词汇主题 id**：无级别前缀，如 `greet`、`time`、`family`。
- **A2 词汇主题 id**：必须加 `a2-` 前缀，如 `a2-travel`、`a2-office`。
- **B1 词汇主题 id**：必须加 `b1-` 前缀，如 `b1-career`、`b1-media`。
- **A1 语法专题 id**：`g-` 前缀，如 `g-praesens`、`g-kasus`。
- **A2 语法专题 id**：`g-a2-` 前缀，如 `g-a2-verben`。
- **B1 语法专题 id**：`g-b1-` 前缀，如 `g-b1-passiv`。
- **变格/词尾专项专题 id**：`dc-` 前缀，如 `dc-article`、`dc-prep`（`window.DECLENSION`，与语法 `g-` 并列但不计入语法专题统计）。

词汇卡全局 id：`{themeId}-{index}`（如 `greet-0`、`a2-travel-5`）。
语法错题卡 id：`{topicId}#{exerciseIndex}`（如 `g-praesens#2`），含 `#`，与词汇 id 天然区分。
变格错题卡 id：`dc-{topicId}#{exerciseIndex}`（如 `dc-article#3`），**复用语法 SRS 队列**——以 `dc-` 开头且含 `#`，被 `isGrammarCardId` 命中（到期过滤与语法复习页共用），错题本类型按前缀记为 `declension`（渲染为「变格」分支）。
听力对话 id：`dl-` 前缀并含级别段（如 `dl-a1-greet`、`dl-b1-health`），与词汇/语法 id 天然区分。
听力 SRS 卡 id：`listen-{dialogueId}#{qIndex}`（如 `listen-dl-a1-greet#0`），含 `#` 但非 `g-` 前缀——语法/听力到期过滤必须用 `isGrammarCardId`/`isListenCardId` 谓词按前缀区分，不得按「含 `#`」粗判，否则听力卡会被误计入语法复习。
阅读短文 id：`rd-` 前缀并含级别段（如 `rd-a1-park`、`rd-a2-camping`、`rd-b1-umzug`），唯一；不新增 SRS 卡类型——「加入学习」直接复用词汇卡 id（vid）。

## 8. 标准操作流程（SOP）

### 8.1 新增词汇主题

1. 在对应级别的 `data/vocabulary*.js` 中追加主题对象，**严格检查 id 前缀**。
2. 在 `tools/gen_zine_covers.py` 的 `THEME_PROMPTS` 中为主题补充中文提示词（如不需要重新生成封面可跳过）。
3. 运行测试：`npm test`。
4. 重新生成该主题封面：`python tools/gen_zine_covers.py`（如已存在则自动跳过；需强制重跑时加 `--force`）。
5. 重新生成音频：`python tools/generate_audio.py`（已存在文件自动跳过，可断点续跑）。
6. 补充词条配图：`python tools/fetch_images.py`。
7. 提交：一个 `feat(data)` 提交放数据改动；一个 `chore(tools)` 或 `assets(audio/images)` 提交放生成的资源与 manifest 更新。

### 8.2 新增语法专题

1. 在对应级别的 `data/grammar*.js` 中追加专题对象，**严格检查 id 前缀**。
2. 每专题至少 5 道练习题；`choice` 题必须提供 `opts` 与合法 `a` 索引，`fill` 题必须提供 `a`。
3. 运行测试：`npm test`。
4. 提交：`feat(data): 新增 B1 语法专题 g-b1-xxx`。

### 8.3 新增阅读短文（S8 内容生产流程）

1. 在 `data/reading_texts.src.js` 追加手写短文对象：`{ id: 'rd-<级别>-<slug>', title, level, theme, text }`（`\n\n` 分段），**严格检查 `rd-` 前缀与级别段**；篇幅 A1 60–90 词 / A2 80–120 / B1 120–150，超纲词 ≤10%，题材与既有短文、听力对话不雷同。
2. 内容过审后才跑管道（沿用 S7 机制：LLM 草稿 → SLA 视角 reviewer 审级别适配/自然地道/文化准确）。
3. 分词与归并：`python tools/build_reading_tokens.py` → 生成 `data/reading.js`；脚本打印映射报告，**逐词核对** lemma 归并与 vid 匹配（未决词补脚本头部 `LEXICON_OVERRIDES` 至零），库外词 gloss 质量优先。
4. 朗读音频：`python tools/generate_reading_audio.py [--limit N] [--ids id1,id2]`（整篇单文件 `de-DE-KatjaNeural` 默认语速 → `audio/reading/<id>.mp3`，断点续跑；manifest 自动新增/更新 `AUDIO_READING` 行）。
5. 运行测试：`npm test`（数据完整性：20 篇/id/级别分布/token 规则/words 计数/vid 可解析/AUDIO_READING 一一对应）。
6. 提交：一个 `feat(data)` 提交放手写层与生成数据；一个 `assets(audio)` 提交放音频与 manifest 更新。

### 8.4 重新生成音频 / 图片 / 音标

- **音频**：`python tools/generate_audio.py`（不耗 API key，但调用 edge-tts 网络服务，耗时较长；已生成文件自动跳过）。重写 manifest 时自动保留 `AUDIO_NATIVE` 行。
- **对话行音频**：`python tools/generate_dialog_audio.py [--limit N] [--ids id1,id2]`（分角色 edge-tts：A = `de-DE-KatjaNeural`、B = `de-DE-ConradNeural`，默认语速 1.0；逐行 → `audio/dialog/<id>-<行号>.mp3`，manifest 自动新增/更新 `AUDIO_DIALOGS` 行）。
- **阅读整篇朗读**：`python tools/generate_reading_audio.py [--limit N] [--ids id1,id2]`（整篇单文件 edge-tts `de-DE-KatjaNeural` 默认语速 → `audio/reading/<id>.mp3`，断点续跑；manifest 自动新增/更新 `AUDIO_READING` 行）。
- **真人发音**：`python tools/fetch_native_audio.py [--limit N] [--ids id1,id2]`（经 de.wiktionary 定位 Wikimedia Commons 真人录音；依赖 curl 与 ffmpeg；断点续跑）。
- **音标**：`python tools/fetch_ipa.py [--limit N] [--force]`（de.wiktionary `{{Lautschrift}}` → `data/ipa.js`；wikitext 有磁盘缓存，重跑便宜；全量结果少于现有条目数时拒写，需 --force 强制）。
- **主题封面**：`python tools/gen_zine_covers.py [--force]`（需 Seedream API key，zine 纸感风格）。
- **词条配图**：`python tools/fetch_images.py [--limit N]`（无需 API key，依赖外部图库可用性）。
- **更换问题配图**：`python tools/fetch_images.py --ids <id,...> --candidates 6` 抓候选到 `images/candidates/`（不碰正式目录），审核选择写入 `images/candidates/choices.json` 后 `python tools/finalize_images.py` 落盘；选 `"none"` 则删除该词配图。

### 8.5 发布时更新 PWA 离线壳

1. **`sw.js` 的 `CACHE` 版本号随发布递增**：形如 `deutsch-zine-vX.Y.Z`，与 `package.json` 的 `version` 保持一致。`activate` 只按 `deutsch-zine-` 前缀删旧缓存——版本号不递增，老用户拿到的仍是旧壳。
2. **同步 `CORE` 预缓存清单**：`index.html` 静态加载的每个文件都必须在 `CORE` 里（`js/bundle.js`、`data/*.js`、`audio/manifest.js`、`images/manifest.js` 等）。漏加不会报错（`Promise.allSettled` 逐个容错 + 运行时 CacheFirst 兜底），但该文件在首次离线访问时会缺失。
3. **图标与清单改动后核对**：图标重新生成用 `python tools/gen_icons.py`（源图 `images/zine/hero.png` → `images/icons/` 的 192 / 512 / maskable-512，产物勿手改）；改 `manifest.webmanifest` 的 `icons` 后确认条目与实际文件一一对应。

### 8.6 变格专项与语境填空（内容是从既有数据派生的）

- **语境填空（`src/cloze.js`）零新内容**：句源全部来自既有数据——`data/vocabulary*.js` 的词条例句、`data/listening.js` 的对话行、`data/reading.js` 的阅读句；挖空目标就是句中命中的词库词。新增内容时不需要为它写任何东西，但也因此**不要**指望改文案就能出题：目标词级别受当前级别限制，对话/阅读句只挖「已学」（`srs` 里有卡）的词，一句都没有命中就跳过该句。
- **变格专项（`data/declension.js`）是这一层唯一手写的内容**：新专题必须 `dc-` 前缀，`choice` 的 `opts`/`a` 索引与 `fill` 的字符串 `a` 都要合法，`tip` 不可空；错题卡 id 用 `dc-{topicId}#{index}`，**不要**新增卡类型或改 `isGrammarCardId`（`dc-` 且含 `#` 天然命中语法队列）。
- **判分都写回既有卡**：变格题写 `dc-` 卡（复用语法 SRS 队列 + 错题本「变格」分支）；阅读/听力页「练一练」写目标词卡（对 `review 2` / 错 `review 0`），不新建卡、不写错题本；复习池里的语境填空与其他题型一样计入词卡的错题与再练队列。

> 注意：`audio/manifest.js` 由 `generate_audio.py`、`generate_dialog_audio.py` 与 `generate_reading_audio.py` 自动维护（各脚本只重建自己负责的键，其余清单行原样保留），`audio/credits_native.json`、`images/manifest.js`、`images/icons/`、`data/ipa.js`、`data/reading.js` 由各脚本自动生成，**请勿手改**。
