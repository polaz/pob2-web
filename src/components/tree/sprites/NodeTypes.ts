// src/components/tree/sprites/NodeTypes.ts
// Constants and type definitions for passive tree node rendering

import { NodeType } from 'src/protos/pob2_pb';

// ============================================================================
// Node Size Constants
// ============================================================================

/** Base size in pixels for each node type at zoom level 1.0 */
export const NODE_SIZES: Record<NodeType, number> = {
  [NodeType.NODE_TYPE_UNKNOWN]: 24,
  [NodeType.NODE_NORMAL]: 24,
  [NodeType.NODE_NOTABLE]: 38,
  [NodeType.NODE_KEYSTONE]: 52,
  [NodeType.NODE_MASTERY]: 40,
  [NodeType.NODE_SOCKET]: 44,
  [NodeType.NODE_CLASS_START]: 48,
  [NodeType.NODE_ASCEND_CLASS_START]: 42,
};

/** Frame/border thickness for each node type */
export const NODE_FRAME_WIDTHS: Record<NodeType, number> = {
  [NodeType.NODE_TYPE_UNKNOWN]: 2,
  [NodeType.NODE_NORMAL]: 2,
  [NodeType.NODE_NOTABLE]: 3,
  [NodeType.NODE_KEYSTONE]: 4,
  [NodeType.NODE_MASTERY]: 2,
  [NodeType.NODE_SOCKET]: 3,
  [NodeType.NODE_CLASS_START]: 3,
  [NodeType.NODE_ASCEND_CLASS_START]: 3,
};

// ============================================================================
// Node Colors
// ============================================================================

/** Color palette for node rendering */
export const NODE_COLORS = {
  // Background colors
  unallocatedBg: 0x2a2a3e,
  allocatedBg: 0xc4a000,
  hoverBg: 0x4a4a5e,
  reachableBg: 0x3a3a4e,
  pathPreviewBg: 0x5a7a9a,

  // Frame colors
  normalFrame: 0x8b8b8b,
  notableFrame: 0xb8860b,
  keystoneFrame: 0xffd700,
  masteryFrame: 0x9370db,
  socketFrame: 0x87ceeb,
  classStartFrame: 0x32cd32,
  ascendancyFrame: 0xff6347,

  // State overlay colors
  allocatedGlow: 0xffd700,
  hoverGlow: 0x87ceeb,
  selectedGlow: 0x00ff00,
  searchHighlight: 0xff69b4,
  pathPreviewGlow: 0x7cb3d9,

  // Connection colors
  connectionNormal: 0x555555,
  connectionAllocated: 0xc4a000,
  connectionPath: 0x7cb3d9,
} as const;

/** Alpha values for different states */
export const NODE_ALPHAS = {
  unallocated: 0.6,
  allocated: 1.0,
  reachable: 0.8,
  unreachable: 0.3,
  hovered: 1.0,
  pathPreview: 0.9,
} as const;

/** Connection line alpha values */
export const CONNECTION_ALPHAS = {
  /** Alpha for normal (unallocated) connections */
  normal: 0.6,
  /** Alpha for allocated connections */
  allocated: 1.0,
  /** Alpha for path preview connections */
  path: 0.9,
} as const;

// ============================================================================
// Rendering Constants
// ============================================================================

/** Size multipliers for different texture sizes */
export const SIZE_MULTIPLIERS = {
  /** Size multiplier for small textures (used at low zoom) */
  small: 0.5,
  /** Size multiplier for medium textures (default) */
  medium: 1.0,
  /** Size multiplier for large textures (used at high zoom) */
  large: 1.5,
} as const;

/** Glow effect constants */
export const GLOW_CONSTANTS = {
  /** Size multiplier for glow effect relative to node size */
  sizeMultiplier: 1.5,
  /** Number of gradient steps for glow effect */
  gradientSteps: 5,
  /** Maximum alpha for glow effect center */
  maxAlpha: 0.3,
} as const;

/**
 * Maximum polygon sides before rendering as circle.
 * Shapes with more sides are rendered as circles for performance.
 */
export const MAX_POLYGON_SIDES = 8;

/** Hit area constants for node interaction */
export const HIT_AREA = {
  /** Extra padding around nodes for easier clicking */
  padding: 4,
} as const;

