/**
 * Unit tests for ItemParser - Parses items from game clipboard text.
 *
 * Tests parsing of various item formats, rarities, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { ItemRarity } from 'src/protos/pob2_pb';
import { ItemParser, createItemParser, parseItem } from 'src/engine/items/ItemParser';

// ============================================================================
// Test Data
// ============================================================================

/** Sample unique weapon text */
const UNIQUE_WEAPON_TEXT = `Rarity: Unique
Starforge
Infernal Sword
--------
Two Handed Sword
Physical Damage: 468-702
Critical Strike Chance: 5.00%
Attacks per Second: 1.30
Weapon Range: 13
--------
Requirements:
Level: 67
Str: 113
Dex: 113
--------
Sockets: R-R-R-R-R-R
--------
Item Level: 83
--------
+25% to Global Critical Strike Multiplier (implicit)
--------
200% increased Physical Damage
30% increased Area of Effect
Deals Double Damage on the first Hit against each Enemy
20% chance to deal Double Damage
--------
Corrupted`;

/** Sample rare armour text */
const RARE_ARMOUR_TEXT = `Rarity: Rare
Damnation Shell
Glorious Plate
--------
Armour: 1250
--------
Requirements:
Level: 68
Str: 191
--------
Sockets: R-R-R-R-R-R
--------
Item Level: 85
--------
+45 to maximum Life (implicit)
--------
+98 to maximum Life
+42% to Fire Resistance
+38% to Cold Resistance
+15% to Lightning Resistance
15% increased Stun and Block Recovery (crafted)`;

/** Sample magic item text */
const MAGIC_ITEM_TEXT = `Rarity: Magic
Burning Heavy Belt of the Tiger
--------
Requirements:
Level: 8
--------
Item Level: 32
--------
+25 to Strength (implicit)
--------
Adds 5 to 10 Fire Damage to Attacks
+15 to Strength`;

/** Sample normal item text */
const NORMAL_ITEM_TEXT = `Rarity: Normal
Iron Greatsword
--------
Two Handed Sword
Physical Damage: 25-42
Critical Strike Chance: 5.00%
Attacks per Second: 1.20
Weapon Range: 13
--------
Requirements:
Level: 10
Str: 26
--------
Item Level: 12`;

/** Sample shield with block */
const SHIELD_TEXT = `Rarity: Rare
Entropy Keep
Titanium Spirit Shield
--------
Chance to Block: 24%
Energy Shield: 195
--------
Requirements:
Level: 68
Int: 159
--------
Sockets: B-B-B
--------
Item Level: 83
--------
+15% to Fire and Lightning Resistances (implicit)
--------
+45 to maximum Energy Shield
+72 to maximum Life
+32% to Fire Resistance
+28% to Lightning Resistance`;

/** Sample weapon with elemental damage */
const ELEMENTAL_WEAPON_TEXT = `Rarity: Rare
Havoc Edge
Vaal Rapier
--------
One Handed Sword
Physical Damage: 45-85
Elemental Damage: 15-28 Fire, 12-24 Cold
Critical Strike Chance: 6.50%
Attacks per Second: 1.55
Weapon Range: 14
--------
Requirements:
Level: 64
Dex: 212
--------
Item Level: 75
--------
+25% to Global Critical Strike Multiplier (implicit)
--------
Adds 15 to 28 Fire Damage
Adds 12 to 24 Cold Damage
15% increased Attack Speed`;

// ============================================================================
// Tests
// ============================================================================

