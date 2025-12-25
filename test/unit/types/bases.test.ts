/**
 * Unit tests for item base type definitions.
 *
 * Tests type structures, utility functions, and data validation.
 */
import { describe, it, expect } from 'vitest';
import {
  type ItemBaseCategory,
  type ItemBaseType,
  type ArmourSubType,
  type JewelSubType,
  type WeaponStats,
  type ArmourStats,
  type FlaskStats,
  type ItemRequirements,
  type ItemBaseTags,
  type RawItemBase,
  type ItemBase,
  type RawItemBasesData,
  LUA_FILE_CATEGORIES,
  getCategoryForType,
  generateBaseId,
} from 'src/types/bases';

describe('bases types', () => {
  describe('ItemBaseCategory', () => {
    it('should accept all valid categories', () => {
      const categories: ItemBaseCategory[] = [
        'weapons',
        'armour',
        'accessories',
        'jewels',
        'flasks',
        'special',
      ];

      expect(categories).toHaveLength(6);
    });
  });

  describe('ItemBaseType', () => {
    it('should accept one-handed weapon types', () => {
      const types: ItemBaseType[] = [
        'One Handed Sword',
        'One Handed Axe',
        'One Handed Mace',
        'Sceptre',
        'Dagger',
        'Claw',
        'Wand',
        'Flail',
        'Spear',
      ];

      expect(types).toHaveLength(9);
    });

    it('should accept two-handed weapon types', () => {
      const types: ItemBaseType[] = [
        'Two Handed Sword',
        'Two Handed Axe',
        'Two Handed Mace',
        'Staff',
        'Warstaff',
        'Bow',
        'Crossbow',
      ];

      expect(types).toHaveLength(7);
    });

    it('should accept armour types', () => {
      const types: ItemBaseType[] = [
        'Body Armour',
        'Boots',
        'Gloves',
        'Helmet',
        'Shield',
      ];

      expect(types).toHaveLength(5);
    });

    it('should accept accessory types', () => {
      const types: ItemBaseType[] = [
        'Ring',
        'Amulet',
        'Belt',
        'Quiver',
        'Focus',
        'Talisman',
      ];

      expect(types).toHaveLength(6);
    });

    it('should accept other item types', () => {
      const types: ItemBaseType[] = [
        'Jewel',
        'Flask',
        'Charm',
        'Life Flask',
        'Mana Flask',
        'Fishing Rod',
        'Trap Tool',
      ];

      expect(types).toHaveLength(7);
    });

    it('should accept special PoE2 types', () => {
      const types: ItemBaseType[] = ['SoulCore', 'Rune', 'Idol'];

      expect(types).toHaveLength(3);
    });
  });

  describe('ArmourSubType', () => {
    it('should accept all armour subtypes', () => {
      const subtypes: ArmourSubType[] = [
        'Armour',
        'Evasion',
        'Energy Shield',
        'Armour/Evasion',
        'Armour/Energy Shield',
        'Evasion/Energy Shield',
        'Armour/Evasion/Energy Shield',
      ];

      expect(subtypes).toHaveLength(7);
    });
  });

  describe('JewelSubType', () => {
    it('should accept all jewel subtypes', () => {
      const subtypes: JewelSubType[] = ['Radius', 'Timeless'];

      expect(subtypes).toHaveLength(2);
    });
  });

  describe('WeaponStats structure', () => {
    it('should accept physical weapon stats', () => {
      const stats: WeaponStats = {
        PhysicalMin: 10,
        PhysicalMax: 25,
        CritChanceBase: 5,
        AttackRateBase: 1.5,
        Range: 11,
      };

      expect(stats.PhysicalMin).toBe(10);
      expect(stats.PhysicalMax).toBe(25);
      expect(stats.CritChanceBase).toBe(5);
      expect(stats.AttackRateBase).toBe(1.5);
      expect(stats.Range).toBe(11);
    });

    it('should accept elemental weapon stats', () => {
      const stats: WeaponStats = {
        ColdMin: 5,
        ColdMax: 15,
        CritChanceBase: 6,
        AttackRateBase: 1.2,
      };

      expect(stats.ColdMin).toBe(5);
      expect(stats.ColdMax).toBe(15);
      expect(stats.PhysicalMin).toBeUndefined();
    });

    it('should accept mixed damage weapon stats', () => {
      const stats: WeaponStats = {
        PhysicalMin: 20,
        PhysicalMax: 40,
        FireMin: 10,
        FireMax: 20,
        LightningMin: 5,
        LightningMax: 50,
        CritChanceBase: 7,
        AttackRateBase: 1.8,
        Range: 13,
      };

      expect(stats.PhysicalMin).toBe(20);
      expect(stats.FireMin).toBe(10);
      expect(stats.LightningMax).toBe(50);
    });
  });

  describe('ArmourStats structure', () => {
    it('should accept pure armour stats', () => {
      const stats: ArmourStats = {
        Armour: 500,
        MovementPenalty: 0.05,
      };

      expect(stats.Armour).toBe(500);
      expect(stats.MovementPenalty).toBe(0.05);
    });

    it('should accept pure evasion stats', () => {
      const stats: ArmourStats = {
        Evasion: 400,
        MovementPenalty: 0.03,
      };

      expect(stats.Evasion).toBe(400);
    });

    it('should accept pure energy shield stats', () => {
      const stats: ArmourStats = {
        EnergyShield: 200,
      };

      expect(stats.EnergyShield).toBe(200);
      expect(stats.Armour).toBeUndefined();
    });

    it('should accept hybrid armour stats', () => {
      const stats: ArmourStats = {
        Armour: 250,
        Evasion: 250,
        MovementPenalty: 0.04,
      };

      expect(stats.Armour).toBe(250);
      expect(stats.Evasion).toBe(250);
    });

    it('should accept shield stats with block chance', () => {
      const stats: ArmourStats = {
        Armour: 300,
        BlockChance: 25,
      };

      expect(stats.BlockChance).toBe(25);
    });
  });

  describe('FlaskStats structure', () => {
    it('should accept life flask stats', () => {
      const stats: FlaskStats = {
        duration: 3,
        chargesUsed: 10,
        chargesMax: 30,
        life: 500,
      };

      expect(stats.duration).toBe(3);
      expect(stats.life).toBe(500);
    });

    it('should accept mana flask stats', () => {
      const stats: FlaskStats = {
        duration: 4,
        chargesUsed: 15,
        chargesMax: 45,
        mana: 300,
      };

      expect(stats.mana).toBe(300);
    });

    it('should accept charm stats with buff', () => {
      const stats: FlaskStats = {
        duration: 3,
        chargesUsed: 40,
        chargesMax: 40,
        buff: ['Immune to Freeze'],
      };

      expect(stats.buff).toHaveLength(1);
      expect(stats.buff?.[0]).toBe('Immune to Freeze');
    });
  });

  describe('ItemRequirements structure', () => {
    it('should accept empty requirements', () => {
      const req: ItemRequirements = {};

      expect(req.level).toBeUndefined();
      expect(req.str).toBeUndefined();
    });

    it('should accept level-only requirements', () => {
      const req: ItemRequirements = {
        level: 50,
      };

      expect(req.level).toBe(50);
    });

    it('should accept single attribute requirements', () => {
      const req: ItemRequirements = {
        level: 20,
        str: 50,
      };

      expect(req.str).toBe(50);
      expect(req.dex).toBeUndefined();
    });

    it('should accept mixed attribute requirements', () => {
      const req: ItemRequirements = {
        level: 60,
        str: 80,
        dex: 40,
        int: 40,
      };

      expect(req.str).toBe(80);
      expect(req.dex).toBe(40);
      expect(req.int).toBe(40);
    });
  });

  describe('ItemBaseTags structure', () => {
    it('should accept weapon tags', () => {
      const tags: ItemBaseTags = {
        default: true,
        weapon: true,
        one_hand_weapon: true,
        onehand: true,
        sword: true,
        ezomyte_basetype: true,
      };

      expect(tags.weapon).toBe(true);
      expect(tags.sword).toBe(true);
    });

    it('should accept armour tags', () => {
      const tags: ItemBaseTags = {
        default: true,
        armour: true,
        body_armour: true,
        str_armour: true,
      };

      expect(tags.armour).toBe(true);
      expect(tags.body_armour).toBe(true);
    });

    it('should accept accessory tags', () => {
      const tags: ItemBaseTags = {
        default: true,
        ring: true,
        not_for_sale: true,
        demigods: true,
      };

      expect(tags.ring).toBe(true);
      expect(tags.demigods).toBe(true);
    });

    it('should allow extensible tags', () => {
      const tags: ItemBaseTags = {
        default: true,
        custom_future_tag: true,
        another_tag: false,
      };

      expect(tags.custom_future_tag).toBe(true);
      expect(tags.another_tag).toBe(false);
    });
  });

  describe('RawItemBase structure', () => {
    it('should accept minimal weapon base', () => {
      const base: RawItemBase = {
        name: 'Shortsword',
        type: 'One Handed Sword',
        quality: 20,
        socketLimit: 3,
        tags: { default: true, weapon: true, sword: true },
        weapon: {
          PhysicalMin: 6,
          PhysicalMax: 9,
          CritChanceBase: 5,
          AttackRateBase: 1.55,
          Range: 11,
        },
        req: {},
      };

      expect(base.name).toBe('Shortsword');
      expect(base.type).toBe('One Handed Sword');
      expect(base.weapon?.PhysicalMin).toBe(6);
    });

    it('should accept armour base with subType', () => {
      const base: RawItemBase = {
        name: 'Rusted Cuirass',
        type: 'Body Armour',
        subType: 'Armour',
        quality: 20,
        socketLimit: 4,
        tags: { default: true, armour: true, body_armour: true },
        armour: { Armour: 45, MovementPenalty: 0.05 },
        req: {},
      };

      expect(base.subType).toBe('Armour');
      expect(base.armour?.Armour).toBe(45);
    });

    it('should accept ring base with implicit', () => {
      const base: RawItemBase = {
        name: 'Ruby Ring',
        type: 'Ring',
        tags: { default: true, ring: true },
        implicit: '+(20-30)% to Fire Resistance',
        implicitModTypes: [['elemental', 'fire', 'resistance']],
        req: { level: 8 },
      };

      expect(base.implicit).toBe('+(20-30)% to Fire Resistance');
      expect(base.implicitModTypes).toHaveLength(1);
    });

    it('should accept charm base', () => {
      const base: RawItemBase = {
        name: 'Thawing Charm',
        type: 'Charm',
        quality: 20,
        tags: { default: true, flask: true, utility_flask: true },
        implicit: 'Used when you become Frozen',
        charm: {
          duration: 3,
          chargesUsed: 40,
          chargesMax: 40,
          buff: ['Immune to Freeze'],
        },
        req: { level: 12 },
      };

      expect(base.charm?.buff).toContain('Immune to Freeze');
    });

    it('should accept manual edit flag', () => {
      const base: RawItemBase = {
        name: 'Custom Item',
        type: 'Ring',
        tags: { default: true },
        req: {},
        _manual: true,
      };

      expect(base._manual).toBe(true);
    });
  });

  describe('ItemBase optimized structure', () => {
    it('should have required fields', () => {
      const base: ItemBase = {
        id: 'shortsword',
        name: 'Shortsword',
        type: 'One Handed Sword',
        category: 'weapons',
        quality: 20,
        socketLimit: 3,
        tags: { default: true, weapon: true },
        weapon: {
          PhysicalMin: 6,
          PhysicalMax: 9,
          CritChanceBase: 5,
          AttackRateBase: 1.55,
        },
        requirements: {},
      };

      expect(base.id).toBe('shortsword');
      expect(base.category).toBe('weapons');
    });
  });

  describe('RawItemBasesData structure', () => {
    it('should accept complete data file structure', () => {
      const data: RawItemBasesData = {
        version: '0.1',
        extractedAt: '2025-12-25T00:00:00.000Z',
        source: 'PathOfBuildingCommunity/PathOfBuilding-PoE2',
        category: 'weapons',
        meta: {
          totalBases: 363,
          byType: {
            'One Handed Sword': 23,
            'Two Handed Sword': 23,
          },
        },
        bases: {
          Shortsword: {
            name: 'Shortsword',
            type: 'One Handed Sword',
            tags: { default: true },
            req: {},
          },
        },
      };

      expect(data.version).toBe('0.1');
      expect(data.category).toBe('weapons');
      expect(data.meta.totalBases).toBe(363);
    });
  });

  describe('LUA_FILE_CATEGORIES constant', () => {
    it('should map weapon files to weapons category', () => {
      expect(LUA_FILE_CATEGORIES.sword).toBe('weapons');
      expect(LUA_FILE_CATEGORIES.axe).toBe('weapons');
      expect(LUA_FILE_CATEGORIES.bow).toBe('weapons');
      expect(LUA_FILE_CATEGORIES.staff).toBe('weapons');
    });

    it('should map armour files to armour category', () => {
      expect(LUA_FILE_CATEGORIES.body).toBe('armour');
      expect(LUA_FILE_CATEGORIES.boots).toBe('armour');
      expect(LUA_FILE_CATEGORIES.shield).toBe('armour');
    });

    it('should map accessory files to accessories category', () => {
      expect(LUA_FILE_CATEGORIES.ring).toBe('accessories');
      expect(LUA_FILE_CATEGORIES.amulet).toBe('accessories');
      expect(LUA_FILE_CATEGORIES.belt).toBe('accessories');
    });

    it('should map jewel file to jewels category', () => {
      expect(LUA_FILE_CATEGORIES.jewel).toBe('jewels');
    });

    it('should map flask file to flasks category', () => {
      expect(LUA_FILE_CATEGORIES.flask).toBe('flasks');
    });

    it('should map special files to special category', () => {
      expect(LUA_FILE_CATEGORIES.soulcore).toBe('special');
      expect(LUA_FILE_CATEGORIES.fishing).toBe('special');
    });
  });

  describe('getCategoryForType utility', () => {
    it('should return weapons for weapon types', () => {
      expect(getCategoryForType('One Handed Sword')).toBe('weapons');
      expect(getCategoryForType('Two Handed Axe')).toBe('weapons');
      expect(getCategoryForType('Bow')).toBe('weapons');
      expect(getCategoryForType('Wand')).toBe('weapons');
      expect(getCategoryForType('Staff')).toBe('weapons');
      expect(getCategoryForType('Dagger')).toBe('weapons');
    });

    it('should return armour for armour types', () => {
      expect(getCategoryForType('Body Armour')).toBe('armour');
      expect(getCategoryForType('Boots')).toBe('armour');
      expect(getCategoryForType('Gloves')).toBe('armour');
      expect(getCategoryForType('Helmet')).toBe('armour');
      expect(getCategoryForType('Shield')).toBe('armour');
    });

    it('should return accessories for accessory types', () => {
      expect(getCategoryForType('Ring')).toBe('accessories');
      expect(getCategoryForType('Amulet')).toBe('accessories');
      expect(getCategoryForType('Belt')).toBe('accessories');
      expect(getCategoryForType('Quiver')).toBe('accessories');
      expect(getCategoryForType('Focus')).toBe('accessories');
      expect(getCategoryForType('Talisman')).toBe('accessories');
    });

    it('should return jewels for jewel type', () => {
      expect(getCategoryForType('Jewel')).toBe('jewels');
    });

    it('should return flasks for flask types', () => {
      expect(getCategoryForType('Flask')).toBe('flasks');
      expect(getCategoryForType('Charm')).toBe('flasks');
      expect(getCategoryForType('Life Flask')).toBe('flasks');
      expect(getCategoryForType('Mana Flask')).toBe('flasks');
    });

    it('should return special for special types', () => {
      expect(getCategoryForType('SoulCore')).toBe('special');
      expect(getCategoryForType('Rune')).toBe('special');
      expect(getCategoryForType('Idol')).toBe('special');
      expect(getCategoryForType('Fishing Rod')).toBe('special');
    });
  });

  describe('generateBaseId utility', () => {
    it('should convert simple names to lowercase kebab-case', () => {
      expect(generateBaseId('Shortsword')).toBe('shortsword');
      expect(generateBaseId('Ruby Ring')).toBe('ruby-ring');
      expect(generateBaseId('Iron Cuirass')).toBe('iron-cuirass');
    });

    it('should handle special characters', () => {
      expect(generateBaseId("Ezomyte Blade")).toBe('ezomyte-blade');
      expect(generateBaseId('Time-Lost Ruby')).toBe('time-lost-ruby');
    });

    it('should handle multiple spaces and special chars', () => {
      expect(generateBaseId('One Handed Sword')).toBe('one-handed-sword');
      expect(generateBaseId('Armour/Evasion Shield')).toBe(
        'armour-evasion-shield'
      );
    });

    it('should trim leading/trailing hyphens', () => {
      expect(generateBaseId('-Test Item-')).toBe('test-item');
      expect(generateBaseId('  Spaced  ')).toBe('spaced');
    });

    it('should handle empty and edge cases', () => {
      expect(generateBaseId('')).toBe('');
      expect(generateBaseId('   ')).toBe('');
    });
  });
});
