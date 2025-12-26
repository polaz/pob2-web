/**
 * SkillProcessor - Process Skill Groups
 *
 * Converts skill groups (active skills + support gems) into modifiers.
 * Handles gem level/quality scaling and support gem effects.
 *
 * ## Skill Group Structure
 *
 * A SkillGroup contains:
 * - One or more active skill gems
 * - Support gems that modify the active skills
 * - Configuration (enabled, slot, includeInFullDps)
 *
 * ## Processing Flow
 *
 * 1. For each enabled skill group:
 *    - Identify active skill gems
 *    - Identify support gems
 *    - Apply support gem effects to active skills
 *    - Parse all resulting modifiers
 *
 * ## TODO: Full Gem Data Integration
 *
 * This processor currently parses gem mod text. Full implementation needs:
 * - Gem level scaling (stats per level)
 * - Quality bonuses
 * - Support gem multipliers
 * - Skill-specific mechanics (cooldown, cost, etc.)
 *
 * See gem data in src/data/gems/ for level progression data.
 */

import { ModDB } from '../modifiers/ModDB';
import type { ModParser } from '../modifiers/ModParser';
import type { ModParseContext } from '../modifiers/types';
import type { SkillGroup, GemInstance } from 'src/protos/skills_pb';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for skill processing.
 */
export interface SkillProcessorInput {
  /** Skill groups from the build */
  skillGroups: SkillGroup[];

  /** Parser for mod text */
  parser: ModParser;

  /** Optional: Only process specific skill group IDs */
  groupsToProcess?: string[];
}

/**
 * Result of skill processing.
 */
export interface SkillProcessorResult {
  /** ModDB containing all skill modifiers */
  skillDB: ModDB;

  /** Statistics about processing */
  stats: {
    /** Number of skill groups processed */
    groupsProcessed: number;

    /** Number of active skills found */
    activeSkills: number;

    /** Number of support gems found */
    supportGems: number;

    /** Number of mods created */
    modsCreated: number;

    /** Number of disabled/skipped groups */
    skippedGroups: number;
  };
}

/**
 * Processed gem with resolved level and quality.
 */
interface ProcessedGem {
  /** Original gem instance */
  instance: GemInstance;

  /** Resolved level (default: 1) */
  level: number;

  /** Resolved quality (default: 0) */
  quality: number;

