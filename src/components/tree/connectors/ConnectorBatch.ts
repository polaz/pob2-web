// src/components/tree/connectors/ConnectorBatch.ts
// Batch renderer for tree connections

import { Graphics, Container } from 'pixi.js';
import type { PassiveNode } from 'src/protos/pob2_pb';
import type {
  ConnectionData,
  ConnectionRenderConfig,
} from './ConnectorTypes';
import {
  ConnectionState,
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
} from './ConnectorTypes';
import {
  buildConnections,
  updateConnectionStates,
  groupConnectionsByState,
  separateByType,
  type TreeConstants,
  type NodeLookup,
  type ConnectionStateContext,
} from './TreeConnector';
import {
  sampleBezierCurves,
  midpoint,
} from './ConnectorGeometry';

// ============================================================================
// Types
// ============================================================================

/** State of the batch renderer */
interface BatchState {
  /** All connection data */
  connections: Map<string, ConnectionData>;
  /** Connections grouped by state */
  stateGroups: Map<ConnectionState, ConnectionData[]>;
  /** Current zoom level */
  zoom: number;
  /** Whether arcs are currently being rendered */
  arcsEnabled: boolean;
}

// ============================================================================
// ConnectorBatchRenderer
// ============================================================================

/**
 * Manages batch rendering of tree connections.
 *
 * Uses one Graphics object per connection state for efficient GPU rendering.
 * Supports both straight lines and bezier curves for arc connections.
 * Handles gradient effects for intermediate (one-side-allocated) connections.
 */
export class ConnectorBatchRenderer {
  /** Container for all connection graphics */
  private container: Container;

  /** Graphics objects for each connection state */
  private graphics: Map<ConnectionState, Graphics>;

  /** Special graphics for intermediate gradient connections */
  private intermediateGraphics: Graphics;

  /** Current batch state */
  private state: BatchState;

  /** Render configuration */
  private config: ConnectionRenderConfig;

  /** Tree constants for arc calculations */
  private treeConstants: TreeConstants | null = null;

  /** Node lookup function */
  private getNode: NodeLookup | null = null;

  /**
   * Create a new ConnectorBatchRenderer.
   *
   * @param parent - Parent container to add graphics to
   * @param config - Optional render configuration
   */
  constructor(
    parent: Container,
    config: Partial<ConnectionRenderConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONNECTION_CONFIG, ...config };

    // Create container
    this.container = new Container();
    parent.addChild(this.container);

    // Create graphics for each state
    this.graphics = new Map();
    for (const stateValue of Object.values(ConnectionState)) {
      const g = new Graphics();
      this.graphics.set(stateValue, g);
      this.container.addChild(g);
    }

    // Special graphics for intermediate gradients (rendered on top of normal intermediate)
    this.intermediateGraphics = new Graphics();
    this.container.addChild(this.intermediateGraphics);

