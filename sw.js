/* deutsch-zine Service Worker — 核心壳预缓存 + 媒体运行时 CacheFirst。
   版本号随发布手工递增（AGENTS.md SOP）。 */
const CACHE = 'deutsch-zine-v4.7.0';

/* 核心壳：首屏与全部数据文件（路径相对 SW 作用域 = 部署目录）。 */
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/bundle.js',
  'data/vocabulary.js',
  'data/vocabulary_a2.js',
  'data/vocabulary_b1.js',
  'data/grammar.js',
  'data/grammar_a2.js',
  'data/grammar_b1.js',
  'data/listening.js',
  'data/reading.js',
  'data/declension.js',
  'data/ipa.js',
  'audio/manifest.js',
  'images/manifest.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      /* 逐个缓存：单个失败（如尚未随版本合并的可选数据文件）不阻断安装。 */
      const results = await Promise.allSettled(CORE.map((url) => cache.add(url)));
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.warn('[sw] 预缓存失败：' + CORE[i], r.reason);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('deutsch-zine-') && k !== CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* 跨域请求直接放行 */

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        /* 只写 200 完整响应：媒体经 Range 请求拿到 206 时 Cache API 的
           cache.put 会抛 TypeError（音频静默不入缓存）。audio/、images/words/
           等大体积目录不预缓存，按需「打开即缓存」，听过/看过即离线可用。 */
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE)
            .then((cache) => cache.put(req, clone))
            .catch(function () { /* 缓存写入失败静默，不影响响应返回 */ });
        }
        return res;
      });
    })
  );
});
