/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three"
import React, { useRef, useMemo, type ReactNode, forwardRef, useImperativeHandle, useCallback, createContext, useEffect } from "react";
import { type RapierRigidBody, RigidBody, useRapier, type RigidBodyProps } from "@react-three/rapier"
import { useFrame } from "@react-three/fiber";
import { clamp } from "three/src/math/MathUtils.js";
import { useCustomGravity } from "../gravity/useCustomGravity";
import { createSlerpVec3 } from "../shared/Math";
import type { ForwardRefComponent } from "../shared/types";
import { bakeCurveLUT, type CurveData } from "../curves/CurveLUT";
import type { ReadonlyVehicleInput, VehicleInput } from "./types";
import type { DriveWheelConfigType, SteerWheelConfigType, WheelInfoType } from "./components/ShapeCastWheel";
import type { PropellerInfoType } from "./components/ThrustPropeller";

type TransmissionMode = "auto" | "manual"

const DEFAULT_CAR_CONFIG = {
    controlMode: "VELOCITY", // "VELOCITY"|"POSITION"
    // Engine and drive train
    engineHorsepower: 6, // HP
    engineMaxRPM: 6000, // RPM
    gearRatios: [10],
    finalDriveRatio: 1,
    transmissionMode: "auto" as TransmissionMode,
    shiftUpRPM: 5200,
    shiftDownRPM: 2200,
    shiftCooldown: 0.35,
    // Steering
    steerRate: Math.PI * 2,
    maxSteerAngle: Math.PI / 6, // 30 degree in radian
    // Reverse
    reverseTorqueScale: 1,
    reverseRPMScale: 0.3,
    // Curves
    engineTorqueCurveData: { points: [{ x: 0, y: 1, r_out: 0 }, { x: 1, y: 0, r_in: 0 },], samples: 50 },
    steerAngleCurveData: { points: [{ x: 0, y: 1, r_out: 0 }, { x: 0.2, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.4, r_in: 0 },], samples: 50 }
}

const DEFAULT_DRONE_CONFIG = {
    controlMode: "VELOCITY", // "VELOCITY"|"POSITION"
    maxYawRate: 2,
    maxHorizSpeed: 30,
    maxVertSpeed: 8,
    maxTiltAngle: Math.PI / 4, // 45 degree in radian
    airDragFactor: 0.2,
    // PD controller setups
    TILT_P: 15,
    TILT_D: 3,
    YAW_POS_P: 6,
    YAW_VEL_P: 4,
    // Position based config
    VERT_POS_P: 9,
    VERT_POS_D: 7,
    HORIZ_POS_P: 5,
    HORIZ_POS_D: 5.5,
    // Velocity based config
    HORIZ_VEL_P: 1,
    VERT_VEL_P: 2,
}

const getDriveRatio = (gearRatios: number[], gearIndex: number, finalDriveRatio: number) => (gearRatios[gearIndex] ?? gearRatios[0] ?? 0) * finalDriveRatio
const getMaxWheelAngVel = (engineMaxRPM: number, driveRatio: number) => driveRatio !== 0 ? (engineMaxRPM / driveRatio) * (2 * Math.PI / 60) : 0

export type WheelsInfoType = ReadonlyMap<string, React.RefObject<Readonly<WheelInfoType>>>;
export type PropellersInfoType = ReadonlyMap<string, React.RefObject<Readonly<PropellerInfoType>>>;
type MutableWheelsInfoType = Map<string, React.RefObject<Readonly<WheelInfoType>>>;
type MutablePropellersInfoType = Map<string, React.RefObject<PropellerInfoType>>;
export const VehicleContext = createContext<{
    body: React.RefObject<RapierRigidBody | null>
    upAxis: React.RefObject<THREE.Vector3>
    gravityDir: React.RefObject<THREE.Vector3>
    gravityMag: React.RefObject<number>
    currPos: React.RefObject<THREE.Vector3>
    currQuat: React.RefObject<THREE.Quaternion>
    currLinvel: React.RefObject<THREE.Vector3>
    currAngvel: React.RefObject<THREE.Vector3>
    bodyXAxis: React.RefObject<THREE.Vector3>
    bodyYAxis: React.RefObject<THREE.Vector3>
    bodyZAxis: React.RefObject<THREE.Vector3>
    movementState: React.RefObject<VehicleInput>
    wheelsInfo: React.RefObject<MutableWheelsInfoType>
    propellersInfo: React.RefObject<MutablePropellersInfoType>
    regWheel: (info: React.RefObject<Readonly<WheelInfoType>>) => void
    unregWheel: (id: string) => void
    regPropeller: (info: React.RefObject<PropellerInfoType>) => void
    unregPropeller: (id: string) => void
} | null>(null)

const EcctrlVehicle: ForwardRefComponent<EcctrlVehicleProps, EcctrlVehicleHandle> = /* @__PURE__ */ forwardRef<
    EcctrlVehicleHandle,
    EcctrlVehicleProps
