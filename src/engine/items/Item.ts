/**
 * Item class for representing equipped items in calculations.
 *
 * Wraps the proto Item interface with computed properties and helper methods.
 */

import { cloneDeep } from 'lodash-es';
import type {
  Item as ProtoItem,
  ItemRarity,
  ItemType,
  Socket,
  WeaponData,
  ArmourData,
  FlaskData,
  JewelData,
} from 'src/protos/items_pb';
import type { Mod } from 'src/engine/modifiers/types';
import type {
  ItemBase,
  ComputedWeaponData,
  ComputedArmourData,
} from './types';
import {
  isWeaponType,
  isArmourType,
  isTwoHandedType,
  computeWeaponStats,
  computeArmourStats,
} from './types';

/**
 * Represents an item in the build system.
 *
 * This class wraps a proto Item and provides:
 * - Computed weapon/armour stats with quality applied
 * - Combined mod accessors
 * - Helper methods for item categorization
 */
export class ItemInstance {
  /** The underlying proto item data */
  private readonly data: ProtoItem;

  /** The item base definition (if matched) */
  private itemBase: ItemBase | null = null;

  /** Parsed modifiers from this item (populated by ModParser) */
  private mods: Mod[] = [];

  /** Cached computed weapon data */
  private cachedWeaponData: ComputedWeaponData | null = null;

  /** Cached computed armour data */
  private cachedArmourData: ComputedArmourData | null = null;

  /**
   * Creates a new ItemInstance.
   *
   * @param data - Proto item data
   * @param itemBase - Optional item base definition for base stats
   */
  constructor(data: ProtoItem, itemBase?: ItemBase) {
    this.data = cloneDeep(data);
    this.itemBase = itemBase ?? null;
  }

  // ==========================================================================
  // Basic Properties
  // ==========================================================================

  /** Unique identifier for this item */
  get id(): string {
    return this.data.id;
  }

  /** Display name of the item */
  get name(): string | undefined {
    return this.data.name;
  }

  /** Base type name (e.g., "Infernal Sword") */
  get baseName(): string | undefined {
    return this.data.baseName;
  }

  /** Type line as shown in game (may include affixes for magic items) */
  get typeLine(): string | undefined {
    return this.data.typeLine;
  }

  /** Item rarity */
  get rarity(): ItemRarity | undefined {
    return this.data.rarity;
  }

  /** Item type category */
  get itemType(): ItemType | undefined {
    return this.data.itemType;
  }

  /** Item level */
  get itemLevel(): number {
    return this.data.itemLevel ?? 1;
  }

  /** Quality percentage (0-30) */
  get quality(): number {
    return this.data.quality ?? 0;
  }

  /** Whether the item is corrupted */
  get corrupted(): boolean {
    return this.data.corrupted ?? false;
  }

  /** Whether the item is mirrored */
  get mirrored(): boolean {
    return this.data.mirrored ?? false;
  }

  /** Whether the item has a fractured mod */
  get fractured(): boolean {
    return this.data.fractured ?? false;
  }

  // ==========================================================================
  // Requirements
  // ==========================================================================

  /** Required character level */
  get requiredLevel(): number {
    return this.data.requiredLevel ?? 1;
  }

  /** Required strength */
  get requiredStr(): number {
    return this.data.requiredStr ?? 0;
  }

  /** Required dexterity */
  get requiredDex(): number {
    return this.data.requiredDex ?? 0;
  }

  /** Required intelligence */
  get requiredInt(): number {
    return this.data.requiredInt ?? 0;
  }

  // ==========================================================================
  // Sockets
  // ==========================================================================

  /** Socket array */
  get sockets(): Socket[] {
    return this.data.sockets;
  }

  /** Number of sockets */
  get socketCount(): number {
    return this.data.sockets.length;
  }

  /** Runes socketed in this item (PoE2) */
  get runes(): string[] {
    return this.data.runes;
  }

  /**
   * Returns the maximum number of linked sockets.
   */
  get maxLinkCount(): number {
    if (this.data.sockets.length === 0) return 0;

    const groupCounts = new Map<number, number>();
    for (const socket of this.data.sockets) {
      const group = socket.group ?? 0;
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    }

    return Math.max(...groupCounts.values());
  }

  // ==========================================================================
  // Modifiers
  // ==========================================================================

  /** Implicit modifier texts */
  get implicitMods(): string[] {
    return this.data.implicitMods;
  }

  /** Explicit modifier texts */
  get explicitMods(): string[] {
    return this.data.explicitMods;
  }

  /** Enchantment modifier texts */
  get enchantMods(): string[] {
    return this.data.enchantMods;
  }

  /** Rune modifier texts (PoE2) */
  get runeMods(): string[] {
    return this.data.runeMods;
  }

  /** Crafted modifier texts */
  get craftedMods(): string[] {
    return this.data.craftedMods;
  }

  /**
   * Returns all modifier texts combined.
   */
  get allModTexts(): string[] {
    return [
      ...this.data.enchantMods,
      ...this.data.implicitMods,
      ...this.data.explicitMods,
      ...this.data.runeMods,
      ...this.data.craftedMods,
    ];
  }

  /**
   * Returns parsed modifiers.
   * Must be populated by calling setParsedMods() after parsing.
   */
  get parsedMods(): Mod[] {
    return this.mods;
  }

