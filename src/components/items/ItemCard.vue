<template>
  <q-card
    class="item-card"
    :class="cardClasses"
    :style="cardStyle"
    flat
    bordered
    @click="$emit('click', item)"
    @mouseenter="$emit('mouseenter', item)"
    @mouseleave="$emit('mouseleave', item)"
  >
    <!-- Header with name and rarity -->
    <q-card-section class="item-card__header q-pa-sm">
      <div class="row items-center no-wrap">
        <!-- Item icon placeholder -->
        <div class="item-card__icon q-mr-sm" :style="iconStyle">
          <img
            v-if="iconUrl"
            :src="iconUrl"
            :alt="displayName"
            class="item-card__icon-img"
            @error="handleIconError"
          />
        </div>

        <!-- Name and base type -->
        <div class="col">
          <div
            v-if="item.name"
            class="item-card__name text-weight-bold"
            :style="{ color: rarityColor }"
          >
            {{ item.name }}
          </div>
          <div class="item-card__base text-caption" :style="{ color: rarityColor }">
            {{ item.baseName ?? item.typeLine ?? 'Unknown' }}
          </div>
        </div>

        <!-- Actions slot -->
        <div v-if="$slots.actions" class="item-card__actions">
          <slot name="actions" />
        </div>
      </div>
    </q-card-section>

    <q-separator v-if="showDetails" />

    <!-- Properties section (weapon/armour stats) -->
    <q-card-section v-if="showDetails && hasProperties" class="item-card__properties q-pa-sm">
      <!-- Weapon properties -->
      <template v-if="item.weaponData">
        <div v-if="physicalDamage" class="item-card__prop">
          <span class="text-grey-6">Physical Damage:</span>
          <span class="text-white q-ml-xs">{{ physicalDamage }}</span>
        </div>
        <div v-if="elementalDamage" class="item-card__prop">
          <span class="text-grey-6">Elemental Damage:</span>
          <span class="q-ml-xs" v-html="elementalDamage"></span>
        </div>
        <div v-if="item.weaponData.critChance" class="item-card__prop">
          <span class="text-grey-6">Critical Strike Chance:</span>
          <span class="text-white q-ml-xs">{{ formatCritChance(item.weaponData.critChance) }}%</span>
        </div>
        <div v-if="item.weaponData.attackSpeed" class="item-card__prop">
          <span class="text-grey-6">Attacks per Second:</span>
          <span class="text-white q-ml-xs">{{ item.weaponData.attackSpeed.toFixed(2) }}</span>
        </div>
        <div v-if="totalDps" class="item-card__prop">
          <span class="text-grey-6">DPS:</span>
          <span class="text-cyan q-ml-xs">{{ totalDps }}</span>
        </div>
      </template>

      <!-- Armour properties -->
      <template v-if="item.armourData">
        <div v-if="item.armourData.armour" class="item-card__prop">
          <span class="text-grey-6">Armour:</span>
          <span class="text-white q-ml-xs">{{ item.armourData.armour }}</span>
        </div>
        <div v-if="item.armourData.evasion" class="item-card__prop">
          <span class="text-grey-6">Evasion Rating:</span>
          <span class="text-white q-ml-xs">{{ item.armourData.evasion }}</span>
        </div>
        <div v-if="item.armourData.energyShield" class="item-card__prop">
          <span class="text-grey-6">Energy Shield:</span>
          <span class="text-white q-ml-xs">{{ item.armourData.energyShield }}</span>
        </div>
        <div v-if="item.armourData.ward" class="item-card__prop">
          <span class="text-grey-6">Ward:</span>
          <span class="text-white q-ml-xs">{{ item.armourData.ward }}</span>
        </div>
        <div v-if="item.armourData.block" class="item-card__prop">
          <span class="text-grey-6">Chance to Block:</span>
          <span class="text-white q-ml-xs">{{ formatBlock(item.armourData.block) }}%</span>
        </div>
      </template>

      <!-- Quality and Item Level -->
      <div v-if="item.quality" class="item-card__prop">
        <span class="text-grey-6">Quality:</span>
        <span class="text-cyan q-ml-xs">+{{ item.quality }}%</span>
      </div>
      <div v-if="item.itemLevel" class="item-card__prop">
        <span class="text-grey-6">Item Level:</span>
        <span class="text-white q-ml-xs">{{ item.itemLevel }}</span>
      </div>
    </q-card-section>

    <q-separator v-if="showDetails && hasRequirements" />

    <!-- Requirements section -->
    <q-card-section v-if="showDetails && hasRequirements" class="item-card__requirements q-pa-sm">
      <div class="text-grey-6 text-caption q-mb-xs">Requirements:</div>
      <div class="row q-gutter-sm text-caption">
        <div v-if="item.requiredLevel">
          <span class="text-grey-6">Level:</span>
          <span class="text-white q-ml-xs">{{ item.requiredLevel }}</span>
        </div>
        <div v-if="item.requiredStr">
          <span class="text-red-4">Str:</span>
          <span class="text-white q-ml-xs">{{ item.requiredStr }}</span>
        </div>
        <div v-if="item.requiredDex">
          <span class="text-green-4">Dex:</span>
          <span class="text-white q-ml-xs">{{ item.requiredDex }}</span>
        </div>
        <div v-if="item.requiredInt">
          <span class="text-blue-4">Int:</span>
          <span class="text-white q-ml-xs">{{ item.requiredInt }}</span>
        </div>
      </div>
    </q-card-section>

    <q-separator v-if="showDetails && hasSockets" />

    <!-- Sockets section -->
    <q-card-section v-if="showDetails && hasSockets" class="item-card__sockets q-pa-sm">
      <div class="row q-gutter-xs items-center">
        <template v-for="(socket, idx) in item.sockets" :key="idx">
          <!-- Link indicator between sockets in same group -->
          <div
            v-if="idx > 0 && socket.group === item.sockets[idx - 1]?.group"
            class="item-card__socket-link"
          >
            -
          </div>
          <div
            class="item-card__socket"
            :class="`item-card__socket--${socket.color?.toLowerCase() ?? 'w'}`"
          />
        </template>
      </div>
    </q-card-section>

    <q-separator v-if="showDetails && hasImplicits" />

    <!-- Implicit mods -->
    <q-card-section v-if="showDetails && hasImplicits" class="item-card__mods q-pa-sm">
      <div
        v-for="(mod, idx) in item.implicitMods"
        :key="`implicit-${idx}`"
        class="item-card__mod item-card__mod--implicit text-cyan"
      >
        {{ mod }}
      </div>
    </q-card-section>

    <q-separator v-if="showDetails && hasExplicits" />

    <!-- Explicit mods -->
    <q-card-section v-if="showDetails && hasExplicits" class="item-card__mods q-pa-sm">
      <!-- Enchant mods -->
      <div
        v-for="(mod, idx) in item.enchantMods"
        :key="`enchant-${idx}`"
        class="item-card__mod item-card__mod--enchant text-light-blue"
      >
        {{ mod }} (enchant)
      </div>

      <!-- Regular explicit mods -->
      <div
        v-for="(mod, idx) in item.explicitMods"
        :key="`explicit-${idx}`"
        class="item-card__mod item-card__mod--explicit text-cyan"
      >
        {{ mod }}
      </div>

      <!-- Crafted mods -->
      <div
        v-for="(mod, idx) in item.craftedMods"
        :key="`crafted-${idx}`"
        class="item-card__mod item-card__mod--crafted text-light-blue"
      >
        {{ mod }} (crafted)
      </div>
    </q-card-section>

    <!-- Status tags -->
    <q-card-section v-if="showDetails && hasStatusTags" class="item-card__status q-pa-sm">
      <div class="row q-gutter-xs">
        <q-chip
          v-if="item.corrupted"
          size="sm"
          color="red-10"
          text-color="red"
          dense
        >
          Corrupted
        </q-chip>
        <q-chip
          v-if="item.mirrored"
          size="sm"
          color="purple-10"
          text-color="purple-4"
          dense
        >
          Mirrored
        </q-chip>
        <q-chip
          v-if="item.fractured"
          size="sm"
          color="amber-10"
          text-color="amber"
          dense
        >
          Fractured
        </q-chip>
      </div>
    </q-card-section>

    <!-- Comparison delta slot -->
    <slot name="comparison" />
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import type { Item } from 'src/protos/pob2_pb';
import {
  itemIconLoader,
  getRarityColor,
  getRarityBorderColor,
} from 'src/services/itemIcons';

