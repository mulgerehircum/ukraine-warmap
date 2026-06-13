<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import type { Map } from 'maplibre-gl'
import { initMap } from '../../../shared/lib/map/initMap'
import { setSatelliteVisible } from '../../../shared/lib/map/satellite'
import { updateNightOverlay, setNightOverlayVisible } from '../../../shared/lib/map/daynight'
import { loadTimeline, setOccupationDate, dateToInt } from '../../../shared/lib/map/timeline'
import { setOccupationVisible } from '../../../shared/lib/map/occupation'
import { setEventsDate, setEventsTypeFilter, loadChoroplethTimeline, getCumulativeOblastCounts, ALL_EVENT_TYPES } from '../../../shared/lib/map/events'
import { setOblastChoroplethVisible, setMilestoneHighlight, setChoroplethCounts, loadAndApplyChoropleth, getOblastCountsByTypes } from '../../../shared/lib/map/oblasts'
import { GROUP_TYPE_CODES } from '../../../shared/lib/map/typeTimeline'
import type { GroupKey } from '../../../shared/lib/map/typeTimeline'
import { initAlerts, stopAlerts, pauseAlerts, reapplyAlerts } from '../../../shared/lib/map/alerts'
import { initOblastBars, updateOblastBars, setOblastBarsVisible } from '../../../shared/lib/map/oblastBars'
import { initCitySpikes, updateCitySpikes, setCitySpikesVisible } from '../../../shared/lib/map/citySpikes'
import { initLandmarks, updateLandmarks, setLandmarksVisible } from '../../../shared/lib/map/landmarks'
import { setAnimating, updateSunLight } from '../../../shared/lib/map/threeLayer'
import { updateArrowsDate, setArrowsVisible } from '../../../shared/lib/map/arrows'
import { MILESTONES } from '../../../shared/data/milestones'
import type { MapMode } from './CompassSelector.vue'
import CompassSelector from './CompassSelector.vue'
import AttributionModal from './AttributionModal.vue'
import WarDayCounter from './WarDayCounter.vue'
import AlertBadge from './AlertBadge.vue'
import AlertDots from './AlertDots.vue'
import TimelineBar from './TimelineBar.vue'
import TypeChart from './TypeChart.vue'
import MilestoneCard from './MilestoneCard.vue'
import MilestoneVideo from './MilestoneVideo.vue'
import TypeFilter from './TypeFilter.vue'
import EventFeed from './EventFeed.vue'
import StoryMode from './StoryMode.vue'

const mapContainer = ref<HTMLElement | null>(null)
const mode = ref<MapMode>('satellite')
const bearing = ref(0)
const activeTypeKeys = ref<string[]>([...ALL_EVENT_TYPES])
const eventsKey = ref(0)
const locationFilter = ref<{ name: string; lng: number; lat: number } | null>(null)

const urlDate = (() => {
  const p = new URLSearchParams(location.search).get('date')
  if (!p || !/^\d{8}$/.test(p)) return null
  const y = +p.slice(0, 4), mo = +p.slice(4, 6) - 1, d = +p.slice(6, 8)
  const t = Date.UTC(y, mo, d)
  return isNaN(t) ? null : new Date(t)
})()
const activeDate = ref<Date>(urlDate ?? new Date())
const autoPlay = !urlDate

const MS_PER_DAY = 86_400_000
const activeMilestoneIdx = computed<number | null>(() => {
  const ms = activeDate.value.getTime()
  const idx = MILESTONES.findIndex(m => {
    const y = Math.floor(m.dateInt / 10000)
    const mo = Math.floor((m.dateInt % 10000) / 100) - 1
    const d = m.dateInt % 100
    return Math.abs(Date.UTC(y, mo, d) - ms) < MS_PER_DAY * 2
  })
  return idx >= 0 ? idx : null
})

const milestoneUrl = computed(() =>
  activeMilestoneIdx.value !== null ? MILESTONES[activeMilestoneIdx.value].url : null
)

const videoHidden = ref(false)
watch(activeMilestoneIdx, () => { videoHidden.value = false })
watch(activeMilestoneIdx, (idx) => {
  setMilestoneHighlight(idx !== null ? MILESTONES[idx].oblasts : [])
})

// ── Story mode ────────────────────────────────────────────────────────────
const storyActive  = ref(false)
const storyIndex   = ref(0)
const storyPaused  = ref(false)
const storyPhase   = ref<'scrubbing' | 'dwelling'>('dwelling')
const storyDateLabel = ref('')

// Timeline scrubs at 60 days/sec — slow enough for the frontline to visibly
// move across the map; fast enough to cover the whole war in ~18 seconds.
const SCRUB_DAYS_PER_SEC = 60
const DWELL_MS = 6000
let storyRaf = 0
let storyDwellTimer = 0
let storyLastTs = 0

