<template>
  <div ref="containerRef" class="passive-tree-canvas">
    <canvas ref="canvasRef" class="passive-tree-canvas__canvas" />

    <!-- Dev mode FPS counter -->
    <div v-if="showFps && ready" class="passive-tree-canvas__fps">
      {{ fps }} FPS | {{ rendererType.toUpperCase() }}
    </div>

    <!-- Loading state -->
    <div v-if="!ready && !error" class="passive-tree-canvas__loading">
      <q-spinner-dots size="40px" color="primary" />
      <div class="q-mt-sm">Initializing renderer...</div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="passive-tree-canvas__error">
      <q-icon name="error" size="40px" color="negative" />
      <div class="q-mt-sm">Failed to initialize renderer</div>
      <div class="text-caption text-grey">{{ error.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, onMounted, onUnmounted, watch } from 'vue';
import { usePixiApp, type TreeLayers } from 'src/composables/usePixiApp';

/** Check if we're in development mode */
const isDev = process.env.NODE_ENV === 'development';

const props = defineProps<{
  /** Whether to show FPS counter (only in dev mode) */
  showFps?: boolean;
}>();

const emit = defineEmits<{
  /** Emitted when the canvas is ready */
  ready: [layers: TreeLayers];
  /** Emitted on resize */
  resize: [width: number, height: number];
  /** Emitted on error */
  error: [error: Error];
}>();

// Template refs
const containerRef = shallowRef<HTMLDivElement | null>(null);
const canvasRef = shallowRef<HTMLCanvasElement | null>(null);

// PixiJS composable
const { ready, error, rendererType, fps, layers, init, resize } = usePixiApp();

// Show FPS only in dev mode when prop is true
const showFps = isDev && (props.showFps ?? true);

// ResizeObserver for responsive sizing
let resizeObserver: ResizeObserver | null = null;

/**
 * Handle container resize.
 * Uses the container's client dimensions to resize the canvas.
 */
function handleResize(): void {
  if (!containerRef.value || !ready.value) return;

  const { clientWidth, clientHeight } = containerRef.value;
  if (clientWidth > 0 && clientHeight > 0) {
    resize(clientWidth, clientHeight);
    emit('resize', clientWidth, clientHeight);
  }
}

onMounted(async () => {
  if (!canvasRef.value || !containerRef.value) {
    console.error('[PassiveTreeCanvas] Canvas or container ref not available');
    return;
  }

  // Initialize PixiJS
  await init(canvasRef.value);

  // Setup resize observer
  resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

// Watch for ready state to emit event
watch(ready, (isReady) => {
  if (isReady && layers.value) {
    emit('ready', layers.value);
  }
});

// Watch for error to emit event
watch(error, (err) => {
  if (err) {
    emit('error', err);
  }
});

// Expose for parent component access
defineExpose({
  ready,
  error,
  rendererType,
  fps,
  layers,
});
</script>

<style scoped>
.passive-tree-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
  background-color: #1a1a2e;
}

.passive-tree-canvas__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.passive-tree-canvas__fps {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #4ade80;
  font-family: monospace;
  font-size: 12px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}

.passive-tree-canvas__loading,
.passive-tree-canvas__error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #9ca3af;
}

.passive-tree-canvas__error {
  color: #ef4444;
}
</style>
