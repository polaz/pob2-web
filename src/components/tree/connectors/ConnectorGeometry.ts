// src/components/tree/connectors/ConnectorGeometry.ts
// Geometry utilities for arc and bezier curve calculations

import type { Point, BezierCurve, ArcData } from './ConnectorTypes';
import { MAX_SINGLE_BEZIER_ANGLE, MIN_ARC_ANGLE } from './ConnectorTypes';

// ============================================================================
// Constants
// ============================================================================

/**
 * RGB color bit manipulation constants.
 * Colors are stored as 24-bit RGB integers: 0xRRGGBB
 */
/** Bit mask for 8-bit color channel (0-255) */
const COLOR_CHANNEL_MASK = 0xff;
/** Bit shift for red channel (bits 16-23) */
const RED_CHANNEL_SHIFT = 16;
/** Bit shift for green channel (bits 8-15) */
const GREEN_CHANNEL_SHIFT = 8;

/**
 * Cubic bezier binomial coefficient.
 * The cubic bezier formula uses binomial coefficients [1, 3, 3, 1] from Pascal's triangle.
 * B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
const CUBIC_BEZIER_COEFFICIENT = 3;

// ============================================================================
// Basic Geometry
// ============================================================================

/**
 * Calculate distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate midpoint between two points.
 */
export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Linear interpolation between two points.
 */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

/**
 * Normalize an angle to the range [0, 2π).
 */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized < 0) {
    normalized += twoPi;
  }
  return normalized;
}

/**
 * Calculate the signed angular difference between two angles.
 * Returns a value in the range (-π, π].
 */
export function angleDifference(from: number, to: number): number {
  let diff = normalizeAngle(to) - normalizeAngle(from);
  if (diff > Math.PI) {
    diff -= Math.PI * 2;
  } else if (diff <= -Math.PI) {
    diff += Math.PI * 2;
  }
  return diff;
}

/**
 * Get a point on a circle at a given angle.
 */
