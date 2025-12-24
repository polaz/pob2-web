// src/workers/calc.worker.ts
// Calculation worker for DPS/defence computations
// Runs heavy calculations off the main thread

import * as Comlink from 'comlink';
import type { Build } from 'src/protos/pob2_pb';
import type { Modifier } from 'src/shared/modifiers';
import {
  aggregateStat,
  calculateDPS,
  calculateCritChance,
  calculateCritMulti,
  calculateArmourDR,
  calculateEvasionChance,
  type StatValue,
} from 'src/shared/calculations';

/**
 * Calculation results structure
 */
export interface CalcResult {
  // Offence
  totalDPS: number;
  hitDPS: number;
  dotDPS: number;
  bleedDPS: number;
  poisonDPS: number;
  igniteDPS: number;
  critChance: number;
  critMulti: number;
  hitChance: number;
  attackSpeed: number;
  castSpeed: number;

  // Defence
  life: number;
  energyShield: number;
  mana: number;
  armour: number;
  evasion: number;
  blockChance: number;
  spellBlockChance: number;
  fireRes: number;
  coldRes: number;
  lightningRes: number;
  chaosRes: number;

  // Attributes
  strength: number;
  dexterity: number;
  intelligence: number;
}

/**
 * Default empty calculation result
 */
const emptyResult: CalcResult = {
  totalDPS: 0,
  hitDPS: 0,
  dotDPS: 0,
  bleedDPS: 0,
  poisonDPS: 0,
  igniteDPS: 0,
  critChance: 0,
  critMulti: 150,
  hitChance: 100,
  attackSpeed: 0,
  castSpeed: 0,
  life: 0,
  energyShield: 0,
  mana: 0,
  armour: 0,
  evasion: 0,
  blockChance: 0,
  spellBlockChance: 0,
  fireRes: 0,
  coldRes: 0,
  lightningRes: 0,
  chaosRes: 0,
  strength: 0,
  dexterity: 0,
  intelligence: 0,
};

/**
 * Calculation worker API
 */
const calcWorkerApi = {
  /**
   * Calculate full build stats
   * @param _build - The build to calculate
   * @param _modifiers - All modifiers from items, tree, gems
   * @returns Full calculation results
   */
  calculateBuild(
    _build: Build,
    _modifiers: Modifier[]
  ): Promise<CalcResult> {
    // TODO: Implement full calculation logic
    // This is a skeleton that will be filled in by CalcSetup, CalcOffence, CalcDefence

    // For now, return empty result
    // Real implementation will:
    // 1. Run CalcSetup to prepare environment
    // 2. Aggregate all modifiers into ModDB
    // 3. Run CalcOffence for DPS
    // 4. Run CalcDefence for defences
    // 5. Return combined results

    return Promise.resolve({ ...emptyResult });
  },

  /**
   * Calculate a single stat from modifiers
   * @param stat - Stat name to calculate
   * @param modifiers - Modifiers affecting this stat
   * @returns Calculated stat value with optional breakdown
   */
  calculateStat(
    stat: string,
    modifiers: Modifier[],
    includeBreakdown = false
  ): Promise<StatValue> {
    const filtered = modifiers.filter((m) => m.stat === stat);
    return Promise.resolve(aggregateStat(filtered, undefined, undefined, includeBreakdown));
  },

  /**
   * Calculate DPS for a skill
   */
  calculateSkillDPS(
    damagePerHit: number,
    hitsPerSecond: number,
    hitChance: number,
    critChance: number,
    critMulti: number
  ): Promise<number> {
    return Promise.resolve(calculateDPS(damagePerHit, hitsPerSecond, hitChance, critChance, critMulti));
  },

  /**
   * Calculate crit stats
   */
  calculateCrit(
    baseCrit: number,
    increasedCrit: number,
    additionalCrit: number,
    additionalMulti: number
  ): Promise<{ chance: number; multi: number }> {
    return Promise.resolve({
      chance: calculateCritChance(baseCrit, increasedCrit, additionalCrit),
      multi: calculateCritMulti(additionalMulti),
    });
  },

  /**
   * Calculate armour damage reduction
   */
  calculateArmour(armour: number, damage: number): Promise<number> {
    return Promise.resolve(calculateArmourDR(armour, damage));
  },

  /**
   * Calculate evasion chance
   */
  calculateEvasion(evasion: number, accuracy: number): Promise<number> {
    return Promise.resolve(calculateEvasionChance(evasion, accuracy));
  },

  /**
   * Health check
   */
  ping(): Promise<string> {
    return Promise.resolve('pong');
  },
};

export type CalcWorkerApi = typeof calcWorkerApi;

Comlink.expose(calcWorkerApi);
