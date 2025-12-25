/**
 * Unit tests for ModParser.
 *
 * Tests the text-to-modifier parsing functionality with
 * data-driven approach and support level tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModParser } from 'src/engine/modifiers/ModParser';
import type { ModParserData, ModParseContext } from 'src/engine/modifiers/types';
import { ModFlag, KeywordFlag } from 'src/types/mods';

// ============================================================================
// Test Data
// ============================================================================

/**
 * Minimal test data for ModParser.
 */
function createTestData(): ModParserData {
  return {
    patterns: [
      {
        id: 'increased_percent',
        regex: '^(\\d+(?:\\.\\d+)?)% increased (.+)$',
        type: 'INC',
        valueGroup: 1,
        statGroup: 2,
        valueScale: 0.01,
      },
      {
        id: 'reduced_percent',
        regex: '^(\\d+(?:\\.\\d+)?)% reduced (.+)$',
        type: 'INC',
        valueGroup: 1,
        statGroup: 2,
        valueScale: -0.01,
      },
      {
        id: 'more_percent',
        regex: '^(\\d+(?:\\.\\d+)?)% more (.+)$',
        type: 'MORE',
        valueGroup: 1,
        statGroup: 2,
        valueScale: 0.01,
      },
      {
        id: 'less_percent',
        regex: '^(\\d+(?:\\.\\d+)?)% less (.+)$',
        type: 'MORE',
        valueGroup: 1,
        statGroup: 2,
        valueScale: -0.01,
      },
      {
        id: 'plus_to_stat',
        regex: '^\\+(\\d+) to (.+)$',
        type: 'BASE',
        valueGroup: 1,
        statGroup: 2,
      },
      {
        id: 'adds_damage_range',
        regex: '^[Aa]dds (\\d+) to (\\d+) (\\w+) [Dd]amage$',
        type: 'BASE',
        valueGroups: [1, 2],
        statGroup: 3,
        outputStats: ['${stat}DamageMin', '${stat}DamageMax'],
      },
      {
        id: 'adds_damage_range_to_attacks',
        regex: '^[Aa]dds (\\d+) to (\\d+) (\\w+) [Dd]amage to [Aa]ttacks$',
        type: 'BASE',
        valueGroups: [1, 2],
        statGroup: 3,
        outputStats: ['${stat}DamageMin', '${stat}DamageMax'],
        flagNames: ['Attack'],
      },
      {
        id: 'adds_damage_range_to_spells',
        regex: '^[Aa]dds (\\d+) to (\\d+) (\\w+) [Dd]amage to [Ss]pells$',
        type: 'BASE',
        valueGroups: [1, 2],
        statGroup: 3,
        outputStats: ['${stat}DamageMin', '${stat}DamageMax'],
        flagNames: ['Spell'],
      },
      {
        id: 'plus_percent_to_stat',
        regex: '^\\+(\\d+(?:\\.\\d+)?)% to (.+)$',
        type: 'BASE',
        valueGroup: 1,
        statGroup: 2,
        valueScale: 0.01,
      },
    ],
    statMappings: {
      'maximum life': 'Life',
      life: 'Life',
      'maximum mana': 'Mana',
      mana: 'Mana',
      'fire damage': 'FireDamage',
      'cold damage': 'ColdDamage',
      'lightning damage': 'LightningDamage',
      'physical damage': 'PhysicalDamage',
      'spell damage': 'SpellDamage',
      'attack speed': 'Speed',
      'cast speed': 'Speed',
      'melee attack speed': 'MeleeSpeed',
      'fire resistance': 'FireResist',
      'cold resistance': 'ColdResist',
      'lightning resistance': 'LightningResist',
      'all elemental resistances': 'ElementalResist',
      strength: 'Str',
      dexterity: 'Dex',
      intelligence: 'Int',
      'critical strike chance': 'CritChance',
      'critical strike multiplier': 'CritMultiplier',
      damage: 'Damage',
    },
    flagMappings: {
      attack: 'Attack',
      attacks: 'Attack',
      spell: 'Spell',
      spells: 'Spell',
      melee: 'Melee',
      projectile: 'Projectile',
      'with axes': ['Axe', 'Hit'],
      'with swords': ['Sword', 'Hit'],
    },
    keywordMappings: {
      fire: 'Fire',
      cold: 'Cold',
      lightning: 'Lightning',
      physical: 'Physical',
      chaos: 'Chaos',
    },
    conditionMappings: {
      'while leeching': {
        type: 'Condition',
        var: 'Leeching',
      },
      "if you've killed recently": {
        type: 'Condition',
        var: 'KilledRecently',
      },
      'on low life': {
        type: 'Condition',
        var: 'LowLife',
      },
      'per power charge': {
        type: 'Multiplier',
        var: 'PowerCharge',
      },
      'per 10 strength': {
        type: 'PerStat',
        stat: 'Str',
        div: 10,
      },
    },
    modCache: {
      cached_life_mod: {
        text: '+50 to Maximum Life',
        effects: [
          {
            name: 'Life',
            type: 'BASE',
            value: 50,
          },
        ],
      },
      cached_display_only: {
        text: 'Has no effects',
        effects: null,
      },
      cached_with_flags: {
        text: '10% increased Attack Speed',
        effects: [
          {
            name: 'Speed',
            type: 'INC',
            value: 0.1,
            flags: Number(ModFlag.Attack),
          },
        ],
      },
      cached_with_condition: {
        text: '20% increased Damage while Leeching',
        effects: [
          {
            name: 'Damage',
            type: 'INC',
            value: 0.2,
            condition: {
              type: 'Condition',
              var: 'Leeching',
            },
          },
        ],
      },
      cached_range_mod: {
        text: '(15-25)% increased Fire Damage',
        effects: [
          {
            name: 'FireDamage',
            type: 'INC',
            value: 20, // Average of range
          },
        ],
      },
    },
  };
}

