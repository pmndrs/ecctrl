import { create } from "zustand";

export type ContorlType = "ecctrl" | "vehicle1" | "vehicle2" | "vehicle3";
export type VehicleAccessTargetType = {
  controller: Exclude<ContorlType, "ecctrl">;
  label: string;
} | null;

export interface controlStoreState {
  activeController: ContorlType;
  vehicleAccessTarget: VehicleAccessTargetType;
  setActiveController: (controller: ContorlType) => void;
  setVehicleAccessTarget: (target: VehicleAccessTargetType) => void;
}

export const useControlStore = /* @__PURE__ */ create<controlStoreState>(
  (set) => ({
    activeController: "ecctrl",
    vehicleAccessTarget: null,
    setActiveController: (status) => set({ activeController: status }),
    setVehicleAccessTarget: (target) => set({ vehicleAccessTarget: target }),
  })
);
