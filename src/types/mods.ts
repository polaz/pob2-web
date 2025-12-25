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
 * ModFlag - Damage/attack type flags (64-bit in PoB, we use bigint or split)
 * These determine what type of damage/attack a modifier applies to.
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
} as const;

export type ModFlagValue = (typeof ModFlag)[keyof typeof ModFlag];

/**
 * KeywordFlag - Skill keyword flags
 * These determine what type of skill a modifier applies to.
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

  /** Damage/attack type flags (0 = applies to all) */
  flags?: number;

  /** Skill keyword flags (0 = applies to all) */
  keywordFlags?: number;

  /** Optional condition for this effect */
  condition?: ModCondition;

  /** Optional tag data for targeting specific stats */
  tag?: ModTag;
}

/**
 * Complex value for LIST type effects.
 */
export interface ModEffectListValue {
  key?: string;
  keyword?: string;
  value?: number | string;
  keyOfScaledMod?: string;
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
 */
export interface ModTag {
  type: string;
  slotName?: string;
  keyword?: string;
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

  /** Generation timestamp */
  generatedAt: string;

  /** Total number of mods */
  count: number;

  /** Mod definitions keyed by text */
  mods: Record<string, ModDefinition>;
}
