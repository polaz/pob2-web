// src/composables/usePixiApp.ts
// Composable for PixiJS 8 Application with WebGPU fallback

import { ref, shallowRef, onUnmounted } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import { Application, Container } from 'pixi.js';
import type { Ticker } from 'pixi.js';

/** Renderer type names for display */
export type RendererType = 'webgpu' | 'webgl2' | 'webgl' | 'canvas' | 'unknown';

/** Fallback reason when preferred renderer is not available */
export interface FallbackInfo {
  /** The preferred renderer that was requested */
  preferred: RendererType;
  /** The actual renderer that was used */
  actual: RendererType;
  /** Reason why WebGPU is not available (if applicable) */
  webgpuReason?: string;
  /** Reason why WebGL2 is not available (if applicable) */
  webgl2Reason?: string;
  /** Reason why WebGL is not available (if applicable) */
  webglReason?: string;
}

/** Container hierarchy for tree rendering layers */
export interface TreeLayers {
  /** Background layer (grid, background image) */
  background: Container;
  /** Connection layer (lines between nodes) */
  connections: Container;
  /** Node layer (passive tree nodes) */
  nodes: Container;
  /** UI overlay layer (hover effects, selection) */
  ui: Container;
}

/** Result of usePixiApp composable */
export interface UsePixiAppResult {
  /** Whether the app is ready to use */
  readonly ready: Ref<boolean>;
  /** Error during initialization (if any) */
  readonly error: ShallowRef<Error | null>;
  /** The PixiJS Application instance */
  readonly app: ShallowRef<Application | null>;
  /** Current renderer type */
  readonly rendererType: Ref<RendererType>;
  /** Current FPS (updated each frame, dev mode only) */
  readonly fps: Ref<number>;
  /** Fallback info showing why preferred renderer wasn't used (dev mode only) */
  readonly fallbackInfo: ShallowRef<FallbackInfo | null>;
  /** Tree rendering layers */
  readonly layers: ShallowRef<TreeLayers | null>;
  /** Initialize the application */
  init: (canvas: HTMLCanvasElement) => Promise<void>;
  /** Resize the application */
  resize: (width: number, height: number) => void;
  /** Destroy the application */
  destroy: () => void;
}

/** Check if we're in development mode */
const isDev = import.meta.env.DEV;

/** FPS update interval in milliseconds */
const FPS_UPDATE_INTERVAL_MS = 500;

/**
 * Detect renderer availability and reasons for unavailability.
 * Returns detailed info about what's available and why fallbacks might occur.
 */
function detectRendererAvailability(): {
  webgpuAvailable: boolean;
  webgpuReason?: string;
  webgl2Available: boolean;
  webgl2Reason?: string;
  webglAvailable: boolean;
  webglReason?: string;
} {
  const result: ReturnType<typeof detectRendererAvailability> = {
    webgpuAvailable: false,
    webgl2Available: false,
    webglAvailable: false,
  };

  // Check WebGPU availability
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    result.webgpuAvailable = true;
  } else {
    result.webgpuReason = 'navigator.gpu not available (browser does not support WebGPU)';
  }

  // Check WebGL2 availability
  try {
    const testCanvas = document.createElement('canvas');
    const gl2 = testCanvas.getContext('webgl2');
    if (gl2) {
      result.webgl2Available = true;
    } else {
      result.webgl2Reason = 'WebGL2 context creation failed';
    }
  } catch (e) {
    result.webgl2Reason = `WebGL2 error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Check WebGL availability
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (gl) {
      result.webglAvailable = true;
    } else {
      result.webglReason = 'WebGL context creation failed';
    }
  } catch (e) {
    result.webglReason = `WebGL error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return result;
}

/**
 * Detect the renderer type from a PixiJS Application.
 */
function detectRendererType(app: Application): RendererType {
  const renderer = app.renderer;
  // PixiJS 8 uses renderer.name or we can check the constructor name
  const name = renderer.constructor.name.toLowerCase();

  if (name.includes('webgpu')) return 'webgpu';
  if (name.includes('webgl2') || name.includes('gl2')) return 'webgl2';
  if (name.includes('webgl') || name.includes('gl')) return 'webgl';
  if (name.includes('canvas')) return 'canvas';
  return 'unknown';
}

/**
 * Create tree rendering layers in the correct z-order.
 * Layers are added to the stage from bottom to top.
 */
