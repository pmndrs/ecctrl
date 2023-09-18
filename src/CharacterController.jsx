import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useControls } from "leva";
import useFollowCam from "./hooks/useFollowCam";
import useGame from "./stores/useGame";

export default function CharacterController(props) {
  const characterRef = useRef();
  const characterModelRef = useRef();

  // Animation change functions
  const idleAnimation = useGame((state) => state.idle);
  const walkAnimation = useGame((state) => state.walk);
  const runAnimation = useGame((state) => state.run);
  const jumpAnimation = useGame((state) => state.jump);
  const jumpIdleAnimation = useGame((state) => state.jumpIdle);
  const jumpLandAnimation = useGame((state) => state.jumpLand);
  const fallAnimation = useGame((state) => state.fall);
  const waveAnimation = useGame((state) => state.wave);
  const danceAnimation = useGame((state) => state.dance);
  const cheerAnimation = useGame((state) => state.cheer);
  const attackAnimation = useGame((state) => state.attack);

  /**
   * Debug settings
   */
  const {
    maxVelLimit,
    turnVelMultiplier,
    turnSpeed,
    sprintMult,
    jumpVel,
    jumpForceToGroundMult,
    slopJumpMult,
    sprintJumpMult,
    airDragMultiplier,
    dragDampingC,
    accDeltaTime,
    rejectVelMult,
    moveImpulsePointY,
    camFollowMult,
  } = useControls(
    "Character Controls",
    {
      maxVelLimit: {
        value: 2.5,
        min: 0,
        max: 10,
        step: 0.01,
      },
      turnVelMultiplier: {
        value: 0.2,
        min: 0,
        max: 1,
        step: 0.01,
      },
      turnSpeed: {
        value: 15,
        min: 5,
        max: 30,
        step: 0.1,
      },
      sprintMult: {
        value: 2,
        min: 1,
        max: 5,
        step: 0.01,
      },
      jumpVel: {
        value: 4,
        min: 0,
        max: 10,
        step: 0.01,
      },
      jumpForceToGroundMult: {
        value: 5,
        min: 0,
        max: 80,
        step: 0.1,
      },
      slopJumpMult: {
        value: 0.25,
        min: 0,
        max: 1,
        step: 0.01,
      },
      sprintJumpMult: {
        value: 1.2,
        min: 1,
        max: 3,
        step: 0.01,
      },
      airDragMultiplier: {
        value: 0.2,
        min: 0,
        max: 1,
        step: 0.01,
      },
      dragDampingC: {
        value: 0.15,
        min: 0,
        max: 0.5,
        step: 0.01,
      },
      accDeltaTime: {
        value: 8,
        min: 0,
        max: 50,
        step: 1,
      },
      rejectVelMult: {
        value: 4,
        min: 0,
        max: 10,
        step: 0.1,
      },
      moveImpulsePointY: {
        value: 0.5,
        min: 0,
        max: 3,
        step: 0.1,
      },
      camFollowMult: {
        value: 11,
        min: 0,
        max: 15,
        step: 0.1,
      },
    },
    { collapsed: true }
  );

  const {
    rayOriginOffest,
    rayHitForgiveness,
    rayLength,
    rayDir,
    floatingDis,
    springK,
    dampingC,
  } = useControls(
    "Floating Ray",
    {
      rayOriginOffest: {
        x: 0,
        y: -0.35,
        z: 0,
      },
      rayHitForgiveness: {
        value: 0.1,
        min: 0,
        max: 0.5,
        step: 0.01,
      },
      rayLength: {
        value: 2,
        min: 0,
        max: 10,
        step: 0.01,
      },
      rayDir: { x: 0, y: -1, z: 0 },
      floatingDis: {
        value: 0.6,
        min: 0,
        max: 2,
        step: 0.01,
      },
      springK: {
        value: 2,
        min: 0,
        max: 5,
        step: 0.01,
      },
      dampingC: {
        value: 0.2,
        min: 0,
        max: 3,
        step: 0.01,
      },
    },
    { collapsed: true }
  );

  const {
    showSlopeRayOrigin,
    slopeRayOriginOffest,
    slopeRayLength,
    slopeRayDir,
    slopeUpExtraForce,
    slopeDownExtraForce,
  } = useControls(
    "Slope Ray",
    {
      showSlopeRayOrigin: false,
      slopeRayOriginOffest: {
        value: 0.23,
        min: 0,
        max: 3,
        step: 0.01,
      },
      slopeRayLength: {
        value: 2.5,
        min: 0,
        max: 10,
        step: 0.01,
      },
      slopeRayDir: { x: 0, y: -1, z: 0 },
      slopeUpExtraForce: {
        value: 0.1,
        min: 0,
        max: 5,
        step: 0.01,
      },
      slopeDownExtraForce: {
        value: 0.2,
        min: 0,
        max: 5,
        step: 0.01,
      },
    },
    { collapsed: true }
  );

  const {
    autoBalance,
    autoBalanceSpringK,
    autoBalanceDampingC,
    autoBalanceDampingOnY,
  } = useControls(
    "AutoBalance Force",
    {
      autoBalance: {
        value: true,
      },
      autoBalanceSpringK: {
        value: 1.2,
        min: 0,
        max: 5,
        step: 0.01,
      },
      autoBalanceDampingC: {
        value: 0.04,
        min: 0,
        max: 0.1,
        step: 0.001,
      },
      autoBalanceDampingOnY: {
        value: 0.02,
        min: 0,
        max: 0.1,
        step: 0.001,
      },
    },
    { collapsed: true }
  );

  /**
   * keyboard controls setup
   */
  const [subscribeKeys, getKeys] = useKeyboardControls();
  const { rapier, world } = useRapier();

  // can jump setup
  let canJump = false;

  // on moving object state
  let isOnMovingObject = false;
  const stadingForcePoint = useMemo(() => new THREE.Vector3(), []);
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
  let dirLight = null;

  /**
   * Follow camera initial setups from props
   */
  const cameraSetups = {
    camInitDis: props.camInitDis ? props.camInitDis : -5,
    camMaxDis: props.camMaxDis ? props.camMaxDis : -7,
    camMinDis: props.camMinDis ? props.camMinDis : -0.7,
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
  let rayHit = null;

  /**Test shape ray */
  // const shape = new rapier.Capsule(0.2,0.1)

  /**
   * Slope detection ray setup
   */
  let slopeAngle = null;
  let actualSlopeNormal = null;
  let actualSlopeAngle = null;
  const actualSlopeNormalVec = useMemo(() => new THREE.Vector3(), []);
  const floorNormal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const slopeRayOriginRef = useRef();
  const slopeRayorigin = useMemo(() => new THREE.Vector3(), []);
  const slopeRayCast = new rapier.Ray(slopeRayorigin, slopeRayDir);
  let slopeRayHit = null;

  /**
   * Character moving function
   */
  const moveCharacter = (delta, run, slopeAngle, movingObjectVelocity) => {
    /**
     * Setup moving direction
     */
    // Only apply slope extra force when slope angle is between 0.2-1, actualSlopeAngle < 1
    if (
      actualSlopeAngle < 1 &&
      Math.abs(slopeAngle) > 0.2 &&
      Math.abs(slopeAngle) < 1
    ) {
      movingDirection.set(0, Math.sin(slopeAngle), Math.cos(slopeAngle));
    } else if (actualSlopeAngle >= 1) {
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
    characterRef.current.applyImpulseAtPoint(moveImpulse, {
      x: currentPos.x,
      y: currentPos.y + moveImpulsePointY,
      z: currentPos.z,
    });
  };

  /**
   * Character auto balance function
   */
  const autoBalanceCharacter = () => {
    dragAngForce.set(
      -autoBalanceSpringK * characterRef.current.rotation().x -
        characterRef.current.angvel().x * autoBalanceDampingC,
      -autoBalanceSpringK * characterRef.current.rotation().y -
        characterRef.current.angvel().y * autoBalanceDampingOnY,
      -autoBalanceSpringK * characterRef.current.rotation().z -
        characterRef.current.angvel().z * autoBalanceDampingC
    );
    characterRef.current.applyTorqueImpulse(dragAngForce);
  };

  useEffect(() => {
    // Initialize directional light
    dirLight = characterModelRef.current.parent.parent.children.find((item) => {
      return item.type === "DirectionalLight";
    });

    // Action 1 key subscribe for special animation
    const unSubscribeAction1 = subscribeKeys(
      (state) => state.action1,
      (value) => {
        if (value) {
          waveAnimation();
        }
      }
    );

    // Action 2 key subscribe for special animation
    const unSubscribeAction2 = subscribeKeys(
      (state) => state.action2,
      (value) => {
        if (value) {
          danceAnimation();
        }
      }
    );

    // Action 3 key subscribe for special animation
    const unSubscribeAction3 = subscribeKeys(
      (state) => state.action3,
      (value) => {
        if (value) {
          cheerAnimation();
        }
      }
    );

    // Trigger key subscribe for special animation
    const unSubscribeTrigger = subscribeKeys(
      (state) => state.trigger,
      (value) => {
        if (value) {
          attackAnimation();
        }
      }
    );

    return () => {
      unSubscribeAction1();
      unSubscribeAction2();
      unSubscribeAction3();
      unSubscribeTrigger();
    };
  });

  useEffect(() => {
    // Lock character rotations at Y axis
    characterRef.current.setEnabledRotations(
      autoBalance ? true : false,
      autoBalance ? true : false,
      autoBalance ? true : false
    );
  }, [autoBalance]);

  useFrame((state, delta) => {
    // Character current position
    if (characterRef.current) {
      currentPos.copy(characterRef.current.translation());
    }

    /**
     * Apply character position to directional light
     */
    if (dirLight) {
      dirLight.position.x = currentPos.x + 20;
      dirLight.position.y = currentPos.y + 30;
      dirLight.position.z = currentPos.z + 10;
      dirLight.target = characterModelRef.current;
    }

    /**
     * Getting all the useful keys from useKeyboardControls
     */
    const { forward, backward, leftward, rightward, jump, run } = getKeys();

    // Getting moving directions
    if (forward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y;
    } else if (backward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y + Math.PI;
    } else if (leftward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y + Math.PI / 2;
    } else if (rightward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y - Math.PI / 2;
    }
    if (forward && leftward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y + Math.PI / 4;
    } else if (forward && rightward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y - Math.PI / 4;
    } else if (backward && leftward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y - Math.PI / 4 + Math.PI;
    } else if (backward && rightward) {
      // Apply camera rotation to character model
      modelEuler.y = pivot.rotation.y + Math.PI / 4 + Math.PI;
    }

    // Move character to the moving direction
    if (forward || backward || leftward || rightward)
      moveCharacter(delta, run, slopeAngle, movingObjectVelocity);

    // Character current velocity
    if (characterRef.current) {
      currentVel.copy(characterRef.current.linvel());
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
          .add(jumpVelocityVec)
      );
      // Apply jump force downward to the standing platform
      characterMassForce.y *= jumpForceToGroundMult;
      rayHit.collider
        .parent()
        ?.applyImpulseAtPoint(characterMassForce, stadingForcePoint, true);
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
    pivotPosition.set(currentPos.x, currentPos.y + 0.5, currentPos.z);
    pivot.position.lerp(pivotPosition, 1 - Math.exp(-camFollowMult * delta));
    state.camera.lookAt(pivot.position);

    /**
     * Ray casting detect if on ground
     */
    rayOrigin.addVectors(currentPos, rayOriginOffest);
    rayHit = world.castRay(
      rayCast,
      rayLength,
      false,
      null,
      null,
      characterRef.current
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
      if (slopeRayHit && actualSlopeAngle < 1) {
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
        stadingForcePoint.set(
          rayOrigin.x,
          rayOrigin.y - rayHit.toi,
          rayOrigin.z
        );
        // this deals with any invisible collider object (sensor or air wall)
        const rayHitObjectBodyType = rayHit.collider.parent().bodyType();
        const rayHitObjectBodyMass = rayHit.collider.parent().mass();
        // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
        // And iff it stands on big mass object (>0.5)
        if (
          (rayHitObjectBodyType === 0 || rayHitObjectBodyType === 2) &&
          rayHitObjectBodyMass > 0.5
        ) {
          isOnMovingObject = true;

          // Calculate distance between character and moving object
          distanceFromCharacterToObject
            .copy(currentPos)
            .sub(rayHit.collider.parent().translation());
          // Moving object linear velocity
          const movingObjectLinvel = rayHit.collider.parent().linvel();
          // Moving object angular velocity
          const movingObjectAngvel = rayHit.collider.parent().angvel();
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
                stadingForcePoint,
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
      false,
      null,
      null,
      characterRef.current
    );

    // Calculate slope angle
    if (slopeRayHit) {
      actualSlopeNormal = slopeRayHit.collider.castRayAndGetNormal(
        slopeRayCast,
        slopeRayLength
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
        slopeAngle = Math.atan(
          (rayHit.toi - slopeRayHit.toi) / slopeRayOriginOffest
        ).toFixed(2);
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
          springDirVec.set(0, floatingForce, 0)
        );

        // Apply opposite force to standing object (gravity g in rapier is 0.11 ?_?)
        characterMassForce.set(0, floatingForce > 0 ? -floatingForce : 0, 0);
        rayHit.collider
          .parent()
          ?.applyImpulseAtPoint(characterMassForce, stadingForcePoint, true);
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
        characterRef.current.applyImpulse(dragForce);
      }
      // on a moving object
      else {
        dragForce.set(
          (movingObjectVelocity.x - currentVel.x) * dragDampingC * 2,
          0,
          (movingObjectVelocity.z - currentVel.z) * dragDampingC * 2
        );
        characterRef.current.applyImpulse(dragForce);
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
    if (!forward && !backward && !leftward && !rightward && !jump && canJump) {
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
  });

  return (
    <RigidBody
      colliders={false}
      position={[0, 5, 0]}
      friction={-0.5}
      gravityScale={1.2}
      canSleep={false}
      ref={characterRef}
    >
      <CapsuleCollider args={[0.35, 0.3]} />
      <group ref={characterModelRef}>
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
          {/* This is used for positioning the slope ray origin */}
          <boxGeometry args={[0.15, 0.15, 0.15]} />
        </mesh>
        {/* Character model */}
        {props.children}
      </group>
    </RigidBody>
  );
}
