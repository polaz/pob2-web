/**
 * ModParser - Text to Modifier Parser
 *
 * Converts modifier text strings into Mod objects for calculations.
 * Uses a data-driven approach with strict separation of data (JSON) and logic (TypeScript).
 *
 * ## Usage
 *
 * ```typescript
 * const parser = new ModParser(data);
 *
 * // Parse a single modifier
 * const result = parser.parse('+50 to Maximum Life', { source: 'item', sourceId: 'item1' });
 * if (result.success) {
 *   db.addList(result.mods);
 * }
 *
 * // Parse multiple modifiers from item text
 * const results = parser.parseLines(itemText, context);
 * ```
 *
 * ## Support Levels
 *
 * - `full`: Fully parsed and calculated
 * - `partial`: Parsed but calculation incomplete
 * - `display_only`: Recognized but not calculated
 * - `unsupported`: Unknown mod (shown as warning)
 */

import type { ModCondition, ModDefinition, ModEffect } from 'src/types/mods';
import { ModFlag, KeywordFlag } from 'src/types/mods';
import type {
  Mod,
  FormPattern,
  ModParserData,
  ModParseContext,
  ParseResult,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Default flags value (applies to all) */
const NO_FLAGS = 0n;

/**
 * Factory for pattern used to extract numeric values from mod text.
 *
 * Returns a fresh RegExp instance on each call to avoid shared `lastIndex`
 * state from the `/g` flag causing cross-call interference.
 */
const createValuePattern = (): RegExp =>
  /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)|(\d+(?:\.\d+)?)/g;

// ============================================================================
// ModParser Class
// ============================================================================

/**
 * Parses modifier text into Mod objects.
 *
 * IMPORTANT: This class contains NO hardcoded patterns or mappings.
 * All patterns are loaded from data files at runtime.
 */
export class ModParser {
  /** Compiled regex patterns for matching */
  private readonly patterns: Array<{ pattern: FormPattern; regex: RegExp }>;

  /** Text to canonical stat name mappings */
  private readonly statMappings: Map<string, string>;

  /** Text to ModFlag values */
  private readonly flagMappings: Map<string, string | string[]>;

  /** Text to KeywordFlag values */
  private readonly keywordMappings: Map<string, string | string[]>;

  /** Text to condition structures */
  private readonly conditionMappings: Map<string, ModCondition>;

  /** Pre-parsed mod cache */
  private readonly modCache: Map<string, ModDefinition>;

  /**
   * Create a new ModParser instance.
   *
   * @param data - Data files containing patterns and mappings
   */
  constructor(data: ModParserData) {
    // Compile regex patterns
    this.patterns = data.patterns.map((pattern) => ({
      pattern,
      regex: new RegExp(pattern.regex, 'i'),
    }));

    // Build lookup maps (lowercase keys for case-insensitive matching)
    this.statMappings = new Map(
      Object.entries(data.statMappings).map(([k, v]) => [k.toLowerCase(), v])
    );
    this.flagMappings = new Map(
      Object.entries(data.flagMappings).map(([k, v]) => [k.toLowerCase(), v])
    );
    this.keywordMappings = new Map(
      Object.entries(data.keywordMappings).map(([k, v]) => [k.toLowerCase(), v])
    );
    this.conditionMappings = new Map(
      Object.entries(data.conditionMappings).map(([k, v]) => [k.toLowerCase(), v])
    );

    // Build mod cache (normalize keys based on mod text, not cache key)
    this.modCache = new Map(
      Object.entries(data.modCache).map(([_k, v]) => [this.normalizeText(v.text), v])
    );
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Parse a single modifier text line.
   *
   * Strategy:
   * 1. Try cache lookup (exact match after normalization)
   * 2. Fall back to pattern matching
   * 3. Return "unsupported" result if all else fails
   *
   * @param text - The modifier text to parse
   * @param context - Context for the modifier (source, sourceId)
   * @returns Parse result with mods and support level
   */
  parse(text: string, context: ModParseContext): ParseResult {
    // Normalize text for matching
    const normalized = this.normalizeText(text);

    if (!normalized) {
      return this.unsupportedResult(text, 'Empty text');
    }

    // 1. Try cache lookup
    const cached = this.lookupCache(normalized, text);
    if (cached) {
      return this.buildFromCache(cached, text, context);
    }

    // 2. Try pattern matching
    const patternResult = this.tryPatterns(normalized, text, context);
    if (patternResult) {
      return patternResult;
    }

    // 3. Unsupported mod
    return this.unsupportedResult(text, 'No matching pattern');
  }

  /**
   * Parse multiple lines of modifier text.
   *
   * @param text - Multi-line modifier text (e.g., from an item)
   * @param context - Context for the modifiers
   * @returns Array of parse results, one per line
   */
  parseLines(text: string, context: ModParseContext): ParseResult[] {
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => this.parse(line, context));
  }

