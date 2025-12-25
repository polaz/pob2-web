// src/composables/useTreeRenderer.ts
// Composable for rendering passive tree nodes and connections

import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { Application } from 'pixi.js';
import type { PassiveNode, NodeGroup } from 'src/protos/pob2_pb';
import { useTreeStore } from 'src/stores/treeStore';
import type { TreeLayers } from 'src/composables/usePixiApp';
import { TreeNode } from 'src/components/tree/sprites/TreeNode';
import {
  getNodeSpriteManager,
  destroyNodeSpriteManager,
} from 'src/components/tree/sprites/NodeSprites';
import { MIN_ZOOM_FOR_CONNECTIONS } from 'src/components/tree/sprites/NodeTypes';
import {
  ConnectorBatchRenderer,
  type TreeConstants,
  type ConnectionStateContext,
} from 'src/components/tree/connectors';

// ============================================================================
// Types
// ============================================================================

/** Result of useTreeRenderer composable */
export interface UseTreeRendererResult {
  /** Whether the renderer is initialized */
  readonly isInitialized: Ref<boolean>;
  /** Number of nodes currently rendered */
  readonly nodeCount: Ref<number>;
  /** Number of connections currently rendered */
  readonly connectionCount: Ref<number>;
  /** Initialize the renderer with layers */
  initialize: (app: Application, layers: TreeLayers) => void;
  /** Render all nodes from tree data */
  renderNodes: () => void;
  /** Update node states (allocated, hovered, etc.) */
  updateNodeStates: (allocatedIds: Set<string>) => void;
  /** Update viewport (pan/zoom) */
  updateViewport: () => void;
  /** Center viewport on tree origin (0,0) */
  centerViewport: (canvasWidth: number, canvasHeight: number) => void;
  /** Get TreeNode by ID */
  getTreeNode: (nodeId: string) => TreeNode | undefined;
  /** Destroy the renderer */
  destroy: () => void;
}

// ============================================================================
// Composable
// ============================================================================

/**
 * Composable for rendering passive tree nodes and connections.
 *
 * Manages:
 * - Creating TreeNode instances for all passive nodes
 * - Rendering connections between nodes (straight lines and arcs)
 * - Updating node states from store
 * - Viewport transformations (pan/zoom)
 * - LOD updates based on zoom level
 *
 * @example
 * ```typescript
 * const { initialize, renderNodes, destroy } = useTreeRenderer();
 *
 * // When canvas is ready
 * function onCanvasReady(layers: TreeLayers) {
 *   initialize(app, layers);
 *   renderNodes();
 * }
 *
 * onUnmounted(() => {
 *   destroy();
 * });
 * ```
 */
