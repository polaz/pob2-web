/**
 * Character class enum conversion utilities.
 *
 * Provides bidirectional conversion between CharacterClass enum values
 * and their display names. Handles unknown values with sensible defaults.
 */

import { CharacterClass } from 'src/protos/pob2_pb';

/**
 * Default class used when conversion fails.
 */
const DEFAULT_CLASS = CharacterClass.WARRIOR;

/**
 * Convert CharacterClass enum to display name.
 *
 * @param charClass - The CharacterClass enum value
 * @returns Display name (e.g., "Warrior", "Sorceress")
 *
 * @example
 * ```typescript
 * classEnumToName(CharacterClass.WARRIOR) // "Warrior"
 * classEnumToName(CharacterClass.SORCERESS) // "Sorceress"
 * ```
 */
export function classEnumToName(charClass: CharacterClass): string {
  const name = CharacterClass[charClass];
  if (typeof name !== 'string') {
    return classEnumToName(DEFAULT_CLASS);
  }
  // Convert WARRIOR to Warrior (capitalize first letter, lowercase rest)
  return name.charAt(0) + name.slice(1).toLowerCase();
}

/**
 * Convert class name string to CharacterClass enum.
 *
 * @param name - The class name (case-insensitive)
 * @returns CharacterClass enum value, or DEFAULT_CLASS if unknown
 *
 * @example
 * ```typescript
 * classNameToEnum("Warrior") // CharacterClass.WARRIOR
 * classNameToEnum("warrior") // CharacterClass.WARRIOR
 * classNameToEnum("SORCERESS") // CharacterClass.SORCERESS
 * classNameToEnum("Unknown") // CharacterClass.WARRIOR (default)
 * ```
 */
export function classNameToEnum(name: string): CharacterClass {
  const nameUpper = name.toUpperCase();
  const enumValue = CharacterClass[nameUpper as keyof typeof CharacterClass];
  return typeof enumValue === 'number' ? enumValue : DEFAULT_CLASS;
}
