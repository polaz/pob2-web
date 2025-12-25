/**
 * Unit tests for ItemInstance class.
 *
 * Tests item creation, property access, computed stats, and helper methods.
 */
import { describe, it, expect } from 'vitest';
import type { Item as ProtoItem } from 'src/protos/items_pb';
import { ItemRarity, ItemType } from 'src/protos/items_pb';
import {
  createItemInstance,
  createEmptyItem,
} from 'src/engine/items/Item';
import type { ItemBase } from 'src/engine/items/types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a minimal proto item for testing.
 */
function createProtoItem(overrides: Partial<ProtoItem> = {}): ProtoItem {
  return {
    id: 'test-item-1',
    sockets: [],
    runes: [],
    implicitMods: [],
    explicitMods: [],
    enchantMods: [],
    runeMods: [],
    craftedMods: [],
    ...overrides,
  };
}

/**
 * Creates a test weapon item.
 */
function createWeaponItem(overrides: Partial<ProtoItem> = {}): ProtoItem {
  return createProtoItem({
    name: 'Starforge',
    baseName: 'Infernal Sword',
    rarity: ItemRarity.RARITY_UNIQUE,
    itemType: ItemType.TWO_HAND_SWORD,
    itemLevel: 83,
    quality: 20,
    weaponData: {
      physicalMin: 468,
      physicalMax: 702,
      critChance: 500, // 5.00%
      attackSpeed: 1.3,
      range: 13,
    },
    explicitMods: [
      '200% increased Physical Damage',
      '30% increased Area of Effect',
    ],
    ...overrides,
  });
}

/**
 * Creates a test armour item.
 */
