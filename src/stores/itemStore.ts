/**
 * Item Store - manages equipped items UI state
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import type { Item } from 'src/protos/pob2_pb';
import { ItemSlot } from 'src/protos/pob2_pb';

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

export const useItemStore = defineStore('item', () => {
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

  /** Get slot display name */
  const getSlotName = computed(() => {
    return (slot: ItemSlot): string => {
      const info = [...EQUIPMENT_SLOTS, ...FLASK_SLOTS, ...SWAP_SLOTS].find(
        (s) => s.slot === slot
      );
      return info?.name ?? 'Unknown';
    };
  });

  /** Get slot short name */
  const getSlotShortName = computed(() => {
    return (slot: ItemSlot): string => {
      const info = [...EQUIPMENT_SLOTS, ...FLASK_SLOTS, ...SWAP_SLOTS].find(
        (s) => s.slot === slot
      );
      return info?.shortName ?? '?';
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

  /** Copy item to clipboard */
  function copyItem(item: Item): void {
    clipboardItem.value = { ...item, id: crypto.randomUUID() };
  }

  /** Clear clipboard */
  function clearClipboard(): void {
    clipboardItem.value = null;
  }

  /** Add item to recent items */
  function addToRecentItems(item: Item): void {
    // Remove if already exists
    const filtered = recentItems.value.filter((i) => i.id !== item.id);
    // Add to front, keep max 20
    recentItems.value = [item, ...filtered].slice(0, 20);
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

    // Getters
    getSlotName,
    getSlotShortName,
    activeWeaponSlots,
    hasClipboardItem,

    // Actions
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
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useItemStore, import.meta.hot));
}
