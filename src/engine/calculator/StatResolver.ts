/**
 * StatResolver - High-Level Stat Aggregation System
 *
 * Provides higher-level stat resolution on top of ModDB, handling:
 * - Stat dependencies (e.g., Str → Life bonus)
 * - Damage type conversions
 * - Conditional modifiers based on config
 * - Detailed breakdowns for UI display
 *
 * ## Usage
 *
 * ```typescript
 * const resolver = new StatResolver({
 *   modDB,
 *   config: {
 *     level: 90,
 *     attributes: { str: 200, dex: 100, int: 50 },
 *     conditions: { LowLife: false, Onslaught: true },
 *     stats: {},
 *   },
 * });
 *
 * const life = resolver.resolve('Life');
 * console.log(life.value);           // 4500
 * console.log(life.breakdown.base);  // 1000
 * console.log(life.breakdown.increased); // 150 (%)
 * ```
 *
 * ## Aggregation Order
 *
 * 1. Collect BASE values (sum)
 * 2. Apply attribute bonuses as BASE
 * 3. Collect INC values (sum percentages)
 * 4. Apply attribute bonuses as INC
 * 5. Collect MORE values (multiply)
 * 6. Final: base * (1 + inc) * more
 */

import type { ModDB } from '../modifiers/ModDB';
import type { CalcConfig } from '../modifiers/types';
import {
  type AttributeValues,
  type StatResolverConfig,
  type StatResolverOptions,
  type ResolvedStat,
  type StatSource,
  STAT_DEPENDENCIES,
} from './types';

// ============================================================================
// StatResolver Class
// ============================================================================

/**
 * High-level stat resolver that handles dependencies and conversions.
 */
export class StatResolver {
  private readonly modDB: ModDB;
  private readonly config: StatResolverConfig;
  private readonly includeBreakdown: boolean;

  /** Cached resolved stats for circular dependency detection */
  private readonly resolving: Set<string> = new Set();

  /** Cached resolved values */
  private readonly cache: Map<string, ResolvedStat> = new Map();

