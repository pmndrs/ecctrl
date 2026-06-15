/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { RapierRigidBody } from "@react-three/rapier";

export interface CustomGravityState {
  gravityField: (pos: THREE.Vector3) => THREE.Vector3;
  setGravityField: (fn: (pos: THREE.Vector3) => THREE.Vector3) => void;
  applyGravityField: (body: RapierRigidBody, timeStep: number) => void;
}

const _bodyPos = new THREE.Vector3();
const _gravity = new THREE.Vector3();
const _impulse = new THREE.Vector3();

export const useCustomGravity = /* @__PURE__ */ create(
  /* @__PURE__ */ subscribeWithSelector<CustomGravityState>((set, get) => {
    return {
      gravityField: () => new THREE.Vector3(0, -9.81, 0),
      setGravityField: (fn) => set({ gravityField: fn }),
      applyGravityField: (body: RapierRigidBody, timeStep: number) => {
        if (body.isSleeping()) return;
        _bodyPos.copy(body.translation());
        _gravity.copy(get().gravityField(_bodyPos));
        _impulse.copy(_gravity).multiplyScalar(body.mass() * body.gravityScale() * timeStep);
        body.applyImpulse(_impulse, false);
      },
    };
  })
);
