<template>
  <div class="stat-delta row items-center no-wrap">
    <span class="stat-delta__label text-grey-5">{{ label }}:</span>
    <span
      class="stat-delta__value q-ml-xs"
      :class="valueClasses"
    >
      {{ formattedValue }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ============================================================================
// Props
// ============================================================================

const props = withDefaults(
  defineProps<{
    /** Stat label */
    label: string;
    /** Delta value (positive or negative) */
    value: number;
    /** Number of decimal places */
    decimals?: number;
    /** Whether to show as percentage */
    isPercentage?: boolean;
    /** Whether positive values are bad (e.g., requirements) */
    positiveIsBad?: boolean;
  }>(),
  {
    decimals: 0,
    isPercentage: false,
    positiveIsBad: false,
  }
);

// ============================================================================
// Computed
// ============================================================================

/** Formatted value string with sign */
const formattedValue = computed(() => {
  const sign = props.value > 0 ? '+' : '';
  const formatted = props.decimals > 0
    ? props.value.toFixed(props.decimals)
    : Math.round(props.value).toString();
  const suffix = props.isPercentage ? '%' : '';
  return `${sign}${formatted}${suffix}`;
});

/** CSS classes for value coloring */
const valueClasses = computed(() => {
  if (props.value === 0) {
    return 'text-grey-6';
  }

  const isPositive = props.value > 0;
  const isGood = props.positiveIsBad ? !isPositive : isPositive;

  return isGood ? 'text-positive' : 'text-negative';
});
</script>

<style scoped>
.stat-delta {
  /* Component-specific layout dimension */
  --label-min-width: 80px;

  font-size: 0.8rem;
  line-height: 1.6;
}

.stat-delta__label {
  min-width: var(--label-min-width);
}

.stat-delta__value {
  font-weight: 500;
}
</style>
