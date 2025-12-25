// test/unit/components/tree/connectors/TreeConnector.test.ts
import { describe, it, expect } from 'vitest';
import type { PassiveNode } from 'src/protos/pob2_pb';
import { NodeType } from 'src/protos/pob2_pb';
import {
  buildConnections,
  updateConnectionStates,
  groupConnectionsByState,
  separateByType,
  type TreeConstants,
  type ConnectionStateContext,
} from 'src/components/tree/connectors/TreeConnector';
import { ConnectionState, ConnectionType } from 'src/components/tree/connectors/ConnectorTypes';

// Helper to create test nodes
function createTestNode(
  id: string,
  x: number,
  y: number,
  linkedIds: string[],
  group?: number,
  orbit?: number
): PassiveNode {
  return {
    id,
    name: `Node ${id}`,
    nodeType: NodeType.NODE_NORMAL,
    stats: [],
    linkedIds,
    position: { x, y },
    orbitIndex: 0,
    isProxy: false,
    isAscendancyStart: false,
    ...(group !== undefined && { group }),
    ...(orbit !== undefined && { orbit }),
  };
}

describe('TreeConnector', () => {
  const emptyConstants: TreeConstants = {
    orbitRadii: [0, 100, 200],
    groups: [],
  };

  const defaultStateContext: ConnectionStateContext = {
    allocatedIds: new Set<string>(),
    pathIds: new Set<string>(),
    alternatePathIds: new Set<string>(),
  };

  describe('buildConnections', () => {
    it('should build connections between linked nodes', () => {
      const nodes: PassiveNode[] = [
        createTestNode('1', 0, 0, ['2']),
        createTestNode('2', 100, 0, ['1', '3']),
        createTestNode('3', 200, 0, ['2']),
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, emptyConstants, getNode, defaultStateContext);

      // Should have 2 unique connections: 1-2 and 2-3
      expect(connections.size).toBe(2);

      // Check connection 1-2 exists
      expect(connections.has('1_2')).toBe(true);
      expect(connections.has('2_3')).toBe(true);
    });

    it('should avoid duplicate connections', () => {
      const nodes: PassiveNode[] = [
        createTestNode('1', 0, 0, ['2']),
        createTestNode('2', 100, 0, ['1']), // Bidirectional link
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, emptyConstants, getNode, defaultStateContext);

      // Should only have 1 connection despite bidirectional links
      expect(connections.size).toBe(1);
    });

    it('should skip nodes without position', () => {
      const nodes: PassiveNode[] = [
        {
          id: '1',
          name: 'Node 1',
          nodeType: NodeType.NODE_NORMAL,
          stats: [],
          linkedIds: ['2'],
          // position intentionally omitted to test missing position handling
          isProxy: false,
          isAscendancyStart: false,
        },
        createTestNode('2', 100, 0, ['1']),
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, emptyConstants, getNode, defaultStateContext);

      // No connections because node 1 has no position
      expect(connections.size).toBe(0);
    });

    it('should create straight connections by default', () => {
      const nodes: PassiveNode[] = [
        createTestNode('1', 0, 0, ['2'], 1, 1),
        createTestNode('2', 100, 0, ['1'], 2, 1), // Different group
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, emptyConstants, getNode, defaultStateContext);

      expect(connections.size).toBe(1);
      const conn = connections.get('1_2');
      expect(conn?.type).toBe(ConnectionType.Straight);
    });

    it('should create arc connections for same group and orbit', () => {
      const constants: TreeConstants = {
        orbitRadii: [0, 100],
        groups: [
          null,
          { x: 0, y: 0, nodes: [1, 2], orbits: [1] },
        ],
      };

      // Create nodes at 90 degree positions on orbit 1
      const nodes: PassiveNode[] = [
        createTestNode('1', 100, 0, ['2'], 1, 1), // At angle 0
        createTestNode('2', 0, 100, ['1'], 1, 1), // At angle π/2
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, constants, getNode, defaultStateContext);

      expect(connections.size).toBe(1);
      const conn = connections.get('1_2');
      expect(conn?.type).toBe(ConnectionType.Arc);
      expect(conn?.arcData).toBeDefined();
      expect(conn?.bezierCurves).toBeDefined();
    });
  });

  describe('updateConnectionStates', () => {
    it('should update connection states based on allocation', () => {
      const nodes: PassiveNode[] = [
        createTestNode('1', 0, 0, ['2']),
        createTestNode('2', 100, 0, ['1', '3']),
        createTestNode('3', 200, 0, ['2']),
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, emptyConstants, getNode, defaultStateContext);

      // Initially all normal
      expect(connections.get('1_2')?.state).toBe(ConnectionState.Normal);

      // Allocate nodes 1 and 2
      const newContext: ConnectionStateContext = {
        allocatedIds: new Set(['1', '2']),
        pathIds: new Set(),
        alternatePathIds: new Set(),
      };

      updateConnectionStates(connections, newContext);

      // Connection 1-2 should now be allocated
      expect(connections.get('1_2')?.state).toBe(ConnectionState.Allocated);
      // Connection 2-3 should be intermediate (only 2 is allocated)
      expect(connections.get('2_3')?.state).toBe(ConnectionState.Intermediate);
    });

    it('should update connection states based on path', () => {
      const nodes: PassiveNode[] = [
        createTestNode('1', 0, 0, ['2']),
        createTestNode('2', 100, 0, ['1']),
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, emptyConstants, getNode, defaultStateContext);

      const newContext: ConnectionStateContext = {
        allocatedIds: new Set(),
        pathIds: new Set(['1', '2']),
        alternatePathIds: new Set(),
      };

      updateConnectionStates(connections, newContext);

      expect(connections.get('1_2')?.state).toBe(ConnectionState.Path);
    });
  });

  describe('groupConnectionsByState', () => {
    it('should group connections by their state', () => {
      const nodes: PassiveNode[] = [
        createTestNode('1', 0, 0, ['2']),
        createTestNode('2', 100, 0, ['1', '3']),
        createTestNode('3', 200, 0, ['2', '4']),
        createTestNode('4', 300, 0, ['3']),
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);

      // Create connections with some allocated
      const context: ConnectionStateContext = {
        allocatedIds: new Set(['1', '2']),
        pathIds: new Set(),
        alternatePathIds: new Set(),
      };

      const connections = buildConnections(nodes, emptyConstants, getNode, context);
      const groups = groupConnectionsByState(connections);

      // Check groups exist for all states
      expect(groups.has(ConnectionState.Normal)).toBe(true);
      expect(groups.has(ConnectionState.Allocated)).toBe(true);
      expect(groups.has(ConnectionState.Intermediate)).toBe(true);

      // Connection 1-2 should be allocated
      const allocatedGroup = groups.get(ConnectionState.Allocated) ?? [];
      expect(allocatedGroup.length).toBe(1);
      expect(allocatedGroup[0]?.id).toBe('1_2');

      // Connection 2-3 should be intermediate
      const intermediateGroup = groups.get(ConnectionState.Intermediate) ?? [];
      expect(intermediateGroup.length).toBe(1);
      expect(intermediateGroup[0]?.id).toBe('2_3');

      // Connection 3-4 should be normal
      const normalGroup = groups.get(ConnectionState.Normal) ?? [];
      expect(normalGroup.length).toBe(1);
      expect(normalGroup[0]?.id).toBe('3_4');
    });
  });

  describe('separateByType', () => {
    it('should separate straight and arc connections', () => {
      const constants: TreeConstants = {
        orbitRadii: [0, 100],
        groups: [
          null,
          { x: 0, y: 0, nodes: [1, 2], orbits: [1] },
        ],
      };

      const nodes: PassiveNode[] = [
        createTestNode('1', 100, 0, ['2', '3'], 1, 1),
        createTestNode('2', 0, 100, ['1'], 1, 1), // Same orbit = arc
        createTestNode('3', 200, 0, ['1'], 2, 0), // Different group = straight
      ];

      const getNode = (id: string) => nodes.find((n) => n.id === id);
      const connections = buildConnections(nodes, constants, getNode, defaultStateContext);
      const allConnections = Array.from(connections.values());

      const { straight, arcs } = separateByType(allConnections);

      // Should have 1 arc (1-2) and 1 straight (1-3)
      expect(arcs.length).toBe(1);
      expect(straight.length).toBe(1);
    });
  });
});
