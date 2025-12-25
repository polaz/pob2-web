// src/composables/useTreeData.ts
// Composable for loading and traversing passive tree data

import { ref, shallowRef, computed, onMounted, watch } from 'vue';
import type {
  RawTreeData,
  TreeData,
  TreeNode,
  TreeNodeType,
  TreeClass,
  TreeAscendancy,
  PathResult,
  ReachabilityResult,
} from 'src/types/tree';
import { getCachedData, setCachedData } from 'src/db';

// Cache configuration
const TREE_CACHE_KEY = 'tree:poe2';
const TREE_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/** Maximum search cache entries to prevent unbounded memory growth */
const SEARCH_CACHE_MAX_SIZE = 100;

// Lazy-loaded tree data (shared singleton)
let treeDataCache: TreeData | null = null;
let loadingPromise: Promise<TreeData> | null = null;

/**
 * Reset module-level state for testing purposes.
 *
 * WARNING: This function mutates the shared singleton cache used by the tree
 * data composable. It must only be called from test code to ensure a clean
 * state between tests and MUST NOT be used in production/runtime code.
 *
 * @example
 * ```typescript
 * // In test setup (beforeEach or afterEach)
 * import { resetTreeDataForTesting } from 'src/composables/useTreeData';
 *
 * beforeEach(() => {
 *   resetTreeDataForTesting(); // Clear cache before each test
 * });
 * ```
 *
 * @throws {Error} If called outside of test environment (NODE_ENV !== 'test')
 * @internal
 */
export function resetTreeDataForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'resetTreeDataForTesting() can only be called in test environment. ' +
        'This function is not meant for production use.'
    );
  }
  treeDataCache = null;
  loadingPromise = null;
}

/**
 * Convert raw tree data to optimized format.
 */
function convertToTreeData(rawData: RawTreeData): TreeData {
  // Convert to optimized format with Set for neighbors
  const nodes = new Map<string, TreeNode>();

  for (const [id, rawNode] of Object.entries(rawData.nodes)) {
    nodes.set(id, {
      id: rawNode.id,
      name: rawNode.name,
      type: rawNode.type,
      x: rawNode.x,
      y: rawNode.y,
      neighbors: new Set(rawNode.neighbors),
      stats: rawNode.stats,
      icon: rawNode.icon,
      ascendancy: rawNode.ascendancy,
      isAscendancyStart: rawNode.isAscendancyStart,
      isMastery: rawNode.isMastery,
    });
  }

  // Convert classes and ascendancies to Maps
  const classes = new Map<string, TreeClass>();
  for (const [name, cls] of Object.entries(rawData.classes)) {
    classes.set(name, cls);
  }

  const ascendancies = new Map<string, TreeAscendancy>();
  for (const [name, asc] of Object.entries(rawData.ascendancies)) {
    ascendancies.set(name, asc);
  }

  return {
    version: rawData.version,
    extractedAt: new Date(rawData.extractedAt),
    source: rawData.source,
    meta: rawData.meta,
    bounds: rawData.bounds,
    classes,
    ascendancies,
    nodes,
  };
}

/**
 * Load tree data from IndexedDB cache or JSON file.
 */
async function loadTreeData(): Promise<TreeData> {
  if (treeDataCache) {
    return treeDataCache;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Try to load from IndexedDB cache first (avoids loading large bundled JSON)
    try {
      const cached = await getCachedData(TREE_CACHE_KEY);
      if (cached) {
        const rawData = JSON.parse(cached.data) as RawTreeData;
        const treeData = convertToTreeData(rawData);
        treeDataCache = treeData;
        return treeData;
      }
    } catch (e) {
      // Cache miss or error, fall back to bundled JSON
      console.warn('[useTreeData] Cache read failed:', e);
    }

    // Load bundled JSON as fallback
    const module = await import('src/data/tree/poe2-tree.json');
    const rawData = module.default as RawTreeData;
    const treeData = convertToTreeData(rawData);

    // Cache in IndexedDB for faster future loads
    try {
      await setCachedData(
        TREE_CACHE_KEY,
        JSON.stringify(rawData),
        rawData.version,
        TREE_CACHE_TTL
      );
    } catch (e) {
      // Caching failed, but we still have the data in memory
      console.warn('[useTreeData] Cache write failed:', e);
    }

    // Only set cache after all operations succeed (atomic success)
    treeDataCache = treeData;
    return treeData;
  })().catch((error) => {
    // Reset state on failure to allow a clean retry
    loadingPromise = null;
    treeDataCache = null;
    throw error;
  });

  return loadingPromise;
}

