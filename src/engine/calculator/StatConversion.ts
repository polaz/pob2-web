/**
 * StatConversion - Damage Type Conversion Handler
 *
 * Handles damage conversion chains in Path of Exile 2.
 *
 * ## Conversion Rules
 *
 * 1. Damage can only convert "up" the chain: Physical → Lightning → Cold → Fire → Chaos
 * 2. Conversion is capped at 100% per source type
 * 3. "Gain as extra" is applied after conversion and is NOT capped
 * 4. Converted damage inherits modifiers from both source AND target type
 *
 * ## Example
 *
 * With 50% Physical to Fire and 30% Physical to Cold:
 * - 100 Physical damage
 * - 50 converts to Fire (50 Fire)
 * - 30 converts to Cold (30 Cold)
 * - 20 remains Physical (100 - 50 - 30 = 20)
 * - Total: 20 Physical + 30 Cold + 50 Fire
 *
 * @see https://www.poewiki.net/wiki/Damage_conversion
 */

import {
  type DamageType,
  type ConversionMatrix,
  type ConversionStep,
  type ConversionResult,
  DAMAGE_TYPE_ORDER,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Maximum conversion percentage from a single source type */
const MAX_CONVERSION_PERCENT = 1.0;

/** Index lookup for damage types */
const DAMAGE_TYPE_INDEX: Record<DamageType, number> = {
  Physical: 0,
  Lightning: 1,
  Cold: 2,
  Fire: 3,
  Chaos: 4,
};

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Create an empty conversion matrix.
 */
export function createEmptyMatrix(): ConversionMatrix {
  return {
    Physical: {},
    Lightning: {},
    Cold: {},
    Fire: {},
    Chaos: {},
  };
}

/**
 * Get the total conversion percentage from a source type.
 *
 * @param matrix - Conversion matrix
 * @param from - Source damage type
 * @returns Total conversion percentage (0-1)
 */
export function getTotalConversion(matrix: ConversionMatrix, from: DamageType): number {
  const conversions = matrix[from];
  let total = 0;

  for (const to of DAMAGE_TYPE_ORDER) {
    if (to !== from && conversions[to] !== undefined) {
      total += conversions[to];
    }
  }

  return total;
}

/**
 * Normalize conversion percentages to not exceed 100%.
 *
 * If total conversion > 100%, each conversion is scaled proportionally.
 *
 * @param matrix - Conversion matrix to normalize
 * @returns Normalized conversion matrix
 */
export function normalizeConversions(matrix: ConversionMatrix): ConversionMatrix {
  const result = createEmptyMatrix();

  for (const from of DAMAGE_TYPE_ORDER) {
    const total = getTotalConversion(matrix, from);

    if (total <= MAX_CONVERSION_PERCENT) {
      // No scaling needed
      result[from] = { ...matrix[from] };
    } else {
      // Scale all conversions proportionally
      const scale = MAX_CONVERSION_PERCENT / total;
      for (const to of DAMAGE_TYPE_ORDER) {
        const conversionValue = matrix[from][to];
        if (to !== from && conversionValue !== undefined) {
          result[from][to] = conversionValue * scale;
        }
      }
    }
  }

  return result;
}

/**
 * Check if conversion from one type to another is valid.
 *
 * Conversion can only go "up" the chain: Physical → Lightning → Cold → Fire → Chaos
 *
 * @param from - Source damage type
 * @param to - Target damage type
 * @returns True if conversion is valid
 */
export function isValidConversion(from: DamageType, to: DamageType): boolean {
  if (from === to) return false;
  return DAMAGE_TYPE_INDEX[from] < DAMAGE_TYPE_INDEX[to];
}

/**
 * Apply damage conversions and "gain as extra" to base damage.
 *
 * @param baseDamage - Base damage per type
 * @param conversions - Conversion percentages
 * @param gainAsExtra - "Gain as extra" percentages
 * @returns Conversion result with final damage and steps
 */
export function applyConversions(
  baseDamage: Record<DamageType, number>,
  conversions: ConversionMatrix,
  gainAsExtra: ConversionMatrix
): ConversionResult {
  const steps: ConversionStep[] = [];

  // Normalize conversions to cap at 100%
  const normalizedConversions = normalizeConversions(conversions);

  // Working damage amounts (will be modified as we convert)
  const damage: Record<DamageType, number> = { ...baseDamage };

  // Process conversions in order (Physical first, then up the chain)
  for (const from of DAMAGE_TYPE_ORDER) {
    const sourceAmount = damage[from];
    if (sourceAmount <= 0) continue;

    // Calculate how much is converted away
    let totalConverted = 0;

    for (const to of DAMAGE_TYPE_ORDER) {
      if (!isValidConversion(from, to)) continue;

      const conversionPercent = normalizedConversions[from][to] ?? 0;
      if (conversionPercent <= 0) continue;

      const convertedAmount = sourceAmount * conversionPercent;
      totalConverted += convertedAmount;

      // Add to target type
      damage[to] += convertedAmount;

      // Record step
      steps.push({
        from,
        to,
        percent: conversionPercent,
        amount: convertedAmount,
      });
    }

    // Subtract converted amount from source
    damage[from] = sourceAmount - totalConverted;
  }

  // Apply "gain as extra" (not capped, applied to damage after conversion)
  for (const from of DAMAGE_TYPE_ORDER) {
    // "Gain as extra" is based on the ORIGINAL base damage, not post-conversion
    const sourceAmount = baseDamage[from];
    if (sourceAmount <= 0) continue;

    for (const to of DAMAGE_TYPE_ORDER) {
      if (from === to) continue;

      const gainPercent = gainAsExtra[from][to] ?? 0;
      if (gainPercent <= 0) continue;

      const extraAmount = sourceAmount * gainPercent;
      damage[to] += extraAmount;

      // Record as a special conversion step (negative "from" indicates gain as extra)
      steps.push({
        from,
        to,
        percent: gainPercent,
        amount: extraAmount,
      });
    }
  }

  return { damage, steps };
}

/**
 * Calculate the inheritance chain for converted damage.
 *
 * Converted damage benefits from modifiers that apply to ANY type in its
 * conversion chain. This function returns all types that a final damage
 * type could have originated from.
 *
 * @param finalType - The final damage type after conversion
 * @param conversions - Conversion matrix to trace back
 * @returns Set of damage types that could have converted to this type
 */
export function getInheritanceChain(
  finalType: DamageType,
  conversions: ConversionMatrix
): Set<DamageType> {
  const chain = new Set<DamageType>([finalType]);

  // Check all types that could convert to this type
  for (const from of DAMAGE_TYPE_ORDER) {
    if (from === finalType) continue;
    if (!isValidConversion(from, finalType)) continue;

    const conversionPercent = conversions[from][finalType] ?? 0;
    if (conversionPercent > 0) {
      chain.add(from);

      // Recursively add types that could convert to the source
      const sourceChain = getInheritanceChain(from, conversions);
      for (const type of sourceChain) {
        chain.add(type);
      }
    }
  }

  return chain;
}

/**
 * Build a conversion matrix from modifier values.
 *
 * @param mods - Array of conversion modifiers
 *   Format: { from: DamageType, to: DamageType, value: number }
 * @returns Conversion matrix
 */
export function buildConversionMatrix(
  mods: Array<{ from: DamageType; to: DamageType; value: number }>
): ConversionMatrix {
  const matrix = createEmptyMatrix();

  for (const mod of mods) {
    if (!isValidConversion(mod.from, mod.to)) continue;

    const current = matrix[mod.from][mod.to] ?? 0;
    matrix[mod.from][mod.to] = current + mod.value;
  }

  return matrix;
}
