/**
 * Environment - Calculation Environment Types
 *
 * Defines the interfaces for the calculation environment that holds all
 * ModDB instances and state needed for DPS/defence calculations.
 *
 * ## Architecture
 *
 * The environment uses a hybrid ModDB hierarchy:
 * - Source DBs kept separate for incremental updates
 * - Flattened playerDB for fast queries during calculation
 *
 * ```
 * Environment
 * ├── Source DBs (standalone, for incremental updates)
 * │   ├── passiveDB: tree allocations + socketed jewels
 * │   ├── skillDB: active skill/gem mods
 * │   ├── configDB: config-derived mods (charges, conditions)
 * │   └── itemDBs: per-slot item mods (active set)
 * │   └── itemDBsSwap: per-slot item mods (swap set)
 * │
 * ├── Calculation DB (flattened from sources)
 * │   └── playerDB: rebuilt from sources on change
 * │
 * └── Enemy DB
 *     └── enemyDB: from config + debuffs
 * ```
 */

import type { ModDB } from '../modifiers/ModDB';
import type { ModParser } from '../modifiers/ModParser';
import type { Build, BuildConfig } from 'src/protos/build_pb';
import type { Item } from 'src/protos/items_pb';
import type { TreeData } from 'src/types/tree';
import type { AttributeValues } from './types';
import { CHARGE_CONSTANTS } from 'src/shared/constants';

// ============================================================================
// Environment Interface
// ============================================================================

/**
 * The calculation environment containing all ModDBs and state.
 *
 * This is the primary data structure passed to calculation functions.
 */
export interface Environment {
  // === Core ModDB Hierarchy ===

  /** Flattened calculation DB (rebuilt from source DBs) */
  playerDB: ModDB;

  /** Enemy stats for offense calculations */
  enemyDB: ModDB;

  // === Source ModDBs (for granular updates) ===

  /** Tree allocations + socketed jewels */
  passiveDB: ModDB;

  /** Per-slot item mods (active weapon set) */
  itemDBs: Map<string, ModDB>;

  /** Per-slot item mods (swap weapon set) */
  itemDBsSwap: Map<string, ModDB>;

  /** Active skill/gem mods */
  skillDB: ModDB;

  /** Config-derived mods (charges, conditions) */
  configDB: ModDB;

  // === Weapon Swap State ===

  /** Currently active weapon set (1 or 2) */
  activeWeaponSet: 1 | 2;

  // === Jewel System ===

  /** Socketed jewels by socket node ID */
  jewelSockets: Map<string, JewelSocket>;

  // === Derived Calculations ===

  /** Character attributes (sum from passives + items) */
  attributes: AttributeValues;

  // === Input Snapshots ===

  /** The build being calculated */
  build: Build;

  /** Resolved build configuration */
  config: ResolvedBuildConfig;

  /** Tree data for node lookups */
  treeData: TreeData;

  // === Acceleration Support ===

  /** Flags indicating which components have changed */
  dirtyFlags: DirtyFlags;

  /** Environment version (incremented on any change) */
  version: number;

  // === Parser Reference ===

  /** Shared ModParser instance */
  parser: ModParser;
}

// ============================================================================
// Jewel System Types
// ============================================================================

/**
 * A jewel socket in the passive tree.
 */
export interface JewelSocket {
  /** Node ID of the socket */
  nodeId: string;

  /** Socketed jewel (null if empty) */
  jewel: Item | null;
}

// ============================================================================
// Dirty Tracking Types
// ============================================================================

// Re-export AttributeValues from types for convenience
export type { AttributeValues } from './types';

/**
 * Flags indicating which environment components have changed.
 *
 * Used for accelerated recalculation - only rebuild what's dirty.
 */
export interface DirtyFlags {
  /** Passive tree allocations changed */
  passives: boolean;

  /** Changed item slots (by slot name) */
  items: Set<string>;

  /** Skills/gems changed */
  skills: boolean;

  /** Build config changed */
  config: boolean;

  /** Changed jewel sockets (by node ID) */
  jewels: Set<string>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Resolved build configuration with defaults applied.
 *
 * All optional fields from BuildConfig are resolved to concrete values.
 */
export interface ResolvedBuildConfig {
  // === Enemy Configuration ===