// ============================================================================
// Props & Emits
// ============================================================================

const props = withDefaults(
  defineProps<{
    /** Item to display */
    item: Item;
    /** Whether to show detailed view */
    showDetails?: boolean;
    /** Whether the card is selected */
    selected?: boolean;
    /** Whether the card is highlighted for comparison */
    highlighted?: boolean;
    /** Card width (CSS value) */
    width?: string;
    /** Whether to show hover effects */
    hoverable?: boolean;
  }>(),
  {
    showDetails: true,
    selected: false,
    highlighted: false,
    width: '280px',
    hoverable: true,
  }
);

defineEmits<{
  click: [item: Item];
  mouseenter: [item: Item];
  mouseleave: [item: Item];
}>();

// ============================================================================
// Icon Loading
// ============================================================================

const iconUrl = ref<string>('');
const iconError = ref(false);

function loadIcon(): void {
  // For now, use rarity placeholder since items don't have icon paths yet
  // In the future, when icon paths are added to item data, use:
  // iconUrl.value = await itemIconLoader.getIconUrl(props.item.iconPath);
  iconUrl.value = itemIconLoader.getRarityPlaceholder(
    props.item.rarity ?? 0,
    props.item.baseName?.charAt(0) ?? props.item.name?.charAt(0) ?? '?'
  );
}

