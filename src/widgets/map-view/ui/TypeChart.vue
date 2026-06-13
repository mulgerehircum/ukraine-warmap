<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { loadTypeTimeline, GROUP_COLORS, GROUP_ORDER } from '../../../shared/lib/map/typeTimeline'
import type { TypeTimelineData, GroupKey } from '../../../shared/lib/map/typeTimeline'

const props = defineProps<{ activeDate: Date }>()
const emit = defineEmits<{ change: [date: Date]; playing: [value: boolean]; filterType: [keys: GroupKey[]] }>()

const selectedTypes = ref(new Set<GroupKey>())

function toggleType(key: GroupKey) {
  if (selectedTypes.value.has(key)) selectedTypes.value.delete(key)
  else selectedTypes.value.add(key)
  selectedTypes.value = new Set(selectedTypes.value)
  emit('filterType', [...selectedTypes.value])
  draw()
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

const WAR_START_MS = Date.UTC(2022, 1, 24)
const MS_PER_DAY   = 86_400_000
const SMOOTH_WINDOW = 14
const PLAY_SPEED    = 20

let data: TypeTimelineData | null = null
let smoothed: Record<GroupKey, number[]> = {} as any
let normalized: Record<GroupKey, number[]> = {} as any
let ro: ResizeObserver | null = null
let dragging = false

const zoomVisible   = ref(false)
const zoomCursorDay = ref(0)
const zoomRadius    = ref(45)
const zoomHoverDay  = ref<number | null>(null)
const handleHovered = ref(false)
let zoomDragging    = false
const lensDateFmt   = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })

function lensGeometry() {
  const c = canvasRef.value
  if (!c || !zoomVisible.value || !data) return null
  const W   = c.offsetWidth
  const len = data[GROUP_ORDER[0]].length
  const LW  = Math.round(W * 0.24)
  const cx  = Math.round((zoomCursorDay.value / (len - 1)) * W)
  const lx  = Math.max(0, Math.min(W - LW, cx - LW / 2))
  return { lx, LW }
}

function isOverHandle(clientX: number, clientY: number): boolean {
  const c = canvasRef.value
  if (!c) return false
  const geo = lensGeometry()
  if (!geo) return false
  const rect  = c.getBoundingClientRect()
  const cssX  = clientX - rect.left
  const cssY  = clientY - rect.top
  const gridW = 3 * 2 + 2 * 3.5
  const gx0   = geo.lx + geo.LW / 2 - gridW / 2
  const gy0   = 5
  return cssX >= gx0 - 5 && cssX <= gx0 + gridW + 5 && cssY >= gy0 - 5 && cssY <= gy0 + 12
}

function setCursor(val: string) {
  if (canvasRef.value) canvasRef.value.style.cursor = val
}

function dayFromLensX(clientX: number): number | null {
  const c = canvasRef.value
  if (!c || !zoomVisible.value || !data) return null
  const rect = c.getBoundingClientRect()
  const cssX = clientX - rect.left
  const W    = c.offsetWidth
  const len  = data[GROUP_ORDER[0]].length
  const LW   = Math.round(W * 0.24)
  const cx   = Math.round((zoomCursorDay.value / (len - 1)) * W)
  const lx   = Math.max(0, Math.min(W - LW, cx - LW / 2))
  if (cssX < lx || cssX > lx + LW) return null
  const zVS = zoomCursorDay.value - zoomRadius.value
  return Math.round(zVS + ((cssX - lx) / LW) * zoomRadius.value * 2)
}

