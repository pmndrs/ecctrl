/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier, type RapierRigidBody, type RigidBodyProps, type RapierCollider, } from "@react-three/rapier";
import React, { useRef, useMemo, type ReactNode, forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import { QueryFilterFlags, type Collider, type ColliderShapeCastHit, type RayColliderIntersection } from "@dimforge/rapier3d-compat";
import { clamp } from "three/src/math/MathUtils.js";
import { useCustomGravity } from "../gravity/useCustomGravity";
import { bakeCurveLUT, evaluateCurveLUT, type CurveData } from "../curves/CurveLUT";
import { createSlerpVec3 } from "../shared/Math";
import type { EcctrlUserDataType, ForwardRefComponent } from "../shared/types";
import type { MovementInput, ReadonlyMovementInput } from "./types";
import * as COLOR from "../shared/constants/Color";

const DEFAULT_CURVE_DATA: CurveData = { points: [{ x: 0, y: 0, r_out: 0 }, { x: 0.5, y: 0, r_in: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 }] }
const Ecctrl: ForwardRefComponent<EcctrlProps, EcctrlHandle> = /* @__PURE__ */ forwardRef<
  EcctrlHandle,
  EcctrlProps
>(({
  children,
  debug = false,
  enable = true,

  // Character setups
  capsuleHalfHeight = 0.3,
  capsuleRadius = 0.3,

  // Forward direction setups
  lockForward = false,
  useCustomForward = false,
  useCharacterUpAxis = false,

  // Custom gravity setups
  enableCustomGravity = false,
  gravityDirLerpSpeed = 6,

  // Base control setups
  maxWalkVel = 2,
  maxRunVel = 5,
  accDeltaTime = 0.2,
  decDeltaTime = 0.2,
  rejectVelFactor = 1,
  moveImpulsePointOffset = 0.5,
  jumpVel = 5,
  jumpDuration = 0.1, // in seconds
  slopeJumpFactor = 0,
  airDragFactor = 0.1,
  slideGripFactor = 0.5,
  fallingGravityScale = 3,
  fallingMaxVel = 20,
  enableToggleRun = true,

  // Floating Ray setups
  groundDetection = "shapeCast",
  slopeMaxAngle = Math.PI / 2.5, // in rad
  floatHeight = 0.2,
  rayOriginOffest = -capsuleHalfHeight,
  rayHitForgiveness = 0.28,
  rayLength = capsuleRadius + 1,
  rayRadius = capsuleRadius / 2,
  springK = 80,
  dampingC = 6,

  // AutoBalance setups
  autoBalance = true,
  autoBalanceSpringK = 0.5,
  autoBalanceDampingC = 0.03,
  autoBalanceSpringOnY = 0.08,
  autoBalanceDampingOnY = 0.006,

  // Moving platform setups
  followPlatform = true,
  massRatioFallOffCurveData = DEFAULT_CURVE_DATA,
  applyCounterMass = true,
  applyCounterJumpImp = true,
  counterJumpImpFactor = 1,
  applyCounterMoveImp = true,
  counterMoveImpFactor = 1,

  // Other rigibody props from parent
  ...props
}, ref) => {
  /**
   * Rapier preset
   */
  const { rapier, world } = useRapier();

  /**
   * Threejs preset
   */
  const { camera } = useThree();

  /**
   * User controls setup
   */
  // Input state preset
  const movementState = useRef<MovementInput>({ forward: false, backward: false, leftward: false, rightward: false, joystick: { x: 0, y: 0 }, run: false, jump: false })
  // Keypress state preset
  const jumpElapsedTime = useRef<number>(0)
  const jumpActive = useRef<boolean>(false)
  const canJumpAgain = useRef<boolean>(true)
  const runActive = useRef<boolean>(false)
  const canRunAgain = useRef<boolean>(false)

  /**
   * Character collider/model preset
   */
  const fixedZero = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const fixedOrigin = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const fixedXAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const fixedYAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const fixedZAxis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const characterRef = useRef<RapierRigidBody>(null)
  const characterYAxis = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const characterXAxis = useRef<THREE.Vector3>(new THREE.Vector3(1, 0, 0));
  const characterZAxis = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 1));
  const characterColliderRef = useRef<RapierCollider>(null);
  const setMovement = useCallback((movement: MovementInput) => {
    if (movement.forward !== undefined) movementState.current.forward = movement.forward;
    if (movement.backward !== undefined) movementState.current.backward = movement.backward;
    if (movement.leftward !== undefined) movementState.current.leftward = movement.leftward;
    if (movement.rightward !== undefined) movementState.current.rightward = movement.rightward;
    if (movement.joystick) {
      movementState.current.joystick!.x = movement.joystick.x;
      movementState.current.joystick!.y = movement.joystick.y;
    }
    if (movement.run !== undefined) movementState.current.run = movement.run;
    if (movement.jump !== undefined) movementState.current.jump = movement.jump;
  }, [])
  const setLockForward = useCallback((lock: boolean) => isLockForward.current = lock, []);
  const setForwardDir = useCallback((dir: THREE.Vector3) => forwardDirection.current.copy(dir), [])
  useImperativeHandle(ref, () => ({
    get body() { return characterRef.current! },
    get collider() { return characterColliderRef.current! },
    get upAxis() { return upAxis.current },
    get gravityDir() { return gravityDir.current },
    get gravityMag() { return referenceGravityMag.current },
    get currPos() { return currentPos.current },
    get currQuat() { return currentQuat.current },
    get currLinVel() { return currentVel.current },
    get currAngVel() { return currentAngVel.current },
    get input() { return movementState.current },
    get inputDir() { return inputDir.current },
    get movingDirection() { return movingDirection.current },
    get relativeVel() { return relativeVel.current },
    get relativeVelOnPlane() { return relativeVelOnPlane.current },
    get relativeVelOnUp() { return relativeVelOnUp.current },
    get moveImpulse() { return moveImpulse.current },
    get floatingImpulse() { return floatingImpulse.current },
    get dragFrictionImpulse() { return dragFrictionImpulse.current },
    get bodyXAxis() { return characterXAxis.current },
    get bodyYAxis() { return characterYAxis.current },
    get bodyZAxis() { return characterZAxis.current },
    get standCollider() { return rayHitBody.current },
    get standPoint() { return standingPoint.current },
    get standNormal() { return actualSlopeNormalVec.current },
    get isOnGround() { return isOnGround.current },
    get isFalling() { return isFalling.current },
    get isOnPlatform() { return isOnMovingObject.current },
    get slopeAngle() { return slopeAngleInFront.current },
    get actualSlopeAngle() { return actualSlopeAngle.current },
    get standFriction() { return standingPointFriction.current },
    get slideFriction() { return slideFrictionCoef.current },
    get isMoving() { return inputDir.current.lengthSq() > 1e-6 },
    get moveSpeed() { return relativeVelOnPlane.current.length() },
    get verticalSpeed() { return relativeVelOnUp.current.dot(referenceUpAxis) },
    get runActive() { return runActive.current },
    get jumpActive() { return jumpActive.current },
    get lockForward() { return isLockForward.current },
    get turnOnYQuat() { return turnOnYQuat.current },
    setMovement,
    setLockForward,
    setForwardDir,
  }), []);

  /**
   * Gravity controls preset
   */
  const gravityField = useCustomGravity((state) => state.gravityField)
  const applyGravityField = useCustomGravity((state) => state.applyGravityField)
  const isZeroGravity = useRef<boolean>(false)
  const upAxis = useRef<THREE.Vector3>(new THREE.Vector3());
  const referenceUpAxis = useMemo(() => useCharacterUpAxis ? characterYAxis.current : upAxis.current, [useCharacterUpAxis])
  const referenceGravity = useRef<THREE.Vector3>(new THREE.Vector3());
  const referenceGravityMag = useRef<number>(0);
  const referenceGravityDir = useRef<THREE.Vector3>(new THREE.Vector3());
  const gravityDir = useRef<THREE.Vector3>(new THREE.Vector3());
  const slerpRef = useRef(createSlerpVec3());

  /**
   * Controls preset
   */
  const relativeVel = useRef<THREE.Vector3>(new THREE.Vector3());
  const relativeVelOnPlane = useRef<THREE.Vector3>(new THREE.Vector3());
  const relativeVelOnUp = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentVel = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentVelOnPlane = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentVelOnUp = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentAngVel = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentAngVelOnPlane = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentAngVelOnUp = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
  // Balance/turning feature preset
  const balanceCrossAxis = useRef<THREE.Vector3>(new THREE.Vector3());
  const turnCrossAxis = useRef<THREE.Vector3>(new THREE.Vector3());
  const turnOnYAxis = useRef<THREE.Vector3>(new THREE.Vector3());
  const turnOnYQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
  // Movement feature preset
  const isLockForward = useRef<boolean>(lockForward);
  const forwardDirection = useRef<THREE.Vector3>(new THREE.Vector3());
  const camRightDirection = useRef<THREE.Vector3>(new THREE.Vector3());
  const rightwardDirection = useRef<THREE.Vector3>(new THREE.Vector3());
  const inputDir = useRef<THREE.Vector3>(new THREE.Vector3());
  const lastInputDir = useRef<THREE.Vector3>(new THREE.Vector3());
  const baseImpulse = useRef<THREE.Vector3>(new THREE.Vector3());
  const moveImpulse = useRef<THREE.Vector3>(new THREE.Vector3());
  const moveImpulsePoint = useRef<THREE.Vector3>(new THREE.Vector3());
  const moveImpulseToGround = useRef<THREE.Vector3>(new THREE.Vector3());
  const movingDirection = useRef<THREE.Vector3>(new THREE.Vector3());
  const movingDirCrossAxis = useRef<THREE.Vector3>(new THREE.Vector3());
  const wantToMoveVel = useRef<THREE.Vector3>(new THREE.Vector3());
  const rejectVel = useRef<THREE.Vector3>(new THREE.Vector3());
  // Jump feature preset
  const isOnGround = useRef<boolean>(false)
  const jumpDirection = useRef<THREE.Vector3>(new THREE.Vector3());
  const jumpVelocityVec = useRef<THREE.Vector3>(new THREE.Vector3());
  const jumpImpulseToGround = useRef<THREE.Vector3>(new THREE.Vector3());
  // Fall preset
  const isFalling = useRef<boolean>(false)
  const initialGravityScale = useRef(props.gravityScale ?? 1)
  // Friction preset
  const dragFrictionImpulse = useRef<THREE.Vector3>(new THREE.Vector3());

  /**
   * Floating shape ray preset
   */
  const springDistVec = useRef<THREE.Vector3>(new THREE.Vector3())
  const dampingVelVec = useRef<THREE.Vector3>(new THREE.Vector3())
  const floatingForce = useRef<THREE.Vector3>(new THREE.Vector3())
  const floatingImpulse = useRef<THREE.Vector3>(new THREE.Vector3())
  const rayOrigin = useRef<THREE.Vector3>(new THREE.Vector3())
  const groundHitOrigin = useRef<THREE.Vector3>(new THREE.Vector3())
  const rayDirection = useRef<THREE.Vector3>(new THREE.Vector3())
  const rayShape = useMemo(() => new rapier.Ball(rayRadius), [rayRadius])
  // const rayShape = useMemo(() => new rapier.Cylinder(rayRadius, rayRadius), [rayRadius])
  const shapeRayHit = useRef<ColliderShapeCastHit>(null)
  const rayHit = useRef<RayColliderIntersection>(null)
  const rayCast = useMemo(() => new rapier.Ray(rayOrigin.current, rayDirection.current), [])
  const castRayHit = useRef<RayColliderIntersection>(null)
  const castShapeHit = useRef<ColliderShapeCastHit>(null)
  const groundHitDistance = useRef<number>(0)
  const groundFloatingDistance = useRef<number>(0)
  const rayHitBody = useRef<RapierRigidBody>(null)
  // Reset ray hit when ground detection method changes to prevent stale hit data
  useEffect(() => {
    if (groundDetection === "rayCast") shapeRayHit.current = null
    else rayHit.current = null
  }, [groundDetection])

  /**
   * Slope detection preset
   */
  const slopeAngleInFront = useRef<number>(0)
  const actualSlopeAngle = useRef<number>(0)
  const actualSlopeNormalVec = useRef<THREE.Vector3>(new THREE.Vector3())

  /**
   * Standing platform preset
   */
  const massRatio = useRef<number>(1)
  const isOnMovingObject = useRef<boolean>(false)
  const slideFrictionCoef = useRef<number>(0);
  const standingPointFriction = useRef<number>(0);
  const standingPoint = useRef<THREE.Vector3>(new THREE.Vector3())
  const characterMassImpulse = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectPosition = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectVelocityOnPlane = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectVelocityOnUp = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectLinearVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectAngularVelocity = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectAngularVelocityValue = useRef<number>(0);
  const movingObjectAngularVelocityAxis = useRef<THREE.Vector3>(new THREE.Vector3())
  const distanceFromCharacterToObjectPoint = useRef<THREE.Vector3>(new THREE.Vector3())
  const movingObjectAngvelToLinvel = useRef<THREE.Vector3>(new THREE.Vector3())
  const massRatioFallOffCurve = useMemo(() => bakeCurveLUT(massRatioFallOffCurveData.points, massRatioFallOffCurveData.samples ?? 50), [massRatioFallOffCurveData]);

  /**
   * Debug indicators preset
   */
  // Look forward indicator
  const forwardIndicatorRef = useRef<THREE.Group>(null)
  const forwardIndicatorMatrix = useRef<THREE.Matrix4>(new THREE.Matrix4())
  // Want to move indicator
  const moveIndicatorRef = useRef<THREE.Group>(null)
  const moveIndicatorMatrix = useRef<THREE.Matrix4>(new THREE.Matrix4())
  // Floating shape caset indicator
  const rayStartRef = useRef<THREE.Mesh>(null)
  const rayEndRef = useRef<THREE.Mesh>(null)
  const rayTriggerRef = useRef<THREE.Mesh>(null)
  const rayStableRef = useRef<THREE.Mesh>(null)
  const standingPointRef = useRef<THREE.Mesh>(null)
  // Axis helper points
  const xAxisPointRef = useRef<THREE.Mesh>(null)
  const yAxisPointRef = useRef<THREE.Mesh>(null)
  const zAxisPointRef = useRef<THREE.Mesh>(null)
  // Arrow helper: current moving velocity
  const currVelArrowRef = useRef<THREE.ArrowHelper>(null)
  const currVelDir = useRef<THREE.Vector3>(new THREE.Vector3());

  // Debug indicators geo/mat/mesh
  const debugAssets = useMemo(() => {
    if (!debug) return null;

    return {
      forwardRingGeo: new THREE.RingGeometry(capsuleRadius * 2, capsuleRadius * 2.1, 32),
      forwardPointerGeo: new THREE.PlaneGeometry(capsuleRadius / 2, capsuleRadius / 2),
      forwardIndicatorMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_AZURE, side: THREE.DoubleSide }),

      rayCastGeo: new THREE.CircleGeometry(groundDetection === "rayCast" ? rayRadius / 2 : rayRadius, 12),
      rayCastMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_PURPLE, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      standingGeo: new THREE.OctahedronGeometry(rayRadius / 2, 3),
      standingMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_MED_PURPLE, transparent: true, opacity: 0.5 }),

      movePointerGeo: new THREE.OctahedronGeometry(capsuleRadius / 3, 0),
      moveRingGeo: new THREE.RingGeometry(capsuleRadius * 1.5, capsuleRadius * 2, 32),
      moveIndicatorMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_BLUE, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),

      modelPointerGeo: new THREE.OctahedronGeometry(capsuleRadius / 3, 0),
      modelRingGeo: new THREE.RingGeometry(capsuleRadius * 1, capsuleRadius * 1.5, 32),
      modelCapGeo: new THREE.SphereGeometry(capsuleRadius, 12, 8, 0, Math.PI, 0),
      modelIndicatorMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_CORNFLOWER_BLUE, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      modelCapMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_CORNFLOWER_BLUE, transparent: true, opacity: 0.5 }),

      xAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_GREEN, transparent: true, opacity: 1 }),
      yAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_BLUE, transparent: true, opacity: 1 }),
      zAxisPointMat: new THREE.MeshBasicMaterial({ color: COLOR.EC_RED, transparent: true, opacity: 1 }),
    };
  }, [debug, capsuleRadius, rayRadius, groundDetection]);

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
   */
  /**
   * Update character collider/model info function
   */
  const updateCharacterInfo = useCallback((body: RapierRigidBody) => {
    currentPos.current.copy(body.translation());
    currentQuat.current.copy(body.rotation())

    characterYAxis.current.set(0, 1, 0).applyQuaternion(currentQuat.current);
    characterXAxis.current.set(1, 0, 0).applyQuaternion(currentQuat.current);
    characterZAxis.current.set(0, 0, 1).applyQuaternion(currentQuat.current);

    currentVel.current.copy(body.linvel())
    currentVelOnPlane.current.copy(currentVel.current).projectOnPlane(referenceUpAxis)
    currentVelOnUp.current.copy(currentVel.current).projectOnVector(referenceUpAxis)

    currentAngVel.current.copy(body.angvel())
    currentAngVelOnPlane.current.copy(currentAngVel.current).projectOnPlane(characterYAxis.current)
    currentAngVelOnUp.current.copy(currentAngVel.current).projectOnVector(characterYAxis.current)
  }, [referenceUpAxis])

  /**
   * Camera project and forward direction function
   */
  const updateForwardDirection = useCallback(() => {
    if (!useCustomForward) {
      camera.getWorldDirection(forwardDirection.current)
      camRightDirection.current.crossVectors(forwardDirection.current, camera.up).normalize();
      forwardDirection.current.crossVectors(referenceUpAxis, camRightDirection.current);
      rightwardDirection.current.crossVectors(forwardDirection.current, referenceUpAxis).normalize();
    } else {
      forwardDirection.current.projectOnPlane(referenceUpAxis).normalize();
      rightwardDirection.current.crossVectors(forwardDirection.current, referenceUpAxis).normalize();
    }
  }, [useCustomForward, referenceUpAxis])

  /**
   * User input function
   */
  const setInputDirection = useCallback((dir: MovementInput) => {
    // Reset inputDir.current
    inputDir.current.set(0, 0, 0)
    // Handle joystick analog input (if available)
    if (dir.joystick && (dir.joystick.x !== 0 || dir.joystick.y !== 0)) {
      inputDir.current
        .addScaledVector(forwardDirection.current, dir.joystick.y)
        .addScaledVector(rightwardDirection.current, dir.joystick.x)
    } else {
      // Apply input direction on to forward direction
      if (dir.forward) inputDir.current.add(forwardDirection.current)
      if (dir.backward) inputDir.current.sub(forwardDirection.current)
      if (dir.leftward) inputDir.current.sub(rightwardDirection.current)
      if (dir.rightward) inputDir.current.add(rightwardDirection.current)
    }
    // Normalize inputDir
    inputDir.current.normalize()
  }, [])

  /**
   * Character moving function
   */
  const moveCharacter = useCallback((body: RapierRigidBody, run: boolean, fpsCorr: number) => {
    /**
     * Setup moving direction base on inputDir and slopeAngleInFront
     */
    movingDirCrossAxis.current.crossVectors(inputDir.current, referenceUpAxis)
    movingDirection.current.copy(inputDir.current).applyAxisAngle(movingDirCrossAxis.current, slopeAngleInFront.current)

    /**
     * Setup rejection velocity
     */
    wantToMoveVel.current.copy(relativeVelOnPlane.current).projectOnVector(inputDir.current);
    rejectVel.current.copy(relativeVelOnPlane.current).sub(wantToMoveVel.current).multiplyScalar(isOnGround.current ? rejectVelFactor : 0)

    /**
     * Calculate required moving impulse: I = m * Δv
     * If it's on a moving/rotating platform, apply platform velocity to Δv accordingly
     * Also, apply reject velocity when character is moving opposite of it's moving direction
     */
    const multiplier = body.mass() * clamp(accDeltaTime, 0, 1) * (isOnGround.current ? slideFrictionCoef.current : airDragFactor) * (actualSlopeAngle.current > slopeMaxAngle ? airDragFactor : 1)
    baseImpulse.current
      .copy(movingDirection.current)
      .multiplyScalar(run ? maxRunVel : maxWalkVel)
      .sub(relativeVelOnPlane.current)
    moveImpulse.current
      .copy(baseImpulse.current)
      .sub(rejectVel.current)
      .multiplyScalar(multiplier)

    // Move character at proper direction and impulse
    moveImpulsePoint.current.copy(currentPos.current).addScaledVector(characterYAxis.current, moveImpulsePointOffset)
    body.applyImpulseAtPoint(moveImpulse.current.multiplyScalar(fpsCorr), moveImpulsePoint.current, true);

    // Apply oppsite moving impulse to the standing point
    // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
    if (applyCounterMoveImp && rayHitBody.current && isOnGround.current && rayHitBody.current.bodyType() === 0) {
      moveImpulseToGround.current.copy(baseImpulse.current).multiplyScalar(multiplier * massRatio.current * counterMoveImpFactor).negate()
      rayHitBody.current.applyImpulseAtPoint(moveImpulseToGround.current.multiplyScalar(fpsCorr), standingPoint.current, true)
    } else {
      moveImpulseToGround.current.set(0, 0, 0)
    }
  }, [referenceUpAxis, rejectVelFactor, maxRunVel, maxWalkVel, accDeltaTime, airDragFactor, slopeMaxAngle, moveImpulsePointOffset, applyCounterMoveImp, counterMoveImpFactor])

  /**
   * Update gravity/upAxis direction and value
   */
  const updateGravityInfo = useCallback((body: RapierRigidBody) => {
    if (enableCustomGravity) {
      referenceGravity.current.copy(gravityField(currentPos.current))
      // Apply custom gravity
      if (!isOnGround.current) applyGravityField(body, world.timestep)
    } else {
      referenceGravity.current.copy(world.gravity)
    }

    referenceGravityMag.current = referenceGravity.current.length()
    referenceGravityDir.current.copy(referenceGravity.current).normalize()
    if (referenceGravityDir.current.lengthSq() === 0) referenceGravityDir.current.copy(characterYAxis.current).negate() // prevent NaN when gravity is zero, just set it to opposite of character up axis
    gravityDir.current.copy(slerpRef.current(gravityDir.current, referenceGravityDir.current, 1 - Math.exp(-gravityDirLerpSpeed * world.timestep), characterXAxis.current))
    upAxis.current.copy(gravityDir.current).negate()
  }, [enableCustomGravity, gravityDirLerpSpeed, gravityField, applyGravityField])

  /**
   * Character auto balance function
   */
  const autoBalanceCharacter = useCallback((body: RapierRigidBody, fpsCorr: number) => {
    balanceCrossAxis.current.crossVectors(characterYAxis.current, upAxis.current);
    const torque = balanceCrossAxis.current.multiplyScalar(autoBalanceSpringK).sub(currentAngVelOnPlane.current.multiplyScalar(autoBalanceDampingC));
    body.applyTorqueImpulse(torque.multiplyScalar(fpsCorr), false);
  }, [autoBalanceSpringK, autoBalanceDampingC])

  /**
   * Character turning function
   */
  const turnCharacter = useCallback((body: RapierRigidBody, direction: THREE.Vector3, fpsCorr: number) => {
    turnCrossAxis.current.crossVectors(characterZAxis.current, direction);
    let dot = clamp(characterZAxis.current.dot(direction), -1, 1);
    if (Math.abs(dot) < 1e-10) dot = 0 // prevent dot=-0
    const angle = Math.atan2(turnCrossAxis.current.dot(characterYAxis.current), dot);
    const torque = turnOnYAxis.current.copy(characterYAxis.current).multiplyScalar(angle * autoBalanceSpringOnY).sub(currentAngVelOnUp.current.multiplyScalar(autoBalanceDampingOnY));
    body.applyTorqueImpulse(torque.multiplyScalar(fpsCorr), false);
  }, [autoBalanceSpringOnY, autoBalanceDampingOnY])

  /**
   * Character floating function
   */
  const ecctrlRayFilter = useCallback((collider: Collider) => {
    const userData = collider.parent?.()?.userData as EcctrlUserDataType | undefined
    return !(userData?.ecctrl?.excludeRay || userData?.ecctrl?.excludeCharacterRay)
  }, [])

  const findWalkableCenterRayHit = useCallback((body: RapierRigidBody, maxDistance: number) => {
    castRayHit.current = null
    rayCast.origin = rayOrigin.current
    rayCast.dir = rayDirection.current

    // Scan center ray for walkable hit
    world.intersectionsWithRay(
      rayCast,
      maxDistance,
      false,
      (hit) => {
        const slopeAngle = actualSlopeNormalVec.current.copy(hit.normal).angleTo(referenceUpAxis)
        if (slopeAngle < slopeMaxAngle && (!castRayHit.current || hit.timeOfImpact < castRayHit.current.timeOfImpact)) {
          castRayHit.current = hit
        }
        return true
      },
      QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      body,
      ecctrlRayFilter
    )

    const selectedRayHit = castRayHit.current as RayColliderIntersection | null
    if (!selectedRayHit) return false

    rayHit.current = selectedRayHit
    rayHitBody.current = selectedRayHit.collider.parent()
    actualSlopeNormalVec.current.copy(selectedRayHit.normal)
    actualSlopeAngle.current = actualSlopeNormalVec.current.angleTo(referenceUpAxis)
    groundHitDistance.current = selectedRayHit.timeOfImpact
    groundFloatingDistance.current = rayRadius * 2 + floatHeight
    groundHitOrigin.current.copy(rayOrigin.current)
    standingPointFriction.current = selectedRayHit.collider.friction() ?? 0
    return true
  }, [rayCast, referenceUpAxis, slopeMaxAngle, ecctrlRayFilter, rayRadius, floatHeight])

  const floatCharacter = useCallback((body: RapierRigidBody) => {
    // Update floating ray origin and direction
    rayOrigin.current.copy(currentPos.current).addScaledVector(characterYAxis.current, rayOriginOffest)
    rayDirection.current.copy(referenceUpAxis).negate()
    // Reset previous hit state
    rayHit.current = null
    shapeRayHit.current = null
    rayHitBody.current = null

    // RayCast ground detection
    if (groundDetection === "rayCast") {
      rayCast.origin = rayOrigin.current
      rayCast.dir = rayDirection.current
      castRayHit.current = world.castRayAndGetNormal(
        rayCast,
        rayLength,
        false,
        QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        body,
        ecctrlRayFilter
      )

      if (castRayHit.current) {
        actualSlopeNormalVec.current.copy(castRayHit.current.normal)
        actualSlopeAngle.current = actualSlopeNormalVec.current.angleTo(referenceUpAxis)
        // Use first walkable ray hit
        if (actualSlopeAngle.current < slopeMaxAngle) {
          rayHit.current = castRayHit.current
          rayHitBody.current = castRayHit.current.collider.parent()
          groundHitOrigin.current.copy(rayOrigin.current)
          groundHitDistance.current = castRayHit.current.timeOfImpact
          groundFloatingDistance.current = rayRadius * 2 + floatHeight
          standingPointFriction.current = castRayHit.current.collider.friction() ?? 0
        }
        // Ignore steep hit and scan center ray below
        else findWalkableCenterRayHit(body, rayLength)
      }
    }
    // ShapeCast ground detection
    else if (groundDetection === "shapeCast") {
      castShapeHit.current = world.castShape(
        rayOrigin.current,
        body.rotation(),
        rayDirection.current,
        rayShape,
        0,
        rayLength,
        false,
        QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        body,
        ecctrlRayFilter
      );

      if (castShapeHit.current) {
        actualSlopeNormalVec.current.copy(castShapeHit.current.normal1);
        actualSlopeAngle.current = actualSlopeNormalVec.current.angleTo(referenceUpAxis);
        // Use first walkable shape hit
        if (actualSlopeAngle.current < slopeMaxAngle) {
          shapeRayHit.current = castShapeHit.current
          groundHitOrigin.current.copy(rayOrigin.current)
          rayHitBody.current = castShapeHit.current.collider.parent()
          groundHitDistance.current = castShapeHit.current.time_of_impact
          groundFloatingDistance.current = rayRadius + floatHeight
          standingPointFriction.current = castShapeHit.current.collider.friction() ?? 0
        } else {
          // Ignore steep hit and scan center ray below
          findWalkableCenterRayHit(body, rayLength + rayRadius)
        }
      }
    }

    // Update ground contact state
    if (rayHitBody.current) {
      isOnGround.current = groundHitDistance.current < groundFloatingDistance.current + rayHitForgiveness

      if (isOnGround.current) {
        // Retrieve actual standing point
        if (rayHit.current) standingPoint.current.copy(groundHitOrigin.current).addScaledVector(rayDirection.current, groundHitDistance.current)
        else if (shapeRayHit.current) standingPoint.current.copy(shapeRayHit.current.witness1)
      } else {
        standingPointFriction.current = 0
      }
    } else {
      rayHitBody.current = null
      isOnGround.current = false
      actualSlopeAngle.current = 0
      slopeAngleInFront.current = 0
      standingPointFriction.current = 0
    }
  }, [rayOriginOffest, referenceUpAxis, groundDetection, rayCast, rayShape, rayLength, rayRadius, floatHeight, rayHitForgiveness, slopeMaxAngle, ecctrlRayFilter, findWalkableCenterRayHit])

  const applyFloatingForce = useCallback((body: RapierRigidBody) => {
    const hasGroundHit = rayHit.current || shapeRayHit.current
    if (!hasGroundHit || !isOnGround.current) {
      floatingImpulse.current.set(0, 0, 0)
      return
    }

    springDistVec.current.copy(referenceUpAxis).multiplyScalar(groundFloatingDistance.current - groundHitDistance.current)
    dampingVelVec.current.copy(relativeVel.current).projectOnVector(referenceUpAxis);
    floatingForce.current.subVectors(springDistVec.current.multiplyScalar(springK), dampingVelVec.current.multiplyScalar(dampingC))
    floatingImpulse.current.copy(floatingForce.current).multiplyScalar(world.timestep); // Convert force to impulse: I = F * dt (already multiply timestep, no need to apply fpsCorr again)
    // During jump startup, keep support force but skip downward adhesion that can cancel slow-motion jumps.
    if (jumpActive.current && floatingImpulse.current.dot(referenceUpAxis) < 0) floatingImpulse.current.set(0, 0, 0)
    if (!body.isSleeping()) body.applyImpulse(floatingImpulse.current, false);
  }, [referenceUpAxis, springK, dampingC])

  /**
   * Character mass on standing collider
   */
  const applyMassOnStandCollider = useCallback((body: RapierRigidBody) => {
    // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
    if (!rayHitBody.current || rayHitBody.current.bodyType() !== 0 || !isOnGround.current) return
    // Apply opposite force to standing object
    const impulseMag = Math.max(-floatingImpulse.current.dot(upAxis.current), 0)
    const weightMag = body.mass() * referenceGravityMag.current * world.timestep // I = F * dt = m * g * dt
    // Gravity is not applied when onGround, so impulseMag is 0 at stable condition, need to apply a constant weightMag
    characterMassImpulse.current.copy(gravityDir.current).multiplyScalar(Math.max(impulseMag, weightMag) * massRatio.current)
    if (applyCounterMass) rayHitBody.current.applyImpulseAtPoint(characterMassImpulse.current, standingPoint.current, true);
  }, [applyCounterMass])

  /**
   * Friction on character function
   */
  const applyFriction = useCallback((body: RapierRigidBody, fpsCorr: number) => {
    if (!rayHitBody.current || !isOnGround.current) return
    // Calculate friction coefficient    
    slideFrictionCoef.current = clamp((standingPointFriction.current + slideGripFactor) * 0.5, 0, 1)
    // Apply friction impulse, I = m * Δv * frictionCoef    
    dragFrictionImpulse.current.copy(relativeVelOnPlane.current).negate().multiplyScalar(body.mass() * slideFrictionCoef.current * clamp(decDeltaTime, 0, 1))
    body.applyImpulse(dragFrictionImpulse.current.multiplyScalar(fpsCorr), false);
  }, [slideGripFactor])

  /**
   * Slope detect function
   */
  const slopeDetect = useCallback(() => {
    const hasGroundHit = rayHit.current || shapeRayHit.current
    if (hasGroundHit) {
      // Actual slope angle from upAxis
      actualSlopeAngle.current = actualSlopeNormalVec.current.angleTo(referenceUpAxis);
      if (isOnGround.current) {
        // Slope angle in front of character moving direction
        slopeAngleInFront.current = -Math.asin(actualSlopeNormalVec.current.dot(inputDir.current))
      } else {
        slopeAngleInFront.current = 0
      }
    } else {
      actualSlopeAngle.current = 0;
      slopeAngleInFront.current = 0
    }
  }, [referenceUpAxis])

  /**
   * Falling detect function
   */
  const fallDetect = useCallback(() => {
    isFalling.current = (currentVelOnUp.current.dot(upAxis.current) < 0 && !isOnGround.current) ? true : false
  }, [])

  /**
   * Zero gravity detect function
   */
  const zeroGravityDetect = useCallback(() => {
    isZeroGravity.current = referenceGravityMag.current === 0
  }, [])

  /**
   * Detect if character is on a moving object
   */
  const isOnMovingObjectDetect = useCallback((body: RapierRigidBody) => {
    // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
    if (followPlatform && rayHitBody.current && isOnGround.current && (rayHitBody.current.bodyType() === 0 || rayHitBody.current.bodyType() === 2)) {
      isOnMovingObject.current = true;

      // Find the proper rigid body mass ratio
      if (rayHitBody.current.bodyType() === 0) {
        const ratio = clamp(rayHitBody.current.mass() / Math.max(body.mass(), 1e-6), 0, 1)
        massRatio.current = evaluateCurveLUT(ratio, massRatioFallOffCurve);
      } else {
        massRatio.current = 1
      }

      // Calculate distance between character and moving object
      movingObjectPosition.current.copy(rayHitBody.current.worldCom())
      distanceFromCharacterToObjectPoint.current.copy(currentPos.current).sub(movingObjectPosition.current);
      // Moving object linear velocity
      movingObjectLinearVelocity.current.copy(rayHitBody.current.linvel())
      // Moving object angular velocity
      movingObjectAngularVelocity.current.copy(rayHitBody.current.angvel())
      // Combine object linear velocity and angular velocity to movingObjectVelocity
      movingObjectAngvelToLinvel.current.crossVectors(movingObjectAngularVelocity.current, distanceFromCharacterToObjectPoint.current)
      movingObjectVelocity.current.copy(movingObjectLinearVelocity.current).addScaledVector(movingObjectAngvelToLinvel.current, massRatio.current)
      movingObjectVelocityOnPlane.current.copy(movingObjectVelocity.current).projectOnPlane(referenceUpAxis)
      movingObjectVelocityOnUp.current.copy(movingObjectVelocity.current).projectOnVector(referenceUpAxis)

      // Compute moving object angular velocity turn quaternion
      movingObjectAngularVelocityValue.current = movingObjectAngularVelocity.current.length()
      movingObjectAngularVelocityAxis.current.copy(movingObjectAngularVelocity.current).normalize()
      turnOnYQuat.current.setFromAxisAngle(movingObjectAngularVelocityAxis.current, movingObjectAngularVelocityValue.current * world.timestep)
    } else {
      isOnMovingObject.current = false;
      movingObjectVelocity.current.set(0, 0, 0);
      movingObjectVelocityOnPlane.current.set(0, 0, 0)
      movingObjectVelocityOnUp.current.set(0, 0, 0)
      turnOnYQuat.current.identity()
      massRatio.current = 1
    }
  }, [followPlatform, referenceUpAxis, massRatioFallOffCurve])

  /**
   * Compute ray hit point relative velocity
   */
  const computeRelativeVelocity = useCallback(() => {
    relativeVel.current.copy(currentVel.current)
    relativeVelOnPlane.current.copy(currentVelOnPlane.current)
    relativeVelOnUp.current.copy(currentVelOnUp.current)
    if (isOnMovingObject.current && followPlatform) {
      relativeVel.current.sub(movingObjectVelocity.current)
      relativeVelOnPlane.current.sub(movingObjectVelocityOnPlane.current)
      relativeVelOnUp.current.sub(movingObjectVelocityOnUp.current)
    }
  }, [followPlatform])

  /**
   * Character jump up impulse function
   */
  const applyJumpImpulse = useCallback((body: RapierRigidBody) => {
    jumpDirection.current.copy(referenceUpAxis).addScaledVector(actualSlopeNormalVec.current, slopeJumpFactor).normalize()
    jumpVelocityVec.current.copy(relativeVelOnPlane.current).add(movingObjectVelocity.current).addScaledVector(jumpDirection.current, jumpVel)
    body.setLinvel(jumpVelocityVec.current, true);
    // Apply oppsite impulse to ground
    if (applyCounterJumpImp && rayHitBody.current && rayHitBody.current.bodyType() === 0) {
      // jumpImpulseToGround.current.copy(characterMassImpulse.current).multiplyScalar(massRatio.current * counterJumpImpFactor)
      jumpImpulseToGround.current.copy(jumpDirection.current).multiplyScalar(-body.mass() * jumpVel * massRatio.current * counterJumpImpFactor)
      rayHitBody.current.applyImpulseAtPoint(jumpImpulseToGround.current, standingPoint.current, true);
    }
  }, [referenceUpAxis, slopeJumpFactor, jumpVel, applyCounterJumpImp, counterJumpImpFactor])

  /**
   * Gravity scale control function
   * zero gravity on ground and extra gravity when falling
   */
  const applyDynamicGravity = useCallback((body: RapierRigidBody) => {
    // Falling condition
    if (isFalling.current) {
      // Exceed fallingMaxVel, change to 0 gravity scale, otherwise apply fallingGravityScale
      if (currentVelOnUp.current.lengthSq() > fallingMaxVel * fallingMaxVel) {
        if (body.gravityScale() !== 0) body.setGravityScale(0, false)
      } else {
        if (body.gravityScale() !== fallingGravityScale) body.setGravityScale(fallingGravityScale, false)
      }
    }
    // Jump up and ground condition
    else {
      // If on ground, stop apply gravity
      if (isOnGround.current) {
        if (body.gravityScale() !== 0) body.setGravityScale(0, false)
      } else {
        if (body.gravityScale() !== initialGravityScale.current) body.setGravityScale(initialGravityScale.current, false)
      }
    }
  }, [fallingMaxVel, fallingGravityScale])

  /**
   * Jump state control function
   */
  const getJumpState = useCallback((jumpPressed: boolean) => {
    // Check if jump is active
    if (jumpActive.current) {
      jumpElapsedTime.current += world.timestep
      // Once jump duration is exceeded, set jump to inactive
      if (jumpElapsedTime.current >= jumpDuration) jumpActive.current = false
    } else {
      // If jump key is pressed and can jump again, set jump to active
      // and set canJumpAgain to false to prevent continuous jumping
      if (jumpPressed && canJumpAgain.current) {
        jumpActive.current = true
        jumpElapsedTime.current = 0
        canJumpAgain.current = false
      }
      // Once jump key is released, allow jumping again
      if (!jumpPressed) canJumpAgain.current = true
    }
    return jumpActive.current
  }, [jumpDuration])

  /**
   * Run state control function
   */
  const getRunState = useCallback((runPressed: boolean) => {
    if (enableToggleRun) {
      // only toggle run state when run key is pressed 
      if (runPressed && !canRunAgain.current) runActive.current = !runActive.current
      // Update canRunAgain state
      canRunAgain.current = runPressed
    } else {
      runActive.current = runPressed
    }
    return runActive.current
  }, [enableToggleRun])

  /**
   * Update debug indicators
   */
  const updateDebugger = useCallback(() => {
    // Look forward direction indicator
    if (forwardIndicatorRef.current) {
      forwardIndicatorRef.current.position.copy(rayOrigin.current)
      forwardIndicatorMatrix.current.lookAt(fixedOrigin, forwardDirection.current, referenceUpAxis)
      forwardIndicatorRef.current.quaternion.setFromRotationMatrix(forwardIndicatorMatrix.current)
    }

    // Floating shape cast indicator
    if (rayStartRef.current && rayEndRef.current && rayTriggerRef.current && rayStableRef.current && standingPointRef.current) {
      const debugStableDistance = groundDetection === "rayCast" ? rayRadius * 2 + floatHeight : rayRadius + groundFloatingDistance.current
      rayStartRef.current.position.copy(rayOrigin.current)
      rayStartRef.current.quaternion.setFromUnitVectors(fixedZAxis, referenceUpAxis)

      rayEndRef.current.position.copy(rayOrigin.current).addScaledVector(referenceUpAxis, -rayLength)
      rayEndRef.current.quaternion.setFromUnitVectors(fixedZAxis, referenceUpAxis)

      rayTriggerRef.current.position.copy(rayOrigin.current).addScaledVector(referenceUpAxis, -debugStableDistance - rayHitForgiveness)
      rayTriggerRef.current.quaternion.setFromUnitVectors(fixedZAxis, referenceUpAxis)

      rayStableRef.current.position.copy(rayOrigin.current).addScaledVector(referenceUpAxis, -debugStableDistance)
      rayStableRef.current.quaternion.setFromUnitVectors(fixedZAxis, referenceUpAxis)

      standingPointRef.current.position.copy(standingPoint.current)
    }

    // Want to move direction indicator
    if (moveIndicatorRef.current) {
      moveIndicatorRef.current.position.copy(rayOrigin.current)
      moveIndicatorMatrix.current.lookAt(fixedOrigin, movingDirection.current, referenceUpAxis)
      moveIndicatorRef.current.quaternion.setFromRotationMatrix(moveIndicatorMatrix.current)
    }

    // Current moving velocity arrow helper
    if (currVelArrowRef.current) {
      currVelArrowRef.current.position.copy(currentPos.current)
      currVelArrowRef.current.setDirection(currVelDir.current.copy(relativeVel.current).normalize())
      currVelArrowRef.current.setLength(relativeVel.current.length() / (runActive.current ? maxRunVel : maxWalkVel))
    }

  }, [fixedOrigin, fixedZAxis, referenceUpAxis, groundDetection, rayLength, rayRadius, floatHeight, rayHitForgiveness, maxRunVel, maxWalkVel])

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
   */

  useFrame(() => {
    // Skip the whole controller loop when disabled
    if (!enable || !characterRef.current) return
    const characterBody = characterRef.current
    let isSleeping = characterBody.isSleeping()

    // Correct frame rate difference
    const frameRateCorrection = 60 * world.timestep

    /**
     * Getting all the user input states
     */
    const forward = movementState.current.forward
    const backward = movementState.current.backward
    const leftward = movementState.current.leftward
    const rightward = movementState.current.rightward
    const run = getRunState(movementState.current.run || false)
    const jump = getJumpState(movementState.current.jump || false)
    const joystick = movementState.current.joystick
    const hasControlInput = forward || backward || leftward || rightward || jump || Math.abs(joystick?.x ?? 0) > 1e-4 || Math.abs(joystick?.y ?? 0) > 1e-4

    // Wake on moving platforms or player input so the controller can refresh contact state before applying impulses.
    if (isSleeping && (isOnMovingObject.current || hasControlInput)) {
      characterBody.wakeUp()
      isSleeping = false
    }

    // If character is sleeping, skip the update to save performance, but still allow it to be woken up by movement input or moving platform.
    if (isSleeping) return

    /**
     * Update character collider pos/vel/quat/axis
     */
    updateCharacterInfo(characterBody)

    /**
     * Update gravity value & direction, and then apply gravity
     */
    updateGravityInfo(characterBody)

    // Update input direction after gravity/up-axis refresh so slope and movement use current-frame input.
    updateForwardDirection()
    setInputDirection({ forward, backward, rightward, leftward, joystick })
    const hasMoveInput = inputDir.current.lengthSq() > 0

    /**
     * Update character auto balance
     */
    if (autoBalance && !isZeroGravity.current) autoBalanceCharacter(characterBody, frameRateCorrection)

    /**
     * Update ground contact info
     */
    // if (!isZeroGravity.current) 
    floatCharacter(characterBody)

    /**
     * Detect if character is on a moving object
     */
    isOnMovingObjectDetect(characterBody)

    /**
     * Compute relative velocity
     */
    computeRelativeVelocity()

    /**
     * Float character up
     */
    applyFloatingForce(characterBody)

    /**
     * Apply character mass to standing object
     */
    applyMassOnStandCollider(characterBody)

    /**
     * Detect slope angle below character
     */
    slopeDetect()

    /**
     * Detect is character under zero gravity condition
     */
    zeroGravityDetect()

    /**
     * Detect if character is falling
     */
    fallDetect()

    /**
     * Apply drag force if character is not moving
     */
    if (!hasMoveInput) applyFriction(characterBody, frameRateCorrection)

    /**
     * Apply dynamic character gravity scale base on different conditions: grounded/jumpUp/fall/exceed-fall-max-vel
     */
    applyDynamicGravity(characterBody)

    /**
     * Apply jump impulse to character
     */
    if (jump && isOnGround.current) applyJumpImpulse(characterBody)

    /**
     * Move character model to correct direction and speed
     */
    // Determine if camera based movment or character based movement
    if (isLockForward.current) {
      // Camera based movement always turn character to camera forward direction
      if (!isZeroGravity.current) turnCharacter(characterBody, forwardDirection.current, frameRateCorrection)
      if (hasMoveInput) moveCharacter(characterBody, run, frameRateCorrection)
      // Keep last input direction same as forward direction
      lastInputDir.current.copy(forwardDirection.current)
    } else {
      // Character based movement
      // If there is input, turn and move character
      if (hasMoveInput) {
        if (!isZeroGravity.current) turnCharacter(characterBody, inputDir.current, frameRateCorrection)
        moveCharacter(characterBody, run, frameRateCorrection)
        lastInputDir.current.copy(inputDir.current)
      } else {
        // If no last input, keep character facing forward direction
        if (lastInputDir.current.lengthSq() === 0) lastInputDir.current.copy(characterZAxis.current);
        // If there is no input, keep character at last input direction or with moving platform angvel
        if (!isZeroGravity.current) turnCharacter(characterBody, (isOnMovingObject.current && followPlatform) ? lastInputDir.current.applyQuaternion(turnOnYQuat.current) : lastInputDir.current, frameRateCorrection)
        // Keep moving direction same as last input direction
        movingDirection.current.copy(lastInputDir.current)
      }
    }

    /** 
     * Update debug indicators 
     */
    if (debug) updateDebugger()
  })

  return (
    <>
      <RigidBody
        colliders={false}
        ref={characterRef}
        position={props.position || [0, 1, 0]}
        friction={props.friction ?? -0.5}
        {...props}
      >
        <CapsuleCollider name="character-capsule-collider" args={[capsuleHalfHeight, capsuleRadius]} ref={characterColliderRef} />
        {/* Character model */}
        {children}

        {/* Debug indicators */}
        {debug && debugAssets &&
          <>
            {/* Character model indicator */}
            <group>
              <mesh scale={[0.5, 0.5, 2]} position={[0, rayOriginOffest, capsuleRadius * 2]} geometry={debugAssets.modelPointerGeo} material={debugAssets.modelIndicatorMat} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, rayOriginOffest, 0]} geometry={debugAssets.modelRingGeo} material={debugAssets.modelIndicatorMat} />
              {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, capsuleHalfHeight, 0]} geometry={debugAssets.modelCapGeo} material={debugAssets.modelCapMat} /> */}
              {/* <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -capsuleHalfHeight, 0]} geometry={debugAssets.modelCapGeo} material={debugAssets.modelCapMat} /> */}
            </group>
            {/* Axis pointers indicator */}
            <group>
              <mesh ref={xAxisPointRef} position={[1, 0, 0]} geometry={debugAssets.standingGeo} material={debugAssets.xAxisPointMat} />
              <mesh ref={yAxisPointRef} position={[0, 1, 0]} geometry={debugAssets.standingGeo} material={debugAssets.yAxisPointMat} />
              <mesh ref={zAxisPointRef} position={[0, 0, 1]} geometry={debugAssets.standingGeo} material={debugAssets.zAxisPointMat} />
            </group>
            {/* Impulse point position indicator */}
            <mesh position={[0, moveImpulsePointOffset, 0]}>
              <octahedronGeometry args={[capsuleRadius / 5, 0]} />
            </mesh>
          </>
        }
      </RigidBody>

      {/* Debug indicators */}
      {debug && debugAssets &&
        <group>
          {/* Looking forward direction indicator */}
          <group ref={forwardIndicatorRef}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={debugAssets.forwardRingGeo} material={debugAssets.forwardIndicatorMat} />
            <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0, -capsuleRadius * 2]} geometry={debugAssets.forwardPointerGeo} material={debugAssets.forwardIndicatorMat} />
          </group>
          {/* Floating shape cast indicator */}
          <group>
            <mesh ref={rayStartRef} geometry={debugAssets.rayCastGeo} material={debugAssets.rayCastMat} />
            <mesh ref={rayTriggerRef} geometry={debugAssets.rayCastGeo} material={debugAssets.standingMat} />
            <mesh ref={rayStableRef} geometry={debugAssets.rayCastGeo} material={debugAssets.standingMat} />
            <mesh ref={rayEndRef} geometry={debugAssets.rayCastGeo} material={debugAssets.rayCastMat} />
            <mesh ref={standingPointRef} geometry={debugAssets.standingGeo} material={debugAssets.rayCastMat} />
          </group >
          {/* Want to move direction indicator */}
          <group ref={moveIndicatorRef}>
            <mesh scale={[0.5, 0.5, 2]} position={[0, 0, -capsuleRadius * 2]} geometry={debugAssets.movePointerGeo} material={debugAssets.moveIndicatorMat} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={debugAssets.moveRingGeo} material={debugAssets.moveIndicatorMat} />
          </group>
          {/* Current moving velocity arrow debugger */}
          <arrowHelper ref={currVelArrowRef} args={[undefined, undefined, undefined, COLOR.EC_RED]} />
        </group>
      }
    </>
  );
})

