/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { EcctrlHandle } from "../Ecctrl";
import { resolveEcctrlAnimationState } from "./resolveAnimationState";
import { useEcctrlAnimationStore } from "./useEcctrlAnimationStore";
import type {
  EcctrlAnimationState,
  EcctrlAnimationStateContext,
  EcctrlAnimationStateResolver,
} from "./types";

type MutableEcctrlAnimationStateContext = {
  -readonly [Key in keyof EcctrlAnimationStateContext]: EcctrlAnimationStateContext[Key];
};

export interface EcctrlAnimationStateControllerProps {
  ecctrl: RefObject<EcctrlHandle | null>;
  enabled?: boolean;
  resolver?: EcctrlAnimationStateResolver;
  onChange?: (
    animationState: EcctrlAnimationState,
    context: EcctrlAnimationStateContext
  ) => void;
}

export function EcctrlAnimationStateController({
  ecctrl,
  enabled = true,
  resolver = resolveEcctrlAnimationState,
  onChange,
}: EcctrlAnimationStateControllerProps) {
  const initialized = useRef(false);
  const previousIsOnGround = useRef(false);
  const currentAnimationState = useRef<EcctrlAnimationState>("IDLE");
  const context = useRef<MutableEcctrlAnimationStateContext>({
    handle: null as unknown as EcctrlHandle,
    isOnGround: false,
    wasOnGround: false,
    isFalling: false,
    isMoving: false,
    runActive: false,
    jumpActive: false,
  });

  useFrame(() => {
    if (!enabled) return;

    const handle = ecctrl.current;
    if (!handle) return;

    const ctx = context.current;
    const isOnGround = handle.isOnGround;

    // Avoid firing JUMP_LAND on the first valid frame when the character starts grounded.
    ctx.handle = handle;
    ctx.isOnGround = isOnGround;
    ctx.wasOnGround = initialized.current ? previousIsOnGround.current : isOnGround;
    ctx.isFalling = handle.isFalling;
    ctx.isMoving = handle.isMoving;
    ctx.runActive = handle.runActive;
    ctx.jumpActive = handle.jumpActive;

    const nextAnimationState = resolver(ctx);
    if (currentAnimationState.current !== nextAnimationState) {
      useEcctrlAnimationStore.getState().setAnimationState(nextAnimationState);
      onChange?.(nextAnimationState, { ...ctx });
      currentAnimationState.current = nextAnimationState;
    }

    previousIsOnGround.current = isOnGround;
    initialized.current = true;
  });

  return null;
}
