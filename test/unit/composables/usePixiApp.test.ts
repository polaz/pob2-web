/**
 * Unit tests for usePixiApp composable.
 *
 * Tests the PixiJS Application wrapper composable. Since PixiJS requires
 * a real WebGL/WebGPU context which isn't available in Node.js test environment,
 * we focus on testing the composable's API structure and state management.
 *
 * Integration testing with actual PixiJS rendering should be done in E2E tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

// Mock PixiJS before importing the composable
vi.mock('pixi.js', () => {
  const MockContainer = vi.fn().mockImplementation(() => ({
    label: '',
    addChild: vi.fn(),
    removeChild: vi.fn(),
  }));

  const mockTicker = {
    add: vi.fn(),
    remove: vi.fn(),
  };

  const mockRenderer = {
    resize: vi.fn(),
    constructor: { name: 'WebGLRenderer' },
  };

  const mockStage = {
    addChild: vi.fn(),
    removeChild: vi.fn(),
    children: [],
  };

  const MockApplication = vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    ticker: mockTicker,
    renderer: mockRenderer,
    stage: mockStage,
  }));

  return {
    Application: MockApplication,
    Container: MockContainer,
  };
});

describe('usePixiApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct initial state', async () => {
    const { usePixiApp } = await import('src/composables/usePixiApp');

    let composableResult: ReturnType<typeof usePixiApp> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = usePixiApp();
        return () => h('div');
      },
    });

    mount(TestComponent);

    expect(composableResult).not.toBeNull();
    expect(composableResult!.ready.value).toBe(false);
    expect(composableResult!.error.value).toBeNull();
    expect(composableResult!.app.value).toBeNull();
    expect(composableResult!.rendererType.value).toBe('unknown');
    expect(composableResult!.fps.value).toBe(0);
    expect(composableResult!.layers.value).toBeNull();
  });

  it('should expose init, resize, and destroy functions', async () => {
    const { usePixiApp } = await import('src/composables/usePixiApp');

    let composableResult: ReturnType<typeof usePixiApp> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = usePixiApp();
        return () => h('div');
      },
    });

    mount(TestComponent);

    expect(typeof composableResult!.init).toBe('function');
    expect(typeof composableResult!.resize).toBe('function');
    expect(typeof composableResult!.destroy).toBe('function');
  });

  it('should not throw when resize called before init', async () => {
    const { usePixiApp } = await import('src/composables/usePixiApp');

    let composableResult: ReturnType<typeof usePixiApp> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = usePixiApp();
        return () => h('div');
      },
    });

    mount(TestComponent);

    // Should not throw when app not initialized
    expect(() => composableResult!.resize(800, 600)).not.toThrow();
  });

  it('should not throw when destroy called before init', async () => {
    const { usePixiApp } = await import('src/composables/usePixiApp');

    let composableResult: ReturnType<typeof usePixiApp> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = usePixiApp();
        return () => h('div');
      },
    });

    mount(TestComponent);

    // Should not throw when app not initialized
    expect(() => composableResult!.destroy()).not.toThrow();
  });
});

describe('usePixiApp types', () => {
  it('should export RendererType type', async () => {
    const { usePixiApp } = await import('src/composables/usePixiApp');

    let composableResult: ReturnType<typeof usePixiApp> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = usePixiApp();
        return () => h('div');
      },
    });

    mount(TestComponent);

    // rendererType should be one of the valid values
    const validTypes = ['webgpu', 'webgl2', 'webgl', 'canvas', 'unknown'];
    expect(validTypes).toContain(composableResult!.rendererType.value);
  });

  it('should export TreeLayers interface via layers ref', async () => {
    const { usePixiApp } = await import('src/composables/usePixiApp');

    let composableResult: ReturnType<typeof usePixiApp> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = usePixiApp();
        return () => h('div');
      },
    });

    mount(TestComponent);

    // layers should be null before init
    expect(composableResult!.layers.value).toBeNull();
  });
});

describe('TreeLayers type structure', () => {
  it('should have correct layer properties when defined', async () => {
    // This test verifies the interface structure through TypeScript
    // The actual values would be set after init() in a real environment
    const expectedLayers = ['background', 'connections', 'nodes', 'ui'];

    // Import the type for compile-time checking
    const mod = await import('src/composables/usePixiApp');
    type TreeLayers = NonNullable<ReturnType<typeof mod.usePixiApp>['layers']['value']>;

    // Type-level assertion: if this compiles, the interface has the right shape
    const mockLayers: TreeLayers = {
      background: {} as TreeLayers['background'],
      connections: {} as TreeLayers['connections'],
      nodes: {} as TreeLayers['nodes'],
      ui: {} as TreeLayers['ui'],
    };

    expect(Object.keys(mockLayers)).toEqual(expectedLayers);
  });
});
