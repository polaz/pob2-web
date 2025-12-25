// src/types/uniques.ts
// Types for PoE2 unique item data
// Source: PathOfBuildingCommunity/PathOfBuilding-PoE2

import type { ItemBaseType, ItemBaseCategory } from './bases';

// ============================================================================
// Unique Item Modifier
// ============================================================================

/**
 * Tag categories for unique item modifiers.
 * Used for filtering and categorization in the UI.
 */
export type UniqueModifierTag =
  // Damage types
  | 'physical'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'chaos'
  | 'elemental'
  | 'damage'
  // Defence
  | 'defences'
  | 'armour'
  | 'evasion'
  | 'energy_shield'
  | 'block'
  | 'life'
  | 'mana'
  | 'resistance'
  // Offence
  | 'attack'
  | 'caster'
  | 'speed'
  | 'critical'
  // Utility
  | 'attribute'
  | 'gem'
  | 'socket'
  | 'skill'
  | 'aura'
  | 'curse'
  | 'minion'
  // Special
  | 'unique_mechanic';

/**
 * A modifier on a unique item.
 *
 * Modifiers can have:
 * - Fixed values (value field)
 * - Range values (min/max fields)
 * - Text-only effects (neither, just text)
 */
export interface UniqueModifier {
  /** Raw modifier text as it appears on the item */
  text: string;

  /** Fixed value for non-range modifiers */
  value?: number;

  /** Minimum value for range modifiers */
  min?: number;

  /** Maximum value for range modifiers */
  max?: number;

  /** Modifier tags for filtering/categorization */
  tags?: UniqueModifierTag[];

  /**
   * Whether this modifier is an implicit (above the line).
   * If false/undefined, it's an explicit modifier.
   */
  implicit?: boolean;
}

// ============================================================================
// Unique Item Definition
// ============================================================================

/**
 * League or source information for unique items.
 */
export interface UniqueItemSource {
  /** League the item is from (e.g., "Dawn of the Hunt") */
  league?: string;

  /** Drop source (e.g., "Drops from unique{The King in the Mists}") */
  dropSource?: string;

  /** Whether the item is boss-only */
  bossOnly?: boolean;

  /** Upgrade path source (e.g., "Upgraded from unique{X} via Y") */
  upgradedFrom?: string;
}

/**
 * A unique item definition.
 *
 * For items WITHOUT variants: variantGroup, variantId, variantName, isDefaultVariant are absent.
 * For items WITH variants: each variant is a separate entry with these fields populated.
 */
export interface UniqueItem {
  /** Unique identifier (e.g., "goldrim" or "black-sun-crest-pre-0.1.1") */
  id: string;

  /** Display name of the unique item */
  name: string;

  /** Base item type name (e.g., "Leather Cap", "Wrapped Greathelm") */
  baseType: string;

  /** Base item type ID for linking to base data */
  baseTypeId: string;

  /** Item type category (e.g., "Helmet", "Ring") */
  itemType: ItemBaseType;

  /** High-level category for file organization */
  category: ItemBaseCategory;

  /** Source/league information */
  source?: UniqueItemSource;

  /** Required item level (if specified) */
  itemLevel?: number;

  /** Item modifiers (implicits and explicits) */
  modifiers: UniqueModifier[];

  // ---- Variant fields (only present for items with variants) ----

  /**
   * Groups all variants of the same item.
   * Only present for items with multiple variants.
   * Example: "black-sun-crest" for all Black Sun Crest variants.
   */
  variantGroup?: string;

  /**
   * Machine-readable variant identifier.
   * Example: "pre-0.1.1", "current", "two-implicit"
   */
  variantId?: string;

  /**
   * Human-readable variant name.
   * Example: "Pre 0.1.1", "Current", "Two Abyssal Sockets"
   */
  variantName?: string;

  /**
   * Whether this is the default variant to show.
   * Only one variant per group should have this set to true.
   */
  isDefaultVariant?: boolean;

  // ---- Manual edit flags ----

  /**
   * If true, this entry was manually added and should be preserved
   * during data regeneration.
   */
  _manual?: boolean;

  /**
   * If true, this entry should be excluded from the final data.
   * Used in override files to remove erroneous entries.
   */
  _deleted?: boolean;
}

// ============================================================================
// Raw Data Structures (from Lua conversion)
// ============================================================================

/**
 * Raw unique item as parsed from Lua files.
 * This is the intermediate format before normalization.
 */
export interface RawUniqueItem {
  /** Item name (first line of the block) */
  name: string;

