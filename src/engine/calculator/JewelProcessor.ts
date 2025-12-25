/**
 * JewelProcessor - Process Socketed Jewels
 *
 * Converts socketed jewels into modifiers added to the passiveDB.
 *
 * ## TODO: Cluster Jewel Support (Issue #133)
 *
 * **IMPORTANT**: This is a SIMPLIFIED implementation that only applies direct
 * stat modifiers from jewels. PoE2 jewels DO have cluster/radius effects that
 * transform nearby nodes - this needs proper implementation.
 *
 * Current limitations:
 * - Does NOT handle radius-based effects
 * - Does NOT transform nodes within jewel radius
 * - Only applies jewel's own stat mods directly
 *
 * See: https://github.com/polaz/pob2-web/issues/133
 *
 * ## Socket Identification
 *
 * Jewel sockets are identified by the tree node ID where they're socketed.
 * The Build proto contains a mapping of socketNodeId -> Item (jewel).
 */

import { ModDB } from '../modifiers/ModDB';
import type { ModParser } from '../modifiers/ModParser';
import type { ModParseContext } from '../modifiers/types';
import type { Item } from 'src/protos/pob2_pb';
import type { JewelSocket } from './Environment';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for jewel processing.
 */
export interface JewelProcessorInput {
  /** Map of socket node ID to socketed jewel */
  jewelSockets: Map<string, JewelSocket>;

  /** Parser for mod text */
  parser: ModParser;
}

/**
 * Result of jewel processing.
 */
export interface JewelProcessorResult {
  /** ModDB containing all jewel modifiers (to be merged into passiveDB) */
  jewelDB: ModDB;