/** Node label rendering constants */
export const LABEL_CONSTANTS = {
  /** Font size for node labels in pixels */
  fontSize: 10,
  /** Maximum width for label text wrapping */
  maxWidth: 80,
  /** Vertical offset from node center to label */
  verticalOffset: 4,
} as const;

/** Highlight effect constants for selected/search nodes */
export const HIGHLIGHT_CONSTANTS = {
  /** Line width for highlight border */
  lineWidth: 3,
  /** Alpha for highlight border */
  alpha: 0.8,
  /** Radius offset for highlight circle */
  radiusOffset: 4,
} as const;

/** Minimum zoom level below which connections are hidden for performance */
export const MIN_ZOOM_FOR_CONNECTIONS = 0.15;

/**
 * Small offset added to LOD minZoom when calculating node size.
 * This ensures we use the size for the current LOD level rather than
 * potentially falling into a lower LOD bracket at exact boundaries.
 * For example, at zoom 0.3 (boundary between minimal and medium LOD),
 * adding 0.1 ensures we use medium LOD sizing (0.4) not minimal (0.3).
 */
export const LOD_ZOOM_SIZE_OFFSET = 0.1;

// ============================================================================
// LOD (Level of Detail) Configuration
// ============================================================================

/**
 * Level of Detail configuration.
 * Controls what gets rendered at different zoom levels for performance.
 */
export interface LODLevel {
  /** Minimum zoom level for this LOD */
  minZoom: number;
  /** Maximum zoom level for this LOD */
  maxZoom: number;
  /** Show node icons/sprites */
  showIcons: boolean;
  /** Show node text labels */
  showLabels: boolean;
  /** Show glow effects */
  showGlows: boolean;
  /** Show frame details */
  showFrameDetails: boolean;
  /** Size multiplier for this LOD level */
  sizeMultiplier: number;
}

/** LOD levels from low detail (zoomed out) to high detail (zoomed in) */
export const LOD_LEVELS: LODLevel[] = [
  {
    // Minimal - zoomed way out, just dots
    minZoom: 0,
    maxZoom: 0.3,
    showIcons: false,
    showLabels: false,
    showGlows: false,
    showFrameDetails: false,
    sizeMultiplier: 0.5,
  },
  {
    // Medium - basic shapes
    minZoom: 0.3,
    maxZoom: 0.6,
    showIcons: false,
    showLabels: false,
    showGlows: false,
    showFrameDetails: true,
    sizeMultiplier: 0.75,
  },
  {
    // Full - all details visible
    minZoom: 0.6,
    maxZoom: Infinity,
    showIcons: true,
    showLabels: true,
    showGlows: true,
    showFrameDetails: true,
    sizeMultiplier: 1.0,
  },
];

/**
 * Get the appropriate LOD level for a given zoom level.
 */
export function getLODLevel(zoom: number): LODLevel {
  for (const level of LOD_LEVELS) {
    if (zoom >= level.minZoom && zoom < level.maxZoom) {
      return level;
    }
  }
  // Fallback to full detail
  return LOD_LEVELS[LOD_LEVELS.length - 1]!;
}

// ============================================================================
// Node State
// ============================================================================

/** State flags for a tree node */
export interface NodeState {
  /** Node is allocated in the current build */
  allocated: boolean;
  /** Node is currently hovered */
  hovered: boolean;
  /** Node is in the highlighted path preview */
  inPath: boolean;
  /** Node can be allocated (has connection to allocated node) */
  reachable: boolean;
  /** Node is selected (for multi-select) */
  selected: boolean;
  /** Node matches current search query */
  searchMatch: boolean;
}

/** Default node state */
export const DEFAULT_NODE_STATE: NodeState = {
  allocated: false,
  hovered: false,
  inPath: false,
  reachable: false,
  selected: false,
  searchMatch: false,
};

// ============================================================================
// Animation Constants
// ============================================================================

