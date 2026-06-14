const SAT_BASE = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible'

function toTileXY(lng: number, lat: number, z: number): [number, number] {
  const n = 1 << z
  const x = ((lng + 180) / 360 * n) | 0
  const latR = lat * Math.PI / 180
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n) | 0
  return [Math.max(0, Math.min(n - 1, x)), Math.max(0, Math.min(n - 1, y))]
}

// Pre-fetches a grid of satellite tiles around a camera position so they land
// in the browser HTTP cache before MapLibre requests them during a fly animation.
// radius=3 → 7×7 = 49 tiles, covering roughly a 1920×1080 viewport at any zoom.
export function prewarmTiles(lng: number, lat: number, zoom: number, radius = 3): void {
  const z = Math.max(0, Math.min(15, Math.round(zoom)))
  const n = 1 << z
  const [cx, cy] = toTileXY(lng, lat, z)
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const tx = Math.max(0, Math.min(n - 1, cx + dx))
      const ty = Math.max(0, Math.min(n - 1, cy + dy))
      // EOX WMTS URL uses {z}/{y}/{x} order (row/col, not the usual x/y)
      fetch(`${SAT_BASE}/${z}/${ty}/${tx}.jpg`).catch(() => {})
    }
  }
}
