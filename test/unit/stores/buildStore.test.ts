/**
 * Unit tests for buildStore.
 *
 * Tests serialization/deserialization, CharacterClass enum conversion,
 * and build state management.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBuildStore } from 'src/stores/buildStore';
import { CharacterClass } from 'src/protos/common_pb';

// Mock the database module
vi.mock('src/db', () => ({
  createBuild: vi.fn().mockResolvedValue(1),
  updateBuild: vi.fn().mockResolvedValue(undefined),
  getBuild: vi.fn().mockResolvedValue(null),
  deleteBuild: vi.fn().mockResolvedValue(undefined),
}));

describe('buildStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have a new empty build with defaults', () => {
      const store = useBuildStore();

      expect(store.currentBuild.id).toBeDefined();
      expect(store.currentBuild.name).toBe('New Build');
      expect(store.currentBuild.characterClass).toBe(CharacterClass.WARRIOR);
      expect(store.currentBuild.level).toBe(1);
      expect(store.currentBuild.allocatedNodeIds).toEqual([]);
      expect(store.isDirty).toBe(false);
      expect(store.isSaved).toBe(false);
    });
  });

  describe('setName', () => {
    it('should update build name and set dirty flag', () => {
      const store = useBuildStore();

      store.setName('My Cool Build');

      expect(store.currentBuild.name).toBe('My Cool Build');
      expect(store.buildName).toBe('My Cool Build');
      expect(store.isDirty).toBe(true);
    });
  });

  describe('setCharacterClass', () => {
    it('should update character class and reset ascendancy', () => {
      const store = useBuildStore();
      store.currentBuild.ascendancy = 'Titan';

      store.setCharacterClass(CharacterClass.SORCERESS);

      expect(store.currentBuild.characterClass).toBe(CharacterClass.SORCERESS);
      expect(store.currentBuild.ascendancy).toBeUndefined();
      expect(store.isDirty).toBe(true);
    });
  });

  describe('setLevel', () => {
    it('should clamp level between 1 and 100', () => {
      const store = useBuildStore();

      store.setLevel(50);
      expect(store.currentBuild.level).toBe(50);

      store.setLevel(0);
      expect(store.currentBuild.level).toBe(1);

      store.setLevel(150);
      expect(store.currentBuild.level).toBe(100);
    });
  });

  describe('node allocation', () => {
    it('should allocate node and set dirty flag', () => {
      const store = useBuildStore();

      store.allocateNode('12345');

      expect(store.allocatedNodeIds).toContain('12345');
      expect(store.allocatedNodeCount).toBe(1);
      expect(store.isDirty).toBe(true);
    });

    it('should not duplicate allocated nodes', () => {
      const store = useBuildStore();

      store.allocateNode('12345');
      store.allocateNode('12345');

      expect(store.allocatedNodeIds.filter((id) => id === '12345')).toHaveLength(1);
    });

    it('should deallocate node', () => {
      const store = useBuildStore();
      store.allocateNode('12345');
      store.allocateNode('67890');

      store.deallocateNode('12345');

      expect(store.allocatedNodeIds).not.toContain('12345');
      expect(store.allocatedNodeIds).toContain('67890');
    });

    it('should handle deallocating non-existent node gracefully', () => {
      const store = useBuildStore();

      // Should not throw
      store.deallocateNode('nonexistent');
      expect(store.allocatedNodeIds).toEqual([]);
    });
  });

  describe('skill group management', () => {
    it('should add skill group', () => {
      const store = useBuildStore();
      const group = { id: '1', label: 'Main Skill', enabled: true, includeInFullDps: true, gems: [] };

      store.addSkillGroup(group);

      expect(store.skillGroups).toHaveLength(1);
      expect(store.skillGroups[0]?.label).toBe('Main Skill');
    });

    it('should remove skill group by index', () => {
      const store = useBuildStore();
      store.addSkillGroup({ id: '1', label: 'Skill 1', enabled: true, includeInFullDps: true, gems: [] });
      store.addSkillGroup({ id: '2', label: 'Skill 2', enabled: true, includeInFullDps: true, gems: [] });

      store.removeSkillGroup(0);

      expect(store.skillGroups).toHaveLength(1);
      expect(store.skillGroups[0]?.label).toBe('Skill 2');
    });

    it('should ignore invalid skill group index', () => {
      const store = useBuildStore();
      store.addSkillGroup({ id: '1', label: 'Skill 1', enabled: true, includeInFullDps: true, gems: [] });

      // Should not throw or modify
      store.removeSkillGroup(-1);
      store.removeSkillGroup(10);

      expect(store.skillGroups).toHaveLength(1);
    });
  });

  describe('CharacterClass handling', () => {
    it('should store and retrieve character class correctly', () => {
      const store = useBuildStore();

      store.setCharacterClass(CharacterClass.SORCERESS);
      expect(store.characterClass).toBe(CharacterClass.SORCERESS);

      store.setCharacterClass(CharacterClass.MONK);
      expect(store.characterClass).toBe(CharacterClass.MONK);
    });

    it('should support all PoE2 classes', () => {
      const store = useBuildStore();
      const classes = [
        CharacterClass.WARRIOR,
        CharacterClass.MONK,
        CharacterClass.SORCERESS,
        CharacterClass.MERCENARY,
        CharacterClass.HUNTRESS,
        CharacterClass.DRUID,
      ];

      for (const charClass of classes) {
        store.setCharacterClass(charClass);
        expect(store.characterClass).toBe(charClass);
      }
    });
  });

  describe('build state management', () => {
    it('should track mastery selections', () => {
      const store = useBuildStore();

      store.setMasterySelection('node1', 'effect1');
      store.setMasterySelection('node2', 'effect2');

      expect(store.currentBuild.masterySelections).toEqual({
        node1: 'effect1',
        node2: 'effect2',
      });
    });

    it('should remove mastery selection', () => {
      const store = useBuildStore();
      store.setMasterySelection('node1', 'effect1');
      store.setMasterySelection('node2', 'effect2');

      store.removeMasterySelection('node1');

      expect(store.currentBuild.masterySelections).toEqual({
        node2: 'effect2',
      });
    });

    it('should set build notes', () => {
      const store = useBuildStore();

      store.setNotes('This is a DPS build for mapping.');

      expect(store.currentBuild.notes).toBe('This is a DPS build for mapping.');
      expect(store.isDirty).toBe(true);
    });

    it('should set build config', () => {
      const store = useBuildStore();
      const config = { enemyLevel: 85, enemyIsBoss: true };

      store.setConfig(config);

      expect(store.config).toEqual(config);
      expect(store.isDirty).toBe(true);
    });
  });

  describe('newBuild', () => {
    it('should reset to empty build state', async () => {
      const store = useBuildStore();

      // Modify build state through public API
      store.setName('Modified Build');
      store.setLevel(99);
      store.allocateNode('12345');

      // Save to set currentBuildDbId (uses mocked database)
      await store.save();

      // Make another change to set isDirty
      store.setName('Another Name');
      expect(store.isDirty).toBe(true);

      store.newBuild();

      expect(store.currentBuild.name).toBe('New Build');
      expect(store.currentBuild.level).toBe(1);
      expect(store.allocatedNodeIds).toEqual([]);
      expect(store.currentBuildDbId).toBeUndefined();
      expect(store.isDirty).toBe(false);
    });
  });

  describe('importBuild / exportBuild', () => {
    it('should import build and set dirty flag', () => {
      const store = useBuildStore();
      const buildToImport = {
        id: 'imported-id',
        name: 'Imported Build',
        characterClass: CharacterClass.DRUID,
        level: 80,
        allocatedNodeIds: ['1', '2', '3'],
        masterySelections: {},
        equippedItems: {},
        skillGroups: [],
      };

      store.importBuild(buildToImport);

      expect(store.currentBuild.name).toBe('Imported Build');
      expect(store.currentBuild.characterClass).toBe(CharacterClass.DRUID);
      expect(store.isDirty).toBe(true);
      expect(store.currentBuildDbId).toBeUndefined();
    });

    it('should export build as deep clone', () => {
      const store = useBuildStore();
      store.setName('Original');
      store.allocateNode('123');

      const exported = store.exportBuild();

      // Modify export - should not affect store
      exported.name = 'Modified';
      exported.allocatedNodeIds.push('456');

      expect(store.currentBuild.name).toBe('Original');
      expect(store.allocatedNodeIds).toEqual(['123']);
    });
  });
});
