# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [Unreleased]

无。

## [3.0.0] - 2026-08-31

### Added
- 使用 esbuild 搭建构建管道（`scripts/build.mjs`），支持 watch / 生产构建 / sourcemap / minify。
- 将 `js/` 业务代码迁移为 `src/` ESM 模块，构建产物为单文件 IIFE `js/bundle.js`。
- 内容生产管道工程化：
  - `tools/requirements.txt` 锁定 `edge-tts`、`httpx`、`python-dotenv` 版本。
  - 消除 `E:\LabX\backend\.env` 等硬编码路径，统一读取项目根 `.env`。
  - 新增 `.env.example` 配置模板。
  - 新增 `tools/README.md` 说明每个脚本的用途、用法、产物与运行顺序。
- 新增 `AGENTS.md` 项目约定速查与 `CHANGELOG.md` 历史条目回填。

### Changed
- `index.html` 入口切换为 `js/bundle.js`。
- `README.md` 同步功能清单与文档索引。

## [2.1.0] - 2026-08-31

### Added
- 语法错题纳入 FSRS 间隔重复调度，新增 `#/review-grammar` 语法复习入口。
- 存储层升级：浏览器端以 IndexedDB 为主存，保留 localStorage 镜像并支持旧数据迁移。
- 按级别懒加载 A2/B1 数据并重建词汇索引，防御跨级别复习依赖错乱。

### Fixed
- `stripArticle` 不再把 `zu/to` 当冠词剥离，避免 `zu Hause` 类答案被误判。
- `save()` 在 `ready()` 完成前不落盘，补齐 300ms 自动落盘测试。
- 仪表盘 due 计数排除语法卡；启动失败回退不落盘。

## [2.0.0] - 2026-08-24

### Added
- A2 / B1 全量内容扩展：全站 38 个主题、1945 个核心词、36 个语法专题。
- 图片辅助学习：
  - 38 张 Seedream 统一风格主题封面。
  - 1092 张来自 Wikimedia Commons / Openverse 的免费授权词条配图。
- 全站音频：1945 词 + 例句预生成本地 mp3。

## M3 - 2026-08-23

### Added
- B1 内容：14 个主题、715 个词、14 个语法专题。
- 全站累计 38 主题、1945 词、35 语法专题。

## M1+M2 - 2026-08-23

### Added
- 级别框架：A1 / A2 / B1 切换、分级过滤、成就动态化。
- A2 内容：12 个主题、612 个词、12 个语法专题。

## [1.2.0] - 2026-08-23

### Added
- 学新词改为百词斩式流程：预览分流（认识/不认识）→ 看词选义 → 听音选词 → 拼写检验 → 组末小结。
- 变位表每行配标准音频。

### Fixed
- 修复变位导航高亮问题。

## [1.1.0] - 2026-08-23

### Added
- 标准德语音频：使用 edge-tts 为全部单词与例句生成本地 mp3。
- FSRS 间隔重复算法（Anki 同款）。
- 连胜日历与冻结券。
- 成就徽章系统。
- 听写题型。
- 动词变位查询工具。

## [1.0.0] - 2026-08-23

### Added
- 德语 A1 学习站初始版本：618 词、12 主题、10 语法专题、间隔复习、错题本、设置。

[Unreleased]: https://github.com/yourname/deutsch-lernen/compare/v3.0...HEAD
[3.0.0]: https://github.com/yourname/deutsch-lernen/compare/v2.1...v3.0
[2.1.0]: https://github.com/yourname/deutsch-lernen/compare/v2.0...v2.1
[2.0.0]: https://github.com/yourname/deutsch-lernen/compare/v1.2...v2.0
[1.2.0]: https://github.com/yourname/deutsch-lernen/compare/v1.1...v1.2
[1.1.0]: https://github.com/yourname/deutsch-lernen/compare/v1.0...v1.1
[1.0.0]: https://github.com/yourname/deutsch-lernen/releases/tag/v1.0
