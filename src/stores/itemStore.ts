/**
 * Item Store - manages equipped items UI state and slot management.
 *
 * This store handles:
 * - UI state (selected slot, editor, clipboard, recent items)
 * - Weapon swap tracking
 * - Validated item equip/unequip operations (delegates to buildStore)
 * - Convenience getters for accessing equipped items
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { cloneDeep } from 'lodash-es';
import type { Item } from 'src/protos/pob2_pb';
import { ItemSlot } from 'src/protos/pob2_pb';
import {
  isValidSlotForItem,
  getSlotValidationError,
  getWeaponSlotsForSet,
} from 'src/engine/items/ItemSlots';
import type { EquipResult } from 'src/engine/items/types';
import { useBuildStore } from './buildStore';

/** Item slot display info */
export interface SlotInfo {
  slot: ItemSlot;
  name: string;
  shortName: string;
}

/** All equippable slots */
export const EQUIPMENT_SLOTS: SlotInfo[] = [
  { slot: ItemSlot.SLOT_WEAPON_1, name: 'Main Hand', shortName: 'MH' },
  { slot: ItemSlot.SLOT_WEAPON_2, name: 'Off Hand', shortName: 'OH' },
  { slot: ItemSlot.SLOT_HELMET, name: 'Helmet', shortName: 'Helm' },
  { slot: ItemSlot.SLOT_BODY_ARMOUR, name: 'Body Armour', shortName: 'Body' },
  { slot: ItemSlot.SLOT_GLOVES, name: 'Gloves', shortName: 'Gloves' },
  { slot: ItemSlot.SLOT_BOOTS, name: 'Boots', shortName: 'Boots' },
  { slot: ItemSlot.SLOT_AMULET, name: 'Amulet', shortName: 'Amulet' },
  { slot: ItemSlot.SLOT_RING_1, name: 'Ring 1', shortName: 'Ring1' },
  { slot: ItemSlot.SLOT_RING_2, name: 'Ring 2', shortName: 'Ring2' },
  { slot: ItemSlot.SLOT_BELT, name: 'Belt', shortName: 'Belt' },
];

/** Flask slots */
export const FLASK_SLOTS: SlotInfo[] = [
  { slot: ItemSlot.SLOT_FLASK_1, name: 'Flask 1', shortName: 'F1' },
  { slot: ItemSlot.SLOT_FLASK_2, name: 'Flask 2', shortName: 'F2' },
  { slot: ItemSlot.SLOT_FLASK_3, name: 'Flask 3', shortName: 'F3' },
  { slot: ItemSlot.SLOT_FLASK_4, name: 'Flask 4', shortName: 'F4' },
  { slot: ItemSlot.SLOT_FLASK_5, name: 'Flask 5', shortName: 'F5' },
];

/** Weapon swap slots */
export const SWAP_SLOTS: SlotInfo[] = [
  { slot: ItemSlot.SLOT_WEAPON_1_SWAP, name: 'Swap Main Hand', shortName: 'SMH' },
  { slot: ItemSlot.SLOT_WEAPON_2_SWAP, name: 'Swap Off Hand', shortName: 'SOH' },
];

/** Maximum number of recent items to keep */
const MAX_RECENT_ITEMS = 20;