  /**
   * Get stats about the parser's data.
   *
   * @returns Statistics about loaded patterns and cache
   */
  getStats(): { patterns: number; statMappings: number; modCache: number } {
    return {
      patterns: this.patterns.length,
      statMappings: this.statMappings.size,
      modCache: this.modCache.size,
    };
  }

  // ==========================================================================
  // Cache Lookup
  // ==========================================================================

  /**
   * Look up a mod in the cache.
   *
   * Only matches exact text or range patterns (e.g., "(15-25)%" matching "20%").
   * Does NOT match arbitrary values to avoid false positives.
   *
   * @param normalized - Normalized text for lookup
   * @param _original - Original text (unused, for future value extraction)
   * @returns Cached definition or null
   */
  private lookupCache(normalized: string, _original: string): ModDefinition | null {
    // Try exact match first
    const exact = this.modCache.get(normalized);
    if (exact) {
      return exact;
    }

    // Try matching range patterns: "(X-Y)% increased Foo" should match "Z% increased Foo"
    // where Z is within the range X-Y
    for (const [key, def] of this.modCache) {
      if (this.matchesRangePattern(key, normalized)) {
        return def;
      }
    }

    return null;
  }

  /**
   * Check if input text matches a cached range pattern.
   *
   * E.g., "20% increased fire damage" matches "(15-25)% increased fire damage"
   * but only if 20 is within the range 15-25.
   */
  private matchesRangePattern(cacheKey: string, input: string): boolean {
    // Check if cache key has a range pattern
    const rangeMatch = /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/.exec(cacheKey);
    if (!rangeMatch || !rangeMatch[1] || !rangeMatch[2]) {
      return false;
    }

    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);

    // Replace range in cache key with a single value placeholder
    const keyPattern = cacheKey.replace(
      /\(\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/,
      '(\\d+(?:\\.\\d+)?)'
    );

    try {
      const regex = new RegExp(`^${keyPattern}$`, 'i');
      const inputMatch = regex.exec(input);

      if (inputMatch && inputMatch[1]) {
        const inputValue = parseFloat(inputMatch[1]);
        // Value must be within range (inclusive)
        return inputValue >= min && inputValue <= max;
      }
    } catch {
      // Invalid regex, skip this pattern
    }

    return false;
  }

  /**
   * Build parse result from cached definition.
   */
  private buildFromCache(
    def: ModDefinition,
    originalText: string,
    context: ModParseContext
  ): ParseResult {
    // No effects = display only
    if (!def.effects || def.effects.length === 0) {
      return {
        success: true,
        mods: [],
        supportLevel: 'display_only',
        originalText,
      };
    }

    // Extract actual values from original text
    const values = this.extractValues(originalText);

    // Extract flags from original text (in case cache doesn't have them)
    const textFlags = this.extractFlags(originalText);

    const mods = this.effectsToMods(def.effects, values, context, textFlags);

    return {
      success: true,
      mods,
      supportLevel: 'full',
      originalText,
    };
  }

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  /**
   * Try all patterns against the text.
   */
  private tryPatterns(
    normalized: string,
    originalText: string,
    context: ModParseContext
  ): ParseResult | null {
    for (const { pattern, regex } of this.patterns) {
      const match = regex.exec(normalized);
      if (match) {
        return this.buildFromPattern(pattern, match, originalText, context);
      }
    }
    return null;
  }

