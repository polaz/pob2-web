/**
 * Build format migrations
 *
 * Handles migrations for build data format changes.
 * Each migration transforms builds from one version to the next.
 */
import type { Transaction } from 'dexie';
import { BUILD_FORMAT_VERSION } from '../types/db';

/**
 * Migration registry mapping from version to migration function.
 * Each function upgrades builds from that version to the next.
 */
const BUILD_MIGRATIONS: Record<number, (build: Record<string, unknown>) => void> = {
  // Version 0 -> 1: Initial version, add version field
  // No actual transformation needed, just set version to 1
};

/**
 * Migrate a single build to the current format version.
 * Applies all migrations sequentially from the build's version to current.
 *
 * @param build - The build object to migrate (modified in place)
 * @returns The migrated build
 */
export function migrateBuild(build: Record<string, unknown>): Record<string, unknown> {
  // Determine current version (0 if missing)
  let currentVersion = typeof build.version === 'number' ? build.version : 0;

  // Apply migrations sequentially
  while (currentVersion < BUILD_FORMAT_VERSION) {
    const migration = BUILD_MIGRATIONS[currentVersion];
    if (migration) {
      migration(build);
    }
    currentVersion++;
  }

  // Set to current version
  build.version = BUILD_FORMAT_VERSION;
  return build;
}

/**
 * Database migration for v2 -> v3: Add version field to builds.
 * This is called by Dexie during schema upgrade.
 */
export async function migrationAddBuildVersion(tx: Transaction): Promise<void> {
  await tx
    .table('builds')
    .toCollection()
    .modify((build: Record<string, unknown>) => {
      // Set version to 1 for existing builds (they are implicitly version 0)
      build.version = BUILD_FORMAT_VERSION;
    });
}

/**
 * Check if a build needs migration.
 */
export function buildNeedsMigration(version: number | undefined): boolean {
  return (version ?? 0) < BUILD_FORMAT_VERSION;
}
