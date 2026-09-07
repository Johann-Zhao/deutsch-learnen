# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [Unreleased]

无。

## [4.2.0] - 2026-09-06

### Added
- **图片四选一题型**（百词斩式看图识词）：看词选图 2×2 网格，干扰图同主题优先、按释义去重；学新词加强阶段首题与复习题型池（约 40% 概率）接入；无图词自动回退文字题；新增 `src/imgquiz.js`。
- **渐进式提示**：图片题错 1 给释义、错 2 排除至 2 选 1、错 3 高亮答案；选择题错 1 给词性+首字母遮罩可重选、错 2 揭示答案；拼写错 1 首字母、错 2 半词、错 3 完整答案。
- **单词详情抽屉**：学习/练习/复习词卡可展开释义、例句（含朗读），动词附现在时六人称变位小表（复用变位模块）。
- **错词再练队列**：答错的词当次隔 3 题复现（批末/会话末队尾强制补齐），每词上限 2 轮，直至答对。
- 学新词页与今日页显示「今日新词 x/N」与「预计 X 天学完本级」。

### Changed
- 复习队列按遗忘曲线优化：verify 待验证卡与错词优先，其余按可提取度（retrievability）升序，而不是无序截取。
- 词性标签兼容非名词词性（动词/副词等显示中文词性角标），修复非名词词卡渲染崩溃。

### Fixed
- 图片题正确图参与洗牌（此前固定第 4 格可盲选）；正确图加载失败不再卡死题目。
- 图片题答对时反馈条正常显示（含「斩」转正确认）。
- 加强小结按词去重，再练词不再重复计数。

## [4.1.0] - 2026-09-06

### Changed
- 学新词流程重构为「5 词一批」：连续介绍 5 个词（每张词卡三个自评按钮），再对「不认识」的词集中加强练习（德→中、中→德选择题各一，各约 1/3 概率替换为听音变体 + 拼写检验），不再每词立即练习。
- 变位音频按当前 `src/conjugate.js` 变位表全量重新生成（251 个）。

### Added
- 介绍环节新增「斩」按钮：已经很熟的词封印卡片（`sealed`），永久移出复习；「认识」的词入 SRS 并标记待验证（`verify`），复习答对一次即转正为「斩」。
- 设置页「学习统计」新增已斩词汇计数。
- `tools/fetch_images.py` 新增 `--ids` 定向重抓与 `--candidates N` 候选模式（双路查询合并）；新增 `tools/finalize_images.py` 按审核选择落盘候选图。
- 词条配图全量视觉审核 1092 张（发现 583 张图词不符，根因为配图管道下标偏移 bug，已修复）；经两轮「候选抓取 + 视觉选题」：509 张原图验证保留、324 张换新并逐张验证、259 张无合适候选的错图移除（宁缺毋滥，前端自动不显示）。

### Fixed
- 变位页点击播放音频内容错误：`tools/dump_conj.js` 改读 `src/conjugate.js`（此前读已不存在的 `js/conjugate.js` 且 CJS/ESM 冲突，致旧音频与界面脱节）；输出转 ASCII 安全，修复中文 locale 下变元音文件名乱码。
- `REGULAR_WITH_AUDIO` 移除与 IRR 重复的 kommen/trinken；变位表朗读按钮的回退文本与 aria-label 不再混入 🔊。

## [4.0.0] - 2026-09-06

### Changed
- 全站视觉重构为 **muted zine 纸感**（v4 设计规范，见 `DESIGN.md`）：
  - 设计令牌：米色旧纸 `#F2EDE3` 底 + 纸纹噪点、衬线标题、打字机微文本、装饰金 `#A88C4A`。
  - 词性色换为低饱和三色（der `#4A6FA5` / die `#A85B6E` / das `#4E7D5E`），仅小面积功能性使用。
  - 组件纸卡化：墨线按钮、印章徽章、档案表格（变位/错题/设置）、editorial 语法章节（章头装饰 + 衬线讲解）。
  - 词汇主题列表改为 zine 封面墙（2:3 封面 + 微文本进度）；今日页杂志封面化。
  - 移动端固定 tab bar（今日/词汇/语法/变位/我的，≤768px 启用）。
- `DESIGN.md` 全文重写为 v4 muted zine 规范（旧的"中性冷白/禁止暖米色衬线"条款作废）。

### Added
- 38 张主题封面与 6 张装饰插画按 zine 纸感风格重生成（Seedream 5.0 pro），新增 `images/zine/`（刊头/空状态插画）。
- `tools/gen_zine_covers.py`（zine 风封面生成）与 `tools/extract_ornaments.py`（从 Cove 素材提取装饰），新增 `images/ornaments/`。
- `tools/shot.mjs`：Playwright 双端截图验收脚本（overflowX 与 jsErrors 断言）。
- 交付验收：`shots/final_*.png` 10 路由 × 1280/375 双端截图全量通过。

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
