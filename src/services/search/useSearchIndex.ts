/**
 * Vue composable for n-gram indexed search.
 *
 * Provides reactive search functionality with:
 * - Background indexing via Web Worker
 * - Automatic locale change handling
 * - Debounced search queries
 * - Loading/ready states
 */

import { ref, shallowRef, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import * as Comlink from 'comlink';
import { debounce } from 'lodash-es';
import { getScriptType, getNgramSize } from 'src/types/i18n';
import type { SearchWorkerApi } from './search.worker';
import type {
  SearchableDocument,
  SearchResult,
  SearchOptions,
  IndexStats,
  UseSearchIndexOptions,
} from './types';

/** Default debounce delay in milliseconds */
const DEFAULT_DEBOUNCE_MS = 150;

/** Minimum query length to trigger search */
const MIN_QUERY_LENGTH = 2;

/**
 * Worker pool for different index types.
 *
 * Each index type (gems, nodes, items, etc.) gets its own worker
 * to prevent cross-contamination and allow parallel builds.
 */
const workerPool = new Map<string, {
  worker: Worker;
  proxy: Comlink.Remote<SearchWorkerApi>;
  refCount: number;
}>();

/**
 * Get or create a worker for the given index type.
 */
function getWorker(indexType: string): Comlink.Remote<SearchWorkerApi> {
  let entry = workerPool.get(indexType);

  if (!entry) {
    const worker = new Worker(
      new URL('./search.worker.ts', import.meta.url),
      { type: 'module' }
    );
    const proxy = Comlink.wrap<SearchWorkerApi>(worker);
    entry = { worker, proxy, refCount: 0 };
    workerPool.set(indexType, entry);
  }

  entry.refCount++;
  return entry.proxy;
}

/**
 * Release a worker reference.
 */
function releaseWorker(indexType: string): void {
  const entry = workerPool.get(indexType);
  if (!entry) return;

  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.worker.terminate();
    workerPool.delete(indexType);
  }
}

/**
 * Composable for n-gram indexed search.
 *
 * @param options - Configuration options
 * @returns Search functionality and state
 *
 * @example
 * // In a component or composable
 * const gemSearch = useSearchIndex({ indexType: 'gem' });
 *
 * // Build index when data is available
 * await gemSearch.buildIndex(gemDocuments);
 *
 * // Search (debounced)
 * gemSearch.setQuery('fireball');
 * // Results available in gemSearch.results
 *
 * // Or search immediately
 * const results = await gemSearch.search('fireball');
 */
export function useSearchIndex(options: UseSearchIndexOptions) {
  const {
    indexType,
    initialDocuments,
    rebuildOnLocaleChange = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  // Get i18n for locale tracking
  const { locale } = useI18n({ useScope: 'global' });

  // Worker reference
  const worker = shallowRef<Comlink.Remote<SearchWorkerApi> | null>(null);

  // State
  const isReady = ref(false);
  const isBuilding = ref(false);
  const error = shallowRef<Error | null>(null);
  const stats = shallowRef<IndexStats | null>(null);
  const query = ref('');
  const results = shallowRef<SearchResult[]>([]);
  const isSearching = ref(false);

  // Store documents for locale rebuild
  let storedDocuments: SearchableDocument[] = [];
  let currentLocale = locale.value;

  // Initialize worker
  try {
    worker.value = getWorker(indexType);
  } catch (e) {
    error.value = e instanceof Error ? e : new Error(String(e));
  }

  /**
   * Build the search index from documents.
   */
  async function buildIndex(documents: SearchableDocument[]): Promise<IndexStats | null> {
    if (!worker.value) {
      error.value = new Error('Worker not initialized');
      return null;
    }

    isBuilding.value = true;
    error.value = null;
    storedDocuments = documents;
    currentLocale = locale.value;

    try {
      // Determine n-gram size based on locale
      const script = getScriptType(currentLocale);
      const ngramSize = getNgramSize(script);

      const buildStats = await worker.value.buildIndex(
        documents,
        { ngramSize },
        currentLocale
      );

      stats.value = buildStats;
      isReady.value = true;
      return buildStats;
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      return null;
    } finally {
      isBuilding.value = false;
    }
  }

  /**
   * Search the index (immediate, not debounced).
   */
  async function search(
    searchQuery: string,
    searchOptions: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!worker.value || !isReady.value) {
      return [];
    }

    if (searchQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    isSearching.value = true;

    try {
      const searchResults = await worker.value.search(searchQuery, searchOptions);
      return searchResults;
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      return [];
    } finally {
      isSearching.value = false;
    }
  }

  /**
   * Debounced search implementation.
   */
  const debouncedSearch = debounce(async (searchQuery: string) => {
    if (searchQuery.length < MIN_QUERY_LENGTH) {
      results.value = [];
      return;
    }

    const searchResults = await search(searchQuery);
    results.value = searchResults;
  }, debounceMs);

  /**
   * Set search query (triggers debounced search).
   */
  function setQuery(newQuery: string): void {
    query.value = newQuery;
    if (newQuery.length < MIN_QUERY_LENGTH) {
      results.value = [];
      debouncedSearch.cancel();
    } else {
      void debouncedSearch(newQuery);
    }
  }

  /**
   * Clear the index.
   */
  async function clear(): Promise<void> {
    if (!worker.value) return;

    await worker.value.clear();
    isReady.value = false;
    stats.value = null;
    results.value = [];
    storedDocuments = [];
  }

  /**
   * Rebuild index for new locale.
   */
  async function rebuildForLocale(): Promise<void> {
    if (storedDocuments.length === 0) return;
    await buildIndex(storedDocuments);
  }

  // Watch for locale changes
  if (rebuildOnLocaleChange) {
    watch(locale, async (newLocale) => {
      if (newLocale !== currentLocale && storedDocuments.length > 0) {
        await rebuildForLocale();
        // Re-run search with new index if there's a query
        if (query.value.length >= MIN_QUERY_LENGTH) {
          void debouncedSearch(query.value);
        }
      }
    });
  }

  // Build initial index if documents provided
  if (initialDocuments && initialDocuments.length > 0) {
    void buildIndex(initialDocuments);
  }

  // Cleanup on unmount
  onUnmounted(() => {
    debouncedSearch.cancel();
    releaseWorker(indexType);
  });

  // Computed helpers
  const hasResults = computed(() => results.value.length > 0);
  const resultCount = computed(() => results.value.length);
  const documentCount = computed(() => stats.value?.documentCount ?? 0);

  return {
    // State
    isReady,
    isBuilding,
    isSearching,
    error,
    stats,
    query,
    results,

    // Computed
    hasResults,
    resultCount,
    documentCount,

    // Actions
    buildIndex,
    search,
    setQuery,
    clear,
    rebuildForLocale,
  };
}
