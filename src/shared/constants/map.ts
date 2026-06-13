export const MAP_CENTER_LON = 31.1656
export const MAP_CENTER_LAT = 48.3794
export const MAP_ZOOM = 5
export const MAP_MIN_ZOOM = 5

// Bounds lock to Ukraine — prevents panning outside the country
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [21.5, 44.0], // SW
  [40.5, 52.5], // NE
]

export const DATA_URLS = {
  outline: '/data/ukraine-outline.geojson',
  cities: '/data/ukraine-cities.json',
} as const
