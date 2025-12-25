/**
 * Tree Store - manages passive tree UI state
 */
import { ref, computed, shallowRef } from 'vue';
import { defineStore, acceptHMRUpdate } from 'pinia';
import type { PassiveTree, PassiveNode } from 'src/protos/pob2_pb';
import { NgramIndex } from 'src/services/search';
import type { SearchableDocument } from 'src/services/search';

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

/** Zoom limits for tree viewport */
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 5.0;
const ZOOM_DEFAULT = 2.0; // Start zoomed in showing central area like in-game

/** Minimum query length for n-gram search */
const MIN_QUERY_LENGTH = 2;

/** Maximum search results */
const MAX_SEARCH_RESULTS = 50;

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
    zoom: ZOOM_DEFAULT,
  });

  /** Whether tree is being dragged */
  const isDragging = ref(false);

  /** Highlighted path (for pathfinding preview) */
  const highlightedPath = shallowRef<string[]>([]);

  /** Comparison mode - show diff between two builds */
  const comparisonNodeIds = shallowRef<string[] | null>(null);

  /** N-gram search index for nodes */
  const nodeSearchIndex = new NgramIndex({ ngramSize: 3, minQueryLength: MIN_QUERY_LENGTH });

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

  /**
   * Get node by ID.
   *
   * This is a regular function (not a computed) by design for performance.
   * Use cases like mouse event handlers need immediate synchronous lookups
   * without the overhead of creating reactive subscriptions. The underlying
   * nodesById computed is already cached and reactive, so changes to treeData
   * will still produce updated results.
   *
   * For reactive bindings in templates, use hoveredNode/selectedNode computeds.
   */
  function getNode(nodeId: string): PassiveNode | undefined {
    return nodesById.value.get(nodeId);
  }

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

  /**
   * All node IDs as an array.
   *
   * Note: Creates a new array on each access. This is acceptable given:
   * - PoE2 tree has ~1500 nodes (small dataset)
   * - Computed caching prevents recalculation unless treeData changes
   * - Primary use is iteration, not frequent random access
   *
   * For O(1) key existence checks, use nodesById.value.has(id) directly.
   */
  const allNodeIds = computed(() => {
    return Array.from(nodesById.value.keys());
  });

  /** Total node count - uses Map.size directly for O(1) access */
  const totalNodeCount = computed(() => nodesById.value.size);

  /** Has active search */
  const hasSearch = computed(() => searchQuery.value.length > 0);

  /** Search result count */
  const searchResultCount = computed(() => searchResults.value.length);

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Set tree data and build the search index.
   */
  function setTreeData(tree: PassiveTree): void {
    treeData.value = tree;
    loadError.value = null;

    // Build search index for nodes
    const documents: SearchableDocument[] = tree.nodes.map((node) => ({
      id: node.id,
      type: 'node' as const,
      fields: {
        name: node.name ?? '',
        stats: node.stats?.join(' ') ?? '',
      },
    }));

    nodeSearchIndex.build(documents);
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

  /**
   * Set search query and perform n-gram indexed search.
   *
   * Uses fuzzy n-gram matching for better search experience.
   */
  function setSearchQuery(query: string): void {
    searchQuery.value = query;

    if (query.length === 0) {
      searchResults.value = [];
      return;
    }

    // For short queries (< MIN_QUERY_LENGTH), n-gram index returns empty
    if (query.length < MIN_QUERY_LENGTH) {
      searchResults.value = [];
      return;
    }

    // Use n-gram index for search
    const indexResults = nodeSearchIndex.search(query, { limit: MAX_SEARCH_RESULTS });

    // Convert to NodeSearchResult format
    const results: NodeSearchResult[] = [];
    for (const result of indexResults) {
      const node = nodesById.value.get(result.id);
      if (!node) continue;

      results.push({
        nodeId: result.id,
        node,
        matchType: result.matchedField === 'name' ? 'name' : 'stat',
        matchText: result.matchedText,
      });
    }

    searchResults.value = results;
  }

  /**
   * Set search results directly.
   * @deprecated Use setSearchQuery instead - search is now performed automatically
   */
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
    viewport.value.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  }

  /** Pan viewport by delta */
  function panViewport(dx: number, dy: number): void {
    viewport.value.x += dx;
    viewport.value.y += dy;
  }

  /** Zoom viewport at point */
  function zoomViewportAt(x: number, y: number, zoomDelta: number): void {
    const oldZoom = viewport.value.zoom;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZoom + zoomDelta));

    // Adjust position to zoom towards the point
    const zoomRatio = newZoom / oldZoom;
    viewport.value.x = x - (x - viewport.value.x) * zoomRatio;
    viewport.value.y = y - (y - viewport.value.y) * zoomRatio;
    viewport.value.zoom = newZoom;
  }

  /** Reset viewport to default */
  function resetViewport(): void {
    viewport.value = { x: 0, y: 0, zoom: ZOOM_DEFAULT };
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

  /** Clear tree data and reset all tree-related state */
  function clearTreeData(): void {
    treeData.value = null;
    hoveredNodeId.value = null;
    selectedNodeId.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    highlightedPath.value = [];
    comparisonNodeIds.value = null;
    loadError.value = null;
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
