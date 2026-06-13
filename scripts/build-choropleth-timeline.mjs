#!/usr/bin/env node
/**
 * Pre-computes per-day per-oblast event counts and writes
 * public/data/choropleth-timeline.json.
 *
 * Output: { dates: number[], counts: number[][] }
 *   dates[i]  — dateInt (YYYYMMDD) for day i
 *   counts[i] — 28-element array; counts[i][j] = events in oblast j on day i
 *
 * At runtime the counts are turned into prefix sums once on load,
 * making cumulative-up-to-date lookup O(1).
 *
 * Usage:
 *   node scripts/build-choropleth-timeline.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(__dir, '..', 'public/data')
const YEARS = [2022, 2023, 2024, 2025, 2026]

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
  if (geometry.type === 'Polygon') return polygonContainsPoint(geometry.coordinates, lng, lat)
  return geometry.coordinates.some(poly => polygonContainsPoint(poly, lng, lat))
}

const oblasts = JSON.parse(readFileSync(`${DATA}/ukraine-oblasts.geojson`, 'utf8'))
const features = oblasts.features
const N = features.length

// dateInt → 28-element counts array
const byDate = new Map()

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
  for (const [dateStr, entries] of Object.entries(yearData)) {
    const di = parseInt(dateStr.replace(/-/g, ''), 10)
    if (!byDate.has(di)) byDate.set(di, new Array(N).fill(0))
    const row = byDate.get(di)
    for (const [lng, lat] of entries) {
      for (let i = 0; i < features.length; i++) {
        if (geometryContainsPoint(features[i].geometry, lng, lat)) {
          row[i]++
          yearCount++
          break
        }
      }
    }
  }
  console.log(`  ${year}: ${yearCount} events matched to oblasts`)
  totalEvents += yearCount
}

const sortedDates = [...byDate.keys()].sort((a, b) => a - b)

const out = {
  dates: sortedDates,
  counts: sortedDates.map(d => byDate.get(d)),
}

const outPath = `${DATA}/choropleth-timeline.json`
writeFileSync(outPath, JSON.stringify(out))
console.log(`Total: ${totalEvents} events`)
console.log(`Written: ${outPath} (${sortedDates.length} dates, ${N} oblasts)`)
