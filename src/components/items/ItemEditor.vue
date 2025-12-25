<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="item-editor">
      <!-- Header -->
      <q-card-section class="item-editor__header row items-center q-pb-none">
        <div class="text-h6">{{ isEditing ? 'Edit Item' : 'Create Item' }}</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="handleClose" />
      </q-card-section>

      <!-- Main content -->
      <q-card-section class="item-editor__content row q-gutter-md">
        <!-- Left panel: Item form -->
        <div class="col-12 col-md-7">
          <!-- Paste from clipboard -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <q-btn
                  color="primary"
                  icon="content_paste"
                  label="Paste from Game"
                  @click="handlePasteFromClipboard"
                />
                <span class="text-caption text-grey">
                  Copy an item in-game (Ctrl+C) and paste here
                </span>
              </div>
              <q-input
                v-model="pasteText"
                type="textarea"
                label="Or paste item text here..."
                outlined
                dense
                rows="3"
                class="q-mt-sm"
                @update:model-value="handlePasteTextChange"
              />
              <div v-if="parseError" class="text-negative text-caption q-mt-xs">
                {{ parseError }}
              </div>
            </q-card-section>
          </q-card>

          <!-- Basic info -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Basic Information</div>
              <div class="row q-gutter-sm">
                <q-select
                  v-model="editedItem.rarity"
                  :options="rarityOptions"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  label="Rarity"
                  outlined
                  dense
                  class="col-12 col-sm-4"
                />
                <q-input
                  v-model="editedItem.name"
                  label="Item Name"
                  outlined
                  dense
                  class="col-12 col-sm-8"
                  :hint="editedItem.rarity === 3 || editedItem.rarity === 4 ? 'Required for rare/unique' : 'Optional'"
                />
              </div>
              <div class="row q-gutter-sm q-mt-sm">
                <q-input
                  v-model="editedItem.baseName"
                  label="Base Type"
                  outlined
                  dense
                  class="col-12 col-sm-6"
                  hint="e.g., 'Exquisite Leather'"
                />
                <q-input
                  v-model.number="editedItem.itemLevel"
                  type="number"
                  label="Item Level"
                  outlined
                  dense
                  class="col-6 col-sm-3"
                  min="1"
                  max="100"
                />
                <q-input
                  v-model.number="editedItem.quality"
                  type="number"
                  label="Quality %"
                  outlined
                  dense
                  class="col-6 col-sm-3"
                  min="0"
                  max="30"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Requirements -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Requirements</div>
              <div class="row q-gutter-sm">
                <q-input
                  v-model.number="editedItem.requiredLevel"
                  type="number"
                  label="Level"
                  outlined
                  dense
                  class="col-6 col-sm-3"
                  min="1"
                  max="100"
                />
                <q-input
                  v-model.number="editedItem.requiredStr"
                  type="number"
                  label="Str"
                  outlined
                  dense
                  class="col-6 col-sm-3"
                  min="0"
                />
                <q-input
                  v-model.number="editedItem.requiredDex"
                  type="number"
                  label="Dex"
                  outlined
                  dense
                  class="col-6 col-sm-3"
                  min="0"
                />
                <q-input
                  v-model.number="editedItem.requiredInt"
                  type="number"
                  label="Int"
                  outlined
                  dense
                  class="col-6 col-sm-3"
                  min="0"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Modifiers -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Modifiers</div>

              <!-- Implicit mods -->
              <div class="q-mb-md">
                <div class="row items-center q-mb-xs">
                  <span class="text-caption text-cyan">Implicit Mods</span>
                  <q-space />
                  <q-btn size="xs" flat icon="add" @click="addMod('implicit')" />
                </div>
                <div v-for="(_mod, idx) in editedImplicits" :key="`imp-${idx}`" class="row items-center q-gutter-xs q-mb-xs">
                  <q-input
                    v-model="editedImplicits[idx]"
                    outlined
                    dense
                    class="col"
                    placeholder="e.g., +15 to Maximum Life"
                  />
                  <q-btn size="sm" flat icon="delete" color="negative" @click="removeMod('implicit', idx)" />
                </div>
              </div>

              <!-- Explicit mods -->
              <div class="q-mb-md">
                <div class="row items-center q-mb-xs">
                  <span class="text-caption text-cyan">Explicit Mods</span>
                  <q-space />
                  <q-btn size="xs" flat icon="add" @click="addMod('explicit')" />
                </div>
                <div v-for="(_mod, idx) in editedExplicits" :key="`exp-${idx}`" class="row items-center q-gutter-xs q-mb-xs">
                  <q-input
                    v-model="editedExplicits[idx]"
                    outlined
                    dense
                    class="col"
                    placeholder="e.g., 20% increased Physical Damage"
                  />
                  <q-btn size="sm" flat icon="delete" color="negative" @click="removeMod('explicit', idx)" />
                </div>
              </div>

              <!-- Crafted mods -->
              <div class="q-mb-md">
                <div class="row items-center q-mb-xs">
                  <span class="text-caption text-light-blue">Crafted Mods</span>
                  <q-space />
                  <q-btn size="xs" flat icon="add" @click="addMod('crafted')" />
                </div>
                <div v-for="(_mod, idx) in editedCrafted" :key="`craft-${idx}`" class="row items-center q-gutter-xs q-mb-xs">
                  <q-input
                    v-model="editedCrafted[idx]"
                    outlined
                    dense
                    class="col"
                    placeholder="e.g., +25 to Maximum Life (crafted)"
                  />
                  <q-btn size="sm" flat icon="delete" color="negative" @click="removeMod('crafted', idx)" />
                </div>
              </div>

              <!-- Enchant mods -->
              <div>
                <div class="row items-center q-mb-xs">
                  <span class="text-caption text-light-blue">Enchant Mods</span>
                  <q-space />
                  <q-btn size="xs" flat icon="add" @click="addMod('enchant')" />
                </div>
                <div v-for="(_mod, idx) in editedEnchants" :key="`ench-${idx}`" class="row items-center q-gutter-xs q-mb-xs">
                  <q-input
                    v-model="editedEnchants[idx]"
                    outlined
                    dense
                    class="col"
                    placeholder="e.g., Enchantment text"
                  />
                  <q-btn size="sm" flat icon="delete" color="negative" @click="removeMod('enchant', idx)" />
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Status flags -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2 q-mb-sm">Status</div>
              <div class="row q-gutter-md">
                <q-toggle
                  v-model="editedItem.corrupted"
                  label="Corrupted"
                  color="red"
                />
                <q-toggle
                  v-model="editedItem.mirrored"
                  label="Mirrored"
                  color="purple"
                />
                <q-toggle
                  v-model="editedItem.fractured"
                  label="Fractured"
                  color="amber"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Right panel: Preview -->
        <div class="col-12 col-md-5">
          <div class="text-subtitle2 q-mb-sm">Preview</div>
          <ItemCard
            :item="previewItem"
            :show-details="true"
            :hoverable="false"
            width="100%"
          />

          <!-- Slot selection (when creating new) -->
          <div v-if="!isEditing && slotOptions.length > 0" class="q-mt-md">
            <q-select
              v-model="selectedSlot"
              :options="slotOptions"
              option-value="slot"
              option-label="name"
              label="Equip to Slot"
              outlined
              dense
            />
          </div>
        </div>
      </q-card-section>

      <!-- Footer actions -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" @click="handleClose" />
        <q-btn
          color="primary"
          :label="isEditing ? 'Save Changes' : 'Create Item'"
          @click="handleSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { cloneDeep } from 'lodash-es';
