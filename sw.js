// Сервис-воркер Wrap PRO: позволяет установить сайт как приложение и открывать его при плохой связи.
// Страница — «сначала сеть»: обновления видны сразу, а без интернета открывается последняя сохранённая версия.
// Библиотеки (Firebase, Excel) — «сначала кэш»: их версии зафиксированы и не меняются.
const CACHE = "wrappro-v8";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png?v=3", "./icon-512.png?v=3", "./icon-maskable-512.png?v=3", "./apple-touch-icon.png?v=3", "./favicon.ico?v=glixpro"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // запросы к базе и входу не трогаем — у Firebase своя работа без сети
  if (/googleapis\.com|firebaseio|identitytoolkit|securetoken/.test(url.hostname)) return;
  const isLib = url.hostname === "www.gstatic.com" || url.hostname === "cdnjs.cloudflare.com";
  if (isLib) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined))));
});
