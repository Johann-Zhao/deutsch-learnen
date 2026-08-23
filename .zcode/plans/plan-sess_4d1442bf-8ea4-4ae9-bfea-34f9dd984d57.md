# 德语学习站 A2/B1 扩展 + 图片辅助计划

## 一、范围（按用户确认）

1. **内容扩展到 A2、B1（完整版）**
   - A2：12 主题 ≈600 词 + 12 个语法专题
   - B1：14 主题 ≈700 词 + 14 个语法专题
   - 加上 A1 共 ≈1900 词、38 主题、36 语法专题
2. **图片辅助**
   - **词条图片**：优先全网搜索 —— 用 Wikimedia Commons API（主）+ Openverse API（备）按词义搜索下载免费授权图片，存 `images/words/<主题id-序号>.jpg`，授权信息记录 `images/credits.json`（标题/作者/许可证/来源），README 注明
   - **主题封面**：调用 LabX 封装的 seedream API（`E:\LabX\backend\.env` 的 key，仿照 `E:\LabX\backend\scripts\seedream_gen.py` 的封装拷贝到本项目 `tools/seedream_client.py`），38 张统一风格的扁平插画封面（无文字、无水印），存 `images/covers/`
3. **不做视频**（用户确认）

## 二、级别框架设计（M1）

- **数据层**：主题对象加 `level: 'A1'|'A2'|'B1'`；语法专题加 `level` 字段。新数据文件：`data/vocabulary_a2.js`、`data/vocabulary_b1.js`、`data/grammar_a2.js`、`data/grammar_b1.js`（主题 id 全局唯一：A2 用 `a2-*`，B1 用 `b1-*`，语法 id 用 `g-a2-*`/`g-b1-*`），index.html 按序追加 script 标签。词条保持单行 5 元素数组（音频脚本兼容）
- **存储**：`settings.level` 默认 `'A1'`，localStorage key 不变（老进度无损）
- **UI**：导航下方加 A1/A2/B1 级别切换条（词汇/语法/仪表盘共用）；仪表盘进度、每日新词计划、主题页、语法列表均按当前级别过滤；**复习队列不分级**（低级别到期词照常复习，符合记忆规律）
- **成就分级**：「本级 50/200 词」「本级全词汇」「本级语法全通」按当前级别动态计算
- **文案**：站名改「德语学习站」，清除 A1 硬编码（标题、README、备份文件名 `de-learn-backup-`）

## 三、A2 内容（M2）

- **语法 12 专题**：Präteritum（过去时 war/hatte + 常规）、Adjektivendungen（形容词词尾四格）、Komparativ/Superlativ、反身代词 sich、第三格动词汇总（helfen/gefallen…）、weil/dass/ob 从句、简单关系代词 der/die/das、Futur I、N-Deklination（弱变化名词）、方向介词双小结（Wechselpräpositionen 复习+in/an/auf 深化）、不定代词 man/jemand/niemand、副词与时间表达（schon noch/jetzt/damals）
- **词汇 12 主题**（每主题 50 词）：旅行与假期、职业与办公室、城市与公共设施、媒体与网络、情感与性格、自然与环境、节日与习俗、科技与家电、银行与信件往来、教育与培训、运动与健身、住房与搬家

## 四、B1 内容（M3）

- **语法 14 专题**：Konjunktiv II（虚拟与礼貌）、Passiv 被动态（现/过）、条件与让步从句（wenn/falls/obwohl）、关系从句全解（介词+关系代词、was/wo）、Genitiv 与第二格、动介搭配（sich freuen auf 等）、间接引语基础（sagen, dass…）、Nominalisierung 名词化、Partizip I/II 作定语、Konnektoren 逻辑连接词全家、形容词名词化、构词法（前缀/复合词）、常用强变化动词表、Futur II 与猜测表达（wohl/wahrscheinlich）
- **词汇 14 主题**（每主题 50 词）：工作与职业发展、经济与消费、媒体与舆论、环境与能源、大学与研究、健康与心理、社会与移民、数字化与人工智能、文化与艺术、欧洲与国际、文学与写作、法律与秩序、日常地道表达（口语搭配）、学术与正式书面语

## 五、音频（M4）

`tools/generate_audio.py` 改为扫描 `data/vocabulary*.js` 全部文件，生成 A2/B1 ≈2600 个 mp3（词+例句，edge-tts Katja，并发 5，后台运行约 20-30 分钟），manifest.js 自动合并。变位音频不变。

## 六、图片管线（M5）

1. `tools/seedream_client.py`：仿 LabX 封装（httpx、b64 落盘、尺寸回退、重试、`output_format: png`、prompt 加「无文字无水印」后缀）；`tools/gen_covers.py` 串行 + 1.5s 间隔生成 38 张主题封面（1024×1024 扁平插画风格统一）
2. `tools/fetch_images.py`：遍历三级词条，筛选**具体名词**（水果、家具、交通、动物等可视词，预置词性+语义白名单），Wikimedia Commons `generator=search`（File 命名空间、mime 过滤 jpeg/png、尺寸>400px）优先，失败回退 Openverse API；串行 0.3s 间隔，下载到 `images/words/`，写 `images/credits.json`；无合适结果的词自动跳过（预期覆盖率 50-70%，宁缺毋滥）
3. **前端**：生成 `images/manifest.js`（`window.IMAGE_WORDS` Set 清单 + `window.IMAGE_COVERS`）；`wordCard()` 有图则显示（`<img class="word-img">`，约 220px 宽，懒加载）；主题列表项显示封面缩略图；CSS 加 `.word-img`（圆角、无文字背景色）
4. 不改词条数据格式（图片按 id 约定路径 + manifest 判断），对判分/复习/音频管线零侵入

## 七、测试与验收（M6）

- 单元测试改为动态断言（主题数≥32、词条 5 元素、语法专题≥32、id 全局唯一性校验新增）；新增级别过滤逻辑测试
- GUI 走查：级别切换、A2/B1 学新词（含图片卡片）、语法专题、仪表盘分级进度、音频 HTTP 抽查、图片显示
- README 全面更新（级别说明、图片来源与授权、生图脚本用法）

## 八、实施顺序与提交

M1 框架 → M2 A2 内容 → M3 B1 内容 → M4 音频（后台）→ M5 生图+图片（后台）→ M6 测试+GUI+README，每个里程碑一次 git 提交。内容数据编写量大（1300 词 + 2600 例句 + 26 个语法专题），按主题分批写入多个 data 文件。

## 九、风险

- seedream API 费用：38 张封面（用户已确认规模）
- Wikimedia 图片覆盖不全：可接受的降级（无图词正常显示纯文字卡）
- edge-tts 网络波动：脚本已支持断点续跑
- 内容体量大：若单次会话未完成，按里程碑分批提交，进度可见