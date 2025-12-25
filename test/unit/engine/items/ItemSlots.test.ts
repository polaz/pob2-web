/**
 * Unit tests for ItemSlots module.
 *
 * Tests slot validation, category detection, and helper functions.
 */
import { describe, it, expect } from 'vitest';
import { ItemSlot, ItemType } from 'src/protos/items_pb';
import {
  // Slot category arrays
  MAIN_HAND_SLOTS,
  OFF_HAND_SLOTS,
  WEAPON_SLOTS,
  PRIMARY_WEAPON_SET,
  SWAP_WEAPON_SET,
  ARMOUR_SLOTS,
  ACCESSORY_SLOTS,
  FLASK_SLOT_ARRAY,
  JEWEL_SLOTS,
  ALL_EQUIPMENT_SLOTS,
  // Item type sets
  ONE_HANDED_TYPES,
  TWO_HANDED_TYPES,
  ALL_WEAPON_TYPES,
  OFF_HAND_ONLY_TYPES,
  OFF_HAND_VALID_TYPES,
  // Validation functions
  isValidSlotForItem,
  getSlotCategory,
  isMainHandSlot,
  isOffHandSlot,
  isSwapSlot,
  isWeaponSlot,
  isTwoHandedWeaponType,
  isOneHandedWeaponType,
  getAlternateWeaponSlot,
  getSlotValidationError,
  getWeaponSlotsForSet,
  getActiveEquipmentSlots,
} from 'src/engine/items/ItemSlots';

// ============================================================================
// Slot Category Arrays
// ============================================================================

