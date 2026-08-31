# AGENTS.md — 项目约定速查

> 面向未来维护本项目的人类或 AI 开发者。在做任何改动前，先读本文件；UI 细节以 `DESIGN.md` 为准。

## 1. 目录结构

```
德语学习项目/
├── index.html              # 应用入口（引用 js/bundle.js）
├── css/style.css           # 全站样式
├── js/                     # 浏览器可直接运行的脚本 + 构建产物
│   └── bundle.js           # esbuild 输出（IIFE，单文件）
├── src/                    # ESM 源码（构建入口 src/main.js）
├── data/                   # 内容数据（按级别分文件）
│   ├── vocabulary.js       # A1 词汇主题
│   ├── vocabulary_a2.js    # A2 词汇主题
│   ├── vocabulary_b1.js    # B1 词汇主题
│   ├── grammar.js          # A1 语法专题
│   ├── grammar_a2.js       # A2 语法专题
│   └── grammar_b1.js       # B1 语法专题
├── audio/                  # 预生成 mp3 与清单
│   ├── word/               # 单词音频
│   ├── sent/               # 例句音频
│   ├── conj/               # 变位音频
│   └── manifest.js         # 自动生成：AUDIO_WORDS / AUDIO_SENTS / AUDIO_CONJ
├── images/                 # 配图与封面
│   ├── covers/             # 38 张主题封面
│   ├── words/              # 词条配图
│   ├── credits.json        # 图片来源与授权信息
│   └── manifest.js         # 自动生成：IMAGE_WORDS / IMAGE_COVERS
├── tools/                  # 内容生产管道（Python / Node）
│   ├── requirements.txt
│   ├── README.md
│   ├── generate_audio.py
│   ├── fetch_images.py
│   ├── gen_covers.py
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

- **词性色环系统**：der 蓝 `#2456C6`、die 红 `#C42B5E`、das 绿 `#1B8A5A`；功能性色彩，非装饰。
- **禁止三套"AI 味"默认样式**（暖米色衬线、近黑荧光、报纸式布局）。
- **视觉方向**：中性冷白 `#F6F7F8`，系统无衬线字体，不用渐变/阴影堆叠。
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

词汇卡全局 id：`{themeId}-{index}`（如 `greet-0`、`a2-travel-5`）。
语法错题卡 id：`{topicId}#{exerciseIndex}`（如 `g-praesens#2`），含 `#`，与词汇 id 天然区分。

## 8. 标准操作流程（SOP）

### 8.1 新增词汇主题

1. 在对应级别的 `data/vocabulary*.js` 中追加主题对象，**严格检查 id 前缀**。
2. 在 `tools/gen_covers.py` 的 `THEME_PROMPTS` 中为主题补充中文提示词（如不需要重新生成封面可跳过）。
3. 运行测试：`npm test`。
4. 重新生成该主题封面：`python tools/gen_covers.py`（如已存在则自动跳过；需强制重跑时加 `--force`）。
5. 重新生成音频：`python tools/generate_audio.py`（已存在文件自动跳过，可断点续跑）。
6. 补充词条配图：`python tools/fetch_images.py`。
7. 提交：一个 `feat(data)` 提交放数据改动；一个 `chore(tools)` 或 `assets(audio/images)` 提交放生成的资源与 manifest 更新。

### 8.2 新增语法专题

1. 在对应级别的 `data/grammar*.js` 中追加专题对象，**严格检查 id 前缀**。
2. 每专题至少 5 道练习题；`choice` 题必须提供 `opts` 与合法 `a` 索引，`fill` 题必须提供 `a`。
3. 运行测试：`npm test`。
4. 提交：`feat(data): 新增 B1 语法专题 g-b1-xxx`。

### 8.3 重新生成音频 / 图片

- **音频**：`python tools/generate_audio.py`（不耗 API key，但调用 edge-tts 网络服务，耗时较长；已生成文件自动跳过）。
- **主题封面**：`python tools/gen_covers.py [--force]`（需 Seedream API key）。
- **词条配图**：`python tools/fetch_images.py [--limit N]`（无需 API key，依赖外部图库可用性）。

> 注意：`audio/manifest.js` 由 `generate_audio.py` 自动生成，`images/manifest.js` 由 `gen_covers.py` 与 `fetch_images.py` 自动更新，**请勿手改**。
