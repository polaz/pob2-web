<template>
  <q-card class="item-comparison-pane" flat bordered>
    <q-card-section class="item-comparison-pane__header q-pa-sm">
      <div class="row items-center">
        <q-icon name="compare_arrows" size="sm" class="q-mr-sm" />
        <span class="text-subtitle2">Item Comparison</span>
        <q-space />
        <q-btn
          v-if="itemA || itemB"
          icon="close"
          flat
          round
          dense
          size="sm"
          @click="handleClear"
        />
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="!itemA && !itemB" class="item-comparison-pane__empty column items-center justify-center text-center q-pa-lg">
      <q-icon name="compare" size="48px" color="grey-6" />
      <div class="text-grey-6 q-mt-md">
        Select items to compare
      </div>
      <div class="text-caption text-grey-7 q-mt-xs">
        Right-click an item and choose "Compare"
      </div>
    </q-card-section>

    <q-card-section v-else class="item-comparison-pane__content q-pa-sm">
      <!-- Side by side items -->
      <div class="row q-gutter-sm">
        <!-- Item A -->
        <div class="col-6">
          <div class="text-caption text-grey-6 q-mb-xs">Current</div>
          <div v-if="itemA" class="item-comparison-pane__item">
            <ItemCard
              :item="itemA"
              :show-details="false"
              :hoverable="false"
              width="100%"
            />
          </div>
          <div v-else class="item-comparison-pane__placeholder flex items-center justify-center">
            <q-icon name="inventory_2" size="24px" color="grey-7" />
          </div>
        </div>

        <!-- Item B -->
        <div class="col-6">
          <div class="text-caption text-grey-6 q-mb-xs">Comparing</div>
          <div v-if="itemB" class="item-comparison-pane__item">
            <ItemCard
              :item="itemB"
              :show-details="false"
              :hoverable="false"
              width="100%"
            />
          </div>
          <div v-else class="item-comparison-pane__placeholder flex items-center justify-center">
            <q-icon name="inventory_2" size="24px" color="grey-7" />
          </div>
        </div>
      </div>

      <!-- Stat deltas -->
      <div v-if="itemA && itemB" class="item-comparison-pane__deltas q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Stat Changes</div>

        <!-- Defence stats -->
        <div v-if="hasDefenceDeltas" class="q-mb-sm">
          <div class="text-caption text-grey-6 q-mb-xs">Defence</div>
          <StatDelta
            v-if="deltas.armour !== 0"
            label="Armour"
            :value="deltas.armour"
          />
          <StatDelta
            v-if="deltas.evasion !== 0"
            label="Evasion"
            :value="deltas.evasion"
          />
          <StatDelta
            v-if="deltas.energyShield !== 0"
            label="Energy Shield"
            :value="deltas.energyShield"
          />
          <StatDelta
            v-if="deltas.ward !== 0"
            label="Ward"
            :value="deltas.ward"
          />
          <StatDelta
            v-if="deltas.block !== 0"
            label="Block"
            :value="deltas.block"
            :is-percentage="true"
          />
        </div>

        <!-- Weapon stats -->
        <div v-if="hasWeaponDeltas" class="q-mb-sm">
          <div class="text-caption text-grey-6 q-mb-xs">Offence</div>
          <StatDelta
            v-if="deltas.physicalDps !== 0"
            label="Physical DPS"
            :value="deltas.physicalDps"
            :decimals="1"
          />
          <StatDelta
            v-if="deltas.elementalDps !== 0"
            label="Elemental DPS"
            :value="deltas.elementalDps"
            :decimals="1"
          />
          <StatDelta
            v-if="deltas.totalDps !== 0"
            label="Total DPS"
            :value="deltas.totalDps"
            :decimals="1"
          />
          <StatDelta
            v-if="deltas.attackSpeed !== 0"
            label="Attack Speed"
            :value="deltas.attackSpeed"
            :decimals="2"
          />
          <StatDelta
            v-if="deltas.critChance !== 0"
            label="Crit Chance"
            :value="deltas.critChance"
            :decimals="2"
            :is-percentage="true"
          />
        </div>

        <!-- Requirements -->
        <div v-if="hasRequirementDeltas">
          <div class="text-caption text-grey-6 q-mb-xs">Requirements</div>
          <StatDelta
            v-if="deltas.requiredLevel !== 0"
            label="Level"
            :value="deltas.requiredLevel"
            :positive-is-bad="true"
          />
          <StatDelta
            v-if="deltas.requiredStr !== 0"
            label="Str"
            :value="deltas.requiredStr"
            :positive-is-bad="true"
          />
          <StatDelta
            v-if="deltas.requiredDex !== 0"
            label="Dex"
            :value="deltas.requiredDex"
            :positive-is-bad="true"
          />
          <StatDelta
            v-if="deltas.requiredInt !== 0"
            label="Int"
            :value="deltas.requiredInt"
            :positive-is-bad="true"
          />
        </div>

        <!-- No significant changes -->
        <div v-if="!hasAnyDeltas" class="text-center text-grey-6 q-pa-md">
          No significant stat differences
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Item } from 'src/protos/pob2_pb';
import { computeWeaponStats, computeArmourStats } from 'src/engine/items/types';
import ItemCard from './ItemCard.vue';
import StatDelta from './StatDelta.vue';

// ============================================================================
// Props & Emits
// ============================================================================

const props = withDefaults(
  defineProps<{
    /** First item (current/equipped) */
    itemA?: Item | null;
    /** Second item (comparing) */
    itemB?: Item | null;
  }>(),
  {
    itemA: null,
    itemB: null,
  }
);