  /** Base type (second line of the block) */
  baseType: string;

  /** Variant definitions (e.g., ["Pre 0.1.1", "Current"]) */
  variants?: string[];

  /** League the item is from */
  league?: string;

  /** Drop source text */
  source?: string;

  /** Required item level */
  itemLevel?: number;

  /** Number of implicits declared */
  implicitCount?: number;

  /** Raw modifier lines with variant tags */
  modifierLines: RawModifierLine[];
}

/**
 * A raw modifier line from Lua parsing.
 */
export interface RawModifierLine {
  /** The modifier text (without variant/tag prefixes) */
  text: string;

  /** Which variant indices this modifier applies to (empty = all) */
  variantIndices?: number[];

  /** Modifier tags from {tags:...} prefix */
  tags?: string[];

  /** Whether this is an implicit modifier */
  implicit?: boolean;
}

// ============================================================================
// Data File Structures
// ============================================================================

/**
 * Metadata for unique items data file.
 */
export interface UniquesFileMeta {
  /** Total number of unique items in this file */
  totalItems: number;

  /** Number of items with variants */
  itemsWithVariants: number;

  /** Total entries including all variants */
  totalEntries: number;

  /** Breakdown by item type */
  byType?: Record<string, number>;
}

/**
 * Complete unique items data structure from JSON file.
 */
export interface UniquesFileData {
  /** Data format version */
  version: string;

  /** Extraction timestamp */
  extractedAt: string;

  /** Data source */
  source: string;

  /** File type identifier (e.g., "sword", "helmet", "ring") */
  fileType: string;

  /** Metadata */
  meta: UniquesFileMeta;

  /** Unique items keyed by ID */
  uniques: Record<string, UniqueItem>;
}

/**
 * Override file structure for manual corrections.
 */
export interface UniquesOverrideData {
  /** Comment explaining the override file */
  _comment?: string;

  /** Overrides keyed by item ID */
  uniques: Record<string, Partial<UniqueItem>>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Mapping of Lua file names to their item types.
 */
export const UNIQUE_FILE_TYPES: Record<string, ItemBaseType> = {
  // Weapons - One Handed
  sword: 'One Handed Sword',
  axe: 'One Handed Axe',
  mace: 'One Handed Mace',
  sceptre: 'Sceptre',
  dagger: 'Dagger',
  claw: 'Claw',
  wand: 'Wand',
  flail: 'Flail',
  spear: 'Spear',
  // Weapons - Two Handed
  bow: 'Bow',
  crossbow: 'Crossbow',
  staff: 'Staff',
  // Armour
  body: 'Body Armour',
  boots: 'Boots',
  gloves: 'Gloves',
  helmet: 'Helmet',
  shield: 'Shield',
  // Accessories
  ring: 'Ring',
  amulet: 'Amulet',
  belt: 'Belt',
  quiver: 'Quiver',
  focus: 'Focus',
  talisman: 'Talisman',
  // Other
  jewel: 'Jewel',
  flask: 'Flask',
  soulcore: 'SoulCore',
  fishing: 'Fishing Rod',
  traptool: 'Trap Tool',
  tincture: 'Flask', // Tinctures use Flask type
} as const;

/**
 * Mapping of Lua file names to categories.
 */
export const UNIQUE_FILE_CATEGORIES: Record<string, ItemBaseCategory> = {
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
  // Other
  jewel: 'jewels',
  flask: 'flasks',
  tincture: 'flasks',
  soulcore: 'special',
  fishing: 'special',
} as const;

/**
 * Generate a stable ID from unique item name.
 */
export function generateUniqueId(name: string, variantId?: string): string {
  const baseId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (variantId) {
    const normalizedVariant = variantId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${baseId}-${normalizedVariant}`;
  }

  return baseId;
}

/**
 * Generate base type ID from base type name.
 */
export function generateBaseTypeId(baseType: string): string {
  return baseType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse a value range from modifier text.
 * Returns { min, max } for ranges like "(10-20)" or { value } for fixed values.
 */
export function parseModifierValue(
  text: string
): { min: number; max: number } | { value: number } | null {
  // Range pattern: (min-max) or (min to max)
  const rangeMatch = text.match(/\((\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    return {
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2]),
    };
  }

  // Fixed value patterns: +N, N%, etc.
  const fixedMatch = text.match(/^[+-]?(\d+(?:\.\d+)?)/);
  if (fixedMatch && fixedMatch[1]) {
    return { value: parseFloat(fixedMatch[1]) };
  }

  return null;
}
