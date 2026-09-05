# 设计规范（DESIGN.md）v4 · muted zine 纸感

本规范基于 Anthropic 官方 frontend-design skill 的方法论，结合德语学习场景制定。开发过程中所有 UI 决策以本文件为准。

> v4（2026-09-06）：全站视觉方向转向 **muted zine（米色旧纸杂志）**。项目 owner 已批准该转向，旧版"中性冷白 + 禁止暖米色衬线"条款作废，以本版为准。

## 1. 视觉方向：muted zine（米色旧纸杂志）

- **灵感来源**：旧杂志内页、档案卡片、打字机标签——纸的质感 + 墨的克制 + 一点装饰金。
- **底色**：米色旧纸 `#F2EDE3`（`--paper`），卡片用略亮纸色 `#F8F5EC`（`--card`），墨线 `#D8D0BE`（`--line`）。
- **纸纹**：body 背景叠一层极低透明度 SVG 噪点（feTurbulence data-URI），只在近看时可见，不抢内容。
- **字体**：标题用衬线栈（Georgia / Noto Serif SC / SimSun），正文用系统无衬线栈，微文本/标签用打字机等宽栈（Courier New）+ 字距拉开 + 全大写。
- **装饰金**：`#A88C4A`（`--gold`）仅用于印章、细线点缀等小面积装饰，不做大色块。

## 2. 设计令牌

| 令牌 | 值 | 用途 |
|---|---|---|
| `--paper` | `#F2EDE3` | 页面底色（米色旧纸） |
| `--card` | `#F8F5EC` | 卡片/纸卡底色 |
| `--ink` | `#26221B` | 主文字、墨线按钮底 |
| `--ink-2` | `#6E675A` | 次级文字、表格首列 |
| `--ink-3` | `#9A917F` | 微文本、弱化标签 |
| `--gold` | `#A88C4A` | 装饰金（印章、点缀线） |
| `--line` | `#D8D0BE` | 边框、分隔线 |
| `--m` | `#4A6FA5` | der 蓝（低饱和，功能性） |
| `--f` | `#A85B6E` | die 红（低饱和，功能性） |
| `--n` / `--ok` | `#4E7D5E` | das 绿（低饱和，功能性）/ 答对 |
| `--bad` | `#A85B6E` | 答错 |
| `--radius-s` | `3px` | 小圆角（按钮、选项、封面） |
| `--radius` | `4px` | 卡片圆角 |
| `--serif` | Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif | 标题 |
| `--sans` | "Segoe UI", "PingFang SC", "Microsoft YaHei", … | 正文 |
| `--mono` | "Courier New", ui-monospace, monospace | 微文本、拼写输入 |
| `--paper-shadow` | 0 1px 2px rgba(38,34,27,.06), 0 4px 14px rgba(38,34,27,.05) | 纸卡投影（唯一阴影） |

新组件必须引用令牌，不得内联色值；间距沿用 4/8px 网格。

## 3. 词性低饱和三色（全站唯一功能性色彩）

| 词性 | 颜色 | 色值 |
|---|---|---|
| der（阳性） | 蓝 | `#4A6FA5` |
| die（阴性/复数） | 红 | `#A85B6E` |
| das（中性） | 绿 | `#4E7D5E` |

- 三色是**功能性**色彩（词性角标、例句目标词、答题对错），一律小面积使用（角标、下划线、淡色底 8–10% 透明度），禁止大面积色块。
- 其余界面保持克制：主按钮用墨色（`--ink`），危险操作用低饱和红，成功反馈用低饱和绿。
- 答对/答错反馈复用 das 绿 / die 红，并保持同一套淡底样式。

## 4. 组件规范

