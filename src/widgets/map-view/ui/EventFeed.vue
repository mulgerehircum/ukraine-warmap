<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { TYPE_DEFS } from '../../../shared/lib/map/eventIcons'
import EventTypeIcon from './EventTypeIcon.vue'
import ArticleDrawer from './ArticleDrawer.vue'
import { EVENT_TYPE_LABELS, ALL_EVENT_TYPES, getLoadedEvents, queryEventsByLocation, type ProcessedEvent } from '../../../shared/lib/map/events'
import { fetchOg } from '../../../shared/lib/map/ogFetch'

const props = defineProps<{
  visible: boolean
  activeTypes: string[]
  eventsKey: number
  milestoneUrl?: string | null
  locationFilter?: { name: string; lng: number; lat: number } | null
}>()

const emit = defineEmits<{
  flyTo: [lng: number, lat: number]
  tabChange: [types: string[]]
  clearLocation: []
}>()

const COLLAPSE_AT = 5

// Feed-level tabs (independent of map type filter)
const TABS = [
  { key: 'all',      label: 'All',     types: ALL_EVENT_TYPES },
  { key: 'strikes',  label: 'Strikes', types: ['S', 'D', 'A', 'L'] },
  { key: 'forces',   label: 'Forces',  types: ['F', 'V', 'M', 'C'] },
  { key: 'other',    label: 'Other',   types: ['O'] },
]
const activeTab = ref('all')

watch(activeTab, (tab) => {
  const types = TABS.find(t => t.key === tab)?.types ?? ALL_EVENT_TYPES
  emit('tabChange', [...types])
})

const articleUrl        = ref<string | null>(null)
const isMilestoneOpen   = ref(false)

watch(() => props.milestoneUrl, (next) => {
  if (next && (articleUrl.value === null || isMilestoneOpen.value)) {
    articleUrl.value = next
    isMilestoneOpen.value = true
  } else if (!next && isMilestoneOpen.value) {
    articleUrl.value = null
    isMilestoneOpen.value = false
  }
})

const open       = ref(true)
const loading    = ref(false)
const allEvents  = ref<ProcessedEvent[]>([])
const dateLabel  = ref('')
const ogDescriptions = ref<Record<string, string>>({})
const expandedTypes  = ref<Record<string, boolean>>({})
let fetchGen = 0
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const locationEvents   = ref<ProcessedEvent[]>([])
const locationLoading  = ref(false)
const isLocationMode   = computed(() => !!props.locationFilter)

const locationDateRange = computed(() => {
  if (!locationEvents.value.length) return ''
  const dates = locationEvents.value.map(e => e.dateInt ?? 0).filter(Boolean)
  if (!dates.length) return ''
  const fmt = (di: number) => new Date(Date.UTC(
    Math.floor(di / 10000),
    (Math.floor(di / 100) % 100) - 1,
    di % 100,
  )).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const min = Math.min(...dates), max = Math.max(...dates)
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
})

watch(() => props.locationFilter, async (loc) => {
  locationEvents.value = []
  expandedTypes.value = {}
  if (!loc) return
  locationLoading.value = true
  try {
    locationEvents.value = await queryEventsByLocation(loc.name, loc.lng, loc.lat)
  } finally {
    locationLoading.value = false
  }
})

