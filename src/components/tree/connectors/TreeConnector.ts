// src/components/tree/connectors/TreeConnector.ts
// Tree connector data builder

import type { PassiveNode } from 'src/protos/tree_pb';
import type {
  Point,
  ConnectionData,
  ArcData,
  BezierCurve,
} from './ConnectorTypes';
import {
  ConnectionType,
  ConnectionState,
  createConnectionId,
  determineConnectionState,
} from './ConnectorTypes';
import {
  shouldUseArc,
  calculateArcData,
  arcToBezierCurves,
} from './ConnectorGeometry';

// ============================================================================
// Constants
// ============================================================================

/**
 * Connection filtering notes:
 *
 * The PoB tree.json (version 0.4) contains 4701 nodes in 1185+ disconnected
 * components, mixing main tree nodes, ascendancy nodes, and nodes at extreme
 * positions (|Y| > 10000) whose purpose is unclear.
 *
 * We filter connections to prevent:
 * 1. Origin nodes (0,0) - missing group data creates invalid lines
 * 2. Cross-boundary connections - ascendancy to non-ascendancy creates long
 *    lines spanning the viewport since ascendancy trees are at distant positions
 *
 * Ascendancy nodes should only connect to other nodes in the same ascendancy
 * or to the main tree via the ascendancy start node (handled separately by
 * the visibleAscendancy filter in treeStore).
 */

// ============================================================================
// Types
// ============================================================================

/** Tree constants needed for arc calculations */
export interface TreeConstants {
  /** Orbit radii by orbit level */
  orbitRadii: number[];
  /** Group data with center positions */
  groups: Array<{
    x: number;
    y: number;
    nodes: number[];
    orbits: number[];
  } | null>;
}

/** Node lookup function type */
export type NodeLookup = (nodeId: string) => PassiveNode | undefined;

/** Allocation/path state lookup */
export interface ConnectionStateContext {
  /** Set of allocated node IDs */
  allocatedIds: Set<string>;
  /** Set of node IDs in primary path */
  pathIds: Set<string>;
  /** Set of node IDs in alternate path */
  alternatePathIds: Set<string>;
}

// ============================================================================
// Connection Builder
// ============================================================================

/**
 * Build connection data for all nodes in the tree.
 *
 * This function:
 * 1. Iterates through all nodes and their connections
 * 2. Determines connection type (straight vs arc)
 * 3. Pre-computes geometry for arcs
 * 4. Determines initial connection state
 *
 * @param nodes - All passive nodes in the tree
 * @param constants - Tree constants (orbit radii, groups)
 * @param getNode - Function to look up nodes by ID
 * @param stateContext - Current allocation/path state
 * @returns Map of connection ID to connection data
 */
