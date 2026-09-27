/* 应用入口：初始化 store → 懒加载当前级别 → 启动路由 */

import { store } from './store.js';
import { loadLevelData } from './data.js';
import { render, setReady } from './app.js';
import { audio } from './audio.js';
import { TTS } from './tts.js';
import { migrate } from './srs.js';

const view = typeof document !== 'undefined' ? document.getElementById('view') : null;
if (view) view.innerHTML = '<div class="card"><p>加载学习进度...</p></div>';

store.ready().then(function () {
  const level = store.state.settings.level || 'A1';
  if (level !== 'A1' && view) view.innerHTML = '<div class="card"><p>加载 ' + level + ' 数据...</p></div>';
  return loadLevelData(level);
}).catch(function (e) {
  console.error('启动加载当前级别失败，回退到 A1', e);
  store.state.settings.level = 'A1';
}).then(function () {
  setReady(true);
  store.migrateCards(migrate);
  audio.init();
  TTS.setRate(store.state.settings.ttsRate);
  audio.setRate(store.state.settings.ttsRate);
  window.addEventListener('hashchange', render);
  render();
  // 存储持久化与配额：查一次结果，未持久化才申请。失败/被拒都只是降级提示，
  // 不阻塞渲染（iOS 通常拒绝 persist()，这是正常结果，不是错误）。
  // 结果是异步拿到的，若用户正停在设置页要重渲染一次，否则那一行会一直显示「未查询」。
  store.initPersistence()
    .then(function () { return store.refreshQuota(); })
    .then(function () {
      if (location.hash === '#/settings') render();
    });
  // 写入失败（配额写满等）首次发生时也要让用户看见：停在设置页就重渲染出提示
  store.onWriteError(function () {
    if (location.hash === '#/settings') render();
  });
});

// 页面离开/隐藏时强制落盘，避免防抖导致进度丢失
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', function () { store.flush(); });
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') store.flush();
  });
}
