/**
 * Skill Store - manages skills and gems UI state
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import type { SkillGroup, GemInstance, Gem } from 'src/protos/pob2_pb';

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

  /** Set gem search query */
  function setGemSearchQuery(query: string): void {
    gemSearchQuery.value = query;
    // Perform search
    if (query.length > 0) {
      const lowerQuery = query.toLowerCase();
      gemSearchResults.value = availableGems.value
        .filter((gem) => gem.name?.toLowerCase().includes(lowerQuery))
        .map((gem) => ({
          gem,
          matchType: 'name' as const,
          matchText: gem.name ?? '',
        }))
        .slice(0, MAX_SEARCH_RESULTS);
    } else {
      gemSearchResults.value = [];
    }
  }

  /** Set available gems */
  function setAvailableGems(gems: Gem[]): void {
    availableGems.value = gems;
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

  /** Create new skill group */
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