function milestoneToDate(idx: number): Date {
  const di = MILESTONES[idx].dateInt
  return new Date(Date.UTC(
    Math.floor(di / 10000),
    (Math.floor(di / 100) % 100) - 1,
    di % 100,
  ))
}

function storyFlyTo(idx: number) {
  if (!map) return
  const { lng, lat, zoom, bearing: b = 0, pitch: p = 45 } = MILESTONES[idx].camera
  map.flyTo({ center: [lng, lat], zoom, bearing: b, pitch: p, duration: 1800, essential: true })
}

async function storyArriveAt(idx: number) {
  storyPhase.value = 'dwelling'
  const date = milestoneToDate(idx)
  await onDateChange(date)
  storyFlyTo(idx)
  videoHidden.value = false
  if (!storyPaused.value) {
    storyDwellTimer = window.setTimeout(() => storyResume(idx), DWELL_MS)
  }
}

// Called after dwell ends — advances to the next milestone or ends the story.
function storyResume(fromIdx: number) {
  if (fromIdx + 1 >= MILESTONES.length) { storyStop(); return }
  storyIndex.value = fromIdx + 1
  storyPhase.value = 'scrubbing'
  storyLastTs = 0
  storyRaf = requestAnimationFrame(storyTick)
}

function storyTick(ts: number) {
  if (storyPaused.value) { storyRaf = requestAnimationFrame(storyTick); return }
  // Skip first tick — just capture the timestamp so dt is correct on next frame.
  if (!storyLastTs) { storyLastTs = ts; storyRaf = requestAnimationFrame(storyTick); return }
  const dt = Math.min((ts - storyLastTs) / 1000, 0.1)
  storyLastTs = ts

  const targetMs = milestoneToDate(storyIndex.value).getTime()
  const rawNext = activeDate.value.getTime() + dt * SCRUB_DAYS_PER_SEC * MS_PER_DAY

  if (rawNext >= targetMs) {
    // Crossed the milestone — snap to it and dwell.
    activeDate.value = milestoneToDate(storyIndex.value)
    const di = dateToInt(activeDate.value)
    if (map) { setOccupationDate(map, di); updateArrowsDate(di); updateSunLight(activeDate.value) }
    storyArriveAt(storyIndex.value)
    return
  }

  const date = new Date(rawNext)
  activeDate.value = date
  const di = dateToInt(date)
  storyDateLabel.value = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (map) {
    setOccupationDate(map, di)
    updateArrowsDate(di)
    updateSunLight(date)
  }
  storyRaf = requestAnimationFrame(storyTick)
}

function storyStart() {
  storyActive.value = true
  storyPaused.value = false
  storyIndex.value = 0
  storyPhase.value = 'scrubbing'
  // Start a few days before the first milestone so the initial scrub is visible.
  activeDate.value = new Date(milestoneToDate(0).getTime() - 5 * MS_PER_DAY)
  storyLastTs = 0
  storyRaf = requestAnimationFrame(storyTick)
}

function storyStop() {
  storyActive.value = false
  cancelAnimationFrame(storyRaf)
  clearTimeout(storyDwellTimer)
  storyPhase.value = 'dwelling'
}

function storyTogglePause() {
  storyPaused.value = !storyPaused.value
  if (!storyPaused.value) {
    if (storyPhase.value === 'dwelling') {
      storyDwellTimer = window.setTimeout(() => storyResume(storyIndex.value), DWELL_MS / 2)
    }
    // Scrubbing: tick loop handles it — it checks storyPaused each frame.
  } else {
    clearTimeout(storyDwellTimer)
  }
}

// Immediately dwell at milestone idx (used by prev/next buttons and dot clicks).
function storyGoto(idx: number) {
  cancelAnimationFrame(storyRaf)
  clearTimeout(storyDwellTimer)
  storyIndex.value = Math.max(0, Math.min(MILESTONES.length - 1, idx))
  storyArriveAt(storyIndex.value)
}

function storyNext() {
  if (storyPhase.value === 'scrubbing') {
    // Skip the remaining scrub — arrive at the current target immediately.
    storyGoto(storyIndex.value)
  } else {
    storyGoto(storyIndex.value + 1)
  }
}

function storyPrev() {
  storyGoto(storyIndex.value - 1)
}

// ─────────────────────────────────────────────────────────────────────────────

const EVENT_LAYERS = ['events-cluster', 'events-circles', 'events-oblast-counts']
const attributionOpen = ref(false)
const alertCount = ref(0)
const alertedIds = ref(new Set<number>())
const mapInstance = ref<Map | null>(null)
const threeDEnabled = ref(true)

