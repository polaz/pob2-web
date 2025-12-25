/**
 * Unit tests for ModList - Ordered collection of modifiers.
 *
 * Tests add operations, filtering, iteration, and ModDB integration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ModList } from 'src/engine/modifiers/ModList';
import { ModDB } from 'src/engine/modifiers/ModDB';
import type { Mod } from 'src/engine/modifiers/types';
import { ModFlag, KeywordFlag } from 'src/types/mods';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test modifier with defaults.
 */
function createMod(overrides: Partial<Mod> = {}): Mod {
  return {
    name: 'TestStat',
    type: 'BASE',
    value: 10,
    flags: 0n,
    keywordFlags: 0n,
    source: 'item',
    sourceId: 'test-item-1',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ModList', () => {
  let list: ModList;

  beforeEach(() => {
    list = new ModList();
  });

  // ==========================================================================
  // Constructor and Properties
  // ==========================================================================

  describe('constructor and properties', () => {
    it('should start empty by default', () => {
      expect(list.length).toBe(0);
      expect(list.isEmpty).toBe(true);
    });

    it('should accept initial modifiers', () => {
      const mods = [
        createMod({ name: 'Life', value: 50 }),
        createMod({ name: 'Mana', value: 100 }),
      ];
      const listWithMods = new ModList(mods);

      expect(listWithMods.length).toBe(2);
      expect(listWithMods.isEmpty).toBe(false);
    });

    it('should not modify the original array', () => {
      const mods = [createMod({ name: 'Life', value: 50 })];
      const listWithMods = new ModList(mods);

      listWithMods.addMod(createMod({ name: 'Mana', value: 100 }));

      expect(mods.length).toBe(1);
      expect(listWithMods.length).toBe(2);
    });
  });

  // ==========================================================================
  // Add Operations
  // ==========================================================================

  describe('add operations', () => {
    it('should add a single modifier', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));

      expect(list.length).toBe(1);
      expect(list.get(0)?.name).toBe('Life');
    });

    it('should support method chaining', () => {
      const result = list
        .addMod(createMod({ name: 'Life', value: 50 }))
        .addMod(createMod({ name: 'Mana', value: 100 }));

      expect(result).toBe(list);
      expect(list.length).toBe(2);
    });

    it('should add multiple modifiers from array', () => {
      list.addList([
        createMod({ name: 'Life', value: 50 }),
        createMod({ name: 'Mana', value: 100 }),
        createMod({ name: 'Life', value: 30 }),
      ]);

      expect(list.length).toBe(3);
    });

    it('should merge another ModList', () => {
      const other = new ModList([
        createMod({ name: 'Life', value: 50 }),
        createMod({ name: 'Mana', value: 100 }),
      ]);

      list.addMod(createMod({ name: 'Energy', value: 200 }));
      list.merge(other);

      expect(list.length).toBe(3);
      expect(list.hasName('Life')).toBe(true);
      expect(list.hasName('Mana')).toBe(true);
      expect(list.hasName('Energy')).toBe(true);
    });

    it('should preserve order when adding', () => {
      list.addMod(createMod({ name: 'First', value: 1 }));
      list.addMod(createMod({ name: 'Second', value: 2 }));
      list.addMod(createMod({ name: 'Third', value: 3 }));

      expect(list.get(0)?.name).toBe('First');
      expect(list.get(1)?.name).toBe('Second');
      expect(list.get(2)?.name).toBe('Third');
    });
  });

  // ==========================================================================
  // Remove Operations
  // ==========================================================================

  describe('remove operations', () => {
    it('should clear all modifiers', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));
      list.addMod(createMod({ name: 'Mana', value: 100 }));

      list.clear();

      expect(list.length).toBe(0);
      expect(list.isEmpty).toBe(true);
    });

    it('should remove modifiers by source', () => {
      list.addMod(createMod({ name: 'Life', value: 50, source: 'item' }));
      list.addMod(createMod({ name: 'Mana', value: 100, source: 'passive' }));
      list.addMod(createMod({ name: 'Energy', value: 200, source: 'item' }));

      list.removeBySource('item');

      expect(list.length).toBe(1);
      expect(list.get(0)?.name).toBe('Mana');
    });

    it('should remove modifiers by source and sourceId', () => {
      list.addMod(createMod({ name: 'Life', value: 50, source: 'item', sourceId: 'item-1' }));
      list.addMod(createMod({ name: 'Mana', value: 100, source: 'item', sourceId: 'item-2' }));
      list.addMod(createMod({ name: 'Energy', value: 200, source: 'item', sourceId: 'item-1' }));

      list.removeBySource('item', 'item-1');

      expect(list.length).toBe(1);
      expect(list.get(0)?.name).toBe('Mana');
    });
  });

  // ==========================================================================
  // Filter Operations
  // ==========================================================================

  describe('filter operations', () => {
    beforeEach(() => {
      list.addList([
        createMod({ name: 'Life', type: 'BASE', value: 50, source: 'item' }),
        createMod({ name: 'Life', type: 'INC', value: 0.1, source: 'passive' }),
        createMod({ name: 'Mana', type: 'BASE', value: 100, source: 'item' }),
        createMod({ name: 'Damage', type: 'MORE', value: 0.2, source: 'gem' }),
      ]);
    });

    it('should filter by custom predicate', () => {
      const baseMods = list.filter((mod) => mod.type === 'BASE');

      expect(baseMods.length).toBe(2);
      expect(baseMods.every((mod) => mod.type === 'BASE')).toBe(true);
    });

    it('should filter by type', () => {
      const incMods = list.filterByType('INC');

      expect(incMods.length).toBe(1);
      expect(incMods.get(0)?.name).toBe('Life');
    });

    it('should filter by name', () => {
      const lifeMods = list.filterByName('Life');

      expect(lifeMods.length).toBe(2);
      expect(lifeMods.every((mod) => mod.name === 'Life')).toBe(true);
    });

    it('should filter by source', () => {
      const itemMods = list.filterBySource('item');

      expect(itemMods.length).toBe(2);
      expect(itemMods.every((mod) => mod.source === 'item')).toBe(true);
    });

    it('should filter by source and sourceId', () => {
      list.clear();
      list.addMod(createMod({ source: 'item', sourceId: 'item-1' }));
      list.addMod(createMod({ source: 'item', sourceId: 'item-2' }));
      list.addMod(createMod({ source: 'item', sourceId: 'item-1' }));

      const filtered = list.filterBySource('item', 'item-1');

      expect(filtered.length).toBe(2);
    });

    it('should filter by flags', () => {
      list.clear();
      list.addMod(createMod({ name: 'Damage', flags: ModFlag.Attack }));
      list.addMod(createMod({ name: 'Damage', flags: ModFlag.Spell }));
      list.addMod(createMod({ name: 'Damage', flags: ModFlag.Attack | ModFlag.Melee }));

      const attackMods = list.filterByFlags(ModFlag.Attack);

      expect(attackMods.length).toBe(2);
    });

    it('should filter by keyword flags', () => {
      list.clear();
      list.addMod(createMod({ name: 'Damage', keywordFlags: KeywordFlag.Fire }));
      list.addMod(createMod({ name: 'Damage', keywordFlags: KeywordFlag.Cold }));
      list.addMod(createMod({ name: 'Damage', keywordFlags: KeywordFlag.Fire | KeywordFlag.Spell }));

      const fireMods = list.filterByKeywordFlags(KeywordFlag.Fire);

      expect(fireMods.length).toBe(2);
    });

    it('should return new ModList from filter', () => {
      const filtered = list.filterByType('BASE');

      expect(filtered).not.toBe(list);
      expect(filtered).toBeInstanceOf(ModList);
    });

    it('should not modify original list when filtering', () => {
      const originalLength = list.length;
      list.filterByType('BASE');

      expect(list.length).toBe(originalLength);
    });
  });

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  describe('query operations', () => {
    beforeEach(() => {
      list.addList([
        createMod({ name: 'Life', type: 'BASE', value: 50 }),
        createMod({ name: 'Mana', type: 'BASE', value: 100 }),
        createMod({ name: 'Life', type: 'INC', value: 0.1 }),
      ]);
    });

    it('should check if any modifier matches with some()', () => {
      expect(list.some((mod) => mod.name === 'Life')).toBe(true);
      expect(list.some((mod) => mod.name === 'Energy')).toBe(false);
    });

    it('should check if all modifiers match with every()', () => {
      expect(list.every((mod) => mod.type === 'BASE' || mod.type === 'INC')).toBe(true);
      expect(list.every((mod) => mod.type === 'BASE')).toBe(false);
    });

    it('should find first matching modifier', () => {
      const found = list.find((mod) => mod.name === 'Mana');

      expect(found).toBeDefined();
      expect(found?.value).toBe(100);
    });

    it('should return undefined when find has no match', () => {
      const found = list.find((mod) => mod.name === 'Energy');

      expect(found).toBeUndefined();
    });

    it('should check if name exists with hasName()', () => {
      expect(list.hasName('Life')).toBe(true);
      expect(list.hasName('Energy')).toBe(false);
    });

    it('should check if type exists with hasType()', () => {
      expect(list.hasType('BASE')).toBe(true);
      expect(list.hasType('MORE')).toBe(false);
    });

    it('should get modifier by index', () => {
      expect(list.get(0)?.name).toBe('Life');
      expect(list.get(1)?.name).toBe('Mana');
      expect(list.get(10)).toBeUndefined();
    });
  });

  // ==========================================================================
  // Transform Operations
  // ==========================================================================

  describe('transform operations', () => {
    it('should map modifiers to new ModList', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));
      list.addMod(createMod({ name: 'Mana', value: 100 }));

      const doubled = list.map((mod) => ({ ...mod, value: (mod.value as number) * 2 }));

      expect(doubled.get(0)?.value).toBe(100);
      expect(doubled.get(1)?.value).toBe(200);
    });

    it('should not modify original list when mapping', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));

      list.map((mod) => ({ ...mod, value: (mod.value as number) * 2 }));

      expect(list.get(0)?.value).toBe(50);
    });

    it('should execute forEach for each modifier', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));
      list.addMod(createMod({ name: 'Mana', value: 100 }));

      const values: number[] = [];
      list.forEach((mod) => values.push(mod.value as number));

      expect(values).toEqual([50, 100]);
    });

    it('should provide index in forEach', () => {
      list.addMod(createMod({ name: 'Life' }));
      list.addMod(createMod({ name: 'Mana' }));

      const indices: number[] = [];
      list.forEach((_, index) => indices.push(index));

      expect(indices).toEqual([0, 1]);
    });
  });

  // ==========================================================================
  // Export Operations
  // ==========================================================================

  describe('export operations', () => {
    it('should apply modifiers to ModDB', () => {
      list.addMod(createMod({ name: 'Life', type: 'BASE', value: 50 }));
      list.addMod(createMod({ name: 'Life', type: 'BASE', value: 30 }));

      const db = new ModDB();
      list.applyTo(db);

      expect(db.sum('BASE', 'Life')).toBe(80);
    });

    it('should clone the list', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));

      const cloned = list.clone();

      expect(cloned.length).toBe(1);
      expect(cloned).not.toBe(list);

      // Modifying clone should not affect original
      cloned.addMod(createMod({ name: 'Mana', value: 100 }));
      expect(list.length).toBe(1);
      expect(cloned.length).toBe(2);
    });

    it('should convert to array', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));
      list.addMod(createMod({ name: 'Mana', value: 100 }));

      const arr = list.toArray();

      expect(arr).toBeInstanceOf(Array);
      expect(arr.length).toBe(2);
      expect(arr[0]?.name).toBe('Life');
    });

    it('should return new array from toArray()', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));

      const arr = list.toArray();
      arr.push(createMod({ name: 'Mana', value: 100 }));

      expect(list.length).toBe(1);
    });

    it('should get unique stat names', () => {
      list.addMod(createMod({ name: 'Life' }));
      list.addMod(createMod({ name: 'Mana' }));
      list.addMod(createMod({ name: 'Life' }));
      list.addMod(createMod({ name: 'Energy' }));

      const names = list.getStatNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('Life');
      expect(names).toContain('Mana');
      expect(names).toContain('Energy');
    });

    it('should get unique sources', () => {
      list.addMod(createMod({ source: 'item' }));
      list.addMod(createMod({ source: 'passive' }));
      list.addMod(createMod({ source: 'item' }));
      list.addMod(createMod({ source: 'gem' }));

      const sources = list.getSources();

      expect(sources).toHaveLength(3);
      expect(sources).toContain('item');
      expect(sources).toContain('passive');
      expect(sources).toContain('gem');
    });
  });

  // ==========================================================================
  // Iteration
  // ==========================================================================

  describe('iteration', () => {
    it('should support for...of loops', () => {
      list.addMod(createMod({ name: 'Life', value: 50 }));
      list.addMod(createMod({ name: 'Mana', value: 100 }));

      const names: string[] = [];
      for (const mod of list) {
        names.push(mod.name);
      }

      expect(names).toEqual(['Life', 'Mana']);
    });

    it('should support spread operator', () => {
      list.addMod(createMod({ name: 'Life' }));
      list.addMod(createMod({ name: 'Mana' }));

      const mods = [...list];

      expect(mods.length).toBe(2);
    });

    it('should support Array.from()', () => {
      list.addMod(createMod({ name: 'Life' }));
      list.addMod(createMod({ name: 'Mana' }));

      const mods = Array.from(list);

      expect(mods.length).toBe(2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty list operations', () => {
      expect(list.filterByType('BASE').length).toBe(0);
      expect(list.some(() => true)).toBe(false);
      expect(list.every(() => true)).toBe(true);
      expect(list.find(() => true)).toBeUndefined();
      expect(list.getStatNames()).toEqual([]);
      expect(list.getSources()).toEqual([]);
    });

    it('should handle chained operations', () => {
      list
        .addMod(createMod({ name: 'Life', type: 'BASE', source: 'item' }))
        .addMod(createMod({ name: 'Life', type: 'INC', source: 'passive' }))
        .addMod(createMod({ name: 'Mana', type: 'BASE', source: 'item' }));

      const result = list.filterByName('Life').filterByType('BASE');

      expect(result.length).toBe(1);
      expect(result.get(0)?.source).toBe('item');
    });

    it('should handle merging empty lists', () => {
      const empty = new ModList();
      list.addMod(createMod({ name: 'Life' }));

      list.merge(empty);

      expect(list.length).toBe(1);
    });

    it('should handle merging into empty list', () => {
      const other = new ModList([createMod({ name: 'Life' })]);

      list.merge(other);

      expect(list.length).toBe(1);
    });
  });
});
