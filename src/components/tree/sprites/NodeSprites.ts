// src/components/tree/sprites/NodeSprites.ts
// Texture and sprite management for passive tree nodes
// Uses procedural generation since we don't have sprite sheets yet

import { Graphics, type Texture, type Renderer, Container } from 'pixi.js';
import { NodeType } from 'src/protos/pob2_pb';
import {
  NODE_SIZES,
  NODE_FRAME_WIDTHS,
  NODE_COLORS,
  SIZE_MULTIPLIERS,
  GLOW_CONSTANTS,
  MAX_POLYGON_SIDES,
  getNodeFrameColor,
  getNodeShapeSides,
} from './NodeTypes';

// ============================================================================
// Types
// ============================================================================

/** Cache key for generated textures */
interface TextureCacheKey {
  nodeType: NodeType;
  allocated: boolean;
  size: 'small' | 'medium' | 'large';
}

/** Texture set for a node (background, frame, glow) */
export interface NodeTextureSet {
  /** Main background texture */
  background: Texture;
  /** Frame/border texture */
  frame: Texture;
  /** Glow effect texture (optional) */
  glow?: Texture;
}

// ============================================================================
// Texture Cache
// ============================================================================

/**
 * NodeSpriteManager generates and caches textures for tree nodes.
 *
 * Since we don't have actual sprite sheet assets yet, textures are
 * procedurally generated using PixiJS Graphics. This approach:
 * - Works without external assets
 * - Provides consistent visuals matching PoE2 style
 * - Is easily replaceable with actual sprites later
 *
 * Textures are cached by node type and state to avoid regeneration.
 */
export class NodeSpriteManager {
  private textureCache: Map<string, NodeTextureSet> = new Map();
  private renderer: Renderer | null = null;
  private isInitialized = false;

  /**
   * Initialize the sprite manager with a renderer.
   * Must be called before generating any textures.
   */
  initialize(renderer: Renderer): void {
    this.renderer = renderer;
    this.isInitialized = true;
  }

  /**
   * Check if the manager is initialized.
   */
  get initialized(): boolean {
    return this.isInitialized && this.renderer !== null;
  }

  /**
   * Generate a cache key string from key object.
   */
  private getCacheKeyString(key: TextureCacheKey): string {
    return `${key.nodeType}_${key.allocated}_${key.size}`;
  }

  /**
   * Get or generate textures for a node type and state.
   */
  getTextures(nodeType: NodeType, allocated: boolean, size: 'small' | 'medium' | 'large' = 'medium'): NodeTextureSet {
    if (!this.renderer) {
      throw new Error('NodeSpriteManager not initialized. Call initialize() first.');
    }

    const key: TextureCacheKey = { nodeType, allocated, size };
    const cacheKey = this.getCacheKeyString(key);

    // Check cache first
    const cached = this.textureCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate new textures
    const textures = this.generateTextures(nodeType, allocated, size);
    this.textureCache.set(cacheKey, textures);
    return textures;
  }

  /**
   * Generate textures for a node type and state.
   */
  private generateTextures(
    nodeType: NodeType,
    allocated: boolean,
    size: 'small' | 'medium' | 'large'
  ): NodeTextureSet {
    const baseSize = NODE_SIZES[nodeType] ?? NODE_SIZES[NodeType.NODE_NORMAL];
    const sizeMultiplier = SIZE_MULTIPLIERS[size];
    const nodeSize = baseSize * sizeMultiplier;
    const frameWidth = NODE_FRAME_WIDTHS[nodeType] ?? 2;

    const background = this.generateBackgroundTexture(nodeType, nodeSize, allocated);
    const frame = this.generateFrameTexture(nodeType, nodeSize, frameWidth);

    const result: NodeTextureSet = { background, frame };

    // Only generate glow for allocated nodes
    if (allocated) {
      result.glow = this.generateGlowTexture(nodeType, nodeSize);
    }

    return result;
  }

  /**
   * Generate background texture for a node.
   * Uses PixiJS v8 Graphics API.
   */
  private generateBackgroundTexture(nodeType: NodeType, size: number, allocated: boolean): Texture {
    const graphics = new Graphics();
    const color = allocated ? NODE_COLORS.allocatedBg : NODE_COLORS.unallocatedBg;
    const radius = size / 2;

    const sides = getNodeShapeSides(nodeType);
    if (sides <= MAX_POLYGON_SIDES) {
      // Draw polygon for special shapes
      this.drawPolygon(graphics, 0, 0, radius, sides);
    } else {
      // Draw circle for normal nodes
      graphics.circle(0, 0, radius);
    }
    graphics.fill(color);

    return this.graphicsToTexture(graphics, size);
  }

