# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [Unreleased]

无。

## [4.6.1] - 2026-09-27

### Fixed
- **已有卡答错时稳定度反而增长、到期日被推后**：`review()` 对所有评分共用「回忆成功」的稳定度增长公式，漏了 FSRS-4.5 的遗忘公式。后果是已学过（`reps>0`）的卡答错后稳定度不降反升——实测「3.71 天 → 13.20 天」、到期日从当天推到 13 天后，与「答错明天再见」的产品语义相反。现按 FSRS-4.5 遗忘公式 `S' = w11·D^−w12·((S+1)^w13−1)·e^(w14·(1−R))` 更新稳定度（用默认权重 W[11..14]）：成熟卡答错后稳定度明显回落（上例 3.71 天 → 1.45 天、次日到期），已贴近 0.1 天下限的卡则维持在 1 天以内、当天再见（下限处数值可能微升，不影响当天到期的语义）；「模糊 / 认识 / Easy」三个评分分支与首评路径的行为不变。连带效果：答错后稳定度掉到 21 天阈值以下时 `mastered` 由 true 回到 false（忘了就不算掌握），已斩（`sealed`）的卡不受影响。
- **字段缺失/迁移的卡评分后产生 `NaN`**：首评判定由 `reps === 0` 改为 `!(reps > 0)`，`reps` 为 `undefined`/`NaN` 的卡（旧存档、外部写入）不再误走非首评分支算出 `NaN` 稳定度与 `'NaN-NaN-NaN'` 到期日；`migrate()` 为 SM-2 遗留卡补 `reps`/`lapses` 兜底（迁移卡视为已复习过 1 次），不再出现 `reps: NaN` 被持久化。

## [4.6.0] - 2026-09-27

### Added
- **语境填空**（零新内容）：句源全部取自既有数据——1945 条词条例句 + 100 行听力对话 + 20 篇阅读短文句，挖空目标词做四选一，题干附中文与整句朗读，两级渐进提示（错 1 提示可重选、错 2 揭示答案）；复习题型池约 25% 概率混入（有图词优先出图片题，图片题不被挤占）；阅读页与听力对话页底部新增「练一练」入口（用本篇/本组句源出 5 题封顶）；判分回写目标词卡 SRS（首答对 `review 2`、答错 `review 0`），不新建卡类型。新增 `src/cloze.js`。
- **变格词尾专项**：6 个专题 50 题（定冠词、不定/否定冠词、形容词词尾、代词、弱变化名词、介词搭配），专题 id 一律 `dc-` 前缀；答错按卡 id `dc-{topicId}#{题号}` 入语法复习队列，错题本单列「变格」分支并可直达专题「重练」；语法页置顶「变格训练」入口（`#/declension`）。新增 `data/declension.js` 与 `src/declension.js`。
- **PWA 离线壳**：新增 `manifest.webmanifest`（standalone、纸色主题 `#F2EDE3`）与 `sw.js`——安装期预缓存核心壳（首屏 + 数据文件），其余同源 GET 走运行时 CacheFirst 并按需写入，仅缓存 200 完整响应（Range 请求的 206 不入缓存）；可安装图标 192 / 512 / maskable-512（`images/icons/`，由 `tools/gen_icons.py` 自 hero 图派生）。`index.html` 在非 `file://` 协议下注册 SW。

### Fixed
- 复习池选择题首次答错即调 `wrongFn()` 置 `answered`、揭示答案并出「下一个」，反馈条却又覆盖成「（再选一次）」——提示邀请的重选被挡死，渐进提示的第二级（错 2 揭示答案）实际不可达。现首错只提示并禁用该错项、可继续选，二错或首错后答对才计分（净语义仍是「首错即错」）。
- 练一练与复习池判分口径不一致：练一练里先错后对原按 `review 2` 计（等于洗白首错），现统一为「首错即错」——只有首答对记 `review 2`，先错后对与连错两次均记 `review 0`。
- 非名词词条（动词/形容词/副词等 509 词，占词库 26.2%）会被抽到「der/die/das？」词性题，而答案索引只对名词类 `{m,f,n,pl}` 有效——题必错，还平白写一次 lapses 进错题本。现以 `canAskGender` 守卫，非名词回退为「看德语选中文」。
- 语法复习页答错写错题本时类型写死 `grammar`，`dc-` 变格卡因此回退到语法分支渲染；现按卡 id 前缀定（`dc-` → 变格 / `listen-` → 听力 / 其余语法）。

## [4.5.0] - 2026-09-24

