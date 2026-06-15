/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three";
import { clamp } from "three/src/math/MathUtils.js";

export const remap = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

export const dynamicCurve = (
  a: number,
  b: number,
  c: number,
  d: number,
  t: number
) => {
  return (x: number) => a * Math.exp(-Math.pow((x + c) / d, t)) + b;
};

export const createSlerpVec3 = () => {
  const startClone = new THREE.Vector3();
  const relativeVec = new THREE.Vector3();
  const resultVec3 = new THREE.Vector3();

  return (
    start: THREE.Vector3,
    end: THREE.Vector3,
    percent: number,
    refAxis?: THREE.Vector3
  ) => {
    const dot = clamp(start.dot(end), -1, 1);

    // When vectors are nearly opposite, find a stable perpendicular vector
    if (Math.abs(dot + 1) < 0.001) {
      // Choose a stable perpendicular axis
      if (refAxis && Math.abs(refAxis.dot(start)) < 0.99) {
        relativeVec.copy(refAxis).normalize();
      } else {
        if (Math.abs(start.y) > 0.99) {
          relativeVec.set(1, 0, 0);
        } else if (Math.abs(start.x) > 0.99) {
          relativeVec.set(0, 1, 0);
        } else {
          relativeVec.set(0, 0, 1);
        }
      }
      // Compute orthogonal vector
      relativeVec.cross(start).normalize();
      const theta = Math.PI * percent;
      resultVec3
        .copy(start)
        .multiplyScalar(Math.cos(theta))
        .addScaledVector(relativeVec, Math.sin(theta));
    } else {
      const theta = Math.acos(dot) * percent;
      relativeVec
        .copy(end)
        .sub(startClone.copy(start).multiplyScalar(dot))
        .normalize();
      resultVec3
        .copy(start)
        .multiplyScalar(Math.cos(theta))
        .addScaledVector(relativeVec, Math.sin(theta));
    }

    return resultVec3.normalize();
  };
};
