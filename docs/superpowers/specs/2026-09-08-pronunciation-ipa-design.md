# S6 发音与音标增强 — 设计规格

> 上位文档：`docs/技术调研与开发规划.md`（§4.1 Wikimedia Commons 发音 / Kaikki IPA，§7.3 音频体积预算，§12 许可红线）。
> 决策记录（2026-09-08 与用户确认）：
> - 发音质量：真人发音 + TTS 兜底（不换 TTS 语音重制全库）。
> - 0.5x：词卡播放按钮旁加慢速按钮（学新词/加强/复习），不动全局语速设置。
> - IPA：仅学习场景显示（学新词卡片 + 详情抽屉），复习页不显示（避免提示效应）。
> - 子代理模型分工（仅本会话执行，不写 AGENTS.md）：简单任务 `deepseek/deepseek-v4.1-flash-expires-on-0910`，较难任务 `primary`。

## 1. 目标与范围

解决实测发现的"部分单词发音不标准、听不清"问题：

1. 学新词卡片与详情抽屉显示 IPA 音标。
2. 词卡提供 0.5x 慢速播放按钮。
3. 用真人发音替换可获取的单词音频，不可获取的保留 edge-tts 兜底。

**明确不做**：例句音频不换真人（无合规来源）；全局语速设置不变；不写 AGENTS.md；不动 SRS/存储。

## 2. 真人发音管道（`tools/fetch_native_audio.py`，新增）

### 2.1 数据源

**已实测验证（2026-09-08）**：Kaikki 逐词 JSON 端点不存在（404），改用 **de.wiktionary.org API**
（`action=parse&prop=wikitext`，数据与 Kaikki 同源自维基词典，CC BY-SA 相同）：
- 词条 wikitext 的 `{{Audio|De-X.ogg}}` 模板直接给出 Wikimedia Commons 发音文件名；
- Commons `imageinfo` API（`iiprop=url|extmetadata`）取下载 URL、许可与说话人署名。

许可：CC BY-SA / CC0，允许分发，须署名说话人（§12.1 已列为许可安全资源）。

### 2.2 流程

```
对全部 1945 词（读 data/vocabulary*.js，复用 tools/generate_audio.py 的 load_items）：
  1. 已存在 audio/native/<wordId>.ogg → 跳过（断点续跑）
  2. 查询词 = 去掉冠词 der/die/das/ein/eine/einen 与反身 sich 的词干
  3. de.wiktionary API 取 wikitext（redirects=1），抽取 {{Audio|...}} 模板：
     全部候选中优先第一个文件名不含空格的（词条本体发音优先于例句发音）
  4. Commons imageinfo API 取下载 URL / LicenseShortName / Artist
  5. 下载；ogg/oga 原样保存，其他格式用 ffmpeg 转 ogg（libvorbis q3，单声道 22050Hz）
  6. 产物：audio/native/<wordId>.ogg
  7. 署名：audio/credits_native.json（自动生成，勿手改）
     { wordId: { file, speaker, license, url } }
  8. 更新 audio/manifest.js：新增 AUDIO_NATIVE = { wordId: "native/<wordId>.ogg" }（自动生成，勿手改）
```

- 请求礼貌延迟 ≥0.5s；失败重试 2 次；查不到的词记录到日志，最终汇总「真人覆盖率 x/1945」。
- ffmpeg 已确认本机可用（v8.1.1）；脚本启动时 `shutil.which('ffmpeg')` 检查，缺失则明确报错退出。
- 命名沿用现有约定：wordId 即全局词汇卡 id（`{themeId}-{index}`）。

## 3. IPA 管道（`tools/fetch_ipa.py`，新增）

- 数据源：de.wiktionary.org API（CC BY-SA；Kaikki 逐词端点已验证不存在，维基词典同源替代）。逐词请求 `action=parse&prop=wikitext&redirects=1`，抽取 `{{IPA}}` 后首个 `{{Lautschrift|...}}` 作为标准德语读音（首个即通用读音，后续的 `{{reg.}}`/`{{Pl.}}` 变体忽略）。
- 输出 `data/ipa.js`（手写风格生成文件，头部注释「由 tools/fetch_ipa.py 自动生成，勿手改」）：

```javascript
window.WORD_IPA = window.WORD_IPA || {};
Object.assign(window.WORD_IPA, {
  "greet-0": "/ˈtaːk/",
  // ...
});
```

