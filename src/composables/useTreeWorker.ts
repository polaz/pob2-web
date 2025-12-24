// src/composables/useTreeWorker.ts
// Composable for using the tree worker

import { ref, shallowRef, onUnmounted } from 'vue';
import * as Comlink from 'comlink';
import type { TreeWorkerApi } from 'src/workers/tree.worker';

// Lazy-loaded worker instance (shared across all uses)
let workerInstance: Worker | null = null;
let workerProxy: Comlink.Remote<TreeWorkerApi> | null = null;
let refCount = 0;

/**
 * Get or create the shared worker instance
 */
function getWorker(): Comlink.Remote<TreeWorkerApi> {
  if (!workerProxy) {
    workerInstance = new Worker(
      new URL('../workers/tree.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerProxy = Comlink.wrap<TreeWorkerApi>(workerInstance);
  }
  refCount++;
  return workerProxy;
}

/**
 * Release worker reference
 */
function releaseWorker(): void {
  refCount--;
  if (refCount <= 0 && workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerProxy = null;
    refCount = 0;
  }
}

/**
 * Composable for tree worker
 * Provides type-safe access to tree worker methods
 */
export function useTreeWorker() {
  const ready = ref(false);
  const error = shallowRef<Error | null>(null);
  const worker = shallowRef<Comlink.Remote<TreeWorkerApi> | null>(null);

  // Initialize worker
  try {
    worker.value = getWorker();
    ready.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e : new Error(String(e));
  }

  // Cleanup on unmount
  onUnmounted(() => {
    releaseWorker();
  });

  return {
    /** Whether the worker is ready */
    ready,
    /** Error during initialization (if any) */
    error,
    /** Worker proxy with all methods */
    worker,
  };
}
