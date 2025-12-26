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
  DIRTY_WILDCARD,
  createFullyDirtyFlags,
  createCleanDirtyFlags,
  hasDirtyFlags,
  resolveConfig,
} from './Environment';

import { processPassives, updatePassivesIncremental, diffAllocatedNodes } from './PassiveProcessor';
import {
  processItemsBothSets,
  updateItemSlot,
  SWAP_WEAPON_SLOTS,
} from './ItemProcessor';
import { processJewels, createJewelSocketMap } from './JewelProcessor';
import { processSkills } from './SkillProcessor';
import { processConfig, processEnemyConfig } from './ConfigProcessor';
import { CLASS_STARTING_STATS } from 'src/shared/constants';
import { CharacterClass } from 'src/protos/common_pb';

// ============================================================================
// Constants
// ============================================================================

/**
 * Fallback stats used when class is unknown or not found in CLASS_STARTING_STATS.
 *
 * These neutral mid-range values (14 each) keep calculations stable for
 * incomplete builds (e.g., during import or when new classes are added).
 * They don't match any specific PoE2 class; real builds should always
 * resolve to CLASS_STARTING_STATS entries.
 */
const DEFAULT_CLASS_STATS: AttributeValues = { str: 14, dex: 14, int: 14 };

/**
 * Pre-computed Set of swap weapon slot names for O(1) lookup.
 * Created once at module load to avoid recreating on each processAccelerated call.
 */
