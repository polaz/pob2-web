/**
 * Tree Store - manages passive tree UI state
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import type { PassiveTree, PassiveNode } from 'src/protos/pob2_pb';

/** Tree viewport state */
export interface TreeViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Node search result */
export interface NodeSearchResult {
  nodeId: string;
  node: PassiveNode;
  matchType: 'name' | 'stat';
  matchText: string;
}

export const useTreeStore = defineStore('tree', () => {
  // ============================================================================
  // State
  // ============================================================================

  /** Full passive tree data */
  const treeData = shallowRef<PassiveTree | null>(null);

  /** Whether tree data is loading */
  const isLoading = ref(false);

  /** Tree loading error */
  const loadError = ref<string | null>(null);

  /** Currently hovered node ID */
  const hoveredNodeId = ref<string | null>(null);

  /** Currently selected node ID (for details panel) */
  const selectedNodeId = ref<string | null>(null);

  /** Search query for node search */
  const searchQuery = ref('');

  /** Search results */
  const searchResults = shallowRef<NodeSearchResult[]>([]);

  /** Current viewport state */
  const viewport = ref<TreeViewport>({
    x: 0,
    y: 0,
    zoom: 1.0,
  });

  /** Whether tree is being dragged */
  const isDragging = ref(false);

  /** Highlighted path (for pathfinding preview) */
  const highlightedPath = shallowRef<string[]>([]);

  /** Comparison mode - show diff between two builds */
  const comparisonNodeIds = shallowRef<string[] | null>(null);

  // ============================================================================
  // Getters
  // ============================================================================

  /** Whether tree data is loaded */
  const isLoaded = computed(() => treeData.value !== null);

  /** Node lookup map for O(1) access by ID */
  const nodesById = computed(() => {
    const map = new Map<string, PassiveNode>();
    if (treeData.value) {
      for (const node of treeData.value.nodes) {
        map.set(node.id, node);
      }
    }
    return map;
  });

  /** Get node by ID */
  const getNode = computed(() => {
    return (nodeId: string): PassiveNode | undefined => {
      return nodesById.value.get(nodeId);
    };
  });

  /** Currently hovered node */
  const hoveredNode = computed(() => {
    if (!hoveredNodeId.value) return null;
    return nodesById.value.get(hoveredNodeId.value) ?? null;
  });

  /** Currently selected node */
  const selectedNode = computed(() => {
    if (!selectedNodeId.value) return null;
    return nodesById.value.get(selectedNodeId.value) ?? null;
  });

  /** All node IDs */
  const allNodeIds = computed(() => {
    return Array.from(nodesById.value.keys());
  });

  /** Total node count */
  const totalNodeCount = computed(() => allNodeIds.value.length);

  /** Has active search */
  const hasSearch = computed(() => searchQuery.value.length > 0);

  /** Search result count */
  const searchResultCount = computed(() => searchResults.value.length);

  // ============================================================================
  // Actions
  // ============================================================================

  /** Set tree data */
  function setTreeData(tree: PassiveTree): void {
    treeData.value = tree;
    loadError.value = null;
  }

  /** Set loading state */
  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  /** Set load error */
  function setLoadError(error: string | null): void {
    loadError.value = error;
    isLoading.value = false;
  }

  /** Set hovered node */
  function setHoveredNode(nodeId: string | null): void {
    hoveredNodeId.value = nodeId;
  }

  /** Set selected node */
  function setSelectedNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId;
  }

  /** Set search query */
  function setSearchQuery(query: string): void {
    searchQuery.value = query;
    // Search is performed by the tree worker, results set via setSearchResults
  }

  /** Set search results */
  function setSearchResults(results: NodeSearchResult[]): void {
    searchResults.value = results;
  }

  /** Clear search */
  function clearSearch(): void {
    searchQuery.value = '';
    searchResults.value = [];
  }

  /** Set viewport position */
  function setViewportPosition(x: number, y: number): void {
    viewport.value.x = x;
    viewport.value.y = y;
  }

  /** Set viewport zoom */
  function setViewportZoom(zoom: number): void {
    viewport.value.zoom = Math.max(0.1, Math.min(3.0, zoom));
  }

  /** Pan viewport by delta */
  function panViewport(dx: number, dy: number): void {
    viewport.value.x += dx;
    viewport.value.y += dy;
  }

  /** Zoom viewport at point */
  function zoomViewportAt(x: number, y: number, zoomDelta: number): void {
    const oldZoom = viewport.value.zoom;
    const newZoom = Math.max(0.1, Math.min(3.0, oldZoom + zoomDelta));

    // Adjust position to zoom towards the point
    const zoomRatio = newZoom / oldZoom;
    viewport.value.x = x - (x - viewport.value.x) * zoomRatio;
    viewport.value.y = y - (y - viewport.value.y) * zoomRatio;
    viewport.value.zoom = newZoom;
  }

  /** Reset viewport to default */
  function resetViewport(): void {
    viewport.value = { x: 0, y: 0, zoom: 1.0 };
  }

  /** Center viewport on node */
  function centerOnNode(nodeId: string): void {
    const node = nodesById.value.get(nodeId);
    if (node?.position) {
      viewport.value.x = -node.position.x;
      viewport.value.y = -node.position.y;
    }
  }

  /** Set dragging state */
  function setDragging(dragging: boolean): void {
    isDragging.value = dragging;
  }

  /** Set highlighted path */
  function setHighlightedPath(path: string[]): void {
    highlightedPath.value = path;
  }

  /** Clear highlighted path */
  function clearHighlightedPath(): void {
    highlightedPath.value = [];
  }

  /** Set comparison node IDs */
  function setComparisonNodes(nodeIds: string[] | null): void {
    comparisonNodeIds.value = nodeIds;
  }

  /** Clear tree data */
  function clearTreeData(): void {
    treeData.value = null;
    hoveredNodeId.value = null;
    selectedNodeId.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    highlightedPath.value = [];
  }

  return {
    // State
    treeData,
    isLoading,
    loadError,
    hoveredNodeId,
    selectedNodeId,
    searchQuery,
    searchResults,
    viewport,
    isDragging,
    highlightedPath,
    comparisonNodeIds,

    // Getters
    isLoaded,
    nodesById,
    getNode,
    hoveredNode,
    selectedNode,
    allNodeIds,
    totalNodeCount,
    hasSearch,
    searchResultCount,

    // Actions
    setTreeData,
    setLoading,
    setLoadError,
    setHoveredNode,
    setSelectedNode,
    setSearchQuery,
    setSearchResults,
    clearSearch,
    setViewportPosition,
    setViewportZoom,
    panViewport,
    zoomViewportAt,
    resetViewport,
    centerOnNode,
    setDragging,
    setHighlightedPath,
    clearHighlightedPath,
    setComparisonNodes,
    clearTreeData,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTreeStore, import.meta.hot));
}
