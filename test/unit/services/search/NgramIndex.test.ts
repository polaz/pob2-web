/**
 * Unit tests for NgramIndex.
 *
 * Tests n-gram extraction, indexing, and search functionality
 * including edge cases, scoring, and performance requirements.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NgramIndex } from 'src/services/search/NgramIndex';
import type { SearchableDocument } from 'src/services/search/types';

/** Create a simple test document */
function createDoc(
  id: string,
  name: string,
  type: SearchableDocument['type'] = 'gem',
  extraFields: Record<string, string> = {}
): SearchableDocument {
  return {
    id,
    type,
    fields: { name, ...extraFields },
  };
}

describe('NgramIndex', () => {
  let index: NgramIndex;

  beforeEach(() => {
    index = new NgramIndex({ ngramSize: 3 });
  });

  describe('construction', () => {
    it('should create with default config', () => {
      const defaultIndex = new NgramIndex();
      expect(defaultIndex).toBeDefined();
      expect(defaultIndex.isEmpty()).toBe(true);
    });

    it('should create with custom config', () => {
      const customIndex = new NgramIndex({
        ngramSize: 2,
        normalize: false,
        minQueryLength: 3,
      });
      expect(customIndex).toBeDefined();
    });
  });

  describe('build', () => {
    it('should build empty index', () => {
      index.build([]);
      expect(index.size).toBe(0);
      expect(index.isEmpty()).toBe(true);
    });

    it('should build index with documents', () => {
      index.build([
        createDoc('1', 'Fireball'),
        createDoc('2', 'Frostbolt'),
      ]);

      expect(index.size).toBe(2);
      expect(index.isEmpty()).toBe(false);
    });

    it('should clear existing index on rebuild', () => {
      index.build([createDoc('1', 'Fireball')]);
      expect(index.size).toBe(1);

      index.build([createDoc('2', 'Ice Storm')]);
      expect(index.size).toBe(1);
    });

    it('should index multiple fields', () => {
      index.build([
        createDoc('1', 'Fireball', 'gem', { description: 'Launches a ball of fire' }),
      ]);

      // Should match on name
      const nameResults = index.search('fireball');
      expect(nameResults.length).toBeGreaterThan(0);

      // Should match on description
      const descResults = index.search('launches');
      expect(descResults.length).toBeGreaterThan(0);
    });

    it('should store data reference', () => {
      const gem = { id: '1', name: 'Fireball', level: 20 };
      index.build([{
        id: '1',
        type: 'gem',
        fields: { name: 'Fireball' },
        data: gem,
      }]);

      const results = index.search('fire');
      expect(results[0]?.data).toEqual(gem);
    });

    it('should track build statistics', () => {
      index.build([
        createDoc('1', 'Fireball'),
        createDoc('2', 'Frostbolt'),
      ]);

      const stats = index.getStats();
      expect(stats).not.toBeNull();
      expect(stats?.documentCount).toBe(2);
      expect(stats?.ngramCount).toBeGreaterThan(0);
      expect(stats?.buildTimeMs).toBeGreaterThanOrEqual(0);
      expect(stats?.ngramSize).toBe(3);
    });
  });

  describe('search - basic', () => {
    beforeEach(() => {
      index.build([
        createDoc('1', 'Fireball'),
        createDoc('2', 'Frostbolt'),
        createDoc('3', 'Lightning Strike'),
        createDoc('4', 'Fire Trap'),
      ]);
    });

    it('should find exact matches with highest score', () => {
      const results = index.search('Fireball');

      // Fireball should be the first result (highest score)
      expect(results[0]?.id).toBe('1');
      expect(results[0]?.score).toBeGreaterThan(0.5);

      // Fire Trap may also match (shares 'fir', 'ire' n-grams) but with lower score
      if (results.length > 1) {
        expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
      }
    });

    it('should find partial matches', () => {
      const results = index.search('fire');
      expect(results.length).toBe(2);
      expect(results.map((r) => r.id)).toContain('1');
      expect(results.map((r) => r.id)).toContain('4');
    });

    it('should be case-insensitive', () => {
      const results = index.search('LIGHTNING');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('3');
    });

    it('should return empty for short queries', () => {
      const results = index.search('f');
      expect(results).toEqual([]);
    });

    it('should return empty for no matches', () => {
      const results = index.search('chaos');
      expect(results).toEqual([]);
    });

    it('should return empty on empty index', () => {
      const emptyIndex = new NgramIndex();
      const results = emptyIndex.search('fire');
      expect(results).toEqual([]);
    });
  });

  describe('search - scoring', () => {
    beforeEach(() => {
      index.build([
        createDoc('1', 'Fireball'),
        createDoc('2', 'Fire'),
        createDoc('3', 'Fires of Wrath'),
      ]);
    });

    it('should rank exact matches higher', () => {
      const results = index.search('fire');

      // 'Fire' should score highest (exact match for short text)
      expect(results[0]?.id).toBe('2');
    });

    it('should return scores between 0 and 1', () => {
      const results = index.search('fire');

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it('should sort by score descending', () => {
      const results = index.search('fire');

      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
      }
    });
  });

  describe('search - options', () => {
    beforeEach(() => {
      index.build([
        createDoc('1', 'Fireball', 'gem'),
        createDoc('2', 'Fire Trap', 'gem'),
        createDoc('3', 'Fire Node', 'node'),
        createDoc('4', 'Burning Item', 'item'),
      ]);
    });

    it('should limit results', () => {
      const results = index.search('fire', { limit: 2 });
      expect(results.length).toBe(2);
    });

    it('should filter by type', () => {
      const results = index.search('fire', { types: ['gem'] });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.type === 'gem')).toBe(true);
    });

    it('should filter by multiple types', () => {
      const results = index.search('fire', { types: ['gem', 'node'] });
      expect(results.length).toBe(3);
    });

    it('should filter by minimum score', () => {
      const results = index.search('fire', { minScore: 0.5 });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should filter by fields', () => {
      index.build([
        createDoc('1', 'Fireball', 'gem', { description: 'A powerful skill' }),
        createDoc('2', 'Ice Storm', 'gem', { description: 'Fires ice shards' }),
      ]);

      // 'fireball' only appears in doc 1's name field
      const nameOnly = index.search('fireball', { fields: ['name'] });
      expect(nameOnly.length).toBe(1);
      expect(nameOnly[0]?.id).toBe('1');

      // 'fires' only appears in doc 2's description field
      const descOnly = index.search('fires', { fields: ['description'] });
      expect(descOnly.length).toBe(1);
      expect(descOnly[0]?.id).toBe('2');
    });
  });

  describe('search - deduplication', () => {
    it('should deduplicate results by document ID', () => {
      index.build([
        createDoc('1', 'Fireball', 'gem', {
          description: 'Fire projectile',
          tags: 'fire spell projectile',
        }),
      ]);

      const results = index.search('fire');

      // Should only have one result even though 'fire' matches multiple fields
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('1');
    });

    it('should keep highest scoring match when deduplicating', () => {
      index.build([
        createDoc('1', 'Fire', 'gem', { description: 'Launches a fireball' }),
      ]);

      const results = index.search('fire');
      expect(results.length).toBe(1);

      // 'Fire' in name should score higher than 'fire' in description
      expect(results[0]?.matchedField).toBe('name');
    });
  });

  describe('search - normalization', () => {
    it('should handle diacritics', () => {
      index.build([
        createDoc('1', 'Résistance'),
        createDoc('2', 'Énergie'),
      ]);

      // Search without diacritics should match
      const results = index.search('resistance');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('1');
    });

    it('should collapse whitespace', () => {
      index.build([
        createDoc('1', 'Lightning   Strike'),
      ]);

      const results = index.search('lightning strike');
      expect(results.length).toBe(1);
    });

    it('should respect normalize: false option', () => {
      const noNormIndex = new NgramIndex({ ngramSize: 3, normalize: false });
      noNormIndex.build([
        createDoc('1', 'Fireball'),
      ]);

      // Uppercase query should not match lowercase document
      const results = noNormIndex.search('FIRE');
      expect(results.length).toBe(0);
    });
  });

  describe('search - bigrams (CJK)', () => {
    it('should work with bigrams for CJK text', () => {
      const cjkIndex = new NgramIndex({ ngramSize: 2 });
      cjkIndex.build([
        createDoc('1', '火球术'),  // Fireball in Chinese
        createDoc('2', '冰霜脉冲'), // Frostbolt-ish
      ]);

      const results = cjkIndex.search('火球');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('1');
    });

    it('should handle short text with bigrams', () => {
      // Use minQueryLength: 1 to allow single character searches for CJK
      const cjkIndex = new NgramIndex({ ngramSize: 2, minQueryLength: 1 });
      cjkIndex.build([
        createDoc('1', '火'),  // Single character
      ]);

      const results = cjkIndex.search('火');
      expect(results.length).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear the index', () => {
      index.build([createDoc('1', 'Fireball')]);
      expect(index.size).toBe(1);

      index.clear();

      expect(index.size).toBe(0);
      expect(index.isEmpty()).toBe(true);
      expect(index.getStats()).toBeNull();
    });
  });

  describe('performance', () => {
    it('should build index with 1000 documents under 500ms', () => {
      const docs: SearchableDocument[] = [];
      for (let i = 0; i < 1000; i++) {
        docs.push(createDoc(
          `gem-${i}`,
          `Test Gem ${i} with some additional text for realism`,
          'gem',
          { description: `Description for gem ${i} with various stats and modifiers` }
        ));
      }

      const start = performance.now();
      index.build(docs);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
      expect(index.size).toBe(1000);
    });

    it('should search in under 10ms', () => {
      const docs: SearchableDocument[] = [];
      for (let i = 0; i < 1000; i++) {
        docs.push(createDoc(`gem-${i}`, `Test Gem ${i}`));
      }
      index.build(docs);

      const start = performance.now();
      const results = index.search('test gem');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty field values', () => {
      index.build([{
        id: '1',
        type: 'gem',
        fields: { name: '', description: 'Valid description' },
      }]);

      const results = index.search('valid');
      expect(results.length).toBe(1);
    });

    it('should handle undefined field values', () => {
      index.build([{
        id: '1',
        type: 'gem',
        fields: { name: 'Fireball', description: undefined as unknown as string },
      }]);

      const results = index.search('fire');
      expect(results.length).toBe(1);
    });

    it('should handle special characters', () => {
      index.build([
        createDoc('1', '+50% Fire Damage'),
        createDoc('2', '10-20 Lightning Damage'),
      ]);

      // Search for 'fire' should only match doc 1
      const results = index.search('fire');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('1');

      // Search for 'lightning' should only match doc 2
      const lightning = index.search('lightning');
      expect(lightning.length).toBe(1);
      expect(lightning[0]?.id).toBe('2');
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000);
      index.build([createDoc('1', longText)]);

      const results = index.search('AAAA');
      expect(results.length).toBe(1);
    });
  });
});
