/**
 * ItemProcessor - Process Equipped Items
 *
 * Converts equipped items into modifiers stored in per-slot ModDBs.
 * Handles both weapon sets (main and swap) separately.
 *
 * ## Responsibilities
 *
 * 1. Parse all mod types (implicit, explicit, crafted, enchant, rune)
 * 2. Create separate ModDB per item slot
 * 3. Handle both weapon sets for weapon swap support
 * 4. Track local vs global modifiers
 *
 * ## Mod Types Processed
 *
 * - **implicitMods**: Base item implicit modifiers
 * - **explicitMods**: Rolled/dropped modifiers
 * - **craftedMods**: Bench crafted modifiers
 * - **enchantMods**: Enchantment modifiers (lab, etc.)
 * - **runeMods**: Rune socket modifiers (PoE2)
 */

import { ModDB } from '../modifiers/ModDB';
import type { ModParser } from '../modifiers/ModParser';
import type { Mod, ModParseContext } from '../modifiers/types';
import type { Item } from 'src/protos/pob2_pb';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for item processing.
 */
export interface ItemProcessorInput {
  /** Equipped items by slot name */
  equippedItems: Record<string, Item>;

  /** Parser for mod text */
  parser: ModParser;

  /** Slots to process (defaults to all slots) */
  slotsToProcess?: string[];
}

/**
 * Result of item processing.
 */
export interface ItemProcessorResult {
  /** ModDBs by slot name */
  itemDBs: Map<string, ModDB>;

  /** Statistics about processing */
  stats: {
    /** Number of items processed */
    itemsProcessed: number;

    /** Number of mods created */
    modsCreated: number;

    /** Breakdown by mod type */
    modsByType: {
      implicit: number;
      explicit: number;
      crafted: number;
      enchant: number;
      rune: number;
    };
  };
}

/**
 * Mod category for tracking source type.
 */
type ModCategory = 'implicit' | 'explicit' | 'crafted' | 'enchant' | 'rune';

// ============================================================================
// Constants
// ============================================================================

/** Source identifier for item mods */
const ITEM_SOURCE = 'item';

/** Weapon slots in the main set (set 1) */
export const MAIN_WEAPON_SLOTS = ['weapon1', 'weapon1swap', 'offhand1'] as const;

/** Weapon slots in the swap set (set 2) */
export const SWAP_WEAPON_SLOTS = ['weapon2', 'weapon2swap', 'offhand2'] as const;

/** All equipment slots */
export const ALL_SLOTS = [
  'weapon1',
  'offhand1',
  'weapon2',
  'offhand2',
  'helmet',
  'body',
  'gloves',
  'boots',
  'belt',
  'amulet',
  'ring1',
  'ring2',
] as const;

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process equipped items into per-slot ModDBs.
 *
 * @param input - Processing input with items, parser, and optional slot filter
 * @returns Map of slot name to ModDB
 */
export function processItems(input: ItemProcessorInput): ItemProcessorResult {
  const { equippedItems, parser, slotsToProcess } = input;

  const itemDBs = new Map<string, ModDB>();
  const stats = {
    itemsProcessed: 0,
    modsCreated: 0,
    modsByType: {
      implicit: 0,
      explicit: 0,
      crafted: 0,
      enchant: 0,
      rune: 0,
    },
  };

  // Determine which slots to process
  const slots = slotsToProcess ?? Object.keys(equippedItems);

  for (const slot of slots) {
    const item = equippedItems[slot];
    if (!item) {
      // No item in this slot - create empty ModDB
      itemDBs.set(slot, new ModDB({ actor: 'player' }));
      continue;
    }

    stats.itemsProcessed++;

    // Create ModDB for this slot
    const slotDB = new ModDB({ actor: 'player' });

    // Process all mod categories
    const modCounts = processItemMods(item, slot, parser, slotDB);

    // Update statistics
    stats.modsCreated += modCounts.total;
    stats.modsByType.implicit += modCounts.implicit;
    stats.modsByType.explicit += modCounts.explicit;
    stats.modsByType.crafted += modCounts.crafted;
    stats.modsByType.enchant += modCounts.enchant;
    stats.modsByType.rune += modCounts.rune;

    itemDBs.set(slot, slotDB);
  }

  return { itemDBs, stats };
}

/**
 * Process items for both weapon sets.
 *
 * @param equippedItems - All equipped items
 * @param parser - ModParser instance
 * @returns Main and swap weapon set ModDBs
 */
