/**
 * PassiveProcessor - Process Allocated Passive Nodes
 *
 * Converts allocated passive tree nodes into modifiers stored in a ModDB.
 *
 * ## Responsibilities
 *
 * 1. Parse stat text from allocated nodes
 * 2. Handle mastery effect selections
 * 3. Determine node type for proper source tracking
 * 4. Return ModDB with all passive modifiers
 *
 * ## Node Types Handled
 *
 * - **normal**: Basic stat nodes
 * - **notable**: Larger nodes with more significant bonuses
 * - **keystone**: Unique mechanics that change gameplay
 * - **mastery**: Nodes with selectable effects
 */

import { ModDB } from '../modifiers/ModDB';
import type { ModParser } from '../modifiers/ModParser';
import type { Mod, ModParseContext } from '../modifiers/types';
import type { TreeData, TreeNode } from 'src/types/tree';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for passive processing.
 */
export interface PassiveProcessorInput {
  /** IDs of allocated passive nodes */
  allocatedNodeIds: string[];

  /** Mastery selections: nodeId -> effectId */
  masterySelections: Record<string, string>;

  /** Tree data for node lookups */
  treeData: TreeData;

  /** Parser for mod text */
  parser: ModParser;
}

/**
 * Result of passive processing.
 */
export interface PassiveProcessorResult {
  /** ModDB containing all passive modifiers */
  passiveDB: ModDB;

