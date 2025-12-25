// src/composables/usePixiApp.ts
// Composable for PixiJS 8 Application with WebGPU fallback

import { ref, shallowRef, onUnmounted } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import { Application, Container } from 'pixi.js';
import type { Ticker } from 'pixi.js';

/** Renderer type names for display */
export type RendererType = 'webgpu' | 'webgl2' | 'webgl' | 'canvas' | 'unknown';

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
    layers,
    init,
    resize,
    destroy,
  };
}
