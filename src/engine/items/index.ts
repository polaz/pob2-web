/**
 * Item engine module exports.
 *
 * Provides item parsing, representation, and calculation utilities.
 */

// Types
export type {
  // Item base types
  WeaponBaseStats,
  ArmourBaseStats,
  ShieldBaseStats,
  FlaskBaseStats,
  JewelBaseStats,
  ItemRequirements,
  ItemBase,
  ItemBasesFile,
  // Runtime types
  ParsedItem,
  ComputedWeaponData,
  ComputedArmourData,
  // Parsing types
  ItemParseResult,
  ItemTextSection,
  ItemSectionType,
  // Equip result
  EquipResult,
} from './types';

// Slot types
export type { SlotCategory } from './ItemSlots';

// Type constants and helpers
export {
  // Constants
  QUALITY_PHYSICAL_MULTIPLIER,
  QUALITY_DEFENCE_MULTIPLIER,
  ITEM_SECTION_SEPARATOR,
  PERCENTAGE_STORAGE_MULTIPLIER,
  PERCENTAGE_TO_DECIMAL_DIVISOR,
  DEFAULT_CRIT_CHANCE,
  AVERAGE_DIVISOR,
  RARITY_TEXT_MAP,
  ITEM_TYPE_MAP,
  TWO_HANDED_WEAPON_TYPES,
  WEAPON_ITEM_TYPES,
  ARMOUR_ITEM_TYPES,
  ACCESSORY_ITEM_TYPES,
  // Type checkers
  isWeaponType,
  isArmourType,
  isAccessoryType,
  isTwoHandedType,
  // Computed stats
  computeWeaponStats,
  computeArmourStats,
} from './types';

// Item class
export { ItemInstance, createItemInstance, createEmptyItem } from './Item';

// Item parser
export { ItemParser, createItemParser, parseItem } from './ItemParser';

// Item slots - validation and constants
export {
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
  // Slot → valid types mapping
  SLOT_VALID_TYPES,
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
} from './ItemSlots';
