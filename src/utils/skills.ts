/**
 * Utility functions for skill data operations.
 */

/**
 * Safely compare gem family values between Skill (array) and Gem (string) types.
 *
 * This handles the type difference between:
 * - `Skill.gemFamily`: string[] (from PoB Lua extraction)
 * - `Gem.family`: string (from gem metadata)
 *
 * @param skillFamily - The gemFamily array from a Skill object
 * @param gemFamily - The family string from a Gem object
 * @returns true if the gem's family is included in the skill's gemFamily array
 *
 * @example
 * ```typescript
 * const skill = getSkill('RapidAttacks');
 * const gem = getGem('gem_rapid_attacks');
 *
 * if (matchesGemFamily(skill?.gemFamily, gem?.family)) {
 *   // Skill and gem belong to the same family
 * }
 * ```
 */
export function matchesGemFamily(
  skillFamily: string[] | undefined,
  gemFamily: string | undefined
): boolean {
  if (!skillFamily || !gemFamily) {
    return false;
  }
  return skillFamily.includes(gemFamily);
}

/**
 * Convert a Skill's gemFamily array to a single string (first element).
 *
 * Useful when you need to normalize skill data to match the Gem.family format.
 *
 * @param skillFamily - The gemFamily array from a Skill object
 * @returns The first family string, or undefined if empty/missing
 */
export function getFirstGemFamily(skillFamily: string[] | undefined): string | undefined {
  if (!skillFamily || skillFamily.length === 0) {
    return undefined;
  }
  return skillFamily[0];
}

/**
 * Convert a Gem's family string to an array format matching Skill.gemFamily.
 *
 * Useful when you need to normalize gem data to match the Skills format.
 *
 * @param gemFamily - The family string from a Gem object
 * @returns An array containing the family, or empty array if missing
 */
export function toGemFamilyArray(gemFamily: string | undefined): string[] {
  if (!gemFamily) {
    return [];
  }
  return [gemFamily];
}
