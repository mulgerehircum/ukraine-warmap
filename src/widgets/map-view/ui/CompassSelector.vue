<script setup lang="ts">
import { ref } from 'vue'
import { AERO_ACCENT, accentRgba, AERO_AMBER, amberRgba, AERO_ORANGE, AERO_ORANGE_R, AERO_ORANGE_G, AERO_ORANGE_B } from '../../../shared/constants/aero'

export type MapMode = 'satellite' | 'terrain' | 'heatmap'

const orangeRgba = (a: number) => `rgba(${AERO_ORANGE_R},${AERO_ORANGE_G},${AERO_ORANGE_B},${a})`

const MODES: { value: MapMode; label: string; abbr: string; color: string; glow: string }[] = [
  { value: 'satellite', label: 'Satellite',  abbr: 'SAT', color: AERO_ACCENT, glow: accentRgba(0.35) },
  { value: 'terrain',   label: 'Terrain',    abbr: 'TRN', color: AERO_AMBER,  glow: amberRgba(0.35)  },
  { value: 'heatmap',   label: 'Choropleth', abbr: 'CHO', color: AERO_ORANGE, glow: orangeRgba(0.35) },
]

defineProps<{ mode: MapMode; bearing: number }>()
const emit = defineEmits<{ select: [mode: MapMode]; 'reset-north': [] }>()

const open = ref(false)

function select(m: MapMode) {
  emit('select', m)
  open.value = false
}

function orbStyle(m: typeof MODES[0], active: boolean) {
  return active
    ? {
        background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.12), rgba(6,12,18,0.9))`,
        border: `1px solid ${m.color}`,
        boxShadow: `0 0 14px ${m.glow}, inset 0 0 10px 1px ${m.glow}`,
        color: m.color,
      }
    : {
        background: 'var(--aero-glass)',
        border: 'var(--aero-border)',
        boxShadow: 'var(--aero-shadow-btn)',
        color: 'var(--aero-text-dim)',
      }
}
</script>

<template>
  <div class="wrap">
    <!-- Compass button -->
    <button class="compass-btn" @click="open = !open" title="Layers">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <g :transform="`rotate(${bearing}, 22, 22)`">
          <polygon points="22,4 17,23 27,23" fill="var(--aero-red)" />
          <polygon points="22,40 17,21 27,21" fill="#52525b" />
          <circle cx="22" cy="22" r="3.5" fill="rgba(6,12,18,0.9)" stroke="rgba(77,215,250,0.4)" stroke-width="1.2" />
        </g>
        <text x="22" y="8.5" text-anchor="middle" dominant-baseline="central"
          font-size="6.5" font-weight="800" font-family="var(--aero-font)"
          fill="var(--aero-accent)" style="pointer-events:none;user-select:none">N</text>
      </svg>
    </button>

    <!-- Mode list -->
    <transition name="modes">
      <div v-if="open" class="mode-list">
        <button
          v-for="m in MODES"
          :key="m.value"
          class="mode-row"
          @click="select(m.value)"
        >
          <span class="mode-label" :class="{ active: mode === m.value }"
            :style="mode === m.value ? { color: m.color, borderColor: m.color + '66' } : {}">
            {{ m.label }}
          </span>
          <span class="mode-orb" :style="orbStyle(m, mode === m.value)">
            {{ m.abbr }}
          </span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.wrap {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

/* ── Compass ──────────────────────────────────────────────── */
.compass-btn {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  cursor: pointer;
  background: radial-gradient(circle at 40% 35%, rgba(15,30,45,0.9), rgba(6,12,18,0.95));
  border: var(--aero-border);
  box-shadow: var(--aero-shadow-btn), var(--aero-inset-glow);
  transition: box-shadow var(--aero-transition), border var(--aero-transition), transform var(--aero-transition-fast);
}

.compass-btn:hover {
  border: var(--aero-border-hover);
  box-shadow: var(--aero-shadow-btn), var(--aero-glow), inset 0 0 14px 1px rgba(77,215,250,0.18);
}

.compass-btn:active {
  transform: scale(0.92);
}

/* ── Mode list ────────────────────────────────────────────── */
.mode-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.mode-row:hover .mode-orb {
  transform: scale(1.07);
}

.mode-label {
  font-family: var(--aero-font);
  font-size: 12px;
  font-weight: 600;
  color: var(--aero-text-dim);
  padding: 4px 12px;
  border-radius: var(--aero-radius-pill);
  background: var(--aero-glass);
  backdrop-filter: var(--aero-backdrop-sm);
  border: var(--aero-border);
  box-shadow: var(--aero-shadow-btn);
  white-space: nowrap;
  transition: color var(--aero-transition), border-color var(--aero-transition);
}

.mode-label.active {
  color: var(--aero-accent);
}

.mode-orb {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--aero-font);
  font-size: 8.5px;
  font-weight: 800;
  flex-shrink: 0;
  transition: transform var(--aero-transition), box-shadow var(--aero-transition);
}

/* Transitions */
.modes-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.modes-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.modes-enter-from, .modes-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