import type { Item, ItemSlot } from 'src/protos/pob2_pb';
import { ItemRarity } from 'src/protos/pob2_pb';
import { EQUIPMENT_SLOTS, type SlotInfo } from 'src/stores/itemStore';
import { parseItem } from 'src/engine/items/ItemParser';
import ItemCard from './ItemCard.vue';

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  /** Dialog visibility */
  modelValue: boolean;
  /** Item to edit (null for new item) */
  item?: Item | null;
  /** Target slot (for new items) */
  targetSlot?: ItemSlot;
}>();

// Default for item prop
const itemToEdit = computed(() => props.item ?? null);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  /** Emitted when item is saved */
  save: [item: Item, slot?: ItemSlot];
  /** Emitted when dialog is closed without saving */
  cancel: [];
}>();

// ============================================================================
// State
// ============================================================================

/** Paste text input */
const pasteText = ref('');

/** Parse error message */
const parseError = ref('');

/** Edited item data - use Record for dynamic optional properties */
interface EditedItemState {
  id: string;
  name: string;
  baseName: string;
  typeLine: string;
  rarity: ItemRarity;
  itemLevel: number;
  quality: number;
  requiredLevel?: number;
  requiredStr?: number;
  requiredDex?: number;
  requiredInt?: number;
  corrupted: boolean;
  mirrored: boolean;
  fractured: boolean;
}

