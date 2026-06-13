import type { Map } from 'maplibre-gl'

type Transition = [number, string] // [YYYYMMDD, status]
type Timeline = Record<string, Transition[]>

let timeline: Timeline | null = null
let timelineEntries: [number, Transition[]][] = [] // pre-computed to avoid Object.entries() per tick
const prevStatuses = new Map<number, string>()
const liberationDates = new Map<number, number>() // cellId → dateInt of last LIBERATED transition

export async function loadTimeline(): Promise<void> {
  const res = await fetch('/data/viina-timeline.json')
  timeline = await res.json() as Timeline
  timelineEntries = Object.entries(timeline).map(([gnStr, transitions]) => [Number(gnStr), transitions])
  for (const [gn, transitions] of timelineEntries) {
    for (let i = transitions.length - 1; i >= 0; i--) {
      if (transitions[i][1] === 'LIBERATED') {
        liberationDates.set(gn, transitions[i][0])
        break
      }
    }
  }
}

export function getLiberationDate(cellId: number): number | null {
  return liberationDates.get(cellId) ?? null
}

function statusAtDate(transitions: Transition[], dateInt: number): string {
  let lo = 0, hi = transitions.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (transitions[mid][0] <= dateInt) { found = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  if (found < 0) return 'UA'

  const raw = transitions[found][1]

  // Frontline noise: if 4+ flips in the last 30 days, call it CONTESTED
  const cutoff = dateInt - 30
  let flips = 0
  for (let i = found; i >= 0 && transitions[i][0] >= cutoff; i--) flips++
  if (flips >= 4) return 'CONTESTED'

  return raw
}

export function setOccupationDate(map: Map, dateInt: number): void {
  for (const [gn, transitions] of timelineEntries) {
    const status = statusAtDate(transitions, dateInt)
    if (prevStatuses.get(gn) !== status) {
      map.setFeatureState({ source: 'occupation', id: gn }, { status })
      prevStatuses.set(gn, status)
    }
  }
}

export function dateToInt(date: Date): number {
  return (
    date.getUTCFullYear() * 10000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  )
}
