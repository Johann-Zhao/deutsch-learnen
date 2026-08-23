/* 导出变位音频生成清单（JSON 到 stdout）：
   [{"verb":"sein","idx":0,"text":"bin"}, ...]
   覆盖全部内置不规则动词 + 常用规则动词，idx 0-5 = 六个人称，6 = Perfekt */
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'conjugate.js'), 'utf8');

// conjugate.js 是浏览器全局风格（var Conjugate = ...），用 new Function 执行后取返回值
const C = new Function(src + '\nreturn Conjugate;')();
if (!C) { console.error('无法加载 Conjugate 模块'); process.exit(1); }

const out = [];
Object.keys(C.irr).forEach(function (verb) {
  const e = C.irr[verb];
  e.f.forEach(function (form, i) { out.push({ verb, idx: i, text: form }); });
  if (e.pp) out.push({ verb, idx: 6, text: e.pp[0] + ' ' + e.pp[1] });
});
C.regularAudio.forEach(function (verb) {
  const d = C.lookup(verb);
  if (!d) return;
  d.forms.forEach(function (form, i) { out.push({ verb, idx: i, text: form }); });
  if (d.pp) out.push({ verb, idx: 6, text: d.pp[0] + ' ' + d.pp[1] });
});
console.log(JSON.stringify(out));
