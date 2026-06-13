<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { MILESTONES } from '../../../shared/data/milestones'
import { accentRgba } from '../../../shared/constants/aero'

const WAR_START_MS = Date.UTC(2022, 1, 24)
const MS_PER_DAY   = 86_400_000
const PLAY_SPEED   = 20 // days per second

const props = defineProps<{ activeDate: Date; autoPlay?: boolean; storyActive?: boolean; storyPaused?: boolean }>()
const emit  = defineEmits<{ change: [date: Date]; playing: [value: boolean]; storyStart: []; storyTogglePause: []; storyStop: [] }>()

// ── Data ─────────────────────────────────────────────────────────────
const counts   = ref<number[]>([])
const maxCount = ref(1)

// ── Position ──────────────────────────────────────────────────────────
let dayFrac     = 0
const maxDay    = computed(() => Math.floor((Date.now() - WAR_START_MS) / MS_PER_DAY))
const viewStart = ref(0)
const viewEnd   = ref(maxDay.value)
const curDay    = ref(0)

const dateFmt     = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const lensDateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })
const dateLabel = computed(() => dateFmt.format(new Date(WAR_START_MS + curDay.value * MS_PER_DAY)))

watch(() => props.activeDate, (d) => {
  const day = Math.floor((d.getTime() - WAR_START_MS) / MS_PER_DAY)
  if (Math.floor(dayFrac) !== day) { dayFrac = day; curDay.value = day; draw() }
})

// ── Milestones ─────────────────────────────────────────────────────────
function dateIntToDay(di: number): number {
  const y = Math.floor(di / 10000)
  const m = Math.floor((di % 10000) / 100) - 1
  const d = di % 100
  return Math.floor((Date.UTC(y, m, d) - WAR_START_MS) / MS_PER_DAY)
}
const milestoneDays = MILESTONES.map(m => dateIntToDay(m.dateInt))

// ── Zoom lens ──────────────────────────────────────────────────────────
const zoomVisible     = ref(false)
const zoomCursorDay   = ref(0)
const zoomRadius      = ref(45)   // days on each side of centre
const zoomHoverDay    = ref<number | null>(null)
const handleHovered   = ref(false)
let   zoomDragging    = false

function lensGeometry() {
  const c = canvasEl.value
  if (!c || !zoomVisible.value) return null
  const W    = c.offsetWidth
  const vLen = viewEnd.value - viewStart.value
  const LW   = Math.round(W * 0.24)
  const cx   = Math.round(((zoomCursorDay.value - viewStart.value) / vLen) * W)
  const lx   = Math.max(0, Math.min(W - LW, cx - LW / 2))
  return { lx, LW }
}

function isOverHandle(clientX: number, clientY: number): boolean {
  const c = canvasEl.value
  if (!c) return false
  const geo = lensGeometry()
  if (!geo) return false
  const rect  = c.getBoundingClientRect()
  const cssX  = clientX - rect.left
  const cssY  = clientY - rect.top
  const gridW = 3 * 2 + 2 * 3.5   // 13px
  const gridH = 2 * 2 + 1 * 3.5   // 7.5px
  const gx0   = geo.lx + geo.LW / 2 - gridW / 2
  const gy0   = 5
  return cssX >= gx0 - 5 && cssX <= gx0 + gridW + 5 && cssY >= gy0 - 5 && cssY <= gy0 + gridH + 5
}

function setCursor(val: string) {
  if (canvasEl.value) canvasEl.value.style.cursor = val
}

// Returns which day within the lens range the cursor is over, or null if outside lens
function dayFromLensX(clientX: number): number | null {
  const c = canvasEl.value
  if (!c || !zoomVisible.value) return null
  const rect = c.getBoundingClientRect()
  const cssX = clientX - rect.left
  const W    = c.offsetWidth
  const vLen = viewEnd.value - viewStart.value
  const LENS_W_CSS = Math.round(W * 0.24)
  const cx   = Math.round(((zoomCursorDay.value - viewStart.value) / vLen) * W)
  const lx   = Math.max(0, Math.min(W - LENS_W_CSS, cx - LENS_W_CSS / 2))
  if (cssX < lx || cssX > lx + LENS_W_CSS) return null
  const zVS  = zoomCursorDay.value - zoomRadius.value
  return Math.round(zVS + ((cssX - lx) / LENS_W_CSS) * zoomRadius.value * 2)
}

