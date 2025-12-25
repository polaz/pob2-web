/**
 * Unit tests for levelingPathStore.
 *
 * Tests checkpoint/step management, serialization/deserialization,
 * CharacterClass enum conversion, and path state management.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLevelingPathStore } from 'src/stores/levelingPathStore';
import { CharacterClass, StepTriggerType, StepActionType } from 'src/protos/pob2_pb';

// Mock the database module
vi.mock('src/db', () => ({
  createLevelingPath: vi.fn().mockResolvedValue(1),
  updateLevelingPath: vi.fn().mockResolvedValue(undefined),
  getLevelingPath: vi.fn().mockResolvedValue(null),
  deleteLevelingPath: vi.fn().mockResolvedValue(undefined),
}));

describe('levelingPathStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have a new empty path with defaults', () => {
      const store = useLevelingPathStore();

      expect(store.currentPath.id).toBeDefined();
      expect(store.currentPath.name).toBe('New Leveling Path');
      expect(store.currentPath.classId).toBe(CharacterClass.WARRIOR);
      expect(store.currentPath.checkpoints).toEqual([]);
      expect(store.currentPath.steps).toEqual([]);
      expect(store.isDirty).toBe(false);
      expect(store.isSaved).toBe(false);
    });
  });

  describe('setName', () => {
    it('should update path name and set dirty flag', () => {
      const store = useLevelingPathStore();

      store.setName('My Leveling Guide');

      expect(store.currentPath.name).toBe('My Leveling Guide');
      expect(store.pathName).toBe('My Leveling Guide');
      expect(store.isDirty).toBe(true);
    });
  });

  describe('setClassId', () => {
    it('should update character class', () => {
      const store = useLevelingPathStore();

      store.setClassId(CharacterClass.SORCERESS);

      expect(store.currentPath.classId).toBe(CharacterClass.SORCERESS);
      expect(store.classId).toBe(CharacterClass.SORCERESS);
      expect(store.isDirty).toBe(true);
    });
  });

  describe('setBuildId', () => {
    it('should set build ID reference', () => {
      const store = useLevelingPathStore();

      store.setBuildId('123');

      expect(store.currentPath.buildId).toBe('123');
      expect(store.buildId).toBe('123');
      expect(store.isDirty).toBe(true);
    });

    it('should clear build ID when set to undefined', () => {
      const store = useLevelingPathStore();
      store.currentPath.buildId = '123';

      store.setBuildId(undefined);

      expect(store.currentPath.buildId).toBeUndefined();
      expect(store.isDirty).toBe(true);
    });
  });

  describe('checkpoint management', () => {
    it('should add a checkpoint at a given level', () => {
      const store = useLevelingPathStore();

      const checkpoint = store.addCheckpoint(10);

      expect(checkpoint.level).toBe(10);
      expect(checkpoint.allocatedPassives).toEqual([]);
      expect(store.checkpointCount).toBe(1);
      expect(store.isDirty).toBe(true);
    });

    it('should return existing checkpoint if level already exists', () => {
      const store = useLevelingPathStore();
      store.addCheckpoint(10);
      store.setCheckpointPassives(10, ['node1', 'node2']);

      const second = store.addCheckpoint(10);

      // Should return the same checkpoint (not create a new one)
      expect(second.level).toBe(10);
      expect(second.allocatedPassives).toEqual(['node1', 'node2']);
      expect(store.checkpointCount).toBe(1);
    });

    it('should update checkpoint passives', () => {
      const store = useLevelingPathStore();
      store.addCheckpoint(10);

      store.setCheckpointPassives(10, ['node1', 'node2', 'node3']);

      const checkpoint = store.getCheckpoint(10);
      expect(checkpoint?.allocatedPassives).toEqual(['node1', 'node2', 'node3']);
    });

    it('should remove a checkpoint', () => {
      const store = useLevelingPathStore();
      store.addCheckpoint(10);
      store.addCheckpoint(20);

      store.removeCheckpoint(10);

      expect(store.checkpointCount).toBe(1);
      expect(store.getCheckpoint(10)).toBeUndefined();
      expect(store.getCheckpoint(20)).toBeDefined();
    });

    it('should return checkpoints sorted by level', () => {
      const store = useLevelingPathStore();
      store.addCheckpoint(50);
      store.addCheckpoint(10);
      store.addCheckpoint(30);

      const checkpoints = store.checkpoints;

      expect(checkpoints.map((cp) => cp.level)).toEqual([10, 30, 50]);
    });

    it('should silently ignore removing non-existent checkpoint', () => {
      const store = useLevelingPathStore();
      store.addCheckpoint(10);

      // Should not throw
      store.removeCheckpoint(99);

      expect(store.checkpointCount).toBe(1);
    });
  });

  describe('step management', () => {
    it('should add a step with auto-incrementing order', () => {
      const store = useLevelingPathStore();

      const step1 = store.addStep();
      const step2 = store.addStep();
      const step3 = store.addStep();

      expect(step1.order).toBe(1);
      expect(step2.order).toBe(2);
      expect(step3.order).toBe(3);
      expect(store.stepCount).toBe(3);
    });

    it('should add a step with trigger and action', () => {
      const store = useLevelingPathStore();

      const step = store.addStep(
        { type: StepTriggerType.TRIGGER_LEVEL, value: '10' },
        { type: StepActionType.ACTION_ALLOCATE, targetId: 'node123' }
      );

      expect(step.trigger?.type).toBe(StepTriggerType.TRIGGER_LEVEL);
      expect(step.trigger?.value).toBe('10');
      expect(step.action?.type).toBe(StepActionType.ACTION_ALLOCATE);
      expect(step.action?.targetId).toBe('node123');
    });

    it('should update a step', () => {
      const store = useLevelingPathStore();
      store.addStep();

      store.updateStep(1, {
        rationale: 'Get more damage early',
        statDelta: { dpsPercent: 15, resistances: {}, otherStats: {} },
      });

      const step = store.getStep(1);
      expect(step?.rationale).toBe('Get more damage early');
      expect(step?.statDelta?.dpsPercent).toBe(15);
    });

    it('should remove a step and reorder remaining', () => {
      const store = useLevelingPathStore();
      store.addStep(); // order 1
      store.addStep(); // order 2
      store.addStep(); // order 3

      store.removeStep(2);

      expect(store.stepCount).toBe(2);
      expect(store.steps.map((s) => s.order)).toEqual([1, 2]);
    });

    it('should reorder steps correctly', () => {
      const store = useLevelingPathStore();
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: '1' });
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: '2' });
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: '3' });

      // Move step 3 to position 1
      store.reorderStep(3, 1);

      const steps = store.steps;
      expect(steps[0]?.trigger?.value).toBe('3');
      expect(steps[1]?.trigger?.value).toBe('1');
      expect(steps[2]?.trigger?.value).toBe('2');
    });

    it('should return steps sorted by order', () => {
      const store = useLevelingPathStore();
      // Add steps with explicit triggers to identify them
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: 'A' });
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: 'B' });
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: 'C' });

      // Manually mess with order to test sorting
      store.currentPath.steps[0]!.order = 3;
      store.currentPath.steps[1]!.order = 1;
      store.currentPath.steps[2]!.order = 2;

      const steps = store.steps;
      expect(steps.map((s) => s.trigger?.value)).toEqual(['B', 'C', 'A']);
    });

    it('should clamp reorder to valid range', () => {
      const store = useLevelingPathStore();
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: 'A' });
      store.addStep({ type: StepTriggerType.TRIGGER_LEVEL, value: 'B' });

      // Try to move to position 100 (should clamp to 2)
      store.reorderStep(1, 100);

      const steps = store.steps;
      expect(steps[0]?.trigger?.value).toBe('B');
      expect(steps[1]?.trigger?.value).toBe('A');
    });
  });

  describe('newPath', () => {
    it('should reset to empty path', () => {
      const store = useLevelingPathStore();
      store.setName('Test Path');
      store.addCheckpoint(10);
      store.addStep();
      store.isDirty = true;

      store.newPath();

      expect(store.currentPath.name).toBe('New Leveling Path');
      expect(store.checkpointCount).toBe(0);
      expect(store.stepCount).toBe(0);
      expect(store.isDirty).toBe(false);
      expect(store.currentPathDbId).toBeUndefined();
    });
  });

  describe('save', () => {
    it('should save new path to database', async () => {
      const { createLevelingPath } = await import('src/db');
      const store = useLevelingPathStore();
      store.setName('Test Path');
      store.addCheckpoint(10);

      const id = await store.save();

      expect(createLevelingPath).toHaveBeenCalledTimes(1);
      expect(id).toBe(1);
      expect(store.currentPathDbId).toBe(1);
      expect(store.isDirty).toBe(false);
      expect(store.isSaved).toBe(true);
    });

    it('should update existing path in database', async () => {
      const { updateLevelingPath } = await import('src/db');
      const store = useLevelingPathStore();
      store.currentPathDbId = 5;
      store.setName('Updated Path');

      const id = await store.save();

      expect(updateLevelingPath).toHaveBeenCalledWith(5, expect.any(Object));
      expect(id).toBe(5);
      expect(store.isDirty).toBe(false);
    });
  });

  describe('load', () => {
    it('should load path from database', async () => {
      const { getLevelingPath } = await import('src/db');
      vi.mocked(getLevelingPath).mockResolvedValueOnce({
        id: 5,
        name: 'Loaded Path',
        className: 'SORCERESS',
        checkpoints: JSON.stringify([{ level: 10, allocatedPassives: ['node1'] }]),
        steps: JSON.stringify([{ order: 1 }]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const store = useLevelingPathStore();
      const success = await store.load(5);

      expect(success).toBe(true);
      expect(store.currentPath.name).toBe('Loaded Path');
      expect(store.currentPath.classId).toBe(CharacterClass.SORCERESS);
      expect(store.checkpointCount).toBe(1);
      expect(store.stepCount).toBe(1);
      expect(store.currentPathDbId).toBe(5);
      expect(store.isDirty).toBe(false);
    });

    it('should return false if path not found', async () => {
      const { getLevelingPath } = await import('src/db');
      vi.mocked(getLevelingPath).mockResolvedValueOnce(undefined);

      const store = useLevelingPathStore();
      const success = await store.load(999);

      expect(success).toBe(false);
    });
  });

  describe('deleteCurrentPath', () => {
    it('should delete path and reset state', async () => {
      const { deleteLevelingPath } = await import('src/db');
      const store = useLevelingPathStore();
      store.currentPathDbId = 5;
      store.setName('To Delete');

      await store.deleteCurrentPath();

      expect(deleteLevelingPath).toHaveBeenCalledWith(5);
      expect(store.currentPath.name).toBe('New Leveling Path');
      expect(store.currentPathDbId).toBeUndefined();
    });

    it('should do nothing if path is not saved', async () => {
      const { deleteLevelingPath } = await import('src/db');
      const store = useLevelingPathStore();

      await store.deleteCurrentPath();

      expect(deleteLevelingPath).not.toHaveBeenCalled();
    });
  });

  describe('import/export', () => {
    it('should export path as deep clone', () => {
      const store = useLevelingPathStore();
      store.setName('Export Test');
      store.addCheckpoint(10);

      const exported = store.exportPath();

      expect(exported.name).toBe('Export Test');
      expect(exported).not.toBe(store.currentPath);
      expect(exported.checkpoints).not.toBe(store.currentPath.checkpoints);
    });

    it('should import path and mark as dirty', () => {
      const store = useLevelingPathStore();
      store.currentPathDbId = 5;

      store.importPath({
        id: 'imported-id',
        name: 'Imported Path',
        classId: CharacterClass.HUNTRESS,
        checkpoints: [{ level: 20, allocatedPassives: ['n1'], equipment: {}, gems: [] }],
        steps: [],
      });

      expect(store.currentPath.name).toBe('Imported Path');
      expect(store.currentPath.classId).toBe(CharacterClass.HUNTRESS);
      expect(store.checkpointCount).toBe(1);
      expect(store.currentPathDbId).toBeUndefined();
      expect(store.isDirty).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should handle buildId conversion correctly', async () => {
      const { createLevelingPath } = await import('src/db');
      const store = useLevelingPathStore();
      store.setBuildId('42');

      await store.save();

      expect(createLevelingPath).toHaveBeenCalledWith(
        expect.objectContaining({ buildId: 42 })
      );
    });

    it('should handle invalid JSON gracefully on load', async () => {
      const { getLevelingPath } = await import('src/db');
      vi.mocked(getLevelingPath).mockResolvedValueOnce({
        id: 1,
        name: 'Bad JSON Path',
        className: 'WARRIOR',
        checkpoints: 'not valid json',
        steps: '{"broken',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const store = useLevelingPathStore();
      const success = await store.load(1);

      expect(success).toBe(true);
      expect(store.currentPath.checkpoints).toEqual([]);
      expect(store.currentPath.steps).toEqual([]);
    });

    it('should handle unknown class name gracefully', async () => {
      const { getLevelingPath } = await import('src/db');
      vi.mocked(getLevelingPath).mockResolvedValueOnce({
        id: 1,
        name: 'Unknown Class Path',
        className: 'UNKNOWN_CLASS',
        checkpoints: '[]',
        steps: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const store = useLevelingPathStore();
      await store.load(1);

      expect(store.currentPath.classId).toBe(CharacterClass.WARRIOR);
    });
  });
});