function drawZoomLens(ctx: CanvasRenderingContext2D, W: number, H: number) {
  if (!data) return
  const len  = data[GROUP_ORDER[0]].length
  const LW   = Math.round(W * 0.24)
  const cx   = Math.round((zoomCursorDay.value / (len - 1)) * W)
  const lx   = Math.max(0, Math.min(W - LW, cx - LW / 2))
  const zVS  = zoomCursorDay.value - zoomRadius.value
  const zVE  = zoomCursorDay.value + zoomRadius.value
  const zLen = zVE - zVS
  const sel  = selectedTypes.value

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(lx, 0, LW, H, [8, 8, 0, 0])
  ctx.clip()
  ctx.clearRect(lx, 0, LW, H)
  ctx.translate(lx, 0)

  // Stacked areas in zoomed space
  const N        = LW + 1
  const baseline = new Array(N).fill(0)

  for (const key of GROUP_ORDER) {
    const color   = GROUP_COLORS[key]
    const dimmed  = sel.size > 0 && !sel.has(key)
    const fillA   = dimmed ? 0.07 : 0.62
    const strokeA = dimmed ? 0.15 : 0.9

    const topVals = Array.from({ length: N }, (_, px) => {
      const dayIdx = Math.max(0, Math.min(len - 1, Math.round(zVS + (px / LW) * zLen)))
      return baseline[px] + (normalized[key][dayIdx] ?? 0)
    })

    ctx.beginPath()
    ctx.moveTo(0, H - baseline[0] * H)
    for (let px = 0; px < N; px++) ctx.lineTo(px, H - baseline[px] * H)
    for (let px = N - 1; px >= 0; px--) ctx.lineTo(px, H - topVals[px] * H)
    ctx.closePath()
    ctx.fillStyle = hexToRgba(color, fillA)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(0, H - topVals[0] * H)
    for (let px = 1; px < N; px++) ctx.lineTo(px, H - topVals[px] * H)
    ctx.strokeStyle = hexToRgba(color, strokeA)
    ctx.lineWidth = dimmed ? 0.75 : 1.5
    ctx.stroke()

    for (let px = 0; px < N; px++) baseline[px] = topVals[px]
  }

  // Playhead
  if (dayFrac >= zVS && dayFrac <= zVE) {
    const px = (dayFrac - zVS) / zLen * LW
    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(Math.round(px) - 5, 0, 10, H)
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillRect(Math.round(px) - 0.5, 0, 1, H)
  }

  // Hover line + date
  const zhd = zoomHoverDay.value
  if (zhd !== null && zhd >= zVS && zhd <= zVE) {
    const px = (zhd - zVS) / zLen * LW
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(Math.round(px) - 1, 0, 2, H)
    ctx.save()
    ctx.font = '700 10px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'top'
    const isRight = px > LW / 2
    ctx.textAlign = isRight ? 'right' : 'left'
    ctx.fillStyle = 'rgba(243,244,246,0.9)'
    ctx.fillText(dateFmt.format(new Date(WAR_START_MS + Math.round(zhd) * MS_PER_DAY)), Math.round(px) + (isRight ? -6 : 6), 4)
    ctx.restore()
  }

  // Edge date labels
  ctx.save()
  ctx.font = '600 9px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(243,244,246,0.45)'
  ctx.fillText(lensDateFmt.format(new Date(WAR_START_MS + Math.max(0, Math.round(zVS)) * MS_PER_DAY)), 6, 5)
  ctx.textAlign = 'right'
  ctx.fillText(lensDateFmt.format(new Date(WAR_START_MS + Math.min(len - 1, Math.round(zVE)) * MS_PER_DAY)), LW - 6, 5)
  ctx.restore()

  ctx.restore() // undo translate + clip

  // Border
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(lx + 0.5, 0.5, LW - 1, H - 0.5, [8, 8, 0, 0])
  ctx.stroke()
  ctx.restore()

  // Drag handle dots
  const DOT = 2, GAP = 3.5, COLS = 3, ROWS = 2
  const gridW = COLS * DOT + (COLS - 1) * GAP
  const gx0   = lx + LW / 2 - gridW / 2
  const gy0   = 5
  ctx.fillStyle = handleHovered.value ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)'
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      ctx.beginPath()
      ctx.arc(gx0 + col * (DOT + GAP) + DOT / 2, gy0 + row * (DOT + GAP) + DOT / 2, DOT / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const playing  = ref(false)
const curDay   = ref(0)
let dayFrac    = 0
let maxDay     = 0
let rafId: number | null = null
let lastTs: number | null = null
let lastEmitMs = 0

const dateFmt  = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateLabel = computed(() => dateFmt.format(new Date(WAR_START_MS + curDay.value * MS_PER_DAY)))

function dateToDay(d: Date): number {
  return Math.floor((d.getTime() - WAR_START_MS) / 86_400_000)
}

function dayToDate(day: number): Date {
  return new Date(WAR_START_MS + day * 86_400_000)
}

function xToDay(x: number): number {
  const canvas = canvasRef.value
  if (!canvas || !data) return 0
  const W = canvas.offsetWidth
  const len = data[GROUP_ORDER[0]].length
  return Math.max(0, Math.min(len - 1, Math.round((x / W) * (len - 1))))
}

function emitDay(day: number) {
  const d = new Date(WAR_START_MS + day * MS_PER_DAY)
  d.setUTCHours(0, 0, 0, 0)
  emit('change', d)
}

function startPlay() {
  if (curDay.value >= maxDay) { dayFrac = 0; curDay.value = 0 }
  playing.value = true; lastTs = null
  rafId = requestAnimationFrame(tick)
  emit('playing', true)
}

function stopPlay() {
  playing.value = false
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  lastTs = null
  emit('playing', false)
}

function tick(ts: number) {
  if (!playing.value) return
  if (lastTs === null) lastTs = ts
  const dt = Math.min(ts - lastTs, 100); lastTs = ts
  dayFrac += (dt / 1000) * PLAY_SPEED
  const newDay = Math.min(Math.floor(dayFrac), maxDay)
  if (newDay !== curDay.value) curDay.value = newDay
  draw()
  if (ts - lastEmitMs > 100) { lastEmitMs = ts; emitDay(newDay) }
  if (dayFrac >= maxDay) {
    dayFrac = maxDay; curDay.value = maxDay
    draw(); emitDay(maxDay); stopPlay(); return
  }
  rafId = requestAnimationFrame(tick)
}

function togglePlay() { if (playing.value) stopPlay(); else startPlay() }

watch(() => props.activeDate, (d) => {
  const day = dateToDay(d)
  if (Math.floor(dayFrac) !== day) { dayFrac = day; curDay.value = day; draw() }
})

function rollingAvg(arr: number[], w: number): number[] {
  const half = Math.floor(w / 2)
  return arr.map((_, i) => {
    const s = Math.max(0, i - half)
    const e = Math.min(arr.length, i + half + 1)
    let sum = 0
    for (let j = s; j < e; j++) sum += arr[j]
    return sum / (e - s)
  })
}

function prepare(d: TypeTimelineData) {
  for (const key of GROUP_ORDER) smoothed[key] = rollingAvg(d[key], SMOOTH_WINDOW)
  const len = d[GROUP_ORDER[0]].length
  for (const key of GROUP_ORDER) normalized[key] = new Array(len).fill(0)
  let maxTotal = 0
  for (let i = 0; i < len; i++) {
    const total = GROUP_ORDER.reduce((s, k) => s + smoothed[k][i], 0)
    if (total > maxTotal) maxTotal = total
  }
  if (maxTotal === 0) return
  for (let i = 0; i < len; i++) {
    for (const key of GROUP_ORDER) normalized[key][i] = smoothed[key][i] / maxTotal
  }
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !data) return
  const dpr = window.devicePixelRatio || 1
  const W = canvas.offsetWidth
  const H = canvas.offsetHeight
  if (W === 0 || H === 0) return
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)
  const len = data[GROUP_ORDER[0]].length
  const xAt = (day: number) => (day / (len - 1)) * W
  const yAt = (pct: number) => H - pct * H
  const sel = selectedTypes.value
  const baseline = new Array(len).fill(0)
  for (const key of GROUP_ORDER) {
    const color   = GROUP_COLORS[key]
    const dimmed  = sel.size > 0 && !sel.has(key)
    const fillA   = dimmed ? 0.07 : 0.62
    const strokeA = dimmed ? 0.15 : 0.9
    const top = baseline.map((b, i) => b + (normalized[key][i] ?? 0))
    ctx.beginPath()
    ctx.moveTo(xAt(0), yAt(baseline[0]))
    for (let i = 1; i < len; i++) ctx.lineTo(xAt(i), yAt(baseline[i]))
    for (let i = len - 1; i >= 0; i--) ctx.lineTo(xAt(i), yAt(top[i]))
    ctx.closePath()
    ctx.fillStyle = hexToRgba(color, fillA)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(xAt(0), yAt(top[0]))
    for (let i = 1; i < len; i++) ctx.lineTo(xAt(i), yAt(top[i]))
    ctx.strokeStyle = hexToRgba(color, strokeA)
    ctx.lineWidth = dimmed ? 1 : 1.5
    ctx.stroke()
    for (let i = 0; i < len; i++) baseline[i] = top[i]
  }
  const cursorDay = Math.max(0, Math.min(len - 1, dateToDay(props.activeDate)))
  const cx = xAt(cursorDay)
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.stroke()

  if (zoomVisible.value) drawZoomLens(ctx, W, H)
}

