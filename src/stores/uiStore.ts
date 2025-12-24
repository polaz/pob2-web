/**
 * UI Store - manages global UI state
 */
import { ref, computed } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import { getUserPreferences, updateUserPreferences } from 'src/db';
import type { UserPreferences } from 'src/types/db';
import { DEFAULT_USER_PREFERENCES } from 'src/types/db';

/** Main tabs in the application */
export type MainTab = 'tree' | 'skills' | 'items' | 'calcs' | 'config' | 'notes';

/** Available themes */
export type Theme = 'dark' | 'light' | 'system';

/** Modal types */
export type ModalType =
  | 'build-list'
  | 'import-build'
  | 'export-build'
  | 'settings'
  | 'about'
  | 'confirm'
  | null;

/** Notification type */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timeout?: number;
}

export const useUiStore = defineStore('ui', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Current active main tab */
  const activeTab = ref<MainTab>('tree');

  /** Previous tab (for back navigation) */
  const previousTab = ref<MainTab | null>(null);

  /** Current theme */
  const theme = ref<Theme>('dark');

  /** Current language */
  const language = ref('en-US');

  /** Whether sidebar is collapsed */
  const isSidebarCollapsed = ref(false);

  /** Whether loading overlay is shown */
  const isLoading = ref(false);

  /** Loading message */
  const loadingMessage = ref<string | null>(null);

  /** Currently open modal */
  const openModal = ref<ModalType>(null);

  /** Modal data (for passing data to modals) */
  const modalData = ref<unknown>(null);

  /** Active notifications */
  const notifications = ref<Notification[]>([]);

  /** Whether tooltips are enabled */
  const tooltipsEnabled = ref(true);

  /** Whether keyboard shortcuts are enabled */
  const keyboardShortcutsEnabled = ref(true);

  /** Whether preferences have been loaded */
  const preferencesLoaded = ref(false);

  // ============================================================================
  // Getters
  // ============================================================================

  /** Effective theme (resolves 'system' to actual theme) */
  const effectiveTheme = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme.value;
  });

  /** Whether dark theme is active */
  const isDarkTheme = computed(() => effectiveTheme.value === 'dark');

  /** Whether any modal is open */
  const hasOpenModal = computed(() => openModal.value !== null);

  /** Whether there are active notifications */
  const hasNotifications = computed(() => notifications.value.length > 0);

  /** Notification count */
  const notificationCount = computed(() => notifications.value.length);

  // ============================================================================
  // Actions
  // ============================================================================

  /** Set active tab */
  function setActiveTab(tab: MainTab): void {
    if (tab === activeTab.value) {
      return; // Don't update if same tab
    }
    previousTab.value = activeTab.value;
    activeTab.value = tab;
  }

  /** Go back to previous tab */
  function goBack(): void {
    if (previousTab.value) {
      activeTab.value = previousTab.value;
      previousTab.value = null;
    }
  }

  /** Set theme */
  function setTheme(newTheme: Theme): void {
    theme.value = newTheme;
    void savePreferences();
  }

  /** Toggle theme between dark and light */
  function toggleTheme(): void {
    theme.value = effectiveTheme.value === 'dark' ? 'light' : 'dark';
    void savePreferences();
  }

  /** Set language */
  function setLanguage(lang: string): void {
    language.value = lang;
    void savePreferences();
  }

  /** Toggle sidebar */
  function toggleSidebar(): void {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  }

  /** Set sidebar collapsed state */
  function setSidebarCollapsed(collapsed: boolean): void {
    isSidebarCollapsed.value = collapsed;
  }

  /** Show loading overlay */
  function showLoading(message?: string): void {
    isLoading.value = true;
    loadingMessage.value = message ?? null;
  }

  /** Hide loading overlay */
  function hideLoading(): void {
    isLoading.value = false;
    loadingMessage.value = null;
  }

  /** Open a modal */
  function showModal(type: ModalType, data?: unknown): void {
    openModal.value = type;
    modalData.value = data ?? null;
  }

  /** Close current modal */
  function closeModal(): void {
    openModal.value = null;
    modalData.value = null;
  }

  /** Timeout IDs for auto-dismissing notifications */
  const notificationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  /** Add notification */
  function notify(
    type: Notification['type'],
    message: string,
    timeout: number = 5000
  ): string {
    const id = crypto.randomUUID();
    const notification: Notification = { id, type, message, timeout };
    notifications.value.push(notification);

    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        notificationTimeouts.delete(id);
        dismissNotification(id);
      }, timeout);
      notificationTimeouts.set(id, timeoutId);
    }

    return id;
  }

  /** Dismiss notification by ID */
  function dismissNotification(id: string): void {
    // Clear timeout if exists to prevent memory leak
    const timeoutId = notificationTimeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      notificationTimeouts.delete(id);
    }

    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  }

  /** Clear all notifications */
  function clearNotifications(): void {
    // Clear all pending timeouts
    for (const timeoutId of notificationTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    notificationTimeouts.clear();
    notifications.value = [];
  }

  /** Toggle tooltips */
  function toggleTooltips(): void {
    tooltipsEnabled.value = !tooltipsEnabled.value;
    void savePreferences();
  }

  /** Toggle keyboard shortcuts */
  function toggleKeyboardShortcuts(): void {
    keyboardShortcutsEnabled.value = !keyboardShortcutsEnabled.value;
    void savePreferences();
  }

  /** Load preferences from database */
  async function loadPreferences(): Promise<void> {
    try {
      const prefs = await getUserPreferences();
      theme.value = prefs.theme;
      language.value = prefs.language;
      tooltipsEnabled.value = prefs.showTooltips;
      preferencesLoaded.value = true;
    } catch (error) {
      console.error('Failed to load preferences:', error);
      // Use defaults
      theme.value = DEFAULT_USER_PREFERENCES.theme;
      language.value = DEFAULT_USER_PREFERENCES.language;
      tooltipsEnabled.value = DEFAULT_USER_PREFERENCES.showTooltips;
      preferencesLoaded.value = true;
    }
  }

  /** Save preferences to database */
  async function savePreferences(): Promise<void> {
    try {
      await updateUserPreferences({
        theme: theme.value,
        language: language.value,
        showTooltips: tooltipsEnabled.value,
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  /** Get current preferences as object */
  function getPreferences(): Partial<UserPreferences> {
    return {
      theme: theme.value,
      language: language.value,
      showTooltips: tooltipsEnabled.value,
    };
  }

  return {
    // State
    activeTab,
    previousTab,
    theme,
    language,
    isSidebarCollapsed,
    isLoading,
    loadingMessage,
    openModal,
    modalData,
    notifications,
    tooltipsEnabled,
    keyboardShortcutsEnabled,
    preferencesLoaded,

    // Getters
    effectiveTheme,
    isDarkTheme,
    hasOpenModal,
    hasNotifications,
    notificationCount,

    // Actions
    setActiveTab,
    goBack,
    setTheme,
    toggleTheme,
    setLanguage,
    toggleSidebar,
    setSidebarCollapsed,
    showLoading,
    hideLoading,
    showModal,
    closeModal,
    notify,
    dismissNotification,
    clearNotifications,
    toggleTooltips,
    toggleKeyboardShortcuts,
    loadPreferences,
    savePreferences,
    getPreferences,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot));
}