// ── Canvas ─────────────────────────────────────────────────────────────
const canvasEl = ref<HTMLCanvasElement | null>(null)

function setupCanvas() {
  const c = canvasEl.value
  if (!c) return
  const dpr  = Math.min(window.devicePixelRatio || 1, 2)
  const rect = c.getBoundingClientRect()
  c.width  = rect.width  * dpr
  c.height = rect.height * dpr
}

function buildAreaPath(
  ctx: CanvasRenderingContext2D,
  fromPX: number, toPX: number,
  PW: number, PH: number,
  vS: number, vLen: number, barAreaPH: number,
) {
  ctx.beginPath()
  ctx.moveTo(fromPX, PH)
  for (let px = fromPX; px <= toPX; px++) {
    const di    = vS + (px / PW) * vLen
    const count = counts.value[Math.floor(di)] ?? 0
    const norm  = count / maxCount.value
    ctx.lineTo(px, PH - Math.max(0, Math.round(norm * barAreaPH)))
  }
  ctx.lineTo(toPX, PH)
  ctx.closePath()
}

function makePastGradient(ctx: CanvasRenderingContext2D, barTop: number, PH: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, barTop, 0, PH)
  g.addColorStop(0.0, 'rgba(77,215,250,1.0)')
  g.addColorStop(1.0, 'rgba(4,12,40,0.92)')
  return g
}

function buildContourPath(
  ctx: CanvasRenderingContext2D,
  fromPX: number, toPX: number,
  PW: number, PH: number,
  vS: number, vLen: number, barAreaPH: number,
) {
  ctx.beginPath()
  for (let px = fromPX; px <= toPX; px++) {
    const di    = vS + (px / PW) * vLen
    const count = counts.value[Math.floor(di)] ?? 0
    const y     = PH - Math.max(0, Math.round(count / maxCount.value * barAreaPH))
    px === fromPX ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
  }
}

function buildZoomContourPath(
  ctx: CanvasRenderingContext2D,
  fromPX: number, toPX: number,
  ZW: number, PH: number,
  zVS: number, zLen: number, barAreaPH: number,
) {
  ctx.beginPath()
  for (let px = fromPX; px <= toPX; px++) {
    const day   = zVS + (px / ZW) * zLen
    const count = counts.value[Math.floor(day)] ?? 0
    const y     = PH - Math.max(0, Math.round(count / maxCount.value * barAreaPH))
    px === fromPX ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
  }
}

function buildZoomPath(
  ctx: CanvasRenderingContext2D,
  fromPX: number, toPX: number,
  ZW: number, PH: number,
  zVS: number, zLen: number, barAreaPH: number,
) {
  ctx.beginPath()
  ctx.moveTo(fromPX, PH)
  for (let px = fromPX; px <= toPX; px++) {
    const day   = zVS + (px / ZW) * zLen
    const count = counts.value[Math.floor(day)] ?? 0
    ctx.lineTo(px, PH - Math.max(0, Math.round(count / maxCount.value * barAreaPH)))
  }
  ctx.lineTo(toPX, PH)
  ctx.closePath()
}

