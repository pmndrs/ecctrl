/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import type { EcctrlAnimationStateResolver } from "./types";

export const resolveEcctrlAnimationState: EcctrlAnimationStateResolver = ({
  isOnGround,
  wasOnGround,
  isFalling,
  isMoving,
  runActive,
  jumpActive,
}) => {
  if (jumpActive && wasOnGround) return "JUMP_START";

  if (isOnGround) {
    if (!wasOnGround) return "JUMP_LAND";
    if (!isMoving) return "IDLE";
    return runActive ? "RUN" : "WALK";
  }

  return isFalling ? "JUMP_FALL" : "JUMP_IDLE";
};
