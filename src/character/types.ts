/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

export type MovementInput = {
  forward?: boolean;
  backward?: boolean;
  leftward?: boolean;
  rightward?: boolean;
  joystick?: { x: number; y: number };
  run?: boolean;
  jump?: boolean;
};

type ReadonlyJoystickInput = Readonly<{ x: number; y: number }>;

export type ReadonlyMovementInput = Readonly<Omit<MovementInput, "joystick">> & {
  readonly joystick?: ReadonlyJoystickInput;
};
