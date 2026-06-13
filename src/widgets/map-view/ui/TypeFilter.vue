<script setup lang="ts">
import { TYPE_DEFS } from '../../../shared/lib/map/eventIcons'
import { EVENT_TYPE_LABELS, ALL_EVENT_TYPES } from '../../../shared/lib/map/events'
import EventTypeIcon from './EventTypeIcon.vue'

const SHORT: Record<string, string> = {
  S: 'Air', D: 'UAV', A: 'Arty', F: 'Fire',
  C: 'Civn', V: 'Armor', M: 'Mil.', L: 'Alert', O: 'Other',
}

const props = defineProps<{
  visible: boolean
  activeTypes: string[]
}>()
const emit = defineEmits<{ change: [types: string[]] }>()

function toggle(type: string) {
  const next = props.activeTypes.includes(type)
    ? props.activeTypes.filter(t => t !== type)
    : [...props.activeTypes, type]
  emit('change', next)
}
function setAll(on: boolean) {
  emit('change', on ? [...ALL_EVENT_TYPES] : [])
}
</script>

<template>
  <div v-show="visible" class="type-filter aero-panel">
    <button
      class="quick" :class="{ active: activeTypes.length === ALL_EVENT_TYPES.length }"
      title="Select all" @click="setAll(true)"
    >All</button>
    <div class="divider" />
    <button
      v-for="type in ALL_EVENT_TYPES" :key="type"
      class="pill" :class="{ inactive: !activeTypes.includes(type) }"
      :title="EVENT_TYPE_LABELS[type]"
      :style="{ color: TYPE_DEFS[type].color }"
      @click="toggle(type)"
    >
      <EventTypeIcon :type="type" :size="16" class="pill-icon" />
      <span class="label">{{ SHORT[type] }}</span>
    </button>
    <div class="divider" />
    <button
      class="quick" :class="{ active: activeTypes.length === 0 }"
      title="Clear all" @click="setAll(false)"
    >None</button>
  </div>
</template>

<style scoped>
.type-filter {
  position: absolute;
  bottom: 82px;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: fit-content;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 8px;
  border-radius: var(--aero-radius-pill);
  white-space: nowrap;
}

.divider {
  width: 1px;
  height: 16px;
  background: rgba(var(--aero-accent-rgb), 0.15);
  margin: 0 3px;
  flex-shrink: 0;
}

.pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px 3px 6px;
  border-radius: 100px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background var(--aero-transition), border-color var(--aero-transition), opacity var(--aero-transition);
  font-family: var(--aero-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.pill .label { color: var(--aero-text); }
.pill:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(var(--aero-accent-rgb), 0.2);
}
.pill.inactive { opacity: 0.28; }

.quick {
  padding: 3px 8px;
  border-radius: 100px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-family: var(--aero-font);
  font-size: 10px;
  font-weight: 700;
  color: var(--aero-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color var(--aero-transition), border-color var(--aero-transition);
}
.quick:hover, .quick.active {
  color: var(--aero-accent);
  border-color: rgba(var(--aero-accent-rgb), 0.3);
}

@media (max-width: 640px) {
  .type-filter { bottom: calc(96px + env(safe-area-inset-bottom, 0px)); }
  .label { display: none; }
  .pill  { padding: 4px 5px; }
}
</style>
