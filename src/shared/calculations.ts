// src/shared/calculations.ts
// Stat aggregation formulas
// These formulas match PoB CE calculations

import { type Modifier, ModType, StatFlag, KeywordFlag } from './modifiers';
import { CRIT_CONSTANTS, DEFENCE_CONSTANTS } from './constants';

/**
 * Result of stat aggregation
 */
export interface StatValue {
  /** Final calculated value */
  value: number;
  /** Breakdown of how the value was calculated */
  breakdown?: StatBreakdown | undefined;
}

/**
 * Breakdown of stat calculation for UI display
 */
export interface StatBreakdown {
  base: number;
  increased: number; // Total % increased
  more: number; // Total % more (multiplicative)
  sources: StatSource[];
}

/**
 * A single source contributing to a stat
 */
export interface StatSource {
  label: string;
  value: number;
  type: ModType;
}

/**
 * Aggregate modifiers for a stat using PoB formula:
 * Final = Base * (1 + sum(increased)/100) * product(1 + more/100)
 *
 * @param modifiers - Array of modifiers affecting this stat
 * @param flags - Optional stat flags to filter modifiers
 * @param keywords - Optional keyword flags to filter modifiers
 * @returns The calculated stat value with optional breakdown
 */
export function aggregateStat(
  modifiers: Modifier[],
  flags: StatFlag = StatFlag.NONE,
  keywords: KeywordFlag = KeywordFlag.NONE,
  includeBreakdown = false
): StatValue {
  let base = 0;
  let increased = 0;
  let more = 1;
  const sources: StatSource[] = [];

  for (const mod of modifiers) {
    // Check if mod flags match required flags
    if (mod.flags !== undefined && flags !== StatFlag.NONE) {
      if ((mod.flags & flags) !== (flags as number)) continue;
    }

    // Check if mod keywords match required keywords
    if (mod.keywords !== undefined && keywords !== KeywordFlag.NONE) {
      if ((mod.keywords & keywords) !== (keywords as number)) continue;
    }

    switch (mod.type) {
      case ModType.BASE:
        base += mod.value;
        if (includeBreakdown) {
          sources.push({
            label: mod.sourceLabel || 'Base',
            value: mod.value,
            type: ModType.BASE,
          });
        }
        break;

      case ModType.INC:
        increased += mod.value;
        if (includeBreakdown) {
          sources.push({
            label: mod.sourceLabel || 'Increased',
            value: mod.value,
            type: ModType.INC,
          });
        }
        break;

      case ModType.MORE:
        more *= 1 + mod.value / 100;
        if (includeBreakdown) {
          sources.push({
            label: mod.sourceLabel || 'More',
            value: mod.value,
            type: ModType.MORE,
          });
        }
        break;

      case ModType.TOTAL:
        // Total override - use this value directly
        return {
          value: mod.value,
          breakdown: includeBreakdown
            ? {
                base: mod.value,
                increased: 0,
                more: 0,
                sources: [
                  { label: 'Total Override', value: mod.value, type: ModType.TOTAL },
                ],
              }
            : undefined,
        };

      case ModType.FLAG:
        // Flags are handled separately, not aggregated
        break;
    }
  }

  const value = base * (1 + increased / 100) * more;

  return {
    value,
    breakdown: includeBreakdown
      ? {
          base,
          increased,
          more: (more - 1) * 100, // Convert back to percentage
          sources,
        }
      : undefined,
  };
}

/**
 * Calculate effective crit chance
 *
 * @param baseCrit - Base crit chance from weapon/skill
 * @param increasedCrit - Sum of increased critical strike chance
 * @param additionalCrit - Flat added crit chance (e.g., from power charges)
 * @returns Effective crit chance (capped at 100%)
 */
export function calculateCritChance(
  baseCrit: number,
  increasedCrit: number,
  additionalCrit = 0
): number {
  const critChance = baseCrit * (1 + increasedCrit / 100) + additionalCrit;
  return Math.min(
    CRIT_CONSTANTS.MAX_CRIT_CHANCE,
    Math.max(CRIT_CONSTANTS.MIN_CRIT_CHANCE, critChance)
  );
}

/**
 * Calculate effective crit multiplier
 *
 * @param additionalMulti - Sum of additional crit multiplier
 * @returns Total crit multiplier
 */
