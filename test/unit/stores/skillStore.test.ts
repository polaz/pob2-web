/**
 * Unit tests for skillStore.
 *
 * Tests gem search functionality, skill group management,
 * and selection state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSkillStore } from 'src/stores/skillStore';
import type { Gem } from 'src/protos/pob2_pb';
import { GemType } from 'src/protos/pob2_pb';

/** Create mock gem */
function createMockGem(id: string, name: string, tags: string[] = []): Gem {
  return {
    id,
    name,
    tags,
    gemType: GemType.SKILL,
    levels: [],
  };
}

describe('skillStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have no selection', () => {
      const store = useSkillStore();

      expect(store.selectedGroupIndex).toBeNull();
      expect(store.selectedGemIndex).toBeNull();
      expect(store.hasSelectedGroup).toBe(false);
      expect(store.hasSelectedGem).toBe(false);
    });

    it('should have empty gem data', () => {
      const store = useSkillStore();

      expect(store.availableGems).toEqual([]);
      expect(store.totalAvailableGems).toBe(0);
    });

    it('should have default display mode', () => {
      const store = useSkillStore();

      expect(store.displayMode).toBe('compact');
    });
  });

  describe('group selection', () => {
    it('should select group and clear gem selection', () => {
      const store = useSkillStore();
      store.selectGem(0, 1); // Set up gem selection first

      store.selectGroup(2);

      expect(store.selectedGroupIndex).toBe(2);
      expect(store.selectedGemIndex).toBeNull();
      expect(store.hasSelectedGroup).toBe(true);
    });

    it('should clear selection', () => {
      const store = useSkillStore();
      store.selectGem(1, 2);

      store.clearSelection();

      expect(store.selectedGroupIndex).toBeNull();
      expect(store.selectedGemIndex).toBeNull();
    });
  });

  describe('gem selection', () => {
    it('should select gem within group', () => {
      const store = useSkillStore();

      store.selectGem(1, 3);

      expect(store.selectedGroupIndex).toBe(1);
      expect(store.selectedGemIndex).toBe(3);
      expect(store.hasSelectedGem).toBe(true);
    });

    it('should clear gem selection only', () => {
      const store = useSkillStore();
      store.selectGem(1, 2);

      store.clearGemSelection();

      expect(store.selectedGroupIndex).toBe(1);
      expect(store.selectedGemIndex).toBeNull();
    });
  });

  describe('gem dragging', () => {
    it('should start dragging', () => {
      const store = useSkillStore();

      store.startDragging(1, 2);

      expect(store.draggingGem).toEqual({ groupIndex: 1, gemIndex: 2 });
      expect(store.isDragging).toBe(true);
    });

    it('should stop dragging', () => {
      const store = useSkillStore();
      store.startDragging(1, 2);

      store.stopDragging();

      expect(store.draggingGem).toBeNull();
      expect(store.isDragging).toBe(false);
    });
  });

  describe('group editor', () => {
    it('should open group editor', () => {
      const store = useSkillStore();

      store.openGroupEditor();

      expect(store.isGroupEditorOpen).toBe(true);
    });

    it('should open group editor with specific group', () => {
      const store = useSkillStore();

      store.openGroupEditor(3);

      expect(store.isGroupEditorOpen).toBe(true);
      expect(store.selectedGroupIndex).toBe(3);
    });

    it('should close group editor', () => {
      const store = useSkillStore();
      store.openGroupEditor();

      store.closeGroupEditor();

      expect(store.isGroupEditorOpen).toBe(false);
    });
  });

  describe('gem selector', () => {
    it('should open gem selector and clear search', () => {
      const store = useSkillStore();
      store.setGemSearchQuery('old query');

      store.openGemSelector();

      expect(store.isGemSelectorOpen).toBe(true);
      expect(store.gemSearchQuery).toBe('');
      expect(store.gemSearchResults).toEqual([]);
    });

    it('should close gem selector', () => {
      const store = useSkillStore();
      store.openGemSelector();
      store.setGemSearchQuery('test');

      store.closeGemSelector();

      expect(store.isGemSelectorOpen).toBe(false);
      expect(store.gemSearchQuery).toBe('');
    });
  });

  describe('gem search', () => {
    beforeEach(() => {
      const store = useSkillStore();
      store.setAvailableGems([
        createMockGem('1', 'Fireball', ['fire', 'projectile', 'spell']),
        createMockGem('2', 'Frostbolt', ['cold', 'projectile', 'spell']),
        createMockGem('3', 'Lightning Strike', ['lightning', 'attack', 'melee']),
        createMockGem('4', 'Fire Trap', ['fire', 'trap']),
      ]);
    });

    it('should search gems by name', () => {
      const store = useSkillStore();

      store.setGemSearchQuery('fire');

      expect(store.gemSearchResults).toHaveLength(2);
      expect(store.gemSearchResults.map((r) => r.gem.name)).toContain('Fireball');
      expect(store.gemSearchResults.map((r) => r.gem.name)).toContain('Fire Trap');
    });

    it('should search gems by tag', () => {
      const store = useSkillStore();

      store.setGemSearchQuery('projectile');

      expect(store.gemSearchResults).toHaveLength(2);
      expect(store.gemSearchResults.every((r) => r.matchType === 'tag')).toBe(true);
    });

    it('should prefer name match over tag match', () => {
      const store = useSkillStore();

      store.setGemSearchQuery('fire');

      // Fireball matches by name, not tag
      const fireballResult = store.gemSearchResults.find((r) => r.gem.name === 'Fireball');
      expect(fireballResult?.matchType).toBe('name');
    });

    it('should be case-insensitive', () => {
      const store = useSkillStore();

      store.setGemSearchQuery('LIGHTNING');

      expect(store.gemSearchResults).toHaveLength(1);
      expect(store.gemSearchResults[0]?.gem.name).toBe('Lightning Strike');
    });

    it('should clear results for empty query', () => {
      const store = useSkillStore();
      store.setGemSearchQuery('fire');

      store.setGemSearchQuery('');

      expect(store.gemSearchResults).toEqual([]);
      expect(store.hasGemSearch).toBe(false);
    });

    it('should limit results to 50', () => {
      const store = useSkillStore();

      // Add 60 gems with matching name
      const gems = [];
      for (let i = 0; i < 60; i++) {
        gems.push(createMockGem(`gem-${i}`, `Test Gem ${i}`));
      }
      store.setAvailableGems(gems);

      store.setGemSearchQuery('test');

      expect(store.gemSearchResults).toHaveLength(50);
    });
  });

  describe('available gems', () => {
    it('should set available gems', () => {
      const store = useSkillStore();
      const gems = [
        createMockGem('1', 'Gem 1'),
        createMockGem('2', 'Gem 2'),
      ];

      store.setAvailableGems(gems);

      expect(store.availableGems).toHaveLength(2);
      expect(store.totalAvailableGems).toBe(2);
    });

    it('should set loading state', () => {
      const store = useSkillStore();

      store.setLoadingGems(true);
      expect(store.isLoadingGems).toBe(true);

      store.setLoadingGems(false);
      expect(store.isLoadingGems).toBe(false);
    });
  });

  describe('active skill', () => {
    it('should set active skill index', () => {
      const store = useSkillStore();

      store.setActiveSkill(2);

      expect(store.activeSkillIndex).toBe(2);
    });
  });

  describe('display mode', () => {
    it('should set display mode', () => {
      const store = useSkillStore();

      store.setDisplayMode('detailed');

      expect(store.displayMode).toBe('detailed');
    });

    it('should toggle display mode', () => {
      const store = useSkillStore();

      expect(store.displayMode).toBe('compact');

      store.toggleDisplayMode();
      expect(store.displayMode).toBe('detailed');

      store.toggleDisplayMode();
      expect(store.displayMode).toBe('compact');
    });
  });

  describe('factory functions', () => {
    it('should create skill group with defaults', () => {
      const store = useSkillStore();

      const group = store.createSkillGroup();

      expect(group.id).toBeDefined();
      expect(group.label).toBe('New Skill');
      expect(group.enabled).toBe(true);
      expect(group.includeInFullDps).toBe(true);
      expect(group.gems).toEqual([]);
    });

    it('should create skill group with custom label', () => {
      const store = useSkillStore();

      const group = store.createSkillGroup('Main DPS');

      expect(group.label).toBe('Main DPS');
    });

    it('should create gem instance with defaults', () => {
      const store = useSkillStore();

      const instance = store.createGemInstance('fireball-gem-id');

      expect(instance.id).toBeDefined();
      expect(instance.gemId).toBe('fireball-gem-id');
      expect(instance.level).toBe(20);
      expect(instance.quality).toBe(20);
      expect(instance.enabled).toBe(true);
      expect(instance.count).toBe(1);
    });
  });
});
