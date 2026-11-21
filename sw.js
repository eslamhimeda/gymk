/* Service worker — makes the app installable (Chrome requires a worker
   with a fetch handler before it offers a real "Install app"), and keeps
   the app shell available offline.
   IMPORTANT: this file must sit next to index.html at the app root so its
   scope covers the whole app. An identical copy ships in assets/ only as
   a source/fallback — a worker inside assets/ cannot control the app. */
const CACHE = "gymk-v1";
const CORE = ["./", "index.html", "assets/manifest.webmanifest", "assets/icon-192.png", "assets/icon-512.png", "assets/logo-mark.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return Promise.allSettled(CORE.map(function (u) { return c.add(u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // YouTube and other cross-origin traffic passes through untouched
  if (req.mode === "navigate") {
    // Network first so app updates arrive immediately; the cached page is
    // only the offline fallback.
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put("index.html", copy); });
        return res;
      }).catch(function () {
        return caches.match("index.html").then(function (hit) { return hit || caches.match("./"); });
      })
    );
    return;
  }
  // Static files (icons, images, manifest): cache first, then network,
  // remembering what was fetched for next time.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
