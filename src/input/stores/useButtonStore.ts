/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface ButtonStoreState {
  buttons: Record<string, boolean>;
  setButtonActive: (id: string, active: boolean) => void;
  resetAllButtons: () => void;
}

export const useButtonStore = /* @__PURE__ */ create(
  /* @__PURE__ */ subscribeWithSelector<ButtonStoreState>((set) => ({
    buttons: {},
    setButtonActive: (id, active) =>
      set((state) => ({ buttons: { ...state.buttons, [id]: active } })),
    resetAllButtons: () => set(() => ({ buttons: {} })),
  }))
);