function createArmourItem(overrides: Partial<ProtoItem> = {}): ProtoItem {
  return createProtoItem({
    name: 'Kaom\'s Heart',
    baseName: 'Glorious Plate',
    rarity: ItemRarity.RARITY_UNIQUE,
    itemType: ItemType.BODY_ARMOUR,
    itemLevel: 68,
    quality: 20,
    armourData: {
      armour: 500,
    },
    explicitMods: [
      '+500 to maximum Life',
      'Has no Sockets',
    ],
    ...overrides,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('ItemInstance', () => {
  // ==========================================================================
  // Basic Properties
  // ==========================================================================

  describe('basic properties', () => {
    it('should create an empty item with createEmptyItem', () => {
      const item = createEmptyItem('test-id');

      expect(item.id).toBe('test-id');
      expect(item.name).toBeUndefined();
      expect(item.baseName).toBeUndefined();
      expect(item.rarity).toBeUndefined();
    });

    it('should create item from proto data', () => {
      const proto = createWeaponItem();
      const item = createItemInstance(proto);

      expect(item.id).toBe('test-item-1');
      expect(item.name).toBe('Starforge');
      expect(item.baseName).toBe('Infernal Sword');
      expect(item.rarity).toBe(ItemRarity.RARITY_UNIQUE);
      expect(item.itemType).toBe(ItemType.TWO_HAND_SWORD);
    });

    it('should access all basic properties', () => {
      const proto = createWeaponItem({
        itemLevel: 85,
        quality: 28,
        corrupted: true,
        mirrored: false,
        fractured: true,
      });
      const item = createItemInstance(proto);

      expect(item.itemLevel).toBe(85);
      expect(item.quality).toBe(28);
      expect(item.corrupted).toBe(true);
      expect(item.mirrored).toBe(false);
      expect(item.fractured).toBe(true);
    });

    it('should have sensible defaults for missing properties', () => {
      const item = createEmptyItem('test');

      expect(item.itemLevel).toBe(1);
      expect(item.quality).toBe(0);
      expect(item.corrupted).toBe(false);
      expect(item.mirrored).toBe(false);
      expect(item.fractured).toBe(false);
      expect(item.requiredLevel).toBe(1);
      expect(item.requiredStr).toBe(0);
      expect(item.requiredDex).toBe(0);
      expect(item.requiredInt).toBe(0);
    });
  });

  // ==========================================================================
  // Requirements
  // ==========================================================================

  describe('requirements', () => {
    it('should access requirement properties', () => {
      const proto = createProtoItem({
        requiredLevel: 67,
        requiredStr: 113,
        requiredDex: 113,
        requiredInt: 0,
      });
      const item = createItemInstance(proto);

      expect(item.requiredLevel).toBe(67);
      expect(item.requiredStr).toBe(113);
      expect(item.requiredDex).toBe(113);
      expect(item.requiredInt).toBe(0);
    });
  });

  // ==========================================================================
  // Sockets
  // ==========================================================================

  describe('sockets', () => {
    it('should return empty sockets by default', () => {
      const item = createEmptyItem('test');

      expect(item.sockets).toEqual([]);
      expect(item.socketCount).toBe(0);
      expect(item.maxLinkCount).toBe(0);
    });

    it('should calculate socket count', () => {
      const proto = createProtoItem({
        sockets: [
          { color: 'R', group: 0 },
          { color: 'R', group: 0 },
          { color: 'G', group: 0 },
          { color: 'B', group: 1 },
        ],
      });
      const item = createItemInstance(proto);

      expect(item.socketCount).toBe(4);
    });

    it('should calculate max link count', () => {
      const proto = createProtoItem({
        sockets: [
          { color: 'R', group: 0 },
          { color: 'R', group: 0 },
          { color: 'G', group: 0 },
          { color: 'B', group: 1 },
          { color: 'B', group: 1 },
        ],
      });
      const item = createItemInstance(proto);

      expect(item.maxLinkCount).toBe(3);
    });

    it('should access runes', () => {
      const proto = createProtoItem({
        runes: ['Soul Rune', 'Mind Rune'],
      });
      const item = createItemInstance(proto);

      expect(item.runes).toEqual(['Soul Rune', 'Mind Rune']);
    });
  });

  // ==========================================================================
  // Modifiers
  // ==========================================================================

  describe('modifiers', () => {
    it('should access all mod types', () => {
      const proto = createProtoItem({
        implicitMods: ['+25% to Global Critical Strike Multiplier'],
        explicitMods: ['200% increased Physical Damage', '30% increased Area'],
        enchantMods: ['40% increased Damage'],
        runeMods: ['Adds 10-20 Fire Damage'],
        craftedMods: ['+15% to Fire Resistance'],
      });
      const item = createItemInstance(proto);

      expect(item.implicitMods).toHaveLength(1);
      expect(item.explicitMods).toHaveLength(2);
      expect(item.enchantMods).toHaveLength(1);
      expect(item.runeMods).toHaveLength(1);
      expect(item.craftedMods).toHaveLength(1);
    });

    it('should combine all mod texts', () => {
      const proto = createProtoItem({
        implicitMods: ['implicit1'],
        explicitMods: ['explicit1', 'explicit2'],
        enchantMods: ['enchant1'],
        runeMods: ['rune1'],
        craftedMods: ['crafted1'],
      });
      const item = createItemInstance(proto);

      const allMods = item.allModTexts;
      expect(allMods).toHaveLength(6);
      expect(allMods).toContain('implicit1');
      expect(allMods).toContain('explicit1');
      expect(allMods).toContain('enchant1');
      expect(allMods).toContain('rune1');
      expect(allMods).toContain('crafted1');
    });

    it('should allow setting parsed mods', () => {
      const item = createEmptyItem('test');
      expect(item.parsedMods).toEqual([]);

      const mods = [
        {
          name: 'Life',
          type: 'BASE' as const,
          value: 50,
          flags: 0n,
          keywordFlags: 0n,
          source: 'item' as const,
          sourceId: 'test',
        },
      ];
      item.setParsedMods(mods);

      expect(item.parsedMods).toEqual(mods);
    });
  });

  // ==========================================================================
  // Type Helpers
  // ==========================================================================

  describe('type helpers', () => {
    it('should identify weapon types', () => {
      const weapon = createItemInstance(createWeaponItem());
      const armour = createItemInstance(createArmourItem());

      expect(weapon.isWeapon).toBe(true);
      expect(weapon.isArmour).toBe(false);
      expect(armour.isWeapon).toBe(false);
      expect(armour.isArmour).toBe(true);
    });

    it('should identify two-handed weapons', () => {
      const twoHand = createItemInstance(
        createWeaponItem({ itemType: ItemType.TWO_HAND_SWORD })
      );
      const oneHand = createItemInstance(
        createWeaponItem({ itemType: ItemType.ONE_HAND_SWORD })
      );

      expect(twoHand.isTwoHanded).toBe(true);
      expect(oneHand.isTwoHanded).toBe(false);
    });

    it('should identify data types', () => {
      const weapon = createItemInstance(createWeaponItem());
      const armour = createItemInstance(createArmourItem());
      const empty = createEmptyItem('test');

      expect(weapon.hasWeaponData).toBe(true);
      expect(weapon.hasArmourData).toBe(false);
      expect(armour.hasWeaponData).toBe(false);
      expect(armour.hasArmourData).toBe(true);
      expect(empty.hasWeaponData).toBe(false);
      expect(empty.hasFlaskData).toBe(false);
      expect(empty.hasJewelData).toBe(false);
    });
  });

  // ==========================================================================
  // Computed Stats
  // ==========================================================================

  describe('computed stats', () => {
    it('should compute weapon stats with quality', () => {
      const proto = createProtoItem({
        quality: 20,
        weaponData: {
          physicalMin: 100,
          physicalMax: 200,
          critChance: 500,
          attackSpeed: 1.5,
          range: 11,
        },
      });
      const item = createItemInstance(proto);

      const stats = item.computedWeaponStats;
      expect(stats).toBeDefined();

      // 20% quality = 1.2x physical damage
      expect(stats!.physicalMin).toBe(120);
      expect(stats!.physicalMax).toBe(240);
      expect(stats!.attackSpeed).toBe(1.5);
      expect(stats!.critChance).toBe(0.05); // 500 / 10000
      expect(stats!.range).toBe(11);

      // DPS = (min + max) / 2 * aps = (120 + 240) / 2 * 1.5 = 270
      expect(stats!.physicalDps).toBe(270);
      expect(stats!.totalDps).toBe(270);
    });

    it('should compute weapon stats with elemental damage', () => {
      const proto = createProtoItem({
        quality: 0,
        weaponData: {
          physicalMin: 100,
          physicalMax: 100,
          fireMin: 50,
          fireMax: 100,
          coldMin: 25,
          coldMax: 75,
          critChance: 500,
          attackSpeed: 1.0,
          range: 11,
        },
      });
      const item = createItemInstance(proto);

      const stats = item.computedWeaponStats!;

      expect(stats.physicalDps).toBe(100);
      expect(stats.elementalDps).toBe(125); // (50+100)/2 + (25+75)/2 = 75 + 50
      expect(stats.totalDps).toBe(225);
    });

    it('should compute armour stats with quality', () => {
      const proto = createProtoItem({
        quality: 20,
        armourData: {
          armour: 500,
          evasion: 200,
          energyShield: 100,
          ward: 50,
          block: 2500, // 25%
        },
      });
      const item = createItemInstance(proto);

      const stats = item.computedArmourStats;
      expect(stats).toBeDefined();

      // 20% quality = 1.2x defensive stats (except ward)
      expect(stats!.armour).toBe(600);
      expect(stats!.evasion).toBe(240);
      expect(stats!.energyShield).toBe(120);
      expect(stats!.ward).toBe(50); // Ward not affected by quality
      expect(stats!.block).toBe(0.25); // 2500 / 10000
    });

    it('should return null for missing data', () => {
      const item = createEmptyItem('test');

      expect(item.computedWeaponStats).toBeNull();
      expect(item.computedArmourStats).toBeNull();
    });

    it('should cache computed stats', () => {
      const proto = createWeaponItem();
      const item = createItemInstance(proto);

      const stats1 = item.computedWeaponStats;
      const stats2 = item.computedWeaponStats;

      expect(stats1).toBe(stats2); // Same object reference
    });
  });

  // ==========================================================================
  // Data Access
  // ==========================================================================

  describe('data access', () => {
    it('should return proto data copy', () => {
      const proto = createWeaponItem();
      const item = createItemInstance(proto);

      const returned = item.toProto();

      expect(returned).toEqual(proto);
      expect(returned).not.toBe(proto); // Different object
    });

    it('should set item base', () => {
      const item = createEmptyItem('test');
      expect(item.base).toBeNull();

      const base: ItemBase = {
        name: 'Infernal Sword',
        type: 'Two Handed Sword',
        quality: 20,
        socketLimit: 6,
        tags: { sword: true },
        req: { level: 67 },
        weapon: {
          PhysicalMin: 100,
          PhysicalMax: 200,
          CritChanceBase: 5,
          AttackRateBase: 1.3,
          Range: 13,
        },
      };
      item.setBase(base);

      expect(item.base).toEqual(base);
    });
  });

  // ==========================================================================
  // Display Helpers
  // ==========================================================================

  describe('display helpers', () => {
    it('should return display name for unique item', () => {
      const item = createItemInstance(createWeaponItem());
      expect(item.displayName).toBe('Starforge');
    });

    it('should return type line for magic item', () => {
      const proto = createProtoItem({
        typeLine: 'Heavy Belt of the Tiger',
        baseName: 'Heavy Belt',
        rarity: ItemRarity.RARITY_MAGIC,
      });
      const item = createItemInstance(proto);

      expect(item.displayName).toBe('Heavy Belt of the Tiger');
    });

    it('should return base name for normal item', () => {
      const proto = createProtoItem({
        baseName: 'Iron Greatsword',
        rarity: ItemRarity.RARITY_NORMAL,
      });
      const item = createItemInstance(proto);

      expect(item.displayName).toBe('Iron Greatsword');
    });

    it('should return physical damage text', () => {
      const item = createItemInstance(
        createProtoItem({
          quality: 0,
          weaponData: {
            physicalMin: 100,
            physicalMax: 200,
          },
        })
      );

      expect(item.physicalDamageText).toBe('100-200');
    });

    it('should return DPS text', () => {
      const item = createItemInstance(
        createProtoItem({
          quality: 0,
          weaponData: {
            physicalMin: 100,
            physicalMax: 200,
            attackSpeed: 1.5,
          },
        })
      );

      // (100 + 200) / 2 * 1.5 = 225.0
      expect(item.dpsText).toBe('225.0');
    });
  });
});