export default React.memo(Ecctrl)

export interface EcctrlHandle {
  body: RapierRigidBody
  collider: RapierCollider
  readonly upAxis: THREE.Vector3
  readonly gravityDir: THREE.Vector3
  readonly gravityMag: number
  readonly currPos: THREE.Vector3
  readonly currQuat: THREE.Quaternion
  readonly currLinVel: THREE.Vector3
  readonly currAngVel: THREE.Vector3
  readonly input: ReadonlyMovementInput
  readonly inputDir: THREE.Vector3
  readonly movingDirection: THREE.Vector3
  readonly relativeVel: THREE.Vector3
  readonly relativeVelOnPlane: THREE.Vector3
  readonly relativeVelOnUp: THREE.Vector3
  readonly moveImpulse: THREE.Vector3
  readonly floatingImpulse: THREE.Vector3
  readonly dragFrictionImpulse: THREE.Vector3
  readonly bodyXAxis: THREE.Vector3
  readonly bodyYAxis: THREE.Vector3
  readonly bodyZAxis: THREE.Vector3
  readonly standCollider: RapierRigidBody | null
  readonly standPoint: THREE.Vector3
  readonly standNormal: THREE.Vector3
  readonly isOnGround: boolean
  readonly isFalling: boolean
  readonly isOnPlatform: boolean
  readonly slopeAngle: number
  readonly actualSlopeAngle: number
  readonly standFriction: number
  readonly slideFriction: number
  readonly isMoving: boolean
  readonly moveSpeed: number
  readonly verticalSpeed: number
  readonly runActive: boolean
  readonly jumpActive: boolean
  readonly lockForward: boolean
  readonly turnOnYQuat: THREE.Quaternion
  setMovement: (state: MovementInput) => void
  setLockForward: (lock: boolean) => void
  setForwardDir: (dir: THREE.Vector3) => void
}

