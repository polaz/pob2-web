<template>
  <q-page class="overflow-hidden">
    <PassiveTreeCanvas
      :show-fps="true"
      @ready="onCanvasReady"
      @resize="onCanvasResize"
      @error="onCanvasError"
    />
  </q-page>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import PassiveTreeCanvas from 'src/components/tree/PassiveTreeCanvas.vue';
import type { TreeLayers } from 'src/composables/usePixiApp';

/**
 * Stores reference to canvas layers for future tree rendering operations.
 * Will be used for node rendering, connections, and UI overlays.
 */
const canvasLayers = shallowRef<TreeLayers | null>(null);

function onCanvasReady(layers: TreeLayers): void {
  canvasLayers.value = layers;
  if (import.meta.env.DEV) {
    console.log('[TreePage] Canvas ready with layers:', Object.keys(layers));
  }
}

function onCanvasResize(width: number, height: number): void {
  if (import.meta.env.DEV) {
    console.log(`[TreePage] Canvas resized to ${width}x${height}`);
  }
}

function onCanvasError(error: Error): void {
  if (import.meta.env.DEV) {
    console.error('[TreePage] Canvas error:', error);
  }
}

// Expose canvas layers for parent component or testing access
defineExpose({
  canvasLayers,
});
</script>
