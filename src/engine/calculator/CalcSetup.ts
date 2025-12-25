/**
 * CalcSetup - Calculation Environment Initialization
 *
 * Main entry point for setting up the calculation environment.
 * Orchestrates all processors to build the complete Environment.
 *
 * ## Usage
 *
 * ```typescript
 * const env = await setupEnvironment(build, { treeData });
 *
 * // Use with StatResolver for calculations
 * const resolver = new StatResolver({ modDB: env.playerDB, config: ... });
 * const life = resolver.resolve('Life');
 * ```
 *
 * ## Initialization Flow
 *
 * 1. Load ModParser (singleton, cached)
 * 2. Process passives → passiveDB
 * 3. Process items → itemDBs, itemDBsSwap
 * 4. Process jewels → merged into passiveDB
 * 5. Process skills → skillDB
 * 6. Process config → configDB, conditions
 * 7. Build playerDB (flatten all source DBs)
 * 8. Build enemyDB
 * 9. Calculate derived attributes
 * 10. Return complete Environment
 */

import { ModDB } from '../modifiers/ModDB';
import { getModParser } from '../modifiers/ModParserLoader';
import type { ModParser } from '../modifiers/ModParser';
import type { Build } from 'src/protos/build_pb';
import type { Item } from 'src/protos/items_pb';
import type { TreeData } from 'src/types/tree';

import {
  type Environment,
  type SetupOptions,
  type DirtyFlags,
  type AttributeValues,
  createFullyDirtyFlags,
  createCleanDirtyFlags,
  hasDirtyFlags,
  isItemSlotDirty,
  resolveConfig,
} from './Environment';

import { processPassives, updatePassivesIncremental, diffAllocatedNodes } from './PassiveProcessor';
import { processItemsBothSets, updateItemSlot } from './ItemProcessor';
import { processJewels, createJewelSocketMap } from './JewelProcessor';
import { processSkills } from './SkillProcessor';
import { processConfig, processEnemyConfig } from './ConfigProcessor';
import { CLASS_STARTING_STATS } from 'src/shared/constants';

// ============================================================================
// Main Setup Function
// ============================================================================

/**
 * Set up the calculation environment from a Build.
 *
 * This is the main entry point for environment initialization.
 * Loads all necessary data and populates all ModDBs.
 *
 * @param build - The build to set up
 * @param options - Setup options (treeData required)
 * @returns Complete calculation environment
 */
export async function setupEnvironment(
  build: Build,
  options: SetupOptions
): Promise<Environment> {
  const { treeData, accelerated = false, previousEnv, configOverrides } = options;

  // Load ModParser (cached singleton)
  const parser = await getModParser();

  // Resolve configuration
  const config = resolveConfig(build.config, configOverrides);

  // Determine dirty flags
  const dirtyFlags = accelerated && previousEnv
    ? computeDirtyFlags(build, previousEnv)
    : createFullyDirtyFlags();

  // If no changes and we have previous env, return updated copy
  if (accelerated && previousEnv && !hasDirtyFlags(dirtyFlags)) {
    return {
      ...previousEnv,
      version: previousEnv.version + 1,
      dirtyFlags: createCleanDirtyFlags(),
    };
  }

  // Process all components
  let passiveDB: ModDB;
  let itemDBs: Map<string, ModDB>;
  let itemDBsSwap: Map<string, ModDB>;
  let skillDB: ModDB;
  let configDB: ModDB;
  let conditions: Record<string, boolean>;

  if (accelerated && previousEnv) {
    // Accelerated mode: reuse unchanged components
    ({ passiveDB, itemDBs, itemDBsSwap, skillDB, configDB, conditions } =
      processAccelerated(build, previousEnv, dirtyFlags, parser, treeData));
  } else {
    // Full rebuild
    ({ passiveDB, itemDBs, itemDBsSwap, skillDB, configDB, conditions } =
      processFull(build, parser, treeData));
  }

  // Merge conditions into config
  const resolvedConfig = { ...config, conditions: { ...config.conditions, ...conditions } };

  // Build jewel socket map
  const jewelSockets = createJewelSocketMap(build.equippedItems);

  // Process jewels and merge into passiveDB
  const jewelResult = processJewels({ jewelSockets, parser });
  passiveDB.addDB(jewelResult.jewelDB);

  // Build flattened playerDB
  const playerDB = rebuildPlayerDB(passiveDB, itemDBs, skillDB, configDB);

  // Build enemyDB
  const enemyDB = processEnemyConfig(resolvedConfig);

  // Calculate derived attributes
  const attributes = calculateAttributes(passiveDB, itemDBs, build);

  // Build complete environment
  const env: Environment = {
    playerDB,
    enemyDB,
    passiveDB,
    itemDBs,
    itemDBsSwap,
    skillDB,
    configDB,
    activeWeaponSet: 1,
    jewelSockets,
    attributes,
    build,
    config: resolvedConfig,
    treeData,
    dirtyFlags: createCleanDirtyFlags(),
    version: previousEnv ? previousEnv.version + 1 : 1,
    parser,
  };

  return env;
}

