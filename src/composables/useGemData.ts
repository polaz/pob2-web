// src/composables/useGemData.ts
// Composable for loading and querying gem data

import { ref, shallowRef, computed, onMounted, watch } from 'vue';
import type {
  RawGemsData,
  GemsData,
  Gem,
  GemType,
} from 'src/types/gems';
import { getCachedData, setCachedData } from 'src/db';

// Cache configuration
const GEMS_CACHE_KEY = 'gems:poe2';
const GEMS_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/** Maximum search cache entries to prevent unbounded memory growth */
const SEARCH_CACHE_MAX_SIZE = 100;

// Lazy-loaded gem data (shared singleton)
let gemsDataCache: GemsData | null = null;
let loadingPromise: Promise<GemsData> | null = null;

/**
 * Reset module-level state for testing purposes.
 *
 * WARNING: This function mutates the shared singleton cache.
 * It must only be called from test code and MUST NOT be used in production.
 *
 * @throws {Error} If called outside of test environment (NODE_ENV !== 'test')
 * @internal
 */
export function resetGemDataForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'resetGemDataForTesting() can only be called in test environment. ' +
        'This function is not meant for production use.'
    );
  }
  gemsDataCache = null;
  loadingPromise = null;
}

/**
 * Convert raw gem data to optimized format.
 */
function convertToGemsData(rawData: RawGemsData): GemsData {
  const gems = new Map<string, Gem>();
  const byName = new Map<string, Gem>();
  const byType = new Map<GemType, Gem[]>();

  // Initialize type arrays
  const types: GemType[] = ['Spell', 'Attack', 'Support', 'Minion', 'Buff', 'Mark', 'Warcry'];
  for (const type of types) {
    byType.set(type, []);
  }

  for (const [id, rawGem] of Object.entries(rawData.gems)) {
    const gem: Gem = {
      id,
      name: rawGem.name,
      type: rawGem.gemType,
      isSupport: rawGem.gemType === 'Support',
      tags: rawGem.tags,
      requirements: {
        str: rawGem.reqStr,
        dex: rawGem.reqDex,
        int: rawGem.reqInt,
      },
      tier: rawGem.Tier,
      maxLevel: rawGem.naturalMaxLevel,
      metadataPath: rawGem.gameId,
      // Conditionally include optional fields (exactOptionalPropertyTypes)
      ...(rawGem.grantedEffectId && { effectId: rawGem.grantedEffectId }),
      ...(rawGem.weaponRequirements && {
        weaponTypes: rawGem.weaponRequirements.split(',').map(s => s.trim()),
      }),
      ...(rawGem.gemFamily && { family: rawGem.gemFamily }),
      ...((rawGem.additionalStatSet1 || rawGem.additionalGrantedEffectId1) && {
        additionalEffects: [
          rawGem.additionalStatSet1,
          rawGem.additionalStatSet2,
          rawGem.additionalStatSet3,
          rawGem.additionalGrantedEffectId1,
          rawGem.additionalGrantedEffectId2,
        ].filter((e): e is string => !!e),
      }),
    };

    gems.set(id, gem);
    byName.set(gem.name.toLowerCase(), gem);
    byType.get(gem.type)?.push(gem);
  }

  return {
    version: rawData.version,
    extractedAt: new Date(rawData.extractedAt),
    source: rawData.source,
    meta: rawData.meta,
    gems,
    byName,
    byType,
  };
}

/**
 * Load gem data from IndexedDB cache or JSON file.
 */
async function loadGemData(): Promise<GemsData> {
  if (gemsDataCache) {
    return gemsDataCache;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Try to load from IndexedDB cache first
    try {
      const cached = await getCachedData(GEMS_CACHE_KEY);
      if (cached) {
        const rawData = JSON.parse(cached.data) as RawGemsData;
        const gemsData = convertToGemsData(rawData);
        gemsDataCache = gemsData;
        return gemsData;
      }
    } catch (e) {
      console.warn('[useGemData] Cache read failed:', e);
    }

    // Load bundled JSON as fallback
    const module = await import('src/data/gems/poe2-gems.json');
    const rawData = module.default as RawGemsData;
    const gemsData = convertToGemsData(rawData);

    // Cache in IndexedDB for faster future loads
    try {
      await setCachedData(
        GEMS_CACHE_KEY,
        JSON.stringify(rawData),
        rawData.version,
        GEMS_CACHE_TTL
      );
    } catch (e) {
      console.warn('[useGemData] Cache write failed:', e);
    }

    // Only set cache after all operations succeed
    gemsDataCache = gemsData;
    return gemsData;
  })().catch((error) => {
    // Reset state on failure to allow a clean retry
    loadingPromise = null;
    gemsDataCache = null;
    throw error;
  });

  return loadingPromise;
}

