import { MercatorCoordinate } from 'maplibre-gl'
import {
  Group, Mesh, LineSegments,
  Shape, Path, ExtrudeGeometry, EdgesGeometry,
  MeshBasicMaterial, LineBasicMaterial,
  Color, Vector2, DoubleSide,
} from 'three'
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson'
import { scene, meterScale } from './threeLayer'

type OblastGeom = Polygon | MultiPolygon

// Max bar height expressed in Mercator units (computed once at Ukraine's centre).
const MAX_HEIGHT_MERC = 120_000 * meterScale(31, 49)
// Minimum height so low-count oblasts still show a visible sliver.
const MIN_HEIGHT_MERC = MAX_HEIGHT_MERC * 0.004

const COLOR_LOW  = new Color(0x4dd7fa) // cyan  — low event count
const COLOR_MID  = new Color(0xfcd34d) // amber — mid
const COLOR_HIGH = new Color(0xd32f2f) // red   — high

function barColor(ratio: number): Color {
  const out = new Color()
  return ratio < 0.5
    ? out.lerpColors(COLOR_LOW, COLOR_MID, ratio * 2)
    : out.lerpColors(COLOR_MID, COLOR_HIGH, (ratio - 0.5) * 2)
}

// GeoJSON rings are closed (last vertex == first); Three.js Shape closes automatically.
function ring2d(ring: Position[]): Vector2[] {
  return ring.slice(0, -1).map(([lng, lat]) => {
    const mc = MercatorCoordinate.fromLngLat({ lng, lat })
    return new Vector2(mc.x, mc.y)
  })
}

function polygonToShape(coords: Position[][]): Shape {
  const shape = new Shape(ring2d(coords[0]))
  for (let i = 1; i < coords.length; i++) shape.holes.push(new Path(ring2d(coords[i])))
  return shape
}

function buildGeom(feature: Feature<OblastGeom>): ExtrudeGeometry {
  const { geometry } = feature
  const shapes = geometry.type === 'Polygon'
    ? [polygonToShape(geometry.coordinates)]
    : geometry.coordinates.map(polygonToShape)
  return new ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false })
}

interface Bar { fill: Mesh; edges: LineSegments }

const barsGroup = new Group()
scene.add(barsGroup)
const bars: (Bar | null)[] = []

export async function initOblastBars(): Promise<void> {
  const res = await fetch('/data/ukraine-oblasts.geojson')
  const { features } = await res.json() as { features: Feature<OblastGeom>[] }

  features.forEach((feature, idx) => {
    const geom = buildGeom(feature)

    const fill = new Mesh(geom, new MeshBasicMaterial({
      color: COLOR_LOW.clone(),
      transparent: true,
      opacity: 0.45,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
    }))
    fill.visible = false

    const edges = new LineSegments(new EdgesGeometry(geom), new LineBasicMaterial({
      color: COLOR_LOW.clone(),
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    }))
    edges.visible = false

    barsGroup.add(fill, edges)
    bars[idx] = { fill, edges }
  })
}

export function updateOblastBars(counts: Map<number, number>): void {
  let max = 0
  counts.forEach(v => { if (v > max) max = v })

  if (max === 0) {
    bars.forEach(b => { if (b) { b.fill.visible = false; b.edges.visible = false } })
    return
  }

  bars.forEach((bar, idx) => {
    if (!bar) return
    const count = counts.get(idx) ?? 0

    if (count === 0) {
      bar.fill.visible = false
      bar.edges.visible = false
      return
    }

    const ratio  = count / max
    const height = Math.max(MIN_HEIGHT_MERC, MAX_HEIGHT_MERC * ratio)

    bar.fill.scale.z  = height
    bar.edges.scale.z = height
    bar.fill.visible  = true
    bar.edges.visible = true

    const col = barColor(ratio)
    ;(bar.fill.material  as MeshBasicMaterial).color.copy(col)
    ;(bar.fill.material  as MeshBasicMaterial).opacity = 0.15 + ratio * 0.45
    ;(bar.edges.material as LineBasicMaterial).color.copy(col)
  })
}

export function setOblastBarsVisible(visible: boolean): void {
  barsGroup.visible = visible
}
