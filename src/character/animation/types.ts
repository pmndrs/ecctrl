/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import type { EcctrlHandle } from "../Ecctrl";

export type EcctrlAnimationState =
  | "IDLE"
  | "WALK"
  | "RUN"
  | "JUMP_START"
  | "JUMP_IDLE"
  | "JUMP_FALL"
  | "JUMP_LAND";

export interface EcctrlAnimationStateContext {
  readonly handle: EcctrlHandle;
  readonly isOnGround: boolean;
  readonly wasOnGround: boolean;
  readonly isFalling: boolean;
  readonly isMoving: boolean;
  readonly runActive: boolean;
  readonly jumpActive: boolean;
}

export type EcctrlAnimationStateResolver = (
  context: EcctrlAnimationStateContext
) => EcctrlAnimationState;
