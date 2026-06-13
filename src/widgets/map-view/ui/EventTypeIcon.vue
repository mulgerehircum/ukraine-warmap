<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { EVENT_SVGS } from '../../../shared/lib/map/eventSvgs'

const props = defineProps<{ type: string; size?: number }>()

const gRef = ref<SVGGElement | null>(null)

function paint() {
  if (gRef.value) gRef.value.innerHTML = EVENT_SVGS[props.type] ?? ''
}

onMounted(paint)
watch(() => props.type, paint)
</script>

<template>
  <svg
    :width="props.size ?? 20"
    :height="props.size ?? 20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    style="display:block;flex-shrink:0"
  ><g ref="gRef" /></svg>
</template>
