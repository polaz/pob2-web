import { defineStore } from '#q-app/wrappers';
import { createPinia } from 'pinia';

// Export all stores
export { useBuildStore } from './buildStore';
export { useTreeStore, type TreeViewport, type NodeSearchResult } from './treeStore';
export { useItemStore, EQUIPMENT_SLOTS, FLASK_SLOTS, SWAP_SLOTS, type SlotInfo } from './itemStore';
export { useSkillStore, type GemSearchResult } from './skillStore';
export { useConfigStore, DEFAULT_BUILD_CONFIG, ENEMY_TYPES, BOSS_PRESETS } from './configStore';
export { useUiStore, type Theme, type ModalType, type Notification } from './uiStore';

/*
 * When adding new properties to stores, you should also
 * extend the `PiniaCustomProperties` interface.
 * @see https://pinia.vuejs.org/core-concepts/plugins.html#typing-new-store-properties
 */
declare module 'pinia' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface PiniaCustomProperties {
    // add your custom properties here, if any
  }
}

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default defineStore((/* { ssrContext } */) => {
  const pinia = createPinia();

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  return pinia;
});
