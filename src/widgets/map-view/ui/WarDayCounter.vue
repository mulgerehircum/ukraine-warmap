<script setup lang="ts">
import { computed } from 'vue'

const WAR_START = new Date(Date.UTC(2022, 1, 24)) // Feb 24, 2022

const props = defineProps<{ date: Date }>()

const dayCount = computed(() => {
  const ms = props.date.getTime() - WAR_START.getTime()
  return Math.floor(ms / 86_400_000) + 1
})

const dateLabel = computed(() =>
  props.date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
)
</script>

<template>
  <div class="war-counter">
    <span class="war-counter__number">{{ dayCount }}</span>
    <span class="war-counter__unit">days</span>
    <span class="war-counter__sub">of full-scale war · {{ dateLabel }}</span>
  </div>
</template>

<style scoped>
.war-counter {
  position: absolute;
  top: 14px;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: fit-content;
  z-index: 10;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 20px 9px;
  background: var(--aero-glass);
  backdrop-filter: blur(18px) saturate(140%);
  border: var(--aero-border);
  border-radius: var(--aero-radius-pill);
  box-shadow: var(--aero-shadow), var(--aero-inset-glow);
  white-space: nowrap;
  pointer-events: none;
}

.war-counter__number {
  font-family: var(--aero-font);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--aero-accent);
  line-height: 1;
}

.war-counter__unit {
  font-family: var(--aero-font);
  font-size: 13px;
  font-weight: 600;
  color: var(--aero-text);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  line-height: 1;
  align-self: center;
}

.war-counter__sub {
  font-family: var(--aero-font);
  font-size: 11px;
  color: var(--aero-text-dim);
  letter-spacing: 0.2px;
  align-self: center;
  padding-left: 4px;
  border-left: 1px solid rgba(var(--aero-accent-rgb), 0.18);
}

@media (max-width: 640px) {
  .war-counter__sub { display: none; }
  .war-counter__number { font-size: 18px; }
  .war-counter__unit   { font-size: 11px; }
}
</style>
