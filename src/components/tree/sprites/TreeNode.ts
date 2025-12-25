// src/components/tree/sprites/TreeNode.ts
// PixiJS Container class for passive tree nodes

import { Container, Graphics, Text, type TextStyle } from 'pixi.js';
import type { PassiveNode } from 'src/protos/pob2_pb';
import { NodeType } from 'src/protos/pob2_pb';
import {
  NODE_COLORS,
  NODE_ANIMATION,
  NODE_FRAME_WIDTHS,
  GLOW_CONSTANTS,
  HIGHLIGHT_CONSTANTS,
  HIT_AREA,
  MAX_POLYGON_SIDES,
  type NodeState,
  type LODLevel,
  DEFAULT_NODE_STATE,
  getNodeSize,
  getNodeFrameColor,
  getNodeBackgroundColor,
  getNodeAlpha,
  getNodeShapeSides,
  getLODLevel,
  getLabelFontSize,
  getLabelMaxWidth,
  getLabelVerticalOffset,
} from './NodeTypes';
import { getNodeSpriteManager } from './NodeSprites';

// ============================================================================
// Text Style for Node Labels
// ============================================================================

/** Create DPI-aware label text style */
function createLabelStyle(): Partial<TextStyle> {
  return {
    fontFamily: 'Arial, sans-serif',
    fontSize: getLabelFontSize(),
    fill: 0xffffff,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: getLabelMaxWidth(),
  };
}

// ============================================================================
// TreeNode Class
// ============================================================================

/**
 * TreeNode is a PixiJS Container representing a passive tree node.
 *
 * It manages:
 * - Node visuals (background, frame, glow)
 * - State-based appearance (allocated, hovered, reachable)
 * - LOD (Level of Detail) for performance
 * - Hit detection for interaction
 *
 * Structure:
 * ```
 * TreeNode (Container)
 * ├── glow (Sprite) - allocated glow effect
 * ├── background (Sprite/Graphics) - node background
 * ├── frame (Sprite/Graphics) - node border
 * ├── icon (Sprite) - node icon (future)
 * └── label (Text) - node name (at high zoom)
 * ```
 */
export class TreeNode extends Container {
  /** The passive node data */
  readonly nodeData: PassiveNode;

  /** Current state of the node */
  private _state: NodeState;

  /** Current LOD level */
  private _currentLOD: LODLevel;

  /** Current viewport zoom level (for constant-size label rendering) */
  private _currentZoom: number = 1.0;

  /** Visual elements */
  private glowGraphics: Graphics | null = null;
  private backgroundGraphics: Graphics;
  private frameGraphics: Graphics;
  private labelText: Text | null = null;

  /** Whether to use procedural graphics or cached textures */
  private useProceduralGraphics = true;

  /** Hit area graphics for interaction */
  private hitAreaGraphics: Graphics;

