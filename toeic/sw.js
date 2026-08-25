const CACHE_NAME = "toeic600-v59";
const ASSETS = [
  ".",
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "manifest.webmanifest",
  "icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // 音声ファイルはPart1〜4合計で700件超あり、インストール時の一括プリキャッシュだと
  // 初回起動が重くなる(数MB〜十数MBを一気に取得することになる)。そのため音声・画像は
  // 「初回再生/表示時にキャッシュへ保存し、以後はキャッシュから返す」という遅延キャッシュにする
  // (2回目以降の再生・オフライン再生は自動的にできるようになる)。
  if (e.request.url.includes("/audio/") || e.request.url.includes("/images/")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