>(({
    children,
    // Global control setups
    enable = true,
    // Car control setups
    carConfig = {},
    // Drone control setups
    droneConfig = {},
    // Gravity setups
    enableCustomGravity = false,
    gravityDirLerpSpeed = 6,
    // Other rigibody props from parent
    ...props
}, ref) => {
    /**
     * Rapier preset
     */
    const { rapier, world } = useRapier();

    /**
     * Vehicle controls preset
     */
    const carControlConfig = useMemo(() => ({ ...DEFAULT_CAR_CONFIG, ...carConfig }), [carConfig])
    const droneControlConfig = useMemo(() => ({ ...DEFAULT_DRONE_CONFIG, ...droneConfig }), [droneConfig])

    /**
     * Car controller preset
     */
    const engineMaxTorque = useRef(0)
    engineMaxTorque.current = carControlConfig.engineMaxRPM !== 0 ? carControlConfig.engineHorsepower * 7022 / carControlConfig.engineMaxRPM : 0
    const gearRatios = Array.isArray(carControlConfig.gearRatios) && carControlConfig.gearRatios.length > 0 ? carControlConfig.gearRatios : DEFAULT_CAR_CONFIG.gearRatios
    const gearIndex = useRef(0)
    gearIndex.current = clamp(Math.floor(gearIndex.current), 0, gearRatios.length - 1)
    const driveRatio = useRef(getDriveRatio(gearRatios, gearIndex.current, carControlConfig.finalDriveRatio))
    driveRatio.current = getDriveRatio(gearRatios, gearIndex.current, carControlConfig.finalDriveRatio)
    const engineRPM = useRef(0)
    const shiftCooldownTimer = useRef(0)
    const engineTorqueCurve = useMemo(() => bakeCurveLUT(carControlConfig.engineTorqueCurveData.points, carControlConfig.engineTorqueCurveData.samples ?? 50), [carControlConfig.engineTorqueCurveData]);
    const steerAngleCurve = useMemo(() => bakeCurveLUT(carControlConfig.steerAngleCurveData.points || [], carControlConfig.steerAngleCurveData.samples ?? 50), [carControlConfig.steerAngleCurveData]);
    const maxWheelAngVel = useRef(getMaxWheelAngVel(carControlConfig.engineMaxRPM, driveRatio.current))
    maxWheelAngVel.current = getMaxWheelAngVel(carControlConfig.engineMaxRPM, driveRatio.current)
    const driveWheelConfig = useRef<DriveWheelConfigType>({
        maxDriveTorque: 0,
        maxWheelAngVel: maxWheelAngVel.current,
        engineTorqueCurve,
        reverseTorqueScale: carControlConfig.reverseTorqueScale,
        reverseRPMScale: carControlConfig.reverseRPMScale,
        driveRatio: driveRatio.current,
    })
    driveWheelConfig.current.maxWheelAngVel = maxWheelAngVel.current
    driveWheelConfig.current.engineTorqueCurve = engineTorqueCurve
    driveWheelConfig.current.reverseTorqueScale = carControlConfig.reverseTorqueScale
    driveWheelConfig.current.reverseRPMScale = carControlConfig.reverseRPMScale
    driveWheelConfig.current.driveRatio = driveRatio.current
    const steerWheelConfig = useRef<SteerWheelConfigType>({
        steerAngleCurve,
        steerRate: carControlConfig.steerRate,
        maxSteerAngle: carControlConfig.maxSteerAngle,
        maxWheelAngVel: maxWheelAngVel.current,
    })
    steerWheelConfig.current.steerAngleCurve = steerAngleCurve
    steerWheelConfig.current.steerRate = carControlConfig.steerRate
    steerWheelConfig.current.maxSteerAngle = carControlConfig.maxSteerAngle
    steerWheelConfig.current.maxWheelAngVel = maxWheelAngVel.current
    const syncTransmissionConfig = useCallback(() => {
        driveRatio.current = getDriveRatio(gearRatios, gearIndex.current, carControlConfig.finalDriveRatio)
        maxWheelAngVel.current = getMaxWheelAngVel(carControlConfig.engineMaxRPM, driveRatio.current)
        driveWheelConfig.current.driveRatio = driveRatio.current
        driveWheelConfig.current.maxWheelAngVel = maxWheelAngVel.current
        steerWheelConfig.current.maxWheelAngVel = maxWheelAngVel.current
    }, [carControlConfig.engineMaxRPM, carControlConfig.finalDriveRatio, gearRatios])

    /**
     * Drone controller preset
     */
    const maxTiltTan = useMemo(() => Math.tan(droneControlConfig.maxTiltAngle), [droneControlConfig.maxTiltAngle])
    const hoverThrottle = useRef<number>(0)
    const targetUp = useRef<THREE.Vector3>(new THREE.Vector3())
    const tiltError = useRef<THREE.Vector3>(new THREE.Vector3())
    const tiltAngVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const torqueWorld = useRef<THREE.Vector3>(new THREE.Vector3())
    const torqueBody = useRef<THREE.Vector3>(new THREE.Vector3())
    const airDragImpulse = useRef<THREE.Vector3>(new THREE.Vector3())
    const worldThrustDir = useRef<THREE.Vector3>(new THREE.Vector3())
    const worldThrustPos = useRef<THREE.Vector3>(new THREE.Vector3())
    const worldTorqueDir = useRef<THREE.Vector3>(new THREE.Vector3())
    // Position based preset
    const targetPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const targetHeading = useRef<THREE.Vector3>(new THREE.Vector3());
    const targetFwd = useRef<THREE.Vector3>(new THREE.Vector3())
    const currentFwd = useRef<THREE.Vector3>(new THREE.Vector3())
    const posError = useRef<THREE.Vector3>(new THREE.Vector3())
    const horizPosError = useRef<THREE.Vector3>(new THREE.Vector3())
    const horizLinVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const horizForce = useRef<THREE.Vector3>(new THREE.Vector3())
    // Velocity based preset
    const worldXAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const worldZAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const vertAccCmd = useRef<number>(0)
    const horizAccCmd = useRef<THREE.Vector3>(new THREE.Vector3())
    const targetLinVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const linVelError = useRef<THREE.Vector3>(new THREE.Vector3())

    /**
     * Gravity controls preset
     */
    const gravityField = useCustomGravity((state) => state.gravityField)
    const applyGravityField = useCustomGravity((state) => state.applyGravityField)
    // const isZeroGravity = useRef<boolean>(false)
    const upAxis = useRef<THREE.Vector3>(new THREE.Vector3());
    const referenceGravity = useRef<THREE.Vector3>(new THREE.Vector3());
    const referenceGravityMag = useRef<number>(0);
    const referenceGravityDir = useRef<THREE.Vector3>(new THREE.Vector3());
    const gravityDir = useRef<THREE.Vector3>(new THREE.Vector3());
    const slerpRef = useRef(createSlerpVec3());

    /**
     * User controls setup
     */
    // Input state preset
    const movementState = useRef<VehicleInput>({
        // Car preset
        forward: false,
        backward: false,
        steerLeft: false,
        steerRight: false,
        brake: false,
        // Drone preset
        throttleUp: false,
        throttleDown: false,
        yawLeft: false,
        yawRight: false,
        pitchForward: false,
        pitchBackward: false,
        rollLeft: false,
        rollRight: false,
        // Joystick preset
        joystickL: { x: 0, y: 0 },
        joystickR: { x: 0, y: 0 },
    })

    /**
     * Vehicle collider/model preset
     */
    const vehicleRef = useRef<RapierRigidBody>(null)
    const vehiclePos = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const vehicleInvertQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const vehicleLinVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleAngVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleXAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleYAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleZAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const setMovement = useCallback((movement: VehicleInput) => {
        if (movement.forward !== undefined) movementState.current.forward = movement.forward;
        if (movement.backward !== undefined) movementState.current.backward = movement.backward;
        if (movement.steerLeft !== undefined) movementState.current.steerLeft = movement.steerLeft;
        if (movement.steerRight !== undefined) movementState.current.steerRight = movement.steerRight;
        if (movement.brake !== undefined) movementState.current.brake = movement.brake;
        if (movement.throttleUp !== undefined) movementState.current.throttleUp = movement.throttleUp
        if (movement.throttleDown !== undefined) movementState.current.throttleDown = movement.throttleDown
        if (movement.yawLeft !== undefined) movementState.current.yawLeft = movement.yawLeft
        if (movement.yawRight !== undefined) movementState.current.yawRight = movement.yawRight
        if (movement.pitchForward !== undefined) movementState.current.pitchForward = movement.pitchForward
        if (movement.pitchBackward !== undefined) movementState.current.pitchBackward = movement.pitchBackward
        if (movement.rollLeft !== undefined) movementState.current.rollLeft = movement.rollLeft
        if (movement.rollRight !== undefined) movementState.current.rollRight = movement.rollRight
        if (movement.joystickL) {
            movementState.current.joystickL!.x = movement.joystickL.x
            movementState.current.joystickL!.y = movement.joystickL.y
        }
        if (movement.joystickR) {
            movementState.current.joystickR!.x = movement.joystickR.x
            movementState.current.joystickR!.y = movement.joystickR.y
        }
    }, [])
    const setTarget = useCallback((pos?: THREE.Vector3, dir?: THREE.Vector3) => {
        if (pos) targetPosition.current.copy(pos)
        if (dir) targetHeading.current.copy(dir)
    }, [])

    /**
     * Register/unregister wheels information
     */
    const wheelsInfo = useRef<MutableWheelsInfoType>(new Map())
    const syncWheelConfig = useCallback(() => {
        let totalDriveTorqueWeight = 0
        wheelsInfo.current.forEach((wheelInfo) => {
            if (!wheelInfo.current.driveWheel) return
            totalDriveTorqueWeight += Math.max(0, wheelInfo.current.driveTorqueWeight ?? 1)
        })
        wheelsInfo.current.forEach((wheelInfo) => {
            if (wheelInfo.current.driveWheel) {
                const driveTorqueWeight = Math.max(0, wheelInfo.current.driveTorqueWeight ?? 1)
                wheelInfo.current.setDriveWheelConfig?.({
                    ...driveWheelConfig.current,
                    maxDriveTorque: totalDriveTorqueWeight > 0
                        ? engineMaxTorque.current * driveTorqueWeight / totalDriveTorqueWeight
                        : 0,
                })
            }
            if (wheelInfo.current.steerWheel) wheelInfo.current.setSteerWheelConfig?.(steerWheelConfig.current)
        })
    }, [])
    const regWheel = useCallback((wheelInfo: React.RefObject<Readonly<WheelInfoType>>) => {
        const id = wheelInfo.current.id
        if (!wheelsInfo.current.has(id)) {
            wheelsInfo.current.set(id, wheelInfo)
            syncWheelConfig()
        }
    }, [syncWheelConfig])
    const unregWheel = useCallback((id: string) => {
        if (wheelsInfo.current.delete(id)) syncWheelConfig()
    }, [syncWheelConfig])
    const setGear = useCallback((index: number) => {
        const nextGearIndex = clamp(Math.floor(index), 0, gearRatios.length - 1)
        if (gearIndex.current === nextGearIndex) return
        gearIndex.current = nextGearIndex
        shiftCooldownTimer.current = carControlConfig.shiftCooldown
        syncTransmissionConfig()
        syncWheelConfig()
    }, [carControlConfig.shiftCooldown, gearRatios.length, syncTransmissionConfig, syncWheelConfig])

    useEffect(() => {
        syncTransmissionConfig()
        syncWheelConfig()
    }, [
        carControlConfig.engineHorsepower,
        carControlConfig.engineMaxRPM,
        carControlConfig.finalDriveRatio,
        carControlConfig.maxSteerAngle,
        carControlConfig.reverseRPMScale,
        carControlConfig.reverseTorqueScale,
        carControlConfig.steerRate,
        engineTorqueCurve,
        gearRatios,
        steerAngleCurve,
        syncTransmissionConfig,
        syncWheelConfig,
    ])

    /**
     * Register/unregister propellers information
     */
    const propellersInfo = useRef<MutablePropellersInfoType>(new Map())
    const regPropeller = useCallback((propellerInfo: React.RefObject<PropellerInfoType>) => {
        const id = propellerInfo.current.id
        if (!propellersInfo.current.has(id)) propellersInfo.current.set(id, propellerInfo)
    }, [])
    const unregPropeller = useCallback((id: string) => propellersInfo.current.delete(id), [])

    /**
     * Expose vehicle info and control functions to children via ref and context
     */
    useImperativeHandle(ref, () => ({
        get body() { return vehicleRef.current! },
        get upAxis() { return upAxis.current },
        get gravityDir() { return gravityDir.current },
        get gravityMag() { return referenceGravityMag.current },
        get currPos() { return vehiclePos.current },
        get currQuat() { return vehicleQuat.current },
        get currLinVel() { return vehicleLinVel.current },
        get currAngVel() { return vehicleAngVel.current },
        get bodyXAxis() { return vehicleXAxis.current },
        get bodyYAxis() { return vehicleYAxis.current },
        get bodyZAxis() { return vehicleZAxis.current },
        get targetPos() { return targetPosition.current },
        get targetFwd() { return targetHeading.current },
        get input() { return movementState.current },
        get wheelsInfo() { return wheelsInfo.current },
        get propellersInfo() { return propellersInfo.current },
        get gearIndex() { return gearIndex.current },
        get driveRatio() { return driveRatio.current },
        get engineRPM() { return engineRPM.current },
        setMovement,
        setTarget,
        setGear,
    }), [setGear, setMovement, setTarget]);

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
     */
    /**
     * Update vehicle info function
     */
    const updateVehicleInfo = useCallback((body: RapierRigidBody) => {
        vehiclePos.current.copy(body.translation())
        vehicleQuat.current.copy(body.rotation())
        vehicleInvertQuat.current.copy(vehicleQuat.current).invert()
        vehicleLinVel.current.copy(body.linvel())
        vehicleAngVel.current.copy(body.angvel())
        vehicleYAxis.current.set(0, 1, 0).applyQuaternion(vehicleQuat.current);
        vehicleXAxis.current.set(1, 0, 0).applyQuaternion(vehicleQuat.current);
        vehicleZAxis.current.set(0, 0, 1).applyQuaternion(vehicleQuat.current);
    }, [])

    /**
     * Update gravity/upAxis direction and value
     */
    const updateGravityInfo = useCallback((body: RapierRigidBody) => {
        if (enableCustomGravity) {
            referenceGravity.current.copy(gravityField(vehiclePos.current))
            // Apply custom gravity
            applyGravityField(body, world.timestep)
        } else {
            referenceGravity.current.copy(world.gravity)
        }

        referenceGravityMag.current = referenceGravity.current.length()
        referenceGravityDir.current.copy(referenceGravity.current).normalize()
        if (referenceGravityDir.current.lengthSq() === 0) referenceGravityDir.current.copy(vehicleYAxis.current).negate()
        gravityDir.current.copy(slerpRef.current(gravityDir.current, referenceGravityDir.current, 1 - Math.exp(-gravityDirLerpSpeed * world.timestep), vehicleZAxis.current))
        upAxis.current.copy(gravityDir.current).negate()
    }, [enableCustomGravity, gravityDirLerpSpeed, gravityField, applyGravityField])

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
     */

    /**
     * Car overall control logics
     */
    const updateTransmission = useCallback((wheels: WheelsInfoType) => {
        let totalWheelRPM = 0
        let totalDriveTorqueWeight = 0
        wheels.forEach((wheel) => {
            if (!wheel.current.driveWheel) return
            const driveTorqueWeight = Math.max(0, wheel.current.driveTorqueWeight ?? 1)
            totalWheelRPM += Math.abs(wheel.current.wheelAngVel) * 60 / (Math.PI * 2) * driveTorqueWeight
            totalDriveTorqueWeight += driveTorqueWeight
        })

        const averageWheelRPM = totalDriveTorqueWeight > 0 ? totalWheelRPM / totalDriveTorqueWeight : 0
        engineRPM.current = averageWheelRPM * Math.abs(driveRatio.current)
        if (carControlConfig.transmissionMode !== "auto" || gearRatios.length <= 1) return

        if (shiftCooldownTimer.current > 0) {
            shiftCooldownTimer.current = Math.max(0, shiftCooldownTimer.current - world.timestep)
            return
        }

        if (engineRPM.current > carControlConfig.shiftUpRPM && gearIndex.current < gearRatios.length - 1) {
            setGear(gearIndex.current + 1)
        } else if (engineRPM.current < carControlConfig.shiftDownRPM && gearIndex.current > 0) {
            setGear(gearIndex.current - 1)
        }
    }, [carControlConfig.shiftDownRPM, carControlConfig.shiftUpRPM, carControlConfig.transmissionMode, gearRatios.length, setGear, world.timestep])

    // Velocity based control logics
    const velocityBasedCarControl = useCallback((input: VehicleInput, wheels: WheelsInfoType) => {
        // Convert user input to drive/brake/steer demand, also clamp them to valid range
        const driveIn = clamp((input.forward ? 1 : 0) - (input.backward ? 1 : 0), -1, 1);
        const steerIn = clamp((input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0) - (input.joystickL?.x ?? 0), -1, 1);
        const brakeIn = input.brake ? 1 : 0

        // Apply drive/brake/steer demand to wheels
        wheels.forEach((wheel) => {
            if (wheel.current.driveWheel && wheel.current.setDriveDemand) wheel.current.setDriveDemand(driveIn)
            if (wheel.current.brakeWheel && wheel.current.setBrakeDemand) wheel.current.setBrakeDemand(brakeIn)
            if (wheel.current.steerWheel && wheel.current.setSteerDemand) wheel.current.setSteerDemand(steerIn)
        })
    }, []);

    // Apply wheels final impulse
    const applyWheelImpulse = useCallback((wheels: WheelsInfoType, body: RapierRigidBody) => {
        if (!body) return

        // wake up check: only wake up when any wheel has contact and non-zero velocity surface
        if (body.isSleeping()) {
            let shouldWake = false
            for (const wheel of wheels.values()) {
                const w = wheel.current
                if (!w.rayHit) continue
                if (w.isOnPlatform || Math.abs(w.wheelLinVel) > 1e-4) {
                    shouldWake = true
                    break
                }
            }

            if (!shouldWake) return
            body.wakeUp()
        }

        wheels.forEach((wheel) => {
            if (!wheel.current.rayHit) return
            // Apply suspension at the support point to avoid contact-patch jacking during steering.
            body.applyImpulseAtPoint(wheel.current.floatImp, wheel.current.supPos, false)
            body.applyImpulseAtPoint(wheel.current.lngFricImp, wheel.current.rayHitPos, false)
            body.applyImpulseAtPoint(wheel.current.latFricImp, wheel.current.rayHitPos, false)
        })
    }, [])

    // Main car control application function
    const applyCarControl = useCallback((wheels: WheelsInfoType, body: RapierRigidBody, input: VehicleInput) => {
        if (!body) return;

        // Update engine RPM and automatic gear changes before sending demands to wheels.
        updateTransmission(wheels)

        // Apply control logics based on selected control mode
        velocityBasedCarControl(input, wheels)

        // Apply drive/brake/friction impulse from shape cast wheels
        applyWheelImpulse(wheels, body)
    }, [applyWheelImpulse, updateTransmission, velocityBasedCarControl])

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
     */

    /**
     * Drone overall control logics
     */
    // Compute propellers overall potential
    const propellerPotential = useRef({ sumLX: 0, sumLY: 0, sumLZ: 0, sumAX: 0, sumAY: 0, sumAZ: 0 })
    const computePropellerPotential = useCallback((propellers: PropellersInfoType) => {
        let sumLX = 0, sumLY = 0, sumLZ = 0
        let sumAX = 0, sumAY = 0, sumAZ = 0
        propellers.forEach(p => {
            sumLX += p.current.lx
            sumLY += p.current.ly
            sumLZ += p.current.lz
            sumAX += Math.abs(p.current.ax)
            sumAY += Math.abs(p.current.ay)
            sumAZ += Math.abs(p.current.az)
        })
        propellerPotential.current.sumLX = sumLX
        propellerPotential.current.sumLY = sumLY
        propellerPotential.current.sumLZ = sumLZ
        propellerPotential.current.sumAX = sumAX
        propellerPotential.current.sumAY = sumAY
        propellerPotential.current.sumAZ = sumAZ
    }, [])

    // Position based control logics
    const positionBasedDroneControl = useCallback((weight: number, sumWorldLY: number) => {
        // Compute the vertical and horizontal position difference
        posError.current.subVectors(targetPosition.current, vehiclePos.current);
        const vertPosErrorMag = posError.current.dot(upAxis.current);
        horizPosError.current.copy(posError.current).projectOnPlane(upAxis.current)

        // Compute the current vertical and horizontal linear velocity
        const vertLinVelMag = vehicleLinVel.current.dot(upAxis.current);
        horizLinVel.current.copy(vehicleLinVel.current).projectOnPlane(upAxis.current)

        // Compute the necessary vertical hovering throttle, also clamp speed at maxVertSpeed
        const vertControl = clamp(vertPosErrorMag * droneControlConfig.VERT_POS_P, -droneControlConfig.VERT_POS_D * droneControlConfig.maxVertSpeed, droneControlConfig.VERT_POS_D * droneControlConfig.maxVertSpeed);
        const vertForceMag = weight + vertControl - vertLinVelMag * droneControlConfig.VERT_POS_D;
        hoverThrottle.current = Math.max(0, vertForceMag / (sumWorldLY || 1))

        // Compute the tilted target up to move horizontally, also clamp speed at maxHorizSpeed
        horizForce.current.set(0, 0, 0).addScaledVector(horizPosError.current, droneControlConfig.HORIZ_POS_P).addScaledVector(horizLinVel.current, -droneControlConfig.HORIZ_POS_D).clampLength(0, droneControlConfig.HORIZ_POS_D * droneControlConfig.maxHorizSpeed);
        targetUp.current.copy(upAxis.current).multiplyScalar(weight).add(horizForce.current.clampLength(0, weight * maxTiltTan)).normalize()
        tiltError.current.crossVectors(vehicleYAxis.current, targetUp.current);
        tiltAngVel.current.copy(vehicleAngVel.current).projectOnPlane(upAxis.current)

        // Find yaw direction difference: yawError
        targetFwd.current.copy(targetHeading.current).projectOnPlane(upAxis.current).normalize();
        currentFwd.current.copy(vehicleZAxis.current).projectOnPlane(upAxis.current).normalize();
        const yawError = targetFwd.current.angleTo(currentFwd.current) * Math.sign(currentFwd.current.cross(targetFwd.current).dot(upAxis.current));
        // Find yaw speed difference: yawRateError, also clamp speed at maxYawRate
        const currentYawRate = vehicleAngVel.current.dot(upAxis.current)
        const targetYawRate = clamp(yawError * droneControlConfig.YAW_POS_P, -droneControlConfig.maxYawRate, droneControlConfig.maxYawRate);
        const yawRateError = targetYawRate - currentYawRate

        // Combine tilt and yaw to form the torque needed to control the drone
        torqueWorld.current.set(0, 0, 0)
            .addScaledVector(tiltError.current, droneControlConfig.TILT_P)
            .addScaledVector(tiltAngVel.current, -droneControlConfig.TILT_D)
            .addScaledVector(upAxis.current, yawRateError * droneControlConfig.YAW_VEL_P)
        // Convert required torque to dorne local quaternion
        torqueBody.current.copy(torqueWorld.current).applyQuaternion(vehicleInvertQuat.current);
    }, [droneControlConfig, maxTiltTan]);

    // Velocity based control logics
    const velocityBasedDroneControl = useCallback((input: VehicleInput, body: RapierRigidBody, weight: number, sumWorldLY: number) => {
        // Convert user input (-1 to 1)
        const throttleIn = clamp((input.throttleUp ? 1 : 0) - (input.throttleDown ? 1 : 0) + (input.joystickL?.y ?? 0), -1, 1);
        const yawIn = clamp((input.yawLeft ? 1 : 0) - (input.yawRight ? 1 : 0) - (input.joystickL?.x ?? 0), -1, 1);
        const pitchIn = clamp((input.pitchForward ? 1 : 0) - (input.pitchBackward ? 1 : 0) + (input.joystickR?.y ?? 0), -1, 1);
        const rollIn = clamp((input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0) + (input.joystickR?.x ?? 0), -1, 1);

        // Find drone roll and pitch axis
        worldXAxis.current.copy(vehicleXAxis.current).projectOnPlane(upAxis.current).normalize()
        worldZAxis.current.copy(vehicleZAxis.current).projectOnPlane(upAxis.current).normalize()

        // Compute the target linear velocity and ΔV base on user input
        targetLinVel.current.set(0, 0, 0)
            .addScaledVector(worldXAxis.current, -rollIn * droneControlConfig.maxHorizSpeed)
            .addScaledVector(worldZAxis.current, pitchIn * droneControlConfig.maxHorizSpeed)
            .addScaledVector(upAxis.current, throttleIn * droneControlConfig.maxVertSpeed)
        linVelError.current.subVectors(targetLinVel.current, vehicleLinVel.current);

        // Use PD controls to find the needed acceleration direction
        vertAccCmd.current = clamp(linVelError.current.dot(upAxis.current) * droneControlConfig.VERT_VEL_P, -referenceGravityMag.current, referenceGravityMag.current)
        horizAccCmd.current.copy(linVelError.current).projectOnPlane(upAxis.current).multiplyScalar(droneControlConfig.HORIZ_VEL_P).clampLength(0, referenceGravityMag.current * maxTiltTan)

        // Compute the necessary vertical hovering throttle
        const verticalForceMag = weight + vertAccCmd.current * body.mass();
        hoverThrottle.current = Math.max(0, verticalForceMag / (sumWorldLY || 1));

        // Tilt the drone up axis towards the acceleration direction
        targetUp.current.copy(upAxis.current).multiplyScalar(referenceGravityMag.current).add(horizAccCmd.current).normalize();
        tiltError.current.crossVectors(vehicleYAxis.current, targetUp.current);
        tiltAngVel.current.copy(vehicleAngVel.current).projectOnPlane(upAxis.current)

        // Find yaw speed difference: yawRateError
        const currentYawRate = vehicleAngVel.current.dot(upAxis.current);
        const targetYawRate = yawIn * droneControlConfig.maxYawRate;
        const yawRateError = targetYawRate - currentYawRate;

        // Combine tilt and yaw to form the torque needed to control the drone
        torqueWorld.current.set(0, 0, 0)
            .addScaledVector(tiltError.current, droneControlConfig.TILT_P)
            .addScaledVector(tiltAngVel.current, -droneControlConfig.TILT_D)
            .addScaledVector(upAxis.current, yawRateError * droneControlConfig.YAW_VEL_P)
        // Convert required torque to dorne local quaternion
        torqueBody.current.copy(torqueWorld.current).applyQuaternion(vehicleInvertQuat.current);
    }, [droneControlConfig, maxTiltTan]);

    // Compute each propeller final throttle after mixer, also clamp it to valid range
    const computePropellerFinalThrottle = useCallback((propeller: Readonly<PropellerInfoType>, maxSafeMix: number) => {
        const mix =
            (torqueBody.current.x * propeller.ax) / (propellerPotential.current.sumAX || 1) + // Pitch
            (torqueBody.current.z * propeller.az) / (propellerPotential.current.sumAZ || 1) + // Roll
            (torqueBody.current.y * propeller.ay) / (propellerPotential.current.sumAY || 1); // Yaw

        return clamp(hoverThrottle.current + clamp(mix, -maxSafeMix, maxSafeMix), 0, 1)
    }, [])

    // Apply propellers final mixer and impulse
    const applyMixerImpulse = useCallback((propellers: MutablePropellersInfoType, body: RapierRigidBody) => {
        // Compute the max mix, so the drone won't lift/lower while yaw/roll/pitch
        const maxSafeMix = Math.min(1.0 - hoverThrottle.current, hoverThrottle.current);

        // Wake up check: only wake up when the finalThrottle has changed
        if (body.isSleeping()) {
            let shouldWake = false
            for (const propeller of propellers.values()) {
                const info = propeller.current
                const finalThrottle = computePropellerFinalThrottle(info, maxSafeMix)
                if (Math.abs(finalThrottle - info.throttle) > 1e-4) {
                    shouldWake = true
                    break
                }
            }

            if (!shouldWake) return
            body.wakeUp()
        }

        propellers.forEach((propeller) => {
            const info = propeller.current
            const finalThrottle = computePropellerFinalThrottle(info, maxSafeMix)

            // Pass the finalThrottle to each propeller component for visualization 
            info.finalThrottle = finalThrottle
            if (info.setThrottle) info.setThrottle(finalThrottle);

            // Store the actual world-space output so users can drive effects without recomputing the mixer.
            worldThrustDir.current.copy(info.thrustDir).applyQuaternion(vehicleQuat.current).normalize();
            worldThrustPos.current.copy(info.thrustPos).applyQuaternion(vehicleQuat.current).add(vehiclePos.current);
            worldTorqueDir.current.copy(info.torqueDir).applyQuaternion(vehicleQuat.current).normalize();
            info.worldThrustDir.copy(worldThrustDir.current)
            info.worldThrustPos.copy(worldThrustPos.current)
            info.worldTorqueDir.copy(worldTorqueDir.current)
            info.thrustImpulse.copy(worldThrustDir.current).multiplyScalar(info.maxThrust! * finalThrottle * world.timestep)
            info.torqueImpulse.copy(worldTorqueDir.current).multiplyScalar(info.maxThrust! * finalThrottle * world.timestep * info.torqueRatio!)

            // Apply Physics
            body.applyImpulseAtPoint(info.thrustImpulse, info.worldThrustPos, false);
            body.applyTorqueImpulse(info.torqueImpulse, false);
        })
    }, [computePropellerFinalThrottle])

    // Apply air drag impulse
    const applyAirDrag = useCallback((body: RapierRigidBody) => {
        airDragImpulse.current.copy(vehicleLinVel.current).multiplyScalar(-droneControlConfig.airDragFactor * world.timestep)
        body.applyImpulse(airDragImpulse.current, false)
    }, [droneControlConfig.airDragFactor, world.timestep])

    // Main drone control application function
    const applyDroneControl = useCallback((propellers: MutablePropellersInfoType, body: RapierRigidBody, input: VehicleInput) => {
        if (!body) return;

        // Compute propellers overall potential
        computePropellerPotential(propellers);

        // Overall potential for hovering drone vertically 
        const sumWorldLY =
            propellerPotential.current.sumLX * vehicleXAxis.current.dot(upAxis.current) +
            propellerPotential.current.sumLY * vehicleYAxis.current.dot(upAxis.current) +
            propellerPotential.current.sumLZ * vehicleZAxis.current.dot(upAxis.current);
        const weight = body.mass() * referenceGravityMag.current

        // Apply control logics based on selected control mode
        switch (droneControlConfig.controlMode) {
            case "POSITION":
                positionBasedDroneControl(weight, sumWorldLY);
                break;
            case "VELOCITY":
                velocityBasedDroneControl(input, body, weight, sumWorldLY);
                break;
        }

        // Apply propellers final mixer and impulse
        applyMixerImpulse(propellers, body);

        // Apply air drag impulse
        applyAirDrag(body)
    }, [computePropellerPotential, positionBasedDroneControl, velocityBasedDroneControl, droneControlConfig.controlMode, applyMixerImpulse, applyAirDrag]);

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
     */

    useFrame(() => {
        // Skip the whole vehicle loop when disabled
        if (!enable || !vehicleRef.current) return

        /**
         * Update when character is not sleeping
         */
        if (!vehicleRef.current.isSleeping()) {
            // Update vehicle collider pos/vel/quat/axis
            updateVehicleInfo(vehicleRef.current)

            //Update gravity value & direction, and then apply gravity
            updateGravityInfo(vehicleRef.current)
        }

        /**
         * Apply drive/brake/friction impulse from shape cast wheels
         * whenever there is a wheel component
         */
        if (wheelsInfo.current.size > 0) applyCarControl(wheelsInfo.current, vehicleRef.current, movementState.current)

        /**
         * Apply drone control logics
         * whenever there is a propeller component
         */
        if (propellersInfo.current.size > 0) applyDroneControl(propellersInfo.current, vehicleRef.current, movementState.current)
    })

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
     */

    const vehicleContextValue = useMemo(() => ({
        body: vehicleRef,
        upAxis: upAxis,
        gravityDir: gravityDir,
        gravityMag: referenceGravityMag,
        currPos: vehiclePos,
        currQuat: vehicleQuat,
        currLinvel: vehicleLinVel,
        currAngvel: vehicleAngVel,
        bodyXAxis: vehicleXAxis,
        bodyYAxis: vehicleYAxis,
        bodyZAxis: vehicleZAxis,
        movementState,
        wheelsInfo,
        propellersInfo,
        regWheel,
        unregWheel,
        regPropeller,
        unregPropeller,
    }), [regWheel, unregWheel, regPropeller, unregPropeller])

    return (
        <VehicleContext.Provider value={vehicleContextValue}>
            <RigidBody
                colliders={false}
                ref={vehicleRef}
                {...props}
            >
                {children}
            </RigidBody>
        </VehicleContext.Provider>
    )
})