export function pointOnCircle(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number
): Point {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

// ============================================================================
// Arc Detection
// ============================================================================

/**
 * Determine if two connected nodes should use an arc connection.
 *
 * Nodes use arcs when:
 * - They are in the same group
 * - They are on the same orbit (same radius from group center)
 * - The arc angle is significant enough to be visible
 *
 * @param fromGroup - Group ID of first node
 * @param toGroup - Group ID of second node
 * @param fromOrbit - Orbit level of first node
 * @param toOrbit - Orbit level of second node
 * @returns True if an arc should be used
 */
export function shouldUseArc(
  fromGroup: number | undefined,
  toGroup: number | undefined,
  fromOrbit: number | undefined,
  toOrbit: number | undefined
): boolean {
  // Must have valid group and orbit data
  if (
    fromGroup === undefined ||
    toGroup === undefined ||
    fromOrbit === undefined ||
    toOrbit === undefined
  ) {
    return false;
  }

  // Same group and same orbit = arc
  return fromGroup === toGroup && fromOrbit === toOrbit && fromOrbit > 0;
}

/**
 * Calculate arc data for two nodes on the same orbit.
 *
 * @param from - Start point (node position)
 * @param to - End point (node position)
 * @param groupCenter - Center of the group
 * @param radius - Orbit radius
 * @returns Arc data or null if arc is too small
 */
export function calculateArcData(
  from: Point,
  to: Point,
  groupCenter: Point,
  radius: number
): ArcData | null {
  // Calculate angles from group center to each node
  const startAngle = Math.atan2(from.y - groupCenter.y, from.x - groupCenter.x);
  const endAngle = Math.atan2(to.y - groupCenter.y, to.x - groupCenter.x);

  // Calculate the arc angle
  const arcAngle = Math.abs(angleDifference(startAngle, endAngle));

  // If arc is too small, use straight line instead
  if (arcAngle < MIN_ARC_ANGLE) {
    return null;
  }

  // Determine direction: use the shorter arc
  const diff = angleDifference(startAngle, endAngle);
  const clockwise = diff < 0;

  return {
    centerX: groupCenter.x,
    centerY: groupCenter.y,
    radius,
    startAngle,
    endAngle,
    clockwise,
  };
}

// ============================================================================
// Bezier Curve Approximation
// ============================================================================

/**
 * Approximate a circular arc with a single cubic bezier curve.
 *
 * This uses the standard method for approximating circular arcs with bezier curves.
 * For arcs up to 90 degrees, a single bezier provides good accuracy.
 *
 * The control point distance is calculated as:
 * h = (4/3) * tan(θ/4) * r
 *
 * where θ is the arc angle and r is the radius.
 *
 * @param arc - Arc data
 * @param fromAngle - Start angle of this segment
 * @param toAngle - End angle of this segment
 * @returns Cubic bezier curve approximating the arc segment
 */
export function arcToBezierSegment(
  arc: ArcData,
  fromAngle: number,
  toAngle: number
): BezierCurve {
  const { centerX, centerY, radius } = arc;

  // Calculate arc angle for this segment
  let arcAngle = toAngle - fromAngle;
  if (arc.clockwise && arcAngle > 0) {
    arcAngle -= Math.PI * 2;
  } else if (!arc.clockwise && arcAngle < 0) {
    arcAngle += Math.PI * 2;
  }

  // Control point distance factor
  // For a 90-degree arc, this equals BEZIER_KAPPA
  // For other angles: (4/3) * tan(θ/4)
  const tanHalfHalf = Math.tan(arcAngle / 4);
  const alpha = (4 / 3) * tanHalfHalf;

  // Start and end points on the circle
  const p0 = pointOnCircle(centerX, centerY, radius, fromAngle);
  const p3 = pointOnCircle(centerX, centerY, radius, toAngle);

  // Control points are perpendicular to the radius at start/end
  // Direction depends on arc direction
  const p1: Point = {
    x: p0.x - alpha * radius * Math.sin(fromAngle),
    y: p0.y + alpha * radius * Math.cos(fromAngle),
  };

  const p2: Point = {
    x: p3.x + alpha * radius * Math.sin(toAngle),
    y: p3.y - alpha * radius * Math.cos(toAngle),
  };

  return { p0, p1, p2, p3 };
}

/**
 * Convert an arc to one or more cubic bezier curves.
 *
 * For arcs larger than 90 degrees, multiple bezier segments are used
 * to maintain accuracy. Each segment approximates at most 90 degrees.
 *
 * @param arc - Arc data
 * @returns Array of bezier curves (at least one)
 */
export function arcToBezierCurves(arc: ArcData): BezierCurve[] {
  const { startAngle, endAngle, clockwise } = arc;

  // Calculate total arc angle
  let totalAngle = endAngle - startAngle;
  if (clockwise) {
    if (totalAngle > 0) totalAngle -= Math.PI * 2;
  } else {
    if (totalAngle < 0) totalAngle += Math.PI * 2;
  }

  const absTotalAngle = Math.abs(totalAngle);

  // If arc is small enough, use single bezier
  if (absTotalAngle <= MAX_SINGLE_BEZIER_ANGLE) {
    return [arcToBezierSegment(arc, startAngle, endAngle)];
  }

  // Split into segments of at most 90 degrees
  const numSegments = Math.ceil(absTotalAngle / MAX_SINGLE_BEZIER_ANGLE);
  const segmentAngle = totalAngle / numSegments;

  const curves: BezierCurve[] = [];
  let currentAngle = startAngle;

  for (let i = 0; i < numSegments; i++) {
    const nextAngle = currentAngle + segmentAngle;
    curves.push(arcToBezierSegment(arc, currentAngle, nextAngle));
    currentAngle = nextAngle;
  }

  return curves;
}

// ============================================================================
// Bezier Curve Utilities
// ============================================================================

/**
 * Evaluate a point on a cubic bezier curve at parameter t.
 *
 * Uses De Casteljau's algorithm for numerical stability.
 *
 * @param curve - Bezier curve
 * @param t - Parameter value (0 to 1)
 * @returns Point on curve at parameter t
 */
export function evaluateBezier(curve: BezierCurve, t: number): Point {
  const { p0, p1, p2, p3 } = curve;

  // De Casteljau's algorithm
  const oneMinusT = 1 - t;
  const oneMinusTSq = oneMinusT * oneMinusT;
  const oneMinusTCub = oneMinusTSq * oneMinusT;
  const tSq = t * t;
  const tCub = tSq * t;

  // Cubic bezier formula: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
  return {
    x:
      oneMinusTCub * p0.x +
      CUBIC_BEZIER_COEFFICIENT * oneMinusTSq * t * p1.x +
      CUBIC_BEZIER_COEFFICIENT * oneMinusT * tSq * p2.x +
      tCub * p3.x,
    y:
      oneMinusTCub * p0.y +
      CUBIC_BEZIER_COEFFICIENT * oneMinusTSq * t * p1.y +
      CUBIC_BEZIER_COEFFICIENT * oneMinusT * tSq * p2.y +
      tCub * p3.y,
  };
}

/**
 * Split a bezier curve at parameter t.
 *
 * @param curve - Original bezier curve
 * @param t - Split point (0 to 1)
 * @returns Two bezier curves [first half, second half]
 */
export function splitBezier(
  curve: BezierCurve,
  t: number
): [BezierCurve, BezierCurve] {
  const { p0, p1, p2, p3 } = curve;

  // First level interpolation
  const p01 = lerp(p0, p1, t);
  const p12 = lerp(p1, p2, t);
  const p23 = lerp(p2, p3, t);

  // Second level
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);

  // Third level - the split point
  const p0123 = lerp(p012, p123, t);

  return [
    { p0: p0, p1: p01, p2: p012, p3: p0123 },
    { p0: p0123, p1: p123, p2: p23, p3: p3 },
  ];
}

