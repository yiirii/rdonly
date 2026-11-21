/* Rd Only service worker. Version and precache list are filled in at build time. */
const VERSION = '__VERSION__'
const CACHE = `rdonly-${VERSION}`
const PRECACHE = __PRECACHE__

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('rdonly-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  // The update check must never be answered from a cache.
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }))
    return
  }
  // Pages: network first so updates land, cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone()
      if (res.ok) void caches.open(CACHE).then((c) => c.put('./', copy))
      return res
    }).catch(async () => (await caches.match('./')) || (await caches.match('index.html')) || Response.error()))
    return
  }
  // Hashed assets, icons, fonts: cache first.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put(req, copy)) }
    return res
  })))
})
