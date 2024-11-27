import * as THREE from "three"
import { Canvas, type Color, type ThreeElements } from "@react-three/fiber";
import React, { useEffect, useState, forwardRef, useMemo, type ReactNode, useCallback, Suspense, useRef } from "react";
import { useSpring, animated } from '@react-spring/three'
import { useJoystickControls } from "./stores/useJoystickControls";
import { Text } from "@react-three/drei";

const JoystickComponents = (props: EcctrlJoystickProps) => {
    /**
     * Preset values/components
     */
    let joystickCenterX: number = 0
    let joystickCenterY: number = 0
    let joystickHalfWidth: number = 0
    let joystickHalfHeight: number = 0
    let joystickMaxDis: number = 0
    let joystickDis: number = 0
    let joystickAng: number = 0
    const touch1MovementVec2 = useMemo(() => new THREE.Vector2(), [])
    const joystickMovementVec2 = useMemo(() => new THREE.Vector2(), [])

    const [windowSize, setWindowSize] = useState({ innerHeight, innerWidth })
    const joystickDiv: HTMLDivElement = document.querySelector("#ecctrl-joystick")

    /**
     * Animation preset
     */
    const [springs, api] = useSpring(
        () => ({
            topRotationX: 0,
            topRotationY: 0,
            basePositionX: 0,
            basePositionY: 0,
            config: {
                tension: 600
            }
        })
    )

    /**
     * Joystick component geometries
     */
    const joystickBaseGeo = useMemo(() => new THREE.CylinderGeometry(2.3, 2.1, 0.3, 16), [])
    const joystickStickGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 3, 6), [])
    const joystickHandleGeo = useMemo(() => new THREE.SphereGeometry(1.4, 8, 8), [])

    /**
     * Joystick component materials
     */
    const joystickBaseMaterial = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.3 }), [])
    const joystickStickMaterial = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.3 }), [])
    const joystickHandleMaterial = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.7 }), [])

    /**
     * Joystick store setup
     */
    const setJoystick = useJoystickControls((state) => state.setJoystick)
    const resetJoystick = useJoystickControls((state) => state.resetJoystick)

    // Touch move function
    const onTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const touch1 = e.targetTouches[0];

        const touch1MovementX = touch1.pageX - joystickCenterX
        const touch1MovementY = -(touch1.pageY - joystickCenterY)
        touch1MovementVec2.set(touch1MovementX, touch1MovementY)

        joystickDis = Math.min(Math.sqrt(Math.pow(touch1MovementX, 2) + Math.pow(touch1MovementY, 2)), joystickMaxDis)
        joystickAng = touch1MovementVec2.angle()
        joystickMovementVec2.set(joystickDis * Math.cos(joystickAng), joystickDis * Math.sin(joystickAng))
        const runState = joystickDis > joystickMaxDis * (props.joystickRunSensitivity ?? 0.9)

        // Apply animations
        api.start({
            topRotationX: -joystickMovementVec2.y / joystickHalfHeight,
            topRotationY: joystickMovementVec2.x / joystickHalfWidth,
            basePositionX: joystickMovementVec2.x * 0.002,
            basePositionY: joystickMovementVec2.y * 0.002,
        })

        // Pass valus to joystick store
        setJoystick(joystickDis, joystickAng, runState)
    }, [api, windowSize])

    // Touch end function
    const onTouchEnd = (e: TouchEvent) => {
        // Reset animations
        api.start({
            topRotationX: 0,
            topRotationY: 0,
            basePositionX: 0,
            basePositionY: 0,
        })

        // Reset joystick store values
        resetJoystick()
    }

    // Reset window size function
    const onWindowResize = () => {
        setWindowSize({ innerHeight: window.innerHeight, innerWidth: window.innerWidth })
    }

    useEffect(() => {
        const joystickPositionX = joystickDiv.getBoundingClientRect().x
        const joystickPositionY = joystickDiv.getBoundingClientRect().y
        joystickHalfWidth = joystickDiv.getBoundingClientRect().width / 2
        joystickHalfHeight = joystickDiv.getBoundingClientRect().height / 2

        joystickMaxDis = joystickHalfWidth * 0.65

        joystickCenterX = joystickPositionX + joystickHalfWidth
        joystickCenterY = joystickPositionY + joystickHalfHeight

        joystickDiv.addEventListener("touchmove", onTouchMove, { passive: false })
        joystickDiv.addEventListener("touchend", onTouchEnd)

        window.visualViewport.addEventListener("resize", onWindowResize)

        return () => {
            joystickDiv.removeEventListener("touchmove", onTouchMove)
            joystickDiv.removeEventListener("touchend", onTouchEnd)
            window.visualViewport.removeEventListener("resize", onWindowResize)
        }
    })

    return (
        <Suspense fallback="null">
            <animated.group position-x={springs.basePositionX} position-y={springs.basePositionY}>
                <mesh geometry={joystickBaseGeo} material={joystickBaseMaterial} rotation={[-Math.PI / 2, 0, 0]} {...props.joystickBaseProps} />
            </animated.group>
            <animated.group rotation-x={springs.topRotationX} rotation-y={springs.topRotationY}>
                <mesh geometry={joystickStickGeo} material={joystickStickMaterial} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.5]} {...props.joystickStickProps} />
                <mesh geometry={joystickHandleGeo} material={joystickHandleMaterial} position={[0, 0, 4]} {...props.joystickHandleProps} />
            </animated.group>
        </Suspense>
    )
}