/**
 * Default test context.
 */
function createTestContext(): ModParseContext {
  return {
    source: 'item',
    sourceId: 'test-item-1',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ModParser', () => {
  let parser: ModParser;
  let context: ModParseContext;

  beforeEach(() => {
    parser = new ModParser(createTestData());
    context = createTestContext();
  });

  // ==========================================================================
  // Constructor and Stats
  // ==========================================================================

  describe('constructor', () => {
    it('should initialize with provided data', () => {
      const stats = parser.getStats();
      expect(stats.patterns).toBeGreaterThan(0);
      expect(stats.statMappings).toBeGreaterThan(0);
      expect(stats.modCache).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return accurate counts', () => {
      const data = createTestData();
      const stats = parser.getStats();

      expect(stats.patterns).toBe(data.patterns.length);
      expect(stats.statMappings).toBe(Object.keys(data.statMappings).length);
      expect(stats.modCache).toBe(Object.keys(data.modCache).length);
    });
  });

  // ==========================================================================
  // Cache Lookup
  // ==========================================================================

  describe('cache lookup', () => {
    it('should find exact match in cache', () => {
      const result = parser.parse('+50 to Maximum Life', context);

      expect(result.success).toBe(true);
      expect(result.supportLevel).toBe('full');
      expect(result.mods).toHaveLength(1);
      expect(result.mods[0]!.name).toBe('Life');
      expect(result.mods[0]!.type).toBe('BASE');
      expect(result.mods[0]!.value).toBe(50);
    });

    it('should find match with different casing', () => {
      const result = parser.parse('+50 TO MAXIMUM LIFE', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('Life');
    });

    it('should return display_only for mods without effects', () => {
      const result = parser.parse('Has no effects', context);

      expect(result.success).toBe(true);
      expect(result.supportLevel).toBe('display_only');
      expect(result.mods).toHaveLength(0);
    });

    it('should preserve flags from cached effects', () => {
      const result = parser.parse('10% increased Attack Speed', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.flags).toBe(ModFlag.Attack);
    });

    it('should preserve conditions from cached effects', () => {
      const result = parser.parse('20% increased Damage while Leeching', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.condition).toEqual({
        type: 'Condition',
        var: 'Leeching',
      });
    });

    it('should match range-based mods', () => {
      // Should match "(15-25)% increased Fire Damage" pattern
      const result = parser.parse('20% increased Fire Damage', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('FireDamage');
    });
  });

  // ==========================================================================
  // Pattern Matching - Increased/Reduced
  // ==========================================================================

  describe('pattern matching - increased/reduced', () => {
    it('should parse increased percentage modifiers', () => {
      const result = parser.parse('15% increased maximum life', context);

      expect(result.success).toBe(true);
      expect(result.mods).toHaveLength(1);
      expect(result.mods[0]!.name).toBe('Life');
      expect(result.mods[0]!.type).toBe('INC');
      expect(result.mods[0]!.value).toBeCloseTo(0.15);
    });

    it('should parse reduced percentage modifiers', () => {
      const result = parser.parse('10% reduced mana', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.type).toBe('INC');
      expect(result.mods[0]!.value).toBeCloseTo(-0.1);
    });

    it('should parse decimal percentages', () => {
      const result = parser.parse('1.5% increased attack speed', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.value).toBeCloseTo(0.015);
    });
  });

  // ==========================================================================
  // Pattern Matching - More/Less
  // ==========================================================================

  describe('pattern matching - more/less', () => {
    it('should parse more percentage modifiers', () => {
      const result = parser.parse('40% more physical damage', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.type).toBe('MORE');
      expect(result.mods[0]!.value).toBeCloseTo(0.4);
    });

    it('should parse less percentage modifiers', () => {
      const result = parser.parse('20% less attack speed', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.type).toBe('MORE');
      expect(result.mods[0]!.value).toBeCloseTo(-0.2);
    });
  });

  // ==========================================================================
  // Pattern Matching - Flat Values
  // ==========================================================================

  describe('pattern matching - flat values', () => {
    it('should parse +X to stat modifiers', () => {
      const result = parser.parse('+30 to strength', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('Str');
      expect(result.mods[0]!.type).toBe('BASE');
      expect(result.mods[0]!.value).toBe(30);
    });

    it('should parse +X% to stat modifiers', () => {
      const result = parser.parse('+35% to fire resistance', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('FireResist');
      expect(result.mods[0]!.type).toBe('BASE');
      expect(result.mods[0]!.value).toBeCloseTo(0.35);
    });

    it('should parse damage range modifiers', () => {
      const result = parser.parse('Adds 10 to 20 Physical Damage', context);

      expect(result.success).toBe(true);
      // Range patterns produce separate min/max mods
      expect(result.mods).toHaveLength(2);
      expect(result.mods[0]!.name).toBe('PhysicalDamageMin');
      expect(result.mods[0]!.type).toBe('BASE');
      expect(result.mods[0]!.value).toBe(10);
      expect(result.mods[1]!.name).toBe('PhysicalDamageMax');
      expect(result.mods[1]!.type).toBe('BASE');
      expect(result.mods[1]!.value).toBe(20);
    });
  });

  // ==========================================================================
  // Flag Extraction
  // ==========================================================================

  describe('flag extraction', () => {
    it('should extract attack flag from text', () => {
      const result = parser.parse('15% increased attack speed', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.flags & ModFlag.Attack).toBeTruthy();
    });

    it('should extract spell flag from text', () => {
      const result = parser.parse('20% increased spell damage', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.flags & ModFlag.Spell).toBeTruthy();
    });

    it('should extract multiple flags', () => {
      const result = parser.parse('10% increased melee attack speed', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.flags & ModFlag.Melee).toBeTruthy();
      expect(result.mods[0]!.flags & ModFlag.Attack).toBeTruthy();
    });

    it('should extract keyword flags', () => {
      const result = parser.parse('15% increased fire damage', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.keywordFlags & KeywordFlag.Fire).toBeTruthy();
    });

    it('should apply pattern-level flagNames', () => {
      const result = parser.parse('Adds 10 to 20 Fire Damage to Attacks', context);

      expect(result.success).toBe(true);
      expect(result.mods).toHaveLength(2);
      // Pattern flagNames: ['Attack'] should set the Attack flag
      expect(result.mods[0]!.flags & ModFlag.Attack).toBeTruthy();
      expect(result.mods[1]!.flags & ModFlag.Attack).toBeTruthy();
    });

    it('should apply pattern-level flagNames for spells', () => {
      const result = parser.parse('Adds 5 to 15 Cold Damage to Spells', context);

      expect(result.success).toBe(true);
      expect(result.mods).toHaveLength(2);
      // Pattern flagNames: ['Spell'] should set the Spell flag
      expect(result.mods[0]!.flags & ModFlag.Spell).toBeTruthy();
      expect(result.mods[1]!.flags & ModFlag.Spell).toBeTruthy();
    });
  });

  // ==========================================================================
  // Condition Extraction
  // ==========================================================================

  describe('condition extraction', () => {
    it('should extract condition from text', () => {
      const result = parser.parse('20% increased damage while leeching', context);

      expect(result.success).toBe(true);
      expect(result.mods).toHaveLength(1);
      expect(result.mods[0]!.condition).toEqual({
        type: 'Condition',
        var: 'Leeching',
      });
    });

    it('should extract PerStat condition', () => {
      const result = parser.parse('1% increased damage per 10 strength', context);

      expect(result.success).toBe(true);
      expect(result.mods).toHaveLength(1);
      expect(result.mods[0]!.condition).toEqual({
        type: 'PerStat',
        stat: 'Str',
        div: 10,
      });
    });

    it('should extract Multiplier condition', () => {
      const result = parser.parse('5% increased damage per power charge', context);

      expect(result.success).toBe(true);
      expect(result.mods).toHaveLength(1);
      expect(result.mods[0]!.condition).toEqual({
        type: 'Multiplier',
        var: 'PowerCharge',
      });
    });
  });

  // ==========================================================================
  // Context Preservation
  // ==========================================================================

  describe('context preservation', () => {
    it('should set source from context', () => {
      const customContext: ModParseContext = {
        source: 'passive',
        sourceId: 'node-123',
      };

      const result = parser.parse('+50 to Maximum Life', customContext);

      expect(result.mods[0]!.source).toBe('passive');
      expect(result.mods[0]!.sourceId).toBe('node-123');
    });

    it('should handle different source types', () => {
      const sources: ModParseContext['source'][] = [
        'item',
        'passive',
        'gem',
        'jewel',
        'flask',
      ];

      for (const source of sources) {
        const ctx: ModParseContext = { source, sourceId: 'test' };
        const result = parser.parse('+50 to Maximum Life', ctx);
        expect(result.mods[0]!.source).toBe(source);
      }
    });
  });

  // ==========================================================================
  // Unsupported Mods
  // ==========================================================================

  describe('unsupported mods', () => {
    it('should return unsupported for unknown patterns', () => {
      const result = parser.parse('This is a completely unknown mod', context);

      expect(result.success).toBe(false);
      expect(result.supportLevel).toBe('unsupported');
      expect(result.mods).toHaveLength(0);
      expect(result.reason).toBeDefined();
    });

    it('should return unsupported for empty text', () => {
      const result = parser.parse('', context);

      expect(result.success).toBe(false);
      expect(result.supportLevel).toBe('unsupported');
      expect(result.reason).toBe('Empty text');
    });

    it('should return unsupported for whitespace-only text', () => {
      const result = parser.parse('   ', context);

      expect(result.success).toBe(false);
      expect(result.supportLevel).toBe('unsupported');
    });

    it('should preserve original text in result', () => {
      const originalText = 'Unknown modifier with weird formatting!!!';
      const result = parser.parse(originalText, context);

      expect(result.originalText).toBe(originalText);
    });
  });

  // ==========================================================================
  // parseLines
  // ==========================================================================

  describe('parseLines', () => {
    it('should parse multiple lines', () => {
      const text = `+50 to Maximum Life
15% increased attack speed
+30 to strength`;

      const results = parser.parseLines(text, context);

      expect(results).toHaveLength(3);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
      expect(results[2]!.success).toBe(true);
    });

    it('should handle empty lines', () => {
      const text = `+50 to Maximum Life

+30 to strength`;

      const results = parser.parseLines(text, context);

      expect(results).toHaveLength(2);
    });

    it('should preserve line order', () => {
      const text = `+10 to strength
+20 to dexterity
+30 to intelligence`;

      const results = parser.parseLines(text, context);

      expect(results[0]!.mods[0]!.value).toBe(10);
      expect(results[1]!.mods[0]!.value).toBe(20);
      expect(results[2]!.mods[0]!.value).toBe(30);
    });

    it('should handle mixed success/failure', () => {
      const text = `+50 to Maximum Life
Unknown mod here
+30 to strength`;

      const results = parser.parseLines(text, context);

      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(false);
      expect(results[2]!.success).toBe(true);
    });
  });

  // ==========================================================================
  // Text Normalization
  // ==========================================================================

  describe('text normalization', () => {
    it('should be case-insensitive', () => {
      const result1 = parser.parse('+50 to Maximum Life', context);
      const result2 = parser.parse('+50 TO MAXIMUM LIFE', context);
      const result3 = parser.parse('+50 To mAxImUm LiFe', context);

      expect(result1.mods[0]!.name).toBe(result2.mods[0]!.name);
      expect(result2.mods[0]!.name).toBe(result3.mods[0]!.name);
    });

    it('should trim whitespace', () => {
      const result = parser.parse('  +50 to Maximum Life  ', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('Life');
    });

    it('should normalize multiple spaces', () => {
      const result = parser.parse('+50  to   Maximum    Life', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('Life');
    });

    it('should handle trailing periods', () => {
      const result = parser.parse('+50 to Maximum Life.', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('Life');
    });
  });

  // ==========================================================================
  // Stat Mapping
  // ==========================================================================

  describe('stat mapping', () => {
    it('should map common stat names', () => {
      const testCases = [
        { input: '+10 to maximum life', expected: 'Life' },
        { input: '+10 to maximum mana', expected: 'Mana' },
        { input: '+10 to strength', expected: 'Str' },
        { input: '+10 to dexterity', expected: 'Dex' },
        { input: '+10 to intelligence', expected: 'Int' },
      ];

      for (const { input, expected } of testCases) {
        const result = parser.parse(input, context);
        expect(result.mods[0]!.name).toBe(expected);
      }
    });

    it('should generate canonical name for unmapped stats', () => {
      const result = parser.parse('15% increased unknown stat name', context);

      expect(result.success).toBe(true);
      // Should generate PascalCase name for unknown stats
      expect(result.mods[0]!.name).toMatch(/^[A-Z]/);
    });
  });

  // ==========================================================================
  // Support Level Accuracy
  // ==========================================================================

  describe('support level accuracy', () => {
    it('should return full for complete parse', () => {
      const result = parser.parse('+50 to Maximum Life', context);
      expect(result.supportLevel).toBe('full');
    });

    it('should return display_only for no-effect mods', () => {
      const result = parser.parse('Has no effects', context);
      expect(result.supportLevel).toBe('display_only');
    });

    it('should return unsupported for unknown mods', () => {
      const result = parser.parse('Completely unknown modifier', context);
      expect(result.supportLevel).toBe('unsupported');
    });

    it('should return partial when warnings exist', () => {
      // Parse a mod that matches pattern but has unknown stat
      const result = parser.parse('15% increased unknown stat', context);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      expect(result.supportLevel).toBe('partial');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      const result = parser.parse('+999999 to maximum life', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.value).toBe(999999);
    });

    it('should handle zero values', () => {
      const result = parser.parse('+0 to maximum life', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.value).toBe(0);
    });

    it('should handle special characters in stat names', () => {
      // This tests robustness with unusual input
      const result = parser.parse('+10 to all elemental resistances', context);

      expect(result.success).toBe(true);
      expect(result.mods[0]!.name).toBe('ElementalResist');
    });

    it('should handle unicode characters gracefully', () => {
      // Tests that unicode (em dash) doesn't crash the parser
      // The parser may or may not successfully parse due to unicode in the pattern
      const result = parser.parse('+50 to Maximum Life \u2014 enchanted', context);

      // Parser should not throw; result can be success or unsupported
      expect(result).toBeDefined();
      expect(['full', 'partial', 'unsupported']).toContain(result.supportLevel);
    });
  });
});
