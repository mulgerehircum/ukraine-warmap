import { MercatorCoordinate } from 'maplibre-gl'
import {
  Group, Mesh, LineSegments,
  CylinderGeometry, EdgesGeometry,
  MeshBasicMaterial, LineBasicMaterial,
  Color,
} from 'three'
import { scene, meterScale } from './threeLayer'
import { getOblastBreakdown } from './oblasts'
import { TYPE_DEFS } from './eventIcons'

// Landmark cities from the broadcast TODO, each pinned to its containing oblast
// feature index (generateId order from ukraine-oblasts.geojson, same as
// REGION_TO_FEATURE in alerts.ts).
const SPIKE_CITIES = [
  { name: 'Kyiv',         lng: 30.5238, lat: 50.4546, oblastIdx: 12 },
  { name: 'Kharkiv',      lng: 36.2547, lat: 49.9818, oblastIdx: 8  },
  { name: 'Odesa',        lng: 30.7326, lat: 46.4825, oblastIdx: 17 },
  { name: 'Mariupol',     lng: 37.5527, lat: 47.1117, oblastIdx: 6  },
  { name: 'Zaporizhzhia', lng: 35.1682, lat: 47.8388, oblastIdx: 26 },
  { name: 'Lviv',         lng: 24.0297, lat: 49.8397, oblastIdx: 14 },
  { name: 'Kherson',      lng: 32.6178, lat: 46.6354, oblastIdx: 9  },
  { name: 'Donetsk',      lng: 37.8029, lat: 48.0159, oblastIdx: 6  },
] as const

const SCALE           = meterScale(31, 49)
const MAX_SPIKE_MERC  = 120_000 * SCALE
const MIN_SPIKE_MERC  = MAX_SPIKE_MERC * 0.005
const R_BASE          = 18_000 * SCALE  // 18km base — visible at Ukraine overview zoom
const R_TIP           = 2_000  * SCALE  // 2km  tip

// Unit cylinder along Z, base at z=0, tip at z=1. Shared across all spikes.
const _cyl = new CylinderGeometry(R_TIP, R_BASE, 1, 10)
_cyl.rotateX(Math.PI / 2)
_cyl.translate(0, 0, 0.5)

const _edges = new EdgesGeometry(_cyl)

interface Spike { fill: Mesh; outline: LineSegments }

const spikesGroup = new Group()
scene.add(spikesGroup)
const spikes: Spike[] = []

export function initCitySpikes(): void {
  SPIKE_CITIES.forEach(({ lng, lat }) => {
    const mc = MercatorCoordinate.fromLngLat({ lng, lat })

    const fill = new Mesh(_cyl, new MeshBasicMaterial({
      color: new Color(0xfcd34d),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      depthTest: false,
    }))
    fill.position.set(mc.x, mc.y, 0)
    fill.scale.z = 0
    fill.visible = false

    const outline = new LineSegments(_edges, new LineBasicMaterial({
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }))
    outline.position.set(mc.x, mc.y, 0)
    outline.scale.z = 0
    outline.visible = false

    spikesGroup.add(fill, outline)
    spikes.push({ fill, outline })
  })
}

function dominantType(oblastIdx: number): string {
  const bd = getOblastBreakdown(oblastIdx)
  if (!bd) return 'A'
  const { total: _, ...types } = bd
  let best = 'A', bestVal = 0
  for (const [k, v] of Object.entries(types as Record<string, number>)) {
    if (k !== 'O' && v > bestVal) { best = k; bestVal = v }
  }
  return best
}

export function updateCitySpikes(counts: Map<number, number>): void {
  let max = 0
  counts.forEach(v => { if (v > max) max = v })

  if (max === 0) {
    spikes.forEach(s => { s.fill.visible = false; s.outline.visible = false })
    return
  }

  SPIKE_CITIES.forEach(({ oblastIdx }, i) => {
    const spike = spikes[i]
    if (!spike) return

    const count = counts.get(oblastIdx) ?? 0
    if (count === 0) {
      spike.fill.visible = false
      spike.outline.visible = false
      return
    }

    const ratio  = count / max
    const height = Math.max(MIN_SPIKE_MERC, MAX_SPIKE_MERC * ratio)

    spike.fill.scale.z    = height
    spike.outline.scale.z = height
    spike.fill.visible    = true
    spike.outline.visible = true

    const hex = TYPE_DEFS[dominantType(oblastIdx)]?.color ?? '#fcd34d'
    const col = new Color(hex)
    ;(spike.fill.material    as MeshBasicMaterial).color.copy(col)
    ;(spike.outline.material as LineBasicMaterial).color.copy(col)
    ;(spike.fill.material    as MeshBasicMaterial).opacity = 0.45 + ratio * 0.4
  })
}

export function setCitySpikesVisible(visible: boolean): void {
  spikesGroup.visible = visible
}
