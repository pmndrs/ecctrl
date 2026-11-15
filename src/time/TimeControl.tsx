/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { useFrame } from "@react-three/fiber";
import { useAfterPhysicsStep, useRapier } from "@react-three/rapier";
import { useRef, type RefObject } from "react";
import { clamp } from "three/src/math/MathUtils.js";

type TimeControlValue = number | RefObject<number>

export type TimeControlProps = {
    paused?: boolean
    timeScale?: TimeControlValue
    maxDelta?: TimeControlValue
}

const readTimeControlValue = (value: TimeControlValue) => typeof value === "number" ? value : value.current

export function TimeControl({ paused = false, timeScale = 1, maxDelta = 1 / 30 }: TimeControlProps) {
    const { step, world } = useRapier();
    const isFixedTimeStepRef = useRef(false);
    const didStepRef = useRef(false);

    useAfterPhysicsStep(() => {
        didStepRef.current = true;
    });

    useFrame((_, delta) => {
        if (paused) return;

        const maxStep = Math.max(0, readTimeControlValue(maxDelta));
        const dt = clamp(delta, 0, maxStep);
        const scale = readTimeControlValue(timeScale);
        if (scale <= 0 || dt <= 0) return;

        const stepDt = dt * scale;
        const clampedStepDt = Math.min(stepDt, 0.5);
        const prevTimestep = world.timestep;

        // @react-three/rapier runs useBeforePhysicsStep callbacks before assigning world.timestep = delta.
        // Pre-sync world.timestep when <Physics timeStep="vary"> is active, while preserving fixed timeStep accumulators.
        if (!isFixedTimeStepRef.current) {
            world.timestep = clampedStepDt;
        }
        didStepRef.current = false;

        step(stepDt);

        if (!isFixedTimeStepRef.current) {
            if (!didStepRef.current) {
                world.timestep = prevTimestep;
                isFixedTimeStepRef.current = true;
            } else if (Math.abs(world.timestep - clampedStepDt) > 1e-9) {
                isFixedTimeStepRef.current = true;
            }
        }
    });

    return null;
}