  /** Enemy level for calculations */
  enemyLevel: number;

  /** Whether enemy is a boss (affects resistances, etc.) */
  enemyIsBoss: boolean;

  /** Enemy type (for specific resistance overrides) */
  enemyType: string;

  // === Charge Configuration ===

  /** Power charges enabled */
  powerCharges: boolean;

  /** Number of power charges */
  powerChargeCount: number;

  /** Maximum power charges */
  maxPowerCharges: number;

  /** Frenzy charges enabled */
  frenzyCharges: boolean;

  /** Number of frenzy charges */
  frenzyChargeCount: number;

  /** Maximum frenzy charges */
  maxFrenzyCharges: number;

  /** Endurance charges enabled */
  enduranceCharges: boolean;

  /** Number of endurance charges */
  enduranceChargeCount: number;

  /** Maximum endurance charges */
  maxEnduranceCharges: number;

  // === Combat State ===

  /** Currently leeching life/mana/ES */
  isLeeching: boolean;

  /** On low life (below 50%) */
  isOnLowLife: boolean;

  /** On full life */
  isOnFullLife: boolean;

  /** On low mana (below 50%) */
  isOnLowMana: boolean;

  /** On full mana */
  isOnFullMana: boolean;

  /** On low energy shield (below 50%) */
  isOnLowEnergyShield: boolean;

  /** On full energy shield */
  isOnFullEnergyShield: boolean;

  // === Condition Overrides ===

  /** Custom conditions (e.g., "Onslaught", "Fortify") */
  conditions: Record<string, boolean>;
}

// ============================================================================
// Setup Options
// ============================================================================

/**
 * Options for setting up the calculation environment.
 */
export interface SetupOptions {
  /** Tree data for node lookups */
  treeData: TreeData;

  /** Whether to use accelerated mode (skip unchanged components) */
  accelerated?: boolean;

  /** Previous environment for accelerated mode */
  previousEnv?: Environment;

