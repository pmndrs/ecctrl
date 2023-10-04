import {
  CuboidCollider,
  RapierRigidBody,
  RigidBody,
  useRapier,
} from "@react-three/rapier";
import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { RayColliderToi } from "@dimforge/rapier3d-compat";

export default function FloatingPlatform() {
  // Preset
  // couldn't find the correct type
  const floatingPlateRef = useRef<any>();
  const floatingPlateRef2 = useRef<any>();
  const floatingMovingPlateRef = useRef<any>();
  const { rapier, world } = useRapier();

  /**
   * Ray setup
   */
  // Platform 1
  const rayLength = 0.8;
  const rayDir = { x: 0, y: -1, z: 0 };
  const springDirVec = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const rayCast = new rapier.Ray(origin, rayDir);
  let rayHit: RayColliderToi = null;
  const floatingDis = 0.8;
  const springK = 2.5;
  const dampingC = 0.15;
  // Platform 2
  const springDirVec2 = useMemo(() => new THREE.Vector3(), []);
  const origin2 = useMemo(() => new THREE.Vector3(), []);
  const rayCast2 = new rapier.Ray(origin2, rayDir);
  let rayHit2: RayColliderToi = null;
  // Moving Platform
  const springDirVecMove = useMemo(() => new THREE.Vector3(), []);
  const originMove = useMemo(() => new THREE.Vector3(), []);
  const rayCastMove = new rapier.Ray(originMove, rayDir);
  const movingVel = useMemo(() => new THREE.Vector3(), []);
  let movingDir = 1;
  let rayHitMove: RayColliderToi = null;

  useEffect(() => {
    // Loack platform 1 rotation
    floatingPlateRef.current.lockRotations(true);

    // Loack platform 2 translation
    floatingPlateRef2.current.lockRotations(true);
    floatingPlateRef2.current.lockTranslations(true);
    floatingPlateRef2.current.setEnabledRotations(false, true, false);
    floatingPlateRef2.current.setEnabledTranslations(false, true, false);

    // Loack moving platform rotation
    floatingMovingPlateRef.current.setEnabledRotations(false, true, false);
    floatingMovingPlateRef.current.setEnabledTranslations(true, true, false);
  }, []);

  useFrame(() => {
    /**
     * Ray casting detect if on ground
     */
    // Ray cast for platform 1
    if (floatingPlateRef.current) {
      origin.set(
        floatingPlateRef.current.translation().x,
        floatingPlateRef.current.translation().y,
        floatingPlateRef.current.translation().z
      );
      rayHit = world.castRay(
        rayCast,
        rayLength,
        false,
        null,
        null,
        floatingPlateRef.current,
        floatingPlateRef.current
      );
    }
    // Ray cast for platform 2
    if (floatingPlateRef2.current) {
      origin2.set(
        floatingPlateRef2.current.translation().x,
        floatingPlateRef2.current.translation().y,
        floatingPlateRef2.current.translation().z
      );
      rayHit2 = world.castRay(
        rayCast2,
        rayLength,
        false,
        null,
        null,
        floatingPlateRef2.current,
        floatingPlateRef2.current
      );
    }
    // Ray cast for moving platform
    if (floatingMovingPlateRef.current) {
      originMove.set(
        floatingMovingPlateRef.current.translation().x,
        floatingMovingPlateRef.current.translation().y,
        floatingMovingPlateRef.current.translation().z
      );
      rayHitMove = world.castRay(
        rayCastMove,
        rayLength,
        false,
        null,
        null,
        floatingMovingPlateRef.current,
        floatingMovingPlateRef.current
      );
      // Apply moving velocity to the platform
      if (floatingMovingPlateRef.current.translation().x > 10) {
        movingDir = -1;
      } else if (floatingMovingPlateRef.current.translation().x < -5) {
        movingDir = 1;
      }

      if (movingDir > 0) {
        floatingMovingPlateRef.current.setLinvel(
          movingVel.set(2, floatingMovingPlateRef.current.linvel().y, 0)
        );
      } else {
        floatingMovingPlateRef.current.setLinvel(
          movingVel.set(-2, floatingMovingPlateRef.current.linvel().y, 0)
        );
      }
    }

    /**
     * Apply floating force
     */
    // Ray for platform 1
    if (rayHit) {
      if (rayHit.collider.parent()) {
        const floatingForce =
          springK * (floatingDis - rayHit.toi) -
          floatingPlateRef.current.linvel().y * dampingC;
        floatingPlateRef.current.applyImpulse(
          springDirVec.set(0, floatingForce, 0),
          true
        );
      }
    }

    // Ray for platform 2
    if (rayHit2) {
      if (rayHit2.collider.parent()) {
        const floatingForce2 =
          springK * (floatingDis - rayHit2.toi) -
          floatingPlateRef2.current.linvel().y * dampingC;
        floatingPlateRef2.current.applyImpulse(
          springDirVec2.set(0, floatingForce2, 0),
          true
        );
      }
    }

    // Ray for moving platform
    if (rayHitMove) {
      if (rayHitMove.collider.parent()) {
        const floatingForceMove =
          springK * (floatingDis - rayHitMove.toi) -
          floatingMovingPlateRef.current.linvel().y * dampingC;
        floatingMovingPlateRef.current.applyImpulse(
          springDirVecMove.set(0, floatingForceMove, 0),
          true
        );
      }
    }
  });

  return (
    <>
      {/* Platform 1 */}
      <RigidBody
        position={[0, 5, -10]}
        mass={1}
        colliders={false}
        ref={floatingPlateRef}
      >
        <Text
          scale={0.5}
          color="black"
          maxWidth={10}
          textAlign="center"
          position={[0, 2.5, 0]}
        >
          Floating Platform push to move
        </Text>
        <CuboidCollider args={[2.5, 0.1, 2.5]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[5, 0.2, 5]} />
          <meshStandardMaterial color={"lightsteelblue"} />
        </mesh>
      </RigidBody>

      {/* Platform 2 */}
      <RigidBody
        position={[7, 5, -10]}
        mass={1}
        colliders={false}
        ref={floatingPlateRef2}
      >
        <Text
          scale={0.5}
          color="black"
          maxWidth={10}
          textAlign="center"
          position={[0, 2.5, 0]}
        >
          Floating Platform push to rotate
        </Text>
        <CuboidCollider args={[2.5, 0.1, 2.5]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[5, 0.2, 5]} />
          <meshStandardMaterial color={"lightsteelblue"} />
        </mesh>
      </RigidBody>

      {/* Floating moving Platform test */}
      <RigidBody
        position={[0, 5, -17]}
        mass={1}
        colliders={false}
        ref={floatingMovingPlateRef}
      >
        <Text
          scale={0.5}
          color="black"
          maxWidth={10}
          textAlign="center"
          position={[0, 2.5, 0]}
        >
          Floating & Moving Platform (rigidbody)
        </Text>
        <CuboidCollider args={[1.25, 0.1, 1.25]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[2.5, 0.2, 2.5]} />
          <meshStandardMaterial color={"lightsteelblue"} />
        </mesh>
      </RigidBody>
    </>
  );
}
