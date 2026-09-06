/* 导出变位音频生成清单（JSON 到 stdout）：
   [{"verb":"sein","idx":0,"text":"bin"}, ...]
   覆盖全部内置不规则动词 + 常用规则动词，idx 0-5 = 六个人称，6 = Perfekt
   输出去重后的清单（同一 verb-idx 只保留一条） */
const { irr, regularAudio, lookup } = (await import(new URL('../src/conjugate.js', import.meta.url).href)).Conjugate;

const out = [];
const seen = new Set();
function push(verb, idx, text) {
  const key = verb + '-' + idx;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ verb, idx, text });
}

Object.keys(irr).forEach(function (verb) {
  const e = irr[verb];
  e.f.forEach(function (form, i) { push(verb, i, form); });
  if (e.pp) push(verb, 6, e.pp[0] + ' ' + e.pp[1]);
});
regularAudio.forEach(function (verb) {
  const d = lookup(verb);
  if (!d) return;
  d.forms.forEach(function (form, i) { push(verb, i, form); });
  if (d.pp) push(verb, 6, d.pp[0] + ' ' + d.pp[1]);
});
// ASCII 安全输出（非 ASCII 转 \uXXXX）：Windows 中文 locale 下 Python 按 GBK 解码
// node stdout 会把变元音读乱，转义后任何 locale 都能正确解析
const json = JSON.stringify(out).replace(/[^\x20-\x7E]/g, function (c) {
  return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
});
console.log(json);
