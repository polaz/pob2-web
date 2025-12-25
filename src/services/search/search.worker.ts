/**
 * Search worker for background indexing and search operations.
 *
 * Offloads heavy n-gram indexing to a Web Worker to prevent
 * blocking the main thread during index builds.
 */

import * as Comlink from 'comlink';
import { NgramIndex } from './NgramIndex';
import type {
  SearchableDocument,
  SearchResult,
  SearchOptions,
  NgramIndexConfig,
  IndexStats,
} from './types';

/**
 * Search worker API
 */
const searchWorkerApi = {
  /** The n-gram index instance */
  index: null as NgramIndex | null,

  /**
   * Build the search index from documents.
   *
   * @param documents - Documents to index
   * @param config - N-gram index configuration
   * @param locale - Locale for this index
   * @returns Index statistics after build
   */
  buildIndex(
    documents: SearchableDocument[],
    config: Partial<NgramIndexConfig> = {},
    locale = 'en-US'
  ): Promise<IndexStats> {
    this.index = new NgramIndex(config);
    this.index.build(documents, locale);
    const stats = this.index.getStats();

    if (!stats) {
      throw new Error('Index build failed - no stats available');
    }

    return Promise.resolve(stats);
  },

  /**
   * Search the index.
   *
   * @param query - Search query string
   * @param options - Search options
   * @returns Array of search results
   */
  search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.index) {
      return Promise.resolve([]);
    }

    const results = this.index.search(query, options);
    return Promise.resolve(results);
  },

  /**
   * Clear the index.
   */
  clear(): Promise<void> {
    if (this.index) {
      this.index.clear();
    }
    return Promise.resolve();
  },

  /**
   * Get index statistics.
   */
  getStats(): Promise<IndexStats | null> {
    if (!this.index) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.index.getStats());
  },

  /**
   * Check if index is ready (has documents).
   */
  isReady(): Promise<boolean> {
    return Promise.resolve(this.index !== null && !this.index.isEmpty());
  },

  /**
   * Get document count.
   */
  getDocumentCount(): Promise<number> {
    if (!this.index) {
      return Promise.resolve(0);
    }
    return Promise.resolve(this.index.size);
  },

  /**
   * Health check.
   */
  ping(): Promise<string> {
    return Promise.resolve('pong');
  },
};

export type SearchWorkerApi = typeof searchWorkerApi;

Comlink.expose(searchWorkerApi);
