import type { Map } from 'maplibre-gl'

const SIZE = 48

// Spectrum-spread palette: red → orange → amber → green → teal → blue → purple → pink → grey
export const TYPE_DEFS: Record<string, { color: string }> = {
  S: { color: '#e53935' }, // Airstrike        – red
  A: { color: '#fb8c00' }, // Artillery        – orange
  F: { color: '#f9a825' }, // Firefight        – amber
  V: { color: '#43a047' }, // Armor            – green
  L: { color: '#00acc1' }, // Air alert        – teal
  M: { color: '#1e88e5' }, // Military cas.    – blue
  D: { color: '#8e24aa' }, // Drone/UAV        – purple
  C: { color: '#d81b60' }, // Civilian cas.    – pink
  O: { color: '#757575' }, // Other            – grey
}

function makeIcon(type: string, color: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const sc = SIZE / 20   // scale 20-unit SVG coords → canvas pixels

  ctx.save()
  ctx.scale(sc, sc)
  ctx.lineJoin = 'round'
  ctx.lineCap  = 'round'

  // ── Frame ──────────────────────────────────────────────────────────
  ctx.beginPath()
  if (type === 'S' || type === 'D' || type === 'L') {
    // Air: pentagon
    ctx.moveTo(10, 2); ctx.lineTo(18, 8); ctx.lineTo(18, 17)
    ctx.lineTo(2, 17); ctx.lineTo(2, 8); ctx.closePath()
  } else if (type === 'O') {
    // Unknown: diamond
    ctx.moveTo(10, 2); ctx.lineTo(18, 10); ctx.lineTo(10, 18)
    ctx.lineTo(2, 10); ctx.closePath()
  } else {
    // Ground: rectangle
    ctx.rect(2, 6, 16, 8)
  }
  ctx.fillStyle   = color
  ctx.fill()
  ctx.lineWidth   = 0.5
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.stroke()

  // ── Inner symbol (white) ───────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.fillStyle   = 'rgba(255,255,255,0.9)'
  ctx.lineWidth   = 1.2

  if (type === 'S') {
    // Swept-wing aircraft
    ctx.beginPath()
    ctx.moveTo(10, 9); ctx.lineTo(5, 14)
    ctx.moveTo(10, 9); ctx.lineTo(15, 14)
    ctx.moveTo(10, 9); ctx.lineTo(10, 15)
    ctx.stroke()
  } else if (type === 'D') {
    // Filled delta-wing silhouette
    ctx.beginPath()
    ctx.moveTo(10, 8); ctx.lineTo(16, 15); ctx.lineTo(10, 13); ctx.lineTo(4, 15)
    ctx.closePath(); ctx.fill()
  } else if (type === 'A') {
    // Upward arc (indirect fire)
    ctx.beginPath()
    ctx.moveTo(6, 13); ctx.bezierCurveTo(6, 8.5, 14, 8.5, 14, 13)
    ctx.stroke()
  } else if (type === 'F') {
    // Diagonal cross (infantry engagement)
    ctx.beginPath()
    ctx.moveTo(6, 8); ctx.lineTo(14, 13)
    ctx.moveTo(14, 8); ctx.lineTo(6, 13)
    ctx.stroke()
  } else if (type === 'C') {
    // Head + body + shoulders
    ctx.beginPath(); ctx.arc(10, 8.5, 1.8, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(10, 10.3); ctx.lineTo(10, 13)
    ctx.moveTo(7.5, 11.2); ctx.lineTo(12.5, 11.2)
    ctx.stroke()
  } else if (type === 'V') {
    // Oval (armor)
    ctx.beginPath(); ctx.ellipse(10, 10, 5, 2.5, 0, 0, Math.PI * 2); ctx.stroke()
  } else if (type === 'M') {
    // Cross (medical/casualties)
    ctx.beginPath()
    ctx.moveTo(10, 7.5); ctx.lineTo(10, 12.5)
    ctx.moveTo(7, 10); ctx.lineTo(13, 10)
    ctx.stroke()
  } else if (type === 'L') {
    // Upward arrow (incoming air threat)
    ctx.beginPath()
    ctx.moveTo(10, 16); ctx.lineTo(10, 9)
    ctx.moveTo(7, 12); ctx.lineTo(10, 9)
    ctx.moveTo(13, 12); ctx.lineTo(10, 9)
    ctx.stroke()
  } else if (type === 'O') {
    // Circle (unknown track)
    ctx.beginPath(); ctx.arc(10, 10, 2.5, 0, Math.PI * 2); ctx.stroke()
  }

  ctx.restore()
  return ctx.getImageData(0, 0, SIZE, SIZE)
}

export function loadEventIcons(map: Map): void {
  for (const [type, { color }] of Object.entries(TYPE_DEFS)) {
    const id = `evt-${type}`
    if (map.hasImage(id)) continue
    map.addImage(id, makeIcon(type, color))
  }
}

function makeClusterIcon(label: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.beginPath()
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2)
  ctx.fillStyle = '#263238'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(SIZE * 0.34)}px system-ui,sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, SIZE / 2, SIZE / 2 + 1)

  return ctx.getImageData(0, 0, SIZE, SIZE)
}

export function loadClusterIcons(map: Map): void {
  for (let n = 3; n <= 9; n++) {
    const id = `evt-cluster-${n}`
    if (!map.hasImage(id)) map.addImage(id, makeClusterIcon(String(n)))
  }
  if (!map.hasImage('evt-cluster-9plus')) {
    map.addImage('evt-cluster-9plus', makeClusterIcon('9+'))
  }
}
