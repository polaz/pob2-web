/**
 * Unit tests for NodeTypes constants and helper functions.
 */
import { describe, it, expect } from 'vitest';
import { NodeType } from 'src/protos/pob2_pb';
import {
  NODE_SIZES,
  NODE_FRAME_WIDTHS,
  NODE_COLORS,
  NODE_ALPHAS,
  NODE_ANIMATION,
  LOD_LEVELS,
  DEFAULT_NODE_STATE,
  DEFAULT_RENDER_CONFIG,
  getLODLevel,
  getNodeSize,
  getNodeFrameColor,
  getNodeBackgroundColor,
  getNodeAlpha,
  isSpecialNode,
  isAscendancyNode,
  getNodeShapeSides,
  type NodeState,
} from 'src/components/tree/sprites/NodeTypes';

describe('NodeTypes', () => {
  describe('NODE_SIZES', () => {
    it('should have sizes for all node types', () => {
      expect(NODE_SIZES[NodeType.NODE_NORMAL]).toBe(24);
      expect(NODE_SIZES[NodeType.NODE_NOTABLE]).toBe(38);
      expect(NODE_SIZES[NodeType.NODE_KEYSTONE]).toBe(52);
      expect(NODE_SIZES[NodeType.NODE_MASTERY]).toBe(40);
      expect(NODE_SIZES[NodeType.NODE_SOCKET]).toBe(44);
      expect(NODE_SIZES[NodeType.NODE_CLASS_START]).toBe(48);
      expect(NODE_SIZES[NodeType.NODE_ASCEND_CLASS_START]).toBe(42);
    });
  });

  describe('NODE_FRAME_WIDTHS', () => {
    it('should have frame widths for all node types', () => {
      expect(NODE_FRAME_WIDTHS[NodeType.NODE_NORMAL]).toBe(2);
      expect(NODE_FRAME_WIDTHS[NodeType.NODE_NOTABLE]).toBe(3);
      expect(NODE_FRAME_WIDTHS[NodeType.NODE_KEYSTONE]).toBe(4);
    });
  });

  describe('NODE_COLORS', () => {
    it('should have background colors', () => {
      expect(NODE_COLORS.unallocatedBg).toBeDefined();
      expect(NODE_COLORS.allocatedBg).toBeDefined();
      expect(NODE_COLORS.hoverBg).toBeDefined();
    });

    it('should have frame colors', () => {
      expect(NODE_COLORS.normalFrame).toBeDefined();
      expect(NODE_COLORS.notableFrame).toBeDefined();
      expect(NODE_COLORS.keystoneFrame).toBeDefined();
    });

    it('should have connection colors', () => {
      expect(NODE_COLORS.connectionNormal).toBeDefined();
      expect(NODE_COLORS.connectionAllocated).toBeDefined();
      expect(NODE_COLORS.connectionPath).toBeDefined();
    });
  });

  describe('NODE_ALPHAS', () => {
    it('should have alpha values for states', () => {
      expect(NODE_ALPHAS.unallocated).toBe(0.6);
      expect(NODE_ALPHAS.allocated).toBe(1.0);
      expect(NODE_ALPHAS.reachable).toBe(0.8);
      expect(NODE_ALPHAS.hovered).toBe(1.0);
    });
  });

  describe('NODE_ANIMATION', () => {
    it('should have animation constants', () => {
      expect(NODE_ANIMATION.hoverDuration).toBe(100);
      expect(NODE_ANIMATION.hoverScale).toBe(1.15);
      expect(NODE_ANIMATION.glowPulseDuration).toBe(1000);
    });
  });

  describe('LOD_LEVELS', () => {
    it('should have 3 LOD levels', () => {
      expect(LOD_LEVELS).toHaveLength(3);
    });

    it('should cover all zoom ranges', () => {
      // First level starts at 0
      expect(LOD_LEVELS[0]!.minZoom).toBe(0);
      // Last level ends at Infinity
      expect(LOD_LEVELS[2]!.maxZoom).toBe(Infinity);
    });

    it('should have increasing detail', () => {
      // Lowest LOD - no icons or labels
      expect(LOD_LEVELS[0]!.showIcons).toBe(false);
      expect(LOD_LEVELS[0]!.showLabels).toBe(false);
      expect(LOD_LEVELS[0]!.showGlows).toBe(false);

      // Highest LOD - all details
      expect(LOD_LEVELS[2]!.showIcons).toBe(true);
      expect(LOD_LEVELS[2]!.showLabels).toBe(true);
      expect(LOD_LEVELS[2]!.showGlows).toBe(true);
    });
  });

  describe('getLODLevel', () => {
    it('should return minimal LOD for very low zoom', () => {
      const lod = getLODLevel(0.1);
      expect(lod.showIcons).toBe(false);
      expect(lod.showLabels).toBe(false);
      expect(lod.sizeMultiplier).toBe(0.5);
    });

    it('should return medium LOD for medium zoom', () => {
      const lod = getLODLevel(0.4);
      expect(lod.showIcons).toBe(false);
      expect(lod.showFrameDetails).toBe(true);
      expect(lod.sizeMultiplier).toBe(0.75);
    });

    it('should return full LOD for high zoom', () => {
      const lod = getLODLevel(1.0);
      expect(lod.showIcons).toBe(true);
      expect(lod.showLabels).toBe(true);
      expect(lod.showGlows).toBe(true);
      expect(lod.sizeMultiplier).toBe(1.0);
    });

    it('should handle edge cases at boundaries', () => {
      // At exact boundary should be in the higher LOD
      const lodAt03 = getLODLevel(0.3);
      expect(lodAt03.minZoom).toBe(0.3);

      const lodAt06 = getLODLevel(0.6);
      expect(lodAt06.minZoom).toBe(0.6);
    });
  });

  describe('getNodeSize', () => {
    it('should return base size at zoom 1.0', () => {
      const size = getNodeSize(NodeType.NODE_NORMAL, 1.0);
      expect(size).toBe(24); // Base size * 1.0 multiplier
    });

    it('should scale size based on LOD', () => {
      const lowZoomSize = getNodeSize(NodeType.NODE_NORMAL, 0.1);
      const highZoomSize = getNodeSize(NodeType.NODE_NORMAL, 1.0);
      expect(lowZoomSize).toBeLessThan(highZoomSize);
    });

    it('should handle different node types', () => {
      const normalSize = getNodeSize(NodeType.NODE_NORMAL, 1.0);
      const keystoneSize = getNodeSize(NodeType.NODE_KEYSTONE, 1.0);
      expect(keystoneSize).toBeGreaterThan(normalSize);
    });
  });

  describe('getNodeFrameColor', () => {
    it('should return correct colors for each node type', () => {
      expect(getNodeFrameColor(NodeType.NODE_NORMAL)).toBe(NODE_COLORS.normalFrame);
      expect(getNodeFrameColor(NodeType.NODE_NOTABLE)).toBe(NODE_COLORS.notableFrame);
      expect(getNodeFrameColor(NodeType.NODE_KEYSTONE)).toBe(NODE_COLORS.keystoneFrame);
      expect(getNodeFrameColor(NodeType.NODE_MASTERY)).toBe(NODE_COLORS.masteryFrame);
      expect(getNodeFrameColor(NodeType.NODE_SOCKET)).toBe(NODE_COLORS.socketFrame);
    });

    it('should return normal frame for unknown type', () => {
      expect(getNodeFrameColor(NodeType.NODE_TYPE_UNKNOWN)).toBe(NODE_COLORS.normalFrame);
    });
  });

  describe('getNodeBackgroundColor', () => {
    it('should return allocated color for allocated nodes', () => {
      const state: NodeState = { ...DEFAULT_NODE_STATE, allocated: true };
      expect(getNodeBackgroundColor(state)).toBe(NODE_COLORS.allocatedBg);
    });

    it('should return hover color for hovered nodes', () => {
      const state: NodeState = { ...DEFAULT_NODE_STATE, hovered: true };
      expect(getNodeBackgroundColor(state)).toBe(NODE_COLORS.hoverBg);
    });

    it('should return path color for nodes in path', () => {
      const state: NodeState = { ...DEFAULT_NODE_STATE, inPath: true };
      expect(getNodeBackgroundColor(state)).toBe(NODE_COLORS.pathPreviewBg);
    });

    it('should return reachable color for reachable nodes', () => {
      const state: NodeState = { ...DEFAULT_NODE_STATE, reachable: true };
      expect(getNodeBackgroundColor(state)).toBe(NODE_COLORS.reachableBg);
    });

    it('should return unallocated color for default state', () => {
      expect(getNodeBackgroundColor(DEFAULT_NODE_STATE)).toBe(NODE_COLORS.unallocatedBg);
    });

    it('should prioritize allocated over other states', () => {
      const state: NodeState = {
        ...DEFAULT_NODE_STATE,
        allocated: true,
        hovered: true,
        reachable: true,
      };
      expect(getNodeBackgroundColor(state)).toBe(NODE_COLORS.allocatedBg);
    });
  });

  describe('getNodeAlpha', () => {
    it('should return full alpha for hovered nodes', () => {
      const state: NodeState = { ...DEFAULT_NODE_STATE, hovered: true };
      expect(getNodeAlpha(state)).toBe(NODE_ALPHAS.hovered);
    });

    it('should return full alpha for allocated nodes', () => {
      const state: NodeState = { ...DEFAULT_NODE_STATE, allocated: true };
      expect(getNodeAlpha(state)).toBe(NODE_ALPHAS.allocated);
    });

    it('should return reduced alpha for unreachable nodes', () => {
      expect(getNodeAlpha(DEFAULT_NODE_STATE)).toBe(NODE_ALPHAS.unreachable);
    });

    it('should prioritize hovered over allocated', () => {
      const state: NodeState = {
        ...DEFAULT_NODE_STATE,
        hovered: true,
        allocated: true,
      };
      expect(getNodeAlpha(state)).toBe(NODE_ALPHAS.hovered);
    });
  });

  describe('isSpecialNode', () => {
    it('should return true for notable nodes', () => {
      expect(isSpecialNode(NodeType.NODE_NOTABLE)).toBe(true);
    });

    it('should return true for keystone nodes', () => {
      expect(isSpecialNode(NodeType.NODE_KEYSTONE)).toBe(true);
    });

    it('should return true for mastery nodes', () => {
      expect(isSpecialNode(NodeType.NODE_MASTERY)).toBe(true);
    });

    it('should return true for socket nodes', () => {
      expect(isSpecialNode(NodeType.NODE_SOCKET)).toBe(true);
    });

    it('should return false for normal nodes', () => {
      expect(isSpecialNode(NodeType.NODE_NORMAL)).toBe(false);
    });

    it('should return false for class start nodes', () => {
      expect(isSpecialNode(NodeType.NODE_CLASS_START)).toBe(false);
    });
  });

  describe('isAscendancyNode', () => {
    it('should return true for ascendancy class start', () => {
      expect(isAscendancyNode(NodeType.NODE_ASCEND_CLASS_START)).toBe(true);
    });

    it('should return false for normal nodes', () => {
      expect(isAscendancyNode(NodeType.NODE_NORMAL)).toBe(false);
    });

    it('should return false for regular class start', () => {
      expect(isAscendancyNode(NodeType.NODE_CLASS_START)).toBe(false);
    });
  });

  describe('getNodeShapeSides', () => {
    it('should return 4 sides for notable (diamond)', () => {
      expect(getNodeShapeSides(NodeType.NODE_NOTABLE)).toBe(4);
    });

    it('should return 8 sides for keystone (octagon)', () => {
      expect(getNodeShapeSides(NodeType.NODE_KEYSTONE)).toBe(8);
    });

    it('should return 32 sides for normal (circle)', () => {
      expect(getNodeShapeSides(NodeType.NODE_NORMAL)).toBe(32);
    });

    it('should return 32 sides for mastery (circle)', () => {
      expect(getNodeShapeSides(NodeType.NODE_MASTERY)).toBe(32);
    });
  });

  describe('DEFAULT_NODE_STATE', () => {
    it('should have all flags set to false', () => {
      expect(DEFAULT_NODE_STATE.allocated).toBe(false);
      expect(DEFAULT_NODE_STATE.hovered).toBe(false);
      expect(DEFAULT_NODE_STATE.inPath).toBe(false);
      expect(DEFAULT_NODE_STATE.reachable).toBe(false);
      expect(DEFAULT_NODE_STATE.selected).toBe(false);
      expect(DEFAULT_NODE_STATE.searchMatch).toBe(false);
    });
  });

  describe('DEFAULT_RENDER_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RENDER_CONFIG.baseScale).toBe(1.0);
      expect(DEFAULT_RENDER_CONFIG.showAllocated).toBe(true);
      expect(DEFAULT_RENDER_CONFIG.showUnallocated).toBe(true);
      expect(DEFAULT_RENDER_CONFIG.enableGlows).toBe(true);
      expect(DEFAULT_RENDER_CONFIG.enableAnimations).toBe(true);
    });
  });
});