const editedItem = reactive<EditedItemState>({
  id: '',
  name: '',
  baseName: '',
  typeLine: '',
  rarity: ItemRarity.RARITY_NORMAL,
  itemLevel: 1,
  quality: 0,
  corrupted: false,
  mirrored: false,
  fractured: false,
});

/** Mod arrays (reactive for v-model binding) */
const editedImplicits = ref<string[]>([]);
const editedExplicits = ref<string[]>([]);
const editedCrafted = ref<string[]>([]);
const editedEnchants = ref<string[]>([]);

/** Selected slot for new items */
const selectedSlot = ref<SlotInfo | null>(null);

// ============================================================================
// Options
// ============================================================================

/** Rarity dropdown options */
const rarityOptions = [
  { value: ItemRarity.RARITY_NORMAL, label: 'Normal' },
  { value: ItemRarity.RARITY_MAGIC, label: 'Magic' },
  { value: ItemRarity.RARITY_RARE, label: 'Rare' },
  { value: ItemRarity.RARITY_UNIQUE, label: 'Unique' },
];

/** Available slots for equipping */
const slotOptions = computed(() => {
  return EQUIPMENT_SLOTS;
});

// ============================================================================
// Computed
// ============================================================================

/** Whether we're editing an existing item */
const isEditing = computed(() => !!itemToEdit.value);

/** Preview item for the card */
const previewItem = computed<Item>(() => {
  // Build base item with required fields
  const item: Item = {
    id: editedItem.id || crypto.randomUUID(),
    rarity: editedItem.rarity,
    itemLevel: editedItem.itemLevel,
    quality: editedItem.quality,
    corrupted: editedItem.corrupted,
    mirrored: editedItem.mirrored,
    fractured: editedItem.fractured,
    sockets: [],
    runes: [],
    implicitMods: editedImplicits.value.filter((m) => m.trim()),
    explicitMods: editedExplicits.value.filter((m) => m.trim()),
    craftedMods: editedCrafted.value.filter((m) => m.trim()),
    enchantMods: editedEnchants.value.filter((m) => m.trim()),
    runeMods: [],
  };

  // Conditionally add optional string fields only if non-empty
  if (editedItem.name) item.name = editedItem.name;
  if (editedItem.baseName) item.baseName = editedItem.baseName;
  if (editedItem.typeLine || editedItem.baseName) {
    item.typeLine = editedItem.typeLine || editedItem.baseName;
  }

  // Conditionally add optional number fields only if defined
  if (editedItem.requiredLevel !== undefined) item.requiredLevel = editedItem.requiredLevel;
  if (editedItem.requiredStr !== undefined) item.requiredStr = editedItem.requiredStr;
  if (editedItem.requiredDex !== undefined) item.requiredDex = editedItem.requiredDex;
  if (editedItem.requiredInt !== undefined) item.requiredInt = editedItem.requiredInt;

  return item;
});