  /** Statistics about processing */
  stats: {
    /** Number of nodes processed */
    nodesProcessed: number;

    /** Number of mastery effects applied */
    masteryEffectsApplied: number;

    /** Number of mods created */
    modsCreated: number;

    /** Number of unsupported mods encountered */
    unsupportedMods: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Source identifier for passive tree mods */
const PASSIVE_SOURCE = 'passive';

/** Source identifier for mastery mods */
const MASTERY_SOURCE = 'mastery';

/** Source identifier for ascendancy mods */
const ASCENDANCY_SOURCE = 'ascendancy';

// ============================================================================
// Module-level Warning Flags
// ============================================================================

/**
 * Module-level warning flag to log mastery limitation only once per session.
 *
 * LIFECYCLE: This flag resets when the application is reloaded (page refresh,
 * app restart). It persists across build switches and data reloads within a
 * single session. This is intentional to prevent console spam while still
 * ensuring developers see the warning at least once per session.
 *
 * TESTING: Module-level state persists across tests. Use resetMasteryWarningFlag()
 * in test cleanup if testing warning behavior.
 */
let masteryLimitationWarned = false;

/**
 * Reset warning flag for testing purposes.
 * Call this in test cleanup to ensure warnings can be tested in isolation.
 */
export function resetMasteryWarningFlag(): void {
  masteryLimitationWarned = false;
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process allocated passive nodes into a ModDB.
 *
 * @param input - Processing input with node IDs, masteries, tree data, parser
 * @returns ModDB containing all passive modifiers
 */
export function processPassives(input: PassiveProcessorInput): PassiveProcessorResult {
  const { allocatedNodeIds, masterySelections, treeData, parser } = input;

  const passiveDB = new ModDB({ actor: 'player' });
  const stats = {
    nodesProcessed: 0,
    masteryEffectsApplied: 0,
    modsCreated: 0,
    unsupportedMods: 0,
  };

  // Process each allocated node
  for (const nodeId of allocatedNodeIds) {
    const node = treeData.nodes.get(nodeId);
    if (!node) {
      // Intentionally treat unknown/missing node IDs as a no-op:
      // this is the only validation for allocatedNodeIds and we do not
      // throw or log an error (e.g. class start nodes with no stats).
      continue;
    }

    stats.nodesProcessed++;

    // Determine source based on node type
    const source = getNodeSource(node);

    // Process node stats
    const nodeMods = processNodeStats(node, parser, source);
    for (const mod of nodeMods) {
      passiveDB.addMod(mod);
      stats.modsCreated++;
    }

    // Process mastery selection if applicable
    if (node.isMastery) {
      const masteryMods = processMasterySelection(
        node,
        nodeId,
        masterySelections,
        parser
      );

      if (masteryMods.length > 0) {
        stats.masteryEffectsApplied++;
        for (const mod of masteryMods) {
          passiveDB.addMod(mod);
          stats.modsCreated++;
        }
      }
    }
  }

  return { passiveDB, stats };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the source type based on node characteristics.
 *
 * Priority order (first match wins):
 * 1. Ascendancy nodes (node.ascendancy is truthy)
 * 2. Mastery nodes (node.isMastery is true)
 * 3. Regular passive nodes (default)
 */
function getNodeSource(node: TreeNode): 'passive' | 'mastery' | 'ascendancy' {
  if (node.ascendancy) {
    return ASCENDANCY_SOURCE;
  }
  if (node.isMastery) {
    return MASTERY_SOURCE;
  }
  return PASSIVE_SOURCE;
}

/**
 * Process a node's stat text into Mod objects.
 *
 * @param node - The tree node to process
 * @param parser - ModParser instance
 * @param source - Source type for the mods
 * @returns Array of parsed Mod objects
 */
function processNodeStats(
  node: TreeNode,
  parser: ModParser,
  source: 'passive' | 'mastery' | 'ascendancy'
): Mod[] {
  const mods: Mod[] = [];

  if (!node.stats || node.stats.length === 0) {
    return mods;
  }

  // Create parse context for this node
  const context: ModParseContext = {
    source,
    sourceId: node.id,
  };

  // Parse each stat line
  for (const statText of node.stats) {
    const result = parser.parse(statText, context);

    if (result.success && result.mods.length > 0) {
      mods.push(...result.mods);
    }
    // Note: We don't track unsupported mods in stats here to avoid
    // inflating the count with display-only mods
  }

  return mods;
}

/**
 * Process mastery effect selection for a mastery node.
 *
 * **KNOWN LIMITATION**: This function currently returns an empty array because
 * mastery effect stats are stored in raw tree data (masteryEffects array) which
 * is not available through the optimized TreeNode structure. Allocated mastery
 * nodes will NOT contribute their selected bonuses until this is addressed.
 *
 * To fix this, one of these approaches is needed:
 * 1. Pass raw tree data with masteryEffects through the processor input
 * 2. Pre-process masteryEffects into a lookup map in CalcSetup
 * 3. Extend TreeNode to include masteryEffects data
 *
 * @param _node - The mastery node (unused - see limitation above)
 * @param nodeId - The node ID for looking up selection
 * @param masterySelections - Map of nodeId -> selected effectId
 * @param _parser - ModParser instance (unused - see limitation above)
 * @returns Empty array until mastery effect lookup is implemented
 */
function processMasterySelection(
  _node: TreeNode,
  nodeId: string,
  masterySelections: Record<string, string>,
  _parser: ModParser
): Mod[] {
  const mods: Mod[] = [];

  // Check if there's a selection for this mastery node.
  // Early return keeps structure minimal while effect processing is unimplemented.
  const selectedEffectId = masterySelections[nodeId];
  if (!selectedEffectId) {
    return mods; // No selection = no mods (same as implemented behavior)
  }

  // LIMITATION: Cannot process mastery effects without raw tree data access.
  // The masteryEffects array (containing effect stats) is only in raw tree data,
  // not in the optimized TreeNode structure passed to this processor.
  //
  // Future implementation would:
  // 1. Look up mastery effect by ID from raw tree data
  // 2. Parse effect stats using the parser
  // 3. Return mods with source: 'mastery', sourceId: `${nodeId}:${selectedEffectId}`
  //
  // Log a warning once per session so this limitation is visible during development.
  if (!masteryLimitationWarned) {
    console.warn(
      '[PassiveProcessor] Mastery selections found but cannot be processed: ' +
        'masteryEffects data not available in TreeNode structure. ' +
        'This warning appears once per session.',
      { nodeId, selectedEffectId }
    );
    masteryLimitationWarned = true;
  }

  return mods;
}

// ============================================================================
// Incremental Update Support
// ============================================================================

/**
 * Calculate the difference between two sets of allocated nodes.
 *
 * @param oldNodeIds - Previously allocated node IDs
 * @param newNodeIds - Currently allocated node IDs
 * @returns Added and removed node IDs
 */
export function diffAllocatedNodes(
  oldNodeIds: string[],
  newNodeIds: string[]
): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldNodeIds);
  const newSet = new Set(newNodeIds);

  const added: string[] = [];
  const removed: string[] = [];

  // Find added nodes
  for (const id of newNodeIds) {
    if (!oldSet.has(id)) {
      added.push(id);
    }
  }

  // Find removed nodes
  for (const id of oldNodeIds) {
    if (!newSet.has(id)) {
      removed.push(id);
    }
  }

  return { added, removed };
}

/**
 * Update a passiveDB incrementally based on node changes.
 *
 * @param passiveDB - Existing ModDB to update
 * @param added - Node IDs that were added
 * @param removed - Node IDs that were removed
 * @param treeData - Tree data for node lookups
 * @param masterySelections - Current mastery selections
 * @param parser - ModParser instance
 */
export function updatePassivesIncremental(
  passiveDB: ModDB,
  added: string[],
  removed: string[],
  treeData: TreeData,
  masterySelections: Record<string, string>,
  parser: ModParser
): void {
  // Remove mods from removed nodes
  for (const nodeId of removed) {
    passiveDB.removeBySource(PASSIVE_SOURCE, nodeId);
    passiveDB.removeBySource(ASCENDANCY_SOURCE, nodeId);

    // Also remove any mastery mods from this node.
    // Mastery sourceId format is "nodeId:effectId".
    //
    // TODO: Handle mastery selection CHANGES on existing nodes. Currently this only
    // handles node removal. If a user changes mastery selection from effect A to B
    // without deallocating the node, the old effect's mods won't be removed because:
    // 1. The node isn't in the 'removed' array (still allocated)
    // 2. masterySelections[nodeId] returns the NEW selection, not the old one
    //
    // When mastery processing is implemented, either:
    // - Track old masterySelections to diff against, or
    // - Use wildcard removal: removeBySourcePrefix(MASTERY_SOURCE, `${nodeId}:`)
    const masteryEffectId = masterySelections[nodeId];
    if (masteryEffectId) {
      passiveDB.removeBySource(MASTERY_SOURCE, `${nodeId}:${masteryEffectId}`);
    }
  }

  // Add mods from added nodes
  for (const nodeId of added) {
    const node = treeData.nodes.get(nodeId);
    if (!node) continue;

    const source = getNodeSource(node);
    const nodeMods = processNodeStats(node, parser, source);
    for (const mod of nodeMods) {
      passiveDB.addMod(mod);
    }

    // Process mastery if applicable
    if (node.isMastery) {
      const masteryMods = processMasterySelection(
        node,
        nodeId,
        masterySelections,
        parser
      );
      for (const mod of masteryMods) {
        passiveDB.addMod(mod);
      }
    }
  }
}
