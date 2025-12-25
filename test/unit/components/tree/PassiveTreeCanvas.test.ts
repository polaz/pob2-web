/**
 * Unit tests for PassiveTreeCanvas component.
 *
 * Tests focus on component structure, props, and emits since full rendering
 * tests require WebGL/WebGPU context (covered in E2E tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, shallowRef } from 'vue';
import { Quasar, QSpinnerDots, QIcon } from 'quasar';

// Create mock refs that persist across tests
const mockReady = ref(false);
const mockError = shallowRef<Error | null>(null);
const mockRendererType = ref('unknown');
const mockFps = ref(0);
const mockFallbackInfo = shallowRef(null);
const mockLayers = shallowRef(null);
const mockInit = vi.fn().mockResolvedValue(undefined);
const mockResize = vi.fn();
const mockDestroy = vi.fn();

// Mock the usePixiApp composable with proper Vue refs
vi.mock('src/composables/usePixiApp', () => ({
  usePixiApp: () => ({
    ready: mockReady,
    error: mockError,
    rendererType: mockRendererType,
    fps: mockFps,
    fallbackInfo: mockFallbackInfo,
    layers: mockLayers,
    init: mockInit,
    resize: mockResize,
    destroy: mockDestroy,
  }),
}));

// Import component after mock is set up
import PassiveTreeCanvas from 'src/components/tree/PassiveTreeCanvas.vue';

/** Type for the component's exposed properties via defineExpose */
interface PassiveTreeCanvasExposed {
  ready: (typeof mockReady)['value'];
  error: (typeof mockError)['value'];
  rendererType: (typeof mockRendererType)['value'];
  fps: (typeof mockFps)['value'];
  fallbackInfo: (typeof mockFallbackInfo)['value'];
  layers: (typeof mockLayers)['value'];
}

describe('PassiveTreeCanvas', () => {
  let wrapper: ReturnType<typeof mount<typeof PassiveTreeCanvas>>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    mockReady.value = false;
    mockError.value = null;
    mockRendererType.value = 'unknown';
    mockFps.value = 0;
    mockFallbackInfo.value = null;
    mockLayers.value = null;
  });

  function mountComponent(props = {}) {
    return mount(PassiveTreeCanvas, {
      props,
      global: {
        plugins: [[Quasar, {}]],
        components: { QSpinnerDots, QIcon },
      },
    });
  }

  describe('component structure', () => {
    it('should mount without error', () => {
      wrapper = mountComponent();
      expect(wrapper.exists()).toBe(true);
    });

    it('should have a container div with correct classes', () => {
      wrapper = mountComponent();
      const container = wrapper.find('.passive-tree-canvas');
      expect(container.exists()).toBe(true);
      expect(container.classes()).toContain('relative');
      expect(container.classes()).toContain('full-width');
      expect(container.classes()).toContain('full-height');
      expect(container.classes()).toContain('overflow-hidden');
    });

    it('should have a canvas element', () => {
      wrapper = mountComponent();
      const canvas = wrapper.find('canvas');
      expect(canvas.exists()).toBe(true);
      expect(canvas.classes()).toContain('block');
      expect(canvas.classes()).toContain('full-width');
      expect(canvas.classes()).toContain('full-height');
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when not ready and no error', () => {
      wrapper = mountComponent();
      const spinner = wrapper.findComponent(QSpinnerDots);
      expect(spinner.exists()).toBe(true);
    });

    it('should show loading message', () => {
      wrapper = mountComponent();
      expect(wrapper.text()).toContain('Initializing renderer...');
    });
  });

  describe('error state', () => {
    it('should show error message when error occurs', async () => {
      mockError.value = new Error('WebGL not supported');
      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Failed to initialize renderer');
      expect(wrapper.text()).toContain('WebGL not supported');
    });

    it('should show error icon when error occurs', async () => {
      mockError.value = new Error('Test error');
      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      const icon = wrapper.findComponent(QIcon);
      expect(icon.exists()).toBe(true);
    });
  });

  describe('props', () => {
    it('should accept showFps prop as true', () => {
      wrapper = mountComponent({ showFps: true });
      expect((wrapper.props() as { showFps?: boolean }).showFps).toBe(true);
    });

    it('should accept showFps prop as false', () => {
      wrapper = mountComponent({ showFps: false });
      expect((wrapper.props() as { showFps?: boolean }).showFps).toBe(false);
    });
  });

  describe('ready state', () => {
    it('should hide loading when ready', async () => {
      wrapper = mountComponent();
      expect(wrapper.findComponent(QSpinnerDots).exists()).toBe(true);

      mockReady.value = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.findComponent(QSpinnerDots).exists()).toBe(false);
    });

    it('should show FPS counter when ready in dev mode', async () => {
      mockReady.value = true;
      mockRendererType.value = 'webgl';
      mockFps.value = 60;
      wrapper = mountComponent({ showFps: true });
      await wrapper.vm.$nextTick();

      const fpsCounter = wrapper.find('.passive-tree-canvas__fps');
      expect(fpsCounter.exists()).toBe(true);
      expect(fpsCounter.text()).toContain('60 FPS');
      expect(fpsCounter.text()).toContain('WEBGL');
    });
  });

  describe('exposed properties', () => {
    /**
     * Helper to get typed exposed properties from wrapper.
     * Vue Test Utils doesn't provide type inference for defineExpose,
     * so we cast through unknown for type safety.
     */
    function getExposed(): PassiveTreeCanvasExposed {
      return wrapper.vm as unknown as PassiveTreeCanvasExposed;
    }

    it('should expose ready ref', () => {
      wrapper = mountComponent();
      expect(getExposed().ready).toBeDefined();
    });

    it('should expose error ref', () => {
      wrapper = mountComponent();
      expect(getExposed().error).toBeDefined();
    });

    it('should expose rendererType ref', () => {
      wrapper = mountComponent();
      expect(getExposed().rendererType).toBeDefined();
    });

    it('should expose fps ref', () => {
      wrapper = mountComponent();
      expect(getExposed().fps).toBeDefined();
    });

    it('should expose fallbackInfo ref', () => {
      wrapper = mountComponent();
      expect(getExposed().fallbackInfo).toBeDefined();
    });

    it('should expose layers ref', () => {
      wrapper = mountComponent();
      expect(getExposed().layers).toBeDefined();
    });
  });

  describe('initialization', () => {
    it('should call init on mount', async () => {
      wrapper = mountComponent();
      // Wait for onMounted to complete
      await wrapper.vm.$nextTick();

      expect(mockInit).toHaveBeenCalled();
    });
  });
});
