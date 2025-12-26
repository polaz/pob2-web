<template>
  <div class="item-slot-grid">
    <!-- Main equipment grid -->
    <div class="item-slot-grid__main row justify-center">
      <!-- Left column: Weapons -->
      <div class="item-slot-grid__column column">
        <ItemSlotComponent
          v-for="slot in leftColumnSlots"
          :key="slot.slot"
          :slot-info="slot"
          :item="getEquippedItem(slot.slot)"
          :selected="selectedSlot === slot.slot"
          @click="handleSlotClick(slot.slot)"
          @contextmenu.prevent="handleSlotContextMenu(slot.slot, $event)"
        />
      </div>

      <!-- Center column: Body, Helm, Belt -->
      <div class="item-slot-grid__column column item-slot-grid__column--center">
        <ItemSlotComponent
          v-for="slot in centerColumnSlots"
          :key="slot.slot"
          :slot-info="slot"
          :item="getEquippedItem(slot.slot)"
          :selected="selectedSlot === slot.slot"
          @click="handleSlotClick(slot.slot)"
          @contextmenu.prevent="handleSlotContextMenu(slot.slot, $event)"
        />
      </div>

      <!-- Right column: Gloves, Boots, Amulet -->
      <div class="item-slot-grid__column column">
        <ItemSlotComponent
          v-for="slot in rightColumnSlots"
          :key="slot.slot"
          :slot-info="slot"
          :item="getEquippedItem(slot.slot)"
          :selected="selectedSlot === slot.slot"
          @click="handleSlotClick(slot.slot)"
          @contextmenu.prevent="handleSlotContextMenu(slot.slot, $event)"
        />
      </div>
    </div>

    <!-- Ring row -->
    <div class="item-slot-grid__rings row justify-center q-gutter-md q-mt-md">
      <ItemSlotComponent
        v-for="slot in ringSlots"
        :key="slot.slot"
        :slot-info="slot"
        :item="getEquippedItem(slot.slot)"
        :selected="selectedSlot === slot.slot"
        :size="'small'"
        @click="handleSlotClick(slot.slot)"
        @contextmenu.prevent="handleSlotContextMenu(slot.slot, $event)"
      />
    </div>

    <!-- Weapon swap toggle -->
    <div class="item-slot-grid__swap row items-center justify-center q-mt-md">
      <q-btn
        :color="isWeaponSwapActive ? 'primary' : 'grey-8'"
        :text-color="isWeaponSwapActive ? 'white' : 'grey-5'"
        size="sm"
        dense
        flat
        @click="toggleWeaponSwap"
      >
        <q-icon name="swap_horiz" class="q-mr-xs" />
        Weapon Set {{ isWeaponSwapActive ? '2' : '1' }}
      </q-btn>
    </div>

    <!-- Swap weapon slots (shown when swap is active) -->
    <div v-if="showSwapSlots" class="item-slot-grid__swap-slots row justify-center q-gutter-md q-mt-sm">
      <ItemSlotComponent
        v-for="slot in swapSlots"
        :key="slot.slot"
        :slot-info="slot"
        :item="getEquippedItem(slot.slot)"
        :selected="selectedSlot === slot.slot"
        @click="handleSlotClick(slot.slot)"
        @contextmenu.prevent="handleSlotContextMenu(slot.slot, $event)"
      />
    </div>

    <!-- Flask row -->
    <div class="item-slot-grid__flasks row justify-center q-gutter-sm q-mt-lg">
      <ItemSlotComponent
        v-for="slot in flaskSlots"
        :key="slot.slot"
        :slot-info="slot"
        :item="getEquippedItem(slot.slot)"
        :selected="selectedSlot === slot.slot"
        :size="'flask'"
        @click="handleSlotClick(slot.slot)"
        @contextmenu.prevent="handleSlotContextMenu(slot.slot, $event)"
      />
    </div>

    <!-- Context menu -->
    <q-menu v-model="contextMenuVisible" :target="contextMenuTarget" context-menu>
      <q-list dense class="item-slot-grid__context-menu">
        <q-item v-if="contextMenuSlot !== null && getEquippedItem(contextMenuSlot)" clickable v-close-popup @click="handleEditItem">
          <q-item-section avatar>
            <q-icon name="edit" size="sm" />
          </q-item-section>
          <q-item-section>Edit</q-item-section>
        </q-item>
        <q-item v-if="contextMenuSlot !== null && getEquippedItem(contextMenuSlot)" clickable v-close-popup @click="handleCopyItem">
          <q-item-section avatar>
            <q-icon name="content_copy" size="sm" />
          </q-item-section>
          <q-item-section>Copy</q-item-section>
        </q-item>
        <q-item v-if="hasClipboardItem" clickable v-close-popup @click="handlePasteItem">
          <q-item-section avatar>
            <q-icon name="content_paste" size="sm" />
          </q-item-section>
          <q-item-section>Paste</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="handlePasteFromClipboard">
          <q-item-section avatar>
            <q-icon name="content_paste_go" size="sm" />
          </q-item-section>
          <q-item-section>Paste from Game</q-item-section>
        </q-item>
        <q-separator v-if="contextMenuSlot !== null && getEquippedItem(contextMenuSlot)" />
        <q-item v-if="contextMenuSlot !== null && getEquippedItem(contextMenuSlot)" clickable v-close-popup @click="handleRemoveItem" class="text-negative">
          <q-item-section avatar>
            <q-icon name="delete" size="sm" />
          </q-item-section>
          <q-item-section>Remove</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Item } from 'src/protos/items_pb';