function seek(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  emit('change', dayToDate(xToDay(e.clientX - rect.left)))
}

function onWheel(e: WheelEvent) {
  const c = canvasRef.value
  if (!c || !data) return
  const rect  = c.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const len   = data[GROUP_ORDER[0]].length
  zoomCursorDay.value = Math.round(ratio * (len - 1))
  const factor = e.deltaY > 0 ? 1.3 : 1 / 1.3
  zoomRadius.value = Math.max(7, Math.min(120, Math.round(zoomRadius.value * factor)))
  zoomVisible.value = true
  draw()
}

function onPointerDown(e: PointerEvent) {
  const lensDay = zoomVisible.value ? dayFromLensX(e.clientX) : null
  if (lensDay !== null) {
    if (!isOverHandle(e.clientX, e.clientY)) {
      if (playing.value) stopPlay()
      emit('change', dayToDate(Math.max(0, Math.min(maxDay, lensDay))))
    }
    zoomDragging = true
    setCursor('grabbing')
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    return
  }
  if (playing.value) stopPlay()
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  seek(e)
}

function onPointerMove(e: PointerEvent) {
  if (zoomDragging) {
    const c = canvasRef.value
    if (c && data) {
      const rect  = c.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const len   = data[GROUP_ORDER[0]].length
      zoomCursorDay.value = Math.round(ratio * (len - 1))
      zoomHoverDay.value  = dayFromLensX(e.clientX)
    }
    draw(); return
  }
  if (dragging) { seek(e); return }
  const lensDay = dayFromLensX(e.clientX)
  zoomHoverDay.value = lensDay
  if (zoomVisible.value && lensDay === null) { zoomVisible.value = false }
  const onHandle = isOverHandle(e.clientX, e.clientY)
  if (handleHovered.value !== onHandle) { handleHovered.value = onHandle }
  setCursor(onHandle ? 'grab' : 'crosshair')
  draw()
}

