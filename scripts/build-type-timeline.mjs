#!/usr/bin/env node
/**
 * Groups VIINA events by day into 5 categories and outputs per-day counts.
 * Output: public/data/type-timeline.json
 * Format: { start: 20220224, Air: number[], Artillery: number[], Ground: number[], Casualties: number[], Other: number[] }
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = resolve(__dir, '..')
const DATA  = resolve(ROOT, 'public/data')
const YEARS = [2022, 2023, 2024, 2025, 2026]

const WAR_START = Date.UTC(2022, 1, 24)

const TYPE_TO_GROUP = {
  S: 'Airstrike',
  D: 'Drone',
  A: 'Artillery',
  F: 'Ground', V: 'Ground',
  C: 'Other', M: 'Other', L: 'Other', O: 'Other',
}
const GROUPS = ['Airstrike', 'Drone', 'Artillery', 'Ground', 'Other']

function dateIntToDay(di) {
  const y = Math.floor(di / 10000)
  const m = Math.floor(di / 100) % 100 - 1
  const d = di % 100
  return Math.floor((Date.UTC(y, m, d) - WAR_START) / 86_400_000)
}

const dayCounts = {}
let maxDay = 0

for (const year of YEARS) {
  const path = resolve(DATA, `viina-events-${year}.json`)
  if (!existsSync(path)) { console.warn(`  skipping missing: viina-events-${year}.json`); continue }
  const data = JSON.parse(readFileSync(path, 'utf8'))
  for (const [dateStr, entries] of Object.entries(data)) {
    const day = dateIntToDay(Number(dateStr))
    if (day < 0) continue
    if (!dayCounts[day]) dayCounts[day] = Object.fromEntries(GROUPS.map(g => [g, 0]))
    for (const ev of entries) {
      const group = TYPE_TO_GROUP[ev[3]] ?? 'Other'
      dayCounts[day][group]++
    }
    if (day > maxDay) maxDay = day
  }
}

const result = { start: 20220224 }
for (const group of GROUPS) {
  result[group] = Array.from({ length: maxDay + 1 }, (_, i) => dayCounts[i]?.[group] ?? 0)
}

writeFileSync(resolve(DATA, 'type-timeline.json'), JSON.stringify(result))
console.log(`✓ type-timeline.json — ${maxDay + 1} days`)