// ============================================================================
// Full Processing
// ============================================================================

/**
 * Process all components from scratch.
 */
function processFull(
  build: Build,
  parser: ModParser,
  treeData: TreeData
): {
  passiveDB: ModDB;
  itemDBs: Map<string, ModDB>;
  itemDBsSwap: Map<string, ModDB>;
  skillDB: ModDB;
  configDB: ModDB;
  conditions: Record<string, boolean>;
} {
  // Process passives
  const passiveResult = processPassives({
    allocatedNodeIds: build.allocatedNodeIds,
    masterySelections: build.masterySelections,
    treeData,
    parser,
  });

  // Process items (both weapon sets)
  const itemResult = processItemsBothSets(build.equippedItems, parser);

  // Process skills
  const skillResult = processSkills({
    skillGroups: build.skillGroups,
    parser,
  });

  // Process config
  const configResult = processConfig({
    config: resolveConfig(build.config),
  });

  return {
    passiveDB: passiveResult.passiveDB,
    itemDBs: itemResult.itemDBs,
    itemDBsSwap: itemResult.itemDBsSwap,
    skillDB: skillResult.skillDB,
    configDB: configResult.configDB,
    conditions: configResult.conditions,
  };
}

// ============================================================================
// Accelerated Processing
// ============================================================================

/**
 * Process only changed components in accelerated mode.
 */
function processAccelerated(
  build: Build,
  previousEnv: Environment,
  dirtyFlags: DirtyFlags,
  parser: ModParser,
  treeData: TreeData
): {
  passiveDB: ModDB;
  itemDBs: Map<string, ModDB>;
  itemDBsSwap: Map<string, ModDB>;
  skillDB: ModDB;
  configDB: ModDB;
  conditions: Record<string, boolean>;
} {
  // Start with copies from previous env
  let passiveDB = previousEnv.passiveDB;
  let itemDBs = previousEnv.itemDBs;
  let itemDBsSwap = previousEnv.itemDBsSwap;
  let skillDB = previousEnv.skillDB;
  let configDB = previousEnv.configDB;
  let conditions = { ...previousEnv.config.conditions };

  // Update passives if dirty
  if (dirtyFlags.passives) {
    const passiveResult = processPassives({
      allocatedNodeIds: build.allocatedNodeIds,
      masterySelections: build.masterySelections,
      treeData,
      parser,
    });
    passiveDB = passiveResult.passiveDB;
  }

  // Update changed item slots
  if (dirtyFlags.items.size > 0) {
    const isAllItems = dirtyFlags.items.has('*');

    if (isAllItems) {
      // Rebuild all items
      const itemResult = processItemsBothSets(build.equippedItems, parser);
      itemDBs = itemResult.itemDBs;
      itemDBsSwap = itemResult.itemDBsSwap;
    } else {
      // Update only changed slots
      itemDBs = new Map(itemDBs);
      itemDBsSwap = new Map(itemDBsSwap);

      for (const slot of dirtyFlags.items) {
        if (isItemSlotDirty(dirtyFlags, slot)) {
          const item = build.equippedItems[slot];
          updateItemSlot(itemDBs, slot, item, parser);
        }
      }
    }
  }

  // Update skills if dirty
  if (dirtyFlags.skills) {
    const skillResult = processSkills({
      skillGroups: build.skillGroups,
      parser,
    });
    skillDB = skillResult.skillDB;
  }

  // Update config if dirty
  if (dirtyFlags.config) {
    const configResult = processConfig({
      config: resolveConfig(build.config),
    });
    configDB = configResult.configDB;
    conditions = configResult.conditions;
  }

  // Handle jewel updates
  if (dirtyFlags.jewels.size > 0) {
    const isAllJewels = dirtyFlags.jewels.has('*');

    if (isAllJewels || dirtyFlags.passives) {
      // Jewels are processed separately and merged in setupEnvironment
      // If passives changed, jewels need to be re-added anyway
    } else {
      // Incremental jewel updates would go here
      // For now, jewels are always processed fully
    }
  }

  return { passiveDB, itemDBs, itemDBsSwap, skillDB, configDB, conditions };
}

// ============================================================================
// Dirty Flag Computation
// ============================================================================

/**
 * Compute dirty flags by comparing current build to previous environment.
 */