function createTreeLayers(stage: Container): TreeLayers {
  const background = new Container();
  background.label = 'background';

  const connections = new Container();
  connections.label = 'connections';

  const nodes = new Container();
  nodes.label = 'nodes';

  const ui = new Container();
  ui.label = 'ui';

  // Add in z-order (first added = bottom)
  stage.addChild(background);
  stage.addChild(connections);
  stage.addChild(nodes);
  stage.addChild(ui);

  return { background, connections, nodes, ui };
}

/**
 * Composable for PixiJS Application with WebGPU fallback.
 *
 * Creates a PixiJS 8 Application with WebGPU as preferred renderer,
 * falling back to WebGL2 → WebGL → Canvas as needed.
 *
 * @example
 * ```typescript
 * const { ready, app, layers, init, resize, destroy } = usePixiApp();
 *
 * onMounted(async () => {
 *   await init(canvasRef.value);
 *   // App is ready, layers are available
 * });
 *
 * onUnmounted(() => {
 *   destroy();
 * });
 * ```
 */
export function usePixiApp(): UsePixiAppResult {
  const ready = ref(false);
  const error = shallowRef<Error | null>(null);
  const app = shallowRef<Application | null>(null);
  const rendererType = ref<RendererType>('unknown');
  const fps = ref(0);
  const fallbackInfo = shallowRef<FallbackInfo | null>(null);
  const layers = shallowRef<TreeLayers | null>(null);

  let lastFpsUpdateTime = 0;
  let frameCount = 0;
  let fpsTickerCallback: ((ticker: Ticker) => void) | null = null;

  /**
   * Initialize the PixiJS Application.
   *
   * @param canvas - The canvas element to render to
   */
  async function init(canvas: HTMLCanvasElement): Promise<void> {
    if (app.value) {
      console.warn('[usePixiApp] Already initialized');
      return;
    }

    try {
      const pixiApp = new Application();

      // Note: resizeTo is intentionally not set here.
      // Resize is handled manually by the component via ResizeObserver
      // to avoid conflicts and give more control over resize behavior.
      await pixiApp.init({
        canvas,
        preference: 'webgpu',
        powerPreference: 'high-performance',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x1a1a2e,
      });

      app.value = pixiApp;
      rendererType.value = detectRendererType(pixiApp);
      layers.value = createTreeLayers(pixiApp.stage);

      // Build fallback info in dev mode
      if (isDev) {
        const availability = detectRendererAvailability();
        const info: FallbackInfo = {
          preferred: 'webgpu',
          actual: rendererType.value,
        };

        // Add reasons for unavailable renderers
        if (!availability.webgpuAvailable && availability.webgpuReason) {
          info.webgpuReason = availability.webgpuReason;
        }
        if (!availability.webgl2Available && availability.webgl2Reason) {
          info.webgl2Reason = availability.webgl2Reason;
        }
        if (!availability.webglAvailable && availability.webglReason) {
          info.webglReason = availability.webglReason;
        }

        fallbackInfo.value = info;
      }

      // Setup FPS monitoring in dev mode
      if (isDev) {
        lastFpsUpdateTime = performance.now();
        frameCount = 0;

        fpsTickerCallback = () => {
          frameCount++;
          const now = performance.now();
          const elapsed = now - lastFpsUpdateTime;

          if (elapsed >= FPS_UPDATE_INTERVAL_MS) {
            fps.value = Math.round((frameCount * 1000) / elapsed);
            frameCount = 0;
            lastFpsUpdateTime = now;
          }
        };
        pixiApp.ticker.add(fpsTickerCallback);
      }

      ready.value = true;

      if (isDev) {
        console.log(`[usePixiApp] Initialized with ${rendererType.value} renderer`);
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      console.error('[usePixiApp] Initialization failed:', e);
    }
  }

  /**
   * Resize the application to the given dimensions.
   *
   * @param width - New width in CSS pixels
   * @param height - New height in CSS pixels
   */
  function resize(width: number, height: number): void {
    if (!app.value) return;

    app.value.renderer.resize(width, height);
  }

  /**
   * Destroy the application and clean up resources.
   */
  function destroy(): void {
    // Explicitly remove FPS ticker callback before destroying app
    if (fpsTickerCallback && app.value) {
      app.value.ticker.remove(fpsTickerCallback);
      fpsTickerCallback = null;
    }

    if (app.value) {
      app.value.destroy(true, { children: true, texture: true });
      app.value = null;
    }

    layers.value = null;
    ready.value = false;
    rendererType.value = 'unknown';
    fps.value = 0;
    fallbackInfo.value = null;
  }

  // Clean up on unmount
  onUnmounted(() => {
    destroy();
  });

  return {
    ready,
    error,
    app,
    rendererType,
    fps,
    fallbackInfo,
    layers,
    init,
    resize,
    destroy,
  };
}