export function processItemsBothSets(
  equippedItems: Record<string, Item>,
  parser: ModParser
): {
  itemDBs: Map<string, ModDB>;
  itemDBsSwap: Map<string, ModDB>;
  stats: ItemProcessorResult['stats'];
} {
  // Determine main set slots
  const mainSlots = ALL_SLOTS.filter((slot) => !isSwapSlot(slot));

  // Process main set (includes non-weapon slots)
  const mainResult = processItems({
    equippedItems,
    parser,
    slotsToProcess: mainSlots,
  });

  // Process swap weapon slots
  const swapSlots = ALL_SLOTS.filter((slot) => isSwapSlot(slot));
  const swapResult = processItems({
    equippedItems,
    parser,
    slotsToProcess: swapSlots,
  });

  // Merge statistics
  const stats: ItemProcessorResult['stats'] = {
    itemsProcessed: mainResult.stats.itemsProcessed + swapResult.stats.itemsProcessed,
    modsCreated: mainResult.stats.modsCreated + swapResult.stats.modsCreated,
    modsByType: {
      implicit:
        mainResult.stats.modsByType.implicit + swapResult.stats.modsByType.implicit,
      explicit:
        mainResult.stats.modsByType.explicit + swapResult.stats.modsByType.explicit,
      crafted:
        mainResult.stats.modsByType.crafted + swapResult.stats.modsByType.crafted,
      enchant:
        mainResult.stats.modsByType.enchant + swapResult.stats.modsByType.enchant,
      rune: mainResult.stats.modsByType.rune + swapResult.stats.modsByType.rune,
    },
  };

  return {
    itemDBs: mainResult.itemDBs,
    itemDBsSwap: swapResult.itemDBs,
    stats,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a slot is a weapon swap slot.
 */
function isSwapSlot(slot: string): boolean {
  return slot === 'weapon2' || slot === 'offhand2';
}

/**
 * Process all mod categories for an item.
 *
 * @param item - The item to process
 * @param slot - The equipment slot
 * @param parser - ModParser instance
 * @param slotDB - ModDB to add mods to
 * @returns Count of mods by category
 */
function processItemMods(
  item: Item,
  slot: string,
  parser: ModParser,
  slotDB: ModDB
): { total: number } & Record<ModCategory, number> {
  const counts = {
    total: 0,
    implicit: 0,
    explicit: 0,
    crafted: 0,
    enchant: 0,
    rune: 0,
  };

  // Create base context for this item
  const baseContext: ModParseContext = {
    source: ITEM_SOURCE,
    sourceId: item.id,
    slotName: slot,
  };

  // Process each mod category
  counts.implicit = processModList(
    item.implicitMods,
    'implicit',
    baseContext,
    parser,
    slotDB
  );
  counts.explicit = processModList(
    item.explicitMods,
    'explicit',
    baseContext,
    parser,
    slotDB
  );
  counts.crafted = processModList(
    item.craftedMods,
    'crafted',
    baseContext,
    parser,
    slotDB
  );
  counts.enchant = processModList(
    item.enchantMods,
    'enchant',
    baseContext,
    parser,
    slotDB
  );
  counts.rune = processModList(item.runeMods, 'rune', baseContext, parser, slotDB);

  counts.total =
    counts.implicit +
    counts.explicit +
    counts.crafted +
    counts.enchant +
    counts.rune;

  return counts;
}

/**
 * Process a list of mod strings and add to ModDB.
 *
 * @param mods - Array of mod text strings
 * @param category - The mod category (for source tracking)
 * @param baseContext - Base parse context
 * @param parser - ModParser instance
 * @param slotDB - ModDB to add mods to
 * @returns Number of mods added
 */
function processModList(
  mods: string[],
  category: ModCategory,
  baseContext: ModParseContext,
  parser: ModParser,
  slotDB: ModDB
): number {
  let count = 0;

  for (const modText of mods) {
    // Create context with category suffix for tracing
    const context: ModParseContext = {
      ...baseContext,
      sourceId: `${baseContext.sourceId}:${category}`,
    };

    const result = parser.parse(modText, context);

    if (result.success && result.mods.length > 0) {
      for (const mod of result.mods) {
        slotDB.addMod(mod);
        count++;
      }
    }
  }

  return count;
}

// ============================================================================
// Incremental Update Support
// ============================================================================

/**
 * Process a single item and return its ModDB.
 *
 * Used for incremental updates when only one slot changes.
 *
 * @param item - The item to process
 * @param slot - The equipment slot
 * @param parser - ModParser instance
 * @returns ModDB for this item
 */
export function processSingleItem(
  item: Item,
  slot: string,
  parser: ModParser
): ModDB {
  const slotDB = new ModDB({ actor: 'player' });
  processItemMods(item, slot, parser, slotDB);
  return slotDB;
}

/**
 * Update itemDBs for a specific slot.
 *
 * @param itemDBs - Existing item ModDBs map
 * @param slot - Slot to update
 * @param item - New item (or undefined to clear)
 * @param parser - ModParser instance
 */
export function updateItemSlot(
  itemDBs: Map<string, ModDB>,
  slot: string,
  item: Item | undefined,
  parser: ModParser
): void {
  if (!item) {
    // Remove item - replace with empty ModDB
    itemDBs.set(slot, new ModDB({ actor: 'player' }));
    return;
  }

  // Process new item
  const slotDB = processSingleItem(item, slot, parser);
  itemDBs.set(slot, slotDB);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all mods from itemDBs as a flat array.
 *
 * @param itemDBs - Map of slot to ModDB
 * @returns All mods from all slots
 */
export function getAllItemMods(itemDBs: Map<string, ModDB>): Mod[] {
  const allMods: Mod[] = [];

  for (const slotDB of itemDBs.values()) {
    for (const statName of slotDB.getStatNames()) {
      const mods = (slotDB as unknown as { mods: Map<string, Mod[]> }).mods.get(
        statName
      );
      if (mods) {
        allMods.push(...mods);
      }
    }
  }

  return allMods;
}

/**
 * Check if a slot has an item equipped.
 *
 * @param itemDBs - Map of slot to ModDB
 * @param slot - Slot name to check
 * @returns True if slot has mods (item equipped)
 */
export function hasItemInSlot(itemDBs: Map<string, ModDB>, slot: string): boolean {
  const slotDB = itemDBs.get(slot);
  return slotDB !== undefined && slotDB.size > 0;
}
