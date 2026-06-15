/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

export type VehicleInput = {
  // General movement for car
  forward?: boolean;
  backward?: boolean;
  steerLeft?: boolean;
  steerRight?: boolean;
  brake?: boolean;

  // General movement for drone
  throttleUp?: boolean;
  throttleDown?: boolean;
  yawLeft?: boolean;
  yawRight?: boolean;
  pitchForward?: boolean;
  pitchBackward?: boolean;
  rollLeft?: boolean;
  rollRight?: boolean;

  // Optional joystick inputs
  joystickL?: { x: number; y: number };
  joystickR?: { x: number; y: number };
};

type ReadonlyJoystickInput = Readonly<{ x: number; y: number }>;

export type ReadonlyVehicleInput = Readonly<Omit<VehicleInput, "joystickL" | "joystickR">> & {
  readonly joystickL?: ReadonlyJoystickInput;
  readonly joystickR?: ReadonlyJoystickInput;
};
