/**
 * Unit tests for mod type definitions.
 *
 * Tests type structures, flag constants, and type guards.
 */
import { describe, it, expect } from 'vitest';
import {
  ModFlag,
  KeywordFlag,
  type ModType,
  type ModEffect,
  type ModDefinition,
  type ModCache,
} from 'src/types/mods';

describe('mods types', () => {
  describe('ModFlag constants', () => {
    it('should have distinct flag values', () => {
      const flags = Object.values(ModFlag);
      const uniqueFlags = new Set(flags);

      expect(uniqueFlags.size).toBe(flags.length);
    });

    it('should be powers of 2 (bitwise flags)', () => {
      for (const [name, value] of Object.entries(ModFlag)) {
        // Check if value is a power of 2 (only one bit set)
        const isPowerOf2 = value > 0n && (value & (value - 1n)) === 0n;
        expect(isPowerOf2, `${name} should be power of 2`).toBe(true);
      }
    });

    it('should use sequential bit positions starting from 0', () => {
      const values = Object.values(ModFlag).sort((a, b) => (a < b ? -1 : 1));

      // Verify first flag is 1n << 0n = 1n
      expect(values[0]).toBe(1n);

      // Verify each subsequent flag is exactly 2x the previous (next bit)
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBe(values[i - 1]! * 2n);
      }
    });

    it('should support bitwise OR operations', () => {
      const combined = ModFlag.Attack | ModFlag.Melee | ModFlag.Sword;

      expect(combined & ModFlag.Attack).toBe(ModFlag.Attack);
      expect(combined & ModFlag.Melee).toBe(ModFlag.Melee);
      expect(combined & ModFlag.Sword).toBe(ModFlag.Sword);
      expect(combined & ModFlag.Spell).toBe(0n);
    });
  });

  describe('KeywordFlag constants', () => {
    it('should have distinct flag values', () => {
      const flags = Object.values(KeywordFlag);
      const uniqueFlags = new Set(flags);

      expect(uniqueFlags.size).toBe(flags.length);
    });

    it('should be powers of 2 (bitwise flags)', () => {
      for (const [name, value] of Object.entries(KeywordFlag)) {
        const isPowerOf2 = value > 0n && (value & (value - 1n)) === 0n;
        expect(isPowerOf2, `${name} should be power of 2`).toBe(true);
      }
    });

    it('should use sequential bit positions starting from 0', () => {
      const values = Object.values(KeywordFlag).sort((a, b) => (a < b ? -1 : 1));

      // Verify first flag is 1n << 0n = 1n
      expect(values[0]).toBe(1n);

      // Verify each subsequent flag is exactly 2x the previous (next bit)
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBe(values[i - 1]! * 2n);
      }
    });

    it('should support bitwise OR operations', () => {
      const combined = KeywordFlag.Fire | KeywordFlag.Spell | KeywordFlag.Hit;

      expect(combined & KeywordFlag.Fire).toBe(KeywordFlag.Fire);
      expect(combined & KeywordFlag.Spell).toBe(KeywordFlag.Spell);
      expect(combined & KeywordFlag.Cold).toBe(0n);
    });
  });

  describe('ModType', () => {
    it('should accept valid mod types', () => {
      const types: ModType[] = ['BASE', 'INC', 'MORE', 'OVERRIDE', 'FLAG', 'LIST'];

      expect(types).toHaveLength(6);
      expect(types).toContain('BASE');
      expect(types).toContain('MORE');
    });
  });

  describe('ModEffect structure', () => {
    it('should accept minimal effect', () => {
      const effect: ModEffect = {
        name: 'Life',
        type: 'BASE',
        value: 50,
      };

      expect(effect.name).toBe('Life');
      expect(effect.type).toBe('BASE');
      expect(effect.value).toBe(50);
      expect(effect.flags).toBeUndefined();
    });

    it('should accept effect with flags', () => {
      const effect: ModEffect = {
        name: 'PhysicalDamage',
        type: 'INC',
        value: 20,
        flags: Number(ModFlag.Attack | ModFlag.Melee),
        keywordFlags: Number(KeywordFlag.Physical),
      };

      expect(effect.flags).toBeDefined();
      expect(effect.keywordFlags).toBeDefined();
    });

    it('should accept effect with condition', () => {
      const effect: ModEffect = {
        name: 'Damage',
        type: 'MORE',
        value: 40,
        condition: {
          type: 'Condition',
          var: 'LowLife',
        },
      };

      expect(effect.condition?.type).toBe('Condition');
      expect(effect.condition?.var).toBe('LowLife');
    });
  });

  describe('ModDefinition structure', () => {
    it('should accept definition without effects', () => {
      const def: ModDefinition = {
        text: '(10-15)% increased Energy Shield',
        effects: null,
        displayText: '(10-15)% increased Energy Shield ',
      };

      expect(def.text).toBe('(10-15)% increased Energy Shield');
      expect(def.effects).toBeNull();
    });

    it('should accept definition with effects', () => {
      const def: ModDefinition = {
        text: '+50 to maximum Life',
        effects: [
          {
            name: 'Life',
            type: 'BASE',
            value: 50,
          },
        ],
      };

      expect(def.effects).toHaveLength(1);
      expect(def.effects?.[0]?.name).toBe('Life');
    });
  });

  describe('ModCache structure', () => {
    it('should accept valid cache structure', () => {
      const cache: ModCache = {
        version: '1.0.0',
        source: 'PathOfBuilding-PoE2',
        generatedAt: '2025-12-25T00:00:00.000Z',
        count: 2,
        mods: {
          mod_1: {
            text: '+50 to Life',
            effects: [{ name: 'Life', type: 'BASE', value: 50 }],
          },
          mod_2: {
            text: '10% increased Damage',
            effects: null,
          },
        },
      };

      expect(cache.version).toBe('1.0.0');
      expect(cache.count).toBe(2);
      expect(Object.keys(cache.mods)).toHaveLength(2);
    });
  });
});
