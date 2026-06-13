import type { Map } from 'maplibre-gl'

const TERRAIN_DEM_MAX_ZOOM = 15

export function addTerrainLayer(map: Map): void {
  const firstLabelId = map.getStyle().layers.find(l => l.type === 'symbol')?.id

  map.addSource('terrain-dem', {
    type: 'raster-dem',
    url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
    encoding: 'mapbox',
    tileSize: 256,
    maxzoom: TERRAIN_DEM_MAX_ZOOM,
  })

  map.setTerrain({ source: 'terrain-dem', exaggeration: 2.5, maxzoom: TERRAIN_DEM_MAX_ZOOM })

  map.addLayer(
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: { 'hillshade-exaggeration': 0.5 },
    },
    firstLabelId,
  )
}
