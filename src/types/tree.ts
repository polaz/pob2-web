// src/types/tree.ts
// Types for PoE2 passive skill tree data
// Source: PathOfBuildingCommunity/PathOfBuilding-PoE2

/**
 * Node type in the passive tree
 */
export type TreeNodeType = 'normal' | 'notable' | 'keystone' | 'mastery';

// ============================================================================
// Mastery Effect Types
// ============================================================================

/**
 * A single mastery effect option that can be selected.
 *
 * When a player allocates a mastery node, they choose ONE effect from
 * the available options. Each effect has a unique ID and stat descriptions.
 *
 * Example:
 * ```
 * {
 *   effect: 48385,
 *   stats: ["Exposure you inflict applies at least -18% to the affected Resistance"]
 * }
 * ```
 */
export interface MasteryEffect {
  /** Unique effect ID used for selection tracking */
  effect: number;
  /** Stat description lines (parsed by ModParser for calculations) */
  stats: string[];
}

/**
 * Mastery effect data stored in the top-level masteryEffects map.
 * This is the format used by PoB's tree.masteryEffects[effectId].
 */
export interface MasteryEffectData {
  /** Stat description lines */
  sd: string[];
}

/**
 * A mastery type grouping multiple nodes and their shared effects.
 *
 * Example: "Life Mastery" nodes scattered across the tree all share
 * the same pool of selectable effects.
 */
export interface MasteryType {
  /** Display name (e.g., "Life Mastery", "Attack Mastery") */
  name: string;
  /** Node IDs that are this mastery type */
  nodeIds: string[];
  /** Available effects for this mastery type */
  effects: MasteryEffect[];
}

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
  /**
   * Top-level mastery effects map: effectId → effect data.
   *
   * This map is used to look up effect details when a user selects
   * a mastery effect. The effectId comes from Build.masterySelections.
   *
   * NOTE: This data is currently NOT extracted by PoB2's export scripts.
   * The map may be empty until mastery effect extraction is implemented.
   *
   * @see https://github.com/polaz/pob2-web/issues/109
   */
  masteryEffects?: Record<number, MasteryEffectData>;
  /**
   * Mastery types grouped by name (e.g., "Life Mastery").
   * Provides a structured view of which nodes share which effects.
   *
   * NOTE: This is a derived/convenience structure, not in original PoB data.
   */
  masteryTypes?: Record<string, MasteryType>;
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
  /**
   * Mastery effects available for this node (if isMastery is true).
   * Each effect has an ID and stat descriptions.
   */
  masteryEffects?: MasteryEffect[];
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
  /**
   * Top-level mastery effects map: effectId → effect data.
   * Used to look up effect stats when resolving Build.masterySelections.
   */
  masteryEffects: Map<number, MasteryEffectData>;
  /**
   * Mastery types grouped by name for UI display.
   */
  masteryTypes: Map<string, MasteryType>;
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
