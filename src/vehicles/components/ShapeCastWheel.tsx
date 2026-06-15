/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three"
import * as COLOR from "../../shared/constants/Color";
import { remap } from "../../shared/Math";
import { VehicleContext } from "../EcctrlVehicle"
import { useFrame, type ThreeElements } from "@react-three/fiber"
import { type RapierRigidBody, useRapier } from "@react-three/rapier"
import { clamp, generateUUID } from "three/src/math/MathUtils.js"
import { type Collider, type ColliderShapeCastHit, type RayColliderIntersection, QueryFilterFlags } from "@dimforge/rapier3d-compat"
import React, { useCallback, useContext, useEffect, useMemo, useRef, forwardRef, type ReactNode, useImperativeHandle } from "react"
import { bakeCurveLUT, evaluateCurveLUT, type CurveData, type CurveLUT } from "../../curves/CurveLUT";
import type { EcctrlUserDataType, ForwardRefComponent } from "../../shared/types";

const ShapeCastWheel: ForwardRefComponent<ShapeCastWheelProps, THREE.Group> = /* @__PURE__ */ forwardRef<
    THREE.Group,
    ShapeCastWheelProps
>(({
    children,
    debug = false,
    enable = true,
    name = "",

    // Float ray base setups
    groundDetection = "shapeCast",
    rayShapeR = 0.5,
    rayShapeH = 0.15,
    rayLength = 0.5,
    springK = 180,
    dampingC = 16, // max at 2*sqrt(K*mass)

    // Drive wheel setups
    driveInvert = false,
    driveWheel = false,
    driveTorqueWeight = 1,

    // Steer wheel setups
    steerInvert = false,
    steerWheel = false,

    // Brake wheel setups
    brakeWheel = false,
    maxBrakeTorque = 40,

    // Wheel rooling resistance setups
    rollingResistanceCoef = 0.007,

    // Tire grip setups
    lowVelThreshold = 0.4,
    tireGripFactor = 1.5,
    lngFrictionEllipseScale = 1,
    latFrictionEllipseScale = 1,
    relaxLngRate = 0.05,
    relaxLatRate = 0.1,
    minLngRelaxCoeff = 0.3,
    minLatRelaxCoeff = 0.3,
    lngSlipRatioCurveData = { points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.25, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.7, r_in: 0 },] },
    latSlipRatioCurveData = { points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.15, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.9, r_in: 0 },] },

    // Moving platform setups
    followPlatform = true,
    massRatioFallOffCurveData = { points: [{ x: 0, y: 0.5, r_out: 0 }, { x: 0.5, y: 1, r_out: 0 }, { x: 1, y: 1, r_in: 0 }] },
    applyCounterMass = true,
    applyCounterFriction = true,

    // Wheel model setups
    showWheelModel = true,
    wheelModelDensity = 1.5,
    wheelModelUpdate = true,
    wheelModelRadius = 0.5,
    wheelModelLerpPosRate = 10,
    wheelModelReversRotation = false,

    // Debugger setups
    debuggerArrowScale = 10,

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
    const fixedScale = useMemo(() => new THREE.Vector3(1, 1, 1), [])
    const fixedOrigin = useMemo(() => new THREE.Vector3(0, 0, 0), [])
    const fixedXAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
    const fixedYAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
    const fixedZAxis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
    const vehiclePos = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const vehicleInvertQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const vehicleMatrix = useRef<THREE.Matrix4>(new THREE.Matrix4())
    const vehicleInvertMatrix = useRef<THREE.Matrix4>(new THREE.Matrix4())
    const vehicleLinVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleAngVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleXAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleYAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const vehicleZAxis = useRef<THREE.Vector3>(new THREE.Vector3())

    /**
     * Wheel physical properties and states
     */
    const effectiveInertia = useRef<number>(0)
    const wheelAngVel = useRef<number>(0)
    const supportPoint = useRef<THREE.Vector3>(new THREE.Vector3())
    const wheelVolume = useMemo(() => Math.PI * rayShapeR * rayShapeR * (rayShapeH * 2), [rayShapeR, rayShapeH])
    const wheelMass = useMemo(() => wheelModelDensity * wheelVolume, [wheelModelDensity, wheelVolume])
    const wheelInertia = useMemo(() => 0.5 * wheelMass * rayShapeR * rayShapeR, [wheelMass, rayShapeR])

    /**
     * Control preset
     */
    // Friction preset
    const frictionCoef = useRef<number>(0);
    const lngAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const latAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const lngFrictionImp = useRef<THREE.Vector3>(new THREE.Vector3());
    const latFrictionImp = useRef<THREE.Vector3>(new THREE.Vector3());
    const lngSlipRatioCurve = useMemo(() => bakeCurveLUT(lngSlipRatioCurveData.points, lngSlipRatioCurveData.samples ?? 50), [lngSlipRatioCurveData]);
    const latSlipRatioCurve = useMemo(() => bakeCurveLUT(latSlipRatioCurveData.points, latSlipRatioCurveData.samples ?? 50), [latSlipRatioCurveData]);
    const lngSlipRatio = useRef<number>(0)
    const latSlipRatio = useRef<number>(0)
    const slipStrength = useRef<number>(0)
    const smoothedLngImpulse = useRef(0);
    const smoothedLatImpulse = useRef(0);
    const desiredLngImpulse = useRef<number>(0)
    const desiredLatImpulse = useRef<number>(0)
    // Steering preset
    const steerAngle = useRef<number>(0)
    const steerTarget = useRef<number>(0)
    const steerIncrement = useRef<number>(0)
    const steerDemand = useRef<number>(0)
    const steerWheelConfig = useRef<SteerWheelConfigType | null>(null)
    const setSteerDemand = useCallback((value: number) => steerDemand.current = value, [])
    const setSteerWheelConfig = useCallback((value: SteerWheelConfigType) => steerWheelConfig.current = value, [])
    // Driving preset
    const driveTorque = useRef<number>(0)
    const driveDemand = useRef<number>(0)
    const driveWheelConfig = useRef<DriveWheelConfigType | null>(null)
    const setDriveDemand = useCallback((value: number) => driveDemand.current = value, [])
    const setDriveWheelConfig = useCallback((value: DriveWheelConfigType) => driveWheelConfig.current = value, [])
    // Braking preset
    const brakeTorque = useRef<number>(0)
    const brakeDemand = useRef<number>(0)
    const setBrakeDemand = useCallback((value: number) => brakeDemand.current = value, [])

    /**
     * Shape cast preset
     */
    const distFromRayOriginToVehicle = useRef<THREE.Vector3>(new THREE.Vector3())
    const angvelToLinvel = useRef<THREE.Vector3>(new THREE.Vector3())
    const floatingImpulse = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayOrigin = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayRotation = useRef<THREE.Quaternion>(new THREE.Quaternion())
    const rayDirection = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayOriginVel = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayUpAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayFWDAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayBWDAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayLeftAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    // const rayShape = useMemo(() => new rapier.Ball(rayShapeR), [rayShapeR])
    // const rayShape = useMemo(() => new rapier.Cylinder(rayRadius, rayRadius), [rayRadius])
    const rayShape = useMemo(() => new rapier.Cylinder(rayShapeH, rayShapeR), [rayShapeH, rayShapeR])
    const rotZ90 = useMemo(() => new THREE.Quaternion().setFromAxisAngle(fixedZAxis, Math.PI / 2), [])
    const shapeRayHit = useRef<ColliderShapeCastHit>(null)
    const rayHit = useRef<RayColliderIntersection>(null)
    const rayCast = useMemo(() => new rapier.Ray(rayOrigin.current, rayDirection.current), [rapier])
    const suspensionToi = useRef<number>(0)
    const rayHitBody = useRef<RapierRigidBody>(null)
    const rayShapeCenter = useRef<THREE.Vector3>(new THREE.Vector3())
    const stableRayHitPoint = useRef<THREE.Vector3>(new THREE.Vector3())
    const targetRayHitPoint = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayHitPointOffset = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayHitPointPosition = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayHitPointVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayHitPointVelOnPlane = useRef<THREE.Vector3>(new THREE.Vector3())
    // const rayHitPointVelOnNormal = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayHitPointNormal = useRef<THREE.Vector3>(new THREE.Vector3())
    const rayHitPointFriction = useRef<number>(0)
    // Reset ray hit when ground detection method changed, to prevent the old hit from affecting the new method's result
    useEffect(() => {
        if (groundDetection === "rayCast") shapeRayHit.current = null
        else rayHit.current = null
    }, [groundDetection])

    /**
     * Moving platform preset
     */
    const massRatio = useRef<number>(1)
    const isOnMovingObject = useRef<boolean>(false)
    const wheelSupportForceMag = useRef<number>(0)
    const wheelSupportImpulse = useRef<THREE.Vector3>(new THREE.Vector3())
    const wheelFrictionImpulse = useRef<THREE.Vector3>(new THREE.Vector3())
    const movingObjectPosition = useRef<THREE.Vector3>(new THREE.Vector3())
    const movingObjectVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
    const movingObjectVelocityOnPlane = useRef<THREE.Vector3>(new THREE.Vector3())
    // const movingObjectVelocityOnUp = useRef<THREE.Vector3>(new THREE.Vector3())
    const movingObjectLinearVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
    const movingObjectAngularVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
    // const movingObjectAngularVelocityValue = useRef<number>(0);
    const distanceFromOriginToObjectPoint = useRef<THREE.Vector3>(new THREE.Vector3())
    const movingObjectAngvelToLinvel = useRef<THREE.Vector3>(new THREE.Vector3())
    const massRatioFallOffCurve = useMemo(() => bakeCurveLUT(massRatioFallOffCurveData.points, massRatioFallOffCurveData.samples ?? 50), [massRatioFallOffCurveData]);

    /**
     * Wheel ref preset and handles
     */
    const shapeCastWheelRef = useRef<THREE.Group>(null)
    const modelRef = useRef<THREE.Group>(null)
    const wheelRef = useRef<THREE.Group>(null)
    const worldPos = useRef<THREE.Vector3>(new THREE.Vector3())
    const worldQuat = useRef<THREE.Quaternion>(new THREE.Quaternion())
    useImperativeHandle(ref, () => shapeCastWheelRef.current!, []);

    /**
     * Register wheel information
     */
    const wheelId = useMemo(() => String(props.id ?? generateUUID()), [props.id]);
    const wheelInfo = useRef<WheelInfoType>({
        // wheel base info
        id: wheelId,
        name,
        enable,
        debug,

        // Shapecast local info
        rayShapeR,
        rayShapeH,
        rayLength,
        springK,
        dampingC,

        // Steer wheel setups
        steerInvert,
        steerWheel,

        // Drive wheel setups
        driveInvert,
        driveWheel,
        driveTorqueWeight,

        // Brake wheel setups
        brakeWheel,
        maxBrakeTorque,

        // Wheel rolling resistance setups
        rollingResistanceCoef,

        // Trie grip setups
        lowVelThreshold,
        tireGripFactor,
        lngFrictionEllipseScale,
        latFrictionEllipseScale,
        relaxLngRate,
        relaxLatRate,
        minLngRelaxCoeff,
        minLatRelaxCoeff,

        // Moving platform setups
        followPlatform,
        applyCounterMass,
        applyCounterFriction,

        // Wheel model setups
        showWheelModel,
        wheelModelDensity,
        wheelModelUpdate,
        wheelModelRadius,
        wheelModelLerpPosRate,
        wheelModelReversRotation,

        // Debugger setups
        debuggerArrowScale,

        // Ray updated values
        rayPos: new THREE.Vector3(),
        rayDir: new THREE.Vector3(),
        rayRot: new THREE.Quaternion(),
        rayUpDir: new THREE.Vector3(),
        rayFwdDir: new THREE.Vector3(),
        rayLeftDir: new THREE.Vector3(),
        floatImp: new THREE.Vector3(),
        rayHit: null,
        rayHitBody: null,
        rayHitPos: new THREE.Vector3(),
        rayHitNormal: new THREE.Vector3(),
        rayHitFriciton: 0,
        rayOriginVel: new THREE.Vector3(),
        rayHitPointVel: new THREE.Vector3(),
        isOnPlatform: false,

        // Friction update info
        lngSlipRatio: 0,
        latSlipRatio: 0,
        slipStrength: 0,
        lngAxis: new THREE.Vector3(),
        latAxis: new THREE.Vector3(),
        lngFricImp: new THREE.Vector3(),
        latFricImp: new THREE.Vector3(),

        // Wheel update info
        effInertia: 0,
        supPos: new THREE.Vector3(),
        steerAngle: 0,
        driveTorque: 0,
        brakeTorque: 0,
        wheelLinVel: 0,
        wheelAngVel: 0,

        // Control setter functions
        setDriveDemand,
        setBrakeDemand,
        setSteerDemand,
        setDriveWheelConfig,
        setSteerWheelConfig,
    })
    wheelInfo.current.driveWheel = driveWheel
    wheelInfo.current.driveTorqueWeight = driveTorqueWeight
    wheelInfo.current.steerWheel = steerWheel

    /**
     * Register the wheel to vehicle on mount, and unregister on unmount
     */
    useEffect(() => {
        vehicleValue?.regWheel(wheelInfo)
        return () => vehicleValue?.unregWheel(wheelId)
    }, [vehicleValue, wheelId, driveWheel, driveTorqueWeight, steerWheel])

    /**
     * Debug indicators preset
     */
    // Forward indicator
    const forwardIndicatorRef = useRef<THREE.Group>(null)

    // Floating shape caset indicator
    const rayHitPointRef = useRef<THREE.Mesh>(null)

    // Axis helper points
    const xAxisPointRef = useRef<THREE.Mesh>(null)
    const yAxisPointRef = useRef<THREE.Mesh>(null)
    const zAxisPointRef = useRef<THREE.Mesh>(null)

    // Arrow helpers
    const currFloatArrowRef = useRef<THREE.ArrowHelper>(null)
    const currFloatArrowDir = useRef<THREE.Vector3>(new THREE.Vector3());
    const currDriftArrowRef = useRef<THREE.ArrowHelper>(null)
    const currDriftArrowDir = useRef<THREE.Vector3>(new THREE.Vector3());
    const currEngineArrowRef = useRef<THREE.ArrowHelper>(null)
    const currEngineArrowDir = useRef<THREE.Vector3>(new THREE.Vector3());

    // Debug indicators geo/mat/mesh
    const debugAssets = useMemo(() => {
        if (!debug) return null;

        return {
            forwardRingGeo: new THREE.RingGeometry(rayShapeH * 1.6, rayShapeH * 2, 12),
            forwardPointerGeo: new THREE.PlaneGeometry(rayShapeH, rayShapeH),
            forwardIndicatorMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_AZURE, side: THREE.DoubleSide }),

            rayCastGeo: new THREE.CircleGeometry(rayShapeH * 0.5, 12),
            rayCastHalfGeo: new THREE.CylinderGeometry(rayShapeR, rayShapeR, rayShapeH * 2, 12, 1, true, 0, -Math.PI),
            rayCastMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_MED_PURPLE, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
            standingGeo: new THREE.OctahedronGeometry(rayShapeH * 0.5, 3),
            standingMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_PURPLE, transparent: true, opacity: 0.5 }),

            xAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_GREEN, transparent: true, opacity: 1 }),
            yAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_BLUE, transparent: true, opacity: 1 }),
            zAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_RED, transparent: true, opacity: 1 }),
        };
    }, [debug, rayShapeR, rayShapeH]);

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
     */

    /**
     * Update vehicle/wheel info function 
     * (needs to recompute vehicle's info for each wheel, to gain the most updated info)
     */
    const updateVehicleInfo = useCallback((body: RapierRigidBody) => {
        vehiclePos.current.copy(body.translation());
        vehicleQuat.current.copy(body.rotation())
        vehicleMatrix.current.compose(vehiclePos.current, vehicleQuat.current, fixedScale)

        vehicleYAxis.current.set(0, 1, 0).applyQuaternion(vehicleQuat.current);
        vehicleXAxis.current.set(1, 0, 0).applyQuaternion(vehicleQuat.current);
        vehicleZAxis.current.set(0, 0, 1).applyQuaternion(vehicleQuat.current);

        vehicleLinVel.current.copy(body.linvel())
        vehicleAngVel.current.copy(body.angvel())

        wheelInfo.current.rayPos = rayOrigin.current
        wheelInfo.current.rayDir = rayDirection.current
        wheelInfo.current.rayRot = rayRotation.current
        wheelInfo.current.rayUpDir = rayUpAxis.current
        wheelInfo.current.rayFwdDir = rayFWDAxis.current
        wheelInfo.current.rayLeftDir = rayLeftAxis.current
        wheelInfo.current.rayHit = groundDetection === "rayCast" ? rayHit.current : shapeRayHit.current
        wheelInfo.current.rayHitBody = rayHitBody.current
        wheelInfo.current.rayHitPos = rayHitPointPosition.current
        wheelInfo.current.rayHitNormal = rayHitPointNormal.current
        wheelInfo.current.rayHitFriciton = rayHitPointFriction.current
        wheelInfo.current.rayOriginVel = rayOriginVel.current
        wheelInfo.current.rayHitPointVel = rayHitPointVelocity.current
        wheelInfo.current.isOnPlatform = isOnMovingObject.current
        wheelInfo.current.floatImp = floatingImpulse.current

        wheelInfo.current.lngSlipRatio = lngSlipRatio.current
        wheelInfo.current.latSlipRatio = latSlipRatio.current
        wheelInfo.current.slipStrength = slipStrength.current
        wheelInfo.current.lngAxis = lngAxis.current
        wheelInfo.current.latAxis = latAxis.current
        wheelInfo.current.lngFricImp = lngFrictionImp.current
        wheelInfo.current.latFricImp = latFrictionImp.current

        wheelInfo.current.effInertia = effectiveInertia.current
        wheelInfo.current.supPos = supportPoint.current
        wheelInfo.current.steerAngle = steerAngle.current
        wheelInfo.current.driveTorque = driveTorque.current
        wheelInfo.current.brakeTorque = brakeTorque.current
        wheelInfo.current.wheelAngVel = wheelAngVel.current
        wheelInfo.current.wheelLinVel = wheelAngVel.current * rayShapeR
    }, [groundDetection, rayShapeR])

    /**
     * Compute ray hit point relative velocity
     */
    const computeRelativeVelocity = useCallback(() => {
        rayHitPointVelocity.current.copy(rayOriginVel.current)
        rayHitPointVelOnPlane.current.copy(rayHitPointVelocity.current).projectOnPlane(rayHitPointNormal.current)
        if (isOnMovingObject.current && followPlatform) {
            rayHitPointVelocity.current.sub(movingObjectVelocity.current)
            rayHitPointVelOnPlane.current.sub(movingObjectVelocityOnPlane.current)
        }
    }, [followPlatform])

    /**
     * Update shape cast info
     */
    const updateShapeCastDir = useCallback(() => {
        if (!shapeCastWheelRef.current) return

        // Steer and gather world pos/quat
        if (steerWheel) shapeCastWheelRef.current.rotateY(steerIncrement.current)
        shapeCastWheelRef.current.getWorldPosition(worldPos.current)
        shapeCastWheelRef.current.getWorldQuaternion(worldQuat.current)

        // Update shape cast current info: pos/dir/vel
        rayOrigin.current.copy(worldPos.current)
        rayDirection.current.set(0, -1, 0).applyQuaternion(worldQuat.current)
        rayUpAxis.current.copy(rayDirection.current).negate();
        rayFWDAxis.current.set(0, 0, 1).applyQuaternion(worldQuat.current)
        rayBWDAxis.current.copy(rayFWDAxis.current).negate();
        rayLeftAxis.current.crossVectors(rayUpAxis.current, rayFWDAxis.current).normalize();

        // Ray velocity combind with linvel and angvel
        distFromRayOriginToVehicle.current.copy(rayOrigin.current).sub(vehiclePos.current)
        angvelToLinvel.current.crossVectors(vehicleAngVel.current, distFromRayOriginToVehicle.current)
        rayOriginVel.current.copy(vehicleLinVel.current).add(angvelToLinvel.current)

        // // Update shape cast current info: pos/dir/vel
        // rayOrigin.current.copy(initPos).applyMatrix4(vehicleMatrix.current)
        // rayDirection.current.copy(initRayDir).applyQuaternion(vehicleQuat.current)
        // // Ray velocity combind with linvel and angvel
        // distFromRayOriginToVehicle.current.copy(rayOrigin.current).sub(vehiclePos.current)
        // angvelToLinvel.current.crossVectors(vehicleAngVel.current, distFromRayOriginToVehicle.current)
        // rayOriginVel.current.copy(vehicleLinVel.current).add(angvelToLinvel.current)

        // // Update shape cast current direciton
        // rayUpAxis.current.copy(rayDirection.current).negate()
        // rayFWDAxis.current.copy(initRayFWD).applyQuaternion(vehicleQuat.current).projectOnPlane(rayUpAxis.current).normalize()
        // if (steerWheel) rayFWDAxis.current.applyAxisAngle(rayUpAxis.current, steerAngle.current);
        // rayBWDAxis.current.copy(rayFWDAxis.current).negate();
        // rayRWDAxis.current.crossVectors(rayFWDAxis.current, rayUpAxis.current).normalize();
    }, [steerWheel])

    /**
     * Floating function
     */
    const ecctrlVehicleRayFilter = useCallback((collider: Collider) => {
        const userData = collider.parent?.()?.userData as EcctrlUserDataType | undefined
        return !(userData?.ecctrl?.excludeRay || userData?.ecctrl?.excludeVehicleRay)
    }, [])

    const floatVehicle = useCallback((body: RapierRigidBody) => {
        // Cast wheel detection shape
        if (groundDetection === "rayCast") {
            rayHit.current = world.castRayAndGetNormal(
                rayCast,
                rayLength + rayShapeR,
                false,
                QueryFilterFlags.EXCLUDE_SENSORS,
                undefined,
                undefined,
                body,
                ecctrlVehicleRayFilter
            );
        } else {
            shapeRayHit.current = world.castShape(
                rayOrigin.current,
                rayRotation.current.copy(worldQuat.current).multiply(rotZ90),
                rayDirection.current,
                rayShape,
                0,
                rayLength,
                false,
                QueryFilterFlags.EXCLUDE_SENSORS,
                undefined,
                undefined,
                body,
                ecctrlVehicleRayFilter
            );
        }

        // Retrieve ray hit collider and distance
        const hitCollider = groundDetection === "rayCast" ? rayHit.current?.collider : shapeRayHit.current?.collider
        const hitDistance = groundDetection === "rayCast" ? rayHit.current?.timeOfImpact : shapeRayHit.current?.time_of_impact

        // Detect below objects and compute floating force
        if (hitCollider && hitDistance != null) {
            suspensionToi.current = groundDetection === "rayCast" ? Math.max(0, hitDistance - rayShapeR) : hitDistance
            // Retrieve ray hit body
            rayHitBody.current = hitCollider.parent()
            // Retrieve raw ray hit point
            if (groundDetection === "rayCast") targetRayHitPoint.current.copy(rayOrigin.current).addScaledVector(rayDirection.current, hitDistance)
            else targetRayHitPoint.current.copy(shapeRayHit.current!.witness1) // actual rayhit point
            // Retrieve ray hit point normal
            rayHitPointNormal.current.copy(groundDetection === "rayCast" ? rayHit.current!.normal : shapeRayHit.current!.normal1).normalize()
            // Compute shape center at suspension hit distance
            rayShapeCenter.current.copy(rayOrigin.current).addScaledVector(rayDirection.current, suspensionToi.current)
            // Compute stable center-section hit point
            let supportOffset = 0
            if (groundDetection === "rayCast") {
                stableRayHitPoint.current.copy(targetRayHitPoint.current)
            } else {
                // Project the raw witness back to the wheel center section.
                const rawOffset = clamp(rayHitPointOffset.current.copy(targetRayHitPoint.current).sub(rayShapeCenter.current).dot(rayLeftAxis.current), -rayShapeH, rayShapeH)
                stableRayHitPoint.current.copy(targetRayHitPoint.current).addScaledVector(rayLeftAxis.current, -rawOffset)

                // Blend side support only when normal shows side contact.
                const normalSide = rayHitPointNormal.current.dot(rayLeftAxis.current)
                const normalFwd = rayHitPointNormal.current.dot(rayFWDAxis.current)
                const sideWeight = clamp(Math.abs(normalSide) / Math.sqrt(Math.max(1 - normalFwd * normalFwd, 1e-6)), 0, 1)
                supportOffset = -Math.abs(rawOffset) * Math.sign(normalSide) * sideWeight
            }
            // Compute final friction point and support point
            rayHitPointPosition.current.copy(stableRayHitPoint.current).addScaledVector(rayLeftAxis.current, supportOffset)
            supportPoint.current.copy(rayShapeCenter.current).addScaledVector(rayLeftAxis.current, supportOffset)
            // Retrieve ray hit point friction
            if (rayHitPointFriction.current !== hitCollider.friction())
                rayHitPointFriction.current = hitCollider.friction() ?? 0
            // Compute spring and damping force
            const springForce = springK * Math.max(0, rayLength - suspensionToi.current);
            const dampingForce = dampingC * rayHitPointVelocity.current.dot(rayUpAxis.current);
            // Compute needed floating force
            floatingImpulse.current.copy(rayHitPointNormal.current).multiplyScalar(springForce - dampingForce).multiplyScalar(world.timestep);
        } else {
            // Reset contact state when no hit
            rayHitBody.current = null
            suspensionToi.current = 0
            rayHitPointFriction.current = 0
            floatingImpulse.current.set(0, 0, 0)
        }
    }, [groundDetection, rayCast, rayShape, rayLength, rayShapeR, rayShapeH, springK, dampingC, ecctrlVehicleRayFilter])

    /**
     * Detect is on a moving object
     */
    const isOnMovingObjectDetect = useCallback((body: RapierRigidBody) => {
        // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
        if (followPlatform && rayHitBody.current && (rayHitBody.current.bodyType() === 0 || rayHitBody.current.bodyType() === 2)) {
            isOnMovingObject.current = true;

            // Find the proper rigid body mass ratio
            if (rayHitBody.current.bodyType() === 0) {
                const ratio = clamp(rayHitBody.current.mass() / Math.max(body.mass(), 1e-6), 0, 1)
                massRatio.current = evaluateCurveLUT(ratio, massRatioFallOffCurve);
            } else {
                massRatio.current = 1
            }

            // Calculate distance between rayOrigin and moving object
            movingObjectPosition.current.copy(rayHitBody.current.translation())
            distanceFromOriginToObjectPoint.current.copy(rayOrigin.current).sub(movingObjectPosition.current);
            // Moving object linear velocity
            movingObjectLinearVelocity.current.copy(rayHitBody.current.linvel())
            // Moving object angular velocity
            movingObjectAngularVelocity.current.copy(rayHitBody.current.angvel())

            // Combine object linear velocity and angular velocity to movingObjectVelocity
            movingObjectAngvelToLinvel.current.crossVectors(movingObjectAngularVelocity.current, distanceFromOriginToObjectPoint.current)
            movingObjectVelocity.current.copy(movingObjectLinearVelocity.current).add(movingObjectAngvelToLinvel.current).multiplyScalar(massRatio.current)
            movingObjectVelocityOnPlane.current.copy(movingObjectVelocity.current).projectOnPlane(rayHitPointNormal.current)
        } else {
            isOnMovingObject.current = false;
            movingObjectVelocity.current.set(0, 0, 0);
            movingObjectVelocityOnPlane.current.set(0, 0, 0)
            massRatio.current = 1
        }
    }, [followPlatform, massRatioFallOffCurve])

    /**
     * Apply wheel mass on standing collider
     */
    const applyMassOnStandCollider = useCallback(() => {
        // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
        if (!rayHitBody.current || rayHitBody.current.bodyType() !== 0 || !applyCounterMass) return
        wheelSupportImpulse.current.copy(rayHitPointNormal.current).multiplyScalar(-1 * wheelSupportForceMag.current * world.timestep * massRatio.current)
        if (wheelSupportForceMag.current > 0) rayHitBody.current.applyImpulseAtPoint(wheelSupportImpulse.current, rayHitPointPosition.current, true);
    }, [applyCounterMass])

    /**
     * Apply tire friction on standing collider
     */
    const applyFricitonOnStandCollider = useCallback(() => {
        // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
        if (!rayHitBody.current || rayHitBody.current.bodyType() !== 0 || !applyCounterFriction) return
        wheelFrictionImpulse.current.addVectors(lngFrictionImp.current, latFrictionImp.current).multiplyScalar(-1 * massRatio.current)
        if (wheelFrictionImpulse.current.lengthSq() > 1e-4) rayHitBody.current.applyImpulseAtPoint(wheelFrictionImpulse.current, rayHitPointPosition.current, true);
    }, [applyCounterFriction])

    /**
     * Handle user input function
     */
    const handleUserInput = useCallback(() => {
        const currDriveConfig = driveWheelConfig.current
        const currSteerConfig = steerWheelConfig.current

        // Compute drive torque based on drive demand, max drive torque, drive ratio, reverse scale and engine torque curve (based on current wheel angular velocity)
        if (driveWheel && currDriveConfig && currDriveConfig.maxDriveTorque !== 0) {
            const maxAngVel = currDriveConfig.maxWheelAngVel * (driveDemand.current < 0 ? currDriveConfig.reverseRPMScale : 1)
            const angvelRatio = maxAngVel > 0 ? Math.abs(wheelAngVel.current) / maxAngVel : 1
            driveTorque.current = driveDemand.current
                * currDriveConfig.maxDriveTorque
                * currDriveConfig.driveRatio
                * (driveDemand.current < 0 ? currDriveConfig.reverseTorqueScale : 1)
                * evaluateCurveLUT(angvelRatio, currDriveConfig.engineTorqueCurve)
                * (driveInvert ? -1 : 1)
        }

        // Compute target steer angle based on speedRatio, steer demand, max steer angle and steer angle curve (based on current vehicle forward speed)
        if (steerWheel && currSteerConfig) {
            const steerMaxWheelAngVel = currSteerConfig?.maxWheelAngVel ?? 0
            const speedRatio = steerMaxWheelAngVel > 0 ? clamp(vehicleLinVel.current.dot(vehicleZAxis.current) / (steerMaxWheelAngVel * rayShapeR), 0, 1) : 0
            steerTarget.current = steerDemand.current * currSteerConfig.maxSteerAngle * evaluateCurveLUT(speedRatio, currSteerConfig.steerAngleCurve) * (steerInvert ? -1 : 1)
        }

        // For brake, simply apply max brake torque based on brake demand
        if (brakeWheel) {
            brakeTorque.current = brakeDemand.current * maxBrakeTorque
        }
    }, [driveWheel, driveInvert, maxBrakeTorque, steerWheel, steerInvert])

    /**
     * Steering wheel function
     */
    const steeringWheel = useCallback(() => {
        // Compute proper increment
        const angleDiff = steerTarget.current - steerAngle.current;
        const maxIncrement = (steerWheelConfig.current?.steerRate ?? 0) * world.timestep;
        steerIncrement.current = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxIncrement);

        // Apply increment
        steerAngle.current += steerIncrement.current
    }, [steerWheelConfig])

    /**
     * Compute friction coefficient based on contact surface friction and tire grip factor
     */
    const computeContactFriction = useCallback(() => {
        if (rayHitBody.current) frictionCoef.current = Math.max((rayHitPointFriction.current + tireGripFactor) * 0.5, 0)
        else frictionCoef.current = 0
    }, [tireGripFactor])

    /**
     * Compute longitudinal and lateral friction impulses based on wheel slip and contact conditions
     */
    const computeWheelFrictionImpulse = useCallback((gravityMag: number) => {
        // Early exit if no contact, no need to compute friction
        if (!rayHitBody.current) {
            wheelSupportForceMag.current = wheelMass * gravityMag
            effectiveInertia.current = wheelInertia + (wheelSupportForceMag.current / gravityMag) * rayShapeR * rayShapeR;
            lngSlipRatio.current = 0
            latSlipRatio.current = 0
            slipStrength.current = 0
            return
        }

        // Compute wheel support force magnitude from floating impulse
        const floatingImpMag = Math.max(floatingImpulse.current.dot(rayHitPointNormal.current), 0)
        wheelSupportForceMag.current = floatingImpMag / world.timestep

        // Based on the support force, compute the effective inertia of the wheel
        effectiveInertia.current = wheelInertia + (wheelSupportForceMag.current / gravityMag) * rayShapeR * rayShapeR;

        // Retrieve longitudinal and lateral axis on the contact plane
        lngAxis.current.copy(rayFWDAxis.current).projectOnPlane(rayHitPointNormal.current).normalize()
        latAxis.current.copy(rayLeftAxis.current).projectOnPlane(rayHitPointNormal.current).normalize()
        // Compute contact point longitudinal and lateral velocity
        const lngContactVel = rayHitPointVelocity.current.dot(lngAxis.current)
        const latContactVel = rayHitPointVelocity.current.dot(latAxis.current)
        const lngContactVelAbs = Math.abs(lngContactVel)
        const latContactVelAbs = Math.abs(latContactVel)
        // Compute wheel linear and slip velocity at the contact point
        const wheelLinVel = wheelAngVel.current * rayShapeR
        const slipDiff = wheelLinVel - lngContactVel;
        const slipDiffAbs = Math.abs(slipDiff)

        // Compute slip ratios and slip values from slip curves LUT
        lngSlipRatio.current = slipDiffAbs / Math.max(lngContactVelAbs, 1e-4)
        latSlipRatio.current = (latContactVelAbs === 0 && lngContactVelAbs === 0) ? 0 : clamp(Math.atan2(latContactVelAbs, lngContactVelAbs) / (Math.PI / 2), 0, 1)
        slipStrength.current = Math.max(lngSlipRatio.current, latSlipRatio.current)
        const lngSlipValue = evaluateCurveLUT(lngSlipRatio.current, lngSlipRatioCurve)
        const latSlipValue = evaluateCurveLUT(latSlipRatio.current, latSlipRatioCurve)

        // Static friction condition at low speed
        const lngStaticWeight = clamp(1.0 - Math.max(slipDiffAbs, lngContactVelAbs) / lowVelThreshold, 0, 1);
        const finalLngSlipValue = remap(lngStaticWeight, 0, 1, lngSlipValue, 1)
        const latStaticWeight = clamp(1.0 - Math.max(latContactVelAbs, lngContactVelAbs) / lowVelThreshold, 0, 1);
        const finalLatSlipValue = remap(latStaticWeight, 0, 1, latSlipValue, 1)

        // Form the friction ellipse based on slip values, 
        // to get the max allowed friction impulse in longitudinal and lateral direction
        const maxLngImp = wheelSupportForceMag.current * finalLngSlipValue * frictionCoef.current * world.timestep * lngFrictionEllipseScale
        const maxLatImp = wheelSupportForceMag.current * finalLatSlipValue * frictionCoef.current * world.timestep * latFrictionEllipseScale

        // Compute desired longitudinal and lateral friction impulse based on slip and speed
        desiredLngImpulse.current = slipDiff * effectiveInertia.current / (rayShapeR * rayShapeR)
        desiredLatImpulse.current = latContactVel * (wheelSupportForceMag.current / gravityMag)

        // Clamp the desired friction impulse within the friction ellipse
        const ellipseUsage = Math.sqrt(desiredLngImpulse.current / maxLngImp * desiredLngImpulse.current / maxLngImp + desiredLatImpulse.current / maxLatImp * desiredLatImpulse.current / maxLatImp);
        if (ellipseUsage > 1.0) {
            desiredLngImpulse.current /= ellipseUsage;
            desiredLatImpulse.current /= ellipseUsage;
        }

        // Keep low-speed tires responsive while still allowing speed-based relaxation.
        let lngCoeff = clamp(Math.max(minLngRelaxCoeff, (lngContactVelAbs / Math.max(relaxLngRate, 1e-6)) * world.timestep), 0, 1);
        let latCoeff = clamp(Math.max(minLatRelaxCoeff, (latContactVelAbs / Math.max(relaxLatRate, 1e-6)) * world.timestep), 0, 1);
        smoothedLngImpulse.current += (desiredLngImpulse.current - smoothedLngImpulse.current) * lngCoeff;
        smoothedLatImpulse.current += (desiredLatImpulse.current - smoothedLatImpulse.current) * latCoeff;

        // Apply the friction impulse to the wheel and the contacted body
        lngFrictionImp.current.copy(lngAxis.current).multiplyScalar(smoothedLngImpulse.current)
        latFrictionImp.current.copy(latAxis.current).multiplyScalar(-smoothedLatImpulse.current)
    }, [wheelMass, wheelInertia, rayShapeR, lowVelThreshold, lngSlipRatioCurve, latSlipRatioCurve, lngFrictionEllipseScale, latFrictionEllipseScale, relaxLngRate, relaxLatRate, minLngRelaxCoeff, minLatRelaxCoeff])

    /**
     * Solve wheel rotation based on drive/brake torque and friction torque
     */
    const solveWheelRotation = useCallback(() => {
        // Define wheel state
        const isDriving = driveWheel && Math.abs(driveTorque.current) > 0 && rayHitBody.current
        const isBraking = brakeWheel && Math.abs(brakeTorque.current) > 0 && rayHitBody.current
        const isFreeRolling = !isDriving && !isBraking

        // Friction reaction torque
        if (rayHitBody.current) wheelAngVel.current -= (lngFrictionImp.current.dot(lngAxis.current) * rayShapeR) / effectiveInertia.current;

        // Rolling resistance
        if ((rayHitBody.current && isFreeRolling) || (!rayHitBody.current && wheelAngVel.current !== 0)) {
            const rollingResistTorque = -rollingResistanceCoef * wheelSupportForceMag.current * wheelAngVel.current;
            wheelAngVel.current += rollingResistTorque / effectiveInertia.current * world.timestep
        }

        // Engine torque
        if (isDriving && !isBraking) wheelAngVel.current += driveTorque.current / effectiveInertia.current * world.timestep

        // Brake torque
        if (isBraking) {
            const appliedBrakeTorque = brakeTorque.current * -Math.sign(wheelAngVel.current);
            wheelAngVel.current += Math.min(
                Math.abs(wheelAngVel.current),
                Math.abs(appliedBrakeTorque / effectiveInertia.current) * world.timestep
            ) * -Math.sign(wheelAngVel.current)
        }
    }, [rollingResistanceCoef, effectiveInertia, driveTorque, brakeTorque, rayShapeR, driveWheel, brakeWheel])

    /**
     * Update wheel models
     */
    const updateWheelModel = useCallback(() => {
        if (!wheelRef.current || !modelRef.current || !wheelModelUpdate) return
        // Update with suspension bouncing position
        const hasContact = groundDetection === "rayCast" ? rayHit.current : shapeRayHit.current
        const offsetY = hasContact ? -(rayLength + rayShapeR) + wheelModelRadius + (rayLength - suspensionToi.current) : -(rayLength + rayShapeR) + wheelModelRadius
        wheelRef.current.position.y = THREE.MathUtils.lerp(wheelRef.current.position.y, offsetY, 1 - Math.exp(-wheelModelLerpPosRate * world.timestep))
        // Update with wheel rotation
        modelRef.current.rotation.x += wheelAngVel.current * world.timestep * (wheelModelReversRotation ? -1 : 1)
    }, [groundDetection, wheelModelRadius, rayLength, rayShapeR, wheelModelLerpPosRate, rayLength, rayShapeR])

    /**
     * Update debug indicators
     */
    const updateDebugger = useCallback(() => {
        const hasContact = groundDetection === "rayCast" ? rayHit.current : shapeRayHit.current
        vehicleInvertQuat.current.copy(vehicleQuat.current).invert()
        vehicleInvertMatrix.current.copy(vehicleMatrix.current).invert()

        // Floating shape cast ray hit point indicator
        if (rayHitPointRef.current) rayHitPointRef.current.position.copy(rayHitPointPosition.current).applyMatrix4(vehicleInvertMatrix.current)

        if (!shapeCastWheelRef.current) return
        // Current floating arrow helper
        if (currFloatArrowRef.current) {
            currFloatArrowRef.current.position.copy(shapeCastWheelRef.current.position)
            currFloatArrowDir.current.copy(rayHitPointNormal.current).applyQuaternion(vehicleInvertQuat.current)
            currFloatArrowRef.current.setDirection(currFloatArrowDir.current)
            const length = hasContact ? wheelSupportForceMag.current * world.timestep * debuggerArrowScale : 0
            currFloatArrowRef.current.setLength(length)
        }
        // Current drifting arrow helper
        if (currDriftArrowRef.current) {
            currDriftArrowRef.current.position.copy(shapeCastWheelRef.current.position)
            currDriftArrowDir.current.copy(latAxis.current).negate().applyQuaternion(vehicleInvertQuat.current)
            currDriftArrowRef.current.setDirection(currDriftArrowDir.current)
            const length = hasContact ? desiredLatImpulse.current * debuggerArrowScale : 0
            currDriftArrowRef.current.setLength(length)
        }
        // Current engine power arrow helper
        if (currEngineArrowRef.current) {
            currEngineArrowRef.current.position.copy(shapeCastWheelRef.current.position)
            currEngineArrowDir.current.copy(lngAxis.current).applyQuaternion(vehicleInvertQuat.current)
            currEngineArrowRef.current.setDirection(currEngineArrowDir.current);
            const length = hasContact ? desiredLngImpulse.current * debuggerArrowScale : 0
            currEngineArrowRef.current.setLength(length)
        }
    }, [groundDetection, debuggerArrowScale])

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
     */

    useFrame(() => {
        // Early exit if no vehicle context or wheel not enabled
        if (!vehicleValue || !enable) return
        const vehicleBody = vehicleValue.body.current
        const vehicleGravityMag = vehicleValue.gravityMag.current

        // Early exit if no vehicle body
        if (!vehicleBody) return

        // Update vehicle info & wheel info
        updateVehicleInfo(vehicleBody)

        // Update shape cast info: pos/dir/axis/vel
        updateShapeCastDir()

        // Handle user input and update drive/brake torque and steer angle
        handleUserInput()

        // Update wheel steering angle based on input
        steeringWheel()

        // Update ray hit info and compute floating impulse
        floatVehicle(vehicleBody)

        // Detect if on a moving object
        isOnMovingObjectDetect(vehicleBody)

        // Apply opposite wheel mass to standing object
        applyMassOnStandCollider()

        // Apply opposite tire friction to standing object
        applyFricitonOnStandCollider()

        // Compute relative ray hit point velocity (with/without moving object)
        computeRelativeVelocity()

        // Compute contact point friction coefficient
        computeContactFriction()

        // Compute tire lng/lat impulse that will applied to the vehicle
        computeWheelFrictionImpulse(vehicleGravityMag)

        // Compute wheel rotation speed based on drive/brake torque and friction impulse, then apply the rotation to wheel angular velocity
        solveWheelRotation()

        // Update wheel models based on the suspension compression and wheel rotation
        updateWheelModel()

        // Update debug indicators   
        if (debug) updateDebugger()
    })

    return (
        <>
            {/* Shape cast wheel */}
            <group ref={shapeCastWheelRef} {...props}>
                {/* Wheel model */}
                {showWheelModel &&
                    <group ref={wheelRef}>
                        <group ref={modelRef}>
                            {children}
                        </group>
                    </group>
                }

                {/* Debug indicators */}
                {debug && debugAssets &&
                    <group>
                        {/* Forward direction indicator */}
                        <group ref={forwardIndicatorRef}>
                            <mesh rotation={[Math.PI / 2, 0, 0]} geometry={debugAssets.forwardRingGeo} material={debugAssets.forwardIndicatorMat} />
                            <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]} position={[0, 0, rayShapeH * 1.6]} geometry={debugAssets.forwardPointerGeo} material={debugAssets.forwardIndicatorMat} />
                        </group>
                        {/* Floating shape cast indicator */}
                        {groundDetection === "shapeCast" &&
                            <group>
                                <mesh rotation={[Math.PI, 0, Math.PI / 2]} geometry={debugAssets.rayCastHalfGeo} material={debugAssets.rayCastMat} />
                                <mesh position={[0, -rayLength, 0]} rotation={[0, 0, Math.PI / 2]} geometry={debugAssets.rayCastHalfGeo} material={debugAssets.rayCastMat} />
                            </group>
                        }
                        {/* Floating ray cast indicator */}
                        {groundDetection === "rayCast" &&
                            <group>
                                <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={debugAssets.rayCastGeo} material={debugAssets.rayCastMat} />
                                <mesh position={[0, -(rayLength + rayShapeR), 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={debugAssets.rayCastGeo} material={debugAssets.rayCastMat} />
                            </group>
                        }
                        {/* Axis pointers indicator */}
                        <group>
                            <mesh ref={xAxisPointRef} position={[1, 0, 0]} geometry={debugAssets.standingGeo} material={debugAssets.xAxisPointMat} />
                            <mesh ref={yAxisPointRef} position={[0, 1, 0]} geometry={debugAssets.standingGeo} material={debugAssets.yAxisPointMat} />
                            <mesh ref={zAxisPointRef} position={[0, 0, 1]} geometry={debugAssets.standingGeo} material={debugAssets.zAxisPointMat} />
                        </group>
                    </group>
                }
            </group>

            {/* Debug indicators */}
            {debug && debugAssets &&
                <group>
                    {/* Shape cast ray hit point debugger*/}
                    <mesh ref={rayHitPointRef} geometry={debugAssets.standingGeo} material={debugAssets.standingMat} />
                    {/* Current floating arrow debugger */}
                    <arrowHelper ref={currFloatArrowRef} args={[undefined, undefined, undefined, COLOR.EC_BLUE]} />
                    {/* Current drifting arrow debugger */}
                    <arrowHelper ref={currDriftArrowRef} args={[undefined, undefined, undefined, COLOR.EC_GREEN]} />
                    {/* Current engine power arrow debugger */}
                    <arrowHelper ref={currEngineArrowRef} args={[undefined, undefined, undefined, COLOR.EC_RED]} />
                </group>
            }
        </>
    )
})

