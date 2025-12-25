// test/unit/components/tree/connectors/ConnectorTypes.test.ts
import { describe, it, expect } from 'vitest';
import {
  ConnectionState,
  ConnectionType,
  CONNECTION_COLORS,
  CONNECTION_ALPHAS,
  CONNECTION_WIDTHS,
  getConnectionColor,
  getConnectionAlpha,
  getConnectionWidth,
  createConnectionId,
  determineConnectionState,
} from 'src/components/tree/connectors/ConnectorTypes';

describe('ConnectorTypes', () => {
  describe('ConnectionState enum', () => {
    it('should have all expected states', () => {
      expect(ConnectionState.Normal).toBe('normal');
      expect(ConnectionState.Allocated).toBe('allocated');
      expect(ConnectionState.Intermediate).toBe('intermediate');
      expect(ConnectionState.Path).toBe('path');
      expect(ConnectionState.AlternatePath).toBe('alternatePath');
    });
  });

  describe('ConnectionType enum', () => {
    it('should have all expected types', () => {
      expect(ConnectionType.Straight).toBe('straight');
      expect(ConnectionType.Arc).toBe('arc');
    });
  });

  describe('getConnectionColor', () => {
    it('should return correct color for each state', () => {
      expect(getConnectionColor(ConnectionState.Normal)).toBe(CONNECTION_COLORS.normal);
      expect(getConnectionColor(ConnectionState.Allocated)).toBe(CONNECTION_COLORS.allocated);
      expect(getConnectionColor(ConnectionState.Path)).toBe(CONNECTION_COLORS.path);
      expect(getConnectionColor(ConnectionState.AlternatePath)).toBe(CONNECTION_COLORS.alternatePath);
    });

    it('should use custom colors when provided', () => {
      const customColors = { normal: 0x123456 };
      expect(getConnectionColor(ConnectionState.Normal, customColors)).toBe(0x123456);
    });
  });

  describe('getConnectionAlpha', () => {
    it('should return correct alpha for each state', () => {
      expect(getConnectionAlpha(ConnectionState.Normal)).toBe(CONNECTION_ALPHAS.normal);
      expect(getConnectionAlpha(ConnectionState.Allocated)).toBe(CONNECTION_ALPHAS.allocated);
      expect(getConnectionAlpha(ConnectionState.Path)).toBe(CONNECTION_ALPHAS.path);
      expect(getConnectionAlpha(ConnectionState.AlternatePath)).toBe(CONNECTION_ALPHAS.alternatePath);
    });

    it('should use custom alphas when provided', () => {
      const customAlphas = { normal: 0.9 };
      expect(getConnectionAlpha(ConnectionState.Normal, customAlphas)).toBe(0.9);
    });
  });

  describe('getConnectionWidth', () => {
    it('should return correct width for each state', () => {
      expect(getConnectionWidth(ConnectionState.Normal)).toBe(CONNECTION_WIDTHS.normal);
      expect(getConnectionWidth(ConnectionState.Allocated)).toBe(CONNECTION_WIDTHS.allocated);
      expect(getConnectionWidth(ConnectionState.Path)).toBe(CONNECTION_WIDTHS.path);
      expect(getConnectionWidth(ConnectionState.AlternatePath)).toBe(CONNECTION_WIDTHS.alternatePath);
    });

    it('should use custom widths when provided', () => {
      const customWidths = { normal: 5 };
      expect(getConnectionWidth(ConnectionState.Normal, customWidths)).toBe(5);
    });
  });

  describe('createConnectionId', () => {
    it('should create consistent ID regardless of order', () => {
      const id1 = createConnectionId('a', 'b');
      const id2 = createConnectionId('b', 'a');
      expect(id1).toBe(id2);
    });

    it('should use underscore as separator', () => {
      const id = createConnectionId('node1', 'node2');
      expect(id).toContain('_');
    });

    it('should sort alphabetically', () => {
      const id = createConnectionId('z', 'a');
      expect(id).toBe('a_z');
    });
  });

  describe('determineConnectionState', () => {
    it('should return Path when both nodes in primary path', () => {
      const state = determineConnectionState(
        false, false, // not allocated
        true, true,   // both in path
        false, false  // not in alt path
      );
      expect(state).toBe(ConnectionState.Path);
    });

    it('should return AlternatePath when both nodes in alternate path', () => {
      const state = determineConnectionState(
        false, false, // not allocated
        false, false, // not in path
        true, true    // both in alt path
      );
      expect(state).toBe(ConnectionState.AlternatePath);
    });

    it('should return Allocated when both nodes allocated', () => {
      const state = determineConnectionState(
        true, true,   // both allocated
        false, false, // not in path
        false, false  // not in alt path
      );
      expect(state).toBe(ConnectionState.Allocated);
    });

    it('should return Intermediate when only one node allocated', () => {
      const state = determineConnectionState(
        true, false,  // one allocated
        false, false, // not in path
        false, false  // not in alt path
      );
      expect(state).toBe(ConnectionState.Intermediate);

      const state2 = determineConnectionState(
        false, true,  // other one allocated
        false, false, // not in path
        false, false  // not in alt path
      );
      expect(state2).toBe(ConnectionState.Intermediate);
    });

    it('should return Normal when neither node allocated', () => {
      const state = determineConnectionState(
        false, false, // neither allocated
        false, false, // not in path
        false, false  // not in alt path
      );
      expect(state).toBe(ConnectionState.Normal);
    });

    it('should prioritize path over allocation', () => {
      const state = determineConnectionState(
        true, true,   // both allocated
        true, true,   // both in path
        false, false  // not in alt path
      );
      expect(state).toBe(ConnectionState.Path);
    });
  });
});
