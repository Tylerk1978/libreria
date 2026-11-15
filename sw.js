// Service worker: rende "La mia libreria" utilizzabile offline.
const CACHE = "libreria-v3";
const COVERS = "libreria-covers";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const COVER_HOSTS = ["mzstatic.com", "books.google.com", "books.googleusercontent.com", "covers.openlibrary.org", "archive.org"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COVERS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(cacheName, req) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }
  catch (err) { return new Response("", { status: 504 }); }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Font di Google.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(CACHE, req));
    return;
  }

  // Copertine mostrate nelle pagine (immagini): conservate per l'uso offline.
  if (req.destination === "image" && COVER_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h))) {
    e.respondWith(cacheFirst(COVERS, req));
    return;
  }

  if (url.origin !== location.origin) return;

  // App: risposta immediata dalla cache, aggiornamento in background quando c'è rete.
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) ||
                (req.mode === "navigate" ? await c.match("index.html") : undefined);
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => undefined);
    return hit || (await net) || new Response("Offline", { status: 503 });
  }));
});
