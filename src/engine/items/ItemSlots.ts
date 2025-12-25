/**
 * Item slot validation and constants.
 *
 * Pure TypeScript module with no Vue/Pinia dependencies.
 * Used by itemStore for slot validation and by CalcSetup for item processing.
 */
import { ItemSlot, ItemType } from 'src/protos/pob2_pb';

// ============================================================================
// Slot Categories
// ============================================================================

/** Main hand weapon slots (both sets) */
export const MAIN_HAND_SLOTS: readonly ItemSlot[] = [
  ItemSlot.SLOT_WEAPON_1,
  ItemSlot.SLOT_WEAPON_1_SWAP,
] as const;

/** Off-hand slots (both sets) */
export const OFF_HAND_SLOTS: readonly ItemSlot[] = [
  ItemSlot.SLOT_WEAPON_2,
  ItemSlot.SLOT_WEAPON_2_SWAP,
] as const;

/** All weapon slots */
export const WEAPON_SLOTS: readonly ItemSlot[] = [
  ...MAIN_HAND_SLOTS,
  ...OFF_HAND_SLOTS,
] as const;

/** Primary weapon set slots */
export const PRIMARY_WEAPON_SET: readonly ItemSlot[] = [
  ItemSlot.SLOT_WEAPON_1,
  ItemSlot.SLOT_WEAPON_2,
] as const;

/** Swap weapon set slots */
export const SWAP_WEAPON_SET: readonly ItemSlot[] = [
  ItemSlot.SLOT_WEAPON_1_SWAP,
  ItemSlot.SLOT_WEAPON_2_SWAP,
] as const;

/** Armour slots */
export const ARMOUR_SLOTS: readonly ItemSlot[] = [
  ItemSlot.SLOT_HELMET,
  ItemSlot.SLOT_BODY_ARMOUR,
  ItemSlot.SLOT_GLOVES,
  ItemSlot.SLOT_BOOTS,
] as const;

/** Accessory slots */
export const ACCESSORY_SLOTS: readonly ItemSlot[] = [
  ItemSlot.SLOT_AMULET,
  ItemSlot.SLOT_RING_1,
  ItemSlot.SLOT_RING_2,
  ItemSlot.SLOT_BELT,
] as const;

/** Flask slots */
export const FLASK_SLOT_ARRAY: readonly ItemSlot[] = [
  ItemSlot.SLOT_FLASK_1,
  ItemSlot.SLOT_FLASK_2,
  ItemSlot.SLOT_FLASK_3,
  ItemSlot.SLOT_FLASK_4,
  ItemSlot.SLOT_FLASK_5,
] as const;

/** Jewel slots */
export const JEWEL_SLOTS: readonly ItemSlot[] = [
  ItemSlot.SLOT_JEWEL_1,
  ItemSlot.SLOT_JEWEL_2,
] as const;

/** All equippable slots (excluding jewels which are tree-based) */
export const ALL_EQUIPMENT_SLOTS: readonly ItemSlot[] = [
  ...WEAPON_SLOTS,
  ...ARMOUR_SLOTS,
  ...ACCESSORY_SLOTS,
  ...FLASK_SLOT_ARRAY,
] as const;

// ============================================================================
// Item Type Sets
// ============================================================================

/** One-handed weapon types (can dual-wield) */
export const ONE_HANDED_TYPES: ReadonlySet<ItemType> = new Set([
  ItemType.ONE_HAND_SWORD,
  ItemType.ONE_HAND_AXE,
  ItemType.ONE_HAND_MACE,
  ItemType.WAND,
  ItemType.DAGGER,
  ItemType.CLAW,
  ItemType.SCEPTRE,
  ItemType.FLAIL,
]);

/** Two-handed weapon types (occupy both weapon slots) */
export const TWO_HANDED_TYPES: ReadonlySet<ItemType> = new Set([
  ItemType.TWO_HAND_SWORD,
  ItemType.TWO_HAND_AXE,
  ItemType.TWO_HAND_MACE,
  ItemType.BOW,
  ItemType.CROSSBOW,
  ItemType.STAFF,
  ItemType.QUARTERSTAFF,
  ItemType.SPEAR,
]);

/** All weapon types */
export const ALL_WEAPON_TYPES: ReadonlySet<ItemType> = new Set([
  ...ONE_HANDED_TYPES,
  ...TWO_HANDED_TYPES,
]);

/** Off-hand specific types (shields, focus, quiver) */
export const OFF_HAND_ONLY_TYPES: ReadonlySet<ItemType> = new Set([
  ItemType.SHIELD,
  ItemType.FOCUS,
  ItemType.QUIVER,
]);

