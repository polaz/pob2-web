/**
 * Unit tests for treeStore.
 *
 * Tests node lookups, selection state, viewport management,
 * and search functionality.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTreeStore } from 'src/stores/treeStore';
import type { PassiveTree, PassiveNode } from 'src/protos/pob2_pb';

/** Create mock passive node */
function createMockNode(
  id: string,
  name: string,
  x = 0,
  y = 0,
  ascendancyName?: string
): PassiveNode {
  return {
    id,
    name,
    position: { x, y },
    stats: [`+10 to ${name}`],
    linkedIds: [],
    ...(ascendancyName && { ascendancyName }),
  };
}

/** Create mock passive tree */
function createMockTree(nodes: PassiveNode[]): PassiveTree {
  return {
    version: '1.0.0',
    nodes,
    groups: [],
    classStartNodes: {},
  };
}

describe('treeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('initial state', () => {
    it('should have null tree data initially', () => {
      const store = useTreeStore();

      expect(store.treeData).toBeNull();
      expect(store.isLoaded).toBe(false);
      expect(store.isLoading).toBe(false);
    });

    it('should have default viewport', () => {
      const store = useTreeStore();

      expect(store.viewport.x).toBe(0);
      expect(store.viewport.y).toBe(0);
      expect(store.viewport.zoom).toBe(2.5); // Comfortable starting zoom
    });
  });

  describe('setTreeData', () => {
    it('should set tree data and update isLoaded', () => {
      const store = useTreeStore();
      const tree = createMockTree([createMockNode('1', 'Node 1')]);

      store.setTreeData(tree);

      expect(store.treeData).toBe(tree);
      expect(store.isLoaded).toBe(true);
      expect(store.loadError).toBeNull();
    });
  });

  describe('node lookup (nodesById / getNode)', () => {
    it('should build node lookup map', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'Strength'),
        createMockNode('200', 'Dexterity'),
        createMockNode('300', 'Intelligence'),
      ];
      store.setTreeData(createMockTree(nodes));

      expect(store.nodesById.size).toBe(3);
      expect(store.nodesById.get('100')?.name).toBe('Strength');
      expect(store.nodesById.get('200')?.name).toBe('Dexterity');
    });

    it('should return node via getNode function', () => {
      const store = useTreeStore();
      const nodes = [createMockNode('100', 'Test Node')];
      store.setTreeData(createMockTree(nodes));

      const node = store.getNode('100');

      expect(node).toBeDefined();
      expect(node?.name).toBe('Test Node');
    });

    it('should return undefined for non-existent node', () => {
      const store = useTreeStore();
      store.setTreeData(createMockTree([createMockNode('100', 'Node')]));

      expect(store.getNode('999')).toBeUndefined();
    });

    it('should expose allNodeIds', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'A'),
        createMockNode('200', 'B'),
      ];
      store.setTreeData(createMockTree(nodes));

      expect(store.allNodeIds).toContain('100');
      expect(store.allNodeIds).toContain('200');
      expect(store.totalNodeCount).toBe(2);
    });
  });

  describe('selection state', () => {
    it('should set hovered node', () => {
      const store = useTreeStore();
      const nodes = [createMockNode('100', 'Hover Me')];
      store.setTreeData(createMockTree(nodes));

      store.setHoveredNode('100');

      expect(store.hoveredNodeId).toBe('100');
      expect(store.hoveredNode?.name).toBe('Hover Me');
    });

    it('should clear hovered node', () => {
      const store = useTreeStore();
      store.setHoveredNode('100');

      store.setHoveredNode(null);

      expect(store.hoveredNodeId).toBeNull();
      expect(store.hoveredNode).toBeNull();
    });

    it('should set selected node', () => {
      const store = useTreeStore();
      const nodes = [createMockNode('100', 'Select Me')];
      store.setTreeData(createMockTree(nodes));

      store.setSelectedNode('100');

      expect(store.selectedNodeId).toBe('100');
      expect(store.selectedNode?.name).toBe('Select Me');
    });
  });

  describe('viewport management', () => {
    it('should set viewport position', () => {
      const store = useTreeStore();

      store.setViewportPosition(100, 200);

      expect(store.viewport.x).toBe(100);
      expect(store.viewport.y).toBe(200);
    });

    it('should set viewport zoom with clamping', () => {
      const store = useTreeStore();

      store.setViewportZoom(3.0);
      expect(store.viewport.zoom).toBe(3.0);

      // Test lower bound (2.0) - ensures nodes are at least 24px
      store.setViewportZoom(0.5);
      expect(store.viewport.zoom).toBe(2.0);

      // Test upper bound (5.0) - prevents nodes larger than 64px
      store.setViewportZoom(10.0);
      expect(store.viewport.zoom).toBe(5.0);
    });

    it('should pan viewport', () => {
      const store = useTreeStore();
      store.setViewportPosition(100, 100);

      store.panViewport(50, -25);

      expect(store.viewport.x).toBe(150);
      expect(store.viewport.y).toBe(75);
    });

    it('should zoom viewport at point', () => {
      const store = useTreeStore();
      store.setViewportPosition(0, 0);
      store.setViewportZoom(3.0);

      store.zoomViewportAt(100, 100, 0.5);

      expect(store.viewport.zoom).toBe(3.5);
      // Position should adjust to zoom towards the point
      expect(store.viewport.x).not.toBe(0);
    });

    it('should reset viewport', () => {
      const store = useTreeStore();
      store.setViewportPosition(500, 500);
      store.setViewportZoom(4.0);

      store.resetViewport();

      expect(store.viewport.x).toBe(0);
      expect(store.viewport.y).toBe(0);
      expect(store.viewport.zoom).toBe(2.5); // Default zoom
    });

    it('should center on node', () => {
      const store = useTreeStore();
      const nodes = [createMockNode('100', 'Center', 500, 300)];
      store.setTreeData(createMockTree(nodes));

      store.centerOnNode('100');

      expect(store.viewport.x).toBe(-500);
      expect(store.viewport.y).toBe(-300);
    });
  });

  describe('search functionality', () => {
    it('should set search query', () => {
      const store = useTreeStore();

      store.setSearchQuery('strength');

      expect(store.searchQuery).toBe('strength');
      expect(store.hasSearch).toBe(true);
    });

    it('should set search results', () => {
      const store = useTreeStore();
      const results = [
        { nodeId: '100', node: createMockNode('100', 'Str'), matchType: 'name' as const, matchText: 'Str' },
      ];

      store.setSearchResults(results);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResultCount).toBe(1);
    });

    it('should clear search', () => {
      const store = useTreeStore();
      store.setSearchQuery('test');
      store.setSearchResults([
        { nodeId: '100', node: createMockNode('100', 'Test'), matchType: 'name' as const, matchText: 'Test' },
      ]);

      store.clearSearch();

      expect(store.searchQuery).toBe('');
      expect(store.searchResults).toHaveLength(0);
      expect(store.hasSearch).toBe(false);
    });
  });

  describe('path highlighting', () => {
    it('should set highlighted path', () => {
      const store = useTreeStore();

      store.setHighlightedPath(['1', '2', '3']);

      expect(store.highlightedPath).toEqual(['1', '2', '3']);
    });

    it('should clear highlighted path', () => {
      const store = useTreeStore();
      store.setHighlightedPath(['1', '2']);

      store.clearHighlightedPath();

      expect(store.highlightedPath).toEqual([]);
    });
  });

  describe('comparison mode', () => {
    it('should set comparison node IDs', () => {
      const store = useTreeStore();

      store.setComparisonNodes(['100', '200', '300']);

      expect(store.comparisonNodeIds).toEqual(['100', '200', '300']);
    });

    it('should clear comparison nodes', () => {
      const store = useTreeStore();
      store.setComparisonNodes(['100']);

      store.setComparisonNodes(null);

      expect(store.comparisonNodeIds).toBeNull();
    });
  });

  describe('clearTreeData', () => {
    it('should reset all tree-related state', () => {
      const store = useTreeStore();

      // Set up various state
      store.setTreeData(createMockTree([createMockNode('100', 'Node')]));
      store.setHoveredNode('100');
      store.setSelectedNode('100');
      store.setSearchQuery('test');
      store.setHighlightedPath(['1', '2']);
      store.setComparisonNodes(['100']);
      store.setVisibleAscendancy('Titan');
      store.setShowAscendancyNodes(false);

      store.clearTreeData();

      expect(store.treeData).toBeNull();
      expect(store.hoveredNodeId).toBeNull();
      expect(store.selectedNodeId).toBeNull();
      expect(store.searchQuery).toBe('');
      expect(store.searchResults).toEqual([]);
      expect(store.highlightedPath).toEqual([]);
      expect(store.comparisonNodeIds).toBeNull();
      expect(store.visibleAscendancy).toBeNull();
      expect(store.showAscendancyNodes).toBe(true);
      expect(store.loadError).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should manage loading state', () => {
      const store = useTreeStore();

      store.setLoading(true);
      expect(store.isLoading).toBe(true);

      store.setLoading(false);
      expect(store.isLoading).toBe(false);
    });

    it('should set load error and clear loading', () => {
      const store = useTreeStore();
      store.setLoading(true);

      store.setLoadError('Failed to load tree');

      expect(store.loadError).toBe('Failed to load tree');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('dragging state', () => {
    it('should manage dragging state', () => {
      const store = useTreeStore();

      store.setDragging(true);
      expect(store.isDragging).toBe(true);

      store.setDragging(false);
      expect(store.isDragging).toBe(false);
    });
  });

  describe('ascendancy visibility', () => {
    it('should have null visible ascendancy initially', () => {
      const store = useTreeStore();

      expect(store.visibleAscendancy).toBeNull();
      expect(store.showAscendancyNodes).toBe(true);
    });

    it('should set visible ascendancy', () => {
      const store = useTreeStore();

      store.setVisibleAscendancy('Titan');

      expect(store.visibleAscendancy).toBe('Titan');
    });

    it('should clear visible ascendancy', () => {
      const store = useTreeStore();
      store.setVisibleAscendancy('Titan');

      store.setVisibleAscendancy(null);

      expect(store.visibleAscendancy).toBeNull();
    });

    it('should toggle show ascendancy nodes', () => {
      const store = useTreeStore();

      store.setShowAscendancyNodes(false);
      expect(store.showAscendancyNodes).toBe(false);

      store.setShowAscendancyNodes(true);
      expect(store.showAscendancyNodes).toBe(true);
    });

    it('should determine main tree node visibility (always visible)', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'Main Node'),
        createMockNode('200', 'Ascendancy Node', 0, 0, 'Titan'),
      ];
      store.setTreeData(createMockTree(nodes));

      // Main tree nodes are always visible
      expect(store.isNodeVisible('100')).toBe(true);
    });

    it('should hide ascendancy nodes when no ascendancy is selected', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'Main Node'),
        createMockNode('200', 'Titan Node', 0, 0, 'Titan'),
      ];
      store.setTreeData(createMockTree(nodes));

      // No ascendancy selected, so ascendancy nodes should be hidden
      expect(store.isNodeVisible('200')).toBe(false);
    });

    it('should show ascendancy nodes when matching ascendancy is selected', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'Main Node'),
        createMockNode('200', 'Titan Node', 0, 0, 'Titan'),
        createMockNode('300', 'Warbringer Node', 0, 0, 'Warbringer'),
      ];
      store.setTreeData(createMockTree(nodes));

      store.setVisibleAscendancy('Titan');

      expect(store.isNodeVisible('100')).toBe(true); // Main tree
      expect(store.isNodeVisible('200')).toBe(true); // Titan
      expect(store.isNodeVisible('300')).toBe(false); // Warbringer
    });

    it('should hide all ascendancy nodes when showAscendancyNodes is false', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'Main Node'),
        createMockNode('200', 'Titan Node', 0, 0, 'Titan'),
      ];
      store.setTreeData(createMockTree(nodes));
      store.setVisibleAscendancy('Titan');

      store.setShowAscendancyNodes(false);

      expect(store.isNodeVisible('100')).toBe(true); // Main tree still visible
      expect(store.isNodeVisible('200')).toBe(false); // Ascendancy hidden
    });

    it('should compute visible node IDs correctly', () => {
      const store = useTreeStore();
      const nodes = [
        createMockNode('100', 'Main Node 1'),
        createMockNode('101', 'Main Node 2'),
        createMockNode('200', 'Titan Node', 0, 0, 'Titan'),
        createMockNode('300', 'Warbringer Node', 0, 0, 'Warbringer'),
      ];
      store.setTreeData(createMockTree(nodes));

      // No ascendancy selected - only main nodes visible
      expect(store.visibleNodeIds).toContain('100');
      expect(store.visibleNodeIds).toContain('101');
      expect(store.visibleNodeIds).not.toContain('200');
      expect(store.visibleNodeIds).not.toContain('300');

      // Select Titan ascendancy
      store.setVisibleAscendancy('Titan');

      expect(store.visibleNodeIds).toContain('100');
      expect(store.visibleNodeIds).toContain('101');
      expect(store.visibleNodeIds).toContain('200');
      expect(store.visibleNodeIds).not.toContain('300');
    });

    it('should reset ascendancy state when clearing tree data', () => {
      const store = useTreeStore();
      store.setVisibleAscendancy('Titan');
      store.setShowAscendancyNodes(false);

      store.clearTreeData();

      expect(store.visibleAscendancy).toBeNull();
      expect(store.showAscendancyNodes).toBe(true);
    });
  });
});
