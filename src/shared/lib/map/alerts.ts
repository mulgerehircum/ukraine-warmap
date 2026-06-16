import type { Map as MlMap } from 'maplibre-gl'
import { setAlertState } from './oblasts'

// Maps alerts.in.ua region position (0-indexed in the `states` string)
// to MapLibre feature ID from ukraine-oblasts.geojson (generateId: true order).
// Derived from HASC codes in the geojson matched against alerts.in.ua region ordering.
const REGION_TO_FEATURE: readonly number[] = [
  23, // 0  Vinnytsia         UA.VI
  24, // 1  Volyn             UA.VO
   5, // 2  Dnipropetrovsk    UA.DP
   6, // 3  Donetsk           UA.DT
  27, // 4  Zhytomyr          UA.ZT
  25, // 5  Zakarpattia       UA.ZK
  26, // 6  Zaporizhzhia      UA.ZP
   7, // 7  Ivano-Frankivsk   UA.IF
  11, // 8  Kyiv Oblast       UA.KV
  13, // 9  Kirovohrad        UA.KH
  15, // 10 Luhansk           UA.LH
  14, // 11 Lviv              UA.LV
  16, // 12 Mykolaiv          UA.MY
  17, // 13 Odesa             UA.OD
  18, // 14 Poltava           UA.PL
  19, // 15 Rivne             UA.RV
  21, // 16 Sumy              UA.SM
  22, // 17 Ternopil          UA.TP
   8, // 18 Kharkiv           UA.KK
   9, // 19 Kherson           UA.KS
  10, // 20 Khmelnytskyi      UA.KM
   1, // 21 Cherkasy          UA.CK
   3, // 22 Chernivtsi        UA.CV
   2, // 23 Chernihiv         UA.CH
  12, // 24 Kyiv City         UA.KC
   4, // 25 Crimea            UA.KR
  20, // 26 Sevastopol        UA.SC
]

const POLL_INTERVAL = 30_000
const MAX_BACKOFF   = 300_000

let map: MlMap | null = null
let onCount: ((n: number, ids: Set<number>) => void) | undefined
let intervalId: ReturnType<typeof setTimeout> | null = null
let consecutiveFails = 0
let stopped = false
let lastAlerted = new Set<number>()

function parseStates(states: string): Set<number> {
  const alerted = new Set<number>()
  for (let i = 0; i < states.length && i < REGION_TO_FEATURE.length; i++) {
    // 'A' = air alert, 'P' = partial alert — both count as active
    if (states[i] !== 'N') alerted.add(REGION_TO_FEATURE[i])
  }
  return alerted
}

async function poll(): Promise<void> {
  if (!map || stopped) return
  try {
    const r = await fetch('/api/alerts', { signal: AbortSignal.timeout(8000) })
    if (r.status === 429) {
      consecutiveFails++
      if (consecutiveFails >= 3) {
        console.warn('[alerts] 3 consecutive 429s — polling stopped for session')
        stopped = true
        return
      }
      const backoff = Math.min(POLL_INTERVAL * (2 ** consecutiveFails), MAX_BACKOFF)
      schedule(backoff)
      return
    }
    if (!r.ok) { schedule(POLL_INTERVAL); return }

    consecutiveFails = 0
    const data = await r.json() as { states?: string }
    const states = data?.states ?? ''
    lastAlerted = parseStates(states)
    setAlertState(lastAlerted)
    onCount?.(lastAlerted.size, lastAlerted)
  } catch (e) {
    console.warn('[alerts] poll error:', e)
  }
  schedule(POLL_INTERVAL)
}

function schedule(delay: number): void {
  if (intervalId !== null) clearTimeout(intervalId)
  intervalId = setTimeout(poll, delay)
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    if (intervalId !== null) { clearTimeout(intervalId); intervalId = null }
  } else {
    schedule(0)
  }
}

export function initAlerts(m: MlMap, countCallback?: (n: number, ids: Set<number>) => void): void {
  map = m
  onCount = countCallback
  stopped = false
  consecutiveFails = 0
  document.addEventListener('visibilitychange', onVisibilityChange)
  schedule(0)
}

export function pauseAlerts(): void {
  setAlertState(new Set())
}

export function reapplyAlerts(): void {
  setAlertState(lastAlerted)
  onCount?.(lastAlerted.size, lastAlerted)
}

export function stopAlerts(): void {
  if (intervalId !== null) { clearTimeout(intervalId); intervalId = null }
  document.removeEventListener('visibilitychange', onVisibilityChange)
  map = null
}
