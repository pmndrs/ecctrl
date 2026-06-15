/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

export { default as EcctrlVehicle } from "./vehicles/EcctrlVehicle";
export type {
  CarConfigType,
  DroneConfigType,
  EcctrlVehicleHandle,
  EcctrlVehicleProps,
  PropellersInfoType,
  WheelsInfoType,
} from "./vehicles/EcctrlVehicle";

export { default as ShapeCastWheel } from "./vehicles/components/ShapeCastWheel";
export type {
  DriveWheelConfigType,
  ShapeCastWheelProps,
  SteerWheelConfigType,
  WheelInfoType,
} from "./vehicles/components/ShapeCastWheel";

export { default as ThrustPropeller } from "./vehicles/components/ThrustPropeller";
export type {
  PropellerInfoType,
  ThrustPropellerProps,
} from "./vehicles/components/ThrustPropeller";

export type { ReadonlyVehicleInput, VehicleInput } from "./vehicles/types";
