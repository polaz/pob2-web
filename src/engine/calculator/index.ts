/**
 * Calculation engine exports.
 *
 * @module engine/calculator
 */

// Types from types.ts
// Note: AttributeValues is also re-exported from Environment.ts (which imports it from types.ts).
// We provide an alias StatResolverAttributeValues here for callers who want explicit naming,
// but both refer to the same type from types.ts. The re-export via Environment.ts is for
// organizational convenience since Environment interfaces use AttributeValues.
export type {
  AttributeValues as StatResolverAttributeValues,
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

// Types from Environment.ts
export type {
  Environment,
  SetupOptions,
  DirtyFlags,
  JewelSocket,
  AttributeValues,
  ResolvedBuildConfig,
} from './Environment';

export {
  DIRTY_WILDCARD,
  createCleanDirtyFlags,
  createFullyDirtyFlags,
  hasDirtyFlags,
  isItemSlotDirty,
  isJewelSocketDirty,
  resolveConfig,
} from './Environment';

// CalcSetup - main entry point
export {
  setupEnvironment,
  rebuildPlayerDB,
  updatePassives,
  updateItem,
  diffAllocatedNodes,
} from './CalcSetup';

// Processors
export {
  processPassives,
  updatePassivesIncremental,
  type PassiveProcessorInput,
  type PassiveProcessorResult,
} from './PassiveProcessor';

export {
  processItems,
  processItemsBothSets,
  processSingleItem,
  updateItemSlot,
  getAllItemMods,
  hasItemInSlot,
  MAIN_WEAPON_SLOTS,
  SWAP_WEAPON_SLOTS,
  ALL_SLOTS,
  type ItemProcessorInput,
  type ItemProcessorResult,
} from './ItemProcessor';

export {
  processJewels,
  processSingleJewel,
  updateJewelSocket,
  createJewelSocketMap,
  getOccupiedSocketIds,
  type JewelProcessorInput,
  type JewelProcessorResult,
} from './JewelProcessor';

export {
  processSkills,
  processSingleSkillGroup,
  getSkillGroupIds,
  getEnabledSkillGroupIds,
  type SkillProcessorInput,
  type SkillProcessorResult,
} from './SkillProcessor';

export {
  processConfig,
  processEnemyConfig,
  rebuildConfig,
  type ConfigProcessorInput,
  type ConfigProcessorResult,
} from './ConfigProcessor';

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
