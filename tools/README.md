# 内容生产管道（tools/）

本目录存放用于批量生成音频、配图、主题封面的 Python / Node 脚本。所有脚本均从项目根目录 `.env` 读取配置（`python-dotenv`），不再使用任何硬编码路径。

## 安装依赖

```bash
pip install -r tools/requirements.txt
```

依赖清单（已锁定版本）：

- `edge-tts==7.2.8` —— 生成德语音频
- `httpx==0.28.1` —— HTTP 请求（生图 API、Wikimedia / Openverse）
- `python-dotenv==1.2.2` —— 统一读取项目根 `.env`

## 配置

复制 `.env.example` 为项目根 `.env`，按需填入真实密钥：

```bash
cp .env.example .env
```

当前仅 `tools/gen_zine_covers.py`（经 `tools/seedream_client.py`）需要 Seedream API key：

- `SEEDREAM_API_KEY`：火山引擎 Ark API key
- `SEEDREAM_API_BASE`：默认 `https://ark.cn-beijing.volces.com/api/v3`
- `SEEDREAM_MODEL`：默认 `doubao-seedream-5-0-pro-260628`

## 脚本清单

### `seedream_client.py`

- **用途**：Seedream（火山引擎 Ark）生图客户端，提供 `generate(prompt, out_path)`。
- **依赖**：`httpx`、`python-dotenv`
- **调用方**：被 `gen_zine_covers.py` 导入；也可命令行调试：
  ```bash
  python tools/seedream_client.py "一只橘猫在读书" test.png
  ```
- **产物**：指定路径的 PNG 图片。

### `gen_zine_covers.py`

- **用途**：当前封面生成工作流——为全部词汇主题生成 **muted zine 纸感风格**封面（2:3 竖版，38 张），并生成装饰刊头插画（`images/zine/*.png`）。
- **依赖**：`seedream_client.py`（需 `.env` 中 Seedream API key）；从 `gen_covers.py` 导入 `load_themes()` / `update_manifest()`。
- **用法**：
  ```bash
  python tools/gen_zine_covers.py              # 跳过已存在文件，补齐缺失项
  python tools/gen_zine_covers.py --force      # 强制重新生成全部封面与装饰图
  python tools/gen_zine_covers.py --only greet,time  # 只跑指定主题 id
  ```
- **产物**：
  - `images/covers/<themeId>.png`
  - `images/zine/*.png`（刊头 / 空状态装饰插画）
  - 更新 `images/manifest.js` 中的 `window.IMAGE_COVERS`
- **注意**：`images/manifest.js` 由本脚本（经 `gen_covers.py` 的 `update_manifest()`）与 `fetch_images.py` 自动更新，**请勿手改**。

### `gen_covers.py`

- **用途**：**依赖模块，不再直接用于生成封面**。现作为 `gen_zine_covers.py` 的公共库保留，提供 `load_themes()`（读取主题清单）与 `update_manifest()`（写 `images/manifest.js`）。
- **说明**：历史上它是旧风格封面的生成入口；v4（muted zine）起封面生成请用 `gen_zine_covers.py`。直接运行本脚本会按旧风格重新生成封面，请勿执行。

### `fetch_images.py`

- **用途**：为具体名词从 Wikimedia Commons（主）/ Openverse（备）抓取免费授权配图。
- **依赖**：`httpx`
- **用法**：
  ```bash
  python tools/fetch_images.py         # 默认上限 800 张
  python tools/fetch_images.py --limit 400
  python tools/fetch_images.py --ids clothes-18,food-20   # 定向重抓指定词（忽略已存在，强制覆盖）
  python tools/fetch_images.py --ids clothes-18 --candidates 6  # 候选模式：每词抓至多 6 个候选
  ```
- **候选模式**：候选落盘 `images/candidates/<id>/<k>.jpg` + `meta.json`（含授权信息与查询来源），**不触碰**正式目录与 manifest；查询合并「纯德语词」与「德语词 + 中文释义」两路，供人工/视觉审核挑选后由 `finalize_images.py` 落盘。
- **产物**：
  - `images/words/<id>.jpg`
  - `images/credits.json`（每张图的来源、作者、许可证、来源页）
  - 更新 `images/manifest.js` 中的 `window.IMAGE_WORDS`
- **注意**：`images/manifest.js` 由本脚本与 `gen_zine_covers.py` 自动更新，**请勿手改**。

### `finalize_images.py`