const emit = defineEmits<{
  /** Emitted when comparison is cleared */
  clear: [];
}>();

// ============================================================================
// Computed Deltas
// ============================================================================

interface StatDeltas {
  // Defence
  armour: number;
  evasion: number;
  energyShield: number;
  ward: number;
  block: number;
  // Weapon
  physicalDps: number;
  elementalDps: number;
  totalDps: number;
  attackSpeed: number;
  critChance: number;
  // Requirements
  requiredLevel: number;
  requiredStr: number;
  requiredDex: number;
  requiredInt: number;
}

/** Computed stat deltas between items (B - A) */
const deltas = computed<StatDeltas>(() => {
  const result: StatDeltas = {
    armour: 0,
    evasion: 0,
    energyShield: 0,
    ward: 0,
    block: 0,
    physicalDps: 0,
    elementalDps: 0,
    totalDps: 0,
    attackSpeed: 0,
    critChance: 0,
    requiredLevel: 0,
    requiredStr: 0,
    requiredDex: 0,
    requiredInt: 0,
  };

  if (!props.itemA || !props.itemB) return result;

  // Armour deltas
  if (props.itemA.armourData || props.itemB.armourData) {
    const armourA = props.itemA.armourData
      ? computeArmourStats(props.itemA.armourData, props.itemA.quality ?? 0)
      : null;
    const armourB = props.itemB.armourData
      ? computeArmourStats(props.itemB.armourData, props.itemB.quality ?? 0)
      : null;

    result.armour = (armourB?.armour ?? 0) - (armourA?.armour ?? 0);
    result.evasion = (armourB?.evasion ?? 0) - (armourA?.evasion ?? 0);
    result.energyShield = (armourB?.energyShield ?? 0) - (armourA?.energyShield ?? 0);
    result.ward = (armourB?.ward ?? 0) - (armourA?.ward ?? 0);
    result.block = (armourB?.block ?? 0) - (armourA?.block ?? 0);
  }

  // Weapon deltas
  if (props.itemA.weaponData || props.itemB.weaponData) {
    const weaponA = props.itemA.weaponData
      ? computeWeaponStats(props.itemA.weaponData, props.itemA.quality ?? 0)
      : null;
    const weaponB = props.itemB.weaponData
      ? computeWeaponStats(props.itemB.weaponData, props.itemB.quality ?? 0)
      : null;

    result.physicalDps = (weaponB?.physicalDps ?? 0) - (weaponA?.physicalDps ?? 0);
    result.elementalDps = (weaponB?.elementalDps ?? 0) - (weaponA?.elementalDps ?? 0);
    result.totalDps = (weaponB?.totalDps ?? 0) - (weaponA?.totalDps ?? 0);
    result.attackSpeed = (weaponB?.attackSpeed ?? 0) - (weaponA?.attackSpeed ?? 0);
    result.critChance = (weaponB?.critChance ?? 0) - (weaponA?.critChance ?? 0);
  }

  // Requirement deltas
  result.requiredLevel = (props.itemB.requiredLevel ?? 0) - (props.itemA.requiredLevel ?? 0);
  result.requiredStr = (props.itemB.requiredStr ?? 0) - (props.itemA.requiredStr ?? 0);
  result.requiredDex = (props.itemB.requiredDex ?? 0) - (props.itemA.requiredDex ?? 0);
  result.requiredInt = (props.itemB.requiredInt ?? 0) - (props.itemA.requiredInt ?? 0);

  return result;
});

/** Whether there are defence deltas to show */
const hasDefenceDeltas = computed(() => {
  const d = deltas.value;
  return d.armour !== 0 || d.evasion !== 0 || d.energyShield !== 0 || d.ward !== 0 || d.block !== 0;
});

/** Whether there are weapon deltas to show */
const hasWeaponDeltas = computed(() => {
  const d = deltas.value;
  return (
    d.physicalDps !== 0 ||
    d.elementalDps !== 0 ||
    d.totalDps !== 0 ||
    d.attackSpeed !== 0 ||
    d.critChance !== 0
  );
});

/** Whether there are requirement deltas to show */
const hasRequirementDeltas = computed(() => {
  const d = deltas.value;
  return d.requiredLevel !== 0 || d.requiredStr !== 0 || d.requiredDex !== 0 || d.requiredInt !== 0;
});

/** Whether there are any deltas */
const hasAnyDeltas = computed(() => {
  return hasDefenceDeltas.value || hasWeaponDeltas.value || hasRequirementDeltas.value;
});

// ============================================================================
// Methods
// ============================================================================

function handleClear(): void {
  emit('clear');
}
</script>

<style scoped>
/* Uses global PoE2 theme variables from themes/poe2.scss */
.item-comparison-pane {
  /* Component-specific layout dimensions */
  --pane-min-width: 280px;
  --empty-min-height: 200px;
  --placeholder-min-height: 80px;
  --placeholder-padding: 16px;

  background-color: var(--poe2-card-bg);
  min-width: var(--pane-min-width);
}

.item-comparison-pane__header {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
}

.item-comparison-pane__empty {
  min-height: var(--empty-min-height);
}

.item-comparison-pane__placeholder {
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: var(--placeholder-padding);
  min-height: var(--placeholder-min-height);
}

.item-comparison-pane__deltas {
  --deltas-padding: 8px;

  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  padding: var(--deltas-padding);
}
</style>
