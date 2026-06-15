/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useRef, useCallback, useEffect } from "react"
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

    // State to track if the joystick is active
    const [active, setActive] = useState(false);
    // Zustand store hooks for joystick state management
    const { setJoystick, resetJoystick } = useJoystickStore()

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
        if (!knobRef.current || !baseRef.current) return;

        // Get the bounding rectangle of the joystick base
        const rect = baseRef.current.getBoundingClientRect();
        // Calculate the center of the joystick base
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Calculate the difference from the center
        let dx = x - centerX;
        let dy = y - centerY;
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
    const resetFunction = useCallback(() => {
        setActive(false);
        if (knobRef.current) knobRef.current.style.transform = 'translate(-50%, -50%)';
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
                moveFunction(e.clientX, e.clientY)
                setActive(true)
            }}
            onPointerMove={(e) => active && moveFunction(e.clientX, e.clientY)}
            onPointerUp={resetFunction}
            onPointerLeave={resetFunction}
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