/** Types valid for off-hand slot (off-hand items + one-handers for dual-wield) */
export const OFF_HAND_VALID_TYPES: ReadonlySet<ItemType> = new Set([
  ...OFF_HAND_ONLY_TYPES,
  ...ONE_HANDED_TYPES,
]);

// ============================================================================
// Slot → Valid Item Types Mapping
// ============================================================================

/**
 * Valid item types for each slot.
 * Used for slot validation when equipping items.
 */
export const SLOT_VALID_TYPES: Readonly<
  Record<ItemSlot, ReadonlySet<ItemType>>
> = {
  [ItemSlot.ITEM_SLOT_UNKNOWN]: new Set(),

  // Main hand: any weapon
  [ItemSlot.SLOT_WEAPON_1]: ALL_WEAPON_TYPES,
  [ItemSlot.SLOT_WEAPON_1_SWAP]: ALL_WEAPON_TYPES,

  // Off-hand: shields, focus, quiver, or one-handers for dual-wield
  [ItemSlot.SLOT_WEAPON_2]: OFF_HAND_VALID_TYPES,
  [ItemSlot.SLOT_WEAPON_2_SWAP]: OFF_HAND_VALID_TYPES,

  // Armour
  [ItemSlot.SLOT_HELMET]: new Set([ItemType.HELMET]),
  [ItemSlot.SLOT_BODY_ARMOUR]: new Set([ItemType.BODY_ARMOUR]),
  [ItemSlot.SLOT_GLOVES]: new Set([ItemType.GLOVES]),
  [ItemSlot.SLOT_BOOTS]: new Set([ItemType.BOOTS]),

  // Accessories
  [ItemSlot.SLOT_AMULET]: new Set([ItemType.AMULET]),
  [ItemSlot.SLOT_RING_1]: new Set([ItemType.RING]),
  [ItemSlot.SLOT_RING_2]: new Set([ItemType.RING]),
  [ItemSlot.SLOT_BELT]: new Set([ItemType.BELT]),

  // Flasks
  [ItemSlot.SLOT_FLASK_1]: new Set([ItemType.FLASK]),
  [ItemSlot.SLOT_FLASK_2]: new Set([ItemType.FLASK]),
  [ItemSlot.SLOT_FLASK_3]: new Set([ItemType.FLASK]),
  [ItemSlot.SLOT_FLASK_4]: new Set([ItemType.FLASK]),
  [ItemSlot.SLOT_FLASK_5]: new Set([ItemType.FLASK]),

  // Jewels
  [ItemSlot.SLOT_JEWEL_1]: new Set([ItemType.JEWEL]),
  [ItemSlot.SLOT_JEWEL_2]: new Set([ItemType.JEWEL]),
};

// ============================================================================
// Slot Category Type
// ============================================================================

/** Categories of equipment slots */
export type SlotCategory =
  | 'weapon'
  | 'armour'
  | 'accessory'
  | 'flask'
  | 'jewel'
  | 'unknown';

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if an item type can be equipped in a slot.
 *
 * @param slot - Target slot
 * @param itemType - Item type to check
 * @returns True if the item type is valid for the slot
 */
export function isValidSlotForItem(
  slot: ItemSlot,
  itemType: ItemType | undefined
): boolean {
  if (itemType === undefined || itemType === ItemType.ITEM_TYPE_UNKNOWN) {
    return false;
  }
  const validTypes = SLOT_VALID_TYPES[slot];
  return validTypes?.has(itemType) ?? false;
}

/**
 * Get the category of a slot.
 *
 * @param slot - Slot to categorize
 * @returns Category of the slot
 */
export function getSlotCategory(slot: ItemSlot): SlotCategory {
  if (WEAPON_SLOTS.includes(slot)) return 'weapon';
  if (ARMOUR_SLOTS.includes(slot)) return 'armour';
  if (ACCESSORY_SLOTS.includes(slot)) return 'accessory';
  if (FLASK_SLOT_ARRAY.includes(slot)) return 'flask';
  if (JEWEL_SLOTS.includes(slot)) return 'jewel';
  return 'unknown';
}

/**
 * Check if slot is a main-hand weapon slot.
 *
 * @param slot - Slot to check
 * @returns True if main-hand slot
 */
export function isMainHandSlot(slot: ItemSlot): boolean {
  return MAIN_HAND_SLOTS.includes(slot);
}

