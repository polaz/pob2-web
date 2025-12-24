/**
 * Config Store - manages calculator configuration options
 */
import { ref, computed } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { cloneDeep } from 'lodash-es';
import type { BuildConfig } from 'src/protos/pob2_pb';

/**
 * Default build configuration.
 * Note: Charge counts represent the maximum available charges for the build,
 * while the boolean flags indicate whether charges are currently active.
 * This allows preserving charge counts when toggling charges on/off.
 */
export const DEFAULT_BUILD_CONFIG: BuildConfig = {
  // Enemy configuration
  enemyLevel: 83,
  enemyIsBoss: false,
  enemyType: 'Normal',

  // Charge configuration: enabled flags and max counts are separate
  // to preserve counts when toggling charges on/off
  powerCharges: false,
  frenzyCharges: false,
  enduranceCharges: false,
  powerChargeCount: 3,
  frenzyChargeCount: 3,
  enduranceChargeCount: 3,

  // Combat state: isOnFullLife and isOnLowLife are mutually exclusive.
  // When both are false, character is in mid-life state (35-99% HP).
  isLeeching: false,
  isOnLowLife: false,
  isOnFullLife: true,
  enemyIsChilled: false,
  enemyIsFrozen: false,
  enemyIsShocked: false,
  enemyIsIgnited: false,
};

/** Enemy types available */
export const ENEMY_TYPES = [
  { value: 'Normal', label: 'Normal' },
  { value: 'Magic', label: 'Magic' },
  { value: 'Rare', label: 'Rare' },
  { value: 'Unique', label: 'Unique' },
] as const;

/** Boss presets */
export const BOSS_PRESETS = [
  { value: 'none', label: 'No Boss', level: 83, isBoss: false },
  { value: 'map_boss', label: 'Map Boss', level: 83, isBoss: true },
  { value: 'pinnacle', label: 'Pinnacle Boss', level: 85, isBoss: true },
  { value: 'uber', label: 'Uber Boss', level: 85, isBoss: true },
] as const;

