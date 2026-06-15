/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three"
import * as COLOR from "../../shared/constants/Color";
import React, { useCallback, useContext, useEffect, useMemo, useRef, forwardRef, type ReactNode, useImperativeHandle } from "react"
import { VehicleContext } from "../EcctrlVehicle"
import { type RapierRigidBody, useRapier } from "@react-three/rapier"
import { useFrame, type ThreeElements } from "@react-three/fiber"
import { clamp, generateUUID, lerp } from "three/src/math/MathUtils.js"
import type { ForwardRefComponent } from "../../shared/types"

const ThrustPropeller: ForwardRefComponent<ThrustPropellerProps, THREE.Group> = /* @__PURE__ */ forwardRef<
    THREE.Group,
    ThrustPropellerProps
>(({
    children,
    debug = true,
    enable = true,
    name = "",

    // Base setups
    maxThrust = 500,
    torqueRatio = 0.6,
    invertThrust = false,
    invertTorque = false,

    // Propeller model setups
    showPropellerModel = true,
    propellerModelUpdate = true,
    propellerModelMaxSpin = 50,
    propellerModelLerpSpinRate = 10,

    // Debugger setups
    debuggerScale = 1,
    debuggerArrowScale = 35,

    // Other group props from parent
    ...props
}, ref) => {
    /**
     * Rapier preset
     */
    const { rapier, world } = useRapier();

    /**
     * Retrieve context object from ecctrl vehicle
     */
    const vehicleValue = useContext(VehicleContext)
    const vehicleBody = vehicleValue!.body.current
    const vehiclePos = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const vehicleInvertQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const vehicleLinVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleAngVel = useRef<THREE.Vector3>(new THREE.Vector3())

    /**
     * Control preset
     */
    const localPos = useRef<THREE.Vector3>(new THREE.Vector3())
    const localQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const worldPos = useRef<THREE.Vector3>(new THREE.Vector3())
    const worldQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const thrustDir = useRef<THREE.Vector3>(new THREE.Vector3())
    const thrustForce = useRef<THREE.Vector3>(new THREE.Vector3())
    const leverageTorque = useRef<THREE.Vector3>(new THREE.Vector3())
    const reactionTorque = useRef<THREE.Vector3>(new THREE.Vector3())
    const reactionTorqueDir = useRef<THREE.Vector3>(new THREE.Vector3())
    const torqueInfluence = useRef<THREE.Vector3>(new THREE.Vector3())
    const throttle = useRef<number>(0)
    const setThrottle = useCallback((value: number) => throttle.current = clamp(value, 0, 1), [])

    /**
     * Refs and handles
     */
    const thrustPropellerRef = useRef<THREE.Group>(null)
    useImperativeHandle(ref, () => thrustPropellerRef.current!, []);

    /**
     * Propeller model preset
     */
    const modelRef = useRef<THREE.Group>(null)
    const modelSpinVel = useRef<number>(0)

    /**
     * Register propeller information
     */
    const propellerId = useMemo(() => String(props.id ?? generateUUID()), [props.id]);
    const propellerInfo = useRef<PropellerInfoType>({
        // propeller base info
        id: propellerId,
        name,
        enable,
        debug,

        // Base setups
        maxThrust,
        torqueRatio,
        debuggerScale,
        invertThrust,
        invertTorque,

        // Updated values
        thrustPos: new THREE.Vector3(),
        thrustDir: new THREE.Vector3(),
        thrustPot: new THREE.Vector3(),
        torqueDir: new THREE.Vector3(),
        torquePot: new THREE.Vector3(),
        worldThrustPos: new THREE.Vector3(),
        worldThrustDir: new THREE.Vector3(),
        worldTorqueDir: new THREE.Vector3(),
        thrustImpulse: new THREE.Vector3(),
        torqueImpulse: new THREE.Vector3(),
        finalThrottle: 0,
        throttle: throttle.current,
        setThrottle,

        // Max potential impulse
        lx: 0,
        ly: 0,
        lz: 0,
        ax: 0,
        ay: 0,
        az: 0,
    })
    useEffect(() => {
        vehicleValue?.regPropeller(propellerInfo)
        return () => vehicleValue?.unregPropeller(propellerId)
    }, [vehicleValue])

    /**
     * Debug indicators preset
     */
    // Axis helper points
    const xAxisPointRef = useRef<THREE.Mesh>(null)
    const yAxisPointRef = useRef<THREE.Mesh>(null)
    const zAxisPointRef = useRef<THREE.Mesh>(null)
    // Arrow helpers
    const currThrustArrowRef = useRef<THREE.ArrowHelper>(null)
    const currTorqueArrowRef = useRef<THREE.ArrowHelper>(null)

    // Debug indicators geo/mat/mesh
    const debugAssets = useMemo(() => {
        if (!debug) return null;

        return {
            thrustRingGeo: new THREE.RingGeometry(debuggerScale * 0.5, debuggerScale * 0.55, 12, 1, 0, -Math.PI * 1),
            thrustRingMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_AZURE, side: THREE.DoubleSide }),
            thrustPointerGeo: new THREE.ConeGeometry(debuggerScale * 0.06, debuggerScale * 0.5, 8, 1, true),
            thrustIndicatorMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_MED_PURPLE, side: THREE.DoubleSide, transparent: true, opacity: 0.3 }),

            axisPointGeo: new THREE.OctahedronGeometry(debuggerScale * 0.05, 3),
            xAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_GREEN, transparent: true, opacity: 1 }),
            yAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_BLUE, transparent: true, opacity: 1 }),
            zAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_RED, transparent: true, opacity: 1 }),
        };
    }, [debug, debuggerScale]);

    // debugAssets clean up when unmount
    useEffect(() => {
        return () => {
            if (!debugAssets) return;
            for (const key in debugAssets) {
                const item = debugAssets[key as keyof typeof debugAssets];
                if ("dispose" in item && typeof item.dispose === "function") {
                    item.dispose();
                }
            }
        };
    }, [debugAssets]);


    /**
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     */

    /**
     * Update vehicle info function 
     */
    const updateVehicleInfo = useCallback((body: RapierRigidBody) => {
        vehiclePos.current.copy(body.translation());
        vehicleQuat.current.copy(body.rotation())
        vehicleLinVel.current.copy(body.linvel())
        vehicleAngVel.current.copy(body.angvel())
    }, [])

    /**
     * Update propeller info function 
     */
    const updatePropellerInfo = useCallback(() => {
        if (!thrustPropellerRef.current) return

        thrustPropellerRef.current.getWorldPosition(worldPos.current);
        thrustPropellerRef.current.getWorldQuaternion(worldQuat.current);
        vehicleInvertQuat.current.copy(vehicleQuat.current).invert()

        localPos.current.subVectors(worldPos.current, vehiclePos.current).applyQuaternion(vehicleInvertQuat.current);
        localQuat.current.multiplyQuaternions(vehicleInvertQuat.current, worldQuat.current);

        thrustDir.current.set(0, invertThrust ? -1 : 1, 0).applyQuaternion(localQuat.current);
        thrustForce.current.copy(thrustDir.current).multiplyScalar(maxThrust);

        leverageTorque.current.crossVectors(localPos.current, thrustForce.current);
        reactionTorqueDir.current.set(0, invertTorque ? -1 : 1, 0).applyQuaternion(localQuat.current);
        reactionTorque.current.copy(reactionTorqueDir.current).multiplyScalar(maxThrust * torqueRatio)
        torqueInfluence.current.copy(leverageTorque.current).add(reactionTorque.current);

        propellerInfo.current.lx = thrustForce.current.x;
        propellerInfo.current.ly = thrustForce.current.y;
        propellerInfo.current.lz = thrustForce.current.z;
        propellerInfo.current.ax = torqueInfluence.current.x;
        propellerInfo.current.ay = torqueInfluence.current.y;
        propellerInfo.current.az = torqueInfluence.current.z;

        propellerInfo.current.thrustPos = localPos.current
        propellerInfo.current.thrustDir = thrustDir.current
        propellerInfo.current.thrustPot = thrustForce.current
        propellerInfo.current.torqueDir = reactionTorqueDir.current
        propellerInfo.current.torquePot = torqueInfluence.current
        propellerInfo.current.throttle = throttle.current
    }, [invertThrust, invertTorque, maxThrust, torqueRatio])

    /**
     * Update propeller model function
     */
    const updatePropellerModel = useCallback((frameRateCorrection: number) => {
        if (!modelRef.current) return
        const targetVel = throttle.current * propellerModelMaxSpin * (invertTorque ? -1 : 1);
        modelSpinVel.current = lerp(modelSpinVel.current, targetVel, 1 - Math.exp(-propellerModelLerpSpinRate * world.timestep))
        modelRef.current.rotateY(modelSpinVel.current * frameRateCorrection)
    }, [propellerModelMaxSpin, propellerModelLerpSpinRate, invertTorque])

    /**
     * Update debug indicators
     */
    const updateDebugger = useCallback(() => {
        if (currThrustArrowRef.current) currThrustArrowRef.current.setLength(throttle.current * debuggerArrowScale)
        if (currTorqueArrowRef.current) currTorqueArrowRef.current.setLength(throttle.current * debuggerArrowScale * torqueRatio)
    }, [debuggerArrowScale, torqueRatio])

    /**
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     */

    useFrame(() => {
        // Early return if no vehicle body or not enabled
        if (!vehicleBody || !enable) return

        // Correct frame rate difference
        const frameRateCorrection = 60 * world.timestep

        // Update vehicle info
        updateVehicleInfo(vehicleBody)

        // Update propeller info
        updatePropellerInfo()

        // Update propeller models
        if (propellerModelUpdate) updatePropellerModel(frameRateCorrection)

        // Update debug indicators 
        updateDebugger()
    })

    return (
        <>
            <group ref={thrustPropellerRef} {...props}>
                {showPropellerModel && (
                    <group ref={modelRef}>
                        {children}
                    </group>
                )}

                {/* Debug indicators */}
                {debug && debugAssets &&
                    <group>
                        {/* Thrust direction indicator */}
                        <group>
                            <mesh rotation-x={invertThrust ? Math.PI : 0} position={[0, debuggerScale * 0.25 * (invertThrust ? -1 : 1), 0]} geometry={debugAssets.thrustPointerGeo} material={debugAssets.thrustIndicatorMat} />
                        </group>
                        {/* Torque direction indicator */}
                        <group>
                            <mesh rotation-x={Math.PI / 2} position={[debuggerScale * 0.53 * (invertTorque ? 1 : -1), 0, debuggerScale * 0.25]} geometry={debugAssets.thrustPointerGeo} material={debugAssets.thrustRingMat} />
                            <mesh rotation-x={Math.PI / 2} geometry={debugAssets.thrustRingGeo} material={debugAssets.thrustRingMat} />
                        </group>
                        {/* Axis pointers indicator */}
                        <group>
                            <mesh ref={xAxisPointRef} position={[debuggerScale, 0, 0]} geometry={debugAssets.axisPointGeo} material={debugAssets.xAxisPointMat} />
                            <mesh ref={yAxisPointRef} position={[0, debuggerScale, 0]} geometry={debugAssets.axisPointGeo} material={debugAssets.yAxisPointMat} />
                            <mesh ref={zAxisPointRef} position={[0, 0, debuggerScale]} geometry={debugAssets.axisPointGeo} material={debugAssets.zAxisPointMat} />
                        </group>
                        {/* Arrow debugger */}
                        <group>
                            {/* Current thrust arrow debugger */}
                            <arrowHelper ref={currThrustArrowRef} args={[new THREE.Vector3(0, invertThrust ? -1 : 1, 0), undefined, 0, COLOR.EC_BLUE]} />
                            {/* Current torque arrow debugger */}
                            <arrowHelper ref={currTorqueArrowRef} args={[new THREE.Vector3(0, invertTorque ? -1 : 1, 0), undefined, 0, COLOR.EC_RED]} />
                        </group>
                    </group>
                }
            </group>
        </>
    );
})