export function calculateCritMulti(additionalMulti: number): number {
  return CRIT_CONSTANTS.BASE_CRIT_MULTI + additionalMulti;
}

/**
 * Calculate armour damage reduction
 * Formula: DR = Armour / (Armour + 5 * Damage)
 *
 * @param armour - Character's armour value
 * @param damage - Incoming physical damage
 * @returns Damage reduction percentage (0-90)
 */
export function calculateArmourDR(armour: number, damage: number): number {
  if (damage <= 0 || armour <= 0) return 0;
  const dr = (armour / (armour + DEFENCE_CONSTANTS.ARMOUR_CONSTANT * damage)) * 100;
  return Math.min(90, dr); // Armour caps at 90% reduction
}

/**
 * Calculate evasion chance
 * Formula: Evasion / (Evasion + (Accuracy^0.8))
 *
 * @param evasion - Character's evasion rating
 * @param accuracy - Attacker's accuracy
 * @returns Chance to evade (0-95%)
 */
export function calculateEvasionChance(evasion: number, accuracy: number): number {
  if (accuracy <= 0 || evasion <= 0) return 0;
  const evadeChance = (evasion / (evasion + Math.pow(accuracy, 0.8))) * 100;
  return Math.min(95, Math.max(5, evadeChance)); // Evasion is 5-95%
}

/**
 * Calculate hit chance
 *
 * @param accuracy - Character's accuracy rating
 * @param evasion - Target's evasion rating
 * @returns Hit chance percentage (5-100%)
 */
export function calculateHitChance(accuracy: number, evasion: number): number {
  if (evasion <= 0) return 100;
  if (accuracy <= 0) return 5;
  const hitChance = (accuracy / (accuracy + Math.pow(evasion, 0.8))) * 100;
  return Math.min(100, Math.max(5, hitChance)); // Hit chance is 5-100%
}

/**
 * Calculate final damage after resistance
 *
 * @param damage - Incoming damage
 * @param resistance - Resistance to that damage type (can be negative)
 * @returns Final damage after resistance
 */
export function calculateDamageAfterResistance(
  damage: number,
  resistance: number
): number {
  return damage * (1 - resistance / 100);
}

/**
 * Calculate DPS
 *
 * @param damagePerHit - Average damage per hit
 * @param hitsPerSecond - Number of hits per second (attack/cast speed)
 * @param hitChance - Hit chance as percentage
 * @param critChance - Crit chance as percentage
 * @param critMulti - Crit multiplier as percentage
 * @returns DPS value
 */
export function calculateDPS(
  damagePerHit: number,
  hitsPerSecond: number,
  hitChance: number,
  critChance: number,
  critMulti: number
): number {
  const effectiveHitChance = hitChance / 100;
  const effectiveCritChance = critChance / 100;
  const effectiveCritMulti = critMulti / 100;

  // Average damage including crits
  const avgDamage =
    damagePerHit *
    (1 - effectiveCritChance + effectiveCritChance * effectiveCritMulti);

  return avgDamage * hitsPerSecond * effectiveHitChance;
}

/**
 * Calculate damage range (min-max) from average
 *
 * @param averageDamage - Average damage
 * @param variance - Variance percentage (default 20% for PoE)
 * @returns Object with min and max damage
 */
export function calculateDamageRange(
  averageDamage: number,
  variance = 20
): { min: number; max: number } {
  const varianceFactor = variance / 100;
  return {
    min: averageDamage * (1 - varianceFactor),
    max: averageDamage * (1 + varianceFactor),
  };
}

/**
 * Round a stat value for display
 * Uses PoB-style rounding: 0 decimals for large numbers, more for small
 *
 * @param value - Value to round
 * @returns Rounded value
 */
export function roundStat(value: number): number {
  if (Math.abs(value) >= 1000) {
    return Math.round(value);
  } else if (Math.abs(value) >= 100) {
    return Math.round(value * 10) / 10;
  } else if (Math.abs(value) >= 10) {
    return Math.round(value * 100) / 100;
  } else {
    return Math.round(value * 1000) / 1000;
  }
}

/**
 * Format a large number with K/M suffix
 *
 * @param value - Value to format
 * @returns Formatted string
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  } else if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  return roundStat(value).toString();
}
