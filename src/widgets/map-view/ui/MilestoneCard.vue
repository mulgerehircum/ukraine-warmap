<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MILESTONES } from '../../../shared/data/milestones'

const props = defineProps<{
  index: number | null
  videoHidden?: boolean
  showProgress?: boolean
  progressPaused?: boolean
  progressDuration?: number
}>()
const emit = defineEmits<{ 'toggle-video': [] }>()

const milestone = computed(() => props.index !== null ? MILESTONES[props.index] : null)
const hasVideo = computed(() => !!milestone.value?.videoUrl)

const thumbCache = new Map<string, string | null>()
const thumbUrl = ref<string | null>(null)
const thumbLoading = ref(false)

function pageTitle(url: string): string {
  return decodeURIComponent(url.split('/wiki/')[1] ?? '')
}

watch(milestone, async (m) => {
  if (!m) { thumbUrl.value = null; return }

  const title = pageTitle(m.url)
  if (thumbCache.has(title)) {
    thumbUrl.value = thumbCache.get(title)!
    return
  }

  thumbLoading.value = true
  thumbUrl.value = null
  try {
    const res  = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    const data = await res.json()
    const src  = data?.thumbnail?.source ?? null
    thumbCache.set(title, src)
    if (milestone.value?.url === m.url) thumbUrl.value = src
  } catch {
    thumbCache.set(title, null)
  } finally {
    thumbLoading.value = false
  }
}, { immediate: true })
</script>

<template>
  <Transition name="ms">
    <div v-if="milestone" class="milestone-card">
      <div class="ms-image-wrap" v-if="thumbLoading || thumbUrl">
        <div v-if="thumbLoading" class="ms-skeleton" />
        <img v-else-if="thumbUrl" :src="thumbUrl" class="ms-image" alt="" />
      </div>
      <div class="ms-eyebrow">Key moment</div>
      <div class="ms-title">{{ milestone.title }}</div>
      <p class="ms-desc">{{ milestone.desc }}</p>
      <div class="ms-footer">
        <a class="ms-link" :href="milestone.url" target="_blank" rel="noopener">Wikipedia ↗</a>
        <button v-if="hasVideo" class="ms-vid-toggle" @click.stop="emit('toggle-video')" :title="videoHidden ? 'Show video' : 'Hide video'">
          <svg v-if="videoHidden" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="4" width="10" height="8" rx="1.5"/>
            <path d="M11 7l4-2.5v7L11 9"/>
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="4" width="10" height="8" rx="1.5" stroke-dasharray="2 1.5"/>
            <path d="M11 7l4-2.5v7L11 9" opacity="0.4"/>
            <line x1="2" y1="2" x2="14" y2="14"/>
          </svg>
        </button>
      </div>
      <div v-if="showProgress" class="ms-prog-track">
        <div
          :key="index ?? -1"
          class="ms-prog-bar"
          :style="{
            animationDuration: `${progressDuration ?? 6000}ms`,
            animationPlayState: progressPaused ? 'paused' : 'running',
          }"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.milestone-card {
  width: 340px;
  padding: 0;
  background: var(--aero-glass);
  backdrop-filter: var(--aero-backdrop);
  border: var(--aero-border);
  border-top: 1px solid rgba(var(--aero-amber-rgb), 0.35);
  border-radius: var(--aero-radius);
  box-shadow: var(--aero-shadow), var(--aero-inset-glow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
}

.ms-image-wrap {
  width: 100%;
  height: 160px;
  flex-shrink: 0;
  overflow: hidden;
  background: rgba(0,0,0,0.3);
}

.ms-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: brightness(0.88) saturate(1.1);
}

.ms-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.ms-eyebrow {
  font-family: var(--aero-font);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--aero-amber-rgb), 0.7);
  padding: 12px 16px 0;
}

.ms-title {
  font-family: var(--aero-font);
  font-size: 14px;
  font-weight: 800;
  color: var(--aero-amber);
  line-height: 1.25;
  padding: 4px 16px 0;
}

.ms-desc {
  font-family: var(--aero-font);
  font-size: 11px;
  line-height: 1.55;
  color: var(--aero-text);
  margin: 0;
  padding: 5px 16px 0;
}

.ms-link {
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 600;
  color: var(--aero-accent);
  text-decoration: none;
  letter-spacing: 0.02em;
  transition: color var(--aero-transition);
  padding: 8px 16px 12px;
  align-self: flex-start;
}

.ms-link:hover { color: var(--aero-text); }

.ms-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 8px 0;
}

.ms-vid-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--aero-radius);
  background: transparent;
  border: var(--aero-border);
  color: var(--aero-text-dim);
  cursor: pointer;
  transition: color var(--aero-transition), border var(--aero-transition), background var(--aero-transition);
  flex-shrink: 0;
}

.ms-vid-toggle svg {
  width: 16px;
  height: 16px;
}

.ms-vid-toggle:hover {
  color: var(--aero-text);
  border: var(--aero-border-hover);
  background: rgba(255,255,255,0.05);
}

.ms-prog-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
  overflow: hidden;
}

.ms-prog-bar {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, rgba(var(--aero-amber-rgb), 0.6), var(--aero-amber));
  transform-origin: left;
  transform: scaleX(0);
  animation: ms-prog-fill linear forwards;
}

@keyframes ms-prog-fill {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

/* Transition */
.ms-enter-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ms-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ms-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.92);
}
.ms-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

@media (max-width: 640px) {
  .milestone-card { width: calc(100vw - 28px); }
  .ms-image-wrap  { height: 110px; }
}
</style>