export default React.memo(ShapeCastWheel)

export type DriveWheelConfigType = {
    maxDriveTorque: number
    maxWheelAngVel: number
    engineTorqueCurve: CurveLUT
    reverseTorqueScale: number
    reverseRPMScale: number
    driveRatio: number
}

export type SteerWheelConfigType = {
    steerAngleCurve: CurveLUT
    steerRate: number
    maxSteerAngle: number
    maxWheelAngVel: number
}

export interface WheelInfoType extends Omit<ShapeCastWheelProps, 'id'> {
    id: string

    rayPos: THREE.Vector3
    rayDir: THREE.Vector3
    rayRot: THREE.Quaternion
    rayUpDir: THREE.Vector3
    rayFwdDir: THREE.Vector3
    rayLeftDir: THREE.Vector3
    floatImp: THREE.Vector3,
    rayHit: ColliderShapeCastHit | RayColliderIntersection | null
    rayHitBody: RapierRigidBody | null
    rayHitPos: THREE.Vector3
    rayHitNormal: THREE.Vector3
    rayHitFriciton: number
    rayOriginVel: THREE.Vector3
    rayHitPointVel: THREE.Vector3
    isOnPlatform: boolean

    lngSlipRatio: number
    latSlipRatio: number
    slipStrength: number
    lngAxis: THREE.Vector3
    latAxis: THREE.Vector3
    lngFricImp: THREE.Vector3
    latFricImp: THREE.Vector3

