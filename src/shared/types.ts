/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import type { ForwardRefExoticComponent, PropsWithoutRef, RefAttributes } from "react";

export type ForwardRefComponent<P, T> = ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;

export interface EcctrlUserDataType {
  ecctrl?: {
    excludeRay?: boolean;
    excludeCharacterRay?: boolean;
    excludeVehicleRay?: boolean;
  };
}
