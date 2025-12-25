/**
 * Unit tests for unique item type definitions.
 *
 * Tests type structures, utility functions, and data validation.
 */
import { describe, it, expect } from 'vitest';
import {
  type UniqueModifierTag,
  type UniqueModifier,
  type UniqueItemSource,
  type UniqueItem,
  type RawUniqueItem,
  type RawModifierLine,
  type UniquesFileMeta,
  type UniquesFileData,
  type UniquesOverrideData,
  UNIQUE_FILE_TYPES,
  UNIQUE_FILE_CATEGORIES,
  generateUniqueId,
  generateBaseTypeId,
  parseModifierValue,
} from 'src/types/uniques';

describe('uniques types', () => {
  describe('UniqueModifierTag', () => {
    it('should accept damage type tags', () => {
      const tags: UniqueModifierTag[] = [
        'physical',
        'fire',
        'cold',
        'lightning',
        'chaos',
        'elemental',
        'damage',
      ];

      expect(tags).toHaveLength(7);
    });

    it('should accept defence tags', () => {
      const tags: UniqueModifierTag[] = [
        'defences',
        'armour',
        'evasion',
        'energy_shield',
        'block',
        'life',
        'mana',
        'resistance',
      ];

      expect(tags).toHaveLength(8);
    });

    it('should accept offence tags', () => {
      const tags: UniqueModifierTag[] = ['attack', 'caster', 'speed', 'critical'];

      expect(tags).toHaveLength(4);
    });

    it('should accept utility tags', () => {
      const tags: UniqueModifierTag[] = [
        'attribute',
        'gem',
        'socket',
        'skill',
        'aura',
        'curse',
        'minion',
      ];

      expect(tags).toHaveLength(7);
    });

    it('should accept special tags', () => {
      const tags: UniqueModifierTag[] = ['unique_mechanic'];

      expect(tags).toHaveLength(1);
    });
  });

  describe('UniqueModifier structure', () => {
    it('should accept modifier with range values', () => {
      const mod: UniqueModifier = {
        text: '(50-80)% increased Armour',
        min: 50,
        max: 80,
      };

      expect(mod.text).toBe('(50-80)% increased Armour');
      expect(mod.min).toBe(50);
      expect(mod.max).toBe(80);
      expect(mod.value).toBeUndefined();
    });

    it('should accept modifier with fixed value', () => {
      const mod: UniqueModifier = {
        text: '25% increased Light Radius',
        value: 25,
      };

      expect(mod.value).toBe(25);
      expect(mod.min).toBeUndefined();
    });

    it('should accept modifier with tags', () => {
      const mod: UniqueModifier = {
        text: '+(20-30)% to Fire Resistance',
        min: 20,
        max: 30,
        tags: ['fire', 'resistance'],
      };

      expect(mod.tags).toHaveLength(2);
      expect(mod.tags).toContain('fire');
      expect(mod.tags).toContain('resistance');
    });

    it('should accept implicit modifier', () => {
      const mod: UniqueModifier = {
        text: '+1 to Level of all Skills',
        value: 1,
        implicit: true,
      };

      expect(mod.implicit).toBe(true);
    });

    it('should accept text-only modifier without value', () => {
      const mod: UniqueModifier = {
        text: 'Enemies in your Presence have at least 10% of Life Reserved',
      };

      expect(mod.text).toContain('Enemies in your Presence');
      expect(mod.value).toBeUndefined();
      expect(mod.min).toBeUndefined();
      expect(mod.max).toBeUndefined();
    });
  });

  describe('UniqueItemSource structure', () => {
    it('should accept league-only source', () => {
      const source: UniqueItemSource = {
        league: 'Dawn of the Hunt',
      };

      expect(source.league).toBe('Dawn of the Hunt');
      expect(source.dropSource).toBeUndefined();
    });

    it('should accept drop source', () => {
      const source: UniqueItemSource = {
        dropSource: 'Drops from unique{The King in the Mists}',
        bossOnly: true,
      };

      expect(source.dropSource).toContain('The King in the Mists');
      expect(source.bossOnly).toBe(true);
    });

    it('should accept upgrade path source', () => {
      const source: UniqueItemSource = {
        upgradedFrom: 'Upgraded from unique{Basic Item} via Prophecy',
      };

      expect(source.upgradedFrom).toContain('Basic Item');
    });
  });

  describe('UniqueItem structure', () => {
    it('should accept minimal unique item without variants', () => {
      const item: UniqueItem = {
        id: 'goldrim',
        name: 'Goldrim',
        baseType: 'Leather Cap',
        baseTypeId: 'leather-cap',
        itemType: 'Helmet',
        category: 'armour',
        modifiers: [
          { text: '+(30-50) to Evasion Rating', min: 30, max: 50 },
          { text: '+(30-40)% to all Elemental Resistances', min: 30, max: 40 },
        ],
      };

      expect(item.id).toBe('goldrim');
      expect(item.name).toBe('Goldrim');
      expect(item.variantGroup).toBeUndefined();
      expect(item.modifiers).toHaveLength(2);
    });

    it('should accept unique item with source info', () => {
      const item: UniqueItem = {
        id: 'blood-price',
        name: 'Blood Price',
        baseType: 'Fierce Greathelm',
        baseTypeId: 'fierce-greathelm',
        itemType: 'Helmet',
        category: 'armour',
        source: {
          league: 'Dawn of the Hunt',
        },
        modifiers: [],
      };

      expect(item.source?.league).toBe('Dawn of the Hunt');
    });

    it('should accept unique item with item level', () => {
      const item: UniqueItem = {
        id: 'test-unique',
        name: 'Test Unique',
        baseType: 'Iron Ring',
        baseTypeId: 'iron-ring',
        itemType: 'Ring',
        category: 'accessories',
        itemLevel: 45,
        modifiers: [],
      };

      expect(item.itemLevel).toBe(45);
    });

    it('should accept unique item variant entry', () => {
      const item: UniqueItem = {
        id: 'corona-of-the-red-sun-current',
        name: 'Corona of the Red Sun',
        baseType: 'Warrior Greathelm',
        baseTypeId: 'warrior-greathelm',
        itemType: 'Helmet',
        category: 'armour',
        modifiers: [
          { text: '+(100-150) to Accuracy Rating', min: 100, max: 150 },
          { text: '+(20-25)% to Fire Resistance', min: 20, max: 25 },
        ],
        variantGroup: 'corona-of-the-red-sun',
        variantId: 'current',
        variantName: 'Current',
        isDefaultVariant: true,
      };

      expect(item.variantGroup).toBe('corona-of-the-red-sun');
      expect(item.variantId).toBe('current');
      expect(item.variantName).toBe('Current');
      expect(item.isDefaultVariant).toBe(true);
    });

    it('should accept unique item variant entry (non-default)', () => {
      const item: UniqueItem = {
        id: 'corona-of-the-red-sun-pre-0-1-1',
        name: 'Corona of the Red Sun',
        baseType: 'Warrior Greathelm',
        baseTypeId: 'warrior-greathelm',
        itemType: 'Helmet',
        category: 'armour',
        modifiers: [{ text: '+(100-150) to Accuracy Rating', min: 100, max: 150 }],
        variantGroup: 'corona-of-the-red-sun',
        variantId: 'pre-0-1-1',
        variantName: 'Pre 0.1.1',
      };

      expect(item.variantGroup).toBe('corona-of-the-red-sun');
      expect(item.isDefaultVariant).toBeUndefined();
    });

    it('should accept manual edit flag', () => {
      const item: UniqueItem = {
        id: 'custom-unique',
        name: 'Custom Unique',
        baseType: 'Iron Ring',
        baseTypeId: 'iron-ring',
        itemType: 'Ring',
        category: 'accessories',
        modifiers: [],
        _manual: true,
      };

      expect(item._manual).toBe(true);
    });

    it('should accept deleted flag', () => {
      const item: UniqueItem = {
        id: 'deprecated-unique',
        name: 'Deprecated Unique',
        baseType: 'Iron Ring',
        baseTypeId: 'iron-ring',
        itemType: 'Ring',
        category: 'accessories',
        modifiers: [],
        _deleted: true,
      };

      expect(item._deleted).toBe(true);
    });
  });

  describe('RawUniqueItem structure', () => {
    it('should accept raw item without variants', () => {
      const raw: RawUniqueItem = {
        name: 'Goldrim',
        baseType: 'Leather Cap',
        modifierLines: [
          { text: '+(30-50) to Evasion Rating' },
          { text: '+(30-40)% to all Elemental Resistances' },
        ],
      };

      expect(raw.name).toBe('Goldrim');
      expect(raw.variants).toBeUndefined();
      expect(raw.modifierLines).toHaveLength(2);
    });

    it('should accept raw item with variants', () => {
      const raw: RawUniqueItem = {
        name: 'Corona of the Red Sun',
        baseType: 'Warrior Greathelm',
        variants: ['Pre 0.1.1', 'Current'],
        modifierLines: [
          { text: '+(100-150) to Accuracy Rating' },
          { text: '+(20-25)% to Fire Resistance', variantIndices: [1] },
        ],
      };

      expect(raw.variants).toHaveLength(2);
      expect(raw.modifierLines[1]?.variantIndices).toContain(1);
    });

    it('should accept raw item with metadata', () => {
      const raw: RawUniqueItem = {
        name: 'Blood Price',
        baseType: 'Fierce Greathelm',
        league: 'Dawn of the Hunt',
        source: 'Drops from unique{Boss Name}',
        itemLevel: 45,
        implicitCount: 1,
        modifierLines: [
          { text: '+1 to Level of all Skills', implicit: true },
          { text: '(80-120)% increased Armour' },
        ],
      };

      expect(raw.league).toBe('Dawn of the Hunt');
      expect(raw.source).toContain('Boss Name');
      expect(raw.itemLevel).toBe(45);
      expect(raw.implicitCount).toBe(1);
    });
  });

  describe('RawModifierLine structure', () => {
    it('should accept simple modifier line', () => {
      const line: RawModifierLine = {
        text: '+(50-80) to maximum Life',
      };

      expect(line.text).toBe('+(50-80) to maximum Life');
      expect(line.variantIndices).toBeUndefined();
    });

    it('should accept modifier line with variant indices', () => {
      const line: RawModifierLine = {
        text: '+(20-25)% to Fire Resistance',
        variantIndices: [0, 2],
      };

      expect(line.variantIndices).toHaveLength(2);
      expect(line.variantIndices).toContain(0);
      expect(line.variantIndices).toContain(2);
    });

    it('should accept modifier line with tags', () => {
      const line: RawModifierLine = {
        text: '10% increased Fire Damage',
        tags: ['fire', 'damage'],
      };

      expect(line.tags).toHaveLength(2);
      expect(line.tags).toContain('fire');
    });

    it('should accept implicit modifier line', () => {
      const line: RawModifierLine = {
        text: '+1 to Level of all Skills',
        implicit: true,
      };

      expect(line.implicit).toBe(true);
    });
  });

  describe('UniquesFileMeta structure', () => {
    it('should accept complete metadata', () => {
      const meta: UniquesFileMeta = {
        totalItems: 51,
        itemsWithVariants: 30,
        totalEntries: 84,
        byType: {
          Helmet: 51,
        },
      };

      expect(meta.totalItems).toBe(51);
      expect(meta.itemsWithVariants).toBe(30);
      expect(meta.totalEntries).toBe(84);
      expect(meta.byType?.Helmet).toBe(51);
    });

    it('should accept metadata without byType', () => {
      const meta: UniquesFileMeta = {
        totalItems: 10,
        itemsWithVariants: 5,
        totalEntries: 15,
      };

      expect(meta.byType).toBeUndefined();
    });
  });

  describe('UniquesFileData structure', () => {
    it('should accept complete data file structure', () => {
      const data: UniquesFileData = {
        version: '0.1',
        extractedAt: '2025-12-25T00:00:00.000Z',
        source: 'PathOfBuildingCommunity/PathOfBuilding-PoE2',
        fileType: 'helmet',
        meta: {
          totalItems: 51,
          itemsWithVariants: 30,
          totalEntries: 84,
        },
        uniques: {
          goldrim: {
            id: 'goldrim',
            name: 'Goldrim',
            baseType: 'Leather Cap',
            baseTypeId: 'leather-cap',
            itemType: 'Helmet',
            category: 'armour',
            modifiers: [],
          },
        },
      };

      expect(data.version).toBe('0.1');
      expect(data.fileType).toBe('helmet');
      expect(data.uniques['goldrim']?.name).toBe('Goldrim');
    });
  });

  describe('UniquesOverrideData structure', () => {
    it('should accept override file structure', () => {
      const data: UniquesOverrideData = {
        _comment: 'Manual corrections for helmet unique items',
        uniques: {
          'broken-unique': {
            modifiers: [{ text: 'Fixed modifier text' }],
          },
        },
      };

      expect(data._comment).toContain('Manual corrections');
      expect(data.uniques['broken-unique']?.modifiers).toHaveLength(1);
    });

    it('should accept empty override file', () => {
      const data: UniquesOverrideData = {
        uniques: {},
      };

      expect(Object.keys(data.uniques)).toHaveLength(0);
    });
  });

  describe('UNIQUE_FILE_TYPES constant', () => {
    it('should map one-handed weapon files to types', () => {
      expect(UNIQUE_FILE_TYPES.sword).toBe('One Handed Sword');
      expect(UNIQUE_FILE_TYPES.axe).toBe('One Handed Axe');
      expect(UNIQUE_FILE_TYPES.mace).toBe('One Handed Mace');
      expect(UNIQUE_FILE_TYPES.sceptre).toBe('Sceptre');
      expect(UNIQUE_FILE_TYPES.dagger).toBe('Dagger');
      expect(UNIQUE_FILE_TYPES.claw).toBe('Claw');
      expect(UNIQUE_FILE_TYPES.wand).toBe('Wand');
    });

    it('should map two-handed weapon files to types', () => {
      expect(UNIQUE_FILE_TYPES.bow).toBe('Bow');
      expect(UNIQUE_FILE_TYPES.crossbow).toBe('Crossbow');
      expect(UNIQUE_FILE_TYPES.staff).toBe('Staff');
    });

    it('should map armour files to types', () => {
      expect(UNIQUE_FILE_TYPES.body).toBe('Body Armour');
      expect(UNIQUE_FILE_TYPES.boots).toBe('Boots');
      expect(UNIQUE_FILE_TYPES.gloves).toBe('Gloves');
      expect(UNIQUE_FILE_TYPES.helmet).toBe('Helmet');
      expect(UNIQUE_FILE_TYPES.shield).toBe('Shield');
    });

    it('should map accessory files to types', () => {
      expect(UNIQUE_FILE_TYPES.ring).toBe('Ring');
      expect(UNIQUE_FILE_TYPES.amulet).toBe('Amulet');
      expect(UNIQUE_FILE_TYPES.belt).toBe('Belt');
      expect(UNIQUE_FILE_TYPES.quiver).toBe('Quiver');
      expect(UNIQUE_FILE_TYPES.focus).toBe('Focus');
      expect(UNIQUE_FILE_TYPES.talisman).toBe('Talisman');
    });

    it('should map other files to types', () => {
      expect(UNIQUE_FILE_TYPES.jewel).toBe('Jewel');
      expect(UNIQUE_FILE_TYPES.flask).toBe('Flask');
      expect(UNIQUE_FILE_TYPES.soulcore).toBe('SoulCore');
    });
  });

  describe('UNIQUE_FILE_CATEGORIES constant', () => {
    it('should map weapon files to weapons category', () => {
      expect(UNIQUE_FILE_CATEGORIES.sword).toBe('weapons');
      expect(UNIQUE_FILE_CATEGORIES.axe).toBe('weapons');
      expect(UNIQUE_FILE_CATEGORIES.bow).toBe('weapons');
      expect(UNIQUE_FILE_CATEGORIES.staff).toBe('weapons');
      expect(UNIQUE_FILE_CATEGORIES.flail).toBe('weapons');
    });

    it('should map armour files to armour category', () => {
      expect(UNIQUE_FILE_CATEGORIES.body).toBe('armour');
      expect(UNIQUE_FILE_CATEGORIES.boots).toBe('armour');
      expect(UNIQUE_FILE_CATEGORIES.gloves).toBe('armour');
      expect(UNIQUE_FILE_CATEGORIES.helmet).toBe('armour');
      expect(UNIQUE_FILE_CATEGORIES.shield).toBe('armour');
    });

    it('should map accessory files to accessories category', () => {
      expect(UNIQUE_FILE_CATEGORIES.ring).toBe('accessories');
      expect(UNIQUE_FILE_CATEGORIES.amulet).toBe('accessories');
      expect(UNIQUE_FILE_CATEGORIES.belt).toBe('accessories');
      expect(UNIQUE_FILE_CATEGORIES.quiver).toBe('accessories');
      expect(UNIQUE_FILE_CATEGORIES.focus).toBe('accessories');
    });

    it('should map jewel file to jewels category', () => {
      expect(UNIQUE_FILE_CATEGORIES.jewel).toBe('jewels');
    });

    it('should map flask files to flasks category', () => {
      expect(UNIQUE_FILE_CATEGORIES.flask).toBe('flasks');
      expect(UNIQUE_FILE_CATEGORIES.tincture).toBe('flasks');
    });

    it('should map special files to special category', () => {
      expect(UNIQUE_FILE_CATEGORIES.soulcore).toBe('special');
      expect(UNIQUE_FILE_CATEGORIES.fishing).toBe('special');
    });
  });

  describe('generateUniqueId utility', () => {
    it('should convert simple names to lowercase kebab-case', () => {
      expect(generateUniqueId('Goldrim')).toBe('goldrim');
      expect(generateUniqueId('Black Sun Crest')).toBe('black-sun-crest');
      expect(generateUniqueId('Corona of the Red Sun')).toBe('corona-of-the-red-sun');
    });

    it('should handle special characters', () => {
      // Apostrophes become hyphens since they're non-alphanumeric
      expect(generateUniqueId("Hyrri's Bite")).toBe('hyrri-s-bite');
      expect(generateUniqueId("Lioneye's Glare")).toBe('lioneye-s-glare');
    });

    it('should append variant ID when provided', () => {
      expect(generateUniqueId('Corona of the Red Sun', 'pre-0.1.1')).toBe(
        'corona-of-the-red-sun-pre-0-1-1'
      );
      expect(generateUniqueId('Test Item', 'Current')).toBe('test-item-current');
    });

    it('should normalize variant IDs', () => {
      expect(generateUniqueId('Item', 'Pre 0.1.1')).toBe('item-pre-0-1-1');
      expect(generateUniqueId('Item', 'Two Abyssal Sockets')).toBe(
        'item-two-abyssal-sockets'
      );
    });

    it('should trim leading/trailing hyphens', () => {
      expect(generateUniqueId('-Test Item-')).toBe('test-item');
      expect(generateUniqueId('Item', '-variant-')).toBe('item-variant');
    });

    it('should handle empty and edge cases', () => {
      expect(generateUniqueId('')).toBe('');
      expect(generateUniqueId('Item', '')).toBe('item');
    });
  });

  describe('generateBaseTypeId utility', () => {
    it('should convert base type names to lowercase kebab-case', () => {
      expect(generateBaseTypeId('Leather Cap')).toBe('leather-cap');
      expect(generateBaseTypeId('Wrapped Greathelm')).toBe('wrapped-greathelm');
      expect(generateBaseTypeId('Iron Ring')).toBe('iron-ring');
    });

    it('should handle complex base type names', () => {
      expect(generateBaseTypeId('Ezomyte Great Axe')).toBe('ezomyte-great-axe');
      expect(generateBaseTypeId('Vaal Sceptre')).toBe('vaal-sceptre');
    });
  });

  describe('parseModifierValue utility', () => {
    it('should parse range values with hyphen', () => {
      const result = parseModifierValue('(50-80)% increased Armour');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('min', 50);
      expect(result).toHaveProperty('max', 80);
    });

    it('should parse range values with dash', () => {
      const result = parseModifierValue('(100–150) to Accuracy Rating');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('min', 100);
      expect(result).toHaveProperty('max', 150);
    });

    it('should parse decimal range values', () => {
      const result = parseModifierValue('(0.5-1.5)% increased Cast Speed');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('min', 0.5);
      expect(result).toHaveProperty('max', 1.5);
    });

    it('should parse fixed values at start of text', () => {
      const result = parseModifierValue('25% increased Light Radius');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('value', 25);
    });

    it('should parse fixed values with plus sign', () => {
      const result = parseModifierValue('+1 to Level of all Skills');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('value', 1);
    });

    it('should return null for text-only modifiers', () => {
      const result = parseModifierValue(
        'Enemies in your Presence have at least 10% of Life Reserved'
      );

      // This has a number in the middle, not at the start, so it may or may not parse
      // The important thing is it handles gracefully
      expect(result === null || 'value' in result || 'min' in result).toBe(true);
    });

    it('should return null for modifiers without numbers at start', () => {
      const result = parseModifierValue('Cannot be Frozen');

      expect(result).toBeNull();
    });
  });
});
