// src/components/tree/sprites/NodeTypes.ts
// Constants and type definitions for passive tree node rendering

import { NodeType } from 'src/protos/pob2_pb';

// ============================================================================
// Node Size Constants
// ============================================================================

/**
 * Base size in world units for each node type.
 * These match the tree coordinate system spacing.
 * Scaled by zoom and clamped to [MIN_NODE_SIZE, MAX_NODE_SIZE].
 */
export const NODE_SIZES: Record<NodeType, number> = {
  [NodeType.NODE_TYPE_UNKNOWN]: 12,
  [NodeType.NODE_NORMAL]: 12,
  [NodeType.NODE_NOTABLE]: 15,
  [NodeType.NODE_KEYSTONE]: 18,
  [NodeType.NODE_MASTERY]: 15,
  [NodeType.NODE_SOCKET]: 16,
  [NodeType.NODE_CLASS_START]: 16,
  [NodeType.NODE_ASCEND_CLASS_START]: 15,
};

/** Frame/border thickness for each node type */
export const NODE_FRAME_WIDTHS: Record<NodeType, number> = {
  [NodeType.NODE_TYPE_UNKNOWN]: 0.5,
  [NodeType.NODE_NORMAL]: 0.5,
  [NodeType.NODE_NOTABLE]: 0.75,
  [NodeType.NODE_KEYSTONE]: 1,
  [NodeType.NODE_MASTERY]: 0.5,
  [NodeType.NODE_SOCKET]: 0.75,
  [NodeType.NODE_CLASS_START]: 0.75,
  [NodeType.NODE_ASCEND_CLASS_START]: 0.75,
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
  padding: 2,
} as const;

/** Node label rendering constants (in rem units) */
export const LABEL_CONSTANTS = {
  /** Font size in rem (relative to root font size, typically 16px) */
  fontSizeRem: 0.75,
  /** Maximum width for label text wrapping in rem */
  maxWidthRem: 8,
  /** Vertical offset from node center to label in rem */
  verticalOffsetRem: 0.25,
} as const;

/** Get root font size in pixels (for rem conversion) */
function getRootFontSize(): number {
  if (typeof document === 'undefined') return 16; // SSR fallback
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** Get font size in pixels (converted from rem) */
export function getLabelFontSize(): number {
  return LABEL_CONSTANTS.fontSizeRem * getRootFontSize();
}

/** Get max width in pixels (converted from rem) */
export function getLabelMaxWidth(): number {
  return LABEL_CONSTANTS.maxWidthRem * getRootFontSize();
}

/** Get vertical offset in pixels (converted from rem) */
export function getLabelVerticalOffset(): number {
  return LABEL_CONSTANTS.verticalOffsetRem * getRootFontSize();
}

/** Highlight effect constants for selected/search nodes */
export const HIGHLIGHT_CONSTANTS = {
  /** Line width for highlight border */
  lineWidth: 1.5,
  /** Alpha for highlight border */
  alpha: 0.8,
  /** Radius offset for highlight circle */
  radiusOffset: 2,
} as const;

/** Minimum zoom level below which connections are hidden for performance */
export const MIN_ZOOM_FOR_CONNECTIONS = 0.15;

/**
 * Minimum node size in screen pixels.
 * Nodes cannot be smaller than this - ensures clickability and readability.
 */
export const MIN_NODE_SIZE = 24;

/**
 * Maximum node size in screen pixels.
 * Prevents nodes from becoming too large on high-DPI monitors.
 */
export const MAX_NODE_SIZE = 64;

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

/**
 * LOD levels from low detail (zoomed out) to high detail (zoomed in).
 * Size multipliers are close to 1.0 since zoom handles main scaling.
 * At ZOOM_MIN (0.85), nodes are already at minimum clickable size.
 */
export const LOD_LEVELS: LODLevel[] = [
  {
    // Minimal - zoomed out, simple shapes only
    minZoom: 0,
    maxZoom: 1.2,
    showIcons: false,
    showLabels: false,
    showGlows: false,
    showFrameDetails: false,
    sizeMultiplier: 1.0, // Full size - zoom handles scaling
  },
  {
    // Medium - basic shapes with frames
    minZoom: 1.2,
    maxZoom: 2.0,
    showIcons: false,
    showLabels: false,
    showGlows: false,
    showFrameDetails: true,
    sizeMultiplier: 1.0,
  },
  {
    // High - full detail with icons and glows
    minZoom: 2.0,
    maxZoom: Infinity,
    showIcons: true,
    showLabels: false, // Labels disabled - shown on hover only
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
 * Get the screen size for a node type at a given zoom level.
 * Node size scales linearly with zoom but is clamped to [MIN_NODE_SIZE, MAX_NODE_SIZE].
 * This ensures:
 * - Nodes are always readable (≥24px)
 * - Nodes don't become too large on high-DPI monitors (≤64px)
 */
export function getNodeSize(nodeType: NodeType, zoom: number): number {
  const baseSize = NODE_SIZES[nodeType] ?? NODE_SIZES[NodeType.NODE_NORMAL];
  const scaledSize = baseSize * zoom;
  return Math.max(MIN_NODE_SIZE, Math.min(MAX_NODE_SIZE, scaledSize));
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
 * - Notable: Diamond (4 sides)
 * - Others: Circle (uses PixiJS circle() when sides > MAX_POLYGON_SIDES)
 */
export function getNodeShapeSides(nodeType: NodeType): number {
  switch (nodeType) {
    case NodeType.NODE_NOTABLE:
      return 4; // Diamond
    default:
      return 32; // Circle - will use circle() since 32 > MAX_POLYGON_SIDES
  }
}
