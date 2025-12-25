/**
 * Draft Store - manages session-only user edits to game data.
 *
 * This store holds temporary edits that overlay on top of base game data.
 * All drafts are lost on page refresh (intentional - no IndexedDB persistence).
 *
 * Use cases:
 * - Skill/gem name corrections
 * - Item name/description edits
 * - i18n string additions/corrections
 * - Custom tree nodes for sandbox mode
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import type {
  CustomTreeNode,
  NodeConnection,
  GemDraft,
  ItemDraft,
  DraftStats,
  DraftSnapshot,
  CustomNodeOrigin,
} from 'src/types/draft';
import { generateCustomNodeId } from 'src/types/draft';
import type { TreeNodeType } from 'src/types/tree';
import { deepMerge } from 'src/utils/dataOverlay';

export const useDraftStore = defineStore('draft', () => {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Skill/gem edits keyed by gem ID.
   * Uses shallowRef for performance with large Maps.
   */
  const skillEdits = shallowRef<Map<string, GemDraft>>(new Map());

  /**
   * Item edits keyed by item ID.
   */
  const itemEdits = shallowRef<Map<string, ItemDraft>>(new Map());

  /**
   * i18n string edits keyed by dot-notation path.
   * Example: 'gem.fireball.name' → 'Corrected Fireball Name'
   */
  const i18nEdits = shallowRef<Map<string, string>>(new Map());

  /**
   * Custom tree nodes keyed by node ID (prefixed with 'custom_').
   */
  const customNodes = shallowRef<Map<string, CustomTreeNode>>(new Map());

  /**
   * Custom connections between nodes.
   * Each connection is a tuple of [sourceId, targetId].
   * Connections can reference both custom nodes and base tree nodes.
   */
  const customConnections = ref<NodeConnection[]>([]);

  /**
   * Whether edit mode is currently enabled.
   * When enabled, UI shows edit controls and highlights editable fields.
   */
  const editModeEnabled = ref(false);

  // ============================================================================
  // Getters
  // ============================================================================

  /** Whether there are any unsaved changes */
  const hasChanges = computed((): boolean => {
    return (
      skillEdits.value.size > 0 ||
      itemEdits.value.size > 0 ||
      i18nEdits.value.size > 0 ||
      customNodes.value.size > 0 ||
      customConnections.value.length > 0
    );
  });

  /** Statistics about current draft state */
  const stats = computed((): DraftStats => {
    const gemEdits = skillEdits.value.size;
    const itemEditsCount = itemEdits.value.size;
    const i18nEditsCount = i18nEdits.value.size;
    const customNodesCount = customNodes.value.size;
    const customConnectionsCount = customConnections.value.length;

    return {
      gemEdits,
      itemEdits: itemEditsCount,
      i18nEdits: i18nEditsCount,
      customNodes: customNodesCount,
      customConnections: customConnectionsCount,
      total:
        gemEdits +
        itemEditsCount +
        i18nEditsCount +
        customNodesCount +
        customConnectionsCount,
    };
  });

  /** Get all custom node IDs */
  const customNodeIds = computed((): string[] => {
    return Array.from(customNodes.value.keys());
  });

  /** Get all edited gem IDs */
  const editedGemIds = computed((): string[] => {
    return Array.from(skillEdits.value.keys());
  });

  /** Get all edited item IDs */
  const editedItemIds = computed((): string[] => {
    return Array.from(itemEdits.value.keys());
  });

  // ============================================================================
  // Skill/Gem Edit Actions
  // ============================================================================

  /**
   * Set or update a skill/gem edit.
   * @param gemId - The gem ID to edit
   * @param draft - Partial gem data to override
   */
  function setSkillEdit(gemId: string, draft: GemDraft): void {
    const newMap = new Map(skillEdits.value);
    const existing = newMap.get(gemId);
    // Use deepMerge to handle nested objects (tags, requirements, etc.)
    newMap.set(gemId, existing ? deepMerge(existing, draft) : draft);
    skillEdits.value = newMap;
  }

  /**
   * Get the draft edit for a gem.
   * @param gemId - The gem ID to look up
   * @returns The draft edit or undefined if not edited
   */
  function getSkillEdit(gemId: string): GemDraft | undefined {
    return skillEdits.value.get(gemId);
  }

  /**
   * Check if a gem has draft edits.
   * @param gemId - The gem ID to check
   */
  function hasSkillEdit(gemId: string): boolean {
    return skillEdits.value.has(gemId);
  }

  /**
   * Remove a skill/gem edit.
   * @param gemId - The gem ID to remove edits for
   */
  function removeSkillEdit(gemId: string): void {
    const newMap = new Map(skillEdits.value);
    newMap.delete(gemId);
    skillEdits.value = newMap;
  }

  /**
   * Clear all skill/gem edits.
   */
  function clearSkillEdits(): void {
    skillEdits.value = new Map();
  }

  // ============================================================================
  // Item Edit Actions
  // ============================================================================

  /**
   * Set or update an item edit.
   * @param itemId - The item ID to edit
   * @param draft - Partial item data to override
   */
  function setItemEdit(itemId: string, draft: ItemDraft): void {
    const newMap = new Map(itemEdits.value);
    const existing = newMap.get(itemId);
    // Use deepMerge to handle nested objects (weaponData, armourData, etc.)
    newMap.set(itemId, existing ? deepMerge(existing, draft) : draft);
    itemEdits.value = newMap;
  }

  /**
   * Get the draft edit for an item.
   * @param itemId - The item ID to look up
   * @returns The draft edit or undefined if not edited
   */
  function getItemEdit(itemId: string): ItemDraft | undefined {
    return itemEdits.value.get(itemId);
  }

  /**
   * Check if an item has draft edits.
   * @param itemId - The item ID to check
   */
  function hasItemEdit(itemId: string): boolean {
    return itemEdits.value.has(itemId);
  }

  /**
   * Remove an item edit.
   * @param itemId - The item ID to remove edits for
   */
  function removeItemEdit(itemId: string): void {
    const newMap = new Map(itemEdits.value);
    newMap.delete(itemId);
    itemEdits.value = newMap;
  }

  /**
   * Clear all item edits.
   */
  function clearItemEdits(): void {
    itemEdits.value = new Map();
  }

  // ============================================================================
  // i18n Edit Actions
  // ============================================================================

  /**
   * Set or update an i18n string edit.
   * @param key - Dot-notation key (e.g., 'gem.fireball.name')
   * @param value - The translated/corrected value
   */
  function setI18nEdit(key: string, value: string): void {
    const newMap = new Map(i18nEdits.value);
    newMap.set(key, value);
    i18nEdits.value = newMap;
  }

  /**
   * Get the draft edit for an i18n key.
   * @param key - Dot-notation key to look up
   * @returns The draft value or undefined if not edited
   */
  function getI18nEdit(key: string): string | undefined {
    return i18nEdits.value.get(key);
  }

  /**
   * Check if an i18n key has a draft edit.
   * @param key - Dot-notation key to check
   */
  function hasI18nEdit(key: string): boolean {
    return i18nEdits.value.has(key);
  }

  /**
   * Remove an i18n edit.
   * @param key - Dot-notation key to remove
   */
  function removeI18nEdit(key: string): void {
    const newMap = new Map(i18nEdits.value);
    newMap.delete(key);
    i18nEdits.value = newMap;
  }

  /**
   * Clear all i18n edits.
   */
  function clearI18nEdits(): void {
    i18nEdits.value = new Map();
  }

  // ============================================================================
  // Custom Tree Node Actions
  // ============================================================================

  /**
   * Create a new custom tree node.
   * @param params - Node parameters (without id and origin)
   * @returns The created node with generated ID
   */
  function createCustomNode(params: {
    name: string;
    type: TreeNodeType;
    x: number;
    y: number;
    stats: string[];
    icon?: string;
    description?: string;
    masteryEffects?: Array<{ effect: number; stats: string[] }>;
  }): CustomTreeNode {
    const id = generateCustomNodeId();
    const origin: CustomNodeOrigin = {
      type: 'user_created',
      createdAt: new Date(),
      ...(params.description && { description: params.description }),
    };

    const node: CustomTreeNode = {
      id,
      name: params.name,
      type: params.type,
      x: params.x,
      y: params.y,
      stats: params.stats,
      origin,
      ...(params.icon && { icon: params.icon }),
      ...(params.masteryEffects && { masteryEffects: params.masteryEffects }),
    };

    const newMap = new Map(customNodes.value);
    newMap.set(id, node);
    customNodes.value = newMap;

    return node;
  }

  /**
   * Update an existing custom node.
   * @param nodeId - The custom node ID to update
   * @param updates - Partial node data to merge
   */
  function updateCustomNode(
    nodeId: string,
    updates: Partial<Omit<CustomTreeNode, 'id' | 'origin'>>
  ): void {
    const existing = customNodes.value.get(nodeId);
    if (!existing) {
      console.warn(`updateCustomNode: Node "${nodeId}" not found`);
      return;
    }

    const newMap = new Map(customNodes.value);
    // Use deepMerge for consistency and to handle masteryEffects array
    newMap.set(nodeId, deepMerge(existing, updates));
    customNodes.value = newMap;
  }

  /**
   * Get a custom node by ID.
   * @param nodeId - The custom node ID to look up
   */
  function getCustomNode(nodeId: string): CustomTreeNode | undefined {
    return customNodes.value.get(nodeId);
  }

  /**
   * Check if a custom node exists.
   * @param nodeId - The node ID to check
   */
  function hasCustomNode(nodeId: string): boolean {
    return customNodes.value.has(nodeId);
  }

  /**
   * Remove a custom node and all its connections.
   * @param nodeId - The custom node ID to remove
   */
  function removeCustomNode(nodeId: string): void {
    const newMap = new Map(customNodes.value);
    newMap.delete(nodeId);
    customNodes.value = newMap;

    // Also remove any connections involving this node
    customConnections.value = customConnections.value.filter(
      ([source, target]) => source !== nodeId && target !== nodeId
    );
  }

  /**
   * Clear all custom nodes and connections.
   */
  function clearCustomNodes(): void {
    customNodes.value = new Map();
    customConnections.value = [];
  }

  // ============================================================================
  // Custom Connection Actions
  // ============================================================================

  /**
   * Add a connection between two nodes.
   * @param sourceId - Source node ID (can be custom or base)
   * @param targetId - Target node ID (can be custom or base)
   */
  function addConnection(sourceId: string, targetId: string): void {
    // Avoid duplicate connections
    const exists = customConnections.value.some(
      ([s, t]) =>
        (s === sourceId && t === targetId) ||
        (s === targetId && t === sourceId)
    );
    if (!exists) {
      customConnections.value = [...customConnections.value, [sourceId, targetId]];
    }
  }

  /**
   * Remove a connection between two nodes.
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   */
  function removeConnection(sourceId: string, targetId: string): void {
    customConnections.value = customConnections.value.filter(
      ([s, t]) =>
        !(s === sourceId && t === targetId) &&
        !(s === targetId && t === sourceId)
    );
  }

  /**
   * Get all connections for a specific node.
   * @param nodeId - The node ID to get connections for
   * @returns Array of connected node IDs
   */
  function getNodeConnections(nodeId: string): string[] {
    const connections: string[] = [];
    for (const [source, target] of customConnections.value) {
      if (source === nodeId) {
        connections.push(target);
      } else if (target === nodeId) {
        connections.push(source);
      }
    }
    return connections;
  }

  // ============================================================================
  // Edit Mode Actions
  // ============================================================================

  /**
   * Enable edit mode.
   */
  function enableEditMode(): void {
    editModeEnabled.value = true;
  }

  /**
   * Disable edit mode.
   */
  function disableEditMode(): void {
    editModeEnabled.value = false;
  }

  /**
   * Toggle edit mode.
   */
  function toggleEditMode(): void {
    editModeEnabled.value = !editModeEnabled.value;
  }

  // ============================================================================
  // Global Actions
  // ============================================================================

  /**
   * Clear all drafts and reset to initial state.
   * Does NOT disable edit mode.
   */
  function clearAll(): void {
    skillEdits.value = new Map();
    itemEdits.value = new Map();
    i18nEdits.value = new Map();
    customNodes.value = new Map();
    customConnections.value = [];
  }

  /**
   * Reset store to initial state including edit mode.
   */
  function reset(): void {
    clearAll();
    editModeEnabled.value = false;
  }

  /**
   * Export current draft state as a snapshot.
   * Useful for debugging or manual export.
   */
  function exportSnapshot(): DraftSnapshot {
    return {
      timestamp: new Date(),
      skillEdits: Object.fromEntries(skillEdits.value),
      itemEdits: Object.fromEntries(itemEdits.value),
      i18nEdits: Object.fromEntries(i18nEdits.value),
      customNodes: Object.fromEntries(customNodes.value),
      customConnections: [...customConnections.value],
    };
  }

  /**
   * Import a draft snapshot.
   * Replaces current state with imported data.
   * @param snapshot - The snapshot to import
   */
  function importSnapshot(snapshot: DraftSnapshot): void {
    skillEdits.value = new Map(Object.entries(snapshot.skillEdits));
    itemEdits.value = new Map(Object.entries(snapshot.itemEdits));
    i18nEdits.value = new Map(Object.entries(snapshot.i18nEdits));
    customNodes.value = new Map(Object.entries(snapshot.customNodes));
    customConnections.value = [...snapshot.customConnections];
  }

  return {
    // State (readonly externally via getters)
    skillEdits,
    itemEdits,
    i18nEdits,
    customNodes,
    customConnections,
    editModeEnabled,

    // Getters
    hasChanges,
    stats,
    customNodeIds,
    editedGemIds,
    editedItemIds,

    // Skill/Gem Edit Actions
    setSkillEdit,
    getSkillEdit,
    hasSkillEdit,
    removeSkillEdit,
    clearSkillEdits,

    // Item Edit Actions
    setItemEdit,
    getItemEdit,
    hasItemEdit,
    removeItemEdit,
    clearItemEdits,

    // i18n Edit Actions
    setI18nEdit,
    getI18nEdit,
    hasI18nEdit,
    removeI18nEdit,
    clearI18nEdits,

    // Custom Tree Node Actions
    createCustomNode,
    updateCustomNode,
    getCustomNode,
    hasCustomNode,
    removeCustomNode,
    clearCustomNodes,

    // Custom Connection Actions
    addConnection,
    removeConnection,
    getNodeConnections,

    // Edit Mode Actions
    enableEditMode,
    disableEditMode,
    toggleEditMode,

    // Global Actions
    clearAll,
    reset,
    exportSnapshot,
    importSnapshot,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDraftStore, import.meta.hot));
}
