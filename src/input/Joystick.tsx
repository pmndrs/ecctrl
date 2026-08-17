/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import React, { useRef, useCallback, useEffect } from "react"
import { useJoystickStore } from "./stores/useJoystickStore";

// Default styles for the joystick wrapper (interactive area)
const defaultJoystickWrapperStyle: React.CSSProperties = {
    userSelect: "none",
    MozUserSelect: "none",
    WebkitUserSelect: "none",
    msUserSelect: "none",
    touchAction: "none",
    overscrollBehavior: "none",
    position: 'fixed',
    zIndex: '10',
    height: '200px',
    width: '200px',
    // left: '0',
    // bottom: '0',
    borderRadius: "50%",
    // background: "rgba(0, 0, 0, 0.1)",
}
// Default styles for the joystick base and knob
const defaultJoystickBaseStyle: React.CSSProperties = {
    width: "100px",
    height: "100px",
    background: "rgba(0, 0, 0, 0.1)",
    border: "2px solid white",
    borderRadius: "50%",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    touchAction: "none",
}
// Default styles for the joystick knob
const defaultJoystickKnobStyle: React.CSSProperties = {
    width: "70px",
    height: "70px",
    background: "rgba(255, 255, 255, 0.8)",
    borderRadius: "50%",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    // transition: "transform 0.1s ease",
    transition: "transform 0.2s cubic-bezier(0.25, 1.5, 0.5, 1)",
    willChange: "transform",
    pointerEvents: "none",
    // backgroundImage: 'url("./images/Demo1.png")',
}

const Joystick = (props: JoystickProps) => {
    // Maximum radius for the joystick movement
    const joystickMaxRadius = props.joystickMaxRadius ?? 50

    // Refs for the joystick base and knob elements
    const baseRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const centerRef = useRef<{ x: number; y: number } | null>(null);
    const releaseTransitionRef = useRef("");

    // Zustand store hooks for joystick state management
    const setJoystick = useJoystickStore((state) => state.setJoystick)
    const resetJoystick = useJoystickStore((state) => state.resetJoystick)

    // Styles for the joystick wrapper
    const joystickWrapperStyle: React.CSSProperties = {
        ...defaultJoystickWrapperStyle,
        ...props.joystickWrapperStyle,
    }
    // Style for the joystick base
    const joystickBaseStyle: React.CSSProperties = {
        ...defaultJoystickBaseStyle,
        ...props.joystickBaseStyle,
    }
    // Style for the joystick knob
    const joystickKnobStyle: React.CSSProperties = {
        ...defaultJoystickKnobStyle,
        ...props.joystickKnobStyle,
    }

    /**
     * Function to handle joystick movement
     */
    const moveFunction = useCallback((x: number, y: number) => {
        // Check if refs are available
        if (!knobRef.current || !centerRef.current) return;

        // Calculate the difference from the center
        let dx = x - centerRef.current.x;
        let dy = y - centerRef.current.y;
        const distance = Math.hypot(dx, dy);
        // If the distance exceeds the maximum radius, scale down the movement
        if (distance > joystickMaxRadius) {
            dx *= joystickMaxRadius / distance;
            dy *= joystickMaxRadius / distance;
        }

        // Update the knob position
        knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        // Update the joystick state in the store
        setJoystick(dx / joystickMaxRadius, -dy / joystickMaxRadius, props.id);
    }, [setJoystick, props.id, joystickMaxRadius]);

    /**
     * Function to reset the joystick state
     */
    const resetFunction = useCallback((pointerId: number) => {
        if (activePointerIdRef.current !== pointerId) return;

        activePointerIdRef.current = null;
        centerRef.current = null;
        if (knobRef.current) {
            knobRef.current.style.transition = releaseTransitionRef.current;
            knobRef.current.style.transform = 'translate(-50%, -50%)';
        }
        resetJoystick(props.id)
    }, [resetJoystick, props.id])

    // Reset joystick when this component unmounts
    useEffect(() => () => resetJoystick(props.id), [resetJoystick, props.id]);

    return (
        <div
            id="ecctrl-joystick"
            style={joystickWrapperStyle}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();

                if (activePointerIdRef.current !== null) return;

                const rect = baseRef.current?.getBoundingClientRect();
                if (!rect || !knobRef.current) return;

                activePointerIdRef.current = e.pointerId;
                centerRef.current = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
                releaseTransitionRef.current = knobRef.current.style.transition;
                knobRef.current.style.transition = "none";
                e.currentTarget.setPointerCapture(e.pointerId);
                moveFunction(e.clientX, e.clientY)
            }}
            onPointerMove={(e) => {
                if (activePointerIdRef.current === e.pointerId) {
                    moveFunction(e.clientX, e.clientY)
                }
            }}
            onPointerUp={(e) => resetFunction(e.pointerId)}
            onPointerCancel={(e) => resetFunction(e.pointerId)}
            onLostPointerCapture={(e) => resetFunction(e.pointerId)}
        >
            <div id="joystick-base" style={joystickBaseStyle} ref={baseRef} >
                <div id="joystick-knob" style={joystickKnobStyle} ref={knobRef} />
            </div>
        </div>
    )
}

export default React.memo(Joystick)
export interface JoystickProps extends React.HTMLAttributes<HTMLDivElement> {
    id?: string;
    joystickMaxRadius?: number;
    joystickWrapperStyle?: React.CSSProperties;
    joystickBaseStyle?: React.CSSProperties;
    joystickKnobStyle?: React.CSSProperties;
    props?: React.HTMLAttributes<HTMLDivElement>;
}
