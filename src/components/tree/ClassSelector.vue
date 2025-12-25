<template>
  <div class="class-selector">
    <q-select
      v-model="selectedClass"
      :options="classOptions"
      label="Class"
      dense
      outlined
      emit-value
      map-options
      options-dense
      class="class-selector__select"
      @update:model-value="handleClassChange"
    >
      <template #prepend>
        <q-icon name="person" size="xs" />
      </template>
    </q-select>

    <!-- Confirmation dialog for class change -->
    <q-dialog v-model="showConfirmDialog" persistent>
      <q-card class="class-selector__dialog">
        <q-card-section class="row items-center">
          <q-icon name="warning" color="warning" size="md" class="q-mr-sm" />
          <span class="text-h6">Change Class?</span>
        </q-card-section>

        <q-card-section>
          Changing your class will reset all allocated passive nodes ({{ allocatedCount }} nodes).
          This action cannot be undone.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="cancelClassChange" />
          <q-btn flat label="Change Class" color="negative" @click="confirmClassChange" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CharacterClass } from 'src/protos/pob2_pb';
import { useBuildStore } from 'src/stores/buildStore';
import { useTreeData } from 'src/composables/useTreeData';
import { useTreeStore } from 'src/stores/treeStore';

const emit = defineEmits<{
  /** Emitted when class changes */
  classChanged: [newClass: CharacterClass];
}>();

const buildStore = useBuildStore();
const treeStore = useTreeStore();
const { classes, treeData } = useTreeData();

/** Currently selected class in the dropdown (local state for controlled input) */
const selectedClass = ref<CharacterClass>(buildStore.characterClass ?? CharacterClass.WARRIOR);

/** Pending class change (set when confirmation is needed) */
const pendingClass = ref<CharacterClass | null>(null);

/** Whether to show the confirmation dialog */
const showConfirmDialog = ref(false);

/** Number of allocated nodes */
const allocatedCount = computed(() => buildStore.allocatedNodeCount);

/**
 * Class options for the dropdown.
 * Maps CharacterClass enum to display labels.
 */
const classOptions = computed(() => {
  // Get class names from tree data if available, fallback to enum names
  const classNames = Array.from(classes.value.keys());

  if (classNames.length > 0) {
    return classNames.map((name) => ({
      label: name,
      value: classNameToEnum(name),
    }));
  }

  // Fallback to enum values if tree data not loaded
  return [
    { label: 'Warrior', value: CharacterClass.WARRIOR },
    { label: 'Monk', value: CharacterClass.MONK },
    { label: 'Sorceress', value: CharacterClass.SORCERESS },
    { label: 'Mercenary', value: CharacterClass.MERCENARY },
    { label: 'Huntress', value: CharacterClass.HUNTRESS },
    { label: 'Druid', value: CharacterClass.DRUID },
    { label: 'Witch', value: CharacterClass.WITCH },
    { label: 'Ranger', value: CharacterClass.RANGER },
  ];
});

/**
 * Convert class name string to CharacterClass enum.
 */
function classNameToEnum(name: string): CharacterClass {
  const nameUpper = name.toUpperCase();
  const enumValue = CharacterClass[nameUpper as keyof typeof CharacterClass];
  return typeof enumValue === 'number' ? enumValue : CharacterClass.WARRIOR;
}

/**
 * Convert CharacterClass enum to display name.
 */
function enumToClassName(charClass: CharacterClass): string {
  const name = CharacterClass[charClass];
  if (typeof name !== 'string') return 'Warrior';
  // Convert WARRIOR to Warrior
  return name.charAt(0) + name.slice(1).toLowerCase();
}

/**
 * Handle class selection change.
 * If nodes are allocated, show confirmation dialog.
 */
function handleClassChange(newClass: CharacterClass): void {
  // If no nodes allocated, change immediately
  if (allocatedCount.value === 0) {
    applyClassChange(newClass);
    return;
  }

  // Show confirmation dialog
  pendingClass.value = newClass;
  showConfirmDialog.value = true;

  // Revert dropdown to current class (will be updated if confirmed)
  selectedClass.value = buildStore.characterClass ?? CharacterClass.WARRIOR;
}

/**
 * Cancel the class change and close dialog.
 */
function cancelClassChange(): void {
  showConfirmDialog.value = false;
  pendingClass.value = null;
}

/**
 * Confirm the class change.
 */
function confirmClassChange(): void {
  if (pendingClass.value !== null) {
    applyClassChange(pendingClass.value);
  }
  showConfirmDialog.value = false;
  pendingClass.value = null;
}

/**
 * Apply the class change to the build.
 */
function applyClassChange(newClass: CharacterClass): void {
  // Reset allocated nodes when changing class
  if (buildStore.allocatedNodeCount > 0) {
    buildStore.setAllocatedNodes([]);
  }

  // Update the class (this also clears ascendancy in buildStore)
  buildStore.setCharacterClass(newClass);
  selectedClass.value = newClass;

  // Clear visible ascendancy in tree since class changed
  treeStore.setVisibleAscendancy(null);

  // Center on class start node
  centerOnClassStart(newClass);

  emit('classChanged', newClass);
}

/**
 * Center the tree viewport on the class start node.
 */
function centerOnClassStart(charClass: CharacterClass): void {
  if (!treeData.value) return;

  const className = enumToClassName(charClass);
  const classData = classes.value.get(className);

  if (classData?.startNodeId) {
    treeStore.centerOnNode(classData.startNodeId);
  }
}

// Sync with buildStore when it changes externally
watch(
  () => buildStore.characterClass,
  (newClass) => {
    if (newClass !== undefined) {
      selectedClass.value = newClass;
    }
  }
);
</script>

<style scoped>
.class-selector {
  min-width: 150px;
}

.class-selector__select {
  min-width: 150px;
}

.class-selector__dialog {
  min-width: 300px;
}
</style>
