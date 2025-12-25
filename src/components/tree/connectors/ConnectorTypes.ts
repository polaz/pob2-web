// src/components/tree/connectors/ConnectorTypes.ts
// Types and constants for tree connection rendering

// ============================================================================
// Connection State
// ============================================================================

/**
 * Visual state of a connection between two nodes.
 * Determines color and rendering style.
 */
export enum ConnectionState {
  /** Neither node is allocated - gray, low opacity */
  Normal = 'normal',
  /** Both nodes are allocated - gold, full opacity */
  Allocated = 'allocated',
  /** One node allocated, one not - gradient effect */
  Intermediate = 'intermediate',
  /** Both nodes in primary path preview - blue */
  Path = 'path',
  /** Both nodes in alternate path preview - blended purple */
  AlternatePath = 'alternatePath',
}

/**
 * Geometric type of a connection.
 */
export enum ConnectionType {
  /** Direct line between nodes */
  Straight = 'straight',
  /** Curved arc for nodes on same orbit in same group */
  Arc = 'arc',
}

// ============================================================================
// Connection Colors
// ============================================================================

/** Color palette for connection rendering */
export const CONNECTION_COLORS = {
  /** Gray for unallocated connections */
  normal: 0x555555,
  /** Gold for allocated connections */
  allocated: 0xc4a000,
  /** Blue for primary path preview */
  path: 0x7cb3d9,
  /** Purple-blue blend for alternate path */
  alternatePath: 0x9b7cd9,
  /** Intermediate gradient endpoint (muted gold) */
  intermediateAllocated: 0xc4a000,
  /** Intermediate gradient endpoint (normal gray) */
  intermediateNormal: 0x555555,
} as const;

/** Alpha values for different connection states */
export const CONNECTION_ALPHAS = {
  /** Alpha for normal (unallocated) connections */
  normal: 0.5,
  /** Alpha for allocated connections */
  allocated: 1.0,
  /** Alpha for intermediate connections (allocated side) */
  intermediateAllocated: 0.9,
  /** Alpha for intermediate connections (normal side) */
  intermediateNormal: 0.6,
  /** Alpha for path preview connections */
  path: 0.9,
  /** Alpha for alternate path connections */
  alternatePath: 0.7,
} as const;

// ============================================================================
// Connection Geometry Constants
// ============================================================================

/** Line width for different states */
export const CONNECTION_WIDTHS = {
  /** Width for normal connections */
  normal: 2,
  /** Width for allocated connections */
  allocated: 3,
  /** Width for intermediate connections */
  intermediate: 2.5,
  /** Width for path preview */
  path: 3,
  /** Width for alternate path */
  alternatePath: 2.5,
} as const;

/**
 * Number of segments to use when drawing bezier arcs.
 * Higher = smoother but more geometry.
 * 8-12 is usually sufficient for smooth arcs.
 */
export const ARC_SEGMENTS = 10;

/**
 * Minimum arc angle (radians) to use bezier curve instead of straight line.
 * Very small arcs look better as straight lines.
 */
export const MIN_ARC_ANGLE = 0.1;

/**
 * Maximum arc angle (radians) for single bezier segment.
 * Larger arcs need multiple segments for accuracy.
 */
export const MAX_SINGLE_BEZIER_ANGLE = Math.PI / 2;

/**
 * Kappa constant for cubic bezier approximation of circular arc.
 * For a 90-degree arc: 4 * (sqrt(2) - 1) / 3 ≈ 0.5522847498
 */
export const BEZIER_KAPPA = 0.5522847498;

/** Minimum zoom level below which connections are hidden for performance */
export const MIN_ZOOM_FOR_CONNECTIONS = 0.15;

/** Minimum zoom for showing arc detail (below this, use straight lines) */
export const MIN_ZOOM_FOR_ARCS = 0.25;

// ============================================================================
// Data Types
// ============================================================================

/** 2D point coordinates */
export interface Point {
  x: number;
  y: number;
}

/** Arc geometry data for curved connections */
export interface ArcData {
  /** Center X of the orbit circle */
  centerX: number;
  /** Center Y of the orbit circle */
  centerY: number;
  /** Radius of the orbit */
  radius: number;
  /** Start angle in radians */
  startAngle: number;
  /** End angle in radians */
  endAngle: number;
  /** Whether to draw clockwise (true) or counter-clockwise (false) */
  clockwise: boolean;
}

/** Cubic bezier control points */
export interface BezierCurve {
  /** Start point */
  p0: Point;
  /** First control point */
  p1: Point;
  /** Second control point */
  p2: Point;
  /** End point */
  p3: Point;
}

