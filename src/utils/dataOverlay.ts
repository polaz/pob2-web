/**
 * Data Overlay System
 *
 * Provides a robust pattern for merging auto-generated external data with
 * manual overrides/corrections. This ensures that:
 *
 * 1. Auto-generated data (from scrapers) remains untouched and reproducible
 * 2. Manual corrections persist across data updates
 * 3. i18n translations can be layered on top without modifying source data
 *
 * ## Architecture
 *
 * ```
 * src/data/<type>/
 * ├── <type>-cache.json           # Auto-generated (scraper output)
 * ├── <type>-overrides.json       # Manual corrections (human-maintained)
 * └── <type>-i18n/                # Future: translations
 *     ├── en.json
 *     └── zh.json
 * ```
 *
 * ## Merge Rules
 *
 * - Objects: Deep merge, overrides win on conflicts
 * - Arrays: Override replaces entire array
 * - `_deleted: true`: Remove entry from final result
 * - `_manual: true`: Flag for scrapers to skip this entry
 * - `_comment: "..."`: Documentation, stripped at runtime
 *
 * ## Example Override File
 *
 * ```json
 * {
 *   "_comment": "Manual corrections for mod-cache.json",
 *   "mods": {
 *     "some_mod_id": {
 *       "_comment": "Fix display text formatting",
 *       "displayText": "Corrected text without trailing space"
 *     },
 *     "deprecated_mod": {
 *       "_deleted": true
 *     },
 *     "custom_mod": {
 *       "_manual": true,
 *       "text": "Fully manual entry"
 *     }
 *   }
 * }
 * ```
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Special keys used to control overlay behavior.
 * These keys are processed during merge and stripped from output.
 */
export const OVERLAY_KEYS = {
  /** Mark entry as deleted - will be removed from final result */
  DELETED: '_deleted',

  /** Mark entry as manually maintained - scrapers should skip */
  MANUAL: '_manual',

  /** Documentation comment - stripped at runtime */
  COMMENT: '_comment',
} as const;

/** Set of all overlay control keys for efficient lookup */
const OVERLAY_KEY_SET: Set<string> = new Set(Object.values(OVERLAY_KEYS));

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * An object that may contain overlay control keys.
 */
export interface OverlayEntry {
  [OVERLAY_KEYS.DELETED]?: boolean;
  [OVERLAY_KEYS.MANUAL]?: boolean;
  [OVERLAY_KEYS.COMMENT]?: string;
  [key: string]: unknown;
}

/**
 * Result of applying overlays, with metadata about what changed.
 */
export interface OverlayResult<T> {
  /** The merged data */
  data: T;

  /** Statistics about the merge operation */
  stats: {
    /** Number of entries that were overridden */
    overridden: number;
    /** Number of entries that were deleted */
    deleted: number;
    /** Number of entries marked as manual */
    manual: number;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a plain object (not array, null, Date, etc.)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Check if an entry has the deletion marker.
 */
export function isDeletedEntry(entry: unknown): boolean {
  return isPlainObject(entry) && entry[OVERLAY_KEYS.DELETED] === true;
}

/**
 * Check if an entry has the manual flag set.
 * Used by scrapers to skip manually maintained entries.
 */
export function isManualEntry(entry: unknown): boolean {
  return isPlainObject(entry) && entry[OVERLAY_KEYS.MANUAL] === true;
}

// ============================================================================
// Core Merge Functions
// ============================================================================

/**
 * Remove overlay control keys from an object.
 * Returns a new object without _deleted, _manual, _comment keys.
 */
export function stripOverlayKeys<T extends Record<string, unknown>>(
  obj: T
): Omit<T, '_deleted' | '_manual' | '_comment'> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!OVERLAY_KEY_SET.has(key)) {
      result[key] = value;
    }
  }

  return result as Omit<T, '_deleted' | '_manual' | '_comment'>;
}

/**
 * Strip only transient overlay keys (_deleted, _comment) but preserve _manual.
 * Used when adding new entries that should retain their manual flag.
 */
function stripTransientKeys<T extends Record<string, unknown>>(
  obj: T
): Omit<T, '_deleted' | '_comment'> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Keep _manual, strip _deleted and _comment
    if (key !== OVERLAY_KEYS.DELETED && key !== OVERLAY_KEYS.COMMENT) {
      result[key] = value;
    }
  }

  return result as Omit<T, '_deleted' | '_comment'>;
}

/**
 * Deep merge base data with overrides.
 *
 * @param base - The base data (typically from auto-generated cache)
 * @param overrides - The override data (typically from manual corrections)
 * @returns Merged data with overrides applied
 *
 * ## Merge Rules
 *
 * 1. **Primitives**: Override value replaces base value
 * 2. **Objects**: Recursively merge, override keys win
 * 3. **Arrays**: Override replaces entire array (no element-level merge)
 * 4. **_deleted**: Entry is removed from result
 * 5. **_manual**: Preserved in result for scraper reference
 * 6. **_comment**: Stripped from result
 */
