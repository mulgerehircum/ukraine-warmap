const CACHE = 'maptiles-v1'

// Cache everything from the MapTiler CDN — tiles, terrain, fonts, sprites.
// Tiles are content-addressed (URL encodes zoom/x/y + API key), so they never
// need revalidation. Cache-first gives instant loads on revisit.
function isTileRequest(url) {
  return url.hostname === 'api.maptiler.com'
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!isTileRequest(url)) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request)
      if (hit) return hit

      const response = await fetch(event.request)
      if (response.ok) cache.put(event.request, response.clone())
      return response
    }),
  )
})
