/**
 * Unit tests for useTreeData composable.
 *
 * This file contains two test suites:
 *
 * 1. **Algorithm Tests**: Reimplement BFS algorithms to verify correctness
 *    with a known graph structure, independent of Vue lifecycle.
 *
 * 2. **Composable API Tests**: Test the actual useTreeData exports by
 *    mounting a test component that uses the composable.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { TreeNode, TreeData, TreeNodeType } from 'src/types/tree';

// Mock the database module
vi.mock('src/db', () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

// Create test tree data with known structure for testing graph algorithms
function createTestTreeData(): TreeData {
  // Create a simple graph:
  //   1 -- 2 -- 3
  //   |    |
  //   4 -- 5 -- 6
  //        |
  //        7
  const nodes = new Map<string, TreeNode>();

  const createNode = (
    id: string,
    neighbors: string[],
    type: TreeNodeType = 'normal',
    name: string | null = null
  ): TreeNode => ({
    id,
    name,
    type,
    x: (Number(id) || 0) * 100,
    y: (Number(id) || 0) * 100,
    neighbors: new Set(neighbors),
    stats: [],
    icon: null,
    ascendancy: null,
    isAscendancyStart: false,
    isMastery: false,
  });

  // Build bidirectional graph
  nodes.set('1', createNode('1', ['2', '4'], 'normal', 'Node One'));
  nodes.set('2', createNode('2', ['1', '3', '5'], 'notable', 'Node Two'));
  nodes.set('3', createNode('3', ['2'], 'keystone', 'Keystone Three'));
  nodes.set('4', createNode('4', ['1', '5'], 'normal', 'Node Four'));
  nodes.set('5', createNode('5', ['2', '4', '6', '7'], 'notable', 'Hub Five'));
  nodes.set('6', createNode('6', ['5'], 'mastery', 'Mastery Six'));
  nodes.set('7', createNode('7', ['5'], 'normal', 'Node Seven'));

  // Add an isolated node for testing unreachable cases
  nodes.set('99', createNode('99', [], 'normal', 'Isolated Node'));

  return {
    version: 'test-1.0',
    extractedAt: new Date(),
    source: 'test',
    meta: {
      totalNodes: nodes.size,
      normalNodes: 4,
      notableNodes: 2,
      keystoneNodes: 1,
      masteryNodes: 1,
      ascendancyNodes: 0,
      classStartNodes: 0,
      totalEdges: 7,
    },
    bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
    classes: new Map(),
    ascendancies: new Map(),
    nodes,
    // Mastery data (empty for basic graph tests)
    masteryEffects: new Map(),
    masteryTypes: new Map(),
  };
}

// Extract internal functions for direct testing
// Since they're not exported, we test through behavior
describe('useTreeData graph traversal', () => {
  let testData: TreeData;

  beforeEach(() => {
    testData = createTestTreeData();
  });

  describe('findShortestPath (BFS)', () => {
    // Helper to run BFS pathfinding
    function findPath(
      nodes: Map<string, TreeNode>,
      startId: string,
      endId: string
    ): { path: string[]; length: number; found: boolean } {
      if (startId === endId) {
        return { path: [startId], length: 1, found: true };
      }

      const startNode = nodes.get(startId);
      const endNode = nodes.get(endId);

      if (!startNode || !endNode) {
        return { path: [], length: 0, found: false };
      }

      const queue: string[] = [startId];
      let head = 0;
      const visited = new Set<string>([startId]);
      const parent = new Map<string, string>();

      while (head < queue.length) {
        const currentId = queue[head++]!;
        const current = nodes.get(currentId);

        if (!current) continue;

        for (const neighborId of current.neighbors) {
          if (visited.has(neighborId)) continue;

          visited.add(neighborId);
          parent.set(neighborId, currentId);

          if (neighborId === endId) {
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

    it('should find path to self', () => {
      const result = findPath(testData.nodes, '1', '1');
      expect(result.found).toBe(true);
      expect(result.path).toEqual(['1']);
      expect(result.length).toBe(1);
    });

    it('should find direct neighbor path', () => {
      const result = findPath(testData.nodes, '1', '2');
      expect(result.found).toBe(true);
      expect(result.path).toEqual(['1', '2']);
      expect(result.length).toBe(2);
    });

    it('should find shortest path through graph', () => {
      // Path from 1 to 6: 1 -> 2 -> 5 -> 6 OR 1 -> 4 -> 5 -> 6 (both length 4)
      const result = findPath(testData.nodes, '1', '6');
      expect(result.found).toBe(true);
      expect(result.length).toBe(4);
      // First and last nodes should be correct
      expect(result.path[0]).toBe('1');
      expect(result.path[result.path.length - 1]).toBe('6');
    });

    it('should find shortest path (prefers first found)', () => {
      // Path from 1 to 7
      const result = findPath(testData.nodes, '1', '7');
      expect(result.found).toBe(true);
      expect(result.length).toBe(4); // 1 -> 2 -> 5 -> 7 or 1 -> 4 -> 5 -> 7
    });

    it('should return not found for isolated nodes', () => {
      const result = findPath(testData.nodes, '1', '99');
      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should return not found for non-existent nodes', () => {
      const result = findPath(testData.nodes, '1', '999');
      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
    });
  });

  describe('findReachableNodes (BFS)', () => {
    function findReachable(
      nodes: Map<string, TreeNode>,
      startIds: string[]
    ): { reachable: Set<string>; distances: Map<string, number> } {
      const reachable = new Set<string>();
      const distances = new Map<string, number>();
      const queue: Array<{ id: string; distance: number }> = [];
      let head = 0;

      for (const id of startIds) {
        if (nodes.has(id)) {
          reachable.add(id);
          distances.set(id, 0);
          queue.push({ id, distance: 0 });
        }
      }

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

    it('should find all reachable nodes from single start', () => {
      const result = findReachable(testData.nodes, ['1']);
      // All nodes except isolated node 99 should be reachable
      expect(result.reachable.size).toBe(7);
      expect(result.reachable.has('99')).toBe(false);
    });

    it('should calculate correct distances', () => {
      const result = findReachable(testData.nodes, ['1']);
      expect(result.distances.get('1')).toBe(0);
      expect(result.distances.get('2')).toBe(1);
      expect(result.distances.get('4')).toBe(1);
      expect(result.distances.get('3')).toBe(2);
      expect(result.distances.get('5')).toBe(2);
    });

    it('should handle multiple start nodes', () => {
      const result = findReachable(testData.nodes, ['1', '7']);
      expect(result.distances.get('1')).toBe(0);
      expect(result.distances.get('7')).toBe(0);
      // Node 5 is 1 step from 7, 2 steps from 1
      expect(result.distances.get('5')).toBe(1);
    });

    it('should handle empty start list', () => {
      const result = findReachable(testData.nodes, []);
      expect(result.reachable.size).toBe(0);
    });

    it('should handle non-existent start nodes', () => {
      const result = findReachable(testData.nodes, ['999']);
      expect(result.reachable.size).toBe(0);
    });
  });

  describe('getNodesWithinDistance (BFS)', () => {
    function getWithinDistance(
      nodes: Map<string, TreeNode>,
      startIds: string[],
      maxDistance: number
    ): Set<string> {
      const result = new Set<string>();
      const queue: Array<{ id: string; distance: number }> = [];
      let head = 0;

      for (const id of startIds) {
        if (nodes.has(id)) {
          result.add(id);
          queue.push({ id, distance: 0 });
        }
      }

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

    it('should return only start nodes at distance 0', () => {
      const result = getWithinDistance(testData.nodes, ['1'], 0);
      expect(result.size).toBe(1);
      expect(result.has('1')).toBe(true);
    });

    it('should return start and neighbors at distance 1', () => {
      const result = getWithinDistance(testData.nodes, ['1'], 1);
      expect(result.size).toBe(3);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
      expect(result.has('4')).toBe(true);
    });

    it('should return nodes within distance 2', () => {
      const result = getWithinDistance(testData.nodes, ['1'], 2);
      // 1, 2, 4, 3, 5
      expect(result.size).toBe(5);
      expect(result.has('3')).toBe(true);
      expect(result.has('5')).toBe(true);
      expect(result.has('6')).toBe(false); // distance 3
      expect(result.has('7')).toBe(false); // distance 3
    });

    it('should handle multiple start nodes', () => {
      // Starting from 1 and 6
      const result = getWithinDistance(testData.nodes, ['1', '6'], 1);
      // From 1: 2, 4; From 6: 5
      expect(result.has('1')).toBe(true);
      expect(result.has('6')).toBe(true);
      expect(result.has('2')).toBe(true);
      expect(result.has('4')).toBe(true);
      expect(result.has('5')).toBe(true);
    });
  });

  describe('node filtering functions', () => {
    it('should filter nodes by type', () => {
      const notables = Array.from(testData.nodes.values()).filter(
        (n) => n.type === 'notable'
      );
      expect(notables.length).toBe(2);
      expect(notables.map((n) => n.id).sort()).toEqual(['2', '5']);
    });

    it('should find keystones', () => {
      const keystones = Array.from(testData.nodes.values()).filter(
        (n) => n.type === 'keystone'
      );
      expect(keystones.length).toBe(1);
      expect(keystones[0]?.id).toBe('3');
    });

    it('should find masteries', () => {
      const masteries = Array.from(testData.nodes.values()).filter(
        (n) => n.type === 'mastery'
      );
      expect(masteries.length).toBe(1);
      expect(masteries[0]?.id).toBe('6');
    });
  });

  describe('search functionality', () => {
    it('should search nodes by name (case insensitive)', () => {
      const query = 'hub';
      const results = Array.from(testData.nodes.values()).filter((n) =>
        n.name?.toLowerCase().includes(query.toLowerCase())
      );
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Hub Five');
    });

    it('should return empty for no matches', () => {
      const query = 'nonexistent';
      const results = Array.from(testData.nodes.values()).filter((n) =>
        n.name?.toLowerCase().includes(query.toLowerCase())
      );
      expect(results.length).toBe(0);
    });

    it('should handle nodes with null names', () => {
      const nodeWithNullName: TreeNode = {
        id: '100',
        name: null,
        type: 'normal',
        x: 0,
        y: 0,
        neighbors: new Set(),
        stats: [],
        icon: null,
        ascendancy: null,
        isAscendancyStart: false,
        isMastery: false,
      };
      testData.nodes.set('100', nodeWithNullName);

      const query = 'test';
      const results = Array.from(testData.nodes.values()).filter((n) =>
        n.name?.toLowerCase().includes(query.toLowerCase())
      );
      // Should not throw, null name nodes are filtered out
      expect(results.every((n) => n.name !== null)).toBe(true);
    });
  });
});

/**
 * Composable API Tests
 *
 * These tests verify the actual useTreeData composable exports work correctly
 * by mounting a test component that uses the composable.
 *
 * Note: We test the composable by directly calling its methods after waiting
 * for the async load to complete. This avoids complex mocking issues with
 * dynamic imports.
 */
