/**
 * Draft Overlay Composable
 *
 * Provides merged views of base game data with session-only draft edits.
 * Uses the draft store to overlay user corrections on top of base data.
 *
 * @example
 * ```typescript
 * const { getGemWithDrafts, getItemWithDrafts, getI18nValue } = useDraftOverlay();
 *
 * // Get a gem with any draft edits applied
 * const gem = getGemWithDrafts(baseGem);
 *
 * // Get an i18n value with draft override
 * const name = getI18nValue('gem.fireball.name', gem.name);
 * ```
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDraftStore } from 'src/stores/draftStore';
import { deepMerge } from 'src/utils/dataOverlay';
import type { Gem } from 'src/types/gems';
import type { TreeNode } from 'src/types/tree';
import type { Item } from 'src/protos/pob2_pb';
import type { CustomTreeNode, GemDraft, ItemDraft } from 'src/types/draft';
import { isCustomNodeId } from 'src/types/draft';

/**
 * Composable for accessing game data with draft overlays applied.
 */
export function useDraftOverlay() {
  const draftStore = useDraftStore();
  const {
    skillEdits,
    itemEdits,
    i18nEdits,
    customNodes,
    customConnections,
    editModeEnabled,
    hasChanges,
  } = storeToRefs(draftStore);

  // ============================================================================
  // Gem Overlay Functions
  // ============================================================================

  /**
   * Apply draft edits to a gem.
   * Returns the merged gem with any draft overrides applied.
   *
   * Note: Uses deepMerge for nested object handling. Gem is NOT a protobuf
   * type (defined in types/gems.ts), so the protobuf cloneDeep guideline
   * doesn't apply.
   *
   * @param gem - The base gem data
   * @returns Merged gem with drafts applied
   */
  function getGemWithDrafts(gem: Gem): Gem {
    const draft = skillEdits.value.get(gem.id);
    if (!draft) {
      return gem;
    }
    return deepMerge(gem, draft);
  }

  /**
   * Apply draft edits to multiple gems.
   *
   * @param gems - Array or Map of base gems
   * @returns New collection with drafts applied
   */
  function getGemsWithDrafts(gems: Map<string, Gem>): Map<string, Gem>;
  function getGemsWithDrafts(gems: Gem[]): Gem[];
  function getGemsWithDrafts(
    gems: Map<string, Gem> | Gem[]
  ): Map<string, Gem> | Gem[] {
    if (Array.isArray(gems)) {
      return gems.map((gem) => getGemWithDrafts(gem));
    }

    const result = new Map<string, Gem>();
    for (const [id, gem] of gems) {
      result.set(id, getGemWithDrafts(gem));
    }
    return result;
  }

  /**
   * Check if a gem has draft edits.
   *
   * @param gemId - The gem ID to check
   */
  function hasGemDraft(gemId: string): boolean {
    return skillEdits.value.has(gemId);
  }

  /**
   * Get the raw draft for a gem (without merging).
   *
   * @param gemId - The gem ID
   */
  function getGemDraft(gemId: string): GemDraft | undefined {
    return skillEdits.value.get(gemId);
  }

  // ============================================================================
  // Item Overlay Functions
  // ============================================================================

  /**
   * Apply draft edits to an item.
   *
   * Note: Uses deepMerge for nested object handling. While Item is a protobuf
   * type, the draft is a plain JS object (Partial<Item>) containing only
   * modified fields. The cloneDeep guideline applies to full protobuf message
   * instances with internal state, not partial patches applied to base data.
   *
   * @param item - The base item data
   * @returns Merged item with drafts applied
   */
  function getItemWithDrafts(item: Item): Item {
    const draft = itemEdits.value.get(item.id);
    if (!draft) {
      return item;
    }
    return deepMerge(item, draft);
  }

  /**
   * Apply draft edits to multiple items.
   *
   * @param items - Record or Map of base items
   * @returns New collection with drafts applied
   */
  function getItemsWithDrafts(items: Map<string, Item>): Map<string, Item>;
  function getItemsWithDrafts(items: Record<string, Item>): Record<string, Item>;
  function getItemsWithDrafts(
    items: Map<string, Item> | Record<string, Item>
  ): Map<string, Item> | Record<string, Item> {
    if (items instanceof Map) {
      const result = new Map<string, Item>();
      for (const [id, item] of items) {
        result.set(id, getItemWithDrafts(item));
      }
      return result;
    }

    const result: Record<string, Item> = {};
    for (const [id, item] of Object.entries(items)) {
      result[id] = getItemWithDrafts(item);
    }
    return result;
  }

  /**
   * Check if an item has draft edits.
   *
   * @param itemId - The item ID to check
   */
  function hasItemDraft(itemId: string): boolean {
    return itemEdits.value.has(itemId);
  }

  /**
   * Get the raw draft for an item (without merging).
   *
   * @param itemId - The item ID
   */
  function getItemDraft(itemId: string): ItemDraft | undefined {
    return itemEdits.value.get(itemId);
  }

  // ============================================================================
  // i18n Overlay Functions
  // ============================================================================

  /**
   * Get an i18n value with draft override if available.
   *
   * @param key - Dot-notation key (e.g., 'gem.fireball.name')
   * @param fallback - Fallback value if no draft exists
   * @returns The draft value if exists, otherwise the fallback
   */
  function getI18nValue(key: string, fallback: string): string {
    const draft = i18nEdits.value.get(key);
    return draft ?? fallback;
  }

  /**
   * Check if an i18n key has a draft override.
   *
   * @param key - Dot-notation key to check
   */
  function hasI18nDraft(key: string): boolean {
    return i18nEdits.value.has(key);
  }

  /**
   * Get all i18n drafts matching a prefix.
   *
   * @param prefix - Key prefix (e.g., 'gem.fireball')
   * @returns Map of matching keys to values
   */
  function getI18nDraftsByPrefix(prefix: string): Map<string, string> {
    const result = new Map<string, string>();
    const normalizedPrefix = prefix.endsWith('.') ? prefix : `${prefix}.`;

    for (const [key, value] of i18nEdits.value) {
      if (key.startsWith(normalizedPrefix)) {
        result.set(key, value);
      }
    }

    return result;
  }

  // ============================================================================
  // Tree Node Overlay Functions
  // ============================================================================

  /**
   * Get a tree node, checking custom nodes first.
   * Returns the custom node if it exists, otherwise returns the base node.
   *
   * @param nodeId - The node ID to look up
   * @param baseNodes - Map of base tree nodes
   * @returns The custom node, base node, or undefined
   */
  function getTreeNode(
    nodeId: string,
    baseNodes: Map<string, TreeNode>
  ): TreeNode | CustomTreeNode | undefined {
    // Check custom nodes first
    if (isCustomNodeId(nodeId)) {
      return customNodes.value.get(nodeId);
    }

    // Fall back to base nodes
    return baseNodes.get(nodeId);
  }

  /**
   * Get all nodes including custom nodes.
   * Returns a combined view of base nodes and custom nodes.
   *
   * @param baseNodes - Map of base tree nodes
   * @returns Combined map including custom nodes
   */
  function getAllNodes(
    baseNodes: Map<string, TreeNode>
  ): Map<string, TreeNode | CustomTreeNode> {
    const result = new Map<string, TreeNode | CustomTreeNode>(baseNodes);

    // Add custom nodes
    for (const [id, node] of customNodes.value) {
      result.set(id, node);
    }

    return result;
  }

  /**
   * Get neighbors for a node, including custom connections.
   *
   * @param nodeId - The node ID
   * @param baseNodes - Map of base tree nodes
   * @returns Set of neighbor node IDs
   */
  function getNodeNeighbors(
    nodeId: string,
    baseNodes: Map<string, TreeNode>
  ): Set<string> {
    const neighbors = new Set<string>();

    // Get base node neighbors if it's a base node
    if (!isCustomNodeId(nodeId)) {
      const baseNode = baseNodes.get(nodeId);
      if (baseNode) {
        for (const neighbor of baseNode.neighbors) {
          neighbors.add(neighbor);
        }
      }
    }

    // Add custom connections
    for (const [source, target] of customConnections.value) {
      if (source === nodeId) {
        neighbors.add(target);
      } else if (target === nodeId) {
        neighbors.add(source);
      }
    }

    return neighbors;
  }

  /**
   * Check if a node ID refers to a custom node.
   */
  function isCustomNode(nodeId: string): boolean {
    return isCustomNodeId(nodeId);
  }

  /**
   * Get all custom node IDs.
   */
  const allCustomNodeIds = computed((): string[] => {
    return Array.from(customNodes.value.keys());
  });

  /**
   * Get all custom connections.
   */
  const allCustomConnections = computed((): Array<[string, string]> => {
    return [...customConnections.value];
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Get a summary of all modifications.
   */
  const modificationSummary = computed(() => {
    return {
      gems: Array.from(skillEdits.value.keys()),
      items: Array.from(itemEdits.value.keys()),
      i18n: Array.from(i18nEdits.value.keys()),
      customNodes: Array.from(customNodes.value.keys()),
      connectionCount: customConnections.value.length,
      hasChanges: hasChanges.value,
    };
  });

  /**
   * Check if any entity (gem, item, or i18n key) has draft edits.
   *
   * @param type - Entity type
   * @param id - Entity ID or i18n key
   */
  function hasDraft(type: 'gem' | 'item' | 'i18n', id: string): boolean {
    switch (type) {
      case 'gem':
        return hasGemDraft(id);
      case 'item':
        return hasItemDraft(id);
      case 'i18n':
        return hasI18nDraft(id);
    }
  }

  return {
    // State refs (readonly)
    editModeEnabled,
    hasChanges,

    // Gem overlay
    getGemWithDrafts,
    getGemsWithDrafts,
    hasGemDraft,
    getGemDraft,

    // Item overlay
    getItemWithDrafts,
    getItemsWithDrafts,
    hasItemDraft,
    getItemDraft,

    // i18n overlay
    getI18nValue,
    hasI18nDraft,
    getI18nDraftsByPrefix,

    // Tree node overlay
    getTreeNode,
    getAllNodes,
    getNodeNeighbors,
    isCustomNode,
    allCustomNodeIds,
    allCustomConnections,

    // Utilities
    modificationSummary,
    hasDraft,
  };
}
