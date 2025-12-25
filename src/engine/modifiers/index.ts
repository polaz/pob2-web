/**
 * Modifier system exports.
 *
 * The modifier system is the core of Path of Building's calculation engine.
 * It stores, queries, and aggregates modifiers from all sources (items,
 * passives, gems, config) to compute final stat values.
 */

// Main class
export { ModDB } from './ModDB';

// Types
export type {
  Mod,
  CalcConfig,
  StatResult,
  ListValue,
  ActorType,
  ModDBOptions,
} from './types';