export const useConfigStore = defineStore('config', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Current build configuration */
  const config = ref<BuildConfig>({ ...DEFAULT_BUILD_CONFIG });

  /** Whether config panel is expanded */
  const isPanelExpanded = ref(true);

  /** Currently selected config section */
  const activeSection = ref<'enemy' | 'charges' | 'combat' | 'custom'>('enemy');

  /** Custom modifiers enabled by user */
  const customModifiers = ref<string[]>([]);

  // ============================================================================
  // Getters
  // ============================================================================

  /** Enemy level */
  const enemyLevel = computed(() => config.value.enemyLevel ?? 83);

  /** Whether enemy is a boss */
  const enemyIsBoss = computed(() => config.value.enemyIsBoss ?? false);

  /** Enemy type */
  const enemyType = computed(() => config.value.enemyType ?? 'Normal');

  /** Power charges enabled */
  const powerChargesEnabled = computed(() => config.value.powerCharges ?? false);

  /** Frenzy charges enabled */
  const frenzyChargesEnabled = computed(() => config.value.frenzyCharges ?? false);

  /** Endurance charges enabled */
  const enduranceChargesEnabled = computed(() => config.value.enduranceCharges ?? false);

  /** Power charge count */
  const powerChargeCount = computed(() => config.value.powerChargeCount ?? 3);

  /** Frenzy charge count */
  const frenzyChargeCount = computed(() => config.value.frenzyChargeCount ?? 3);

  /** Endurance charge count */
  const enduranceChargeCount = computed(() => config.value.enduranceChargeCount ?? 3);

  /** Is leeching */
  const isLeeching = computed(() => config.value.isLeeching ?? false);

  /** Is on low life */
  const isOnLowLife = computed(() => config.value.isOnLowLife ?? false);

  /** Is on full life */
  const isOnFullLife = computed(() => config.value.isOnFullLife ?? true);

  /** Enemy ailment states */
  const enemyAilments = computed(() => ({
    chilled: config.value.enemyIsChilled ?? false,
    frozen: config.value.enemyIsFrozen ?? false,
    shocked: config.value.enemyIsShocked ?? false,
    ignited: config.value.enemyIsIgnited ?? false,
  }));

  // ============================================================================
  // Actions
  // ============================================================================

  /** Set enemy level */
  function setEnemyLevel(level: number): void {
    config.value.enemyLevel = Math.max(1, Math.min(100, level));
  }

  /** Set enemy is boss */
  function setEnemyIsBoss(isBoss: boolean): void {
    config.value.enemyIsBoss = isBoss;
  }

  /** Set enemy type */
  function setEnemyType(type: string): void {
    config.value.enemyType = type;
  }

  /** Apply boss preset */
  function applyBossPreset(presetValue: string): void {
    const preset = BOSS_PRESETS.find((p) => p.value === presetValue);
    if (preset) {
      config.value.enemyLevel = preset.level;
      config.value.enemyIsBoss = preset.isBoss;
    }
  }

  /** Toggle power charges */
  function togglePowerCharges(): void {
    config.value.powerCharges = !config.value.powerCharges;
  }

  /** Toggle frenzy charges */
  function toggleFrenzyCharges(): void {
    config.value.frenzyCharges = !config.value.frenzyCharges;
  }

  /** Toggle endurance charges */
  function toggleEnduranceCharges(): void {
    config.value.enduranceCharges = !config.value.enduranceCharges;
  }

  /** Set charge counts */
  function setChargeCount(type: 'power' | 'frenzy' | 'endurance', count: number): void {
    const clampedCount = Math.max(0, Math.min(10, count));
    switch (type) {
      case 'power':
        config.value.powerChargeCount = clampedCount;
        break;
      case 'frenzy':
        config.value.frenzyChargeCount = clampedCount;
        break;
      case 'endurance':
        config.value.enduranceChargeCount = clampedCount;
        break;
    }
  }

  /** Toggle leeching state */
  function toggleLeeching(): void {
    config.value.isLeeching = !config.value.isLeeching;
  }

  /**
   * Toggle low life state.
   * Low life (<35% HP) and full life (100% HP) are mutually exclusive.
   * When both are false, character is in mid-life state (35-99% HP).
   */
  function toggleLowLife(): void {
    config.value.isOnLowLife = !config.value.isOnLowLife;
    if (config.value.isOnLowLife) {
      config.value.isOnFullLife = false;
    }
  }

  /**
   * Toggle full life state.
   * Full life (100% HP) and low life (<35% HP) are mutually exclusive.
   * When both are false, character is in mid-life state (35-99% HP).
   */
  function toggleFullLife(): void {
    config.value.isOnFullLife = !config.value.isOnFullLife;
    if (config.value.isOnFullLife) {
      config.value.isOnLowLife = false;
    }
  }

  /** Toggle enemy ailment */
  function toggleEnemyAilment(ailment: 'chilled' | 'frozen' | 'shocked' | 'ignited'): void {
    switch (ailment) {
      case 'chilled':
        config.value.enemyIsChilled = !config.value.enemyIsChilled;
        break;
      case 'frozen':
        config.value.enemyIsFrozen = !config.value.enemyIsFrozen;
        break;
      case 'shocked':
        config.value.enemyIsShocked = !config.value.enemyIsShocked;
        break;
      case 'ignited':
        config.value.enemyIsIgnited = !config.value.enemyIsIgnited;
        break;
    }
  }

  /**
   * Set full config.
   * Enforces mutual exclusivity: if both isOnFullLife and isOnLowLife are true,
   * isOnLowLife takes precedence (full life is disabled) since low life is a
   * more specific build-defining state.
   */
  function setConfig(newConfig: BuildConfig): void {
    const clonedConfig = cloneDeep(newConfig);

    // Enforce mutual exclusivity: low life takes precedence
    if (clonedConfig.isOnFullLife && clonedConfig.isOnLowLife) {
      clonedConfig.isOnFullLife = false;
    }

    config.value = clonedConfig;
  }

  /** Reset to defaults */
  function resetToDefaults(): void {
    config.value = cloneDeep(DEFAULT_BUILD_CONFIG);
  }

  /** Export config */
  function exportConfig(): BuildConfig {
    return cloneDeep(config.value);
  }

  /** Toggle panel expansion */
  function togglePanel(): void {
    isPanelExpanded.value = !isPanelExpanded.value;
  }

  /** Set active section */
  function setActiveSection(section: 'enemy' | 'charges' | 'combat' | 'custom'): void {
    activeSection.value = section;
  }

  /** Add custom modifier */
  function addCustomModifier(modifier: string): void {
    if (!customModifiers.value.includes(modifier)) {
      customModifiers.value.push(modifier);
    }
  }

  /** Remove custom modifier */
  function removeCustomModifier(modifier: string): void {
    const index = customModifiers.value.indexOf(modifier);
    if (index !== -1) {
      customModifiers.value.splice(index, 1);
    }
  }

  /** Clear custom modifiers */
  function clearCustomModifiers(): void {
    customModifiers.value = [];
  }

  return {
    // State
    config,
    isPanelExpanded,
    activeSection,
    customModifiers,

    // Constants
    ENEMY_TYPES,
    BOSS_PRESETS,

    // Getters
    enemyLevel,
    enemyIsBoss,
    enemyType,
    powerChargesEnabled,
    frenzyChargesEnabled,
    enduranceChargesEnabled,
    powerChargeCount,
    frenzyChargeCount,
    enduranceChargeCount,
    isLeeching,
    isOnLowLife,
    isOnFullLife,
    enemyAilments,

    // Actions
    setEnemyLevel,
    setEnemyIsBoss,
    setEnemyType,
    applyBossPreset,
    togglePowerCharges,
    toggleFrenzyCharges,
    toggleEnduranceCharges,
    setChargeCount,
    toggleLeeching,
    toggleLowLife,
    toggleFullLife,
    toggleEnemyAilment,
    setConfig,
    resetToDefaults,
    exportConfig,
    togglePanel,
    setActiveSection,
    addCustomModifier,
    removeCustomModifier,
    clearCustomModifiers,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
