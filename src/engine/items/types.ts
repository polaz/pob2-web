/**
 * Engine-specific item types for runtime calculations.
 *
 * These types extend the proto types from src/protos/pob2_pb.ts
 * with runtime-specific fields needed for calculation and parsing.
 */

import type {
  Item,
  ItemRarity,
  ItemType,
  WeaponData,
  ArmourData,
} from 'src/protos/pob2_pb';
import type { Mod } from 'src/engine/modifiers/types';

// ============================================================================
// Item Base Types (from JSON data files)
// ============================================================================

/**
 * Weapon stats from base item data.
 */
export interface WeaponBaseStats {
  PhysicalMin: number;
  PhysicalMax: number;
  CritChanceBase: number;
  AttackRateBase: number;
  Range: number;
}

/**
 * Armour stats from base item data.
 */
export interface ArmourBaseStats {
  Armour?: number;
  Evasion?: number;
  EnergyShield?: number;
  Ward?: number;
  Block?: number;
  MovementPenalty?: number;
}

/**
 * Shield stats from base item data.
 */
export interface ShieldBaseStats extends ArmourBaseStats {
  Block?: number;
}

/**
 * Flask stats from base item data.
 */
export interface FlaskBaseStats {
  LifeTotal?: number;
  ManaTotal?: number;
  Duration?: number;
  ChargesUsed?: number;
  ChargesMax?: number;
}

/**
 * Jewel stats from base item data.
 */
export interface JewelBaseStats {
  radius?: number;
  limit?: string;
}

/**
 * Requirements for an item base.
 */
export interface ItemRequirements {
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
}

/**
 * An item base definition as stored in JSON data files.
 */
export interface ItemBase {
  /** Display name of the base type */
  name: string;

  /** Item type category (e.g., "One Handed Sword", "Body Armour") */
  type: string;

  /** Sub-type for armour (e.g., "Armour", "Evasion", "Energy Shield") */
  subType?: string;

  /** Default quality percentage */
  quality: number;

  /** Maximum number of sockets */
  socketLimit: number;

  /** Item tags for filtering/categorization */
  tags: Record<string, boolean>;

  /** Requirements to equip */
  req: ItemRequirements;

  /** Weapon-specific stats (if weapon) */
  weapon?: WeaponBaseStats;

  /** Armour-specific stats (if armour/shield) */
  armour?: ArmourBaseStats;

  /** Flask-specific stats (if flask) */
  flask?: FlaskBaseStats;

  /** Jewel-specific stats (if jewel) */
  jewel?: JewelBaseStats;

  /** Implicit mod texts */
  implicit?: string[];
}

/**
 * Item bases file structure as loaded from JSON.
 */
export interface ItemBasesFile {
  version: string;
  extractedAt: string;
  source: string;
  category: string;
  meta: {
    totalBases: number;
    byType: Record<string, number>;
  };
  bases: Record<string, ItemBase>;
}

// ============================================================================
// Runtime Item Types
// ============================================================================

/**
 * A parsed item ready for calculation.
 *
 * Extends the proto Item with parsed modifiers and computed values.
 */
export interface ParsedItem extends Item {
  /** The item base definition (if found) */
  base?: ItemBase;

  /** All parsed modifiers from this item */
  parsedMods: Mod[];

  /** Computed weapon data with quality applied */
  computedWeaponData?: ComputedWeaponData;

  /** Computed armour data with quality applied */
  computedArmourData?: ComputedArmourData;
}

/**
 * Weapon data with quality and local mods applied.
 */
export interface ComputedWeaponData {
  /** Physical damage range */
  physicalMin: number;
  physicalMax: number;

  /** Elemental damage ranges */
  fireMin: number;
  fireMax: number;
  coldMin: number;
  coldMax: number;
  lightningMin: number;
  lightningMax: number;
  chaosMin: number;
  chaosMax: number;

  /** Total combined damage */
  totalMin: number;
  totalMax: number;

  /** Average damage per hit */
  averageDamage: number;

  /** Attacks per second */
  attackSpeed: number;

  /** Critical strike chance (as decimal, e.g., 0.05 = 5%) */
  critChance: number;

  /** DPS values */
  physicalDps: number;
  elementalDps: number;
  chaosDps: number;
  totalDps: number;

  /** Weapon range */
  range: number;
}

/**
 * Armour data with quality and local mods applied.
 */
export interface ComputedArmourData {
  armour: number;
  evasion: number;
  energyShield: number;
  ward: number;
  block: number;
}

// ============================================================================
// Parsing Types
// ============================================================================

/**
 * Result of parsing an item from text.
 */
export interface ItemParseResult {
  /** Whether parsing succeeded */
  success: boolean;

  /** The parsed item (if successful) */
  item?: Item;

  /** Error message (if failed) */
  error?: string;

