/* 截图验收工具：Playwright 驱动本机 Edge，等待 SPA 渲染后全页截图。
   用法：node tools/shot.mjs <route> <outfile> <width> [height]
   示例：node tools/shot.mjs /vocab shots/vocab_1280.png 1280 1800
   需先起本地服务：python -m http.server 8765 */

const route = process.argv[2] || '';
const out = process.argv[3] || 'shots/shot.png';
const width = parseInt(process.argv[4] || '1280', 10);
const height = parseInt(process.argv[5] || '1500', 10);

import { createRequire } from 'node:module';
const require = createRequire('C:/Users/matebook 14/AppData/Roaming/npm/node_modules/');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:8765/#/' + route, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1.page-title, .card', { timeout: 15000 });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ out, width, overflowX: overflow, jsErrors: errors }));
  if (overflow) process.exitCode = 2;
})();