describe('ItemSlots - Slot Category Arrays', () => {
  describe('MAIN_HAND_SLOTS', () => {
    it('should contain main weapon slots', () => {
      expect(MAIN_HAND_SLOTS).toContain(ItemSlot.SLOT_WEAPON_1);
      expect(MAIN_HAND_SLOTS).toContain(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(MAIN_HAND_SLOTS).toHaveLength(2);
    });
  });

  describe('OFF_HAND_SLOTS', () => {
    it('should contain off-hand slots', () => {
      expect(OFF_HAND_SLOTS).toContain(ItemSlot.SLOT_WEAPON_2);
      expect(OFF_HAND_SLOTS).toContain(ItemSlot.SLOT_WEAPON_2_SWAP);
      expect(OFF_HAND_SLOTS).toHaveLength(2);
    });
  });

  describe('WEAPON_SLOTS', () => {
    it('should contain all weapon slots', () => {
      expect(WEAPON_SLOTS).toHaveLength(4);
      expect(WEAPON_SLOTS).toContain(ItemSlot.SLOT_WEAPON_1);
      expect(WEAPON_SLOTS).toContain(ItemSlot.SLOT_WEAPON_2);
      expect(WEAPON_SLOTS).toContain(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(WEAPON_SLOTS).toContain(ItemSlot.SLOT_WEAPON_2_SWAP);
    });
  });

  describe('PRIMARY_WEAPON_SET', () => {
    it('should contain primary weapon slots', () => {
      expect(PRIMARY_WEAPON_SET).toEqual([
        ItemSlot.SLOT_WEAPON_1,
        ItemSlot.SLOT_WEAPON_2,
      ]);
    });
  });

  describe('SWAP_WEAPON_SET', () => {
    it('should contain swap weapon slots', () => {
      expect(SWAP_WEAPON_SET).toEqual([
        ItemSlot.SLOT_WEAPON_1_SWAP,
        ItemSlot.SLOT_WEAPON_2_SWAP,
      ]);
    });
  });

  describe('ARMOUR_SLOTS', () => {
    it('should contain all armour slots', () => {
      expect(ARMOUR_SLOTS).toHaveLength(4);
      expect(ARMOUR_SLOTS).toContain(ItemSlot.SLOT_HELMET);
      expect(ARMOUR_SLOTS).toContain(ItemSlot.SLOT_BODY_ARMOUR);
      expect(ARMOUR_SLOTS).toContain(ItemSlot.SLOT_GLOVES);
      expect(ARMOUR_SLOTS).toContain(ItemSlot.SLOT_BOOTS);
    });
  });

  describe('ACCESSORY_SLOTS', () => {
    it('should contain all accessory slots', () => {
      expect(ACCESSORY_SLOTS).toHaveLength(4);
      expect(ACCESSORY_SLOTS).toContain(ItemSlot.SLOT_AMULET);
      expect(ACCESSORY_SLOTS).toContain(ItemSlot.SLOT_RING_1);
      expect(ACCESSORY_SLOTS).toContain(ItemSlot.SLOT_RING_2);
      expect(ACCESSORY_SLOTS).toContain(ItemSlot.SLOT_BELT);
    });
  });

  describe('FLASK_SLOT_ARRAY', () => {
    it('should contain all flask slots', () => {
      expect(FLASK_SLOT_ARRAY).toHaveLength(5);
      expect(FLASK_SLOT_ARRAY).toContain(ItemSlot.SLOT_FLASK_1);
      expect(FLASK_SLOT_ARRAY).toContain(ItemSlot.SLOT_FLASK_5);
    });
  });

  describe('JEWEL_SLOTS', () => {
    it('should contain jewel slots', () => {
      expect(JEWEL_SLOTS).toContain(ItemSlot.SLOT_JEWEL_1);
      expect(JEWEL_SLOTS).toContain(ItemSlot.SLOT_JEWEL_2);
    });
  });

  describe('ALL_EQUIPMENT_SLOTS', () => {
    it('should contain all equippable slots except jewels', () => {
      expect(ALL_EQUIPMENT_SLOTS).toContain(ItemSlot.SLOT_WEAPON_1);
      expect(ALL_EQUIPMENT_SLOTS).toContain(ItemSlot.SLOT_HELMET);
      expect(ALL_EQUIPMENT_SLOTS).toContain(ItemSlot.SLOT_AMULET);
      expect(ALL_EQUIPMENT_SLOTS).toContain(ItemSlot.SLOT_FLASK_1);
      expect(ALL_EQUIPMENT_SLOTS).not.toContain(ItemSlot.SLOT_JEWEL_1);
    });
  });
});

// ============================================================================
// Item Type Sets
// ============================================================================

describe('ItemSlots - Item Type Sets', () => {
  describe('ONE_HANDED_TYPES', () => {
    it('should contain one-handed weapons', () => {
      expect(ONE_HANDED_TYPES.has(ItemType.ONE_HAND_SWORD)).toBe(true);
      expect(ONE_HANDED_TYPES.has(ItemType.WAND)).toBe(true);
      expect(ONE_HANDED_TYPES.has(ItemType.DAGGER)).toBe(true);
      expect(ONE_HANDED_TYPES.has(ItemType.CLAW)).toBe(true);
      expect(ONE_HANDED_TYPES.has(ItemType.FLAIL)).toBe(true);
    });

    it('should not contain two-handed weapons', () => {
      expect(ONE_HANDED_TYPES.has(ItemType.TWO_HAND_SWORD)).toBe(false);
      expect(ONE_HANDED_TYPES.has(ItemType.BOW)).toBe(false);
    });
  });

  describe('TWO_HANDED_TYPES', () => {
    it('should contain two-handed weapons', () => {
      expect(TWO_HANDED_TYPES.has(ItemType.TWO_HAND_SWORD)).toBe(true);
      expect(TWO_HANDED_TYPES.has(ItemType.BOW)).toBe(true);
      expect(TWO_HANDED_TYPES.has(ItemType.CROSSBOW)).toBe(true);
      expect(TWO_HANDED_TYPES.has(ItemType.STAFF)).toBe(true);
      expect(TWO_HANDED_TYPES.has(ItemType.QUARTERSTAFF)).toBe(true);
      expect(TWO_HANDED_TYPES.has(ItemType.SPEAR)).toBe(true);
    });

    it('should not contain one-handed weapons', () => {
      expect(TWO_HANDED_TYPES.has(ItemType.ONE_HAND_SWORD)).toBe(false);
      expect(TWO_HANDED_TYPES.has(ItemType.WAND)).toBe(false);
    });
  });

  describe('ALL_WEAPON_TYPES', () => {
    it('should contain all weapon types', () => {
      expect(ALL_WEAPON_TYPES.has(ItemType.ONE_HAND_SWORD)).toBe(true);
      expect(ALL_WEAPON_TYPES.has(ItemType.TWO_HAND_SWORD)).toBe(true);
      expect(ALL_WEAPON_TYPES.has(ItemType.BOW)).toBe(true);
    });

    it('should not contain non-weapons', () => {
      expect(ALL_WEAPON_TYPES.has(ItemType.HELMET)).toBe(false);
      expect(ALL_WEAPON_TYPES.has(ItemType.SHIELD)).toBe(false);
    });
  });

  describe('OFF_HAND_ONLY_TYPES', () => {
    it('should contain shield, focus, quiver', () => {
      expect(OFF_HAND_ONLY_TYPES.has(ItemType.SHIELD)).toBe(true);
      expect(OFF_HAND_ONLY_TYPES.has(ItemType.FOCUS)).toBe(true);
      expect(OFF_HAND_ONLY_TYPES.has(ItemType.QUIVER)).toBe(true);
    });
  });

  describe('OFF_HAND_VALID_TYPES', () => {
    it('should contain off-hand items and one-handers for dual-wield', () => {
      expect(OFF_HAND_VALID_TYPES.has(ItemType.SHIELD)).toBe(true);
      expect(OFF_HAND_VALID_TYPES.has(ItemType.ONE_HAND_SWORD)).toBe(true);
      expect(OFF_HAND_VALID_TYPES.has(ItemType.DAGGER)).toBe(true);
    });

    it('should not contain two-handed weapons', () => {
      expect(OFF_HAND_VALID_TYPES.has(ItemType.TWO_HAND_SWORD)).toBe(false);
      expect(OFF_HAND_VALID_TYPES.has(ItemType.BOW)).toBe(false);
    });
  });
});

// ============================================================================
// Validation Functions
// ============================================================================

describe('ItemSlots - Validation Functions', () => {
  describe('isValidSlotForItem', () => {
    it('should validate main hand weapons', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_1, ItemType.ONE_HAND_SWORD)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_1, ItemType.TWO_HAND_SWORD)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_1, ItemType.BOW)).toBe(true);
    });

    it('should validate off-hand items', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_2, ItemType.SHIELD)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_2, ItemType.FOCUS)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_2, ItemType.ONE_HAND_SWORD)).toBe(true);
    });

    it('should reject two-handed in off-hand', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_2, ItemType.TWO_HAND_SWORD)).toBe(false);
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_2, ItemType.BOW)).toBe(false);
    });

    it('should validate armour slots', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_HELMET, ItemType.HELMET)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_BODY_ARMOUR, ItemType.BODY_ARMOUR)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_GLOVES, ItemType.GLOVES)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_BOOTS, ItemType.BOOTS)).toBe(true);
    });

    it('should reject wrong armour in slots', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_HELMET, ItemType.BOOTS)).toBe(false);
      expect(isValidSlotForItem(ItemSlot.SLOT_BODY_ARMOUR, ItemType.HELMET)).toBe(false);
    });

    it('should validate accessory slots', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_AMULET, ItemType.AMULET)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_RING_1, ItemType.RING)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_RING_2, ItemType.RING)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_BELT, ItemType.BELT)).toBe(true);
    });

    it('should validate flask slots', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_FLASK_1, ItemType.FLASK)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_FLASK_5, ItemType.FLASK)).toBe(true);
    });

    it('should validate jewel slots', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_JEWEL_1, ItemType.JEWEL)).toBe(true);
    });

    it('should return false for undefined type', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_HELMET, undefined)).toBe(false);
    });

    it('should return false for unknown type', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_HELMET, ItemType.ITEM_TYPE_UNKNOWN)).toBe(false);
    });

    it('should validate swap weapon slots same as primary', () => {
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_1_SWAP, ItemType.ONE_HAND_SWORD)).toBe(true);
      expect(isValidSlotForItem(ItemSlot.SLOT_WEAPON_2_SWAP, ItemType.SHIELD)).toBe(true);
    });
  });

  describe('getSlotCategory', () => {
    it('should categorize weapon slots', () => {
      expect(getSlotCategory(ItemSlot.SLOT_WEAPON_1)).toBe('weapon');
      expect(getSlotCategory(ItemSlot.SLOT_WEAPON_2)).toBe('weapon');
      expect(getSlotCategory(ItemSlot.SLOT_WEAPON_1_SWAP)).toBe('weapon');
    });

    it('should categorize armour slots', () => {
      expect(getSlotCategory(ItemSlot.SLOT_HELMET)).toBe('armour');
      expect(getSlotCategory(ItemSlot.SLOT_BODY_ARMOUR)).toBe('armour');
    });

    it('should categorize accessory slots', () => {
      expect(getSlotCategory(ItemSlot.SLOT_AMULET)).toBe('accessory');
      expect(getSlotCategory(ItemSlot.SLOT_RING_1)).toBe('accessory');
      expect(getSlotCategory(ItemSlot.SLOT_BELT)).toBe('accessory');
    });

    it('should categorize flask slots', () => {
      expect(getSlotCategory(ItemSlot.SLOT_FLASK_1)).toBe('flask');
      expect(getSlotCategory(ItemSlot.SLOT_FLASK_5)).toBe('flask');
    });

    it('should categorize jewel slots', () => {
      expect(getSlotCategory(ItemSlot.SLOT_JEWEL_1)).toBe('jewel');
    });

    it('should return unknown for invalid slot', () => {
      expect(getSlotCategory(ItemSlot.ITEM_SLOT_UNKNOWN)).toBe('unknown');
    });
  });

  describe('isMainHandSlot', () => {
    it('should return true for main hand slots', () => {
      expect(isMainHandSlot(ItemSlot.SLOT_WEAPON_1)).toBe(true);
      expect(isMainHandSlot(ItemSlot.SLOT_WEAPON_1_SWAP)).toBe(true);
    });

    it('should return false for off-hand slots', () => {
      expect(isMainHandSlot(ItemSlot.SLOT_WEAPON_2)).toBe(false);
      expect(isMainHandSlot(ItemSlot.SLOT_WEAPON_2_SWAP)).toBe(false);
    });

    it('should return false for non-weapon slots', () => {
      expect(isMainHandSlot(ItemSlot.SLOT_HELMET)).toBe(false);
    });
  });

  describe('isOffHandSlot', () => {
    it('should return true for off-hand slots', () => {
      expect(isOffHandSlot(ItemSlot.SLOT_WEAPON_2)).toBe(true);
      expect(isOffHandSlot(ItemSlot.SLOT_WEAPON_2_SWAP)).toBe(true);
    });

    it('should return false for main hand slots', () => {
      expect(isOffHandSlot(ItemSlot.SLOT_WEAPON_1)).toBe(false);
    });
  });

  describe('isSwapSlot', () => {
    it('should return true for swap slots', () => {
      expect(isSwapSlot(ItemSlot.SLOT_WEAPON_1_SWAP)).toBe(true);
      expect(isSwapSlot(ItemSlot.SLOT_WEAPON_2_SWAP)).toBe(true);
    });

    it('should return false for primary slots', () => {
      expect(isSwapSlot(ItemSlot.SLOT_WEAPON_1)).toBe(false);
      expect(isSwapSlot(ItemSlot.SLOT_WEAPON_2)).toBe(false);
    });

    it('should return false for non-weapon slots', () => {
      expect(isSwapSlot(ItemSlot.SLOT_HELMET)).toBe(false);
    });
  });

  describe('isWeaponSlot', () => {
    it('should return true for all weapon slots', () => {
      expect(isWeaponSlot(ItemSlot.SLOT_WEAPON_1)).toBe(true);
      expect(isWeaponSlot(ItemSlot.SLOT_WEAPON_2)).toBe(true);
      expect(isWeaponSlot(ItemSlot.SLOT_WEAPON_1_SWAP)).toBe(true);
      expect(isWeaponSlot(ItemSlot.SLOT_WEAPON_2_SWAP)).toBe(true);
    });

    it('should return false for non-weapon slots', () => {
      expect(isWeaponSlot(ItemSlot.SLOT_HELMET)).toBe(false);
      expect(isWeaponSlot(ItemSlot.SLOT_AMULET)).toBe(false);
    });
  });

  describe('isTwoHandedWeaponType', () => {
    it('should return true for two-handed weapons', () => {
      expect(isTwoHandedWeaponType(ItemType.TWO_HAND_SWORD)).toBe(true);
      expect(isTwoHandedWeaponType(ItemType.BOW)).toBe(true);
      expect(isTwoHandedWeaponType(ItemType.STAFF)).toBe(true);
    });

    it('should return false for one-handed weapons', () => {
      expect(isTwoHandedWeaponType(ItemType.ONE_HAND_SWORD)).toBe(false);
      expect(isTwoHandedWeaponType(ItemType.WAND)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTwoHandedWeaponType(undefined)).toBe(false);
    });
  });

  describe('isOneHandedWeaponType', () => {
    it('should return true for one-handed weapons', () => {
      expect(isOneHandedWeaponType(ItemType.ONE_HAND_SWORD)).toBe(true);
      expect(isOneHandedWeaponType(ItemType.WAND)).toBe(true);
      expect(isOneHandedWeaponType(ItemType.FLAIL)).toBe(true);
    });

    it('should return false for two-handed weapons', () => {
      expect(isOneHandedWeaponType(ItemType.TWO_HAND_SWORD)).toBe(false);
      expect(isOneHandedWeaponType(ItemType.BOW)).toBe(false);
    });
  });

  describe('getAlternateWeaponSlot', () => {
    it('should return swap slot for primary slots', () => {
      expect(getAlternateWeaponSlot(ItemSlot.SLOT_WEAPON_1)).toBe(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(getAlternateWeaponSlot(ItemSlot.SLOT_WEAPON_2)).toBe(ItemSlot.SLOT_WEAPON_2_SWAP);
    });

    it('should return primary slot for swap slots', () => {
      expect(getAlternateWeaponSlot(ItemSlot.SLOT_WEAPON_1_SWAP)).toBe(ItemSlot.SLOT_WEAPON_1);
      expect(getAlternateWeaponSlot(ItemSlot.SLOT_WEAPON_2_SWAP)).toBe(ItemSlot.SLOT_WEAPON_2);
    });

    it('should return null for non-weapon slots', () => {
      expect(getAlternateWeaponSlot(ItemSlot.SLOT_HELMET)).toBeNull();
      expect(getAlternateWeaponSlot(ItemSlot.SLOT_AMULET)).toBeNull();
    });
  });

  describe('getSlotValidationError', () => {
    it('should return null for valid combinations', () => {
      expect(getSlotValidationError(ItemSlot.SLOT_HELMET, ItemType.HELMET)).toBeNull();
      expect(getSlotValidationError(ItemSlot.SLOT_WEAPON_1, ItemType.ONE_HAND_SWORD)).toBeNull();
    });

    it('should return error for invalid combinations', () => {
      const error = getSlotValidationError(ItemSlot.SLOT_HELMET, ItemType.BOOTS);
      expect(error).not.toBeNull();
      expect(error).toContain('BOOTS');
      expect(error).toContain('SLOT_HELMET');
    });

    it('should return error for undefined type', () => {
      const error = getSlotValidationError(ItemSlot.SLOT_HELMET, undefined);
      expect(error).toBe('Item has no type');
    });

    it('should return error for unknown type', () => {
      const error = getSlotValidationError(ItemSlot.SLOT_HELMET, ItemType.ITEM_TYPE_UNKNOWN);
      expect(error).toBe('Item has no type');
    });
  });

  describe('getWeaponSlotsForSet', () => {
    it('should return primary slots for set 1', () => {
      const slots = getWeaponSlotsForSet(1);
      expect(slots.mainHand).toBe(ItemSlot.SLOT_WEAPON_1);
      expect(slots.offHand).toBe(ItemSlot.SLOT_WEAPON_2);
    });

    it('should return swap slots for set 2', () => {
      const slots = getWeaponSlotsForSet(2);
      expect(slots.mainHand).toBe(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(slots.offHand).toBe(ItemSlot.SLOT_WEAPON_2_SWAP);
    });
  });

  describe('getActiveEquipmentSlots', () => {
    it('should return primary weapons plus other slots for set 1', () => {
      const slots = getActiveEquipmentSlots(1);
      expect(slots).toContain(ItemSlot.SLOT_WEAPON_1);
      expect(slots).toContain(ItemSlot.SLOT_WEAPON_2);
      expect(slots).not.toContain(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(slots).toContain(ItemSlot.SLOT_HELMET);
      expect(slots).toContain(ItemSlot.SLOT_AMULET);
      expect(slots).toContain(ItemSlot.SLOT_FLASK_1);
    });

    it('should return swap weapons plus other slots for set 2', () => {
      const slots = getActiveEquipmentSlots(2);
      expect(slots).toContain(ItemSlot.SLOT_WEAPON_1_SWAP);
      expect(slots).toContain(ItemSlot.SLOT_WEAPON_2_SWAP);
      expect(slots).not.toContain(ItemSlot.SLOT_WEAPON_1);
      expect(slots).toContain(ItemSlot.SLOT_HELMET);
    });
  });
});
