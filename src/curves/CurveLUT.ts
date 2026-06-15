/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

export type CurvePoint = {
  x: number;
  y: number;
  r_in?: number;
  r_out?: number;
  w_in?: number;
  w_out?: number;
};

export type CurveLUT = {
  lut: Float32Array;
  xMin: number;
  xMax: number;
  samples: number;
};

export type CurveData = {
  points: CurvePoint[];
  samples?: number;
};

/**
 * Weighted cubic Hermite curve functions.
 * Weight blends each user tangent toward the segment linear slope:
 * weight 0 = straight line, weight 1 = user tangent.
 */
function evalHermiteSegment(p0: CurvePoint, p1: CurvePoint, x: number) {
  const x0 = p0.x;
  const x1 = p1.x;
  const dx = x1 - x0;
  if (dx <= 0) return p0.y; // fallback if points overlap

  const t = (x - x0) / dx;
  const t2 = t * t;
  const t3 = t2 * t;

  // Cubic Hermite basis functions
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  // Convert angle (rad) -> slope (dy/dx)
  const m0 = p0.r_out !== undefined ? Math.tan(p0.r_out) : 0;
  const m1 = p1.r_in !== undefined ? Math.tan(p1.r_in) : 0;
  const w_out = p0.w_out ?? 1;
  const w_in = p1.w_in ?? 1;
  const linearSlope = (p1.y - p0.y) / dx;
  const weightedM0 = linearSlope + (m0 - linearSlope) * w_out;
  const weightedM1 = linearSlope + (m1 - linearSlope) * w_in;

  return h00 * p0.y + h10 * weightedM0 * dx + h01 * p1.y + h11 * weightedM1 * dx;
}

function findSegmentByX(x: number, points: CurvePoint[]) {
  let low = 0;
  let high = points.length - 2;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (x < points[mid].x) high = mid - 1;
    else if (x > points[mid + 1].x) low = mid + 1;
    else return mid;
  }
  return x < points[0].x ? 0 : points.length - 2;
}

function evalMultiPointCurveAtX(x: number, points: CurvePoint[]) {
  const i = findSegmentByX(x, points);
  const p0 = points[i];
  const p1 = points[i + 1];
  return evalHermiteSegment(p0, p1, x);
}

export function bakeCurveLUT(points: CurvePoint[], samples: number = 50): CurveLUT {
  if (points.length < 2) throw new Error("Curve needs at least 2 points");
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const xMin = sortedPoints[0].x;
  const xMax = sortedPoints[sortedPoints.length - 1].x;
  const lut = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1);
    const x = xMin + u * (xMax - xMin);
    lut[i] = evalMultiPointCurveAtX(x, sortedPoints);
  }
  return { lut, xMin, xMax, samples };
}

export function evaluateCurveLUT(x: number, curve: CurveLUT) {
  const { lut, xMin, xMax, samples } = curve;
  const u = (x - xMin) / (xMax - xMin);
  if (u <= 0) return lut[0];
  if (u >= 1) return lut[samples - 1];
  const f = u * (samples - 1);
  const i = f | 0;
  const t = f - i;
  const y0 = lut[i];
  const y1 = lut[i + 1];
  return y0 * (1 - t) + y1 * t;
}
