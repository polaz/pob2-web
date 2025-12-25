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
    <div v-if="!item" class="item-slot__empty">
      <img :src="placeholderIcon" :alt="slotInfo.name" class="item-slot__placeholder" />
      <div class="item-slot__label">{{ slotInfo.shortName }}</div>
    </div>

    <!-- Equipped item -->
    <div v-else class="item-slot__item">
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
        width="260px"
      />
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Item } from 'src/protos/pob2_pb';
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

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  /** Slot information */
  slotInfo: SlotInfo;
  /** Equipped item (if any) */
  item?: Item | null;
  /** Whether the slot is selected */
  selected?: boolean;
  /** Slot size variant */
  size?: 'normal' | 'small' | 'flask';
}>();

// Provide defaults via computed properties to avoid exactOptionalPropertyTypes issues
const isSelected = computed(() => props.selected ?? false);
const slotSize = computed(() => props.size ?? 'normal');

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
  'item-slot--selected': isSelected.value,
  'item-slot--hovering': hovering.value,
  'item-slot--empty': !props.item,
  'item-slot--equipped': !!props.item,
  [`item-slot--${slotSize.value}`]: true,
}));

/** Slot size dimensions */
const slotDimensions = computed(() => {
  switch (slotSize.value) {
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
.item-slot {
  --slot-bg: #1a1a2e;
  --slot-border: #3a3a4e;
  --slot-hover-border: #5a5a7e;

  position: relative;
  background-color: var(--slot-bg);
  border: 2px solid var(--slot-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}

.item-slot:hover {
  border-color: var(--slot-hover-border);
  transform: scale(1.02);
}

.item-slot--selected {
  border-color: var(--q-primary) !important;
  box-shadow: 0 0 8px rgba(var(--q-primary-rgb), 0.4);
}

.item-slot--equipped {
  /* Equipped slot has item-specific border color */
}

.item-slot__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  opacity: 0.5;
}

.item-slot__placeholder {
  width: 60%;
  height: 60%;
  object-fit: contain;
  opacity: 0.6;
}

.item-slot__label {
  font-size: 0.65rem;
  color: #666;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.item-slot__item {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-slot__icon {
  width: 90%;
  height: 90%;
  object-fit: contain;
}

.item-slot__rarity-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

/* Size variants */
.item-slot--small {
  /* Small slot (rings) */
}

.item-slot--flask {
  /* Flask slot - taller aspect ratio */
}

/* Tooltip styling */
.item-slot__tooltip {
  background: transparent;
  padding: 0;
}
</style>
