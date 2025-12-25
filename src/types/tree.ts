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
  /**
   * Mastery effects available for this node.
   * Each effect has an ID and stat descriptions.
   * Only present on mastery nodes (isMastery: true).
   * Can be null in raw JSON data for non-mastery nodes.
   */
  masteryEffects?: Array<{
    effect: number;
    stats: string[];
  }> | null;
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
 *
 * The `nodes` array contains numeric node indices as they appear in the
 * source tree JSON. Each numeric index corresponds to a `RawTreeNode.id`
 * value, which is stored as a string and used as a key in `RawTreeData.nodes`.
 *
 * When looking up node data from a `TreeGroup`, you must convert the
 * numeric index from `group.nodes` to a string before indexing into
 * `RawTreeData.nodes`. For example:
 *
 * ```typescript
 * const nodeId: string = String(group.nodes[0]); // matches RawTreeNode.id
 * const node: RawTreeNode | undefined = rawTreeData.nodes[nodeId];
 * ```
 */
export interface TreeGroup {
  x: number;
  y: number;
  /**
   * Numeric node indices from the source JSON.
   * Convert these to strings (e.g. `String(index)`) to obtain the
   * corresponding `RawTreeNode.id` keys in `RawTreeData.nodes`.
   */
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
