<template>
  <div
    class="item-slot"
    :class="slotClasses"
    :style="slotStyle"
    @click="$emit('click')"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <!-- Empty slot placeholder -->
    <div v-if="!item" class="item-slot__empty fit column items-center justify-center">
      <img :src="placeholderIcon" :alt="slotInfo.name" class="item-slot__placeholder" />
      <div class="item-slot__label">{{ slotInfo.shortName }}</div>
    </div>

    <!-- Equipped item -->
    <div v-else class="item-slot__item fit flex items-center justify-center">
      <img
        :src="itemIcon"
        :alt="itemDisplayName"
        class="item-slot__icon"
        @error="handleIconError"
      />
      <!-- Rarity indicator bar -->
      <div class="item-slot__rarity-bar" :style="rarityBarStyle" />
    </div>

    <!-- Tooltip with item preview -->
    <q-tooltip
      v-if="item"
      class="item-slot__tooltip"
      anchor="center right"
      self="center left"
      :offset="[10, 0]"
      transition-show="scale"
      transition-hide="scale"
    >
      <ItemCard
        :item="item"
        :show-details="true"
        :hoverable="false"
        :width="TOOLTIP_CARD_WIDTH"
      />
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Item } from 'src/protos/items_pb';
import type { SlotInfo } from 'src/stores/itemStore';
import {
  itemIconLoader,
  getRarityColor,
  getRarityBorderColor,
} from 'src/services/itemIcons';
import ItemCard from './ItemCard.vue';

// ============================================================================
// Constants
// ============================================================================

/** Normal slot size in pixels */
const SLOT_SIZE_NORMAL = 64;

/** Small slot size for rings in pixels */
const SLOT_SIZE_SMALL = 48;

/** Flask slot width in pixels */
const FLASK_SLOT_WIDTH = 40;

/** Flask slot height in pixels */
const FLASK_SLOT_HEIGHT = 64;

/** Width of item tooltip card - string format for direct CSS usage in :style binding */
const TOOLTIP_CARD_WIDTH = '260px';

// ============================================================================
// Props & Emits
// ============================================================================

const props = withDefaults(
  defineProps<{
    /** Slot information */
    slotInfo: SlotInfo;
    /** Equipped item (if any) */
    item?: Item | null;
    /** Whether the slot is selected */
    selected?: boolean;
    /** Slot size variant */
    size?: 'normal' | 'small' | 'flask';
  }>(),
  {
    selected: false,
    size: 'normal',
  }
);

defineEmits<{
  click: [];
}>();

// ============================================================================
// State
// ============================================================================

const hovering = ref(false);
const iconError = ref(false);

// ============================================================================
// Computed Properties
// ============================================================================

/** Slot CSS classes */
const slotClasses = computed(() => ({
  'item-slot--selected': props.selected,
  'item-slot--hovering': hovering.value,
  'item-slot--empty': !props.item,
  'item-slot--equipped': !!props.item,
  [`item-slot--${props.size}`]: true,
}));

/** Slot size dimensions based on slot type */
const slotDimensions = computed<{ width: string; height: string }>(() => {
  switch (props.size) {
    case 'small':
      return { width: `${SLOT_SIZE_SMALL}px`, height: `${SLOT_SIZE_SMALL}px` };
    case 'flask':
      return { width: `${FLASK_SLOT_WIDTH}px`, height: `${FLASK_SLOT_HEIGHT}px` };
    default:
      return { width: `${SLOT_SIZE_NORMAL}px`, height: `${SLOT_SIZE_NORMAL}px` };
  }
});

/** Slot inline styles */
const slotStyle = computed(() => ({
  width: slotDimensions.value.width,
  height: slotDimensions.value.height,
  borderColor: props.item
    ? getRarityBorderColor(props.item.rarity)
    : undefined,
}));

/** Placeholder icon for empty slot */
const placeholderIcon = computed(() => {
  const slotName = props.slotInfo.name.toLowerCase().replace(/\s+/g, '-');
  return itemIconLoader.getSlotPlaceholder(slotName);
});

/** Item icon URL */
const itemIcon = computed(() => {
  if (!props.item || iconError.value) {
    return itemIconLoader.getRarityPlaceholder(
      props.item?.rarity ?? 0,
      props.item?.baseName?.charAt(0) ?? '?'
    );
  }
  // For now, use rarity placeholder since items don't have icon paths
  return itemIconLoader.getRarityPlaceholder(
    props.item.rarity ?? 0,
    props.item.baseName?.charAt(0) ?? props.item.name?.charAt(0) ?? '?'
  );
});

/** Item display name */
const itemDisplayName = computed(() => {
  if (!props.item) return props.slotInfo.name;
  return props.item.name ?? props.item.baseName ?? props.item.typeLine ?? 'Unknown';
});

/** Rarity bar style */
const rarityBarStyle = computed(() => ({
  backgroundColor: getRarityColor(props.item?.rarity),
}));

// ============================================================================
// Methods
// ============================================================================

function handleIconError(): void {
  iconError.value = true;
}
</script>

<style scoped>
/* Uses global PoE2 theme variables from themes/poe2.scss */
.item-slot {
  /*
   * Component-specific dimensions as CSS custom properties for responsive scaling.
   * These are designed to be adjusted via media queries for different resolutions
   * and DPI settings. Current values are base defaults for standard displays.
   * Future: Add @media queries for high-DPI displays and mobile viewports.
   */
  --placeholder-scale: 60%;
  --icon-scale: 90%;
  --rarity-bar-height: 3px;

  position: relative;
  background-color: var(--poe2-slot-bg);
  border: 2px solid var(--poe2-slot-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}

.item-slot:hover {
  border-color: var(--poe2-slot-border-hover);
  transform: scale(1.02);
}

.item-slot--selected {
  border-color: var(--q-primary) !important;
  /* Use solid primary color for glow - alpha not needed for box-shadow spread effect */
  box-shadow: 0 0 8px var(--q-primary);
}

.item-slot--equipped {
  /* Equipped slot has item-specific border color */
}

.item-slot__empty {
  opacity: 0.5;
}

.item-slot__placeholder {
  width: var(--placeholder-scale);
  height: var(--placeholder-scale);
  object-fit: contain;
  opacity: 0.6;
}

.item-slot__label {
  /* Typography values that don't have Quasar equivalents */
  --label-font-size: 0.65rem;
  --label-spacing: 0.5px;
  --label-margin: 2px;

  font-size: var(--label-font-size);
  color: var(--poe2-text-muted);
  margin-top: var(--label-margin);
  text-transform: uppercase;
  letter-spacing: var(--label-spacing);
}

/* item-slot__item uses Quasar 'fit' class for width/height: 100% */

.item-slot__icon {
  width: var(--icon-scale);
  height: var(--icon-scale);
  object-fit: contain;
}

.item-slot__rarity-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--rarity-bar-height);
}

/* Size variants are handled by slotDimensions computed property (inline styles)
   for dynamic sizing based on props.size */

/* Tooltip styling */
.item-slot__tooltip {
  background: transparent;
  padding: 0;
}
</style>