const isLive = computed(() => {
  const now = new Date()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const activeDayUTC = Date.UTC(activeDate.value.getUTCFullYear(), activeDate.value.getUTCMonth(), activeDate.value.getUTCDate())
  return activeDayUTC >= todayUTC
})

const EMPTY_ALERT_SET = new Set<number>()
const alertDotIds = computed(() => isLive.value ? alertedIds.value : EMPTY_ALERT_SET)

watch(isLive, (live) => {
  if (live) reapplyAlerts()
  else { pauseAlerts(); alertCount.value = 0; alertedIds.value = new Set() }
})
let map: Map | null = null

onMounted(() => {
  if (!mapContainer.value) return
  map = initMap(mapContainer.value)
  mapInstance.value = map
  ;(window as any).map = map
  map.on('rotate', () => { bearing.value = -(map?.getBearing() ?? 0) })
  map.on('load', () => {
    const di = dateToInt(activeDate.value)
    const m = map
    m!.on('mouseenter', 'city-labels', () => { m!.getCanvas().style.cursor = 'pointer' })
    m!.on('mouseleave', 'city-labels', () => { m!.getCanvas().style.cursor = '' })
    m!.on('click', 'city-labels', (e) => {
      const feat = e.features?.[0]
      if (!feat) return
      const name = feat.properties?.name as string | undefined
      if (name) {
        const [fLng, fLat] = (feat.geometry as any).coordinates as [number, number]
        locationFilter.value = { name, lng: fLng, lat: fLat }
        m!.flyTo({ center: [fLng, fLat], zoom: Math.max(m!.getZoom(), 10), duration: 700 })
      }
    })
    loadTimeline().then(() => { if (m) setOccupationDate(m, di) })
    setEventsDate(m, di).then(() => { eventsKey.value++ })
    updateArrowsDate(di)
    loadAndApplyChoropleth()
    initAlerts(m, (n, ids) => { alertCount.value = n; alertedIds.value = ids })
    initCitySpikes()
    setCitySpikesVisible(false)
    Promise.all([initLandmarks(m!), loadChoroplethTimeline()]).then(() => {
      const initial = getCumulativeOblastCounts(dateToInt(activeDate.value))
      updateCitySpikes(initial)
      updateLandmarks(initial)
      updateSunLight(activeDate.value)
      setLandmarksVisible(true)
      initOblastBars().then(() => {
        updateOblastBars(initial)
        setOblastBarsVisible(false)
        m.triggerRepaint()
      })
    })
  })
})

onBeforeUnmount(() => {
  stopAlerts()
  storyStop()
  map?.remove()
  map = null
})

async function selectMode(next: MapMode) {
  if (!map || next === mode.value) return
  const isChoropleth = next === 'heatmap'
  mode.value = next
  setSatelliteVisible(map, true)
  setOblastChoroplethVisible(isChoropleth)
  setOccupationVisible(map, !isChoropleth)
  setNightOverlayVisible(map, !isChoropleth)
  EVENT_LAYERS.forEach(id => map!.setLayoutProperty(id, 'visibility', isChoropleth ? 'none' : 'visible'))
  setArrowsVisible(!isChoropleth)
  if (isChoropleth) {
    const di = dateToInt(activeDate.value)
    await loadChoroplethTimeline()
    setChoroplethCounts(getCumulativeOblastCounts(di))
  } else {
    const di = dateToInt(activeDate.value)
    updateNightOverlay(map, activeDate.value)
    setOccupationDate(map, di)
  }
}

function resetNorth() {
  map?.easeTo({ bearing: 0, duration: 300 })
}

async function onDateChange(date: Date) {
  if (!map) return
  activeDate.value = date
  const di = dateToInt(date)
  history.replaceState(null, '', `?date=${di}`)
  const cumulative = getCumulativeOblastCounts(di)
  updateArrowsDate(di)
  updateOblastBars(cumulative)
  updateCitySpikes(cumulative)
  updateLandmarks(cumulative)
  updateSunLight(date)
  if (mode.value === 'heatmap') {
    await setEventsDate(map, di, true)
    setChoroplethCounts(cumulative)
  } else {
    const m = map
    setTimeout(() => { updateNightOverlay(m, date); setOccupationDate(m, di) }, 0)
    await setEventsDate(map, di)
  }
  eventsKey.value++
}

function onTypeFilter(types: string[]) {
  activeTypeKeys.value = types
  setEventsTypeFilter(new Set(types))
  eventsKey.value++
}

