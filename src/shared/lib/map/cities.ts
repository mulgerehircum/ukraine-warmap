import type { Map } from 'maplibre-gl'

export function addCityLayer(map: Map): void {
  map.addSource('cities', {
    type: 'geojson',
    data: '/data/ukraine-cities.json',
  })

  // Dots — size and visibility scale with zoom and population
  map.addLayer({
    id: 'city-dots',
    type: 'circle',
    source: 'cities',
    filter: [
      'any',
      ['get', 'capital'],
      ['step', ['zoom'],
        ['>=', ['get', 'pop'], 100000],  // zoom <8 : 100k+
        8,  ['>=', ['get', 'pop'], 20000],
        9,  ['>=', ['get', 'pop'], 5000],
        10, ['>=', ['get', 'pop'], 1000],
        12, ['>=', ['get', 'pop'], 0],
      ],
    ],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, ['case', ['get', 'capital'], 4, 2],
        10, ['case', ['get', 'capital'], 7, 4],
        14, ['case', ['get', 'capital'], 9, 6],
      ],
      'circle-color': [
        'case',
        ['get', 'capital'], '#4DD7FA',
        ['>=', ['get', 'pop'], 100000], '#e2e8f0',
        '#94a3b8',
      ],
      'circle-stroke-color': 'rgba(0,0,0,0.55)',
      'circle-stroke-width': 1,
    },
  })

  // Labels — only appear at higher zooms or for large places
  map.addLayer({
    id: 'city-labels',
    type: 'symbol',
    source: 'cities',
    filter: [
      'any',
      ['get', 'capital'],
      ['step', ['zoom'],
        ['>=', ['get', 'pop'], 100000],
        8,  ['>=', ['get', 'pop'], 20000],
        9,  ['>=', ['get', 'pop'], 5000],
        10, ['>=', ['get', 'pop'], 1000],
        12, ['>=', ['get', 'pop'], 0],
      ],
    ],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Semibold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5, ['case', ['get', 'capital'], 13, 10],
        10, ['case', ['get', 'capital'], 15, 12],
      ],
      'text-offset': [0, 1],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': ['case', ['get', 'capital'], '#4DD7FA', '#e2e8f0'],
      'text-halo-color': 'rgba(0,0,0,0.75)',
      'text-halo-width': 1.5,
    },
  })
}
