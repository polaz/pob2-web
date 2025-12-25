// src/types/bases.ts
// Types for PoE2 item base data
// Source: PathOfBuildingCommunity/PathOfBuilding-PoE2

// ============================================================================
// Item Base Categories
// ============================================================================

/**
 * High-level item base categories for organizing data files
 */
export type ItemBaseCategory =
  | 'weapons'
  | 'armour'
  | 'accessories'
  | 'jewels'
  | 'flasks'
  | 'special';

/**
 * Item type as defined in PoB2 base data.
 * These match the 'type' field from Lua files.
 */
export type ItemBaseType =
  // Weapons - One Handed
  | 'One Handed Sword'
  | 'One Handed Axe'
  | 'One Handed Mace'
  | 'Sceptre'
  | 'Dagger'
  | 'Claw'
  | 'Wand'
  | 'Flail'
  | 'Spear'
  // Weapons - Two Handed
  | 'Two Handed Sword'
  | 'Two Handed Axe'
  | 'Two Handed Mace'
  | 'Staff'
  | 'Warstaff'
  | 'Bow'
  | 'Crossbow'
  // Armour
  | 'Body Armour'
  | 'Boots'
  | 'Gloves'
  | 'Helmet'
  | 'Shield'
  // Accessories
  | 'Ring'
  | 'Amulet'
  | 'Belt'
  | 'Quiver'
  | 'Focus'
  | 'Talisman'
  // Other
  | 'Jewel'
  | 'Flask'
  | 'Charm'
  | 'Life Flask'
  | 'Mana Flask'
  | 'Soul Core'
  | 'Fishing Rod'
  | 'Trap Tool';

/**
 * Armour subtype for hybrid armour pieces
 */
export type ArmourSubType =
  | 'Armour'
  | 'Evasion'
  | 'Energy Shield'
  | 'Armour/Evasion'
  | 'Armour/Energy Shield'
  | 'Evasion/Energy Shield'
  | 'Armour/Evasion/Energy Shield';

/**
 * Jewel subtype for special jewel types
 */
export type JewelSubType = 'Radius' | 'Timeless';

// ============================================================================
// Combat Stats
// ============================================================================

/**
 * Weapon combat statistics
 */
export interface WeaponStats {
  /** Minimum physical damage */
  PhysicalMin?: number;
  /** Maximum physical damage */
  PhysicalMax?: number;
  /** Minimum fire damage (for elemental bases) */
  FireMin?: number;
  /** Maximum fire damage */
  FireMax?: number;
  /** Minimum cold damage */
  ColdMin?: number;
  /** Maximum cold damage */
  ColdMax?: number;
  /** Minimum lightning damage */
  LightningMin?: number;
  /** Maximum lightning damage */
  LightningMax?: number;
  /** Minimum chaos damage */
  ChaosMin?: number;
  /** Maximum chaos damage */
  ChaosMax?: number;
  /** Base critical strike chance (e.g., 5 = 5%) */
  CritChanceBase: number;
  /** Attacks per second */
  AttackRateBase: number;
  /** Weapon range */
  Range?: number;
}

/**
 * Armour defensive statistics
 */
export interface ArmourStats {
  /** Base armour value */
  Armour?: number;
  /** Base evasion rating */
  Evasion?: number;
  /** Base energy shield */
  EnergyShield?: number;
  /** Movement speed penalty (0.05 = 5%) */
  MovementPenalty?: number;
  /** Block chance for shields */
  BlockChance?: number;
}

/**
 * Flask/Charm statistics
 */
export interface FlaskStats {
  /** Effect duration in seconds */
  duration?: number;
  /** Charges consumed per use */
  chargesUsed?: number;
  /** Maximum charges */
  chargesMax?: number;
  /** Life recovered (for life flasks) */
  lifeTotal?: number;
  /** Mana recovered (for mana flasks) */
  manaTotal?: number;
  /** Buff effects while active */
  buff?: string[];
}

/**
 * Shield-specific statistics
 */
export interface ShieldStats {
  /** Base block chance */
  BlockChance?: number;
}

// ============================================================================
// Requirements
// ============================================================================

/**
 * Item requirements
 */
