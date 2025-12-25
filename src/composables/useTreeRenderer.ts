// src/composables/useTreeRenderer.ts
// Composable for rendering passive tree nodes

import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { Application } from 'pixi.js';
import { Graphics } from 'pixi.js';
import type { PassiveNode } from 'src/protos/pob2_pb';
import { useTreeStore } from 'src/stores/treeStore';
import type { TreeLayers } from 'src/composables/usePixiApp';
import { TreeNode } from 'src/components/tree/sprites/TreeNode';
import {
  getNodeSpriteManager,
  destroyNodeSpriteManager,
} from 'src/components/tree/sprites/NodeSprites';
import {
  NODE_COLORS,
  CONNECTION_ALPHAS,
  MIN_ZOOM_FOR_CONNECTIONS,
} from 'src/components/tree/sprites/NodeTypes';

// ============================================================================
// Types
// ============================================================================

/** Result of useTreeRenderer composable */
export interface UseTreeRendererResult {
  /** Whether the renderer is initialized */
  readonly isInitialized: Ref<boolean>;
  /** Number of nodes currently rendered */
  readonly nodeCount: Ref<number>;
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

/** Connection line data */
interface ConnectionLine {
  fromId: string;
  toId: string;
  graphics: Graphics;
}

// ============================================================================
// Connection Line Constants
// ============================================================================

const CONNECTION_WIDTH = 1;
const CONNECTION_ALLOCATED_WIDTH = 2;

// ============================================================================
// Composable
// ============================================================================

/**
 * Composable for rendering passive tree nodes and connections.
 *
 * Manages:
 * - Creating TreeNode instances for all passive nodes
 * - Rendering connections between nodes
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

  // Internal references
  let app: Application | null = null;
  let layers: TreeLayers | null = null;
  const nodeMap: Map<string, TreeNode> = new Map();
  let connectionLines: ConnectionLine[] = [];

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
        updatePathHighlight(newPath);
      },
      { deep: true }
    );
    watchCleanups.push(unwatchPath);

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

    // Render connections
    renderConnections(nodes);

    nodeCount.value = nodeMap.size;

    // Note: centering is done by caller after canvas is properly sized

    // Apply current viewport
    updateViewport();

    // Update LOD for current zoom
    updateLOD(treeStore.viewport.zoom);
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
   * Render connection lines between nodes.
   */
  function renderConnections(nodes: PassiveNode[]): void {
    if (!layers) return;

    // Clear existing connections
    clearConnections();

    // Build a set of rendered connections to avoid duplicates
    const renderedConnections = new Set<string>();

    for (const node of nodes) {
      if (!node.position || !node.linkedIds) continue;

      for (const linkedId of node.linkedIds) {
        // Create unique key for this connection (sorted to avoid duplicates)
        const connKey = [node.id, linkedId].sort().join('_');
        if (renderedConnections.has(connKey)) continue;
        renderedConnections.add(connKey);

        // Find the linked node
        const linkedNode = treeStore.getNode(linkedId);
        if (!linkedNode?.position) continue;

        // Create connection line
        const line = new Graphics();
        line.lineStyle(CONNECTION_WIDTH, NODE_COLORS.connectionNormal, CONNECTION_ALPHAS.normal);
        line.moveTo(node.position.x, node.position.y);
        line.lineTo(linkedNode.position.x, linkedNode.position.y);

        layers.connections.addChild(line);
        connectionLines.push({
          fromId: node.id,
          toId: linkedId,
          graphics: line,
        });
      }
    }
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

    // Update connection colors
    updateConnectionColors(allocatedIds);
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
   * Update connection line colors based on allocated state.
   */
  function updateConnectionColors(allocatedIds: Set<string>): void {
    for (const conn of connectionLines) {
      const fromAllocated = allocatedIds.has(conn.fromId);
      const toAllocated = allocatedIds.has(conn.toId);

      conn.graphics.clear();

      if (fromAllocated && toAllocated) {
        // Both nodes allocated - bright connection
        conn.graphics.lineStyle(CONNECTION_ALLOCATED_WIDTH, NODE_COLORS.connectionAllocated, CONNECTION_ALPHAS.allocated);
      } else {
        // Normal connection
        conn.graphics.lineStyle(CONNECTION_WIDTH, NODE_COLORS.connectionNormal, CONNECTION_ALPHAS.normal);
      }

      // Redraw the line
      const fromNode = treeStore.getNode(conn.fromId);
      const toNode = treeStore.getNode(conn.toId);
      if (fromNode?.position && toNode?.position) {
        conn.graphics.moveTo(fromNode.position.x, fromNode.position.y);
        conn.graphics.lineTo(toNode.position.x, toNode.position.y);
      }
    }
  }

  /**
   * Update path preview highlight.
   */
  function updatePathHighlight(pathNodeIds: string[]): void {
    const pathSet = new Set(pathNodeIds);

    // Update node states
    for (const [nodeId, treeNode] of nodeMap) {
      treeNode.setInPath(pathSet.has(nodeId));
    }

    // Update connection colors for path
    for (const conn of connectionLines) {
      const fromInPath = pathSet.has(conn.fromId);
      const toInPath = pathSet.has(conn.toId);

      if (fromInPath && toInPath) {
        // Both nodes in path - highlight connection
        conn.graphics.clear();
        conn.graphics.lineStyle(CONNECTION_ALLOCATED_WIDTH, NODE_COLORS.connectionPath, CONNECTION_ALPHAS.path);

        const fromNode = treeStore.getNode(conn.fromId);
        const toNode = treeStore.getNode(conn.toId);
        if (fromNode?.position && toNode?.position) {
          conn.graphics.moveTo(fromNode.position.x, fromNode.position.y);
          conn.graphics.lineTo(toNode.position.x, toNode.position.y);
        }
      }
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

    // Apply transform to both nodes and connections layers
    layers.nodes.position.set(x, y);
    layers.nodes.scale.set(zoom);

    layers.connections.position.set(x, y);
    layers.connections.scale.set(zoom);

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
   * Clear all connection lines.
   */
  function clearConnections(): void {
    for (const conn of connectionLines) {
      conn.graphics.destroy();
    }
    connectionLines = [];
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

    // Clear nodes and connections
    clearNodes();
    clearConnections();

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
    initialize,
    renderNodes,
    updateNodeStates,
    updateViewport,
    centerViewport: centerViewportOnTree,
    getTreeNode,
    destroy,
  };
}
