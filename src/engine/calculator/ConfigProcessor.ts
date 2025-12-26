/**
 * ConfigProcessor - Process Build Configuration
 *
 * Converts BuildConfig options into modifiers stored in a configDB.
 * Handles charges, combat conditions, and buff states.
 *
 * ## Responsibilities
 *
 * 1. Apply charge bonuses (power, frenzy, endurance)
 * 2. Set up combat conditions (leeching, low life, etc.)
 * 3. Process custom condition overrides
 *
 * ## Charge Effects (PoE2)
 *
 * - **Power Charges**: +40% crit chance per charge
 * - **Frenzy Charges**: +4% attack/cast speed, +4% more damage per charge
 * - **Endurance Charges**: +4% physical DR, +4% elemental res per charge
 */

import { ModDB } from '../modifiers/ModDB';
import type { Mod } from '../modifiers/types';
import type { ResolvedBuildConfig } from './Environment';
import { CHARGE_MULTIPLIERS, BOSS_CONSTANTS } from 'src/shared/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for config processing.
 */
export interface ConfigProcessorInput {
  /** Resolved build configuration */
  config: ResolvedBuildConfig;
}

/**
 * Result of config processing.
 */
export interface ConfigProcessorResult {
  /** ModDB containing config-derived modifiers */
  configDB: ModDB;

  /** Active conditions map (for CalcConfig) */
  conditions: Record<string, boolean>;