### Added
- **阅读 Tab**：20 篇分级短文（A1×8 / A2×7 / B1×5，LLM 草稿经「高级学习者 + 二语习得研究者」视角审核），正文逐词三态着色（已掌握 / 学习中 / 生词），点词弹卡（词形/lemma/词性/IPA/例句/发音），词库词一键「加入学习」直接入 FSRS（复用词汇卡 id，不新增卡类型），篇内生词率统计（>10% 提示偏难），每篇整篇 edge-tts 朗读（缺音频回退系统语音全文）。
- 新数据文件 `data/reading.js`（index.html 静态加载；作者手写层 `data/reading_texts.src.js` 经分词管道加工）；新管道脚本 `tools/build_reading_tokens.py`（预分词 + 词形归并 + 词库匹配 + 库外词释义）与 `tools/generate_reading_audio.py`（整篇朗读，断点续跑）；`audio/manifest.js` 新增 `AUDIO_READING` 清单。

### Changed
- 桌面侧栏与移动端 tab bar 新增第 7 项「阅读」（375px 实测七项不溢出，未触发「听读」合并回退）。
- `tools/generate_audio.py` 与 `tools/generate_dialog_audio.py` 重写 manifest 的保留逻辑通用化：解析旧 manifest 全部 `window.X = …` 行，仅重建本脚本负责的键，其余原样保留（S7 逐行枚举的教训，每加一类音频不再要改所有旧脚本）。

## [4.4.0] - 2026-09-21

### Added
- **听力 Tab**：20 组小对话理解（A1×8 / A2×7 / B1×5，LLM 草稿经 SLA 视角审核），每组分角色 edge-tts 音频（A = Katja / B = Conrad）逐行预生成；三级交互：盲听整组 → 看题作答（即时反馈 + 解析）→ 逐句精听。
- **听写强化**：复用现有听音/拼写题型与渐进提示，到期词优先、每次上限 20 词，评分照旧写词卡 SRS。
- **听力错题进 FSRS**：答错的对话理解题按 `listen-{dialogueId}#{qIndex}` 卡 id 入间隔重复，今日页与听力首页显示到期数，独立 `#/listen-review` 复习入口（重听整组再答）。
- 新数据文件 `data/listening.js`（index.html 静态加载）；新管道脚本 `tools/generate_dialog_audio.py`；`audio/manifest.js` 新增 `AUDIO_DIALOGS` 清单。

### Changed
- 语法到期过滤按前缀收窄（`g-` 且含 `#`）：听力卡 id 同样含 `#`，原先「id 含 `#`」的过滤会把听力卡误计入语法复习，现以 `isGrammarCardId` / `isListenCardId` 谓词区分两类（S7 规格 §6 关键集成点，测试锁定互斥）。
- 桌面侧栏与移动端 tab bar 新增第 6 项「听力」。

## [4.3.0] - 2026-09-08

### Added
- **真人发音**：经 de.wiktionary `{{Audio}}` 模板定位 Wikimedia Commons 真人录音（CC BY-SA/CC0），下载为 `audio/native/*.ogg`；播放回退链改为 真人发音 → edge-tts 预生成 → speechSynthesis。逐词署名见 `audio/credits_native.json`。
- **IPA 音标**：学新词卡片与单词详情抽屉显示标准德语 IPA（源自 de.wiktionary，`data/ipa.js`）；复习页不显示，避免提示效应。
- **0.5× 慢速朗读**：学新词、加强练习、复习的单词播放按钮旁新增「0.5×」按钮，一次性慢放该词，不影响全局语速设置。
- 设置页新增「音频与音标来源」署名卡片。
- 新管道脚本：`tools/dewikt.py`（de.wiktionary 共享访问，带磁盘缓存）、`tools/fetch_ipa.py`、`tools/fetch_native_audio.py`；`audio/manifest.js` 新增 `AUDIO_NATIVE` 清单。

### Changed
- `audio.playWord/playSentence/playConj` 支持一次性 `opts.rate`；`audio.hasWord` 覆盖真人发音词。
- `tools/generate_audio.py` 重写 manifest 时保留 `AUDIO_NATIVE` 行。

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

[Unreleased]: https://github.com/yourname/deutsch-lernen/compare/v4.4.0...HEAD
[4.4.0]: https://github.com/yourname/deutsch-lernen/compare/v4.3.0...v4.4.0
[3.0.0]: https://github.com/yourname/deutsch-lernen/compare/v2.1...v3.0
[2.1.0]: https://github.com/yourname/deutsch-lernen/compare/v2.0...v2.1
[2.0.0]: https://github.com/yourname/deutsch-lernen/compare/v1.2...v2.0
[1.2.0]: https://github.com/yourname/deutsch-lernen/compare/v1.1...v1.2
[1.1.0]: https://github.com/yourname/deutsch-lernen/compare/v1.0...v1.1
[1.0.0]: https://github.com/yourname/deutsch-lernen/releases/tag/v1.0