function drawZoomLens(ctx: CanvasRenderingContext2D, dpr: number, PW: number, PH: number, W: number, H: number, vS: number, vLen: number) {
  const RADIUS_PX  = 8 * dpr        // --aero-radius = 8px
  const LENS_W_CSS = Math.round(W * 0.24)
  const LENS_W_PX  = LENS_W_CSS * dpr
  const zDay  = zoomCursorDay.value
  const cx    = Math.round(((zDay - vS) / vLen) * W)
  const lx    = Math.max(0, Math.min(W - LENS_W_CSS, cx - LENS_W_CSS / 2))
  const lxPX  = lx * dpr
  const zVS   = zDay - zoomRadius.value
  const zVE   = zDay + zoomRadius.value
  const zLen  = zVE - zVS
  const barAreaPH = PH - Math.round(20 * dpr)
  const curPX = Math.max(0, Math.min(LENS_W_PX, Math.round(((dayFrac - zVS) / zLen) * LENS_W_PX)))

  // Rounded clip region
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(lxPX, 0, LENS_W_PX, PH, [RADIUS_PX, RADIUS_PX, 0, 0])
  ctx.clip()
  ctx.clearRect(lxPX, 0, LENS_W_PX, PH)
  ctx.translate(lxPX, 0)

  // Glow bloom
  ctx.save()
  ctx.filter = 'blur(10px)'
  buildZoomPath(ctx, 0, curPX, LENS_W_PX, PH, zVS, zLen, barAreaPH)
  const glowG = ctx.createLinearGradient(0, 0, 0, PH)
  glowG.addColorStop(0.0,  accentRgba(1.0))
  glowG.addColorStop(0.3,  accentRgba(0.85))
  glowG.addColorStop(0.6,  accentRgba(0.4))
  glowG.addColorStop(1.0,  accentRgba(0.0))
  ctx.fillStyle = glowG; ctx.fill()
  ctx.restore()

  // Past fill
  buildZoomPath(ctx, 0, curPX, LENS_W_PX, PH, zVS, zLen, barAreaPH)
  ctx.fillStyle = makePastGradient(ctx, PH - barAreaPH, PH)
  ctx.fill()

  // Future ghost — white-tipped like past bars but at ~45% intensity
  if (curPX < LENS_W_PX) {
    buildZoomPath(ctx, curPX, LENS_W_PX, LENS_W_PX, PH, zVS, zLen, barAreaPH)
    const futG = ctx.createLinearGradient(0, 0, 0, PH)
    futG.addColorStop(0.0,  'rgba(255,255,255,0.0)')
    futG.addColorStop(0.05, 'rgba(255,255,255,0.45)')
    futG.addColorStop(0.22, 'rgba(210,245,255,0.38)')
    futG.addColorStop(0.45, accentRgba(0.28))
    futG.addColorStop(0.75, accentRgba(0.12))
    futG.addColorStop(1.0,  accentRgba(0.0))
    ctx.fillStyle = futG; ctx.fill()
    buildZoomContourPath(ctx, curPX, LENS_W_PX, LENS_W_PX, PH, zVS, zLen, barAreaPH)
    ctx.strokeStyle = accentRgba(0.38)
    ctx.lineWidth   = dpr
    ctx.stroke()
  }

  // Playhead inside lens
  if (dayFrac >= zVS && dayFrac <= zVE) {
    const px = ((dayFrac - zVS) / zLen) * LENS_W_PX
    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = accentRgba(0.55)
    ctx.fillRect(Math.round(px) - 5 * dpr, 0, 10 * dpr, PH)
    ctx.restore()
    ctx.fillStyle = accentRgba(1)
    ctx.fillRect(Math.round(px) - dpr, 0, 2 * dpr, PH)
  }

  // Hovered bar — cyan column at ~half the past-fill intensity
  const zhd = zoomHoverDay.value
  if (zhd !== null && zhd >= zVS && zhd <= zVE) {
    const barCount = counts.value[Math.round(zhd)] ?? 0
    const barTopY  = PH - Math.max(0, Math.round(barCount / maxCount.value * barAreaPH))
    const colLeft  = (zhd - zVS) / zLen * LENS_W_PX
    const colRight = (zhd + 1 - zVS) / zLen * LENS_W_PX
    const colW     = Math.max(2 * dpr, colRight - colLeft)
    const colX     = Math.round(colLeft)

    // Bloom
    ctx.save()
    ctx.filter = 'blur(6px)'
    const bloomG = ctx.createLinearGradient(0, barTopY, 0, PH)
    bloomG.addColorStop(0, accentRgba(0.45))
    bloomG.addColorStop(1, accentRgba(0))
    ctx.fillStyle = bloomG
    ctx.fillRect(colX - Math.round(4 * dpr), barTopY, colW + Math.round(8 * dpr), PH - barTopY)
    ctx.restore()

    // Crisp cyan fill
    const colG = ctx.createLinearGradient(0, barTopY, 0, PH)
    colG.addColorStop(0.0,  accentRgba(0.48))
    colG.addColorStop(0.4,  accentRgba(0.35))
    colG.addColorStop(0.75, accentRgba(0.18))
    colG.addColorStop(1.0,  accentRgba(0.06))
    ctx.fillStyle = colG
    ctx.fillRect(colX, barTopY, colW, PH - barTopY)

    // Date label — flips side at midpoint
    ctx.save()
    ctx.font = `700 ${Math.round(10 * dpr)}px "Segoe UI", system-ui, sans-serif`
    ctx.textBaseline = 'bottom'
    const midX   = colX + colW / 2
    const isRight = midX > LENS_W_PX / 2
    ctx.textAlign = isRight ? 'right' : 'left'
    ctx.fillStyle = 'rgba(243,244,246,0.95)'
    const labelX  = midX + (isRight ? -Math.round(6 * dpr) : Math.round(6 * dpr))
    const labelY  = Math.max(Math.round(30 * dpr), barTopY - Math.round(5 * dpr))
    ctx.fillText(dateFmt.format(new Date(WAR_START_MS + Math.round(zhd) * MS_PER_DAY)), labelX, labelY)
    ctx.restore()
  }

  // Date labels at left/right edges of lens
  ctx.save()
  ctx.font = `600 ${Math.round(9 * dpr)}px "Segoe UI", system-ui, sans-serif`
  ctx.textBaseline = 'top'
  const labelY    = Math.round(5 * dpr)
  const startMs   = WAR_START_MS + Math.max(0, Math.round(zVS)) * MS_PER_DAY
  const endMs     = WAR_START_MS + Math.round(zVE) * MS_PER_DAY
  const startLabel = lensDateFmt.format(new Date(startMs))
  const endLabel   = lensDateFmt.format(new Date(endMs))
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(243,244,246,0.55)'
  ctx.fillText(startLabel, Math.round(6 * dpr), labelY)
  ctx.textAlign = 'right'
  ctx.fillText(endLabel, LENS_W_PX - Math.round(6 * dpr), labelY)
  ctx.restore()

  ctx.restore() // undo translate + clip

  // Rounded border: top-left, top-right rounded; bottom straight (sits on canvas floor)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = dpr
  ctx.beginPath()
  ctx.roundRect(lxPX + dpr * 0.5, dpr * 0.5, LENS_W_PX - dpr, PH - dpr * 0.5, [RADIUS_PX, RADIUS_PX, 0, 0])
  ctx.stroke()
  ctx.restore()

  // Drag handle — 3×2 dot grid at top centre
  const DOT  = Math.round(2   * dpr)
  const GAP  = Math.round(3.5 * dpr)
  const COLS = 3, ROWS = 2
  const gridW = COLS * DOT + (COLS - 1) * GAP
  const gridH = ROWS * DOT + (ROWS - 1) * GAP
  const gx0  = lxPX + LENS_W_PX / 2 - gridW / 2
  const gy0  = Math.round(5 * dpr)
  ctx.save()
  ctx.fillStyle = handleHovered.value ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)'
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const dx = gx0 + c * (DOT + GAP) + DOT / 2
      const dy = gy0 + r * (DOT + GAP) + DOT / 2
      ctx.beginPath()
      ctx.arc(dx, dy, DOT / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function draw() {
  const c = canvasEl.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const PW = c.width
  const PH = c.height
  const W  = PW / dpr
  const H  = PH / dpr

  ctx.clearRect(0, 0, PW, PH)

  const cur        = dayFrac
  const vS         = viewStart.value
  const vE         = viewEnd.value
  const vLen       = vE - vS
  const barAreaPH  = PH - Math.round(20 * dpr)
  const curPX      = Math.max(0, Math.min(PW, Math.round(((cur - vS) / vLen) * PW)))

  // Glow bloom — wide, aggressive
  ctx.save()
  ctx.filter = 'blur(10px)'
  buildAreaPath(ctx, 0, curPX, PW, PH, vS, vLen, barAreaPH)
  const glowG = ctx.createLinearGradient(0, 0, 0, PH)
  glowG.addColorStop(0.0,  accentRgba(1.0))
  glowG.addColorStop(0.3,  accentRgba(0.85))
  glowG.addColorStop(0.6,  accentRgba(0.4))
  glowG.addColorStop(1.0,  accentRgba(0.0))
  ctx.fillStyle = glowG
  ctx.fill()
  ctx.restore()

  // Past fill + contour
  buildAreaPath(ctx, 0, curPX, PW, PH, vS, vLen, barAreaPH)
  ctx.fillStyle = makePastGradient(ctx, PH - barAreaPH, PH)
  ctx.fill()
  buildContourPath(ctx, 0, curPX, PW, PH, vS, vLen, barAreaPH)
  const pastContourG = ctx.createLinearGradient(0, PH - barAreaPH, 0, PH)
  pastContourG.addColorStop(0.0, 'rgba(4,12,40,0.85)')
  pastContourG.addColorStop(1.0, 'rgba(77,215,250,0.22)')
  ctx.strokeStyle = pastContourG
  ctx.lineWidth   = dpr
  ctx.stroke()

  // Ghost future
  if (curPX < PW) {
    buildAreaPath(ctx, curPX, PW, PW, PH, vS, vLen, barAreaPH)
    const futG = ctx.createLinearGradient(0, 0, 0, PH)
    futG.addColorStop(0.08, accentRgba(0.2))
    futG.addColorStop(1.0,  accentRgba(0))
    ctx.fillStyle = futG
    ctx.fill()
    buildContourPath(ctx, curPX, PW, PW, PH, vS, vLen, barAreaPH)
    ctx.strokeStyle = accentRgba(0.38)
    ctx.lineWidth   = dpr
    ctx.stroke()
  }

  ctx.save()
  ctx.scale(dpr, dpr)

  // Year markers
  ctx.font = `800 12px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelY = (H - 14) * 0.42
  for (const y of [2023, 2024, 2025, 2026]) {
    const day = Math.floor((Date.UTC(y, 0, 1) - WAR_START_MS) / MS_PER_DAY)
    if (day < vS || day > vE) continue
    const x = Math.round(((day - vS) / vLen) * W)
    ctx.fillStyle = accentRgba(0.9)
    ctx.fillText(String(y), x, labelY)
    ctx.fillStyle = accentRgba(0.3)
    ctx.fillRect(x - 1, labelY + 7, 2, H - labelY - 7)
  }

  // Milestone markers — dot + stem, greedy row-stagger to avoid overlap
  const MIN_GAP    = 12           // px min between dot centres in the same row
  const ROW_Y      = [4, 10, 16] // CSS px y-centre per row
  const rowLastX: number[] = []  // last x placed in each row

  for (let i = 0; i < milestoneDays.length; i++) {
    const md = milestoneDays[i]
    if (md < vS || md > vE) continue
    const mx       = Math.round(((md - vS) / vLen) * W)
    const isActive = Math.abs(Math.floor(dayFrac) - md) <= 1

    // First row with enough horizontal clearance
    let row = 0
    while (row < ROW_Y.length - 1 && rowLastX[row] !== undefined && mx - rowLastX[row] < MIN_GAP) row++
    rowLastX[row] = mx

    const cy    = ROW_Y[row]
    const color = isActive ? 'rgba(252,211,77,' : 'rgba(190,232,252,'

    if (isActive) {
      ctx.save()
      ctx.filter = 'blur(4px)'
      ctx.fillStyle = 'rgba(252,211,77,0.5)'
      ctx.beginPath(); ctx.arc(mx, cy, 5, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    // Stem from dot bottom to waveform zone
    ctx.strokeStyle = color + (isActive ? '0.7)' : '0.4)')
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(mx, cy + 3); ctx.lineTo(mx, 18); ctx.stroke()

    // Dot
    ctx.beginPath(); ctx.arc(mx, cy, isActive ? 3 : 2.5, 0, Math.PI * 2)
    ctx.fillStyle = color + (isActive ? '1)' : '0.6)')
    ctx.fill()
  }

  // Playhead
  if (cur >= vS && cur <= vE) {
    const px = ((cur - vS) / vLen) * W
    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = accentRgba(0.55)
    ctx.fillRect(Math.round(px) - 5, 0, 10, H)
    ctx.restore()
    ctx.fillStyle = accentRgba(1)
    ctx.fillRect(Math.round(px) - 1, 0, 2, H)
  }

  // Hover cursor
  const hd = hoverDay.value
  if (hd !== null && hd >= vS && hd <= vE) {
    const hx = Math.round(((hd - vS) / vLen) * W)
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillRect(hx, 0, 1, H)
    const label = new Date(WAR_START_MS + hd * MS_PER_DAY)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    ctx.font = '700 10px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'top'
    ctx.textAlign = hx > W / 2 ? 'right' : 'left'
    ctx.fillStyle = 'rgba(243,244,246,0.85)'
    ctx.fillText(label, hx > W / 2 ? hx - 5 : hx + 5, 3)
  }

  ctx.restore()

  if (zoomVisible.value) drawZoomLens(ctx, dpr, PW, PH, W, H, vS, vLen)
}

// ── Interaction ────────────────────────────────────────────────────────
let dragging    = false
let lastEmitDay = -1
const hoverDay  = ref<number | null>(null)

function dayFromClientX(clientX: number): number {
  const c = canvasEl.value
  if (!c) return 0
  const rect  = c.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return Math.round(viewStart.value + ratio * (viewEnd.value - viewStart.value))
}

function seekTo(day: number) {
  const d = Math.max(0, Math.min(day, maxDay.value))
  dayFrac = d; curDay.value = d; draw()
  if (d !== lastEmitDay) { lastEmitDay = d; emitDay(d) }
}

function emitDay(day: number) {
  const date = new Date(WAR_START_MS + day * MS_PER_DAY)
  date.setUTCHours(0, 0, 0, 0)
  emit('change', date)
}

function onWheel(e: WheelEvent) {
  const c = canvasEl.value
  if (!c) return
  const rect  = c.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const vS    = viewStart.value
  const vE    = viewEnd.value
  const vLen  = vE - vS
  zoomCursorDay.value = Math.round(vS + ratio * vLen)
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
      seekTo(lensDay)
    }
    zoomDragging = true
    setCursor('grabbing')
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    return
  }
  if (playing.value) stopPlay()
  dragging = true; hoverDay.value = null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  seekTo(dayFromClientX(e.clientX))
}
function onPointerMove(e: PointerEvent) {
  const day = dayFromClientX(e.clientX)
  if (zoomDragging) {
    zoomCursorDay.value = day
    zoomHoverDay.value = dayFromLensX(e.clientX)
    draw(); return
  }
  if (dragging) { seekTo(day); return }
  hoverDay.value = day
  const lensDay = dayFromLensX(e.clientX)
  zoomHoverDay.value = lensDay
  if (zoomVisible.value && lensDay === null) { zoomVisible.value = false }
  const onHandle = isOverHandle(e.clientX, e.clientY)
  if (handleHovered.value !== onHandle) { handleHovered.value = onHandle; draw() }
  setCursor(onHandle ? 'grab' : 'crosshair')
  draw()
}
function onPointerUp() {
  dragging = false; zoomDragging = false
  setCursor(handleHovered.value ? 'grab' : 'crosshair')
}
function onPointerLeave() {
  hoverDay.value = null; zoomHoverDay.value = null; handleHovered.value = false
  zoomVisible.value = false
  setCursor('crosshair')
  draw()
}

// ── Playback ───────────────────────────────────────────────────────────
const playing = ref(false)
let rafId: number | null = null
let lastTs: number | null = null
let lastEmitMs = 0

function startPlay() {
  if (curDay.value >= maxDay.value) { dayFrac = 0; curDay.value = 0 }
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
  const newDay = Math.min(Math.floor(dayFrac), maxDay.value)
  if (newDay !== curDay.value) curDay.value = newDay
  draw()
  if (ts - lastEmitMs > 100) { lastEmitMs = ts; emitDay(newDay) }
  if (dayFrac >= maxDay.value) {
    dayFrac = maxDay.value; curDay.value = maxDay.value
    draw(); emitDay(maxDay.value); stopPlay(); return
  }
  rafId = requestAnimationFrame(tick)
}
function togglePlay() { playing.value ? stopPlay() : startPlay() }

const isLive = computed(() => curDay.value >= maxDay.value - 1)

function handleGoLive() {
  if (playing.value) stopPlay()
  if (props.storyActive) emit('storyStop')
  seekTo(maxDay.value)
}

function handlePlayClick() {
  if (props.storyActive) {
    emit('storyTogglePause')
  } else {
    emit('storyStart')
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(async () => {
  dayFrac = Math.floor((props.activeDate.getTime() - WAR_START_MS) / MS_PER_DAY)
  curDay.value = dayFrac
  setupCanvas(); draw()
  try {
    const res  = await fetch('/data/timeline-summary.json')
    const data = await res.json() as { start: number; counts: number[] }
    counts.value   = data.counts
    maxCount.value = Math.max(...data.counts, 1)
    viewEnd.value  = data.counts.length
    draw()
    if (props.autoPlay) startPlay()
  } catch { /* histogram stays empty */ }
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  stopPlay()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
})

function onResize() { setupCanvas(); draw() }

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === ' ')          { e.preventDefault(); handlePlayClick() }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); if (playing.value) stopPlay(); seekTo(curDay.value - 1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); if (playing.value) stopPlay(); seekTo(curDay.value + 1) }
}
</script>

<template>
  <div class="timeline">
    <button
      class="play-btn aero-icon-btn"
      :class="{ 'is-active': storyActive ? !storyPaused : playing }"
      :title="storyActive ? (storyPaused ? 'Resume story (Space)' : 'Pause story (Space)') : 'Story mode (Space)'"
      @click="handlePlayClick"
    >
      <svg v-if="storyActive ? storyPaused : !playing" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M9 5l11 7-11 7z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    </button>

    <div class="tl-date">{{ dateLabel }}</div>

    <canvas
      ref="canvasEl"
      class="histogram"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel.prevent="onWheel"
    />

    <button class="live-btn" :class="{ 'is-live': isLive }" @click="handleGoLive" :title="isLive ? 'You are live' : 'Jump to today'">
      <span v-if="isLive" class="live-dot" />
      <span>{{ isLive ? 'Live' : 'Today' }}</span>
    </button>
  </div>
</template>

<style scoped>
.timeline {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  height: 84px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: linear-gradient(
    to bottom,
    transparent                0%,
    rgba(4,  9, 18, 0.55)     35%,
    rgba(4,  9, 18, 0.82)    100%
  );
  backdrop-filter: none;
  border-top: none;
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

.histogram {
  flex: 1;
  align-self: stretch;
  cursor: crosshair;
  display: block;
  border-radius: 2px;
}


.live-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 9px;
  min-width: 66px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--aero-radius-pill);
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aero-text-dim);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.2s;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
}
.live-btn:not(.is-live):hover {
  color: var(--aero-text);
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.05);
}
.live-btn.is-live {
  color: rgba(var(--aero-red-rgb), 0.9);
  border-color: rgba(var(--aero-red-rgb), 0.4);
  background: rgba(var(--aero-red-rgb), 0.08);
  box-shadow: 0 0 10px rgba(var(--aero-red-rgb), 0.15);
  cursor: default;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  animation: live-pulse 1.5s ease-in-out infinite;
}
@keyframes live-pulse {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%       { transform: scale(0.6); opacity: 0.3; }
}

@media (max-width: 640px) {
  .timeline {
    padding: 0 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    height: auto;
    min-height: 72px;
    gap: 8px;
  }
  .tl-date  { min-width: 80px; font-size: 11px; }
  .play-btn { width: 34px; height: 34px; }
  .live-btn { min-width: 54px; font-size: 9px; }
}
</style>