export default React.memo(ThrustPropeller)

export interface PropellerInfoType extends Omit<ThrustPropellerProps, 'id'> {
    id: string

    // Local potential values in vehicle space.
    thrustPos: THREE.Vector3
    thrustDir: THREE.Vector3
    thrustPot: THREE.Vector3
    torqueDir: THREE.Vector3
    torquePot: THREE.Vector3

    // Actual mixer output in world space.
    worldThrustPos: THREE.Vector3
    worldThrustDir: THREE.Vector3
    worldTorqueDir: THREE.Vector3
    thrustImpulse: THREE.Vector3
    torqueImpulse: THREE.Vector3
    finalThrottle: number
    throttle: number
    setThrottle?: (value: number) => void

    // Max potential impulse
    lx: number,
    ly: number,
    lz: number,
    ax: number,
    ay: number,
    az: number,
}

export type ThrustPropellerProps = ThreeElements['group'] & {
    children?: ReactNode
    debug?: boolean
    enable?: boolean
    name?: string

    // Base setups
    maxThrust?: number,
    torqueRatio?: number,
    invertThrust?: boolean,
    invertTorque?: boolean,

    // Propeller model setups
    showPropellerModel?: boolean
    propellerModelUpdate?: boolean,
    propellerModelMaxSpin?: number
    propellerModelLerpSpinRate?: number

    // Debugger setups
    debuggerScale?: number,
    debuggerArrowScale?: number,
}
