/**
 * Engine-specific modifier types for runtime calculations.
 *
 * These types extend the base modifier types from src/types/mods.ts
 * with runtime-specific fields needed for calculation.
 */

import type {
  ModType,
  ModSource,
  ModCondition,
  ModTag,
  ModDefinition,
} from 'src/types/mods';

// ============================================================================
// Runtime Modifier Types
// ============================================================================

/**
 * A runtime modifier stored in ModDB.
 *
 * This is the flattened, calculation-ready form of a modifier effect.
 * Each Mod represents a single stat modification with all context needed
 * for aggregation and filtering.
 */
export interface Mod {
  /** Stat name this modifier affects (e.g., "Life", "PhysicalDamage") */
  name: string;

  /** How this modifier is applied (BASE, INC, MORE, etc.) */
  type: ModType;

  /**
   * The modifier value.
   * - Numeric for most types (BASE, INC, MORE, OVERRIDE, FLAG)
   * - May be complex/structured for LIST type modifiers
   */
  value: unknown;

  /** Damage/attack type flags for filtering (0 = applies to all) */
  flags: bigint;

  /** Skill keyword flags for filtering (0 = applies to all) */
  keywordFlags: bigint;

  /** Where this modifier comes from */
  source: ModSource;

  /** Source identifier (item ID, node ID, etc.) */
  sourceId: string;

  /** Optional condition that must be met */
  condition?: ModCondition;

  /** Optional tag for targeting */
  tag?: ModTag;
}

/**
 * Configuration for calculating a stat.
 *
 * Used to pass context when querying ModDB for stat values.
 */
export interface CalcConfig {
  /** Flags that must match (modifier flags & config flags = modifier flags) */
  flags?: bigint;

  /** Keyword flags that must match */
  keywordFlags?: bigint;

  /** Active conditions (e.g., { LowLife: true, Onslaught: true }) */
  conditions?: Record<string, boolean>;

  /** Current stat values for PerStat/Multiplier conditions */
  stats?: Record<string, number>;

  /** Slot name for SocketedIn conditions */
  slotName?: string;
}

/**
 * Result of a stat calculation.
 *
 * Contains breakdown of how the final value was computed.
 */
export interface StatResult {
  /** Final calculated value */
  value: number;

  /** Sum of all BASE values */
  base: number;

  /** Sum of all INC values (applied as multiplier: 1 + inc) */
  inc: number;

  /** Combined MORE multiplier (product of all MORE values) */
  more: number;

  /** Override value if any (highest wins) */
  override?: number;

  /** Number of modifiers that contributed */
  modCount: number;
}

// ============================================================================
// Modifier List Types
// ============================================================================

/**
 * A list value from LIST type modifiers.
 *
 * Used for effects that add to a collection rather than a numeric stat.
 */
export interface ListValue {
  /** The modifier that produced this value */
  mod: Mod;

  /** The list value data */
  value: unknown;
}

// ============================================================================
// Actor Types (for hierarchical ModDB)
// ============================================================================

/**
 * Actor type for ModDB hierarchy.
 *
 * Different actors can have different modifier contexts.
 */
export type ActorType = 'player' | 'minion' | 'totem' | 'enemy';

/**
 * Options for creating a ModDB instance.
 */
export interface ModDBOptions {
  /** Parent ModDB to inherit modifiers from */
  parent?: ModDB;

  /** Actor type for this database */
  actor?: ActorType;
}

// Forward declaration for circular reference
import type { ModDB } from './ModDB';

// ============================================================================
// ModParser Types
// ============================================================================

/**
 * Support level for a parsed modifier.
 *
 * Indicates how well the modifier can be calculated.
 */
export type ModSupportLevel =
  /** Fully parsed and calculated */
  | 'full'
  /** Parsed but calculation incomplete (shown in UI, partial DPS) */
  | 'partial'
  /** Recognized but not calculated (shown as informational) */
  | 'display_only'
  /** Unknown mod, not in data (shown as warning) */
  | 'unsupported';

/**
 * A pattern for matching modifier text.
 */
export interface FormPattern {
  /** Unique identifier for this pattern */
  id: string;

  /** Regular expression pattern string */
  regex: string;

  /** Modifier type this pattern produces */
  type: ModType;

  /** Capture group index for the numeric value (1-indexed) */
  valueGroup?: number;

  /** Multiple capture groups for values (e.g., damage ranges) */
  valueGroups?: number[];

  /** Capture group index for the stat name (1-indexed) */
  statGroup?: number;

  /** Scale factor applied to the value (e.g., 0.01 for percentages) */
  valueScale?: number;

  /** Output stat names with template placeholders (e.g., "${stat}Min") */
  outputStats?: string[];

  /** Example modifier texts that match this pattern */
  examples?: string[];
}

/**
 * Data files loaded by ModParser.
 */
export interface ModParserData {
  /** Form patterns for text matching */
  patterns: FormPattern[];

  /** Text to canonical stat name mappings */
  statMappings: Record<string, string>;

  /** Text to ModFlag name mappings */
  flagMappings: Record<string, string | string[]>;

  /** Text to KeywordFlag name mappings */
  keywordMappings: Record<string, string | string[]>;

  /** Text to condition structure mappings */
  conditionMappings: Record<string, ModCondition>;

  /** Pre-parsed mod cache */
  modCache: Record<string, ModDefinition>;
}

/**
 * Context for parsing a modifier.
 */
export interface ModParseContext {
  /** Source of the modifier (item, passive, etc.) */
  source: ModSource;

  /** Source identifier */
  sourceId: string;

  /** Whether this is a local modifier */
  isLocal?: boolean;

  /** Item slot for local modifiers */
  slotName?: string;
}

/**
 * Result of parsing a modifier.
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;

  /** Parsed modifiers (may be multiple from one text line) */
  mods: Mod[];

  /** Support level achieved */
  supportLevel: ModSupportLevel;

  /** Original text that was parsed */
  originalText: string;

  /** Reason for failure (if success is false) */
  reason?: string;

  /** Warnings generated during parsing */
  warnings?: string[];
}
