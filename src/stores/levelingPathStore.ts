/**
 * Leveling Path Store - manages leveling path state for Path of Leveling feature.
 *
 * LevelingPath is a separate entity from Build, allowing one build to have
 * multiple leveling paths and enabling standalone leveling guides.
 */
import { ref, computed } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { cloneDeep } from 'lodash-es';
import type {
  LevelingPath,
  Checkpoint,
  LevelingStep,
  StatDelta,
  StatSnapshot,
  StepTrigger,
  StepAction,
  Item,
  SkillGroup,
} from 'src/protos/pob2_pb';
import { CharacterClass } from 'src/protos/pob2_pb';
import {
  createLevelingPath,
  updateLevelingPath,
  getLevelingPath,
  deleteLevelingPath,
} from 'src/db';
import type { StoredLevelingPath } from 'src/types/db';

/**
 * Create a new empty leveling path with defaults.
 */
function createEmptyLevelingPath(): LevelingPath {
  return {
    id: crypto.randomUUID(),
    name: 'New Leveling Path',
    classId: CharacterClass.WARRIOR,
    checkpoints: [],
    steps: [],
  };
}

/**
 * Create an empty checkpoint at a given level.
 */
function createEmptyCheckpoint(level: number): Checkpoint {
  return {
    level,
    allocatedPassives: [],
    equipment: {},
    gems: [],
  };
}

/**
 * Create an empty leveling step.
 */
function createEmptyStep(order: number): LevelingStep {
  return {
    order,
  };
}

