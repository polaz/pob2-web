/**
 * Unit tests for uiStore.
 *
 * Tests notification lifecycle, theme management, modal state,
 * and preferences persistence.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from 'src/stores/uiStore';

// Mock the database module
vi.mock('src/db', () => ({
  getUserPreferences: vi.fn().mockResolvedValue({
    theme: 'dark',
    language: 'en-US',
    showTooltips: true,
    keyboardShortcutsEnabled: true,
  }),
  updateUserPreferences: vi.fn().mockResolvedValue(undefined),
}));

// Mock matchMedia for system theme detection
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });

describe('uiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have default theme', () => {
      const store = useUiStore();

      expect(store.theme).toBe('dark');
      expect(store.effectiveTheme).toBe('dark');
      expect(store.isDarkTheme).toBe(true);
    });

    it('should have no open modal', () => {
      const store = useUiStore();

      expect(store.openModal).toBeNull();
      expect(store.hasOpenModal).toBe(false);
    });

    it('should have no notifications', () => {
      const store = useUiStore();

      expect(store.notifications).toEqual([]);
      expect(store.hasNotifications).toBe(false);
      expect(store.notificationCount).toBe(0);
    });
  });

  describe('theme management', () => {
    it('should set theme', () => {
      const store = useUiStore();

      store.setTheme('light');

      expect(store.theme).toBe('light');
      expect(store.effectiveTheme).toBe('light');
      expect(store.isDarkTheme).toBe(false);
    });

    it('should toggle theme', () => {
      const store = useUiStore();

      store.toggleTheme();

      expect(store.theme).toBe('light');

      store.toggleTheme();

      expect(store.theme).toBe('dark');
    });

    it('should resolve system theme', () => {
      const store = useUiStore();

      store.setTheme('system');

      // matchMedia is mocked to return dark
      expect(store.effectiveTheme).toBe('dark');
    });
  });

  describe('language', () => {
    it('should set language', () => {
      const store = useUiStore();

      store.setLanguage('ru-RU');

      expect(store.language).toBe('ru-RU');
    });
  });

  describe('sidebar', () => {
    it('should toggle sidebar', () => {
      const store = useUiStore();

      expect(store.isSidebarCollapsed).toBe(false);

      store.toggleSidebar();
      expect(store.isSidebarCollapsed).toBe(true);

      store.toggleSidebar();
      expect(store.isSidebarCollapsed).toBe(false);
    });

    it('should set sidebar state directly', () => {
      const store = useUiStore();

      store.setSidebarCollapsed(true);
      expect(store.isSidebarCollapsed).toBe(true);

      store.setSidebarCollapsed(false);
      expect(store.isSidebarCollapsed).toBe(false);
    });
  });

  describe('loading state', () => {
    it('should show loading', () => {
      const store = useUiStore();

      store.showLoading('Loading builds...');

      expect(store.isLoading).toBe(true);
      expect(store.loadingMessage).toBe('Loading builds...');
    });

    it('should show loading without message', () => {
      const store = useUiStore();

      store.showLoading();

      expect(store.isLoading).toBe(true);
      expect(store.loadingMessage).toBeNull();
    });

    it('should hide loading', () => {
      const store = useUiStore();
      store.showLoading('Loading...');

      store.hideLoading();

      expect(store.isLoading).toBe(false);
      expect(store.loadingMessage).toBeNull();
    });
  });

  describe('modal management', () => {
    it('should show modal', () => {
      const store = useUiStore();

      store.showModal('settings');

      expect(store.openModal).toBe('settings');
      expect(store.hasOpenModal).toBe(true);
    });

    it('should show modal with data', () => {
      const store = useUiStore();

      store.showModal('confirm', { message: 'Are you sure?' });

      expect(store.openModal).toBe('confirm');
      expect(store.modalData).toEqual({ message: 'Are you sure?' });
    });

    it('should close modal', () => {
      const store = useUiStore();
      store.showModal('settings', { key: 'value' });

      store.closeModal();

      expect(store.openModal).toBeNull();
      expect(store.modalData).toBeNull();
      expect(store.hasOpenModal).toBe(false);
    });
  });

  describe('notifications', () => {
    it('should add notification and return ID', () => {
      const store = useUiStore();

      const id = store.notify('success', 'Build saved!');

      expect(id).toBeDefined();
      expect(store.notifications).toHaveLength(1);
      expect(store.notifications[0]?.type).toBe('success');
      expect(store.notifications[0]?.message).toBe('Build saved!');
      expect(store.hasNotifications).toBe(true);
    });

    it('should auto-dismiss notification after timeout', () => {
      const store = useUiStore();

      store.notify('info', 'Auto dismiss', 3000);

      expect(store.notifications).toHaveLength(1);

      // Advance time past timeout
      vi.advanceTimersByTime(3500);

      expect(store.notifications).toHaveLength(0);
    });

    it('should not auto-dismiss with timeout 0', () => {
      const store = useUiStore();

      store.notify('error', 'Persistent error', 0);

      vi.advanceTimersByTime(10000);

      expect(store.notifications).toHaveLength(1);
    });

    it('should dismiss notification manually', () => {
      const store = useUiStore();
      const id = store.notify('warning', 'Warning!', 0);

      store.dismissNotification(id);

      expect(store.notifications).toHaveLength(0);
    });

    it('should clear timeout when dismissing manually', () => {
      const store = useUiStore();
      const id = store.notify('info', 'Test', 5000);

      store.dismissNotification(id);

      // Advance time - should not cause issues since timeout was cleared
      vi.advanceTimersByTime(6000);

      expect(store.notifications).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      const store = useUiStore();

      store.notify('info', 'One', 5000);
      store.notify('success', 'Two', 5000);
      store.notify('warning', 'Three', 5000);

      expect(store.notifications).toHaveLength(3);

      store.clearNotifications();

      expect(store.notifications).toHaveLength(0);
      expect(store.notificationCount).toBe(0);
    });

    it('should clear all timeouts when clearing notifications', () => {
      const store = useUiStore();

      store.notify('info', 'One', 5000);
      store.notify('info', 'Two', 5000);

      store.clearNotifications();

      // Advance time - should not cause issues
      vi.advanceTimersByTime(10000);

      expect(store.notifications).toHaveLength(0);
    });

    it('should handle dismissing non-existent notification', () => {
      const store = useUiStore();

      // Should not throw
      store.dismissNotification('non-existent-id');

      expect(store.notifications).toHaveLength(0);
    });
  });

  describe('tooltips and keyboard shortcuts', () => {
    it('should toggle tooltips', () => {
      const store = useUiStore();

      expect(store.tooltipsEnabled).toBe(true);

      store.toggleTooltips();
      expect(store.tooltipsEnabled).toBe(false);

      store.toggleTooltips();
      expect(store.tooltipsEnabled).toBe(true);
    });

    it('should toggle keyboard shortcuts', () => {
      const store = useUiStore();

      expect(store.keyboardShortcutsEnabled).toBe(true);

      store.toggleKeyboardShortcuts();
      expect(store.keyboardShortcutsEnabled).toBe(false);
    });
  });

  describe('preferences', () => {
    it('should load preferences', async () => {
      const store = useUiStore();

      await store.loadPreferences();

      expect(store.theme).toBe('dark');
      expect(store.language).toBe('en-US');
      expect(store.preferencesLoaded).toBe(true);
    });

    it('should get preferences object', () => {
      const store = useUiStore();
      store.setTheme('light');
      store.setLanguage('ru-RU');

      const prefs = store.getPreferences();

      expect(prefs.theme).toBe('light');
      expect(prefs.language).toBe('ru-RU');
      expect(prefs.showTooltips).toBe(true);
    });
  });
});
