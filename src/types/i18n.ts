/**
 * Internationalization types and utilities for game data.
 *
 * Game data (gems, items, mods, nodes) is localized in 10+ PoE2 languages.
 * This module provides types and helpers for working with localized strings.
 */

/**
 * A string localized to multiple languages.
 *
 * Keys are BCP 47 locale codes (e.g., 'en-US', 'ru', 'zh-CN').
 * Values are the translated strings.
 *
 * @example
 * const gemName: LocalizedString = {
 *   'en-US': 'Fireball',
 *   'ru': 'Огненный шар',
 *   'zh-CN': '火球术'
 * };
 */
export interface LocalizedString {
  [locale: string]: string;
}

/**
 * Default fallback locale when requested locale is not available.
 */
export const DEFAULT_LOCALE = 'en-US';

/**
 * Supported PoE2 locales with their script types.
 *
 * Script type determines n-gram size for search indexing:
 * - 'latin': Uses trigrams (3-character n-grams)
 * - 'cjk': Uses bigrams (2-character n-grams)
 * - 'thai': Uses bigrams (2-character n-grams)
 */
export const SUPPORTED_LOCALES = {
  'en-US': { name: 'English', script: 'latin' },
  'ru': { name: 'Russian', script: 'latin' },
  'de': { name: 'German', script: 'latin' },
  'fr': { name: 'French', script: 'latin' },
  'es': { name: 'Spanish', script: 'latin' },
  'pt-BR': { name: 'Portuguese (Brazil)', script: 'latin' },
  'zh-CN': { name: 'Chinese (Simplified)', script: 'cjk' },
  'zh-TW': { name: 'Chinese (Traditional)', script: 'cjk' },
  'ja': { name: 'Japanese', script: 'cjk' },
  'ko': { name: 'Korean', script: 'cjk' },
  'th': { name: 'Thai', script: 'thai' },
} as const;

export type SupportedLocale = keyof typeof SUPPORTED_LOCALES;
export type ScriptType = 'latin' | 'cjk' | 'thai';

/**
 * Get the script type for a locale.
 *
 * @param locale - BCP 47 locale code
 * @returns The script type, defaults to 'latin' for unknown locales
 */
export function getScriptType(locale: string): ScriptType {
  const supported = SUPPORTED_LOCALES[locale as SupportedLocale];
  if (supported) {
    return supported.script;
  }

  // Fallback based on locale prefix
  if (locale.startsWith('zh') || locale.startsWith('ja') || locale.startsWith('ko')) {
    return 'cjk';
  }
  if (locale.startsWith('th')) {
    return 'thai';
  }
  return 'latin';
}

/**
 * Get the n-gram size for a script type.
 *
 * - Latin/Cyrillic: 3 (trigrams) - better for longer words
 * - CJK: 2 (bigrams) - characters are more meaningful individually
 * - Thai: 2 (bigrams) - similar to CJK in character density
 *
 * @param script - The script type
 * @returns The n-gram size to use
 */
export function getNgramSize(script: ScriptType): number {
  switch (script) {
    case 'cjk':
    case 'thai':
      return 2;
    case 'latin':
    default:
      return 3;
  }
}

/**
 * Get localized text from a LocalizedString object.
 *
 * Falls back to the default locale (en-US) if the requested locale
 * is not available. Returns empty string if neither is available.
 *
 * @param localized - The localized string object
 * @param locale - The desired locale
 * @param fallback - Fallback locale (defaults to en-US)
 * @returns The localized text, or empty string if not found
 *
 * @example
 * const name = getLocalizedText(gem.localizedName, 'ru');
 * // Returns Russian name, or English if Russian not available
 */
export function getLocalizedText(
  localized: LocalizedString | undefined | null,
  locale: string,
  fallback: string = DEFAULT_LOCALE
): string {
  if (!localized) {
    return '';
  }

  // Try exact locale match
  if (localized[locale]) {
    return localized[locale];
  }

  // Try fallback locale
  if (localized[fallback]) {
    return localized[fallback];
  }

  // Return first available translation
  const keys = Object.keys(localized);
  const firstKey = keys[0];
  if (firstKey !== undefined) {
    return localized[firstKey] ?? '';
  }

  return '';
}

/**
 * Check if a LocalizedString has a translation for the given locale.
 *
 * @param localized - The localized string object
 * @param locale - The locale to check
 * @returns True if the locale has a non-empty translation
 */
export function hasLocale(
  localized: LocalizedString | undefined | null,
  locale: string
): boolean {
  if (!localized) {
    return false;
  }
  return typeof localized[locale] === 'string' && localized[locale].length > 0;
}

/**
 * Create a LocalizedString with a single locale.
 *
 * Convenience function for creating localized strings when you only
 * have one translation (typically from English source data).
 *
 * @param text - The text value
 * @param locale - The locale (defaults to en-US)
 * @returns A LocalizedString object
 *
 * @example
 * const name = createLocalizedString('Fireball');
 * // { 'en-US': 'Fireball' }
 */
export function createLocalizedString(
  text: string,
  locale: string = DEFAULT_LOCALE
): LocalizedString {
  return { [locale]: text };
}

/**
 * Merge multiple LocalizedString objects.
 *
 * Later objects override earlier ones for the same locale.
 *
 * @param strings - The localized strings to merge
 * @returns A merged LocalizedString
 */
export function mergeLocalizedStrings(
  ...strings: (LocalizedString | undefined | null)[]
): LocalizedString {
  const result: LocalizedString = {};
  for (const str of strings) {
    if (str) {
      Object.assign(result, str);
    }
  }
  return result;
}