function fmtDateInt(di: number | undefined): string {
  if (!di) return ''
  return new Date(Date.UTC(
    Math.floor(di / 10000),
    (Math.floor(di / 100) % 100) - 1,
    di % 100,
  )).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const TYPE_ORDER = [...ALL_EVENT_TYPES.filter(t => t !== 'O'), 'O']

const tabTypes = computed(() => TABS.find(t => t.key === activeTab.value)?.types ?? ALL_EVENT_TYPES)

const grouped = computed(() => {
  const source = isLocationMode.value ? locationEvents.value : allEvents.value
  const allowed = isLocationMode.value
    ? new Set(ALL_EVENT_TYPES)
    : new Set(props.activeTypes.filter(t => tabTypes.value.includes(t)))
  const filtered = source.filter(e => allowed.has(e.type))

  const map = new Map<string, ProcessedEvent[]>()
  for (const ev of filtered) {
    if (!map.has(ev.type)) map.set(ev.type, [])
    map.get(ev.type)!.push(ev)
  }
  for (const evs of map.values()) {
    if (isLocationMode.value) evs.sort((a, b) => (b.dateInt ?? 0) - (a.dateInt ?? 0))
    else evs.sort((a, b) => b.n - a.n)
  }

  return TYPE_ORDER
    .filter(t => map.has(t))
    .map(t => {
      const evs = map.get(t)!
      const expanded = !!expandedTypes.value[t]
      return {
        type: t,
        label: EVENT_TYPE_LABELS[t] ?? t,
        color: TYPE_DEFS[t]?.color ?? '#6b7280',
        total: evs.length,
        visible: expanded ? evs : evs.slice(0, COLLAPSE_AT),
        hasMore: !expanded && evs.length > COLLAPSE_AT,
        remaining: evs.length - COLLAPSE_AT,
        expanded,
      }
    })
})

const totalCount = computed(() =>
  isLocationMode.value
    ? locationEvents.value.length
    : allEvents.value.filter(e => props.activeTypes.includes(e.type)).length
)

function toggleExpand(type: string) {
  expandedTypes.value = { ...expandedTypes.value, [type]: !expandedTypes.value[type] }
}


watch(() => props.eventsKey, () => {
  if (isLocationMode.value) return

  // Update date label immediately for snappy scrubbing feedback
  const snapshot = getLoadedEvents()
  if (snapshot) {
    const di = snapshot.dateInt
    dateLabel.value = new Date(Date.UTC(
      Math.floor(di / 10000),
      (Math.floor(di / 100) % 100) - 1,
      di % 100,
    )).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  } else {
    dateLabel.value = ''
  }

  // Debounce the heavy part: card list swap + OG fetches
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    const loaded = getLoadedEvents()
    ogDescriptions.value = {}
    expandedTypes.value  = {}
    if (!loaded) { allEvents.value = []; return }
    allEvents.value = loaded.entries
    loading.value = true
    fetchAllOg(loaded.entries, ++fetchGen).finally(() => { loading.value = false })
  }, 350)
}, { immediate: true })

async function fetchAllOg(evs: ProcessedEvent[], gen: number) {
  const seen = new Set<string>()
  const urls = evs.map(ev => ev.urls[0]).filter((u): u is string => {
    if (!u || seen.has(u)) return false
    seen.add(u); return true
  })
  if (!urls.length) return
  const CONCURRENCY = 5
  let idx = 0
  async function worker() {
    while (idx < urls.length && gen === fetchGen) {
      const url = urls[idx++]
      const data = await fetchOg(url)
      if (gen !== fetchGen) return
      if (data?.description) ogDescriptions.value[url] = data.description.slice(0, 280)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))
}
</script>

