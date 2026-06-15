import { useEffect, useState } from "react";

const hasTouchInput = () => {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
};

export function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(hasTouchInput);

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updateTouchDevice = () => setIsTouchDevice(hasTouchInput());

    updateTouchDevice();
    coarsePointerQuery.addEventListener("change", updateTouchDevice);
    return () => coarsePointerQuery.removeEventListener("change", updateTouchDevice);
  }, []);

  return isTouchDevice;
}
