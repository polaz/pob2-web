/**
 * XML serialization/deserialization for PoB2-compatible build format.
 *
 * This module converts between our Build proto format and PoB2's XML format,
 * enabling import/export of build codes that are compatible with Path of Building.
 *
 * PoB2 XML structure:
 * ```xml
 * <PathOfBuilding>
 *   <Build level="90" className="Warrior" ascendClassName="Titan" .../>
 *   <Tree activeSpec="1">
 *     <Spec nodes="1234,5678,..." masteryEffects="nodeId:effectId,..."/>
 *   </Tree>
 *   <Items activeItemSet="1">
 *     <Item id="1">Rarity: UNIQUE\n...</Item>
 *     <Slot name="Weapon 1" itemId="1"/>
 *   </Items>
 *   <Skills activeSkillSet="1">
 *     <SkillSet id="1">
 *       <Skill enabled="true" slot="...">
 *         <Gem gemId="..." level="20" quality="20"/>
 *       </Skill>
 *     </SkillSet>
 *   </Skills>
 *   <Config>
 *     <Input name="enemyLevel" number="83"/>
 *   </Config>
 * </PathOfBuilding>
 * ```
 */

import type { Build, BuildConfig } from 'src/protos/build_pb';
import type { Item } from 'src/protos/items_pb';
import type { SkillGroup, GemInstance } from 'src/protos/skills_pb';
import { CharacterClass } from 'src/protos/common_pb';
import { ItemRarity } from 'src/protos/items_pb';

// =============================================================================
// Constants
// =============================================================================

/** Current PoE2 tree version for new exports */
const POE2_TREE_VERSION = '3_25';

/** XML declaration for generated documents */
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * Default set ID for PoB2's item/skill/spec sets.
 *
 * PoB2 supports multiple item sets, skill sets, and tree specs per build.
 * When exporting, we use set ID 1 as the "active" set since our data model
 * currently represents a single configuration. PoB2 expects this value
 * for attributes like activeItemSet, activeSkillSet, activeSpec, and id.
 */
const DEFAULT_SET_ID = 1;

/**
 * Default character class name for PoB2 XML export.
 *
 * Used when no character class is specified in the build. Warrior is chosen
 * as it's the first class in PoE2's class list and is commonly used for
 * placeholder/template builds.
 */
const DEFAULT_CLASS_NAME = 'Warrior';

/**
 * Default character level for PoB2 XML export.
 *
 * Level 1 represents a fresh character. Used when no level is specified
 * in the build data being exported.
 */
const DEFAULT_LEVEL = 1;

/**
 * Default spec/build title for PoB2 XML export.
 *
 * Used as a placeholder name when the build has no name specified.
 * PoB2 displays this in its spec dropdown menu.
 */
const DEFAULT_SPEC_TITLE = 'Default';

/**
 * Starting ID for PoB2 item numbering.
 * PoB2 uses 1-based item IDs in the Items section.
 */
const ITEM_ID_START = 1;

/**
 * Index of the first skill group, used to mark it as the main active skill.
 * PoB2 treats the first skill in the list as the "main" active skill.
 */
const FIRST_SKILL_GROUP_INDEX = 0;

/**
 * Minimum quality value to display in item text.
 * PoB2 treats 0% quality as the default state and omits it from item display.
 */
const MIN_DISPLAYED_QUALITY = 0;

// Item text parsing prefix lengths (for substring extraction)
/** Length of "Rarity: " prefix in item text */
const RARITY_PREFIX_LENGTH = 8;
/** Length of "Item Level: " prefix in item text */
const ITEM_LEVEL_PREFIX_LENGTH = 12;
/** Length of "Implicits: " prefix in item text */
const IMPLICITS_PREFIX_LENGTH = 11;

// =============================================================================
// Character Class Mapping
// =============================================================================

