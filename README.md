# 德语学习站 A1–B1

面向中文母语学习者的德语本地学习应用，覆盖 **A1 / A2 / B1** 三个级别。纯静态网页，无需安装、语音离线可用。

## 使用方法

用 Chrome 或 Edge 双击打开 `index.html` 即可。顶部右侧 **A1 / A2 / B1** 切换级别。

- **词汇**：38 个主题、1945 个核心词（A1 618 / A2 612 / B1 715），词条配图、例句与标准发音
- **学新词**：百词斩式流程 —— 预览分流（认识/不认识）→ 看词选义 → 听音选词 → 拼写检验 → 组末小结
- **复习**：FSRS 间隔重复（Anki 同款算法），五种题型（词性/听音/翻译/例句填空/听写）；复习队列跨级别（低级别到期词照常出现）
- **语法**：36 个专题（A1 10 / A2 12 / B1 14），中文讲解 + 交互练习
- **语法复习**：语法错题纳入 FSRS 间隔重复调度，独立的 `#/review-grammar` 入口
- **变位**：动词变位查询工具（30 个不规则动词内置，每行可听标准发音）
- **错题本 / 打卡 / 成就**：连胜日历 + 冻结券 + 分级成就徽章
- **存储**：浏览器端以 IndexedDB 主存，保留 localStorage 镜像并支持旧数据迁移
- **懒加载**：A2/B1 数据按级别动态加载，降低首屏开销并支持跨级别复习
- 进度保存在浏览器；换电脑前在「设置 → 导出进度」备份

## 图片说明

- **主题封面**（38 张）：由 Seedream（doubao-seedream-5-0-pro）生成的统一风格扁平插画。重新生成：`python tools/gen_covers.py`（API 配置读取项目根 `.env`，详见 `tools/README.md`）
- **词条配图**：来自 [Wikimedia Commons](https://commons.wikimedia.org/) 与 [Openverse](https://api.openverse.org/) 的免费授权图片（CC 系列或公有领域），仅用于本地学习。每张图的文件、作者、许可证与来源页记录在 `images/credits.json`。补充抓取：`python tools/fetch_images.py`
- 抓图脚本只处理具体名词并过滤抽象词，未命中即跳过 —— 部分词无图是正常降级

## 发音说明

全部单词与例句已用微软神经语音（Katja，[edge-tts](https://github.com/rany2/edge-tts)）预生成为本地 mp3；变位表 265 个形式同源。清单外文本回退系统 TTS（Windows 可装德语语音包改善）。重新生成：`pip install edge-tts` 后运行 `python tools/generate_audio.py`（支持断点续跑）。

## 开发

```bash
npm install         # 安装构建依赖（仅 esbuild）
npm run dev         # watch 模式构建 src/main.js → js/bundle.js
npm test            # 运行单元测试（算法、判分、数据完整性）
npm run build       # 生产构建（IIFE + ES2018 + sourcemap + minify）
```

> 说明：本项目当前仍处于 S2 工程化阶段。`src/main.js` 是构建入口占位，Task 6 迁移完成后将切换 `index.html` 引用 `js/bundle.js`；当前双击 `index.html` 仍沿用现有 `js/*.js`，行为不变。

结构：`data/` 内容数据（按级别分文件）、`js/` 逻辑与页面与构建产物、`src/` 未来 ESM 源码、`audio/` 语音、`images/` 配图、`tools/` 生成脚本、`DESIGN.md` 设计规范。

## 文档索引

| 文档 | 内容 |
|---|---|
| `DESIGN.md` | UI/UX 设计规范（色彩、词性色环、动效、文案底线） |
| `AGENTS.md` | 项目约定速查：目录结构、数据格式、命名约定、标准操作流程 |
| `CHANGELOG.md` | 版本历史与里程碑（Keep a Changelog 格式） |
| `tools/README.md` | 内容生产管道说明：脚本用途、运行顺序、产物位置 |
| `docs/技术调研与开发规划.md` | 技术选型、架构演进、学习逻辑调研 |
| `docs/plans/2026-08-30-s1-s2-实施计划.md` | S1 修补 + S2 工程化可执行计划 |

## 针对的痛点

| 痛点 | 方案 |
|---|---|
| der/die/das 记不住 | 全站词性配色（蓝/红/绿），练习强制选词性 |
| 变位与四格难 | 分级语法专题 + 变位查询工具 + 拼写检验 |
| 学了就忘 | FSRS 间隔重复 + 五种复习题型 |
| 不敢开口 | 全量真人级神经语音 + 听写题型 |
| 图文关联弱 | 词条配图 + 主题插画封面 |
