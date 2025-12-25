/**
 * Search service type definitions.
 *
 * Provides interfaces for the n-gram indexed search system
 * that works across all game data types with i18n support.
 */

// Note: LocalizedString and ScriptType are used in JSDoc examples but not directly imported
// They are part of the i18n module which consumers should use alongside this search module

/**
 * Types of searchable game data.
 */
export type SearchableType = 'gem' | 'item' | 'mod' | 'node' | 'base';

/**
 * A document that can be indexed and searched.
 *
 * Each document has a unique ID, a type for filtering,
 * and a set of searchable text fields.
 */
export interface SearchableDocument {
  /** Unique identifier for the document */
  id: string;

  /** Type of game data (for filtering search results) */
  type: SearchableType;

  /**
   * Searchable text fields.
   *
   * Keys are field names (e.g., 'name', 'description', 'tags').
   * Values are the text to index and search.
   *
   * For localized data, use getLocalizedText() before indexing
   * to extract the text for the current locale.
   */
  fields: Record<string, string>;

  /**
   * Optional reference to the original data object.
   *
   * When provided, search results will include this reference
   * for direct access without additional lookups.
   */
  data?: unknown;
}

/**
 * Result from a search query.
 */
export interface SearchResult<T = unknown> {
  /** Document ID */
  id: string;

  /** Document type */
  type: SearchableType;

  /**
   * Relevance score (0-1).
   *
   * Calculated as Jaccard similarity between query n-grams
   * and document n-grams: |intersection| / |union|
   */
  score: number;

  /**
   * The field that matched the query.
   *
   * When a document has multiple searchable fields,
   * this indicates which field produced the best match.
   */
  matchedField: string;

  /**
   * The matched text from the document.
   *
   * Useful for displaying what exactly matched in the UI.
   */
  matchedText: string;

  /**
   * Reference to the original data object (if provided during indexing).
   */
  data?: T;
}

/**
 * Options for search queries.
 */
export interface SearchOptions {
  /**
   * Maximum number of results to return.
   * @default 50
   */
  limit?: number;

  /**
   * Filter results by type(s).
   *
   * When provided, only documents of matching types are returned.
   */
  types?: SearchableType[];

  /**
   * Minimum score threshold (0-1).
   *
   * Results with scores below this threshold are excluded.
   * @default 0.1
   */
  minScore?: number;

  /**
   * Fields to search within.
   *
   * When provided, only these fields are searched.
   * When omitted, all fields are searched.
   */
  fields?: string[];
}

/**
 * Configuration for the n-gram index.
 */
export interface NgramIndexConfig {
  /**
   * N-gram size for indexing.
   *
   * Typically 3 for Latin/Cyrillic (trigrams) and 2 for CJK (bigrams).
   * This is usually determined by the locale's script type.
   */
  ngramSize: number;

  /**
   * Whether to apply text normalization.
   *
   * Normalization includes:
   * - Lowercase conversion
   * - Diacritic removal (NFD decomposition + combining mark removal)
   * - Whitespace collapsing
   *
   * @default true
   */
  normalize?: boolean;

  /**
   * Minimum query length to perform search.
   *
   * Queries shorter than this return empty results.
   * @default 2
   */
  minQueryLength?: number;
}

/**
 * Statistics about an n-gram index.
 */
export interface IndexStats {
  /** Number of documents indexed */
  documentCount: number;

  /** Number of unique n-grams in the index */
  ngramCount: number;

  /** Total size of the index in bytes (approximate) */
  sizeBytes: number;

  /** Time taken to build the index in milliseconds */
  buildTimeMs: number;

  /** The n-gram size used */
  ngramSize: number;

  /** The locale for which this index was built */
  locale: string;
}

/**
 * Messages sent to the search worker.
 */
export type SearchWorkerRequest =
  | { type: 'build'; documents: SearchableDocument[]; config: NgramIndexConfig; locale: string }
  | { type: 'search'; query: string; options?: SearchOptions }
  | { type: 'clear' }
  | { type: 'stats' };

/**
 * Messages received from the search worker.
 */
export type SearchWorkerResponse =
  | { type: 'built'; stats: IndexStats }
  | { type: 'results'; results: SearchResult[] }
  | { type: 'cleared' }
  | { type: 'stats'; stats: IndexStats | null }
  | { type: 'error'; message: string };

/**
 * Options for the useSearchIndex composable.
 */
export interface UseSearchIndexOptions {
  /**
   * The type of data being indexed.
   *
   * Used to create separate indexes for different data types.
   */
  indexType: SearchableType | 'mixed';

  /**
   * Initial documents to index.
   *
   * If not provided, call `buildIndex()` manually to populate the index.
   */
  initialDocuments?: SearchableDocument[];

  /**
   * Whether to automatically rebuild the index when locale changes.
   * @default true
   */
  rebuildOnLocaleChange?: boolean;

  /**
   * Debounce delay for search queries in milliseconds.
   * @default 150
   */
  debounceMs?: number;
}

/**
 * Helper type for creating searchable documents from game data.
 *
 * @example
 * function gemToSearchable(gem: Gem, locale: string): SearchableDocument {
 *   return {
 *     id: gem.id,
 *     type: 'gem',
 *     fields: {
 *       name: getLocalizedText(gem.localizedName, locale),
 *       tags: gem.tags.join(' '),
 *     },
 *     data: gem,
 *   };
 * }
 */
export type DocumentFactory<T> = (item: T, locale: string) => SearchableDocument;