export const useItemStore = defineStore('item', () => {
  // ============================================================================
  // Dependencies
  // ============================================================================

  /** Build store for accessing/modifying equipped items */
  const buildStore = useBuildStore();

  // ============================================================================
  // State
  // ============================================================================

  /** Currently selected slot for editing */
  const selectedSlot = ref<ItemSlot | null>(null);

  /** Item being edited (not yet equipped) */
  const editingItem = shallowRef<Item | null>(null);

  /** Whether item editor modal is open */
  const isEditorOpen = ref(false);

  /** Whether we're using weapon swap set */
  const isWeaponSwapActive = ref(false);

  /** Clipboard item for copy/paste */
  const clipboardItem = shallowRef<Item | null>(null);

  /** Recently used unique items (for quick selection) */
  const recentItems = shallowRef<Item[]>([]);

  /** Item search query (for unique item browser) */
  const searchQuery = ref('');

  /** Whether unique item browser is open */
  const isUniqueBrowserOpen = ref(false);

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Internal pre-computed slot lookup map for O(1) access in getters.
   * Defined inside store function (not at module level) because:
   * - It uses store-specific constants (EQUIPMENT_SLOTS, etc.)
   * - Created once per store instance, which is a singleton in Pinia
   * - Keeps the lookup logic co-located with the getters that use it
   */
  const slotLookup: Map<ItemSlot, SlotInfo> = new Map(
    [...EQUIPMENT_SLOTS, ...FLASK_SLOTS, ...SWAP_SLOTS].map((s) => [s.slot, s])
  );

  /**
   * Get slot display name.
   * Returns a function to allow parameterized lookup in templates.
   * This is a common Pinia pattern for getters that need arguments.
   */
  const getSlotName = computed(() => {
    return (slot: ItemSlot): string => {
      return slotLookup.get(slot)?.name ?? 'Unknown';
    };
  });

  /**
   * Get slot short name.
   * Returns a function to allow parameterized lookup in templates.
   */
  const getSlotShortName = computed(() => {
    return (slot: ItemSlot): string => {
      return slotLookup.get(slot)?.shortName ?? '?';
    };
  });

  /** Current weapon slots based on swap state */
  const activeWeaponSlots = computed(() => {
    if (isWeaponSwapActive.value) {
      return {
        mainHand: ItemSlot.SLOT_WEAPON_1_SWAP,
        offHand: ItemSlot.SLOT_WEAPON_2_SWAP,
      };
    }
    return {
      mainHand: ItemSlot.SLOT_WEAPON_1,
      offHand: ItemSlot.SLOT_WEAPON_2,
    };
  });

  /** Whether an item is in clipboard */
  const hasClipboardItem = computed(() => clipboardItem.value !== null);

  // ============================================================================
  // Item Access Getters (read from buildStore)
  // ============================================================================

  /**
   * Get item in a specific slot.
   * Returns a function for parameterized lookup in templates.
   */
  const getItemInSlot = computed(() => {
    return (slot: ItemSlot): Item | undefined => {
      return buildStore.equippedItems[String(slot)];
    };
  });

  /**
   * Get all equipped items as a Map.
   * Converts from buildStore's Record format to Map for easier iteration.
   */
  const allEquippedItems = computed((): Map<ItemSlot, Item> => {
    const items = new Map<ItemSlot, Item>();
    for (const [key, item] of Object.entries(buildStore.equippedItems)) {
      const slot = Number(key) as ItemSlot;
      if (!Number.isNaN(slot) && item) {
        items.set(slot, item);
      }
    }
    return items;
  });

  /**
   * Get main hand weapon (respects weapon swap state).
   */
  const mainHandWeapon = computed((): Item | undefined => {
    const slot = activeWeaponSlots.value.mainHand;
    return buildStore.equippedItems[String(slot)];
  });

  /**
   * Get off-hand item (respects weapon swap state).
   */
  const offHandItem = computed((): Item | undefined => {
    const slot = activeWeaponSlots.value.offHand;
    return buildStore.equippedItems[String(slot)];
  });

  /**
   * Get equipped items for active weapon set only.
   */
  const activeWeaponItems = computed((): Map<ItemSlot, Item> => {
    const items = new Map<ItemSlot, Item>();
    const { mainHand, offHand } = activeWeaponSlots.value;

    const mh = buildStore.equippedItems[String(mainHand)];
    if (mh) items.set(mainHand, mh);

    const oh = buildStore.equippedItems[String(offHand)];
    if (oh) items.set(offHand, oh);

    return items;
  });

  /**
   * Get equipped items for swap weapon set.
   */
  const swapWeaponItems = computed((): Map<ItemSlot, Item> => {
    const items = new Map<ItemSlot, Item>();
    // Get the inactive weapon set slots
    const inactiveSet: 1 | 2 = isWeaponSwapActive.value ? 1 : 2;
    const { mainHand, offHand } = getWeaponSlotsForSet(inactiveSet);

    const mh = buildStore.equippedItems[String(mainHand)];
    if (mh) items.set(mainHand, mh);

    const oh = buildStore.equippedItems[String(offHand)];
    if (oh) items.set(offHand, oh);

    return items;
  });

  /**
   * Active weapon set number (1 = primary, 2 = swap).
   */
  const activeWeaponSet = computed((): 1 | 2 => {
    return isWeaponSwapActive.value ? 2 : 1;
  });

  // ============================================================================
  // Actions
  // ============================================================================

  /** Select slot for editing */
  function selectSlot(slot: ItemSlot): void {
    selectedSlot.value = slot;
  }

  /** Clear slot selection */
  function clearSlotSelection(): void {
    selectedSlot.value = null;
  }

  /** Open item editor for slot */
  function openEditor(slot: ItemSlot, item?: Item): void {
    selectedSlot.value = slot;
    editingItem.value = item ?? null;
    isEditorOpen.value = true;
  }

  /** Close item editor */
  function closeEditor(): void {
    isEditorOpen.value = false;
    editingItem.value = null;
  }

  /** Set editing item */
  function setEditingItem(item: Item | null): void {
    editingItem.value = item;
  }

  /** Toggle weapon swap */
  function toggleWeaponSwap(): void {
    isWeaponSwapActive.value = !isWeaponSwapActive.value;
  }

  /** Set weapon swap state */
  function setWeaponSwap(active: boolean): void {
    isWeaponSwapActive.value = active;
  }

  /**
   * Copy item to clipboard with new unique ID.
   * Note: crypto.randomUUID() requires secure context (HTTPS/localhost).
   * This is guaranteed for PWA deployment.
   */
  function copyItem(item: Item): void {
    const cloned = cloneDeep(item);
    cloned.id = crypto.randomUUID();
    clipboardItem.value = cloned;
  }

  /** Clear clipboard */
  function clearClipboard(): void {
    clipboardItem.value = null;
  }

  /**
   * Add item to recent items.
   * Assumes item IDs are globally unique (enforced at Item creation time).
   * Duplicate detection relies on this uniqueness guarantee.
   *
   * @param item - Item to add. Must have a valid non-empty id field.
   */
  function addToRecentItems(item: Item): void {
    // Validate item has a valid ID
    if (!item.id || typeof item.id !== 'string') {
      console.warn('addToRecentItems: Item missing valid ID, skipping');
      return;
    }
    // Remove if already exists (by unique ID)
    const filtered = recentItems.value.filter((i) => i.id !== item.id);
    // Add to front, keep max items
    recentItems.value = [item, ...filtered].slice(0, MAX_RECENT_ITEMS);
  }

  /** Clear recent items */
  function clearRecentItems(): void {
    recentItems.value = [];
  }

  /** Set search query */
  function setSearchQuery(query: string): void {
    searchQuery.value = query;
  }

  /** Open unique item browser */
  function openUniqueBrowser(): void {
    isUniqueBrowserOpen.value = true;
  }

  /** Close unique item browser */
  function closeUniqueBrowser(): void {
    isUniqueBrowserOpen.value = false;
    searchQuery.value = '';
  }

  // ============================================================================
  // Validated Item Actions
  // ============================================================================

  /**
   * Equip item in slot with validation.
   * Validates item type against slot before equipping.
   *
   * @param slot - Target slot
   * @param item - Item to equip
   * @returns Result with success/error info and replaced item
   */
  function equipItem(slot: ItemSlot, item: Item): EquipResult {
    // Validate slot compatibility
    const error = getSlotValidationError(slot, item.itemType);
    if (error) {
      return { success: false, error };
    }

    // Get current item (for return value)
    const replacedItem = buildStore.equippedItems[String(slot)];

    // Delegate to buildStore
    buildStore.setEquippedItem(slot, item);

    // Add to recent items for quick access
    addToRecentItems(item);

    return {
      success: true,
      ...(replacedItem && { replacedItem }),
    };
  }

  /**
   * Unequip item from slot.
   *
   * @param slot - Slot to clear
   * @returns The removed item, if any
   */
  function unequipItem(slot: ItemSlot): Item | undefined {
    const item = buildStore.equippedItems[String(slot)];
    if (item) {
      buildStore.removeEquippedItem(slot);
    }
    return item;
  }

  /**
   * Swap weapons between main and swap sets.
   * Toggles between weapon set 1 and 2.
   */
  function swapWeapons(): void {
    isWeaponSwapActive.value = !isWeaponSwapActive.value;
  }

  /**
   * Check if an item can be equipped in a slot.
   *
   * @param slot - Target slot
   * @param item - Item to check
   * @returns True if item can be equipped in slot
   */
  function canEquipInSlot(slot: ItemSlot, item: Item): boolean {
    return isValidSlotForItem(slot, item.itemType);
  }

  /**
   * Get all items for a specific weapon set.
   *
   * @param weaponSet - Which weapon set (1 = primary, 2 = swap)
   * @returns Map of slot to item for that weapon set
   */
  function getWeaponSetItems(weaponSet: 1 | 2): Map<ItemSlot, Item> {
    const items = new Map<ItemSlot, Item>();
    const { mainHand, offHand } = getWeaponSlotsForSet(weaponSet);

    const mh = buildStore.equippedItems[String(mainHand)];
    if (mh) items.set(mainHand, mh);

    const oh = buildStore.equippedItems[String(offHand)];
    if (oh) items.set(offHand, oh);

    return items;
  }

  return {
    // State
    selectedSlot,
    editingItem,
    isEditorOpen,
    isWeaponSwapActive,
    clipboardItem,
    recentItems,
    searchQuery,
    isUniqueBrowserOpen,

    // Constants
    EQUIPMENT_SLOTS,
    FLASK_SLOTS,
    SWAP_SLOTS,

    // Getters - UI
    getSlotName,
    getSlotShortName,
    activeWeaponSlots,
    hasClipboardItem,

    // Getters - Item Access
    getItemInSlot,
    allEquippedItems,
    mainHandWeapon,
    offHandItem,
    activeWeaponItems,
    swapWeaponItems,
    activeWeaponSet,

    // Actions - UI
    selectSlot,
    clearSlotSelection,
    openEditor,
    closeEditor,
    setEditingItem,
    toggleWeaponSwap,
    setWeaponSwap,
    copyItem,
    clearClipboard,
    addToRecentItems,
    clearRecentItems,
    setSearchQuery,
    openUniqueBrowser,
    closeUniqueBrowser,

    // Actions - Validated Item Operations
    equipItem,
    unequipItem,
    swapWeapons,
    canEquipInSlot,
    getWeaponSetItems,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useItemStore, import.meta.hot));
}