/**
 * Complete connection data for rendering.
 */
export interface ConnectionData {
  /** Unique identifier for this connection */
  id: string;
  /** Source node ID */
  fromId: string;
  /** Target node ID */
  toId: string;
  /** Source node position */
  from: Point;
  /** Target node position */
  to: Point;
  /** Geometric type */
  type: ConnectionType;
  /** Arc data if type is Arc */
  arcData?: ArcData;
  /** Pre-computed bezier curves for arc (multiple for large arcs) */
  bezierCurves?: BezierCurve[];
  /** Current visual state */
  state: ConnectionState;
  /** Group ID (for arc detection) */
  groupId?: number;
  /** Orbit level (for arc detection) */
  orbit?: number;
}

/**
 * Connection rendering configuration.
 */
export interface ConnectionRenderConfig {
  /** Enable arc rendering (vs all straight lines) */
  enableArcs: boolean;
  /** Enable gradient for intermediate connections */
  enableGradients: boolean;
  /** Enable alternate path rendering */
  enableAlternatePath: boolean;
  /** Custom color overrides */
  colors?: Partial<typeof CONNECTION_COLORS>;
  /** Custom alpha overrides */
  alphas?: Partial<typeof CONNECTION_ALPHAS>;
  /** Custom width overrides */
  widths?: Partial<typeof CONNECTION_WIDTHS>;
}

/** Default render configuration */
export const DEFAULT_CONNECTION_CONFIG: ConnectionRenderConfig = {
  enableArcs: true,
  enableGradients: true,
  enableAlternatePath: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the color for a connection state.
 */
export function getConnectionColor(
  state: ConnectionState,
  config?: Partial<Record<keyof typeof CONNECTION_COLORS, number>>
): number {
  const colors = { ...CONNECTION_COLORS, ...config };
  switch (state) {
    case ConnectionState.Allocated:
      return colors.allocated;
    case ConnectionState.Path:
      return colors.path;
    case ConnectionState.AlternatePath:
      return colors.alternatePath;
    case ConnectionState.Intermediate:
      return colors.intermediateAllocated;
    case ConnectionState.Normal:
    default:
      return colors.normal;
  }
}

/**
 * Get the alpha for a connection state.
 */
export function getConnectionAlpha(
  state: ConnectionState,
  config?: Partial<Record<keyof typeof CONNECTION_ALPHAS, number>>
): number {
  const alphas = { ...CONNECTION_ALPHAS, ...config };
  switch (state) {
    case ConnectionState.Allocated:
      return alphas.allocated;
    case ConnectionState.Path:
      return alphas.path;
    case ConnectionState.AlternatePath:
      return alphas.alternatePath;
    case ConnectionState.Intermediate:
      return alphas.intermediateAllocated;
    case ConnectionState.Normal:
    default:
      return alphas.normal;
  }
}

/**
 * Get the line width for a connection state.
 */
export function getConnectionWidth(
  state: ConnectionState,
  config?: Partial<Record<keyof typeof CONNECTION_WIDTHS, number>>
): number {
  const widths = { ...CONNECTION_WIDTHS, ...config };
  switch (state) {
    case ConnectionState.Allocated:
      return widths.allocated;
    case ConnectionState.Path:
      return widths.path;
    case ConnectionState.AlternatePath:
      return widths.alternatePath;
    case ConnectionState.Intermediate:
      return widths.intermediate;
    case ConnectionState.Normal:
    default:
      return widths.normal;
  }
}

/**
 * Create a unique connection ID from two node IDs.
 * Sorted to ensure consistency regardless of direction.
 */
export function createConnectionId(nodeA: string, nodeB: string): string {
  return [nodeA, nodeB].sort().join('_');
}

/**
 * Determine the connection state based on node allocation and path states.
 */
export function determineConnectionState(
  fromAllocated: boolean,
  toAllocated: boolean,
  fromInPath: boolean,
  toInPath: boolean,
  fromInAltPath: boolean,
  toInAltPath: boolean
): ConnectionState {
  // Path states take precedence over allocation
  if (fromInPath && toInPath) {
    return ConnectionState.Path;
  }
  if (fromInAltPath && toInAltPath) {
    return ConnectionState.AlternatePath;
  }

  // Allocation states
  if (fromAllocated && toAllocated) {
    return ConnectionState.Allocated;
  }
  if (fromAllocated || toAllocated) {
    return ConnectionState.Intermediate;
  }

  return ConnectionState.Normal;
}
