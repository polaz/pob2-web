/**
 * Unit tests for useSkillData composable.
 *
 * Tests the skill data loading and querying functionality.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

// Mock the database module
vi.mock('src/db', () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Composable API Tests
 *
 * Tests the actual useSkillData composable by mounting a test component.
 */
describe('useSkillData composable API', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Clear cached skill data before each test
    const mod = await import('src/composables/useSkillData');
    mod.resetSkillDataForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to mount component and wait for skill data to load.
   */
  async function mountAndWaitForLoad() {
    const { useSkillData } = await import('src/composables/useSkillData');

    let composableResult: ReturnType<typeof useSkillData> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useSkillData();
        return () => h('div');
      },
    });

    mount(TestComponent);

    // Wait for loading to complete (poll for up to 5 seconds)
    const startTime = Date.now();
    while (composableResult!.loading.value && Date.now() - startTime < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return composableResult!;
  }

  describe('loading and caching', () => {
    it('should load skill data and expose via skillsData ref', async () => {
      const result = await mountAndWaitForLoad();

      expect(result.loading.value).toBe(false);
      expect(result.error.value).toBeNull();
      expect(result.skillsData.value).not.toBeNull();
      // Real skill data has many skills
      expect(result.skillCount.value).toBeGreaterThan(100);
    });

    it('should expose skill counts', async () => {
      const result = await mountAndWaitForLoad();

      expect(result.activeSkillCount.value).toBeGreaterThan(0);
      expect(result.supportSkillCount.value).toBeGreaterThan(0);
      expect(result.statMappingCount.value).toBeGreaterThan(0);
    });
  });

  describe('query methods', () => {
    it('should expose getSkill function that returns correct skill', async () => {
      const result = await mountAndWaitForLoad();

      // Get any skill from the data
      const firstSkillId = result.skillsData.value?.skills.keys().next().value;
      expect(firstSkillId).toBeDefined();

      const skill = result.getSkill(firstSkillId!);
      expect(skill).toBeDefined();
    });

    it('should expose getSkillByName function (case-insensitive)', async () => {
      const result = await mountAndWaitForLoad();

      // Get any skill with a name and search by it
      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithName = skills.find((s) => s.name);
      expect(skillWithName).toBeDefined();

      const foundSkill = result.getSkillByName(skillWithName!.name!.toUpperCase());
      expect(foundSkill).toBeDefined();
      expect(foundSkill?.name).toBe(skillWithName!.name);
    });

    it('should expose getSupportSkills function', async () => {
      const result = await mountAndWaitForLoad();

      const supportSkills = result.getSupportSkills();
      expect(supportSkills.length).toBeGreaterThan(0);
      expect(supportSkills.every((s) => s.support === true)).toBe(true);
    });

    it('should expose getActiveSkills function', async () => {
      const result = await mountAndWaitForLoad();

      const activeSkills = result.getActiveSkills();
      expect(activeSkills.length).toBeGreaterThan(0);
      expect(activeSkills.every((s) => s.support !== true)).toBe(true);
    });

    it('should expose searchSkills function', async () => {
      const result = await mountAndWaitForLoad();

      // Empty query returns empty array
      expect(result.searchSkills('')).toEqual([]);
      expect(result.searchSkills('   ')).toEqual([]);

      // Search for a known skill name part (Ice Nova is a common skill)
      const iceResults = result.searchSkills('ice');
      expect(iceResults.length).toBeGreaterThan(0);
      expect(iceResults.every((s) => s.name?.toLowerCase().includes('ice'))).toBe(true);
    });

    it('should cache search results (LRU)', async () => {
      const result = await mountAndWaitForLoad();

      // First search
      const results1 = result.searchSkills('fire');

      // Second search should return same array reference (cached)
      const results2 = result.searchSkills('fire');
      expect(results2).toBe(results1);
    });
  });

  describe('stat mapping', () => {
    it('should expose getStatMapping function', async () => {
      const result = await mountAndWaitForLoad();

      // Get any stat mapping from the data
      const firstStatName = result.skillsData.value?.statMap.keys().next().value;
      expect(firstStatName).toBeDefined();

      const mapping = result.getStatMapping(firstStatName!);
      expect(mapping).toBeDefined();
    });

    it('should expose resolveStatName function', async () => {
      const result = await mountAndWaitForLoad();

      // Find a mapping with a name property
      const statMap = result.skillsData.value?.statMap;
      let testStatName: string | undefined;
      let expectedName: string | undefined;

      if (statMap) {
        for (const [key, mapping] of statMap.entries()) {
          if (mapping.name) {
            testStatName = key;
            expectedName = mapping.name;
            break;
          }
        }
      }

      if (testStatName && expectedName) {
        const resolved = result.resolveStatName(testStatName);
        expect(resolved).toBe(expectedName);
      }
    });
  });

  describe('damage effectiveness calculations', () => {
    it('should calculate damage effectiveness for skill at level 1', async () => {
      const result = await mountAndWaitForLoad();

      // Find a skill with statSets that has baseEffectiveness
      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithStatSets = skills.find(
        (s) => s.statSets?.[0]?.baseEffectiveness !== undefined
      );

      const statSet0 = skillWithStatSets?.statSets?.[0];
      if (skillWithStatSets && statSet0) {
        const effectiveness = result.getDamageEffectiveness(skillWithStatSets, 1);
        expect(effectiveness).toBeDefined();
        // At level 1, effectiveness equals baseEffectiveness (no level bonus)
        expect(effectiveness).toBe(statSet0.baseEffectiveness);
      }
    });

    it('should scale damage effectiveness with level using correct formula', async () => {
      const result = await mountAndWaitForLoad();

      // Find a skill with incrementalEffectiveness
      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithScaling = skills.find(
        (s) =>
          s.statSets?.[0]?.baseEffectiveness !== undefined &&
          s.statSets?.[0]?.incrementalEffectiveness !== undefined
      );

      const statSet = skillWithScaling?.statSets?.[0];
      if (skillWithScaling && statSet) {
        const baseEff = statSet.baseEffectiveness ?? 0;
        const incEff = statSet.incrementalEffectiveness ?? 0;
        const damageIncEff = statSet.damageIncrementalEffectiveness ?? 0;

        // Test at level 10
        const level = 10;
        const effectiveness = result.getDamageEffectiveness(skillWithScaling, level);

        // Expected: baseEff * (1 + incEff * (level-1)) * (1 + damageIncEff)^(level-1)
        const linearMultiplier = 1 + incEff * (level - 1);
        const exponentialMultiplier = Math.pow(1 + damageIncEff, level - 1);
        const expected = baseEff * linearMultiplier * exponentialMultiplier;

        expect(effectiveness).toBeCloseTo(expected, 10);
      }
    });

    it('should return undefined for skill without statSets', async () => {
      const result = await mountAndWaitForLoad();

      // Create a skill object without statSets
      const skillWithoutStatSets = { name: 'Test Skill' };
      const effectiveness = result.getDamageEffectiveness(skillWithoutStatSets, 1);
      expect(effectiveness).toBeUndefined();
    });

    it('should return undefined for invalid statSetIndex', async () => {
      const result = await mountAndWaitForLoad();

      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithStatSets = skills.find((s) => s.statSets?.length === 1);

      if (skillWithStatSets) {
        // Try to access statSet at index 99 (doesn't exist)
        const effectiveness = result.getDamageEffectiveness(skillWithStatSets, 1, 99);
        expect(effectiveness).toBeUndefined();
      }
    });
  });

  describe('stat values retrieval', () => {
    it('should return stat values for skill at specific level', async () => {
      const result = await mountAndWaitForLoad();

      // Find a skill with statSets that has levels data
      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithLevels = skills.find(
        (s) => s.statSets?.[0]?.levels && Object.keys(s.statSets[0].levels).length > 0
      );

      if (skillWithLevels && skillWithLevels.statSets?.[0]?.levels) {
        const levelKeys = Object.keys(skillWithLevels.statSets[0].levels);
        const firstKey = levelKeys[0];
        if (firstKey) {
          const testLevel = parseInt(firstKey, 10);
          const statValues = result.getStatValues(skillWithLevels, testLevel);
          expect(statValues).toBeInstanceOf(Map);
          expect(statValues!.size).toBeGreaterThan(0);
        }
      }
    });

    it('should include constant stats in stat values', async () => {
      const result = await mountAndWaitForLoad();

      // Find a skill with constantStats
      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithConstants = skills.find(
        (s) => s.statSets?.[0]?.constantStats && s.statSets[0].constantStats.length > 0
      );

      if (skillWithConstants && skillWithConstants.statSets?.[0]?.constantStats) {
        const statValues = result.getStatValues(skillWithConstants, 1);
        expect(statValues).toBeDefined();

        // Verify constant stats are included
        const constantStats = skillWithConstants.statSets[0].constantStats;
        for (const { stat, value } of constantStats) {
          expect(statValues!.get(stat)).toBe(value);
        }
      }
    });

    it('should return undefined for skill without statSets', async () => {
      const result = await mountAndWaitForLoad();

      const skillWithoutStatSets = { name: 'Test Skill' };
      const statValues = result.getStatValues(skillWithoutStatSets, 1);
      expect(statValues).toBeUndefined();
    });

    it('should return undefined for invalid level', async () => {
      const result = await mountAndWaitForLoad();

      // Find a skill with statSets that has levels data
      const skills = Array.from(result.skillsData.value?.skills.values() ?? []);
      const skillWithLevels = skills.find(
        (s) => s.statSets?.[0]?.levels && Object.keys(s.statSets[0].levels).length > 0
      );

      if (skillWithLevels) {
        // Test with invalid levels
        expect(result.getStatValues(skillWithLevels, 0)).toBeUndefined();
        expect(result.getStatValues(skillWithLevels, -1)).toBeUndefined();
        expect(result.getStatValues(skillWithLevels, 999)).toBeUndefined();
      }
    });
  });

  describe('error handling', () => {
    it('should return empty results when skill data not loaded', async () => {
      const { useSkillData, resetSkillDataForTesting } = await import(
        'src/composables/useSkillData'
      );
      resetSkillDataForTesting();

      let composableResult: ReturnType<typeof useSkillData> | null = null;

      const TestComponent = defineComponent({
        setup() {
          composableResult = useSkillData();
          return () => h('div');
        },
      });

      mount(TestComponent);
      // Don't wait - test immediate state before async load completes

      // Before data loads, functions should return safe defaults
      expect(composableResult!.loading.value).toBe(true);
      expect(composableResult!.getSkill('test')).toBeUndefined();
      expect(composableResult!.getSkillByName('test')).toBeUndefined();
      expect(composableResult!.getSupportSkills()).toEqual([]);
      expect(composableResult!.getActiveSkills()).toEqual([]);
      expect(composableResult!.searchSkills('test')).toEqual([]);
      expect(composableResult!.getStatMapping('test')).toBeUndefined();
      expect(composableResult!.resolveStatName('test')).toBeUndefined();
    });
  });

  describe('resetSkillDataForTesting', () => {
    it('should throw error when called outside test environment', async () => {
      const originalEnv = process.env.NODE_ENV;

      try {
        // Temporarily set to production
        process.env.NODE_ENV = 'production';

        // Need to re-import to get fresh module with new env
        vi.resetModules();
        const mod = await import('src/composables/useSkillData');

        expect(() => mod.resetSkillDataForTesting()).toThrow(
          'resetSkillDataForTesting() can only be called in test environment'
        );
      } finally {
        // Restore original env
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should reset cache state when called in test environment', async () => {
      const { useSkillData, resetSkillDataForTesting } = await import(
        'src/composables/useSkillData'
      );

      // Load data first
      const result1 = await mountAndWaitForLoad();
      expect(result1.skillsData.value).not.toBeNull();

      // Reset cache
      resetSkillDataForTesting();

      // Create new instance - should start loading again
      let composableResult: ReturnType<typeof useSkillData> | null = null;

      const TestComponent = defineComponent({
        setup() {
          composableResult = useSkillData();
          return () => h('div');
        },
      });

      mount(TestComponent);

      // Should be in loading state after reset
      expect(composableResult!.loading.value).toBe(true);
    });
  });
});
