// src/composables/useSkillData.ts
// Composable for loading and querying skill stats data

import { ref, shallowRef, computed, onMounted, watch } from 'vue';
import type {
  RawSkillsData,
  SkillsData,
  Skill,
  StatMapping,
  CompleteSkill,
} from 'src/types/skills';
import type { Gem } from 'src/types/gems';
import { getCachedData, setCachedData } from 'src/db';

// Cache configuration
const SKILLS_CACHE_KEY = 'skills:poe2';
const SKILLS_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/** Maximum search cache entries to prevent unbounded memory growth */
const SEARCH_CACHE_MAX_SIZE = 100;

// Lazy-loaded skill data (shared singleton)
let skillsDataCache: SkillsData | null = null;
let loadingPromise: Promise<SkillsData> | null = null;

/**
 * Reset module-level state for testing purposes.
 *
 * WARNING: This function mutates the shared singleton cache.
 * It must only be called from test code and MUST NOT be used in production.
 *
 * @throws {Error} If called outside of test environment (NODE_ENV !== 'test')
 * @internal
 */
export function resetSkillDataForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'resetSkillDataForTesting() can only be called in test environment. ' +
        'This function is not meant for production use.'
    );
  }
  skillsDataCache = null;
  loadingPromise = null;
}

/**
 * Convert raw skill data to optimized format.
 */
function convertToSkillsData(rawData: RawSkillsData): SkillsData {
  const skills = new Map<string, Skill>();
  const byName = new Map<string, Skill>();
  const statMap = new Map<string, StatMapping>();

  // Build stat map
  for (const [statName, mapping] of Object.entries(rawData.statMap)) {
    statMap.set(statName, mapping);
  }

  // Build skill maps
  for (const [id, skill] of Object.entries(rawData.skills)) {
    skills.set(id, skill);
    if (skill.name) {
      byName.set(skill.name.toLowerCase(), skill);
    }
  }

  return {
    version: rawData.version,
    extractedAt: new Date(rawData.extractedAt),
    source: rawData.source,
    meta: rawData.meta,
    statMap,
    skills,
    byName,
  };
}

/**
 * Load skill data from IndexedDB cache or JSON file.
 */
async function loadSkillData(): Promise<SkillsData> {
  if (skillsDataCache) {
    return skillsDataCache;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Try to load from IndexedDB cache first
    try {
      const cached = await getCachedData(SKILLS_CACHE_KEY);
      if (cached) {
        const rawData = JSON.parse(cached.data) as RawSkillsData;
        const skillsData = convertToSkillsData(rawData);
        skillsDataCache = skillsData;
        return skillsData;
      }
    } catch (e) {
      console.warn('[useSkillData] Cache read failed:', e);
    }

    // Load bundled JSON as fallback
    const module = await import('src/data/gems/poe2-skills.json');
    const rawData = module.default as RawSkillsData;
    const skillsData = convertToSkillsData(rawData);

    // Cache in IndexedDB for faster future loads
    try {
      await setCachedData(
        SKILLS_CACHE_KEY,
        JSON.stringify(rawData),
        rawData.version,
        SKILLS_CACHE_TTL
      );
    } catch (e) {
      console.warn('[useSkillData] Cache write failed:', e);
    }

    // Only set cache after all operations succeed
    skillsDataCache = skillsData;
    return skillsData;
  })().catch((error) => {
    // Reset state on failure to allow a clean retry
    loadingPromise = null;
    skillsDataCache = null;
    throw error;
  });

  return loadingPromise;
}

/**
 * Composable for skill stats data access and querying.
 */
