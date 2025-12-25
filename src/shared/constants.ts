// src/shared/constants.ts
// Game constants for Path of Exile 2
// These values are from game data and should match PoB CE

/**
 * Base character stats at level 1
 */
export const BASE_STATS = {
  LIFE: 38,
  MANA: 34,
  LIFE_PER_LEVEL: 12,
  MANA_PER_LEVEL: 6,
  LIFE_PER_STR: 0.5,
  MANA_PER_INT: 0.5,
  ACCURACY_PER_DEX: 2,
  EVASION_PER_DEX: 0.2,
} as const;

/**
 * Attribute requirements per point
 */
export const ATTRIBUTE_EFFECTS = {
  STR_TO_LIFE: 0.5, // +0.5 life per strength
  STR_TO_MELEE_DAMAGE: 0.2, // +0.2% melee physical damage per strength
  DEX_TO_ACCURACY: 2, // +2 accuracy per dexterity
  DEX_TO_EVASION: 0.2, // +0.2% evasion per dexterity
  INT_TO_MANA: 0.5, // +0.5 mana per intelligence
  INT_TO_ES: 0.2, // +0.2% energy shield per intelligence
} as const;

/**
 * Critical strike constants
 */
export const CRIT_CONSTANTS = {
  BASE_CRIT_MULTI: 150, // Base critical strike multiplier (%)
  MIN_CRIT_CHANCE: 5, // Minimum crit chance (%)
  MAX_CRIT_CHANCE: 100, // Maximum crit chance (%)
} as const;

/**
 * Defence constants
 */
export const DEFENCE_CONSTANTS = {
  // Armour formula constants
  ARMOUR_CONSTANT: 5, // Used in armour formula

  // Evasion formula constants
  EVASION_CONSTANT: 0.25,

  // Block constants
  MAX_BLOCK_CHANCE: 75, // Maximum block chance (%)
  MAX_SPELL_BLOCK: 75, // Maximum spell block chance (%)

  // Dodge/Suppression constants (PoE2)
  MAX_SPELL_SUPPRESSION: 100, // Maximum spell suppression (%)
  SUPPRESSION_DAMAGE_REDUCTION: 50, // Damage reduction when suppressing (%)
} as const;

/**
 * Charge constants
 */
export const CHARGE_CONSTANTS = {
  // Power charges
  POWER_CHARGE_CRIT: 40, // +40% crit chance per power charge
  DEFAULT_POWER_CHARGES: 3, // Default max power charges

  // Frenzy charges
  FRENZY_CHARGE_ATTACK_SPEED: 4, // +4% attack speed per frenzy charge
  FRENZY_CHARGE_CAST_SPEED: 4, // +4% cast speed per frenzy charge
  FRENZY_CHARGE_DAMAGE: 4, // +4% more damage per frenzy charge
  DEFAULT_FRENZY_CHARGES: 3, // Default max frenzy charges

  // Endurance charges
  ENDURANCE_CHARGE_PHYS_DR: 4, // +4% physical damage reduction per endurance charge
  ENDURANCE_CHARGE_RESIST: 4, // +4% elemental resistances per endurance charge
  DEFAULT_ENDURANCE_CHARGES: 3, // Default max endurance charges
} as const;

/**
 * Resistance constants
 */
export const RESISTANCE_CONSTANTS = {
  DEFAULT_RES_CAP: 75, // Default resistance cap (%)
  MAX_RES_CAP: 90, // Maximum resistance cap (%)
  CHAOS_RES_DEFAULT: 0, // Default chaos resistance (%)
} as const;

/**
 * Ailment thresholds and durations
 */
export const AILMENT_CONSTANTS = {
  // Freeze
  FREEZE_THRESHOLD: 5, // Freeze threshold (% of max life)
  FREEZE_MIN_DURATION: 0.3, // Minimum freeze duration (seconds)
  FREEZE_MAX_DURATION: 3, // Maximum freeze duration (seconds)

  // Chill
  CHILL_MIN_EFFECT: 5, // Minimum chill effect (%)
  CHILL_MAX_EFFECT: 30, // Maximum chill effect (%)
  CHILL_DURATION: 2, // Base chill duration (seconds)

  // Shock
  SHOCK_MIN_EFFECT: 5, // Minimum shock effect (%)
  SHOCK_MAX_EFFECT: 50, // Maximum shock effect (%)
  SHOCK_DURATION: 2, // Base shock duration (seconds)

  // Ignite
  IGNITE_DAMAGE_RATIO: 0.9, // Ignite deals 90% of base fire damage over 4 seconds
  IGNITE_DURATION: 4, // Base ignite duration (seconds)

  // Bleed
  BLEED_DAMAGE_RATIO: 0.7, // Bleed deals 70% of base physical damage over 5 seconds
  BLEED_DURATION: 5, // Base bleed duration (seconds)
  BLEED_MOVING_MULTI: 1.5, // 50% more bleed damage while moving

  // Poison
  POISON_DAMAGE_RATIO: 0.3, // Poison deals 30% of base chaos + physical damage over 2 seconds
  POISON_DURATION: 2, // Base poison duration (seconds)
} as const;

/**
 * Level-related constants
 */
export const LEVEL_CONSTANTS = {
  MAX_CHARACTER_LEVEL: 100,
  MAX_GEM_LEVEL: 21,
  MAX_GEM_QUALITY: 23, // With anomalous/divergent/phantasmal
} as const;

/**
 * Item-related constants
 */
export const ITEM_CONSTANTS = {
  MAX_ITEM_LEVEL: 100,
  MAX_QUALITY: 30, // With perfect fossil
  MAX_SOCKETS: 6, // PoE1 style (PoE2 uses runes)
} as const;

/**
 * Passive tree constants
 */
export const TREE_CONSTANTS = {
  MAX_PASSIVE_POINTS: 123, // Maximum passive skill points
  MAX_ASCENDANCY_POINTS: 8, // Maximum ascendancy points
  BANDIT_PASSIVE_POINTS: 2, // Points from helping all bandits (PoE1)
} as const;

/**
 * Time constants
 */
export const TIME_CONSTANTS = {
  RECENTLY_DURATION: 4, // "Recently" means within 4 seconds
  SERVER_TICK_RATE: 33.33, // Server tick rate in ms (30 ticks per second)
} as const;

/**
 * Boss-related constants
 */
export const BOSS_CONSTANTS = {
  /** Curse effect reduction on boss enemies (33% less curse effect) */
  CURSE_EFFECT_REDUCTION: -0.33,
} as const;

/**
 * Class starting attributes (PoE2)
 */
export const CLASS_STARTING_STATS: Record<
  string,
  { str: number; dex: number; int: number }
> = {
  WARRIOR: { str: 24, dex: 14, int: 14 },
  MONK: { str: 14, dex: 20, int: 18 },
  SORCERESS: { str: 14, dex: 14, int: 24 },
  MERCENARY: { str: 14, dex: 24, int: 14 },
  HUNTRESS: { str: 14, dex: 24, int: 14 },
  DRUID: { str: 20, dex: 14, int: 18 },
  // PoE1 classes for compatibility
  MARAUDER: { str: 32, dex: 14, int: 14 },
  RANGER: { str: 14, dex: 32, int: 14 },
  WITCH: { str: 14, dex: 14, int: 32 },
  DUELIST: { str: 23, dex: 23, int: 14 },
  TEMPLAR: { str: 23, dex: 14, int: 23 },
  SHADOW: { str: 14, dex: 23, int: 23 },
  SCION: { str: 20, dex: 20, int: 20 },
} as const;
