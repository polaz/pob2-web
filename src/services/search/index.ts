/**
 * N-gram indexed search service.
 *
 * Provides fast, fuzzy text search for game data with full i18n support.
 *
 * @example
 * // In a component
 * import { useSearchIndex } from 'src/services/search';
 *
 * const gemSearch = useSearchIndex({ indexType: 'gem' });
 *
 * // Build index with game data
 * await gemSearch.buildIndex(gemDocuments);
 *
 * // Search (debounced via setQuery)
 * gemSearch.setQuery('fireball');
 * // Results in gemSearch.results
 *
 * @example
 * // Direct NgramIndex usage (for testing or worker-less scenarios)
 * import { NgramIndex } from 'src/services/search';
 *
 * const index = new NgramIndex({ ngramSize: 3 });
 * index.build(documents);
 * const results = index.search('query');
 */

// Core algorithm
export { NgramIndex } from './NgramIndex';

// Vue composable
export { useSearchIndex } from './useSearchIndex';

// Types
export type {
  SearchableType,
  SearchableDocument,
  SearchResult,
  SearchOptions,
  NgramIndexConfig,
  IndexStats,
  UseSearchIndexOptions,
  DocumentFactory,
} from './types';
