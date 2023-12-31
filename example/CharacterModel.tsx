import {
  useAnimations,
  useGLTF,
  useTexture,
  Trail,
  SpriteAnimator,
} from "@react-three/drei";
import { useControls } from "leva";
import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useGame } from "../src/stores/useGame";
import { BallCollider, RapierCollider, vec3 } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";

export default function CharacterModel(props: CharacterModelProps) {
  // Change the character src to yours
  const group = useRef<THREE.Group>();
  const { nodes, animations } = useGLTF("/Floating Character.glb") as GLTF & {
    nodes: any;
  };
  const { actions } = useAnimations(animations, group);
  // gradientMapTexture for MeshToonMaterial
  const gradientMapTexture = useTexture("./textures/3.jpg");
  gradientMapTexture.minFilter = THREE.NearestFilter;
  gradientMapTexture.magFilter = THREE.NearestFilter;
  gradientMapTexture.generateMipmaps = false;

  /**
   * Prepare hands ref for attack action
   */
  const rightHandRef = useRef<THREE.Mesh>();
  const rightHandColliderRef = useRef<RapierCollider>();
  const leftHandRef = useRef<THREE.Mesh>();
  const leftHandColliderRef = useRef<RapierCollider>();
  const rightHandPos = useMemo(() => new THREE.Vector3(), []);
  const leftHandPos = useMemo(() => new THREE.Vector3(), []);
  const bodyPos = useMemo(() => new THREE.Vector3(), []);
  const bodyRot = useMemo(() => new THREE.Quaternion(), []);
  let rightHand: THREE.Object3D = null;
  let leftHand: THREE.Object3D = null;
  let mugModel: THREE.Object3D = null;

  /**
   * Prepare punch effect sprite
   */
  const [punchEffectProps, setPunchEffectProp] = useState({
    visible: false,
    scale: [1, 1, 1],
    play: false,
    position: [-0.2, -0.2, 0.5],
    startFrame: 0,
  });

  /**
   * Debug settings
   */
  const { mainColor, outlineColor, trailColor } = useControls(
    "Character Model",
    {
      mainColor: "mediumslateblue",
      outlineColor: "black",
      trailColor: "violet",
    }
  );

  /**
   * Prepare replacing materials
   */
  const outlineMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: outlineColor,
        transparent: true,
      }),
    [outlineColor]
  );
  const meshToonMaterial = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: mainColor,
        gradientMap: gradientMapTexture,
        transparent: true,
      }),
    [mainColor]
  );

  /**
   * Character animations setup
   */
  const curAnimation = useGame((state) => state.curAnimation);
  const resetAnimation = useGame((state) => state.reset);
  const initializeAnimationSet = useGame(
    (state) => state.initializeAnimationSet
  );

  // Rename your character animations here
  const animationSet = {
    idle: "Idle",
    walk: "Walk",
    run: "Run",
    jump: "Jump_Start",
    jumpIdle: "Jump_Idle",
    jumpLand: "Jump_Land",
    fall: "Climbing", // This is for falling from high sky
    action1: "Wave",
    action2: "Dance",
    action3: "Cheer",
    action4: "Attack(1h)",
  };

  useEffect(() => {
    // Initialize animation set
    initializeAnimationSet(animationSet);
  }, []);

  useEffect(() => {
    group.current.traverse((obj) => {
      // Prepare both hands bone object
      if (obj instanceof THREE.Bone) {
        if (obj.name === "handSlotRight") rightHand = obj;
        if (obj.name === "handSlotLeft") leftHand = obj;
      }
      // Prepare mug model for cheer action
      if (obj.name === "mug") {
        mugModel = obj;
        mugModel.visible = false;
      }
    });
  });

  useFrame(() => {
    if (curAnimation === animationSet.action4) {
      if (rightHand) {
        rightHand.getWorldPosition(rightHandPos);
        group.current.getWorldPosition(bodyPos);
        group.current.getWorldQuaternion(bodyRot);
      }

      // Apply hands position to hand colliders
      if (rightHandColliderRef.current) {
        // check if parent group autobalance is on or off
        if (group.current.parent.quaternion.y === 0 && group.current.parent.quaternion.w === 1) {
          rightHandRef.current.position.copy(rightHandPos).sub(bodyPos).applyQuaternion(bodyRot.conjugate());
        } else {
          rightHandRef.current.position.copy(rightHandPos).sub(bodyPos);
        }
        rightHandColliderRef.current.setTranslationWrtParent(
          rightHandRef.current.position
        );
      }
    }
  });

  useEffect(() => {
    // Play animation
    const action = actions[curAnimation ? curAnimation : animationSet.jumpIdle];

    // For jump and jump land animation, only play once and clamp when finish
    if (
      curAnimation === animationSet.jump ||
      curAnimation === animationSet.jumpLand ||
      curAnimation === animationSet.action1 ||
      curAnimation === animationSet.action2 ||
      curAnimation === animationSet.action3 ||
      curAnimation === animationSet.action4
    ) {
      action
        .reset()
        .fadeIn(0.2)
        .setLoop(THREE.LoopOnce, undefined as number)
        .play();
      action.clampWhenFinished = true;
      // Only show mug during cheer action
      if (curAnimation === animationSet.action3) {
        mugModel.visible = true;
      } else {
        mugModel.visible = false;
      }
    } else {
      action.reset().fadeIn(0.2).play();
      mugModel.visible = false;
    }

    // When any action is clamp and finished reset animation
    (action as any)._mixer.addEventListener("finished", () => resetAnimation());

    return () => {
      // Fade out previous action
      action.fadeOut(0.2);

      // Clean up mixer listener, and empty the _listeners array
      (action as any)._mixer.removeEventListener("finished", () =>
        resetAnimation()
      );
      (action as any)._mixer._listeners = [];

      // Move hand collider back to initial position after action
      if (curAnimation === animationSet.action4) {
        if (rightHandColliderRef.current) {
          rightHandColliderRef.current.setTranslationWrtParent(vec3({ x: 0, y: 0, z: 0 }))
        }
      }
    };
  }, [curAnimation]);

  return (
    <Suspense fallback={<capsuleGeometry args={[0.3, 0.7]} />}>
      {/* Default capsule modle */}
      {/* <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.7]} />
        <meshStandardMaterial color="mediumpurple" />
      </mesh>
      <mesh castShadow position={[0, 0.2, 0.2]}>
        <boxGeometry args={[0.5, 0.2, 0.3]} />
        <meshStandardMaterial color="mediumpurple" />
      </mesh> */}

      {/* Replace yours model here */}
      {/* Head collider */}
      <BallCollider args={[0.5]} position={[0, 0.45, 0]} />
      {/* Right hand collider */}
      <mesh ref={rightHandRef} />
      <BallCollider
        args={[0.1]}
        ref={rightHandColliderRef}
        onCollisionEnter={(e) => {
          if (curAnimation === animationSet.action4) {
            // Play punch effect
            setPunchEffectProp((prev) => ({
              ...prev,
              visible: true,
              play: true,
            }));
          }
        }}
      />

      {/* Left hand collider */}
      <mesh ref={leftHandRef} />
      <BallCollider args={[0.1]} ref={leftHandColliderRef} />
      {/* Character model */}
      <group
        ref={group}
        {...props}
        dispose={null}
      >
        <group name="Scene" scale={0.8} position={[0, -0.6, 0]}>
          <group name="KayKit_Animated_Character">
            <skinnedMesh
              name="outline"
              geometry={nodes.outline.geometry}
              material={outlineMaterial}
              skeleton={nodes.outline.skeleton}
            />
            <skinnedMesh
              name="PrototypePete"
              geometry={nodes.PrototypePete.geometry}
              material={meshToonMaterial}
              skeleton={nodes.PrototypePete.skeleton}
              receiveShadow
              castShadow
            />
            <Trail
              width={1.5}
              color={trailColor}
              length={3}
              decay={2}
              attenuation={(width) => width}
            >
              <primitive object={nodes.Body} />
            </Trail>
          </group>
        </group>
        <SpriteAnimator
          visible={punchEffectProps.visible}
          scale={punchEffectProps.scale as any}
          position={punchEffectProps.position as any}
          startFrame={punchEffectProps.startFrame}
          loop={true}
          onLoopEnd={() => {
            setPunchEffectProp((prev) => ({
              ...prev,
              visible: false,
              play: false,
            }));
          }}
          play={punchEffectProps.play}
          numberOfFrames={7}
          alphaTest={0.01}
          textureImageURL={"./punchEffect.png"}
        />
      </group>
    </Suspense>
  );
}

export type CharacterModelProps = JSX.IntrinsicElements["group"];

// Change the character src to yours
useGLTF.preload("/Floating Character.glb");
