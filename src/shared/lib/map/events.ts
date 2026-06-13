import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson'
import { MAP_MIN_ZOOM } from '../../constants/map'
import { loadEventIcons, loadClusterIcons } from './eventIcons'

type EventEntry = [number, number, string, string, number, string[]?] // [lng, lat, name, typeCode, nReports, urls?]
type EventsByDate = Record<string, EventEntry[]>
type ObGeometry = Polygon | MultiPolygon
type ObFeature = Feature<ObGeometry, GeoJsonProperties>
type ObCollection = FeatureCollection<ObGeometry, GeoJsonProperties>

const loadedYears = new Set<number>()
const store: Record<string, EventEntry[]> = {}
/** At map min zoom we only show per-oblast counts; this is the first zoom with cluster layers. */
export const EVENT_DETAIL_MIN_ZOOM = MAP_MIN_ZOOM + 1
/** Clustering stops above this zoom; individual icons appear from here. */
export const CLUSTER_MAX_ZOOM = 12

const emptyPointCollection: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
}

let oblastsLoaded = false
let oblastFeatures: ObFeature[] = []
let lastEventsMap: MlMap | null = null
let lastEventsDateInt: number | null = null

// minzoom/maxzoom on each layer handles show/hide automatically.
// This only manages data: clear the clustered source below the threshold so
// unclustered points (clusterMinPoints < 3) cannot bleed through.
function applyEventsPointDataForCurrentZoom(): void {
  if (!lastEventsMap || lastEventsDateInt == null) return
  const src = lastEventsMap.getSource('events') as GeoJSONSource | undefined
  if (!src) return
  const zoom = lastEventsMap.getZoom()
  if (zoom < EVENT_DETAIL_MIN_ZOOM) {
    src.setData(emptyPointCollection)
  } else {
    src.setData(buildGeoJSON(lastEventsDateInt))
  }
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  S: 'Airstrike',
  D: 'UAV / Drone',
  A: 'Artillery',
  F: 'Firefight',
  C: 'Civilian casualties',
  V: 'Armor',
  M: 'Military casualties',
  L: 'Air alert',
  O: 'Other',
}

export const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS)

let activeTypes = new Set(ALL_EVENT_TYPES)

async function loadYear(year: number): Promise<void> {
  if (loadedYears.has(year)) return
  loadedYears.add(year)
  try {
    const res = await fetch(`/data/viina-events-${year}.json`)
    Object.assign(store, await res.json() as EventsByDate)
  } catch {
    loadedYears.delete(year)
  }
}

async function loadOblasts(): Promise<void> {
  if (oblastsLoaded) return
  try {
    const res = await fetch('/data/ukraine-oblasts.geojson')
    const data = await res.json() as ObCollection
    oblastFeatures = data.features
    oblastsLoaded = true
  } catch {
    // non-fatal: oblast count layer stays empty
  }
}

function ringContainsPoint(ring: Position[], lng: number, lat: number): boolean {
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = (yi > lat) !== (yj > lat)
      && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }

  return inside
}

function polygonContainsPoint(polygonCoords: Position[][], lng: number, lat: number): boolean {
  if (!polygonCoords.length || !ringContainsPoint(polygonCoords[0], lng, lat)) return false
  for (let i = 1; i < polygonCoords.length; i += 1) {
    if (ringContainsPoint(polygonCoords[i], lng, lat)) return false
  }
  return true
}

function geometryContainsPoint(geometry: ObGeometry, lng: number, lat: number): boolean {
  if (geometry.type === 'Polygon') {
    return polygonContainsPoint(geometry.coordinates, lng, lat)
  }

  return geometry.coordinates.some((polygonCoords) => polygonContainsPoint(polygonCoords, lng, lat))
}

function geometryCenter(geometry: ObGeometry): [number, number] {
  let lngSum = 0
  let latSum = 0
  let count = 0

  const consumeRing = (ring: Position[]): void => {
    ring.forEach(([lng, lat]) => {
      lngSum += lng
      latSum += lat
      count += 1
    })
  }

  if (geometry.type === 'Polygon') {
    if (geometry.coordinates[0]) consumeRing(geometry.coordinates[0])
  } else {
    geometry.coordinates.forEach((polygonCoords) => {
      if (polygonCoords[0]) consumeRing(polygonCoords[0])
    })
  }

  if (!count) return [31.1656, 48.3794]
  return [lngSum / count, latSum / count]
}

