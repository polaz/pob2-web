// src/workers/tree.worker.ts
// Passive tree worker for pathfinding and tree operations
// Handles heavy tree computations off the main thread

import * as Comlink from 'comlink';
import type { PassiveTree } from 'src/protos/pob2_pb';

/**
 * Path result from pathfinding
 */
export interface PathResult {
  /** Ordered list of node IDs in the path */
  path: string[];
  /** Total number of points needed */
  pointCost: number;
  /** Whether a valid path was found */
  found: boolean;
}

/**
 * Node search result
 */
export interface NodeSearchResult {
  /** Node ID */
  id: string;
  /** Node name */
  name: string;
  /** Search relevance score */
  score: number;
  /** Node type (normal, notable, keystone) */
  nodeType: string;
}

/**
 * Tree statistics
 */
export interface TreeStats {
  /** Total allocated nodes */
  allocatedCount: number;
  /** Total points spent */
  pointsSpent: number;
  /** Keystones allocated */
  keystones: string[];
  /** Notables allocated */
  notables: string[];
}

/**
 * Tree worker API
 */
const treeWorkerApi = {
  /**
   * Find shortest path between two nodes
   * Uses BFS for unweighted shortest path
   */
  findPath(
    _tree: PassiveTree,
    _fromNodeId: string,
    _toNodeId: string,
    _allocatedNodeIds: string[]
  ): Promise<PathResult> {
    // TODO: Implement BFS pathfinding
    // For now, return empty result
    return Promise.resolve({
      path: [],
      pointCost: 0,
      found: false,
    });
  },

  /**
   * Find path from nearest allocated node to target
   */
  findPathToNode(
    _tree: PassiveTree,
    _targetNodeId: string,
    _allocatedNodeIds: string[]
  ): Promise<PathResult> {
    // TODO: Implement pathfinding from allocated nodes
    // Find the shortest path from any allocated node to target
    return Promise.resolve({
      path: [],
      pointCost: 0,
      found: false,
    });
  },

  /**
   * Get all reachable nodes from current allocation
   */
  getReachableNodes(
    _tree: PassiveTree,
    _allocatedNodeIds: string[]
  ): Promise<string[]> {
    // TODO: Implement reachability check
    // Return all nodes that are adjacent to allocated nodes
    return Promise.resolve([]);
  },

  /**
   * Check if a node can be deallocated without breaking the tree
   */
  canDeallocate(
    _tree: PassiveTree,
    _nodeId: string,
    _allocatedNodeIds: string[]
  ): Promise<boolean> {
    // TODO: Implement connectivity check
    // A node can be deallocated if removing it doesn't disconnect the tree
    return Promise.resolve(false);
  },

  /**
   * Search nodes by name or stats
   */
  searchNodes(
    _tree: PassiveTree,
    _query: string,
    _limit = 20
  ): Promise<NodeSearchResult[]> {
    // TODO: Implement fuzzy search
    // Search through node names and stat descriptions
    return Promise.resolve([]);
  },

  /**
   * Calculate tree statistics
   */
  getTreeStats(
    _tree: PassiveTree,
    allocatedNodeIds: string[]
  ): Promise<TreeStats> {
    // TODO: Implement stat calculation
    return Promise.resolve({
      allocatedCount: allocatedNodeIds.length,
      pointsSpent: allocatedNodeIds.length,
      keystones: [],
      notables: [],
    });
  },

  /**
   * Validate tree allocation (check for disconnected nodes)
   */
  validateTree(
    _tree: PassiveTree,
    _allocatedNodeIds: string[],
    _classStartNodeId: string
  ): Promise<{ valid: boolean; disconnectedNodes: string[] }> {
    // TODO: Implement tree validation
    // Check that all nodes are connected to class start
    return Promise.resolve({
      valid: true,
      disconnectedNodes: [],
    });
  },

  /**
   * Health check
   */
  ping(): Promise<string> {
    return Promise.resolve('pong');
  },
};

export type TreeWorkerApi = typeof treeWorkerApi;

Comlink.expose(treeWorkerApi);