const ButtonComponents = ({ buttonNumber = 1, customButtons = [], ...props }: EcctrlJoystickProps) => {
    /**
    * Button component geometries
    */
    const buttonLargeBaseGeo = useMemo(() => new THREE.CylinderGeometry(1.1, 1, 0.3, 16), [])
    const buttonSmallBaseGeo = useMemo(() => new THREE.CylinderGeometry(0.9, 0.8, 0.3, 16), [])
    const buttonTop1Geo = useMemo(() => new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), [])
    const buttonTop2Geo = useMemo(() => new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), [])
    const buttonTop3Geo = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16), [])
    const buttonTop4Geo = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16), [])
    const buttonTop5Geo = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 0.5, 16), [])

    /**
    * Button component materials
    */
    const buttonBaseMaterial = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.3 }), [])
    const buttonTop1Material = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.5 }), [])
    const buttonTop2Material = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.5 }), [])
    const buttonTop3Material = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.5 }), [])
    const buttonTop4Material = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.5 }), [])
    const buttonTop5Material = useMemo(() => new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.5 }), [])

    const buttonDiv: HTMLDivElement = document.querySelector("#ecctrl-button")

    /**
    * Animation preset
    */
    type ButtonSprings = {
        [key in `buttonTop${number}BaseScaleY` | `buttonTop${number}BaseScaleXAndZ`]: number
    } & {
        [key in `buttonTopCustom${number}BaseScaleY` | `buttonTopCustom${number}BaseScaleXAndZ`]?: number
    }
    let initialSprings = useRef<ButtonSprings>({});
    const [springs, api] = useSpring<ButtonSprings>(() => {
        for (let index = 0; index < customButtons.length; index++) {
            initialSprings.current[`buttonTopCustom${index}BaseScaleY`] = 1;
            initialSprings.current[`buttonTopCustom${index}BaseScaleXAndZ`] = 1;
        }

        initialSprings.current = {
            ...initialSprings.current,
            buttonTop1BaseScaleY: 1,
            buttonTop1BaseScaleXAndZ: 1,
            buttonTop2BaseScaleY: 1,
            buttonTop2BaseScaleXAndZ: 1,
            buttonTop3BaseScaleY: 1,
            buttonTop3BaseScaleXAndZ: 1,
            buttonTop4BaseScaleY: 1,
            buttonTop4BaseScaleXAndZ: 1,
            buttonTop5BaseScaleY: 1,
            buttonTop5BaseScaleXAndZ: 1
        }

        return {
            ...initialSprings.current,
            config: {
                tension: 600
            }
            
        }
    });

    /**
    * Button store setup
    */
    const pressButton1 = useJoystickControls((state) => state.pressButton1)
    const pressButton2 = useJoystickControls((state) => state.pressButton2)
    const pressButton3 = useJoystickControls((state) => state.pressButton3)
    const pressButton4 = useJoystickControls((state) => state.pressButton4)
    const pressButton5 = useJoystickControls((state) => state.pressButton5)
    const releaseAllButtons = useJoystickControls((state) => state.releaseAllButtons)

    // Pointer down function
    const onPointerDown = (numberOrKey: number | string, callback?: () => void) => {
        if (typeof numberOrKey === "number") {
            switch (numberOrKey) {
                case 1:
                    pressButton1()
                    api.start({
                        buttonTop1BaseScaleY: 0.5,
                        buttonTop1BaseScaleXAndZ: 1.15,
                    })
                    break;
                case 2:
                    pressButton2()
                    api.start({
                        buttonTop2BaseScaleY: 0.5,
                        buttonTop2BaseScaleXAndZ: 1.15,
                    })
                    break;
                case 3:
                    pressButton3()
                    api.start({
                        buttonTop3BaseScaleY: 0.5,
                        buttonTop3BaseScaleXAndZ: 1.15,
                    })
                    break;
                case 4:
                    pressButton4()
                    api.start({
                        buttonTop4BaseScaleY: 0.5,
                        buttonTop4BaseScaleXAndZ: 1.15,
                    })
                    break;
                case 5:
                    pressButton5()
                    api.start({
                        buttonTop5BaseScaleY: 0.5,
                        buttonTop5BaseScaleXAndZ: 1.15,
                    })
                    break;
                default:
                    break;
            }

        } else if (typeof numberOrKey === "string" && numberOrKey.toLowerCase().startsWith("custom")) {
            api.start({
                [`buttonTop${numberOrKey}BaseScaleY`]: 0.5,
                [`buttonTop${numberOrKey}BaseScaleXAndZ`]: 1.15,
            });

            if (callback) {
                callback();
            }
        }
    }

    // Pointer up function
    const onPointerUp = () => {
        releaseAllButtons();
        api.start({
            ...initialSprings.current
        })
    }

    useEffect(() => {
        buttonDiv.addEventListener("pointerup", onPointerUp)

        return () => {
            buttonDiv.removeEventListener("pointerup", onPointerUp)
        }
    })

    return (
        <Suspense fallback="null">
            {customButtons.map((customButton, index) => (
                <animated.group
                    key={`custom${index}`}
                    scale-x={springs[`buttonTopCustom${index}BaseScaleXAndZ`]}
                    scale-y={springs[`buttonTopCustom${index}BaseScaleY`]}
                    scale-z={springs[`buttonTopCustom${index}BaseScaleXAndZ`]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        onPointerDown(`Custom${index}`, customButton.callback);
                    }}
                    position={customButton.position}
                >
                    <mesh geometry={buttonLargeBaseGeo} material={buttonBaseMaterial} {...customButton.buttonLargeBaseProps} />
                    <mesh geometry={buttonTop1Geo} material={buttonTop1Material} position={[0, -0.3, 0]} {...customButton.buttonTopProps} />
                    {customButton.text && (
                        <Text
                            position={customButton.text.position || [0, 0.1, 0]}
                            fontSize={customButton.text.fontSize || 0.25}
                            color={customButton.text.color || "white"}
                            fontWeight={customButton.text.fontWeight || "normal"}
                            anchorX="center"
                            anchorY="middle"
                            rotation={customButton.text.rotation || [Math.PI / 2, 0, 0]}
                            material={new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })}
                            renderOrder={2}
                        >
                            {customButton.text.value}
                        </Text>
                    )}
                </animated.group>
            ))}
            {/* Button 1 */}
            {buttonNumber > 0 &&
                <animated.group
                    scale-x={springs.buttonTop1BaseScaleXAndZ}
                    scale-y={springs.buttonTop1BaseScaleY}
                    scale-z={springs.buttonTop1BaseScaleXAndZ}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={props.buttonGroup1Position || (buttonNumber === 1 ? [0, 0, 0] : [2, 1, 0])}>
                    <mesh geometry={buttonLargeBaseGeo} material={buttonBaseMaterial} {...props.buttonLargeBaseProps} onPointerDown={() => onPointerDown(1)} />
                    <mesh geometry={buttonTop1Geo} material={buttonTop1Material} position={[0, -0.3, 0]} {...props.buttonTop1Props} />
                    {props.buttonText1Props && (
                        <Text
                            position={props.buttonText1Props.position || [0, 0.1, 0]}
                            fontSize={props.buttonText1Props.fontSize || 0.25}
                            color={props.buttonText1Props.color || "white"}
                            fontWeight={props.buttonText1Props.fontWeight || "normal"}
                            anchorX="center"
                            anchorY="middle"
                            rotation={props.buttonText1Props.rotation || [Math.PI / 2, 0, 0]}
                            material={new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })}
                            renderOrder={2}
                        >
                            {props.buttonText1Props.value}
                        </Text>
                    )}
                </animated.group>}
            {/* Button 2 */}
            {buttonNumber > 1 &&
                <animated.group
                    scale-x={springs.buttonTop2BaseScaleXAndZ}
                    scale-y={springs.buttonTop2BaseScaleY}
                    scale-z={springs.buttonTop2BaseScaleXAndZ}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={props.buttonGroup2Position || [0.5, -1.3, 0]}>
                    <mesh geometry={buttonLargeBaseGeo} material={buttonBaseMaterial} {...props.buttonLargeBaseProps} onPointerDown={() => onPointerDown(2)} />
                    <mesh geometry={buttonTop2Geo} material={buttonTop2Material} position={[0, -0.3, 0]} {...props.buttonTop2Props} />
                    {props.buttonText2Props && (
                        <Text
                            position={props.buttonText2Props.position || [0, 0.1, 0]}
                            fontSize={props.buttonText2Props.fontSize || 0.25}
                            color={props.buttonText2Props.color || "white"}
                            fontWeight={props.buttonText2Props.fontWeight || "normal"}
                            anchorX="center"
                            anchorY="middle"
                            rotation={props.buttonText2Props.rotation || [Math.PI / 2, 0, 0]}
                            material={new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })}
                            renderOrder={2}
                        >
                            {props.buttonText2Props.value}
                        </Text>
                    )}
                </animated.group>}
            {/* Button 3 */}
            {buttonNumber > 2 &&
                <animated.group
                    scale-x={springs.buttonTop3BaseScaleXAndZ}
                    scale-y={springs.buttonTop3BaseScaleY}
                    scale-z={springs.buttonTop3BaseScaleXAndZ}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={props.buttonGroup3Position || [-1, 1, 0]}>
                    <mesh geometry={buttonSmallBaseGeo} material={buttonBaseMaterial} {...props.buttonSmallBaseProps} onPointerDown={() => onPointerDown(3)} />
                    <mesh geometry={buttonTop3Geo} material={buttonTop3Material} position={[0, -0.3, 0]} {...props.buttonTop3Props} />
                    {props.buttonText3Props && (
                        <Text
                            position={props.buttonText3Props.position || [0, 0.1, 0]}
                            fontSize={props.buttonText3Props.fontSize || 0.25}
                            color={props.buttonText3Props.color || "white"}
                            fontWeight={props.buttonText3Props.fontWeight || "normal"}
                            anchorX="center"
                            anchorY="middle"
                            rotation={props.buttonText3Props.rotation || [Math.PI / 2, 0, 0]}
                            material={new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })}
                            renderOrder={2}
                        >
                            {props.buttonText3Props.value}
                        </Text>
                    )}
                </animated.group>}
            {/* Button 4 */}
            {buttonNumber > 3 &&
                <animated.group
                    scale-x={springs.buttonTop4BaseScaleXAndZ}
                    scale-y={springs.buttonTop4BaseScaleY}
                    scale-z={springs.buttonTop4BaseScaleXAndZ}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={props.buttonGroup4Position || [-2, -1.3, 0]}>
                    <mesh geometry={buttonSmallBaseGeo} material={buttonBaseMaterial} {...props.buttonSmallBaseProps} onPointerDown={() => onPointerDown(4)} />
                    <mesh geometry={buttonTop4Geo} material={buttonTop4Material} position={[0, -0.3, 0]} {...props.buttonTop4Props} />
                    {props.buttonText4Props && (
                        <Text
                            position={props.buttonText4Props.position || [0, 0.1, 0]}
                            fontSize={props.buttonText4Props.fontSize || 0.25}
                            color={props.buttonText4Props.color || "white"}
                            fontWeight={props.buttonText4Props.fontWeight || "normal"}
                            anchorX="center"
                            anchorY="middle"
                            rotation={props.buttonText4Props.rotation || [Math.PI / 2, 0, 0]}
                            material={new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })}
                            renderOrder={2}
                        >
                            {props.buttonText4Props.value}
                        </Text>
                    )}
                </animated.group>}
            {/* Button 5 */}
            {buttonNumber > 4 &&
                <animated.group
                    scale-x={springs.buttonTop5BaseScaleXAndZ}
                    scale-y={springs.buttonTop5BaseScaleY}
                    scale-z={springs.buttonTop5BaseScaleXAndZ}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={props.buttonGroup5Position || [0.4, 2.9, 0]}>
                    <mesh geometry={buttonSmallBaseGeo} material={buttonBaseMaterial} {...props.buttonSmallBaseProps} onPointerDown={() => onPointerDown(5)} />
                    <mesh geometry={buttonTop5Geo} material={buttonTop5Material} position={[0, -0.3, 0]} {...props.buttonTop5Props} />
                    {props.buttonText5Props && (
                        <Text
                            position={props.buttonText5Props.position || [0, 0.1, 0]}
                            fontSize={props.buttonText5Props.fontSize || 0.25}
                            color={props.buttonText5Props.color || "white"}
                            fontWeight={props.buttonText5Props.fontWeight || "normal"}
                            anchorX="center"
                            anchorY="middle"
                            rotation={props.buttonText5Props.rotation || [Math.PI / 2, 0, 0]}
                            material={new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })}
                            renderOrder={2}
                        >
                            {props.buttonText5Props.value}
                        </Text>
                    )}
                </animated.group>}
        </Suspense>
    )
}

