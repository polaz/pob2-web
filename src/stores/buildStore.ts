/**
 * Build Store - manages the current active build state.
 */
import { ref, computed } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { cloneDeep } from 'lodash-es';
import type { Build, BuildConfig, Item, SkillGroup, ItemSlot } from 'src/protos/pob2_pb';
import { CharacterClass } from 'src/protos/pob2_pb';
import { createBuild, updateBuild, getBuild, deleteBuild } from 'src/db';
import type { StoredBuild } from 'src/types/db';

/** Create a new empty build with defaults */
function createEmptyBuild(): Build {
  return {
    id: crypto.randomUUID(),
    name: 'New Build',
    characterClass: CharacterClass.WARRIOR,
    level: 1,
    allocatedNodeIds: [],
    masterySelections: {} as Record<string, string>,
    equippedItems: {} as Record<string, Item>,
    skillGroups: [],
  };
}

export const useBuildStore = defineStore('build', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Current active build */
  const currentBuild = ref<Build>(createEmptyBuild());

  /** Database ID of the current build (undefined if not saved) */
  const currentBuildDbId = ref<number | undefined>(undefined);

  /** Whether the build has unsaved changes */
  const isDirty = ref(false);

  /** Whether build is currently being saved */
  const isSaving = ref(false);

  /** Whether build is currently being loaded */
  const isLoading = ref(false);

  // ============================================================================
  // Getters
  // ============================================================================

  /** Build display name */
  const buildName = computed(() => currentBuild.value.name ?? 'Unnamed Build');

  /** Character class */
  const characterClass = computed(() => currentBuild.value.characterClass);

  /** Ascendancy */
  const ascendancy = computed(() => currentBuild.value.ascendancy);

  /** Character level */
  const level = computed(() => currentBuild.value.level ?? 1);

  /** Allocated passive node IDs */
  const allocatedNodeIds = computed(() => currentBuild.value.allocatedNodeIds);

  /** Number of allocated nodes */
  const allocatedNodeCount = computed(() => currentBuild.value.allocatedNodeIds.length);

  /** Equipped items map */
  const equippedItems = computed(() => currentBuild.value.equippedItems);

  /** Skill groups */
  const skillGroups = computed(() => currentBuild.value.skillGroups);

  /** Build configuration */
  const config = computed(() => currentBuild.value.config);

  /** Whether build is saved to database */
  const isSaved = computed(() => currentBuildDbId.value !== undefined);

  // ============================================================================
  // Actions
  // ============================================================================

  /** Create a new empty build */
  function newBuild(): void {
    currentBuild.value = createEmptyBuild();
    currentBuildDbId.value = undefined;
    isDirty.value = false;
  }

  /** Set build name */
  function setName(name: string): void {
    currentBuild.value.name = name;
    isDirty.value = true;
  }

  /** Set character class */
  function setCharacterClass(charClass: CharacterClass): void {
    currentBuild.value.characterClass = charClass;
    // Reset ascendancy when class changes
    delete currentBuild.value.ascendancy;
    isDirty.value = true;
  }

  /** Set ascendancy */
  function setAscendancy(asc: string | undefined): void {
    if (asc === undefined) {
      delete currentBuild.value.ascendancy;
    } else {
      currentBuild.value.ascendancy = asc;
    }
    isDirty.value = true;
  }

  /** Set character level */
  function setLevel(lvl: number): void {
    currentBuild.value.level = Math.max(1, Math.min(100, lvl));
    isDirty.value = true;
  }

  /** Set allocated node IDs */
  function setAllocatedNodes(nodeIds: string[]): void {
    currentBuild.value.allocatedNodeIds = nodeIds;
    isDirty.value = true;
  }

  /** Add allocated node */
  function allocateNode(nodeId: string): void {
    if (!currentBuild.value.allocatedNodeIds.includes(nodeId)) {
      currentBuild.value.allocatedNodeIds.push(nodeId);
      isDirty.value = true;
    }
  }

  /** Remove allocated node */
  function deallocateNode(nodeId: string): void {
    const index = currentBuild.value.allocatedNodeIds.indexOf(nodeId);
    if (index !== -1) {
      currentBuild.value.allocatedNodeIds.splice(index, 1);
      isDirty.value = true;
    }
  }

  /** Set mastery selection for a node */
  function setMasterySelection(nodeId: string, effectId: string): void {
    currentBuild.value.masterySelections[nodeId] = effectId;
    isDirty.value = true;
  }

  /** Remove mastery selection */
  function removeMasterySelection(nodeId: string): void {
    delete currentBuild.value.masterySelections[nodeId];
    isDirty.value = true;
  }

  /**
   * Set equipped item in slot.
   * Note: ItemSlot enum values are converted to strings for JSON serialization
   * compatibility. The Build.equippedItems uses string keys by design.
   */
  function setEquippedItem(slot: ItemSlot, item: Item): void {
    currentBuild.value.equippedItems[String(slot)] = item;
    isDirty.value = true;
  }

  /**
   * Remove equipped item from slot.
   * Note: ItemSlot enum values are converted to strings for JSON serialization.
   */
  function removeEquippedItem(slot: ItemSlot): void {
    delete currentBuild.value.equippedItems[String(slot)];
    isDirty.value = true;
  }

  /** Set skill groups */
  function setSkillGroups(groups: SkillGroup[]): void {
    currentBuild.value.skillGroups = groups;
    isDirty.value = true;
  }

  /** Add skill group */
  function addSkillGroup(group: SkillGroup): void {
    currentBuild.value.skillGroups.push(group);
    isDirty.value = true;
  }

  /**
   * Remove skill group by index.
   * Note: Callers should update skillStore selection state after removal
   * to handle cases where the removed group was selected.
   */
  function removeSkillGroup(index: number): void {
    const groups = currentBuild.value.skillGroups;
    // Silently ignore invalid indices - no state change, no dirty flag
    if (index < 0 || index >= groups.length) {
      return;
    }
    groups.splice(index, 1);
    isDirty.value = true;
  }

  /** Set build configuration */
  function setConfig(cfg: BuildConfig): void {
    currentBuild.value.config = cfg;
    isDirty.value = true;
  }

  /** Set build notes */
  function setNotes(notes: string): void {
    currentBuild.value.notes = notes;
    isDirty.value = true;
  }

  /**
   * Convert CharacterClass enum to string name for storage.
   * Handles both numeric enum values and already-string values.
   */
  function characterClassToString(charClass: CharacterClass): string {
    // CharacterClass is a numeric enum, so CharacterClass[value] gives the name
    const name = CharacterClass[charClass];
    return typeof name === 'string' ? name : 'WARRIOR';
  }

  /**
   * Convert stored class name string back to CharacterClass enum.
   * Handles both string names (e.g., "WARRIOR") and numeric string values.
   */
  function stringToCharacterClass(className: string): CharacterClass {
    // First try as enum name (e.g., "WARRIOR")
    const enumValue = CharacterClass[className as keyof typeof CharacterClass];
    if (typeof enumValue === 'number') {
      return enumValue;
    }
    // Try parsing as numeric value
    const numValue = Number(className);
    if (!Number.isNaN(numValue) && CharacterClass[numValue] !== undefined) {
      return numValue as CharacterClass;
    }
    // Default fallback
    return CharacterClass.WARRIOR;
  }

  /**
   * Convert Build to StoredBuild for database.
   *
   * Note: passiveNodes are stored as numbers because PoE2 node IDs are numeric.
   * Non-numeric IDs are filtered out with a warning since they indicate data issues.
   */
  function toStoredBuild(): Omit<StoredBuild, 'id' | 'createdAt' | 'updatedAt'> {
    const allocatedNodeIds = currentBuild.value.allocatedNodeIds;
    const passiveNodes: number[] = [];
    for (const id of allocatedNodeIds) {
      const num = Number.parseInt(id, 10);
      if (Number.isNaN(num)) {
        console.warn(`toStoredBuild: Non-numeric node ID "${id}" will be skipped`);
      } else {
        passiveNodes.push(num);
      }
    }

    const result: Omit<StoredBuild, 'id' | 'createdAt' | 'updatedAt'> = {
      name: currentBuild.value.name ?? 'Unnamed Build',
      className: characterClassToString(currentBuild.value.characterClass ?? CharacterClass.WARRIOR),
      level: currentBuild.value.level ?? 1,
      passiveNodes,
      items: JSON.stringify(currentBuild.value.equippedItems),
      skills: JSON.stringify(currentBuild.value.skillGroups),
    };
    if (currentBuild.value.ascendancy) result.ascendancy = currentBuild.value.ascendancy;
    if (currentBuild.value.config) result.config = JSON.stringify(currentBuild.value.config);
    if (Object.keys(currentBuild.value.masterySelections).length > 0) {
      result.masterySelections = JSON.stringify(currentBuild.value.masterySelections);
    }
    if (currentBuild.value.notes) result.notes = currentBuild.value.notes;
    if (currentBuild.value.buildCode) result.buildCode = currentBuild.value.buildCode;
    return result;
  }

  /**
   * Parse JSON safely with fallback.
   * Logs parse errors to help debug data corruption issues.
   */
  function safeJsonParse<T>(json: string, fallback: T, fieldName?: string): T {
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      console.warn(
        `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}:`,
        e instanceof Error ? e.message : e
      );
      return fallback;
    }
  }

  /** Validate that value is a Record<string, Item> */
  function isValidItemsRecord(value: unknown): value is Record<string, Item> {
    if (typeof value !== 'object' || value === null) return false;
    // Basic shape validation - items should have id and name at minimum
    for (const item of Object.values(value)) {
      if (typeof item !== 'object' || item === null) return false;
    }
    return true;
  }

  /** Validate that value is a SkillGroup array */
  function isValidSkillGroups(value: unknown): value is SkillGroup[] {
    if (!Array.isArray(value)) return false;
    // Basic shape validation - each group should be an object
    return value.every((group) => typeof group === 'object' && group !== null);
  }

  /** Validate that value is a Record<string, string> for mastery selections */
  function isValidMasterySelections(value: unknown): value is Record<string, string> {
    if (typeof value !== 'object' || value === null) return false;
    for (const [key, val] of Object.entries(value)) {
      if (typeof key !== 'string' || typeof val !== 'string') return false;
    }
    return true;
  }

  /** Load Build from StoredBuild */
  function fromStoredBuild(stored: StoredBuild): Build {
    // Parse and validate equipped items
    let equippedItems: Record<string, Item> = {};
    if (stored.items) {
      const parsed = safeJsonParse<unknown>(stored.items, null, 'equippedItems');
      if (isValidItemsRecord(parsed)) {
        equippedItems = parsed;
      }
    }

    // Parse and validate skill groups
    let skillGroups: SkillGroup[] = [];
    if (stored.skills) {
      const parsed = safeJsonParse<unknown>(stored.skills, null, 'skillGroups');
      if (isValidSkillGroups(parsed)) {
        skillGroups = parsed;
      }
    }

    // Parse and validate mastery selections
    let masterySelections: Record<string, string> = {};
    if (stored.masterySelections) {
      const parsed = safeJsonParse<unknown>(stored.masterySelections, null, 'masterySelections');
      if (isValidMasterySelections(parsed)) {
        masterySelections = parsed;
      }
    }

    const result: Build = {
      id: String(stored.id),
      name: stored.name,
      characterClass: stringToCharacterClass(stored.className),
      level: stored.level,
      allocatedNodeIds: stored.passiveNodes.map((id) => String(id)),
      masterySelections,
      equippedItems,
      skillGroups,
    };
    if (stored.ascendancy) result.ascendancy = stored.ascendancy;
    if (stored.config) {
      const parsedConfig = safeJsonParse<BuildConfig | null>(stored.config, null, 'config');
      if (parsedConfig) result.config = parsedConfig;
    }
    if (stored.notes) result.notes = stored.notes;
    if (stored.buildCode) result.buildCode = stored.buildCode;
    return result;
  }

  /** Save current build to database */
  async function save(): Promise<number> {
    isSaving.value = true;
    try {
      const storedData = toStoredBuild();

      if (currentBuildDbId.value !== undefined) {
        // Update existing build
        await updateBuild(currentBuildDbId.value, storedData);
        isDirty.value = false;
        return currentBuildDbId.value;
      } else {
        // Create new build
        const newId = await createBuild(storedData);
        currentBuildDbId.value = newId;
        isDirty.value = false;
        return newId;
      }
    } finally {
      isSaving.value = false;
    }
  }

  /** Load build from database by ID */
  async function load(id: number): Promise<boolean> {
    isLoading.value = true;
    try {
      const stored = await getBuild(id);
      if (stored) {
        currentBuild.value = fromStoredBuild(stored);
        currentBuildDbId.value = id;
        isDirty.value = false;
        return true;
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /** Delete current build from database */
  async function deleteCurrentBuild(): Promise<void> {
    if (currentBuildDbId.value !== undefined) {
      await deleteBuild(currentBuildDbId.value);
      newBuild();
    }
  }

  /** Import build from Build object */
  function importBuild(build: Build): void {
    currentBuild.value = cloneDeep(build);
    currentBuildDbId.value = undefined;
    isDirty.value = true;
  }

  /** Export current build as Build object */
  function exportBuild(): Build {
    return cloneDeep(currentBuild.value);
  }

  return {
    // State
    currentBuild,
    currentBuildDbId,
    isDirty,
    isSaving,
    isLoading,

    // Getters
    buildName,
    characterClass,
    ascendancy,
    level,
    allocatedNodeIds,
    allocatedNodeCount,
    equippedItems,
    skillGroups,
    config,
    isSaved,

    // Actions
    newBuild,
    setName,
    setCharacterClass,
    setAscendancy,
    setLevel,
    setAllocatedNodes,
    allocateNode,
    deallocateNode,
    setMasterySelection,
    removeMasterySelection,
    setEquippedItem,
    removeEquippedItem,
    setSkillGroups,
    addSkillGroup,
    removeSkillGroup,
    setConfig,
    setNotes,
    save,
    load,
    deleteCurrentBuild,
    importBuild,
    exportBuild,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBuildStore, import.meta.hot));
}