export function buildConnections(
  nodes: PassiveNode[],
  constants: TreeConstants,
  getNode: NodeLookup,
  stateContext: ConnectionStateContext
): Map<string, ConnectionData> {
  const connections = new Map<string, ConnectionData>();
  const processedIds = new Set<string>();
  let skippedOriginNodes = 0;
  let skippedOriginConnections = 0;
  let skippedCrossBoundary = 0;

  for (const node of nodes) {
    if (!node.position || !node.linkedIds) continue;

    // Skip nodes at origin (0,0) - these have missing group data in PoB
    // and would create invalid long lines across the viewport
    if (node.position.x === 0 && node.position.y === 0) {
      skippedOriginNodes++;
      continue;
    }

    const fromPoint: Point = {
      x: node.position.x,
      y: node.position.y,
    };

    for (const linkedId of node.linkedIds) {
      // Create unique connection ID (sorted to avoid duplicates)
      const connId = createConnectionId(node.id, linkedId);
      if (processedIds.has(connId)) continue;
      processedIds.add(connId);

      // Get linked node
      const linkedNode = getNode(linkedId);
      if (!linkedNode?.position) continue;

      // Skip connections to nodes at origin (0,0)
      if (linkedNode.position.x === 0 && linkedNode.position.y === 0) {
        skippedOriginConnections++;
        continue;
      }

      // Skip cross-boundary connections (ascendancy <-> non-ascendancy)
      // Ascendancy trees are at distant positions and connecting them to
      // the main tree creates long lines spanning the viewport
      const fromAsc = node.ascendancyName;
      const toAsc = linkedNode.ascendancyName;
      if ((fromAsc && !toAsc) || (!fromAsc && toAsc)) {
        skippedCrossBoundary++;
        continue;
      }
      // Also skip if both have different ascendancies
      if (fromAsc && toAsc && fromAsc !== toAsc) {
        skippedCrossBoundary++;
        continue;
      }

      const toPoint: Point = {
        x: linkedNode.position.x,
        y: linkedNode.position.y,
      };

      // Determine connection type and geometry
      const connectionData = buildConnectionData(
        connId,
        node,
        linkedNode,
        fromPoint,
        toPoint,
        constants,
        stateContext
      );

      connections.set(connId, connectionData);
    }
  }

  if (import.meta.env.DEV) {
    console.log(`[TreeConnector] Built ${connections.size} connections`);
    console.log(`[TreeConnector] Skipped: ${skippedOriginNodes} origin nodes, ${skippedOriginConnections} origin connections, ${skippedCrossBoundary} cross-boundary`);

    // Count connection types
    let arcCount = 0;
    let straightCount = 0;
    for (const conn of connections.values()) {
      if (conn.type === ConnectionType.Arc) {
        arcCount++;
      } else {
        straightCount++;
      }
    }
    console.log(`[TreeConnector] Types: ${arcCount} arcs, ${straightCount} straight lines`);

    // Sample some connections to verify coordinates
    const samples = Array.from(connections.values()).slice(0, 5);
    console.log('[TreeConnector] Sample connections:');
    for (const conn of samples) {
      const dx = Math.abs(conn.to.x - conn.from.x);
      const dy = Math.abs(conn.to.y - conn.from.y);
      console.log(`  ${conn.id}: (${conn.from.x.toFixed(1)}, ${conn.from.y.toFixed(1)}) -> (${conn.to.x.toFixed(1)}, ${conn.to.y.toFixed(1)}) dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);
    }

    // Check for very long connections
    let longConnections = 0;
    for (const conn of connections.values()) {
      const dy = Math.abs(conn.to.y - conn.from.y);
      if (dy > 100) longConnections++;
    }
    console.log(`[TreeConnector] Connections with dy > 100: ${longConnections}`);
  }

  return connections;
}

/**
 * Build data for a single connection.
 */
function buildConnectionData(
  id: string,
  fromNode: PassiveNode,
  toNode: PassiveNode,
  fromPoint: Point,
  toPoint: Point,
  constants: TreeConstants,
  stateContext: ConnectionStateContext
): ConnectionData {
  const { allocatedIds, pathIds, alternatePathIds } = stateContext;

  // Determine current state
  const state = determineConnectionState(
    allocatedIds.has(fromNode.id),
    allocatedIds.has(toNode.id),
    pathIds.has(fromNode.id),
    pathIds.has(toNode.id),
    alternatePathIds.has(fromNode.id),
    alternatePathIds.has(toNode.id)
  );

  // Check if we should use an arc
  const useArc = shouldUseArc(
    fromNode.group,
    toNode.group,
    fromNode.orbit,
    toNode.orbit
  );

  if (useArc && fromNode.group !== undefined) {
    // Build arc connection
    const arcData = buildArcConnection(
      fromPoint,
      toPoint,
      fromNode.group,
      fromNode.orbit!,
      constants
    );

    if (arcData) {
      return {
        id,
        fromId: fromNode.id,
        toId: toNode.id,
        from: fromPoint,
        to: toPoint,
        type: ConnectionType.Arc,
        arcData: arcData.arc,
        bezierCurves: arcData.curves,
        state,
        ...(fromNode.group !== undefined && { groupId: fromNode.group }),
        ...(fromNode.orbit !== undefined && { orbit: fromNode.orbit }),
      };
    }
  }

  // Straight line connection
  return {
    id,
    fromId: fromNode.id,
    toId: toNode.id,
    from: fromPoint,
    to: toPoint,
    type: ConnectionType.Straight,
    state,
    ...(fromNode.group !== undefined && { groupId: fromNode.group }),
    ...(fromNode.orbit !== undefined && { orbit: fromNode.orbit }),
  };
}

/**
 * Build arc connection data with pre-computed bezier curves.
 */
function buildArcConnection(
  fromPoint: Point,
  toPoint: Point,
  groupId: number,
  orbit: number,
  constants: TreeConstants
): { arc: ArcData; curves: BezierCurve[] } | null {
  // Get group center
  const group = constants.groups[groupId];
  if (!group) return null;

  const groupCenter: Point = { x: group.x, y: group.y };

  // Get orbit radius
  const radius = constants.orbitRadii[orbit];
  if (radius === undefined || radius === 0) return null;

  // Calculate arc data
  const arcData = calculateArcData(fromPoint, toPoint, groupCenter, radius);
  if (!arcData) return null;

  // Pre-compute bezier curves
  const curves = arcToBezierCurves(arcData);

  return { arc: arcData, curves };
}

// ============================================================================
// State Updates
// ============================================================================

/**
 * Update connection states based on new allocation/path context.
 *
 * This is more efficient than rebuilding all connections - it only
 * updates the state field without recalculating geometry.
 *
 * @param connections - Existing connections map
 * @param stateContext - New state context
 */
export function updateConnectionStates(
  connections: Map<string, ConnectionData>,
  stateContext: ConnectionStateContext
): void {
  const { allocatedIds, pathIds, alternatePathIds } = stateContext;

  for (const conn of connections.values()) {
    conn.state = determineConnectionState(
      allocatedIds.has(conn.fromId),
      allocatedIds.has(conn.toId),
      pathIds.has(conn.fromId),
      pathIds.has(conn.toId),
      alternatePathIds.has(conn.fromId),
      alternatePathIds.has(conn.toId)
    );
  }
}

// ============================================================================
// Grouping by State
// ============================================================================

/**
 * Group connections by their current state for batch rendering.
 *
 * @param connections - All connections
 * @returns Map of state to array of connections in that state
 */
export function groupConnectionsByState(
  connections: Map<string, ConnectionData>
): Map<ConnectionState, ConnectionData[]> {
  const groups = new Map<ConnectionState, ConnectionData[]>();

  // Initialize all groups
  for (const state of Object.values(ConnectionState)) {
    groups.set(state, []);
  }

  // Group connections
  for (const conn of connections.values()) {
    const group = groups.get(conn.state);
    if (group) {
      group.push(conn);
    }
  }

  return groups;
}

/**
 * Separate connections by type within a state group.
 *
 * @param connections - Connections of the same state
 * @returns Object with straight and arc connections separated
 */
export function separateByType(connections: ConnectionData[]): {
  straight: ConnectionData[];
  arcs: ConnectionData[];
} {
  const straight: ConnectionData[] = [];
  const arcs: ConnectionData[] = [];

  for (const conn of connections) {
    if (conn.type === ConnectionType.Arc) {
      arcs.push(conn);
    } else {
      straight.push(conn);
    }
  }

  return { straight, arcs };
}
