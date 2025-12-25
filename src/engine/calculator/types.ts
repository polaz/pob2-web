/**
 * Types for the calculation engine.
 *
 * These types define the interfaces for stat resolution, damage conversion,
 * and calculation breakdowns.
 */

import type { ModDB } from '../modifiers/ModDB';

// ============================================================================
// Attribute Types
// ============================================================================

/**
 * Character attributes (Strength, Dexterity, Intelligence).
 */
export interface AttributeValues {
  str: number;
  dex: number;
  int: number;
}

// ============================================================================
// Stat Resolution Types
// ============================================================================

/**
 * Configuration for stat resolution.
 */
export interface StatResolverConfig {
  /** Current character level */
  level: number;

  /** Current attribute values */
  attributes: AttributeValues;

  /** Active conditions (e.g., LowLife, Onslaught) */
  conditions: Record<string, boolean>;

  /** Current stat values for PerStat conditions */
  stats: Record<string, number>;

  /** Damage/attack type flags for filtering */
  flags?: bigint;

  /** Skill keyword flags for filtering */
  keywordFlags?: bigint;
}

/**
 * A single source contributing to a stat.
 */
export interface StatSource {
  /** Human-readable label (e.g., "Passive Tree", "Body Armour") */
  label: string;

  /** Value contributed by this source */
  value: number;

  /** Modifier type (BASE, INC, MORE) */
  type: 'BASE' | 'INC' | 'MORE';

  /** Source identifier for tracing */
  sourceId?: string;
}

/**
 * Breakdown of how a stat was calculated.
 */
export interface StatBreakdown {
  /** Sum of all BASE values */
  base: number;

  /** Total % increased (sum of INC values) */
  increased: number;

  /** Combined MORE multiplier */
  more: number;

  /** Individual sources contributing to the stat */
  sources: StatSource[];

  /** Conversion steps if this stat had damage converted to it */
  conversions?: ConversionStep[];
}

/**
 * Result of resolving a stat.
 */
export interface ResolvedStat {
  /** Final calculated value */
  value: number;

  /** Breakdown of how the value was calculated */
  breakdown: StatBreakdown;
}

// ============================================================================
// Damage Conversion Types
// ============================================================================

/**
 * Damage types for conversion handling.
 */
export type DamageType = 'Physical' | 'Fire' | 'Cold' | 'Lightning' | 'Chaos';

/**
 * All damage types in conversion order.
 * Physical → Lightning → Cold → Fire → Chaos
 */
export const DAMAGE_TYPE_ORDER: readonly DamageType[] = [
  'Physical',
  'Lightning',
  'Cold',
  'Fire',
  'Chaos',
] as const;

/**
 * A step in the damage conversion chain.
 */
export interface ConversionStep {
  /** Source damage type */
  from: DamageType;

  /** Target damage type */
  to: DamageType;

  /** Conversion percentage (0-1) */
  percent: number;

  /** Amount of damage converted */
  amount: number;
}

/**
 * Configuration for damage conversion.
 */
export interface ConversionConfig {
  /** Conversion percentages from each type to each other type */
  conversions: ConversionMatrix;

  /** "Gain as extra" percentages */
  gainAsExtra: ConversionMatrix;
}

/**
 * Matrix of conversion percentages.
 * conversionMatrix[from][to] = percentage (0-1)
 */
export type ConversionMatrix = Record<DamageType, Partial<Record<DamageType, number>>>;

/**
 * Result of applying damage conversions.
 */
export interface ConversionResult {
  /** Final damage amounts per type */
  damage: Record<DamageType, number>;

  /** Conversion steps applied */
  steps: ConversionStep[];
}

// ============================================================================
// Stat Dependency Types
// ============================================================================

/**
 * Definition of a stat dependency.
 *
 * Example: Life depends on Strength (0.5 life per Str)
 */
export interface StatDependency {
  /** Stat that provides the bonus */
  sourceStat: string;

  /** Stat that receives the bonus */
  targetStat: string;

  /** Type of bonus (BASE or INC) */
  bonusType: 'BASE' | 'INC';

  /** Multiplier to apply (e.g., 0.5 for "0.5 life per Str") */
  multiplier: number;

  /** Optional divisor (e.g., 10 for "per 10 Str") */
  divisor?: number;
}

/**
 * Built-in stat dependencies from game mechanics.
 */
export const STAT_DEPENDENCIES: readonly StatDependency[] = [
  // Strength bonuses
  { sourceStat: 'Str', targetStat: 'Life', bonusType: 'BASE', multiplier: 0.5 },
  { sourceStat: 'Str', targetStat: 'MeleeDamage', bonusType: 'INC', multiplier: 0.002 }, // 0.2% per Str

  // Dexterity bonuses
  { sourceStat: 'Dex', targetStat: 'Accuracy', bonusType: 'BASE', multiplier: 2 },
  { sourceStat: 'Dex', targetStat: 'Evasion', bonusType: 'INC', multiplier: 0.002 }, // 0.2% per Dex

  // Intelligence bonuses
  { sourceStat: 'Int', targetStat: 'Mana', bonusType: 'BASE', multiplier: 0.5 },
  { sourceStat: 'Int', targetStat: 'EnergyShield', bonusType: 'INC', multiplier: 0.002 }, // 0.2% per Int
] as const;

// ============================================================================
// Options Types
// ============================================================================

/**
 * Options for creating a StatResolver.
 */
export interface StatResolverOptions {
  /** ModDB to query for modifiers */
  modDB: ModDB;

  /** Configuration for stat resolution */
  config: StatResolverConfig;

  /** Whether to include detailed breakdowns (default: true) */
  includeBreakdown?: boolean;
}
