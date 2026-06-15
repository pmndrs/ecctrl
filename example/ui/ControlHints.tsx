import React, { type CSSProperties, useEffect, useMemo, useState } from "react";
import { type ContorlType, useControlStore } from "../store/useControlStore";
import { useIsTouchDevice } from "./useIsTouchDevice";

type HintKey = {
  label: string;
  codes: string[];
  wide?: boolean;
};

type HintGroup = {
  label: string;
  keys: HintKey[];
  layout?: "row" | "directional" | "stack";
  keyRow?: "top" | "bottom";
  labelPosition?: "below" | "inline" | "none";
  bottomLabel?: string;
};

type HintPreset = {
  accent: string;
  groups: HintGroup[];
};

const key = (label: string, ...codes: string[]): HintKey => ({ label, codes });
const wideKey = (label: string, ...codes: string[]): HintKey => ({ label, codes, wide: true });

const CONTROL_HINTS: Record<"ecctrl" | "vehicle" | "drone", HintPreset> = {
  ecctrl: {
    accent: "#e5e7eb",
    groups: [
      { label: "Move", layout: "directional", keys: [key("W", "KeyW"), key("A", "KeyA"), key("S", "KeyS"), key("D", "KeyD")] },
      { label: "Run", layout: "stack", labelPosition: "inline", bottomLabel: "Jump", keys: [key("Shift", "ShiftLeft", "ShiftRight", "Shift"), wideKey("Space", "Space")] },
      { label: "Enter", keyRow: "bottom", labelPosition: "inline", keys: [key("F", "KeyF")] },
    ],
  },
  vehicle: {
    accent: "#e5e7eb",
    groups: [
      { label: "Drive / Steer", layout: "directional", keys: [key("W", "KeyW"), key("A", "KeyA"), key("S", "KeyS"), key("D", "KeyD")] },
      { label: "Brake", keyRow: "bottom", keys: [wideKey("Space", "Space")] },
      { label: "Exit", keyRow: "bottom", labelPosition: "inline", keys: [key("F", "KeyF")] },
    ],
  },
  drone: {
    accent: "#e5e7eb",
    groups: [
      { label: "Throttle / Yaw", layout: "directional", keys: [key("W", "KeyW"), key("A", "KeyA"), key("S", "KeyS"), key("D", "KeyD")] },
      { label: "Pitch / Roll", layout: "directional", keys: [key("↑", "ArrowUp"), key("←", "ArrowLeft"), key("↓", "ArrowDown"), key("→", "ArrowRight")] },
      { label: "Exit", keyRow: "bottom", labelPosition: "inline", keys: [key("F", "KeyF")] },
    ],
  },
};

const getPresetKey = (controller: ContorlType) => {
  if (controller === "vehicle3") return "drone";
  if (controller === "vehicle1" || controller === "vehicle2") return "vehicle";
  return "ecctrl";
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
};

export function ControlHints() {
  const activeController = useControlStore((state) => state.activeController);
  const isTouchDevice = useIsTouchDevice();
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(() => new Set());
  const preset = CONTROL_HINTS[getPresetKey(activeController)];

  const visibleCodes = useMemo(() => {
    const codes = new Set<string>();
    preset.groups.forEach((group) => group.keys.forEach((hintKey) => hintKey.codes.forEach((code) => codes.add(code))));
    return codes;
  }, [preset]);

  useEffect(() => {
    setPressedKeys(new Set());
  }, [activeController]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target) || !visibleCodes.has(event.code)) return;
      setPressedKeys((current) => {
        if (current.has(event.code)) return current;
        const next = new Set(current);
        next.add(event.code);
        return next;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!visibleCodes.has(event.code)) return;
      setPressedKeys((current) => {
        if (!current.has(event.code)) return current;
        const next = new Set(current);
        next.delete(event.code);
        return next;
      });
    };

    const clearPressedKeys = () => setPressedKeys(new Set());

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearPressedKeys);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearPressedKeys);
    };
  }, [visibleCodes]);

  if (isTouchDevice) return null;

  const renderHintKey = (hintKey: HintKey) => {
    const isActive = hintKey.codes.some((code) => pressedKeys.has(code));
    return (
      <span
        className={[
          "controlHintKey",
          hintKey.wide ? "is-wide" : "",
          isActive ? "is-active" : "",
        ].filter(Boolean).join(" ")}
        key={hintKey.label}
      >
        {hintKey.label}
      </span>
    );
  };

  return (
    <div className="controlHints" style={{ "--control-hint-accent": preset.accent } as CSSProperties}>
      <div className="controlHintsGroups">
        {preset.groups.map((group) => {
          if (group.layout === "stack") {
            return (
              <div className="controlHintGroup is-stack label-inline" key={group.label}>
                <div className="controlHintStackRow is-top">
                  {group.keys[0] && renderHintKey(group.keys[0])}
                  <div className="controlHintLabel">{group.label}</div>
                </div>
                <div className="controlHintStackRow is-bottom">
                  {group.keys[1] && renderHintKey(group.keys[1])}
                </div>
                {group.bottomLabel && <div className="controlHintStackLabel">{group.bottomLabel}</div>}
              </div>
            );
          }

          return (
            <div
              className={[
                "controlHintGroup",
                group.layout === "directional" ? "is-directional" : `is-${group.keyRow ?? "top"}`,
                `label-${group.labelPosition ?? "below"}`,
              ].join(" ")}
              key={group.label}
            >
              <div className={group.layout === "directional" ? "controlHintKeys is-directional" : "controlHintKeys"}>
                {group.keys.map(renderHintKey)}
              </div>
              <div className="controlHintLabel">{group.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