  /** Override config values */
  configOverrides?: Partial<ResolvedBuildConfig>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create empty dirty flags (nothing dirty).
 */
export function createCleanDirtyFlags(): DirtyFlags {
  return {
    passives: false,
    items: new Set(),
    skills: false,
    config: false,
    jewels: new Set(),
  };
}

/**
 * Wildcard marker indicating "all items" or "all jewels" are dirty.
 *
 * ## Design Rationale
 *
 * We use a string wildcard ('*') instead of separate boolean flags for simplicity:
 * - Single Set<string> handles both specific IDs and "all dirty" state
 * - Checking `set.has('*') || set.has(id)` is O(1) and clear
 * - Alternative (separate allItemsDirty boolean) adds complexity without benefit
 *
 * The '*' character is safe because:
 * - Slot names are defined constants (weapon1, helmet, etc.)
 * - Jewel node IDs are numeric strings from tree data
 * - Neither can ever be '*'
 */
export const DIRTY_WILDCARD = '*';

/**
 * Create fully dirty flags (everything needs rebuild).
 */
export function createFullyDirtyFlags(): DirtyFlags {
  return {
    passives: true,
    items: new Set([DIRTY_WILDCARD]),
    skills: true,
    config: true,
    jewels: new Set([DIRTY_WILDCARD]),
  };
}

/**
 * Check if any flags are dirty.
 */
export function hasDirtyFlags(flags: DirtyFlags): boolean {
  return (
    flags.passives ||
    flags.items.size > 0 ||
    flags.skills ||
    flags.config ||
    flags.jewels.size > 0
  );
}

/**
 * Check if a specific item slot is dirty.
 *
 * @param flags - Dirty flags to check
 * @param slot - Slot name to check
 * @returns True if slot is dirty or all items are dirty
 */
export function isItemSlotDirty(flags: DirtyFlags, slot: string): boolean {
  return flags.items.has(DIRTY_WILDCARD) || flags.items.has(slot);
}

/**
 * Check if a specific jewel socket is dirty.
 *
 * @param flags - Dirty flags to check
 * @param nodeId - Node ID to check
 * @returns True if socket is dirty or all jewels are dirty
 */
export function isJewelSocketDirty(flags: DirtyFlags, nodeId: string): boolean {
  return flags.jewels.has(DIRTY_WILDCARD) || flags.jewels.has(nodeId);
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default enemy level for calculations */
const DEFAULT_ENEMY_LEVEL = 83;

/**
 * Resolve BuildConfig to ResolvedBuildConfig with defaults.
 *
 * @param config - Optional build config from proto
 * @param overrides - Optional overrides to apply
 * @returns Fully resolved configuration
 */
export function resolveConfig(
  config?: BuildConfig,
  overrides?: Partial<ResolvedBuildConfig>
): ResolvedBuildConfig {
  const resolved: ResolvedBuildConfig = {
    // Enemy configuration
    enemyLevel: config?.enemyLevel ?? DEFAULT_ENEMY_LEVEL,
    enemyIsBoss: config?.enemyIsBoss ?? false,
    enemyType: config?.enemyType ?? 'normal',

    // Charge configuration
    powerCharges: config?.powerCharges ?? false,
    powerChargeCount: config?.powerChargeCount ?? 0,
    maxPowerCharges: CHARGE_CONSTANTS.DEFAULT_POWER_CHARGES,

    frenzyCharges: config?.frenzyCharges ?? false,
    frenzyChargeCount: config?.frenzyChargeCount ?? 0,
    maxFrenzyCharges: CHARGE_CONSTANTS.DEFAULT_FRENZY_CHARGES,

    enduranceCharges: config?.enduranceCharges ?? false,
    enduranceChargeCount: config?.enduranceChargeCount ?? 0,
    maxEnduranceCharges: CHARGE_CONSTANTS.DEFAULT_ENDURANCE_CHARGES,

    // Combat state
    isLeeching: config?.isLeeching ?? false,
    isOnLowLife: config?.isOnLowLife ?? false,
    isOnFullLife: config?.isOnFullLife ?? true,
    isOnLowMana: config?.isOnLowMana ?? false,
    isOnFullMana: config?.isOnFullMana ?? true,
    isOnLowEnergyShield: config?.isOnLowEnergyShield ?? false,
    isOnFullEnergyShield: config?.isOnFullEnergyShield ?? true,

    // Conditions
    conditions: {},
  };

  // Apply overrides if provided
  if (overrides) {
    Object.assign(resolved, overrides);
  }

  // Enforce mutual exclusivity for resource states.
  // A character cannot be simultaneously "Low" and "Full" for the same resource.
  // "Low" takes precedence as it's the more constrained state.
  //
  // Valid state combinations for each resource (Life, Mana, ES):
  // - Low=true,  Full=false  → Character is below 50% (explicit low)
  // - Low=false, Full=true   → Character is at 100% (explicit or default full)
  // - Low=false, Full=false  → Character is between 50-99% (in-between state)
  //
  // The in-between state (neither Low nor Full) is valid and represents a
  // character whose resource is partially depleted but not critically low.
  // By default, resolveConfig sets Full=true; callers can explicitly set both
  // to false via overrides to represent the in-between state.
  if (resolved.isOnLowLife && resolved.isOnFullLife) {
    resolved.isOnFullLife = false;
  }
  if (resolved.isOnLowMana && resolved.isOnFullMana) {
    resolved.isOnFullMana = false;
  }
  if (resolved.isOnLowEnergyShield && resolved.isOnFullEnergyShield) {
    resolved.isOnFullEnergyShield = false;
  }

  // Clamp charge counts to maximums
  resolved.powerChargeCount = Math.min(
    resolved.powerChargeCount,
    resolved.maxPowerCharges
  );
  resolved.frenzyChargeCount = Math.min(
    resolved.frenzyChargeCount,
    resolved.maxFrenzyCharges
  );
  resolved.enduranceChargeCount = Math.min(
    resolved.enduranceChargeCount,
    resolved.maxEnduranceCharges
  );

  // If charges are disabled, set count to 0
  if (!resolved.powerCharges) resolved.powerChargeCount = 0;
  if (!resolved.frenzyCharges) resolved.frenzyChargeCount = 0;
  if (!resolved.enduranceCharges) resolved.enduranceChargeCount = 0;

  return resolved;
}
