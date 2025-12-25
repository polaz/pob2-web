<template>
  <q-page class="items-page">
    <div class="items-page__container row q-gutter-md">
      <!-- Left panel: Equipment slots -->
      <div class="items-page__slots col-12 col-md-auto">
        <q-card flat bordered class="items-page__card">
          <q-card-section class="q-pa-sm">
            <div class="text-subtitle2 q-mb-sm">Equipment</div>
            <ItemSlotGrid
              @slot-select="handleSlotSelect"
              @edit-item="handleEditItem"
              @paste-item="handlePasteItem"
            />
          </q-card-section>
        </q-card>
      </div>

      <!-- Center panel: Selected item details -->
      <div class="items-page__details col">
        <q-card flat bordered class="items-page__card full-height">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <div class="text-subtitle2">{{ selectedSlotName }}</div>
              <q-space />
              <q-btn
                v-if="selectedItem"
                color="primary"
                size="sm"
                icon="edit"
                label="Edit"
                @click="openEditorForSelected"
              />
              <q-btn
                v-else
                color="primary"
                size="sm"
                icon="add"
                label="Add Item"
                @click="openEditorForNew"
              />
            </div>

            <!-- No slot selected -->
            <div v-if="!selectedSlot" class="items-page__empty text-center q-pa-xl">
              <q-icon name="touch_app" size="64px" color="grey-6" />
              <div class="text-grey-6 q-mt-md text-h6">Select an equipment slot</div>
              <div class="text-grey-7 q-mt-xs">
                Click on a slot to view or edit the equipped item
              </div>
            </div>

            <!-- Slot selected but empty -->
            <div v-else-if="!selectedItem" class="items-page__empty text-center q-pa-xl">
              <q-icon name="inventory_2" size="64px" color="grey-6" />
              <div class="text-grey-6 q-mt-md text-h6">No item equipped</div>
              <div class="text-grey-7 q-mt-xs">
                Click "Add Item" or paste an item from the game
              </div>
              <q-btn
                color="primary"
                class="q-mt-md"
                icon="content_paste"
                label="Paste from Game"
                @click="handlePasteFromClipboard"
              />
            </div>

            <!-- Item details -->
            <div v-else>
              <ItemCard
                :item="selectedItem"
                :show-details="true"
                :hoverable="false"
                width="100%"
              >
                <template #actions>
                  <q-btn
                    flat
                    round
                    dense
                    icon="content_copy"
                    size="sm"
                    @click="handleCopyItem"
                  >
                    <q-tooltip>Copy item</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    icon="compare"
                    size="sm"
                    @click="handleCompareItem"
                  >
                    <q-tooltip>Compare</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    size="sm"
                    color="negative"
                    @click="handleRemoveItem"
                  >
                    <q-tooltip>Remove</q-tooltip>
                  </q-btn>
                </template>
              </ItemCard>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Right panel: Comparison -->
      <div class="items-page__comparison col-12 col-lg-auto">
        <ItemComparisonPane
          :item-a="comparisonItemA"
          :item-b="comparisonItemB"
          @clear="clearComparison"
        />
      </div>
    </div>

    <!-- Item editor modal -->
    <ItemEditor
      v-model="isEditorOpen"
      :item="editingItem"
      v-bind="editingSlot !== undefined ? { 'target-slot': editingSlot } : {}"
      @save="handleEditorSave"
      @cancel="handleEditorCancel"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Item, ItemSlot } from 'src/protos/pob2_pb';
import { useItemStore } from 'src/stores/itemStore';
import { useBuildStore } from 'src/stores/buildStore';
import { parseItem } from 'src/engine/items/ItemParser';
import ItemSlotGrid from 'src/components/items/ItemSlotGrid.vue';
import ItemCard from 'src/components/items/ItemCard.vue';
import ItemEditor from 'src/components/items/ItemEditor.vue';
import ItemComparisonPane from 'src/components/items/ItemComparisonPane.vue';

// ============================================================================
// Stores
// ============================================================================

const itemStore = useItemStore();
const buildStore = useBuildStore();

// ============================================================================
// State
// ============================================================================

/** Whether editor modal is open */
const isEditorOpen = ref(false);

/** Item being edited */
const editingItem = ref<Item | null>(null);

/** Slot being edited */
const editingSlot = ref<ItemSlot | undefined>(undefined);

/** Item A for comparison (current equipped) */
const comparisonItemA = ref<Item | null>(null);

/** Item B for comparison */
const comparisonItemB = ref<Item | null>(null);

// ============================================================================
// Computed
// ============================================================================

/** Currently selected slot */
const selectedSlot = computed(() => itemStore.selectedSlot);

