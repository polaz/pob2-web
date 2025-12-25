// test/unit/components/tree/connectors/ConnectorGeometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  distance,
  midpoint,
  lerp,
  normalizeAngle,
  angleDifference,
  pointOnCircle,
  shouldUseArc,
  calculateArcData,
  arcToBezierCurves,
  evaluateBezier,
  splitBezier,
  sampleBezier,
  lerpColor,
  lerpAlpha,
} from 'src/components/tree/connectors/ConnectorGeometry';
import type { ArcData, BezierCurve } from 'src/components/tree/connectors/ConnectorTypes';

describe('ConnectorGeometry', () => {
  describe('distance', () => {
    it('should calculate distance between two points', () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
      expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
      expect(distance({ x: -1, y: -1 }, { x: 2, y: 3 })).toBeCloseTo(5, 5);
    });
  });

  describe('midpoint', () => {
    it('should calculate midpoint between two points', () => {
      const mid = midpoint({ x: 0, y: 0 }, { x: 10, y: 10 });
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });

    it('should handle negative coordinates', () => {
      const mid = midpoint({ x: -10, y: -10 }, { x: 10, y: 10 });
      expect(mid.x).toBe(0);
      expect(mid.y).toBe(0);
    });
  });

  describe('lerp', () => {
    it('should interpolate between two points', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 10, y: 20 };

      expect(lerp(p1, p2, 0)).toEqual({ x: 0, y: 0 });
      expect(lerp(p1, p2, 1)).toEqual({ x: 10, y: 20 });
      expect(lerp(p1, p2, 0.5)).toEqual({ x: 5, y: 10 });
    });
  });

  describe('normalizeAngle', () => {
    it('should normalize angles to [0, 2π)', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 10);
      expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0, 10);
      expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 10);
      expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    });
  });

  describe('angleDifference', () => {
    it('should calculate signed angular difference', () => {
      expect(angleDifference(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10);
      expect(angleDifference(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2, 10);
      // Crossing 0/2π boundary
      expect(angleDifference(0, -Math.PI / 4)).toBeCloseTo(-Math.PI / 4, 10);
    });
  });

  describe('pointOnCircle', () => {
    it('should calculate point on circle at given angle', () => {
      const p = pointOnCircle(0, 0, 10, 0);
      expect(p.x).toBeCloseTo(10, 10);
      expect(p.y).toBeCloseTo(0, 10);

      const p2 = pointOnCircle(0, 0, 10, Math.PI / 2);
      expect(p2.x).toBeCloseTo(0, 10);
      expect(p2.y).toBeCloseTo(10, 10);
    });

    it('should handle non-zero center', () => {
      const p = pointOnCircle(5, 5, 10, 0);
      expect(p.x).toBeCloseTo(15, 10);
      expect(p.y).toBeCloseTo(5, 10);
    });
  });

  describe('shouldUseArc', () => {
    it('should return true for same group and orbit', () => {
      expect(shouldUseArc(1, 1, 2, 2)).toBe(true);
    });

    it('should return false for different groups', () => {
      expect(shouldUseArc(1, 2, 2, 2)).toBe(false);
    });

    it('should return false for different orbits', () => {
      expect(shouldUseArc(1, 1, 1, 2)).toBe(false);
    });

    it('should return false for orbit 0', () => {
      expect(shouldUseArc(1, 1, 0, 0)).toBe(false);
    });

    it('should return false for undefined values', () => {
      expect(shouldUseArc(undefined, 1, 2, 2)).toBe(false);
      expect(shouldUseArc(1, undefined, 2, 2)).toBe(false);
      expect(shouldUseArc(1, 1, undefined, 2)).toBe(false);
      expect(shouldUseArc(1, 1, 2, undefined)).toBe(false);
    });
  });

  describe('calculateArcData', () => {
    it('should calculate arc data for points on a circle', () => {
      const center = { x: 0, y: 0 };
      const from = { x: 10, y: 0 }; // angle 0
      const to = { x: 0, y: 10 }; // angle π/2

      const arc = calculateArcData(from, to, center, 10);

      expect(arc).not.toBeNull();
      expect(arc!.centerX).toBe(0);
      expect(arc!.centerY).toBe(0);
      expect(arc!.radius).toBe(10);
      expect(arc!.startAngle).toBeCloseTo(0, 5);
      expect(arc!.endAngle).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should return null for very small arcs', () => {
      const center = { x: 0, y: 0 };
      const from = { x: 10, y: 0 };
      const to = { x: 10, y: 0.5 }; // Very small angle

      const arc = calculateArcData(from, to, center, 10);
      expect(arc).toBeNull();
    });
  });

  describe('arcToBezierCurves', () => {
    it('should convert small arc to single bezier curve', () => {
      const arc: ArcData = {
        centerX: 0,
        centerY: 0,
        radius: 10,
        startAngle: 0,
        endAngle: Math.PI / 4, // 45 degrees
        clockwise: false,
      };

      const curves = arcToBezierCurves(arc);

      expect(curves.length).toBe(1);
      // Start point should be on the arc
      expect(curves[0]!.p0.x).toBeCloseTo(10, 5);
      expect(curves[0]!.p0.y).toBeCloseTo(0, 5);
    });

    it('should split large arc into multiple bezier curves', () => {
      const arc: ArcData = {
        centerX: 0,
        centerY: 0,
        radius: 10,
        startAngle: 0,
        endAngle: Math.PI, // 180 degrees
        clockwise: false,
      };

      const curves = arcToBezierCurves(arc);

      // 180 degrees should be split into 2 segments (max 90 each)
      expect(curves.length).toBe(2);
    });
  });

  describe('evaluateBezier', () => {
    it('should return start point at t=0', () => {
      const curve: BezierCurve = {
        p0: { x: 0, y: 0 },
        p1: { x: 10, y: 0 },
        p2: { x: 10, y: 10 },
        p3: { x: 0, y: 10 },
      };

      const p = evaluateBezier(curve, 0);
      expect(p.x).toBeCloseTo(0, 10);
      expect(p.y).toBeCloseTo(0, 10);
    });

    it('should return end point at t=1', () => {
      const curve: BezierCurve = {
        p0: { x: 0, y: 0 },
        p1: { x: 10, y: 0 },
        p2: { x: 10, y: 10 },
        p3: { x: 0, y: 10 },
      };

      const p = evaluateBezier(curve, 1);
      expect(p.x).toBeCloseTo(0, 10);
      expect(p.y).toBeCloseTo(10, 10);
    });

    it('should return intermediate point at t=0.5', () => {
      // Straight line bezier
      const curve: BezierCurve = {
        p0: { x: 0, y: 0 },
        p1: { x: 5, y: 5 },
        p2: { x: 5, y: 5 },
        p3: { x: 10, y: 10 },
      };

      const p = evaluateBezier(curve, 0.5);
      expect(p.x).toBeCloseTo(5, 5);
      expect(p.y).toBeCloseTo(5, 5);
    });
  });

  describe('splitBezier', () => {
    it('should split bezier at midpoint', () => {
      const curve: BezierCurve = {
        p0: { x: 0, y: 0 },
        p1: { x: 10, y: 0 },
        p2: { x: 10, y: 10 },
        p3: { x: 0, y: 10 },
      };

      const [first, second] = splitBezier(curve, 0.5);

      // First curve should start at original start
      expect(first.p0).toEqual(curve.p0);

      // Second curve should end at original end
      expect(second.p3).toEqual(curve.p3);

      // Split point should be the same
      expect(first.p3.x).toBeCloseTo(second.p0.x, 10);
      expect(first.p3.y).toBeCloseTo(second.p0.y, 10);
    });
  });

  describe('sampleBezier', () => {
    it('should sample correct number of points', () => {
      const curve: BezierCurve = {
        p0: { x: 0, y: 0 },
        p1: { x: 10, y: 0 },
        p2: { x: 10, y: 10 },
        p3: { x: 0, y: 10 },
      };

      const points = sampleBezier(curve, 10);
      expect(points.length).toBe(11); // n+1 points for n segments
    });

    it('should start and end at curve endpoints', () => {
      const curve: BezierCurve = {
        p0: { x: 0, y: 0 },
        p1: { x: 10, y: 0 },
        p2: { x: 10, y: 10 },
        p3: { x: 20, y: 20 },
      };

      const points = sampleBezier(curve, 5);
      expect(points[0]!.x).toBeCloseTo(0, 10);
      expect(points[0]!.y).toBeCloseTo(0, 10);
      expect(points[points.length - 1]!.x).toBeCloseTo(20, 10);
      expect(points[points.length - 1]!.y).toBeCloseTo(20, 10);
    });
  });

  describe('lerpColor', () => {
    it('should interpolate between two colors', () => {
      const red = 0xff0000;
      const blue = 0x0000ff;

      const start = lerpColor(red, blue, 0);
      expect(start).toBe(red);

      const end = lerpColor(red, blue, 1);
      expect(end).toBe(blue);

      const mid = lerpColor(red, blue, 0.5);
      /**
       * Color interpolation tolerance bounds.
       * When interpolating between 0 and 255 at t=0.5:
       * - Exact value is 127.5
       * - Math.round gives either 127 or 128 depending on floating point
       * These bounds account for acceptable rounding variance.
       */
      const INTERPOLATION_MIN = 127;
      const INTERPOLATION_MAX = 128;
      const RED_CHANNEL_SHIFT = 16;
      const COLOR_CHANNEL_MASK = 0xff;

      const redChannel = (mid >> RED_CHANNEL_SHIFT) & COLOR_CHANNEL_MASK;
      const blueChannel = mid & COLOR_CHANNEL_MASK;
      expect(redChannel).toBeGreaterThanOrEqual(INTERPOLATION_MIN);
      expect(redChannel).toBeLessThanOrEqual(INTERPOLATION_MAX);
      expect(blueChannel).toBeGreaterThanOrEqual(INTERPOLATION_MIN);
      expect(blueChannel).toBeLessThanOrEqual(INTERPOLATION_MAX);
    });
  });

  describe('lerpAlpha', () => {
    it('should interpolate between two alpha values', () => {
      expect(lerpAlpha(0, 1, 0)).toBe(0);
      expect(lerpAlpha(0, 1, 1)).toBe(1);
      expect(lerpAlpha(0, 1, 0.5)).toBe(0.5);
      expect(lerpAlpha(0.2, 0.8, 0.5)).toBe(0.5);
    });
  });
});