  /**
   * Generate frame/border texture for a node.
   * Uses PixiJS v8 Graphics API.
   */
  private generateFrameTexture(nodeType: NodeType, size: number, frameWidth: number): Texture {
    const graphics = new Graphics();
    const color = getNodeFrameColor(nodeType);
    const radius = size / 2;

    const sides = getNodeShapeSides(nodeType);
    if (sides <= MAX_POLYGON_SIDES) {
      // Draw polygon outline
      this.drawPolygon(graphics, 0, 0, radius - frameWidth / 2, sides);
    } else {
      // Draw circle outline
      graphics.circle(0, 0, radius - frameWidth / 2);
    }
    graphics.stroke({ width: frameWidth, color });

    return this.graphicsToTexture(graphics, size);
  }

  /**
   * Generate glow effect texture for allocated nodes.
   * Uses PixiJS v8 Graphics API.
   * @param _nodeType - Reserved for future use when different node types have different glow styles
   */
  private generateGlowTexture(_nodeType: NodeType, size: number): Texture {
    const graphics = new Graphics();
    const glowSize = size * GLOW_CONSTANTS.sizeMultiplier;
    const radius = size / 2;

    // Create radial gradient effect using multiple circles
    const steps = GLOW_CONSTANTS.gradientSteps;
    for (let i = steps; i >= 0; i--) {
      const ratio = i / steps;
      const currentRadius = radius + (glowSize / 2 - radius) * (1 - ratio);
      const alpha = ratio * GLOW_CONSTANTS.maxAlpha;

      graphics.circle(0, 0, currentRadius).fill({ color: NODE_COLORS.allocatedGlow, alpha });
    }

    return this.graphicsToTexture(graphics, glowSize);
  }

  /**
   * Draw a regular polygon on a Graphics object.
   * Uses PixiJS v8 poly() API - caller must call fill() or stroke() after.
   */
  private drawPolygon(
    graphics: Graphics,
    x: number,
    y: number,
    radius: number,
    sides: number
  ): void {
    const points: number[] = [];
    const angleOffset = -Math.PI / 2; // Start from top

    for (let i = 0; i < sides; i++) {
      const angle = angleOffset + (i / sides) * Math.PI * 2;
      points.push(x + Math.cos(angle) * radius);
      points.push(y + Math.sin(angle) * radius);
    }

    graphics.poly(points, true);
  }

  /**
   * Convert a Graphics object to a Texture.
   */
  private graphicsToTexture(graphics: Graphics, size: number): Texture {
    if (!this.renderer) {
      throw new Error('Renderer not available');
    }

    // Create a container to center the graphics
    const container = new Container();
    container.addChild(graphics);
    graphics.position.set(size / 2, size / 2);

    // Generate texture from the container
    const texture = this.renderer.generateTexture({
      target: container,
      resolution: window.devicePixelRatio || 1,
    });

    // Clean up
    container.destroy({ children: true });

    return texture;
  }

  /**
   * Pregenerate common textures to avoid runtime generation.
   */
  pregenerate(): void {
    if (!this.renderer) {
      console.warn('Cannot pregenerate textures: renderer not initialized');
      return;
    }

    const nodeTypes = [
      NodeType.NODE_NORMAL,
      NodeType.NODE_NOTABLE,
      NodeType.NODE_KEYSTONE,
      NodeType.NODE_MASTERY,
      NodeType.NODE_SOCKET,
      NodeType.NODE_CLASS_START,
      NodeType.NODE_ASCEND_CLASS_START,
    ];

    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    for (const nodeType of nodeTypes) {
      for (const allocated of [true, false]) {
        for (const size of sizes) {
          this.getTextures(nodeType, allocated, size);
        }
      }
    }
  }

  /**
   * Clear the texture cache and destroy all cached textures.
   */
  destroy(): void {
    for (const textureSet of this.textureCache.values()) {
      textureSet.background.destroy(true);
      textureSet.frame.destroy(true);
      textureSet.glow?.destroy(true);
    }
    this.textureCache.clear();
    this.renderer = null;
    this.isInitialized = false;
  }

  /**
   * Get the number of cached texture sets.
   */
  get cacheSize(): number {
    return this.textureCache.size;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Shared instance of NodeSpriteManager */
let spriteManagerInstance: NodeSpriteManager | null = null;

/**
 * Get the shared NodeSpriteManager instance.
 */
export function getNodeSpriteManager(): NodeSpriteManager {
  if (!spriteManagerInstance) {
    spriteManagerInstance = new NodeSpriteManager();
  }
  return spriteManagerInstance;
}

/**
 * Destroy the shared NodeSpriteManager instance.
 */
export function destroyNodeSpriteManager(): void {
  if (spriteManagerInstance) {
    spriteManagerInstance.destroy();
    spriteManagerInstance = null;
  }
}