import { ItemSlot as ItemSlotEnum } from 'src/protos/items_pb';
import { useItemStore, EQUIPMENT_SLOTS, FLASK_SLOTS, SWAP_SLOTS, type SlotInfo } from 'src/stores/itemStore';
import { useBuildStore } from 'src/stores/buildStore';
import { parseItem } from 'src/engine/items/ItemParser';
import ItemSlotComponent from './ItemSlot.vue';

// ============================================================================
// Props & Emits
// ============================================================================

withDefaults(
  defineProps<{
    /** Whether to show swap weapon slots */
    showSwapSlots?: boolean;
  }>(),
  {
    showSwapSlots: true,
  }
);

const emit = defineEmits<{
  /** Emitted when a slot is selected */
  'slot-select': [slot: ItemSlotEnum];
  /** Emitted when edit is requested for an item */
  'edit-item': [slot: ItemSlotEnum, item: Item];
  /** Emitted when paste from clipboard is requested */
  'paste-item': [slot: ItemSlotEnum, item: Item];
}>();

// ============================================================================
// Stores
// ============================================================================

const itemStore = useItemStore();
const buildStore = useBuildStore();

// ============================================================================
// Slot Organization
// ============================================================================

/** Left column slots: Main Hand, Off Hand */
const leftColumnSlots = computed<SlotInfo[]>(() => {
  const slots = itemStore.activeWeaponSlots;
  return EQUIPMENT_SLOTS.filter(
    (s) => s.slot === slots.mainHand || s.slot === slots.offHand
  );
});

/** Center column slots: Helmet, Body Armour, Belt */
const centerColumnSlots = computed<SlotInfo[]>(() => {
  return EQUIPMENT_SLOTS.filter((s) =>
    ['SLOT_HELMET', 'SLOT_BODY_ARMOUR', 'SLOT_BELT'].includes(
      getSlotEnumName(s.slot)
    )
  );
});

/** Right column slots: Gloves, Boots, Amulet */
const rightColumnSlots = computed<SlotInfo[]>(() => {
  return EQUIPMENT_SLOTS.filter((s) =>
    ['SLOT_GLOVES', 'SLOT_BOOTS', 'SLOT_AMULET'].includes(getSlotEnumName(s.slot))
  );
});

/** Ring slots */
const ringSlots = computed<SlotInfo[]>(() => {
  return EQUIPMENT_SLOTS.filter((s) =>
    ['SLOT_RING_1', 'SLOT_RING_2'].includes(getSlotEnumName(s.slot))
  );
});

/** Flask slots */
const flaskSlots = computed<SlotInfo[]>(() => FLASK_SLOTS);

/** Weapon swap slots */
const swapSlots = computed<SlotInfo[]>(() => SWAP_SLOTS);

/** Selected slot from store */
const selectedSlot = computed(() => itemStore.selectedSlot);

/** Weapon swap state from store - controls which weapon set label is shown */
const isWeaponSwapActive = computed(() => itemStore.isWeaponSwapActive);

/** Whether clipboard has an item - used to conditionally show paste option in context menu */
const hasClipboardItem = computed(() => itemStore.hasClipboardItem);

// ============================================================================
// Context Menu State
// ============================================================================

