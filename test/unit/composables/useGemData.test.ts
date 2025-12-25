/**
 * Unit tests for useGemData composable.
 *
 * Tests the gem data loading and querying functionality.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Gem, GemsData, GemType } from 'src/types/gems';

// Mock the database module
vi.mock('src/db', () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Composable API Tests
 *
 * Tests the actual useGemData composable by mounting a test component.
 */
describe('useGemData composable API', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Clear cached gem data before each test
    const mod = await import('src/composables/useGemData');
    mod.resetGemDataForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to mount component and wait for gem data to load.
   */
  async function mountAndWaitForLoad() {
    const { useGemData } = await import('src/composables/useGemData');

    let composableResult: ReturnType<typeof useGemData> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useGemData();
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

  it('should load gem data and expose via gemsData ref', async () => {
    const result = await mountAndWaitForLoad();

    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBeNull();
    expect(result.gemsData.value).not.toBeNull();
    // Real gem data has many gems
    expect(result.gemCount.value).toBeGreaterThan(100);
  });

  it('should expose gem counts', async () => {
    const result = await mountAndWaitForLoad();

    expect(result.skillGemCount.value).toBeGreaterThan(0);
    expect(result.supportGemCount.value).toBeGreaterThan(0);
    // Total should equal skill + support
    expect(result.gemCount.value).toBe(
      result.skillGemCount.value + result.supportGemCount.value
    );
  });

  it('should expose getGem function that returns correct gem', async () => {
    const result = await mountAndWaitForLoad();

    // Get any gem from the data
    const firstGemId = result.gemsData.value?.gems.keys().next().value;
    expect(firstGemId).toBeDefined();

    const gem = result.getGem(firstGemId!);
    expect(gem).toBeDefined();
    expect(gem?.id).toBe(firstGemId);
  });

  it('should expose getGemByName function (case-insensitive)', async () => {
    const result = await mountAndWaitForLoad();

    // Get any gem and search by its name
    const firstGem = result.gemsData.value?.gems.values().next().value;
    expect(firstGem).toBeDefined();

    const foundGem = result.getGemByName(firstGem!.name.toUpperCase());
    expect(foundGem).toBeDefined();
    expect(foundGem?.id).toBe(firstGem!.id);
  });

  it('should expose getGemsByType function', async () => {
    const result = await mountAndWaitForLoad();

    // Get spell gems
    const spellGems = result.getGemsByType('Spell');
    expect(spellGems.length).toBeGreaterThan(0);
    expect(spellGems.every((g) => g.type === 'Spell')).toBe(true);

    // Get attack gems
    const attackGems = result.getGemsByType('Attack');
    expect(attackGems.length).toBeGreaterThan(0);
    expect(attackGems.every((g) => g.type === 'Attack')).toBe(true);

    // Get support gems
    const supportGems = result.getGemsByType('Support');
    expect(supportGems.length).toBeGreaterThan(0);
    expect(supportGems.every((g) => g.type === 'Support')).toBe(true);
  });

  it('should expose getSkillGems function', async () => {
    const result = await mountAndWaitForLoad();

    const skillGems = result.getSkillGems();
    expect(skillGems.length).toBeGreaterThan(0);
    expect(skillGems.every((g) => !g.isSupport)).toBe(true);
  });

  it('should expose getSupportGems function', async () => {
    const result = await mountAndWaitForLoad();

    const supportGems = result.getSupportGems();
    expect(supportGems.length).toBeGreaterThan(0);
    expect(supportGems.every((g) => g.isSupport)).toBe(true);
  });

  it('should expose getGemsByTag function', async () => {
    const result = await mountAndWaitForLoad();

    // Get fire gems
    const fireGems = result.getGemsByTag('fire');
    expect(fireGems.length).toBeGreaterThan(0);
    expect(fireGems.every((g) => g.tags.fire === true)).toBe(true);

    // Get projectile gems
    const projectileGems = result.getGemsByTag('projectile');
    expect(projectileGems.length).toBeGreaterThan(0);
    expect(projectileGems.every((g) => g.tags.projectile === true)).toBe(true);
  });

  it('should expose searchGems function', async () => {
    const result = await mountAndWaitForLoad();

    // Empty query returns empty array
    expect(result.searchGems('')).toEqual([]);
    expect(result.searchGems('   ')).toEqual([]);

    // Search for a known gem name part
    const fireResults = result.searchGems('fire');
    expect(fireResults.length).toBeGreaterThan(0);
    expect(
      fireResults.every((g) => g.name.toLowerCase().includes('fire'))
    ).toBe(true);
  });

  it('should cache search results (LRU)', async () => {
    const result = await mountAndWaitForLoad();

    // First search
    const results1 = result.searchGems('fire');

    // Second search should return same array reference (cached)
    const results2 = result.searchGems('fire');
    expect(results2).toBe(results1);
  });

  it('should expose getGemsByAttribute function', async () => {
    const result = await mountAndWaitForLoad();

    // Get strength gems
    const strGems = result.getGemsByAttribute('str');
    expect(strGems.length).toBeGreaterThan(0);
    expect(strGems.every((g) => g.requirements.str > 0)).toBe(true);

    // Get dexterity gems
    const dexGems = result.getGemsByAttribute('dex');
    expect(dexGems.length).toBeGreaterThan(0);
    expect(dexGems.every((g) => g.requirements.dex > 0)).toBe(true);

    // Get intelligence gems
    const intGems = result.getGemsByAttribute('int');
    expect(intGems.length).toBeGreaterThan(0);
    expect(intGems.every((g) => g.requirements.int > 0)).toBe(true);
  });

  it('should return empty results when gem data not loaded', async () => {
    const { useGemData, resetGemDataForTesting } = await import(
      'src/composables/useGemData'
    );
    resetGemDataForTesting();

    let composableResult: ReturnType<typeof useGemData> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useGemData();
        return () => h('div');
      },
    });

    mount(TestComponent);
    // Don't wait - test immediate state before async load completes

    // Before data loads, functions should return safe defaults
    expect(composableResult!.loading.value).toBe(true);
    expect(composableResult!.getGem('test')).toBeUndefined();
    expect(composableResult!.getGemByName('test')).toBeUndefined();
    expect(composableResult!.getGemsByType('Spell')).toEqual([]);
    expect(composableResult!.getSkillGems()).toEqual([]);
    expect(composableResult!.getSupportGems()).toEqual([]);
    expect(composableResult!.getGemsByTag('fire')).toEqual([]);
    expect(composableResult!.searchGems('test')).toEqual([]);
    expect(composableResult!.getGemsByAttribute('str')).toEqual([]);
  });
});
