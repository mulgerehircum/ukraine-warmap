<script setup lang="ts">
import { computed, ref } from 'vue'
import { MILESTONES } from '../../../shared/data/milestones'

const props = defineProps<{ index: number | null }>()

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null)
    }
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
  } catch { /* invalid URL */ }
  return null
}

const embedSrc = computed(() => {
  if (props.index === null) return null
  const m = MILESTONES[props.index]
  if (!m.videoUrl) return null
  const id = extractYouTubeId(m.videoUrl)
  if (!id) return null
  const start = m.videoTimestamp ? `&start=${m.videoTimestamp}` : ''
  const loop = m.videoLoop ? `&loop=1&playlist=${id}` : ''
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&autoplay=1&mute=1${start}${loop}`
})

const width = ref(480)
const MIN_W = 320
const MAX_W = 900

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const startW = width.value
  function onMove(e: MouseEvent) {
    width.value = Math.min(MAX_W, Math.max(MIN_W, startW + e.clientX - startX))
  }
  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}
</script>

<template>
  <Transition name="mv">
    <div v-if="embedSrc" class="milestone-video" :style="{ width: width + 'px' }">
      <iframe
        :key="embedSrc"
        :src="embedSrc"
        class="mv-frame"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      />
      <div class="mv-handle" @mousedown="startResize" />
    </div>
  </Transition>
</template>

<style scoped>
.milestone-video {
  position: relative;
  min-width: 320px;
  max-width: min(900px, 90vw);
  background: var(--aero-glass);
  backdrop-filter: var(--aero-backdrop);
  border: var(--aero-border);
  border-top: 1px solid rgba(var(--aero-amber-rgb), 0.35);
  border-radius: var(--aero-radius);
  box-shadow: var(--aero-shadow), var(--aero-inset-glow);
  overflow: hidden;
  pointer-events: auto;
}

.mv-frame {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
}

.mv-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;
}

.mv-handle::after {
  content: '';
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-right: 2px solid rgba(255, 255, 255, 0.25);
  border-bottom: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 1px;
  transition: border-color var(--aero-transition);
}

.mv-handle:hover::after {
  border-color: rgba(var(--aero-amber-rgb), 0.7);
}

@media (max-width: 640px) {
  .milestone-video { display: none; }
}

.mv-enter-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mv-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.mv-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
.mv-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
