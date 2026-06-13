<script setup lang="ts">
defineProps<{ count: number }>()
</script>

<template>
  <Transition name="fade">
    <div v-if="count > 0" class="alert-badge">
      <span class="alert-badge__dot" />
      <span class="alert-badge__text">{{ count }} active alert{{ count === 1 ? '' : 's' }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.alert-badge {
  position: absolute;
  top: 62px;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: fit-content;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px 4px 10px;
  background: var(--aero-glass);
  backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(var(--aero-red-rgb), 0.45);
  border-radius: var(--aero-radius-pill);
  box-shadow: var(--aero-shadow), 0 0 14px rgba(var(--aero-red-rgb), 0.18);
  white-space: nowrap;
  pointer-events: none;
}

.alert-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--aero-red);
  animation: pulse 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

.alert-badge__text {
  font-family: var(--aero-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(var(--aero-red-rgb), 0.95);
  text-transform: uppercase;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.75); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