export const EcctrlJoystick = forwardRef<HTMLDivElement, EcctrlJoystickProps>((props, ref) => {
    const joystickWrapperStyle: React.CSSProperties = {
        userSelect: "none",
        MozUserSelect: "none",
        WebkitUserSelect: "none",
        msUserSelect: "none",
        touchAction: "none",
        pointerEvents: "none",
        overscrollBehavior: "none",
        position: 'fixed',
        zIndex: '9999',
        height: props.joystickHeightAndWidth || '200px',
        width: props.joystickHeightAndWidth || '200px',
        left: props.joystickPositionLeft || '0',
        bottom: props.joystickPositionBottom || '0',
    }

    const buttonWrapperStyle: React.CSSProperties = {
        userSelect: "none",
        MozUserSelect: "none",
        WebkitUserSelect: "none",
        msUserSelect: "none",
        touchAction: "none",
        pointerEvents: "none",
        overscrollBehavior: "none",
        position: 'fixed',
        zIndex: '9999',
        height: props.buttonHeightAndWidth || '200px',
        width: props.buttonHeightAndWidth || '200px',
        right: props.buttonPositionRight || '0',
        bottom: props.buttonPositionBottom || '0',
    }

    return (
        <div ref={ref}>
            <div id="ecctrl-joystick" style={joystickWrapperStyle} onContextMenu={(e) => e.preventDefault()}>
                <Canvas
                    shadows
                    orthographic
                    camera={{
                        zoom: props.joystickCamZoom || 26,
                        position: props.joystickCamPosition || [0, 0, 50],
                    }}
                >
                    <JoystickComponents {...props} />
                    {props.children}
                </Canvas>
            </div>
            {
                props.buttonNumber !== 0 &&
                <div id="ecctrl-button" style={buttonWrapperStyle} onContextMenu={(e) => e.preventDefault()}>
                    <Canvas
                        shadows
                        orthographic
                        camera={{
                            zoom: props.buttonCamZoom || 26,
                            position: props.buttonCamPosition || [0, 0, 50],
                        }}>
                        <ButtonComponents {...props} />
                        {props.children}
                    </Canvas>
                </div>
            }
        </div>
    )
})