export default React.memo(EcctrlVehicle);

export type CarConfigType = {
    controlMode?: "VELOCITY" | "POSITION",
    // Engine and drive train
    engineHorsepower?: number,
    engineMaxRPM?: number,
    gearRatios?: number[],
    finalDriveRatio?: number,
    transmissionMode?: TransmissionMode,
    shiftUpRPM?: number,
    shiftDownRPM?: number,
    shiftCooldown?: number,
    // Steering
    steerRate?: number,
    maxSteerAngle?: number,
    // Reverse
    reverseTorqueScale?: number,
    reverseRPMScale?: number,
    // Curves
    engineTorqueCurveData?: CurveData,
    steerAngleCurveData?: CurveData,
};

export type DroneConfigType = {
    controlMode?: "VELOCITY" | "POSITION",
    maxYawRate?: number,
    maxHorizSpeed?: number,
    maxVertSpeed?: number,
    maxTiltAngle?: number,
    airDragFactor?: number,
    // PD controller setups
    TILT_P?: number,
    TILT_D?: number,
    YAW_POS_P?: number,
    YAW_VEL_P?: number,
    // Position based config
    VERT_POS_P?: number,
    VERT_POS_D?: number,
    HORIZ_POS_P?: number,
    HORIZ_POS_D?: number,
    // Velocity based config
    HORIZ_VEL_P?: number,
    VERT_VEL_P?: number,
};