function handleIconError(): void {
  iconError.value = true;
  iconUrl.value = itemIconLoader.getPlaceholder();
}

onMounted(loadIcon);
watch(() => props.item, loadIcon);

// ============================================================================
// Computed Properties
// ============================================================================

/** Display name for the item */
const displayName = computed(() => {
  return props.item.name ?? props.item.baseName ?? props.item.typeLine ?? 'Unknown Item';
});

/** Rarity color */
const rarityColor = computed(() => getRarityColor(props.item.rarity));

/** Card CSS classes */
const cardClasses = computed(() => ({
  'item-card--selected': props.selected,
  'item-card--highlighted': props.highlighted,
  'item-card--hoverable': props.hoverable,
  'item-card--corrupted': props.item.corrupted,
}));

/** Card inline styles */
const cardStyle = computed(() => ({
  width: props.width,
  borderColor: getRarityBorderColor(props.item.rarity),
}));

/** Icon container styles */
const iconStyle = computed(() => ({
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
}));

/** Whether item has displayable properties */
const hasProperties = computed(() => {
  return !!(
    props.item.weaponData ||
    props.item.armourData ||
    props.item.quality ||
    props.item.itemLevel
  );
});

/** Whether item has requirements */
const hasRequirements = computed(() => {
  return !!(
    props.item.requiredLevel ||
    props.item.requiredStr ||
    props.item.requiredDex ||
    props.item.requiredInt
  );
});

/** Whether item has sockets */
const hasSockets = computed(() => {
  return props.item.sockets && props.item.sockets.length > 0;
});

/** Whether item has implicit mods */
const hasImplicits = computed(() => {
  return props.item.implicitMods && props.item.implicitMods.length > 0;
});

/** Whether item has explicit/crafted/enchant mods */
const hasExplicits = computed(() => {
  return !!(
    (props.item.explicitMods && props.item.explicitMods.length > 0) ||
    (props.item.craftedMods && props.item.craftedMods.length > 0) ||
    (props.item.enchantMods && props.item.enchantMods.length > 0)
  );
});

/** Whether item has status tags (corrupted/mirrored/fractured) */
const hasStatusTags = computed(() => {
  return props.item.corrupted || props.item.mirrored || props.item.fractured;
});

// ============================================================================
// Weapon Stats Formatting
// ============================================================================

/** Physical damage display string */
const physicalDamage = computed(() => {
  const wd = props.item.weaponData;
  if (!wd || (!wd.physicalMin && !wd.physicalMax)) return null;
  return `${wd.physicalMin ?? 0}-${wd.physicalMax ?? 0}`;
});

