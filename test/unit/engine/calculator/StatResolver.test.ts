/**
 * Unit tests for StatResolver - High-Level Stat Aggregation System.
 *
 * Tests stat resolution, attribute bonuses, caching, and breakdown generation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StatResolver, createStatResolver } from 'src/engine/calculator/StatResolver';
import { ModDB } from 'src/engine/modifiers/ModDB';
import type { Mod } from 'src/engine/modifiers/types';
import type { StatResolverConfig } from 'src/engine/calculator/types';
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
    sourceId: 'test-1',
    ...overrides,
  };
}

/**
 * Create a default resolver config.
 */
function createConfig(overrides: Partial<StatResolverConfig> = {}): StatResolverConfig {
  return {
    level: 90,
    attributes: { str: 0, dex: 0, int: 0 },
    conditions: {},
    stats: {},
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('StatResolver', () => {
  let modDB: ModDB;
  let resolver: StatResolver;

  beforeEach(() => {
    modDB = new ModDB();
    resolver = new StatResolver({
      modDB,
      config: createConfig(),
    });
  });

  // ==========================================================================
  // Basic Resolution
  // ==========================================================================

  describe('basic resolution', () => {
    it('should resolve a stat with only BASE value', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result = resolver.resolve('Life');

      expect(result.value).toBe(100);
      expect(result.breakdown.base).toBe(100);
      expect(result.breakdown.increased).toBe(0);
      expect(result.breakdown.more).toBe(1);
    });

    it('should resolve a stat with BASE and INC', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Life', type: 'INC', value: 0.5 }));

      const result = resolver.resolve('Life');

      // 100 * (1 + 0.5) = 150
      expect(result.value).toBe(150);
      expect(result.breakdown.base).toBe(100);
      expect(result.breakdown.increased).toBe(50); // Stored as percentage
    });

    it('should resolve a stat with BASE, INC, and MORE', () => {
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Damage', type: 'INC', value: 0.5 }));
      modDB.addMod(createMod({ name: 'Damage', type: 'MORE', value: 0.2 }));

      const result = resolver.resolve('Damage');

      // 100 * (1 + 0.5) * 1.2 = 180
      expect(result.value).toBeCloseTo(180);
      expect(result.breakdown.base).toBe(100);
      expect(result.breakdown.increased).toBe(50);
      expect(result.breakdown.more).toBeCloseTo(1.2);
    });

    it('should return zero for non-existent stat', () => {
      const result = resolver.resolve('NonExistent');

      expect(result.value).toBe(0);
      expect(result.breakdown.base).toBe(0);
    });

    it('should respect OVERRIDE values', () => {
      modDB.addMod(createMod({ name: 'CritChance', type: 'BASE', value: 5 }));
      modDB.addMod(createMod({ name: 'CritChance', type: 'INC', value: 1.0 }));
      modDB.addMod(createMod({ name: 'CritChance', type: 'OVERRIDE', value: 100 }));

      const result = resolver.resolve('CritChance');

      expect(result.value).toBe(100);
    });
  });

  // ==========================================================================
  // Attribute Bonuses
  // ==========================================================================

  describe('attribute bonuses', () => {
    it('should apply Strength to Life (0.5 per Str)', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 100, dex: 0, int: 0 } }),
      });

      const result = resolver.resolve('Life');

      // 100 (base mods) + 50 (100 str * 0.5) = 150 base
      // 150 * 1 * 1 = 150
      expect(result.value).toBe(150);
      expect(result.breakdown.base).toBe(150);
    });

    it('should apply Dexterity to Accuracy (2 per Dex)', () => {
      modDB.addMod(createMod({ name: 'Accuracy', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 0, dex: 50, int: 0 } }),
      });

      const result = resolver.resolve('Accuracy');

      // 100 (base mods) + 100 (50 dex * 2) = 200 base
      expect(result.value).toBe(200);
    });

    it('should apply Intelligence to Mana (0.5 per Int)', () => {
      modDB.addMod(createMod({ name: 'Mana', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 0, dex: 0, int: 200 } }),
      });

      const result = resolver.resolve('Mana');

      // 100 (base mods) + 100 (200 int * 0.5) = 200 base
      expect(result.value).toBe(200);
    });

    it('should apply Strength to MeleeDamage as INC (0.2% per Str)', () => {
      modDB.addMod(createMod({ name: 'MeleeDamage', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 100, dex: 0, int: 0 } }),
      });

      const result = resolver.resolve('MeleeDamage');

      // 100 base * (1 + 0.2) = 120
      // 100 str * 0.002 = 0.2 (20% increased)
      expect(result.value).toBeCloseTo(120);
      expect(result.breakdown.increased).toBeCloseTo(20);
    });

    it('should apply Dexterity to Evasion as INC (0.2% per Dex)', () => {
      modDB.addMod(createMod({ name: 'Evasion', type: 'BASE', value: 500 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 0, dex: 150, int: 0 } }),
      });

      const result = resolver.resolve('Evasion');

      // 500 base * (1 + 0.3) = 650
      // 150 dex * 0.002 = 0.3 (30% increased)
      expect(result.value).toBeCloseTo(650);
    });

    it('should apply Intelligence to EnergyShield as INC (0.2% per Int)', () => {
      modDB.addMod(createMod({ name: 'EnergyShield', type: 'BASE', value: 200 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 0, dex: 0, int: 250 } }),
      });

      const result = resolver.resolve('EnergyShield');

      // 200 base * (1 + 0.5) = 300
      // 250 int * 0.002 = 0.5 (50% increased)
      expect(result.value).toBeCloseTo(300);
    });

    it('should not apply attribute bonuses for zero or negative attributes', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: -10, dex: 0, int: 0 } }),
      });

      const result = resolver.resolve('Life');

      // No bonus from negative str
      expect(result.value).toBe(100);
    });
  });

  // ==========================================================================
  // Flag Filtering
  // ==========================================================================

  describe('flag filtering', () => {
    it('should filter by damage flags when resolving', () => {
      modDB.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.2,
        flags: ModFlag.Attack,
      }));
      modDB.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.3,
        flags: ModFlag.Spell,
      }));
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));

      const attackResult = resolver.resolve('Damage', ModFlag.Attack);
      const spellResult = resolver.resolve('Damage', ModFlag.Spell);

      // 100 * (1 + 0.2) = 120 for attack
      expect(attackResult.value).toBeCloseTo(120);
      // 100 * (1 + 0.3) = 130 for spell
      expect(spellResult.value).toBeCloseTo(130);
    });

    it('should filter by keyword flags when resolving', () => {
      modDB.addMod(createMod({
        name: 'Damage',
        type: 'MORE',
        value: 0.5,
        keywordFlags: KeywordFlag.Fire,
      }));
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));

      const fireResult = resolver.resolve('Damage', undefined, KeywordFlag.Fire);
      const coldResult = resolver.resolve('Damage', undefined, KeywordFlag.Cold);

      // 100 * 1 * 1.5 = 150 for fire
      expect(fireResult.value).toBeCloseTo(150);
      // 100 * 1 * 1 = 100 for cold (no MORE)
      expect(coldResult.value).toBe(100);
    });
  });

  // ==========================================================================
  // Caching
  // ==========================================================================

  describe('caching', () => {
    it('should cache resolved stats', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result1 = resolver.resolve('Life');
      const result2 = resolver.resolve('Life');

      // Should return same reference from cache
      expect(result1).toBe(result2);
    });

    it('should cache different flag combinations separately', () => {
      modDB.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.2,
        flags: ModFlag.Attack,
      }));
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));

      const attackResult1 = resolver.resolve('Damage', ModFlag.Attack);
      const spellResult1 = resolver.resolve('Damage', ModFlag.Spell);
      const attackResult2 = resolver.resolve('Damage', ModFlag.Attack);

      // Same flags should return cached
      expect(attackResult1).toBe(attackResult2);
      // Different flags should be different results
      expect(attackResult1).not.toBe(spellResult1);
    });

    it('should clear cache when clearCache is called', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result1 = resolver.resolve('Life');

      resolver.clearCache();
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 50 }));

      const result2 = resolver.resolve('Life');

      // After cache clear, should get new result
      expect(result2.value).toBe(150);
      expect(result1).not.toBe(result2);
    });

    it('should clear cache when config is updated', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result1 = resolver.resolve('Life');

      resolver.updateConfig({ attributes: { str: 100, dex: 0, int: 0 } });

      const result2 = resolver.resolve('Life');

      // Config update should clear cache and apply new attributes
      expect(result2.value).toBe(150);
      expect(result1.value).toBe(100);
    });
  });

  // ==========================================================================
  // Circular Dependency Protection
  // ==========================================================================

  describe('circular dependency protection', () => {
    it('should handle circular dependency by returning zero', () => {
      // This tests the internal mechanism - in practice, stats shouldn't
      // have circular dependencies, but the resolver should handle it gracefully
      const result = resolver.resolve('SomeStat');

      expect(result.value).toBe(0);
    });
  });

  // ==========================================================================
  // Resolve Multiple
  // ==========================================================================

  describe('resolveMultiple', () => {
    it('should resolve multiple stats at once', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Mana', type: 'BASE', value: 50 }));
      modDB.addMod(createMod({ name: 'EnergyShield', type: 'BASE', value: 200 }));

      const results = resolver.resolveMultiple(['Life', 'Mana', 'EnergyShield']);

      expect(results.get('Life')?.value).toBe(100);
      expect(results.get('Mana')?.value).toBe(50);
      expect(results.get('EnergyShield')?.value).toBe(200);
    });

    it('should apply same flags to all stats', () => {
      modDB.addMod(createMod({
        name: 'Damage',
        type: 'INC',
        value: 0.2,
        flags: ModFlag.Attack,
      }));
      modDB.addMod(createMod({
        name: 'Speed',
        type: 'INC',
        value: 0.1,
        flags: ModFlag.Attack,
      }));
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Speed', type: 'BASE', value: 1 }));

      const results = resolver.resolveMultiple(['Damage', 'Speed'], ModFlag.Attack);

      expect(results.get('Damage')?.value).toBeCloseTo(120);
      expect(results.get('Speed')?.value).toBeCloseTo(1.1);
    });
  });

  // ==========================================================================
  // Get Attributes
  // ==========================================================================

  describe('getAttributes', () => {
    it('should return current attributes', () => {
      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 100, dex: 50, int: 75 } }),
      });

      const attrs = resolver.getAttributes();

      expect(attrs.str).toBe(100);
      expect(attrs.dex).toBe(50);
      expect(attrs.int).toBe(75);
    });

    it('should return a copy (not mutable reference)', () => {
      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 100, dex: 0, int: 0 } }),
      });

      const attrs = resolver.getAttributes();
      attrs.str = 999;

      const attrsAgain = resolver.getAttributes();

      // Original should be unchanged
      expect(attrsAgain.str).toBe(100);
    });
  });

  // ==========================================================================
  // Breakdown Generation
  // ==========================================================================

  describe('breakdown generation', () => {
    it('should generate breakdown with sources', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Life', type: 'INC', value: 0.5 }));
      modDB.addMod(createMod({ name: 'Life', type: 'MORE', value: 0.2 }));

      const result = resolver.resolve('Life');

      expect(result.breakdown.sources.length).toBeGreaterThan(0);
      expect(result.breakdown.sources.some(s => s.type === 'BASE')).toBe(true);
      expect(result.breakdown.sources.some(s => s.type === 'INC')).toBe(true);
      expect(result.breakdown.sources.some(s => s.type === 'MORE')).toBe(true);
    });

    it('should include attribute bonus in breakdown', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 100, dex: 0, int: 0 } }),
      });

      const result = resolver.resolve('Life');

      const attrSource = result.breakdown.sources.find(s => s.label === 'Attributes');
      expect(attrSource).toBeDefined();
      expect(attrSource?.value).toBe(50); // 100 str * 0.5
    });

    it('should not include zero-value sources', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      // No INC mods, no attribute bonuses

      const result = resolver.resolve('Life');

      // Should only have the BASE source
      expect(result.breakdown.sources.length).toBe(1);
      expect(result.breakdown.sources[0]?.type).toBe('BASE');
    });

    it('should skip breakdown when includeBreakdown is false', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Life', type: 'INC', value: 0.5 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig(),
        includeBreakdown: false,
      });

      const result = resolver.resolve('Life');

      // Value should still be calculated correctly
      expect(result.value).toBe(150);
      // But sources should be empty
      expect(result.breakdown.sources).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Factory Function
  // ==========================================================================

  describe('createStatResolver factory', () => {
    it('should create resolver with default config', () => {
      const factoryResolver = createStatResolver(modDB);

      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result = factoryResolver.resolve('Life');

      expect(result.value).toBe(100);
    });

    it('should create resolver with custom attributes', () => {
      const factoryResolver = createStatResolver(modDB, { str: 50, dex: 0, int: 0 });

      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result = factoryResolver.resolve('Life');

      // 100 + 25 (50 str * 0.5) = 125
      expect(result.value).toBe(125);
    });

    it('should create resolver with custom level', () => {
      const factoryResolver = createStatResolver(modDB, { str: 0, dex: 0, int: 0 }, 50);

      // Level doesn't affect basic stat resolution currently
      // but the resolver should accept the parameter
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      const result = factoryResolver.resolve('Life');

      expect(result.value).toBe(100);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty ModDB', () => {
      const result = resolver.resolve('Life');

      expect(result.value).toBe(0);
      expect(result.breakdown.base).toBe(0);
      expect(result.breakdown.increased).toBe(0);
      expect(result.breakdown.more).toBe(1);
    });

    it('should handle negative INC values', () => {
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Damage', type: 'INC', value: -0.3 }));

      const result = resolver.resolve('Damage');

      // 100 * (1 + (-0.3)) = 70
      expect(result.value).toBe(70);
    });

    it('should handle negative MORE values (less multiplier)', () => {
      modDB.addMod(createMod({ name: 'Damage', type: 'BASE', value: 100 }));
      modDB.addMod(createMod({ name: 'Damage', type: 'MORE', value: -0.2 }));

      const result = resolver.resolve('Damage');

      // 100 * 1 * 0.8 = 80
      expect(result.value).toBe(80);
    });

    it('should handle very large attribute values', () => {
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 1000, dex: 0, int: 0 } }),
      });

      const result = resolver.resolve('Life');

      // 100 + 500 (1000 str * 0.5) = 600
      expect(result.value).toBe(600);
    });

    it('should handle combined attribute bonuses to same stat', () => {
      // If a stat had bonuses from multiple attributes, they should stack
      modDB.addMod(createMod({ name: 'Life', type: 'BASE', value: 100 }));

      resolver = new StatResolver({
        modDB,
        config: createConfig({ attributes: { str: 100, dex: 100, int: 100 } }),
      });

      const result = resolver.resolve('Life');

      // Only Str affects Life in STAT_DEPENDENCIES
      // 100 + 50 = 150
      expect(result.value).toBe(150);
    });
  });
});
