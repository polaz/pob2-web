/**
 * Calculation engine exports.
 *
 * @module engine/calculator
 */

// Types
export type {
  AttributeValues,
  StatResolverConfig,
  StatResolverOptions,
  ResolvedStat,
  StatBreakdown,
  StatSource,
  StatDependency,
  DamageType,
  ConversionStep,
  ConversionConfig,
  ConversionMatrix,
  ConversionResult,
} from './types';

export { DAMAGE_TYPE_ORDER, STAT_DEPENDENCIES } from './types';

// StatResolver
export { StatResolver, createStatResolver } from './StatResolver';

// StatConversion
export {
  createEmptyMatrix,
  getTotalConversion,
  normalizeConversions,
  isValidConversion,
  applyConversions,
  getInheritanceChain,
  buildConversionMatrix,
} from './StatConversion';
