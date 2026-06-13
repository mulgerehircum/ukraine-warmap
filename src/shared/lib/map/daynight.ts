import type { Map, GeoJSONSource } from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'

function toRad(deg: number): number { return (deg * Math.PI) / 180 }
function toDeg(rad: number): number { return (rad * 180) / Math.PI }

function solarPosition(date: Date): { declination: number; subsolarLng: number } {
  // Days since J2000.0 (2000-01-01T12:00:00Z)
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000

  // Mean longitude and mean anomaly (degrees)
  const L = (280.460 + 0.9856474 * d) % 360
  const g = toRad(((357.528 + 0.9856003 * d) % 360 + 360) % 360)

  // Ecliptic longitude (radians)
  const eclipLon = toRad(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g))

  // Obliquity of the ecliptic and solar declination
  const obliquity = toRad(23.439 - 0.0000004 * d)
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipLon))

  // Right ascension (radians)
  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(eclipLon), Math.cos(eclipLon))

  // Greenwich Mean Sidereal Time (hours) → Greenwich Hour Angle (degrees westward)
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const GMST = ((6.697375 + 0.0657098242 * d + utcH) % 24 + 24) % 24
  const GHA = ((GMST * 15 - toDeg(ra)) % 360 + 360) % 360

  // GHA measured westward → east-positive longitude
  let subsolarLng = -GHA
  if (subsolarLng < -180) subsolarLng += 360
  if (subsolarLng > 180) subsolarLng -= 360

  return { declination, subsolarLng }
}

function buildNightPolygon(date: Date): Feature<Polygon> {
  const { declination, subsolarLng } = solarPosition(date)

  // Avoid tan(0) singularity at equinox — tiny value gives correct ±90° limits
  const decl = Math.abs(declination) < 1e-4 ? 1e-4 : declination

  // Walk terminator East→West (counterclockwise exterior ring per GeoJSON spec)
  const ring: [number, number][] = []
  for (let lon = 180; lon >= -180; lon--) {
    const lat = toDeg(Math.atan(-Math.cos(toRad(lon - subsolarLng)) / Math.tan(decl)))
    ring.push([lon, Math.max(-89.9, Math.min(89.9, lat))])
  }

  // Close via the dark pole (south when sun is north of equator, north otherwise)
  const poleLat = declination > 0 ? -90 : 90
  ring.push([-180, poleLat], [180, poleLat], ring[0])

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  }
}

export function addDayNightLayer(map: Map): void {
  map.addSource('night', { type: 'geojson', data: buildNightPolygon(new Date()) })

  // Insert below occupation so territory colours remain readable in darkness
  map.addLayer(
    {
      id: 'night-overlay',
      type: 'fill',
      source: 'night',
      paint: {
        'fill-color': '#000d1a',
        'fill-opacity': 0.6,
      },
    },
    'occupation-fill',
  )
}

export function updateNightOverlay(map: Map, date: Date): void {
  const src = map.getSource('night') as GeoJSONSource | undefined
  src?.setData(buildNightPolygon(date))
}

export function setNightOverlayVisible(map: Map, visible: boolean): void {
  map.setLayoutProperty('night-overlay', 'visibility', visible ? 'visible' : 'none')
}

// Ukraine centroid used for per-scene sun direction (good enough for all cities)
const UKRAINE_LAT_R = toRad(49)
const UKRAINE_LNG = 31

/**
 * Returns the sun direction vector in Three.js Mercator world space
 * (X = east, Y = south, Z = up). z = sin(elevation): positive above horizon.
 */
export function getSunVector(date: Date): { x: number; y: number; z: number } {
  const { declination: decl, subsolarLng } = solarPosition(date)
  const H = toRad(UKRAINE_LNG - subsolarLng)
  const sinD = Math.sin(decl), cosD = Math.cos(decl)
  const sinP = Math.sin(UKRAINE_LAT_R), cosP = Math.cos(UKRAINE_LAT_R)
  const z = sinP * sinD + cosP * cosD * Math.cos(H)  // sin(elevation)
  const x = -cosD * Math.sin(H)                       // east
  const y = -(sinD - sinP * z) / cosP                 // south (Mercator +Y = south)
  return { x, y, z }
}