// ============================================================================
// Watchers
// ============================================================================

/** Reset form when item prop changes or dialog opens */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    }
  }
);

watch(
  () => itemToEdit.value,
  () => {
    if (props.modelValue) {
      resetForm();
    }
  }
);

// ============================================================================
// Methods
// ============================================================================

/**
 * Resets the form to initial state or item data.
 */
function resetForm(): void {
  pasteText.value = '';
  parseError.value = '';

  if (itemToEdit.value) {
    // Editing existing item
    const item = itemToEdit.value;
    editedItem.id = item.id;
    editedItem.name = item.name ?? '';
    editedItem.baseName = item.baseName ?? '';
    editedItem.typeLine = item.typeLine ?? '';
    editedItem.rarity = item.rarity ?? ItemRarity.RARITY_NORMAL;
    editedItem.itemLevel = item.itemLevel ?? 1;
    editedItem.quality = item.quality ?? 0;
    // Use conditional assignment to avoid setting undefined with exactOptionalPropertyTypes
    if (item.requiredLevel !== undefined) editedItem.requiredLevel = item.requiredLevel;
    else delete editedItem.requiredLevel;
    if (item.requiredStr !== undefined) editedItem.requiredStr = item.requiredStr;
    else delete editedItem.requiredStr;
    if (item.requiredDex !== undefined) editedItem.requiredDex = item.requiredDex;
    else delete editedItem.requiredDex;
    if (item.requiredInt !== undefined) editedItem.requiredInt = item.requiredInt;
    else delete editedItem.requiredInt;
    editedItem.corrupted = item.corrupted ?? false;
    editedItem.mirrored = item.mirrored ?? false;
    editedItem.fractured = item.fractured ?? false;

    editedImplicits.value = item.implicitMods ? [...item.implicitMods] : [];
    editedExplicits.value = item.explicitMods ? [...item.explicitMods] : [];
    editedCrafted.value = item.craftedMods ? [...item.craftedMods] : [];
    editedEnchants.value = item.enchantMods ? [...item.enchantMods] : [];
  } else {
    // Creating new item
    editedItem.id = crypto.randomUUID();
    editedItem.name = '';
    editedItem.baseName = '';
    editedItem.typeLine = '';
    editedItem.rarity = ItemRarity.RARITY_NORMAL;
    editedItem.itemLevel = 1;
    editedItem.quality = 0;
    delete editedItem.requiredLevel;
    delete editedItem.requiredStr;
    delete editedItem.requiredDex;
    delete editedItem.requiredInt;
    editedItem.corrupted = false;
    editedItem.mirrored = false;
    editedItem.fractured = false;

    editedImplicits.value = [];
    editedExplicits.value = [];
    editedCrafted.value = [];
    editedEnchants.value = [];
  }

  // Set default slot if provided
  if (props.targetSlot !== undefined) {
    selectedSlot.value = EQUIPMENT_SLOTS.find((s) => s.slot === props.targetSlot) ?? null;
  }
}

/**
 * Handles paste from system clipboard.
 */
async function handlePasteFromClipboard(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) {
      pasteText.value = text;
      handlePasteTextChange(text);
    }
  } catch (error) {
    console.warn('Failed to read from clipboard:', error);
    parseError.value = 'Failed to read clipboard. Please paste manually.';
  }
}

/**
 * Handles paste text change and parses the item.
 * q-input @update:model-value emits string | number | null;
 * we only process non-empty strings.
 */
function handlePasteTextChange(value: string | number | null): void {
  // Only process non-empty strings
  if (typeof value !== 'string' || !value.trim()) {
    parseError.value = '';
    return;
  }

  const result = parseItem(value);
  if (result.success && result.item) {
    parseError.value = '';
    applyParsedItem(result.item);

    if (result.warnings.length > 0) {
      console.warn('Item parse warnings:', result.warnings);
    }
    if (result.unparsedLines.length > 0) {
      console.warn('Unparsed lines:', result.unparsedLines);
    }
  } else {
    parseError.value = result.error ?? 'Failed to parse item';
  }
}

