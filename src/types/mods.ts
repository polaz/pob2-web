/**
 * Modifier type definitions.
 *
 * Based on Path of Building's modifier system.
 * These types represent parsed modifier effects used in calculations.
 */

// ============================================================================
// Modifier Flags (bitwise)
// ============================================================================

/**
 * ModFlag - Damage/attack type flags for targeting damage calculations.
 *
 * These flags determine WHAT TYPE OF DAMAGE/ATTACK a modifier applies to.
 * Used to filter modifiers based on the damage source (attack vs spell),
 * delivery method (melee, projectile, area), and weapon type.
 *
 * Note: Some flag names overlap with KeywordFlag (Attack, Spell, Hit, etc.).
 * This is intentional - ModFlag targets damage calculations while KeywordFlag
 * targets skill keywords. A skill can have KeywordFlag.Attack (it's an attack skill)
 * while a modifier uses ModFlag.Attack (applies to attack damage).
 *
 * Uses bigint for 64-bit precision matching Path of Building's Lua implementation.
 */
export const ModFlag = {
  // Damage modes
  Attack: 1n << 0n,
  Spell: 1n << 1n,
  Hit: 1n << 2n,
  Dot: 1n << 3n,
  Cast: 1n << 4n,

  // Damage sources
  Melee: 1n << 5n,
  Area: 1n << 6n,
  Projectile: 1n << 7n,
  Ailment: 1n << 8n,
  Weapon: 1n << 9n,

  // Weapon types
  Axe: 1n << 10n,
  Bow: 1n << 11n,
  Claw: 1n << 12n,
  Dagger: 1n << 13n,
  Mace: 1n << 14n,
  Staff: 1n << 15n,
  Sword: 1n << 16n,
  Wand: 1n << 17n,
  Unarmed: 1n << 18n,
  Fishing: 1n << 19n,

  // Weapon classes
  WeaponMelee: 1n << 20n,
  WeaponRanged: 1n << 21n,
  Weapon1H: 1n << 22n,
  Weapon2H: 1n << 23n,

  // Special
  Minion: 1n << 24n,
  Shield: 1n << 25n,
  Totem: 1n << 26n,
  Trap: 1n << 27n,
  Mine: 1n << 28n,
  Brand: 1n << 29n,
  DualWield: 1n << 30n,
} as const;

export type ModFlagValue = (typeof ModFlag)[keyof typeof ModFlag];

/**
 * KeywordFlag - Skill keyword flags for targeting skill types.
 *
 * These flags determine WHAT TYPE OF SKILL a modifier applies to.
 * Used to filter modifiers based on skill keywords/tags (aura, curse, vaal)
 * and damage types (physical, fire, cold, etc.).
 *
 * Note: Some flag names overlap with ModFlag (Attack, Spell, Hit, Melee, etc.).
 * This is intentional - KeywordFlag identifies skill characteristics while
 * ModFlag targets damage types. Example: "10% increased Attack Speed" uses
 * ModFlag.Attack, while "Supported Attack Skills deal 10% more Damage" uses
 * KeywordFlag.Attack to identify which skills are affected.
 *
 * Uses bigint for 64-bit precision matching Path of Building's Lua implementation.
 */
export const KeywordFlag = {
  Aura: 1n << 0n,
  Curse: 1n << 1n,
  Warcry: 1n << 2n,
  Movement: 1n << 3n,
  Vaal: 1n << 4n,
  Physical: 1n << 5n,
  Fire: 1n << 6n,
  Cold: 1n << 7n,
  Lightning: 1n << 8n,
  Chaos: 1n << 9n,
  Poison: 1n << 10n,
  Bleed: 1n << 11n,
  Ignite: 1n << 12n,
  Minion: 1n << 13n,
  Totem: 1n << 14n,
  Trap: 1n << 15n,
  Mine: 1n << 16n,
  Attack: 1n << 17n,
  Spell: 1n << 18n,
  Hit: 1n << 19n,
  Ailment: 1n << 20n,
  Brand: 1n << 21n,
  Stance: 1n << 22n,
  Channelling: 1n << 23n,
  Bow: 1n << 24n,
  Wand: 1n << 25n,
  Melee: 1n << 26n,
} as const;

export type KeywordFlagValue = (typeof KeywordFlag)[keyof typeof KeywordFlag];

// ============================================================================
// Modifier Types
// ============================================================================

/**
 * How the modifier value is applied to the stat.
 */
export type ModType =
  | 'BASE' // Flat addition: stat += value
  | 'INC' // Increased/reduced: stat *= (1 + sum(inc values))
  | 'MORE' // More/less: stat *= (1 + value) for each
  | 'OVERRIDE' // Override: stat = value (highest wins)
  | 'FLAG' // Boolean flag: enables/disables something
  | 'LIST'; // List append: adds to a list of effects

