/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three";
import { CameraControlsImpl } from "@react-three/drei";

/**
 * Custom CameraControls class to allow dynamic up axis change
 */
class EcctrlCameraControlsImpl extends CameraControlsImpl {
  declare private _oldUp: THREE.Vector3;
  declare private _newUp: THREE.Vector3;

  declare private _pivotXAxis: THREE.Vector3;
  declare private _pivotYAxis: THREE.Vector3;
  declare private _pivotZAxis: THREE.Vector3;
  declare private _rotZ: THREE.Quaternion;
  declare private _rotX: THREE.Quaternion;

  // Create EcctrlCameraControls instance
  constructor(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    domElement?: HTMLElement
  ) {
    super(camera, domElement);
    this._oldUp = new THREE.Vector3(0, 1, 0);
    this._newUp = new THREE.Vector3(0, 1, 0);
    this._pivotXAxis = new THREE.Vector3();
    this._pivotYAxis = new THREE.Vector3();
    this._pivotZAxis = new THREE.Vector3();
    this._rotZ = new THREE.Quaternion();
    this._rotX = new THREE.Quaternion();
  }

  // Custom method to set up axis
  setUp(newUp: THREE.Vector3) {
    // Store and normalize the new up vector
    this._newUp.copy(newUp).normalize();

    // Calculate the angle between old and new up vectors
    const angleBetween = this._newUp.angleTo(this._oldUp);
    // If there is a change in up vector, adjust the camera orientation
    if (angleBetween > 0) {
      // Compute pivot axes
      this._pivotYAxis.copy(this._oldUp);
      this._pivotXAxis.crossVectors(this._newUp, this._oldUp).normalize();
      this._pivotZAxis.crossVectors(this._pivotXAxis, this._pivotYAxis).normalize();
      // Measure angles between newUp and pivot axes
      const upRightPivotAngle = Math.PI / 2 - this._newUp.angleTo(this._pivotXAxis);
      const frontRightPivotAngle = Math.PI / 2 - this._newUp.angleTo(this._pivotZAxis);
      // Create incremental quaternions to rotate pivot axes
      this._rotZ.setFromAxisAngle(this._pivotZAxis, upRightPivotAngle);
      this._rotX.setFromAxisAngle(this._pivotXAxis, frontRightPivotAngle);
      // Apply incremental rotation to _yAxisUpSpace
      this._yAxisUpSpaceInverse.premultiply(this._rotZ).premultiply(this._rotX);
      this._yAxisUpSpace.copy(this._yAxisUpSpaceInverse).invert();
      // Store current up for next frame
      this._oldUp.copy(this._newUp);
    }
  }
}

/**
 * Export custome camera controls (EcctrlCameraControls)
 */
import React, { forwardRef } from "react";
import { CameraControls, type CameraControlsProps } from "@react-three/drei";
import type { ForwardRefComponent } from "../shared/types";
export const EcctrlCameraControls: ForwardRefComponent<CameraControlsProps, EcctrlCameraControlsImpl> = /* @__PURE__ */ forwardRef<
  EcctrlCameraControlsImpl,
  CameraControlsProps
>((props, ref) => {
  return <CameraControls {...props} ref={ref} impl={EcctrlCameraControlsImpl} />
})
export type EcctrlCameraControls = EcctrlCameraControlsImpl
