<template>
  <div class="ascendancy-panel">
    <!-- Ascendancy Selection -->
    <div class="ascendancy-panel__header row items-center q-mb-sm">
      <span class="text-subtitle2 text-weight-medium">Ascendancy</span>
      <q-space />
      <q-badge v-if="selectedAscendancy" color="primary" class="q-ml-sm">
        {{ ascendancyPointsUsed }}/{{ maxAscendancyPoints }}
      </q-badge>
    </div>

    <!-- No class selected message -->
    <div v-if="!currentClassName" class="text-grey-6 text-caption">
      Select a class first
    </div>

    <!-- Ascendancy options -->
    <div v-else class="ascendancy-panel__options">
      <q-btn-toggle
        v-model="selectedAscendancy"
        :options="ascendancyOptions"
        spread
        no-caps
        unelevated
        toggle-color="primary"
        color="grey-8"
        text-color="grey-4"
        toggle-text-color="white"
        class="ascendancy-panel__toggle"
        @update:model-value="handleAscendancyChange"
      />

      <!-- Clear ascendancy button -->
      <q-btn
        v-if="selectedAscendancy"
        flat
        dense
        size="sm"
        color="grey"
        icon="close"
        label="Clear"
        class="q-mt-xs full-width"
        @click="clearAscendancy"
      />
    </div>

    <!-- Ascendancy info -->
    <div v-if="selectedAscendancy && ascendancyInfo" class="ascendancy-panel__info q-mt-sm">
      <div class="row items-center q-gutter-xs">
        <q-icon name="stars" size="xs" color="amber" />
        <span class="text-caption text-grey-4">{{ ascendancyInfo.id }}</span>
      </div>

      <!-- View in tree button -->
      <q-btn
        flat
        dense
        size="sm"
        color="primary"
        icon="visibility"
        label="View in Tree"
        class="q-mt-xs full-width"
        @click="centerOnAscendancy"
      />
    </div>

    <!-- Ascendancy points breakdown -->
    <div v-if="selectedAscendancy" class="ascendancy-panel__points q-mt-md">
      <div class="text-caption text-grey-6 q-mb-xs">Ascendancy Points</div>
      <q-linear-progress
        :value="ascendancyPointsUsed / maxAscendancyPoints"
        color="primary"
        track-color="grey-8"
        size="8px"
        rounded
      />
      <div class="row justify-between text-caption text-grey-5 q-mt-xs">
        <span>{{ ascendancyPointsUsed }} allocated</span>
        <span>{{ maxAscendancyPoints - ascendancyPointsUsed }} available</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CharacterClass } from 'src/protos/pob2_pb';
import { useBuildStore } from 'src/stores/buildStore';
import { useTreeData } from 'src/composables/useTreeData';
import { useTreeStore } from 'src/stores/treeStore';
import type { TreeAscendancy } from 'src/types/tree';

const emit = defineEmits<{
  /** Emitted when ascendancy changes */
  ascendancyChanged: [ascendancy: string | undefined];
}>();

const buildStore = useBuildStore();
const treeStore = useTreeStore();
const { classes, ascendancies, getAscendancyNodes } = useTreeData();

/** Maximum ascendancy points available (8 in PoE2) */
const maxAscendancyPoints = 8;

/** Currently selected ascendancy */
const selectedAscendancy = ref<string | undefined>(buildStore.ascendancy);

/**
 * Current class name derived from CharacterClass enum.
 */
const currentClassName = computed(() => {
  const charClass = buildStore.characterClass;
  if (charClass === undefined) return null;

  const name = CharacterClass[charClass];
  if (typeof name !== 'string') return null;

  // Convert WARRIOR to Warrior
  return name.charAt(0) + name.slice(1).toLowerCase();
});

/**
 * Available ascendancies for the current class.
 */
const availableAscendancies = computed(() => {
  if (!currentClassName.value) return [];

  const classData = classes.value.get(currentClassName.value);
  if (!classData) return [];

  return classData.ascendancies;
});

/**
 * Ascendancy options for the button toggle.
 */
const ascendancyOptions = computed(() => {
  return availableAscendancies.value.map((name: string) => ({
    label: name,
    value: name,
  }));
});

/**
 * Current ascendancy info from tree data.
 */
const ascendancyInfo = computed((): TreeAscendancy | null => {
  if (!selectedAscendancy.value) return null;
  return ascendancies.value.get(selectedAscendancy.value) ?? null;
});

/**
 * Count of ascendancy points used.
 * Counts allocated nodes that belong to the current ascendancy.
 */
const ascendancyPointsUsed = computed(() => {
  if (!selectedAscendancy.value) return 0;

  const ascNodes = getAscendancyNodes(selectedAscendancy.value);
  const allocatedSet = new Set(buildStore.allocatedNodeIds);

  let count = 0;
  for (const node of ascNodes) {
    if (allocatedSet.has(node.id)) {
      count++;
    }
  }

  return count;
});

/**
 * Handle ascendancy selection change.
 */
function handleAscendancyChange(newAscendancy: string | undefined): void {
  buildStore.setAscendancy(newAscendancy);

  // Update tree visibility to show selected ascendancy nodes
  treeStore.setVisibleAscendancy(newAscendancy ?? null);

  emit('ascendancyChanged', newAscendancy);
}

/**
 * Clear the current ascendancy selection.
 */
function clearAscendancy(): void {
  selectedAscendancy.value = undefined;
  handleAscendancyChange(undefined);
}

/**
 * Center the tree viewport on the ascendancy start node.
 */
function centerOnAscendancy(): void {
  if (!ascendancyInfo.value?.startNodeId) return;
  treeStore.centerOnNode(ascendancyInfo.value.startNodeId);
}

// Sync with buildStore when it changes externally
watch(
  () => buildStore.ascendancy,
  (newAscendancy) => {
    selectedAscendancy.value = newAscendancy;
  }
);

// Clear ascendancy when class changes (if not compatible)
watch(
  () => buildStore.characterClass,
  () => {
    // Check if current ascendancy is still valid for the new class
    if (selectedAscendancy.value && !availableAscendancies.value.includes(selectedAscendancy.value)) {
      clearAscendancy();
    }
  }
);
</script>

<style scoped>
.ascendancy-panel {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.ascendancy-panel__toggle {
  width: 100%;
}

.ascendancy-panel__toggle :deep(.q-btn) {
  font-size: 12px;
  padding: 4px 8px;
}

.ascendancy-panel__info {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.ascendancy-panel__points {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
</style>
