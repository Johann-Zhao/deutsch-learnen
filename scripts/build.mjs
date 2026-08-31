import * as esbuild from 'esbuild';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENTRY = resolve(process.cwd(), 'src/main.js');
const OUTFILE = resolve(process.cwd(), 'js/bundle.js');
const WATCH = process.argv.includes('--watch');

if (!existsSync(ENTRY)) {
  console.error('错误：src/main.js 不存在。请先完成 Task 6 的 ES Module 迁移。');
  process.exit(1);
}

const options = {
  entryPoints: [ENTRY],
  bundle: true,
  format: 'iife',
  target: ['es2018'],
  sourcemap: true,
  minify: true,
  outfile: OUTFILE,
  banner: {
    js: '/* 本文件由 npm run build 自动生成，提交到 git 以保证零构建双击可用。' +
        ' 修改 src/main.js 后请重新运行构建。 */',
  },
};

if (WATCH) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(' watching src/main.js ...');
} else {
  await esbuild.build(options);
  console.log(' built js/bundle.js');
}
