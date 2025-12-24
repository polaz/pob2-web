// src/composables/useImportWorker.ts
// Composable for using the import/export worker

import { ref, shallowRef, onUnmounted } from 'vue';
import * as Comlink from 'comlink';
import type { ImportWorkerApi } from 'src/workers/import.worker';

// Lazy-loaded worker instance (shared across all uses)
let workerInstance: Worker | null = null;
let workerProxy: Comlink.Remote<ImportWorkerApi> | null = null;
let refCount = 0;

/**
 * Get or create the shared worker instance
 */
function getWorker(): Comlink.Remote<ImportWorkerApi> {
  if (!workerProxy) {
    workerInstance = new Worker(
      new URL('../workers/import.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerProxy = Comlink.wrap<ImportWorkerApi>(workerInstance);
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
 * Composable for import/export worker
 * Provides type-safe access to import worker methods
 */
export function useImportWorker() {
  const ready = ref(false);
  const error = shallowRef<Error | null>(null);
  const worker = shallowRef<Comlink.Remote<ImportWorkerApi> | null>(null);

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
