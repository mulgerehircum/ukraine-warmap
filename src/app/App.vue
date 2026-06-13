<script setup lang="ts">
import HomePage from '../pages/home/ui/HomePage.vue'
</script>

<template>
  <HomePage />
</template>

<style>
*, *::before, *::after { box-sizing: border-box; }
html, body, #app { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }

:root {
  --aero-font: 'Segoe UI', system-ui, sans-serif;

  /* Dark glass */
  --aero-glass:       rgba(6, 12, 18, 0.72);
  --aero-glass-light: rgba(15, 25, 35, 0.60);

  /* Borders */
  --aero-border:       1px solid rgba(77, 215, 250, 0.22);
  --aero-border-hover: 1px solid rgba(77, 215, 250, 0.55);

  /* Shadows & glow */
  --aero-shadow:      0 4px 24px rgba(0, 0, 0, 0.65);
  --aero-shadow-btn:  0 2px 14px rgba(0, 0, 0, 0.55);
  --aero-glow:        0 0 18px rgba(77, 215, 250, 0.25);
  --aero-inset-glow:  inset 0 0 12px 1px rgba(77, 215, 250, 0.12);

  /* Palette */
  --aero-accent:     #4DD7FA;
  --aero-accent-rgb: 77, 215, 250;   /* raw for rgba(var(--aero-accent-rgb), α) */
  --aero-amber:      #fcd34d;
  --aero-amber-rgb:  252, 211, 77;
  --aero-red:        #d32f2f;
  --aero-red-rgb:    211, 47, 47;
  --aero-orange:     #f97316;
  --aero-orange-rgb: 249, 115, 22;

  /* Text */
  --aero-text:      #f3f4f6;
  --aero-text-dim:  #a1a1a5;

  /* Shape */
  --aero-radius:      8px;
  --aero-radius-pill: 100px;

  /* Backdrop filters */
  --aero-backdrop:    blur(16px) saturate(140%);  /* panels, popups */
  --aero-backdrop-sm: blur(12px);                 /* small buttons, labels */

  /* Transition timings */
  --aero-transition:      0.15s;
  --aero-transition-fast: 0.08s;
  --aero-transition-slow: 0.20s;
}
</style>
