import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  quat,
  RigidBody,
  CapsuleCollider,
  useRapier,
  RapierRigidBody,
  type RigidBodyProps,
} from "@react-three/rapier";
import { useEffect, useRef, useMemo, type ReactNode, forwardRef, type RefObject, useCallback } from "react";
import * as THREE from "three";
import { useControls } from "leva";
import { useFollowCam } from "./hooks/useFollowCam";
import { useGame } from "./stores/useGame";
import type {
  Collider,
  RayColliderToi,
  Vector,
} from "@dimforge/rapier3d-compat";

export { EcctrlAnimation } from "./EcctrlAnimation";

const DYNAMIC: number = 0;
const FIXED: number = 1;

// Retrieve current moving direction of the character
const getMovingDirection = (forward: boolean,
  backward: boolean,
  leftward: boolean,
  rightward: boolean,
  pivot: THREE.Object3D)
  :number | null => {
    if (!forward && !backward && !leftward && !rightward) return null;
    if (forward && leftward) return pivot.rotation.y + Math.PI / 4;
    if (forward && rightward) return pivot.rotation.y - Math.PI / 4;
    if (backward && leftward) return pivot.rotation.y - Math.PI / 4 + Math.PI;
    if (backward && rightward) return pivot.rotation.y + Math.PI / 4 + Math.PI;
    if (backward) return pivot.rotation.y + Math.PI;
    if (leftward) return pivot.rotation.y + Math.PI / 2;
    if (rightward) return pivot.rotation.y - Math.PI / 2;
    if (forward) return pivot.rotation.y;
};