- **纸卡 `.card`**：`--card` 底 + 1px `--line` 边 + `--radius` + `--paper-shadow`，padding 22px（小屏 16px），下边距 16px。学习/复习流程用 `.card.sheet`（max-width 680px 居中，`margin: 0 auto 16px`）。
- **墨线按钮 `.btn`**：墨色底、纸色字、1px 墨色边，`min-height: 44px`；`.btn-ghost` 透明底墨线边；hover 加深；disabled 降透明度。
- **封面墙 `.cover-wall`**：`repeat(auto-fill, minmax(148px, 1fr))`，封面 `aspect-ratio: 2/3`、`object-fit: cover`、1px 纸线边；标题衬线 14px，元信息用打字机微文本。
- **印章徽章 `.badge-seal`**：金色 1.5px 圆形镂空章（min 64×64px），锁定态虚线 + 35% 透明度；普通 `.badge` 为纸底墨线小胶囊。
- **档案表格 `.archive-table`**：折叠边框、表头打字机微文本大写（纸底），首列次级墨色 400，末列加粗。
- **章头 `.chapter-head` / 装饰图 `.hero-zine` / `.ornament`**：章头配哥特花窗等装饰插画（`images/ornaments/`），`hero-zine` 全宽刊头图（`images/zine/`）带纸卡投影；空状态 `.empty-art` ≤180px 居中，文案必须是行动邀请。
- **移动 tab bar `.tabbar`**：≤768px 启用，固定底部，含 safe-area 内边距；图标 + 微文本标签，激活态墨色加粗；`main` 底部 padding ≥ 84px 防遮挡。

## 5. 动效

- 所有动效 ≤300ms：颜色过渡 150ms、位移/投影 200ms、淡入 240ms、反馈 pop 250ms、印章落章 280ms。
- 全部动效包在 `@media (prefers-reduced-motion: no-preference)` 内，reduced-motion 下零动效。
- 禁止渐变、发光、无限循环动画；hover 反馈（封面微浮起等）属于同一条克制曲线。

## 6. 文案准则

- 按钮写明结果：「开始今日复习」而非「提交」
- 空状态是行动邀请：「今天没有到期复习，学几个新词？」
- 错误提示直接说明问题和解决方式，不道歉、不含糊
- 同一动作在流程中名称一致
- 微文本装饰（刊头标签、档案编号）用德语/拉丁字母大写，与正文中文区分层级

## 7. 质量底线

- 响应式适配至 375px 宽，无横向滚动
- 键盘焦点样式可见（2px 墨色 outline + offset）
- 文本对比度达到 WCAG AA
- 答案判定不区分大小写（句首大写除外需容忍），德语变元音正确处理

## 8. 移动端规范

为 PWA 做准备，所有页面必须在 375px 宽无横向滚动、无遮挡、可单手握持操作。

### 8.1 断点

- 基准断点：`max-width: 480px`（紧凑模式）；`max-width: 768px` 启用 tab bar、隐藏顶部 `.nav`；`max-width: 640px` grid 单列。

### 8.2 触控目标

所有可点击元素有效热区 ≥44×44px：tab bar 项、`.btn`、`.opt`、级别切换按钮、发音按钮、设置控件（`min-height: 44px` 或等效 padding）。允许纯文本链接、徽章、进度点等装饰/信息元素例外，但不得作为唯一操作入口。

### 8.3 安全区

- `viewport` meta 已加 `viewport-fit=cover`。
- `.topbar` 顶部内边距使用 `env(safe-area-inset-top, 0px)`；`.tabbar` 与 `main` 底部内边距使用 `env(safe-area-inset-bottom, 0px)`。

### 8.4 tab bar 约定

- 仅 ≤768px 显示；桌面端导航走 `.topbar .nav`。
- 五个主入口：今日 / 词汇 / 语法 / 变位 / 我的；当前路由激活态墨色加粗。
- `main { padding-bottom: calc(84px + safe-area) }` 保证最后一屏内容不被遮挡。

### 8.5 输入与排版

- 所有 `<input>`、`<select>`、`<textarea>` 字体大小 ≥16px，防止 iOS 聚焦时页面自动缩放。
- 小屏下卡片内边距 22→16px；标题字号随断点收敛，保证 375px 不溢出。

## 9. 结构即信息

- 所有数字（进度、掌握度、正确率）必须来自真实数据
- 不使用无意义的 01/02/03 编号装饰
- 印刷式层级：衬线大标题 → 正文无衬线 → 打字机微文本，一层都不能少
