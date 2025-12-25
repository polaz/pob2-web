// src/types/local/items.local.ts
// UI-only state extensions for items
// These extend proto-generated types with local-only fields

import type { Item, Socket } from 'src/protos/items_pb';

/**
 * Extended Item with UI state
 * Proto fields + local-only editing/display state
 */
export interface LocalItem extends Item {
  // Editing state
  /** Item is currently being edited */
  editing?: boolean;
  /** Item editor has unsaved changes */
  dirty?: boolean;
  /** Validation errors for current edits */
  validationErrors?: string[];

  // Display state
  /** Item is currently selected in list */
  selected?: boolean;
  /** Item is being dragged */
  dragging?: boolean;
  /** Item is a valid drop target */
  dropTarget?: boolean;
  /** Item is highlighted (search, comparison) */
  highlighted?: boolean;

  // Comparison state
  /** Item is being compared */
  comparing?: boolean;
  /** Stats that are better than equipped item */
  betterStats?: string[];
  /** Stats that are worse than equipped item */
  worseStats?: string[];

  // Computed values (from calculation engine)
  /** Calculated DPS contribution */
  dpsContribution?: number;
  /** Calculated effective HP contribution */
  ehpContribution?: number;
  /** Overall item score (for sorting) */
  score?: number;
}

/**
 * Extended Socket with UI state
 */
export interface LocalSocket extends Socket {
  /** Socket is currently selected */
  selected?: boolean;
  /** Socket is valid for current gem */
  validForGem?: boolean;
}

/**
 * Item slot UI state
 */
export interface ItemSlotState {
  /** Slot identifier */
  slotId: string;
  /** Currently equipped item ID (if any) */
  equippedItemId?: string;
  /** Slot is a valid drop target for dragged item */
  validDropTarget?: boolean;
  /** Slot is currently hovered */
  hovered?: boolean;
  /** Slot is locked (e.g., during comparison mode) */
  locked?: boolean;
}

/**
 * Item list filter state
 */
export interface ItemListFilter {
  /** Text search query */
  searchQuery?: string;
  /** Filter by item type */
  itemTypes?: string[];
  /** Filter by rarity */
  rarities?: string[];
  /** Minimum item level */
  minItemLevel?: number;
  /** Maximum item level */
  maxItemLevel?: number;
  /** Show only items with specific mod */
  requiredMod?: string;
  /** Sort field */
  sortBy: 'name' | 'level' | 'rarity' | 'dps' | 'score';
  /** Sort direction */
  sortDirection: 'asc' | 'desc';
}

/**
 * Default item list filter
 */
export const DEFAULT_ITEM_LIST_FILTER: ItemListFilter = {
  sortBy: 'name',
  sortDirection: 'asc',
};

/**
 * Item comparison result
 */
export interface ItemComparisonResult {
  /** First item ID */
  itemAId: string;
  /** Second item ID */
  itemBId: string;
  /** Stat differences (positive = A is better) */
  statDiffs: Record<string, number>;
  /** DPS difference */
  dpsDiff?: number;
  /** EHP difference */
  ehpDiff?: number;
  /** Overall comparison (-1 = A worse, 0 = equal, 1 = A better) */
  overall: -1 | 0 | 1;
}
