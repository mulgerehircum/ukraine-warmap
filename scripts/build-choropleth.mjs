#!/usr/bin/env node
/**
 * Pre-computes total event counts per oblast across all years and writes
 * public/data/oblast-choropleth.json — a plain array where index i is the
 * total event count for the i-th feature in ukraine-oblasts.geojson.
 *
 * Usage:
 *   node scripts/build-choropleth.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(__dir, '..', 'public/data')
const YEARS = [2022, 2023, 2024, 2025, 2026]

// --- Point-in-polygon (same algorithm as events.ts) -------------------------

function ringContainsPoint(ring, lng, lat) {
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

function polygonContainsPoint(coords, lng, lat) {
  if (!coords.length || !ringContainsPoint(coords[0], lng, lat)) return false
  for (let i = 1; i < coords.length; i++) {
    if (ringContainsPoint(coords[i], lng, lat)) return false
  }
  return true
}

function geometryContainsPoint(geometry, lng, lat) {
  if (geometry.type === 'Polygon') {
    return polygonContainsPoint(geometry.coordinates, lng, lat)
  }
  return geometry.coordinates.some(poly => polygonContainsPoint(poly, lng, lat))
}

// ---------------------------------------------------------------------------

const oblasts = JSON.parse(readFileSync(`${DATA}/ukraine-oblasts.geojson`, 'utf8'))
const features = oblasts.features

// Each entry: { total, S, D, A, F, C, V, M, L } — 'Other' excluded
const KNOWN_TYPES = new Set(['S','D','A','F','C','V','M','L'])
const data = features.map(() => ({ total: 0, S: 0, D: 0, A: 0, F: 0, C: 0, V: 0, M: 0, L: 0 }))

let totalEvents = 0

for (const year of YEARS) {
  const path = `${DATA}/viina-events-${year}.json`
  let yearData
  try {
    yearData = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    console.warn(`  skipping ${year} (file not found)`)
    continue
  }

  let yearCount = 0
  for (const entries of Object.values(yearData)) {
    for (const [lng, lat, , typeCode] of entries) {
      if (!KNOWN_TYPES.has(typeCode)) continue  // skip 'Other'
      for (let i = 0; i < features.length; i++) {
        if (geometryContainsPoint(features[i].geometry, lng, lat)) {
          data[i].total++
          data[i][typeCode]++
          yearCount++
          break
        }
      }
    }
  }
  console.log(`  ${year}: ${yearCount} events matched to oblasts`)
  totalEvents += yearCount
}

const totals = data.map(d => d.total).filter(t => t > 0)
console.log(`Total: ${totalEvents} events across ${features.length} oblasts`)
console.log(`Range: ${Math.min(...totals)}–${Math.max(...totals)}`)

const out = `${DATA}/oblast-choropleth.json`
writeFileSync(out, JSON.stringify(data))
console.log(`Written: ${out}`)