  /** Statistics about processing */
  stats: {
    /** Number of charge mods applied */
    chargeMods: number;

    /** Number of condition mods applied */
    conditionMods: number;

    /** Total mods created */
    modsCreated: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Source identifier for config-derived mods */
const CONFIG_SOURCE = 'config';

/** No flags - applies to all */
const NO_FLAGS = 0n;

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process build configuration into a ModDB.
 *
 * @param input - Processing input with resolved config
 * @returns ModDB and conditions map
 */
export function processConfig(input: ConfigProcessorInput): ConfigProcessorResult {
  const { config } = input;

  const configDB = new ModDB({ actor: 'player' });
  const conditions: Record<string, boolean> = {};
  const stats = {
    chargeMods: 0,
    conditionMods: 0,
    modsCreated: 0,
  };

  // Process charges
  const chargeMods = processCharges(config);
  for (const mod of chargeMods) {
    configDB.addMod(mod);
    stats.chargeMods++;
    stats.modsCreated++;
  }

  // Process combat conditions
  processCombatConditions(config, conditions);

  // Process custom conditions from config
  if (config.conditions) {
    Object.assign(conditions, config.conditions);
  }

  return { configDB, conditions, stats };
}

// ============================================================================
// Charge Processing
// ============================================================================

/**
 * Generate modifiers from charge configuration.
 *
 * Uses CHARGE_MULTIPLIERS which are pre-computed at module load time
 * (in constants.ts) as decimal values, avoiding division operations here.
 *
 * @param config - Resolved build config
 * @returns Array of charge-related mods
 */
function processCharges(config: ResolvedBuildConfig): Mod[] {
  const mods: Mod[] = [];

  // Power charges: +40% crit chance per charge
  if (config.powerCharges && config.powerChargeCount > 0) {
    const critBonus = config.powerChargeCount * CHARGE_MULTIPLIERS.POWER_CHARGE_CRIT;

    mods.push(createConfigMod('CritChance', 'INC', critBonus, 'power_charges'));

    // Also add the charge count as a multiplier variable
    mods.push(
      createConfigMod(
        'Multiplier:PowerCharge',
        'BASE',
        config.powerChargeCount,
        'power_charges'
      )
    );
  }

  // Frenzy charges: +4% attack/cast speed, +4% more damage per charge
  if (config.frenzyCharges && config.frenzyChargeCount > 0) {
    const speedBonus =
      config.frenzyChargeCount * CHARGE_MULTIPLIERS.FRENZY_CHARGE_ATTACK_SPEED;
    const damageBonus =
      config.frenzyChargeCount * CHARGE_MULTIPLIERS.FRENZY_CHARGE_DAMAGE;

    // Speed bonus (applies to both attack and cast speed)
    mods.push(createConfigMod('Speed', 'INC', speedBonus, 'frenzy_charges'));

    // Damage bonus (MORE multiplier)
    mods.push(createConfigMod('Damage', 'MORE', damageBonus, 'frenzy_charges'));

    // Charge count multiplier
    mods.push(
      createConfigMod(
        'Multiplier:FrenzyCharge',
        'BASE',
        config.frenzyChargeCount,
        'frenzy_charges'
      )
    );
  }

  // Endurance charges: +4% phys DR, +4% elemental res per charge
  if (config.enduranceCharges && config.enduranceChargeCount > 0) {
    const physDR =
      config.enduranceChargeCount * CHARGE_MULTIPLIERS.ENDURANCE_CHARGE_PHYS_DR;
    const elemRes =
      config.enduranceChargeCount * CHARGE_MULTIPLIERS.ENDURANCE_CHARGE_RESIST;

    // Physical damage reduction
    mods.push(
      createConfigMod('PhysicalDamageReduction', 'BASE', physDR, 'endurance_charges')
    );

    // Elemental resistances
    mods.push(
      createConfigMod('ElementalResist', 'BASE', elemRes, 'endurance_charges')
    );

    // Charge count multiplier
    mods.push(
      createConfigMod(
        'Multiplier:EnduranceCharge',
        'BASE',
        config.enduranceChargeCount,
        'endurance_charges'
      )
    );
  }

  return mods;
}

// ============================================================================
// Condition Processing
// ============================================================================

/**
 * Set up combat condition flags from config.
 *
 * @param config - Resolved build config
 * @param conditions - Conditions map to populate
 */
function processCombatConditions(
  config: ResolvedBuildConfig,
  conditions: Record<string, boolean>
): void {
  // Leeching state
  conditions['Leeching'] = config.isLeeching;

  // Life state (mutually exclusive)
  conditions['LowLife'] = config.isOnLowLife;
  conditions['FullLife'] = config.isOnFullLife && !config.isOnLowLife;

  // Mana state (mutually exclusive)
  conditions['LowMana'] = config.isOnLowMana;
  conditions['FullMana'] = config.isOnFullMana && !config.isOnLowMana;

  // Energy shield state (mutually exclusive)
  conditions['LowEnergyShield'] = config.isOnLowEnergyShield;
  conditions['FullEnergyShield'] =
    config.isOnFullEnergyShield && !config.isOnLowEnergyShield;

  // Charge presence conditions
  conditions['HavePowerCharge'] =
    config.powerCharges && config.powerChargeCount > 0;
  conditions['HaveFrenzyCharge'] =
    config.frenzyCharges && config.frenzyChargeCount > 0;
  conditions['HaveEnduranceCharge'] =
    config.enduranceCharges && config.enduranceChargeCount > 0;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a config-derived modifier.
 *
 * @param name - Stat name
 * @param type - Mod type
 * @param value - Mod value
 * @param sourceId - Source identifier suffix
 * @returns Mod object
 */
function createConfigMod(
  name: string,
  type: 'BASE' | 'INC' | 'MORE' | 'FLAG',
  value: number | boolean,
  sourceId: string
): Mod {
  return {
    name,
    type,
    value,
    flags: NO_FLAGS,
    keywordFlags: NO_FLAGS,
    source: CONFIG_SOURCE,
    sourceId: `config:${sourceId}`,
  };
}

// ============================================================================
// Enemy Configuration
// ============================================================================

/**
 * Process enemy configuration into an enemyDB.
 *
 * @param config - Resolved build config
 * @returns ModDB for enemy stats
 */
export function processEnemyConfig(config: ResolvedBuildConfig): ModDB {
  const enemyDB = new ModDB({ actor: 'enemy' });

  // Enemy level affects accuracy and resistance calculations
  enemyDB.addMod({
    name: 'Level',
    type: 'BASE',
    value: config.enemyLevel,
    flags: NO_FLAGS,
    keywordFlags: NO_FLAGS,
    source: CONFIG_SOURCE,
    sourceId: 'config:enemy_level',
  });

  // Boss enemies have different stats
  if (config.enemyIsBoss) {
    // Bosses typically have higher resistances
    // These are placeholder values - actual boss stats would come from game data
    enemyDB.addMod({
      name: 'IsBoss',
      type: 'FLAG',
      value: true,
      flags: NO_FLAGS,
      keywordFlags: NO_FLAGS,
      source: CONFIG_SOURCE,
      sourceId: 'config:enemy_is_boss',
    });

    // Boss curse effect reduction
    enemyDB.addMod({
      name: 'CurseEffectiveness',
      type: 'MORE',
      value: BOSS_CONSTANTS.CURSE_EFFECT_REDUCTION,
      flags: NO_FLAGS,
      keywordFlags: NO_FLAGS,
      source: CONFIG_SOURCE,
      sourceId: 'config:enemy_boss_curse',
    });
  }

  return enemyDB;
}

// ============================================================================
// Incremental Update Support
// ============================================================================

/**
 * Rebuild configDB from scratch.
 *
 * Config changes typically affect multiple mods, so we rebuild entirely
 * rather than trying incremental updates.
 *
 * @param config - New resolved config
 * @returns New configDB and conditions
 */
export function rebuildConfig(
  config: ResolvedBuildConfig
): Pick<ConfigProcessorResult, 'configDB' | 'conditions'> {
  const result = processConfig({ config });
  return {
    configDB: result.configDB,
    conditions: result.conditions,
  };
}
