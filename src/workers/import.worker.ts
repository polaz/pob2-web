// src/workers/import.worker.ts
// Import/export worker for build code encoding/decoding
// Handles build code parsing off the main thread

import * as Comlink from 'comlink';
import type { Build } from 'src/protos/build_pb';

/**
 * Import result
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Imported build (if successful) */
  build?: Build;
  /** Error message (if failed) */
  error?: string;
  /** Warnings during import */
  warnings: string[];
}

/**
 * Export result
 */
export interface ExportResult {
  /** Whether export was successful */
  success: boolean;
  /** Encoded build code (if successful) */
  code?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Supported import formats
 */
export type ImportFormat = 'pob' | 'pob2' | 'pathofexile' | 'unknown';

/**
 * Import worker API
 */
const importWorkerApi = {
  /**
   * Detect the format of a build code without importing.
   * Use this for UI hints (e.g., showing format icon) before user confirms import.
   * Note: importBuild() auto-detects format, so calling this first is optional.
   */
  detectFormat(_code: string): Promise<ImportFormat> {
    // TODO: Implement format detection
    // - PoB CE codes start with specific patterns
    // - PoE2 codes have different structure
    // - pathofexile.com links have URL pattern
    return Promise.resolve('unknown');
  },

  /**
   * Import a build from code string.
   * Auto-detects format - no need to call detectFormat() first.
   */
  importBuild(code: string): Promise<ImportResult> {
    // TODO: Implement build import
    // 1. Detect format
    // 2. Decode based on format
    // 3. Convert to our Build structure
    // 4. Return result

    // Check format without using this context
    const format = detectFormatSync(code);

    if (format === 'unknown') {
      return Promise.resolve({
        success: false,
        error: 'Unknown build code format',
        warnings: [],
      });
    }

    // Placeholder implementation
    return Promise.resolve({
      success: false,
      error: 'Import not yet implemented',
      warnings: [],
    });
  },

  /**
   * Import build from PoB CE format
   */
  importFromPoB(_code: string): Promise<ImportResult> {
    // TODO: Implement PoB CE import
    // PoB codes are base64-encoded, zlib-compressed XML
    return Promise.resolve({
      success: false,
      error: 'PoB import not yet implemented',
      warnings: [],
    });
  },

  /**
   * Import build from pathofexile.com profile
   */
  importFromProfile(
    _accountName: string,
    _characterName: string
  ): Promise<ImportResult> {
    // TODO: Implement profile import
    // Fetch from pathofexile.com API
    return Promise.resolve({
      success: false,
      error: 'Profile import not yet implemented',
      warnings: [],
    });
  },

  /**
   * Export build to shareable code
   */
  exportBuild(_build: Build): Promise<ExportResult> {
    // TODO: Implement build export
    // 1. Serialize build to binary (protobuf)
    // 2. Compress with zlib
    // 3. Encode to base64
    // 4. Return code

    return Promise.resolve({
      success: false,
      error: 'Export not yet implemented',
    });
  },

  /**
   * Export build to PoB CE format (for compatibility)
   */
  exportToPoB(_build: Build): Promise<ExportResult> {
    // TODO: Implement PoB CE export
    // Convert to PoB XML format for sharing with PoB users
    return Promise.resolve({
      success: false,
      error: 'PoB export not yet implemented',
    });
  },

  /**
   * Validate a build code without full import.
   * Returns both validity status and detected format.
   * Faster than importBuild() when you only need validation.
   */
  validateCode(code: string): Promise<{ valid: boolean; format: ImportFormat }> {
    const format = detectFormatSync(code);
    return Promise.resolve({
      valid: format !== 'unknown',
      format,
    });
  },

  /**
   * Health check
   */
  ping(): Promise<string> {
    return Promise.resolve('pong');
  },
};

/**
 * Synchronous format detection helper
 */
function detectFormatSync(_code: string): ImportFormat {
  // TODO: Implement format detection
  return 'unknown';
}

export type ImportWorkerApi = typeof importWorkerApi;

Comlink.expose(importWorkerApi);
