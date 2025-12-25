<template>
  <div ref="containerRef" class="passive-tree-canvas relative full-width full-height overflow-hidden">
    <canvas ref="canvasRef" class="block full-width full-height" />

    <!-- Dev mode FPS counter with renderer info -->
    <div
      v-if="shouldShowFps && ready"
      class="passive-tree-canvas__fps absolute q-pa-xs text-caption"
      style="top: 8px; right: 8px"
    >
      <div>{{ fps }} FPS | {{ rendererType.toUpperCase() }} | {{ treeRenderer.nodeCount.value }} nodes</div>
      <div>Canvas: {{ canvasSize.width }}x{{ canvasSize.height }}</div>
      <div>Mouse: ({{ mouseTreeCoords.x.toFixed(1) }}, {{ mouseTreeCoords.y.toFixed(1) }})</div>
      <div>Viewport: ({{ treeStore.viewport.x.toFixed(1) }}, {{ treeStore.viewport.y.toFixed(1) }}) z={{ treeStore.viewport.zoom.toFixed(2) }}</div>
      <div>Expected VP: ({{ (canvasSize.width / 2).toFixed(0) }}, {{ (canvasSize.height / 2).toFixed(0) }})</div>
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
import { useTreeRenderer } from 'src/composables/useTreeRenderer';
import { useTreeStore } from 'src/stores/treeStore';

const props = withDefaults(
  defineProps<{
    /** Whether to show FPS counter (only in dev mode) */
    showFps?: boolean;
    /** Whether to enable node rendering */
    enableRendering?: boolean;
  }>(),
  {
    showFps: true,
    enableRendering: true,
  }
);

const emit = defineEmits<{
  /** Emitted when the canvas is ready */
  ready: [layers: TreeLayers];
  /** Emitted on resize */
  resize: [width: number, height: number];
  /** Emitted on error */
  error: [error: Error];
}>();

// Stores
const treeStore = useTreeStore();

// Template refs
const containerRef = shallowRef<HTMLDivElement | null>(null);
const canvasRef = shallowRef<HTMLCanvasElement | null>(null);

// PixiJS composable
const { ready, error, app, rendererType, fps, fallbackInfo, layers, init, resize } = usePixiApp();

// Tree renderer composable
const treeRenderer = useTreeRenderer();

// Pan/zoom state
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

// Track if user has manually panned (prevents auto-recentering on resize)
let userHasPanned = false;

// Debug: mouse position in tree coordinates
const mouseTreeCoords = shallowRef({ x: 0, y: 0 });

// Debug: canvas size (updated on resize, not computed since clientWidth isn't reactive)
const canvasSize = shallowRef({ width: 0, height: 0 });

// Show FPS only in dev mode when prop is true (reactive to prop changes)
const shouldShowFps = computed(() => import.meta.env.DEV && props.showFps);

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

// Throttle resize calls to 60fps (16ms) to prevent excessive updates during rapid resizing
const RESIZE_THROTTLE_MS = 16;
let lastResizeTime = 0;
let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Handle container resize with throttling.
 * Uses the container's client dimensions to resize the canvas.
 * Throttled to 60fps to prevent performance issues during rapid window resizing.
 */
function handleResize(): void {
  if (!containerRef.value || !ready.value) return;

  const now = performance.now();
  const elapsed = now - lastResizeTime;

  if (elapsed >= RESIZE_THROTTLE_MS) {
    // Enough time has passed, resize immediately
    performResize();
    lastResizeTime = now;
  } else if (!resizeTimeoutId) {
    // Schedule resize for later to ensure final size is captured
    resizeTimeoutId = setTimeout(() => {
      resizeTimeoutId = null;
      performResize();
      lastResizeTime = performance.now();
    }, RESIZE_THROTTLE_MS - elapsed);
  }
}

/**
 * Perform the actual resize operation.
 * Uses getBoundingClientRect for accurate visible dimensions.
 */
function performResize(): void {
  if (!canvasRef.value || !ready.value) return;

  // Use getBoundingClientRect for accurate visible dimensions
  const rect = canvasRef.value.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (width > 0 && height > 0) {
    resize(width, height);
    emit('resize', width, height);

    // Update debug canvas size
    canvasSize.value = { width, height };

    // Center viewport if nodes are rendered and user hasn't manually panned
    // This handles both initial centering and re-centering after layout settles
    if (treeRenderer.nodeCount.value > 0 && !userHasPanned) {
      treeRenderer.centerViewport(width, height);
    }
  }
}

// ============================================================================
// Pan/Zoom Handlers
// ============================================================================

/** Zoom sensitivity multiplier */
const ZOOM_SENSITIVITY = 0.001;

/**
 * Handle pointer down for pan start.
 */
function handlePointerDown(event: PointerEvent): void {
  if (event.button !== 0) return; // Only left mouse button

  isDragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  treeStore.setDragging(true);

  // Capture pointer for smooth dragging outside canvas
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
}

/**
 * Handle pointer move for panning and coordinate tracking.
 */