const geoJSONCache = new Map<number, FeatureCollection<Point>>()

function buildGeoJSON(dateInt: number): FeatureCollection<Point> {
  if (geoJSONCache.has(dateInt)) return geoJSONCache.get(dateInt)!
  const entries = store[dateInt] ?? []
  const result: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: entries
      .filter(entry => activeTypes.has(entry[3]))
      .map(([lng, lat, name, type, n, urls = []]) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { name, type, n, urls: JSON.stringify(urls) },
      })),
  }
  geoJSONCache.set(dateInt, result)
  return result
}

const oblastCountCache = new Map<number, Map<number, number>>()

export function getOblastEventCounts(dateInt: number): Map<number, number> {
  if (oblastCountCache.has(dateInt)) return oblastCountCache.get(dateInt)!
  const countsByOblast = new Map<number, number>()
  for (const entry of store[dateInt] ?? []) {
    if (!activeTypes.has(entry[3])) continue
    const [lng, lat] = entry
    for (let i = 0; i < oblastFeatures.length; i += 1) {
      if (geometryContainsPoint(oblastFeatures[i].geometry, lng, lat)) {
        countsByOblast.set(i, (countsByOblast.get(i) ?? 0) + 1)
        break
      }
    }
  }
  oblastCountCache.set(dateInt, countsByOblast)
  return countsByOblast
}

let ctDates: number[] = []
let ctPrefixSums: number[][] = []

export async function loadChoroplethTimeline(): Promise<void> {
  if (ctDates.length) return
  const res = await fetch('/data/choropleth-timeline.json')
  const { dates, counts } = await res.json() as { dates: number[]; counts: number[][] }
  ctDates = dates
  ctPrefixSums = []
  for (let d = 0; d < dates.length; d++) {
    const prev = ctPrefixSums[d - 1] ?? new Array(counts[d].length).fill(0)
    ctPrefixSums.push(counts[d].map((v, i) => prev[i] + v))
  }
}

export function getCumulativeOblastCounts(upToDateInt: number): Map<number, number> {
  if (!ctDates.length) return new Map()
  let lo = 0, hi = ctDates.length - 1, idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ctDates[mid] <= upToDateInt) { idx = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  if (idx < 0) return new Map()
  const row = ctPrefixSums[idx]
  const result = new Map<number, number>()
  for (let i = 0; i < row.length; i++) {
    if (row[i]) result.set(i, row[i])
  }
  return result
}

function buildOblastCountGeoJSON(dateInt: number): FeatureCollection<Point> {
  const countsByOblast = getOblastEventCounts(dateInt)

  return {
    type: 'FeatureCollection',
    features: Array.from(countsByOblast.entries()).map(([idx, count]) => {
      const feature = oblastFeatures[idx]
      const center = geometryCenter(feature.geometry)
      const name = String(feature.properties?.NAME_1 ?? 'Oblast')
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: center },
        properties: { count, name },
      }
    }),
  }
}

