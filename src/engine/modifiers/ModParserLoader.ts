/**
 * ModParserLoader - Singleton Lazy Loader for ModParser
 *
 * Loads all required data files for ModParser and initializes a single shared instance.
 * Uses lazy initialization - the parser is not created until first access.
 *
 * ## Usage
 *
 * ```typescript
 * // Get the shared parser instance (async, loads data on first call)
 * const parser = await getModParser();
 *
 * // Or preload during app initialization
 * await preloadModParser();
 * const parser = await getModParser(); // Returns immediately (cached)
 * ```
 *
 * ## Data Files Loaded
 *
 * - `src/data/mods/patterns/form-patterns.json` - Regex patterns for parsing
 * - `src/data/mods/patterns/stat-mappings.json` - Text to stat name mappings
 * - `src/data/mods/patterns/flag-mappings.json` - Text to flag mappings
 * - `src/data/mods/patterns/condition-mappings.json` - Text to condition mappings
 * - `src/data/mods/mod-cache.json` - Pre-parsed mod cache
 * - `src/data/mods/mod-cache-overrides.json` - Manual corrections
 */

import { ModParser } from './ModParser';
import type { ModParserData, FormPattern } from './types';
import type { ModCondition, ModDefinition } from 'src/types/mods';
import { mergeWithOverrides } from 'src/utils/dataOverlay';

// ============================================================================
// Types for JSON imports
// ============================================================================

interface FormPatternsJson {
  version: string;
  patterns: FormPattern[];
}

interface StatMappingsJson {
  version: string;
  mappings: Record<string, string>;
}

interface FlagMappingsJson {
  version: string;
  modFlags: Record<string, string | string[]>;
  keywordFlags: Record<string, string | string[]>;
}

interface ConditionMappingsJson {
  version: string;
  conditions: Record<string, unknown>;
}

interface ModCacheJson {
  version: string;
  mods: Record<string, unknown>;
}

// ============================================================================
// Singleton State
// ============================================================================

/** Cached ModParser instance */
let cachedParser: ModParser | null = null;

/** Promise for in-progress loading (prevents duplicate loads) */
let loadingPromise: Promise<ModParser> | null = null;

/** Cached error from last failed load attempt (prevents infinite retries) */
let cachedError: Error | null = null;

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load all data files required for ModParser.
 *
 * @returns Flattened ModParserData ready for parser construction
 */
async function loadParserData(): Promise<ModParserData> {
  try {
    // Load all data files in parallel
    const [
      formPatternsRaw,
      statMappingsRaw,
      flagMappingsRaw,
      conditionMappingsRaw,
      modCacheRaw,
      modCacheOverridesRaw,
    ] = await Promise.all([
      import('src/data/mods/patterns/form-patterns.json') as Promise<{
        default: FormPatternsJson;
      }>,
      import('src/data/mods/patterns/stat-mappings.json') as Promise<{
        default: StatMappingsJson;
      }>,
      import('src/data/mods/patterns/flag-mappings.json') as Promise<{
        default: FlagMappingsJson;
      }>,
      import('src/data/mods/patterns/condition-mappings.json') as Promise<{
        default: ConditionMappingsJson;
      }>,
      import('src/data/mods/mod-cache.json') as Promise<{ default: ModCacheJson }>,
      // Overrides file is optional - gracefully handle missing file
      import('src/data/mods/mod-cache-overrides.json')
        .then((m) => m.default as { mods?: Record<string, unknown> })
        .catch(() => ({ mods: {} })),
    ]);

    // Extract default exports (ES module imports)
    const formPatterns = formPatternsRaw.default;
    const statMappings = statMappingsRaw.default;
    const flagMappings = flagMappingsRaw.default;
    const conditionMappings = conditionMappingsRaw.default;
    const modCache = modCacheRaw.default;
    const modCacheOverrides = modCacheOverridesRaw;

    // Merge mod cache with overrides
    const mergedMods = mergeWithOverrides(
      modCache.mods,
      modCacheOverrides.mods ?? {}
    );

    // Build flattened ModParserData
    const parserData: ModParserData = {
      patterns: formPatterns.patterns,
      statMappings: statMappings.mappings,
      flagMappings: flagMappings.modFlags,
      keywordMappings: flagMappings.keywordFlags,
      conditionMappings: conditionMappings.conditions as Record<string, ModCondition>,
      modCache: mergedMods as Record<string, ModDefinition>,
    };

    return parserData;
  } catch (error: unknown) {
    // Log detailed error for debugging - these files are essential for parser
    console.error('[ModParserLoader] Failed to load data files:', error);
    const errorDetail = error instanceof Error ? error.message : String(error);
    const requiredFiles = [
      'src/data/mods/patterns/form-patterns.json',
      'src/data/mods/patterns/stat-mappings.json',
      'src/data/mods/patterns/flag-mappings.json',
      'src/data/mods/patterns/condition-mappings.json',
      'src/data/mods/mod-cache.json',
    ];
    throw new Error(
      `Failed to load ModParser data files: ${errorDetail}. ` +
        `Required files: ${requiredFiles.join(', ')}`
    );
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the shared ModParser instance.
 *
 * Lazily loads all required data files on first call.
 * Subsequent calls return the cached instance immediately.
 *
 * @returns Promise resolving to the shared ModParser instance
 */
export async function getModParser(): Promise<ModParser> {
  // Return cached instance if available
  if (cachedParser) {
    return cachedParser;
  }

  // If a previous load failed, rethrow the cached error (prevents infinite retries)
  if (cachedError) {
    throw cachedError;
  }

  // If loading is in progress, wait for it
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    try {
      const data = await loadParserData();
      cachedParser = new ModParser(data);
      return cachedParser;
    } catch (error) {
      // Cache the error to prevent infinite retry attempts
      cachedError = error instanceof Error ? error : new Error(String(error));
      throw cachedError;
    }
  })();

  // Clear loading promise when done
  void loadingPromise.finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

/**
 * Preload the ModParser without returning it.
 *
 * Call this during app initialization to warm the cache.
 * The parser will be ready immediately when needed later.
 */
export async function preloadModParser(): Promise<void> {
  await getModParser();
}

/**
 * Check if the ModParser is already loaded.
 *
 * @returns True if the parser is cached and ready
 */
export function isModParserLoaded(): boolean {
  return cachedParser !== null;
}

/**
 * Clear the cached ModParser instance and any cached errors.
 *
 * Primarily for testing - forces data to be reloaded on next access.
 * Also clears cached errors to allow retry after fixing the issue.
 */
export function clearModParserCache(): void {
  cachedParser = null;
  loadingPromise = null;
  cachedError = null;
}

/**
 * Get parser statistics.
 *
 * Returns actual stats if parser is loaded, or default zero values if not.
 * This avoids forcing null checks at call sites (Null Object pattern).
 *
 * @returns Parser stats (zeros if parser not yet loaded)
 */
export function getModParserStats(): {
  patterns: number;
  statMappings: number;
  modCache: number;
} {
  if (!cachedParser) {
    return {
      patterns: 0,
      statMappings: 0,
      modCache: 0,
    };
  }
  return cachedParser.getStats();
}