/**
 * A single stat effect within a modifier.
 */
export interface ModEffect {
  /** Stat name (e.g., "Life", "PhysicalDamage", "CritChance") */
  name: string;

  /** How this effect is applied */
  type: ModType;

  /** Effect value (number for most, can be complex for LIST type) */
  value: number | string | ModEffectListValue;

  /**
   * Damage/attack type flags (0 = applies to all).
   *
   * Supports both number (for JSON compatibility) and bigint (for precision
   * with flags beyond bit 53). When combining ModFlag values with bitwise OR,
   * the result is bigint and should be stored as-is for full precision.
   */
  flags?: number | bigint;

  /**
   * Skill keyword flags (0 = applies to all).
   *
   * Supports both number (for JSON compatibility) and bigint (for precision
   * with flags beyond bit 53). When combining KeywordFlag values with bitwise OR,
   * the result is bigint and should be stored as-is for full precision.
   */
  keywordFlags?: number | bigint;

  /** Optional condition for this effect */
  condition?: ModCondition;

  /** Optional tag data for targeting specific stats */
  tag?: ModTag;
}

/**
 * Complex value for LIST type effects.
 *
 * Note: Index signature allows arbitrary properties because Path of Building's
 * LIST values contain data-driven fields that vary per mod type. We define
 * common fields explicitly but must allow extensibility for external data.
 */
export interface ModEffectListValue {
  key?: string;
  keyword?: string;
  value?: number | string;
  keyOfScaledMod?: string;
  /** Additional data-driven fields from Path of Building */
  [key: string]: unknown;
}

/**
 * Condition that must be met for the modifier to apply.
 */
export interface ModCondition {
  /** Condition type */
  type: 'Condition' | 'PerStat' | 'Multiplier' | 'StatThreshold' | 'SocketedIn';

  /** Variable name for the condition */
  var?: string;

  /** Threshold value (for StatThreshold) */
  threshold?: number;

  /** Stat to check (for PerStat) */
  stat?: string;

  /** Divisor (for PerStat) */
  div?: number;

  /** Negation flag */
  neg?: boolean;
}

/**
 * Tag for targeting specific slots/gems/etc.
 *
 * Note: Index signature allows arbitrary properties because Path of Building's
 * tag system has many specialized fields per tag type. We define common fields
 * explicitly but must allow extensibility for external data.
 */
export interface ModTag {
  type: string;
  slotName?: string;
  keyword?: string;
  /** Additional tag-type-specific fields from Path of Building */
  [key: string]: unknown;
}

// ============================================================================
// Modifier Definition
// ============================================================================

/**
 * A complete modifier definition as stored in the mod database.
 */
export interface ModDefinition {
  /** The modifier text as it appears on items/passives */
  text: string;

  /** Parsed stat effects (null if unparseable or display-only) */
  effects: ModEffect[] | null;

  /** Display text (may differ from text for formatting) */
  displayText?: string;
}

/**
 * Modifier source - where a modifier comes from.
 */
export type ModSource =
  | 'item'
  | 'passive'
  | 'gem'
  | 'jewel'
  | 'flask'
  | 'aura'
  | 'curse'
  | 'config'
  | 'enchant'
  | 'corruption'
  | 'crafted';

/**
 * An active modifier instance in a build.
 */
export interface Modifier {
  /** Reference to the definition */
  definition: ModDefinition;

  /** Where this modifier comes from */
  source: ModSource;

  /** Source identifier (item ID, node ID, etc.) */
  sourceId: string;

  /** Resolved numeric value (after rolling/scaling) */
  value?: number;

  /** Whether this modifier is currently active */
  enabled: boolean;
}

// ============================================================================
// Mod Cache Structure (matches JSON output)
// ============================================================================

/**
 * The complete mod cache as loaded from JSON.
 */
export interface ModCache {
  /** Version of the mod cache */
  version: string;

  /** Source (e.g., "PathOfBuilding-PoE2") */
  source: string;

  /** Git branch the cache was generated from */
  branch?: string;

  /** Generation timestamp */
  generatedAt: string;

  /** Total number of mods */
  count: number;

  /** Aggregate statistics about cache contents */
  stats?: {
    /** Number of mods with parsed effects */
    withEffects: number;
    /** Number of mods that are display-only (no effects parsed) */
    displayOnly: number;
    /** Number of mods that failed to parse */
    failed: number;
  };

  /** Mod definitions keyed by text */
  mods: Record<string, ModDefinition>;
}
