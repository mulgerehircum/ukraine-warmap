import type { Map } from 'maplibre-gl'

const SIZE = 56
const PADDING = 9

const SHIP_PATH = 'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z'
const PLANE_PATH = 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z'

function makeIcon(pathD: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  // Dark navy fill, gold ring
  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2)
  ctx.fillStyle = '#0d1b2a'
  ctx.fill()
  ctx.strokeStyle = '#ffd700'
  ctx.lineWidth = 2.5
  ctx.stroke()

  const scale = (SIZE - PADDING * 2) / 24
  ctx.save()
  ctx.translate(PADDING, PADDING)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffd700'
  ctx.fill(new Path2D(pathD), 'evenodd')
  ctx.restore()

  return ctx.getImageData(0, 0, SIZE, SIZE)
}

export const HONORARY_EVENTS = [
  {
    id: 'moskva',
    icon: 'honorary-ship',
    coords: [31.0, 45.3] as [number, number],
    title: 'Moskva cruiser',
    date: '14 April 2022',
    description: 'Russian Navy flagship struck by two Ukrainian Neptune anti-ship missiles. Caught fire and sank in the Black Sea.',
    url: 'https://en.wikipedia.org/wiki/Russian_cruiser_Moskva',
  },
  {
    id: 'mh17',
    icon: 'honorary-plane',
    coords: [38.39, 48.13] as [number, number],
    title: 'MH17',
    date: '17 July 2014',
    description: 'Malaysia Airlines Flight 17 shot down by a Russian Buk missile over eastern Ukraine, killing all 298 on board.',
    url: 'https://en.wikipedia.org/wiki/Malaysia_Airlines_Flight_17',
  },
]

export function addHonoraryEventsLayer(map: Map): void {
  map.addImage('honorary-ship',  makeIcon(SHIP_PATH))
  map.addImage('honorary-plane', makeIcon(PLANE_PATH))

  map.addSource('honorary-events', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: HONORARY_EVENTS.map(e => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: e.coords },
        properties: { id: e.id, icon: e.icon, title: e.title, date: e.date, description: e.description, url: e.url },
      })),
    },
  })

  map.addLayer({
    id: 'honorary-events',
    type: 'symbol',
    source: 'honorary-events',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 0.62,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 1 },
  })
}