export function useSkillData() {
  const loading = ref(true);
  const error = shallowRef<Error | null>(null);
  const skillsData = shallowRef<SkillsData | null>(null);

  // Load skill data on mount
  onMounted(async () => {
    try {
      skillsData.value = await loadSkillData();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  });

  // Computed properties
  const skillCount = computed(() => skillsData.value?.skills.size ?? 0);
  const activeSkillCount = computed(() => skillsData.value?.meta.activeSkills ?? 0);
  const supportSkillCount = computed(() => skillsData.value?.meta.supportSkills ?? 0);
  const statMappingCount = computed(() => skillsData.value?.statMap.size ?? 0);

  /**
   * Search cache using shallowRef for performance.
   */
  const searchCache = shallowRef(new Map<string, Skill[]>());

  // Clear cache whenever skillsData changes
  watch(skillsData, () => {
    searchCache.value = new Map();
  });

  /**
   * Get a skill by effect ID.
   *
   * @param effectId - The skill effect ID (e.g., "IceNovaPlayer")
   * @returns The skill if found, undefined otherwise
   */
  function getSkill(effectId: string): Skill | undefined {
    return skillsData.value?.skills.get(effectId);
  }

  /**
   * Get a skill by name (case-insensitive).
   *
   * @param name - The skill name to look up
   * @returns The skill if found, undefined otherwise
   */
  function getSkillByName(name: string): Skill | undefined {
    return skillsData.value?.byName.get(name.toLowerCase());
  }

  /**
   * Get skill for a gem by its grantedEffectId.
   *
   * @param gem - The gem object with effectId
   * @returns The skill if found, undefined otherwise
   */
  function getSkillForGem(gem: Gem): Skill | undefined {
    if (!gem.effectId) return undefined;
    return skillsData.value?.skills.get(gem.effectId);
  }

  /**
   * Get complete skill data combining gem metadata and skill stats.
   *
   * @param gem - The gem object
   * @returns Complete skill data if skill stats found, undefined otherwise
   */
  function getCompleteSkill(gem: Gem): CompleteSkill | undefined {
    const skill = getSkillForGem(gem);
    if (!skill) return undefined;

    return {
      gem: {
        id: gem.id,
        name: gem.name,
        type: gem.type,
        isSupport: gem.isSupport,
        tier: gem.tier,
        maxLevel: gem.maxLevel,
        requirements: gem.requirements,
        tags: gem.tags,
        ...(gem.weaponTypes && { weaponTypes: gem.weaponTypes }),
      },
      skill,
    };
  }

  /**
   * Get stat mapping for a game stat name.
   *
   * @param statName - The game stat name (e.g., "spell_minimum_base_cold_damage")
   * @returns The stat mapping if found, undefined otherwise
   */
  function getStatMapping(statName: string): StatMapping | undefined {
    return skillsData.value?.statMap.get(statName);
  }

  /**
   * Resolve a game stat name to its internal name.
   *
   * @param statName - The game stat name
   * @returns The internal name (e.g., "ColdMin") or undefined
   */
  function resolveStatName(statName: string): string | undefined {
    const mapping = getStatMapping(statName);
    return mapping?.name;
  }

  /**
   * Get all support skills.
   *
   * @returns Array of support skills
   */
  function getSupportSkills(): Skill[] {
    if (!skillsData.value) return [];
    return Array.from(skillsData.value.skills.values()).filter((s) => s.support === true);
  }

  /**
   * Get all active (non-support) skills.
   *
   * @returns Array of active skills
   */
  function getActiveSkills(): Skill[] {
    if (!skillsData.value) return [];
    return Array.from(skillsData.value.skills.values()).filter((s) => s.support !== true);
  }

  /**
   * Search skills by name (case-insensitive, LRU cached).
   *
   * @param query - Search query string
   * @returns Array of skills whose names contain the query
   */
  function searchSkills(query: string): Skill[] {
    if (!skillsData.value) return [];

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

    const result = Array.from(skillsData.value.skills.values()).filter(
      (s) => s.name && s.name.toLowerCase().includes(normalizedQuery)
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
   * Get damage effectiveness for a skill at a specific level.
   *
   * Formula from PoB CalcTools.lua:
   *   baseEffectiveness * (1 + incrementalEffectiveness * (level - 1))
   *                     * (1 + damageIncrementalEffectiveness) ^ (level - 1)
   *
   * Note: incrementalEffectiveness uses linear scaling, while
   * damageIncrementalEffectiveness uses exponential scaling.
   *
   * @param skill - The skill
   * @param level - The gem level (1-40)
   * @param statSetIndex - The stat set index (0 for primary, 1+ for variants)
   * @returns The damage effectiveness multiplier, or undefined
   */
  function getDamageEffectiveness(
    skill: Skill,
    level: number,
    statSetIndex = 0
  ): number | undefined {
    const statSet = skill.statSets?.[statSetIndex];
    if (!statSet) return undefined;

    const baseEff = statSet.baseEffectiveness ?? 0;
    const incEff = statSet.incrementalEffectiveness ?? 0;
    const damageIncEff = statSet.damageIncrementalEffectiveness ?? 0;

    // Linear scaling for incrementalEffectiveness
    const linearMultiplier = 1 + incEff * (level - 1);
    // Exponential scaling for damageIncrementalEffectiveness
    const exponentialMultiplier = Math.pow(1 + damageIncEff, level - 1);

    return baseEff * linearMultiplier * exponentialMultiplier;
  }

  /**
   * Get stat values for a skill at a specific level.
   *
   * @param skill - The skill
   * @param level - The gem level (1-40)
   * @param statSetIndex - The stat set index (0 for primary, 1+ for variants)
   * @returns Map of stat name to value, or undefined
   */
  function getStatValues(
    skill: Skill,
    level: number,
    statSetIndex = 0
  ): Map<string, number> | undefined {
    const statSet = skill.statSets?.[statSetIndex];
    if (!statSet) return undefined;

    const result = new Map<string, number>();

    // Add constant stats
    if (statSet.constantStats) {
      for (const { stat, value } of statSet.constantStats) {
        result.set(stat, value);
      }
    }

    // Add level-based stats
    const levelData = statSet.levels?.[String(level)];
    if (levelData && statSet.stats) {
      for (let i = 0; i < statSet.stats.length && i < levelData.values.length; i++) {
        const statName = statSet.stats[i];
        const value = levelData.values[i];
        if (statName && value !== undefined) {
          result.set(statName, value);
        }
      }
    }

    return result;
  }

  return {
    // State
    loading,
    error,
    skillsData,

    // Computed
    skillCount,
    activeSkillCount,
    supportSkillCount,
    statMappingCount,

    // Methods
    getSkill,
    getSkillByName,
    getSkillForGem,
    getCompleteSkill,
    getStatMapping,
    resolveStatName,
    getSupportSkills,
    getActiveSkills,
    searchSkills,
    getDamageEffectiveness,
    getStatValues,
  };
}
