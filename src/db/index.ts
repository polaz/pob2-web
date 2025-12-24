/**
 * Dexie.js database for offline-first storage
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  StoredBuild,
  GameDataCacheEntry,
  UserPreferences,
} from '../types/db';
import { DEFAULT_USER_PREFERENCES } from '../types/db';
import { applyMigrations } from './migrations';

/** PoB2 Database class extending Dexie */
export class PoB2Database extends Dexie {
  /** Builds table */
  builds!: EntityTable<StoredBuild, 'id'>;
  /** Game data cache table */
  gameDataCache!: EntityTable<GameDataCacheEntry, 'key'>;
  /** User preferences table */
  userPreferences!: EntityTable<UserPreferences, 'id'>;

  constructor() {
    super('pob2-web');

    // Version 1: Initial schema
    this.version(1).stores({
      builds: '++id, name, className, ascendancy, updatedAt',
      gameDataCache: 'key, expiresAt',
      userPreferences: 'id',
    });

    // Apply migrations for data transformations
    applyMigrations(this);
  }
}

/** Singleton database instance */
export const db = new PoB2Database();

// ============================================================================
// Builds CRUD operations
// ============================================================================

/** Create a new build */
export async function createBuild(
  build: Omit<StoredBuild, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const now = new Date();
  const id = await db.builds.add({
    ...build,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

/** Get a build by ID */
export async function getBuild(id: number): Promise<StoredBuild | undefined> {
  return db.builds.get(id);
}

/** Get all builds */
export async function getAllBuilds(): Promise<StoredBuild[]> {
  return db.builds.orderBy('updatedAt').reverse().toArray();
}

/** Update a build */
export async function updateBuild(
  id: number,
  changes: Partial<Omit<StoredBuild, 'id' | 'createdAt'>>
): Promise<number> {
  return db.builds.update(id, {
    ...changes,
    updatedAt: new Date(),
  });
}

/** Delete a build */
export async function deleteBuild(id: number): Promise<void> {
  await db.builds.delete(id);
}

/** Search builds by name */
export async function searchBuilds(query: string): Promise<StoredBuild[]> {
  const lowerQuery = query.toLowerCase();
  return db.builds
    .filter((build) => build.name.toLowerCase().includes(lowerQuery))
    .toArray();
}

// ============================================================================
// Game Data Cache operations
// ============================================================================

/** Get cached game data */
export async function getCachedData(
  key: string
): Promise<GameDataCacheEntry | undefined> {
  const entry = await db.gameDataCache.get(key);
  if (entry && entry.expiresAt > new Date()) {
    return entry;
  }
  // Expired or not found
  if (entry) {
    await db.gameDataCache.delete(key);
  }
  return undefined;
}

/** Set cached game data */
export async function setCachedData(
  key: string,
  data: string,
  version: string,
  ttlSeconds: number = 86400 // 24 hours default
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await db.gameDataCache.put({
    key,
    data,
    version,
    expiresAt,
    updatedAt: now,
  });
}

/** Clear expired cache entries */
export async function clearExpiredCache(): Promise<number> {
  const now = new Date();
  const expired = await db.gameDataCache
    .filter((entry) => entry.expiresAt <= now)
    .toArray();
  await db.gameDataCache.bulkDelete(expired.map((e) => e.key));
  return expired.length;
}

/** Clear all cache */
export async function clearAllCache(): Promise<void> {
  await db.gameDataCache.clear();
}

// ============================================================================
// User Preferences operations
// ============================================================================

/** Get user preferences (creates defaults if not exist) */
export async function getUserPreferences(): Promise<UserPreferences> {
  let prefs = await db.userPreferences.get('user');
  if (!prefs) {
    await db.userPreferences.add(DEFAULT_USER_PREFERENCES);
    prefs = DEFAULT_USER_PREFERENCES;
  }
  return prefs;
}

/** Update user preferences */
export async function updateUserPreferences(
  changes: Partial<Omit<UserPreferences, 'id'>>
): Promise<void> {
  const current = await getUserPreferences();
  await db.userPreferences.put({
    ...current,
    ...changes,
    id: 'user',
  });
}

/** Reset user preferences to defaults */
export async function resetUserPreferences(): Promise<void> {
  await db.userPreferences.put(DEFAULT_USER_PREFERENCES);
}

// ============================================================================
// Database utilities
// ============================================================================

/** Clear all data from database */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', [db.builds, db.gameDataCache, db.userPreferences], async () => {
    await db.builds.clear();
    await db.gameDataCache.clear();
    await db.userPreferences.clear();
  });
}

/** Export database to JSON */
export async function exportDatabase(): Promise<string> {
  const [builds, cache, prefs] = await Promise.all([
    db.builds.toArray(),
    db.gameDataCache.toArray(),
    db.userPreferences.toArray(),
  ]);
  return JSON.stringify({ builds, cache, prefs }, null, 2);
}

/** Import database from JSON */
export async function importDatabase(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    builds?: StoredBuild[];
    cache?: GameDataCacheEntry[];
    prefs?: UserPreferences[];
  };

  await db.transaction('rw', [db.builds, db.gameDataCache, db.userPreferences], async () => {
    if (data.builds) {
      await db.builds.clear();
      await db.builds.bulkAdd(data.builds);
    }
    if (data.cache) {
      await db.gameDataCache.clear();
      await db.gameDataCache.bulkAdd(data.cache);
    }
    if (data.prefs) {
      await db.userPreferences.clear();
      await db.userPreferences.bulkAdd(data.prefs);
    }
  });
}