<template>
  <div v-show="visible" class="feed-wrap">
    <!-- Collapsed pill -->
    <button v-if="!open" class="feed-toggle" @click="open = true">
      <span class="feed-toggle-label">Events</span>
      <span class="feed-badge">{{ totalCount }}</span>
    </button>

    <!-- Panel -->
    <div v-show="open" class="feed">

      <!-- Header -->
      <div class="feed-header">
        <span class="feed-title">Events</span>
        <span class="feed-header-right">
          <span v-if="loading || locationLoading" class="feed-loading" />
          <span v-else class="feed-badge">{{ totalCount }}</span>
          <button class="feed-close" @click="open = false">✕</button>
        </span>
      </div>

      <!-- Location banner -->
      <div v-if="isLocationMode" class="location-banner">
        <svg class="location-pin" viewBox="0 0 12 12" width="11" height="11" fill="currentColor">
          <path d="M6 0a4 4 0 0 1 4 4c0 3-4 8-4 8S2 7 2 4a4 4 0 0 1 4-4zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
        </svg>
        <span class="location-name">{{ props.locationFilter?.name }}</span>
        <span v-if="locationDateRange" class="location-range">{{ locationDateRange }}</span>
        <button class="location-clear" title="Clear location filter" @click="emit('clearLocation')">✕</button>
      </div>

      <!-- Date label (hidden in location mode) -->
      <div v-else class="feed-date">{{ dateLabel }}</div>

      <!-- Tabs (hidden in location mode) -->
      <div v-if="!isLocationMode" class="feed-tabs">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="feed-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </div>

      <!-- List -->
      <div class="feed-list">
        <div v-if="grouped.length === 0 && !locationLoading" class="feed-empty">
          {{ isLocationMode ? 'No events found for this location' : 'No events for this date' }}
        </div>

        <template v-for="group in grouped" :key="group.type">
          <!-- Type section label -->
          <div class="feed-section">
            <EventTypeIcon :type="group.type" :size="16" :style="{ color: group.color }" />
            <span class="feed-section-label">{{ group.label }}</span>
            <span class="feed-section-count">{{ group.total }}</span>
            <span class="feed-section-line" />
          </div>

          <!-- Cards -->
          <div
            v-for="(ev, i) in group.visible"
            :key="i"
            class="feed-card"
            :style="{ '--c': group.color }"
            role="button"
            tabindex="0"
            @click="emit('flyTo', ev.lng, ev.lat); if (ev.urls[0]) { articleUrl = ev.urls[0]; isMilestoneOpen = false }"
            @keydown.enter.space.prevent="emit('flyTo', ev.lng, ev.lat); if (ev.urls[0]) { articleUrl = ev.urls[0]; isMilestoneOpen = false }"
          >
            <div class="feed-card-meta">
              <span class="feed-card-loc">
                <svg class="feed-pin" viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
                  <path d="M6 0a4 4 0 0 1 4 4c0 3-4 8-4 8S2 7 2 4a4 4 0 0 1 4-4zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                </svg>
                <template v-if="isLocationMode">{{ fmtDateInt(ev.dateInt) }}</template>
                <template v-else>{{ ev.name }}</template>
              </span>
              <span v-if="ev.n > 1" class="feed-card-rep">×{{ ev.n }}</span>
              <EventTypeIcon :type="group.type" :size="14" :style="{ color: group.color }" />
            </div>
            <span class="feed-card-title">{{ group.label }}</span>
            <span v-if="ev.urls[0] && ogDescriptions[ev.urls[0]]" class="feed-card-desc">
              <span class="feed-card-desc-inner">{{ ogDescriptions[ev.urls[0]] }}</span>
            </span>
          </div>

          <!-- Expand/collapse -->
          <button v-if="group.hasMore" class="feed-more" @click.stop="toggleExpand(group.type)">
            Show {{ group.remaining }} more
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M8 10.5L2.5 5h11z"/></svg>
          </button>
          <button v-else-if="group.total > COLLAPSE_AT" class="feed-more" @click.stop="toggleExpand(group.type)">
            Show less
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M8 5.5L13.5 11h-11z"/></svg>
          </button>
        </template>
      </div>

    </div>
  </div>

  <ArticleDrawer :url="articleUrl" @close="articleUrl = null; isMilestoneOpen = false" />
</template>

<style scoped>
.feed-wrap {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

/* Collapsed pill */
.feed-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--aero-glass);
  backdrop-filter: blur(16px) saturate(140%);
  border: var(--aero-border);
  border-radius: var(--aero-radius-pill);
  box-shadow: var(--aero-shadow), var(--aero-inset-glow);
  cursor: pointer;
  transition: border 0.15s, box-shadow 0.15s;
}
.feed-toggle:hover {
  border: var(--aero-border-hover);
  box-shadow: var(--aero-shadow), var(--aero-glow), var(--aero-inset-glow);
}
.feed-toggle-label {
  font-family: var(--aero-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--aero-accent);
}

/* Panel */
.feed {
  width: 280px;
  max-height: calc(100vh - 14px - 72px - 16px);
  display: flex;
  flex-direction: column;
  background: var(--aero-glass);
  backdrop-filter: blur(24px) saturate(150%);
  border: var(--aero-border);
  border-radius: var(--aero-radius);
  box-shadow: var(--aero-shadow), var(--aero-inset-glow);
  overflow: hidden;
}

/* Header */
.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 0;
  flex-shrink: 0;
}
.feed-title {
  font-family: var(--aero-font);
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--aero-text);
}
.feed-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feed-badge {
  font-family: var(--aero-font);
  font-size: 11px;
  font-weight: 700;
  color: var(--aero-accent);
  background: rgba(var(--aero-accent-rgb), 0.12);
  border: 1px solid rgba(var(--aero-accent-rgb), 0.25);
  border-radius: 100px;
  padding: 1px 8px;
  min-width: 24px;
  text-align: center;
}