  /**
   * Build parse result from pattern match.
   */
  private buildFromPattern(
    pattern: FormPattern,
    match: RegExpExecArray,
    originalText: string,
    context: ModParseContext
  ): ParseResult {
    const warnings: string[] = [];

    // Extract value(s)
    let value: number;
    if (pattern.valueGroups && pattern.valueGroups.length >= 2) {
      // Multiple values (e.g., damage range) - use average
      const idx1 = pattern.valueGroups[0]!;
      const idx2 = pattern.valueGroups[1]!;
      const val1 = parseFloat(match[idx1] ?? '0');
      const val2 = parseFloat(match[idx2] ?? '0');
      value = (val1 + val2) / 2; // Average for ranges
    } else if (pattern.valueGroup) {
      value = parseFloat(match[pattern.valueGroup] ?? '0');
    } else {
      value = 1; // FLAG type, no value needed
    }

    // Apply value scale
    if (pattern.valueScale !== undefined) {
      value *= pattern.valueScale;
    }

    // Extract stat name
    let statName: string;
    if (pattern.statGroup) {
      const rawStat = match[pattern.statGroup] ?? '';
      statName = this.mapStatName(rawStat.toLowerCase());
      if (!statName) {
        warnings.push(`Unknown stat: ${rawStat}`);
        statName = this.toCanonicalName(rawStat);
      }
    } else if (pattern.outputStats) {
      // Complex pattern with multiple output stats - use first for simple case
      statName = pattern.outputStats[0] ?? 'Unknown';
    } else {
      statName = 'Unknown';
      warnings.push('Pattern has no stat group');
    }

    // Extract flags from remaining text
    const { flags, keywordFlags } = this.extractFlags(originalText);

    // Extract conditions
    const condition = this.extractCondition(originalText);

    const mod: Mod = {
      name: statName,
      type: pattern.type,
      value,
      flags,
      keywordFlags,
      source: context.source,
      sourceId: context.sourceId,
      ...(condition && { condition }),
    };

    return {
      success: true,
      mods: [mod],
      supportLevel: warnings.length > 0 ? 'partial' : 'full',
      originalText,
      ...(warnings.length > 0 && { warnings }),
    };
  }

  // ==========================================================================
  // Effect Conversion
  // ==========================================================================

  /**
   * Convert ModEffect array to Mod array.
   *
   * @param effects - Effects from cached definition
   * @param values - Values extracted from original text
   * @param context - Parse context
   * @param textFlags - Optional flags extracted from original text
   */
  private effectsToMods(
    effects: ModEffect[],
    values: number[],
    context: ModParseContext,
    textFlags?: { flags: bigint; keywordFlags: bigint }
  ): Mod[] {
    let valueIndex = 0;

    return effects.map((effect) => {
      // Get value from extracted values first, then fall back to effect value
      let value: number;
      if (values.length > valueIndex) {
        value = values[valueIndex++]!;
      } else if (typeof effect.value === 'number') {
        value = effect.value;
      } else {
        value = 0;
      }

      // Convert flags to bigint, merge with text-extracted flags
      let flags = this.convertFlags(effect.flags);
      let keywordFlags = this.convertKeywordFlags(effect.keywordFlags);

      // Merge with text-extracted flags (OR them together)
      if (textFlags) {
        flags |= textFlags.flags;
        keywordFlags |= textFlags.keywordFlags;
      }

      return {
        name: effect.name,
        type: effect.type,
        value,
        flags,
        keywordFlags,
        source: context.source,
        sourceId: context.sourceId,
        ...(effect.condition && { condition: effect.condition }),
        ...(effect.tag && { tag: effect.tag }),
      };
    });
  }

  // ==========================================================================
  // Text Normalization
  // ==========================================================================