  /**
   * Create a new StatResolver.
   *
   * @param options - Resolver options
   */
  constructor(options: StatResolverOptions) {
    this.modDB = options.modDB;
    this.config = options.config;
    this.includeBreakdown = options.includeBreakdown ?? true;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Resolve a single stat to its final value.
   *
   * @param statName - Name of the stat to resolve
   * @param flags - Optional damage/attack type flags
   * @param keywordFlags - Optional skill keyword flags
   * @returns Resolved stat with value and breakdown
   */
  resolve(statName: string, flags?: bigint, keywordFlags?: bigint): ResolvedStat {
    // Check cache first
    const cacheKey = this.getCacheKey(statName, flags, keywordFlags);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Check for circular dependency
    if (this.resolving.has(cacheKey)) {
      // Return zero to break the cycle
      return this.createEmptyResult();
    }

    this.resolving.add(cacheKey);

    try {
      const result = this.resolveInternal(statName, flags, keywordFlags);
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.resolving.delete(cacheKey);
    }
  }

  /**
   * Resolve multiple stats at once.
   *
   * @param statNames - Names of stats to resolve
   * @param flags - Optional damage/attack type flags
   * @param keywordFlags - Optional skill keyword flags
   * @returns Map of stat names to resolved values
   */
  resolveMultiple(
    statNames: string[],
    flags?: bigint,
    keywordFlags?: bigint
  ): Map<string, ResolvedStat> {
    const results = new Map<string, ResolvedStat>();

    for (const name of statNames) {
      results.set(name, this.resolve(name, flags, keywordFlags));
    }

    return results;
  }

  /**
   * Get the current attributes.
   */
  getAttributes(): AttributeValues {
    return { ...this.config.attributes };
  }

  /**
   * Clear the resolution cache.
   *
   * Call this when the underlying ModDB or config changes.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update the config and clear cache.
   *
   * @param updates - Partial config updates
   */
  updateConfig(updates: Partial<StatResolverConfig>): void {
    Object.assign(this.config, updates);
    this.clearCache();
  }

  // ==========================================================================
  // Internal Resolution
  // ==========================================================================

  /**
   * Internal resolution logic.
   */
  private resolveInternal(
    statName: string,
    flags?: bigint,
    keywordFlags?: bigint
  ): ResolvedStat {
    const calcConfig = this.buildCalcConfig(flags, keywordFlags);
    const sources: StatSource[] = [];

    // Get base value from ModDB
    const baseFromMods = this.modDB.sum('BASE', statName, calcConfig);

    // Get attribute bonuses
    const attributeBonus = this.getAttributeBonus(statName, 'BASE');

    const totalBase = baseFromMods + attributeBonus;

    if (this.includeBreakdown && baseFromMods !== 0) {
      sources.push({
        label: 'Modifiers',
        value: baseFromMods,
        type: 'BASE',
      });
    }

    if (this.includeBreakdown && attributeBonus !== 0) {
      sources.push({
        label: 'Attributes',
        value: attributeBonus,
        type: 'BASE',
      });
    }

    // Get increased value from ModDB
    const incFromMods = this.modDB.sum('INC', statName, calcConfig);

    // Get attribute INC bonuses
    const attributeInc = this.getAttributeBonus(statName, 'INC');

    const totalInc = incFromMods + attributeInc;

    if (this.includeBreakdown && incFromMods !== 0) {
      sources.push({
        label: 'Increased',
        value: incFromMods * 100, // Convert to percentage for display
        type: 'INC',
      });
    }

    if (this.includeBreakdown && attributeInc !== 0) {
      sources.push({
        label: 'Attributes (Inc)',
        value: attributeInc * 100, // Convert to percentage for display
        type: 'INC',
      });
    }

    // Get more multiplier from ModDB
    const moreMultiplier = this.modDB.more(statName, calcConfig);

    if (this.includeBreakdown && moreMultiplier !== 1) {
      sources.push({
        label: 'More',
        value: (moreMultiplier - 1) * 100, // Convert to percentage for display
        type: 'MORE',
      });
    }

    // Check for override
    const override = this.modDB.override(statName, calcConfig);
    if (override !== undefined) {
      return {
        value: override,
        breakdown: {
          base: totalBase,
          increased: totalInc * 100,
          more: moreMultiplier,
          sources: [{ label: 'Override', value: override, type: 'BASE' }],
        },
      };
    }

    // Calculate final value: base * (1 + inc) * more
    const value = totalBase * (1 + totalInc) * moreMultiplier;

    return {
      value,
      breakdown: {
        base: totalBase,
        increased: totalInc * 100, // Store as percentage
        more: moreMultiplier,
        sources,
      },
    };
  }

  // ==========================================================================
  // Attribute Bonuses
  // ==========================================================================

  /**
   * Get attribute-derived bonus for a stat.
   *
   * @param statName - Stat to get bonus for
   * @param bonusType - Type of bonus (BASE or INC)
   * @returns Bonus value
   */
  private getAttributeBonus(statName: string, bonusType: 'BASE' | 'INC'): number {
    let bonus = 0;

    for (const dep of STAT_DEPENDENCIES) {
      if (dep.targetStat !== statName || dep.bonusType !== bonusType) continue;

      const sourceValue = this.getAttributeValue(dep.sourceStat);
      if (sourceValue <= 0) continue;

      const divisor = dep.divisor ?? 1;
      bonus += Math.floor(sourceValue / divisor) * dep.multiplier;
    }

    return bonus;
  }

  /**
   * Get an attribute value by name.
   */
  private getAttributeValue(name: string): number {
    switch (name) {
      case 'Str':
        return this.config.attributes.str;
      case 'Dex':
        return this.config.attributes.dex;
      case 'Int':
        return this.config.attributes.int;
      default:
        return 0;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Build CalcConfig for ModDB queries.
   */
  private buildCalcConfig(flags?: bigint, keywordFlags?: bigint): CalcConfig {
    const resolvedFlags = flags ?? this.config.flags;
    const resolvedKeywordFlags = keywordFlags ?? this.config.keywordFlags;

    return {
      ...(resolvedFlags !== undefined && { flags: resolvedFlags }),
      ...(resolvedKeywordFlags !== undefined && { keywordFlags: resolvedKeywordFlags }),
      conditions: this.config.conditions,
      stats: this.config.stats,
    };
  }

  /**
   * Generate cache key for a stat query.
   */
  private getCacheKey(statName: string, flags?: bigint, keywordFlags?: bigint): string {
    const f = flags?.toString() ?? 'none';
    const k = keywordFlags?.toString() ?? 'none';
    return `${statName}:${f}:${k}`;
  }

  /**
   * Create an empty result (for circular dependency handling).
   */
  private createEmptyResult(): ResolvedStat {
    return {
      value: 0,
      breakdown: {
        base: 0,
        increased: 0,
        more: 1,
        sources: [],
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a StatResolver with default configuration.
 *
 * @param modDB - ModDB to query
 * @param attributes - Current attributes
 * @param level - Character level
 * @returns Configured StatResolver
 */
export function createStatResolver(
  modDB: ModDB,
  attributes: AttributeValues = { str: 0, dex: 0, int: 0 },
  level = 1
): StatResolver {
  return new StatResolver({
    modDB,
    config: {
      level,
      attributes,
      conditions: {},
      stats: {},
    },
  });
}
