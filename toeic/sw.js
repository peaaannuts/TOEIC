const CACHE_NAME = "toeic600-v48";
const ASSETS = [
  ".",
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "manifest.webmanifest",
  "icon.svg",
  "audio/part1/q1_a.mp3",
  "audio/part1/q1_b.mp3",
  "audio/part1/q1_c.mp3",
  "audio/part1/q1_d.mp3",
  "audio/part1/q2_a.mp3",
  "audio/part1/q2_b.mp3",
  "audio/part1/q2_c.mp3",
  "audio/part1/q2_d.mp3",
  "audio/part1/q3_a.mp3",
  "audio/part1/q3_b.mp3",
  "audio/part1/q3_c.mp3",
  "audio/part1/q3_d.mp3",
  "audio/part1/q4_a.mp3",
  "audio/part1/q4_b.mp3",
  "audio/part1/q4_c.mp3",
  "audio/part1/q4_d.mp3",
  "audio/part1/q5_a.mp3",
  "audio/part1/q5_b.mp3",
  "audio/part1/q5_c.mp3",
  "audio/part1/q5_d.mp3",
  "audio/part1/q6_a.mp3",
  "audio/part1/q6_b.mp3",
  "audio/part1/q6_c.mp3",
  "audio/part1/q6_d.mp3",
  "audio/part1/q7_a.mp3",
  "audio/part1/q7_b.mp3",
  "audio/part1/q7_c.mp3",
  "audio/part1/q7_d.mp3",
  "audio/part1/q8_a.mp3",
  "audio/part1/q8_b.mp3",
  "audio/part1/q8_c.mp3",
  "audio/part1/q8_d.mp3",
  "audio/part1/q9_a.mp3",
  "audio/part1/q9_b.mp3",
  "audio/part1/q9_c.mp3",
  "audio/part1/q9_d.mp3",
  "audio/part1/q10_a.mp3",
  "audio/part1/q10_b.mp3",
  "audio/part1/q10_c.mp3",
  "audio/part1/q10_d.mp3",
  "audio/part1/q11_a.mp3",
  "audio/part1/q11_b.mp3",
  "audio/part1/q11_c.mp3",
  "audio/part1/q11_d.mp3",
  "audio/part1/q12_a.mp3",
  "audio/part1/q12_b.mp3",
  "audio/part1/q12_c.mp3",
  "audio/part1/q12_d.mp3",
  "audio/part1/q13_a.mp3",
  "audio/part1/q13_b.mp3",
  "audio/part1/q13_c.mp3",
  "audio/part1/q13_d.mp3",
  "audio/part1/q14_a.mp3",
  "audio/part1/q14_b.mp3",
  "audio/part1/q14_c.mp3",
  "audio/part1/q14_d.mp3",
  "audio/part1/q15_a.mp3",
  "audio/part1/q15_b.mp3",
  "audio/part1/q15_c.mp3",
  "audio/part1/q15_d.mp3",
  "audio/part1/q16_a.mp3",
  "audio/part1/q16_b.mp3",
  "audio/part1/q16_c.mp3",
  "audio/part1/q16_d.mp3",
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
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
