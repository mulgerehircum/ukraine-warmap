<script setup lang="ts">
defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" @click.self="$emit('close')">
        <div class="modal">
          <button class="close-btn" @click="$emit('close')">✕</button>
          <h2>Data sources</h2>
          <ul>
            <li>
              <strong>Satellite imagery</strong> —
              <a href="https://s2maps.eu" target="_blank" rel="noopener">EOX S2Maps</a>
              © EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2021)
            </li>
            <li>
              <strong>Map tiles &amp; terrain</strong> —
              <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a>
              ·
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>
            </li>
            <li>
              <strong>Rendering</strong> —
              <a href="https://maplibre.org" target="_blank" rel="noopener">MapLibre GL JS</a>
            </li>
            <li>
              <strong>Oblast borders</strong> —
              <a href="https://gadm.org" target="_blank" rel="noopener">GADM</a>
              v4.1, academic/non-commercial use
            </li>
            <li>
              <strong>Territorial control &amp; events</strong> —
              <a href="https://github.com/zhukovyuri/VIINA" target="_blank" rel="noopener">VIINA</a>
              (Violent Incident Information from News Articles), Yuri Zhukov et al.
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  position: relative;
  background: var(--aero-glass);
  backdrop-filter: blur(20px) saturate(140%);
  border: var(--aero-border);
  box-shadow: var(--aero-shadow), var(--aero-inset-glow);
  border-radius: var(--aero-radius);
  padding: 28px 32px;
  max-width: 480px;
  width: 90%;
}

.modal h2 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--aero-font);
  color: var(--aero-accent);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.modal ul {
  margin: 0;
  padding: 0 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  line-height: 1.55;
  font-family: var(--aero-font);
  color: var(--aero-text-dim);
}

.modal strong {
  color: var(--aero-text);
  font-weight: 600;
}

.modal a {
  color: var(--aero-accent);
  text-decoration: none;
}

.modal a:hover {
  color: var(--aero-amber);
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--aero-glass);
  border: var(--aero-border);
  box-shadow: var(--aero-shadow-btn);
  border-radius: 50%;
  cursor: pointer;
  font-size: 11px;
  color: var(--aero-text-dim);
  transition: border 0.15s, color 0.15s;
}

.close-btn:hover {
  border: var(--aero-border-hover);
  color: var(--aero-text);
}

.modal-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.96) translateY(8px); }
</style>