function onTypeChartFilter(groups: GroupKey[]) {
  if (groups.length === 0) {
    activeTypeKeys.value = [...ALL_EVENT_TYPES]
    setEventsTypeFilter(new Set(ALL_EVENT_TYPES))
    setChoroplethCounts(getCumulativeOblastCounts(dateToInt(activeDate.value)))
  } else {
    const codes = [...new Set(groups.flatMap(g => GROUP_TYPE_CODES[g]))]
    activeTypeKeys.value = codes
    setEventsTypeFilter(new Set(codes))
    setChoroplethCounts(getOblastCountsByTypes(codes as any))
  }
  eventsKey.value++
}

function onFlyTo(lng: number, lat: number) {
  map?.flyTo({ center: [lng, lat], zoom: 13, duration: 900 })
}

function onPlayingChange(playing: boolean) {
  setAnimating(playing)
}

function toggleThreeD() {
  threeDEnabled.value = !threeDEnabled.value
  setOblastBarsVisible(threeDEnabled.value)
  setCitySpikesVisible(threeDEnabled.value)
}
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-view" />
    <WarDayCounter :date="activeDate" />
    <AlertBadge :count="isLive ? alertCount : 0" />
    <AlertDots :map="mapInstance" :alerted-ids="alertDotIds" />
    <CompassSelector :mode="mode" :bearing="bearing" @select="selectMode" @reset-north="resetNorth" />
    <TypeFilter
      :visible="mode !== 'heatmap' && !storyActive"
      :active-types="activeTypeKeys"
      @change="onTypeFilter"
    />
    <EventFeed
      :visible="!storyActive"
      :active-types="activeTypeKeys"
      :events-key="eventsKey"
      :milestone-url="milestoneUrl"
      :location-filter="locationFilter"
      @fly-to="onFlyTo"
      @clear-location="locationFilter = null"
    />
    <button class="attribution-btn" @click="attributionOpen = true">©</button>

    <div class="milestone-stack">
      <MilestoneCard
        :index="activeMilestoneIdx"
        :video-hidden="videoHidden"
        :show-progress="storyActive && storyPhase === 'dwelling'"
        :progress-paused="storyPaused"
        :progress-duration="DWELL_MS"
        @toggle-video="videoHidden = !videoHidden"
      />
      <MilestoneVideo v-if="!videoHidden" :index="activeMilestoneIdx" />
    </div>

    <StoryMode
      v-if="storyActive"
      :index="storyIndex"
      :phase="storyPhase"
      :paused="storyPaused"
      :date-label="storyDateLabel"
      @prev="storyPrev"
      @next="storyNext"
      @goto="storyGoto"
      @toggle-pause="storyTogglePause"
      @exit="storyStop"
    />

    <TypeChart v-if="mode === 'heatmap'" :active-date="activeDate" @change="onDateChange" @playing="onPlayingChange" @filter-type="onTypeChartFilter" />
    <TimelineBar v-else :active-date="activeDate" :auto-play="false" :story-active="storyActive" :story-paused="storyPaused" @change="onDateChange" @playing="onPlayingChange" @story-start="storyStart" @story-toggle-pause="storyTogglePause" @story-stop="storyStop" />
    <AttributionModal :open="attributionOpen" @close="attributionOpen = false" />
  </div>
</template>

<style>
.maplibregl-popup-tip { display: none; }

.maplibregl-popup-content {
  padding: 8px 12px;
  border-radius: var(--aero-radius);
  background: var(--aero-glass) !important;
  backdrop-filter: var(--aero-backdrop);
  border: var(--aero-border) !important;
  box-shadow: var(--aero-shadow), var(--aero-inset-glow) !important;
  font-family: var(--aero-font);
  font-size: 12px;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 210px;
  color: var(--aero-text);
}

.tt-name {
  font-weight: 700;
  color: var(--aero-accent);
  font-size: 12px;
}

.tt-status {
  font-size: 12px;
  color: var(--aero-text-dim);
}
</style>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-view {
  width: 100%;
  height: 100%;
}

.milestone-stack {
  position: absolute;
  top: 88px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.attribution-btn {
  position: absolute;
  bottom: 82px;
  right: 14px;
  z-index: 1;
  padding: 5px 12px;
  background: var(--aero-glass);
  backdrop-filter: var(--aero-backdrop-sm);
  border: var(--aero-border);
  box-shadow: var(--aero-shadow-btn), var(--aero-inset-glow);
  border-radius: var(--aero-radius-pill);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--aero-font);
  color: var(--aero-text-dim);
  transition: border var(--aero-transition), color var(--aero-transition), box-shadow var(--aero-transition);
}

.attribution-btn:hover {
  border: var(--aero-border-hover);
  color: var(--aero-text);
  box-shadow: var(--aero-shadow-btn), var(--aero-glow), var(--aero-inset-glow);
}
</style>