  /** Warnings generated during parsing */
  warnings: string[];

  /** Lines that couldn't be parsed */
  unparsedLines: string[];
}

/**
 * Section of an item text (separated by dashes).
 */
export interface ItemTextSection {
  /** Section index (0-based) */
  index: number;

  /** Lines in this section */
  lines: string[];

  /** Section type (if identified) */
  type?: ItemSectionType;
}

/**
 * Types of sections in item text.
 */
export type ItemSectionType =
  | 'header' // Rarity, name, base type
  | 'properties' // Quality, attack speed, etc.
  | 'requirements' // Level, attributes
  | 'sockets' // Socket information
  | 'implicit' // Implicit mods (above separator)
  | 'explicit' // Explicit mods
  | 'enchant' // Enchantments
  | 'crafted' // Crafted mods
  | 'corrupted' // Corrupted tag
  | 'mirrored' // Mirrored tag
  | 'note' // Trade note
  | 'unknown';

// ============================================================================
// Constants
// ============================================================================

/** Quality bonus multiplier for physical damage (20% quality = 1.2x) */
export const QUALITY_PHYSICAL_MULTIPLIER = 0.01;

/** Quality bonus multiplier for armour/evasion/ES (20% quality = 1.2x) */
export const QUALITY_DEFENCE_MULTIPLIER = 0.01;

/** Section separator in item text */
export const ITEM_SECTION_SEPARATOR = '--------';

/**
 * Multiplier for storing percentage values as integers.
 * Example: 5.00% is stored as 500 (5.00 * 100)
 */
export const PERCENTAGE_STORAGE_MULTIPLIER = 100;

/**
 * Divisor for converting stored percentage values back to decimal.
 * Stored values are percentage * 100, so divide by 10000 to get decimal.
 * Example: 500 (5.00%) / 10000 = 0.05
 */
export const PERCENTAGE_TO_DECIMAL_DIVISOR = 10000;

/**
 * Default critical strike chance value (5.00% stored as 500).
 * Used when weapon data doesn't specify a crit chance.
 */
export const DEFAULT_CRIT_CHANCE = 500;

/**
 * Divisor for calculating average from min/max range.
 * Average = (min + max) / 2
 */
export const AVERAGE_DIVISOR = 2;

/** Rarity text to enum mapping */
export const RARITY_TEXT_MAP: Record<string, ItemRarity> = {
  Normal: 1, // RARITY_NORMAL
  Magic: 2, // RARITY_MAGIC
  Rare: 3, // RARITY_RARE
  Unique: 4, // RARITY_UNIQUE
};

// ============================================================================
// Type Mappings
// ============================================================================

/**
 * Maps item type strings to ItemType enum values.
 */
export const ITEM_TYPE_MAP: Record<string, ItemType> = {
  // Weapons - One Handed
  'One Handed Sword': 1, // ONE_HAND_SWORD
  'One Handed Axe': 3, // ONE_HAND_AXE
  'One Handed Mace': 5, // ONE_HAND_MACE
  Sceptre: 13, // SCEPTRE
  Dagger: 11, // DAGGER
  Claw: 12, // CLAW
  Wand: 10, // WAND

  // Weapons - Two Handed
  'Two Handed Sword': 2, // TWO_HAND_SWORD
  'Two Handed Axe': 4, // TWO_HAND_AXE
  'Two Handed Mace': 6, // TWO_HAND_MACE
  Staff: 9, // STAFF
  Bow: 7, // BOW
  Crossbow: 8, // CROSSBOW

  // PoE2 weapons
  Quarterstaff: 14, // QUARTERSTAFF
  Spear: 15, // SPEAR
  Flail: 16, // FLAIL

  // Armour
  Helmet: 20, // HELMET
  'Body Armour': 21, // BODY_ARMOUR
  Gloves: 22, // GLOVES
  Boots: 23, // BOOTS
  Shield: 24, // SHIELD
  Focus: 25, // FOCUS (PoE2)

  // Accessories
  Amulet: 30, // AMULET
  Ring: 31, // RING
  Belt: 32, // BELT

  // Other
  Flask: 40, // FLASK
  Jewel: 41, // JEWEL
  Charm: 42, // CHARM (PoE2)
  Quiver: 43, // QUIVER
};

/**
 * Weapon types that are two-handed.
 */
export const TWO_HANDED_WEAPON_TYPES: Set<ItemType> = new Set([
  2, // TWO_HAND_SWORD
  4, // TWO_HAND_AXE
  6, // TWO_HAND_MACE
  7, // BOW
  8, // CROSSBOW
  9, // STAFF
  14, // QUARTERSTAFF
  15, // SPEAR
]);

/**
 * Item types that are weapons.
 */
export const WEAPON_ITEM_TYPES: Set<ItemType> = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
]);

