# Deutsch Zine · 德语学习志 —— 前端重构设计规范（S3）

> 日期：2026-09-06 · 分支：`phase/s3-zine-redesign` · 状态：已获用户批准
>
> 本文档是 S3 阶段前端重构的唯一设计依据。用户已明确批准：完全转向 muted zine 纸感美学，覆盖旧 DESIGN.md 中与之冲突的条款（禁米色纸底/衬线/金色装饰一条作废）；词性三色系统保留但低饱和化。学习逻辑（FSRS、判分、懒加载、存储、音频）一行不动。

## 0. 背景与输入

- 现有应用：纯静态德语学习站 A1–B1（vanilla JS + ESM + esbuild → `js/bundle.js`，hash 路由，IndexedDB 主存 + localStorage 镜像）。
- 风格依据：GitHub `moonlin1213/muted-zine-poster-v01` skill（muted zine 海报：旧纸、大面积留白、低饱和灰调、打字机/衬线微文本、拼贴锚点、印刷缺陷质感）。
- 素材：`Desktop/Cove前端 PNG 素材分享 01.pdf`（28 页金色/橄榄色天体、星座、哥特花窗、装饰边框 PNG，米色纸底），用 pdfimages + PIL 合成 alpha 提取为透明 PNG。
- 生图：项目已封装 `tools/seedream_client.py`（doubao-seedream-5-0-pro，`.env` 已配置，实测可用）。

## 1. 设计概念

把应用从"工具型网页"改造成**一本每天翻阅的德语学习杂志**：米色旧纸底、大面积留白、衬线大标题、打字机微文本、撕纸拼贴图像、金色天体/哥特装饰点缀。德语环境特色通过：德语微文本（日期、单词、短句）、Fraktur 风格首字母点缀、哥特花窗分章、星座/星月金色装饰体现。

## 2. 设计令牌

```css
--paper: #F2EDE3;        /* 米色旧纸底（叠加 CSS/SVG 噪点纹理） */
--card: #F8F5EC;         /* 卡片纸色 */
--ink: #26221B;          /* 主文字墨色 */
--ink-2: #6E675A;        /* 次级文字 */
--ink-3: #9A917F;        /* 微文本 */
--gold: #A88C4A;         /* 装饰金（与 Cove 素材同源） */
--line: #D8D0BE;         /* 墨线/分隔线 */
/* 词性功能色（低饱和，仅小面积功能用途） */
--m: #4A6FA5;  /* der */
--f: #A85B6E;  /* die */
--n: #4E7D5E;  /* das */
```

- 字体：标题衬线栈 `Georgia, "Noto Serif SC", "Songti SC", serif`；正文无衬线栈不变；微文本等宽 `“Courier New”, monospace`，小字号 + 大写 + 宽字距。
- 圆角收敛为 2–4px；间距维持 4/8px 网格；阴影仅允许极浅"纸影"（单层、低透明）。
- 词性色仅用于：名词色条/角标、例句目标词加粗、词性题对错反馈。禁止大面积彩色块。

## 3. 页面版式（桌面与移动同一套视觉语言）

1. **今日页**：杂志封面式。顶部打字机德语日期 + 衬线大标题"今日"；今日任务卡做成"本期导读"；数据统计为档案式统计栏；连胜日历为纸格点阵；成就为金色印章徽章（"盖下"动效可关）。
2. **词汇墙**：38 张 2:3 zine 封面组成的封面墙，按 A1/A2/B1 分辑；hover 轻微抬起 + 纸影。
3. **学习/复习流程**：居中单栏"卡片纸"（max-width 收敛）；选项为墨线边框按钮；反馈用低饱和词性色；拼写/听写输入框做练习本横线效果。
4. **语法页**：editorial 章节式，哥特花窗/星月 PNG 做分章装饰，讲解为杂志长文排版。
5. **变位/错题本/设置**：档案表格风（等宽字体表格、墨线分隔）。
6. **导航**：桌面保留顶栏（品牌 + 导航 + 级别切换），视觉纸感化；移动端新增底部 tab bar（今日/词汇/语法/变位/我的），顶栏精简为品牌 + 级别切换。

## 4. 图像系统

- **38 张主题封面重生成**：新增 `tools/gen_zine_covers.py`（复用 `seedream_client.py`），每主题按 skill Variation Engine 选不同版式（center-fragment / lower-left-float / upper-right-block / dot-orbit / single-specimen 等），主体与主题强相关（time=闹钟、family=餐桌、traffic=火车…），2:3 竖版纸感，含一个德语单词微文本。旧扁平风封面全部替换（`images/covers/*.png`），manifest 自动更新。
- **装饰插图约 6 张**：首页 hero、无到期复习空状态、语法章头、错题本空状态、设置页脚、移动端启动/欢迎图。存入 `images/zine/`。
- **Cove 提取**：`tools/extract_ornaments.py`（pdfimages 已有产物 + PIL 合成 smask alpha）产出透明 PNG 装饰件至 `images/ornaments/`，挑选可用件（边框、星月、星座、哥特窗）。
- 生图质量门：逐张目检，出现高饱和色块或跑题即按 skill 规则收紧 prompt 重生成一次；全部图目检合格才算完成。

## 5. 交互与动效

- 保留：卡片翻面、答题对/错反馈（≤300ms，尊重 `prefers-reduced-motion`）。
- 新增（克制）：封面 hover 抬起+纸影、路由切换淡入、成就印章盖下。全部可被 `prefers-reduced-motion` 关闭。
- 学习逻辑、数据格式、命名约定（AGENTS.md 第 7 节）全部不变。

## 6. 移动端

- 底部 tab bar：今日 / 词汇 / 语法 / 变位 / 我的（设置并入"我的"）。
- 沿用并落实既有规范：触控热区 ≥44×44px、`env(safe-area-inset-*)`、输入字号 ≥16px、`touch-action: manipulation`、375px 无横向滚动。
- 桌面/移动逐页截图对比验收，风格一致。

## 7. 工程与验证

- 分支：`phase/s3-zine-redesign`，完成后合并 main 并打 tag（建议 `v4.0`）。
- 代码：重写 `css/style.css`（设计令牌驱动，保持单 css 引用）；`src/views.js / vocabulary.js / grammar.js / conjugate.js / app.js / ui.js` 仅做模板与结构调整，不动算法；`index.html` 增加底部 tab bar 容器与必要 meta。
- 文档同步：重写 `DESIGN.md`（新视觉规范）、更新 `AGENTS.md`（SOP 增加 `gen_zine_covers.py` / `extract_ornaments.py`）、`CHANGELOG.md` 记 v4.0。
- 每步 `npm test` 保持绿色；`npm run build` 产出 `js/bundle.js`。
- 验收：本地 http server + 截图（桌面 1280px / 移动 375px）逐页目检：今日、词汇墙、学新词全流程、复习、语法章、变位、错题本、设置。
- 交付前自查清单：双端截图齐全、`npm test` 绿、bundle 已重建、manifest 已更新、无遗留 TBD、文档已同步。

## 8. 明确不做（YAGNI）

- 不换框架（React/Vue），不动后端/存储/算法。
- 不做 PWA 离线包（仅保留前置 meta，真正 PWA 属 S5）。
- 不为词条配图（1945 词）重生成，沿用现有 Wikimedia/Openverse 配图。
- 不做暗色模式。
