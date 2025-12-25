<template>
  <div class="tree-page">
    <PassiveTreeCanvas
      :show-fps="true"
      @ready="onCanvasReady"
      @resize="onCanvasResize"
      @error="onCanvasError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PassiveTreeCanvas from 'src/components/tree/PassiveTreeCanvas.vue';
import type { TreeLayers } from 'src/composables/usePixiApp';

// Track canvas state for future use
const canvasLayers = ref<TreeLayers | null>(null);

function onCanvasReady(layers: TreeLayers): void {
  canvasLayers.value = layers;
  console.log('[TreePage] Canvas ready with layers:', Object.keys(layers));
}

function onCanvasResize(width: number, height: number): void {
  console.log(`[TreePage] Canvas resized to ${width}x${height}`);
}

function onCanvasError(error: Error): void {
  console.error('[TreePage] Canvas error:', error);
}
</script>

<style scoped>
.tree-page {
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
}
</style>
