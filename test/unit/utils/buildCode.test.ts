/**
 * Unit tests for build code encode/decode functionality.
 *
 * Tests cover:
 * - Roundtrip encoding/decoding
 * - XML serialization/deserialization
 * - Error handling for invalid codes
 * - Performance requirements (<100ms)
 * - PoB2 compatibility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeBuildCode,
  decodeBuildCode,
  decodeBuildCodeOrThrow,
  isValidBuildCodeFormat,
  extractXmlFromBuildCode,
  compressXmlToBuildCode,
} from 'src/utils/buildCode';
import { buildToXml, xmlToBuild } from 'src/utils/buildXml';
import type { Build, BuildConfig } from 'src/protos/build_pb';
import type { Item } from 'src/protos/items_pb';
import type { SkillGroup, GemInstance } from 'src/protos/skills_pb';
import { CharacterClass } from 'src/protos/common_pb';
import { ItemRarity } from 'src/protos/items_pb';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMinimalBuild(): Build {
  return {
    id: 'test-build-1',
    name: 'Test Build',
    characterClass: CharacterClass.WARRIOR,
    level: 90,
    allocatedNodeIds: [],
    masterySelections: {},
    equippedItems: {},
    skillGroups: [],
  };
}

function createFullBuild(): Build {
  const item: Item = {
    id: 'item-1',
    name: 'Starforge',
    baseName: 'Infernal Sword',
    rarity: ItemRarity.RARITY_UNIQUE,
    itemLevel: 83,
    quality: 20,
    corrupted: false,
    sockets: [],
    runes: [],
    implicitMods: ['+30% to Global Critical Strike Multiplier'],
    explicitMods: [
      'Adds 100 to 200 Physical Damage',
      '20% increased Attack Speed',
      'Your Physical Damage can Shock',
    ],
    enchantMods: [],
    runeMods: [],
    craftedMods: [],
  };

  const gem: GemInstance = {
    id: 'gem-1',
    gemId: 'Cyclone',
    level: 21,
    quality: 23,
    enabled: true,
  };

  const skillGroup: SkillGroup = {
    id: 'skill-1',
    label: 'Main Skill',
    enabled: true,
    includeInFullDps: true,
    slot: 'Weapon 1',
    gems: [gem],
  };

  const config: BuildConfig = {
    enemyLevel: 83,
    enemyIsBoss: true,
    powerCharges: true,
    powerChargeCount: 6,
    frenzyCharges: true,
    frenzyChargeCount: 6,
    enduranceCharges: false,
    isLeeching: true,
    isOnFullLife: false,
    isOnLowLife: false,
    enemyIsChilled: true,
    enemyIsShocked: true,
  };

  return {
    id: 'test-build-full',
    name: 'Full Test Build',
    characterClass: CharacterClass.WARRIOR,
    ascendancy: 'Titan',
    level: 100,
    allocatedNodeIds: ['1234', '5678', '9012', '3456'],
    masterySelections: {
      '1234': 'effect-1',
      '5678': 'effect-2',
    },
    equippedItems: {
      'Weapon 1': item,
    },
    skillGroups: [skillGroup],
    config,
    notes: 'This is a test build with notes.',
  };
}

// =============================================================================
// buildCode.ts Tests
// =============================================================================

describe('buildCode', () => {
  describe('isValidBuildCodeFormat', () => {
    it('should return true for valid URL-safe base64 strings', () => {
      expect(isValidBuildCodeFormat('eNrtWW1v2zgM_isG0A')).toBe(true);
      expect(isValidBuildCodeFormat('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_==')).toBe(
        true
      );
    });

    it('should return false for empty or short strings', () => {
      expect(isValidBuildCodeFormat('')).toBe(false);
      expect(isValidBuildCodeFormat('abc')).toBe(false);
      expect(isValidBuildCodeFormat('123456789')).toBe(false); // exactly 9 chars, need 10+
    });

    it('should return false for strings with invalid characters', () => {
      expect(isValidBuildCodeFormat('invalid code with spaces')).toBe(false);
      expect(isValidBuildCodeFormat('invalid+code')).toBe(false); // + is not URL-safe
      expect(isValidBuildCodeFormat('invalid/code')).toBe(false); // / is not URL-safe
    });
  });

  describe('encodeBuildCode', () => {
    it('should encode a minimal build to a non-empty string', () => {
      const build = createMinimalBuild();
      const code = encodeBuildCode(build);

      expect(code).toBeTruthy();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(10);
    });

    it('should produce URL-safe base64 output', () => {
      const build = createMinimalBuild();
      const code = encodeBuildCode(build);

      // Should not contain + or /
      expect(code).not.toContain('+');
      expect(code).not.toContain('/');
      // Should only contain URL-safe characters
      expect(isValidBuildCodeFormat(code)).toBe(true);
    });

    it('should produce consistent output for the same build', () => {
      const build = createMinimalBuild();
      const code1 = encodeBuildCode(build);
      const code2 = encodeBuildCode(build);

      expect(code1).toBe(code2);
    });

    it('should respect compression level option', () => {
      const build = createFullBuild();

      const codeLevel1 = encodeBuildCode(build, { compressionLevel: 1 });
      const codeLevel9 = encodeBuildCode(build, { compressionLevel: 9 });

      // Higher compression should generally produce smaller or equal output
      // (allow small tolerance as compression effectiveness varies with data)
      expect(codeLevel9.length).toBeLessThanOrEqual(codeLevel1.length + 10);
    });
  });

  describe('decodeBuildCode', () => {
    it('should decode an encoded build back to the original', () => {
      const original = createMinimalBuild();
      const code = encodeBuildCode(original);
      const result = decodeBuildCode(code);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.build.name).toBe(original.name);
        expect(result.build.level).toBe(original.level);
        expect(result.build.characterClass).toBe(original.characterClass);
      }
    });

    it('should preserve all build data in roundtrip', () => {
      const original = createFullBuild();
      const code = encodeBuildCode(original);
      const result = decodeBuildCode(code);

      expect(result.success).toBe(true);
      if (result.success) {
        const decoded = result.build;

        // Basic info
        expect(decoded.name).toBe(original.name);
        expect(decoded.level).toBe(original.level);
        expect(decoded.characterClass).toBe(original.characterClass);
        expect(decoded.ascendancy).toBe(original.ascendancy);

        // Passive tree
        expect(decoded.allocatedNodeIds).toEqual(original.allocatedNodeIds);
        expect(decoded.masterySelections).toEqual(original.masterySelections);

        // Items
        expect(Object.keys(decoded.equippedItems)).toEqual(Object.keys(original.equippedItems));
        const decodedItem = decoded.equippedItems['Weapon 1'];
        const originalItem = original.equippedItems['Weapon 1'];
        expect(decodedItem?.name).toBe(originalItem?.name);
        expect(decodedItem?.rarity).toBe(originalItem?.rarity);

        // Skills
        expect(decoded.skillGroups.length).toBe(original.skillGroups.length);
        expect(decoded.skillGroups[0]?.gems.length).toBe(original.skillGroups[0]?.gems.length);

        // Config
        expect(decoded.config?.enemyLevel).toBe(original.config?.enemyLevel);
        expect(decoded.config?.enemyIsBoss).toBe(original.config?.enemyIsBoss);
        expect(decoded.config?.powerCharges).toBe(original.config?.powerCharges);

        // Notes
        expect(decoded.notes).toBe(original.notes);
      }
    });

    it('should return error for invalid format', () => {
      const result = decodeBuildCode('invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_FORMAT');
      }
    });

    it('should return error for invalid base64', () => {
      // Valid format but garbage content
      const result = decodeBuildCode('AAAAAAAAAA!!!');

      expect(result.success).toBe(false);
    });

    it('should return error for non-zlib data', () => {
      // Valid base64 but not zlib-compressed
      const notCompressed = btoa('This is not compressed XML')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const result = decodeBuildCode(notCompressed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('DECOMPRESS_FAILED');
      }
    });

    it('should include XML in successful result', () => {
      const build = createMinimalBuild();
      const code = encodeBuildCode(build);
      const result = decodeBuildCode(code);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.xml).toContain('<PathOfBuilding>');
        expect(result.xml).toContain('</PathOfBuilding>');
      }
    });
  });

  describe('decodeBuildCodeOrThrow', () => {
    it('should return build for valid code', () => {
      const original = createMinimalBuild();
      const code = encodeBuildCode(original);
      const decoded = decodeBuildCodeOrThrow(code);

      expect(decoded.name).toBe(original.name);
    });

    it('should throw for invalid code', () => {
      expect(() => decodeBuildCodeOrThrow('invalid')).toThrow('INVALID_FORMAT');
    });
  });

  describe('extractXmlFromBuildCode', () => {
    it('should extract XML from valid build code', () => {
      const build = createMinimalBuild();
      const code = encodeBuildCode(build);
      const xml = extractXmlFromBuildCode(code);

      expect(xml).not.toBeNull();
      expect(xml).toContain('<PathOfBuilding>');
      expect(xml).toContain('<Build');
    });

    it('should return null for invalid code', () => {
      expect(extractXmlFromBuildCode('invalid')).toBeNull();
      expect(extractXmlFromBuildCode('')).toBeNull();
    });
  });

  describe('compressXmlToBuildCode', () => {
    it('should compress XML to valid build code', () => {
      const xml = '<?xml version="1.0"?><PathOfBuilding><Build level="90"/></PathOfBuilding>';
      const code = compressXmlToBuildCode(xml);

      expect(isValidBuildCodeFormat(code)).toBe(true);

      // Should be decodable
      const extracted = extractXmlFromBuildCode(code);
      expect(extracted).toContain('<PathOfBuilding>');
    });
  });

  describe('performance', () => {
    it('should encode in under 100ms', () => {
      const build = createFullBuild();

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        encodeBuildCode(build);
      }
      const elapsed = performance.now() - start;

      // 100 encodes should take less than 1000ms (10ms each on average)
      expect(elapsed).toBeLessThan(1000);
      // Single encode should be well under 100ms
      expect(elapsed / 100).toBeLessThan(100);
    });

    it('should decode in under 100ms', () => {
      const build = createFullBuild();
      const code = encodeBuildCode(build);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        decodeBuildCode(code);
      }
      const elapsed = performance.now() - start;

      // 100 decodes should take less than 1000ms
      expect(elapsed).toBeLessThan(1000);
      // Single decode should be well under 100ms
      expect(elapsed / 100).toBeLessThan(100);
    });
  });
});

// =============================================================================
// buildXml.ts Tests
// =============================================================================

describe('buildXml', () => {
  describe('buildToXml', () => {
    it('should produce valid XML with PathOfBuilding root', () => {
      const build = createMinimalBuild();
      const xml = buildToXml(build);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<PathOfBuilding>');
      expect(xml).toContain('</PathOfBuilding>');
    });

    it('should include Build element with class and level', () => {
      const build = createMinimalBuild();
      build.level = 85;
      build.characterClass = CharacterClass.SORCERESS;

      const xml = buildToXml(build);

      expect(xml).toContain('level="85"');
      expect(xml).toContain('className="Sorceress"');
    });

    it('should include Tree element with nodes', () => {
      const build = createMinimalBuild();
      build.allocatedNodeIds = ['100', '200', '300'];

      const xml = buildToXml(build);

      expect(xml).toContain('<Tree');
      expect(xml).toContain('<Spec');
      expect(xml).toContain('nodes="100,200,300"');
    });

    it('should include mastery effects', () => {
      const build = createMinimalBuild();
      build.masterySelections = {
        '100': 'effect-a',
        '200': 'effect-b',
      };

      const xml = buildToXml(build);

      expect(xml).toContain('masteryEffects="100:effect-a,200:effect-b"');
    });

    it('should include Items section', () => {
      const build = createMinimalBuild();
      build.equippedItems = {
        'Weapon 1': {
          id: 'item-1',
          name: 'Test Sword',
          baseName: 'Runic Sword',
          rarity: ItemRarity.RARITY_RARE,
          sockets: [],
          runes: [],
          implicitMods: [],
          explicitMods: ['+50 to Strength'],
          enchantMods: [],
          runeMods: [],
          craftedMods: [],
        },
      };

      const xml = buildToXml(build);

      expect(xml).toContain('<Items');
      expect(xml).toContain('<Item');
      expect(xml).toContain('Rarity: RARE');
      expect(xml).toContain('Test Sword');
      expect(xml).toContain('+50 to Strength');
      expect(xml).toContain('<Slot');
      expect(xml).toContain('name="Weapon 1"');
    });

    it('should include Skills section', () => {
      const build = createMinimalBuild();
      build.skillGroups = [
        {
          id: 'skill-1',
          label: 'Main Attack',
          enabled: true,
          gems: [
            {
              id: 'gem-1',
              gemId: 'Fireball',
              level: 20,
              quality: 20,
            },
          ],
        },
      ];

      const xml = buildToXml(build);

      expect(xml).toContain('<Skills');
      expect(xml).toContain('<SkillSet');
      expect(xml).toContain('<Skill');
      expect(xml).toContain('<Gem');
      expect(xml).toContain('gemId="Fireball"');
      expect(xml).toContain('level="20"');
    });

    it('should include Config section', () => {
      const build = createMinimalBuild();
      build.config = {
        enemyLevel: 83,
        powerCharges: true,
        isLeeching: true,
      };

      const xml = buildToXml(build);

      expect(xml).toContain('<Config');
      expect(xml).toContain('<Input');
      expect(xml).toContain('name="enemyLevel"');
      expect(xml).toContain('number="83"');
      expect(xml).toContain('name="usePowerCharges"');
    });

    it('should include Notes when present', () => {
      const build = createMinimalBuild();
      build.notes = 'These are my build notes.';

      const xml = buildToXml(build);

      expect(xml).toContain('<Notes>');
      expect(xml).toContain('These are my build notes.');
      expect(xml).toContain('</Notes>');
    });

    it('should escape special XML characters', () => {
      const build = createMinimalBuild();
      build.notes = 'Notes with <special> & "characters"';

      const xml = buildToXml(build);

      expect(xml).toContain('&lt;special&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;characters&quot;');
    });
  });

  describe('xmlToBuild', () => {
    let minimalXml: string;

    beforeEach(() => {
      minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="90" className="Warrior" ascendClassName="Titan"/>
  <Tree activeSpec="1">
    <Spec title="Test Build" treeVersion="3_25" nodes="100,200,300"/>
  </Tree>
  <Items activeItemSet="1"/>
  <Skills activeSkillSet="1"/>
  <Config/>
</PathOfBuilding>`;
    });

    it('should parse minimal valid XML', () => {
      const build = xmlToBuild(minimalXml);

      expect(build.level).toBe(90);
      expect(build.characterClass).toBe(CharacterClass.WARRIOR);
      expect(build.ascendancy).toBe('Titan');
      expect(build.allocatedNodeIds).toEqual(['100', '200', '300']);
    });

    it('should parse mastery effects', () => {
      const xml = minimalXml.replace(
        'nodes="100,200,300"',
        'nodes="100,200,300" masteryEffects="100:eff-1,200:eff-2"'
      );
      const build = xmlToBuild(xml);

      expect(build.masterySelections).toEqual({
        '100': 'eff-1',
        '200': 'eff-2',
      });
    });

    it('should parse items', () => {
      const xml = `<?xml version="1.0"?>
<PathOfBuilding>
  <Build level="1" className="Warrior"/>
  <Tree><Spec nodes=""/></Tree>
  <Items activeItemSet="1">
    <Item id="1">Rarity: UNIQUE
Headhunter
Leather Belt
Item Level: 83
+50 to Maximum Life</Item>
    <Slot name="Belt" itemId="1"/>
  </Items>
  <Skills/>
  <Config/>
</PathOfBuilding>`;

      const build = xmlToBuild(xml);

      expect(build.equippedItems['Belt']).toBeDefined();
      expect(build.equippedItems['Belt']?.name).toBe('Headhunter');
      expect(build.equippedItems['Belt']?.rarity).toBe(ItemRarity.RARITY_UNIQUE);
      expect(build.equippedItems['Belt']?.itemLevel).toBe(83);
    });

    it('should parse skills and gems', () => {
      const xml = `<?xml version="1.0"?>
<PathOfBuilding>
  <Build level="1" className="Warrior"/>
  <Tree><Spec nodes=""/></Tree>
  <Items/>
  <Skills activeSkillSet="1">
    <SkillSet id="1">
      <Skill enabled="true" label="Main">
        <Gem gemId="Cyclone" level="21" quality="23"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Config/>
</PathOfBuilding>`;

      const build = xmlToBuild(xml);

      expect(build.skillGroups.length).toBe(1);
      const firstGroup = build.skillGroups[0];
      expect(firstGroup).toBeDefined();
      expect(firstGroup?.label).toBe('Main');
      expect(firstGroup?.enabled).toBe(true);
      expect(firstGroup?.gems.length).toBe(1);
      const firstGem = firstGroup?.gems[0];
      expect(firstGem?.gemId).toBe('Cyclone');
      expect(firstGem?.level).toBe(21);
    });

    it('should parse config inputs', () => {
      const xml = `<?xml version="1.0"?>
<PathOfBuilding>
  <Build level="1" className="Warrior"/>
  <Tree><Spec nodes=""/></Tree>
  <Items/>
  <Skills/>
  <Config>
    <Input name="enemyLevel" number="84"/>
    <Input name="usePowerCharges" boolean="true"/>
    <Input name="conditionLeeching" boolean="true"/>
  </Config>
</PathOfBuilding>`;

      const build = xmlToBuild(xml);

      expect(build.config?.enemyLevel).toBe(84);
      expect(build.config?.powerCharges).toBe(true);
      expect(build.config?.isLeeching).toBe(true);
    });

    it('should throw for invalid XML', () => {
      expect(() => xmlToBuild('not xml at all')).toThrow();
    });

    it('should throw for wrong root element', () => {
      const xml = '<?xml version="1.0"?><WrongRoot/>';
      expect(() => xmlToBuild(xml)).toThrow(/expected root element 'PathOfBuilding'/);
    });

    it('should handle empty nodes gracefully', () => {
      const xml = minimalXml.replace('nodes="100,200,300"', 'nodes=""');
      const build = xmlToBuild(xml);

      expect(build.allocatedNodeIds).toEqual([]);
    });

    it('should assign new UUIDs on parse', () => {
      const build1 = xmlToBuild(minimalXml);
      const build2 = xmlToBuild(minimalXml);

      expect(build1.id).not.toBe(build2.id);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through XML roundtrip', () => {
      const original = createFullBuild();
      const xml = buildToXml(original);
      const parsed = xmlToBuild(xml);

      expect(parsed.name).toBe(original.name);
      expect(parsed.level).toBe(original.level);
      expect(parsed.characterClass).toBe(original.characterClass);
      expect(parsed.ascendancy).toBe(original.ascendancy);
      expect(parsed.allocatedNodeIds).toEqual(original.allocatedNodeIds);
      expect(parsed.masterySelections).toEqual(original.masterySelections);
    });
  });
});

// =============================================================================
// Character Class Mapping Tests
// =============================================================================

describe('character class mapping', () => {
  const classTestCases: Array<{ enum: CharacterClass; pobName: string }> = [
    { enum: CharacterClass.WARRIOR, pobName: 'Warrior' },
    { enum: CharacterClass.MONK, pobName: 'Monk' },
    { enum: CharacterClass.SORCERESS, pobName: 'Sorceress' },
    { enum: CharacterClass.MERCENARY, pobName: 'Mercenary' },
    { enum: CharacterClass.HUNTRESS, pobName: 'Huntress' },
    { enum: CharacterClass.DRUID, pobName: 'Druid' },
  ];

  for (const { enum: charClass, pobName } of classTestCases) {
    it(`should map ${pobName} correctly in roundtrip`, () => {
      const build = createMinimalBuild();
      build.characterClass = charClass;

      const xml = buildToXml(build);
      expect(xml).toContain(`className="${pobName}"`);

      const parsed = xmlToBuild(xml);
      expect(parsed.characterClass).toBe(charClass);
    });
  }
});
