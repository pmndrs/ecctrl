import { useControlStore } from "../store/useControlStore";

export function InteractionPrompt() {
  const activeController = useControlStore((state) => state.activeController);
  const vehicleAccessTarget = useControlStore((state) => state.vehicleAccessTarget);

  if (activeController !== "ecctrl" || !vehicleAccessTarget) return null;

  return (
    <div className="interactionPrompt">
      <span className="interactionPromptText">Enter {vehicleAccessTarget.label}</span>
    </div>
  );
}
