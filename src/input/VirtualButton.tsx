/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import React, { useRef, useCallback, useEffect } from "react"
import { useButtonStore } from "./stores/useButtonStore";

// Default style for the virtual button wrapper
const defaultButtonWrapperStyle: React.CSSProperties = {
    userSelect: "none",
    MozUserSelect: "none",
    WebkitUserSelect: "none",
    msUserSelect: "none",
    touchAction: "none",
    overscrollBehavior: "none",
    position: 'fixed',
    zIndex: '10',
    height: '60px',
    width: '60px',
    background: "rgba(0, 0, 0, 0.1)",
    borderRadius: "50%",
}
// Default style for the virtual button cap
const defaultButtonCapStyle: React.CSSProperties = {
    width: "45px",
    height: "45px",
    background: "rgba(255, 255, 255, 0.8)",
    borderRadius: "50%",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    transition: "transform 0.2s cubic-bezier(0.25, 1.5, 0.5, 1)",
    willChange: "transform",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: '12px',
    fontWeight: 'bold',
    fontFamily: 'Arial, sans-serif',
    color: 'LightGray',
    userSelect: 'none',
    pointerEvents: "none",
}

const VirtualButton = (props: VirtualButtonProps) => {
    // Reference to the button cap element for style manipulation
    const capRef = useRef<HTMLDivElement>(null);
    // Zustand store for managing button states
    const { setButtonActive, resetAllButtons } = useButtonStore()

    // Styles for the button wrapper
    const buttonWrapperStyle: React.CSSProperties = {
        ...defaultButtonWrapperStyle,
        ...props.buttonWrapperStyle,
    }
    // Styles for the button cap
    const buttonCapStyle: React.CSSProperties = {
        ...defaultButtonCapStyle,
        ...props.buttonCapStyle,
    }

    /**
     * Function to handle button press, setting the button active state
     */
    const pressFunction = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setButtonActive(props.id, true);
        if (capRef.current) {
            capRef.current.style.transform = "translate(-50%, -50%) scale(1.3)";
            capRef.current.style.opacity = "0.5";
        }
    }, [setButtonActive, props.id])

    /**
     * Function to reset the button state, called on pointer up or leave
     */
    const resetFunction = useCallback(() => {
        setButtonActive(props.id, false);
        if (capRef.current) {
            capRef.current.style.transform = "translate(-50%, -50%) scale(1)";
            capRef.current.style.opacity = "1";
        }
    }, [setButtonActive, props.id]);

    // Reset all buttons when this component unmounts
    useEffect(() => () => resetAllButtons(), [resetAllButtons]);

    return (
        <div
            id="ecctrl-virtual-button"
            style={buttonWrapperStyle}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => pressFunction(e)}
            onPointerUp={resetFunction}
            onPointerLeave={resetFunction}
        >
            <div id="virtual-button-cap" style={buttonCapStyle} ref={capRef} >
                {props.label}
            </div>
        </div>
    )
}

export default React.memo(VirtualButton)
export interface VirtualButtonProps extends React.HTMLAttributes<HTMLDivElement> {
    id: string;
    label?: string;
    buttonWrapperStyle?: React.CSSProperties;
    buttonCapStyle?: React.CSSProperties;
    props?: React.HTMLAttributes<HTMLDivElement>;
}