  /** Whether this is a support gem */
  isSupport: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Source identifier for skill/gem mods */
const SKILL_SOURCE = 'gem';

/** Default gem level if not specified */
const DEFAULT_GEM_LEVEL = 1;

/** Default gem quality if not specified */
const DEFAULT_GEM_QUALITY = 0;

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process skill groups into a ModDB.
 *
 * @param input - Processing input with skill groups and parser
 * @returns ModDB containing all skill modifiers
 */
export function processSkills(input: SkillProcessorInput): SkillProcessorResult {
  const { skillGroups, parser, groupsToProcess } = input;

  const skillDB = new ModDB({ actor: 'player' });
  const stats = {
    groupsProcessed: 0,
    activeSkills: 0,
    supportGems: 0,
    modsCreated: 0,
    skippedGroups: 0,
  };

  for (const group of skillGroups) {
    // Skip if filtering by group ID and this group isn't in the list
    if (groupsToProcess && !groupsToProcess.includes(group.id)) {
      continue;
    }

    // Skip disabled groups
    if (group.enabled === false) {
      stats.skippedGroups++;
      continue;
    }

    stats.groupsProcessed++;

    // Process gems in this group
    const groupResult = processSkillGroup(group, parser, skillDB);

    stats.activeSkills += groupResult.activeSkills;
    stats.supportGems += groupResult.supportGems;
    stats.modsCreated += groupResult.modsCreated;
  }

  return { skillDB, stats };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process a single skill group.
 *
 * @param group - The skill group to process
 * @param parser - ModParser instance
 * @param skillDB - ModDB to add mods to
 * @returns Statistics about the processed group
 */
function processSkillGroup(
  group: SkillGroup,
  parser: ModParser,
  skillDB: ModDB
): { activeSkills: number; supportGems: number; modsCreated: number } {
  let modsCreated = 0;

  // Separate active skills from support gems
  const processedGems = group.gems
    .filter((gem) => gem.enabled !== false)
    .map((gem) => processGemInstance(gem));

  const activeGems = processedGems.filter((g) => !g.isSupport);
  const supportGems = processedGems.filter((g) => g.isSupport);

  const activeSkills = activeGems.length;
  const supportGemCount = supportGems.length;

  // Process active gems with their support gems
  for (const activeGem of activeGems) {
    const context: ModParseContext = {
      source: SKILL_SOURCE,
      sourceId: `${group.id}:${activeGem.instance.id}`,
      // Use explicit undefined check to allow empty string as valid slot
      ...(group.slot !== undefined && { slotName: group.slot }),
    };

    // Process the active gem's own mods
    // TODO: This should use actual gem data with level/quality scaling
    // For now, we parse the gem ID as a placeholder
    const gemModCount = processGemMods(activeGem, context, parser, skillDB);
    modsCreated += gemModCount;

    // Process support gem effects on this active gem
    for (const supportGem of supportGems) {
      const supportContext: ModParseContext = {
        source: SKILL_SOURCE,
        sourceId: `${group.id}:${activeGem.instance.id}:${supportGem.instance.id}`,
        // Use explicit undefined check to allow empty string as valid slot
        ...(group.slot !== undefined && { slotName: group.slot }),
      };

      const supportModCount = processGemMods(supportGem, supportContext, parser, skillDB);
      modsCreated += supportModCount;
    }
  }

  return { activeSkills, supportGems: supportGemCount, modsCreated };
}

/**
 * Module-level warning flags to log each warning only once per session.
 *
 * Note: Module-level state can persist across tests. Use resetWarningFlags()
 * in test cleanup if testing warning behavior.
 */
let supportGemHeuristicWarned = false;
let processGemModsPlaceholderWarned = false;

/**
 * Reset warning flags for testing purposes.
 *
 * EXPORTED FOR TESTING: This function is intentionally exported to allow
 * test isolation. Module-level warning state persists across tests, so
 * this reset function must be called in test cleanup. This is a standard
 * pattern for once-per-session warnings that need test coverage.
 */
export function resetWarningFlags(): void {
  supportGemHeuristicWarned = false;
  processGemModsPlaceholderWarned = false;
}

/**
 * Known support gem IDs that do not contain the word "support".
 *
 * This is a stopgap until full gem data integration. IDs are stored in
 * lowercase; lookups normalize input accordingly.
 *
 * TODO: Validate this list against full PoE2 gem data once gem data
 * integration is complete. Additional support gems without "support"
 * in their name may exist.
 */
const KNOWN_SUPPORT_GEM_IDS: ReadonlySet<string> = new Set([
  'empower',
  'enhance',
  'enlighten',
]);

/**
 * Pattern to detect the word "support" as a separate token in a gem ID.
 *
 * Matches when "support" appears:
 * - At the start or end of the string
 * - Surrounded by spaces, underscores, or hyphens
 *
 * Examples: "Support", "Damage Support", "minion_support", "support-damage"
 *
 * This heuristic is combined with KNOWN_SUPPORT_GEM_IDS for gems like "Empower"
 * that don't have "support" in their name. Will be replaced by proper gem data
 * lookup when gem data integration is complete (see src/data/gems/).
 */
const SUPPORT_GEM_PATTERN = /(?:^|[\s_-])support(?:$|[\s_-])/i;

/**
 * Determine whether a gem ID represents a support gem.
 *
 * First checks KNOWN_SUPPORT_GEM_IDS (for gems like "Empower" that don't
 * contain "support"), then falls back to the SUPPORT_GEM_PATTERN heuristic.
 */
function isSupportGemId(gemId: string): boolean {
  const normalized = gemId.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  // Check known support gems first
  if (KNOWN_SUPPORT_GEM_IDS.has(normalized)) {
    return true;
  }

  // Fall back to pattern matching
  return SUPPORT_GEM_PATTERN.test(gemId);
}

/**
 * Process a GemInstance into a ProcessedGem with resolved values.
 */
function processGemInstance(gem: GemInstance): ProcessedGem {
  // Use combined check: known IDs + pattern heuristic
  const isSupport = gem.gemId ? isSupportGemId(gem.gemId) : false;

  // Warn once about using heuristic - gems might be incorrectly categorized
  if (!supportGemHeuristicWarned && gem.gemId) {
    console.warn(
      '[SkillProcessor] Using heuristic for gem type detection. ' +
        'Some gems may be incorrectly categorized until full gem data integration. ' +
        'Known support gems without "support" in name: Empower, Enhance, Enlighten.'
    );
    supportGemHeuristicWarned = true;
  }

  return {
    instance: gem,
    level: gem.level ?? DEFAULT_GEM_LEVEL,
    quality: gem.quality ?? DEFAULT_GEM_QUALITY,
    isSupport,
  };
}

/**
 * Process mods from a gem.
 *
 * **IMPORTANT: This is a NO-OP placeholder awaiting gem data integration.**
 *
 * Currently returns 0 (no mods added) because gem stat data lookup is not yet
 * implemented. This means skill/gem modifiers are NOT contributing to calculations.
 *
 * Full implementation requires:
 * 1. Look up gem data from src/data/gems/
 * 2. Get stats for the gem's level
 * 3. Apply quality bonuses
 * 4. Parse the resulting stat text
 *
 * See: gem data in src/data/gems/ for level progression data
 *
 * @param _gem - The processed gem (unused - placeholder)
 * @param _context - Parse context (unused - placeholder)
 * @param _parser - ModParser instance (unused - placeholder)
 * @param _skillDB - ModDB to add mods to (unused - placeholder)
 * @returns Always 0 until gem data integration is complete
 */
function processGemMods(
  _gem: ProcessedGem,
  _context: ModParseContext,
  _parser: ModParser,
  _skillDB: ModDB
): number {
  // Log once that gem stats are not yet applied
  if (!processGemModsPlaceholderWarned) {
    console.warn(
      '[SkillProcessor] processGemMods is currently a no-op; gem stats are not yet applied. ' +
        'This function exists to maintain call site structure while gem data integration is pending.'
    );
    processGemModsPlaceholderWarned = true;
  }

  // NO-OP: Gem data lookup not yet implemented
  // When implemented, this would:
  // 1. Load gem data: const gemData = await getGemData(_gem.instance.gemId);
  // 2. Get level data: const levelData = gemData.levels[_gem.level - 1];
  // 3. Get stat text: const statTexts = levelData.stats;
  // 4. Apply quality: const qualityStats = applyQuality(gemData, _gem.quality);
  // 5. Parse stats and add to skillDB
  return 0;
}

// ============================================================================
// Incremental Update Support
// ============================================================================

/**
 * Process a single skill group and return its mods.
 *
 * @param group - The skill group to process
 * @param parser - ModParser instance
 * @returns ModDB for this skill group
 */
export function processSingleSkillGroup(
  group: SkillGroup,
  parser: ModParser
): ModDB {
  const skillDB = new ModDB({ actor: 'player' });

  if (group.enabled !== false) {
    processSkillGroup(group, parser, skillDB);
  }

  return skillDB;
}

/**
 * Get all skill group IDs from the build.
 *
 * @param skillGroups - Array of skill groups
 * @returns Array of skill group IDs
 */
export function getSkillGroupIds(skillGroups: SkillGroup[]): string[] {
  return skillGroups.map((g) => g.id);
}

/**
 * Get enabled skill group IDs.
 *
 * @param skillGroups - Array of skill groups
 * @returns Array of enabled skill group IDs
 */
export function getEnabledSkillGroupIds(skillGroups: SkillGroup[]): string[] {
  return skillGroups.filter((g) => g.enabled !== false).map((g) => g.id);
}
