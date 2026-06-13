<script setup lang="ts">
import { ref, shallowRef, triggerRef, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Map as MlMap } from 'maplibre-gl'

const props = defineProps<{ map: object | null; alertedIds: Set<number> }>()
const getMap = () => props.map as MlMap | null

const CENTROIDS: Record<number, [number, number]> = {
   1: [30.9, 49.4],   2: [31.5, 51.5],   3: [25.9, 48.3],
   4: [34.2, 45.1],   5: [34.8, 48.4],   6: [37.6, 48.0],
   7: [24.7, 48.9],   8: [36.2, 49.9],   9: [33.4, 46.5],
  10: [27.0, 49.5],  11: [31.0, 50.3],  12: [30.5, 50.5],
  13: [32.2, 48.5],  14: [24.0, 49.8],  15: [38.8, 48.7],
  16: [31.9, 47.0],  17: [30.3, 46.2],  18: [33.5, 49.6],
  19: [26.2, 51.0],  20: [33.5, 44.6],  21: [34.3, 51.1],
  22: [25.6, 49.5],  23: [28.5, 49.2],  24: [24.8, 51.0],
  25: [22.9, 48.4],  26: [35.4, 47.7],  27: [28.7, 50.3],
}

const DOT_COUNT = 6
const CYCLE = 2.4 // seconds, matches CSS animation duration

// seeded so scatter is deterministic per oblast across re-renders
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

const DOTS: Record<number, Array<{ lngLat: [number, number]; delay: number }>> = {}
for (const [idStr, [lng, lat]] of Object.entries(CENTROIDS)) {
  const id = +idStr
  const r = rng(id * 7919)
  DOTS[id] = Array.from({ length: DOT_COUNT }, () => ({
    lngLat: [lng + (r() - 0.5) * 2.0, lat + (r() - 0.5) * 1.5] as [number, number],
    delay: +(r() * CYCLE).toFixed(2),
  }))
}

interface GeoPoint  { lngLat: [number, number]; delay: number }
interface ScreenPoint { x: number; y: number; delay: number }

const visible = ref<GeoPoint[]>([])
const points  = shallowRef<ScreenPoint[]>([])

function validate() {
  const m = getMap()
  if (!m || props.alertedIds.size === 0) { visible.value = []; points.value = []; return }
  const { width, height } = m.getCanvas()
  const next: GeoPoint[] = []
  for (const id of props.alertedIds) {
    const geo = DOTS[id]
    if (!geo) continue
    for (const g of geo) {
      const { x, y } = m.project(g.lngLat)
      if (x < 0 || y < 0 || x > width || y > height) continue
      const hits = m.queryRenderedFeatures([x, y], { layers: ['oblast-fill'] })
      if (!hits.some(f => props.alertedIds.has(f.id as number))) continue
      next.push(g)
    }
  }
  visible.value = next
  project()
}

function project() {
  const m = getMap()
  if (!m) return
  const geo = visible.value
  const cur = points.value
  if (cur.length !== geo.length) {
    points.value = geo.map(g => { const { x, y } = m.project(g.lngLat); return { x: Math.round(x), y: Math.round(y), delay: g.delay } })
    return
  }
  let changed = false
  for (let i = 0; i < geo.length; i++) {
    const { x, y } = m.project(geo[i].lngLat)
    const nx = Math.round(x), ny = Math.round(y)
    if (cur[i].x !== nx || cur[i].y !== ny) { cur[i].x = nx; cur[i].y = ny; changed = true }
  }
  if (changed) triggerRef(points)
}

function attach(m: MlMap) {
  m.on('render',  project)
  m.on('zoomend', validate)
}
function detach(m: MlMap) {
  m.off('render',  project)
  m.off('zoomend', validate)
}

watch(() => props.map, (n, p) => {
  if (p) detach(p as MlMap)
  if (n) { attach(n as MlMap); validate() }
})
watch(() => props.alertedIds, validate, { deep: true })
onMounted(()      => { const m = getMap(); if (m) { attach(m); validate() } })
onBeforeUnmount(() => { const m = getMap(); if (m) detach(m) })
</script>

<template>
  <div class="alert-overlay" aria-hidden="true">
    <div
      v-for="(pt, i) in points"
      :key="i"
      class="alert-pin"
      :style="`transform:translate(${pt.x}px,${pt.y}px);--d:${pt.delay}s`"
    >
      <span class="alert-dot" />
      <span class="alert-ring" />
    </div>
  </div>
</template>

<style scoped>
.alert-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 2;
}

.alert-pin {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}

.alert-dot {
  position: absolute;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: rgba(230, 55, 55, 1);
  box-shadow: 0 0 5px 1px rgba(255, 80, 80, 0.7);
  animation: dot-blink 2.4s ease-in-out var(--d, 0s) infinite;
}

@keyframes dot-blink {
  0%        { opacity: 1;   transform: scale(1);   }
  18%       { opacity: 0.9; transform: scale(1.4); }
  38%, 100% { opacity: 0.3; transform: scale(0.7); }
}

.alert-ring {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  border: 1.2px solid rgba(220, 55, 55, 0.85);
  box-shadow: 0 0 4px rgba(255, 80, 80, 0.4);
  animation: ring-ripple 2.4s ease-out var(--d, 0s) infinite;
}

@keyframes ring-ripple {
  0%   { transform: scale(0.5); opacity: 0.9; border-width: 1.5px; }
  55%  { opacity: 0.35; }
  100% { transform: scale(6);   opacity: 0;   border-width: 0.3px; }
}

</style>
