/**
 * ItemParser - Parses items from game clipboard text format.
 *
 * Handles parsing of items copied from Path of Exile 2 game client.
 * Supports all rarity types and extracts properties, requirements,
 * sockets, and modifiers.
 */

import type {
  Item,
  Socket,
  WeaponData,
  ArmourData,
} from 'src/protos/pob2_pb';
import { ItemRarity } from 'src/protos/pob2_pb';
import type {
  ItemParseResult,
  ItemTextSection,
  ItemBase,
} from './types';
import {
  RARITY_TEXT_MAP,
  ITEM_TYPE_MAP,
  ITEM_SECTION_SEPARATOR,
  PERCENTAGE_STORAGE_MULTIPLIER,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a unique ID for items.
 * Uses crypto.randomUUID() if available, otherwise fallback.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Safely parses an integer from a regex match group.
 */
function safeParseInt(value: string | undefined, defaultValue = 0): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely parses a float from a regex match group.
 */
function safeParseFloat(value: string | undefined, defaultValue = 0): number {
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Regular Expression Patterns
// ============================================================================

/** Pattern for rarity line */
const RARITY_PATTERN = /^Rarity:\s*(\w+)$/;

/** Pattern for item class line (PoE2 shows this) */
const ITEM_CLASS_PATTERN = /^Item Class:\s*(.+)$/;

/** Pattern for quality */
const QUALITY_PATTERN = /^Quality:\s*\+?(\d+)%/;

/** Pattern for item level */
const ITEM_LEVEL_PATTERN = /^Item Level:\s*(\d+)$/;

/** Pattern for physical damage */
const PHYSICAL_DAMAGE_PATTERN = /^Physical Damage:\s*(\d+)-(\d+)/;

/** Pattern for elemental damage (fire, cold, lightning) */
const ELEMENTAL_DAMAGE_PATTERN = /^Elemental Damage:\s*(.+)$/;

/** Pattern for chaos damage */
const CHAOS_DAMAGE_PATTERN = /^Chaos Damage:\s*(\d+)-(\d+)/;

/** Pattern for critical strike chance */
const CRIT_CHANCE_PATTERN = /^Critical (?:Strike )?Chance:\s*([\d.]+)%/;

/** Pattern for attacks per second */
const ATTACK_SPEED_PATTERN = /^Attacks per Second:\s*([\d.]+)/;

/** Pattern for weapon range */
const WEAPON_RANGE_PATTERN = /^(?:Weapon )?Range:\s*(\d+)/;

/** Pattern for armour value */
const ARMOUR_PATTERN = /^Armour:\s*(\d+)/;

/** Pattern for evasion value */
const EVASION_PATTERN = /^Evasion(?: Rating)?:\s*(\d+)/;

/** Pattern for energy shield value */
const ENERGY_SHIELD_PATTERN = /^Energy Shield:\s*(\d+)/;

/** Pattern for ward value */
const WARD_PATTERN = /^Ward:\s*(\d+)/;

/** Pattern for block chance */
const BLOCK_PATTERN = /^(?:Chance to )?Block:\s*(\d+)%/;

/** Pattern for requirements header */
const REQUIREMENTS_PATTERN = /^Requirements:$/;

/** Pattern for level requirement */
const REQ_LEVEL_PATTERN = /^Level:\s*(\d+)/;

/** Pattern for strength requirement */
const REQ_STR_PATTERN = /^Str(?:ength)?:\s*(\d+)/;

/** Pattern for dexterity requirement */
const REQ_DEX_PATTERN = /^Dex(?:terity)?:\s*(\d+)/;

/** Pattern for intelligence requirement */
const REQ_INT_PATTERN = /^Int(?:elligence)?:\s*(\d+)/;

/** Pattern for sockets line */
const SOCKETS_PATTERN = /^Sockets:\s*(.+)$/;

/** Pattern for crafted mod suffix */
const CRAFTED_MOD_PATTERN = /\s*\(crafted\)\s*$/i;

/** Pattern for enchant mod prefix/suffix */
const ENCHANT_MOD_PATTERN = /\s*\(enchant\)\s*$/i;

/** Pattern for implicit mod indicator */
const IMPLICIT_MOD_PATTERN = /\s*\(implicit\)\s*$/i;

/** Pattern for fractured mod suffix */
const FRACTURED_MOD_PATTERN = /\s*\(fractured\)\s*$/i;

/** Pattern for fire damage in elemental line */
const FIRE_DAMAGE_PATTERN = /(\d+)-(\d+)\s*Fire/i;

/** Pattern for cold damage in elemental line */
const COLD_DAMAGE_PATTERN = /(\d+)-(\d+)\s*Cold/i;

/** Pattern for lightning damage in elemental line */
const LIGHTNING_DAMAGE_PATTERN = /(\d+)-(\d+)\s*Lightning/i;

// ============================================================================
// Types
// ============================================================================

interface HeaderParseResult {
  success: boolean;
  error?: string;
  rarity?: ItemRarity;
  name: string | undefined;
  baseName: string | undefined;
  typeLine: string | undefined;
}

interface RequirementParseResult {
  parsed: boolean;
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
}

interface ModParseResult {
  parsed: boolean;
  text: string;
  isImplicit: boolean;
  isEnchant: boolean;
  isCrafted: boolean;
  isFractured: boolean;
}

// ============================================================================
// ItemParser Class
// ============================================================================

/**
 * Parses items from clipboard text format.
 */
export class ItemParser {
  /** Item base lookup function */
  private baseResolver: ((baseName: string) => ItemBase | undefined) | null =
    null;

  /**
   * Creates a new ItemParser.
   *
   * @param baseResolver - Optional function to look up item bases by name
   */
  constructor(baseResolver?: (baseName: string) => ItemBase | undefined) {
    this.baseResolver = baseResolver ?? null;
  }

  /**
   * Parses an item from clipboard text.
   *
   * @param text - The item text copied from game
   * @returns Parse result with item data or error
   */
  parse(text: string): ItemParseResult {
    const warnings: string[] = [];
    const unparsedLines: string[] = [];

    // Normalize line endings and trim
    const normalizedText = text.replace(/\r\n/g, '\n').trim();
    if (!normalizedText) {
      return {
        success: false,
        error: 'Empty item text',
        warnings,
        unparsedLines,
      };
    }

    // Split into sections by separator
    const sections = this.splitIntoSections(normalizedText);
    if (sections.length === 0) {
      return {
        success: false,
        error: 'No valid sections found',
        warnings,
        unparsedLines,
      };
    }

    // Parse header section (rarity, name, base)
    const firstSection = sections[0];
    if (!firstSection) {
      return {
        success: false,
        error: 'No header section found',
        warnings,
        unparsedLines,
      };
    }

    const headerResult = this.parseHeader(firstSection);
    if (!headerResult.success || headerResult.error) {
      return {
        success: false,
        error: headerResult.error ?? 'Unknown header error',
        warnings,
        unparsedLines,
      };
    }

    // Initialize item with header data
    const item: Item = {
      id: generateId(),
      sockets: [],
      runes: [],
      implicitMods: [],
      explicitMods: [],
      enchantMods: [],
      runeMods: [],
      craftedMods: [],
      corrupted: false,
      mirrored: false,
      fractured: false,
    };

    // Set optional properties only if defined
    if (headerResult.name !== undefined) {
      item.name = headerResult.name;
    }
    if (headerResult.baseName !== undefined) {
      item.baseName = headerResult.baseName;
    }
    if (headerResult.typeLine !== undefined) {
      item.typeLine = headerResult.typeLine;
    }
    if (headerResult.rarity !== undefined) {
      item.rarity = headerResult.rarity;
    }

    // Track if we've seen the implicit separator
    let foundImplicitSeparator = false;
    let inRequirements = false;

    // Process remaining sections
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;

      for (const line of section.lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check for corrupted/mirrored status
        if (trimmedLine === 'Corrupted') {
          item.corrupted = true;
          continue;
        }
        if (trimmedLine === 'Mirrored') {
          item.mirrored = true;
          continue;
        }

        // Check for requirements header
        if (REQUIREMENTS_PATTERN.test(trimmedLine)) {
          inRequirements = true;
          continue;
        }

        // Parse requirements
        if (inRequirements) {
          const reqResult = this.parseRequirementLine(trimmedLine);
          if (reqResult.parsed) {
            if (reqResult.level !== undefined)
              item.requiredLevel = reqResult.level;
            if (reqResult.str !== undefined) item.requiredStr = reqResult.str;
            if (reqResult.dex !== undefined) item.requiredDex = reqResult.dex;
            if (reqResult.int !== undefined) item.requiredInt = reqResult.int;
            continue;
          }
          // If line doesn't match requirements, we're done with requirements
          inRequirements = false;
        }

        // Parse item properties
        const propResult = this.parsePropertyLine(trimmedLine, item);
        if (propResult.parsed) continue;

        // Parse sockets
        const socketMatch = SOCKETS_PATTERN.exec(trimmedLine);
        if (socketMatch && socketMatch[1]) {
          item.sockets = this.parseSockets(socketMatch[1]);
          continue;
        }

        // Parse modifiers
        const modResult = this.parseModLine(trimmedLine, foundImplicitSeparator);
        if (modResult.parsed) {
          if (modResult.isEnchant) {
            item.enchantMods.push(modResult.text);
          } else if (modResult.isImplicit) {
            item.implicitMods.push(modResult.text);
          } else if (modResult.isCrafted) {
            item.craftedMods.push(modResult.text);
          } else if (modResult.isFractured) {
            item.fractured = true;
            item.explicitMods.push(modResult.text);
          } else {
            item.explicitMods.push(modResult.text);
          }
          foundImplicitSeparator = true; // After first mod, assume explicit
          continue;
        }

        // Line couldn't be parsed
        unparsedLines.push(trimmedLine);
      }
    }

    // Try to resolve item type from base name
    if (item.baseName && !item.itemType && this.baseResolver) {
      const base = this.baseResolver(item.baseName);
      if (base) {
        const itemType = ITEM_TYPE_MAP[base.type];
        if (itemType !== undefined) {
          item.itemType = itemType;
        }
      }
    }

    return {
      success: true,
      item,
      warnings,
      unparsedLines,
    };
  }

  /**
   * Splits item text into sections by separator.
   */
  private splitIntoSections(text: string): ItemTextSection[] {
    const lines = text.split('\n');
    const sections: ItemTextSection[] = [];
    let currentLines: string[] = [];
    let sectionIndex = 0;

    for (const line of lines) {
      if (line.trim() === ITEM_SECTION_SEPARATOR) {
        if (currentLines.length > 0) {
          sections.push({
            index: sectionIndex++,
            lines: currentLines,
          });
          currentLines = [];
        }
      } else {
        currentLines.push(line);
      }
    }

    // Add final section
    if (currentLines.length > 0) {
      sections.push({
        index: sectionIndex,
        lines: currentLines,
      });
    }

    return sections;
  }

  /**
   * Parses the header section (rarity, name, base type).
   */
  private parseHeader(section: ItemTextSection): HeaderParseResult {
    const lines = section.lines.filter((l) => l.trim());

    if (lines.length === 0) {
      return {
        success: false,
        error: 'Empty header section',
        name: undefined,
        baseName: undefined,
        typeLine: undefined,
      };
    }

    const firstLine = lines[0];
    if (!firstLine) {
      return {
        success: false,
        error: 'Empty header section',
        name: undefined,
        baseName: undefined,
        typeLine: undefined,
      };
    }

    // First line should be rarity
    const rarityMatch = RARITY_PATTERN.exec(firstLine.trim());
    if (!rarityMatch || !rarityMatch[1]) {
      return {
        success: false,
        error: 'Missing rarity line',
        name: undefined,
        baseName: undefined,
        typeLine: undefined,
      };
    }

    const rarityText = rarityMatch[1];
    const rarity = RARITY_TEXT_MAP[rarityText];
    if (rarity === undefined) {
      return {
        success: false,
        error: `Unknown rarity: ${rarityText}`,
        name: undefined,
        baseName: undefined,
        typeLine: undefined,
      };
    }

    let name: string | undefined;
    let baseName: string | undefined;
    let typeLine: string | undefined;

    // Parse remaining header lines based on rarity
    const remainingLines = lines.slice(1).filter((l) => {
      // Filter out Item Class line
      return !ITEM_CLASS_PATTERN.test(l.trim());
    });

    if (rarity === ItemRarity.RARITY_UNIQUE) {
      // Unique: name on line 2, base on line 3
      if (remainingLines.length >= 2) {
        name = remainingLines[0]?.trim();
        baseName = remainingLines[1]?.trim();
        typeLine = baseName;
      } else if (remainingLines.length === 1) {
        name = remainingLines[0]?.trim();
        baseName = name;
        typeLine = name;
      }
    } else if (rarity === ItemRarity.RARITY_RARE) {
      // Rare: name on line 2, base on line 3
      if (remainingLines.length >= 2) {
        name = remainingLines[0]?.trim();
        baseName = remainingLines[1]?.trim();
        typeLine = baseName;
      } else if (remainingLines.length === 1) {
        baseName = remainingLines[0]?.trim();
        typeLine = baseName;
      }
    } else if (rarity === ItemRarity.RARITY_MAGIC) {
      // Magic: type line contains affixes + base
      if (remainingLines.length >= 1) {
        typeLine = remainingLines[0]?.trim();
        baseName = typeLine;
      }
    } else {
      // Normal: just base type
      if (remainingLines.length >= 1) {
        baseName = remainingLines[0]?.trim();
        typeLine = baseName;
      }
    }

    return {
      success: true,
      rarity,
      name,
      baseName,
      typeLine,
    };
  }

  /**
   * Parses a property line and updates item data.
   */
  private parsePropertyLine(
    line: string,
    item: Item
  ): { parsed: boolean } {
    // Quality
    const qualityMatch = QUALITY_PATTERN.exec(line);
    if (qualityMatch && qualityMatch[1]) {
      item.quality = safeParseInt(qualityMatch[1]);
      return { parsed: true };
    }

    // Item Level
    const itemLevelMatch = ITEM_LEVEL_PATTERN.exec(line);
    if (itemLevelMatch && itemLevelMatch[1]) {
      item.itemLevel = safeParseInt(itemLevelMatch[1]);
      return { parsed: true };
    }

    // Initialize weapon data if needed for weapon properties
    const ensureWeaponData = (): WeaponData => {
      if (!item.weaponData) {
        item.weaponData = {};
      }
      return item.weaponData;
    };

    // Initialize armour data if needed for armour properties
    const ensureArmourData = (): ArmourData => {
      if (!item.armourData) {
        item.armourData = {};
      }
      return item.armourData;
    };

    // Physical Damage
    const physMatch = PHYSICAL_DAMAGE_PATTERN.exec(line);
    if (physMatch && physMatch[1] && physMatch[2]) {
      const wd = ensureWeaponData();
      wd.physicalMin = safeParseInt(physMatch[1]);
      wd.physicalMax = safeParseInt(physMatch[2]);
      return { parsed: true };
    }

    // Elemental Damage (can have multiple types on one line)
    const elemMatch = ELEMENTAL_DAMAGE_PATTERN.exec(line);
    if (elemMatch && elemMatch[1]) {
      const elemText = elemMatch[1];
      const wd = ensureWeaponData();

      const fireMatch = FIRE_DAMAGE_PATTERN.exec(elemText);
      if (fireMatch && fireMatch[1] && fireMatch[2]) {
        wd.fireMin = safeParseInt(fireMatch[1]);
        wd.fireMax = safeParseInt(fireMatch[2]);
      }

      const coldMatch = COLD_DAMAGE_PATTERN.exec(elemText);
      if (coldMatch && coldMatch[1] && coldMatch[2]) {
        wd.coldMin = safeParseInt(coldMatch[1]);
        wd.coldMax = safeParseInt(coldMatch[2]);
      }

      const lightningMatch = LIGHTNING_DAMAGE_PATTERN.exec(elemText);
      if (lightningMatch && lightningMatch[1] && lightningMatch[2]) {
        wd.lightningMin = safeParseInt(lightningMatch[1]);
        wd.lightningMax = safeParseInt(lightningMatch[2]);
      }

      return { parsed: true };
    }

    // Chaos Damage
    const chaosMatch = CHAOS_DAMAGE_PATTERN.exec(line);
    if (chaosMatch && chaosMatch[1] && chaosMatch[2]) {
      const wd = ensureWeaponData();
      wd.chaosMin = safeParseInt(chaosMatch[1]);
      wd.chaosMax = safeParseInt(chaosMatch[2]);
      return { parsed: true };
    }

    // Critical Strike Chance
    const critMatch = CRIT_CHANCE_PATTERN.exec(line);
    if (critMatch && critMatch[1]) {
      const wd = ensureWeaponData();
      // Store as percentage * PERCENTAGE_STORAGE_MULTIPLIER (e.g., 5.00% = 500)
      wd.critChance = Math.round(
        safeParseFloat(critMatch[1]) * PERCENTAGE_STORAGE_MULTIPLIER
      );
      return { parsed: true };
    }

    // Attacks per Second
    const apsMatch = ATTACK_SPEED_PATTERN.exec(line);
    if (apsMatch && apsMatch[1]) {
      const wd = ensureWeaponData();
      wd.attackSpeed = safeParseFloat(apsMatch[1]);
      return { parsed: true };
    }

    // Weapon Range
    const rangeMatch = WEAPON_RANGE_PATTERN.exec(line);
    if (rangeMatch && rangeMatch[1]) {
      const wd = ensureWeaponData();
      wd.range = safeParseInt(rangeMatch[1]);
      return { parsed: true };
    }

    // Armour
    const armourMatch = ARMOUR_PATTERN.exec(line);
    if (armourMatch && armourMatch[1]) {
      const ad = ensureArmourData();
      ad.armour = safeParseInt(armourMatch[1]);
      return { parsed: true };
    }

    // Evasion
    const evasionMatch = EVASION_PATTERN.exec(line);
    if (evasionMatch && evasionMatch[1]) {
      const ad = ensureArmourData();
      ad.evasion = safeParseInt(evasionMatch[1]);
      return { parsed: true };
    }

    // Energy Shield
    const esMatch = ENERGY_SHIELD_PATTERN.exec(line);
    if (esMatch && esMatch[1]) {
      const ad = ensureArmourData();
      ad.energyShield = safeParseInt(esMatch[1]);
      return { parsed: true };
    }

    // Ward
    const wardMatch = WARD_PATTERN.exec(line);
    if (wardMatch && wardMatch[1]) {
      const ad = ensureArmourData();
      ad.ward = safeParseInt(wardMatch[1]);
      return { parsed: true };
    }

    // Block
    const blockMatch = BLOCK_PATTERN.exec(line);
    if (blockMatch && blockMatch[1]) {
      const ad = ensureArmourData();
      // Store as percentage * PERCENTAGE_STORAGE_MULTIPLIER
      ad.block = safeParseInt(blockMatch[1]) * PERCENTAGE_STORAGE_MULTIPLIER;
      return { parsed: true };
    }

    return { parsed: false };
  }

  /**
   * Parses a requirement line.
   */
  private parseRequirementLine(line: string): RequirementParseResult {
    const levelMatch = REQ_LEVEL_PATTERN.exec(line);
    if (levelMatch && levelMatch[1]) {
      return { parsed: true, level: safeParseInt(levelMatch[1]) };
    }

    const strMatch = REQ_STR_PATTERN.exec(line);
    if (strMatch && strMatch[1]) {
      return { parsed: true, str: safeParseInt(strMatch[1]) };
    }

    const dexMatch = REQ_DEX_PATTERN.exec(line);
    if (dexMatch && dexMatch[1]) {
      return { parsed: true, dex: safeParseInt(dexMatch[1]) };
    }

    const intMatch = REQ_INT_PATTERN.exec(line);
    if (intMatch && intMatch[1]) {
      return { parsed: true, int: safeParseInt(intMatch[1]) };
    }

    return { parsed: false };
  }

  /**
   * Parses sockets string into Socket array.
   *
   * Format: "R-R-G B" where - indicates linked, space indicates unlinked
   */
  private parseSockets(socketsStr: string): Socket[] {
    const sockets: Socket[] = [];
    let currentGroup = 0;

    // Split by spaces to get link groups
    const groups = socketsStr.trim().split(/\s+/);

    for (const group of groups) {
      // Split each group by links
      const linkedSockets = group.split('-');

      for (const socketChar of linkedSockets) {
        const color = socketChar.trim().toUpperCase();
        if (color) {
          sockets.push({
            color,
            group: currentGroup,
          });
        }
      }

      currentGroup++;
    }

    return sockets;
  }

  /**
   * Parses a modifier line.
   */
  private parseModLine(
    line: string,
    _afterImplicit: boolean
  ): ModParseResult {
    let text = line;
    let isImplicit = false;
    let isEnchant = false;
    let isCrafted = false;
    let isFractured = false;

    // Check for implicit marker
    if (IMPLICIT_MOD_PATTERN.test(text)) {
      isImplicit = true;
      text = text.replace(IMPLICIT_MOD_PATTERN, '').trim();
    }

    // Check for enchant marker
    if (ENCHANT_MOD_PATTERN.test(text)) {
      isEnchant = true;
      text = text.replace(ENCHANT_MOD_PATTERN, '').trim();
    }

    // Check for crafted marker
    if (CRAFTED_MOD_PATTERN.test(text)) {
      isCrafted = true;
      text = text.replace(CRAFTED_MOD_PATTERN, '').trim();
    }

    // Check for fractured marker
    if (FRACTURED_MOD_PATTERN.test(text)) {
      isFractured = true;
      text = text.replace(FRACTURED_MOD_PATTERN, '').trim();
    }

    // If line has any alphanumeric content, treat as a mod
    if (/[a-zA-Z0-9]/.test(text)) {
      return {
        parsed: true,
        text,
        isImplicit,
        isEnchant,
        isCrafted,
        isFractured,
      };
    }

    return {
      parsed: false,
      text: '',
      isImplicit: false,
      isEnchant: false,
      isCrafted: false,
      isFractured: false,
    };
  }

  /**
   * Sets the base resolver function.
   *
   * @param resolver - Function to look up item bases by name
   */
  setBaseResolver(resolver: (baseName: string) => ItemBase | undefined): void {
    this.baseResolver = resolver;
  }
}

/**
 * Creates a new ItemParser instance.
 *
 * @param baseResolver - Optional function to look up item bases
 * @returns A new ItemParser
 */
export function createItemParser(
  baseResolver?: (baseName: string) => ItemBase | undefined
): ItemParser {
  return new ItemParser(baseResolver);
}

/**
 * Parses an item from clipboard text using a default parser.
 *
 * @param text - The item text to parse
 * @returns Parse result with item data or error
 */
export function parseItem(text: string): ItemParseResult {
  const parser = new ItemParser();
  return parser.parse(text);
}
