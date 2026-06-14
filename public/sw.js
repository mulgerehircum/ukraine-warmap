const CACHE = 'maptiles-v2'

// Cache MapTiler (vector tiles, terrain, fonts) and EOX satellite tiles.
// All tile URLs are content-addressed (zoom/x/y baked in), so they never
// need revalidation. Cache-first gives instant loads on revisit and on replay
// after tile pre-warming.
function isTileRequest(url) {
  return url.hostname === 'api.maptiler.com' || url.hostname === 'tiles.maps.eox.at'
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