describe('useTreeData composable API', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Clear cached tree data before each test
    const mod = await import('src/composables/useTreeData');
    mod.resetTreeDataForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to mount component and wait for tree data to load.
   * Uses a polling approach since flushPromises() may not wait for
   * the full async chain (IndexedDB + dynamic import + conversion).
   */
  async function mountAndWaitForLoad() {
    const { useTreeData } = await import('src/composables/useTreeData');

    let composableResult: ReturnType<typeof useTreeData> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useTreeData();
        return () => h('div');
      },
    });

    mount(TestComponent);

    // Wait for loading to complete (poll for up to 5 seconds)
    const startTime = Date.now();
    while (composableResult!.loading.value && Date.now() - startTime < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return composableResult!;
  }

  it('should load tree data and expose via treeData ref', async () => {
    const result = await mountAndWaitForLoad();

    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBeNull();
    expect(result.treeData.value).not.toBeNull();
    // Real tree has many nodes
    expect(result.nodeCount.value).toBeGreaterThan(100);
  });

  it('should expose getNode function that returns correct node', async () => {
    const result = await mountAndWaitForLoad();

    // Get any node from the tree
    const firstNodeId = result.treeData.value?.nodes.keys().next().value;
    expect(firstNodeId).toBeDefined();

    const node = result.getNode(firstNodeId!);
    expect(node).toBeDefined();
    expect(node?.id).toBe(firstNodeId);
  });

  it('should expose getNodesByType function', async () => {
    const result = await mountAndWaitForLoad();

    // Real tree should have notable nodes
    const notables = result.getNodesByType('notable');
    expect(notables.length).toBeGreaterThan(0);
    expect(notables.every((n) => n.type === 'notable')).toBe(true);

    // Real tree should have keystone nodes
    const keystones = result.getNodesByType('keystone');
    expect(keystones.length).toBeGreaterThan(0);
    expect(keystones.every((n) => n.type === 'keystone')).toBe(true);
  });

  it('should expose findPath function that finds shortest path', async () => {
    const result = await mountAndWaitForLoad();

    // Get two connected nodes
    const nodes = result.treeData.value?.nodes;
    expect(nodes).toBeDefined();

    // Find a node with neighbors
    let startId: string | undefined;
    let endId: string | undefined;
    for (const [id, node] of nodes!) {
      if (node.neighbors.size > 0) {
        startId = id;
        endId = node.neighbors.values().next().value;
        break;
      }
    }

    expect(startId).toBeDefined();
    expect(endId).toBeDefined();

    const pathResult = result.findPath(startId!, endId!);
    expect(pathResult.found).toBe(true);
    expect(pathResult.path.length).toBeGreaterThan(0);
    expect(pathResult.path[0]).toBe(startId);
    expect(pathResult.path[pathResult.path.length - 1]).toBe(endId);
  });

  it('should expose searchNodes function', async () => {
    const result = await mountAndWaitForLoad();

    // Search for common stat terms that should exist in the tree
    // Empty query returns empty array
    expect(result.searchNodes('')).toEqual([]);
    expect(result.searchNodes('   ')).toEqual([]);

    // Find a node name to search for
    const firstNode = result.treeData.value?.nodes.values().next().value;
    if (firstNode?.name) {
      const searchTerm = firstNode.name.split(' ')[0]?.toLowerCase();
      if (searchTerm && searchTerm.length > 2) {
        const results = result.searchNodes(searchTerm);
        expect(results.length).toBeGreaterThan(0);
      }
    }
  });

  it('should cache search results (LRU)', async () => {
    const result = await mountAndWaitForLoad();

    // Find a searchable term
    const firstNode = result.treeData.value?.nodes.values().next().value;
    const searchTerm = firstNode?.name?.split(' ')[0]?.toLowerCase() || 'test';

    // First search
    const results1 = result.searchNodes(searchTerm);

    // Second search should return same array reference (cached)
    const results2 = result.searchNodes(searchTerm);
    expect(results2).toBe(results1);
  });

  it('should return empty results when tree data not loaded', async () => {
    const { useTreeData, resetTreeDataForTesting } = await import(
      'src/composables/useTreeData'
    );
    resetTreeDataForTesting();

    let composableResult: ReturnType<typeof useTreeData> | null = null;

    const TestComponent = defineComponent({
      setup() {
        composableResult = useTreeData();
        return () => h('div');
      },
    });

    mount(TestComponent);
    // Don't wait - test immediate state before async load completes

    // Before data loads, functions should return safe defaults
    expect(composableResult!.loading.value).toBe(true);
    expect(composableResult!.getNode('1')).toBeUndefined();
    expect(composableResult!.getNodesByType('normal')).toEqual([]);
    expect(composableResult!.findPath('1', '2')).toEqual({
      path: [],
      length: 0,
      found: false,
    });
    expect(composableResult!.searchNodes('test')).toEqual([]);
  });

  describe('mastery effect methods', () => {
    it('should expose masteryEffects and masteryTypes computed refs', async () => {
      const result = await mountAndWaitForLoad();

      // masteryEffects and masteryTypes should be Maps (may be empty)
      expect(result.masteryEffects.value).toBeInstanceOf(Map);
      expect(result.masteryTypes.value).toBeInstanceOf(Map);
    });

    it('should return undefined for non-existent mastery effect ID', async () => {
      const result = await mountAndWaitForLoad();

      const effect = result.getMasteryEffect(99999999);
      expect(effect).toBeUndefined();
    });

    it('should return empty array for getMasteryEffectsForNode with non-mastery node', async () => {
      const result = await mountAndWaitForLoad();

      // Find a non-mastery node
      const nodes = result.treeData.value?.nodes;
      let nonMasteryId: string | undefined;
      for (const [id, node] of nodes!) {
        if (!node.isMastery) {
          nonMasteryId = id;
          break;
        }
      }

      if (nonMasteryId) {
        const effects = result.getMasteryEffectsForNode(nonMasteryId);
        expect(effects).toEqual([]);
      }
    });

    it('should return undefined for non-existent mastery type', async () => {
      const result = await mountAndWaitForLoad();

      const masteryType = result.getMasteryType('Non-Existent Mastery');
      expect(masteryType).toBeUndefined();
    });

    it('should resolve empty mastery selections to empty array', async () => {
      const result = await mountAndWaitForLoad();

      // Empty map should return empty results
      const resolved = result.resolveMasterySelections(new Map());
      expect(resolved).toEqual([]);

      // Empty object should also work
      const resolvedObj = result.resolveMasterySelections({});
      expect(resolvedObj).toEqual([]);
    });

    it('should handle invalid effect IDs in mastery selections gracefully', async () => {
      const result = await mountAndWaitForLoad();

      // Non-numeric effect ID should be filtered out
      const selections = { 'node123': 'not-a-number' };
      const resolved = result.resolveMasterySelections(selections);
      expect(resolved).toEqual([]);
    });

    it('should return mastery methods when tree data not loaded', async () => {
      const { useTreeData, resetTreeDataForTesting } = await import(
        'src/composables/useTreeData'
      );
      resetTreeDataForTesting();

      let composableResult: ReturnType<typeof useTreeData> | null = null;

      const TestComponent = defineComponent({
        setup() {
          composableResult = useTreeData();
          return () => h('div');
        },
      });

      mount(TestComponent);
      // Don't wait - test immediate state before async load completes

      // Before data loads, mastery methods should return safe defaults
      expect(composableResult!.getMasteryEffect(12345)).toBeUndefined();
      expect(composableResult!.getMasteryEffectsForNode('123')).toEqual([]);
      expect(composableResult!.getMasteryType('Life Mastery')).toBeUndefined();
      expect(composableResult!.resolveMasterySelections({})).toEqual([]);
    });
  });
});