function handlePointerMove(event: PointerEvent): void {
  // Update mouse tree coordinates for debug display
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    // Convert screen coords to tree coords: tree = (screen - viewport) / zoom
    const { x: vpX, y: vpY, zoom } = treeStore.viewport;
    mouseTreeCoords.value = {
      x: (screenX - vpX) / zoom,
      y: (screenY - vpY) / zoom,
    };
  }

  if (!isDragging) return;

  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;

  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  // Mark that user has manually panned (prevents auto-recentering on resize)
  if (dx !== 0 || dy !== 0) {
    userHasPanned = true;
  }

  // Pan viewport
  treeStore.panViewport(dx, dy);
}

/**
 * Handle pointer up for pan end.
 */
function handlePointerUp(event: PointerEvent): void {
  if (!isDragging) return;

  isDragging = false;
  treeStore.setDragging(false);

  // Release pointer capture
  (event.target as HTMLElement).releasePointerCapture(event.pointerId);
}

/**
 * Handle wheel for zooming.
 */
function handleWheel(event: WheelEvent): void {
  event.preventDefault();

  if (!containerRef.value) return;

  // Get mouse position relative to canvas
  const rect = containerRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Calculate zoom delta
  const zoomDelta = -event.deltaY * ZOOM_SENSITIVITY;

  // Zoom at mouse position
  treeStore.zoomViewportAt(x, y, zoomDelta);
}

/**
 * Setup canvas event listeners.
 */
function setupEventListeners(): void {
  if (!canvasRef.value) return;

  canvasRef.value.addEventListener('pointerdown', handlePointerDown);
  canvasRef.value.addEventListener('pointermove', handlePointerMove);
  canvasRef.value.addEventListener('pointerup', handlePointerUp);
  canvasRef.value.addEventListener('pointercancel', handlePointerUp);
  canvasRef.value.addEventListener('wheel', handleWheel, { passive: false });
}

/**
 * Remove canvas event listeners.
 */
function removeEventListeners(): void {
  if (!canvasRef.value) return;

  canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
  canvasRef.value.removeEventListener('pointermove', handlePointerMove);
  canvasRef.value.removeEventListener('pointerup', handlePointerUp);
  canvasRef.value.removeEventListener('pointercancel', handlePointerUp);
  canvasRef.value.removeEventListener('wheel', handleWheel);
}

onMounted(async () => {
  if (!canvasRef.value || !containerRef.value) {
    console.error('[PassiveTreeCanvas] Canvas or container ref not available');
    return;
  }

  // Initialize PixiJS
  await init(canvasRef.value);

  // Perform initial resize - ResizeObserver may not trigger if container already settled
  if (ready.value) {
    performResize();
  }

  // Initialize tree renderer if enabled
  if (props.enableRendering && ready.value && app.value && layers.value) {
    treeRenderer.initialize(app.value, layers.value);
  }

  // Setup event listeners for pan/zoom
  setupEventListeners();

  // Setup resize observer for subsequent resizes
  resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  // Clear any pending throttled resize
  if (resizeTimeoutId) {
    clearTimeout(resizeTimeoutId);
    resizeTimeoutId = null;
  }

  // Remove event listeners
  removeEventListeners();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Destroy tree renderer
  treeRenderer.destroy();
});

// Watch for ready state to emit event and initialize renderer
watch(ready, (isReady) => {
  if (isReady && layers.value) {
    emit('ready', layers.value);

    // Initialize tree renderer if not already initialized
    if (props.enableRendering && app.value && !treeRenderer.isInitialized.value) {
      treeRenderer.initialize(app.value, layers.value);
    }
  }
});

// Watch for error to emit event
watch(error, (err) => {
  if (err) {
    emit('error', err);
  }
});

// Watch for nodes to be rendered and center viewport
watch(
  () => treeRenderer.nodeCount.value,
  (count) => {
    if (count > 0 && !userHasPanned && canvasRef.value) {
      const rect = canvasRef.value.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        treeRenderer.centerViewport(Math.round(rect.width), Math.round(rect.height));
      }
    }
  }
);

// Expose for parent component access
defineExpose({
  ready,
  error,
  rendererType,
  fps,
  fallbackInfo,
  layers,
  treeRenderer,
});
</script>

<style scoped>
/*
 * CSS custom properties for passive tree canvas theming.
 * These match the PoE2 visual style and can be overridden by parent components.
 */
.passive-tree-canvas {
  /* Canvas background - matches PixiJS CANVAS_BACKGROUND_COLOR */
  --tree-canvas-bg: #1a1a2e;
  /* FPS counter styling */
  --tree-fps-bg: rgba(0, 0, 0, 0.7);
  --tree-fps-color: #4ade80;
  /* Minimum height for canvas container */
  --tree-canvas-min-height: 200px;

  min-height: var(--tree-canvas-min-height);
  background-color: var(--tree-canvas-bg);
}

/* FPS counter visual styling - positioning via inline style */
.passive-tree-canvas__fps {
  background-color: var(--tree-fps-bg);
  color: var(--tree-fps-color);
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