type TextProps = {
    value: string;
    fontSize?: number;
    fontWeight?: number | string;
    color?: Color;
    position?: [x: number, y: number, z: number];
    rotation?: [x: number, y: number, z: number];
}

export type EcctrlJoystickProps = {
    // Joystick props
    children?: ReactNode;
    joystickRunSensitivity?: number;
    joystickPositionLeft?: number;
    joystickPositionBottom?: number;
    joystickHeightAndWidth?: number;
    joystickCamZoom?: number;
    joystickCamPosition?: [x: number, y: number, z: number];
    joystickBaseProps?: ThreeElements['mesh'];
    joystickStickProps?: ThreeElements['mesh'];
    joystickHandleProps?: ThreeElements['mesh'];

    // Touch buttons props
    buttonNumber?: number;
    buttonPositionRight?: number;
    buttonPositionBottom?: number;
    buttonHeightAndWidth?: number;
    buttonCamZoom?: number;
    buttonCamPosition?: [x: number, y: number, z: number];
    buttonGroup1Position?: [x: number, y: number, z: number];
    buttonGroup2Position?: [x: number, y: number, z: number];
    buttonGroup3Position?: [x: number, y: number, z: number];
    buttonGroup4Position?: [x: number, y: number, z: number];
    buttonGroup5Position?: [x: number, y: number, z: number];
    buttonLargeBaseProps?: ThreeElements['mesh'];
    buttonSmallBaseProps?: ThreeElements['mesh'];
    buttonTop1Props?: ThreeElements['mesh'];
    buttonTop2Props?: ThreeElements['mesh'];
    buttonTop3Props?: ThreeElements['mesh'];
    buttonTop4Props?: ThreeElements['mesh'];
    buttonTop5Props?: ThreeElements['mesh'];
    customButtons?: EcctrlJoystickProps[];
    position?: [x: number, y: number, z: number];
    callback?: () => void;
    buttonTopProps?: ThreeElements['mesh'];
    text?: TextProps;
    buttonText1Props?: TextProps;
    buttonText2Props?: TextProps;
    buttonText3Props?: TextProps;
    buttonText4Props?: TextProps;
    buttonText5Props?: TextProps;
};