const SWAP_SLOT_SET: ReadonlySet<string> = new Set(SWAP_WEAPON_SLOTS);

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

  // Process jewels and merge into passiveDB.
  // Always process in full mode (!accelerated or !previousEnv).
  // In accelerated mode, only skip if BOTH jewels AND passives are unchanged.
  //
  // IMPORTANT: Jewels must be reprocessed when passives change because passiveDB is rebuilt
  // from scratch, which loses any previously merged jewel mods. The condition below ensures
  // jewels are processed whenever passiveDB is rebuilt (passives dirty) or jewels change.
  //
  // NOTE: When any jewel changes, we reprocess ALL jewels rather than doing incremental
  // updates. This is intentional because jewel radius effects can interact with passive
  // nodes in complex ways (e.g., Timeless Jewels transform nodes within radius). Tracking
  // which nodes are affected by each jewel would add significant complexity. Full
  // reprocessing is acceptable since jewel counts are small (typically <10).
  const shouldProcessJewels =
    !accelerated || !previousEnv || dirtyFlags.jewels.size > 0 || dirtyFlags.passives;
  if (shouldProcessJewels) {
    // If passiveDB is still the previousEnv reference (passives weren't dirty),
    // we must create a copy before adding jewel mods to avoid mutating the previous env.
    // When passives ARE dirty, passiveDB is already a fresh instance from processPassives.
    //
    // NOTE: ModDB.addDB copies Mod object references (shallow). This is safe because Mod
    // objects are immutable in our architecture - they're created once by ModParser and
    // never modified. Sharing references between ModDBs is intentional and memory-efficient.
    if (accelerated && previousEnv && !dirtyFlags.passives) {
      const clonedPassiveDB = new ModDB({ actor: 'player' });
      clonedPassiveDB.addDB(passiveDB);
      passiveDB = clonedPassiveDB;
    }
    const jewelResult = processJewels({ jewelSockets, parser });
    passiveDB.addDB(jewelResult.jewelDB);
  }

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
    const isAllItems = dirtyFlags.items.has(DIRTY_WILDCARD);

    if (isAllItems) {
      // Rebuild all items
      const itemResult = processItemsBothSets(build.equippedItems, parser);
      itemDBs = itemResult.itemDBs;
      itemDBsSwap = itemResult.itemDBsSwap;
    } else {
      // Update only changed slots
      itemDBs = new Map(itemDBs);
      itemDBsSwap = new Map(itemDBsSwap);

      // In this branch, we know wildcard is not set (checked above), so all
      // entries in dirtyFlags.items are specific slot names that need updating.
      // Defensively skip the wildcard marker in case it's ever mixed with slots.
      // Update the correct map based on whether the slot is a swap weapon slot.
      for (const slot of dirtyFlags.items) {
        if (slot === DIRTY_WILDCARD) continue;
        const item = build.equippedItems[slot];
        const targetDB = SWAP_SLOT_SET.has(slot) ? itemDBsSwap : itemDBs;
        updateItemSlot(targetDB, slot, item, parser);
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

  // Note: Jewel modifiers are NOT processed in this function.
  // Jewel processing is always done in setupEnvironment() after this function
  // returns. This is because jewel modifiers are merged into passiveDB and the
  // order of operations matters. setupEnvironment() handles jewel processing
  // when either jewels OR passives are dirty (since passiveDB rebuild loses
  // previously merged jewel mods). See: setupEnvironment() shouldProcessJewels.

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

  // Compare items by ID only. In our proto-based architecture, items are immutable:
  // modifying an item creates a new Item object with a new ID. This means ID comparison
  // correctly detects all item changes including mod modifications.
  for (const slot of allSlots) {
    const newItem = build.equippedItems[slot];
    const oldItem = prevBuild.equippedItems[slot];

    if (newItem?.id !== oldItem?.id) {
      flags.items.add(slot);
    }
  }

  // Check skills - early exit if lengths differ or arrays are identical references
  if (build.skillGroups.length !== prevBuild.skillGroups.length) {
    flags.skills = true;
  } else if (build.skillGroups !== prevBuild.skillGroups) {
    // Only iterate if arrays are different objects
    for (let i = 0; i < build.skillGroups.length; i++) {
      const newGroup = build.skillGroups[i];
      const oldGroup = prevBuild.skillGroups[i];
      if (newGroup?.id !== oldGroup?.id || newGroup?.enabled !== oldGroup?.enabled) {
        flags.skills = true;
        break;
      }
    }
  }

  // Check config - use ?? {} to normalize undefined to empty object for shallow comparison.
  // objectsEqual does shallow property comparison; undefined configs become {} to match correctly.
  if (!objectsEqual(build.config ?? {}, prevBuild.config ?? {})) {
    flags.config = true;
  }

  // Check jewel sockets by comparing jewelSockets maps from both environments.
  // Jewels are stored in equippedItems with socket node IDs as keys.
  // We compare the previous environment's jewelSockets with a freshly computed map.
  const newJewelSockets = createJewelSocketMap(build.equippedItems);
  const prevJewelSockets = previousEnv.jewelSockets;

  // Check for removed or changed sockets (iterating prev finds these)
  for (const [nodeId, prevSocket] of prevJewelSockets) {
    const newSocket = newJewelSockets.get(nodeId);
    if (!newSocket || newSocket.jewel?.id !== prevSocket.jewel?.id) {
      flags.jewels.add(nodeId);
    }
  }

  // Check for added sockets
  for (const [nodeId, newSocket] of newJewelSockets) {
    if (!prevJewelSockets.has(nodeId) && newSocket.jewel) {
      flags.jewels.add(nodeId);
    }
  }

  return flags;
}

// ============================================================================
// PlayerDB Rebuild
// ============================================================================

/**
 * Rebuild the flattened playerDB from source ModDBs.
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
 *
 * LIMITATION: This is a simplified calculation that only sums BASE modifiers.
 * It does NOT use StatResolver and therefore ignores INC/MORE modifiers to
 * attributes. For accurate attribute values with percentage bonuses, a full
 * StatResolver pass would be needed. This simplified version is sufficient
 * for basic attribute requirements checking but may be inaccurate for builds
 * with significant % increased attribute modifiers.
 *
 * @returns Attribute values (may be inaccurate if % modifiers exist)
 */
function calculateAttributes(
  passiveDB: ModDB,
  itemDBs: Map<string, ModDB>,
  build: Build
): AttributeValues {
  // Start with class base attributes (see DEFAULT_CLASS_STATS for fallback rationale)
  let classStats: AttributeValues = DEFAULT_CLASS_STATS;
  if (
    build.characterClass !== undefined &&
    build.characterClass !== CharacterClass.CHARACTER_CLASS_UNKNOWN
  ) {
    // Convert enum value to name (e.g., CharacterClass.WARRIOR -> "WARRIOR")
    const enumName = CharacterClass[build.characterClass];
    if (typeof enumName === 'string') {
      const foundStats = CLASS_STARTING_STATS[enumName];
      if (foundStats) {
        classStats = foundStats;
      }
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
 *
 * NOTE: This performs shallow equality only. Nested objects or arrays are
 * compared by reference, not by value. This is intentional for performance
 * in hot paths like dirty flag computation. For BuildConfig, this means
 * nested changes may not be detected if the same object reference is reused.
 * In practice, config changes typically create new objects via proto cloning.
 */
function objectsEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    // Verify key exists in b (handles case where a and b have same count but different keys)
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
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

  // Deep clone dirtyFlags to avoid mutating the original environment's Sets
  const dirtyFlags: DirtyFlags = {
    ...env.dirtyFlags,
    items: new Set(env.dirtyFlags.items),
    jewels: new Set(env.dirtyFlags.jewels),
    passives: true,
  };

  return {
    ...env,
    passiveDB,
    playerDB,
    dirtyFlags,
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

  // Shallow clone of the Map structure only. ModDB instances are reused.
  //
  // IMMUTABILITY CONTRACT: updateItemSlot MUST replace the slot entry with a
  // new ModDB rather than mutating existing ones. This allows safe Map reuse.
  // If updateItemSlot is ever changed to mutate ModDBs in place, this clone
  // would need to deep-clone the ModDB instances as well.
  const itemDBs = new Map(env.itemDBs);
  updateItemSlot(itemDBs, slot, item, parser);

  // Rebuild playerDB
  const playerDB = rebuildPlayerDB(env.passiveDB, itemDBs, env.skillDB, env.configDB);

  // Deep clone dirtyFlags to avoid mutating the original environment's Sets
  const dirtyFlags: DirtyFlags = {
    ...env.dirtyFlags,
    items: new Set(env.dirtyFlags.items),
    jewels: new Set(env.dirtyFlags.jewels),
  };
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
