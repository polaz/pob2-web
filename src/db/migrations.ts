/**
 * Database migrations for schema updates
 *
 * When adding new migrations:
 * 1. Increment version number in db.version() call in index.ts
 * 2. Add migration function here
 * 3. Register migration in applyMigrations()
 *
 * Dexie handles schema changes automatically, but data transformations
 * need to be handled manually in upgrade functions.
 */
import type { PoB2Database } from './index';

/**
 * Apply all migrations to the database
 * This is called from the PoB2Database constructor
 */
export function applyMigrations(db: PoB2Database): void {
  // Future migrations will be registered here
  // Example:
  // db.version(2).stores({...}).upgrade(migrationV2);
  // db.version(3).stores({...}).upgrade(migrationV3);

  // Keep reference to avoid unused variable warning
  void db;
}

/**
 * Example migration template for future use
 *
 * When you need to add a migration:
 *
 * 1. In index.ts, add new version:
 *    this.version(2).stores({
 *      builds: '++id, name, className, ascendancy, updatedAt, [NEW_INDEX]',
 *      // ... other tables
 *    }).upgrade(tx => migrationV1ToV2(tx));
 *
 * 2. Implement migration function:
 *    async function migrationV1ToV2(tx: Transaction): Promise<void> {
 *      // Transform data as needed
 *      await tx.table('builds').toCollection().modify(build => {
 *        build.newField = 'default value';
 *      });
 *    }
 */

// ============================================================================
// Migration utilities
// ============================================================================

/**
 * Safe date parsing for migrations
 * Handles both Date objects and ISO strings
 */
export function parseDate(value: Date | string | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Ensure array field exists and is an array
 */
export function ensureArray<T>(value: T[] | undefined): T[] {
  if (Array.isArray(value)) return value;
  return [];
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
