#!/usr/bin/env node
/**
 * Reads viina-events-YYYY.json files and outputs a compact daily event count array.
 * Output: public/data/timeline-summary.json
 * Format: { start: 20220224, counts: number[] }  (index 0 = Feb 24 2022)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = resolve(__dir, '..')
const DATA  = resolve(ROOT, 'public/data')
const YEARS = [2022, 2023, 2024, 2025, 2026]

const WAR_START = Date.UTC(2022, 1, 24)

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
    dayCounts[day] = (dayCounts[day] || 0) + entries.length
    if (day > maxDay) maxDay = day
  }
}

const counts = Array.from({ length: maxDay + 1 }, (_, i) => dayCounts[i] || 0)
const peak = Math.max(...counts)

writeFileSync(resolve(DATA, 'timeline-summary.json'), JSON.stringify({ start: 20220224, counts }))
console.log(`✓ timeline-summary.json — ${counts.length} days, peak ${peak} events/day`)