  /** Statistics about processing */
  stats: {
    /** Number of jewel sockets with jewels */
    jewelsProcessed: number;

    /** Number of mods created */
    modsCreated: number;

    /** Number of empty sockets */
    emptySockets: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Source identifier for jewel mods */
const JEWEL_SOURCE = 'jewel';

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process socketed jewels into a ModDB.
 *
 * @param input - Processing input with jewel sockets and parser
 * @returns ModDB containing all jewel modifiers
 */
export function processJewels(input: JewelProcessorInput): JewelProcessorResult {
  const { jewelSockets, parser } = input;

  const jewelDB = new ModDB({ actor: 'player' });
  const stats = {
    jewelsProcessed: 0,
    modsCreated: 0,
    emptySockets: 0,
  };

  for (const [nodeId, socket] of jewelSockets) {
    if (!socket.jewel) {
      stats.emptySockets++;
      continue;
    }

    stats.jewelsProcessed++;

    // Process the jewel's mods
    const modCount = processJewelMods(socket.jewel, nodeId, parser, jewelDB);
    stats.modsCreated += modCount;
  }

  return { jewelDB, stats };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process all mods from a jewel and add to ModDB.
 *
 * @param jewel - The jewel item to process
 * @param socketNodeId - The tree node ID where the jewel is socketed
 * @param parser - ModParser instance
 * @param jewelDB - ModDB to add mods to
 * @returns Number of mods added
 */
function processJewelMods(
  jewel: Item,
  socketNodeId: string,
  parser: ModParser,
  jewelDB: ModDB
): number {
  let modCount = 0;

  // Create parse context for this jewel
  const context: ModParseContext = {
    source: JEWEL_SOURCE,
    sourceId: `${socketNodeId}:${jewel.id}`,
  };

  // Jewels have the same mod structure as other items
  // Process all mod categories

  // Implicit mods
  for (const modText of jewel.implicitMods) {
    const result = parser.parse(modText, context);
    if (result.success && result.mods.length > 0) {
      for (const mod of result.mods) {
        jewelDB.addMod(mod);
        modCount++;
      }
    }
  }

  // Explicit mods
  for (const modText of jewel.explicitMods) {
    const result = parser.parse(modText, context);
    if (result.success && result.mods.length > 0) {
      for (const mod of result.mods) {
        jewelDB.addMod(mod);
        modCount++;
      }
    }
  }

  // Crafted mods (if applicable)
  for (const modText of jewel.craftedMods) {
    const result = parser.parse(modText, context);
    if (result.success && result.mods.length > 0) {
      for (const mod of result.mods) {
        jewelDB.addMod(mod);
        modCount++;
      }
    }
  }

  // Corrupted implicit mods (enchants are used for corrupted implicits sometimes)
  for (const modText of jewel.enchantMods) {
    const result = parser.parse(modText, context);
    if (result.success && result.mods.length > 0) {
      for (const mod of result.mods) {
        jewelDB.addMod(mod);
        modCount++;
      }
    }
  }

  return modCount;
}

// ============================================================================
// Incremental Update Support
// ============================================================================

/**
 * Process a single jewel socket.
 *
 * Used for incremental updates when only one socket changes.
 *
 * @param jewel - The jewel to process (or null for empty socket)
 * @param socketNodeId - The tree node ID
 * @param parser - ModParser instance
 * @returns ModDB containing this jewel's mods
 */
export function processSingleJewel(
  jewel: Item | null,
  socketNodeId: string,
  parser: ModParser
): ModDB {
  const jewelDB = new ModDB({ actor: 'player' });

  if (jewel) {
    processJewelMods(jewel, socketNodeId, parser, jewelDB);
  }

  return jewelDB;
}

/**
 * Update passiveDB for a specific jewel socket change.
 *
 * Removes old mods and adds new ones from the updated jewel.
 *
 * @param passiveDB - PassiveDB to update
 * @param socketNodeId - The socket node ID that changed
 * @param oldJewel - Previous jewel (or null)
 * @param newJewel - New jewel (or null)
 * @param parser - ModParser instance
 */
export function updateJewelSocket(
  passiveDB: ModDB,
  socketNodeId: string,
  oldJewel: Item | null,
  newJewel: Item | null,
  parser: ModParser
): void {
  // Remove old jewel's mods
  if (oldJewel) {
    passiveDB.removeBySource(JEWEL_SOURCE, `${socketNodeId}:${oldJewel.id}`);
  }

  // Add new jewel's mods
  if (newJewel) {
    const context: ModParseContext = {
      source: JEWEL_SOURCE,
      sourceId: `${socketNodeId}:${newJewel.id}`,
    };

    // Process all mod types
    const allMods = [
      ...newJewel.implicitMods,
      ...newJewel.explicitMods,
      ...newJewel.craftedMods,
      ...newJewel.enchantMods,
    ];

    for (const modText of allMods) {
      const result = parser.parse(modText, context);
      if (result.success && result.mods.length > 0) {
        for (const mod of result.mods) {
          passiveDB.addMod(mod);
        }
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create JewelSocket map from Build data.
 *
 * Converts the Build's jewel socket data into the JewelSocket map format.
 * This is a helper for CalcSetup.
 *
 * @param socketedJewels - Map of socket node ID to jewel item
 * @returns JewelSocket map
 */
export function createJewelSocketMap(
  socketedJewels: Record<string, Item> | undefined
): Map<string, JewelSocket> {
  const socketMap = new Map<string, JewelSocket>();

  if (!socketedJewels) {
    return socketMap;
  }

  for (const [nodeId, jewel] of Object.entries(socketedJewels)) {
    socketMap.set(nodeId, {
      nodeId,
      jewel,
    });
  }

  return socketMap;
}

/**
 * Get list of socket node IDs that have jewels.
 *
 * @param jewelSockets - Map of socket node ID to JewelSocket
 * @returns Array of node IDs with socketed jewels
 */
export function getOccupiedSocketIds(
  jewelSockets: Map<string, JewelSocket>
): string[] {
  const occupied: string[] = [];

  for (const [nodeId, socket] of jewelSockets) {
    if (socket.jewel) {
      occupied.push(nodeId);
    }
  }

  return occupied;
}
