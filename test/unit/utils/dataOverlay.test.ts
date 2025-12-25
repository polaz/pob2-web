/**
 * Unit tests for data overlay system.
 *
 * Tests the deep merge logic, overlay control keys, and utility functions
 * that enable manual corrections to persist across auto-generated data updates.
 */
import { describe, it, expect } from 'vitest';
import {
  OVERLAY_KEYS,
  isPlainObject,
  isDeletedEntry,
  isManualEntry,
  stripOverlayKeys,
  deepMerge,
  applyOverlay,
  mergeWithOverrides,
  getManualKeys,
  getDeletedKeys,
  createOverlayLoader,
} from 'src/utils/dataOverlay';

describe('dataOverlay', () => {
  // ==========================================================================
  // Type Guards
  // ==========================================================================

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
      expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it('should return false for non-plain-objects', () => {
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject([1, 2, 3])).toBe(false);
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
      expect(isPlainObject(new Date())).toBe(false);
      expect(isPlainObject(() => {})).toBe(false);
    });
  });

  describe('isDeletedEntry', () => {
    it('should return true for deleted entries', () => {
      expect(isDeletedEntry({ _deleted: true })).toBe(true);
      expect(isDeletedEntry({ _deleted: true, other: 'data' })).toBe(true);
    });

    it('should return false for non-deleted entries', () => {
      expect(isDeletedEntry({})).toBe(false);
      expect(isDeletedEntry({ _deleted: false })).toBe(false);
      expect(isDeletedEntry({ deleted: true })).toBe(false);
      expect(isDeletedEntry(null)).toBe(false);
      expect(isDeletedEntry('string')).toBe(false);
    });
  });

  describe('isManualEntry', () => {
    it('should return true for manual entries', () => {
      expect(isManualEntry({ _manual: true })).toBe(true);
      expect(isManualEntry({ _manual: true, text: 'custom' })).toBe(true);
    });

    it('should return false for non-manual entries', () => {
      expect(isManualEntry({})).toBe(false);
      expect(isManualEntry({ _manual: false })).toBe(false);
      expect(isManualEntry({ manual: true })).toBe(false);
      expect(isManualEntry(null)).toBe(false);
    });
  });

  // ==========================================================================
  // stripOverlayKeys
  // ==========================================================================

  describe('stripOverlayKeys', () => {
    it('should remove all overlay control keys', () => {
      const input = {
        _deleted: true,
        _manual: true,
        _comment: 'test comment',
        name: 'Test',
        value: 42,
      };

      const result = stripOverlayKeys(input);

      expect(result).toEqual({ name: 'Test', value: 42 });
      expect('_deleted' in result).toBe(false);
      expect('_manual' in result).toBe(false);
      expect('_comment' in result).toBe(false);
    });

    it('should return object unchanged if no control keys', () => {
      const input = { name: 'Test', value: 42 };
      const result = stripOverlayKeys(input);

      expect(result).toEqual(input);
    });

    it('should handle empty objects', () => {
      expect(stripOverlayKeys({})).toEqual({});
    });
  });

  // ==========================================================================
  // deepMerge - Core Logic
  // ==========================================================================

  describe('deepMerge', () => {
    describe('primitive handling', () => {
      it('should return base when override is null', () => {
        expect(deepMerge({ a: 1 }, null)).toEqual({ a: 1 });
      });

      it('should return base when override is undefined', () => {
        expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
      });

      it('should return override when base is null', () => {
        expect(deepMerge(null, { a: 1 })).toEqual({ a: 1 });
      });

      it('should return override when base is undefined', () => {
        expect(deepMerge(undefined, { a: 1 })).toEqual({ a: 1 });
      });

      it('should override primitive with primitive', () => {
        expect(deepMerge(1, 2)).toBe(2);
        expect(deepMerge('a', 'b')).toBe('b');
        expect(deepMerge(true, false)).toBe(false);
      });
    });

    describe('object merging', () => {
      it('should merge simple objects', () => {
        const base = { a: 1, b: 2 };
        const override = { b: 3, c: 4 };

        expect(deepMerge(base, override)).toEqual({ a: 1, b: 3, c: 4 });
      });

      it('should deep merge nested objects', () => {
        const base = {
          level1: {
            a: 1,
            level2: { x: 10, y: 20 },
          },
        };
        const override = {
          level1: {
            b: 2,
            level2: { y: 25, z: 30 },
          },
        };

        expect(deepMerge(base, override)).toEqual({
          level1: {
            a: 1,
            b: 2,
            level2: { x: 10, y: 25, z: 30 },
          },
        });
      });

      it('should not mutate original objects', () => {
        const base = { a: 1, nested: { x: 10 } };
        const override = { b: 2, nested: { y: 20 } };
        const baseCopy = JSON.parse(JSON.stringify(base));
        const overrideCopy = JSON.parse(JSON.stringify(override));

        deepMerge(base, override);

        expect(base).toEqual(baseCopy);
        expect(override).toEqual(overrideCopy);
      });
    });

    describe('array handling', () => {
      it('should replace arrays entirely', () => {
        const base = { arr: [1, 2, 3] };
        const override = { arr: [4, 5] };

        expect(deepMerge(base, override)).toEqual({ arr: [4, 5] });
      });

      it('should not merge array elements', () => {
        const base = { items: [{ id: 1 }, { id: 2 }] };
        const override = { items: [{ id: 3 }] };

        expect(deepMerge(base, override)).toEqual({ items: [{ id: 3 }] });
      });
    });

    describe('_deleted handling', () => {
      it('should remove entries marked as deleted', () => {
        const base = { a: 1, b: 2, c: 3 };
        const override = { b: { _deleted: true } };

        expect(deepMerge(base, override)).toEqual({ a: 1, c: 3 });
      });

      it('should handle nested deletions', () => {
        const base = {
          mods: {
            mod1: { text: 'Mod 1' },
            mod2: { text: 'Mod 2' },
            mod3: { text: 'Mod 3' },
          },
        };
        const override = {
          mods: {
            mod2: { _deleted: true },
          },
        };

        const result = deepMerge(base, override);

        expect(result.mods).toEqual({
          mod1: { text: 'Mod 1' },
          mod3: { text: 'Mod 3' },
        });
        expect('mod2' in result.mods).toBe(false);
      });
    });

    describe('_manual handling', () => {
      it('should preserve _manual flag in output', () => {
        const base = { a: 1 };
        const override = {
          b: { _manual: true, text: 'Manual entry' },
        };

        const result = deepMerge(base, override);

        expect(result).toEqual({
          a: 1,
          b: { _manual: true, text: 'Manual entry' },
        });
      });
    });

    describe('_comment handling', () => {
      it('should strip _comment from output', () => {
        const base = { a: 1 };
        const override = {
          _comment: 'This is a comment',
          b: 2,
        };

        const result = deepMerge(base, override);

        expect(result).toEqual({ a: 1, b: 2 });
        expect('_comment' in result).toBe(false);
      });

      it('should strip nested _comment keys', () => {
        const base = { mods: { mod1: { text: 'Test' } } };
        const override = {
          mods: {
            mod1: {
              _comment: 'Fix display text',
              displayText: 'Fixed',
            },
          },
        };

        const result = deepMerge(base, override);

        expect(result.mods.mod1).toEqual({
          text: 'Test',
          displayText: 'Fixed',
        });
        expect('_comment' in result.mods.mod1).toBe(false);
      });
    });
  });

  // ==========================================================================
  // applyOverlay & mergeWithOverrides
  // ==========================================================================

  describe('applyOverlay', () => {
    it('should return base data when no overrides', () => {
      const base = { a: 1, b: 2 };
      const result = applyOverlay(base);

      expect(result.data).toEqual(base);
      expect(result.stats).toEqual({ overridden: 0, deleted: 0, manual: 0 });
    });

    it('should return base data when overrides is undefined', () => {
      const base = { a: 1 };
      const result = applyOverlay(base, undefined);

      expect(result.data).toEqual(base);
    });

    it('should track override statistics', () => {
      const base = { a: 1, b: 2, c: 3 };
      const override = {
        a: 10, // override
        b: { _deleted: true }, // delete
        d: { _manual: true, value: 4 }, // manual
      };

      const result = applyOverlay(base, override);

      expect(result.data).toEqual({
        a: 10,
        c: 3,
        d: { _manual: true, value: 4 },
      });
      expect(result.stats.overridden).toBeGreaterThan(0);
      expect(result.stats.deleted).toBe(1);
      expect(result.stats.manual).toBe(1);
    });
  });

  describe('mergeWithOverrides', () => {
    it('should be a simple wrapper around applyOverlay', () => {
      const base = { a: 1 };
      const override = { b: 2 };

      expect(mergeWithOverrides(base, override)).toEqual({ a: 1, b: 2 });
    });

    it('should handle undefined overrides', () => {
      const base = { a: 1 };
      expect(mergeWithOverrides(base)).toEqual(base);
    });
  });

  // ==========================================================================
  // Key Extraction Utilities
  // ==========================================================================

  describe('getManualKeys', () => {
    it('should find top-level manual entries', () => {
      const overrides = {
        entry1: { _manual: true },
        entry2: { value: 1 },
        entry3: { _manual: true },
      };

      const keys = getManualKeys(overrides);

      expect(keys).toEqual(new Set(['entry1', 'entry3']));
    });

    it('should find nested manual entries', () => {
      const overrides = {
        mods: {
          mod1: { _manual: true },
          mod2: { text: 'override' },
        },
        gems: {
          gem1: { _manual: true },
        },
      };

      const keys = getManualKeys(overrides);

      expect(keys).toEqual(new Set(['mods.mod1', 'gems.gem1']));
    });

    it('should return empty set when no manual entries', () => {
      const overrides = { a: 1, b: { c: 2 } };
      expect(getManualKeys(overrides)).toEqual(new Set());
    });

    it('should ignore overlay control keys', () => {
      const overrides = {
        _comment: 'test',
        _deleted: true,
        real: { _manual: true },
      };

      expect(getManualKeys(overrides)).toEqual(new Set(['real']));
    });
  });

  describe('getDeletedKeys', () => {
    it('should find deleted entries', () => {
      const overrides = {
        entry1: { _deleted: true },
        entry2: { value: 1 },
        nested: {
          child: { _deleted: true },
        },
      };

      const keys = getDeletedKeys(overrides);

      expect(keys).toEqual(new Set(['entry1', 'nested.child']));
    });

    it('should return empty set when no deletions', () => {
      expect(getDeletedKeys({ a: 1 })).toEqual(new Set());
    });
  });

  // ==========================================================================
  // createOverlayLoader
  // ==========================================================================

  describe('createOverlayLoader', () => {
    it('should combine base and override loaders', async () => {
      const loadBase = async () => ({ a: 1, b: 2 });
      const loadOverrides = async () => ({ b: 3, c: 4 });

      const loader = createOverlayLoader(loadBase, loadOverrides);
      const result = await loader();

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should handle missing override loader', async () => {
      const loadBase = async () => ({ a: 1 });

      const loader = createOverlayLoader(loadBase);
      const result = await loader();

      expect(result).toEqual({ a: 1 });
    });

    it('should handle override loader failure gracefully', async () => {
      const loadBase = async () => ({ a: 1 });
      const loadOverrides = async () => {
        throw new Error('File not found');
      };

      const loader = createOverlayLoader(loadBase, loadOverrides);
      const result = await loader();

      expect(result).toEqual({ a: 1 });
    });
  });

  // ==========================================================================
  // Real-World Scenarios
  // ==========================================================================

  describe('real-world scenarios', () => {
    it('should handle mod cache overlay pattern', () => {
      // Simulates actual mod-cache.json structure
      const baseModCache = {
        version: '1.0.0',
        source: 'PathOfBuilding-PoE2',
        count: 3,
        mods: {
          X_increased_damage: {
            text: '10% increased Damage',
            effects: [{ name: 'Damage', type: 'INC', value: 10 }],
            displayText: '10% increased Damage ',
          },
          X_added_life: {
            text: '+50 to maximum Life',
            effects: [{ name: 'Life', type: 'BASE', value: 50 }],
          },
          deprecated_mod: {
            text: 'Old mod',
            effects: null,
          },
        },
      };

      // Manual overrides file
      const overrides = {
        _comment: 'Fix formatting issues and remove deprecated mods',
        mods: {
          X_increased_damage: {
            _comment: 'Remove trailing space from displayText',
            displayText: '10% increased Damage',
          },
          deprecated_mod: {
            _deleted: true,
          },
          custom_mod: {
            _manual: true,
            _comment: 'Custom mod not in PoB data',
            text: 'Custom Effect',
            effects: [{ name: 'Custom', type: 'FLAG', value: 1 }],
          },
        },
      };

      // Cast to Record for dynamic key access in test
      const result = mergeWithOverrides(baseModCache, overrides) as {
        version: string;
        source: string;
        count: number;
        mods: Record<string, unknown>;
      };

      // Version and source preserved
      expect(result.version).toBe('1.0.0');
      expect(result.source).toBe('PathOfBuilding-PoE2');

      // displayText was corrected
      const damageMod = result.mods.X_increased_damage as Record<string, unknown>;
      expect(damageMod.displayText).toBe('10% increased Damage');

      // Original effects preserved
      expect(damageMod.effects).toEqual([
        { name: 'Damage', type: 'INC', value: 10 },
      ]);

      // Deprecated mod removed
      expect('deprecated_mod' in result.mods).toBe(false);

      // Custom mod added with _manual flag
      expect(result.mods.custom_mod).toEqual({
        _manual: true,
        text: 'Custom Effect',
        effects: [{ name: 'Custom', type: 'FLAG', value: 1 }],
      });

      // _comment keys stripped
      expect('_comment' in result).toBe(false);
      expect('_comment' in damageMod).toBe(false);
    });

    it('should handle gem data overlay pattern', () => {
      const baseGems = {
        gems: {
          Fireball: {
            name: 'Fireball',
            gemType: 'Spell',
            tags: { fire: true, projectile: true },
          },
        },
      };

      const overrides = {
        gems: {
          Fireball: {
            _comment: 'Add missing tag',
            tags: { fire: true, projectile: true, aoe: true },
          },
        },
      };

      const result = mergeWithOverrides(baseGems, overrides);

      // Name preserved, tags updated (arrays/objects at leaf level replaced)
      expect(result.gems.Fireball.name).toBe('Fireball');
      expect(result.gems.Fireball.tags).toEqual({
        fire: true,
        projectile: true,
        aoe: true,
      });
    });
  });

  // ==========================================================================
  // OVERLAY_KEYS constant
  // ==========================================================================

  describe('OVERLAY_KEYS constant', () => {
    it('should have correct key names', () => {
      expect(OVERLAY_KEYS.DELETED).toBe('_deleted');
      expect(OVERLAY_KEYS.MANUAL).toBe('_manual');
      expect(OVERLAY_KEYS.COMMENT).toBe('_comment');
    });
  });
});