/** Animation timing constants */
export const NODE_ANIMATION = {
  /** Duration for hover scale animation in ms */
  hoverDuration: 100,
  /** Duration for allocation state change in ms */
  allocationDuration: 200,
  /** Duration for glow pulse in ms */
  glowPulseDuration: 1000,
  /** Scale factor when hovered */
  hoverScale: 1.15,
  /** Scale factor for glow pulse (min/max) */
  glowPulseScale: { min: 0.9, max: 1.1 },
} as const;

// ============================================================================
// Rendering Configuration
// ============================================================================

/** Configuration for node rendering */
export interface NodeRenderConfig {
  /** Base scale for all nodes */
  baseScale: number;
  /** Whether to show allocated nodes */
  showAllocated: boolean;
  /** Whether to show unallocated nodes */
  showUnallocated: boolean;
  /** Whether to enable glow effects */
  enableGlows: boolean;
  /** Whether to enable animations */
  enableAnimations: boolean;
}

/** Default render configuration */
export const DEFAULT_RENDER_CONFIG: NodeRenderConfig = {
  baseScale: 1.0,
  showAllocated: true,
  showUnallocated: true,
  enableGlows: true,
  enableAnimations: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the size for a node type at a given zoom level.
 */
export function getNodeSize(nodeType: NodeType, zoom: number): number {
  const baseSize = NODE_SIZES[nodeType] ?? NODE_SIZES[NodeType.NODE_NORMAL];
  const lod = getLODLevel(zoom);
  return baseSize * lod.sizeMultiplier;
}

/**
 * Get the frame color for a node type.
 */
export function getNodeFrameColor(nodeType: NodeType): number {
  switch (nodeType) {
    case NodeType.NODE_NOTABLE:
      return NODE_COLORS.notableFrame;
    case NodeType.NODE_KEYSTONE:
      return NODE_COLORS.keystoneFrame;
    case NodeType.NODE_MASTERY:
      return NODE_COLORS.masteryFrame;
    case NodeType.NODE_SOCKET:
      return NODE_COLORS.socketFrame;
    case NodeType.NODE_CLASS_START:
      return NODE_COLORS.classStartFrame;
    case NodeType.NODE_ASCEND_CLASS_START:
      return NODE_COLORS.ascendancyFrame;
    default:
      return NODE_COLORS.normalFrame;
  }
}

/**
 * Get the background color based on node state.
 */
export function getNodeBackgroundColor(state: NodeState): number {
  if (state.allocated) {
    return NODE_COLORS.allocatedBg;
  }
  if (state.hovered) {
    return NODE_COLORS.hoverBg;
  }
  if (state.inPath) {
    return NODE_COLORS.pathPreviewBg;
  }
  if (state.reachable) {
    return NODE_COLORS.reachableBg;
  }
  return NODE_COLORS.unallocatedBg;
}

/**
 * Get the alpha value based on node state.
 */
export function getNodeAlpha(state: NodeState): number {
  if (state.hovered) {
    return NODE_ALPHAS.hovered;
  }
  if (state.allocated) {
    return NODE_ALPHAS.allocated;
  }
  if (state.inPath) {
    return NODE_ALPHAS.pathPreview;
  }
  if (state.reachable) {
    return NODE_ALPHAS.reachable;
  }
  return NODE_ALPHAS.unreachable;
}

/**
 * Check if a node type is a special node (not normal).
 */
export function isSpecialNode(nodeType: NodeType): boolean {
  return (
    nodeType === NodeType.NODE_NOTABLE ||
    nodeType === NodeType.NODE_KEYSTONE ||
    nodeType === NodeType.NODE_MASTERY ||
    nodeType === NodeType.NODE_SOCKET
  );
}

/**
 * Check if a node type is an ascendancy-related node.
 */
export function isAscendancyNode(nodeType: NodeType): boolean {
  return nodeType === NodeType.NODE_ASCEND_CLASS_START;
}

/**
 * Get the number of sides for a node shape (for polygon rendering).
 * - Normal: Circle (many sides)
 * - Notable: Diamond/octagon
 * - Keystone: Octagon
 * - Others: Circle
 */
export function getNodeShapeSides(nodeType: NodeType): number {
  switch (nodeType) {
    case NodeType.NODE_NOTABLE:
      return 4; // Diamond
    case NodeType.NODE_KEYSTONE:
      return 8; // Octagon
    default:
      return 32; // Circle approximation
  }
}