/** Display name for selected slot */
const selectedSlotName = computed(() => {
  if (!selectedSlot.value) return 'Equipment';
  return itemStore.getSlotName(selectedSlot.value);
});

/** Item equipped in selected slot */
const selectedItem = computed(() => {
  if (!selectedSlot.value) return null;
  return buildStore.equippedItems[String(selectedSlot.value)] ?? null;
});

// ============================================================================
// Slot Event Handlers
// ============================================================================

/**
 * Handles slot selection from grid.
 */
function handleSlotSelect(_slot: ItemSlot): void {
  // Selection is handled by the store via ItemSlotGrid
}

/**
 * Handles edit request from grid context menu.
 */
function handleEditItem(slot: ItemSlot, item: Item): void {
  editingSlot.value = slot;
  editingItem.value = item;
  isEditorOpen.value = true;
}

/**
 * Handles paste from grid context menu.
 */
function handlePasteItem(slot: ItemSlot, item: Item): void {
  buildStore.setEquippedItem(slot, item);
  itemStore.addToRecentItems(item);
}

// ============================================================================
// Editor Actions
// ============================================================================

/**
 * Opens editor for selected slot (editing existing item).
 */
function openEditorForSelected(): void {
  if (!selectedSlot.value || !selectedItem.value) return;
  editingSlot.value = selectedSlot.value;
  editingItem.value = selectedItem.value;
  isEditorOpen.value = true;
}

/**
 * Opens editor for new item in selected slot.
 */
function openEditorForNew(): void {
  if (!selectedSlot.value) return;
  editingSlot.value = selectedSlot.value;
  editingItem.value = null;
  isEditorOpen.value = true;
}

/**
 * Handles editor save.
 */
function handleEditorSave(item: Item, slot?: ItemSlot): void {
  const targetSlot = slot ?? editingSlot.value;
  if (targetSlot !== undefined) {
    buildStore.setEquippedItem(targetSlot, item);
    itemStore.addToRecentItems(item);
  }
  editingItem.value = null;
  editingSlot.value = undefined;
}

/**
 * Handles editor cancel.
 */
function handleEditorCancel(): void {
  editingItem.value = null;
  editingSlot.value = undefined;
}

// ============================================================================
// Item Actions
// ============================================================================

/**
 * Copies selected item to clipboard.
 */
function handleCopyItem(): void {
  if (selectedItem.value) {
    itemStore.copyItem(selectedItem.value);
  }
}

/**
 * Sets up comparison for selected item.
 */
function handleCompareItem(): void {
  if (selectedItem.value) {
    comparisonItemA.value = selectedItem.value;
    // Item B would be set when user selects another item or pastes one
  }
}

/**
 * Removes item from selected slot.
 */
function handleRemoveItem(): void {
  if (selectedSlot.value) {
    buildStore.removeEquippedItem(selectedSlot.value);
  }
}

/**
 * Pastes item from system clipboard.
 */
async function handlePasteFromClipboard(): Promise<void> {
  if (!selectedSlot.value) return;

  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      console.warn('Clipboard is empty');
      return;
    }

    const result = parseItem(text);
    if (result.success && result.item) {
      // If there's already an item equipped, set it as comparison A
      if (selectedItem.value) {
        comparisonItemA.value = selectedItem.value;
        comparisonItemB.value = result.item;
      }

      buildStore.setEquippedItem(selectedSlot.value, result.item);
      itemStore.addToRecentItems(result.item);
    } else {
      console.warn('Failed to parse item:', result.error);
    }
  } catch (error) {
    console.warn('Failed to read clipboard:', error);
  }
}

/**
 * Clears comparison.
 */
function clearComparison(): void {
  comparisonItemA.value = null;
  comparisonItemB.value = null;
}
</script>

<style scoped>
.items-page {
  /* Layout dimensions */
  --page-padding: 16px;
  --slots-panel-width: 280px;
  --details-panel-min-width: 300px;
  --comparison-panel-min-width: 280px;
  --comparison-panel-max-width: 320px;
  --empty-state-min-height: 300px;
  --header-offset: 100px;

  padding: var(--page-padding);
}

.items-page__container {
  min-height: calc(100vh - var(--header-offset));
}

.items-page__card {
  background-color: #0d0d14;
}

.items-page__slots {
  min-width: var(--slots-panel-width);
}

.items-page__details {
  min-width: var(--details-panel-min-width);
}

.items-page__comparison {
  min-width: var(--comparison-panel-min-width);
  max-width: var(--comparison-panel-max-width);
}

.items-page__empty {
  min-height: var(--empty-state-min-height);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Responsive adjustments */
@media (max-width: 1023px) {
  .items-page__comparison {
    max-width: none;
  }
}
</style>