/**
 * Find shortest path between two nodes using BFS.
 *
 * Uses head pointer pattern for O(1) dequeue. The queue array grows but
 * isn't trimmed during traversal. For PoE2's tree size (~1500 nodes),
 * this is acceptable. For significantly larger graphs, consider periodic
 * array slicing or a proper deque implementation.
 */
function findShortestPath(
  nodes: Map<string, TreeNode>,
  startId: string,
  endId: string
): PathResult {
  if (startId === endId) {
    return { path: [startId], length: 1, found: true };
  }

  const startNode = nodes.get(startId);
  const endNode = nodes.get(endId);

  if (!startNode || !endNode) {
    return { path: [], length: 0, found: false };
  }

  // BFS with O(1) dequeue using head pointer
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++]!;
    const current = nodes.get(currentId);

    if (!current) continue;

    for (const neighborId of current.neighbors) {
      if (visited.has(neighborId)) continue;

      visited.add(neighborId);
      parent.set(neighborId, currentId);

      if (neighborId === endId) {
        // Reconstruct path
        const path: string[] = [endId];
        let curr = endId;
        while (parent.has(curr)) {
          curr = parent.get(curr)!;
          path.unshift(curr);
        }
        return { path, length: path.length, found: true };
      }

      queue.push(neighborId);
    }
  }

  return { path: [], length: 0, found: false };
}

/**
 * Find all nodes reachable from a set of starting nodes.
 */
function findReachableNodes(
  nodes: Map<string, TreeNode>,
  startIds: string[]
): ReachabilityResult {
  const reachable = new Set<string>();
  const distances = new Map<string, number>();
  const queue: Array<{ id: string; distance: number }> = [];

  for (const id of startIds) {
    if (nodes.has(id)) {
      reachable.add(id);
      distances.set(id, 0);
      queue.push({ id, distance: 0 });
    }
  }

  // BFS with O(1) dequeue using head pointer
  let head = 0;
  while (head < queue.length) {
    const { id, distance } = queue[head++]!;
    const node = nodes.get(id);

    if (!node) continue;

    for (const neighborId of node.neighbors) {
      if (reachable.has(neighborId)) continue;

      reachable.add(neighborId);
      const newDistance = distance + 1;
      distances.set(neighborId, newDistance);
      queue.push({ id: neighborId, distance: newDistance });
    }
  }

  return { reachable, distances };
}

/**
 * Get nodes within a certain distance from starting nodes.
 */
function getNodesWithinDistance(
  nodes: Map<string, TreeNode>,
  startIds: string[],
  maxDistance: number
): Set<string> {
  const result = new Set<string>();
  const queue: Array<{ id: string; distance: number }> = [];

  for (const id of startIds) {
    if (nodes.has(id)) {
      result.add(id);
      queue.push({ id, distance: 0 });
    }
  }

  // BFS with O(1) dequeue using head pointer
  let head = 0;
  while (head < queue.length) {
    const { id, distance } = queue[head++]!;

    if (distance >= maxDistance) continue;

    const node = nodes.get(id);
    if (!node) continue;

    for (const neighborId of node.neighbors) {
      if (result.has(neighborId)) continue;

      result.add(neighborId);
      queue.push({ id: neighborId, distance: distance + 1 });
    }
  }

  return result;
}

/**
 * Composable for tree data access and graph traversal.
 */
