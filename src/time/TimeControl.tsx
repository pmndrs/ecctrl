/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type { RefObject } from "react";
import { clamp } from "three/src/math/MathUtils.js";

type TimeControlValue = number | RefObject<number>

export type TimeControlProps = {
    paused?: boolean
    timeScale?: TimeControlValue
    maxDelta?: TimeControlValue
}

const readTimeControlValue = (value: TimeControlValue) => typeof value === "number" ? value : value.current

export function TimeControl({ paused = false, timeScale = 1, maxDelta = 1 / 30 }: TimeControlProps) {
    const { step } = useRapier();

    useFrame((_, delta) => {
        if (paused) return;

        const maxStep = Math.max(0, readTimeControlValue(maxDelta));
        const dt = clamp(delta, 0, maxStep);
        const scale = readTimeControlValue(timeScale);
        if (scale <= 0 || dt <= 0) return;

        step(dt * scale);
    });

    return null;
}
