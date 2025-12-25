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
} from './types';

// Type constants and helpers
export {
  // Constants
  QUALITY_PHYSICAL_MULTIPLIER,
  QUALITY_DEFENCE_MULTIPLIER,
  ITEM_SECTION_SEPARATOR,
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
