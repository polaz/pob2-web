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
 */
function getNodeSource(node: TreeNode): 'passive' | 'mastery' | 'ascendancy' {
  if (node.ascendancy) {
    return ASCENDANCY_SOURCE;
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
 * @param node - The mastery node (unused but kept for future reference)
 * @param nodeId - The node ID for looking up selection
 * @param masterySelections - Map of nodeId -> selected effectId
 * @param parser - ModParser instance
 * @returns Array of Mod objects from the selected mastery effect
 */
function processMasterySelection(
  _node: TreeNode,
  nodeId: string,
  masterySelections: Record<string, string>,
  _parser: ModParser
): Mod[] {
  const mods: Mod[] = [];

  // Check if there's a selection for this mastery node
  const selectedEffectId = masterySelections[nodeId];
  if (!selectedEffectId) {
    return mods;
  }

  // Mastery effects are stored in the raw tree data, not the optimized TreeNode
  // For now, we parse the effect ID as a stat reference
  // The actual mastery effect lookup would require access to raw tree data
  // with masteryEffects array

  // Note: In a full implementation, we would:
  // 1. Create a parse context with source: 'mastery', sourceId: `${nodeId}:${selectedEffectId}`
  // 2. Look up the mastery effect stats from the raw tree data's masteryEffects array
  // 3. Parse those stats using the parser
  //
  // Example of how it would work with raw data:
  // const rawNode = rawTreeData.nodes[nodeId];
  // const effect = rawNode?.masteryEffects?.find(e => String(e.effect) === selectedEffectId);
  // if (effect) {
  //   for (const statText of effect.stats) {
  //     const result = parser.parse(statText, { source: 'mastery', sourceId: ... });
  //     if (result.success) mods.push(...result.mods);
  //   }
  // }

  // For now, we'll need to integrate mastery effect lookup in CalcSetup
  // when we have access to raw tree data

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

    // Also remove any mastery mods from this node
    // Mastery sourceId format is "nodeId:effectId"
    // We need to remove all mods where sourceId starts with "nodeId:"
    // Since removeBySource doesn't support wildcards, we need to handle this differently
    // For now, just remove exact matches for known mastery patterns
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