export function useTreeData() {
  const loading = ref(true);
  const error = shallowRef<Error | null>(null);
  const treeData = shallowRef<TreeData | null>(null);

  // Load tree data on mount
  onMounted(async () => {
    try {
      treeData.value = await loadTreeData();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  });

  // Computed properties
  const nodeCount = computed(() => treeData.value?.nodes.size ?? 0);
  const classes = computed(() => treeData.value?.classes ?? new Map());
  const ascendancies = computed(() => treeData.value?.ascendancies ?? new Map());

  // Reactive search cache - automatically cleared when treeData changes
  const searchCache = shallowRef(new Map<string, TreeNode[]>());

  // Clear cache whenever treeData changes (more robust than version checking)
  watch(treeData, () => {
    searchCache.value = new Map();
  });

  /**
   * Get a node by ID.
   *
   * @param id - The node ID to look up
   * @returns The node if found, undefined otherwise
   */
  function getNode(id: string): TreeNode | undefined {
    return treeData.value?.nodes.get(id);
  }

  /**
   * Get all nodes of a specific type.
   *
   * @param type - The node type to filter by (normal, notable, keystone, mastery)
   * @returns Array of nodes matching the type
   */
  function getNodesByType(type: TreeNodeType): TreeNode[] {
    if (!treeData.value) return [];
    return Array.from(treeData.value.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Get all nodes belonging to a specific ascendancy.
   *
   * @param ascendancyName - The ascendancy name to filter by
   * @returns Array of nodes in the ascendancy
   */
  function getAscendancyNodes(ascendancyName: string): TreeNode[] {
    if (!treeData.value) return [];
    return Array.from(treeData.value.nodes.values()).filter(
      n => n.ascendancy === ascendancyName
    );
  }

  /**
   * Find the shortest path between two nodes using BFS.
   *
   * @param startId - Starting node ID
   * @param endId - Target node ID
   * @returns PathResult with path array, length, and found flag
   */
  function findPath(startId: string, endId: string): PathResult {
    if (!treeData.value) {
      return { path: [], length: 0, found: false };
    }
    return findShortestPath(treeData.value.nodes, startId, endId);
  }

  /**
   * Find all nodes reachable from a set of allocated nodes.
   *
   * @param allocatedIds - Array of currently allocated node IDs
   * @returns ReachabilityResult with reachable set and distance map
   */
  function getReachable(allocatedIds: string[]): ReachabilityResult {
    if (!treeData.value) {
      return { reachable: new Set(), distances: new Map() };
    }
    return findReachableNodes(treeData.value.nodes, allocatedIds);
  }

  /**
   * Get all nodes within a certain distance from starting nodes.
   *
   * @param startIds - Array of starting node IDs
   * @param maxDistance - Maximum distance (number of edges) to traverse
   * @returns Set of node IDs within the distance
   */
  function getWithinDistance(startIds: string[], maxDistance: number): Set<string> {
    if (!treeData.value) return new Set();
    return getNodesWithinDistance(treeData.value.nodes, startIds, maxDistance);
  }

  /**
   * Search nodes by name (case-insensitive, LRU cached).
   *
   * Uses an LRU cache bounded to SEARCH_CACHE_MAX_SIZE entries to prevent
   * unbounded memory growth. Cache is automatically invalidated when tree
   * data changes via Vue's reactivity system (watch on treeData).
   *
   * @param query - Search query string
   * @returns Array of nodes whose names contain the query
   */
  function searchNodes(query: string): TreeNode[] {
    if (!treeData.value) return [];

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const cache = searchCache.value;
    const cached = cache.get(normalizedQuery);
    if (cached) {
      // Move to end for LRU (delete and re-add preserves Map insertion order)
      cache.delete(normalizedQuery);
      cache.set(normalizedQuery, cached);
      return cached;
    }

    const result = Array.from(treeData.value.nodes.values()).filter(
      n => n.name?.toLowerCase().includes(normalizedQuery)
    );

    // Evict oldest entry if cache is full (first key in Map iteration order)
    if (cache.size >= SEARCH_CACHE_MAX_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(normalizedQuery, result);
    return result;
  }

  return {
    // State
    loading,
    error,
    treeData,

    // Computed
    nodeCount,
    classes,
    ascendancies,

    // Methods
    getNode,
    getNodesByType,
    getAscendancyNodes,
    findPath,
    getReachable,
    getWithinDistance,
    searchNodes,
  };
}
