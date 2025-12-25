/**
 * Build storage composable - manages build persistence with auto-save,
 * recent builds tracking, and session restoration.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useBuildStore } from 'src/stores/buildStore';
import {
  getAllBuilds,
  getBuild,
  getUserPreferences,
  updateUserPreferences,
  deleteBuild as dbDeleteBuild,
  createBuild,
  updateBuild,
} from 'src/db';
import type { StoredBuild } from 'src/types/db';
import { BUILD_FORMAT_VERSION } from 'src/types/db';
import { migrateBuild, buildNeedsMigration } from 'src/db/buildMigrations';
import { CharacterClass } from 'src/protos/common_pb';

/** Maximum number of recent builds to track */
const MAX_RECENT_BUILDS = 10;

/** Default auto-save interval in milliseconds */
const DEFAULT_AUTO_SAVE_INTERVAL_MS = 30000;

/** Debounce delay for auto-save in milliseconds */
const AUTO_SAVE_DEBOUNCE_MS = 2000;

/**
 * Convert CharacterClass enum to string name for storage.
 * Mirrors the pattern from buildStore for consistency.
 */
function characterClassToString(charClass: CharacterClass | undefined): string {
  if (charClass === undefined) return 'WARRIOR';
  const name = CharacterClass[charClass];
  return typeof name === 'string' ? name : 'WARRIOR';
}

/**
 * Build metadata for list display (without full data).
 */