  /**
   * Sets the parsed modifiers for this item.
   *
   * @param mods - Parsed Mod objects from ModParser
   */
  setParsedMods(mods: Mod[]): void {
    this.mods = mods;
    // Invalidate cached computed data since mods may affect local values
    this.cachedWeaponData = null;
    this.cachedArmourData = null;
  }

  // ==========================================================================
  // Type Helpers
  // ==========================================================================

  /** Whether this item is a weapon */
  get isWeapon(): boolean {
    return isWeaponType(this.data.itemType);
  }

  /** Whether this item is armour */
  get isArmour(): boolean {
    return isArmourType(this.data.itemType);
  }

  /** Whether this is a two-handed weapon */
  get isTwoHanded(): boolean {
    return isTwoHandedType(this.data.itemType);
  }

  /** Whether this item has weapon data */
  get hasWeaponData(): boolean {
    return this.data.weaponData !== undefined;
  }

  /** Whether this item has armour data */
  get hasArmourData(): boolean {
    return this.data.armourData !== undefined;
  }

  /** Whether this item has flask data */
  get hasFlaskData(): boolean {
    return this.data.flaskData !== undefined;
  }

  /** Whether this item has jewel data */
  get hasJewelData(): boolean {
    return this.data.jewelData !== undefined;
  }

  // ==========================================================================
  // Raw Data Accessors
  // ==========================================================================

  /** Raw weapon data from proto */
  get weaponData(): WeaponData | undefined {
    return this.data.weaponData;
  }

  /** Raw armour data from proto */
  get armourData(): ArmourData | undefined {
    return this.data.armourData;
  }

  /** Raw flask data from proto */
  get flaskData(): FlaskData | undefined {
    return this.data.flaskData;
  }

  /** Raw jewel data from proto */
  get jewelData(): JewelData | undefined {
    return this.data.jewelData;
  }

  /** The item base definition */
  get base(): ItemBase | null {
    return this.itemBase;
  }

  // ==========================================================================
  // Computed Stats
  // ==========================================================================

  /**
   * Returns computed weapon stats with quality applied.
   *
   * Note: This does NOT include local mod effects yet.
   * Full computation with local mods is done in the calculation engine.
   */
  get computedWeaponStats(): ComputedWeaponData | null {
    if (!this.data.weaponData) return null;

    if (!this.cachedWeaponData) {
      this.cachedWeaponData = computeWeaponStats(
        this.data.weaponData,
        this.quality
      );
    }

    return this.cachedWeaponData;
  }

  /**
   * Returns computed armour stats with quality applied.
   *
   * Note: This does NOT include local mod effects yet.
   * Full computation with local mods is done in the calculation engine.
   */
  get computedArmourStats(): ComputedArmourData | null {
    if (!this.data.armourData) return null;

    if (!this.cachedArmourData) {
      this.cachedArmourData = computeArmourStats(
        this.data.armourData,
        this.quality
      );
    }

    return this.cachedArmourData;
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Returns the underlying proto item data.
   *
   * Use this when you need to serialize or store the item.
   */
  toProto(): ProtoItem {
    return cloneDeep(this.data);
  }

  /**
   * Sets the item base definition.
   *
   * @param itemBase - The base definition to associate with this item
   */
  setBase(itemBase: ItemBase): void {
    this.itemBase = itemBase;
    // Invalidate caches
    this.cachedWeaponData = null;
    this.cachedArmourData = null;
  }

  // ==========================================================================
  // Display Helpers
  // ==========================================================================

  /**
   * Returns the display name for this item.
   *
   * For unique/rare items, returns the name.
   * For magic/normal items, returns the type line or base name.
   */
  get displayName(): string {
    if (this.data.name) return this.data.name;
    if (this.data.typeLine) return this.data.typeLine;
    if (this.data.baseName) return this.data.baseName;
    return 'Unknown Item';
  }

  /**
   * Returns a formatted string with physical damage range.
   */
  get physicalDamageText(): string | undefined {
    const stats = this.computedWeaponStats;
    if (!stats || (stats.physicalMin === 0 && stats.physicalMax === 0)) {
      return undefined;
    }
    return `${stats.physicalMin}-${stats.physicalMax}`;
  }

  /**
   * Returns a formatted string with total DPS.
   */
  get dpsText(): string | undefined {
    const stats = this.computedWeaponStats;
    if (!stats) return undefined;
    return stats.totalDps.toFixed(1);
  }
}

/**
 * Creates a new ItemInstance from proto data.
 *
 * @param data - Proto item data
 * @param itemBase - Optional item base definition
 * @returns A new ItemInstance
 */
export function createItemInstance(
  data: ProtoItem,
  itemBase?: ItemBase
): ItemInstance {
  return new ItemInstance(data, itemBase);
}

/**
 * Creates an empty item with just an ID.
 *
 * @param id - Unique identifier for the item
 * @returns A new ItemInstance with minimal data
 */
export function createEmptyItem(id: string): ItemInstance {
  return new ItemInstance({
    id,
    sockets: [],
    runes: [],
    implicitMods: [],
    explicitMods: [],
    enchantMods: [],
    runeMods: [],
    craftedMods: [],
  });
}