function onPointerUp() {
  dragging = false; zoomDragging = false
  setCursor(handleHovered.value ? 'grab' : 'crosshair')
}

function onPointerLeave() {
  zoomHoverDay.value = null; handleHovered.value = false
  zoomVisible.value = false
  setCursor('crosshair')
  draw()
}

onMounted(async () => {
  dayFrac = dateToDay(props.activeDate)
  curDay.value = Math.floor(dayFrac)
  data = await loadTypeTimeline()
  maxDay = data[GROUP_ORDER[0]].length - 1
  prepare(data)
  draw()
  ro = new ResizeObserver(draw)
  if (canvasRef.value) ro.observe(canvasRef.value)
})

onBeforeUnmount(() => {
  stopPlay()
  ro?.disconnect()
})
</script>

<template>
  <div class="type-chart">
    <button class="play-btn aero-icon-btn" :class="{ 'is-active': playing }" :title="playing ? 'Pause (Space)' : 'Play (Space)'" @click="togglePlay">
      <svg v-if="!playing" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 5l11 7-11 7z"/></svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
    </button>

    <div class="tl-date">{{ dateLabel }}</div>

    <div class="tc-canvas-wrap">
      <canvas
        ref="canvasRef"
        class="tc-canvas"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
      />
      <div class="tc-legend">
        <button
          v-for="key in [...GROUP_ORDER].reverse()"
          :key="key"
          class="tc-pill"
          :class="{ 'is-selected': selectedTypes.has(key), 'is-dimmed': selectedTypes.size > 0 && !selectedTypes.has(key) }"
          @click.stop="toggleType(key)"
        >
          <i :style="{ background: GROUP_COLORS[key] }" />{{ key }}
        </button>
      </div>
    </div>

    <div class="tl-end">Today</div>
  </div>
</template>

<style scoped>
.type-chart {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 84px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: linear-gradient(
    to bottom,
    transparent            0%,
    rgba(4,  9, 18, 0.55) 35%,
    rgba(4,  9, 18, 0.82) 100%
  );
}

.play-btn {
  width: 38px;
  height: 38px;
}

.tl-date {
  font-family: var(--aero-font);
  font-size: 12px;
  font-weight: 700;
  color: var(--aero-text);
  min-width: 110px;
  letter-spacing: 0.01em;
  flex-shrink: 0;
  text-shadow: 0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9);
}

.tc-canvas-wrap {
  flex: 1;
  position: relative;
  align-self: stretch;
}

.tc-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
  border-radius: 2px;
}

.tl-end {
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 600;
  color: var(--aero-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
  text-shadow: 0 1px 6px rgba(0,0,0,0.9);
}

.tc-legend {
  position: absolute;
  top: 5px;
  right: 4px;
  display: flex;
  gap: 6px;
  align-items: center;
  pointer-events: all;
}

.tc-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--aero-font);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--aero-radius-pill);
  padding: 2px 6px 2px 4px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s, opacity 0.15s;
}

.tc-pill:hover {
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.07);
  border-color: rgba(255,255,255,0.18);
}

.tc-pill.is-selected {
  color: rgba(255,255,255,0.95);
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.3);
}

.tc-pill.is-dimmed {
  opacity: 0.35;
}

.tc-pill i {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.85;
}
</style>
