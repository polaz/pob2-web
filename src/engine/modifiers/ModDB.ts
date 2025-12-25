/**
 * ModDB - Modifier Database
 *
 * Core storage and query system for modifiers during calculations.
 * Based on Path of Building's ModDB.lua implementation.
 *
 * ## Usage
 *
 * ```typescript
 * const db = new ModDB();
 *
 * // Add modifiers
 * db.addMod({ name: 'Life', type: 'BASE', value: 50, ... });
 * db.addMod({ name: 'Life', type: 'INC', value: 0.1, ... });
 *
 * // Query stats
 * const life = db.sum('BASE', 'Life'); // 50
 * const inc = db.sum('INC', 'Life');   // 0.1
 * ```
 *
 * ## Aggregation Rules
 *
 * - BASE: Sum all values
 * - INC: Sum all values (applied as multiplier: 1 + sum)
 * - MORE: Multiply all values (each applied as: 1 + value)
 * - OVERRIDE: Highest value wins
 * - FLAG: True if any modifier exists
 * - LIST: Collect all values into array
 */

import type {
  Mod,
  CalcConfig,
  StatResult,
  ListValue,
  ActorType,
  ModDBOptions,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Default flags value (applies to all) */
const NO_FLAGS = 0n;

// ============================================================================
// ModDB Class
// ============================================================================

/**
 * Modifier Database for storing and querying modifiers.
 */
export class ModDB {
  /** Modifiers indexed by stat name for O(1) lookup */
  private readonly mods: Map<string, Mod[]> = new Map();

  /** Parent database for hierarchical lookups */
  private readonly parent: ModDB | undefined;

  /** Actor type for this database */
  private readonly actor: ActorType;

  /** Multiplier cache for expensive calculations (reserved for future optimization) */
  private readonly multiplierCache: Map<string, number> = new Map();

  /**
   * Create a new ModDB instance.
   *
   * @param options - Configuration options
   */
  constructor(options: ModDBOptions = {}) {
    this.parent = options.parent;
    this.actor = options.actor ?? 'player';
  }

  // ==========================================================================
  // Modifier Management
  // ==========================================================================

  /**
   * Add a single modifier to the database.
   *
   * @param mod - The modifier to add
   */
  addMod(mod: Mod): void {
    const existing = this.mods.get(mod.name);
    if (existing) {
      existing.push(mod);
    } else {
      this.mods.set(mod.name, [mod]);
    }
    this.invalidateCache();
  }

  /**
   * Add multiple modifiers to the database.
   *
   * @param mods - Array of modifiers to add
   */
  addList(mods: Mod[]): void {
    for (const mod of mods) {
      this.addMod(mod);
    }
  }

  /**
   * Merge another ModDB into this one.
   *
   * @param other - The ModDB to merge from
   */
  addDB(other: ModDB): void {
    for (const [, mods] of other.mods) {
      for (const mod of mods) {
        this.addMod(mod);
      }
    }
  }

  /**
   * Remove all modifiers from a specific source.
   *
   * @param source - The source to remove (e.g., "item")
   * @param sourceId - Optional specific source ID
   */
  removeBySource(source: string, sourceId?: string): void {
    for (const [name, mods] of this.mods) {
      const filtered = mods.filter((mod) => {
        if (mod.source !== source) return true;
        if (sourceId !== undefined && mod.sourceId !== sourceId) return true;
        return false;
      });

      if (filtered.length === 0) {
        this.mods.delete(name);
      } else if (filtered.length !== mods.length) {
        this.mods.set(name, filtered);
      }
    }
    this.invalidateCache();
  }

  /**
   * Clear all modifiers from the database.
   */
  clear(): void {
    this.mods.clear();
    this.invalidateCache();
  }

  /**
   * Get the number of modifiers in the database.
   */
  get size(): number {
    let count = 0;
    for (const mods of this.mods.values()) {
      count += mods.length;
    }
    return count;
  }

  // ==========================================================================
  // Flag Matching
  // ==========================================================================

  /**
   * Check if a modifier's flags match the config flags.
   *
   * A modifier matches if:
   * - Modifier has no flags (applies to all), OR
   * - All modifier flags are present in config flags
   *
   * @param mod - The modifier to check
   * @param config - The calculation config
   * @returns True if the modifier applies
   */
  private matchesFlags(mod: Mod, config: CalcConfig): boolean {
    // Check damage/attack flags
    if (mod.flags !== NO_FLAGS) {
      const configFlags = config.flags ?? NO_FLAGS;
      // All modifier flags must be present in config
      if ((mod.flags & configFlags) !== mod.flags) {
        return false;
      }
    }

    // Check keyword flags
    if (mod.keywordFlags !== NO_FLAGS) {
      const configKeywords = config.keywordFlags ?? NO_FLAGS;
      if ((mod.keywordFlags & configKeywords) !== mod.keywordFlags) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a modifier's condition is met.
   *
   * @param mod - The modifier to check
   * @param config - The calculation config
   * @returns True if condition is met (or no condition)
   */
  private matchesCondition(mod: Mod, config: CalcConfig): boolean {
    if (!mod.condition) return true;

    const cond = mod.condition;

    switch (cond.type) {
      case 'Condition': {
        // Check if condition variable is true
        const value = config.conditions?.[cond.var ?? ''] ?? false;
        return cond.neg ? !value : value;
      }

      case 'PerStat': {
        // PerStat conditions are handled during value calculation
        return true;
      }

      case 'Multiplier': {
        // Multiplier conditions are handled during value calculation
        return true;
      }

      case 'StatThreshold': {
        // Check if stat meets threshold
        const statValue = config.stats?.[cond.stat ?? ''] ?? 0;
        const threshold = cond.threshold ?? 0;
        return statValue >= threshold;
      }

      case 'SocketedIn': {
        // Check if slot matches
        return config.slotName === cond.var;
      }

      default:
        return true;
    }
  }

  /**
   * Get the effective value of a modifier, applying PerStat/Multiplier.
   *
   * @param mod - The modifier
   * @param config - The calculation config
   * @returns The effective value
   */
  private getEffectiveValue(mod: Mod, config: CalcConfig): number {
    let value = mod.value;

    if (mod.condition) {
      const cond = mod.condition;

      if (cond.type === 'PerStat') {
        // Value per X points of a stat
        const statValue = config.stats?.[cond.stat ?? ''] ?? 0;
        const div = cond.div ?? 1;
        value *= Math.floor(statValue / div);
      } else if (cond.type === 'Multiplier') {
        // Multiply by a variable value
        const multiplier = config.stats?.[cond.var ?? ''] ?? 0;
        value *= multiplier;
      }
    }

    return value;
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get all modifiers for a stat name that match the config.
   *
   * @param name - Stat name to query
   * @param config - Optional calculation config for filtering
   * @returns Array of matching modifiers
   */
  private getModsFor(name: string, config: CalcConfig = {}): Mod[] {
    const result: Mod[] = [];

    // Get from this database
    const local = this.mods.get(name);
    if (local) {
      for (const mod of local) {
        if (this.matchesFlags(mod, config) && this.matchesCondition(mod, config)) {
          result.push(mod);
        }
      }
    }

    // Get from parent database
    if (this.parent) {
      const parentMods = this.parent.getModsFor(name, config);
      result.push(...parentMods);
    }

    return result;
  }

  /**
   * Sum all modifiers of a specific type for given stat names.
   *
   * @param modType - The modifier type to sum (BASE or INC)
   * @param names - Stat names to sum
   * @param config - Optional calculation config
   * @returns Sum of all matching modifier values
   */
  sum(modType: 'BASE' | 'INC', ...args: (string | CalcConfig)[]): number {
    const { names, config } = this.parseArgs(args);

    let total = 0;
    for (const name of names) {
      const mods = this.getModsFor(name, config);
      for (const mod of mods) {
        if (mod.type === modType) {
          total += this.getEffectiveValue(mod, config);
        }
      }
    }

    return total;
  }

  /**
   * Calculate the combined MORE multiplier for given stat names.
   *
   * Each MORE modifier is applied as (1 + value), all multiplied together.
   *
   * @param names - Stat names to check
   * @param config - Optional calculation config
   * @returns Combined multiplier (1.0 if no MORE mods)
   */
  more(...args: (string | CalcConfig)[]): number {
    const { names, config } = this.parseArgs(args);

    let multiplier = 1;
    for (const name of names) {
      const mods = this.getModsFor(name, config);
      for (const mod of mods) {
        if (mod.type === 'MORE') {
          const value = this.getEffectiveValue(mod, config);
          multiplier *= 1 + value;
        }
      }
    }

    return multiplier;
  }

  /**
   * Check if a FLAG modifier exists for any of the given stat names.
   *
   * @param names - Stat names to check
   * @param config - Optional calculation config
   * @returns True if any FLAG modifier exists
   */
  flag(...args: (string | CalcConfig)[]): boolean {
    const { names, config } = this.parseArgs(args);

    for (const name of names) {
      const mods = this.getModsFor(name, config);
      for (const mod of mods) {
        if (mod.type === 'FLAG') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the OVERRIDE value for a stat (highest wins).
   *
   * @param name - Stat name to check
   * @param config - Optional calculation config
   * @returns Override value or undefined if none
   */
  override(name: string, config: CalcConfig = {}): number | undefined {
    const mods = this.getModsFor(name, config);
    let highest: number | undefined;

    for (const mod of mods) {
      if (mod.type === 'OVERRIDE') {
        const value = this.getEffectiveValue(mod, config);
        if (highest === undefined || value > highest) {
          highest = value;
        }
      }
    }

    return highest;
  }

  /**
   * Collect all LIST values for a stat.
   *
   * @param name - Stat name to collect
   * @param config - Optional calculation config
   * @returns Array of list values
   */
  list(name: string, config: CalcConfig = {}): ListValue[] {
    const mods = this.getModsFor(name, config);
    const result: ListValue[] = [];

    for (const mod of mods) {
      if (mod.type === 'LIST') {
        result.push({
          mod,
          value: mod.value,
        });
      }
    }

    return result;
  }

  /**
   * Calculate a full stat with BASE, INC, MORE, and OVERRIDE.
   *
   * Formula: base * (1 + inc) * more
   * If OVERRIDE exists, it replaces the calculated value.
   *
   * @param names - Stat names to calculate
   * @param config - Optional calculation config
   * @returns Full stat result with breakdown
   */
  calc(...args: (string | CalcConfig)[]): StatResult {
    const { names, config } = this.parseArgs(args);

    // Get all mods for these names
    let modCount = 0;
    let base = 0;
    let inc = 0;
    let more = 1;
    let override: number | undefined;

    for (const name of names) {
      const mods = this.getModsFor(name, config);
      modCount += mods.length;

      for (const mod of mods) {
        const value = this.getEffectiveValue(mod, config);

        switch (mod.type) {
          case 'BASE':
            base += value;
            break;
          case 'INC':
            inc += value;
            break;
          case 'MORE':
            more *= 1 + value;
            break;
          case 'OVERRIDE':
            if (override === undefined || value > override) {
              override = value;
            }
            break;
        }
      }
    }

    // Calculate final value
    let value = base * (1 + inc) * more;

    // Override replaces calculated value
    if (override !== undefined) {
      value = override;
    }

    const result: StatResult = {
      value,
      base,
      inc,
      more,
      modCount,
    };

    if (override !== undefined) {
      result.override = override;
    }

    return result;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Parse variable arguments into names array and config.
   *
   * Supports: sum('A', 'B', config) or sum('A', 'B')
   */
  private parseArgs(
    args: (string | CalcConfig)[]
  ): { names: string[]; config: CalcConfig } {
    const last = args[args.length - 1];
    if (last !== undefined && typeof last === 'object' && !Array.isArray(last)) {
      return {
        names: args.slice(0, -1) as string[],
        config: last,
      };
    }
    return {
      names: args as string[],
      config: {},
    };
  }

  /**
   * Invalidate the multiplier cache.
   */
  private invalidateCache(): void {
    this.multiplierCache.clear();
  }

  /**
   * Get all stat names in this database.
   */
  getStatNames(): string[] {
    return Array.from(this.mods.keys());
  }

  /**
   * Check if this database has any modifiers for a stat.
   */
  hasStat(name: string): boolean {
    return this.mods.has(name) || (this.parent?.hasStat(name) ?? false);
  }

  /**
   * Get the actor type for this database.
   */
  getActor(): ActorType {
    return this.actor;
  }

  /**
   * Get the parent database.
   */
  getParent(): ModDB | undefined {
    return this.parent;
  }
}