/**
 * Sample points along a bezier curve.
 *
 * @param curve - Bezier curve
 * @param numPoints - Number of points to sample
 * @returns Array of points along the curve
 */
export function sampleBezier(curve: BezierCurve, numPoints: number): Point[] {
  const points: Point[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push(evaluateBezier(curve, t));
  }

  return points;
}

/**
 * Sample points along multiple bezier curves.
 *
 * @param curves - Array of bezier curves
 * @param pointsPerCurve - Number of points per curve
 * @returns Array of points along all curves
 */
export function sampleBezierCurves(
  curves: BezierCurve[],
  pointsPerCurve: number
): Point[] {
  const points: Point[] = [];

  for (let i = 0; i < curves.length; i++) {
    const curve = curves[i]!;
    // For first curve, include start point
    // For subsequent curves, skip start point (it's the same as previous end)
    const startIndex = i === 0 ? 0 : 1;

    for (let j = startIndex; j <= pointsPerCurve; j++) {
      const t = j / pointsPerCurve;
      points.push(evaluateBezier(curve, t));
    }
  }

  return points;
}

// ============================================================================
// Gradient Helpers
// ============================================================================

/**
 * Interpolate between two colors.
 *
 * @param color1 - First color (hex number)
 * @param color2 - Second color (hex number)
 * @param t - Interpolation factor (0 = color1, 1 = color2)
 * @returns Interpolated color
 */
export function lerpColor(color1: number, color2: number, t: number): number {
  // Extract RGB channels using bit shifts and masks
  const r1 = (color1 >> RED_CHANNEL_SHIFT) & COLOR_CHANNEL_MASK;
  const g1 = (color1 >> GREEN_CHANNEL_SHIFT) & COLOR_CHANNEL_MASK;
  const b1 = color1 & COLOR_CHANNEL_MASK;

  const r2 = (color2 >> RED_CHANNEL_SHIFT) & COLOR_CHANNEL_MASK;
  const g2 = (color2 >> GREEN_CHANNEL_SHIFT) & COLOR_CHANNEL_MASK;
  const b2 = color2 & COLOR_CHANNEL_MASK;

  // Interpolate each channel
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  // Recombine channels into 24-bit RGB color
  return (r << RED_CHANNEL_SHIFT) | (g << GREEN_CHANNEL_SHIFT) | b;
}

/**
 * Interpolate between two alpha values.
 */
export function lerpAlpha(alpha1: number, alpha2: number, t: number): number {
  return alpha1 + (alpha2 - alpha1) * t;
}
