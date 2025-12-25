/**
 * Item Icon Loading Service
 *
 * Loads item icons from web.poecdn.com CDN with caching support.
 * Uses Service Worker for offline caching in PWA mode.
 */

import type { ItemType, ItemRarity } from 'src/protos/pob2_pb';

// ============================================================================
// Constants
// ============================================================================

/** Base CDN URL for PoE item images */
const POE_CDN_BASE = 'https://web.poecdn.com/image';

/** Placeholder SVG for missing/loading icons */
const PLACEHOLDER_ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect fill='%232a2a3e' width='64' height='64' rx='4'/%3E%3Ctext x='32' y='36' fill='%23666' font-family='sans-serif' font-size='24' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E`;

/** Maximum concurrent icon loads */
const MAX_CONCURRENT_LOADS = 6;

/** Icon load timeout in milliseconds */
const LOAD_TIMEOUT_MS = 10000;

/** Memory cache max size */
const MEMORY_CACHE_MAX_SIZE = 200;

// ============================================================================
// Rarity Colors (matching PoE2 game colors)
// These values mirror the CSS custom properties in themes/poe2.scss
// For runtime theming, use getCssVariable() or CSS var(--poe2-rarity-xxx)
// ============================================================================

/** Item rarity color mapping - mirrors --poe2-rarity-xxx CSS variables */
export const RARITY_COLORS: Record<number, string> = {
  0: '#c8c8c8', // UNKNOWN - grey (--poe2-rarity-normal)
  1: '#c8c8c8', // NORMAL - white/grey (--poe2-rarity-normal)
  2: '#8888ff', // MAGIC - blue (--poe2-rarity-magic)
  3: '#ffff77', // RARE - yellow (--poe2-rarity-rare)
  4: '#af6025', // UNIQUE - orange/brown (--poe2-rarity-unique)
};

/** Item rarity background colors - mirrors --poe2-rarity-xxx-bg CSS variables */
export const RARITY_BG_COLORS: Record<number, string> = {
  0: '#1a1a2e', // UNKNOWN (--poe2-rarity-normal-bg)
  1: '#1a1a2e', // NORMAL (--poe2-rarity-normal-bg)
  2: '#1a1a3e', // MAGIC - subtle blue tint (--poe2-rarity-magic-bg)
  3: '#2a2a1e', // RARE - subtle yellow tint (--poe2-rarity-rare-bg)
  4: '#2a1a0e', // UNIQUE - subtle orange tint (--poe2-rarity-unique-bg)
};

/** Item rarity border colors - mirrors --poe2-rarity-xxx-border CSS variables */
export const RARITY_BORDER_COLORS: Record<number, string> = {
  0: '#3a3a4e', // UNKNOWN (--poe2-rarity-normal-border)
  1: '#4a4a5e', // NORMAL (--poe2-rarity-normal-border)
  2: '#4a4a8e', // MAGIC (--poe2-rarity-magic-border)
  3: '#6a6a3e', // RARE (--poe2-rarity-rare-border)
  4: '#5a3a1e', // UNIQUE (--poe2-rarity-unique-border)
};

/**
 * Gets a CSS custom property value at runtime.
 * Useful for dynamic theming when JS needs current theme colors.
 *
 * @param name - Full CSS custom property name including the `--` prefix
 *               (e.g., '--poe2-rarity-magic', '--poe2-bg-card')
 * @param fallback - Fallback value if variable is not defined
 * @returns The CSS variable value, trimmed of whitespace
 *
 * @example
 * const magicColor = getCssVariable('--poe2-rarity-magic', '#8888ff');
 */
export function getCssVariable(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// ============================================================================
// Slot Icons (for empty slots)
// ============================================================================

/** Slot type to icon name mapping */
const SLOT_ICONS: Record<string, string> = {
  weapon: 'weapon',
  'main-hand': 'weapon',
  'off-hand': 'offhand',
  helmet: 'helmet',
  'body-armour': 'body',
  gloves: 'gloves',
  boots: 'boots',
  amulet: 'amulet',
  ring: 'ring',
  belt: 'belt',
  flask: 'flask',
  jewel: 'jewel',
};

// ============================================================================
// Types
// ============================================================================

export interface IconLoadResult {
  success: boolean;
  url: string;
  error?: string;
}

interface CacheEntry {
  url: string;
  timestamp: number;
}

// ============================================================================
// Icon URL Builder
// ============================================================================

/**
 * Builds icon URL from CDN path.
 *
 * @param iconPath - Path from API/data (e.g., "Art/2DItems/Armours/...")
 * @param scale - Image scale (1 = original, 2 = 2x)
 * @param w - Width in inventory cells
 * @param h - Height in inventory cells
 * @returns Full CDN URL
 */
export function buildIconUrl(
  iconPath: string,
  scale: number = 1,
  w: number = 1,
  h: number = 1
): string {
  // Handle paths that are already full URLs
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
    return iconPath;
  }

  // Handle paths that start with /
  const cleanPath = iconPath.startsWith('/') ? iconPath.slice(1) : iconPath;

  // Build URL with query params
  const params = new URLSearchParams({
    scale: String(scale),
    w: String(w),
    h: String(h),
  });

  return `${POE_CDN_BASE}/${cleanPath}?${params.toString()}`;
}

// ============================================================================
// Icon Loader Class
// ============================================================================

/**
 * Manages loading and caching of item icons.
 */
class ItemIconLoader {
  /** In-memory URL cache */
  private cache: Map<string, CacheEntry> = new Map();

  /** Currently loading URLs */
  private loading: Map<string, Promise<IconLoadResult>> = new Map();

  /** Load queue for throttling */
  private queue: Array<{
    key: string;
    url: string;
    resolve: (result: IconLoadResult) => void;
  }> = [];

  /**
   * Head pointer for O(1) dequeue from queue array.
   * Queue grows but isn't trimmed - acceptable for icon loading batches.
   */
  private queueHead = 0;

  /** Current number of active loads */
  private activeLoads = 0;

  /**
   * Gets an icon URL, loading and caching as needed.
   *
   * @param iconPath - Icon path from API/data
   * @returns Promise resolving to icon URL (or placeholder on error)
   */
  async getIconUrl(iconPath: string | undefined): Promise<string> {
    if (!iconPath) {
      return PLACEHOLDER_ICON;
    }

    const cacheKey = iconPath;

    // Check memory cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.url;
    }

    // Check if already loading
    const loadingPromise = this.loading.get(cacheKey);
    if (loadingPromise) {
      const result = await loadingPromise;
      return result.url;
    }

    // Build URL and queue load
    const url = buildIconUrl(iconPath);

    // Create load promise
    const loadPromise = new Promise<IconLoadResult>((resolve) => {
      this.queue.push({ key: cacheKey, url, resolve });
      this.processQueue();
    });

    this.loading.set(cacheKey, loadPromise);

    const result = await loadPromise;
    this.loading.delete(cacheKey);

    return result.url;
  }

  /**
   * Processes the load queue, respecting concurrency limits.
   * Uses head pointer pattern for O(1) dequeue instead of O(n) shift().
   */
  private processQueue(): void {
    while (this.activeLoads < MAX_CONCURRENT_LOADS && this.queueHead < this.queue.length) {
      const item = this.queue[this.queueHead++];
      if (!item) break;

      this.activeLoads++;
      void this.loadIcon(item.key, item.url)
        .then(item.resolve)
        .finally(() => {
          this.activeLoads--;
          this.processQueue();
        });
    }

    // Reset queue when fully processed to free memory
    if (this.queueHead >= this.queue.length && this.activeLoads === 0) {
      this.queue = [];
      this.queueHead = 0;
    }
  }

  /**
   * Loads a single icon URL.
   */
  private async loadIcon(key: string, url: string): Promise<IconLoadResult> {
    try {
      // Use fetch to check if image is accessible
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Cache successful URL
        this.addToCache(key, url);
        return { success: true, url };
      } else {
        // Cache placeholder for failed loads
        this.addToCache(key, PLACEHOLDER_ICON);
        return {
          success: false,
          url: PLACEHOLDER_ICON,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      // On error, return placeholder
      this.addToCache(key, PLACEHOLDER_ICON);
      return {
        success: false,
        url: PLACEHOLDER_ICON,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Adds entry to cache, evicting old entries if needed.
   * Uses FIFO eviction based on Map's insertion order guarantee (ES2015+).
   */
  private addToCache(key: string, url: string): void {
    // Evict oldest entry (first inserted) if cache is at capacity
    if (this.cache.size >= MEMORY_CACHE_MAX_SIZE) {
      // Map.keys().next() returns first inserted key due to Map's insertion order
      // Type is inferred as string from Map<string, CacheEntry>
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      url,
      timestamp: Date.now(),
    });
  }

  /**
   * Preloads a batch of icon URLs.
   *
   * @param iconPaths - Array of icon paths to preload
   */
  async preload(iconPaths: string[]): Promise<void> {
    await Promise.all(iconPaths.map((path) => this.getIconUrl(path)));
  }

  /**
   * Clears the icon cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets the placeholder icon URL.
   */
  getPlaceholder(): string {
    return PLACEHOLDER_ICON;
  }

  /**
   * Gets a rarity-colored placeholder for items without icons.
   *
   * @param rarity - Item rarity enum value
   * @param letter - Optional letter to display (e.g., first letter of item type)
   * @returns Data URL for colored placeholder
   */
  getRarityPlaceholder(rarity: ItemRarity | number = 0, letter = '?'): string {
    // Default colors for unknown rarity
    const defaultBg = '#1a1a2e';
    const defaultBorder = '#3a3a4e';
    const defaultText = '#c8c8c8';

    const bgColor = RARITY_BG_COLORS[rarity] ?? defaultBg;
    const borderColor = RARITY_BORDER_COLORS[rarity] ?? defaultBorder;
    const textColor = RARITY_COLORS[rarity] ?? defaultText;

    // Escape special characters for SVG
    const safeLetter = letter.charAt(0).toUpperCase();

    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect fill='${encodeURIComponent(bgColor)}' stroke='${encodeURIComponent(borderColor)}' stroke-width='2' x='1' y='1' width='62' height='62' rx='4'/%3E%3Ctext x='32' y='40' fill='${encodeURIComponent(textColor)}' font-family='sans-serif' font-size='28' font-weight='bold' text-anchor='middle'%3E${safeLetter}%3C/text%3E%3C/svg%3E`;
  }

  /**
   * Gets a slot-specific placeholder icon.
   *
   * @param slotType - Slot type (e.g., 'helmet', 'weapon')
   * @returns Data URL for slot placeholder
   */
  getSlotPlaceholder(slotType: string): string {
    const iconName = SLOT_ICONS[slotType.toLowerCase()] ?? 'default';
    const letter = iconName.charAt(0).toUpperCase();

    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect fill='%231a1a2e' stroke='%233a3a4e' stroke-width='2' stroke-dasharray='4' x='1' y='1' width='62' height='62' rx='4'/%3E%3Ctext x='32' y='40' fill='%23555' font-family='sans-serif' font-size='28' text-anchor='middle'%3E${letter}%3C/text%3E%3C/svg%3E`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Singleton icon loader instance */
export const itemIconLoader = new ItemIconLoader();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets rarity color for an item.
 *
 * @param rarity - Item rarity enum value
 * @returns CSS color string
 */
export function getRarityColor(rarity: ItemRarity | number | undefined): string {
  const defaultColor = '#c8c8c8';
  return RARITY_COLORS[rarity ?? 0] ?? defaultColor;
}

/**
 * Gets rarity background color for an item.
 *
 * @param rarity - Item rarity enum value
 * @returns CSS color string
 */
export function getRarityBgColor(
  rarity: ItemRarity | number | undefined
): string {
  const defaultColor = '#1a1a2e';
  return RARITY_BG_COLORS[rarity ?? 0] ?? defaultColor;
}

/**
 * Gets rarity border color for an item.
 *
 * @param rarity - Item rarity enum value
 * @returns CSS color string
 */
export function getRarityBorderColor(
  rarity: ItemRarity | number | undefined
): string {
  const defaultColor = '#3a3a4e';
  return RARITY_BORDER_COLORS[rarity ?? 0] ?? defaultColor;
}

/**
 * Gets rarity name for display.
 *
 * @param rarity - Item rarity enum value
 * @returns Rarity name string
 */
export function getRarityName(rarity: ItemRarity | number | undefined): string {
  switch (rarity) {
    case 1:
      return 'Normal';
    case 2:
      return 'Magic';
    case 3:
      return 'Rare';
    case 4:
      return 'Unique';
    default:
      return 'Unknown';
  }
}

/**
 * Gets item type name for display.
 *
 * @param itemType - Item type enum value
 * @returns Item type name string
 */
export function getItemTypeName(itemType: ItemType | number | undefined): string {
  // Map from proto ItemType enum values to display names
  const typeNames: Record<number, string> = {
    1: 'One Handed Sword',
    2: 'Two Handed Sword',
    3: 'One Handed Axe',
    4: 'Two Handed Axe',
    5: 'One Handed Mace',
    6: 'Two Handed Mace',
    7: 'Bow',
    8: 'Crossbow',
    9: 'Staff',
    10: 'Wand',
    11: 'Dagger',
    12: 'Claw',
    13: 'Sceptre',
    14: 'Quarterstaff',
    15: 'Spear',
    16: 'Flail',
    20: 'Helmet',
    21: 'Body Armour',
    22: 'Gloves',
    23: 'Boots',
    24: 'Shield',
    25: 'Focus',
    30: 'Amulet',
    31: 'Ring',
    32: 'Belt',
    40: 'Flask',
    41: 'Jewel',
    42: 'Charm',
    43: 'Quiver',
  };

  return typeNames[itemType ?? 0] ?? 'Unknown';
}
