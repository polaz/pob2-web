/**
 * ModList - Ordered collection of modifiers.
 *
 * Provides operations for collecting, filtering, and managing lists of modifiers
 * before adding them to a ModDB for calculation. Commonly used to collect
 * modifiers from parsing items, passives, or gems before applying them.
 *
 * ## Usage
 *
 * ```typescript
 * const list = new ModList();
 *
 * // Add modifiers
 * list.addMod({ name: 'Life', type: 'BASE', value: 50, ... });
 * list.addMod({ name: 'Life', type: 'INC', value: 0.1, ... });
 *
 * // Filter
 * const baseMods = list.filterByType('BASE');
 * const lifeMods = list.filterByName('Life');
 *
 * // Apply to ModDB
 * list.applyTo(db);
 * ```
 */

import type { Mod } from './types';
import type { ModType, ModSource } from 'src/types/mods';
import type { ModDB } from './ModDB';

// ============================================================================
// ModList Class
// ============================================================================

/**
 * Ordered collection of modifiers.
 *
 * Implements Iterable for use with for...of loops.
 */
export class ModList implements Iterable<Mod> {
  /** Internal storage for modifiers */
  private readonly mods: Mod[] = [];

  /**
   * Create a new ModList.
   *
   * @param mods - Optional initial modifiers
   */
  constructor(mods?: Mod[]) {
    if (mods) {
      this.mods = [...mods];
    }
  }

  // ==========================================================================
  // Properties
  // ==========================================================================

  /**
   * Number of modifiers in the list.
   */
  get length(): number {
    return this.mods.length;
  }

  /**
   * Whether the list is empty.
   */
  get isEmpty(): boolean {
    return this.mods.length === 0;
  }

  // ==========================================================================
  // Add Operations
  // ==========================================================================

  /**
   * Add a single modifier to the list.
   *
   * @param mod - The modifier to add
   * @returns This list for chaining
   */
  addMod(mod: Mod): this {
    this.mods.push(mod);
    return this;
  }

  /**
   * Add multiple modifiers to the list.
   *
   * @param mods - Array of modifiers to add
   * @returns This list for chaining
   */
  addList(mods: readonly Mod[]): this {
    this.mods.push(...mods);
    return this;
  }

  /**
   * Merge another ModList into this one.
   *
   * @param other - The ModList to merge from
   * @returns This list for chaining
   */
  merge(other: ModList): this {
    this.mods.push(...other.mods);
    return this;
  }

  // ==========================================================================
  // Remove Operations
  // ==========================================================================

  /**
   * Remove all modifiers from the list.
   *
   * @returns This list for chaining
   */
  clear(): this {
    this.mods.length = 0;
    return this;
  }

  /**
   * Remove modifiers by source.
   *
   * @param source - The source to remove
   * @param sourceId - Optional specific source ID
   * @returns This list for chaining
   */
  removeBySource(source: ModSource, sourceId?: string): this {
    for (let i = this.mods.length - 1; i >= 0; i--) {
      const mod = this.mods[i]!;
      if (mod.source === source) {
        if (sourceId === undefined || mod.sourceId === sourceId) {
          this.mods.splice(i, 1);
        }
      }
    }
    return this;
  }

  // ==========================================================================
  // Filter Operations (return new ModList)
  // ==========================================================================

  /**
   * Filter modifiers by a predicate function.
   *
   * @param predicate - Function that returns true for mods to keep
   * @returns New ModList with matching modifiers
   */
  filter(predicate: (mod: Mod) => boolean): ModList {
    return new ModList(this.mods.filter(predicate));
  }

  /**
   * Filter modifiers by type.
   *
   * @param type - The modifier type to keep
   * @returns New ModList with matching modifiers
   */
  filterByType(type: ModType): ModList {
    return this.filter((mod) => mod.type === type);
  }

  /**
   * Filter modifiers by stat name.
   *
   * @param name - The stat name to keep
   * @returns New ModList with matching modifiers
   */
  filterByName(name: string): ModList {
    return this.filter((mod) => mod.name === name);
  }

  /**
   * Filter modifiers by source.
   *
   * @param source - The source to keep
   * @param sourceId - Optional specific source ID
   * @returns New ModList with matching modifiers
   */
  filterBySource(source: ModSource, sourceId?: string): ModList {
    return this.filter((mod) => {
      if (mod.source !== source) return false;
      if (sourceId !== undefined && mod.sourceId !== sourceId) return false;
      return true;
    });
  }

