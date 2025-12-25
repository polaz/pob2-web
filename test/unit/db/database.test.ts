/**
 * Unit tests for Dexie database CRUD operations
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  db,
  createBuild,
  getBuild,
  getAllBuilds,
  updateBuild,
  deleteBuild,
  searchBuilds,
  getCachedData,
  setCachedData,
  clearExpiredCache,
  clearAllCache,
  getUserPreferences,
  updateUserPreferences,
  resetUserPreferences,
  clearDatabase,
  exportDatabase,
  importDatabase,
} from '../../../src/db/index';
import { DEFAULT_USER_PREFERENCES, BUILD_FORMAT_VERSION, type StoredBuild } from '../../../src/types/db';

describe('PoB2Database', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('Builds CRUD', () => {
    const testBuild = {
      version: BUILD_FORMAT_VERSION,
      name: 'Test Warrior Build',
      className: 'Warrior',
      ascendancy: 'Titan',
      level: 90,
      passiveNodes: [1, 2, 3, 4, 5],
      items: '{}',
      skills: '[]',
      notes: 'Test notes',
    };

    it('should create a build and return ID', async () => {
      const id = await createBuild(testBuild);
      expect(id).toBeTypeOf('number');
      expect(id).toBeGreaterThan(0);
    });

    it('should get a build by ID', async () => {
      const id = await createBuild(testBuild);
      const build = await getBuild(id);

      expect(build).toBeDefined();
      expect(build?.name).toBe(testBuild.name);
      expect(build?.className).toBe(testBuild.className);
      expect(build?.level).toBe(testBuild.level);
      expect(build?.createdAt).toBeInstanceOf(Date);
      expect(build?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return undefined for non-existent build', async () => {
      const build = await getBuild(99999);
      expect(build).toBeUndefined();
    });

    it('should get all builds sorted by updatedAt desc', async () => {
      await createBuild({ ...testBuild, name: 'Build 1' });
      await new Promise((r) => setTimeout(r, 10)); // Small delay
      await createBuild({ ...testBuild, name: 'Build 2' });

      const builds = await getAllBuilds();
      expect(builds).toHaveLength(2);
      expect(builds[0]?.name).toBe('Build 2'); // Most recent first
      expect(builds[1]?.name).toBe('Build 1');
    });

    it('should update a build', async () => {
      const id = await createBuild(testBuild);
      const originalBuild = await getBuild(id);

      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp
      await updateBuild(id, { name: 'Updated Name', level: 100 });

      const updated = await getBuild(id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.level).toBe(100);
      expect(updated?.className).toBe(testBuild.className); // Unchanged
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        originalBuild!.updatedAt.getTime()
      );
    });

    it('should delete a build', async () => {
      const id = await createBuild(testBuild);
      await deleteBuild(id);

      const build = await getBuild(id);
      expect(build).toBeUndefined();
    });

    it('should search builds by name', async () => {
      await createBuild({ ...testBuild, name: 'Fire Warrior' });
      await createBuild({ ...testBuild, name: 'Ice Mage' });
      await createBuild({ ...testBuild, name: 'Lightning Warrior' });

      const results = await searchBuilds('warrior');
      expect(results).toHaveLength(2);
      expect(results.map((b: StoredBuild) => b.name)).toContain('Fire Warrior');
      expect(results.map((b: StoredBuild) => b.name)).toContain('Lightning Warrior');
    });
  });

  describe('Game Data Cache', () => {
    it('should set and get cached data', async () => {
      await setCachedData('test-key', '{"data": "value"}', '1.0', 3600);

      const cached = await getCachedData('test-key');
      expect(cached).toBeDefined();
      expect(cached?.data).toBe('{"data": "value"}');
      expect(cached?.version).toBe('1.0');
    });

    it('should return undefined for expired cache', async () => {
      // Set with 0 TTL (already expired)
      await setCachedData('expired-key', 'data', '1.0', 0);

      // Wait a bit to ensure expiration
      await new Promise((r) => setTimeout(r, 10));

      const cached = await getCachedData('expired-key');
      expect(cached).toBeUndefined();
    });

    it('should clear expired cache entries', async () => {
      await setCachedData('valid-key', 'data1', '1.0', 3600);
      await setCachedData('expired-key', 'data2', '1.0', 0);

      await new Promise((r) => setTimeout(r, 10));

      const cleared = await clearExpiredCache();
      expect(cleared).toBe(1);

      const valid = await getCachedData('valid-key');
      expect(valid).toBeDefined();
    });

    it('should clear all cache', async () => {
      await setCachedData('key1', 'data1', '1.0', 3600);
      await setCachedData('key2', 'data2', '1.0', 3600);

      await clearAllCache();

      const cache1 = await getCachedData('key1');
      const cache2 = await getCachedData('key2');
      expect(cache1).toBeUndefined();
      expect(cache2).toBeUndefined();
    });
  });

  describe('User Preferences', () => {
    it('should return default preferences on first access', async () => {
      const prefs = await getUserPreferences();

      expect(prefs).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it('should update user preferences', async () => {
      await updateUserPreferences({
        theme: 'light',
        language: 'ru-RU',
        treeZoom: 1.5,
      });

      const prefs = await getUserPreferences();
      expect(prefs.theme).toBe('light');
      expect(prefs.language).toBe('ru-RU');
      expect(prefs.treeZoom).toBe(1.5);
      expect(prefs.showTooltips).toBe(true); // Unchanged default
    });

    it('should reset preferences to defaults', async () => {
      await updateUserPreferences({ theme: 'light' });
      await resetUserPreferences();

      const prefs = await getUserPreferences();
      expect(prefs).toEqual(DEFAULT_USER_PREFERENCES);
    });
  });

  describe('Database Utilities', () => {
    it('should export and import database', async () => {
      // Create test data
      await createBuild({
        version: BUILD_FORMAT_VERSION,
        name: 'Export Test',
        className: 'Witch',
        level: 80,
        passiveNodes: [1, 2, 3],
        items: '{}',
        skills: '[]',
      });
      await setCachedData('test-cache', 'cached-data', '1.0', 3600);
      await updateUserPreferences({ theme: 'light' });

      // Export
      const exported = await exportDatabase();
      expect(exported).toBeTypeOf('string');

      const parsed = JSON.parse(exported);
      expect(parsed.builds).toHaveLength(1);
      expect(parsed.cache).toHaveLength(1);
      expect(parsed.prefs).toHaveLength(1);

      // Clear and import
      await clearDatabase();
      await importDatabase(exported);

      // Verify imported data
      const builds = await getAllBuilds();
      expect(builds).toHaveLength(1);
      expect(builds[0]?.name).toBe('Export Test');
    });

    it('should clear entire database', async () => {
      await createBuild({
        version: BUILD_FORMAT_VERSION,
        name: 'Test',
        className: 'Warrior',
        level: 1,
        passiveNodes: [],
        items: '{}',
        skills: '[]',
      });
      await setCachedData('key', 'data', '1.0', 3600);
      await updateUserPreferences({ theme: 'light' });

      await clearDatabase();

      const builds = await getAllBuilds();
      const cache = await db.gameDataCache.toArray();
      const prefs = await db.userPreferences.toArray();

      expect(builds).toHaveLength(0);
      expect(cache).toHaveLength(0);
      expect(prefs).toHaveLength(0);
    });
  });
});
