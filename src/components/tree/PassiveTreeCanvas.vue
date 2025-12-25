<template>
  <div ref="containerRef" class="passive-tree-canvas relative full-width full-height overflow-hidden">
    <canvas ref="canvasRef" class="block full-width full-height" />

    <!-- Dev mode FPS counter with renderer info -->
    <div
      v-if="shouldShowFps && ready"
      class="passive-tree-canvas__fps absolute q-pa-xs text-caption"
      style="top: 8px; right: 8px"
    >
      <div>{{ fps }} FPS | {{ rendererType.toUpperCase() }}</div>
      <div v-if="fallbackReason" class="passive-tree-canvas__fallback text-orange-4">
        {{ fallbackReason }}
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="!ready && !error" class="absolute-center column items-center text-center text-grey-6">
      <q-spinner-dots size="40px" color="primary" />
      <div class="q-mt-sm">Initializing renderer...</div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="absolute-center column items-center text-center text-negative">
      <q-icon name="error" size="40px" color="negative" />
      <div class="q-mt-sm">Failed to initialize renderer</div>
      <div class="text-caption text-grey">{{ error.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, computed, onMounted, onUnmounted, watch } from 'vue';
import { usePixiApp, type TreeLayers } from 'src/composables/usePixiApp';

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
const { ready, error, rendererType, fps, fallbackInfo, layers, init, resize } = usePixiApp();

// Show FPS only in dev mode when prop is true (reactive to prop changes)
const shouldShowFps = computed(() => import.meta.env.DEV && (props.showFps ?? true));

// Compute fallback reason message for display
const fallbackReason = computed(() => {
  if (!fallbackInfo.value) return null;

  const info = fallbackInfo.value;
  // If we got the preferred renderer, no fallback occurred
  if (info.actual === info.preferred) return null;

  // Build a message explaining why we fell back
  const reasons: string[] = [];

  if (info.webgpuReason && info.actual !== 'webgpu') {
    reasons.push(`WebGPU: ${info.webgpuReason}`);
  }
  if (info.webgl2Reason && info.actual !== 'webgl2' && info.actual !== 'webgpu') {
    reasons.push(`WebGL2: ${info.webgl2Reason}`);
  }
  if (info.webglReason && info.actual === 'canvas') {
    reasons.push(`WebGL: ${info.webglReason}`);
  }

  return reasons.length > 0 ? reasons.join(' | ') : null;
});

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
  fallbackInfo,
  layers,
});
</script>

<style scoped>
.passive-tree-canvas {
  min-height: 200px;
  background-color: #1a1a2e;
}

/* FPS counter visual styling - positioning via inline style */
.passive-tree-canvas__fps {
  background-color: rgba(0, 0, 0, 0.7);
  color: #4ade80;
  font-family: monospace;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
  max-width: 400px;
}

/* Fallback reason text - smaller and orange */
.passive-tree-canvas__fallback {
  font-size: 10px;
  margin-top: 2px;
  opacity: 0.9;
}
</style>