export interface BuildListItem {
  id: number;
  name: string;
  className: string;
  ascendancy?: string;
  level: number;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Composable for managing build storage with auto-save and session management.
 */
export function useBuildStorage() {
  const buildStore = useBuildStore();

  // ============================================================================
  // State
  // ============================================================================

  /** Whether auto-save is currently active */
  const isAutoSaveActive = ref(false);

  /** Whether builds are being loaded */
  const isLoadingBuilds = ref(false);

  /** List of all builds (metadata only) */
  const buildList = ref<BuildListItem[]>([]);

  /** Recent build IDs */
  const recentBuildIds = ref<number[]>([]);

  /** Auto-save interval ID for cleanup */
  let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Flag to prevent save during load */
  let isRestoring = false;

  // ============================================================================
  // Computed
  // ============================================================================

  /** Recent builds with full metadata */
  const recentBuilds = computed<BuildListItem[]>(() => {
    return recentBuildIds.value
      .map((id) => buildList.value.find((b) => b.id === id))
      .filter((b): b is BuildListItem => b !== undefined);
  });

  /** Total number of saved builds */
  const buildCount = computed(() => buildList.value.length);

  // ============================================================================
  // Build List Management
  // ============================================================================

  /**
   * Refresh the build list from database.
   */
  async function refreshBuildList(): Promise<void> {
    isLoadingBuilds.value = true;
    try {
      const builds = await getAllBuilds();
      // Filter out builds without IDs (should not happen, but be safe)
      const buildsWithId = builds.filter(
        (b): b is StoredBuild & { id: number } => typeof b.id === 'number'
      );
      buildList.value = buildsWithId.map((b) => {
        const item: BuildListItem = {
          id: b.id,
          name: b.name,
          className: b.className,
          level: b.level,
          updatedAt: b.updatedAt,
          createdAt: b.createdAt,
        };
        if (b.ascendancy) item.ascendancy = b.ascendancy;
        return item;
      });
    } finally {
      isLoadingBuilds.value = false;
    }
  }

  /**
   * Get all builds sorted by update time (most recent first).
   */
  async function getBuilds(): Promise<BuildListItem[]> {
    await refreshBuildList();
    return buildList.value;
  }

  // ============================================================================
  // Recent Builds Management
  // ============================================================================

  /**
   * Load recent builds from user preferences.
   */
  async function loadRecentBuilds(): Promise<void> {
    const prefs = await getUserPreferences();
    recentBuildIds.value = prefs.recentBuilds ?? [];
  }

  /**
   * Add a build to recent builds list.
   */
  async function addToRecentBuilds(buildId: number): Promise<void> {
    // Remove if already exists (will re-add at front)
    const filtered = recentBuildIds.value.filter((id) => id !== buildId);
    // Add to front
    recentBuildIds.value = [buildId, ...filtered].slice(0, MAX_RECENT_BUILDS);
    // Persist
    await updateUserPreferences({ recentBuilds: recentBuildIds.value });
  }

  /**
   * Remove a build from recent builds (e.g., when deleted).
   */
  async function removeFromRecentBuilds(buildId: number): Promise<void> {
    recentBuildIds.value = recentBuildIds.value.filter((id) => id !== buildId);
    await updateUserPreferences({ recentBuilds: recentBuildIds.value });
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Restore the last session (load last active build).
   * Returns true if a build was restored, false otherwise.
   */
  async function restoreLastSession(): Promise<boolean> {
    isRestoring = true;
    try {
      const prefs = await getUserPreferences();
      if (prefs.lastBuildId !== undefined) {
        const stored = await getBuild(prefs.lastBuildId);
        if (stored && stored.id !== undefined) {
          // Migrate if needed and persist the migration
          if (buildNeedsMigration(stored.version)) {
            migrateBuild(stored as unknown as Record<string, unknown>);
            // Persist migrated build back to database
            await updateBuild(stored.id, { version: BUILD_FORMAT_VERSION });
          }
          const loaded = await buildStore.load(prefs.lastBuildId);
          if (loaded) {
            await addToRecentBuilds(prefs.lastBuildId);
            return true;
          }
        }
      }
      return false;
    } finally {
      isRestoring = false;
    }
  }

  /**
   * Save the current build ID as last session.
   */
  async function saveLastSession(): Promise<void> {
    if (buildStore.currentBuildDbId !== undefined) {
      await updateUserPreferences({ lastBuildId: buildStore.currentBuildDbId });
    }
  }

  // ============================================================================
  // Auto-save
  // ============================================================================

  /**
   * Debounced save function to prevent excessive writes.
   */
  const debouncedSave = useDebounceFn(async () => {
    if (isRestoring) return;
    if (!buildStore.isDirty) return;

    try {
      const buildId = await buildStore.save();
      await addToRecentBuilds(buildId);
      await saveLastSession();
    } catch (e) {
      console.warn(
        `Auto-save failed for build ${buildStore.currentBuildDbId}:`,
        e instanceof Error ? e.message : e
      );
    }
  }, AUTO_SAVE_DEBOUNCE_MS);

  /**
   * Start auto-save with the specified interval.
   * @param intervalMs - Interval in milliseconds (default: from user preferences)
   */
  async function startAutoSave(intervalMs?: number): Promise<void> {
    // Stop any existing auto-save
    stopAutoSave();

    // Get interval from preferences if not specified
    let interval = intervalMs;
    if (interval === undefined) {
      const prefs = await getUserPreferences();
      const prefIntervalMs = prefs.autoSaveInterval * 1000;
      interval =
        Number.isFinite(prefIntervalMs) && prefIntervalMs > 0
          ? prefIntervalMs
          : DEFAULT_AUTO_SAVE_INTERVAL_MS;
    }

    // Ensure interval is at least the debounce duration and positive
    interval = Math.max(
      Number.isFinite(interval) && interval > 0
        ? interval
        : DEFAULT_AUTO_SAVE_INTERVAL_MS,
      AUTO_SAVE_DEBOUNCE_MS
    );

    isAutoSaveActive.value = true;

    // Set up interval for periodic saves
    autoSaveIntervalId = setInterval(() => {
      if (buildStore.isDirty && !buildStore.isSaving) {
        void debouncedSave().catch(() => {
          // Error already logged inside debouncedSave
        });
      }
    }, interval);
  }

  /**
   * Stop auto-save.
   */
  function stopAutoSave(): void {
    if (autoSaveIntervalId !== null) {
      clearInterval(autoSaveIntervalId);
      autoSaveIntervalId = null;
    }
    isAutoSaveActive.value = false;
  }

  // ============================================================================
  // Build Operations
  // ============================================================================

  /**
   * Save the current build and update tracking.
   * @returns The build ID
   */
  async function saveBuild(): Promise<number> {
    const buildId = await buildStore.save();
    await addToRecentBuilds(buildId);
    await saveLastSession();
    await refreshBuildList();
    return buildId;
  }

  /**
   * Load a build by ID.
   * @param id - Build database ID
   * @returns True if loaded successfully
   */
  async function loadBuild(id: number): Promise<boolean> {
    isRestoring = true;
    try {
      // Check if build needs migration
      const stored = await getBuild(id);
      if (!stored) return false;

      // Migrate if needed and persist the migration
      if (buildNeedsMigration(stored.version)) {
        migrateBuild(stored as unknown as Record<string, unknown>);
        // Persist migrated build back to database
        await updateBuild(id, { version: BUILD_FORMAT_VERSION });
      }

      const loaded = await buildStore.load(id);
      if (loaded) {
        await addToRecentBuilds(id);
        await saveLastSession();
        return true;
      }
      return false;
    } finally {
      isRestoring = false;
    }
  }

  /**
   * Delete a build by ID.
   * If deleting the current build, creates a new empty build.
   */
  async function deleteBuild(id: number): Promise<void> {
    await dbDeleteBuild(id);
    await removeFromRecentBuilds(id);

    // If we deleted the current build, create new
    if (buildStore.currentBuildDbId === id) {
      buildStore.newBuild();
      // Clear last build ID using destructuring to avoid mutating the original object
      const { lastBuildId: _, ...restPrefs } = await getUserPreferences();
      await updateUserPreferences(restPrefs);
    }

    await refreshBuildList();
  }

  /**
   * Duplicate the current build with a new name.
   * @param newName - Name for the duplicated build (defaults to "Copy of [name]")
   * @returns The new build ID
   */
  async function duplicateBuild(newName?: string): Promise<number> {
    const exported = buildStore.exportBuild();
    const name = newName ?? `Copy of ${exported.name ?? 'Build'}`;

    // Create a new build entry - use conditional spread for optional fields
    const storedData: Omit<StoredBuild, 'id' | 'createdAt' | 'updatedAt'> = {
      version: BUILD_FORMAT_VERSION,
      name,
      className: characterClassToString(exported.characterClass),
      level: exported.level ?? 1,
      // PoE2 passive node IDs are positive integers (starting from 1), so 0 is invalid
      passiveNodes: exported.allocatedNodeIds.reduce<number[]>((acc, id) => {
        const num = Number.parseInt(id, 10);
        if (!Number.isNaN(num) && num > 0) {
          acc.push(num);
        }
        return acc;
      }, []),
      items: JSON.stringify(exported.equippedItems),
      skills: JSON.stringify(exported.skillGroups),
      ...(typeof exported.ascendancy === 'string' &&
        exported.ascendancy.trim() !== '' && {
          ascendancy: exported.ascendancy,
        }),
      ...(exported.config && { config: JSON.stringify(exported.config) }),
      ...(Object.keys(exported.masterySelections).length > 0 && {
        masterySelections: JSON.stringify(exported.masterySelections),
      }),
      ...(exported.notes && { notes: exported.notes }),
      ...(exported.buildCode && { buildCode: exported.buildCode }),
    };

    const newId = await createBuild(storedData);
    await addToRecentBuilds(newId);
    await refreshBuildList();
    return newId;
  }

  /**
   * Rename the current build.
   * @param newName - New name for the build
   */
  async function renameBuild(newName: string): Promise<void> {
    buildStore.setName(newName);
    if (buildStore.isSaved) {
      await buildStore.save();
      await refreshBuildList();
    }
  }

  /**
   * Create a new empty build and optionally save it.
   * @param saveImmediately - Whether to save the new build to database
   * @returns The new build ID if saved, undefined otherwise
   */
  async function newBuild(saveImmediately = false): Promise<number | undefined> {
    buildStore.newBuild();
    if (saveImmediately) {
      const id = await saveBuild();
      return id;
    }
    return undefined;
  }

  // ============================================================================
  // Watch for dirty state changes (trigger debounced auto-save)
  // ============================================================================

  const stopDirtyWatch = watch(
    () => buildStore.isDirty,
    (isDirty) => {
      if (isDirty && isAutoSaveActive.value && !isRestoring) {
        void debouncedSave().catch(() => {
          // Errors are already handled and logged inside debouncedSave
        });
      }
    }
  );

  // ============================================================================
  // Cleanup
  // ============================================================================

  onUnmounted(() => {
    stopAutoSave();
    stopDirtyWatch();
  });

  // ============================================================================
  // Initialize
  // ============================================================================

  /**
   * Initialize the build storage system.
   * Loads recent builds and optionally restores last session.
   * @param options - Initialization options
   */
  async function initialize(options?: {
    restoreSession?: boolean;
    enableAutoSave?: boolean;
  }): Promise<void> {
    const { restoreSession = true, enableAutoSave = true } = options ?? {};

    // Load recent builds
    await loadRecentBuilds();

    // Refresh build list
    await refreshBuildList();

    // Restore last session if requested
    if (restoreSession) {
      const restored = await restoreLastSession();
      if (!restored) {
        console.info('No previous session to restore');
      }
    }

    // Start auto-save if requested and user has it enabled
    if (enableAutoSave) {
      const prefs = await getUserPreferences();
      if (prefs.autoSave) {
        await startAutoSave();
      }
    }
  }

  return {
    // State
    isAutoSaveActive,
    isLoadingBuilds,
    buildList,
    recentBuildIds,

    // Computed
    recentBuilds,
    buildCount,

    // Build list
    refreshBuildList,
    getBuilds,

    // Recent builds
    loadRecentBuilds,
    addToRecentBuilds,
    removeFromRecentBuilds,

    // Session
    restoreLastSession,
    saveLastSession,

    // Auto-save
    startAutoSave,
    stopAutoSave,

    // Build operations
    saveBuild,
    loadBuild,
    deleteBuild,
    duplicateBuild,
    renameBuild,
    newBuild,

    // Initialize
    initialize,
  };
}