- **用途**：把候选审核结果落盘——读 `images/candidates/choices.json`（`{"<id>": 候选序号k 或 "none"}`）。
- **行为**：选 k → 候选覆盖到 `images/words/<id>.jpg` 并写 credits；`"none"` → 删除该词旧图与 credits 条目（前端不再显示图）；全部处理后按磁盘实况重建 `IMAGE_WORDS`，并把 choices.json 改名 choices.done.json 防重跑。
- **用法**：
  ```bash
  python tools/finalize_images.py
  ```

### `generate_audio.py`

- **用途**：为全部单词、例句、变位表形式生成标准德语音频（edge-tts，Katja 语音）。
- **依赖**：`edge-tts`
- **用法**：
  ```bash
  python tools/generate_audio.py
  ```
- **产物**：
  - `audio/word/<id>.mp3`
  - `audio/sent/<id>.mp3`
  - `audio/conj/<verb>-<idx>.mp3`
  - 生成/更新 `audio/manifest.js`（`window.AUDIO_WORDS` / `window.AUDIO_SENTS` / `window.AUDIO_CONJ`）
- **注意**：`audio/manifest.js` 由本脚本自动生成，**请勿手改**。
- **断点续跑**：已存在且非空的 mp3 会自动跳过；失败条目会在下次运行时重试。

### `generate_dialog_audio.py`

- **用途**：为听力小对话（`data/listening.js` 的 `window.LISTEN_DIALOGS`）逐行生成德语音频，分角色音色：A = `de-DE-KatjaNeural`（女声），B = `de-DE-ConradNeural`（男声），默认语速 1.0（不在生成端减速，保「原生、地道、清晰」，播放变速交给前端）。
- **依赖**：`edge-tts`
- **用法**：
  ```bash
  python tools/generate_dialog_audio.py                # 全量（20 组 × 各行）
  python tools/generate_dialog_audio.py --limit 1      # 只跑前 1 组（小样本验证）
  python tools/generate_dialog_audio.py --ids dl-a1-greet,dl-b1-health  # 定向重跑指定组
  ```
- **产物**：
  - `audio/dialog/<dialogueId>-<lineIndex>.mp3`（lineIndex 从 0 起，逐行一个文件；不做整组拼接）
  - 更新 `audio/manifest.js` 的 `window.AUDIO_DIALOGS`（`{ 对话 id: 从第 0 行起连续可用的音频文件数 }`；全部生成成功时即等于对话行数）
- **注意**：`audio/manifest.js` 中 `AUDIO_WORDS / AUDIO_SENTS / AUDIO_CONJ / AUDIO_NATIVE` 四行按原文件逐行保留不变，`AUDIO_DIALOGS` 由本脚本维护，**请勿手改**。
- **断点续跑**：已存在且非空的 mp3 自动跳过；请求间隔 ≥1 秒；单行失败自动重试 2 次，结束时打印失败行清单与逐组抽查清单（`[ok] 级别 id: 可用行数/总行数`）。
- **操作提醒**：`tools/generate_audio.py` 目前只保留 `AUDIO_NATIVE` 行，重跑它会丢掉 `AUDIO_DIALOGS` 行；重跑后需再执行一次本脚本恢复（保留逻辑待后续任务补上）。

### `dump_conj.js`

- **用途**：导出变位音频生成清单（JSON 到 stdout），覆盖全部内置不规则动词与常用规则动词。
- **依赖**：Node.js；动态导入 `src/conjugate.js`（ESM），输出 ASCII 安全（非 ASCII 转 \uXXXX，防 Windows 中文 locale 乱码）
- **用法**：
  ```bash
  node tools/dump_conj.js
  ```
- **产物**：stdout 输出 JSON 数组，例如 `[{"verb":"sein","idx":0,"text":"bin"}, ...]`。
- **说明**：通常不需要单独运行；`generate_audio.py` 会在内部调用它。

## 标准运行顺序

在内容数据（`data/vocabulary*.js`、`data/grammar*.js`）更新后，按以下顺序重新生成资源：

1. **音频**（无需 API key）：
   ```bash
   python tools/generate_audio.py          # 词汇 / 例句 / 变位
   python tools/generate_dialog_audio.py   # 听力小对话逐行音频（分角色）
   ```
   > 注意顺序：先 `generate_audio.py`、后 `generate_dialog_audio.py`，否则 `AUDIO_DIALOGS` 行会被覆盖掉。

2. **主题封面**（需要 Seedream API key）：
   ```bash
   python tools/gen_zine_covers.py
   ```

3. **词条配图**（无需 API key，依赖网络与外部图库）：
   ```bash
   python tools/fetch_images.py
   ```

第 2、3 步相互独立，可交换顺序；第 1 步也可单独执行。