/**
 * Check if slot is an off-hand slot.
 *
 * @param slot - Slot to check
 * @returns True if off-hand slot
 */
export function isOffHandSlot(slot: ItemSlot): boolean {
  return OFF_HAND_SLOTS.includes(slot);
}

/**
 * Check if slot is in the swap weapon set.
 *
 * @param slot - Slot to check
 * @returns True if swap weapon slot
 */
export function isSwapSlot(slot: ItemSlot): boolean {
  return (
    slot === ItemSlot.SLOT_WEAPON_1_SWAP ||
    slot === ItemSlot.SLOT_WEAPON_2_SWAP
  );
}

/**
 * Check if slot is a weapon slot (main or off-hand, either set).
 *
 * @param slot - Slot to check
 * @returns True if weapon slot
 */
export function isWeaponSlot(slot: ItemSlot): boolean {
  return WEAPON_SLOTS.includes(slot);
}

/**
 * Check if item type is two-handed.
 *
 * @param itemType - Item type to check
 * @returns True if two-handed weapon
 */
export function isTwoHandedWeaponType(
  itemType: ItemType | undefined
): boolean {
  return itemType !== undefined && TWO_HANDED_TYPES.has(itemType);
}

/**
 * Check if item type is one-handed.
 *
 * @param itemType - Item type to check
 * @returns True if one-handed weapon
 */
export function isOneHandedWeaponType(
  itemType: ItemType | undefined
): boolean {
  return itemType !== undefined && ONE_HANDED_TYPES.has(itemType);
}

/**
 * Get the corresponding slot in the other weapon set.
 *
 * @param slot - Current weapon slot
 * @returns Corresponding slot in other set, or null if not a weapon slot
 */
export function getAlternateWeaponSlot(slot: ItemSlot): ItemSlot | null {
  switch (slot) {
    case ItemSlot.SLOT_WEAPON_1:
      return ItemSlot.SLOT_WEAPON_1_SWAP;
    case ItemSlot.SLOT_WEAPON_2:
      return ItemSlot.SLOT_WEAPON_2_SWAP;
    case ItemSlot.SLOT_WEAPON_1_SWAP:
      return ItemSlot.SLOT_WEAPON_1;
    case ItemSlot.SLOT_WEAPON_2_SWAP:
      return ItemSlot.SLOT_WEAPON_2;
    default:
      return null;
  }
}

/**
 * Get validation error message for slot/item combination.
 *
 * @param slot - Target slot
 * @param itemType - Item type to check
 * @returns Error message if invalid, null if valid
 */
export function getSlotValidationError(
  slot: ItemSlot,
  itemType: ItemType | undefined
): string | null {
  if (itemType === undefined || itemType === ItemType.ITEM_TYPE_UNKNOWN) {
    return 'Item has no type';
  }
  if (!isValidSlotForItem(slot, itemType)) {
    const slotName = ItemSlot[slot] ?? `Unknown slot (${slot})`;
    const typeName = ItemType[itemType] ?? `Unknown type (${itemType})`;
    return `Cannot equip ${typeName} in ${slotName}`;
  }
  return null;
}

/**
 * Get the weapon slots for a given weapon set.
 *
 * @param activeSet - Which weapon set (1 = primary, 2 = swap)
 * @returns Object with mainHand and offHand slot IDs
 */
export function getWeaponSlotsForSet(activeSet: 1 | 2): {
  mainHand: ItemSlot;
  offHand: ItemSlot;
} {
  if (activeSet === 1) {
    return {
      mainHand: ItemSlot.SLOT_WEAPON_1,
      offHand: ItemSlot.SLOT_WEAPON_2,
    };
  }
  return {
    mainHand: ItemSlot.SLOT_WEAPON_1_SWAP,
    offHand: ItemSlot.SLOT_WEAPON_2_SWAP,
  };
}

/**
 * Get all slots that should be considered "equipped" for a given weapon set.
 * This includes non-weapon slots plus the appropriate weapon slots.
 *
 * @param activeSet - Which weapon set is active (1 = primary, 2 = swap)
 * @returns Array of all active equipment slots
 */
export function getActiveEquipmentSlots(activeSet: 1 | 2): readonly ItemSlot[] {
  const weaponSlots =
    activeSet === 1 ? PRIMARY_WEAPON_SET : SWAP_WEAPON_SET;
  return [
    ...weaponSlots,
    ...ARMOUR_SLOTS,
    ...ACCESSORY_SLOTS,
    ...FLASK_SLOT_ARRAY,
  ];
}