export interface EcctrlProps extends RigidBodyProps {
  children?: ReactNode;
  debug?: boolean;
  enable?: boolean;

  // Character setups
  capsuleHalfHeight?: number;
  capsuleRadius?: number;

  // Forward direction setups
  lockForward?: boolean;
  useCustomForward?: boolean;
  useCharacterUpAxis?: boolean;

  // Custom gravity setups
  enableCustomGravity?: boolean;
  gravityDirLerpSpeed?: number;

  // Base control setups
  maxWalkVel?: number;
  maxRunVel?: number;
  accDeltaTime?: number;
  decDeltaTime?: number;
  rejectVelFactor?: number;
  moveImpulsePointOffset?: number;
  jumpVel?: number;
  jumpDuration?: number;
  slopeJumpFactor?: number;
  airDragFactor?: number;
  slideGripFactor?: number;
  fallingGravityScale?: number;
  fallingMaxVel?: number;
  enableToggleRun?: boolean;

  // Floating Ray setups
  groundDetection?: "shapeCast" | "rayCast";
  slopeMaxAngle?: number;
  floatHeight?: number;
  rayOriginOffest?: number;
  rayHitForgiveness?: number;
  rayLength?: number;
  rayRadius?: number;
  springK?: number;
  dampingC?: number;

  // AutoBalance Force setups
  autoBalance?: boolean;
  autoBalanceSpringK?: number;
  autoBalanceDampingC?: number;
  autoBalanceSpringOnY?: number;
  autoBalanceDampingOnY?: number;

  // Moving platform setups
  followPlatform?: boolean
  massRatioFallOffCurveData?: CurveData;
  applyCounterMass?: boolean;
  applyCounterJumpImp?: boolean;
  counterJumpImpFactor?: number;
  applyCounterMoveImp?: boolean;
  counterMoveImpFactor?: number;

  // Other rigibody props from parent
  props?: RigidBodyProps;
};
