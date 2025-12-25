/**
 * Unit tests for StatConversion - Damage Type Conversion Handler.
 *
 * Tests damage conversion chains, normalization, and "gain as extra" mechanics.
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyMatrix,
  getTotalConversion,
  normalizeConversions,
  isValidConversion,
  applyConversions,
  getInheritanceChain,
  buildConversionMatrix,
} from 'src/engine/calculator/StatConversion';
import type { DamageType, ConversionMatrix } from 'src/engine/calculator/types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a conversion matrix with specific conversions.
 */
function createMatrix(conversions: Array<{ from: DamageType; to: DamageType; value: number }>): ConversionMatrix {
  const matrix = createEmptyMatrix();
  for (const { from, to, value } of conversions) {
    matrix[from][to] = value;
  }
  return matrix;
}

/**
 * Create base damage record with defaults.
 */
function createBaseDamage(overrides: Partial<Record<DamageType, number>> = {}): Record<DamageType, number> {
  return {
    Physical: 0,
    Lightning: 0,
    Cold: 0,
    Fire: 0,
    Chaos: 0,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('StatConversion', () => {
  // ==========================================================================
  // createEmptyMatrix
  // ==========================================================================

  describe('createEmptyMatrix', () => {
    it('should create a matrix with all damage types', () => {
      const matrix = createEmptyMatrix();

      expect(matrix.Physical).toBeDefined();
      expect(matrix.Lightning).toBeDefined();
      expect(matrix.Cold).toBeDefined();
      expect(matrix.Fire).toBeDefined();
      expect(matrix.Chaos).toBeDefined();
    });

    it('should have empty objects for each damage type', () => {
      const matrix = createEmptyMatrix();

      expect(Object.keys(matrix.Physical)).toHaveLength(0);
      expect(Object.keys(matrix.Fire)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getTotalConversion
  // ==========================================================================

  describe('getTotalConversion', () => {
    it('should return 0 for no conversions', () => {
      const matrix = createEmptyMatrix();

      expect(getTotalConversion(matrix, 'Physical')).toBe(0);
    });

    it('should sum all conversions from a type', () => {
      const matrix = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.3 },
        { from: 'Physical', to: 'Cold', value: 0.2 },
      ]);

      expect(getTotalConversion(matrix, 'Physical')).toBeCloseTo(0.5);
    });

    it('should not count self-conversion', () => {
      const matrix = createEmptyMatrix();
      // This shouldn't happen in practice, but test the behavior
      matrix.Physical.Physical = 0.5;

      expect(getTotalConversion(matrix, 'Physical')).toBe(0);
    });
  });

  // ==========================================================================
  // normalizeConversions
  // ==========================================================================

  describe('normalizeConversions', () => {
    it('should not change conversions under 100%', () => {
      const matrix = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.3 },
        { from: 'Physical', to: 'Cold', value: 0.2 },
      ]);

      const normalized = normalizeConversions(matrix);

      expect(normalized.Physical.Fire).toBeCloseTo(0.3);
      expect(normalized.Physical.Cold).toBeCloseTo(0.2);
    });

    it('should scale conversions exceeding 100%', () => {
      const matrix = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.6 },
        { from: 'Physical', to: 'Cold', value: 0.6 },
      ]);
      // Total: 120%

      const normalized = normalizeConversions(matrix);

      // Both should be scaled by 100/120 = 0.833...
      expect(normalized.Physical.Fire).toBeCloseTo(0.5);
      expect(normalized.Physical.Cold).toBeCloseTo(0.5);
      expect(getTotalConversion(normalized, 'Physical')).toBeCloseTo(1.0);
    });

    it('should handle exactly 100% conversion', () => {
      const matrix = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
        { from: 'Physical', to: 'Lightning', value: 0.5 },
      ]);

      const normalized = normalizeConversions(matrix);

      expect(normalized.Physical.Fire).toBeCloseTo(0.5);
      expect(normalized.Physical.Lightning).toBeCloseTo(0.5);
    });

    it('should normalize each damage type independently', () => {
      const matrix = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.8 },
        { from: 'Physical', to: 'Cold', value: 0.4 },
        { from: 'Lightning', to: 'Fire', value: 0.3 },
      ]);

      const normalized = normalizeConversions(matrix);

      // Physical is over 100%, should be normalized
      expect(getTotalConversion(normalized, 'Physical')).toBeCloseTo(1.0);
      // Lightning is under 100%, should stay the same
      expect(normalized.Lightning.Fire).toBeCloseTo(0.3);
    });
  });

  // ==========================================================================
  // isValidConversion
  // ==========================================================================

  describe('isValidConversion', () => {
    it('should return true for valid upward conversions', () => {
      // Physical → Lightning → Cold → Fire → Chaos
      expect(isValidConversion('Physical', 'Lightning')).toBe(true);
      expect(isValidConversion('Physical', 'Cold')).toBe(true);
      expect(isValidConversion('Physical', 'Fire')).toBe(true);
      expect(isValidConversion('Physical', 'Chaos')).toBe(true);
      expect(isValidConversion('Lightning', 'Cold')).toBe(true);
      expect(isValidConversion('Lightning', 'Fire')).toBe(true);
      expect(isValidConversion('Cold', 'Fire')).toBe(true);
      expect(isValidConversion('Fire', 'Chaos')).toBe(true);
    });

    it('should return false for downward conversions', () => {
      expect(isValidConversion('Fire', 'Cold')).toBe(false);
      expect(isValidConversion('Cold', 'Lightning')).toBe(false);
      expect(isValidConversion('Chaos', 'Physical')).toBe(false);
    });

    it('should return false for same-type conversion', () => {
      expect(isValidConversion('Physical', 'Physical')).toBe(false);
      expect(isValidConversion('Fire', 'Fire')).toBe(false);
    });
  });

  // ==========================================================================
  // applyConversions
  // ==========================================================================

  describe('applyConversions', () => {
    it('should convert physical to fire', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.damage.Physical).toBe(50);
      expect(result.damage.Fire).toBe(50);
    });

    it('should handle multiple conversions from same source', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.3 },
        { from: 'Physical', to: 'Cold', value: 0.2 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.damage.Physical).toBe(50);
      expect(result.damage.Fire).toBe(30);
      expect(result.damage.Cold).toBe(20);
    });

    it('should cap conversions at 100%', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.7 },
        { from: 'Physical', to: 'Cold', value: 0.5 },
      ]);
      // Total 120%, should be normalized to 100%
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      // After normalization: ~58% fire, ~42% cold
      expect(result.damage.Physical).toBe(0);
      expect(result.damage.Fire + result.damage.Cold).toBeCloseTo(100);
    });

    it('should apply gain as extra without cap', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createEmptyMatrix();
      const gainAsExtra = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      // Physical stays at 100, plus 50 extra fire
      expect(result.damage.Physical).toBe(100);
      expect(result.damage.Fire).toBe(50);
    });

    it('should apply conversion before gain as extra', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);
      const gainAsExtra = createMatrix([
        { from: 'Physical', to: 'Cold', value: 0.3 },
      ]);

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      // 50% physical converts to fire = 50 physical left, 50 fire
      // 30% of ORIGINAL 100 physical gains as cold = 30 cold
      expect(result.damage.Physical).toBe(50);
      expect(result.damage.Fire).toBe(50);
      expect(result.damage.Cold).toBe(30);
    });

    it('should handle chained conversions', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Lightning', value: 1.0 },
        { from: 'Lightning', to: 'Cold', value: 0.5 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      // Physical fully converts to lightning
      // Then 50% of that lightning converts to cold
      expect(result.damage.Physical).toBe(0);
      expect(result.damage.Lightning).toBe(50);
      expect(result.damage.Cold).toBe(50);
    });

    it('should record conversion steps', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toEqual({
        from: 'Physical',
        to: 'Fire',
        percent: 0.5,
        amount: 50,
      });
    });

    it('should record gain as extra steps', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createEmptyMatrix();
      const gainAsExtra = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.3 },
      ]);

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toEqual({
        from: 'Physical',
        to: 'Fire',
        percent: 0.3,
        amount: 30,
      });
    });

    it('should handle no base damage', () => {
      const baseDamage = createBaseDamage();
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.damage.Physical).toBe(0);
      expect(result.damage.Fire).toBe(0);
      expect(result.steps).toHaveLength(0);
    });

    it('should handle multiple base damage types', () => {
      const baseDamage = createBaseDamage({
        Physical: 100,
        Lightning: 50,
      });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
        { from: 'Lightning', to: 'Cold', value: 0.4 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.damage.Physical).toBe(50);
      expect(result.damage.Fire).toBe(50);
      expect(result.damage.Lightning).toBe(30);
      expect(result.damage.Cold).toBe(20);
    });
  });

  // ==========================================================================
  // getInheritanceChain
  // ==========================================================================

  describe('getInheritanceChain', () => {
    it('should include the final type itself', () => {
      const conversions = createEmptyMatrix();

      const chain = getInheritanceChain('Fire', conversions);

      expect(chain.has('Fire')).toBe(true);
    });

    it('should include direct source types', () => {
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);

      const chain = getInheritanceChain('Fire', conversions);

      expect(chain.has('Fire')).toBe(true);
      expect(chain.has('Physical')).toBe(true);
    });

    it('should include indirect source types', () => {
      const conversions = createMatrix([
        { from: 'Physical', to: 'Lightning', value: 0.5 },
        { from: 'Lightning', to: 'Fire', value: 0.5 },
      ]);

      const chain = getInheritanceChain('Fire', conversions);

      expect(chain.has('Fire')).toBe(true);
      expect(chain.has('Lightning')).toBe(true);
      expect(chain.has('Physical')).toBe(true);
    });

    it('should not include types with zero conversion', () => {
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);

      const chain = getInheritanceChain('Fire', conversions);

      expect(chain.has('Lightning')).toBe(false);
      expect(chain.has('Cold')).toBe(false);
    });

    it('should handle no conversions', () => {
      const conversions = createEmptyMatrix();

      const chain = getInheritanceChain('Fire', conversions);

      expect(chain.size).toBe(1);
      expect(chain.has('Fire')).toBe(true);
    });

    it('should handle complex conversion chains', () => {
      const conversions = createMatrix([
        { from: 'Physical', to: 'Lightning', value: 0.3 },
        { from: 'Physical', to: 'Cold', value: 0.3 },
        { from: 'Lightning', to: 'Fire', value: 0.5 },
        { from: 'Cold', to: 'Fire', value: 0.5 },
      ]);

      const chain = getInheritanceChain('Fire', conversions);

      // Fire can come from: Fire (self), Lightning, Cold, Physical (through both)
      expect(chain.has('Fire')).toBe(true);
      expect(chain.has('Lightning')).toBe(true);
      expect(chain.has('Cold')).toBe(true);
      expect(chain.has('Physical')).toBe(true);
    });
  });

  // ==========================================================================
  // buildConversionMatrix
  // ==========================================================================

  describe('buildConversionMatrix', () => {
    it('should build matrix from modifier array', () => {
      const mods = [
        { from: 'Physical' as DamageType, to: 'Fire' as DamageType, value: 0.3 },
        { from: 'Physical' as DamageType, to: 'Cold' as DamageType, value: 0.2 },
      ];

      const matrix = buildConversionMatrix(mods);

      expect(matrix.Physical.Fire).toBe(0.3);
      expect(matrix.Physical.Cold).toBe(0.2);
    });

    it('should accumulate multiple mods for same conversion', () => {
      const mods = [
        { from: 'Physical' as DamageType, to: 'Fire' as DamageType, value: 0.3 },
        { from: 'Physical' as DamageType, to: 'Fire' as DamageType, value: 0.2 },
      ];

      const matrix = buildConversionMatrix(mods);

      expect(matrix.Physical.Fire).toBe(0.5);
    });

    it('should ignore invalid conversions', () => {
      const mods = [
        { from: 'Fire' as DamageType, to: 'Physical' as DamageType, value: 0.5 },
        { from: 'Physical' as DamageType, to: 'Fire' as DamageType, value: 0.3 },
      ];

      const matrix = buildConversionMatrix(mods);

      // Fire → Physical is invalid and should be ignored
      expect(matrix.Fire.Physical).toBeUndefined();
      // Physical → Fire is valid
      expect(matrix.Physical.Fire).toBe(0.3);
    });

    it('should ignore same-type conversion', () => {
      const mods = [
        { from: 'Physical' as DamageType, to: 'Physical' as DamageType, value: 0.5 },
      ];

      const matrix = buildConversionMatrix(mods);

      expect(matrix.Physical.Physical).toBeUndefined();
    });

    it('should return empty matrix for empty array', () => {
      const matrix = buildConversionMatrix([]);

      expect(getTotalConversion(matrix, 'Physical')).toBe(0);
      expect(getTotalConversion(matrix, 'Fire')).toBe(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle very small conversion values', () => {
      const baseDamage = createBaseDamage({ Physical: 1000 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.001 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.damage.Physical).toBeCloseTo(999);
      expect(result.damage.Fire).toBeCloseTo(1);
    });

    it('should handle 100% conversion', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 1.0 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      expect(result.damage.Physical).toBe(0);
      expect(result.damage.Fire).toBe(100);
    });

    it('should handle gain as extra exceeding 100%', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createEmptyMatrix();
      const gainAsExtra = createMatrix([
        { from: 'Physical', to: 'Fire', value: 1.5 },
      ]);

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      // Gain as extra is NOT capped
      expect(result.damage.Physical).toBe(100);
      expect(result.damage.Fire).toBe(150);
    });

    it('should handle multiple gain as extra to same type', () => {
      const baseDamage = createBaseDamage({
        Physical: 100,
        Lightning: 50,
      });
      const conversions = createEmptyMatrix();
      const gainAsExtra = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.3 },
        { from: 'Lightning', to: 'Fire', value: 0.4 },
      ]);

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      // 30% of 100 physical + 40% of 50 lightning = 30 + 20 = 50 extra fire
      expect(result.damage.Fire).toBe(50);
    });

    it('should maintain total damage with conversion (no gain)', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.3 },
        { from: 'Physical', to: 'Cold', value: 0.3 },
        { from: 'Physical', to: 'Lightning', value: 0.2 },
      ]);
      const gainAsExtra = createEmptyMatrix();

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      const total = Object.values(result.damage).reduce((sum, val) => sum + val, 0);
      expect(total).toBeCloseTo(100);
    });

    it('should increase total damage with gain as extra', () => {
      const baseDamage = createBaseDamage({ Physical: 100 });
      const conversions = createEmptyMatrix();
      const gainAsExtra = createMatrix([
        { from: 'Physical', to: 'Fire', value: 0.5 },
      ]);

      const result = applyConversions(baseDamage, conversions, gainAsExtra);

      const total = Object.values(result.damage).reduce((sum, val) => sum + val, 0);
      expect(total).toBe(150); // 100 physical + 50 fire
    });
  });
});
