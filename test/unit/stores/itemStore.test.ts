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
import { useBuildStore } from 'src/stores/buildStore';
import { ItemSlot, ItemRarity, ItemType } from 'src/protos/pob2_pb';
import type { Item } from 'src/protos/pob2_pb';

/** Create mock item with optional item type */
function createMockItem(
  id: string,
  name: string,
  itemType?: ItemType
): Item {
  const item: Item = {
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
  if (itemType !== undefined) {
    item.itemType = itemType;
  }
  return item;
}

/** Create mock weapon item */
function createMockWeapon(id: string, name: string): Item {
  return createMockItem(id, name, ItemType.ONE_HAND_SWORD);
}

/** Create mock helmet item */
function createMockHelmet(id: string, name: string): Item {
  return createMockItem(id, name, ItemType.HELMET);
}

/** Create mock shield item */
function createMockShield(id: string, name: string): Item {
  return createMockItem(id, name, ItemType.SHIELD);
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

  // ============================================================================
  // Item Access Getters (read from buildStore)
  // ============================================================================

  describe('item access getters', () => {
    it('should return undefined for empty slot', () => {
      const store = useItemStore();

      expect(store.getItemInSlot(ItemSlot.SLOT_HELMET)).toBeUndefined();
    });

    it('should return item from buildStore', () => {
      const itemStore = useItemStore();
      const buildStore = useBuildStore();
      const helmet = createMockHelmet('h1', 'Test Helmet');

      buildStore.setEquippedItem(ItemSlot.SLOT_HELMET, helmet);

      expect(itemStore.getItemInSlot(ItemSlot.SLOT_HELMET)).toEqual(helmet);
    });

    it('should return all equipped items as Map', () => {
      const itemStore = useItemStore();
      const buildStore = useBuildStore();
      const helmet = createMockHelmet('h1', 'Helmet');
      const weapon = createMockWeapon('w1', 'Sword');

      buildStore.setEquippedItem(ItemSlot.SLOT_HELMET, helmet);
      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1, weapon);

      const items = itemStore.allEquippedItems;
      expect(items.size).toBe(2);
      expect(items.get(ItemSlot.SLOT_HELMET)).toEqual(helmet);
      expect(items.get(ItemSlot.SLOT_WEAPON_1)).toEqual(weapon);
    });

    it('should return main hand weapon based on active set', () => {
      const itemStore = useItemStore();
      const buildStore = useBuildStore();
      const primaryWeapon = createMockWeapon('pw1', 'Primary Sword');
      const swapWeapon = createMockWeapon('sw1', 'Swap Sword');

      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1, primaryWeapon);
      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1_SWAP, swapWeapon);

      // Default: primary set active
      expect(itemStore.mainHandWeapon).toEqual(primaryWeapon);

      // Switch to swap set
      itemStore.toggleWeaponSwap();
      expect(itemStore.mainHandWeapon).toEqual(swapWeapon);
    });

    it('should return off-hand item based on active set', () => {
      const itemStore = useItemStore();
      const buildStore = useBuildStore();
      const primaryShield = createMockShield('ps1', 'Primary Shield');
      const swapShield = createMockShield('ss1', 'Swap Shield');

      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_2, primaryShield);
      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_2_SWAP, swapShield);

      expect(itemStore.offHandItem).toEqual(primaryShield);

      itemStore.toggleWeaponSwap();
      expect(itemStore.offHandItem).toEqual(swapShield);
    });

    it('should return active weapon items', () => {
      const itemStore = useItemStore();
      const buildStore = useBuildStore();
      const weapon = createMockWeapon('w1', 'Sword');
      const shield = createMockShield('s1', 'Shield');

      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1, weapon);
      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_2, shield);

      const activeItems = itemStore.activeWeaponItems;
      expect(activeItems.size).toBe(2);
      expect(activeItems.get(ItemSlot.SLOT_WEAPON_1)).toEqual(weapon);
      expect(activeItems.get(ItemSlot.SLOT_WEAPON_2)).toEqual(shield);
    });

    it('should return swap weapon items', () => {
      const itemStore = useItemStore();
      const buildStore = useBuildStore();
      const swapWeapon = createMockWeapon('sw1', 'Swap Weapon');

      buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1_SWAP, swapWeapon);

      const swapItems = itemStore.swapWeaponItems;
      expect(swapItems.size).toBe(1);
      expect(swapItems.get(ItemSlot.SLOT_WEAPON_1_SWAP)).toEqual(swapWeapon);
    });

    it('should return correct active weapon set number', () => {
      const store = useItemStore();

      expect(store.activeWeaponSet).toBe(1);

      store.toggleWeaponSwap();
      expect(store.activeWeaponSet).toBe(2);
    });
  });

  // ============================================================================
  // Validated Item Actions
  // ============================================================================

  describe('validated item actions', () => {
    describe('equipItem', () => {
      it('should equip valid item in slot', () => {
        const itemStore = useItemStore();
        const buildStore = useBuildStore();
        const helmet = createMockHelmet('h1', 'Test Helmet');

        const result = itemStore.equipItem(ItemSlot.SLOT_HELMET, helmet);

        expect(result.success).toBe(true);
        if (result.success) {
          // Type narrowing: success=true means no error property
          expect(result.replacedItem).toBeUndefined();
        }
        expect(buildStore.equippedItems[String(ItemSlot.SLOT_HELMET)]).toEqual(helmet);
      });

      it('should reject invalid item for slot', () => {
        const itemStore = useItemStore();
        const buildStore = useBuildStore();
        const helmet = createMockHelmet('h1', 'Test Helmet');

        // Try to equip helmet in weapon slot
        const result = itemStore.equipItem(ItemSlot.SLOT_WEAPON_1, helmet);

        expect(result.success).toBe(false);
        if (!result.success) {
          // Type narrowing: success=false means error is required
          expect(result.error).toContain('HELMET');
        }
        expect(buildStore.equippedItems[String(ItemSlot.SLOT_WEAPON_1)]).toBeUndefined();
      });

      it('should return replaced item', () => {
        const itemStore = useItemStore();
        const buildStore = useBuildStore();
        const oldHelmet = createMockHelmet('h1', 'Old Helmet');
        const newHelmet = createMockHelmet('h2', 'New Helmet');

        buildStore.setEquippedItem(ItemSlot.SLOT_HELMET, oldHelmet);
        const result = itemStore.equipItem(ItemSlot.SLOT_HELMET, newHelmet);

        expect(result.success).toBe(true);
        if (result.success) {
          // Type narrowing: success=true means replacedItem may be present
          expect(result.replacedItem).toEqual(oldHelmet);
        }
      });

      it('should add equipped item to recent items', () => {
        const itemStore = useItemStore();
        const helmet = createMockHelmet('h1', 'Test Helmet');

        itemStore.equipItem(ItemSlot.SLOT_HELMET, helmet);

        expect(itemStore.recentItems).toHaveLength(1);
        expect(itemStore.recentItems[0]?.id).toBe('h1');
      });

      it('should reject item without type', () => {
        const itemStore = useItemStore();
        const itemWithoutType = createMockItem('i1', 'No Type Item');

        const result = itemStore.equipItem(ItemSlot.SLOT_HELMET, itemWithoutType);

        expect(result.success).toBe(false);
        if (!result.success) {
          // Type narrowing: success=false means error is required
          expect(result.error).toContain('no type');
        }
      });
    });

    describe('unequipItem', () => {
      it('should remove item from slot', () => {
        const itemStore = useItemStore();
        const buildStore = useBuildStore();
        const helmet = createMockHelmet('h1', 'Test Helmet');

        buildStore.setEquippedItem(ItemSlot.SLOT_HELMET, helmet);
        const removed = itemStore.unequipItem(ItemSlot.SLOT_HELMET);

        expect(removed).toEqual(helmet);
        expect(buildStore.equippedItems[String(ItemSlot.SLOT_HELMET)]).toBeUndefined();
      });

      it('should return undefined for empty slot', () => {
        const itemStore = useItemStore();

        const removed = itemStore.unequipItem(ItemSlot.SLOT_HELMET);

        expect(removed).toBeUndefined();
      });
    });

    describe('swapWeapons', () => {
      it('should toggle weapon set', () => {
        const store = useItemStore();

        expect(store.activeWeaponSet).toBe(1);

        store.swapWeapons();
        expect(store.activeWeaponSet).toBe(2);

        store.swapWeapons();
        expect(store.activeWeaponSet).toBe(1);
      });
    });

    describe('canEquipInSlot', () => {
      it('should return true for valid combination', () => {
        const store = useItemStore();
        const helmet = createMockHelmet('h1', 'Helmet');

        expect(store.canEquipInSlot(ItemSlot.SLOT_HELMET, helmet)).toBe(true);
      });

      it('should return false for invalid combination', () => {
        const store = useItemStore();
        const helmet = createMockHelmet('h1', 'Helmet');

        expect(store.canEquipInSlot(ItemSlot.SLOT_BOOTS, helmet)).toBe(false);
      });

      it('should return false for item without type', () => {
        const store = useItemStore();
        const noTypeItem = createMockItem('i1', 'No Type');

        expect(store.canEquipInSlot(ItemSlot.SLOT_HELMET, noTypeItem)).toBe(false);
      });
    });

    describe('getWeaponSetItems', () => {
      it('should return primary set items', () => {
        const itemStore = useItemStore();
        const buildStore = useBuildStore();
        const weapon = createMockWeapon('w1', 'Weapon');

        buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1, weapon);

        const items = itemStore.getWeaponSetItems(1);
        expect(items.get(ItemSlot.SLOT_WEAPON_1)).toEqual(weapon);
      });

      it('should return swap set items', () => {
        const itemStore = useItemStore();
        const buildStore = useBuildStore();
        const swapWeapon = createMockWeapon('sw1', 'Swap Weapon');

        buildStore.setEquippedItem(ItemSlot.SLOT_WEAPON_1_SWAP, swapWeapon);

        const items = itemStore.getWeaponSetItems(2);
        expect(items.get(ItemSlot.SLOT_WEAPON_1_SWAP)).toEqual(swapWeapon);
      });
    });
  });
});