const Ecctrl = forwardRef<RapierRigidBody, EcctrlProps>(({
  children,
  debug = false,
  capsuleHalfHeight = 0.35,
  capsuleRadius = 0.3,
  floatHeight = 0.3,
  characterInitDir = 0, // in rad
  followLight = false,
  // Follow camera setups
  camInitDis = -5,
  camMaxDis = -7,
  camMinDis = -0.7,
  camInitDir = 0, // in rad
  // Base control setups
  maxVelLimit = 2.5,
  turnVelMultiplier = 0.2,
  turnSpeed = 15,
  sprintMult = 2,
  jumpVel = 4,
  jumpForceToGroundMult = 5,
  slopJumpMult = 0.25,
  sprintJumpMult = 1.2,
  airDragMultiplier = 0.2,
  dragDampingC = 0.15,
  accDeltaTime = 8,
  rejectVelMult = 4,
  moveImpulsePointY = 0.5,
  camFollowMult = 11,
  // Floating Ray setups
  rayOriginOffest = { x: 0, y: -capsuleHalfHeight, z: 0 },
  rayHitForgiveness = 0.1,
  rayLength = capsuleRadius + 2,
  rayDir = { x: 0, y: -1, z: 0 },
  floatingDis = capsuleRadius + floatHeight,
  springK = 1.2,
  dampingC = 0.08,
  // Slope Ray setups
  showSlopeRayOrigin = false,
  slopeMaxAngle = 1, // in rad
  slopeRayOriginOffest = capsuleRadius - 0.03,
  slopeRayLength = capsuleRadius + 3,
  slopeRayDir = { x: 0, y: -1, z: 0 },
  slopeUpExtraForce = 0.1,
  slopeDownExtraForce = 0.2,
  // AutoBalance Force setups
  autoBalance = true,
  autoBalanceSpringK = 0.3,
  autoBalanceDampingC = 0.03,
  autoBalanceSpringOnY = 0.3,
  autoBalanceDampingOnY = 0.02,
  // Animation temporary setups
  animated = false,
  // Other rigibody props from parent
  ...props
}: EcctrlProps, ref) => {
  const characterRef = ref as RefObject<RapierRigidBody> || useRef<RapierRigidBody>()
  const characterModelRef = useRef<THREE.Group>();

  /** 
   * Body collider setup
   */
  const modelFacingVec = useMemo(() => new THREE.Vector3(), []);
  const bodyFacingVec = useMemo(() => new THREE.Vector3(), []);
  const bodyBalanceVec = useMemo(() => new THREE.Vector3(), []);
  const bodyBalanceVecOnX = useMemo(() => new THREE.Vector3(), []);
  const bodyFacingVecOnY = useMemo(() => new THREE.Vector3(), []);
  const bodyBalanceVecOnZ = useMemo(() => new THREE.Vector3(), []);
  const vectorY = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const vectorZ = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  // Animation change functions
  const idleAnimation = !animated ? null : useGame((state) => state.idle);
  const walkAnimation = !animated ? null : useGame((state) => state.walk);
  const runAnimation = !animated ? null : useGame((state) => state.run);
  const jumpAnimation = !animated ? null : useGame((state) => state.jump);
  const jumpIdleAnimation = !animated
    ? null
    : useGame((state) => state.jumpIdle);
  const jumpLandAnimation = !animated
    ? null
    : useGame((state) => state.jumpLand);
  const fallAnimation = !animated ? null : useGame((state) => state.fall);
  const action1Animation = !animated ? null : useGame((state) => state.action1);
  const action2Animation = !animated ? null : useGame((state) => state.action2);
  const action3Animation = !animated ? null : useGame((state) => state.action3);
  const action4Animation = !animated ? null : useGame((state) => state.action4);

  /**
   * Debug settings
   */
  let characterControlsDebug = null;
  let floatingRayDebug = null;
  let slopeRayDebug = null;
  let autoBalanceForceDebug = null;
  if (debug) {
    // Character Controls
    characterControlsDebug = useControls(
      "Character Controls",
      {
        maxVelLimit: {
          value: maxVelLimit,
          min: 0,
          max: 10,
          step: 0.01,
        },
        turnVelMultiplier: {
          value: turnVelMultiplier,
          min: 0,
          max: 1,
          step: 0.01,
        },
        turnSpeed: {
          value: turnSpeed,
          min: 5,
          max: 30,
          step: 0.1,
        },
        sprintMult: {
          value: sprintMult,
          min: 1,
          max: 5,
          step: 0.01,
        },
        jumpVel: {
          value: jumpVel,
          min: 0,
          max: 10,
          step: 0.01,
        },
        jumpForceToGroundMult: {
          value: jumpForceToGroundMult,
          min: 0,
          max: 80,
          step: 0.1,
        },
        slopJumpMult: {
          value: slopJumpMult,
          min: 0,
          max: 1,
          step: 0.01,
        },
        sprintJumpMult: {
          value: sprintJumpMult,
          min: 1,
          max: 3,
          step: 0.01,
        },
        airDragMultiplier: {
          value: airDragMultiplier,
          min: 0,
          max: 1,
          step: 0.01,
        },
        dragDampingC: {
          value: dragDampingC,
          min: 0,
          max: 0.5,
          step: 0.01,
        },
        accDeltaTime: {
          value: accDeltaTime,
          min: 0,
          max: 50,
          step: 1,
        },
        rejectVelMult: {
          value: rejectVelMult,
          min: 0,
          max: 10,
          step: 0.1,
        },
        moveImpulsePointY: {
          value: moveImpulsePointY,
          min: 0,
          max: 3,
          step: 0.1,
        },
        camFollowMult: {
          value: camFollowMult,
          min: 0,
          max: 15,
          step: 0.1,
        },
      },
      { collapsed: true }
    );
    // Apply debug values
    maxVelLimit = characterControlsDebug.maxVelLimit;
    turnVelMultiplier = characterControlsDebug.turnVelMultiplier;
    turnSpeed = characterControlsDebug.turnSpeed;
    sprintMult = characterControlsDebug.sprintMult;
    jumpVel = characterControlsDebug.jumpVel;
    jumpForceToGroundMult = characterControlsDebug.jumpForceToGroundMult;
    slopJumpMult = characterControlsDebug.slopJumpMult;
    sprintJumpMult = characterControlsDebug.sprintJumpMult;
    airDragMultiplier = characterControlsDebug.airDragMultiplier;
    dragDampingC = characterControlsDebug.dragDampingC;
    accDeltaTime = characterControlsDebug.accDeltaTime;
    rejectVelMult = characterControlsDebug.rejectVelMult;
    moveImpulsePointY = characterControlsDebug.moveImpulsePointY;
    camFollowMult = characterControlsDebug.camFollowMult;

    // Floating Ray
    floatingRayDebug = useControls(
      "Floating Ray",
      {
        rayOriginOffest: {
          x: 0,
          y: -capsuleHalfHeight,
          z: 0,
        },
        rayHitForgiveness: {
          value: rayHitForgiveness,
          min: 0,
          max: 0.5,
          step: 0.01,
        },
        rayLength: {
          value: capsuleRadius + 2,
          min: 0,
          max: capsuleRadius + 10,
          step: 0.01,
        },
        rayDir: { x: 0, y: -1, z: 0 },
        floatingDis: {
          value: capsuleRadius + floatHeight,
          min: 0,
          max: capsuleRadius + 2,
          step: 0.01,
        },
        springK: {
          value: springK,
          min: 0,
          max: 5,
          step: 0.01,
        },
        dampingC: {
          value: dampingC,
          min: 0,
          max: 3,
          step: 0.01,
        },
      },
      { collapsed: true }
    );
    // Apply debug values
    rayOriginOffest = floatingRayDebug.rayOriginOffest;
    rayHitForgiveness = floatingRayDebug.rayHitForgiveness;
    rayLength = floatingRayDebug.rayLength;
    rayDir = floatingRayDebug.rayDir;
    floatingDis = floatingRayDebug.floatingDis;
    springK = floatingRayDebug.springK;
    dampingC = floatingRayDebug.dampingC;

    // Slope Ray
    slopeRayDebug = useControls(
      "Slope Ray",
      {
        showSlopeRayOrigin: false,
        slopeMaxAngle: {
          value: slopeMaxAngle,
          min: 0,
          max: 1.57,
          step: 0.01
        },
        slopeRayOriginOffest: {
          value: capsuleRadius,
          min: 0,
          max: capsuleRadius + 3,
          step: 0.01,
        },
        slopeRayLength: {
          value: capsuleRadius + 3,
          min: 0,
          max: capsuleRadius + 13,
          step: 0.01,
        },
        slopeRayDir: { x: 0, y: -1, z: 0 },
        slopeUpExtraForce: {
          value: slopeUpExtraForce,
          min: 0,
          max: 5,
          step: 0.01,
        },
        slopeDownExtraForce: {
          value: slopeDownExtraForce,
          min: 0,
          max: 5,
          step: 0.01,
        },
      },
      { collapsed: true }
    );
    // Apply debug values
    showSlopeRayOrigin = slopeRayDebug.showSlopeRayOrigin;
    slopeMaxAngle = slopeRayDebug.slopeMaxAngle;
    slopeRayLength = slopeRayDebug.slopeRayLength;
    slopeRayDir = slopeRayDebug.slopeRayDir;
    slopeUpExtraForce = slopeRayDebug.slopeUpExtraForce;
    slopeDownExtraForce = slopeRayDebug.slopeDownExtraForce;

    // AutoBalance Force
    autoBalanceForceDebug = useControls(
      "AutoBalance Force",
      {
        autoBalance: {
          value: true,
        },
        autoBalanceSpringK: {
          value: autoBalanceSpringK,
          min: 0,
          max: 5,
          step: 0.01,
        },
        autoBalanceDampingC: {
          value: autoBalanceDampingC,
          min: 0,
          max: 0.1,
          step: 0.001,
        },
        autoBalanceSpringOnY: {
          value: autoBalanceSpringOnY,
          min: 0,
          max: 5,
          step: 0.01,
        },
        autoBalanceDampingOnY: {
          value: autoBalanceDampingOnY,
          min: 0,
          max: 0.1,
          step: 0.001,
        },
      },
      { collapsed: true }
    );
    // Apply debug values
    autoBalance = autoBalanceForceDebug.autoBalance;
    autoBalanceSpringK = autoBalanceForceDebug.autoBalanceSpringK;
    autoBalanceDampingC = autoBalanceForceDebug.autoBalanceDampingC;
    autoBalanceSpringOnY = autoBalanceForceDebug.autoBalanceSpringOnY;
    autoBalanceDampingOnY = autoBalanceForceDebug.autoBalanceDampingOnY;
  }

  /**
   * keyboard controls setup
   */
  const [subscribeKeys, getKeys] = useKeyboardControls();
  const { rapier, world } = useRapier();

  // can jump setup
  let canJump = false;

  // on moving object state
  let isOnMovingObject = false;
  const standingForcePoint = useMemo(() => new THREE.Vector3(), []);
  const movingObjectDragForce = useMemo(() => new THREE.Vector3(), []);
  const movingObjectVelocity = useMemo(() => new THREE.Vector3(), []);
  const movingObjectVelocityInCharacterDir = useMemo(
    () => new THREE.Vector3(),
    []
  );
  const distanceFromCharacterToObject = useMemo(() => new THREE.Vector3(), []);
  const objectAngvelToLinvel = useMemo(() => new THREE.Vector3(), []);

  /**
   * Initial light setup
   */
  let dirLight: THREE.DirectionalLight = null;

  /**
   * Follow camera initial setups from props
   */
  const cameraSetups = {
    camInitDis,
    camMaxDis,
    camMinDis,
  };

  /**
   * Load camera pivot and character move preset
   */
  const { pivot, followCam, cameraCollisionDetect } =
    useFollowCam(cameraSetups);
  const pivotPosition = useMemo(() => new THREE.Vector3(), []);
  const modelEuler = useMemo(() => new THREE.Euler(), []);
  const modelQuat = useMemo(() => new THREE.Quaternion(), []);
  const moveImpulse = useMemo(() => new THREE.Vector3(), []);
  const movingDirection = useMemo(() => new THREE.Vector3(), []);
  const moveAccNeeded = useMemo(() => new THREE.Vector3(), []);
  const jumpVelocityVec = useMemo(() => new THREE.Vector3(), []);
  const jumpDirection = useMemo(() => new THREE.Vector3(), []);
  const currentVel = useMemo(() => new THREE.Vector3(), []);
  const currentPos = useMemo(() => new THREE.Vector3(), []);
  const dragForce = useMemo(() => new THREE.Vector3(), []);
  const dragAngForce = useMemo(() => new THREE.Vector3(), []);
  const wantToMoveVel = useMemo(() => new THREE.Vector3(), []);
  const rejectVel = useMemo(() => new THREE.Vector3(), []);

  /**
   * Floating Ray setup
   */
  let floatingForce = null;
  const springDirVec = useMemo(() => new THREE.Vector3(), []);
  const characterMassForce = useMemo(() => new THREE.Vector3(), []);
  const rayOrigin = useMemo(() => new THREE.Vector3(), []);
  const rayCast = new rapier.Ray(rayOrigin, rayDir);
  let rayHit: RayColliderToi = null;

  /**Test shape ray */
  // const shape = new rapier.Capsule(0.2,0.1)

  /**
   * Slope detection ray setup
   */
  let slopeAngle: number = null;
  let actualSlopeNormal: Vector = null;
  let actualSlopeAngle: number = null;
  const actualSlopeNormalVec = useMemo(() => new THREE.Vector3(), []);
  const floorNormal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const slopeRayOriginRef = useRef<THREE.Mesh>();
  const slopeRayorigin = useMemo(() => new THREE.Vector3(), []);
  const slopeRayCast = new rapier.Ray(slopeRayorigin, slopeRayDir);
  let slopeRayHit: RayColliderToi = null;

  /**
   * Character moving function
   */
  const moveCharacter = (
    _: number,
    run: boolean,
    slopeAngle: number,
    movingObjectVelocity: THREE.Vector3
  ) => {
    /**
     * Setup moving direction
     */
    // Only apply slope extra force when slope angle is between 0.2 and slopeMaxAngle, actualSlopeAngle < slopeMaxAngle
    if (
      actualSlopeAngle < slopeMaxAngle &&
      Math.abs(slopeAngle) > 0.2 &&
      Math.abs(slopeAngle) < slopeMaxAngle
    ) {
      movingDirection.set(0, Math.sin(slopeAngle), Math.cos(slopeAngle));
    } else if (actualSlopeAngle >= slopeMaxAngle) {
      movingDirection.set(
        0,
        Math.sin(slopeAngle) > 0 ? 0 : Math.sin(slopeAngle),
        Math.sin(slopeAngle) > 0 ? 0.1 : 1
      );
    } else {
      movingDirection.set(0, 0, 1);
    }

    // Apply character quaternion to moving direction
    movingDirection.applyQuaternion(characterModelRef.current.quaternion);
    // Calculate moving object velocity direction according to character moving direction
    movingObjectVelocityInCharacterDir
      .copy(movingObjectVelocity)
      .projectOnVector(movingDirection)
      .multiply(movingDirection);
    // Calculate angle between moving object velocity direction and character moving direction
    const angleBetweenCharacterDirAndObjectDir =
      movingObjectVelocity.angleTo(movingDirection);

    /**
     * Setup rejection velocity, (currently only work on ground)
     */
    const wantToMoveMeg = currentVel.dot(movingDirection);
    wantToMoveVel.set(
      movingDirection.x * wantToMoveMeg,
      0,
      movingDirection.z * wantToMoveMeg
    );
    rejectVel.copy(currentVel).sub(wantToMoveVel);

    /**
     * Calculate required accelaration and force: a = Δv/Δt
     * If it's on a moving/rotating platform, apply platform velocity to Δv accordingly
     * Also, apply reject velocity when character is moving opposite of it's moving direction
     */
    moveAccNeeded.set(
      (movingDirection.x *
        (maxVelLimit * (run ? sprintMult : 1) +
          movingObjectVelocityInCharacterDir.x) -
        (currentVel.x -
          movingObjectVelocity.x *
          Math.sin(angleBetweenCharacterDirAndObjectDir) +
          rejectVel.x * (isOnMovingObject ? 0 : rejectVelMult))) /
      accDeltaTime,
      0,
      (movingDirection.z *
        (maxVelLimit * (run ? sprintMult : 1) +
          movingObjectVelocityInCharacterDir.z) -
        (currentVel.z -
          movingObjectVelocity.z *
          Math.sin(angleBetweenCharacterDirAndObjectDir) +
          rejectVel.z * (isOnMovingObject ? 0 : rejectVelMult))) /
      accDeltaTime
    );

    // Wanted to move force function: F = ma
    const moveForceNeeded = moveAccNeeded.multiplyScalar(
      characterRef.current.mass()
    );

    /**
     * Check if character complete turned to the wanted direction
     */
    const characterRotated =
      Math.sin(characterModelRef.current.rotation.y).toFixed(3) ==
      Math.sin(modelEuler.y).toFixed(3);

    // If character hasn't complete turning, change the impulse quaternion follow characterModelRef quaternion
    if (!characterRotated) {
      moveImpulse.set(
        moveForceNeeded.x *
        turnVelMultiplier *
        (canJump ? 1 : airDragMultiplier), // if it's in the air, give it less control
        slopeAngle === null || slopeAngle == 0 // if it's on a slope, apply extra up/down force to the body
          ? 0
          : movingDirection.y *
          turnVelMultiplier *
          (movingDirection.y > 0 // check it is on slope up or slope down
            ? slopeUpExtraForce
            : slopeDownExtraForce) *
          (run ? sprintMult : 1),
        moveForceNeeded.z *
        turnVelMultiplier *
        (canJump ? 1 : airDragMultiplier) // if it's in the air, give it less control
      );
    }
    // If character complete turning, change the impulse quaternion default
    else {
      moveImpulse.set(
        moveForceNeeded.x * (canJump ? 1 : airDragMultiplier),
        slopeAngle === null || slopeAngle == 0 // if it's on a slope, apply extra up/down force to the body
          ? 0
          : movingDirection.y *
          (movingDirection.y > 0 // check it is on slope up or slope down
            ? slopeUpExtraForce
            : slopeDownExtraForce) *
          (run ? sprintMult : 1),
        moveForceNeeded.z * (canJump ? 1 : airDragMultiplier)
      );
    }

    // Move character at proper direction and impulse
    characterRef.current.applyImpulseAtPoint(
      moveImpulse,
      {
        x: currentPos.x,
        y: currentPos.y + moveImpulsePointY,
        z: currentPos.z,
      },
      false
    );
  };

  /**
   * Character auto balance function
   */
  const autoBalanceCharacter = () => {
    bodyFacingVec.set(0, 0, 1).applyQuaternion(quat(characterRef.current.rotation()))
    bodyBalanceVec.set(0, 1, 0).applyQuaternion(quat(characterRef.current.rotation()))

    bodyBalanceVecOnX.set(0, bodyBalanceVec.y, bodyBalanceVec.z)
    bodyFacingVecOnY.set(bodyFacingVec.x, 0, bodyFacingVec.z)
    bodyBalanceVecOnZ.set(bodyBalanceVec.x, bodyBalanceVec.y, 0)

    characterModelRef.current.getWorldDirection(modelFacingVec)
    const crossVecOnX = vectorY.clone().cross(bodyBalanceVecOnX);
    const crossVecOnY = vectorZ.clone().cross(bodyFacingVecOnY);
    const crossVecOnZ = vectorY.clone().cross(bodyBalanceVecOnZ);

    dragAngForce.set(
      (crossVecOnX.x < 0 ? 1 : -1) *
      autoBalanceSpringK * (bodyBalanceVecOnX.angleTo(vectorY))
      - characterRef.current.angvel().x * autoBalanceDampingC,
      (crossVecOnY.y < 0 ? 1 : -1) *
      autoBalanceSpringOnY * (bodyFacingVecOnY.angleTo(vectorZ))
      - characterRef.current.angvel().y * autoBalanceDampingOnY,
      (crossVecOnZ.z < 0 ? 1 : -1) *
      autoBalanceSpringK * (bodyBalanceVecOnZ.angleTo(vectorY))
      - characterRef.current.angvel().z * autoBalanceDampingC,
    );

    // Apply balance torque impulse
    characterRef.current.applyTorqueImpulse(dragAngForce, false)
  };

  const setCharacterBodyType = useCallback(
    (e: FocusEvent) => 
      e.type === "blur" ?
        characterRef.current.setBodyType(FIXED, false) :
        characterRef.current.setBodyType(DYNAMIC, true)
  , [])

  useEffect(() => {
    // Initialize directional light
    if (followLight) {
      dirLight = characterModelRef.current.parent.parent.children.find(
        (item) => {
          return item.name === "followLight";
        }
      ) as THREE.DirectionalLight;
    }

    // Action 1 key subscribe for special animation
    const unSubscribeAction1 = subscribeKeys(
      (state) => state.action1,
      (value) => {
        if (value) {
          animated && action1Animation();
        }
      }
    );

    // Action 2 key subscribe for special animation
    const unSubscribeAction2 = subscribeKeys(
      (state) => state.action2,
      (value) => {
        if (value) {
          animated && action2Animation();
        }
      }
    );

    // Action 3 key subscribe for special animation
    const unSubscribeAction3 = subscribeKeys(
      (state) => state.action3,
      (value) => {
        if (value) {
          animated && action3Animation();
        }
      }
    );

    // Trigger key subscribe for special animation
    const unSubscribeAction4 = subscribeKeys(
      (state) => state.action4,
      (value) => {
        if (value) {
          animated && action4Animation();
        }
      }
    );

    return () => {
      unSubscribeAction1();
      unSubscribeAction2();
      unSubscribeAction3();
      unSubscribeAction4();
    };
  });

  useEffect(() => {
    // Lock character rotations at Y axis
    characterRef.current.setEnabledRotations(
      autoBalance ? true : false,
      autoBalance ? true : false,
      autoBalance ? true : false,
      false
    );
  }, [autoBalance]);

  useEffect(() => {
    // Initialize character facing direction
    modelEuler.y = characterInitDir
    // Initialize camera facing direction
    pivot.rotation.y = camInitDir

    window.addEventListener("blur", setCharacterBodyType);
    window.addEventListener("focus", setCharacterBodyType);
    
    return () => {
      window.removeEventListener("blur", () => setCharacterBodyType);
      window.removeEventListener("focus", () => setCharacterBodyType);
    }
  }, [])

  useFrame((state, delta) => {
    // Character current position
    if (characterRef.current) {
      currentPos.copy(characterRef.current.translation() as THREE.Vector3);
    }

    /**
     * Apply character position to directional light
     */
    if (followLight && dirLight) {
      dirLight.position.x = currentPos.x + 20;
      dirLight.position.y = currentPos.y + 30;
      dirLight.position.z = currentPos.z + 10;
      dirLight.target = characterModelRef.current;
    }

    /**
     * Getting all the useful keys from useKeyboardControls
     */
    const { forward, backward, leftward, rightward, jump, run } = getKeys();

    // Getting moving directions (IIFE)
    modelEuler.y = ((movingDirection) => movingDirection === null ? modelEuler.y : movingDirection)
    (getMovingDirection(forward, backward, leftward, rightward, pivot ))

    // Move character to the moving direction
    if (forward || backward || leftward || rightward)
      moveCharacter(delta, run, slopeAngle, movingObjectVelocity);

    // Character current velocity
    if (characterRef.current) {
      currentVel.copy(characterRef.current.linvel() as THREE.Vector3);
    }

    // Jump impulse
    if (jump && canJump) {
      // characterRef.current.applyImpulse(jumpDirection.set(0, 0.5, 0), true);
      jumpVelocityVec.set(
        currentVel.x,
        run ? sprintJumpMult * jumpVel : jumpVel,
        currentVel.z
      );
      // Apply slope normal to jump direction
      characterRef.current.setLinvel(
        jumpDirection
          .set(0, (run ? sprintJumpMult * jumpVel : jumpVel) * slopJumpMult, 0)
          .projectOnVector(actualSlopeNormalVec)
          .add(jumpVelocityVec),
        false
      );
      // Apply jump force downward to the standing platform
      characterMassForce.y *= jumpForceToGroundMult;
      rayHit.collider
        .parent()
        ?.applyImpulseAtPoint(characterMassForce, standingForcePoint, true);
    }

    // Rotate character model
    modelQuat.setFromEuler(modelEuler);
    characterModelRef.current.quaternion.rotateTowards(
      modelQuat,
      delta * turnSpeed
    );

    /**
     *  Camera movement
     */
    pivotPosition.set(
      currentPos.x,
      currentPos.y + (capsuleHalfHeight + capsuleRadius / 2),
      currentPos.z
    );
    pivot.position.lerp(pivotPosition, 1 - Math.exp(-camFollowMult * delta));
    state.camera.lookAt(pivot.position);

    /**
     * Ray casting detect if on ground
     */
    rayOrigin.addVectors(currentPos, rayOriginOffest as THREE.Vector3);
    rayHit = world.castRay(
      rayCast,
      rayLength,
      true,
      null,
      null,
      // I have no idea
      characterRef.current as unknown as Collider,
      null,
      // this exclude with sensor collider
      ((collider) => !collider.isSensor())
    );
    /**Test shape ray */
    // rayHit = world.castShape(
    //   currentPos,
    //   { w: 0, x: 0, y: 0, z: 0 },
    //   {x:0,y:-1,z:0},
    //   shape,
    //   rayLength,
    //   true,
    //   null,
    //   null,
    //   characterRef.current
    // );

    if (rayHit && rayHit.toi < floatingDis + rayHitForgiveness) {
      if (slopeRayHit && actualSlopeAngle < slopeMaxAngle) {
        canJump = true;
      }
    } else {
      canJump = false;
    }

    /**
     * Ray detect if on rigid body or dynamic platform, then apply the linear velocity and angular velocity to character
     */
    if (rayHit && canJump) {
      if (rayHit.collider.parent()) {
        // Getting the standing force apply point
        standingForcePoint.set(
          rayOrigin.x,
          rayOrigin.y - rayHit.toi,
          rayOrigin.z
        );
        const rayHitObjectBodyType = rayHit.collider.parent().bodyType();
        const rayHitObjectBodyMass = rayHit.collider.parent().mass();
        // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
        // And if it stands on big mass object (>0.5)
        if (
          (rayHitObjectBodyType === 0 || rayHitObjectBodyType === 2) &&
          rayHitObjectBodyMass > 0.5
        ) {
          isOnMovingObject = true;

          // Calculate distance between character and moving object
          distanceFromCharacterToObject
            .copy(currentPos)
            .sub(rayHit.collider.parent().translation() as THREE.Vector3);
          // Moving object linear velocity
          const movingObjectLinvel = rayHit.collider
            .parent()
            .linvel() as THREE.Vector3;
          // Moving object angular velocity
          const movingObjectAngvel = rayHit.collider
            .parent()
            .angvel() as THREE.Vector3;
          // Combine object linear velocity and angular velocity to movingObjectVelocity
          movingObjectVelocity.set(
            movingObjectLinvel.x +
            objectAngvelToLinvel.crossVectors(
              movingObjectAngvel,
              distanceFromCharacterToObject
            ).x,
            movingObjectLinvel.y,
            movingObjectLinvel.z +
            objectAngvelToLinvel.crossVectors(
              movingObjectAngvel,
              distanceFromCharacterToObject
            ).z
          );

          // Apply opposite drage force to the stading rigid body, body type 0
          // Character moving and unmoving should provide different drag force to the platform
          if (rayHitObjectBodyType === 0) {
            if (!forward && !backward && !leftward && !rightward && canJump) {
              movingObjectDragForce.set(
                (currentVel.x - movingObjectVelocity.x) * dragDampingC,
                0,
                (currentVel.z - movingObjectVelocity.z) * dragDampingC
              );
            } else {
              movingObjectDragForce.copy(moveImpulse).negate();
            }
            rayHit.collider
              .parent()
              .applyImpulseAtPoint(
                movingObjectDragForce,
                standingForcePoint,
                true
              );
          }
        } else {
          isOnMovingObject = false;
          movingObjectVelocity.set(0, 0, 0);
        }
      }
    }

    /**
     * Slope ray casting detect if on slope
     */
    slopeRayOriginRef.current.getWorldPosition(slopeRayorigin);
    slopeRayorigin.y = rayOrigin.y;
    slopeRayHit = world.castRay(
      slopeRayCast,
      slopeRayLength,
      true,
      null,
      null,
      // Still no idea
      characterRef.current as unknown as Collider,
      null,
      // this exclude with sensor collider
      ((collider) => !collider.isSensor())
    );

    // Calculate slope angle
    if (slopeRayHit) {
      actualSlopeNormal = slopeRayHit.collider.castRayAndGetNormal(
        slopeRayCast,
        slopeRayLength,
        false
      )?.normal;
      if (actualSlopeNormal) {
        actualSlopeNormalVec?.set(
          actualSlopeNormal.x,
          actualSlopeNormal.y,
          actualSlopeNormal.z
        );
        actualSlopeAngle = actualSlopeNormalVec?.angleTo(floorNormal);
      }
    }
    if (slopeRayHit && rayHit && slopeRayHit.toi < floatingDis + 0.5) {
      if (canJump) {
        // Round the slope angle to 2 decimal places
        slopeAngle = Number(
          Math.atan(
            (rayHit.toi - slopeRayHit.toi) / slopeRayOriginOffest
          ).toFixed(2)
        );
      } else {
        slopeAngle = null;
      }
    } else {
      slopeAngle = null;
    }

    /**
     * Apply floating force
     */
    if (rayHit != null) {
      if (canJump && rayHit.collider.parent()) {
        floatingForce =
          springK * (floatingDis - rayHit.toi) -
          characterRef.current.linvel().y * dampingC;
        characterRef.current.applyImpulse(
          springDirVec.set(0, floatingForce, 0),
          false
        );

        // Apply opposite force to standing object (gravity g in rapier is 0.11 ?_?)
        characterMassForce.set(0, floatingForce > 0 ? -floatingForce : 0, 0);
        rayHit.collider
          .parent()
          ?.applyImpulseAtPoint(characterMassForce, standingForcePoint, true);
      }
    }

    /**
     * Apply drag force if it's not moving
     */
    if (!forward && !backward && !leftward && !rightward && canJump) {
      // not on a moving object
      if (!isOnMovingObject) {
        dragForce.set(
          -currentVel.x * dragDampingC,
          0,
          -currentVel.z * dragDampingC
        );
        characterRef.current.applyImpulse(dragForce, false);
      }
      // on a moving object
      else {
        dragForce.set(
          (movingObjectVelocity.x - currentVel.x) * dragDampingC * 2,
          0,
          (movingObjectVelocity.z - currentVel.z) * dragDampingC * 2
        );
        characterRef.current.applyImpulse(dragForce, false);
      }
    }

    /**
     * Apply auto balance force to the character
     */
    if (autoBalance && characterRef.current) {
      autoBalanceCharacter();
    }

    /**
     * Camera collision detect
     */
    cameraCollisionDetect(delta);

    /**
     * Apply all the animations
     */
    if (animated) {
      if (
        !forward &&
        !backward &&
        !leftward &&
        !rightward &&
        !jump &&
        canJump
      ) {
        idleAnimation();
      } else if (jump && canJump) {
        jumpAnimation();
      } else if (canJump && (forward || backward || leftward || rightward)) {
        run ? runAnimation() : walkAnimation();
      } else if (!canJump) {
        jumpIdleAnimation();
      }
      // On high sky, play falling animation
      if (rayHit == null && currentVel.y < 0) {
        fallAnimation();
      }
    }
  });

  return (
    <RigidBody
      colliders={false}
      canSleep={false}
      ref={characterRef}
      position={props.position || [0, 5, 0]}
      friction={props.friction || -0.5}
      {...props}
    >
      <CapsuleCollider args={[capsuleHalfHeight, capsuleRadius]} />
      <group ref={characterModelRef} userData={{ camExcludeCollision: true }}>
        {/* This mesh is used for positioning the slope ray origin */}
        <mesh
          position={[
            rayOriginOffest.x,
            rayOriginOffest.y,
            rayOriginOffest.z + slopeRayOriginOffest,
          ]}
          ref={slopeRayOriginRef}
          visible={showSlopeRayOrigin}
          userData={{ camExcludeCollision: true }} // this won't be collide by camera ray
        >
          <boxGeometry args={[0.15, 0.15, 0.15]} />
        </mesh>
        {/* Character model */}
        {children}
      </group>
    </RigidBody>
  );
})

