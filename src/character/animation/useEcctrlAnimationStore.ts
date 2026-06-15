/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { EcctrlAnimationState } from "./types";

export interface EcctrlAnimationStoreState {
  animationState: EcctrlAnimationState;
  setAnimationState: (animationState: EcctrlAnimationState) => void;
}

export const useEcctrlAnimationStore = /* @__PURE__ */ create(
  /* @__PURE__ */ subscribeWithSelector<EcctrlAnimationStoreState>((set) => ({
    animationState: "IDLE",
    setAnimationState: (animationState) =>
      set((state) => {
        if (state.animationState === animationState) return state;
        return { animationState };
      }),
  }))
);
