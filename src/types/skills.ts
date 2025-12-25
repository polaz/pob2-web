// src/types/skills.ts
// Types for PoE2 skill stats data extracted from PoB2's Skills/*.lua files
// Source: PathOfBuildingCommunity/PathOfBuilding-PoE2

/**
 * Quality stat bonus per quality point
 */
export interface QualityStat {
  /** Game stat name (e.g., "number_of_chains") */
  stat: string;
  /** Value per 1% quality */
  perQuality: number;
}

/**
 * Cost per skill use (mana, life, etc.)
 */
export interface SkillCost {
  mana?: number;
  life?: number;
  rage?: number;
  [key: string]: number | undefined;
}

/**
 * Per-level skill data (from skill's levels table)
 */
export interface SkillLevel {
  /** Base critical strike chance (percent, e.g., 12 = 12%) */
  critChance?: number;
  /** Character level requirement to use this gem level */
  levelRequirement?: number;
  /** PvP damage multiplier */
  pvpDamageMultiplier?: number;
  /** Mana cost multiplier (for support gems) */
  manaMultiplier?: number;
  /** Attack speed multiplier (negative = slower, e.g., -40 = 40% slower) */
  attackSpeedMultiplier?: number;
  /** Base damage multiplier for attacks (e.g., 1.4 = 140% base damage) */
  baseMultiplier?: number;
  /** Damage effectiveness for some skills */
  damageEffectiveness?: number;
  /** Resource cost per use */
  cost?: SkillCost;
}

/**
 * Constant stat (fixed value, doesn't scale with level)
 */
export interface ConstantStat {
  /** Game stat name */
  stat: string;
  /** Fixed value */
  value: number;
}

/**
 * Per-level stat values in a stat set
 */
export interface StatSetLevel {
  /** Stat values matching the stats array order */
  values: number[];
  /** Effective actor level for damage scaling calculations */
  actorLevel?: number;
  /** Interpolation method for each stat (1 = linear) */
  statInterpolation?: number[];
}

/**
 * Stat set defining damage scaling and mechanics for a skill variant
 *
 * Skills can have multiple stat sets for different behaviors:
 * - Base skill
 * - Infusion variants (Cold-Infused, Fire-Infused, etc.)
 * - Secondary effects (projectile explosion, aftershock, etc.)
 */
export interface SkillStatSet {
  /** Display label for this stat set */
  label?: string;

  // Damage effectiveness scaling
  /** Base damage effectiveness (e.g., 1.52 = 152% base damage) */
  baseEffectiveness?: number;
  /** Incremental effectiveness per level */
  incrementalEffectiveness?: number;
  /** Damage incremental effectiveness per level (for gems with separate scaling) */
  damageIncrementalEffectiveness?: number;

  /** Stat description scope for tooltip generation */
  statDescriptionScope?: string;

  /** Base flags (spell, area, melee, etc.) */
  baseFlags?: string[];

  /** Fixed stats that don't scale with level */
  constantStats?: ConstantStat[];

  /**
   * Array of stat names that scale with level
   * Order matches the values array in each level
   */
  stats?: string[];

  /** Stats that don't apply to minions */
  notMinionStat?: string[];

  /**
   * Per-level stat values
   * Keys are level numbers (1-40+)
   */
  levels?: Record<string, StatSetLevel>;
}

/**
 * Complete skill data extracted from PoB2
 */
export interface Skill {
  /** Display name */
  name?: string;

  /** Base type name (usually same as name) */
  baseTypeName?: string;

  /** Attribute color (1=Str/Red, 2=Dex/Green, 3=Int/Blue) */
  color?: number;

  /** Skill description text */
  description?: string;

  /** Base cast/attack time in seconds */
  castTime?: number;

  /** Whether this is a support gem */
  support?: boolean;

  /** Skill type flags (Spell, Attack, Projectile, etc.) */
  skillTypes?: string[];

  // Support gem specific
  /** Required skill types for support to apply */
  requireSkillTypes?: string[];
  /** Skill types added to supported skill */
  addSkillTypes?: string[];
  /** Skill types that prevent support */
  excludeSkillTypes?: string[];

  /** Support gem family grouping */
  gemFamily?: string[];

  /** Quality stat bonuses */
  qualityStats?: QualityStat[];

  /**
   * Per-level skill data
   * Keys are level numbers (1-40+)
   */
  levels?: Record<string, SkillLevel>;

  /** Stat sets for damage calculation */
  statSets?: SkillStatSet[];

  /** Lineage (unique/boss drop) gem flag */
  isLineage?: boolean;

  /** Flavour text */
  flavourText?: string;
}

/**
 * Stat mapping entry from SkillStatMap.lua
 */
export interface StatMapping {
  /** Internal stat name (e.g., "ColdMin", "duration") */
  name?: string;
  /** Division factor (e.g., 1000 for ms->s conversion) */
  div?: number;
  /** Modifier name (for mod-based stats) */
  mod?: string;
  /** Flag name (for flag-based stats) */
  flag?: string;
}

/**
 * Skills data metadata
 */
export interface SkillsMeta {
  totalSkills: number;
  activeSkills: number;
  supportSkills: number;
  statMappings: number;
}

/**
 * Complete raw skills data structure from JSON file
 */
export interface RawSkillsData {
  version: string;
  extractedAt: string;
  source: string;
  meta: SkillsMeta;
  /** Stat name mappings from game names to internal names */
  statMap: Record<string, StatMapping>;
  /** Skills indexed by effect ID */
  skills: Record<string, Skill>;
}

/**
 * Optimized skills data for runtime operations
 */
export interface SkillsData {
  version: string;
  extractedAt: Date;
  source: string;
  meta: SkillsMeta;
  /** Stat name mappings */
  statMap: Map<string, StatMapping>;
  /** Skills indexed by effect ID */
  skills: Map<string, Skill>;
  /** Index by name for search */
  byName: Map<string, Skill>;
}

/**
 * Combined gem + skill data for a complete skill definition
 */
export interface CompleteSkill {
  /** Gem metadata (from poe2-gems.json) */
  gem: {
    id: string;
    name: string;
    type: string;
    isSupport: boolean;
    tier: number;
    maxLevel: number;
    requirements: {
      str: number;
      dex: number;
      int: number;
    };
    /** Tag flags for filtering (values may be undefined for non-present tags) */
    tags: Record<string, boolean | undefined>;
    weaponTypes?: string[];
  };

  /** Skill stats (from poe2-skills.json) */
  skill: Skill;
}
