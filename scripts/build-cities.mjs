#!/usr/bin/env node
/**
 * Downloads Ukrainian populated places from GeoNames and writes
 * public/data/ukraine-cities.json as a GeoJSON FeatureCollection.
 *
 * Each feature has: name, population, capital (bool)
 * Filtered to populated places (feature class P) with population > 0.
 *
 * Usage:
 *   node scripts/build-cities.mjs
 */
import { execSync } from 'child_process'
import { createReadStream, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const DATA = resolve(ROOT, 'public/data')
const TMP  = resolve(ROOT, '.geonames-tmp')

const URL  = 'https://download.geonames.org/export/dump/UA.zip'
const ZIP  = resolve(TMP, 'UA.zip')
const TXT  = resolve(TMP, 'UA.txt')

mkdirSync(TMP, { recursive: true })

console.log('Downloading GeoNames Ukraine dump…')
if (process.platform === 'win32') {
  execSync(`curl -L -o "${ZIP}" "${URL}"`, { stdio: 'inherit' })
  execSync(`powershell -Command "Expand-Archive -Force '${ZIP}' '${TMP}'"`)
} else {
  execSync(`curl -L -o "${ZIP}" "${URL}"`, { stdio: 'inherit' })
  execSync(`unzip -o "${ZIP}" UA.txt -d "${TMP}"`, { stdio: 'inherit' })
}

// GeoNames columns (tab-separated):
// 0:geonameid 1:name 2:asciiname 3:alternatenames 4:lat 5:lon
// 6:feature_class 7:feature_code 8:country 9:cc2
// 10:admin1 11:admin2 12:admin3 13:admin4
// 14:population 15:elevation 16:dem 17:timezone 18:modified

const CAPITAL_CODES = new Set(['PPLC', 'PPLA'])
const SKIP_CODES    = new Set(['PPLX', 'PPLS', 'PPLQ', 'PPLW']) // sections, historical

const features = []

console.log('Parsing…')
await new Promise((resolve, reject) => {
  const rl = createInterface({ input: createReadStream(TXT), crlfDelay: Infinity })
  rl.on('line', (line) => {
    const c = line.split('\t')
    if (c[6] !== 'P') return                    // only populated places
    if (SKIP_CODES.has(c[7])) return
    const pop = parseInt(c[14], 10) || 0
    if (pop < 200) return                        // skip tiny hamlets
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(c[5]), parseFloat(c[4])] },
      properties: {
        name:     c[1],
        pop,
        capital:  CAPITAL_CODES.has(c[7]),
      },
    })
  })
  rl.on('close', resolve)
  rl.on('error', reject)
})

features.sort((a, b) => b.properties.pop - a.properties.pop)

const out = { type: 'FeatureCollection', features }
writeFileSync(resolve(DATA, 'ukraine-cities.json'), JSON.stringify(out))
console.log(`Written ${features.length} settlements → public/data/ukraine-cities.json`)
