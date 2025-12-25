/**
 * Unit tests for useDraftOverlay composable.
 *
 * Tests the overlay functionality that merges base game data
 * with session-only draft edits from the draft store.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDraftStore } from 'src/stores/draftStore';
import { useDraftOverlay } from 'src/composables/useDraftOverlay';
import type { Gem, GemType, GemTags } from 'src/types/gems';
import type { TreeNode, TreeNodeType } from 'src/types/tree';
import type { Item } from 'src/protos/items_pb';

// Helper to create test gems
function createTestGem(overrides: Partial<Gem> = {}): Gem {
  return {
    id: 'test-gem',
    name: 'Test Gem',
    type: 'Spell' as GemType,
    isSupport: false,
    tags: {} as GemTags,
    requirements: { str: 0, dex: 0, int: 100 },
    tier: 1,
    maxLevel: 20,
    metadataPath: 'Metadata/Gems/Test',
    ...overrides,
  };
}

// Helper to create test items
function createTestItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    name: 'Test Item',
    baseName: 'Simple Robe',
    ...overrides,
  } as Item;
}

// Helper to create test tree nodes
function createTestNode(
  id: string,
  neighbors: string[],
  type: TreeNodeType = 'normal',
  name: string | null = null
): TreeNode {
  return {
    id,
    name,
    type,
    x: 0,
    y: 0,
    neighbors: new Set(neighbors),
    stats: [],
    icon: null,
    ascendancy: null,
    isAscendancyStart: false,
    isMastery: false,
  };
}

describe('useDraftOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('gem overlay', () => {
    it('should return original gem when no draft exists', () => {
      const { getGemWithDrafts } = useDraftOverlay();
      const gem = createTestGem({ id: 'fireball', name: 'Fireball' });

      const result = getGemWithDrafts(gem);

      expect(result).toEqual(gem);
    });

    it('should merge draft edits with base gem', () => {
      const draftStore = useDraftStore();
      const { getGemWithDrafts } = useDraftOverlay();

      const gem = createTestGem({ id: 'fireball', name: 'Fireball', tier: 1 });
      draftStore.setSkillEdit('fireball', { name: 'Corrected Fireball', tier: 5 });

      const result = getGemWithDrafts(gem);

      expect(result.name).toBe('Corrected Fireball');
      expect(result.tier).toBe(5);
      expect(result.id).toBe('fireball'); // Unchanged
      expect(result.type).toBe('Spell'); // Unchanged
    });

    it('should apply drafts to multiple gems in array', () => {
      const draftStore = useDraftStore();
      const { getGemsWithDrafts } = useDraftOverlay();

      const gems = [
        createTestGem({ id: 'gem1', name: 'Gem 1' }),
        createTestGem({ id: 'gem2', name: 'Gem 2' }),
        createTestGem({ id: 'gem3', name: 'Gem 3' }),
      ];
      draftStore.setSkillEdit('gem2', { name: 'Modified Gem 2' });

      const result = getGemsWithDrafts(gems);

      expect(result).toHaveLength(3);
      expect(result[0]!.name).toBe('Gem 1');
      expect(result[1]!.name).toBe('Modified Gem 2');
      expect(result[2]!.name).toBe('Gem 3');
    });

    it('should apply drafts to gems in Map', () => {
      const draftStore = useDraftStore();
      const { getGemsWithDrafts } = useDraftOverlay();

      const gems = new Map<string, Gem>([
        ['gem1', createTestGem({ id: 'gem1', name: 'Gem 1' })],
        ['gem2', createTestGem({ id: 'gem2', name: 'Gem 2' })],
      ]);
      draftStore.setSkillEdit('gem1', { name: 'Modified' });

      const result = getGemsWithDrafts(gems);

      expect(result.get('gem1')?.name).toBe('Modified');
      expect(result.get('gem2')?.name).toBe('Gem 2');
    });

    it('should check if gem has draft', () => {
      const draftStore = useDraftStore();
      const { hasGemDraft } = useDraftOverlay();

      draftStore.setSkillEdit('gem1', { name: 'Modified' });

      expect(hasGemDraft('gem1')).toBe(true);
      expect(hasGemDraft('gem2')).toBe(false);
    });

    it('should get raw gem draft', () => {
      const draftStore = useDraftStore();
      const { getGemDraft } = useDraftOverlay();

      draftStore.setSkillEdit('gem1', { name: 'Modified', tier: 10 });

      expect(getGemDraft('gem1')).toEqual({ name: 'Modified', tier: 10 });
      expect(getGemDraft('gem2')).toBeUndefined();
    });
  });

  describe('item overlay', () => {
    it('should return original item when no draft exists', () => {
      const { getItemWithDrafts } = useDraftOverlay();
      const item = createTestItem({ id: 'tabula', name: 'Tabula Rasa' });

      const result = getItemWithDrafts(item);

      expect(result).toEqual(item);
    });

    it('should merge draft edits with base item', () => {
      const draftStore = useDraftStore();
      const { getItemWithDrafts } = useDraftOverlay();

      const item = createTestItem({ id: 'tabula', name: 'Tabula Rasa' });
      draftStore.setItemEdit('tabula', { name: 'Corrected Tabula' });

      const result = getItemWithDrafts(item);

      expect(result.name).toBe('Corrected Tabula');
      expect(result.id).toBe('tabula');
    });

    it('should apply drafts to items in Record', () => {
      const draftStore = useDraftStore();
      const { getItemsWithDrafts } = useDraftOverlay();

      const items: Record<string, Item> = {
        item1: createTestItem({ id: 'item1', name: 'Item 1' }),
        item2: createTestItem({ id: 'item2', name: 'Item 2' }),
      };
      draftStore.setItemEdit('item1', { name: 'Modified' });

      const result = getItemsWithDrafts(items);

      expect(result.item1!.name).toBe('Modified');
      expect(result.item2!.name).toBe('Item 2');
    });

    it('should apply drafts to items in Map', () => {
      const draftStore = useDraftStore();
      const { getItemsWithDrafts } = useDraftOverlay();

      const items = new Map<string, Item>([
        ['item1', createTestItem({ id: 'item1', name: 'Item 1' })],
        ['item2', createTestItem({ id: 'item2', name: 'Item 2' })],
      ]);
      draftStore.setItemEdit('item2', { name: 'Modified' });

      const result = getItemsWithDrafts(items);

      expect(result.get('item1')?.name).toBe('Item 1');
      expect(result.get('item2')?.name).toBe('Modified');
    });

    it('should check if item has draft', () => {
      const draftStore = useDraftStore();
      const { hasItemDraft } = useDraftOverlay();

      draftStore.setItemEdit('item1', { name: 'Modified' });

      expect(hasItemDraft('item1')).toBe(true);
      expect(hasItemDraft('item2')).toBe(false);
    });
  });

  describe('i18n overlay', () => {
    it('should return fallback when no draft exists', () => {
      const { getI18nValue } = useDraftOverlay();

      const result = getI18nValue('gem.fireball.name', 'Fireball');

      expect(result).toBe('Fireball');
    });

    it('should return draft value when it exists', () => {
      const draftStore = useDraftStore();
      const { getI18nValue } = useDraftOverlay();

      draftStore.setI18nEdit('gem.fireball.name', 'Огненный шар');

      const result = getI18nValue('gem.fireball.name', 'Fireball');

      expect(result).toBe('Огненный шар');
    });

    it('should check if i18n key has draft', () => {
      const draftStore = useDraftStore();
      const { hasI18nDraft } = useDraftOverlay();

      draftStore.setI18nEdit('gem.fireball.name', 'Value');

      expect(hasI18nDraft('gem.fireball.name')).toBe(true);
      expect(hasI18nDraft('gem.icenova.name')).toBe(false);
    });

    it('should get i18n drafts by prefix', () => {
      const draftStore = useDraftStore();
      const { getI18nDraftsByPrefix } = useDraftOverlay();

      draftStore.setI18nEdit('gem.fireball.name', 'FB Name');
      draftStore.setI18nEdit('gem.fireball.description', 'FB Desc');
      draftStore.setI18nEdit('gem.icenova.name', 'IN Name');
      draftStore.setI18nEdit('item.tabula.name', 'Tabula');

      const result = getI18nDraftsByPrefix('gem.fireball');

      expect(result.size).toBe(2);
      expect(result.get('gem.fireball.name')).toBe('FB Name');
      expect(result.get('gem.fireball.description')).toBe('FB Desc');
    });

    it('should handle prefix with trailing dot', () => {
      const draftStore = useDraftStore();
      const { getI18nDraftsByPrefix } = useDraftOverlay();

      draftStore.setI18nEdit('gem.fireball.name', 'FB');

      const result = getI18nDraftsByPrefix('gem.fireball.');

      expect(result.size).toBe(1);
    });
  });

  describe('tree node overlay', () => {
    it('should return base node for non-custom ID', () => {
      const { getTreeNode } = useDraftOverlay();
      const baseNodes = new Map<string, TreeNode>([
        ['123', createTestNode('123', ['456'], 'normal', 'Base Node')],
      ]);

      const result = getTreeNode('123', baseNodes);

      expect(result?.name).toBe('Base Node');
    });

    it('should return custom node for custom ID', () => {
      const draftStore = useDraftStore();
      const { getTreeNode } = useDraftOverlay();

      const customNode = draftStore.createCustomNode({
        name: 'Custom Node',
        type: 'notable',
        x: 100,
        y: 200,
        stats: ['+10% Damage'],
      });

      const baseNodes = new Map<string, TreeNode>();
      const result = getTreeNode(customNode.id, baseNodes);

      expect(result?.name).toBe('Custom Node');
      expect(result?.type).toBe('notable');
    });

    it('should return undefined for non-existent node', () => {
      const { getTreeNode } = useDraftOverlay();
      const baseNodes = new Map<string, TreeNode>();

      const result = getTreeNode('nonexistent', baseNodes);

      expect(result).toBeUndefined();
    });

    it('should combine base and custom nodes in getAllNodes', () => {
      const draftStore = useDraftStore();
      const { getAllNodes } = useDraftOverlay();

      const baseNodes = new Map<string, TreeNode>([
        ['1', createTestNode('1', ['2'], 'normal', 'Node 1')],
        ['2', createTestNode('2', ['1'], 'normal', 'Node 2')],
      ]);

      const customNode = draftStore.createCustomNode({
        name: 'Custom',
        type: 'notable',
        x: 0,
        y: 0,
        stats: [],
      });

      const result = getAllNodes(baseNodes);

      expect(result.size).toBe(3);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
      expect(result.has(customNode.id)).toBe(true);
    });

    it('should include custom connections in getNodeNeighbors', () => {
      const draftStore = useDraftStore();
      const { getNodeNeighbors } = useDraftOverlay();

      const baseNodes = new Map<string, TreeNode>([
        ['1', createTestNode('1', ['2'], 'normal')],
        ['2', createTestNode('2', ['1'], 'normal')],
      ]);

      // Add custom connection from base node to another
      draftStore.addConnection('1', '3');

      const result = getNodeNeighbors('1', baseNodes);

      expect(result.has('2')).toBe(true); // Base neighbor
      expect(result.has('3')).toBe(true); // Custom connection
    });

    it('should get neighbors for custom node', () => {
      const draftStore = useDraftStore();
      const { getNodeNeighbors } = useDraftOverlay();

      const customNode = draftStore.createCustomNode({
        name: 'Custom',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      draftStore.addConnection(customNode.id, 'base_1');
      draftStore.addConnection(customNode.id, 'base_2');

      const baseNodes = new Map<string, TreeNode>();
      const result = getNodeNeighbors(customNode.id, baseNodes);

      expect(result.size).toBe(2);
      expect(result.has('base_1')).toBe(true);
      expect(result.has('base_2')).toBe(true);
    });

    it('should identify custom node IDs', () => {
      const draftStore = useDraftStore();
      const { isCustomNode } = useDraftOverlay();

      const customNode = draftStore.createCustomNode({
        name: 'Custom',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });

      expect(isCustomNode(customNode.id)).toBe(true);
      expect(isCustomNode('base_123')).toBe(false);
      expect(isCustomNode('12345')).toBe(false);
    });

    it('should expose all custom node IDs', () => {
      const draftStore = useDraftStore();
      const { allCustomNodeIds } = useDraftOverlay();

      const node1 = draftStore.createCustomNode({
        name: 'N1',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      const node2 = draftStore.createCustomNode({
        name: 'N2',
        type: 'notable',
        x: 0,
        y: 0,
        stats: [],
      });

      expect(allCustomNodeIds.value).toContain(node1.id);
      expect(allCustomNodeIds.value).toContain(node2.id);
    });

    it('should expose all custom connections', () => {
      const draftStore = useDraftStore();
      const { allCustomConnections } = useDraftOverlay();

      draftStore.addConnection('a', 'b');
      draftStore.addConnection('c', 'd');

      expect(allCustomConnections.value).toHaveLength(2);
      expect(allCustomConnections.value).toContainEqual(['a', 'b']);
      expect(allCustomConnections.value).toContainEqual(['c', 'd']);
    });
  });

  describe('utility functions', () => {
    it('should provide modification summary', () => {
      const draftStore = useDraftStore();
      const { modificationSummary } = useDraftOverlay();

      draftStore.setSkillEdit('gem1', { name: 'G' });
      draftStore.setItemEdit('item1', { name: 'I' });
      draftStore.setI18nEdit('key1', 'value');
      const node = draftStore.createCustomNode({
        name: 'N',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      draftStore.addConnection(node.id, 'base');

      expect(modificationSummary.value).toEqual({
        gems: ['gem1'],
        items: ['item1'],
        i18n: ['key1'],
        customNodes: [node.id],
        connectionCount: 1,
        hasChanges: true,
      });
    });

    it('should check any draft via hasDraft utility', () => {
      const draftStore = useDraftStore();
      const { hasDraft } = useDraftOverlay();

      draftStore.setSkillEdit('gem1', { name: 'G' });
      draftStore.setItemEdit('item1', { name: 'I' });
      draftStore.setI18nEdit('key1', 'value');

      expect(hasDraft('gem', 'gem1')).toBe(true);
      expect(hasDraft('gem', 'gem2')).toBe(false);
      expect(hasDraft('item', 'item1')).toBe(true);
      expect(hasDraft('item', 'item2')).toBe(false);
      expect(hasDraft('i18n', 'key1')).toBe(true);
      expect(hasDraft('i18n', 'key2')).toBe(false);
    });

    it('should expose editModeEnabled state', () => {
      const draftStore = useDraftStore();
      const { editModeEnabled } = useDraftOverlay();

      expect(editModeEnabled.value).toBe(false);

      draftStore.enableEditMode();
      expect(editModeEnabled.value).toBe(true);
    });

    it('should expose hasChanges state', () => {
      const draftStore = useDraftStore();
      const { hasChanges } = useDraftOverlay();

      expect(hasChanges.value).toBe(false);

      draftStore.setSkillEdit('gem1', { name: 'G' });
      expect(hasChanges.value).toBe(true);
    });
  });
});
