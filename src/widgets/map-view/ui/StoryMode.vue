<script setup lang="ts">
import { computed } from 'vue'
import { MILESTONES } from '../../../shared/data/milestones'

const props = defineProps<{
  index: number
  phase: 'scrubbing' | 'dwelling'
  paused: boolean
  dateLabel: string
}>()

const emit = defineEmits<{
  prev: []
  next: []
  goto: [idx: number]
  togglePause: []
  exit: []
}>()

const milestone = computed(() => MILESTONES[props.index])
const total = MILESTONES.length

function dotClick(i: number) {
  emit('goto', i)
}
</script>

<template>
  <div class="story-bar">
    <div class="story-left">
      <span class="story-badge">▶ Story</span>
      <span class="story-phase" :class="{ scrubbing: phase === 'scrubbing' }">
        {{ phase === 'scrubbing' ? dateLabel : milestone.title }}
      </span>
    </div>

    <div class="story-dots">
      <button
        v-for="(_, i) in MILESTONES"
        :key="i"
        class="story-dot"
        :class="{ active: i === index, past: i < index }"
        @click="dotClick(i)"
        :title="MILESTONES[i].title"
      />
    </div>

    <div class="story-controls">
      <span class="story-counter">{{ index + 1 }} / {{ total }}</span>
      <button class="story-btn" :disabled="index === 0" @click="emit('prev')" title="Previous">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M11 3L5 8l6 5V3z"/></svg>
      </button>
      <button class="story-btn story-btn-pause" @click="emit('togglePause')" :title="paused ? 'Resume' : 'Pause'">
        <svg v-if="paused" viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M6 3l7 5-7 5V3z"/></svg>
        <svg v-else viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M5 3h2v10H5zm4 0h2v10H9z"/></svg>
      </button>
      <button class="story-btn" :disabled="index === total - 1" @click="emit('next')" title="Next">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M5 3l6 5-6 5V3z"/></svg>
      </button>
      <button class="story-btn story-btn-exit" @click="emit('exit')" title="Exit story mode">✕</button>
    </div>
  </div>
</template>

<style scoped>
.story-bar {
  position: absolute;
  bottom: 72px;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: fit-content;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 14px;
  background: var(--aero-glass);
  backdrop-filter: blur(24px) saturate(150%);
  border: var(--aero-border);
  border-top: 1px solid rgba(var(--aero-amber-rgb), 0.4);
  border-radius: var(--aero-radius-pill);
  box-shadow: var(--aero-shadow), 0 0 0 1px rgba(var(--aero-amber-rgb), 0.08) inset;
  white-space: nowrap;
  max-width: calc(100vw - 28px);
}

.story-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.story-badge {
  font-family: var(--aero-font);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--aero-amber);
  flex-shrink: 0;
}

.story-phase {
  font-family: var(--aero-font);
  font-size: 12px;
  font-weight: 700;
  color: var(--aero-text);
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
.story-phase.scrubbing {
  color: var(--aero-text-dim);
  font-weight: 400;
}

.story-dots {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.story-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
  flex-shrink: 0;
}
.story-dot.past {
  background: rgba(var(--aero-amber-rgb), 0.4);
}
.story-dot.active {
  background: var(--aero-amber);
  transform: scale(1.4);
}
.story-dot:hover:not(.active) {
  background: rgba(255,255,255,0.35);
}

@media (max-width: 640px) {
  .story-bar  { bottom: calc(96px + env(safe-area-inset-bottom, 0px)); }
  .story-dots { display: none; }
}

.story-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.story-counter {
  font-family: var(--aero-font);
  font-size: 10px;
  color: var(--aero-text-dim);
  min-width: 32px;
  text-align: right;
  margin-right: 4px;
}

.story-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  cursor: pointer;
  color: rgba(255,255,255,0.55);
  padding: 0;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
  flex-shrink: 0;
}
.story-btn:hover:not(:disabled) {
  color: var(--aero-text);
  border-color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.06);
}
.story-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.story-btn-pause {
  color: var(--aero-amber);
  border-color: rgba(var(--aero-amber-rgb), 0.3);
}
.story-btn-pause:hover {
  background: rgba(var(--aero-amber-rgb), 0.1) !important;
  border-color: rgba(var(--aero-amber-rgb), 0.6) !important;
  color: var(--aero-amber) !important;
}
.story-btn-exit {
  margin-left: 4px;
  font-size: 11px;
}
</style>
