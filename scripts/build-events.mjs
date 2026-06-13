#!/usr/bin/env node
/**
 * Fetches VIINA event data from GitHub and rebuilds viina-events-YYYY.json.
 *
 * Output entry format: [lng, lat, locationName, typeCode, nReports, urls]
 *
 * Usage:
 *   node scripts/build-events.mjs          # all years
 *   node scripts/build-events.mjs 2026     # single year
 */
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT    = resolve(__dir, '..')
const DATA    = resolve(ROOT, 'public/data')
const TMP     = resolve(ROOT, '.viina-tmp')
const BASE    = 'https://media.githubusercontent.com/media/zhukovyuri/VIINA/main/Data'
const YEARS   = [2022, 2023, 2024, 2025, 2026]

// First matching column wins; rest fall through to 'O'
const TYPE_MAP = [
  ['t_airstrike_b', 'S'],
  ['t_uav_b',       'D'],
  ['t_artillery_b', 'A'],
  ['t_firefight_b', 'F'],
  ['t_civcas_b',    'C'],
  ['t_armor_b',     'V'],
  ['t_milcas_b',    'M'],
  ['t_airalert_b',  'L'],
]

// ── CSV parser (handles quoted fields with embedded commas/newlines) ──────────
function parseCSV(content) {
  const rows = []
  let headers = null
  let field = ''
  let inQ = false
  let cols = []

  const flush = () => { cols.push(field); field = '' }
  const nextRow = () => {
    if (!headers) { headers = cols }
    else if (cols.length > 1) {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = cols[i] ?? '' })
      rows.push(obj)
    }
    cols = []
  }

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQ) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') { inQ = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQ = true }
      else if (ch === ',') { flush() }
      else if (ch === '\n') { flush(); nextRow() }
      else if (ch === '\r') { /* skip */ }
      else { field += ch }
    }
  }
  flush(); nextRow()
  return rows
}

function dl(url, dest) {
  console.log(`  ↓ ${url.split('/').pop()}`)
  execSync(`curl -sL "${url}" -o "${dest}"`)
}

function unzip(src, dest) {
  mkdirSync(dest, { recursive: true })
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${src}' -DestinationPath '${dest}'"`)
  } else {
    execSync(`unzip -o "${src}" -d "${dest}"`, { stdio: 'pipe' })
  }
}

function typeOf(row) {
  for (const [col, code] of TYPE_MAP) if (row[col] === '1') return code
  return 'O'
}

function processYear(year) {
  console.log(`\n── ${year} ──────────────────────────`)
  const tmp = resolve(TMP, String(year))
  mkdirSync(tmp, { recursive: true })

  // event_1pd ────────────────────────────────────────────────────────────────
  const zip1 = resolve(tmp, '1pd.zip')
  dl(`${BASE}/event_1pd_latest_${year}.zip`, zip1)
  unzip(zip1, resolve(tmp, '1pd'))
  const rows1pd = parseCSV(
    readFileSync(resolve(tmp, '1pd', `event_1pd_latest_${year}.csv`), 'utf8'),
  )
  console.log(`  ${rows1pd.length} events`)

  // event_info (for URLs) ────────────────────────────────────────────────────
  const zipI = resolve(tmp, 'info.zip')
  dl(`${BASE}/event_info_latest_${year}.zip`, zipI)
  unzip(zipI, resolve(tmp, 'info'))
  const rowsInfo = parseCSV(
    readFileSync(resolve(tmp, 'info', `event_info_latest_${year}.csv`), 'utf8'),
  )
  console.log(`  ${rowsInfo.length} source reports`)

  // Build URL lookup: event_id_1pd → string[]
  const urlMap = new Map()
  for (const row of rowsInfo) {
    const id = row['event_id_1pd']
    const url = row['url']
    if (!id || !url) continue
    const list = urlMap.get(id)
    if (list) list.push(url)
    else urlMap.set(id, [url])
  }

  // Aggregate by date ────────────────────────────────────────────────────────
  const byDate = {}
  for (const row of rows1pd) {
    const date = row['date']
    if (!date) continue
    const lng      = parseFloat(row['longitude'])
    const lat      = parseFloat(row['latitude'])
    const name     = row['asciiname'] || row['location'] || ''
    const typeCode = typeOf(row)
    const nReports = parseInt(row['n_reports']) || 1
    const urls     = urlMap.get(row['event_id_1pd']) ?? []
    if (!byDate[date]) byDate[date] = []
    byDate[date].push([lng, lat, name, typeCode, nReports, urls])
  }

  const out = resolve(DATA, `viina-events-${year}.json`)
  writeFileSync(out, JSON.stringify(byDate))
  const dates = Object.keys(byDate).length
  console.log(`  ✓ ${out} (${dates} dates)`)
}

mkdirSync(TMP, { recursive: true })
const years = process.argv[2] ? [parseInt(process.argv[2])] : YEARS
for (const year of years) processYear(year)
console.log('\nDone. You can delete .viina-tmp when finished.')