function computeDirtyFlags(build: Build, previousEnv: Environment): DirtyFlags {
  const flags = createCleanDirtyFlags();
  const prevBuild = previousEnv.build;

  // Check passives
  if (
    build.allocatedNodeIds.length !== prevBuild.allocatedNodeIds.length ||
    !arraysEqual(build.allocatedNodeIds, prevBuild.allocatedNodeIds)
  ) {
    flags.passives = true;
  }

  // Check mastery selections
  if (!objectsEqual(build.masterySelections, prevBuild.masterySelections)) {
    flags.passives = true;
  }

  // Check items
  const allSlots = new Set([
    ...Object.keys(build.equippedItems),
    ...Object.keys(prevBuild.equippedItems),
  ]);

  for (const slot of allSlots) {
    const newItem = build.equippedItems[slot];
    const oldItem = prevBuild.equippedItems[slot];

    if (newItem?.id !== oldItem?.id) {
      flags.items.add(slot);
    }
  }

  // Check skills
  if (build.skillGroups.length !== prevBuild.skillGroups.length) {
    flags.skills = true;
  } else {
    for (let i = 0; i < build.skillGroups.length; i++) {
      const newGroup = build.skillGroups[i];
      const oldGroup = prevBuild.skillGroups[i];
      if (newGroup?.id !== oldGroup?.id || newGroup?.enabled !== oldGroup?.enabled) {
        flags.skills = true;
        break;
      }
    }
  }

  // Check config
  if (!objectsEqual(build.config ?? {}, prevBuild.config ?? {})) {
    flags.config = true;
  }

  return flags;
}

// ============================================================================
// PlayerDB Rebuild
// ============================================================================

/**
 * Rebuild the flattened playerDB from source ModDBs.
 *
 * Performance target: <1ms
 */
export function rebuildPlayerDB(
  passiveDB: ModDB,
  itemDBs: Map<string, ModDB>,
  skillDB: ModDB,
  configDB: ModDB
): ModDB {
  const playerDB = new ModDB({ actor: 'player' });

  // Add all source databases
  playerDB.addDB(passiveDB);

  for (const slotDB of itemDBs.values()) {
    playerDB.addDB(slotDB);
  }

  playerDB.addDB(skillDB);
  playerDB.addDB(configDB);

  return playerDB;
}

// ============================================================================
// Attribute Calculation
// ============================================================================

/**
 * Calculate character attributes from passives and items.
 */
function calculateAttributes(
  passiveDB: ModDB,
  itemDBs: Map<string, ModDB>,
  build: Build
): AttributeValues {
  // Start with class base attributes
  // Default stats used when class is unknown or not in CLASS_STARTING_STATS
  const DEFAULT_CLASS_STATS: AttributeValues = { str: 14, dex: 14, int: 14 };

  let classStats: AttributeValues = DEFAULT_CLASS_STATS;
  if (build.characterClass !== undefined) {
    const candidateKey = String(build.characterClass).toUpperCase();
    const foundStats = CLASS_STARTING_STATS[candidateKey];
    if (foundStats) {
      classStats = foundStats;
    }
  }

  // This is a simplified calculation - full implementation would use StatResolver
  // For now, just sum BASE attribute mods
  const tempDB = new ModDB({ actor: 'player' });
  tempDB.addDB(passiveDB);
  for (const slotDB of itemDBs.values()) {
    tempDB.addDB(slotDB);
  }

  const str = classStats.str + tempDB.sum('BASE', 'Str');
  const dex = classStats.dex + tempDB.sum('BASE', 'Dex');
  const int = classStats.int + tempDB.sum('BASE', 'Int');

  // Handle "All Attributes" bonus
  const allAttr = tempDB.sum('BASE', 'AllAttributes');

  return {
    str: str + allAttr,
    dex: dex + allAttr,
    int: int + allAttr,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if two arrays are equal (shallow comparison).
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Check if two objects are equal (shallow comparison).
 */
function objectsEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }

  return true;
}

// ============================================================================
// Incremental Update Functions
// ============================================================================

/**
 * Update environment with new passive allocations.
 */
export function updatePassives(
  env: Environment,
  allocatedNodeIds: string[]
): Environment {
  const parser = env.parser;
  const { added, removed } = diffAllocatedNodes(
    env.build.allocatedNodeIds,
    allocatedNodeIds
  );

  // Clone passiveDB and update
  const passiveDB = new ModDB({ actor: 'player' });
  passiveDB.addDB(env.passiveDB);

  updatePassivesIncremental(
    passiveDB,
    added,
    removed,
    env.treeData,
    env.build.masterySelections,
    parser
  );

  // Rebuild playerDB
  const playerDB = rebuildPlayerDB(passiveDB, env.itemDBs, env.skillDB, env.configDB);

  return {
    ...env,
    passiveDB,
    playerDB,
    dirtyFlags: { ...env.dirtyFlags, passives: true },
    version: env.version + 1,
  };
}

/**
 * Update environment with a changed item.
 */
export function updateItem(
  env: Environment,
  slot: string,
  item: Item | undefined
): Environment {
  const parser = env.parser;

  // Clone itemDBs and update
  const itemDBs = new Map(env.itemDBs);
  updateItemSlot(itemDBs, slot, item, parser);

  // Rebuild playerDB
  const playerDB = rebuildPlayerDB(env.passiveDB, itemDBs, env.skillDB, env.configDB);

  // Update dirty flags
  const dirtyFlags = { ...env.dirtyFlags };
  dirtyFlags.items = new Set(dirtyFlags.items);
  dirtyFlags.items.add(slot);

  return {
    ...env,
    itemDBs,
    playerDB,
    dirtyFlags,
    version: env.version + 1,
  };
}

// Re-export for convenience
export { diffAllocatedNodes };