/**
 * Composable for gem data access and querying.
 */
export function useGemData() {
  const loading = ref(true);
  const error = shallowRef<Error | null>(null);
  const gemsData = shallowRef<GemsData | null>(null);

  // Load gem data on mount
  onMounted(async () => {
    try {
      gemsData.value = await loadGemData();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  });

  // Computed properties
  const gemCount = computed(() => gemsData.value?.gems.size ?? 0);
  const skillGemCount = computed(() => gemsData.value?.meta.skillGems ?? 0);
  const supportGemCount = computed(() => gemsData.value?.meta.supportGems ?? 0);

  /**
   * Search cache using shallowRef for performance.
   * See useTreeData.ts for detailed explanation of mutation pattern.
   */
  const searchCache = shallowRef(new Map<string, Gem[]>());

  // Clear cache whenever gemsData changes
  watch(gemsData, () => {
    searchCache.value = new Map();
  });

  /**
   * Get a gem by ID.
   *
   * @param id - The gem ID (variantId) to look up
   * @returns The gem if found, undefined otherwise
   */
  function getGem(id: string): Gem | undefined {
    return gemsData.value?.gems.get(id);
  }

  /**
   * Get a gem by name (case-insensitive).
   *
   * @param name - The gem name to look up
   * @returns The gem if found, undefined otherwise
   */
  function getGemByName(name: string): Gem | undefined {
    return gemsData.value?.byName.get(name.toLowerCase());
  }

  /**
   * Get all gems of a specific type.
   *
   * @param type - The gem type to filter by
   * @returns Array of gems matching the type
   */
  function getGemsByType(type: GemType): Gem[] {
    return gemsData.value?.byType.get(type) ?? [];
  }

  /**
   * Get all skill gems (non-support).
   *
   * @returns Array of skill gems
   */
  function getSkillGems(): Gem[] {
    if (!gemsData.value) return [];
    return Array.from(gemsData.value.gems.values()).filter(g => !g.isSupport);
  }

  /**
   * Get all support gems.
   *
   * @returns Array of support gems
   */
  function getSupportGems(): Gem[] {
    return gemsData.value?.byType.get('Support') ?? [];
  }

  /**
   * Get gems by tag.
   *
   * @param tag - The tag to filter by (e.g., 'fire', 'projectile')
   * @returns Array of gems with the specified tag
   */
  function getGemsByTag(tag: string): Gem[] {
    if (!gemsData.value) return [];
    return Array.from(gemsData.value.gems.values()).filter(
      g => g.tags[tag] === true
    );
  }

  /**
   * Get gems compatible with a weapon type.
   *
   * @param weaponType - The weapon type to check
   * @returns Array of gems that can be used with the weapon
   */
  function getGemsForWeapon(weaponType: string): Gem[] {
    if (!gemsData.value) return [];
    const normalizedWeapon = weaponType.toLowerCase();

    return Array.from(gemsData.value.gems.values()).filter(g => {
      // No weapon restriction means compatible with all
      if (!g.weaponTypes) return true;
      return g.weaponTypes.some(
        wt => wt.toLowerCase().includes(normalizedWeapon)
      );
    });
  }

  /**
   * Search gems by name (case-insensitive, LRU cached).
   *
   * @param query - Search query string
   * @returns Array of gems whose names contain the query
   */
  function searchGems(query: string): Gem[] {
    if (!gemsData.value) return [];

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const cache = searchCache.value;
    const cached = cache.get(normalizedQuery);
    if (cached) {
      // Move to end for LRU
      cache.delete(normalizedQuery);
      cache.set(normalizedQuery, cached);
      return cached;
    }

    const result = Array.from(gemsData.value.gems.values()).filter(
      g => g.name.toLowerCase().includes(normalizedQuery)
    );

    // Evict oldest entry if cache is full
    if (cache.size >= SEARCH_CACHE_MAX_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(normalizedQuery, result);
    return result;
  }

  /**
   * Get gems by attribute requirement.
   *
   * @param attribute - 'str' | 'dex' | 'int'
   * @returns Array of gems requiring that attribute
   */
  function getGemsByAttribute(attribute: 'str' | 'dex' | 'int'): Gem[] {
    if (!gemsData.value) return [];
    return Array.from(gemsData.value.gems.values()).filter(
      g => g.requirements[attribute] > 0
    );
  }

  return {
    // State
    loading,
    error,
    gemsData,

    // Computed
    gemCount,
    skillGemCount,
    supportGemCount,

    // Methods
    getGem,
    getGemByName,
    getGemsByType,
    getSkillGems,
    getSupportGems,
    getGemsByTag,
    getGemsForWeapon,
    searchGems,
    getGemsByAttribute,
  };
}