export interface ItemRequirements {
  /** Minimum character level */
  level?: number;
  /** Strength requirement */
  str?: number;
  /** Dexterity requirement */
  dex?: number;
  /** Intelligence requirement */
  int?: number;
}

// ============================================================================
// Item Base Definition
// ============================================================================

/**
 * Tag flags for item categorization and filtering
 */
export interface ItemBaseTags {
  default?: boolean;
  // Weapon types
  weapon?: boolean;
  one_hand_weapon?: boolean;
  two_hand_weapon?: boolean;
  onehand?: boolean;
  twohand?: boolean;
  sword?: boolean;
  axe?: boolean;
  mace?: boolean;
  sceptre?: boolean;
  dagger?: boolean;
  claw?: boolean;
  wand?: boolean;
  bow?: boolean;
  crossbow?: boolean;
  staff?: boolean;
  warstaff?: boolean;
  flail?: boolean;
  spear?: boolean;
  // Armour types
  armour?: boolean;
  body_armour?: boolean;
  boots?: boolean;
  gloves?: boolean;
  helmet?: boolean;
  shield?: boolean;
  str_armour?: boolean;
  dex_armour?: boolean;
  int_armour?: boolean;
  str_dex_armour?: boolean;
  str_int_armour?: boolean;
  dex_int_armour?: boolean;
  str_dex_int_armour?: boolean;
  // Accessories
  ring?: boolean;
  amulet?: boolean;
  belt?: boolean;
  quiver?: boolean;
  focus?: boolean;
  talisman?: boolean;
  // Jewels
  jewel?: boolean;
  strjewel?: boolean;
  dexjewel?: boolean;
  intjewel?: boolean;
  radius_jewel?: boolean;
  str_radius_jewel?: boolean;
  dex_radius_jewel?: boolean;
  int_radius_jewel?: boolean;
  // Flasks
  flask?: boolean;
  life_flask?: boolean;
  mana_flask?: boolean;
  utility_flask?: boolean;
  // Special flags
  not_for_sale?: boolean;
  demigods?: boolean;
  ezomyte_basetype?: boolean;
  maraketh_basetype?: boolean;
  vaal_basetype?: boolean;
  // Extensible for future tags
  [key: string]: boolean | undefined;
}

/**
 * Raw item base data as stored in JSON (from Lua conversion)
 */
export interface RawItemBase {
  /** Item name (key in the original Lua table) */
  name: string;

  /** Item type category */
  type: ItemBaseType;

  /** Subtype for armour/jewels (e.g., 'Armour', 'Evasion', 'Radius', 'Timeless') */
  subType?: string;

  /** Base quality (typically 20) */
  quality?: number;

  /** Maximum socket count */
  socketLimit?: number;

  /** Categorization tags */
  tags: ItemBaseTags;

  /** Implicit modifier text */
  implicit?: string;

  /** Implicit modifier type tags for categorization */
  implicitModTypes?: string[][];

  /** Weapon stats (for weapons only) */
  weapon?: WeaponStats;

  /** Armour stats (for armour only) */
  armour?: ArmourStats;

  /** Shield stats (for shields only) */
  shield?: ShieldStats;

  /** Flask/Charm stats */
  flask?: FlaskStats;
  charm?: FlaskStats;

  /** Item requirements */
  req: ItemRequirements;

  /**
   * Manual edit flag - if true, this entry was manually added
   * and should be preserved during data merges
   */
  _manual?: boolean;

  /**
   * Field-level manual edit markers
   */
  [key: `_manual_${string}`]: boolean | undefined;
}

/**
 * Optimized item base for runtime operations
 */
export interface ItemBase {
  /** Unique identifier (derived from name) */
  id: string;

  /** Display name */
  name: string;

  /** Item type category */
  type: ItemBaseType;

  /** High-level category for organization */
  category: ItemBaseCategory;

  /** Subtype for armour/jewels */
  subType?: string;

  /** Base quality */
  quality: number;

  /** Maximum socket count */
  socketLimit: number;

  /** Categorization tags */
  tags: ItemBaseTags;

  /** Implicit modifier text */
  implicit?: string;

  /** Weapon stats (for weapons only) */
  weapon?: WeaponStats;

