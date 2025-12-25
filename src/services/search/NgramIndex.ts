/**
 * N-gram based search index for fast fuzzy text search.
 *
 * Uses n-gram tokenization for language-agnostic fuzzy matching.
 * Scores results using Jaccard similarity (intersection over union).
 *
 * Performance targets:
 * - Index build: < 500ms for 1000 documents
 * - Search query: < 10ms
 * - Memory: < 500KB per locale index
 */

import type {
  SearchableDocument,
  SearchResult,
  SearchOptions,
  NgramIndexConfig,
  IndexStats,
} from './types';

/** Default configuration values */
const DEFAULT_NGRAM_SIZE = 3;
const DEFAULT_MIN_QUERY_LENGTH = 2;
const DEFAULT_MIN_SCORE = 0.1;
const DEFAULT_LIMIT = 50;

/**
 * Stored document data for result reconstruction.
 */
interface StoredDocument {
  id: string;
  type: SearchableDocument['type'];
  fields: Map<string, { text: string; ngrams: Set<string> }>;
  data?: unknown;
}

/**
 * N-gram based search index.
 *
 * @example
 * const index = new NgramIndex({ ngramSize: 3 });
 *
 * index.build([
 *   { id: '1', type: 'gem', fields: { name: 'Fireball' } },
 *   { id: '2', type: 'gem', fields: { name: 'Frostbolt' } },
 * ]);
 *
 * const results = index.search('fire');
 * // [{ id: '1', type: 'gem', score: 0.75, matchedField: 'name', ... }]
 */
export class NgramIndex {
  private readonly ngramSize: number;
  private readonly normalize: boolean;
  private readonly minQueryLength: number;

  /** Inverted index: ngram -> Set of (docId, fieldName) pairs */
  private readonly invertedIndex = new Map<string, Set<string>>();

  /** Document storage for result reconstruction */
  private readonly documents = new Map<string, StoredDocument>();

  /** Build statistics */
  private stats: IndexStats | null = null;

  constructor(config: Partial<NgramIndexConfig> = {}) {
    this.ngramSize = config.ngramSize ?? DEFAULT_NGRAM_SIZE;
    this.normalize = config.normalize ?? true;
    this.minQueryLength = config.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
  }

  /**
   * Build the index from a set of documents.
   *
   * Clears any existing index data before building.
   *
   * @param documents - Documents to index
   * @param locale - Locale for statistics tracking
   */
  build(documents: SearchableDocument[], locale = 'en-US'): void {
    const startTime = performance.now();

    // Clear existing data
    this.invertedIndex.clear();
    this.documents.clear();

    // Index each document
    for (const doc of documents) {
      this.indexDocument(doc);
    }

    // Calculate stats
    const buildTimeMs = performance.now() - startTime;
    this.stats = {
      documentCount: this.documents.size,
      ngramCount: this.invertedIndex.size,
      sizeBytes: this.estimateSize(),
      buildTimeMs,
      ngramSize: this.ngramSize,
      locale,
    };
  }

  /**
   * Search the index for matching documents.
   *
   * @param query - Search query string
   * @param options - Search options
   * @returns Sorted array of search results (best matches first)
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const {
      limit = DEFAULT_LIMIT,
      types,
      minScore = DEFAULT_MIN_SCORE,
      fields: searchFields,
    } = options;

    // Check minimum query length
    const normalizedQuery = this.normalizeText(query);
    if (normalizedQuery.length < this.minQueryLength) {
      return [];
    }

    // Extract query n-grams
    const queryNgrams = this.extractNgrams(normalizedQuery);
    if (queryNgrams.size === 0) {
      return [];
    }

    // Find candidate documents via inverted index
    const candidates = this.findCandidates(queryNgrams);

    // Score each candidate
    const results: SearchResult[] = [];

    for (const docKey of candidates) {
      const [docId, fieldName] = this.parseDocKey(docKey);
      const doc = this.documents.get(docId);

      if (!doc) continue;

      // Apply type filter
      if (types && types.length > 0 && !types.includes(doc.type)) {
        continue;
      }

      // Apply field filter
      if (searchFields && searchFields.length > 0 && !searchFields.includes(fieldName)) {
        continue;
      }

      const fieldData = doc.fields.get(fieldName);
      if (!fieldData) continue;

      // Calculate Jaccard similarity
      const score = this.calculateScore(queryNgrams, fieldData.ngrams);

      if (score >= minScore) {
        results.push({
          id: doc.id,
          type: doc.type,
          score,
          matchedField: fieldName,
          matchedText: fieldData.text,
          data: doc.data,
        });
      }
    }

    // Deduplicate by document ID (keep highest scoring match per document)
    const deduped = this.deduplicateResults(results);

    // Sort by score descending
    deduped.sort((a, b) => b.score - a.score);

    // Apply limit
    return deduped.slice(0, limit);
  }

  /**
   * Clear the index.
   */
  clear(): void {
    this.invertedIndex.clear();
    this.documents.clear();
    this.stats = null;
  }

