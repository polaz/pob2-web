/**
 * Unit tests for ModDB - Modifier Database.
 *
 * Tests storage, aggregation, flag filtering, conditions, and parent chaining.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ModDB } from 'src/engine/modifiers/ModDB';
import type { Mod, CalcConfig } from 'src/engine/modifiers/types';
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

describe('ModDB', () => {
  let db: ModDB;

  beforeEach(() => {
    db = new ModDB();
  });

  // ==========================================================================
  // Basic Operations
  // ==========================================================================

  describe('basic operations', () => {
    it('should start empty', () => {
      expect(db.size).toBe(0);
      expect(db.getStatNames()).toEqual([]);
    });

    it('should add a single modifier', () => {
      db.addMod(createMod({ name: 'Life', value: 50 }));

      expect(db.size).toBe(1);
      expect(db.hasStat('Life')).toBe(true);
      expect(db.hasStat('Mana')).toBe(false);
    });

    it('should add multiple modifiers for same stat', () => {
      db.addMod(createMod({ name: 'Life', value: 50 }));
      db.addMod(createMod({ name: 'Life', value: 30 }));

      expect(db.size).toBe(2);
      expect(db.sum('BASE', 'Life')).toBe(80);
    });

    it('should add list of modifiers', () => {
      db.addList([
        createMod({ name: 'Life', value: 50 }),
        createMod({ name: 'Mana', value: 100 }),
        createMod({ name: 'Life', value: 30 }),
      ]);

      expect(db.size).toBe(3);
      expect(db.sum('BASE', 'Life')).toBe(80);
      expect(db.sum('BASE', 'Mana')).toBe(100);
    });

    it('should merge another ModDB', () => {
      const other = new ModDB();
      other.addMod(createMod({ name: 'Life', value: 50 }));
      other.addMod(createMod({ name: 'Mana', value: 100 }));

      db.addMod(createMod({ name: 'Life', value: 30 }));
      db.addDB(other);

      expect(db.size).toBe(3);
      expect(db.sum('BASE', 'Life')).toBe(80);
    });

    it('should clear all modifiers', () => {
      db.addMod(createMod({ name: 'Life', value: 50 }));
      db.addMod(createMod({ name: 'Mana', value: 100 }));

      db.clear();

      expect(db.size).toBe(0);
      expect(db.hasStat('Life')).toBe(false);
    });

    it('should remove modifiers by source', () => {
      db.addMod(createMod({ name: 'Life', value: 50, source: 'item', sourceId: 'item-1' }));
      db.addMod(createMod({ name: 'Life', value: 30, source: 'passive', sourceId: 'node-1' }));
      db.addMod(createMod({ name: 'Mana', value: 100, source: 'item', sourceId: 'item-2' }));

      db.removeBySource('item');

      expect(db.size).toBe(1);
      expect(db.sum('BASE', 'Life')).toBe(30);
    });

    it('should remove modifiers by source and sourceId', () => {
      db.addMod(createMod({ name: 'Life', value: 50, source: 'item', sourceId: 'item-1' }));
      db.addMod(createMod({ name: 'Life', value: 30, source: 'item', sourceId: 'item-2' }));

      db.removeBySource('item', 'item-1');

      expect(db.size).toBe(1);
      expect(db.sum('BASE', 'Life')).toBe(30);
    });
  });

  // ==========================================================================
  // Sum Aggregation
  // ==========================================================================

  describe('sum aggregation', () => {
    it('should sum BASE values', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 50 }));
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 30 }));
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 20 }));

      expect(db.sum('BASE', 'Life')).toBe(100);
    });

    it('should sum INC values', () => {
      db.addMod(createMod({ name: 'Life', type: 'INC', value: 0.1 }));
      db.addMod(createMod({ name: 'Life', type: 'INC', value: 0.2 }));

      expect(db.sum('INC', 'Life')).toBeCloseTo(0.3);
    });

    it('should sum across multiple stat names', () => {
      db.addMod(createMod({ name: 'PhysicalDamage', type: 'INC', value: 0.1 }));
      db.addMod(createMod({ name: 'Damage', type: 'INC', value: 0.2 }));

      expect(db.sum('INC', 'PhysicalDamage', 'Damage')).toBeCloseTo(0.3);
    });

    it('should return 0 for non-existent stat', () => {
      expect(db.sum('BASE', 'NonExistent')).toBe(0);
    });

    it('should only sum matching mod types', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 50 }));
      db.addMod(createMod({ name: 'Life', type: 'INC', value: 0.1 }));
      db.addMod(createMod({ name: 'Life', type: 'MORE', value: 0.2 }));

      expect(db.sum('BASE', 'Life')).toBe(50);
      expect(db.sum('INC', 'Life')).toBeCloseTo(0.1);
    });
  });

  // ==========================================================================
  // More Aggregation
  // ==========================================================================

  describe('more aggregation', () => {
    it('should multiply MORE values', () => {
      db.addMod(createMod({ name: 'Damage', type: 'MORE', value: 0.2 }));
      db.addMod(createMod({ name: 'Damage', type: 'MORE', value: 0.3 }));

      // (1 + 0.2) * (1 + 0.3) = 1.2 * 1.3 = 1.56
      expect(db.more('Damage')).toBeCloseTo(1.56);
    });

    it('should return 1 for no MORE mods', () => {
      expect(db.more('Damage')).toBe(1);
    });

    it('should handle negative MORE (less) values', () => {
      db.addMod(createMod({ name: 'Damage', type: 'MORE', value: -0.2 }));

      // (1 + (-0.2)) = 0.8
      expect(db.more('Damage')).toBeCloseTo(0.8);
    });

    it('should multiply across multiple stat names', () => {
      db.addMod(createMod({ name: 'PhysicalDamage', type: 'MORE', value: 0.2 }));
      db.addMod(createMod({ name: 'Damage', type: 'MORE', value: 0.3 }));

      // (1 + 0.2) * (1 + 0.3) = 1.56
      expect(db.more('PhysicalDamage', 'Damage')).toBeCloseTo(1.56);
    });
  });

  // ==========================================================================
  // Flag Check
  // ==========================================================================

  describe('flag check', () => {
    it('should return true if FLAG exists', () => {
      db.addMod(createMod({ name: 'CannotBeChilled', type: 'FLAG', value: 1 }));

      expect(db.flag('CannotBeChilled')).toBe(true);
    });

    it('should return false if no FLAG', () => {
      expect(db.flag('CannotBeChilled')).toBe(false);
    });

    it('should check multiple names', () => {
      db.addMod(createMod({ name: 'CannotBeChilled', type: 'FLAG', value: 1 }));

      expect(db.flag('CannotBeFrozen', 'CannotBeChilled')).toBe(true);
      expect(db.flag('CannotBeFrozen', 'CannotBeShocked')).toBe(false);
    });
  });

  // ==========================================================================
  // Override
  // ==========================================================================

  describe('override', () => {
    it('should return override value', () => {
      db.addMod(createMod({ name: 'CritChance', type: 'OVERRIDE', value: 100 }));

      expect(db.override('CritChance')).toBe(100);
    });

    it('should return highest override', () => {
      db.addMod(createMod({ name: 'CritChance', type: 'OVERRIDE', value: 50 }));
      db.addMod(createMod({ name: 'CritChance', type: 'OVERRIDE', value: 100 }));

      expect(db.override('CritChance')).toBe(100);
    });

    it('should return undefined if no override', () => {
      expect(db.override('CritChance')).toBeUndefined();
    });
  });

  // ==========================================================================
  // List Collection
  // ==========================================================================

  describe('list collection', () => {
    it('should collect LIST values', () => {
      db.addMod(createMod({ name: 'ExtraSkill', type: 'LIST', value: 100 }));
      db.addMod(createMod({ name: 'ExtraSkill', type: 'LIST', value: 200 }));

      const list = db.list('ExtraSkill');

      expect(list).toHaveLength(2);
      expect(list[0]?.value).toBe(100);
      expect(list[1]?.value).toBe(200);
    });

    it('should return empty array if no LIST mods', () => {
      expect(db.list('ExtraSkill')).toEqual([]);
    });
  });

  // ==========================================================================
  // Full Calculation
  // ==========================================================================

  describe('calc - full calculation', () => {
    it('should calculate BASE only', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result = db.calc('Life');

      expect(result.value).toBe(100);
      expect(result.base).toBe(100);
      expect(result.inc).toBe(0);
      expect(result.more).toBe(1);
    });

    it('should calculate BASE + INC', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      db.addMod(createMod({ name: 'Life', type: 'INC', value: 0.5 }));

      const result = db.calc('Life');

      // 100 * (1 + 0.5) = 150
      expect(result.value).toBe(150);
      expect(result.base).toBe(100);
      expect(result.inc).toBeCloseTo(0.5);
    });

    it('should calculate BASE + INC + MORE', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      db.addMod(createMod({ name: 'Life', type: 'INC', value: 0.5 }));
      db.addMod(createMod({ name: 'Life', type: 'MORE', value: 0.2 }));
      db.addMod(createMod({ name: 'Life', type: 'MORE', value: 0.3 }));

      const result = db.calc('Life');

      // 100 * (1 + 0.5) * (1.2) * (1.3) = 100 * 1.5 * 1.56 = 234
      expect(result.value).toBeCloseTo(234);
      expect(result.base).toBe(100);
      expect(result.inc).toBeCloseTo(0.5);
      expect(result.more).toBeCloseTo(1.56);
    });

    it('should use OVERRIDE instead of calculated value', () => {
      db.addMod(createMod({ name: 'CritChance', type: 'BASE', value: 5 }));
      db.addMod(createMod({ name: 'CritChance', type: 'INC', value: 1.0 }));
      db.addMod(createMod({ name: 'CritChance', type: 'OVERRIDE', value: 100 }));

      const result = db.calc('CritChance');

      expect(result.value).toBe(100);
      expect(result.override).toBe(100);
    });

    it('should calculate across multiple stat names', () => {
      db.addMod(createMod({ name: 'PhysicalDamage', type: 'BASE', value: 100 }));
      db.addMod(createMod({ name: 'Damage', type: 'INC', value: 0.2 }));
      db.addMod(createMod({ name: 'PhysicalDamage', type: 'MORE', value: 0.3 }));

      const result = db.calc('PhysicalDamage', 'Damage');

      // 100 * (1 + 0.2) * 1.3 = 156
      expect(result.value).toBeCloseTo(156);
    });
  });

  // ==========================================================================
  // Flag Filtering
  // ==========================================================================

  describe('flag filtering', () => {
    it('should filter by damage flags', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.2,
        flags: ModFlag.Attack,
      }));
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.3,
        flags: ModFlag.Spell,
      }));

      const attackConfig: CalcConfig = { flags: ModFlag.Attack };
      const spellConfig: CalcConfig = { flags: ModFlag.Spell };

      expect(db.sum('INC', 'Damage', attackConfig)).toBeCloseTo(0.2);
      expect(db.sum('INC', 'Damage', spellConfig)).toBeCloseTo(0.3);
    });

    it('should include mods with no flags', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.2,
        flags: 0n, // Applies to all
      }));
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.3,
        flags: ModFlag.Attack,
      }));

      const attackConfig: CalcConfig = { flags: ModFlag.Attack };

      // Both should match attack config
      expect(db.sum('INC', 'Damage', attackConfig)).toBeCloseTo(0.5);
    });

    it('should filter by combined flags', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.2,
        flags: ModFlag.Attack | ModFlag.Melee,
      }));

      const meleeAttack: CalcConfig = { flags: ModFlag.Attack | ModFlag.Melee };
      const rangedAttack: CalcConfig = { flags: ModFlag.Attack | ModFlag.Projectile };

      expect(db.sum('INC', 'Damage', meleeAttack)).toBeCloseTo(0.2);
      expect(db.sum('INC', 'Damage', rangedAttack)).toBe(0);
    });

    it('should filter by keyword flags', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'MORE',
        value: 0.2,
        keywordFlags: KeywordFlag.Fire,
      }));

      const fireConfig: CalcConfig = { keywordFlags: KeywordFlag.Fire };
      const coldConfig: CalcConfig = { keywordFlags: KeywordFlag.Cold };

      expect(db.more('Damage', fireConfig)).toBeCloseTo(1.2);
      expect(db.more('Damage', coldConfig)).toBe(1);
    });
  });

  // ==========================================================================
  // Conditions
  // ==========================================================================

  describe('conditions', () => {
    it('should apply Condition type', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'MORE',
        value: 0.4,
        condition: { type: 'Condition', var: 'LowLife' },
      }));

      const lowLife: CalcConfig = { conditions: { LowLife: true } };
      const fullLife: CalcConfig = { conditions: { LowLife: false } };

      expect(db.more('Damage', lowLife)).toBeCloseTo(1.4);
      expect(db.more('Damage', fullLife)).toBe(1);
    });

    it('should apply negated Condition', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'MORE',
        value: 0.3,
        condition: { type: 'Condition', var: 'LowLife', neg: true },
      }));

      const lowLife: CalcConfig = { conditions: { LowLife: true } };
      const notLowLife: CalcConfig = { conditions: { LowLife: false } };

      expect(db.more('Damage', lowLife)).toBe(1);
      expect(db.more('Damage', notLowLife)).toBeCloseTo(1.3);
    });

    it('should apply StatThreshold condition', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.5,
        condition: { type: 'StatThreshold', stat: 'Strength', threshold: 200 },
      }));

      const lowStr: CalcConfig = { stats: { Strength: 100 } };
      const highStr: CalcConfig = { stats: { Strength: 250 } };

      expect(db.sum('INC', 'Damage', lowStr)).toBe(0);
      expect(db.sum('INC', 'Damage', highStr)).toBeCloseTo(0.5);
    });

    it('should apply PerStat multiplier', () => {
      db.addMod(createMod({
        name: 'Life',
        type: 'BASE',
        value: 5,
        condition: { type: 'PerStat', stat: 'Strength', div: 10 },
      }));

      const str50: CalcConfig = { stats: { Strength: 50 } };
      const str100: CalcConfig = { stats: { Strength: 100 } };

      // 5 * floor(50/10) = 5 * 5 = 25
      expect(db.sum('BASE', 'Life', str50)).toBe(25);
      // 5 * floor(100/10) = 5 * 10 = 50
      expect(db.sum('BASE', 'Life', str100)).toBe(50);
    });

    it('should apply Multiplier condition', () => {
      db.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.05,
        condition: { type: 'Multiplier', var: 'FrenzyCharges' },
      }));

      const noCharges: CalcConfig = { stats: { FrenzyCharges: 0 } };
      const threeCharges: CalcConfig = { stats: { FrenzyCharges: 3 } };

      expect(db.sum('INC', 'Damage', noCharges)).toBe(0);
      // 0.05 * 3 = 0.15
      expect(db.sum('INC', 'Damage', threeCharges)).toBeCloseTo(0.15);
    });

    it('should apply SocketedIn condition', () => {
      db.addMod(createMod({
        name: 'GemLevel',
        type: 'BASE',
        value: 2,
        condition: { type: 'SocketedIn', var: 'Helmet' },
      }));

      const helmet: CalcConfig = { slotName: 'Helmet' };
      const gloves: CalcConfig = { slotName: 'Gloves' };

      expect(db.sum('BASE', 'GemLevel', helmet)).toBe(2);
      expect(db.sum('BASE', 'GemLevel', gloves)).toBe(0);
    });
  });

  // ==========================================================================
  // Parent Chaining
  // ==========================================================================

  describe('parent chaining', () => {
    it('should inherit mods from parent', () => {
      const parent = new ModDB();
      parent.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const child = new ModDB({ parent });
      child.addMod(createMod({ name: 'Life', type: 'BASE', value: 50 }));

      expect(child.sum('BASE', 'Life')).toBe(150);
    });

    it('should check parent for hasStat', () => {
      const parent = new ModDB();
      parent.addMod(createMod({ name: 'GlobalMod', type: 'FLAG', value: 1 }));

      const child = new ModDB({ parent });

      expect(child.hasStat('GlobalMod')).toBe(true);
    });

    it('should not modify parent when adding to child', () => {
      const parent = new ModDB();
      parent.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const child = new ModDB({ parent });
      child.addMod(createMod({ name: 'Life', type: 'BASE', value: 50 }));

      expect(parent.sum('BASE', 'Life')).toBe(100);
      expect(child.sum('BASE', 'Life')).toBe(150);
    });

    it('should support deep parent chains', () => {
      const grandparent = new ModDB();
      grandparent.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const parent = new ModDB({ parent: grandparent });
      parent.addMod(createMod({ name: 'Life', type: 'INC', value: 0.5 }));

      const child = new ModDB({ parent });
      child.addMod(createMod({ name: 'Life', type: 'MORE', value: 0.2 }));

      // 100 * (1 + 0.5) * 1.2 = 180
      expect(child.calc('Life').value).toBeCloseTo(180);
    });
  });

  // ==========================================================================
  // Actor Type
  // ==========================================================================

  describe('actor type', () => {
    it('should default to player', () => {
      expect(db.getActor()).toBe('player');
    });

    it('should accept custom actor type', () => {
      const minionDb = new ModDB({ actor: 'minion' });
      expect(minionDb.getActor()).toBe('minion');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle zero values', () => {
      db.addMod(createMod({ name: 'Damage', type: 'BASE', value: 0 }));
      db.addMod(createMod({ name: 'Damage', type: 'INC', value: 0 }));

      expect(db.calc('Damage').value).toBe(0);
    });

    it('should handle negative values', () => {
      db.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));
      db.addMod(createMod({ name: 'Damage', type: 'INC', value: -0.5 }));

      // 100 * (1 + (-0.5)) = 50
      expect(db.calc('Damage').value).toBe(50);
    });

    it('should handle very small INC values', () => {
      db.addMod(createMod({ name: 'Damage', type: 'BASE', value: 1000 }));
      db.addMod(createMod({ name: 'Damage', type: 'INC', value: 0.001 }));

      expect(db.calc('Damage').value).toBeCloseTo(1001);
    });

    it('should handle empty config object', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      expect(db.sum('BASE', 'Life', {})).toBe(100);
    });

    it('should handle division by zero in PerStat condition', () => {
      // When div <= 0, the PerStat multiplication is skipped to avoid NaN
      // The modifier is still included, but its value is not scaled
      db.addMod(
        createMod({
          name: 'Damage',
          type: 'BASE',
          value: 10,
          condition: { type: 'PerStat', stat: 'Strength', div: 0 },
        })
      );

      const config = { stats: { Strength: 100 } };
      // With div=0, the PerStat scaling is skipped, original value used
      expect(db.sum('BASE', 'Damage', config)).toBe(10);
    });

    it('should handle empty names array returning default values', () => {
      db.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      // Calling with no stat names returns defaults
      expect(db.sum('BASE')).toBe(0);
      expect(db.more()).toBe(1);
      expect(db.flag()).toBe(false);
    });

    it('should throw on mixed types in arguments', () => {
      // Config object in the middle of stat names is invalid
      // Runtime validation catches this even though types allow it
      expect(() => {
        db.sum('BASE', 'Life', {}, 'Damage');
      }).toThrow(TypeError);
    });

    it('should throw when only config object is passed without stat names', () => {
      // Passing just a config with no stat names should throw
      // Runtime validation catches this even though types allow it
      expect(() => {
        db.more({ flags: 1n });
      }).toThrow(TypeError);
    });
  });
});