  /**
   * Filter modifiers that have specific flags set.
   *
   * @param flags - The flags to check for
   * @returns New ModList with modifiers that have all specified flags
   */
  filterByFlags(flags: bigint): ModList {
    return this.filter((mod) => (mod.flags & flags) === flags);
  }

  /**
   * Filter modifiers that have specific keyword flags set.
   *
   * @param keywordFlags - The keyword flags to check for
   * @returns New ModList with modifiers that have all specified keyword flags
   */
  filterByKeywordFlags(keywordFlags: bigint): ModList {
    return this.filter((mod) => (mod.keywordFlags & keywordFlags) === keywordFlags);
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Check if any modifier matches the predicate.
   *
   * @param predicate - Function to test each modifier
   * @returns True if any modifier matches
   */
  some(predicate: (mod: Mod) => boolean): boolean {
    return this.mods.some(predicate);
  }

  /**
   * Check if all modifiers match the predicate.
   *
   * @param predicate - Function to test each modifier
   * @returns True if all modifiers match (or list is empty)
   */
  every(predicate: (mod: Mod) => boolean): boolean {
    return this.mods.every(predicate);
  }

  /**
   * Find the first modifier matching the predicate.
   *
   * @param predicate - Function to test each modifier
   * @returns The first matching modifier or undefined
   */
  find(predicate: (mod: Mod) => boolean): Mod | undefined {
    return this.mods.find(predicate);
  }

  /**
   * Check if the list contains a modifier for a stat name.
   *
   * @param name - The stat name to check
   * @returns True if any modifier affects that stat
   */
  hasName(name: string): boolean {
    return this.mods.some((mod) => mod.name === name);
  }

  /**
   * Check if the list contains a modifier of a specific type.
   *
   * @param type - The modifier type to check
   * @returns True if any modifier has that type
   */
  hasType(type: ModType): boolean {
    return this.mods.some((mod) => mod.type === type);
  }

  /**
   * Get a modifier by index.
   *
   * @param index - The index to retrieve
   * @returns The modifier at that index or undefined
   */
  get(index: number): Mod | undefined {
    return this.mods[index];
  }

  // ==========================================================================
  // Transform Operations
  // ==========================================================================

  /**
   * Create a new ModList with transformed modifiers.
   *
   * @param transform - Function to transform each modifier
   * @returns New ModList with transformed modifiers
   */
  map(transform: (mod: Mod) => Mod): ModList {
    return new ModList(this.mods.map(transform));
  }

  /**
   * Execute a function for each modifier.
   *
   * @param callback - Function to execute for each modifier
   */
  forEach(callback: (mod: Mod, index: number) => void): void {
    this.mods.forEach(callback);
  }

  // ==========================================================================
  // Export Operations
  // ==========================================================================

  /**
   * Apply all modifiers to a ModDB.
   *
   * @param db - The ModDB to add modifiers to
   */
  applyTo(db: ModDB): void {
    db.addList(this.mods);
  }

  /**
   * Create a copy of this ModList.
   *
   * @returns New ModList with the same modifiers
   */
  clone(): ModList {
    return new ModList(this.mods);
  }

  /**
   * Convert to a plain array.
   *
   * @returns Array of modifiers
   */
  toArray(): Mod[] {
    return [...this.mods];
  }

  /**
   * Get unique stat names in the list.
   *
   * @returns Array of unique stat names
   */
  getStatNames(): string[] {
    const names = new Set<string>();
    for (const mod of this.mods) {
      names.add(mod.name);
    }
    return Array.from(names);
  }

  /**
   * Get unique sources in the list.
   *
   * @returns Array of unique sources
   */
  getSources(): ModSource[] {
    const sources = new Set<ModSource>();
    for (const mod of this.mods) {
      sources.add(mod.source);
    }
    return Array.from(sources);
  }

  // ==========================================================================
  // Iteration
  // ==========================================================================

  /**
   * Iterator for use with for...of loops.
   */
  [Symbol.iterator](): Iterator<Mod> {
    return this.mods[Symbol.iterator]();
  }
}