    effInertia: number
    supPos: THREE.Vector3
    steerAngle: number
    driveTorque: number
    brakeTorque: number
    wheelLinVel: number
    wheelAngVel: number

    setDriveDemand?: (value: number) => void
    setBrakeDemand?: (value: number) => void
    setSteerDemand?: (value: number) => void
    setDriveWheelConfig?: (value: DriveWheelConfigType) => void
    setSteerWheelConfig?: (value: SteerWheelConfigType) => void
}

export type ShapeCastWheelProps = ThreeElements['group'] & {
    children?: ReactNode
    debug?: boolean
    enable?: boolean
    name?: string

    // Base setups
    groundDetection?: "shapeCast" | "rayCast"
    rayShapeR?: number
    rayShapeH?: number
    rayLength?: number
    springK?: number
    dampingC?: number

    // Drive wheel setups
    driveInvert?: boolean
    driveWheel?: boolean
    driveTorqueWeight?: number

    // Steer wheel setups
    steerInvert?: boolean
    steerWheel?: boolean

    // Brake wheel setups
    brakeWheel?: boolean
    maxBrakeTorque?: number

    // Rolling resistance setups
    rollingResistanceCoef?: number

    // Trie grip setups
    lowVelThreshold?: number
    tireGripFactor?: number
    lngFrictionEllipseScale?: number
    latFrictionEllipseScale?: number
    relaxLngRate?: number
    relaxLatRate?: number
    minLngRelaxCoeff?: number
    minLatRelaxCoeff?: number
    lngSlipRatioCurveData?: CurveData
    latSlipRatioCurveData?: CurveData

    // Moving platform setups
    followPlatform?: boolean
    massRatioFallOffCurveData?: CurveData
    applyCounterMass?: boolean
    applyCounterFriction?: boolean

    // Wheel model setups
    showWheelModel?: boolean
    wheelModelDensity?: number
    wheelModelUpdate?: boolean
    wheelModelRadius?: number
    wheelModelLerpPosRate?: number
    wheelModelReversRotation?: boolean

    // Debugger setups
    debuggerArrowScale?: number
}