.feed-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  border-radius: 50%;
  transition: color 0.12s, background 0.12s;
  padding: 0;
  flex-shrink: 0;
}
.feed-close:hover { color: #fff; background: rgba(255,255,255,0.08); }

.feed-loading {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(var(--aero-accent-rgb), 0.2);
  border-top-color: var(--aero-accent);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Date */
.feed-date {
  font-family: var(--aero-font);
  font-size: 11px;
  font-weight: 600;
  color: var(--aero-text-dim);
  letter-spacing: 0.04em;
  padding: 4px 14px 10px;
  flex-shrink: 0;
}

/* Tabs */
.feed-tabs {
  display: flex;
  gap: 4px;
  padding: 0 14px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.feed-tab {
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.feed-tab:hover {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
}
.feed-tab.active {
  background: rgba(var(--aero-accent-rgb), 0.1);
  border-color: rgba(var(--aero-accent-rgb), 0.3);
  color: var(--aero-accent);
}

/* List */
.feed-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 10px 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.08) transparent;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.feed-list::-webkit-scrollbar { width: 3px; }
.feed-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.feed-empty {
  padding: 24px 0;
  font-family: var(--aero-font);
  font-size: 11px;
  color: rgba(255,255,255,0.25);
  text-align: center;
}

/* Section header */
.feed-section {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 4px 5px;
}
.feed-section-label {
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
}
.feed-section-count {
  font-family: var(--aero-font);
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  white-space: nowrap;
}
.feed-section-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin-left: 2px;
}

/* Location banner */
.location-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px 9px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.location-pin {
  color: var(--aero-accent);
  flex-shrink: 0;
}
.location-name {
  font-family: var(--aero-font);
  font-size: 12px;
  font-weight: 700;
  color: var(--aero-accent);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.location-range {
  font-family: var(--aero-font);
  font-size: 10px;
  color: var(--aero-text-dim);
  white-space: nowrap;
  flex-shrink: 0;
}
.location-clear {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%;
  cursor: pointer;
  font-size: 9px;
  color: rgba(255,255,255,0.35);
  padding: 0;
  flex-shrink: 0;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.location-clear:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.06);
}

/* Cards */
.feed-card {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--c) 14%, transparent) 0,
    rgba(255,255,255,0.03) 28px
  );
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 9px 11px 9px 14px;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--aero-transition), background var(--aero-transition);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.feed-card:hover {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--c) 32%, transparent) 0,
    color-mix(in srgb, var(--c) 6%, transparent) 50px,
    transparent 120px
  );
  border-color: rgba(255,255,255,0.18);
}
.feed-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12%;
  bottom: 12%;
  width: 2px;
  border-radius: 0 1px 1px 0;
  background: linear-gradient(to bottom, transparent, var(--c) 30%, var(--c) 70%, transparent);
}
.feed-card-meta {
  display: flex;
  align-items: center;
  gap: 5px;
}
.feed-card-loc {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--aero-font);
  font-size: 9.5px;
  color: rgba(255,255,255,0.35);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feed-pin {
  color: rgba(255,255,255,0.25);
  flex-shrink: 0;
}

.feed-card-rep {
  font-family: var(--aero-font);
  font-size: 9px;
  font-weight: 700;
  color: var(--aero-accent);
  opacity: 0.7;
  flex-shrink: 0;
}
.feed-card-title {
  font-family: var(--aero-font);
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,0.88);
  line-height: 1.3;
}
.feed-card-desc {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease;
}
.feed-card-desc-inner {
  overflow: hidden;
  font-family: var(--aero-font);
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  line-height: 1.45;
}
.feed-card:hover .feed-card-desc {
  grid-template-rows: 1fr;
}

/* Expand */
.feed-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 7px 0;
  margin-top: 2px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.03em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.feed-more:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.6);
}

@media (max-width: 640px) {
  .feed {
    width: calc(100vw - 28px);
    max-height: calc(100dvh - 14px - 100px - 16px);
  }
}
</style>
