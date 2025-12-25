// src/components/tree/sprites/TreeNode.ts
// PixiJS Container class for passive tree nodes

import { Container, type Sprite, Graphics, Text, type TextStyle } from 'pixi.js';
import type { PassiveNode } from 'src/protos/pob2_pb';
import { NodeType } from 'src/protos/pob2_pb';
import {
  NODE_COLORS,
  NODE_ANIMATION,
  type NodeState,
  type LODLevel,
  DEFAULT_NODE_STATE,
  getNodeSize,
  getNodeFrameColor,
  getNodeBackgroundColor,
  getNodeAlpha,
  getNodeShapeSides,
  getLODLevel,
  isSpecialNode,
} from './NodeTypes';
import { getNodeSpriteManager } from './NodeSprites';

// ============================================================================
// Text Style for Node Labels
// ============================================================================

const LABEL_STYLE: Partial<TextStyle> = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 10,
  fill: 0xffffff,
  align: 'center',
  wordWrap: true,
  wordWrapWidth: 80,
};

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

  /** Visual elements */
  private glowSprite: Sprite | null = null;
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
    const changed =
      newState.allocated !== this._state.allocated ||
      newState.hovered !== this._state.hovered ||
      newState.inPath !== this._state.inPath ||
      newState.reachable !== this._state.reachable ||
      newState.selected !== this._state.selected ||
      newState.searchMatch !== this._state.searchMatch;

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
   * Update LOD based on zoom level.
   * Only re-renders if LOD level changes.
   */
  updateLOD(zoom: number): void {
    const newLOD = getLODLevel(zoom);

    // Check if LOD changed
    if (newLOD.minZoom !== this._currentLOD.minZoom) {
      this._currentLOD = newLOD;
      this.render();
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
    const size = getNodeSize(nodeType, this._currentLOD.minZoom + 0.1);
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

    // Draw background
    this.backgroundGraphics.beginFill(bgColor);
    if (sides <= 8) {
      this.drawPolygon(this.backgroundGraphics, radius, sides);
    } else {
      this.backgroundGraphics.drawCircle(0, 0, radius);
    }
    this.backgroundGraphics.endFill();

    // Draw frame if LOD allows detail
    if (lod.showFrameDetails) {
      const frameWidth = this.getFrameWidth(nodeType);
      this.frameGraphics.lineStyle(frameWidth, frameColor, 1);

      if (sides <= 8) {
        this.drawPolygon(this.frameGraphics, radius - frameWidth / 2, sides);
      } else {
        this.frameGraphics.drawCircle(0, 0, radius - frameWidth / 2);
      }
    }

    // Add selection/search highlight
    if (this._state.selected || this._state.searchMatch) {
      const highlightColor = this._state.selected
        ? NODE_COLORS.selectedGlow
        : NODE_COLORS.searchHighlight;

      this.frameGraphics.lineStyle(3, highlightColor, 0.8);
      this.frameGraphics.drawCircle(0, 0, radius + 4);
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
    if (this.glowSprite) {
      this.removeChild(this.glowSprite);
      this.glowSprite.destroy();
      this.glowSprite = null;
    }

    // Only show glow for allocated nodes at high LOD
    if (!this._state.allocated || !lod.showGlows) {
      return;
    }

    // Create procedural glow
    const glowGraphics = new Graphics();
    const glowSize = size * 1.5;
    const radius = size / 2;

    // Radial gradient effect
    const steps = 5;
    for (let i = steps; i >= 0; i--) {
      const ratio = i / steps;
      const currentRadius = radius + (glowSize / 2 - radius) * (1 - ratio);
      const alpha = ratio * 0.3;

      glowGraphics.beginFill(NODE_COLORS.allocatedGlow, alpha);
      glowGraphics.drawCircle(0, 0, currentRadius);
      glowGraphics.endFill();
    }

    // Add glow behind other elements
    this.addChildAt(glowGraphics, 0);

    // Store reference (using Graphics instead of Sprite for procedural)
    // Note: This is a simplified implementation
  }

  /**
   * Render node label (name).
   */
  private renderLabel(size: number, lod: LODLevel): void {
    // Remove existing label
    if (this.labelText) {
      this.removeChild(this.labelText);
      this.labelText.destroy();
      this.labelText = null;
    }

    // Only show labels at high LOD for special nodes
    if (!lod.showLabels || !isSpecialNode(this.nodeData.nodeType ?? NodeType.NODE_NORMAL)) {
      return;
    }

    const name = this.nodeData.name;
    if (!name) return;

    this.labelText = new Text(name, LABEL_STYLE);
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, size / 2 + 4);

    this.addChild(this.labelText);
  }

  /**
   * Render invisible hit area for interaction.
   */
  private renderHitArea(size: number): void {
    // Make hit area slightly larger for easier interaction
    const hitRadius = size / 2 + 4;

    this.hitAreaGraphics.beginFill(0xffffff);
    this.hitAreaGraphics.drawCircle(0, 0, hitRadius);
    this.hitAreaGraphics.endFill();
  }

  /**
   * Update hover visual state (scale animation).
   */
  private updateHoverState(): void {
    const targetScale = this._state.hovered ? NODE_ANIMATION.hoverScale : 1.0;

    // Simple immediate scale change (could be animated with gsap or ticker)
    this.scale.set(targetScale);

    // Update alpha for hover effect
    this.alpha = getNodeAlpha(this._state);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Draw a regular polygon on a Graphics object centered at origin.
   */
  private drawPolygon(graphics: Graphics, radius: number, sides: number): void {
    const points: number[] = [];
    const angleOffset = -Math.PI / 2; // Start from top

    for (let i = 0; i < sides; i++) {
      const angle = angleOffset + (i / sides) * Math.PI * 2;
      points.push(Math.cos(angle) * radius);
      points.push(Math.sin(angle) * radius);
    }

    graphics.drawPolygon(points);
  }

  /**
   * Get frame width for a node type.
   */
  private getFrameWidth(nodeType: NodeType): number {
    switch (nodeType) {
      case NodeType.NODE_KEYSTONE:
        return 4;
      case NodeType.NODE_NOTABLE:
      case NodeType.NODE_SOCKET:
        return 3;
      default:
        return 2;
    }
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
    return getNodeSize(this.nodeType, this._currentLOD.minZoom + 0.1);
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
    if (this.glowSprite) {
      this.glowSprite.destroy();
      this.glowSprite = null;
    }

    // Call parent destroy
    super.destroy({ children: true });
  }
}