/**
 * Item types that are armour pieces.
 */
export const ARMOUR_ITEM_TYPES: Set<ItemType> = new Set([
  20, 21, 22, 23, 24, 25,
]);

/**
 * Item types that are accessories.
 */
export const ACCESSORY_ITEM_TYPES: Set<ItemType> = new Set([30, 31, 32]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if an item type is a weapon.
 */
export function isWeaponType(itemType: ItemType | undefined): boolean {
  return itemType !== undefined && WEAPON_ITEM_TYPES.has(itemType);
}

/**
 * Checks if an item type is armour.
 */
export function isArmourType(itemType: ItemType | undefined): boolean {
  return itemType !== undefined && ARMOUR_ITEM_TYPES.has(itemType);
}

/**
 * Checks if an item type is an accessory.
 */
export function isAccessoryType(itemType: ItemType | undefined): boolean {
  return itemType !== undefined && ACCESSORY_ITEM_TYPES.has(itemType);
}

/**
 * Checks if an item type is two-handed.
 */
export function isTwoHandedType(itemType: ItemType | undefined): boolean {
  return itemType !== undefined && TWO_HANDED_WEAPON_TYPES.has(itemType);
}

// ============================================================================
// Equip Result
// ============================================================================

/**
 * Result of attempting to equip an item in a slot.
 */
export interface EquipResult {
  /** Whether the equip operation succeeded */
  success: boolean;
  /** Error message if the operation failed */
  error?: string;
  /** The item that was replaced (if any) */
  replacedItem?: Item;
}

/**
 * Converts proto WeaponData to computed values with quality applied.
 */
export function computeWeaponStats(
  weaponData: WeaponData,
  quality: number = 0
): ComputedWeaponData {
  const qualityMultiplier = 1 + quality * QUALITY_PHYSICAL_MULTIPLIER;

  const physicalMin = Math.round(
    (weaponData.physicalMin ?? 0) * qualityMultiplier
  );
  const physicalMax = Math.round(
    (weaponData.physicalMax ?? 0) * qualityMultiplier
  );
  const fireMin = weaponData.fireMin ?? 0;
  const fireMax = weaponData.fireMax ?? 0;
  const coldMin = weaponData.coldMin ?? 0;
  const coldMax = weaponData.coldMax ?? 0;
  const lightningMin = weaponData.lightningMin ?? 0;
  const lightningMax = weaponData.lightningMax ?? 0;
  const chaosMin = weaponData.chaosMin ?? 0;
  const chaosMax = weaponData.chaosMax ?? 0;

  const totalMin =
    physicalMin + fireMin + coldMin + lightningMin + chaosMin;
  const totalMax =
    physicalMax + fireMax + coldMax + lightningMax + chaosMax;
  const averageDamage = (totalMin + totalMax) / AVERAGE_DIVISOR;

  const attackSpeed = weaponData.attackSpeed ?? 1;
  // Convert crit chance from stored format to decimal
  const critChance =
    (weaponData.critChance ?? DEFAULT_CRIT_CHANCE) /
    PERCENTAGE_TO_DECIMAL_DIVISOR;

  const physicalDps =
    ((physicalMin + physicalMax) / AVERAGE_DIVISOR) * attackSpeed;
  const elementalDps =
    ((fireMin + fireMax + coldMin + coldMax + lightningMin + lightningMax) /
      AVERAGE_DIVISOR) *
    attackSpeed;
  const chaosDps = ((chaosMin + chaosMax) / AVERAGE_DIVISOR) * attackSpeed;
  const totalDps = physicalDps + elementalDps + chaosDps;

  return {
    physicalMin,
    physicalMax,
    fireMin,
    fireMax,
    coldMin,
    coldMax,
    lightningMin,
    lightningMax,
    chaosMin,
    chaosMax,
    totalMin,
    totalMax,
    averageDamage,
    attackSpeed,
    critChance,
    physicalDps,
    elementalDps,
    chaosDps,
    totalDps,
    range: weaponData.range ?? 0,
  };
}

/**
 * Converts proto ArmourData to computed values with quality applied.
 */
export function computeArmourStats(
  armourData: ArmourData,
  quality: number = 0
): ComputedArmourData {
  const qualityMultiplier = 1 + quality * QUALITY_DEFENCE_MULTIPLIER;

  return {
    armour: Math.round((armourData.armour ?? 0) * qualityMultiplier),
    evasion: Math.round((armourData.evasion ?? 0) * qualityMultiplier),
    energyShield: Math.round(
      (armourData.energyShield ?? 0) * qualityMultiplier
    ),
    ward: armourData.ward ?? 0, // Ward not affected by quality
    block: (armourData.block ?? 0) / PERCENTAGE_TO_DECIMAL_DIVISOR,
  };
}