const contextMenuVisible = ref(false);
const contextMenuTarget = ref<Element | undefined>(undefined);
const contextMenuSlot = ref<ItemSlotEnum | null>(null);

// ============================================================================
// Methods
// ============================================================================

/** Returns enum key name using TypeScript reverse mapping (e.g., 3 → 'SLOT_HELMET'). */
function getSlotEnumName(slot: ItemSlotEnum): string {
  const name = ItemSlotEnum[slot];
  return typeof name === 'string' ? name : 'UNKNOWN';
}

/**
 * Gets the equipped item for a slot.
 */
function getEquippedItem(slot: ItemSlotEnum): Item | null {
  const items = buildStore.equippedItems;
  return items[String(slot)] ?? null;
}

/**
 * Handles slot click.
 */
function handleSlotClick(slot: ItemSlotEnum): void {
  itemStore.selectSlot(slot);
  emit('slot-select', slot);
}

/**
 * Handles slot context menu.
 */
function handleSlotContextMenu(slot: ItemSlotEnum, event: MouseEvent): void {
  contextMenuSlot.value = slot;
  contextMenuTarget.value = event.target as Element;
  contextMenuVisible.value = true;
}

/**
 * Toggles weapon swap.
 */
function toggleWeaponSwap(): void {
  itemStore.toggleWeaponSwap();
}

/**
 * Handles edit item from context menu.
 */
function handleEditItem(): void {
  if (contextMenuSlot.value === null) return;
  const item = getEquippedItem(contextMenuSlot.value);
  if (item) {
    emit('edit-item', contextMenuSlot.value, item);
  }
}

/**
 * Handles copy item to clipboard.
 */
function handleCopyItem(): void {
  if (contextMenuSlot.value === null) return;
  const item = getEquippedItem(contextMenuSlot.value);
  if (item) {
    itemStore.copyItem(item);
  }
}

/**
 * Handles paste item from internal clipboard.
 */
function handlePasteItem(): void {
  if (contextMenuSlot.value === null || !itemStore.clipboardItem) return;
  buildStore.setEquippedItem(contextMenuSlot.value, itemStore.clipboardItem);
}

/**
 * Handles paste from system clipboard (game item text).
 *
 * Error handling note: This component uses console.warn for errors rather than
 * user-facing notifications. As a reusable grid component, notification strategy
 * should be determined by the parent component, not enforced here. The parent
 * page (ItemsPage.vue) provides its own paste handler with full UI notifications.
 * Context menu paste failures are logged for debugging but don't interrupt user flow.
 */
async function handlePasteFromClipboard(): Promise<void> {
  if (contextMenuSlot.value === null) return;

  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      console.warn('Clipboard is empty');
      return;
    }

    const result = parseItem(text);
    if (result.success && result.item) {
      emit('paste-item', contextMenuSlot.value, result.item);
    } else {
      console.warn('Failed to parse item:', result.error);
    }
  } catch (error) {
    console.warn('Failed to read clipboard:', error);
  }
}

/**
 * Handles remove item from slot.
 */
function handleRemoveItem(): void {
  if (contextMenuSlot.value === null) return;
  buildStore.removeEquippedItem(contextMenuSlot.value);
}
</script>

<style scoped>
/* Uses global PoE2 theme variables from themes/poe2.scss */
.item-slot-grid {
  /* Component-specific layout spacing as CSS custom properties */
  --grid-padding: 16px;
  --column-gap: 24px;
  --slot-gap: 8px;

  padding: var(--grid-padding);
}

.item-slot-grid__main {
  gap: var(--column-gap);
}

.item-slot-grid__column {
  gap: var(--slot-gap);
}

/* Center column uses same gap as other columns via Quasar classes.
   Quasar layout utilities preferred over custom CSS per project guidelines. */

/* Ring row uses Quasar q-gutter-md class for consistent spacing.
   Quasar layout utilities preferred over custom CSS per project guidelines. */

.item-slot-grid__swap {
  opacity: 0.8;
}

.item-slot-grid__swap-slots {
  opacity: 0.7;
  border: 1px dashed var(--poe2-border-muted);
  border-radius: 8px;
  padding: var(--slot-gap);
}

.item-slot-grid__flasks {
  padding-top: var(--slot-gap);
  border-top: 1px solid var(--poe2-border-subtle);
}

.item-slot-grid__context-menu {
  --context-menu-min-width: 150px;
  min-width: var(--context-menu-min-width);
}
</style>
