import type { Map as MlMap } from 'maplibre-gl'

export type OblastBreakdown = { total: number; S: number; D: number; A: number; F: number; C: number; V: number; M: number; L: number }

let choroplethMap: MlMap | null = null
let choroplethData: OblastBreakdown[] = []
let highlightedIds: number[] = []
let alertedIds = new Set<number>()
const prevChoroplethCounts = new Array(28).fill(-1)

let alertAnimId: number | null = null

function alertAnimTick(ts: number) {
  if (!choroplethMap || alertedIds.size === 0) { alertAnimId = null; return }
  const t = (ts % 2800) / 2800
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  const a = (0.22 + 0.28 * pulse).toFixed(3)
  choroplethMap.setPaintProperty('oblast-alert', 'fill-color', `rgba(211,47,47,${a})`)
  alertAnimId = requestAnimationFrame(alertAnimTick)
}

export function addOblastLayer(map: MlMap): void {
  choroplethMap = map
  map.addSource('oblasts', {
    type: 'geojson',
    data: '/data/ukraine-oblasts.geojson',
    generateId: true,
  })

  map.addLayer({
    id: 'oblast-choropleth',
    type: 'fill',
    source: 'oblasts',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'interpolate', ['linear'],
        ['coalesce', ['feature-state', 'count'], 0],
        0,     'rgba(0,0,0,0)',
        108,   'rgba(255,140,20,0.30)',
        1000,  'rgba(255,100,10,0.50)',
        5000,  'rgba(210,50,0,0.65)',
        15000, 'rgba(170,15,0,0.78)',
        47000, 'rgba(130,0,0,0.88)',
      ],
      'fill-opacity': 1.0,
    },
  })

  map.addLayer({
    id: 'oblast-borders-casing',
    type: 'line',
    source: 'oblasts',
    paint: {
      'line-color': '#000000',
      'line-width': 3,
      'line-opacity': 0.3,
    },
  })

  map.addLayer({
    id: 'oblast-borders',
    type: 'line',
    source: 'oblasts',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1.5,
      'line-opacity': 0.9,
    },
  })

  map.addLayer({
    id: 'oblast-alert',
    type: 'fill',
    source: 'oblasts',
    paint: {
      'fill-color': 'rgba(211, 47, 47, 0.35)',
      'fill-opacity': ['case', ['boolean', ['feature-state', 'alert'], false], 1, 0],
    },
  })

  map.addLayer({
    id: 'oblast-highlight',
    type: 'fill',
    source: 'oblasts',
    paint: {
      'fill-color': 'rgba(252,211,77,0.18)',
      'fill-opacity': ['case', ['boolean', ['feature-state', 'highlighted'], false], 1, 0],
    },
  })

  map.addLayer({
    id: 'oblast-hittest',
    type: 'fill',
    source: 'oblasts',
    paint: { 'fill-opacity': 0.001 },
  })

  map.addLayer({
    id: 'oblast-highlight-border',
    type: 'line',
    source: 'oblasts',
    paint: {
      'line-color': 'rgba(252,211,77,0.9)',
      'line-width': 2,
      'line-blur': 1,
      'line-opacity': ['case', ['boolean', ['feature-state', 'highlighted'], false], 1, 0],
    },
  })
}

export function setOblastChoroplethVisible(visible: boolean): void {
  if (!choroplethMap) return
  choroplethMap.setLayoutProperty('oblast-choropleth', 'visibility', visible ? 'visible' : 'none')
}

export async function loadAndApplyChoropleth(): Promise<void> {
  if (!choroplethMap) return
  const res = await fetch('/data/oblast-choropleth.json')
  choroplethData = await res.json() as OblastBreakdown[]
  choroplethData.forEach((d, id) => {
    choroplethMap!.setFeatureState({ source: 'oblasts', id }, { count: d.total })
  })
}

export function getOblastBreakdown(id: number): OblastBreakdown | null {
  return choroplethData[id] ?? null
}

export function getOblastCountsByTypes(types: (keyof OblastBreakdown)[]): Map<number, number> {
  const result = new Map<number, number>()
  choroplethData.forEach((d, id) => {
    const count = types.reduce((sum, t) => sum + (d[t] as number ?? 0), 0)
    if (count) result.set(id, count)
  })
  return result
}

export function setChoroplethCounts(counts: Map<number, number>): void {
  if (!choroplethMap) return
  for (let id = 0; id < 28; id++) {
    const count = counts.get(id) ?? 0
    if (prevChoroplethCounts[id] === count) continue
    prevChoroplethCounts[id] = count
    choroplethMap.setFeatureState({ source: 'oblasts', id }, { count })
  }
}

export function setAlertState(incoming: Set<number>): void {
  if (!choroplethMap) return
  alertedIds.forEach(id =>
    choroplethMap!.setFeatureState({ source: 'oblasts', id }, { alert: false })
  )
  alertedIds = incoming
  incoming.forEach(id =>
    choroplethMap!.setFeatureState({ source: 'oblasts', id }, { alert: true })
  )
  if (incoming.size > 0 && alertAnimId === null) {
    alertAnimId = requestAnimationFrame(alertAnimTick)
  } else if (incoming.size === 0 && alertAnimId !== null) {
    cancelAnimationFrame(alertAnimId)
    alertAnimId = null
    choroplethMap.setPaintProperty('oblast-alert', 'fill-color', 'rgba(211,47,47,0.35)')
  }
}

export function setMilestoneHighlight(indices: number[]): void {
  if (!choroplethMap) return
  highlightedIds.forEach(id =>
    choroplethMap!.setFeatureState({ source: 'oblasts', id }, { highlighted: false })
  )
  highlightedIds = indices
  indices.forEach(id =>
    choroplethMap!.setFeatureState({ source: 'oblasts', id }, { highlighted: true })
  )
}
