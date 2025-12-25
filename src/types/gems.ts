// src/types/gems.ts
// Types for PoE2 skill and support gem data
// Source: PathOfBuildingCommunity/PathOfBuilding-PoE2

/**
 * Gem type categories matching PoB2 data
 */
export type GemType =
  | 'Spell'
  | 'Attack'
  | 'Support'
  | 'Minion'
  | 'Buff'
  | 'Mark'
  | 'Warcry';

/**
 * Attribute requirement distribution (0-100 for each)
 */
export interface GemRequirements {
  str: number;
  dex: number;
  int: number;
}

/**
 * Tag flags indicating gem capabilities
 */
export interface GemTags {
  // Attribute flags
  strength?: boolean;
  dexterity?: boolean;
  intelligence?: boolean;

  // Damage types
  fire?: boolean;
  cold?: boolean;
  lightning?: boolean;
  physical?: boolean;
  chaos?: boolean;

  // Skill categories
  spell?: boolean;
  attack?: boolean;
  melee?: boolean;
  projectile?: boolean;
  area?: boolean;
  duration?: boolean;
  channelling?: boolean;

  // Special types
  minion?: boolean;
  totem?: boolean;
  trap?: boolean;
  mine?: boolean;
  aura?: boolean;
  herald?: boolean;
  warcry?: boolean;
  movement?: boolean;
  travel?: boolean;
  guard?: boolean;
  link?: boolean;
  mark?: boolean;
  curse?: boolean;
  hex?: boolean;

  // Mechanics
  grants_active_skill?: boolean;
  support?: boolean;
  sustained?: boolean;
  storm?: boolean;
  trigger?: boolean;
  vaal?: boolean;
  critical?: boolean;
  chaining?: boolean;
  slam?: boolean;
  strike?: boolean;
  orb?: boolean;
  brand?: boolean;

  // Extensible - allow any string key for future tags
  [key: string]: boolean | undefined;
}

/**
 * Raw gem data as stored in JSON (from Lua conversion)
 */
export interface RawGem {
  /** Display name */
  name: string;

  /** Base type name (usually same as name) */
  baseTypeName?: string;

  /** Unique game identifier path */
  gameId: string;

  /** Variant identifier for alternate versions */
  variantId: string;

  /** Granted effect ID for skill activation */
  grantedEffectId?: string;

  /** Gem type category */
  gemType: GemType;

  /** Comma-separated tag string for display */
  tagString?: string;

  /** Boolean tag flags */
  tags: GemTags;

  /** Strength requirement (0-100) */
  reqStr: number;

  /** Dexterity requirement (0-100) */
  reqDex: number;

  /** Intelligence requirement (0-100) */
  reqInt: number;

  /** Progression tier (1-20) */
  Tier: number;

  /** Maximum gem level (20 for skills, 1 for supports) */
  naturalMaxLevel: number;

  /** Weapon type restrictions (comma-separated) */
  weaponRequirements?: string;

  /** Support gem family grouping */
  gemFamily?: string;

  /** Additional stat set IDs for infusions */
  additionalStatSet1?: string;
  additionalStatSet2?: string;
  additionalStatSet3?: string;

  /** Additional granted effect IDs */
  additionalGrantedEffectId1?: string;
  additionalGrantedEffectId2?: string;

  /**
   * Manual edit flag - if true, this entry was manually added
   * and should be preserved during data merges
   */
  _manual?: boolean;

  /**
   * Field-level manual edit markers
   * Format: _manual_{fieldName} = true
   * Fields with these markers are preserved during merges
   */
  [key: `_manual_${string}`]: boolean | undefined;
}

/**
 * Optimized gem data for runtime operations
 */
export interface Gem {
  /** Unique identifier (from variantId or derived from path) */
  id: string;

  /** Display name */
  name: string;

  /** Gem type category */
  type: GemType;

  /** Whether this is a support gem */
  isSupport: boolean;

  /** Tag flags for filtering */
  tags: GemTags;

  /** Attribute requirements */
  requirements: GemRequirements;

  /** Progression tier */
  tier: number;

  /** Maximum gem level */
  maxLevel: number;

  /** Weapon type restrictions (parsed array) */
  weaponTypes?: string[];

  /** Support gem family */
  family?: string;

  /** Granted effect ID */
  effectId?: string;

  /** Additional effect IDs */
  additionalEffects?: string[];

  /** Original metadata path for reference */
  metadataPath: string;
}

/**
 * Gem data metadata
 */
export interface GemsMeta {
  totalGems: number;
  skillGems: number;
  supportGems: number;
  spellGems: number;
  attackGems: number;
  minionGems: number;
  buffGems: number;
  markGems: number;
  warcryGems: number;
}

/**
 * Complete raw gems data structure from JSON file
 */
export interface RawGemsData {
  version: string;
  extractedAt: string;
  source: string;
  meta: GemsMeta;
  gems: Record<string, RawGem>;
}

/**
 * Optimized gems data for runtime operations
 */
export interface GemsData {
  version: string;
  extractedAt: Date;
  source: string;
  meta: GemsMeta;
  gems: Map<string, Gem>;
  /** Index by name for search */
  byName: Map<string, Gem>;
  /** Index by type for filtering */
  byType: Map<GemType, Gem[]>;
}
