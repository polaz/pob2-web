/**
 * Unit tests for itemStore.
 *
 * Tests slot management, recent items handling, clipboard operations,
 * and weapon swap functionality.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  useItemStore,
  EQUIPMENT_SLOTS,
  FLASK_SLOTS,
  SWAP_SLOTS,
} from 'src/stores/itemStore';
import { ItemSlot, ItemRarity } from 'src/protos/pob2_pb';
import type { Item } from 'src/protos/pob2_pb';

/** Create mock item */
function createMockItem(id: string, name: string): Item {
  return {
    id,
    name,
    baseName: 'Sword',
    rarity: ItemRarity.RARITY_RARE,
    sockets: [],
    runes: [],
    implicitMods: [],
    explicitMods: [],
    enchantMods: [],
    runeMods: [],
    craftedMods: [],
  };
}

describe('itemStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have no selected slot', () => {
      const store = useItemStore();

      expect(store.selectedSlot).toBeNull();
      expect(store.isEditorOpen).toBe(false);
    });

    it('should have empty clipboard', () => {
      const store = useItemStore();

      expect(store.clipboardItem).toBeNull();
      expect(store.hasClipboardItem).toBe(false);
    });

    it('should have empty recent items', () => {
      const store = useItemStore();

      expect(store.recentItems).toEqual([]);
    });
  });

  describe('slot selection', () => {
    it('should select slot', () => {
      const store = useItemStore();

      store.selectSlot(ItemSlot.SLOT_HELMET);

      expect(store.selectedSlot).toBe(ItemSlot.SLOT_HELMET);
    });

    it('should clear slot selection', () => {
      const store = useItemStore();
      store.selectSlot(ItemSlot.SLOT_HELMET);

      store.clearSlotSelection();

      expect(store.selectedSlot).toBeNull();
    });
  });

  describe('slot name lookup', () => {
    it('should return slot name', () => {
      const store = useItemStore();

      expect(store.getSlotName(ItemSlot.SLOT_HELMET)).toBe('Helmet');
      expect(store.getSlotName(ItemSlot.SLOT_BODY_ARMOUR)).toBe('Body Armour');
      expect(store.getSlotName(ItemSlot.SLOT_WEAPON_1)).toBe('Main Hand');
    });

    it('should return slot short name', () => {
      const store = useItemStore();

      expect(store.getSlotShortName(ItemSlot.SLOT_HELMET)).toBe('Helm');
      expect(store.getSlotShortName(ItemSlot.SLOT_BODY_ARMOUR)).toBe('Body');
      expect(store.getSlotShortName(ItemSlot.SLOT_RING_1)).toBe('Ring1');
    });

    it('should return Unknown for invalid slot', () => {
      const store = useItemStore();

      expect(store.getSlotName(999 as ItemSlot)).toBe('Unknown');
      expect(store.getSlotShortName(999 as ItemSlot)).toBe('?');
    });
  });

  describe('editor management', () => {
    it('should open editor for slot', () => {
      const store = useItemStore();

      store.openEditor(ItemSlot.SLOT_GLOVES);

      expect(store.isEditorOpen).toBe(true);
      expect(store.selectedSlot).toBe(ItemSlot.SLOT_GLOVES);
      expect(store.editingItem).toBeNull();
    });

    it('should open editor with existing item', () => {
      const store = useItemStore();
      const item = createMockItem('1', 'Test Gloves');

      store.openEditor(ItemSlot.SLOT_GLOVES, item);

      expect(store.isEditorOpen).toBe(true);
      expect(store.editingItem).toBe(item);
    });

    it('should close editor', () => {
      const store = useItemStore();
      store.openEditor(ItemSlot.SLOT_GLOVES, createMockItem('1', 'Item'));

      store.closeEditor();

      expect(store.isEditorOpen).toBe(false);
      expect(store.editingItem).toBeNull();
    });
  });

  describe('weapon swap', () => {
    it('should toggle weapon swap', () => {
      const store = useItemStore();

      expect(store.isWeaponSwapActive).toBe(false);

      store.toggleWeaponSwap();
      expect(store.isWeaponSwapActive).toBe(true);

      store.toggleWeaponSwap();
      expect(store.isWeaponSwapActive).toBe(false);
    });

    it('should return correct active weapon slots', () => {
      const store = useItemStore();

      // Default (not swapped)
      expect(store.activeWeaponSlots.mainHand).toBe(ItemSlot.SLOT_WEAPON_1);
      expect(store.activeWeaponSlots.offHand).toBe(ItemSlot.SLOT_WEAPON_2);

      // Swapped
      store.toggleWeaponSwap();
      expect(store.activeWeaponSlots.mainHand).toBe(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(store.activeWeaponSlots.offHand).toBe(ItemSlot.SLOT_WEAPON_2_SWAP);
    });

    it('should set weapon swap directly', () => {
      const store = useItemStore();

      store.setWeaponSwap(true);
      expect(store.isWeaponSwapActive).toBe(true);

      store.setWeaponSwap(false);
      expect(store.isWeaponSwapActive).toBe(false);
    });
  });

  describe('clipboard operations', () => {
    it('should copy item to clipboard with new ID', () => {
      const store = useItemStore();
      const item = createMockItem('original-id', 'Test Item');

      store.copyItem(item);

      expect(store.clipboardItem).not.toBeNull();
      expect(store.clipboardItem?.name).toBe('Test Item');
      expect(store.clipboardItem?.id).not.toBe('original-id');
      expect(store.hasClipboardItem).toBe(true);
    });

    it('should clear clipboard', () => {
      const store = useItemStore();
      store.copyItem(createMockItem('1', 'Item'));

      store.clearClipboard();

      expect(store.clipboardItem).toBeNull();
      expect(store.hasClipboardItem).toBe(false);
    });
  });

  describe('recent items', () => {
    it('should add item to recent items', () => {
      const store = useItemStore();
      const item = createMockItem('item-1', 'Recent Item');

      store.addToRecentItems(item);

      expect(store.recentItems).toHaveLength(1);
      expect(store.recentItems[0]?.name).toBe('Recent Item');
    });

    it('should add to front of recent items', () => {
      const store = useItemStore();

      store.addToRecentItems(createMockItem('1', 'First'));
      store.addToRecentItems(createMockItem('2', 'Second'));

      expect(store.recentItems[0]?.name).toBe('Second');
      expect(store.recentItems[1]?.name).toBe('First');
    });

    it('should not duplicate items by ID', () => {
      const store = useItemStore();

      store.addToRecentItems(createMockItem('same-id', 'First'));
      store.addToRecentItems(createMockItem('same-id', 'Updated'));

      expect(store.recentItems).toHaveLength(1);
      expect(store.recentItems[0]?.name).toBe('Updated');
    });

    it('should limit to max 20 recent items', () => {
      const store = useItemStore();

      // Add 25 items
      for (let i = 0; i < 25; i++) {
        store.addToRecentItems(createMockItem(`id-${i}`, `Item ${i}`));
      }

      expect(store.recentItems).toHaveLength(20);
      // Most recent should be first
      expect(store.recentItems[0]?.name).toBe('Item 24');
    });

    it('should skip items without valid ID', () => {
      const store = useItemStore();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      store.addToRecentItems({ name: 'No ID' } as Item);
      store.addToRecentItems({ id: '', name: 'Empty ID' } as Item);

      expect(store.recentItems).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
    });

    it('should clear recent items', () => {
      const store = useItemStore();
      store.addToRecentItems(createMockItem('1', 'Item'));

      store.clearRecentItems();

      expect(store.recentItems).toEqual([]);
    });
  });

  describe('unique browser', () => {
    it('should open unique browser', () => {
      const store = useItemStore();

      store.openUniqueBrowser();

      expect(store.isUniqueBrowserOpen).toBe(true);
    });

    it('should close unique browser and clear search', () => {
      const store = useItemStore();
      store.openUniqueBrowser();
      store.setSearchQuery('test');

      store.closeUniqueBrowser();

      expect(store.isUniqueBrowserOpen).toBe(false);
      expect(store.searchQuery).toBe('');
    });

    it('should set search query', () => {
      const store = useItemStore();

      store.setSearchQuery('unique sword');

      expect(store.searchQuery).toBe('unique sword');
    });
  });

  describe('slot constants', () => {
    it('should have all equipment slots', () => {
      expect(EQUIPMENT_SLOTS).toHaveLength(10);
      expect(EQUIPMENT_SLOTS.find((s) => s.slot === ItemSlot.SLOT_HELMET)).toBeDefined();
      expect(EQUIPMENT_SLOTS.find((s) => s.slot === ItemSlot.SLOT_BODY_ARMOUR)).toBeDefined();
    });

    it('should have all flask slots', () => {
      expect(FLASK_SLOTS).toHaveLength(5);
    });

    it('should have swap slots', () => {
      expect(SWAP_SLOTS).toHaveLength(2);
      expect(SWAP_SLOTS.find((s) => s.slot === ItemSlot.SLOT_WEAPON_1_SWAP)).toBeDefined();
    });
  });
});