    // Initialize state
    this.state = {
      connections: new Map(),
      stateGroups: new Map(),
      zoom: 1.0,
      arcsEnabled: true,
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Initialize with tree data.
   *
   * @param constants - Tree constants for arc calculations
   * @param getNode - Node lookup function
   */
  initialize(constants: TreeConstants, getNode: NodeLookup): void {
    this.treeConstants = constants;
    this.getNode = getNode;
  }

  /**
   * Build connections for all nodes.
   *
   * @param nodes - All passive nodes
   * @param stateContext - Current allocation/path state
   */
  buildConnections(
    nodes: PassiveNode[],
    stateContext: ConnectionStateContext
  ): void {
    if (!this.treeConstants || !this.getNode) {
      console.warn('[ConnectorBatch] Not initialized');
      return;
    }

    // Build all connection data
    this.state.connections = buildConnections(
      nodes,
      this.treeConstants,
      this.getNode,
      stateContext
    );

    // Group by state
    this.state.stateGroups = groupConnectionsByState(this.state.connections);

    // Render all
    this.render();
  }

  /**
   * Update connection states and re-render affected batches.
   *
   * @param stateContext - New allocation/path state
   */
  updateStates(stateContext: ConnectionStateContext): void {
    // Update state data
    updateConnectionStates(this.state.connections, stateContext);

    // Re-group by state
    this.state.stateGroups = groupConnectionsByState(this.state.connections);

    // Re-render all batches
    this.render();
  }

  /**
   * Update zoom level and handle LOD changes.
   *
   * @param zoom - New zoom level
   */
  updateZoom(zoom: number): void {
    const isVisible = zoom >= MIN_ZOOM_FOR_CONNECTIONS;

    const hadArcs = this.state.arcsEnabled;
    const hasArcs = zoom >= MIN_ZOOM_FOR_ARCS && this.config.enableArcs;

    this.state.zoom = zoom;
    this.state.arcsEnabled = hasArcs;

    // Update visibility
    this.container.visible = isVisible;

    // Re-render if arc state changed
    if (hadArcs !== hasArcs && isVisible) {
      this.render();
    }
  }

  /**
   * Get the container for viewport transforms.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Get connection count.
   */
  getConnectionCount(): number {
    return this.state.connections.size;
  }

  /**
   * Destroy and clean up resources.
   */
  destroy(): void {
    for (const g of this.graphics.values()) {
      g.destroy();
    }
    this.graphics.clear();
    this.intermediateGraphics.destroy();
    this.container.destroy();
    this.state.connections.clear();
    this.state.stateGroups.clear();
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  /**
   * Render all connection batches.
   */
  private render(): void {
    // Clear all graphics
    for (const g of this.graphics.values()) {
      g.clear();
    }
    this.intermediateGraphics.clear();

    // Render each state group
    for (const [stateValue, connections] of this.state.stateGroups) {
      if (connections.length === 0) continue;

      if (stateValue === ConnectionState.Intermediate && this.config.enableGradients) {
        // Special gradient rendering for intermediate
        this.renderIntermediateGradient(connections);
      } else {
        // Standard batch rendering
        this.renderStateBatch(stateValue, connections);
      }
    }
  }

  /**
   * Render a batch of connections in a single state.
   */
  private renderStateBatch(
    stateValue: ConnectionState,
    connections: ConnectionData[]
  ): void {
    const g = this.graphics.get(stateValue);
    if (!g) return;

    const color = getConnectionColor(stateValue, this.config.colors);
    const alpha = getConnectionAlpha(stateValue, this.config.alphas);
    const width = getConnectionWidth(stateValue, this.config.widths);

    // Separate by type
    const { straight, arcs } = separateByType(connections);

    // Draw straight lines
    if (straight.length > 0) {
      g.setStrokeStyle({ width, color, alpha });

      for (const conn of straight) {
        g.moveTo(conn.from.x, conn.from.y);
        g.lineTo(conn.to.x, conn.to.y);
      }

      g.stroke();
    }

    // Draw arcs (if enabled at current zoom)
    if (arcs.length > 0 && this.state.arcsEnabled) {
      g.setStrokeStyle({ width, color, alpha });

      for (const conn of arcs) {
        this.drawArc(g, conn);
      }

      g.stroke();
    } else if (arcs.length > 0) {
      // Fall back to straight lines at low zoom
      g.setStrokeStyle({ width, color, alpha });

      for (const conn of arcs) {
        g.moveTo(conn.from.x, conn.from.y);
        g.lineTo(conn.to.x, conn.to.y);
      }

      g.stroke();
    }
  }

  /**
   * Render intermediate connections with gradient effect.
   *
   * Draws from allocated node to midpoint in allocated color,
   * then from midpoint to unallocated node in normal color.
   */
  private renderIntermediateGradient(connections: ConnectionData[]): void {
    const g = this.intermediateGraphics;

    const allocatedColor = this.config.colors?.intermediateAllocated ?? CONNECTION_COLORS.intermediateAllocated;
    const normalColor = this.config.colors?.intermediateNormal ?? CONNECTION_COLORS.intermediateNormal;
    const allocatedAlpha = this.config.alphas?.intermediateAllocated ?? CONNECTION_ALPHAS.intermediateAllocated;
    const normalAlpha = this.config.alphas?.intermediateNormal ?? CONNECTION_ALPHAS.intermediateNormal;
    const width = this.config.widths?.intermediate ?? CONNECTION_WIDTHS.intermediate;

    const { straight, arcs } = separateByType(connections);

    // Draw straight lines with gradient (two segments)
    for (const conn of straight) {
      const mid = midpoint(conn.from, conn.to);

      // First half: allocated color
      g.setStrokeStyle({ width, color: allocatedColor, alpha: allocatedAlpha });
      g.moveTo(conn.from.x, conn.from.y);
      g.lineTo(mid.x, mid.y);
      g.stroke();

      // Second half: normal color
      g.setStrokeStyle({ width, color: normalColor, alpha: normalAlpha });
      g.moveTo(mid.x, mid.y);
      g.lineTo(conn.to.x, conn.to.y);
      g.stroke();
    }

    // Draw arcs with gradient
    if (arcs.length > 0 && this.state.arcsEnabled) {
      for (const conn of arcs) {
        this.drawArcGradient(g, conn, allocatedColor, normalColor, allocatedAlpha, normalAlpha, width);
      }
    } else if (arcs.length > 0) {
      // Fall back to straight gradient lines at low zoom
      for (const conn of arcs) {
        const mid = midpoint(conn.from, conn.to);

        g.setStrokeStyle({ width, color: allocatedColor, alpha: allocatedAlpha });
        g.moveTo(conn.from.x, conn.from.y);
        g.lineTo(mid.x, mid.y);
        g.stroke();

        g.setStrokeStyle({ width, color: normalColor, alpha: normalAlpha });
        g.moveTo(mid.x, mid.y);
        g.lineTo(conn.to.x, conn.to.y);
        g.stroke();
      }
    }
  }

  /**
   * Draw a single arc connection.
   */
  private drawArc(g: Graphics, conn: ConnectionData): void {
    if (!conn.bezierCurves || conn.bezierCurves.length === 0) {
      // Fallback to straight line
      g.moveTo(conn.from.x, conn.from.y);
      g.lineTo(conn.to.x, conn.to.y);
      return;
    }

    // Sample points along bezier curves
    const points = sampleBezierCurves(conn.bezierCurves, ARC_SEGMENTS);

    if (points.length < 2) {
      g.moveTo(conn.from.x, conn.from.y);
      g.lineTo(conn.to.x, conn.to.y);
      return;
    }

    // Draw as polyline
    g.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
  }

  /**
   * Draw an arc with gradient effect (for intermediate connections).
   */
  private drawArcGradient(
    g: Graphics,
    conn: ConnectionData,
    color1: number,
    color2: number,
    alpha1: number,
    alpha2: number,
    width: number
  ): void {
    if (!conn.bezierCurves || conn.bezierCurves.length === 0) {
      // Fallback to straight gradient line
      const mid = midpoint(conn.from, conn.to);

      g.setStrokeStyle({ width, color: color1, alpha: alpha1 });
      g.moveTo(conn.from.x, conn.from.y);
      g.lineTo(mid.x, mid.y);
      g.stroke();

      g.setStrokeStyle({ width, color: color2, alpha: alpha2 });
      g.moveTo(mid.x, mid.y);
      g.lineTo(conn.to.x, conn.to.y);
      g.stroke();
      return;
    }

    // Sample points along bezier curves
    const points = sampleBezierCurves(conn.bezierCurves, ARC_SEGMENTS * 2);

    if (points.length < 2) return;

    const midIndex = Math.floor(points.length / 2);

    // First half with color1
    g.setStrokeStyle({ width, color: color1, alpha: alpha1 });
    g.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i <= midIndex; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
    g.stroke();

    // Second half with color2
    g.setStrokeStyle({ width, color: color2, alpha: alpha2 });
    g.moveTo(points[midIndex]!.x, points[midIndex]!.y);
    for (let i = midIndex + 1; i < points.length; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
    g.stroke();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ConnectorBatchRenderer.
 *
 * @param parent - Parent container
 * @param config - Optional configuration
 * @returns New renderer instance
 */
export function createConnectorBatchRenderer(
  parent: Container,
  config?: Partial<ConnectionRenderConfig>
): ConnectorBatchRenderer {
  return new ConnectorBatchRenderer(parent, config);
}
