/**
 * Unit tests for draftStore.
 *
 * Tests session-only draft state management for user edits
 * to skills, items, i18n strings, and custom tree nodes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDraftStore } from 'src/stores/draftStore';

describe('draftStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have empty state and no changes', () => {
      const store = useDraftStore();

      expect(store.hasChanges).toBe(false);
      expect(store.editModeEnabled).toBe(false);
      expect(store.stats.total).toBe(0);
      expect(store.skillEdits.size).toBe(0);
      expect(store.itemEdits.size).toBe(0);
      expect(store.i18nEdits.size).toBe(0);
      expect(store.customNodes.size).toBe(0);
      expect(store.customConnections).toEqual([]);
    });
  });

  describe('skill/gem edits', () => {
    it('should set and get skill edit', () => {
      const store = useDraftStore();

      store.setSkillEdit('fireball', { name: 'Corrected Fireball' });

      expect(store.hasSkillEdit('fireball')).toBe(true);
      expect(store.getSkillEdit('fireball')).toEqual({ name: 'Corrected Fireball' });
      expect(store.hasChanges).toBe(true);
      expect(store.stats.gemEdits).toBe(1);
    });

    it('should merge partial edits', () => {
      const store = useDraftStore();

      store.setSkillEdit('fireball', { name: 'Fireball v1' });
      store.setSkillEdit('fireball', { tier: 5 });

      expect(store.getSkillEdit('fireball')).toEqual({
        name: 'Fireball v1',
        tier: 5,
      });
    });

    it('should remove skill edit', () => {
      const store = useDraftStore();
      store.setSkillEdit('fireball', { name: 'Edited' });
      store.setSkillEdit('icenova', { name: 'Ice Nova' });

      store.removeSkillEdit('fireball');

      expect(store.hasSkillEdit('fireball')).toBe(false);
      expect(store.hasSkillEdit('icenova')).toBe(true);
    });

    it('should clear all skill edits', () => {
      const store = useDraftStore();
      store.setSkillEdit('fireball', { name: 'FB' });
      store.setSkillEdit('icenova', { name: 'IN' });

      store.clearSkillEdits();

      expect(store.skillEdits.size).toBe(0);
      expect(store.stats.gemEdits).toBe(0);
    });

    it('should track edited gem IDs', () => {
      const store = useDraftStore();
      store.setSkillEdit('fireball', { name: 'FB' });
      store.setSkillEdit('icenova', { name: 'IN' });

      const ids = store.editedGemIds;

      expect(ids).toContain('fireball');
      expect(ids).toContain('icenova');
      expect(ids).toHaveLength(2);
    });
  });

  describe('item edits', () => {
    it('should set and get item edit', () => {
      const store = useDraftStore();

      store.setItemEdit('tabula', { name: 'Corrected Tabula' });

      expect(store.hasItemEdit('tabula')).toBe(true);
      expect(store.getItemEdit('tabula')).toEqual({ name: 'Corrected Tabula' });
      expect(store.hasChanges).toBe(true);
      expect(store.stats.itemEdits).toBe(1);
    });

    it('should merge partial item edits', () => {
      const store = useDraftStore();

      store.setItemEdit('tabula', { name: 'Tabula Rasa' });
      store.setItemEdit('tabula', { baseName: 'Simple Robe' });

      expect(store.getItemEdit('tabula')).toEqual({
        name: 'Tabula Rasa',
        baseName: 'Simple Robe',
      });
    });

    it('should remove item edit', () => {
      const store = useDraftStore();
      store.setItemEdit('tabula', { name: 'T' });
      store.setItemEdit('goldrim', { name: 'G' });

      store.removeItemEdit('tabula');

      expect(store.hasItemEdit('tabula')).toBe(false);
      expect(store.hasItemEdit('goldrim')).toBe(true);
    });

    it('should clear all item edits', () => {
      const store = useDraftStore();
      store.setItemEdit('tabula', { name: 'T' });
      store.setItemEdit('goldrim', { name: 'G' });

      store.clearItemEdits();

      expect(store.itemEdits.size).toBe(0);
    });

    it('should track edited item IDs', () => {
      const store = useDraftStore();
      store.setItemEdit('tabula', { name: 'T' });
      store.setItemEdit('goldrim', { name: 'G' });

      const ids = store.editedItemIds;

      expect(ids).toContain('tabula');
      expect(ids).toContain('goldrim');
    });
  });

  describe('i18n edits', () => {
    it('should set and get i18n edit', () => {
      const store = useDraftStore();

      store.setI18nEdit('gem.fireball.name', 'Огненный шар');

      expect(store.hasI18nEdit('gem.fireball.name')).toBe(true);
      expect(store.getI18nEdit('gem.fireball.name')).toBe('Огненный шар');
      expect(store.hasChanges).toBe(true);
      expect(store.stats.i18nEdits).toBe(1);
    });

    it('should overwrite existing i18n edit', () => {
      const store = useDraftStore();
      store.setI18nEdit('gem.fireball.name', 'First');
      store.setI18nEdit('gem.fireball.name', 'Second');

      expect(store.getI18nEdit('gem.fireball.name')).toBe('Second');
    });

    it('should remove i18n edit', () => {
      const store = useDraftStore();
      store.setI18nEdit('gem.fireball.name', 'FB');
      store.setI18nEdit('gem.icenova.name', 'IN');

      store.removeI18nEdit('gem.fireball.name');

      expect(store.hasI18nEdit('gem.fireball.name')).toBe(false);
      expect(store.hasI18nEdit('gem.icenova.name')).toBe(true);
    });

    it('should clear all i18n edits', () => {
      const store = useDraftStore();
      store.setI18nEdit('gem.fireball.name', 'FB');
      store.setI18nEdit('gem.icenova.name', 'IN');

      store.clearI18nEdits();

      expect(store.i18nEdits.size).toBe(0);
    });
  });

  describe('custom tree nodes', () => {
    it('should create custom node with generated ID', () => {
      const store = useDraftStore();

      const node = store.createCustomNode({
        name: 'Custom Notable',
        type: 'notable',
        x: 100,
        y: 200,
        stats: ['+10% increased Damage'],
      });

      expect(node.id).toMatch(/^custom_/);
      expect(node.name).toBe('Custom Notable');
      expect(node.type).toBe('notable');
      expect(node.origin.type).toBe('user_created');
      expect(node.origin.createdAt).toBeInstanceOf(Date);
      expect(store.hasCustomNode(node.id)).toBe(true);
    });

    it('should update existing custom node', () => {
      const store = useDraftStore();
      const node = store.createCustomNode({
        name: 'Original',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });

      store.updateCustomNode(node.id, { name: 'Updated', x: 50 });

      const updated = store.getCustomNode(node.id);
      expect(updated?.name).toBe('Updated');
      expect(updated?.x).toBe(50);
      expect(updated?.origin).toBe(node.origin); // Origin preserved
    });

    it('should warn when updating non-existent node', () => {
      const store = useDraftStore();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      store.updateCustomNode('nonexistent', { name: 'Test' });

      expect(warnSpy).toHaveBeenCalledWith(
        'updateCustomNode: Node "nonexistent" not found'
      );
      warnSpy.mockRestore();
    });

    it('should remove custom node and its connections', () => {
      const store = useDraftStore();
      const node1 = store.createCustomNode({
        name: 'Node 1',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      const node2 = store.createCustomNode({
        name: 'Node 2',
        type: 'normal',
        x: 100,
        y: 0,
        stats: [],
      });
      store.addConnection(node1.id, node2.id);
      store.addConnection(node1.id, 'base_node_123');

      store.removeCustomNode(node1.id);

      expect(store.hasCustomNode(node1.id)).toBe(false);
      expect(store.hasCustomNode(node2.id)).toBe(true);
      expect(store.customConnections).toHaveLength(0);
    });

    it('should clear all custom nodes and connections', () => {
      const store = useDraftStore();
      const node = store.createCustomNode({
        name: 'Node',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      store.addConnection(node.id, 'base_123');

      store.clearCustomNodes();

      expect(store.customNodes.size).toBe(0);
      expect(store.customConnections).toHaveLength(0);
    });

    it('should track custom node IDs', () => {
      const store = useDraftStore();
      const node1 = store.createCustomNode({
        name: 'N1',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      const node2 = store.createCustomNode({
        name: 'N2',
        type: 'notable',
        x: 0,
        y: 0,
        stats: [],
      });

      expect(store.customNodeIds).toContain(node1.id);
      expect(store.customNodeIds).toContain(node2.id);
    });

    it('should support mastery nodes', () => {
      const store = useDraftStore();

      const node = store.createCustomNode({
        name: 'Custom Mastery',
        type: 'mastery',
        x: 0,
        y: 0,
        stats: [],
        masteryEffects: [
          { effect: 1, stats: ['+5% increased Fire Damage'] },
          { effect: 2, stats: ['+5% increased Cold Damage'] },
        ],
      });

      expect(node.masteryEffects).toHaveLength(2);
      expect(node.masteryEffects?.[0]?.stats[0]).toBe('+5% increased Fire Damage');
    });
  });

  describe('custom connections', () => {
    it('should add connection between nodes', () => {
      const store = useDraftStore();
      const node = store.createCustomNode({
        name: 'Custom',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });

      store.addConnection(node.id, 'base_123');

      expect(store.customConnections).toHaveLength(1);
      expect(store.customConnections[0]).toEqual([node.id, 'base_123']);
    });

    it('should not add duplicate connections', () => {
      const store = useDraftStore();

      store.addConnection('a', 'b');
      store.addConnection('a', 'b'); // Same direction
      store.addConnection('b', 'a'); // Reverse direction

      expect(store.customConnections).toHaveLength(1);
    });

    it('should remove connection', () => {
      const store = useDraftStore();
      store.addConnection('a', 'b');
      store.addConnection('c', 'd');

      store.removeConnection('a', 'b');

      expect(store.customConnections).toHaveLength(1);
      expect(store.customConnections[0]).toEqual(['c', 'd']);
    });

    it('should remove connection regardless of direction', () => {
      const store = useDraftStore();
      store.addConnection('a', 'b');

      store.removeConnection('b', 'a'); // Reverse direction

      expect(store.customConnections).toHaveLength(0);
    });

    it('should get node connections', () => {
      const store = useDraftStore();
      store.addConnection('center', 'left');
      store.addConnection('center', 'right');
      store.addConnection('top', 'center');

      const connections = store.getNodeConnections('center');

      expect(connections).toContain('left');
      expect(connections).toContain('right');
      expect(connections).toContain('top');
      expect(connections).toHaveLength(3);
    });
  });

  describe('edit mode', () => {
    it('should toggle edit mode', () => {
      const store = useDraftStore();

      expect(store.editModeEnabled).toBe(false);

      store.enableEditMode();
      expect(store.editModeEnabled).toBe(true);

      store.disableEditMode();
      expect(store.editModeEnabled).toBe(false);

      store.toggleEditMode();
      expect(store.editModeEnabled).toBe(true);

      store.toggleEditMode();
      expect(store.editModeEnabled).toBe(false);
    });
  });

  describe('stats', () => {
    it('should compute accurate stats', () => {
      const store = useDraftStore();
      store.setSkillEdit('gem1', { name: 'G1' });
      store.setSkillEdit('gem2', { name: 'G2' });
      store.setItemEdit('item1', { name: 'I1' });
      store.setI18nEdit('key1', 'value1');
      store.setI18nEdit('key2', 'value2');
      store.setI18nEdit('key3', 'value3');
      const node = store.createCustomNode({
        name: 'N',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      store.addConnection(node.id, 'base');

      expect(store.stats).toEqual({
        gemEdits: 2,
        itemEdits: 1,
        i18nEdits: 3,
        customNodes: 1,
        customConnections: 1,
        total: 8,
      });
    });
  });

  describe('clearAll', () => {
    it('should clear all drafts but not edit mode', () => {
      const store = useDraftStore();
      store.setSkillEdit('gem1', { name: 'G1' });
      store.setItemEdit('item1', { name: 'I1' });
      store.setI18nEdit('key1', 'value1');
      store.createCustomNode({ name: 'N', type: 'normal', x: 0, y: 0, stats: [] });
      store.enableEditMode();

      store.clearAll();

      expect(store.hasChanges).toBe(false);
      expect(store.stats.total).toBe(0);
      expect(store.editModeEnabled).toBe(true); // Preserved
    });
  });

  describe('reset', () => {
    it('should reset everything including edit mode', () => {
      const store = useDraftStore();
      store.setSkillEdit('gem1', { name: 'G1' });
      store.enableEditMode();

      store.reset();

      expect(store.hasChanges).toBe(false);
      expect(store.editModeEnabled).toBe(false);
    });
  });

  describe('snapshot export/import', () => {
    it('should export snapshot of current state', () => {
      const store = useDraftStore();
      store.setSkillEdit('gem1', { name: 'G1' });
      store.setItemEdit('item1', { name: 'I1' });
      store.setI18nEdit('key1', 'value1');
      const node = store.createCustomNode({
        name: 'N',
        type: 'normal',
        x: 0,
        y: 0,
        stats: [],
      });
      store.addConnection(node.id, 'base');

      const snapshot = store.exportSnapshot();

      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.skillEdits).toEqual({ gem1: { name: 'G1' } });
      expect(snapshot.itemEdits).toEqual({ item1: { name: 'I1' } });
      expect(snapshot.i18nEdits).toEqual({ key1: 'value1' });
      expect(snapshot.customNodes[node.id]).toBeDefined();
      expect(snapshot.customConnections).toHaveLength(1);
    });

    it('should import snapshot replacing current state', () => {
      const store = useDraftStore();
      store.setSkillEdit('old', { name: 'Old' });

      const snapshot = {
        timestamp: new Date(),
        skillEdits: { new: { name: 'New' } },
        itemEdits: { item: { name: 'Item' } },
        i18nEdits: { key: 'value' },
        customNodes: {},
        customConnections: [] as Array<[string, string]>,
      };

      store.importSnapshot(snapshot);

      expect(store.hasSkillEdit('old')).toBe(false);
      expect(store.hasSkillEdit('new')).toBe(true);
      expect(store.hasItemEdit('item')).toBe(true);
      expect(store.hasI18nEdit('key')).toBe(true);
    });
  });

  describe('hasChanges', () => {
    it('should be false when no edits exist', () => {
      const store = useDraftStore();
      expect(store.hasChanges).toBe(false);
    });

    it('should be true when skill edit exists', () => {
      const store = useDraftStore();
      store.setSkillEdit('gem', { name: 'G' });
      expect(store.hasChanges).toBe(true);
    });

    it('should be true when item edit exists', () => {
      const store = useDraftStore();
      store.setItemEdit('item', { name: 'I' });
      expect(store.hasChanges).toBe(true);
    });

    it('should be true when i18n edit exists', () => {
      const store = useDraftStore();
      store.setI18nEdit('key', 'value');
      expect(store.hasChanges).toBe(true);
    });

    it('should be true when custom node exists', () => {
      const store = useDraftStore();
      store.createCustomNode({ name: 'N', type: 'normal', x: 0, y: 0, stats: [] });
      expect(store.hasChanges).toBe(true);
    });

    it('should be true when custom connection exists', () => {
      const store = useDraftStore();
      store.addConnection('a', 'b');
      expect(store.hasChanges).toBe(true);
    });

    it('should return to false after clearing all', () => {
      const store = useDraftStore();
      store.setSkillEdit('gem', { name: 'G' });
      expect(store.hasChanges).toBe(true);

      store.clearAll();
      expect(store.hasChanges).toBe(false);
    });
  });
});
