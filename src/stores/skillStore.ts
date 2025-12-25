/**
 * Skill Store - manages skills and gems UI state
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import type { SkillGroup, GemInstance, Gem } from 'src/protos/skills_pb';
import { NgramIndex } from 'src/services/search';
import type { SearchableDocument } from 'src/services/search';

/** Gem search result */
export interface GemSearchResult {
  gem: Gem;
  matchType: 'name' | 'tag';
  matchText: string;
}

/** Maximum search results to display */
const MAX_SEARCH_RESULTS = 50;

/** Default gem level for new instances */
const DEFAULT_GEM_LEVEL = 20;

/** Default gem quality for new instances */
const DEFAULT_GEM_QUALITY = 20;

/** Minimum query length for n-gram search */
const MIN_QUERY_LENGTH = 2;

export const useSkillStore = defineStore('skill', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Currently selected skill group index */
  const selectedGroupIndex = ref<number | null>(null);

  /** Currently selected gem index within group */
  const selectedGemIndex = ref<number | null>(null);

  /** Gem being dragged (for reordering) */
  const draggingGem = shallowRef<{ groupIndex: number; gemIndex: number } | null>(null);

  /** Whether skill group editor is open */
  const isGroupEditorOpen = ref(false);

  /** Whether gem selector modal is open */
  const isGemSelectorOpen = ref(false);

  /** Gem search query */
  const gemSearchQuery = ref('');

  /** Gem search results */
  const gemSearchResults = shallowRef<GemSearchResult[]>([]);

  /** All available gems (loaded from game data) */
  const availableGems = shallowRef<Gem[]>([]);

  /** Whether gem data is loading */
  const isLoadingGems = ref(false);

  /** Active skill for DPS display (index in skill groups) */
  const activeSkillIndex = ref<number>(0);

  /** Skill display mode */
  const displayMode = ref<'compact' | 'detailed'>('compact');

  /** N-gram search index for gems */
  const gemSearchIndex = new NgramIndex({ ngramSize: 3, minQueryLength: MIN_QUERY_LENGTH });

  /** Map of gem ID to Gem for fast lookup */
  const gemsById = new Map<string, Gem>();

  // ============================================================================
  // Getters
  // ============================================================================

  /** Whether a skill group is selected */
  const hasSelectedGroup = computed(() => selectedGroupIndex.value !== null);

  /** Whether a gem is selected */
  const hasSelectedGem = computed(
    () => selectedGroupIndex.value !== null && selectedGemIndex.value !== null
  );

  /** Whether currently dragging a gem */
  const isDragging = computed(() => draggingGem.value !== null);

  /** Has gem search query */
  const hasGemSearch = computed(() => gemSearchQuery.value.length > 0);

  /** Gem search result count */
  const gemSearchResultCount = computed(() => gemSearchResults.value.length);

  /** Total available gems */
  const totalAvailableGems = computed(() => availableGems.value.length);

  // ============================================================================
  // Actions
  // ============================================================================

  /** Select skill group by index */
  function selectGroup(index: number | null): void {
    selectedGroupIndex.value = index;
    selectedGemIndex.value = null;
  }

  /** Select gem within group */
  function selectGem(groupIndex: number, gemIndex: number): void {
    selectedGroupIndex.value = groupIndex;
    selectedGemIndex.value = gemIndex;
  }

  /** Clear gem selection */
  function clearGemSelection(): void {
    selectedGemIndex.value = null;
  }

  /** Clear all selection */
  function clearSelection(): void {
    selectedGroupIndex.value = null;
    selectedGemIndex.value = null;
  }

  /** Start dragging gem */
  function startDragging(groupIndex: number, gemIndex: number): void {
    draggingGem.value = { groupIndex, gemIndex };
  }

  /** Stop dragging gem */
  function stopDragging(): void {
    draggingGem.value = null;
  }

  /** Open group editor */
  function openGroupEditor(groupIndex?: number): void {
    if (groupIndex !== undefined) {
      selectedGroupIndex.value = groupIndex;
    }
    isGroupEditorOpen.value = true;
  }

  /** Close group editor */
  function closeGroupEditor(): void {
    isGroupEditorOpen.value = false;
  }

  /** Open gem selector */
  function openGemSelector(): void {
    isGemSelectorOpen.value = true;
    gemSearchQuery.value = '';
    gemSearchResults.value = [];
  }

  /** Close gem selector */
  function closeGemSelector(): void {
    isGemSelectorOpen.value = false;
    gemSearchQuery.value = '';
    gemSearchResults.value = [];
  }

  /**
   * Set gem search query and perform n-gram indexed search.
   *
   * Uses fuzzy n-gram matching for better search experience.
   * Falls back to substring matching for very short queries.
   */
  function setGemSearchQuery(query: string): void {
    gemSearchQuery.value = query;

    if (query.length === 0) {
      gemSearchResults.value = [];
      return;
    }

    // For short queries (< MIN_QUERY_LENGTH), fall back to substring search
    if (query.length < MIN_QUERY_LENGTH) {
      const lowerQuery = query.toLowerCase();
      const results: GemSearchResult[] = [];

      for (const gem of availableGems.value) {
        if (gem.name?.toLowerCase().startsWith(lowerQuery)) {
          results.push({
            gem,
            matchType: 'name',
            matchText: gem.name,
          });
        }
      }

      gemSearchResults.value = results.slice(0, MAX_SEARCH_RESULTS);
      return;
    }

    // Use n-gram index for longer queries
    const searchResults = gemSearchIndex.search(query, { limit: MAX_SEARCH_RESULTS });

    // Convert search results to GemSearchResult format
    const results: GemSearchResult[] = [];
    for (const result of searchResults) {
      const gem = gemsById.get(result.id);
      if (!gem) continue;

      results.push({
        gem,
        matchType: result.matchedField === 'name' ? 'name' : 'tag',
        matchText: result.matchedText,
      });
    }

    gemSearchResults.value = results;
  }

  /**
   * Set available gems and build the search index.
   */
  function setAvailableGems(gems: Gem[]): void {
    availableGems.value = gems;

    // Build lookup map
    gemsById.clear();
    for (const gem of gems) {
      gemsById.set(gem.id, gem);
    }

    // Build search index
    const documents: SearchableDocument[] = gems.map((gem) => ({
      id: gem.id,
      type: 'gem' as const,
      fields: {
        name: gem.name ?? '',
        tags: gem.tags?.join(' ') ?? '',
      },
    }));

    gemSearchIndex.build(documents);
  }

  /** Set loading state */
  function setLoadingGems(loading: boolean): void {
    isLoadingGems.value = loading;
  }

  /** Set active skill for DPS display */
  function setActiveSkill(index: number): void {
    activeSkillIndex.value = index;
  }

  /** Set display mode */
  function setDisplayMode(mode: 'compact' | 'detailed'): void {
    displayMode.value = mode;
  }

  /** Toggle display mode */
  function toggleDisplayMode(): void {
    displayMode.value = displayMode.value === 'compact' ? 'detailed' : 'compact';
  }

  /**
   * Create new skill group.
   * Note: crypto.randomUUID() requires secure context (HTTPS/localhost).
   * This is guaranteed for PWA deployment.
   */
  function createSkillGroup(label?: string): SkillGroup {
    return {
      id: crypto.randomUUID(),
      label: label ?? 'New Skill',
      enabled: true,
      includeInFullDps: true,
      gems: [],
    };
  }

  /** Create new gem instance */
  function createGemInstance(gemId: string): GemInstance {
    return {
      id: crypto.randomUUID(),
      gemId,
      level: DEFAULT_GEM_LEVEL,
      quality: DEFAULT_GEM_QUALITY,
      enabled: true,
      count: 1,
    };
  }

  return {
    // State
    selectedGroupIndex,
    selectedGemIndex,
    draggingGem,
    isGroupEditorOpen,
    isGemSelectorOpen,
    gemSearchQuery,
    gemSearchResults,
    availableGems,
    isLoadingGems,
    activeSkillIndex,
    displayMode,

    // Getters
    hasSelectedGroup,
    hasSelectedGem,
    isDragging,
    hasGemSearch,
    gemSearchResultCount,
    totalAvailableGems,

    // Actions
    selectGroup,
    selectGem,
    clearGemSelection,
    clearSelection,
    startDragging,
    stopDragging,
    openGroupEditor,
    closeGroupEditor,
    openGemSelector,
    closeGemSelector,
    setGemSearchQuery,
    setAvailableGems,
    setLoadingGems,
    setActiveSkill,
    setDisplayMode,
    toggleDisplayMode,
    createSkillGroup,
    createGemInstance,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSkillStore, import.meta.hot));
}
