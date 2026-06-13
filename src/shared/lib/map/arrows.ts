import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import { OPERATION_ARROWS } from '../../data/operationArrows'

let arrowsMap: MlMap | null = null

function geoBearing(a: [number, number], b: [number, number]): number {
  const dLng = (b[0] - a[0]) * Math.PI / 180
  const lat1 = a[1] * Math.PI / 180
  const lat2 = b[1] * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function makeArrowImage(): ImageData {
  const S = 64
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(S / 2, 2)
  ctx.lineTo(2,     S - 2)
  ctx.lineTo(S - 2, S - 2)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, S, S)
}

export function addArrowsLayer(map: MlMap): void {
  arrowsMap = map
  map.addImage('op-arrow', makeArrowImage(), { sdf: true })

  map.addSource('op-arrows-lines', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addSource('op-arrows-heads', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  // Outer glow
  map.addLayer({
    id: 'op-arrows-glow',
    type: 'line',
    source: 'op-arrows-lines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 22, 8, 36],
      'line-opacity': 0.14,
      'line-blur': 10,
    },
  })

  // Shaft
  map.addLayer({
    id: 'op-arrows-line',
    type: 'line',
    source: 'op-arrows-lines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6],
      'line-opacity': 0.92,
    },
  })

  // Arrowheads
  map.addLayer({
    id: 'op-arrows-heads',
    type: 'symbol',
    source: 'op-arrows-heads',
    layout: {
      'icon-image': 'op-arrow',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 0.8],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 9, 13],
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'icon-color': ['get', 'color'],
      'icon-opacity': 0.95,
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.85)',
      'text-halo-width': 1.5,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 6, 1],
    },
  })
}

export function updateArrowsDate(dateInt: number): void {
  if (!arrowsMap) return

  const active = OPERATION_ARROWS.filter(a =>
    dateInt >= a.dateStart && dateInt <= a.dateEnd
  )

  const lineFeatures = active.map(a => ({
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: a.coords },
    properties: { color: a.color, label: a.label },
  }))

  const headFeatures = active.map(a => {
    const n = a.coords.length
    const b = geoBearing(a.coords[n - 2], a.coords[n - 1])
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: a.coords[n - 1] },
      properties: { bearing: b, color: a.color, label: a.label },
    }
  })

  ;(arrowsMap.getSource('op-arrows-lines') as GeoJSONSource).setData({
    type: 'FeatureCollection', features: lineFeatures,
  })
  ;(arrowsMap.getSource('op-arrows-heads') as GeoJSONSource).setData({
    type: 'FeatureCollection', features: headFeatures,
  })
}

export function setArrowsVisible(visible: boolean): void {
  if (!arrowsMap) return
  const v = visible ? 'visible' : 'none'
  for (const id of ['op-arrows-glow', 'op-arrows-line', 'op-arrows-heads'])
    arrowsMap.setLayoutProperty(id, 'visibility', v)
}
