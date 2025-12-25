/**
 * Build Code Encode/Decode for PoB2 Compatibility.
 *
 * This module provides functions to encode and decode build codes that are
 * compatible with Path of Building 2 (PoB2).
 *
 * Build Code Format:
 * 1. Serialize build to XML
 * 2. Compress with zlib deflate
 * 3. Encode with base64
 * 4. Replace + with - and / with _ (URL-safe)
 *
 * @module buildCode
 */

import { deflateSync, inflateSync } from 'fflate';
import type { Build } from 'src/protos/pob2_pb';
import { buildToXml, xmlToBuild } from './buildXml';

// =============================================================================
// Types
// =============================================================================

/** Error types for build code operations */
export type BuildCodeErrorType =
  | 'INVALID_FORMAT'
  | 'DECODE_FAILED'
  | 'DECOMPRESS_FAILED'
  | 'INVALID_XML'
  | 'MISSING_REQUIRED_FIELD';

/** Build code error with type and message */
export interface BuildCodeError {
  type: BuildCodeErrorType;
  message: string;
}

/** Successful decode result */
export interface DecodeSuccess {
  success: true;
  build: Build;
  /** The intermediate XML string (useful for debugging) */
  xml: string;
}

/** Failed decode result */
export interface DecodeFailure {
  success: false;
  error: BuildCodeError;
}

/** Result of decoding a build code */
export type DecodeResult = DecodeSuccess | DecodeFailure;

