// src/workers/parser.worker.ts
// Parser worker for modifier and item text parsing
// Handles text parsing operations off the main thread

import * as Comlink from 'comlink';
import type { Item } from 'src/protos/pob2_pb';
import type { Modifier, ModSource } from 'src/shared/modifiers';

/**
 * Parse result for a single mod line
 */
export interface ModParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed modifier (if successful) */
  modifier?: Modifier;
  /** Original text */
  originalText: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Item parse result
 */
export interface ItemParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed item (if successful) */
  item?: Item;
  /** Parsed modifiers from the item */
  modifiers: Modifier[];
  /** Error message (if failed) */
  error?: string;
  /** Warnings during parsing */
  warnings: string[];
}

/**
 * Parser worker API
 */
const parserWorkerApi = {
  /**
   * Parse a single modifier line
   * @param text - Modifier text (e.g., "+50 to Maximum Life")
   * @param _source - Source of the modifier
   * @param _sourceLabel - Label for the source
   */
  parseModifier(
    text: string,
    _source: ModSource = 'ITEM' as ModSource,
    _sourceLabel?: string
  ): Promise<ModParseResult> {
    // TODO: Implement modifier parsing
    // This will use regex patterns and mod data to parse text
    return Promise.resolve({
      success: false,
      originalText: text,
      error: 'Modifier parsing not yet implemented',
    });
  },

  /**
   * Parse multiple modifier lines
   */
  parseModifiers(
    texts: string[],
    _source: ModSource = 'ITEM' as ModSource,
    _sourceLabel?: string
  ): Promise<ModParseResult[]> {
    const results: ModParseResult[] = texts.map((text) => ({
      success: false,
      originalText: text,
      error: 'Modifier parsing not yet implemented',
    }));
    return Promise.resolve(results);
  },

  /**
   * Parse item from clipboard text (PoE item copy format)
   */
  parseItem(_clipboardText: string): Promise<ItemParseResult> {
    // TODO: Implement item parsing
    // Parse PoE item copy format (Ctrl+C on item)
    // Format:
    // Item Class: ...
    // Rarity: ...
    // Name
    // Base Type
    // --------
    // Stats...

    return Promise.resolve({
      success: false,
      modifiers: [],
      error: 'Item parsing not yet implemented',
      warnings: [],
    });
  },

  /**
   * Parse passive node stats
   */
  parseNodeStats(
    _stats: string[],
    _nodeId: string
  ): Promise<Modifier[]> {
    // TODO: Implement node stat parsing
    // Parse passive node stat descriptions into modifiers
    return Promise.resolve([]);
  },

  /**
   * Parse gem stats at a given level
   */
  parseGemStats(
    _gemId: string,
    _level: number,
    _quality: number
  ): Promise<Modifier[]> {
    // TODO: Implement gem stat parsing
    return Promise.resolve([]);
  },

  /**
   * Normalize stat text for comparison
   * Removes variable numbers, normalizes whitespace
   */
  normalizeStatText(text: string): Promise<string> {
    // Replace numbers with placeholder
    let normalized = text.replace(/[+-]?\d+(\.\d+)?/g, '#');
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    // Lowercase
    normalized = normalized.toLowerCase();
    return Promise.resolve(normalized);
  },

  /**
   * Extract numbers from stat text
   */
  extractNumbers(text: string): Promise<number[]> {
    const matches = text.match(/[+-]?\d+(\.\d+)?/g);
    if (!matches) return Promise.resolve([]);
    return Promise.resolve(matches.map((m) => parseFloat(m)));
  },

  /**
   * Health check
   */
  ping(): Promise<string> {
    return Promise.resolve('pong');
  },
};

export type ParserWorkerApi = typeof parserWorkerApi;

Comlink.expose(parserWorkerApi);
