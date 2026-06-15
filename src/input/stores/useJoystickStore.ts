/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface JoystickState {
  active: boolean;
  x: number;
  y: number;
}

export interface JoystickStoreState {
  joysticks: Record<string, JoystickState>;
  setJoystick: (x: number, y: number, id?: string) => void;
  resetJoystick: (id?: string) => void;
}

const DEFAULT_ID = "default";
const EMPTY: JoystickState = { active: false, x: 0, y: 0 };
export const useJoystickStore = /* @__PURE__ */ create(
  /* @__PURE__ */ subscribeWithSelector<JoystickStoreState>((set) => ({
    joysticks: { [DEFAULT_ID]: { ...EMPTY } },
    setJoystick: (x: number, y: number, id?: string) =>
      set((state) => ({
        joysticks: {...state.joysticks,[id ?? DEFAULT_ID]: { active: !(x === 0 && y === 0), x, y }},
      })),
    resetJoystick: (id?: string) =>
      set((state) => ({
        joysticks: {...state.joysticks,[id ?? DEFAULT_ID]: { ...EMPTY }},
      })),
  }))
);