export function useTreeRenderer(): UseTreeRendererResult {
  const treeStore = useTreeStore();

  // State
  const isInitialized = ref(false);
  const nodeCount = ref(0);
  const connectionCount = ref(0);

  // Internal references
  let app: Application | null = null;
  let layers: TreeLayers | null = null;
  const nodeMap: Map<string, TreeNode> = new Map();

  // Connector batch renderer
  let connectorRenderer: ConnectorBatchRenderer | null = null;

  // Watch cleanup functions
  const watchCleanups: Array<() => void> = [];

  /**
   * Initialize the renderer with PixiJS app and layers.
   */
  function initialize(pixiApp: Application, treeLayers: TreeLayers): void {
    if (isInitialized.value) {
      console.warn('[useTreeRenderer] Already initialized');
      return;
    }

    app = pixiApp;
    layers = treeLayers;

    // Initialize sprite manager
    const spriteManager = getNodeSpriteManager();
    spriteManager.initialize(app.renderer);

    // Initialize connector batch renderer
    connectorRenderer = new ConnectorBatchRenderer(layers.connections);

    // Setup store watchers
    setupWatchers();

    isInitialized.value = true;

    // Render if tree data is already loaded
    if (treeStore.isLoaded) {
      renderNodes();
    }
  }

  /**
   * Setup watchers for store state changes.
   */
  function setupWatchers(): void {
    // Watch for tree data changes
    const unwatchTree = watch(
      () => treeStore.treeData,
      (newTree) => {
        if (newTree) {
          renderNodes();
        }
      }
    );
    watchCleanups.push(unwatchTree);

    // Watch for viewport changes
    const unwatchViewport = watch(
      () => treeStore.viewport,
      () => {
        updateViewport();
      },
      { deep: true }
    );
    watchCleanups.push(unwatchViewport);

    // Watch for hovered node changes
    const unwatchHover = watch(
      () => treeStore.hoveredNodeId,
      (newId, oldId) => {
        if (oldId) {
          const oldNode = nodeMap.get(oldId);
          oldNode?.setHovered(false);
        }
        if (newId) {
          const newNode = nodeMap.get(newId);
          newNode?.setHovered(true);
        }
      }
    );
    watchCleanups.push(unwatchHover);

    // Watch for highlighted path changes
    const unwatchPath = watch(
      () => treeStore.highlightedPath,
      (newPath) => {
        updatePathHighlight(newPath, false);
      },
      { deep: true }
    );
    watchCleanups.push(unwatchPath);

    // Watch for alternate highlighted path changes
    const unwatchAltPath = watch(
      () => treeStore.alternateHighlightedPath,
      (newPath) => {
        updatePathHighlight(newPath, true);
      },
      { deep: true }
    );
    watchCleanups.push(unwatchAltPath);

    // Watch for search results
    const unwatchSearch = watch(
      () => treeStore.searchResults,
      (results) => {
        updateSearchHighlights(results.map((r) => r.nodeId));
      },
      { deep: true }
    );
    watchCleanups.push(unwatchSearch);
  }

  /**
   * Render all nodes from tree data.
   */
  function renderNodes(): void {
    if (!layers || !treeStore.treeData || !app) {
      return;
    }

    // Clear existing nodes
    clearNodes();

    const tree = treeStore.treeData;
    const nodes = tree.nodes;

    // Create TreeNode for each passive node
    for (const nodeData of nodes) {
      const treeNode = createTreeNode(nodeData);
      if (treeNode) {
        nodeMap.set(nodeData.id, treeNode);
        layers.nodes.addChild(treeNode);
      }
    }

    // Initialize and render connections
    if (connectorRenderer) {
      // Build tree constants from tree data
      const treeConstants = buildTreeConstants(tree.groups, tree.constants);

      // Initialize connector renderer with constants
      connectorRenderer.initialize(treeConstants, (id) => treeStore.getNode(id));

      // Build initial state context
      const stateContext = buildStateContext();

      // Build and render connections
      connectorRenderer.buildConnections(nodes, stateContext);
      connectionCount.value = connectorRenderer.getConnectionCount();
    }

    nodeCount.value = nodeMap.size;

    // Note: centering is done by caller after canvas is properly sized

    // Apply current viewport
    updateViewport();

    // Update LOD for current zoom
    updateLOD(treeStore.viewport.zoom);
  }

  /**
   * Build tree constants from proto data.
   */
  function buildTreeConstants(
    groups: NodeGroup[],
    constants?: { orbitRadii?: number[]; skillsPerOrbit?: number[] }
  ): TreeConstants {
    /** Base 10 for parsing node IDs from string to number */
    const DECIMAL_RADIX = 10;

    // Convert NodeGroup[] to the format expected by connector
    const groupData: TreeConstants['groups'] = groups.map((group) => {
      if (!group) return null;
      return {
        x: group.position?.x ?? 0,
        y: group.position?.y ?? 0,
        nodes: group.nodeIds?.map((id) => parseInt(id, DECIMAL_RADIX)) ?? [],
        orbits: [], // Not used for arc detection
      };
    });

    return {
      orbitRadii: constants?.orbitRadii ?? [],
      groups: groupData,
    };
  }

  /**
   * Build connection state context from current store state.
   *
   * Note: allocatedIds is currently empty. When build store provides allocated
   * node IDs, this should be updated to use them. Connection rendering will
   * still function correctly - all connections will appear as "Normal" state
   * until allocation data is available.
   */
  function buildStateContext(): ConnectionStateContext {
    return {
      allocatedIds: new Set<string>(),
      pathIds: new Set(treeStore.highlightedPath),
      alternatePathIds: new Set(treeStore.alternateHighlightedPath),
    };
  }

  /**
   * Center viewport on tree origin (0,0) at current zoom level.
   * The PoE passive tree is designed with origin at center.
   * @param canvasWidth - actual canvas width in pixels
   * @param canvasHeight - actual canvas height in pixels
   */
  function centerViewportOnTree(canvasWidth: number, canvasHeight: number): void {
    const zoom = treeStore.viewport.zoom;

    // Center viewport on tree origin (0,0)
    // Formula: screen position = tree position * zoom + viewport offset
    // To put origin at screen center: 0 * zoom + viewport = screenCenter
    // So: viewport = screenCenter
    const viewportX = canvasWidth / 2;
    const viewportY = canvasHeight / 2;

    if (import.meta.env.DEV) {
      console.log(`[TreeRenderer] Centering on origin (0,0), canvas: ${canvasWidth}x${canvasHeight}, viewport: (${viewportX.toFixed(1)}, ${viewportY.toFixed(1)}), zoom: ${zoom}`);
    }

    treeStore.setViewportPosition(viewportX, viewportY);
  }

  /**
   * Create a TreeNode from PassiveNode data.
   */
  function createTreeNode(nodeData: PassiveNode): TreeNode | null {
    // Skip nodes without position
    if (!nodeData.position) {
      return null;
    }

    const treeNode = new TreeNode(nodeData);

    // Setup interaction handlers
    treeNode.on('pointerenter', () => {
      treeStore.setHoveredNode(nodeData.id);
    });

    treeNode.on('pointerleave', () => {
      if (treeStore.hoveredNodeId === nodeData.id) {
        treeStore.setHoveredNode(null);
      }
    });

    treeNode.on('pointertap', () => {
      treeStore.setSelectedNode(nodeData.id);
    });

    return treeNode;
  }

  /**
   * Update node states based on allocated node IDs.
   */
  function updateNodeStates(allocatedIds: Set<string>): void {
    // First pass: update allocated state
    for (const [nodeId, treeNode] of nodeMap) {
      const isAllocated = allocatedIds.has(nodeId);
      treeNode.setAllocated(isAllocated);
    }

    // Second pass: update reachable state
    // A node is reachable if it's connected to an allocated node
    const reachableIds = computeReachableNodes(allocatedIds);
    for (const [nodeId, treeNode] of nodeMap) {
      if (!allocatedIds.has(nodeId)) {
        treeNode.setReachable(reachableIds.has(nodeId));
      }
    }

    // Update connection states
    if (connectorRenderer) {
      const stateContext: ConnectionStateContext = {
        allocatedIds,
        pathIds: new Set(treeStore.highlightedPath),
        alternatePathIds: new Set(treeStore.alternateHighlightedPath),
      };
      connectorRenderer.updateStates(stateContext);
    }
  }

  /**
   * Compute which nodes are reachable from allocated nodes.
   */
  function computeReachableNodes(allocatedIds: Set<string>): Set<string> {
    const reachable = new Set<string>();

    for (const allocatedId of allocatedIds) {
      const node = treeStore.getNode(allocatedId);
      if (!node?.linkedIds) continue;

      for (const linkedId of node.linkedIds) {
        if (!allocatedIds.has(linkedId)) {
          reachable.add(linkedId);
        }
      }
    }

    return reachable;
  }

  /**
   * Update path preview highlight.
   *
   * @param pathNodeIds - Node IDs in the path
   * @param _isAlternate - Whether this is an alternate path (reserved for future
   *   visual differentiation; currently both paths share the same node visual)
   */
  function updatePathHighlight(pathNodeIds: string[], _isAlternate: boolean): void {
    const pathSet = new Set(pathNodeIds);

    // Update node states
    // Note: Currently primary and alternate paths share the same in-path visual.
    // The _isAlternate parameter is preserved for potential future differentiation
    // (e.g., different glow colors or border styles for alternate path nodes).
    for (const [nodeId, treeNode] of nodeMap) {
      treeNode.setInPath(pathSet.has(nodeId));
    }

    // Update connection states
    if (connectorRenderer) {
      connectorRenderer.updateStates(buildStateContext());
    }
  }

  /**
   * Update search result highlights.
   */
  function updateSearchHighlights(searchNodeIds: string[]): void {
    const searchSet = new Set(searchNodeIds);

    for (const [nodeId, treeNode] of nodeMap) {
      treeNode.setState({ searchMatch: searchSet.has(nodeId) });
    }
  }

  /**
   * Update viewport transform (pan/zoom).
   */
  function updateViewport(): void {
    if (!layers) return;

    const { x, y, zoom } = treeStore.viewport;

    // Apply transform to nodes layer
    layers.nodes.position.set(x, y);
    layers.nodes.scale.set(zoom);

    // Apply transform to connections via batch renderer
    if (connectorRenderer) {
      const container = connectorRenderer.getContainer();
      container.position.set(x, y);
      container.scale.set(zoom);
      connectorRenderer.updateZoom(zoom);
    }

    // Update LOD based on zoom
    updateLOD(zoom);
  }

  /**
   * Update LOD (Level of Detail) for all nodes based on zoom.
   */
  function updateLOD(zoom: number): void {
    for (const treeNode of nodeMap.values()) {
      treeNode.updateLOD(zoom);
    }

    // Show/hide connections based on LOD
    if (layers) {
      // Hide connections at very low zoom for performance
      layers.connections.visible = zoom >= MIN_ZOOM_FOR_CONNECTIONS;
    }
  }

  /**
   * Get a TreeNode by ID.
   */
  function getTreeNode(nodeId: string): TreeNode | undefined {
    return nodeMap.get(nodeId);
  }

  /**
   * Clear all rendered nodes.
   */
  function clearNodes(): void {
    for (const treeNode of nodeMap.values()) {
      treeNode.destroy();
    }
    nodeMap.clear();
    nodeCount.value = 0;
  }

  /**
   * Destroy the renderer and clean up resources.
   */
  function destroy(): void {
    // Remove watchers
    for (const cleanup of watchCleanups) {
      cleanup();
    }
    watchCleanups.length = 0;

    // Clear nodes
    clearNodes();

    // Destroy connector renderer
    if (connectorRenderer) {
      connectorRenderer.destroy();
      connectorRenderer = null;
    }
    connectionCount.value = 0;

    // Destroy sprite manager
    destroyNodeSpriteManager();

    // Reset state
    app = null;
    layers = null;
    isInitialized.value = false;
  }

  // Clean up on unmount
  onUnmounted(() => {
    destroy();
  });

  return {
    isInitialized,
    nodeCount,
    connectionCount,
    initialize,
    renderNodes,
    updateNodeStates,
    updateViewport,
    centerViewport: centerViewportOnTree,
    getTreeNode,
    destroy,
  };
}