  /**
   * Normalize text for consistent matching.
   *
   * - Lowercase
   * - Trim whitespace
   * - Normalize whitespace (multiple spaces → single)
   * - Remove trailing periods
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\.+$/, '');
  }

  /**
   * Extract numeric values from text.
   */
  private extractValues(text: string): number[] {
    const values: number[] = [];
    const pattern = createValuePattern();
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[2]) {
        // Range: (X-Y) - take average
        const min = parseFloat(match[1]);
        const max = parseFloat(match[2]);
        values.push((min + max) / 2);
      } else if (match[3]) {
        // Single value
        values.push(parseFloat(match[3]));
      }
    }

    return values;
  }

  // ==========================================================================
  // Flag Extraction
  // ==========================================================================

  /**
   * Check if text contains a phrase with word boundaries.
   *
   * Uses word boundary regex to avoid false positives like "fire" matching "bonfire".
   */
  private containsPhrase(text: string, phrase: string): boolean {
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedPhrase}\\b`, 'i');
    return pattern.test(text);
  }

  /**
   * Extract ModFlags from text.
   *
   * Uses word boundary matching to avoid false positives.
   */
  private extractFlags(text: string): { flags: bigint; keywordFlags: bigint } {
    let flags = NO_FLAGS;
    let keywordFlags = NO_FLAGS;

    // Check for mod flags (use word boundary matching)
    for (const [phrase, flagName] of this.flagMappings) {
      if (this.containsPhrase(text, phrase)) {
        const flagValues = Array.isArray(flagName) ? flagName : [flagName];
        for (const name of flagValues) {
          const flag = ModFlag[name as keyof typeof ModFlag];
          if (flag !== undefined) {
            flags |= flag;
          }
        }
      }
    }

    // Check for keyword flags (use word boundary matching)
    for (const [phrase, flagName] of this.keywordMappings) {
      if (this.containsPhrase(text, phrase)) {
        const flagValues = Array.isArray(flagName) ? flagName : [flagName];
        for (const name of flagValues) {
          const flag = KeywordFlag[name as keyof typeof KeywordFlag];
          if (flag !== undefined) {
            keywordFlags |= flag;
          }
        }
      }
    }

    return { flags, keywordFlags };
  }

  /**
   * Extract condition from text.
   *
   * Matches longer/more specific phrases first by sorting entries by length.
   * Uses word boundary matching to avoid false positives.
   */
  private extractCondition(text: string): ModCondition | undefined {
    // Sort by phrase length descending to match more specific phrases first
    const sortedConditions = [...this.conditionMappings.entries()].sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [phrase, condition] of sortedConditions) {
      if (this.containsPhrase(text, phrase)) {
        return condition;
      }
    }

    return undefined;
  }

  // ==========================================================================
  // Stat Name Mapping
  // ==========================================================================

  /**
   * Map raw stat text to canonical stat name.
   *
   * Uses word boundary matching for partial matches to avoid false positives.
   * Prefers longer matches (more specific) when multiple patterns match.
   */
  private mapStatName(rawStat: string): string {
    const normalized = rawStat.toLowerCase().trim();

    // Fast path: exact match
    const exact = this.statMappings.get(normalized);
    if (exact) {
      return exact;
    }

    // Refined partial match with word boundaries
    // Prefer the longest matching key (more specific mapping)
    let bestMatch: { value: string; score: number } | undefined;

    for (const [key, value] of this.statMappings) {
      const keyLower = key.toLowerCase().trim();
      if (!keyLower) {
        continue;
      }

      // Use word boundary regex to avoid false positives
      const escapedKey = keyLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escapedKey}\\b`, 'i');

      if (pattern.test(normalized)) {
        const score = keyLower.length;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { value, score };
        }
      }
    }

    return bestMatch ? bestMatch.value : '';
  }

  /**
   * Convert raw stat text to canonical name format.
   *
   * E.g., "maximum life" → "MaximumLife"
   */
  private toCanonicalName(text: string): string {
    return text
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  // ==========================================================================
  // Flag Conversion
  // ==========================================================================

  /**
   * Convert flags from number/bigint to bigint.
   */
  private convertFlags(flags: number | bigint | undefined): bigint {
    if (flags === undefined) {
      return NO_FLAGS;
    }
    return typeof flags === 'bigint' ? flags : BigInt(flags);
  }

  /**
   * Convert keyword flags from number/bigint to bigint.
   *
   * Delegates to {@link convertFlags} to ensure a single source of truth
   * for flag normalization.
   */
  private convertKeywordFlags(flags: number | bigint | undefined): bigint {
    return this.convertFlags(flags);
  }

  // ==========================================================================
  // Result Builders
  // ==========================================================================

  /**
   * Create an unsupported result.
   */
  private unsupportedResult(originalText: string, reason: string): ParseResult {
    return {
      success: false,
      mods: [],
      supportLevel: 'unsupported',
      originalText,
      reason,
    };
  }
}