/** Options for encoding build codes */
export interface EncodeOptions {
  /**
   * Compression level (0-9).
   * Higher = smaller output but slower.
   * Default: 6 (balanced)
   */
  compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

// =============================================================================
// Base64 Encoding/Decoding
// =============================================================================

/**
 * Encode Uint8Array to base64 string.
 * Uses browser's btoa with proper binary handling.
 *
 * Note: Array.from with join is used for readability. For typical build codes (~10-50KB),
 * the performance difference vs a for-loop is negligible (<1ms). If encoding very large
 * payloads becomes a bottleneck, consider switching to a for-loop with string concatenation.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

/**
 * Decode base64 string to Uint8Array.
 * Uses browser's atob with proper binary handling.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert standard base64 to URL-safe base64.
 * Replaces + with - and / with _
 */
function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Convert URL-safe base64 back to standard base64.
 * Replaces - with + and _ with /
 */
function fromUrlSafeBase64(urlSafe: string): string {
  return urlSafe.replace(/-/g, '+').replace(/_/g, '/');
}

// =============================================================================
// Validation
// =============================================================================

/** Regex pattern for valid build code characters (URL-safe base64) */
const BUILD_CODE_PATTERN = /^[A-Za-z0-9_-]+=*$/;

/**
 * Minimum length for a valid build code string.
 *
 * PoB2 build codes are compressed XML encoded as base64. Even the smallest
 * valid build (empty tree, no items) produces a code of ~50+ characters.
 * Strings shorter than 10 characters cannot possibly contain valid compressed
 * XML data and are almost certainly user errors (partial paste, random text).
 * We fail fast to avoid expensive decompression attempts on invalid input.
 */
const MIN_BUILD_CODE_LENGTH = 10;

/**
 * Check if a string looks like a valid build code.
 * Does not verify the content, just the format.
 */
export function isValidBuildCodeFormat(code: string): boolean {
  if (!code || code.length < MIN_BUILD_CODE_LENGTH) {
    return false;
  }
  return BUILD_CODE_PATTERN.test(code);
}

/**
 * Check if decompressed content looks like valid PoB2 XML.
 *
 * We check for <PathOfBuilding as the primary indicator since it's the required root element.
 * The <?xml declaration is optional in XML and some PoB exports may omit it, so we accept
 * either marker to be lenient with input while still catching obviously invalid content.
 *
 * This is intentionally a fast/lenient pre-check using simple string matching.
 * Full XML structure validation happens later via DOMParser which will catch
 * malformed content like `<?xmlinvalid`. This pre-check exists to quickly reject
 * obviously wrong data (e.g., binary garbage) before expensive parsing.
 */
function isValidPobXml(xml: string): boolean {
  return xml.includes('<PathOfBuilding') || xml.includes('<?xml');
}

// =============================================================================
// Encode
// =============================================================================

/**
 * Encode a Build object to a PoB2-compatible build code string.
 *
 * @param build The build to encode
 * @param options Encoding options
 * @returns URL-safe base64 encoded, deflate compressed build code
 *
 * @example
 * ```ts
 * const code = encodeBuildCode(myBuild);
 * // Returns something like: "eNrtWW1v2zgM_isG0A..."
 * ```
 */
export function encodeBuildCode(build: Build, options: EncodeOptions = {}): string {
  const { compressionLevel = 6 } = options;

  // Step 1: Convert build to XML
  const xml = buildToXml(build);

  // Step 2: Convert XML string to Uint8Array
  const encoder = new TextEncoder();
  const xmlBytes = encoder.encode(xml);

  // Step 3: Compress with deflate
  const compressed = deflateSync(xmlBytes, { level: compressionLevel });

  // Step 4: Encode to base64
  const base64 = uint8ArrayToBase64(compressed);

  // Step 5: Make URL-safe
  return toUrlSafeBase64(base64);
}

// =============================================================================
// Decode
// =============================================================================

/**
 * Decode a PoB2 build code string to a Build object.
 *
 * @param code The build code to decode (URL-safe base64)
 * @returns Result object with either the decoded build or an error
 *
 * @example
 * ```ts
 * const result = decodeBuildCode(code);
 * if (result.success) {
 *   console.log(result.build.name);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function decodeBuildCode(code: string): DecodeResult {
  // Validate format
  if (!isValidBuildCodeFormat(code)) {
    return {
      success: false,
      error: {
        type: 'INVALID_FORMAT',
        message: 'Invalid build code format. Expected URL-safe base64 string.',
      },
    };
  }

  // Step 1: Convert from URL-safe base64 to standard base64
  const base64 = fromUrlSafeBase64(code);

  // Step 2: Decode from base64
  let compressed: Uint8Array;
  try {
    compressed = base64ToUint8Array(base64);
  } catch (e) {
    return {
      success: false,
      error: {
        type: 'DECODE_FAILED',
        message: `Failed to decode base64: ${e instanceof Error ? e.message : 'Unknown error'}`,
      },
    };
  }

  // Step 3: Decompress with inflate
  let xmlBytes: Uint8Array;
  try {
    xmlBytes = inflateSync(compressed);
  } catch (e) {
    return {
      success: false,
      error: {
        type: 'DECOMPRESS_FAILED',
        message: `Failed to decompress: ${e instanceof Error ? e.message : 'Unknown error'}`,
      },
    };
  }

  // Step 4: Convert Uint8Array to string
  const decoder = new TextDecoder('utf-8');
  const xml = decoder.decode(xmlBytes);

  // Step 5: Validate XML content
  if (!isValidPobXml(xml)) {
    return {
      success: false,
      error: {
        type: 'INVALID_XML',
        message: 'Decompressed data is not valid PoB2 XML.',
      },
    };
  }

  // Step 6: Parse XML to Build object
  let build: Build;
  try {
    build = xmlToBuild(xml);
  } catch (e) {
    return {
      success: false,
      error: {
        type: 'INVALID_XML',
        message: `Failed to parse XML: ${e instanceof Error ? e.message : 'Unknown error'}`,
      },
    };
  }

  return {
    success: true,
    build,
    xml,
  };
}

/**
 * Decode a build code and throw on error.
 * Convenience function for cases where you want exception-based error handling.
 *
 * @param code The build code to decode
 * @returns The decoded Build object
 * @throws Error if decoding fails
 */
export function decodeBuildCodeOrThrow(code: string): Build {
  const result = decodeBuildCode(code);
  if (!result.success) {
    throw new Error(`${result.error.type}: ${result.error.message}`);
  }
  return result.build;
}

/**
 * Extract just the XML from a build code without parsing to Build.
 * Useful for debugging or inspecting build code contents.
 *
 * @param code The build code to decode
 * @returns The XML string or null if decoding fails
 */
export function extractXmlFromBuildCode(code: string): string | null {
  if (!isValidBuildCodeFormat(code)) {
    return null;
  }

  try {
    const base64 = fromUrlSafeBase64(code);
    const compressed = base64ToUint8Array(base64);
    const xmlBytes = inflateSync(compressed);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(xmlBytes);
  } catch {
    return null;
  }
}

/**
 * Compress raw XML to a build code.
 * Useful for testing or when you have pre-built XML.
 *
 * @param xml The XML string to compress
 * @param options Encoding options
 * @returns URL-safe base64 encoded, deflate compressed build code
 */
export function compressXmlToBuildCode(xml: string, options: EncodeOptions = {}): string {
  const { compressionLevel = 6 } = options;

  const encoder = new TextEncoder();
  const xmlBytes = encoder.encode(xml);
  const compressed = deflateSync(xmlBytes, { level: compressionLevel });
  const base64 = uint8ArrayToBase64(compressed);

  return toUrlSafeBase64(base64);
}