  /**
   * Get index statistics.
   */
  getStats(): IndexStats | null {
    return this.stats;
  }

  /**
   * Check if the index is empty.
   */
  isEmpty(): boolean {
    return this.documents.size === 0;
  }

  /**
   * Get the number of indexed documents.
   */
  get size(): number {
    return this.documents.size;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Index a single document.
   */
  private indexDocument(doc: SearchableDocument): void {
    const storedDoc: StoredDocument = {
      id: doc.id,
      type: doc.type,
      fields: new Map(),
      data: doc.data,
    };

    for (const [fieldName, text] of Object.entries(doc.fields)) {
      if (!text || typeof text !== 'string') continue;

      const normalizedText = this.normalizeText(text);
      const ngrams = this.extractNgrams(normalizedText);

      // Store field data
      storedDoc.fields.set(fieldName, { text, ngrams });

      // Add to inverted index
      const docKey = this.createDocKey(doc.id, fieldName);
      for (const ngram of ngrams) {
        let docSet = this.invertedIndex.get(ngram);
        if (!docSet) {
          docSet = new Set();
          this.invertedIndex.set(ngram, docSet);
        }
        docSet.add(docKey);
      }
    }

    this.documents.set(doc.id, storedDoc);
  }

  /**
   * Normalize text for indexing and search.
   *
   * - Converts to lowercase
   * - Removes diacritics (accents)
   * - Collapses whitespace
   */
  private normalizeText(text: string): string {
    if (!this.normalize) {
      return text;
    }

    return (
      text
        .toLowerCase()
        // NFD decomposition separates base characters from combining marks
        .normalize('NFD')
        // Remove combining diacritical marks (accents)
        .replace(/[\u0300-\u036f]/g, '')
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Extract n-grams from text.
   *
   * For text shorter than n-gram size, includes the entire text as a single gram.
   */
  private extractNgrams(text: string): Set<string> {
    const ngrams = new Set<string>();

    if (text.length === 0) {
      return ngrams;
    }

    // For short text, use the entire string
    if (text.length < this.ngramSize) {
      ngrams.add(text);
      return ngrams;
    }

    // Extract overlapping n-grams
    for (let i = 0; i <= text.length - this.ngramSize; i++) {
      const ngram = text.slice(i, i + this.ngramSize);
      ngrams.add(ngram);
    }

    return ngrams;
  }

  /**
   * Find candidate documents that share n-grams with the query.
   */
  private findCandidates(queryNgrams: Set<string>): Set<string> {
    const candidates = new Set<string>();

    for (const ngram of queryNgrams) {
      const docSet = this.invertedIndex.get(ngram);
      if (docSet) {
        for (const docKey of docSet) {
          candidates.add(docKey);
        }
      }
    }

    return candidates;
  }

  /**
   * Calculate Jaccard similarity between two n-gram sets.
   *
   * Jaccard = |A ∩ B| / |A ∪ B|
   *
   * Returns a value between 0 (no overlap) and 1 (identical).
   */
  private calculateScore(queryNgrams: Set<string>, docNgrams: Set<string>): number {
    if (queryNgrams.size === 0 || docNgrams.size === 0) {
      return 0;
    }

    // Count intersection
    let intersectionSize = 0;
    for (const ngram of queryNgrams) {
      if (docNgrams.has(ngram)) {
        intersectionSize++;
      }
    }

    // Union size = |A| + |B| - |A ∩ B|
    const unionSize = queryNgrams.size + docNgrams.size - intersectionSize;

    return intersectionSize / unionSize;
  }

  /**
   * Create a composite key for document + field.
   */
  private createDocKey(docId: string, fieldName: string): string {
    return `${docId}\0${fieldName}`;
  }

  /**
   * Parse a composite key back to document ID and field name.
   */
  private parseDocKey(key: string): [string, string] {
    const separatorIndex = key.indexOf('\0');
    if (separatorIndex === -1) {
      return [key, ''];
    }
    return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)];
  }

  /**
   * Deduplicate results by document ID, keeping the highest score.
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const byId = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = byId.get(result.id);
      if (!existing || result.score > existing.score) {
        byId.set(result.id, result);
      }
    }

    return Array.from(byId.values());
  }

  /**
   * Estimate the memory size of the index in bytes.
   *
   * This is a rough approximation for monitoring purposes.
   */
  private estimateSize(): number {
    let size = 0;

    // Inverted index: estimate key + value overhead
    for (const [ngram, docSet] of this.invertedIndex) {
      // Key: string bytes + Map overhead (~50 bytes)
      size += ngram.length * 2 + 50;
      // Value: Set with string references (~40 bytes per entry)
      size += docSet.size * 40;
    }

    // Documents: estimate stored data
    for (const doc of this.documents.values()) {
      // Base overhead
      size += 100;
      // Fields
      for (const [fieldName, fieldData] of doc.fields) {
        size += fieldName.length * 2;
        size += fieldData.text.length * 2;
        size += fieldData.ngrams.size * 20;
      }
    }

    return size;
  }
}