/** Elemental damage display with colored values */
const elementalDamage = computed(() => {
  const wd = props.item.weaponData;
  if (!wd) return null;

  const parts: string[] = [];

  if (wd.fireMin || wd.fireMax) {
    parts.push(`<span class="text-red">${wd.fireMin ?? 0}-${wd.fireMax ?? 0}</span>`);
  }
  if (wd.coldMin || wd.coldMax) {
    parts.push(`<span class="text-light-blue">${wd.coldMin ?? 0}-${wd.coldMax ?? 0}</span>`);
  }
  if (wd.lightningMin || wd.lightningMax) {
    parts.push(`<span class="text-yellow">${wd.lightningMin ?? 0}-${wd.lightningMax ?? 0}</span>`);
  }
  if (wd.chaosMin || wd.chaosMax) {
    parts.push(`<span class="text-purple">${wd.chaosMin ?? 0}-${wd.chaosMax ?? 0}</span>`);
  }

  return parts.length > 0 ? parts.join(', ') : null;
});

/** Total DPS display */
const totalDps = computed(() => {
  const wd = props.item.weaponData;
  if (!wd || !wd.attackSpeed) return null;

  const physMin = wd.physicalMin ?? 0;
  const physMax = wd.physicalMax ?? 0;
  const fireMin = wd.fireMin ?? 0;
  const fireMax = wd.fireMax ?? 0;
  const coldMin = wd.coldMin ?? 0;
  const coldMax = wd.coldMax ?? 0;
  const lightningMin = wd.lightningMin ?? 0;
  const lightningMax = wd.lightningMax ?? 0;
  const chaosMin = wd.chaosMin ?? 0;
  const chaosMax = wd.chaosMax ?? 0;

  const avgDamage =
    (physMin + physMax + fireMin + fireMax + coldMin + coldMax + lightningMin + lightningMax + chaosMin + chaosMax) / 2;
  const dps = avgDamage * wd.attackSpeed;

  return dps.toFixed(1);
});

// ============================================================================
// Formatting Helpers
// ============================================================================

/** Percentage storage multiplier divisor */
const PERCENTAGE_TO_DECIMAL_DIVISOR = 100;

/** Format crit chance from stored value (e.g., 500 -> "5.00") */
function formatCritChance(value: number): string {
  return (value / PERCENTAGE_TO_DECIMAL_DIVISOR).toFixed(2);
}

/** Format block chance from stored value */
function formatBlock(value: number): string {
  return (value / PERCENTAGE_TO_DECIMAL_DIVISOR).toFixed(0);
}
</script>

<style scoped>
.item-card {
  --item-card-bg: #0d0d14;
  --item-card-border: #3a3a4e;

  background-color: var(--item-card-bg);
  border-width: 2px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.item-card--hoverable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.item-card--selected {
  box-shadow: 0 0 0 2px var(--q-primary);
}

.item-card--highlighted {
  box-shadow: 0 0 8px 2px rgba(255, 255, 100, 0.3);
}

.item-card--corrupted {
  border-color: #d20000 !important;
}

.item-card__header {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
}

.item-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-card__icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-card__name {
  font-size: 0.95rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__base {
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__prop {
  font-size: 0.8rem;
  line-height: 1.4;
}

.item-card__socket {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.item-card__socket--r {
  background: radial-gradient(circle at 30% 30%, #ff6b6b, #8b0000);
}

.item-card__socket--g {
  background: radial-gradient(circle at 30% 30%, #6bff6b, #006400);
}

.item-card__socket--b {
  background: radial-gradient(circle at 30% 30%, #6b6bff, #00008b);
}

.item-card__socket--w {
  background: radial-gradient(circle at 30% 30%, #ffffff, #888888);
}

.item-card__socket--a {
  background: radial-gradient(circle at 30% 30%, #444444, #000000);
  border-color: #666;
}

.item-card__socket-link {
  color: #666;
  font-weight: bold;
  margin: 0 -2px;
}

.item-card__mod {
  font-size: 0.8rem;
  line-height: 1.4;
}

.item-card__mod--implicit {
  color: #88ccff;
}

.item-card__mod--explicit {
  color: #88ffff;
}

.item-card__mod--crafted {
  color: #aaddff;
  font-style: italic;
}

.item-card__mod--enchant {
  color: #aaddff;
}
</style>
