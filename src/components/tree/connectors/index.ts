// src/components/tree/connectors/index.ts
// Tree connector module exports

// Types and constants
export {
  ConnectionState,
  ConnectionType,
  CONNECTION_COLORS,
  CONNECTION_ALPHAS,
  CONNECTION_WIDTHS,
  MIN_ZOOM_FOR_CONNECTIONS,
  MIN_ZOOM_FOR_ARCS,
  ARC_SEGMENTS,
  DEFAULT_CONNECTION_CONFIG,
  getConnectionColor,
  getConnectionAlpha,
  getConnectionWidth,
  createConnectionId,
  determineConnectionState,
  type Point,
  type ArcData,
  type BezierCurve,
  type ConnectionData,
  type ConnectionRenderConfig,
} from './ConnectorTypes';

// Geometry utilities
export {
  distance,
  midpoint,
  lerp,
  normalizeAngle,
  angleDifference,
  pointOnCircle,
  shouldUseArc,
  calculateArcData,
  arcToBezierSegment,
  arcToBezierCurves,
  evaluateBezier,
  splitBezier,
  sampleBezier,
  sampleBezierCurves,
  lerpColor,
  lerpAlpha,
} from './ConnectorGeometry';

// Connection building
export {
  buildConnections,
  updateConnectionStates,
  groupConnectionsByState,
  separateByType,
  type TreeConstants,
  type NodeLookup,
  type ConnectionStateContext,
} from './TreeConnector';

// Batch renderer
export {
  ConnectorBatchRenderer,
  createConnectorBatchRenderer,
} from './ConnectorBatch';
