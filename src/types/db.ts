/**
 * Database type definitions for Dexie.js IndexedDB storage
 */

/** Build state stored in IndexedDB */
export interface StoredBuild {
  /** Auto-incremented primary key */
  id?: number;
  /** Build display name */
  name: string;
  /** Character class (e.g., 'Warrior', 'Witch') */
  className: string;
  /** Ascendancy class (e.g., 'Titan', 'Infernalist') */
  ascendancy?: string;
  /** Character level */
  level: number;
  /** Allocated passive node IDs */
  passiveNodes: number[];
  /** Equipped items serialized as JSON */
  items: string;
  /** Active skill gems configuration */
  skills: string;
  /** Build configuration (enemy, charges, combat state) */
  config?: string;
  /** Build notes/description */
  notes?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  updatedAt: Date;
  /** Build code for sharing (base64 encoded) */
  buildCode?: string;
}

/** Cached game data entry */
export interface GameDataCacheEntry {
  /** Cache key (e.g., 'passive-tree', 'gems', 'mods') */
  key: string;
  /** Cached data as JSON string */
  data: string;
  /** Data version for cache invalidation */
  version: string;
  /** Cache expiry timestamp */
  expiresAt: Date;
  /** When the cache was last updated */
  updatedAt: Date;
}

/** User preferences stored locally */
export interface UserPreferences {
  /** Singleton key - always 'user' */
  id: string;
  /** UI theme ('dark' | 'light' | 'system') */
  theme: 'dark' | 'light' | 'system';
  /** UI language code */
  language: string;
  /** Tree zoom level (0.1 - 3.0) */
  treeZoom: number;
  /** Show node tooltips on hover */
  showTooltips: boolean;
  /** Auto-save builds */
  autoSave: boolean;
  /** Auto-save interval in seconds */
  autoSaveInterval: number;
  /** Last opened build ID */
  lastBuildId?: number;
  /** Recently opened build IDs */
  recentBuilds: number[];
  /** Custom keyboard shortcuts */
  keyboardShortcuts?: Record<string, string>;
}

/** Default user preferences */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  id: 'user',
  theme: 'dark',
  language: 'en-US',
  treeZoom: 1.0,
  showTooltips: true,
  autoSave: true,
  autoSaveInterval: 30,
  recentBuilds: [],
};
