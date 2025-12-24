// src/types/local/tree.local.ts
// UI-only state extensions for passive tree nodes
// These extend proto-generated types with local-only fields

import type { PassiveNode, NodeGroup } from 'src/protos/pob2_pb';

/**
 * Extended PassiveNode with UI state
 * Proto fields + local-only rendering/interaction state
 */
export interface LocalPassiveNode extends PassiveNode {
  // Rendering state
  /** Computed x position for rendering (may differ from proto position) */
  renderX?: number;
  /** Computed y position for rendering */
  renderY?: number;
  /** Current scale factor for animations */
  scale?: number;
  /** Current alpha/opacity */
  alpha?: number;

  // Interaction state
  /** Node is currently hovered */
  hovered?: boolean;
  /** Node is selected (for multi-select operations) */
  selected?: boolean;
  /** Node is part of current path preview */
  inPath?: boolean;
  /** Node can be allocated (has path from allocated node) */
  canAllocate?: boolean;
  /** Node is currently being highlighted (search result, etc.) */
  highlighted?: boolean;
  /** Search match score (for relevance sorting) */
  searchScore?: number;

  // Derived state (computed from build)
  /** Node is allocated in current build */
  allocated?: boolean;
  /** Is this node reachable from current allocations */
  reachable?: boolean;
  /** Distance from nearest allocated node (for pathfinding) */
  distanceFromAllocated?: number;
}

/**
 * Extended NodeGroup with UI state
 */
export interface LocalNodeGroup extends NodeGroup {
  /** Group is expanded (for cluster jewels) */
  expanded?: boolean;
  /** Group is visible in current viewport */
  visible?: boolean;
}

/**
 * Tree viewport state
 */
export interface TreeViewport {
  /** Current center X position */
  x: number;
  /** Current center Y position */
  y: number;
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Minimum zoom level */
  minZoom: number;
  /** Maximum zoom level */
  maxZoom: number;
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
}

/**
 * Tree selection state
 */
export interface TreeSelection {
  /** Currently hovered node ID */
  hoveredNodeId?: string;
  /** Currently selected node IDs (for multi-select) */
  selectedNodeIds: Set<string>;
  /** Nodes in current path preview */
  pathPreviewNodeIds: string[];
  /** Search query for highlighting */
  searchQuery?: string;
  /** Search result node IDs */
  searchResultNodeIds: string[];
}

/**
 * Tree rendering configuration
 */
export interface TreeRenderConfig {
  /** Show allocated nodes */
  showAllocated: boolean;
  /** Show unallocated nodes */
  showUnallocated: boolean;
  /** Show node connections */
  showConnections: boolean;
  /** Show mastery nodes */
  showMasteries: boolean;
  /** Show class start nodes */
  showClassStarts: boolean;
  /** Highlight keystones */
  highlightKeystones: boolean;
  /** Highlight notables */
  highlightNotables: boolean;
  /** Connection line width */
  connectionWidth: number;
  /** Node hover scale factor */
  hoverScale: number;
}

/**
 * Default tree render configuration
 */
export const DEFAULT_TREE_RENDER_CONFIG: TreeRenderConfig = {
  showAllocated: true,
  showUnallocated: true,
  showConnections: true,
  showMasteries: true,
  showClassStarts: true,
  highlightKeystones: true,
  highlightNotables: true,
  connectionWidth: 2,
  hoverScale: 1.1,
};