describe('ItemParser', () => {
  // ==========================================================================
  // Basic Parsing
  // ==========================================================================

  describe('basic parsing', () => {
    it('should create parser with factory function', () => {
      const parser = createItemParser();
      expect(parser).toBeInstanceOf(ItemParser);
    });

    it('should parse using standalone function', () => {
      const result = parseItem(NORMAL_ITEM_TEXT);
      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
    });

    it('should fail on empty text', () => {
      const parser = new ItemParser();
      const result = parser.parse('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty item text');
    });

    it('should fail on whitespace-only text', () => {
      const parser = new ItemParser();
      const result = parser.parse('   \n\t\n   ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty item text');
    });

    it('should handle Windows line endings', () => {
      const windowsText = NORMAL_ITEM_TEXT.replace(/\n/g, '\r\n');
      const result = parseItem(windowsText);

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Rarity Parsing
  // ==========================================================================

  describe('rarity parsing', () => {
    it('should parse unique item', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.success).toBe(true);
      expect(result.item!.rarity).toBe(ItemRarity.RARITY_UNIQUE);
      expect(result.item!.name).toBe('Starforge');
      expect(result.item!.baseName).toBe('Infernal Sword');
    });

    it('should parse rare item', () => {
      const result = parseItem(RARE_ARMOUR_TEXT);

      expect(result.success).toBe(true);
      expect(result.item!.rarity).toBe(ItemRarity.RARITY_RARE);
      expect(result.item!.name).toBe('Damnation Shell');
      expect(result.item!.baseName).toBe('Glorious Plate');
    });

    it('should parse magic item', () => {
      const result = parseItem(MAGIC_ITEM_TEXT);

      expect(result.success).toBe(true);
      expect(result.item!.rarity).toBe(ItemRarity.RARITY_MAGIC);
      expect(result.item!.baseName).toBe('Burning Heavy Belt of the Tiger');
    });

    it('should parse normal item', () => {
      const result = parseItem(NORMAL_ITEM_TEXT);

      expect(result.success).toBe(true);
      expect(result.item!.rarity).toBe(ItemRarity.RARITY_NORMAL);
      expect(result.item!.baseName).toBe('Iron Greatsword');
    });

    it('should fail on unknown rarity', () => {
      const text = `Rarity: Legendary
Some Item`;
      const result = parseItem(text);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown rarity');
    });

    it('should fail on missing rarity', () => {
      const text = `Some Item
Iron Sword`;
      const result = parseItem(text);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing rarity line');
    });
  });

  // ==========================================================================
  // Property Parsing
  // ==========================================================================

  describe('property parsing', () => {
    it('should parse quality', () => {
      const text = `Rarity: Normal
Iron Sword
--------
Quality: +20%`;
      const result = parseItem(text);

      expect(result.success).toBe(true);
      expect(result.item!.quality).toBe(20);
    });

    it('should parse item level', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.itemLevel).toBe(83);
    });

    it('should parse weapon physical damage', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.weaponData).toBeDefined();
      expect(result.item!.weaponData!.physicalMin).toBe(468);
      expect(result.item!.weaponData!.physicalMax).toBe(702);
    });

    it('should parse weapon elemental damage', () => {
      const result = parseItem(ELEMENTAL_WEAPON_TEXT);

      expect(result.item!.weaponData).toBeDefined();
      expect(result.item!.weaponData!.fireMin).toBe(15);
      expect(result.item!.weaponData!.fireMax).toBe(28);
      expect(result.item!.weaponData!.coldMin).toBe(12);
      expect(result.item!.weaponData!.coldMax).toBe(24);
    });

    it('should parse critical strike chance', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.weaponData!.critChance).toBe(500); // 5.00% * 100
    });

    it('should parse attacks per second', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.weaponData!.attackSpeed).toBe(1.3);
    });

    it('should parse weapon range', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.weaponData!.range).toBe(13);
    });

    it('should parse armour value', () => {
      const result = parseItem(RARE_ARMOUR_TEXT);

      expect(result.item!.armourData).toBeDefined();
      expect(result.item!.armourData!.armour).toBe(1250);
    });

    it('should parse energy shield', () => {
      const result = parseItem(SHIELD_TEXT);

      expect(result.item!.armourData).toBeDefined();
      expect(result.item!.armourData!.energyShield).toBe(195);
    });

    it('should parse block chance', () => {
      const result = parseItem(SHIELD_TEXT);

      expect(result.item!.armourData).toBeDefined();
      // 24% * 100 = 2400
      expect(result.item!.armourData!.block).toBe(2400);
    });
  });

  // ==========================================================================
  // Requirements Parsing
  // ==========================================================================

  describe('requirements parsing', () => {
    it('should parse level requirement', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.requiredLevel).toBe(67);
    });

    it('should parse strength requirement', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.requiredStr).toBe(113);
    });

    it('should parse dexterity requirement', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.requiredDex).toBe(113);
    });

    it('should parse intelligence requirement', () => {
      const result = parseItem(SHIELD_TEXT);

      expect(result.item!.requiredInt).toBe(159);
    });
  });

  // ==========================================================================
  // Socket Parsing
  // ==========================================================================

  describe('socket parsing', () => {
    it('should parse fully linked sockets', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.sockets).toHaveLength(6);
      // All sockets in same group = all linked
      expect(result.item!.sockets.every((s) => s.group === 0)).toBe(true);
      expect(result.item!.sockets.every((s) => s.color === 'R')).toBe(true);
    });

    it('should parse partially linked sockets', () => {
      const result = parseItem(SHIELD_TEXT);

      expect(result.item!.sockets).toHaveLength(3);
      expect(result.item!.sockets.every((s) => s.group === 0)).toBe(true);
      expect(result.item!.sockets.every((s) => s.color === 'B')).toBe(true);
    });

    it('should parse unlinked socket groups', () => {
      const text = `Rarity: Normal
Test Item
--------
Sockets: R-R-G B-B`;
      const result = parseItem(text);

      expect(result.item!.sockets).toHaveLength(5);

      // First group (R-R-G)
      expect(result.item!.sockets[0]).toEqual({ color: 'R', group: 0 });
      expect(result.item!.sockets[1]).toEqual({ color: 'R', group: 0 });
      expect(result.item!.sockets[2]).toEqual({ color: 'G', group: 0 });

      // Second group (B-B)
      expect(result.item!.sockets[3]).toEqual({ color: 'B', group: 1 });
      expect(result.item!.sockets[4]).toEqual({ color: 'B', group: 1 });
    });
  });

  // ==========================================================================
  // Modifier Parsing
  // ==========================================================================

  describe('modifier parsing', () => {
    it('should parse implicit mods', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.implicitMods).toHaveLength(1);
      expect(result.item!.implicitMods[0]).toBe(
        '+25% to Global Critical Strike Multiplier'
      );
    });

    it('should parse explicit mods', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.explicitMods.length).toBeGreaterThan(0);
      expect(result.item!.explicitMods).toContain(
        '200% increased Physical Damage'
      );
      expect(result.item!.explicitMods).toContain(
        '30% increased Area of Effect'
      );
    });

    it('should parse crafted mods', () => {
      const result = parseItem(RARE_ARMOUR_TEXT);

      expect(result.item!.craftedMods).toHaveLength(1);
      expect(result.item!.craftedMods[0]).toBe(
        '15% increased Stun and Block Recovery'
      );
    });

    it('should strip (implicit) suffix from mod text', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      // Should not contain the (implicit) suffix
      expect(result.item!.implicitMods[0]).not.toContain('(implicit)');
    });

    it('should strip (crafted) suffix from mod text', () => {
      const result = parseItem(RARE_ARMOUR_TEXT);

      // Should not contain the (crafted) suffix
      expect(result.item!.craftedMods[0]).not.toContain('(crafted)');
    });
  });

  // ==========================================================================
  // Status Parsing
  // ==========================================================================

  describe('status parsing', () => {
    it('should parse corrupted status', () => {
      const result = parseItem(UNIQUE_WEAPON_TEXT);

      expect(result.item!.corrupted).toBe(true);
    });

    it('should parse mirrored status', () => {
      const text = `Rarity: Rare
Test Item
Iron Sword
--------
Mirrored`;
      const result = parseItem(text);

      expect(result.item!.mirrored).toBe(true);
    });

    it('should default to not corrupted', () => {
      const result = parseItem(RARE_ARMOUR_TEXT);

      expect(result.item!.corrupted).toBe(false);
    });

    it('should parse fractured mods', () => {
      const text = `Rarity: Rare
Test Item
Iron Sword
--------
+50 to maximum Life (fractured)`;
      const result = parseItem(text);

      expect(result.item!.fractured).toBe(true);
      expect(result.item!.explicitMods).toContain('+50 to maximum Life');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should generate unique ID for each parse', () => {
      const result1 = parseItem(NORMAL_ITEM_TEXT);
      const result2 = parseItem(NORMAL_ITEM_TEXT);

      expect(result1.item!.id).toBeDefined();
      expect(result2.item!.id).toBeDefined();
      expect(result1.item!.id).not.toBe(result2.item!.id);
    });

    it('should treat unknown text lines as mods', () => {
      const text = `Rarity: Normal
Test Item
--------
Some Unknown Property: 123
Another Strange Line`;
      const result = parseItem(text);

      expect(result.success).toBe(true);
      // The parser treats any alphanumeric text as a potential mod
      // so these lines end up as explicit mods, not unparsed lines
      expect(result.item!.explicitMods).toContain('Some Unknown Property: 123');
      expect(result.item!.explicitMods).toContain('Another Strange Line');
    });

    it('should handle item class line (PoE2)', () => {
      const text = `Rarity: Unique
Starforge
Infernal Sword
--------
Item Class: Two Handed Swords
--------
Physical Damage: 468-702`;
      const result = parseItem(text);

      expect(result.success).toBe(true);
      expect(result.item!.name).toBe('Starforge');
      expect(result.item!.baseName).toBe('Infernal Sword');
    });

    it('should handle high crit chance values', () => {
      const text = `Rarity: Normal
Test Dagger
--------
Critical Strike Chance: 6.50%`;
      const result = parseItem(text);

      expect(result.item!.weaponData!.critChance).toBe(650);
    });
  });

  // ==========================================================================
  // Base Resolver
  // ==========================================================================

  describe('base resolver', () => {
    it('should accept base resolver in constructor', () => {
      const resolver = (name: string) =>
        name === 'Infernal Sword'
          ? {
              name: 'Infernal Sword',
              type: 'Two Handed Sword',
              quality: 20,
              socketLimit: 6,
              tags: {},
              req: {},
            }
          : undefined;

      const parser = createItemParser(resolver);
      expect(parser).toBeInstanceOf(ItemParser);
    });

    it('should allow setting base resolver later', () => {
      const parser = new ItemParser();

      parser.setBaseResolver((name) =>
        name === 'Iron Greatsword'
          ? {
              name: 'Iron Greatsword',
              type: 'Two Handed Sword',
              quality: 20,
              socketLimit: 6,
              tags: {},
              req: {},
            }
          : undefined
      );

      const result = parser.parse(NORMAL_ITEM_TEXT);
      expect(result.success).toBe(true);
    });
  });
});
