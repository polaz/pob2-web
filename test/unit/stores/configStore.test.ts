/**
 * Unit tests for configStore.
 *
 * Tests mutual exclusivity rules for life states, charge management,
 * and configuration handling.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  useConfigStore,
  DEFAULT_BUILD_CONFIG,
  ENEMY_TYPES,
  BOSS_PRESETS,
} from 'src/stores/configStore';

describe('configStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have default configuration', () => {
      const store = useConfigStore();

      expect(store.enemyLevel).toBe(83);
      expect(store.enemyIsBoss).toBe(false);
      expect(store.enemyType).toBe('Normal');
      expect(store.isOnFullLife).toBe(true);
      expect(store.isOnLowLife).toBe(false);
    });

    it('should have correct charge defaults', () => {
      const store = useConfigStore();

      expect(store.powerChargesEnabled).toBe(false);
      expect(store.frenzyChargesEnabled).toBe(false);
      expect(store.enduranceChargesEnabled).toBe(false);
      expect(store.powerChargeCount).toBe(3);
      expect(store.frenzyChargeCount).toBe(3);
      expect(store.enduranceChargeCount).toBe(3);
    });
  });

  describe('mutual exclusivity: low life / full life', () => {
    it('should disable full life when enabling low life', () => {
      const store = useConfigStore();

      // Start with full life (default)
      expect(store.isOnFullLife).toBe(true);
      expect(store.isOnLowLife).toBe(false);

      // Toggle low life ON
      store.toggleLowLife();

      expect(store.isOnLowLife).toBe(true);
      expect(store.isOnFullLife).toBe(false);
    });

    it('should disable low life when enabling full life', () => {
      const store = useConfigStore();

      // Start in low life state
      store.toggleLowLife();
      expect(store.isOnLowLife).toBe(true);

      // Toggle full life ON
      store.toggleFullLife();

      expect(store.isOnFullLife).toBe(true);
      expect(store.isOnLowLife).toBe(false);
    });

    it('should allow both to be false (mid-life state)', () => {
      const store = useConfigStore();

      // Start with full life, then toggle off
      store.toggleFullLife();

      expect(store.isOnFullLife).toBe(false);
      expect(store.isOnLowLife).toBe(false);
    });

    it('should toggle low life off when already on', () => {
      const store = useConfigStore();

      store.toggleLowLife(); // ON
      expect(store.isOnLowLife).toBe(true);

      store.toggleLowLife(); // OFF
      expect(store.isOnLowLife).toBe(false);
      // Full life should remain false (mid-life state)
      expect(store.isOnFullLife).toBe(false);
    });
  });

  describe('setConfig mutual exclusivity', () => {
    it('should enforce low life precedence when both are true', () => {
      const store = useConfigStore();

      // Set config with both flags true (invalid state)
      store.setConfig({
        ...DEFAULT_BUILD_CONFIG,
        isOnLowLife: true,
        isOnFullLife: true,
      });

      // Low life should take precedence
      expect(store.isOnLowLife).toBe(true);
      expect(store.isOnFullLife).toBe(false);
    });

    it('should preserve valid exclusive states', () => {
      const store = useConfigStore();

      store.setConfig({
        ...DEFAULT_BUILD_CONFIG,
        isOnLowLife: true,
        isOnFullLife: false,
      });

      expect(store.isOnLowLife).toBe(true);
      expect(store.isOnFullLife).toBe(false);
    });

    it('should allow mid-life state (both false)', () => {
      const store = useConfigStore();

      store.setConfig({
        ...DEFAULT_BUILD_CONFIG,
        isOnLowLife: false,
        isOnFullLife: false,
      });

      expect(store.isOnLowLife).toBe(false);
      expect(store.isOnFullLife).toBe(false);
    });
  });

  describe('enemy configuration', () => {
    it('should clamp enemy level between 1 and 100', () => {
      const store = useConfigStore();

      store.setEnemyLevel(50);
      expect(store.enemyLevel).toBe(50);

      store.setEnemyLevel(0);
      expect(store.enemyLevel).toBe(1);

      store.setEnemyLevel(150);
      expect(store.enemyLevel).toBe(100);
    });

    it('should set enemy type', () => {
      const store = useConfigStore();

      store.setEnemyType('Rare');

      expect(store.enemyType).toBe('Rare');
    });

    it('should apply boss presets', () => {
      const store = useConfigStore();

      store.applyBossPreset('pinnacle');

      expect(store.enemyLevel).toBe(85);
      expect(store.enemyIsBoss).toBe(true);
    });

    it('should handle unknown boss preset gracefully', () => {
      const store = useConfigStore();
      const originalLevel = store.enemyLevel;

      store.applyBossPreset('unknown_preset');

      // Should not change anything
      expect(store.enemyLevel).toBe(originalLevel);
    });
  });

  describe('charge management', () => {
    it('should toggle power charges', () => {
      const store = useConfigStore();

      expect(store.powerChargesEnabled).toBe(false);

      store.togglePowerCharges();
      expect(store.powerChargesEnabled).toBe(true);

      store.togglePowerCharges();
      expect(store.powerChargesEnabled).toBe(false);
    });

    it('should toggle frenzy charges', () => {
      const store = useConfigStore();

      store.toggleFrenzyCharges();
      expect(store.frenzyChargesEnabled).toBe(true);
    });

    it('should toggle endurance charges', () => {
      const store = useConfigStore();

      store.toggleEnduranceCharges();
      expect(store.enduranceChargesEnabled).toBe(true);
    });

    it('should set charge count with clamping', () => {
      const store = useConfigStore();

      store.setChargeCount('power', 5);
      expect(store.powerChargeCount).toBe(5);

      store.setChargeCount('frenzy', -1);
      expect(store.frenzyChargeCount).toBe(0);

      store.setChargeCount('endurance', 15);
      expect(store.enduranceChargeCount).toBe(10);
    });
  });

  describe('enemy ailments', () => {
    it('should toggle enemy ailments', () => {
      const store = useConfigStore();

      store.toggleEnemyAilment('chilled');
      expect(store.enemyAilments.chilled).toBe(true);

      store.toggleEnemyAilment('frozen');
      expect(store.enemyAilments.frozen).toBe(true);

      store.toggleEnemyAilment('shocked');
      expect(store.enemyAilments.shocked).toBe(true);

      store.toggleEnemyAilment('ignited');
      expect(store.enemyAilments.ignited).toBe(true);
    });

    it('should toggle ailments off', () => {
      const store = useConfigStore();

      store.toggleEnemyAilment('chilled');
      store.toggleEnemyAilment('chilled');

      expect(store.enemyAilments.chilled).toBe(false);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all config to defaults', () => {
      const store = useConfigStore();

      // Modify various settings
      store.setEnemyLevel(50);
      store.togglePowerCharges();
      store.toggleLowLife();
      store.setChargeCount('power', 8);

      store.resetToDefaults();

      expect(store.enemyLevel).toBe(DEFAULT_BUILD_CONFIG.enemyLevel);
      expect(store.powerChargesEnabled).toBe(false);
      expect(store.isOnLowLife).toBe(false);
      expect(store.isOnFullLife).toBe(true);
      expect(store.powerChargeCount).toBe(3);
    });
  });

  describe('exportConfig', () => {
    it('should export config as deep clone', () => {
      const store = useConfigStore();
      store.setEnemyLevel(75);

      const exported = store.exportConfig();

      // Modify export
      exported.enemyLevel = 99;

      // Original should be unchanged
      expect(store.enemyLevel).toBe(75);
    });
  });

  describe('custom modifiers', () => {
    it('should add custom modifier', () => {
      const store = useConfigStore();

      store.addCustomModifier('+10% increased damage');

      expect(store.customModifiers).toContain('+10% increased damage');
    });

    it('should not duplicate custom modifiers', () => {
      const store = useConfigStore();

      store.addCustomModifier('+10% increased damage');
      store.addCustomModifier('+10% increased damage');

      expect(store.customModifiers.filter((m) => m === '+10% increased damage')).toHaveLength(1);
    });

    it('should remove custom modifier', () => {
      const store = useConfigStore();
      store.addCustomModifier('mod1');
      store.addCustomModifier('mod2');

      store.removeCustomModifier('mod1');

      expect(store.customModifiers).not.toContain('mod1');
      expect(store.customModifiers).toContain('mod2');
    });

    it('should clear all custom modifiers', () => {
      const store = useConfigStore();
      store.addCustomModifier('mod1');
      store.addCustomModifier('mod2');

      store.clearCustomModifiers();

      expect(store.customModifiers).toEqual([]);
    });
  });

  describe('panel and section state', () => {
    it('should toggle panel expansion', () => {
      const store = useConfigStore();

      expect(store.isPanelExpanded).toBe(true);

      store.togglePanel();
      expect(store.isPanelExpanded).toBe(false);

      store.togglePanel();
      expect(store.isPanelExpanded).toBe(true);
    });

    it('should set active section', () => {
      const store = useConfigStore();

      store.setActiveSection('charges');
      expect(store.activeSection).toBe('charges');

      store.setActiveSection('combat');
      expect(store.activeSection).toBe('combat');
    });
  });

  describe('constants export', () => {
    it('should export ENEMY_TYPES', () => {
      expect(ENEMY_TYPES).toHaveLength(4);
      expect(ENEMY_TYPES.map((t) => t.value)).toContain('Normal');
      expect(ENEMY_TYPES.map((t) => t.value)).toContain('Rare');
    });

    it('should export BOSS_PRESETS', () => {
      expect(BOSS_PRESETS).toHaveLength(4);
      expect(BOSS_PRESETS.find((p) => p.value === 'pinnacle')?.level).toBe(85);
    });
  });
});