  /**
   * Create a new TreeNode.
   *
   * @param nodeData - The passive node data
   * @param initialState - Initial node state (defaults to unallocated)
   */
  constructor(nodeData: PassiveNode, initialState?: Partial<NodeState>) {
    super();

    this.nodeData = nodeData;
    this._state = { ...DEFAULT_NODE_STATE, ...initialState };
    this._currentLOD = getLODLevel(1.0); // Default to zoom 1.0

    // Set position from node data
    if (nodeData.position) {
      this.position.set(nodeData.position.x, nodeData.position.y);
    }

    // Create visual elements
    this.backgroundGraphics = new Graphics();
    this.frameGraphics = new Graphics();
    this.hitAreaGraphics = new Graphics();

    // Add children in z-order
    this.addChild(this.backgroundGraphics);
    this.addChild(this.frameGraphics);
    this.addChild(this.hitAreaGraphics);

    // Make hit area invisible but interactive
    this.hitAreaGraphics.alpha = 0;

    // Enable interaction
    this.eventMode = 'static';
    this.cursor = 'pointer';

    // Set label for debugging
    this.label = `node_${nodeData.id}`;

    // Initial render
    this.render();
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /** Get current node state */
  get state(): NodeState {
    return this._state;
  }

  /** Update node state and re-render */
  setState(newState: Partial<NodeState>): void {
    // Only check properties that are actually provided in newState
    const changed =
      ('allocated' in newState && newState.allocated !== this._state.allocated) ||
      ('hovered' in newState && newState.hovered !== this._state.hovered) ||
      ('inPath' in newState && newState.inPath !== this._state.inPath) ||
      ('reachable' in newState && newState.reachable !== this._state.reachable) ||
      ('selected' in newState && newState.selected !== this._state.selected) ||
      ('searchMatch' in newState && newState.searchMatch !== this._state.searchMatch);

    if (changed) {
      this._state = { ...this._state, ...newState };
      this.render();
    }
  }

  /** Set allocated state */
  setAllocated(allocated: boolean): void {
    if (this._state.allocated !== allocated) {
      this._state.allocated = allocated;
      this.render();
    }
  }

  /** Set hovered state */
  setHovered(hovered: boolean): void {
    if (this._state.hovered !== hovered) {
      this._state.hovered = hovered;
      this.updateHoverState();
    }
  }

  /** Set reachable state */
  setReachable(reachable: boolean): void {
    if (this._state.reachable !== reachable) {
      this._state.reachable = reachable;
      this.render();
    }
  }

  /** Set path preview state */
  setInPath(inPath: boolean): void {
    if (this._state.inPath !== inPath) {
      this._state.inPath = inPath;
      this.render();
    }
  }

  // ============================================================================
  // LOD Management
  // ============================================================================

  /** Get current LOD level */
  get currentLOD(): LODLevel {
    return this._currentLOD;
  }

  /**
   * Update LOD and size based on zoom level.
   * Re-renders when zoom changes to update node size (linear scaling).
   */
  updateLOD(zoom: number): void {
    const prevZoom = this._currentZoom;
    this._currentZoom = zoom;
    this._currentLOD = getLODLevel(zoom);

    // Re-render if zoom changed (node size scales with zoom)
    if (prevZoom !== zoom) {
      this.render();
    }

    // Update label scale if visible (keeps text constant screen size during zoom)
    if (this.labelText) {
      const inverseZoom = 1 / zoom;
      this.labelText.scale.set(inverseZoom);

      // Update position offset too - use local size (screen size / zoom)
      const nodeType = this.nodeData.nodeType ?? NodeType.NODE_NORMAL;
      const screenSize = getNodeSize(nodeType, this._currentZoom);
      const localSize = screenSize / this._currentZoom;
      const nodeRadius = localSize / 2;
      const screenOffset = getLabelVerticalOffset() * inverseZoom;
      this.labelText.position.set(0, nodeRadius + screenOffset);
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  /**
   * Render the node based on current state and LOD.
   */
  render(): void {
    const nodeType = this.nodeData.nodeType ?? NodeType.NODE_NORMAL;
    // getNodeSize returns desired screen size, but container is scaled by zoom,
    // so we divide by zoom to get local size that results in correct screen size
    const screenSize = getNodeSize(nodeType, this._currentZoom);
    const size = screenSize / this._currentZoom;
    const lod = this._currentLOD;

    // Clear previous graphics
    this.backgroundGraphics.clear();
    this.frameGraphics.clear();
    this.hitAreaGraphics.clear();

    // Try to use cached textures if sprite manager is initialized
    const spriteManager = getNodeSpriteManager();
    if (spriteManager.initialized && !this.useProceduralGraphics) {
      this.renderWithTextures(spriteManager, nodeType, size);
    } else {
      this.renderProcedural(nodeType, size, lod);
    }

    // Render glow if allocated and LOD allows
    this.renderGlow(size, lod);

    // Render label if at high LOD
    this.renderLabel(size, lod);

    // Update hit area
    this.renderHitArea(size);

    // Update alpha based on state
    this.alpha = getNodeAlpha(this._state);
  }

  /**
   * Render node using procedural graphics.
   */
  private renderProcedural(nodeType: NodeType, size: number, lod: LODLevel): void {
    const bgColor = getNodeBackgroundColor(this._state);
    const frameColor = getNodeFrameColor(nodeType);
    const radius = size / 2;
    const sides = getNodeShapeSides(nodeType);

    // Draw background using PixiJS v8 API
    if (sides <= MAX_POLYGON_SIDES) {
      this.drawPolygon(this.backgroundGraphics, radius, sides);
    } else {
      this.backgroundGraphics.circle(0, 0, radius);
    }
    this.backgroundGraphics.fill(bgColor);

    // Draw frame if LOD allows detail
    if (lod.showFrameDetails) {
      const frameWidth = this.getFrameWidth(nodeType);

      if (sides <= MAX_POLYGON_SIDES) {
        this.drawPolygon(this.frameGraphics, radius - frameWidth / 2, sides);
      } else {
        this.frameGraphics.circle(0, 0, radius - frameWidth / 2);
      }
      this.frameGraphics.stroke({ width: frameWidth, color: frameColor });
    }

    // Add selection/search highlight
    if (this._state.selected || this._state.searchMatch) {
      const highlightColor = this._state.selected
        ? NODE_COLORS.selectedGlow
        : NODE_COLORS.searchHighlight;

      this.frameGraphics
        .circle(0, 0, radius + HIGHLIGHT_CONSTANTS.radiusOffset)
        .stroke({ width: HIGHLIGHT_CONSTANTS.lineWidth, color: highlightColor, alpha: HIGHLIGHT_CONSTANTS.alpha });
    }
  }

  /**
   * Render node using cached textures.
   */
  private renderWithTextures(
    _spriteManager: ReturnType<typeof getNodeSpriteManager>,
    _nodeType: NodeType,
    _size: number
  ): void {
    // TODO: Implement texture-based rendering when sprite sheets are available
    // For now, fall back to procedural
    this.useProceduralGraphics = true;
    this.renderProcedural(
      this.nodeData.nodeType ?? NodeType.NODE_NORMAL,
      _size,
      this._currentLOD
    );
  }

  /**
   * Render glow effect for allocated nodes.
   */
  private renderGlow(size: number, lod: LODLevel): void {
    // Remove existing glow if present
    if (this.glowGraphics) {
      this.removeChild(this.glowGraphics);
      this.glowGraphics.destroy();
      this.glowGraphics = null;
    }

    // Only show glow for allocated nodes at high LOD
    if (!this._state.allocated || !lod.showGlows) {
      return;
    }

    // Create procedural glow
    const glowGraphics = new Graphics();
    const glowSize = size * GLOW_CONSTANTS.sizeMultiplier;
    const radius = size / 2;

    // Radial gradient effect using shared constants and PixiJS v8 API
    const steps = GLOW_CONSTANTS.gradientSteps;
    for (let i = steps; i >= 0; i--) {
      const ratio = i / steps;
      const currentRadius = radius + (glowSize / 2 - radius) * (1 - ratio);
      const alpha = ratio * GLOW_CONSTANTS.maxAlpha;

      glowGraphics.circle(0, 0, currentRadius).fill({ color: NODE_COLORS.allocatedGlow, alpha });
    }

    // Add glow behind other elements and store reference for cleanup
    this.addChildAt(glowGraphics, 0);
    this.glowGraphics = glowGraphics;
  }

  /**
   * Render node label (name).
   * Labels only show on hover, with constant screen size regardless of zoom.
   */
  private renderLabel(size: number, _lod: LODLevel): void {
    // Remove existing label
    if (this.labelText) {
      this.removeChild(this.labelText);
      this.labelText.destroy();
      this.labelText = null;
    }

    // Only show label when hovered
    if (!this._state.hovered) {
      return;
    }

    const name = this.nodeData.name;
    const pos = this.nodeData.position;

    // Include node coordinates in debug mode
    const debugCoords = pos ? `\n(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})` : '';
    const labelContent = import.meta.env.DEV ? `${name || 'unnamed'}${debugCoords}` : (name || '');

    if (!labelContent) return;

    this.labelText = new Text(labelContent, createLabelStyle());
    this.labelText.anchor.set(0.5, 0);

    // Apply inverse zoom scale to keep text constant screen size
    const inverseZoom = 1 / this._currentZoom;
    this.labelText.scale.set(inverseZoom);

    // Position below node edge with fixed screen-space offset
    const nodeRadius = size / 2;
    const screenOffset = getLabelVerticalOffset() * inverseZoom;
    this.labelText.position.set(0, nodeRadius + screenOffset);

    this.addChild(this.labelText);
  }

  /**
   * Render invisible hit area for interaction.
   */
  private renderHitArea(size: number): void {
    // Make hit area slightly larger for easier interaction
    const hitRadius = size / 2 + HIT_AREA.padding;

    this.hitAreaGraphics.circle(0, 0, hitRadius).fill(0xffffff);
  }

  /**
   * Update hover visual state (scale animation and label).
   */
  private updateHoverState(): void {
    const targetScale = this._state.hovered ? NODE_ANIMATION.hoverScale : 1.0;

    // Simple immediate scale change (could be animated with gsap or ticker)
    this.scale.set(targetScale);

    // Update alpha for hover effect
    this.alpha = getNodeAlpha(this._state);

    // Re-render to show/hide label on hover - use local size
    const nodeType = this.nodeData.nodeType ?? NodeType.NODE_NORMAL;
    const screenSize = getNodeSize(nodeType, this._currentZoom);
    const localSize = screenSize / this._currentZoom;
    this.renderLabel(localSize, this._currentLOD);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Draw a regular polygon on a Graphics object centered at origin.
   * Uses PixiJS v8 poly() API - caller must call fill() or stroke() after.
   */
  private drawPolygon(graphics: Graphics, radius: number, sides: number): void {
    const points: number[] = [];
    const angleOffset = -Math.PI / 2; // Start from top

    for (let i = 0; i < sides; i++) {
      const angle = angleOffset + (i / sides) * Math.PI * 2;
      points.push(Math.cos(angle) * radius);
      points.push(Math.sin(angle) * radius);
    }

    graphics.poly(points, true);
  }

  /**
   * Get frame width for a node type.
   */
  private getFrameWidth(nodeType: NodeType): number {
    return NODE_FRAME_WIDTHS[nodeType] ?? NODE_FRAME_WIDTHS[NodeType.NODE_NORMAL];
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /** Get node ID */
  get nodeId(): string {
    return this.nodeData.id;
  }

  /** Get node type */
  get nodeType(): NodeType {
    return this.nodeData.nodeType ?? NodeType.NODE_NORMAL;
  }

  /** Get node name */
  get nodeName(): string | undefined {
    return this.nodeData.name;
  }

  /** Check if node is allocated */
  get isAllocated(): boolean {
    return this._state.allocated;
  }

  /** Check if node is hovered */
  get isHovered(): boolean {
    return this._state.hovered;
  }

  /** Check if node is reachable */
  get isReachable(): boolean {
    return this._state.reachable;
  }

  /** Get the visual size of the node */
  get nodeSize(): number {
    return getNodeSize(this.nodeType, this._currentZoom);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy the node and clean up resources.
   */
  override destroy(): void {
    // Clean up label
    if (this.labelText) {
      this.labelText.destroy();
      this.labelText = null;
    }

    // Clean up glow
    if (this.glowGraphics) {
      this.glowGraphics.destroy();
      this.glowGraphics = null;
    }

    // Call parent destroy
    super.destroy({ children: true });
  }
}
