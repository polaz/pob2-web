/**
 * Unit tests for mod type definitions.
 *
 * Tests type structures and flag constants.
 */
import { describe, it, expect } from 'vitest';
import {
  ModFlag,
  KeywordFlag,
  type ModType,
  type ModEffect,
  type ModEffectListValue,
  type ModCondition,
  type ModTag,
  type ModDefinition,
  type ModSource,
  type Modifier,
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

    it('should accept effect with number flags', () => {
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

    it('should accept effect with bigint flags for precision', () => {
      const effect: ModEffect = {
        name: 'PhysicalDamage',
        type: 'INC',
        value: 20,
        flags: ModFlag.Attack | ModFlag.Melee,
        keywordFlags: KeywordFlag.Physical,
      };

      expect(effect.flags).toBe(ModFlag.Attack | ModFlag.Melee);
      expect(effect.keywordFlags).toBe(KeywordFlag.Physical);
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

    it('should accept effect with tag', () => {
      const effect: ModEffect = {
        name: 'GemLevel',
        type: 'BASE',
        value: 2,
        tag: {
          type: 'SocketedIn',
          slotName: 'Helmet',
          keyword: 'Fire',
        },
      };

      expect(effect.tag?.type).toBe('SocketedIn');
      expect(effect.tag?.slotName).toBe('Helmet');
    });
  });

  describe('ModEffectListValue structure', () => {
    it('should accept LIST value with common fields', () => {
      const listValue: ModEffectListValue = {
        key: 'SomeKey',
        keyword: 'Fire',
        value: 100,
        keyOfScaledMod: 'FireDamage',
      };

      expect(listValue.key).toBe('SomeKey');
      expect(listValue.keyword).toBe('Fire');
      expect(listValue.value).toBe(100);
    });

    it('should accept LIST value with arbitrary PoB fields', () => {
      const listValue: ModEffectListValue = {
        key: 'CustomEffect',
        customPoBField: 'some-value',
        anotherField: { nested: true },
        numericField: 42,
      };

      expect(listValue.key).toBe('CustomEffect');
      expect(listValue.customPoBField).toBe('some-value');
      expect(listValue.anotherField).toEqual({ nested: true });
    });

    it('should work with ModEffect LIST type', () => {
      const effect: ModEffect = {
        name: 'ExtraSkillMod',
        type: 'LIST',
        value: {
          key: 'GrantedSkill',
          skillId: 'Fireball',
          level: 20,
        } as ModEffectListValue,
      };

      expect(effect.type).toBe('LIST');
      expect((effect.value as ModEffectListValue).key).toBe('GrantedSkill');
    });
  });

  describe('ModCondition variants', () => {
    it('should accept Condition type', () => {
      const condition: ModCondition = {
        type: 'Condition',
        var: 'LowLife',
        neg: false,
      };

      expect(condition.type).toBe('Condition');
      expect(condition.var).toBe('LowLife');
    });

    it('should accept PerStat type', () => {
      const condition: ModCondition = {
        type: 'PerStat',
        stat: 'Strength',
        div: 10,
      };

      expect(condition.type).toBe('PerStat');
      expect(condition.stat).toBe('Strength');
      expect(condition.div).toBe(10);
    });

    it('should accept Multiplier type', () => {
      const condition: ModCondition = {
        type: 'Multiplier',
        var: 'FrenzyCharges',
      };

      expect(condition.type).toBe('Multiplier');
      expect(condition.var).toBe('FrenzyCharges');
    });

    it('should accept StatThreshold type', () => {
      const condition: ModCondition = {
        type: 'StatThreshold',
        stat: 'Strength',
        threshold: 200,
      };

      expect(condition.type).toBe('StatThreshold');
      expect(condition.threshold).toBe(200);
    });

    it('should accept SocketedIn type', () => {
      const condition: ModCondition = {
        type: 'SocketedIn',
        var: 'Body Armour',
      };

      expect(condition.type).toBe('SocketedIn');
      expect(condition.var).toBe('Body Armour');
    });
  });

  describe('ModTag structure', () => {
    it('should accept basic tag', () => {
      const tag: ModTag = {
        type: 'Slot',
        slotName: 'Weapon 1',
      };

      expect(tag.type).toBe('Slot');
      expect(tag.slotName).toBe('Weapon 1');
    });

    it('should accept tag with keyword', () => {
      const tag: ModTag = {
        type: 'SkillType',
        keyword: 'Attack',
      };

      expect(tag.type).toBe('SkillType');
      expect(tag.keyword).toBe('Attack');
    });

    it('should accept tag with arbitrary PoB fields', () => {
      const tag: ModTag = {
        type: 'GlobalEffect',
        effectType: 'Buff',
        affectsSelf: true,
        stackLimit: 5,
      };

      expect(tag.type).toBe('GlobalEffect');
      expect(tag.effectType).toBe('Buff');
      expect(tag.affectsSelf).toBe(true);
    });
  });

  describe('ModDefinition structure', () => {
    it('should accept definition without effects', () => {
      const def: ModDefinition = {
        text: '(10-15)% increased Energy Shield',
        effects: null,
        // Note: trailing space matches actual PoB data quirks - this is intentional.
        // External data should NOT be "fixed" in tests. See DATA OVERLAY ARCHITECTURE in CLAUDE.md.
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

  describe('ModSource type', () => {
    it('should accept all valid mod sources', () => {
      const sources: ModSource[] = [
        'item',
        'passive',
        'gem',
        'jewel',
        'flask',
        'aura',
        'curse',
        'config',
        'enchant',
        'corruption',
        'crafted',
      ];

      expect(sources).toHaveLength(11);
      expect(sources).toContain('item');
      expect(sources).toContain('passive');
      expect(sources).toContain('crafted');
    });
  });

  describe('Modifier structure', () => {
    it('should accept complete modifier', () => {
      const modifier: Modifier = {
        definition: {
          text: '+50 to maximum Life',
          effects: [{ name: 'Life', type: 'BASE', value: 50 }],
        },
        source: 'item',
        sourceId: 'item_body_armour_1',
        value: 50,
        enabled: true,
      };

      expect(modifier.definition.text).toBe('+50 to maximum Life');
      expect(modifier.source).toBe('item');
      expect(modifier.enabled).toBe(true);
    });

    it('should accept modifier without resolved value', () => {
      const modifier: Modifier = {
        definition: {
          text: '(10-15)% increased Energy Shield',
          effects: null,
        },
        source: 'passive',
        sourceId: 'node_12345',
        enabled: true,
      };

      expect(modifier.value).toBeUndefined();
      expect(modifier.source).toBe('passive');
    });

    it('should accept disabled modifier', () => {
      const modifier: Modifier = {
        definition: {
          text: 'Some conditional mod',
          effects: [{ name: 'Damage', type: 'INC', value: 10 }],
        },
        source: 'config',
        sourceId: 'config_option_1',
        enabled: false,
      };

      expect(modifier.enabled).toBe(false);
    });
  });

  describe('ModCache structure', () => {
    it('should accept minimal cache structure', () => {
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

    it('should accept cache with branch and stats', () => {
      const cache: ModCache = {
        version: '1.0.0',
        source: 'PathOfBuilding-PoE2',
        branch: 'dev',
        generatedAt: '2025-12-25T00:00:00.000Z',
        count: 6135,
        stats: {
          withEffects: 5236,
          displayOnly: 1017,
          failed: 0,
        },
        mods: {},
      };

      expect(cache.branch).toBe('dev');
      expect(cache.stats?.withEffects).toBe(5236);
      expect(cache.stats?.displayOnly).toBe(1017);
      expect(cache.stats?.failed).toBe(0);
    });
  });
});