/**
 * Map CharacterClass enum to PoB2 class name string.
 *
 * Note: CHARACTER_CLASS_UNKNOWN maps to 'Scion' for PoB2 compatibility, but this creates
 * an asymmetric mapping since POB_NAME_TO_CLASS maps 'Scion' back to CharacterClass.SCION.
 * This is intentional: UNKNOWN is a placeholder that serializes as a valid class for PoB2,
 * but when we import 'Scion' from PoB2 XML, we correctly identify it as the Scion class.
 */
const CLASS_TO_POB_NAME: Record<CharacterClass, string> = {
  [CharacterClass.CHARACTER_CLASS_UNKNOWN]: 'Scion',
  [CharacterClass.WARRIOR]: 'Warrior',
  [CharacterClass.MONK]: 'Monk',
  [CharacterClass.SORCERESS]: 'Sorceress',
  [CharacterClass.MERCENARY]: 'Mercenary',
  [CharacterClass.HUNTRESS]: 'Huntress',
  [CharacterClass.DRUID]: 'Druid',
  // PoE1 classes (for compatibility)
  [CharacterClass.RANGER]: 'Ranger',
  [CharacterClass.TEMPLAR]: 'Templar',
  [CharacterClass.WITCH]: 'Witch',
  [CharacterClass.MARAUDER]: 'Marauder',
  [CharacterClass.DUELIST]: 'Duelist',
  [CharacterClass.SHADOW]: 'Shadow',
  [CharacterClass.SCION]: 'Scion',
};

/** Map PoB2 class name string to CharacterClass enum */
const POB_NAME_TO_CLASS: Record<string, CharacterClass> = {
  Warrior: CharacterClass.WARRIOR,
  Monk: CharacterClass.MONK,
  Sorceress: CharacterClass.SORCERESS,
  Mercenary: CharacterClass.MERCENARY,
  Huntress: CharacterClass.HUNTRESS,
  Druid: CharacterClass.DRUID,
  // PoE1 classes
  Ranger: CharacterClass.RANGER,
  Templar: CharacterClass.TEMPLAR,
  Witch: CharacterClass.WITCH,
  Marauder: CharacterClass.MARAUDER,
  Duelist: CharacterClass.DUELIST,
  Shadow: CharacterClass.SHADOW,
  Scion: CharacterClass.SCION,
};

// =============================================================================
// Item Rarity Mapping
// =============================================================================

/** Map ItemRarity enum to PoB2 rarity string */
const RARITY_TO_POB: Record<ItemRarity, string> = {
  [ItemRarity.ITEM_RARITY_UNKNOWN]: 'NORMAL',
  [ItemRarity.RARITY_NORMAL]: 'NORMAL',
  [ItemRarity.RARITY_MAGIC]: 'MAGIC',
  [ItemRarity.RARITY_RARE]: 'RARE',
  [ItemRarity.RARITY_UNIQUE]: 'UNIQUE',
};

/** Map PoB2 rarity string to ItemRarity enum */
const POB_TO_RARITY: Record<string, ItemRarity> = {
  NORMAL: ItemRarity.RARITY_NORMAL,
  MAGIC: ItemRarity.RARITY_MAGIC,
  RARE: ItemRarity.RARITY_RARE,
  UNIQUE: ItemRarity.RARITY_UNIQUE,
};

// =============================================================================
// XML Helper Functions
// =============================================================================

/**
 * Escape special XML characters in text content.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape special XML characters in attribute values.
 * Uses the same escaping as text content.
 */
function escapeAttr(value: string): string {
  return escapeXml(value);
}

/**
 * Build an XML element string with attributes.
 *
 * Attribute filtering:
 * - `undefined` and empty strings are excluded (no attribute rendered)
 * - `false` renders as "false", `0` renders as "0" (both are valid values)
 * - `true` renders as "true"
 *
 * Self-closing behavior:
 * - `selfClose=true` with no content: renders `<tag/>` or `<tag attr="val"/>`
 * - `selfClose=true` with content: ignores selfClose, renders full element with content
 *   (content takes precedence over self-closing since self-closing with content is invalid XML)
 */