export default Ecctrl

export interface EcctrlProps extends RigidBodyProps {
  children?: ReactNode;
  debug?: boolean;
  capsuleHalfHeight?: number;
  capsuleRadius?: number;
  floatHeight?: number;
  characterInitDir?: number;
  followLight?: boolean;
  // Follow camera setups
  camInitDis?: number;
  camMaxDis?: number;
  camMinDis?: number;
  camInitDir?: number;
  // Base control setups
  maxVelLimit?: number;
  turnVelMultiplier?: number;
  turnSpeed?: number;
  sprintMult?: number;
  jumpVel?: number;
  jumpForceToGroundMult?: number;
  slopJumpMult?: number;
  sprintJumpMult?: number;
  airDragMultiplier?: number;
  dragDampingC?: number;
  accDeltaTime?: number;
  rejectVelMult?: number;
  moveImpulsePointY?: number;
  camFollowMult?: number;
  // Floating Ray setups
  rayOriginOffest?: { x: number; y: number; z: number };
  rayHitForgiveness?: number;
  rayLength?: number;
  rayDir?: { x: number; y: number; z: number };
  floatingDis?: number;
  springK?: number;
  dampingC?: number;
  // Slope Ray setups
  showSlopeRayOrigin?: boolean;
  slopeMaxAngle?: number;
  slopeRayOriginOffest?: number;
  slopeRayLength?: number;
  slopeRayDir?: { x: number; y: number; z: number };
  slopeUpExtraForce?: number;
  slopeDownExtraForce?: number;
  // AutoBalance Force setups
  autoBalance?: boolean;
  autoBalanceSpringK?: number;
  autoBalanceDampingC?: number;
  autoBalanceSpringOnY?: number;
  autoBalanceDampingOnY?: number;
  // Animation temporary setups
  animated?: boolean;
  // Other rigibody props from parent
  props?: RigidBodyProps;
};
