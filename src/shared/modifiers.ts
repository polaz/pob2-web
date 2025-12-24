// src/shared/modifiers.ts
// Modifier system types for calculation logic
// These are NOT proto types - they're pure TypeScript for computation

/**
 * Modifier types that determine how a mod affects stats
 */
export enum ModType {
  BASE = 'BASE',
  INC = 'INC', // Increased/Reduced (additive percentage)
  MORE = 'MORE', // More/Less (multiplicative percentage)
  TOTAL = 'TOTAL', // Direct total override
  FLAG = 'FLAG', // Boolean flags (e.g., "Cannot be stunned")
  OVERRIDE = 'OVERRIDE', // Override other mods
}

/**
 * Stat flags for categorizing damage and effects
 * Uses bitwise flags for efficient combination checking
 */
export enum StatFlag {
  NONE = 0,

  // Damage types
  ATTACK = 1 << 0,
  SPELL = 1 << 1,
  MELEE = 1 << 2,
  RANGED = 1 << 3,
  PROJECTILE = 1 << 4,
  AREA = 1 << 5,
  CHAINING = 1 << 6,
  TOTEM = 1 << 7,
  MINION = 1 << 8,
  TRAP = 1 << 9,
  MINE = 1 << 10,
  DOT = 1 << 11, // Damage over time
  BRAND = 1 << 12,

  // Weapon types
  SWORD = 1 << 13,
  AXE = 1 << 14,
  MACE = 1 << 15,
  BOW = 1 << 16,
  CROSSBOW = 1 << 17,
  STAFF = 1 << 18,
  WAND = 1 << 19,
  DAGGER = 1 << 20,
  CLAW = 1 << 21,
  QUARTERSTAFF = 1 << 22,
  SPEAR = 1 << 23,
  FLAIL = 1 << 24,

  // Hand configuration
  DUAL_WIELD = 1 << 25,
  TWO_HANDED = 1 << 26,
  SHIELD = 1 << 27,
}

/**
 * Keyword flags for skill tags and mod conditions
 */
export enum KeywordFlag {
  NONE = 0,

  // Element keywords
  FIRE = 1 << 0,
  COLD = 1 << 1,
  LIGHTNING = 1 << 2,
  CHAOS = 1 << 3,
  PHYSICAL = 1 << 4,

  // Ailment keywords
  IGNITE = 1 << 5,
  SHOCK = 1 << 6,
  CHILL = 1 << 7,
  FREEZE = 1 << 8,
  POISON = 1 << 9,
  BLEED = 1 << 10,

  // Skill keywords
  AURA = 1 << 11,
  CURSE = 1 << 12,
  WARCRY = 1 << 13,
  HERALD = 1 << 14,
  MOVEMENT = 1 << 15,
  VAAL = 1 << 16,
  CHANNELLING = 1 << 17,
  TRIGGER = 1 << 18,
  DURATION = 1 << 19,
  GUARD = 1 << 20,
  LINK = 1 << 21, // PoE2 link skills
  PERSISTENT = 1 << 22, // PoE2 persistent buff skills
}

/**
 * Damage types enum (not bitwise, mutually exclusive for base damage)
 */
export enum DamageType {
  PHYSICAL = 'PHYSICAL',
  FIRE = 'FIRE',
  COLD = 'COLD',
  LIGHTNING = 'LIGHTNING',
  CHAOS = 'CHAOS',
}

/**
 * All damage types as array for iteration
 */
export const ALL_DAMAGE_TYPES: DamageType[] = [
  DamageType.PHYSICAL,
  DamageType.FIRE,
  DamageType.COLD,
  DamageType.LIGHTNING,
  DamageType.CHAOS,
];

/**
 * Elemental damage types (excludes physical and chaos)
 */
export const ELEMENTAL_DAMAGE_TYPES: DamageType[] = [
  DamageType.FIRE,
  DamageType.COLD,
  DamageType.LIGHTNING,
];

/**
 * Source of a modifier (for tracking and debugging)
 */
export enum ModSource {
  TREE = 'TREE', // Passive tree node
  ITEM = 'ITEM', // Equipped item
  GEM = 'GEM', // Active or support gem
  CONFIG = 'CONFIG', // Build configuration
  BUFF = 'BUFF', // Active buff
  ASCENDANCY = 'ASCENDANCY', // Ascendancy notable
  MASTERY = 'MASTERY', // Mastery effect
}

/**
 * A single modifier that affects a stat
 */
export interface Modifier {
  /** The stat this modifier affects (e.g., "Damage", "Life", "CritChance") */
  stat: string;

  /** How this modifier applies (BASE, INC, MORE, etc.) */
  type: ModType;

  /** The value of the modifier */
  value: number;

  /** Bitwise flags for stat categories this applies to */
  flags?: StatFlag;

  /** Bitwise keyword flags for conditions */
  keywords?: KeywordFlag;

  /** Source of this modifier */
  source?: ModSource;

  /** Human-readable source description (e.g., "Weapon 1", "Ring 1") */
  sourceLabel?: string;

  /** Optional condition for this modifier */
  condition?: ModifierCondition;
}

/**
 * Condition for a modifier to apply
 */
export interface ModifierCondition {
  /** Type of condition */
  type: ConditionType;

  /** Threshold value if applicable */
  threshold?: number;

  /** Stat to check if applicable */
  stat?: string;
}

/**
 * Types of conditions for modifier application
 */
export enum ConditionType {
  ALWAYS = 'ALWAYS', // Always applies
  WHILE_LEECHING = 'WHILE_LEECHING',
  ON_LOW_LIFE = 'ON_LOW_LIFE', // <35% life
  ON_FULL_LIFE = 'ON_FULL_LIFE', // 100% life
  ON_LOW_MANA = 'ON_LOW_MANA', // <35% mana
  ON_FULL_MANA = 'ON_FULL_MANA', // 100% mana
  ENEMY_CHILLED = 'ENEMY_CHILLED',
  ENEMY_FROZEN = 'ENEMY_FROZEN',
  ENEMY_SHOCKED = 'ENEMY_SHOCKED',
  ENEMY_IGNITED = 'ENEMY_IGNITED',
  ENEMY_POISONED = 'ENEMY_POISONED',
  ENEMY_BLEEDING = 'ENEMY_BLEEDING',
  RECENTLY_KILLED = 'RECENTLY_KILLED', // Killed recently (4 seconds)
  RECENTLY_BEEN_HIT = 'RECENTLY_BEEN_HIT', // Been hit recently (4 seconds)
  HAVE_POWER_CHARGES = 'HAVE_POWER_CHARGES',
  HAVE_FRENZY_CHARGES = 'HAVE_FRENZY_CHARGES',
  HAVE_ENDURANCE_CHARGES = 'HAVE_ENDURANCE_CHARGES',
}

/**
 * Helper function to check if flags match
 */
export function flagsMatch(
  modFlags: StatFlag | undefined,
  requiredFlags: StatFlag
): boolean {
  if (modFlags === undefined) return true; // No flags = applies to all
  if (requiredFlags === StatFlag.NONE) return true;
  return (modFlags & requiredFlags) === (requiredFlags as number);
}

/**
 * Helper function to check if keywords match
 */
export function keywordsMatch(
  modKeywords: KeywordFlag | undefined,
  requiredKeywords: KeywordFlag
): boolean {
  if (modKeywords === undefined) return true; // No keywords = applies to all
  if (requiredKeywords === KeywordFlag.NONE) return true;
  return (modKeywords & requiredKeywords) === (requiredKeywords as number);
}