function xmlElement(
  tag: string,
  attrs: Record<string, string | number | boolean | undefined>,
  content?: string,
  selfClose = false
): string {
  // Filter out undefined and empty strings; numbers (including 0) and booleans are preserved
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
    .join(' ');

  const openTag = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;

  if (selfClose && !content) {
    return attrStr ? `<${tag} ${attrStr}/>` : `<${tag}/>`;
  }

  return `${openTag}${content ?? ''}</${tag}>`;
}

/**
 * Get attribute value from an element, returning undefined if not present.
 *
 * In the DOM, `getAttribute` returns:
 * - `null` when the attribute is missing
 * - a string (including `''`) when the attribute exists
 *
 * We normalize `null` to `undefined` so callers can distinguish:
 * - `undefined` → attribute not present (suitable for optional props with exactOptionalPropertyTypes)
 * - `''` → attribute present with an empty value
 */
function getAttr(element: Element, name: string): string | undefined {
  const value = element.getAttribute(name);
  if (value === null) return undefined;
  return value;
}

/**
 * Get numeric attribute value from an element.
 */
function getNumAttr(element: Element, name: string): number | undefined {
  const value = getAttr(element, name);
  if (value === undefined) return undefined;
  const num = Number(value);
  // Reject NaN and non-finite values (Infinity, -Infinity) from malformed XML
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Get boolean attribute value from an element.
 */
function getBoolAttr(element: Element, name: string): boolean | undefined {
  const value = getAttr(element, name);
  if (value === undefined) return undefined;
  return value === 'true' || value === '1';
}

// =============================================================================
// Build to XML Serialization
// =============================================================================

/**
 * Serialize allocated node IDs to PoB2 format.
 * Format: comma-separated numeric node IDs
 */
function serializeNodes(nodeIds: string[]): string {
  return nodeIds.join(',');
}

/**
 * Serialize mastery selections to PoB2 format.
 * Format: "nodeId:effectId,nodeId:effectId,..."
 */
function serializeMasteryEffects(selections: Record<string, string>): string {
  return Object.entries(selections)
    .map(([nodeId, effectId]) => `${nodeId}:${effectId}`)
    .join(',');
}

/**
 * Serialize a single item to PoB2 text format.
 * PoB uses a line-based format for items.
 */
function serializeItem(item: Item): string {
  const lines: string[] = [];

  // Rarity line
  // Explicitly check for undefined so ItemRarity.ITEM_RARITY_UNKNOWN (0) still maps via RARITY_TO_POB.
  // Using a truthiness check (e.g. ||) would incorrectly treat 0 as "no rarity" and fallback.
  const rarity = item.rarity !== undefined ? RARITY_TO_POB[item.rarity] : 'NORMAL';
  lines.push(`Rarity: ${rarity}`);

  // Name (for uniques/rares) or base name
  if (item.name) {
    lines.push(item.name);
  }
  if (item.baseName) {
    lines.push(item.baseName);
  } else if (item.typeLine) {
    lines.push(item.typeLine);
  }

  // Item level
  if (item.itemLevel !== undefined) {
    lines.push(`Item Level: ${item.itemLevel}`);
  }

  // Quality - PoB2 only displays quality when > MIN_DISPLAYED_QUALITY
  if (item.quality !== undefined && item.quality > MIN_DISPLAYED_QUALITY) {
    lines.push(`Quality: +${item.quality}%`);
  }

  // Corrupted
  if (item.corrupted) {
    lines.push('Corrupted');
  }

  // Implicit mods
  if (item.implicitMods && item.implicitMods.length > 0) {
    lines.push('Implicits: ' + item.implicitMods.length);
    for (const mod of item.implicitMods) {
      lines.push(mod);
    }
  }

  // Explicit mods
  if (item.explicitMods && item.explicitMods.length > 0) {
    for (const mod of item.explicitMods) {
      lines.push(mod);
    }
  }

  return lines.join('\n');
}

/**
 * Serialize items section to XML.
 */
function serializeItems(items: Record<string, Item>): string {
  const itemElements: string[] = [];
  const slotElements: string[] = [];
  let itemId = ITEM_ID_START;

  for (const [slot, item] of Object.entries(items)) {
    const currentId = itemId++;

    // Item element with text content
    const itemContent = serializeItem(item);
    itemElements.push(xmlElement('Item', { id: currentId }, itemContent));

    // Slot element linking slot name to item ID
    slotElements.push(xmlElement('Slot', { name: slot, itemId: currentId }, '', true));
  }

  const content = [...itemElements, ...slotElements].join('\n');
  return xmlElement('Items', { activeItemSet: DEFAULT_SET_ID }, '\n' + content + '\n');
}

/**
 * Serialize a gem instance to XML.
 */
function serializeGem(gem: GemInstance): string {
  return xmlElement(
    'Gem',
    {
      gemId: gem.gemId,
      level: gem.level,
      quality: gem.quality,
      enabled: gem.enabled,
      count: gem.count,
    },
    '',
    true
  );
}

/**
 * Serialize skill groups to XML.
 */
function serializeSkills(skillGroups: SkillGroup[]): string {
  if (skillGroups.length === 0) {
    return xmlElement('Skills', { activeSkillSet: DEFAULT_SET_ID }, '');
  }

  const skillSetContent = skillGroups
    .map((group, index) => {
      const gemElements = group.gems.map(serializeGem).join('\n');
      // Only serialize enabled="false" explicitly; missing attribute = true (PoB2 convention)
      const enabledAttr = group.enabled === false ? false : undefined;
      return xmlElement(
        'Skill',
        {
          enabled: enabledAttr,
          slot: group.slot,
          label: group.label,
          mainActiveSkill: index === FIRST_SKILL_GROUP_INDEX ? DEFAULT_SET_ID : undefined,
          includeInFullDPS: group.includeInFullDps,
        },
        gemElements ? '\n' + gemElements + '\n' : ''
      );
    })
    .join('\n');

  const skillSetElement = xmlElement('SkillSet', { id: DEFAULT_SET_ID }, '\n' + skillSetContent + '\n');
  return xmlElement('Skills', { activeSkillSet: DEFAULT_SET_ID }, '\n' + skillSetElement + '\n');
}

/**
 * Serialize build config to XML.
 */
function serializeConfig(config: BuildConfig | undefined): string {
  if (!config) {
    return xmlElement('Config', {}, '');
  }

  const inputs: string[] = [];

  // Enemy configuration
  if (config.enemyLevel !== undefined) {
    inputs.push(xmlElement('Input', { name: 'enemyLevel', number: config.enemyLevel }, '', true));
  }
  if (config.enemyIsBoss !== undefined) {
    inputs.push(
      xmlElement('Input', { name: 'enemyIsBoss', string: config.enemyIsBoss ? 'Pinnacle' : '' }, '', true)
    );
  }

  // Charges
  if (config.powerCharges) {
    inputs.push(xmlElement('Input', { name: 'usePowerCharges', boolean: true }, '', true));
  }
  if (config.frenzyCharges) {
    inputs.push(xmlElement('Input', { name: 'useFrenzyCharges', boolean: true }, '', true));
  }
  if (config.enduranceCharges) {
    inputs.push(xmlElement('Input', { name: 'useEnduranceCharges', boolean: true }, '', true));
  }
  if (config.powerChargeCount !== undefined) {
    inputs.push(xmlElement('Input', { name: 'overridePowerCharges', number: config.powerChargeCount }, '', true));
  }
  if (config.frenzyChargeCount !== undefined) {
    inputs.push(
      xmlElement('Input', { name: 'overrideFrenzyCharges', number: config.frenzyChargeCount }, '', true)
    );
  }
  if (config.enduranceChargeCount !== undefined) {
    inputs.push(
      xmlElement('Input', { name: 'overrideEnduranceCharges', number: config.enduranceChargeCount }, '', true)
    );
  }

  // Combat state
  if (config.isLeeching) {
    inputs.push(xmlElement('Input', { name: 'conditionLeeching', boolean: true }, '', true));
  }
  if (config.isOnLowLife) {
    inputs.push(xmlElement('Input', { name: 'conditionLowLife', boolean: true }, '', true));
  }
  if (config.isOnFullLife) {
    inputs.push(xmlElement('Input', { name: 'conditionFullLife', boolean: true }, '', true));
  }
  if (config.enemyIsChilled) {
    inputs.push(xmlElement('Input', { name: 'enemyConditionChilled', boolean: true }, '', true));
  }
  if (config.enemyIsFrozen) {
    inputs.push(xmlElement('Input', { name: 'enemyConditionFrozen', boolean: true }, '', true));
  }
  if (config.enemyIsShocked) {
    inputs.push(xmlElement('Input', { name: 'enemyConditionShocked', boolean: true }, '', true));
  }
  if (config.enemyIsIgnited) {
    inputs.push(xmlElement('Input', { name: 'enemyConditionIgnited', boolean: true }, '', true));
  }

  return xmlElement('Config', {}, inputs.length > 0 ? '\n' + inputs.join('\n') + '\n' : '');
}

/**
 * Convert a Build object to PoB2-compatible XML string.
 */
export function buildToXml(build: Build): string {
  // Use ?? since CLASS_TO_POB_NAME[undefined] returns undefined (non-existent key)
  const className = CLASS_TO_POB_NAME[build.characterClass as CharacterClass] ?? DEFAULT_CLASS_NAME;

  // Build element
  const buildElement = xmlElement(
    'Build',
    {
      level: build.level ?? DEFAULT_LEVEL,
      className,
      ascendClassName: build.ascendancy,
    },
    '',
    true
  );

  // Tree element with Spec
  const nodes = serializeNodes(build.allocatedNodeIds);
  const masteryEffects = serializeMasteryEffects(build.masterySelections);
  // masteryEffects passed directly - xmlElement filters empty strings (see xmlElement JSDoc)
  const specElement = xmlElement(
    'Spec',
    {
      title: build.name ?? DEFAULT_SPEC_TITLE,
      treeVersion: POE2_TREE_VERSION,
      nodes,
      masteryEffects,
    },
    '',
    true
  );
  const treeElement = xmlElement('Tree', { activeSpec: DEFAULT_SET_ID }, '\n' + specElement + '\n');

  // Items element
  const itemsElement = serializeItems(build.equippedItems);

  // Skills element
  const skillsElement = serializeSkills(build.skillGroups);

  // Config element
  const configElement = serializeConfig(build.config);

  // Notes element (if present)
  const notesElement = build.notes ? xmlElement('Notes', {}, escapeXml(build.notes)) : '';

  // Combine all sections
  const content = [buildElement, treeElement, itemsElement, skillsElement, configElement, notesElement]
    .filter(Boolean)
    .join('\n');

  const rootElement = xmlElement('PathOfBuilding', {}, '\n' + content + '\n');

  return XML_DECLARATION + '\n' + rootElement;
}

// =============================================================================
// XML to Build Deserialization
// =============================================================================

/**
 * Parse allocated node IDs from PoB2 format.
 */
function parseNodes(nodesStr: string | undefined): string[] {
  if (!nodesStr?.trim()) {
    return [];
  }
  return nodesStr.split(',').filter((id) => id.trim() !== '');
}

/**
 * Parse mastery selections from PoB2 format.
 */
function parseMasteryEffects(effectsStr: string | undefined): Record<string, string> {
  if (!effectsStr?.trim()) {
    return {};
  }

  const result: Record<string, string> = {};
  const pairs = effectsStr.split(',');

  for (const pair of pairs) {
    const [nodeId, effectId] = pair.split(':');
    if (nodeId && effectId) {
      result[nodeId.trim()] = effectId.trim();
    }
  }

  return result;
}

/**
 * Parse a single item from PoB2 text format.
 */
function parseItem(itemText: string, itemId: string): Item {
  const lines = itemText.split('\n').map((line) => line.trim());
  const item: Item = {
    id: itemId,
    sockets: [],
    runes: [],
    implicitMods: [],
    explicitMods: [],
    enchantMods: [],
    runeMods: [],
    craftedMods: [],
  };

  let section: 'header' | 'implicits' | 'explicits' = 'header';
  let implicitCount = 0;
  let implicitsParsed = 0;

  for (const line of lines) {
    if (!line) continue;

    // Parse rarity
    if (line.startsWith('Rarity: ')) {
      const rarityStr = line.substring(RARITY_PREFIX_LENGTH).trim().toUpperCase();
      item.rarity = POB_TO_RARITY[rarityStr] ?? ItemRarity.RARITY_NORMAL;
      continue;
    }

    // Parse item level
    if (line.startsWith('Item Level: ')) {
      const parsedLevel = parseInt(line.substring(ITEM_LEVEL_PREFIX_LENGTH), 10);
      if (!Number.isNaN(parsedLevel)) {
        item.itemLevel = parsedLevel;
      }
      continue;
    }

    // Parse quality
    if (line.startsWith('Quality: ')) {
      const qualityMatch = line.match(/Quality:\s*\+?(\d+)%?/);
      const qualityValue = qualityMatch?.[1];
      if (qualityValue) {
        const parsedQuality = parseInt(qualityValue, 10);
        if (!Number.isNaN(parsedQuality)) {
          item.quality = parsedQuality;
        }
      }
      continue;
    }

    // Parse corrupted
    if (line === 'Corrupted') {
      item.corrupted = true;
      continue;
    }

    // Parse implicits count
    if (line.startsWith('Implicits: ')) {
      const parsedImplicitCount = parseInt(line.substring(IMPLICITS_PREFIX_LENGTH), 10);
      implicitCount = Number.isNaN(parsedImplicitCount) ? 0 : parsedImplicitCount;
      section = 'implicits';
      continue;
    }

    // Handle section transitions
    if (section === 'implicits' && implicitsParsed < implicitCount) {
      item.implicitMods.push(line);
      implicitsParsed++;
      if (implicitsParsed >= implicitCount) {
        section = 'explicits';
      }
      continue;
    }

    // In header section, parse name and base
    // For UNIQUE/RARE items: first line after rarity is name, second is baseName
    // For NORMAL/MAGIC items: first line after rarity is baseName (no separate name)
    // After baseName is set, transition to explicits section
    if (section === 'header') {
      if (!item.name && item.rarity !== undefined) {
        if (item.rarity === ItemRarity.RARITY_UNIQUE || item.rarity === ItemRarity.RARITY_RARE) {
          item.name = line;
        } else {
          item.baseName = line;
          section = 'explicits';
        }
      } else if (!item.baseName) {
        item.baseName = line;
        section = 'explicits';
      }
      continue;
    }

    // Explicit mods
    if (section === 'explicits') {
      item.explicitMods.push(line);
    }
  }

  return item;
}

/**
 * Parse items section from XML.
 */
function parseItems(itemsElement: Element | null): Record<string, Item> {
  if (!itemsElement) {
    return {};
  }

  const items: Record<string, Item> = {};
  const itemElements = itemsElement.getElementsByTagName('Item');
  const slotElements = itemsElement.getElementsByTagName('Slot');

  // Build a map of itemId -> Item
  const itemById = new Map<string, Item>();
  for (let i = 0; i < itemElements.length; i++) {
    const itemEl = itemElements.item(i);
    if (!itemEl) continue;
    const id = getAttr(itemEl, 'id') ?? String(i + ITEM_ID_START);
    const itemText = itemEl.textContent ?? '';
    itemById.set(id, parseItem(itemText, id));
  }

  // Map slots to items
  for (let i = 0; i < slotElements.length; i++) {
    const slotEl = slotElements.item(i);
    if (!slotEl) continue;
    const slotName = getAttr(slotEl, 'name');
    const itemId = getAttr(slotEl, 'itemId');

    if (slotName && itemId) {
      const item = itemById.get(itemId);
      if (item) {
        items[slotName] = item;
      }
    }
  }

  return items;
}

/**
 * Parse a gem instance from XML.
 * Only sets optional properties when values exist (exactOptionalPropertyTypes compatibility).
 *
 * Note on id vs gemId:
 * - `id` is the unique instance identifier for this gem in the build (UUID)
 * - `gemId` is the gem definition identifier from PoB2's gem database (e.g., "Fireball")
 * When gemId exists in XML, we use it as the instance id for consistency with PoB2 exports.
 */
function parseGem(gemElement: Element): GemInstance {
  const gemId = getAttr(gemElement, 'gemId');
  const level = getNumAttr(gemElement, 'level');
  const quality = getNumAttr(gemElement, 'quality');
  const enabled = getBoolAttr(gemElement, 'enabled');
  const count = getNumAttr(gemElement, 'count');

  const gem: GemInstance = {
    // Use gemId as instance id when available for PoB2 compatibility, else generate UUID
    id: gemId ?? crypto.randomUUID(),
  };

  if (gemId) gem.gemId = gemId;
  if (level !== undefined) gem.level = level;
  if (quality !== undefined) gem.quality = quality;
  if (enabled !== undefined) gem.enabled = enabled;
  if (count !== undefined) gem.count = count;

  return gem;
}

/**
 * Parse skill groups from XML.
 * Only sets optional properties when values exist (exactOptionalPropertyTypes compatibility).
 */
function parseSkills(skillsElement: Element | null): SkillGroup[] {
  if (!skillsElement) {
    return [];
  }

  const skillGroups: SkillGroup[] = [];
  const skillSetElements = skillsElement.getElementsByTagName('SkillSet');

  // If no SkillSet, try direct Skill elements (older format)
  const firstSkillSet = skillSetElements.item(0);
  const skillElements = firstSkillSet
    ? firstSkillSet.getElementsByTagName('Skill')
    : skillsElement.getElementsByTagName('Skill');

  for (let i = 0; i < skillElements.length; i++) {
    const skillEl = skillElements.item(i);
    if (!skillEl) continue;

    const gemElements = skillEl.getElementsByTagName('Gem');
    const gems: GemInstance[] = [];
    for (let j = 0; j < gemElements.length; j++) {
      const gemEl = gemElements.item(j);
      if (gemEl) {
        gems.push(parseGem(gemEl));
      }
    }

    // PoB2 treats missing 'enabled' attribute as true, so we normalize undefined to true
    // during parsing for consistent behavior. This is intentional - skills are enabled by default.
    const label = getAttr(skillEl, 'label');
    const includeInFullDps = getBoolAttr(skillEl, 'includeInFullDPS');
    const slot = getAttr(skillEl, 'slot');

    // Conditional spread: empty strings are intentionally excluded (meaningless labels/slots)
    const group: SkillGroup = {
      id: crypto.randomUUID(),
      enabled: getBoolAttr(skillEl, 'enabled') ?? true,
      gems,
      ...(label && { label }),
      ...(includeInFullDps !== undefined && { includeInFullDps }),
      ...(slot && { slot }),
    };

    skillGroups.push(group);
  }

  return skillGroups;
}

/**
 * Parse build config from XML.
 * Only sets properties when values are defined (exactOptionalPropertyTypes compatibility).
 */
function parseConfig(configElement: Element | null): BuildConfig | undefined {
  if (!configElement) {
    return undefined;
  }

  const inputs = configElement.getElementsByTagName('Input');
  if (inputs.length === 0) {
    return undefined;
  }

  const config: BuildConfig = {};

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs.item(i);
    if (!input) continue;
    const name = getAttr(input, 'name');
    const numValue = getNumAttr(input, 'number');
    const boolValue = getBoolAttr(input, 'boolean');
    const strValue = getAttr(input, 'string');

    switch (name) {
      case 'enemyLevel':
        if (numValue !== undefined) config.enemyLevel = numValue;
        break;
      case 'enemyIsBoss':
        if (strValue !== undefined) {
          config.enemyIsBoss = strValue === 'Pinnacle' || strValue === 'true';
        }
        break;
      case 'usePowerCharges':
        if (boolValue !== undefined) config.powerCharges = boolValue;
        break;
      case 'useFrenzyCharges':
        if (boolValue !== undefined) config.frenzyCharges = boolValue;
        break;
      case 'useEnduranceCharges':
        if (boolValue !== undefined) config.enduranceCharges = boolValue;
        break;
      case 'overridePowerCharges':
        if (numValue !== undefined) config.powerChargeCount = numValue;
        break;
      case 'overrideFrenzyCharges':
        if (numValue !== undefined) config.frenzyChargeCount = numValue;
        break;
      case 'overrideEnduranceCharges':
        if (numValue !== undefined) config.enduranceChargeCount = numValue;
        break;
      case 'conditionLeeching':
        if (boolValue !== undefined) config.isLeeching = boolValue;
        break;
      case 'conditionLowLife':
        if (boolValue !== undefined) config.isOnLowLife = boolValue;
        break;
      case 'conditionFullLife':
        if (boolValue !== undefined) config.isOnFullLife = boolValue;
        break;
      case 'enemyConditionChilled':
        if (boolValue !== undefined) config.enemyIsChilled = boolValue;
        break;
      case 'enemyConditionFrozen':
        if (boolValue !== undefined) config.enemyIsFrozen = boolValue;
        break;
      case 'enemyConditionShocked':
        if (boolValue !== undefined) config.enemyIsShocked = boolValue;
        break;
      case 'enemyConditionIgnited':
        if (boolValue !== undefined) config.enemyIsIgnited = boolValue;
        break;
    }
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Convert PoB2 XML string to a Build object.
 *
 * @throws Error if XML is invalid or missing required elements
 */
export function xmlToBuild(xml: string): Build {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent}`);
  }

  // Find root element
  const root = doc.documentElement;
  if (root.tagName !== 'PathOfBuilding') {
    throw new Error(`Invalid PoB2 XML: expected root element 'PathOfBuilding', got '${root.tagName}'`);
  }

  // Parse Build element
  // Some legacy/alternative PoB XML exports omit a <Build> element and store build
  // attributes directly on the root <PathOfBuilding> element. Fall back to the root
  // so these formats still import correctly.
  const buildEl = root.querySelector('Build');
  const buildElOrRoot = buildEl ?? root;
  const className = getAttr(buildElOrRoot, 'className') ?? DEFAULT_CLASS_NAME;
  const characterClass = POB_NAME_TO_CLASS[className] ?? CharacterClass.WARRIOR;

  // Parse Tree element
  // In some older or minimal PoB2 XML exports, the Spec element may be:
  // - Directly under the PathOfBuilding root (no Tree wrapper), or
  // - Completely missing when no tree was configured.
  // We first look for Spec under Tree, then fall back to a root-level Spec,
  // and finally treat the root itself as the source of tree attributes.
  const treeEl = root.querySelector('Tree');
  const specEl = treeEl?.querySelector('Spec') ?? root.querySelector('Spec');
  const specElOrRoot = specEl ?? root;
  const nodesStr = getAttr(specElOrRoot, 'nodes');
  const masteryEffectsStr = getAttr(specElOrRoot, 'masteryEffects');

  // Parse other sections
  const itemsEl = root.querySelector('Items');
  const skillsEl = root.querySelector('Skills');
  const configEl = root.querySelector('Config');
  const notesEl = root.querySelector('Notes');

  // Get optional values
  const ascendancy = getAttr(buildElOrRoot, 'ascendClassName');
  const notesText = notesEl?.textContent;
  const config = parseConfig(configEl);

  // Build object using conditional spread for optional properties
  const build: Build = {
    id: crypto.randomUUID(),
    name: getAttr(specElOrRoot, 'title') ?? getAttr(buildElOrRoot, 'buildName') ?? 'Imported Build',
    characterClass,
    level: getNumAttr(buildElOrRoot, 'level') ?? DEFAULT_LEVEL,
    allocatedNodeIds: parseNodes(nodesStr),
    masterySelections: parseMasteryEffects(masteryEffectsStr),
    equippedItems: parseItems(itemsEl),
    skillGroups: parseSkills(skillsEl),
    ...(ascendancy && { ascendancy }),
    ...(config && { config }),
    ...(notesText && { notes: notesText }),
  };

  return build;
}