export function deepMerge<T>(base: T, overrides: unknown): T {
  // Handle null/undefined overrides - return base as-is
  if (overrides === null || overrides === undefined) {
    return base;
  }

  // Handle null/undefined base - return override (stripped if object)
  if (base === null || base === undefined) {
    if (isPlainObject(overrides)) {
      // Preserve _manual flag, strip only transient keys
      return stripTransientKeys(overrides) as T;
    }
    return overrides as T;
  }

  // If override is marked as deleted, this will be handled by caller
  // For direct calls, we return base (deletion is context-dependent)
  if (isDeletedEntry(overrides)) {
    return base;
  }

  // Arrays: override replaces entirely
  if (Array.isArray(overrides)) {
    return overrides as T;
  }

  // Non-object overrides replace base directly
  if (!isPlainObject(overrides)) {
    return overrides as T;
  }

  // Base is not an object but override is - use override with transient keys stripped
  if (!isPlainObject(base)) {
    return stripTransientKeys(overrides) as T;
  }

  // Both are objects - deep merge
  const result: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    // Skip comment keys entirely
    if (key === OVERLAY_KEYS.COMMENT) {
      continue;
    }

    // Handle deletion marker on nested entries
    if (isDeletedEntry(overrideValue)) {
      delete result[key];
      continue;
    }

    // Preserve _manual flag (don't strip, scrapers need it)
    if (key === OVERLAY_KEYS.MANUAL) {
      result[key] = overrideValue;
      continue;
    }

    // Recursive merge for nested objects
    if (isPlainObject(result[key]) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(result[key], overrideValue);
    } else if (isPlainObject(overrideValue)) {
      // Override is object, strip transient keys but preserve _manual
      result[key] = stripTransientKeys(overrideValue);
    } else {
      // Direct replacement for primitives and arrays
      result[key] = overrideValue;
    }
  }

  return result as T;
}

/**
 * Apply overlay to base data with detailed result.
 *
 * @param baseData - Auto-generated base data
 * @param overrideData - Manual overrides (optional)
 * @returns Merged data with statistics
 */
export function applyOverlay<T>(
  baseData: T,
  overrideData?: unknown
): OverlayResult<T> {
  const stats = {
    overridden: 0,
    deleted: 0,
    manual: 0,
  };

  if (!overrideData || !isPlainObject(overrideData)) {
    return { data: baseData, stats };
  }

  // Count statistics before merge
  countOverlayStats(overrideData, stats);

  // Perform the merge
  const data = deepMerge(baseData, overrideData);

  return { data, stats };
}

/**
 * Simple overlay application without statistics.
 */
export function mergeWithOverrides<T>(base: T, overrides?: unknown): T {
  return applyOverlay(base, overrides).data;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Recursively count overlay statistics.
 */
function countOverlayStats(
  obj: Record<string, unknown>,
  stats: { overridden: number; deleted: number; manual: number }
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (OVERLAY_KEY_SET.has(key)) {
      continue;
    }

    if (isPlainObject(value)) {
      if (isDeletedEntry(value)) {
        stats.deleted++;
      } else if (isManualEntry(value)) {
        stats.manual++;
        stats.overridden++;
      } else {
        stats.overridden++;
        // Recurse into nested objects
        countOverlayStats(value, stats);
      }
    } else {
      stats.overridden++;
    }
  }
}

/**
 * Get all keys marked as manual in an override file.
 * Used by scrapers to preserve manual entries during regeneration.
 *
 * @param overrides - The override object to scan
 * @param path - Current path (for nested objects)
 * @returns Set of dot-separated paths to manual entries
 */
export function getManualKeys(
  overrides: Record<string, unknown>,
  path: string = ''
): Set<string> {
  const manualKeys = new Set<string>();

  for (const [key, value] of Object.entries(overrides)) {
    if (OVERLAY_KEY_SET.has(key)) {
      continue;
    }

    const currentPath = path ? `${path}.${key}` : key;

    if (isPlainObject(value)) {
      if (isManualEntry(value)) {
        manualKeys.add(currentPath);
      } else {
        // Recurse into nested objects
        const nestedKeys = getManualKeys(value, currentPath);
        nestedKeys.forEach((k) => manualKeys.add(k));
      }
    }
  }

  return manualKeys;
}

/**
 * Get all keys marked as deleted in an override file.
 *
 * @param overrides - The override object to scan
 * @param path - Current path (for nested objects)
 * @returns Set of dot-separated paths to deleted entries
 */
export function getDeletedKeys(
  overrides: Record<string, unknown>,
  path: string = ''
): Set<string> {
  const deletedKeys = new Set<string>();

  for (const [key, value] of Object.entries(overrides)) {
    if (OVERLAY_KEY_SET.has(key)) {
      continue;
    }

    const currentPath = path ? `${path}.${key}` : key;

    if (isPlainObject(value)) {
      if (isDeletedEntry(value)) {
        deletedKeys.add(currentPath);
      } else {
        // Recurse into nested objects
        const nestedKeys = getDeletedKeys(value, currentPath);
        nestedKeys.forEach((k) => deletedKeys.add(k));
      }
    }
  }

  return deletedKeys;
}

// ============================================================================
// Data Loading Helpers
// ============================================================================

/**
 * Type definition for data loader function.
 */
export type DataLoader<T> = () => Promise<T>;

/**
 * Create a loader that applies overlays automatically.
 *
 * @param loadBase - Function to load base data
 * @param loadOverrides - Function to load override data (optional)
 * @returns Combined loader function
 *
 * @example
 * ```typescript
 * const loadMods = createOverlayLoader(
 *   () => import('../data/mods/mod-cache.json'),
 *   () => import('../data/mods/mod-cache-overrides.json').catch(() => ({}))
 * );
 *
 * const modData = await loadMods();
 * ```
 */
export function createOverlayLoader<T>(
  loadBase: DataLoader<T>,
  loadOverrides?: DataLoader<unknown>
): DataLoader<T> {
  return async (): Promise<T> => {
    const [base, overrides] = await Promise.all([
      loadBase(),
      loadOverrides?.().catch(() => undefined),
    ]);

    return mergeWithOverrides(base, overrides);
  };
}
