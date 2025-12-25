<template>
  <div class="ascendancy-panel q-pa-sm rounded-borders">
    <!-- Ascendancy Selection -->
    <div class="ascendancy-panel__header row items-center q-mb-sm">
      <span class="text-subtitle2 text-weight-medium">Ascendancy</span>
      <q-space />
      <q-badge v-if="selectedAscendancy" color="primary" class="q-ml-sm">
        {{ ascendancyPointsUsed }}/{{ MAX_ASCENDANCY_POINTS }}
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
    <div v-if="selectedAscendancy && ascendancyInfo" class="ascendancy-panel__info q-mt-sm q-pa-sm rounded-borders">
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
    <div v-if="selectedAscendancy" class="ascendancy-panel__points q-mt-md q-pa-sm rounded-borders">
      <div class="text-caption text-grey-6 q-mb-xs">Ascendancy Points</div>
      <q-linear-progress
        :value="ascendancyPointsUsed / MAX_ASCENDANCY_POINTS"
        color="primary"
        track-color="grey-8"
        size="8px"
        rounded
      />
      <div class="row justify-between text-caption text-grey-5 q-mt-xs">
        <span>{{ ascendancyPointsUsed }} allocated</span>
        <span>{{ MAX_ASCENDANCY_POINTS - ascendancyPointsUsed }} available</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useBuildStore } from 'src/stores/buildStore';
import { useTreeData } from 'src/composables/useTreeData';
import { useTreeStore } from 'src/stores/treeStore';
import { classEnumToName } from 'src/utils/characterClass';
import type { TreeAscendancy } from 'src/types/tree';

/**
 * Maximum ascendancy points available per character in PoE2.
 * Players earn 2 points at each of the 4 labyrinth trials (Normal, Cruel, Merciless, Eternal).
 */
const MAX_ASCENDANCY_POINTS = 8;

const emit = defineEmits<{
  /** Emitted when ascendancy changes */
  ascendancyChanged: [ascendancy: string | undefined];
}>();

const buildStore = useBuildStore();
const treeStore = useTreeStore();
const { classes, ascendancies, getAscendancyNodes } = useTreeData();

/** Currently selected ascendancy */
const selectedAscendancy = ref<string | undefined>(buildStore.ascendancy);

/**
 * Current class name derived from CharacterClass enum.
 */
const currentClassName = computed(() => {
  const charClass = buildStore.characterClass;
  if (charClass === undefined) return null;
  return classEnumToName(charClass);
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
 *
 * Optimized to iterate over allocated nodes (typically smaller set)
 * and check ascendancy membership via a Set lookup.
 */
const ascendancyPointsUsed = computed(() => {
  if (!selectedAscendancy.value) return 0;

  const ascNodes = getAscendancyNodes(selectedAscendancy.value);
  const ascNodeIds = new Set(ascNodes.map((n) => n.id));

  let count = 0;
  for (const nodeId of buildStore.allocatedNodeIds) {
    if (ascNodeIds.has(nodeId)) {
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
/*
 * Ascendancy panel styling uses PoE2 theme variables.
 * Custom CSS needed for toggle button deep styling and rgba overlays.
 */
.ascendancy-panel {
  background-color: var(--poe2-bg-overlay);
}

.ascendancy-panel__toggle {
  width: 100%;
}

/* Deep selector needed for Quasar toggle button internals */
.ascendancy-panel__toggle :deep(.q-btn) {
  font-size: 12px;
}

.ascendancy-panel__info {
  background-color: var(--poe2-bg-overlay);
}

.ascendancy-panel__points {
  background-color: var(--poe2-bg-surface);
}
</style>