export function addEventsLayer(map: MlMap): void {
  map.addSource('events', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 25,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterMinPoints: 3,
  })

  loadEventIcons(map)
  loadClusterIcons(map)

  // Cluster badge — canvas icon with count digit baked in (no glyph server needed)
  map.addLayer({
    id: 'events-cluster',
    type: 'symbol',
    source: 'events',
    minzoom: EVENT_DETAIL_MIN_ZOOM,
    filter: ['has', 'point_count'],
    layout: {
      'icon-image': [
        'step', ['get', 'point_count'],
        'evt-cluster-3',
        4,  'evt-cluster-4',
        5,  'evt-cluster-5',
        6,  'evt-cluster-6',
        7,  'evt-cluster-7',
        8,  'evt-cluster-8',
        9,  'evt-cluster-9',
        10, 'evt-cluster-9plus',
      ],
      'icon-size': ['step', ['get', 'point_count'], 0.58, 10, 0.72],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 0.92 },
  })

  // Individual event icons — only appear once clustering stops
  map.addLayer({
    id: 'events-circles',
    type: 'symbol',
    source: 'events',
    minzoom: CLUSTER_MAX_ZOOM,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': [
        'match', ['get', 'type'],
        'S', 'evt-S',
        'D', 'evt-D',
        'A', 'evt-A',
        'F', 'evt-F',
        'C', 'evt-C',
        'V', 'evt-V',
        'M', 'evt-M',
        'L', 'evt-L',
        'evt-O',
      ],
      'icon-size': ['interpolate', ['linear'], ['get', 'n'], 1, 0.38, 5, 0.5, 20, 0.65],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 0.92 },
  })

  map.addSource('events-oblast-counts', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: 'events-oblast-counts',
    type: 'symbol',
    source: 'events-oblast-counts',
    maxzoom: EVENT_DETAIL_MIN_ZOOM,
    layout: {
      'text-field': ['to-string', ['get', 'count']],
      'text-size': 14,
      'text-font': ['Open Sans Semibold'],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      visibility: 'visible',
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
      'text-opacity': 0.95,
    },
  })

  lastEventsMap = map
  map.on('zoomend', () => applyEventsPointDataForCurrentZoom())
}

export async function setEventsDate(map: MlMap, requestedDateInt: number, skipMapUpdates = false): Promise<number> {
  lastEventsMap = map
  const year = Math.floor(requestedDateInt / 10000)
  await Promise.all([loadYear(year), loadOblasts()])

  // If the requested date has no data (e.g. today is past the dataset), fall back to the latest available date in that year.
  let dateInt = requestedDateInt
  if (!(store[requestedDateInt]?.length)) {
    const latestInYear = Object.keys(store)
      .map(Number)
      .filter((k) => Math.floor(k / 10000) === year)
      .reduce((max, k) => Math.max(max, k), 0)
    if (latestInYear > 0) dateInt = latestInYear
  }

  lastEventsDateInt = dateInt
  if (!skipMapUpdates) {
    applyEventsPointDataForCurrentZoom()
    if (map.getZoom() < EVENT_DETAIL_MIN_ZOOM) {
      const oblastCountSrc = map.getSource('events-oblast-counts') as GeoJSONSource | undefined
      oblastCountSrc?.setData(buildOblastCountGeoJSON(dateInt))
    }
  }
  return dateInt
}

export function setEventsTypeFilter(types: Set<string>): void {
  activeTypes = new Set(types)
  geoJSONCache.clear()
  oblastCountCache.clear()
  applyEventsPointDataForCurrentZoom()
  if (lastEventsMap && lastEventsDateInt != null) {
    const oblastCountSrc = lastEventsMap.getSource('events-oblast-counts') as GeoJSONSource | undefined
    oblastCountSrc?.setData(buildOblastCountGeoJSON(lastEventsDateInt))
  }
}

export type ProcessedEvent = { lng: number; lat: number; name: string; type: string; n: number; urls: string[]; dateInt?: number }

export function getLoadedEvents(): { dateInt: number; entries: ProcessedEvent[] } | null {
  if (lastEventsDateInt == null) return null
  return {
    dateInt: lastEventsDateInt,
    entries: (store[lastEventsDateInt] ?? []).map(([lng, lat, name, type, n, urls = []]) => ({ lng, lat, name, type, n, urls })),
  }
}

function distKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function queryEventsByLocation(
  _displayName: string,
  lng: number,
  lat: number,
  radiusKm = 8,
): Promise<ProcessedEvent[]> {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = 2022; y <= currentYear; y++) years.push(y)
  await Promise.all(years.map(loadYear))

  const results: ProcessedEvent[] = []
  for (const [dateKey, entries] of Object.entries(store)) {
    const di = Number(dateKey)
    for (const [eLng, eLat, evName, type, n, urls = []] of entries) {
      if (distKm(lng, lat, eLng, eLat) <= radiusKm)
        results.push({ lng: eLng, lat: eLat, name: evName, type, n, urls, dateInt: di })
    }
  }
  results.sort((a, b) => (a.dateInt ?? 0) - (b.dateInt ?? 0))
  return results
}