export const useLevelingPathStore = defineStore('levelingPath', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Current active leveling path */
  const currentPath = ref<LevelingPath>(createEmptyLevelingPath());

  /** Database ID of the current path (undefined if not saved) */
  const currentPathDbId = ref<number | undefined>(undefined);

  /** Whether the path has unsaved changes */
  const isDirty = ref(false);

  /** Whether path is currently being saved */
  const isSaving = ref(false);

  /** Whether path is currently being loaded */
  const isLoading = ref(false);

  // ============================================================================
  // Getters
  // ============================================================================

  /** Path display name */
  const pathName = computed(() => currentPath.value.name ?? 'Unnamed Path');

  /** Character class */
  const classId = computed(() => currentPath.value.classId);

  /** Associated build ID */
  const buildId = computed(() => currentPath.value.buildId);

  /** All checkpoints sorted by level */
  const checkpoints = computed(() =>
    [...currentPath.value.checkpoints].sort((a, b) => a.level - b.level)
  );

  /** Number of checkpoints */
  const checkpointCount = computed(() => currentPath.value.checkpoints.length);

  /** All steps sorted by order */
  const steps = computed(() =>
    [...currentPath.value.steps].sort((a, b) => a.order - b.order)
  );

  /** Number of steps */
  const stepCount = computed(() => currentPath.value.steps.length);

  /** Whether path is saved to database */
  const isSaved = computed(() => currentPathDbId.value !== undefined);

  // ============================================================================
  // Actions - Path Management
  // ============================================================================

  /** Create a new empty leveling path */
  function newPath(): void {
    currentPath.value = createEmptyLevelingPath();
    currentPathDbId.value = undefined;
    isDirty.value = false;
  }

  /** Set path name */
  function setName(name: string): void {
    currentPath.value.name = name;
    isDirty.value = true;
  }

  /** Set character class */
  function setClassId(charClass: CharacterClass): void {
    currentPath.value.classId = charClass;
    isDirty.value = true;
  }

  /** Set associated build ID */
  function setBuildId(id: string | undefined): void {
    if (id === undefined) {
      delete currentPath.value.buildId;
    } else {
      currentPath.value.buildId = id;
    }
    isDirty.value = true;
  }

  /** Set path notes */
  function setNotes(notes: string): void {
    currentPath.value.notes = notes;
    isDirty.value = true;
  }

  // ============================================================================
  // Actions - Checkpoint Management
  // ============================================================================

  /** Add a new checkpoint at a given level */
  function addCheckpoint(level: number): Checkpoint {
    // Check if checkpoint at this level already exists
    const existing = currentPath.value.checkpoints.find((cp) => cp.level === level);
    if (existing) {
      return existing;
    }

    const checkpoint = createEmptyCheckpoint(level);
    currentPath.value.checkpoints.push(checkpoint);
    isDirty.value = true;
    return checkpoint;
  }

  /** Update a checkpoint at a given level */
  function updateCheckpoint(level: number, updates: Partial<Omit<Checkpoint, 'level'>>): void {
    const index = currentPath.value.checkpoints.findIndex((cp) => cp.level === level);
    // Silently ignore missing checkpoints - invalid levels are treated as a no-op
    if (index === -1) return;

    const checkpoint = currentPath.value.checkpoints[index]!;
    if (updates.allocatedPassives !== undefined) {
      checkpoint.allocatedPassives = updates.allocatedPassives;
    }
    if (updates.equipment !== undefined) {
      checkpoint.equipment = updates.equipment;
    }
    if (updates.gems !== undefined) {
      checkpoint.gems = updates.gems;
    }
    if (updates.stats !== undefined) {
      checkpoint.stats = updates.stats;
    }
    if (updates.notes !== undefined) {
      checkpoint.notes = updates.notes;
    }
    isDirty.value = true;
  }

  /** Remove a checkpoint at a given level */
  function removeCheckpoint(level: number): void {
    const index = currentPath.value.checkpoints.findIndex((cp) => cp.level === level);
    // Silently ignore missing checkpoints - invalid levels are treated as a no-op
    if (index === -1) return;

    currentPath.value.checkpoints.splice(index, 1);
    isDirty.value = true;
  }

  /** Get checkpoint by level */
  function getCheckpoint(level: number): Checkpoint | undefined {
    return currentPath.value.checkpoints.find((cp) => cp.level === level);
  }

  /** Set allocated passives for a checkpoint */
  function setCheckpointPassives(level: number, passives: string[]): void {
    updateCheckpoint(level, { allocatedPassives: passives });
  }

  /** Set equipment for a checkpoint */
  function setCheckpointEquipment(level: number, equipment: Record<string, Item>): void {
    updateCheckpoint(level, { equipment });
  }

  /** Set gems for a checkpoint */
  function setCheckpointGems(level: number, gems: SkillGroup[]): void {
    updateCheckpoint(level, { gems });
  }

  /** Set calculated stats for a checkpoint */
  function setCheckpointStats(level: number, stats: StatSnapshot): void {
    updateCheckpoint(level, { stats });
  }

  // ============================================================================
  // Actions - Step Management
  // ============================================================================

  /** Add a new step */
  function addStep(trigger?: StepTrigger, action?: StepAction): LevelingStep {
    const maxOrder = currentPath.value.steps.reduce((max, s) => Math.max(max, s.order), 0);
    const step = createEmptyStep(maxOrder + 1);
    if (trigger) step.trigger = trigger;
    if (action) step.action = action;
    currentPath.value.steps.push(step);
    isDirty.value = true;
    return step;
  }

  /** Update a step by order */
  function updateStep(order: number, updates: Partial<Omit<LevelingStep, 'order'>>): void {
    const step = currentPath.value.steps.find((s) => s.order === order);
    // Silently ignore invalid order values - missing steps are treated as a no-op
    if (!step) return;

    if (updates.trigger !== undefined) {
      step.trigger = updates.trigger;
    }
    if (updates.action !== undefined) {
      step.action = updates.action;
    }
    if (updates.statDelta !== undefined) {
      step.statDelta = updates.statDelta;
    }
    if (updates.rationale !== undefined) {
      step.rationale = updates.rationale;
    }
    isDirty.value = true;
  }

  /** Remove a step by order */
  function removeStep(order: number): void {
    const index = currentPath.value.steps.findIndex((s) => s.order === order);
    // Silently ignore invalid order values - no step to remove
    if (index === -1) return;

    currentPath.value.steps.splice(index, 1);
    // Reorder remaining steps
    currentPath.value.steps.forEach((s, i) => {
      s.order = i + 1;
    });
    isDirty.value = true;
  }

  /** Reorder a step (move from oldOrder to newOrder) */
  function reorderStep(oldOrder: number, newOrder: number): void {
    const steps = currentPath.value.steps;
    const stepIndex = steps.findIndex((s) => s.order === oldOrder);
    // Silently ignore invalid oldOrder values - no matching step exists
    if (stepIndex === -1) return;

    // Clamp newOrder to valid range
    const clampedNewOrder = Math.max(1, Math.min(steps.length, newOrder));
    // No-op: step is already at the clamped target position
    if (oldOrder === clampedNewOrder) return;

    // Remove step from old position (stepIndex is valid, so splice always returns one element)
    const [step] = steps.splice(stepIndex, 1) as [LevelingStep];

    // Insert at new position (adjust for 1-based order)
    steps.splice(clampedNewOrder - 1, 0, step);

    // Reassign all orders
    steps.forEach((s, i) => {
      s.order = i + 1;
    });
    isDirty.value = true;
  }

  /** Get step by order */
  function getStep(order: number): LevelingStep | undefined {
    return currentPath.value.steps.find((s) => s.order === order);
  }

  /** Set stat delta for a step */
  function setStepStatDelta(order: number, statDelta: StatDelta): void {
    updateStep(order, { statDelta });
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Convert CharacterClass enum to string name for storage.
   */
  function characterClassToString(charClass: CharacterClass): string {
    const name = CharacterClass[charClass];
    return typeof name === 'string' ? name : 'WARRIOR';
  }

  /**
   * Convert stored class name string back to CharacterClass enum.
   */
  function stringToCharacterClass(className: string): CharacterClass {
    const enumValue = CharacterClass[className as keyof typeof CharacterClass];
    if (typeof enumValue === 'number') {
      return enumValue;
    }
    const numValue = Number(className);
    if (!Number.isNaN(numValue) && CharacterClass[numValue] !== undefined) {
      return numValue as CharacterClass;
    }
    return CharacterClass.WARRIOR;
  }

  /**
   * Determine if a value is a plain object (and not an array).
   */
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Basic structural compatibility check between a parsed value and a fallback value.
   * Ensures that primitives, arrays, and plain objects match in kind.
   */
  function hasCompatibleType(value: unknown, reference: unknown): boolean {
    if (reference === null) {
      return value === null;
    }
    if (Array.isArray(reference)) {
      return Array.isArray(value);
    }
    if (isPlainObject(reference)) {
      return isPlainObject(value);
    }
    return typeof value === typeof reference;
  }

  /**
   * Parse JSON safely with fallback and basic type validation.
   */
  function safeJsonParse<T>(json: string, fallback: T, fieldName?: string): T {
    try {
      const parsed: unknown = JSON.parse(json);

      if (!hasCompatibleType(parsed, fallback)) {
        console.warn(
          `Parsed JSON type mismatch${fieldName ? ` for field "${fieldName}"` : ''} - using fallback`
        );
        return fallback;
      }

      return parsed as T;
    } catch (e) {
      console.warn(
        `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}:`,
        e instanceof Error ? e.message : e
      );
      return fallback;
    }
  }

  /**
   * Convert LevelingPath to StoredLevelingPath for database.
   */
  function toStoredLevelingPath(): Omit<StoredLevelingPath, 'id' | 'createdAt' | 'updatedAt'> {
    const result: Omit<StoredLevelingPath, 'id' | 'createdAt' | 'updatedAt'> = {
      name: currentPath.value.name ?? 'Unnamed Path',
      className: characterClassToString(currentPath.value.classId ?? CharacterClass.WARRIOR),
      checkpoints: JSON.stringify(currentPath.value.checkpoints),
      steps: JSON.stringify(currentPath.value.steps),
    };

    if (currentPath.value.buildId) {
      const buildIdNum = Number.parseInt(currentPath.value.buildId, 10);
      if (!Number.isNaN(buildIdNum)) {
        result.buildId = buildIdNum;
      }
    }
    if (currentPath.value.notes) {
      result.notes = currentPath.value.notes;
    }
    return result;
  }

  /**
   * Load LevelingPath from StoredLevelingPath.
   */
  function fromStoredLevelingPath(stored: StoredLevelingPath): LevelingPath {
    const checkpoints = safeJsonParse<Checkpoint[]>(stored.checkpoints, [], 'checkpoints');
    const steps = safeJsonParse<LevelingStep[]>(stored.steps, [], 'steps');

    const result: LevelingPath = {
      id: String(stored.id),
      name: stored.name,
      classId: stringToCharacterClass(stored.className),
      checkpoints,
      steps,
    };

    if (stored.buildId !== undefined) {
      result.buildId = String(stored.buildId);
    }
    if (stored.notes) {
      result.notes = stored.notes;
    }

    return result;
  }

  /** Save current leveling path to database */
  async function save(): Promise<number> {
    isSaving.value = true;
    try {
      const storedData = toStoredLevelingPath();

      if (currentPathDbId.value !== undefined) {
        await updateLevelingPath(currentPathDbId.value, storedData);
        isDirty.value = false;
        return currentPathDbId.value;
      } else {
        const newId = await createLevelingPath(storedData);
        currentPathDbId.value = newId;
        isDirty.value = false;
        return newId;
      }
    } finally {
      isSaving.value = false;
    }
  }

  /** Load leveling path from database by ID */
  async function load(id: number): Promise<boolean> {
    isLoading.value = true;
    try {
      const stored = await getLevelingPath(id);
      if (stored) {
        currentPath.value = fromStoredLevelingPath(stored);
        currentPathDbId.value = id;
        isDirty.value = false;
        return true;
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /** Delete current leveling path from database */
  async function deleteCurrentPath(): Promise<void> {
    if (currentPathDbId.value !== undefined) {
      await deleteLevelingPath(currentPathDbId.value);
      newPath();
    }
  }

  /** Import leveling path from LevelingPath object */
  function importPath(path: LevelingPath): void {
    currentPath.value = cloneDeep(path);
    currentPathDbId.value = undefined;
    isDirty.value = true;
  }

  /** Export current leveling path as LevelingPath object */
  function exportPath(): LevelingPath {
    return cloneDeep(currentPath.value);
  }

  return {
    // State
    currentPath,
    currentPathDbId,
    isDirty,
    isSaving,
    isLoading,

    // Getters
    pathName,
    classId,
    buildId,
    checkpoints,
    checkpointCount,
    steps,
    stepCount,
    isSaved,

    // Path management
    newPath,
    setName,
    setClassId,
    setBuildId,
    setNotes,

    // Checkpoint management
    addCheckpoint,
    updateCheckpoint,
    removeCheckpoint,
    getCheckpoint,
    setCheckpointPassives,
    setCheckpointEquipment,
    setCheckpointGems,
    setCheckpointStats,

    // Step management
    addStep,
    updateStep,
    removeStep,
    reorderStep,
    getStep,
    setStepStatDelta,

    // Persistence
    save,
    load,
    deleteCurrentPath,
    importPath,
    exportPath,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLevelingPathStore, import.meta.hot));
}
