import type { Map } from 'maplibre-gl'

const STATUS_EXPR = ['coalesce', ['feature-state', 'status'], ['get', 'status']] as const

// VIINA gn_UA_tess.geojson merged with control_latest_2026 + 2022 history
// Status values: 'RU' = occupied, 'CONTESTED' = contested, 'LIBERATED' = retaken from RU, 'UA' = always Ukrainian
export function addOccupationLayer(map: Map): void {
  map.addSource('occupation', {
    type: 'geojson',
    data: '/data/viina-tess.geojson',
    promoteId: 'geonameid',
  })

  const colorExpr = [
    'match', STATUS_EXPR,
    'UA',        'rgba(0,0,0,0)',
    'LIBERATED', '#2563eb',
    'RU',        '#b91c1c',
    'CONTESTED', '#ea580c',
    'rgba(0,0,0,0)',
  ] as const

  // Territory fill — semi-transparent tinted overlay
  map.addLayer(
    {
      id: 'occupation-fill',
      type: 'fill',
      source: 'occupation',
      paint: {
        'fill-color': colorExpr as any,
        'fill-opacity': [
          'match', STATUS_EXPR,
          'UA',        0,
          'LIBERATED', 0.28,
          'RU',        0.38,
          'CONTESTED', 0.55,
          0,
        ] as any,
        'fill-antialias': true,
      },
    },
    'oblast-borders-casing',
  )

  // Soft glow along all non-UA borders
  map.addLayer(
    {
      id: 'occupation-glow',
      type: 'line',
      source: 'occupation',
      paint: {
        'line-color': colorExpr as any,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 6, 10, 14],
        'line-opacity': ['match', STATUS_EXPR, 'RU', 0.12, 'LIBERATED', 0.12, 'CONTESTED', 0.12, 0] as any,
        'line-blur': 5,
      },
    },
    'oblast-borders-casing',
  )

  // Sharp frontline edge
  map.addLayer(
    {
      id: 'occupation-line',
      type: 'line',
      source: 'occupation',
      paint: {
        'line-color': [
          'match', STATUS_EXPR,
          'LIBERATED', '#93c5fd',
          'RU',        '#fca5a5',
          'CONTESTED', '#fdba74',
          '#ffffff',
        ] as any,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.5],
        'line-opacity': ['match', STATUS_EXPR, 'RU', 0.55, 'LIBERATED', 0.55, 'CONTESTED', 0.55, 0] as any,
      },
    },
    'oblast-borders-casing',
  )
}

const OCCUPATION_LAYERS = ['occupation-fill', 'occupation-glow', 'occupation-line']

export function setOccupationVisible(map: Map, visible: boolean): void {
  const v = visible ? 'visible' : 'none'
  for (const id of OCCUPATION_LAYERS) map.setLayoutProperty(id, 'visibility', v)
}
