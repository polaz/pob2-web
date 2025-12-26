/**
 * Modifier system exports.
 *
 * The modifier system is the core of Path of Building's calculation engine.
 * It stores, queries, and aggregates modifiers from all sources (items,
 * passives, gems, config) to compute final stat values.
 */

// Main classes
export { ModDB } from './ModDB';
export { ModList } from './ModList';
export { ModParser } from './ModParser';

// ModParser loader (singleton with lazy initialization)
export {
  getModParser,
  preloadModParser,
  isModParserLoaded,
  clearModParserCache,
  getModParserStats,
} from './ModParserLoader';

// Types
export type {
  Mod,
  CalcConfig,
  StatResult,
  ListValue,
  ActorType,
  ModDBOptions,
  // ModParser types
  ModSupportLevel,
  FormPattern,
  ModParserData,
  ModParseContext,
  ParseResult,
} from './types';
