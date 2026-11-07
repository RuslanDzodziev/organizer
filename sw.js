/* Контур Движение — работа без интернета: страницы, загрузчик и фото хранятся на устройстве. */
var C = 'kd-offline-v1';
var CORE = ['./', './index.html', './form.html', './boot.js?v=6'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var u = new URL(req.url); if (u.origin !== location.origin) return;
  /* фото фона — сначала из памяти устройства */
  if (u.pathname.indexOf('/bg2/') >= 0 || u.pathname.indexOf('/bg/') >= 0) {
    e.respondWith(caches.open(C).then(function (c) { return c.match(req).then(function (r) { return r || fetch(req).then(function (n) { if (n.ok) c.put(req, n.clone()); return n; }); }); }));
    return;
  }
  /* страницы и скрипты — сначала сеть, без сети — сохранённая копия */
  var key = u.origin + u.pathname + (/\.js$/.test(u.pathname) ? u.search : '');
  e.respondWith(fetch(req).then(function (n) {
    if (n.ok) { var cp = n.clone(); caches.open(C).then(function (c) { c.put(key, cp); }); }
    return n;
  }).catch(function () {
    return caches.open(C).then(function (c) { return c.match(key).then(function (r) { return r || c.match(req, { ignoreSearch: true }); }); });
  }));
});