- 按全局词汇卡 id 键控；查不到 IPA 的词不写条目（前端不显示，宁缺毋滥）。
- `index.html` 静态加载 `data/ipa.js`（约 60KB，与 A1 数据同级，不参与懒加载）。

## 4. 前端改动

### 4.1 音频回退链（`src/audio.js`）

`playWord(id, de, opts)`：

1. `AUDIO_NATIVE[id]` 存在 → 播 `audio/native/<file>`；
2. 否则 `AUDIO_WORDS[id]` → 播 `audio/word/<file>`（现状）；
3. 否则 speechSynthesis 回退（现状）。

`opts.rate`（可选，一次性）：本次播放用 `playbackRate = opts.rate`，播完不影响全局 `rate`。`opts` 缺省时行为与今天完全一致。

### 4.2 IPA 显示（仅学习场景）

- 学新词介绍卡（`src/vocabulary.js` 介绍步）与详情抽屉：词下方显示 IPA，样式为打字机微文本（DESIGN.md 允许的字体系与中性色），格式 `/…/`。
- 复习页、图片题、拼写题**不显示**。
- `window.WORD_IPA[wordId]` 缺失时不渲染该元素。

### 4.3 0.5x 慢速按钮

- 位置：学新词介绍卡、加强练习题卡、复习词卡的播放按钮旁，小按钮「0.5×」（`UI.el` / `speakBtn` 同风格扩展，遵守 DESIGN.md 墨线按钮规范）。
- 行为：点击调用 `audio.playWord(id, de, { rate: 0.5 })`；只播该词，不影响例句与全局语速。
- 无 audio（连 speechSynthesis 都不可用）时按钮不渲染。

### 4.4 署名与致谢

- 设置页「学习统计」卡片下新增「音频与音标来源」小段：真人发音来自 Wikimedia Commons / Lingua Libre 贡献者（CC BY-SA，详见 `audio/credits_native.json`）；IPA 来自 de.wiktionary.org（CC BY-SA）。
- 满足 §12.1 对 CC BY-SA 数据「应用内署名并标明许可」的要求。

## 5. 数据与格式约束

- `data/vocabulary*.js`、`data/grammar*.js` 零改动（Global Constraint：只能扩展，不改结构）。
- `audio/manifest.js`、`audio/credits_native.json`、`data/ipa.js` 均为脚本自动生成，头部注明勿手改。
- 体积预算：native 音频 ogg q3 ≈ 每词 30–60KB；若覆盖 60%（约 1200 词）新增约 40–70MB，在可接受范围（纯本地项目，无网络分发压力）。

## 6. 测试（追加到 `tests/run.js`，沿用现有 runner）

- IPA 查找：`getWordIpa(id)` 类纯函数——存在返回字符串、缺失返回 null。
- 回退链选择：`pickWordAudio(id, {native, words})` 纯函数——native 优先、缺失回退 word、再缺失返回 null。
- 一次性 rate：`playWord` 的 opts.rate 不改变模块级 `rate`（状态断言）。
- 现有 57 项测试保持全绿。

## 7. 验收标准

1. 学新词卡片与详情抽屉可见 IPA（有数据的词）；复习页无 IPA。
2. 词卡「0.5×」按钮可慢放单词，全局语速设置不受影响。
3. `audio/native/` 有文件的词播放真人发音；其余词播放行为与现状一致。
4. 设置页有署名段；`credits_native.json` 覆盖所有 native 文件。
5. `npm test` 全绿；`npm run build` 成功；file:// 双击可用。
6. 管道脚本断点续跑：中断后重跑不重复下载。

## 8. 分支与提交

- 分支 `phase/s6-pronunciation`，从 main 新建；完成后合并回 main 打 tag `v4.3.0`。
- 提交规范沿用 `类型(范围): 中文描述`。
- 建议提交切分：`feat(tools)` 两个管道脚本 + 生成的 manifest/ipa 数据（`assets`）、`feat(audio)` 回退链与 rate 参数、`feat(views)` IPA 与慢速按钮 UI、`docs` spec/plan。

## 9. 与主线的关系

本功能与听力模块（原路线图 S3）并行：本功能先做（用户实测痛点），完成后接着出听力模块 spec。