export interface EcctrlVehicleProps extends RigidBodyProps {
    children?: ReactNode
    // Global control setups
    enable?: boolean
    // Car control setups
    carConfig?: Partial<CarConfigType>
    // Drone control setups
    droneConfig?: Partial<DroneConfigType>
    // Gravity setups
    enableCustomGravity?: boolean
    gravityDirLerpSpeed?: number
    // Other rigibody props from parent
    props?: RigidBodyProps;
}

export interface EcctrlVehicleHandle {
    body: RapierRigidBody
    readonly upAxis: THREE.Vector3
    readonly gravityDir: THREE.Vector3
    readonly gravityMag: number
    readonly currPos: THREE.Vector3
    readonly currQuat: THREE.Quaternion
    readonly currLinVel: THREE.Vector3
    readonly currAngVel: THREE.Vector3
    readonly bodyXAxis: THREE.Vector3
    readonly bodyYAxis: THREE.Vector3
    readonly bodyZAxis: THREE.Vector3
    readonly targetPos: THREE.Vector3
    readonly targetFwd: THREE.Vector3
    readonly input: ReadonlyVehicleInput
    readonly wheelsInfo: WheelsInfoType
    readonly propellersInfo: PropellersInfoType
    readonly gearIndex: number
    readonly driveRatio: number
    readonly engineRPM: number
    setMovement: (state: VehicleInput) => void
    setTarget: (pos?: THREE.Vector3, dir?: THREE.Vector3) => void
    setGear: (gearIndex: number) => void
}
