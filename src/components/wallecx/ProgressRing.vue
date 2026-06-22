<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 0–100 */
    pct: number;
    /** stroke color for the progress arc */
    color: string;
    /** rendered px size (square) */
    size?: number;
  }>(),
  { size: 44 },
);

// Geometry matches the 42x42 viewBox: r=18 → circumference ≈ 113.1.
const RADIUS = 18;
const CIRC = 2 * Math.PI * RADIUS;

const clamped = computed(() => Math.min(100, Math.max(0, Math.round(props.pct))));
const offset = computed(() => CIRC * (1 - clamped.value / 100));
</script>

<template>
  <div
    class="progress-ring"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="`${clamped}% complete`"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 42 42"
      style="transform: rotate(-90deg)"
      aria-hidden="true"
    >
      <circle
        cx="21"
        cy="21"
        :r="RADIUS"
        fill="none"
        stroke="var(--color-surface-divider)"
        stroke-width="4"
      />
      <circle
        cx="21"
        cy="21"
        :r="RADIUS"
        fill="none"
        :stroke="color"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="CIRC"
        :stroke-dashoffset="offset"
        style="transition: stroke-dashoffset 0.35s ease"
      />
    </svg>
    <span class="progress-ring-label">{{ clamped }}%</span>
  </div>
</template>

<style scoped>
.progress-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.progress-ring-label {
  position: absolute;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-typo-heading);
}
</style>
