import type { Map } from 'maplibre-gl'

let baseFillLayerIds: string[] = []

export function addSatelliteLayer(map: Map): void {
  const { layers } = map.getStyle()

  // Line layers (base style borders) are replaced by oblast borders — remove permanently
  layers
    .filter(l => l.type === 'line')
    .forEach(l => map.removeLayer(l.id))

  // Snapshot base fill IDs before hiding — setSatelliteVisible must only touch these
  baseFillLayerIds = layers.filter(l => l.type === 'fill').map(l => l.id)

  // Fill layers hidden so they can be restored in terrain mode
  baseFillLayerIds.forEach(id => map.setLayoutProperty(id, 'visibility', 'none'))

  // Country name labels — permanently removed, replaced by our own city layer
  if (map.getLayer('countries-label')) map.removeLayer('countries-label')

  const firstLineOrSymbolId = layers.find(l => l.type === 'symbol' && l.id !== 'countries-label')?.id

  map.addSource('satellite', {
    type: 'raster',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'],
    tileSize: 256,
    maxzoom: 15,
    attribution: '© EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2021)',
  })

  map.addLayer(
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      paint: {
        'raster-brightness-min': 0.15,
        'raster-saturation': 0.3,
      },
    },
    firstLineOrSymbolId,
  )
}

export function setSatelliteVisible(map: Map, visible: boolean): void {
  map.setLayoutProperty('satellite', 'visibility', visible ? 'visible' : 'none')

  baseFillLayerIds.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'none' : 'visible')
    }
  })
}
