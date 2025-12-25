// src/types/tree.ts
// Types for PoE2 passive skill tree data
// Source: PathOfBuildingCommunity/PathOfBuilding-PoE2

/**
 * Node type in the passive tree
 */
export type TreeNodeType = 'normal' | 'notable' | 'keystone' | 'mastery';

/**
 * Raw node data from tree JSON
 */
export interface RawTreeNode {
  id: string;
  name: string | null;
  type: TreeNodeType;
  x: number;
  y: number;
  neighbors: string[];
  stats: string[];
  icon: string | null;
  group: number;
  orbit?: number;
  orbitIndex?: number;
  // Ascendancy info
  ascendancy: string | null;
  isAscendancyStart: boolean;
  // Class start info
  classStartIndex?: number;
  // Mastery info
  isMastery: boolean;
  masteryEffects?: unknown;
}

/**
 * Class definition with ascendancy info
 */
export interface TreeClass {
  id: string;
  startNodeId: string | null;
  ascendancies: string[];
}

/**
 * Ascendancy definition
 */
export interface TreeAscendancy {
  id: string;
  class: string;
  startNodeId: string | null;
}

/**
 * Metadata for the tree data file
 */
export interface TreeMeta {
  totalNodes: number;
  normalNodes: number;
  notableNodes: number;
  keystoneNodes: number;
  masteryNodes: number;
  ascendancyNodes: number;
  classStartNodes: number;
  totalEdges: number;
}

/**
 * Bounds of the tree in coordinate space
 */
export interface TreeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Group data for node positioning.
 * Note: nodes array contains numeric indices matching the source data format.
 * Convert to string IDs when looking up in TreeData.nodes Map.
 */
export interface TreeGroup {
  x: number;
  y: number;
  /** Numeric node indices - use String(index) for TreeData.nodes lookup */
  nodes: number[];
  orbits?: number[];
}

/**
 * Complete raw tree data structure from JSON file
 */
export interface RawTreeData {
  version: string;
  extractedAt: string;
  source: string;
  meta: TreeMeta;
  bounds: TreeBounds;
  classes: Record<string, TreeClass>;
  ascendancies: Record<string, TreeAscendancy>;
  nodes: Record<string, RawTreeNode>;
  groups: Array<TreeGroup | null>;
  constants: TreeConstants;
}

/**
 * Tree constants for orbit calculations
 */
export interface TreeConstants {
  orbitRadii: number[];
  skillsPerOrbit: number[];
  PSSCentreInnerRadius?: number;
  orbitAnglesByOrbit?: number[][];
}

/**
 * Optimized node for graph traversal
 * Same as RawTreeNode but with Set for faster neighbor lookups
 */
export interface TreeNode {
  id: string;
  name: string | null;
  type: TreeNodeType;
  x: number;
  y: number;
  neighbors: Set<string>;
  stats: string[];
  icon: string | null;
  ascendancy: string | null;
  isAscendancyStart: boolean;
  isMastery: boolean;
}

/**
 * Optimized tree data for runtime operations.
 *
 * Note: RawTreeData.groups and RawTreeData.constants are intentionally excluded.
 * These fields are only needed for initial node positioning during tree rendering
 * setup, not for runtime graph operations. The x/y coordinates are pre-computed
 * in each TreeNode, so groups/constants become redundant after conversion.
 */
export interface TreeData {
  version: string;
  extractedAt: Date;
  source: string;
  meta: TreeMeta;
  bounds: TreeBounds;
  classes: Map<string, TreeClass>;
  ascendancies: Map<string, TreeAscendancy>;
  nodes: Map<string, TreeNode>;
}

/**
 * Result of pathfinding operations
 */
export interface PathResult {
  /** Ordered list of node IDs from start to end */
  path: string[];
  /** Total number of nodes in path */
  length: number;
  /** Whether a valid path was found */
  found: boolean;
}

/**
 * Result of reachability check
 */
export interface ReachabilityResult {
  /** Set of reachable node IDs */
  reachable: Set<string>;
  /** Distance from starting nodes to each reachable node */
  distances: Map<string, number>;
}