  /** Armour stats (for armour only) */
  armour?: ArmourStats;

  /** Shield stats (for shields only) */
  shield?: ShieldStats;

  /** Flask/Charm stats */
  flask?: FlaskStats;

  /** Item requirements */
  requirements: ItemRequirements;
}

// ============================================================================
// Data File Structures
// ============================================================================

/**
 * Metadata for item bases data file
 */
export interface ItemBasesMeta {
  /** Total number of bases in this file */
  totalBases: number;
  /** Breakdown by type */
  byType?: Record<string, number>;
}

/**
 * Complete raw item bases data structure from JSON file
 */
export interface RawItemBasesData {
  /** Data format version */
  version: string;
  /** Extraction timestamp */
  extractedAt: string;
  /** Data source */
  source: string;
  /** Category this file represents */
  category: ItemBaseCategory;
  /** Metadata */
  meta: ItemBasesMeta;
  /** Item bases keyed by name */
  bases: Record<string, RawItemBase>;
}

/**
 * Optimized item bases data for runtime operations
 */
export interface ItemBasesData {
  /** Data format version */
  version: string;
  /** Extraction date */
  extractedAt: Date;
  /** Data source */
  source: string;
  /** Category this data represents */
  category: ItemBaseCategory;
  /** Metadata */
  meta: ItemBasesMeta;
  /** Item bases by ID */
  bases: Map<string, ItemBase>;
  /** Index by name for search */
  byName: Map<string, ItemBase>;
  /** Index by type for filtering */
  byType: Map<ItemBaseType, ItemBase[]>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Mapping of Lua file names to categories
 */
export const LUA_FILE_CATEGORIES: Record<string, ItemBaseCategory> = {
  // Weapons
  sword: 'weapons',
  axe: 'weapons',
  mace: 'weapons',
  sceptre: 'weapons',
  dagger: 'weapons',
  claw: 'weapons',
  wand: 'weapons',
  bow: 'weapons',
  crossbow: 'weapons',
  staff: 'weapons',
  flail: 'weapons',
  spear: 'weapons',
  traptool: 'weapons',
  // Armour
  body: 'armour',
  boots: 'armour',
  gloves: 'armour',
  helmet: 'armour',
  shield: 'armour',
  // Accessories
  ring: 'accessories',
  amulet: 'accessories',
  belt: 'accessories',
  quiver: 'accessories',
  focus: 'accessories',
  talisman: 'accessories',
  // Jewels
  jewel: 'jewels',
  // Flasks
  flask: 'flasks',
  // Special
  soulcore: 'special',
  fishing: 'special',
} as const;

/**
 * Get the category for a given item type
 */
export function getCategoryForType(type: ItemBaseType): ItemBaseCategory {
  if (
    type.includes('Sword') ||
    type.includes('Axe') ||
    type.includes('Mace') ||
    type === 'Sceptre' ||
    type === 'Dagger' ||
    type === 'Claw' ||
    type === 'Wand' ||
    type === 'Bow' ||
    type === 'Crossbow' ||
    type === 'Staff' ||
    type === 'Warstaff' ||
    type === 'Flail' ||
    type === 'Spear' ||
    type === 'Trap Tool' ||
    type === 'Fishing Rod'
  ) {
    return 'weapons';
  }
  if (
    type === 'Body Armour' ||
    type === 'Boots' ||
    type === 'Gloves' ||
    type === 'Helmet' ||
    type === 'Shield'
  ) {
    return 'armour';
  }
  if (
    type === 'Ring' ||
    type === 'Amulet' ||
    type === 'Belt' ||
    type === 'Quiver' ||
    type === 'Focus' ||
    type === 'Talisman'
  ) {
    return 'accessories';
  }
  if (type === 'Jewel') {
    return 'jewels';
  }
  if (
    type === 'Flask' ||
    type === 'Charm' ||
    type === 'Life Flask' ||
    type === 'Mana Flask'
  ) {
    return 'flasks';
  }
  if (type === 'Soul Core') {
    return 'special';
  }
  return 'special';
}

/**
 * Generate a stable ID from item base name
 */
export function generateBaseId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