/**
 * Applies a parsed item to the form.
 */
function applyParsedItem(item: Item): void {
  editedItem.id = item.id;
  editedItem.name = item.name ?? '';
  editedItem.baseName = item.baseName ?? '';
  editedItem.typeLine = item.typeLine ?? '';
  editedItem.rarity = item.rarity ?? ItemRarity.RARITY_NORMAL;
  editedItem.itemLevel = item.itemLevel ?? 1;
  editedItem.quality = item.quality ?? 0;
  // Use conditional assignment to avoid setting undefined with exactOptionalPropertyTypes
  if (item.requiredLevel !== undefined) editedItem.requiredLevel = item.requiredLevel;
  else delete editedItem.requiredLevel;
  if (item.requiredStr !== undefined) editedItem.requiredStr = item.requiredStr;
  else delete editedItem.requiredStr;
  if (item.requiredDex !== undefined) editedItem.requiredDex = item.requiredDex;
  else delete editedItem.requiredDex;
  if (item.requiredInt !== undefined) editedItem.requiredInt = item.requiredInt;
  else delete editedItem.requiredInt;
  editedItem.corrupted = item.corrupted ?? false;
  editedItem.mirrored = item.mirrored ?? false;
  editedItem.fractured = item.fractured ?? false;

  editedImplicits.value = item.implicitMods ? [...item.implicitMods] : [];
  editedExplicits.value = item.explicitMods ? [...item.explicitMods] : [];
  editedCrafted.value = item.craftedMods ? [...item.craftedMods] : [];
  editedEnchants.value = item.enchantMods ? [...item.enchantMods] : [];
}

/**
 * Adds a new mod to the specified array.
 */
function addMod(type: 'implicit' | 'explicit' | 'crafted' | 'enchant'): void {
  switch (type) {
    case 'implicit':
      editedImplicits.value.push('');
      break;
    case 'explicit':
      editedExplicits.value.push('');
      break;
    case 'crafted':
      editedCrafted.value.push('');
      break;
    case 'enchant':
      editedEnchants.value.push('');
      break;
  }
}

/**
 * Removes a mod from the specified array.
 */
function removeMod(type: 'implicit' | 'explicit' | 'crafted' | 'enchant', index: number): void {
  switch (type) {
    case 'implicit':
      editedImplicits.value.splice(index, 1);
      break;
    case 'explicit':
      editedExplicits.value.splice(index, 1);
      break;
    case 'crafted':
      editedCrafted.value.splice(index, 1);
      break;
    case 'enchant':
      editedEnchants.value.splice(index, 1);
      break;
  }
}

/**
 * Handles save action.
 */
function handleSave(): void {
  const item = cloneDeep(previewItem.value);
  const slot = selectedSlot.value?.slot;
  emit('save', item, slot);
  emit('update:modelValue', false);
}

/**
 * Handles close/cancel action.
 */
function handleClose(): void {
  emit('cancel');
  emit('update:modelValue', false);
}
</script>

<style scoped>
/* Editor root - custom layout for height: 100% + max-width + margin: auto
   full-screen modal pattern; Quasar classes don't handle this combo */
.item-editor {
  background-color: #0d0d14;
  max-width: 1200px;
  margin: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.item-editor__header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.item-editor__content {
  flex: 1;
  overflow-y: auto;
}

/* Dark theme for inputs */
:deep(.q-field--outlined .q-field__control) {
  background-color: rgba(255, 255, 255, 0.03);
}

:deep(.q-field--outlined .q-field__control:before) {
  border-color: rgba(255, 255, 255, 0.15);
}

:deep(.q-field--outlined:hover .q-field__control:before) {
  border-color: rgba(255, 255, 255, 0.3);
}
</style>
