import { useGLTF, useAnimations } from "@react-three/drei";
import { useEffect, useRef, Suspense } from "react";
import * as THREE from "three";
import useGame from "./stores/useGame";

export function EcctrlAnimation(props) {
  // Change the character src to yours
  const group = useRef();
  const { animations } = useGLTF(props.characterURL);
  const { actions } = useAnimations(animations, group);

  /**
   * Character animations setup
   */
  const curAnimation = useGame((state) => state.curAnimation);
  const resetAnimation = useGame((state) => state.reset);
  const initializeAnimationSet = useGame(
    (state) => state.initializeAnimationSet
  );

  useEffect(() => {
    // Initialize animation set
    initializeAnimationSet(props.animationSet);
  }, []);

  useEffect(() => {
    // Play animation
    const action =
      actions[curAnimation ? curAnimation : props.animationSet.jumpIdle];

    // For jump and jump land animation, only play once and clamp when finish
    if (
      curAnimation === props.animationSet.jump ||
      curAnimation === props.animationSet.jumpLand ||
      curAnimation === props.animationSet.action1 ||
      curAnimation === props.animationSet.action2 ||
      curAnimation === props.animationSet.action3 ||
      curAnimation === props.animationSet.action4
    ) {
      action.reset().fadeIn(0.2).setLoop(THREE.LoopOnce).play();
      action.clampWhenFinished = true;
    } else {
      action.reset().fadeIn(0.2).play();
    }

    // When any action is clamp and finished reset animation
    action._mixer.addEventListener("finished", () => resetAnimation());

    return () => {
      // Fade out previous action
      action.fadeOut(0.2);

      // Clean up mixer listener, and empty the _listeners array
      action._mixer.removeEventListener("finished", () => resetAnimation());
      action._mixer._listeners = [];
    };
  }, [curAnimation]);

  return (
    <Suspense fallback={null}>
      <group
        ref={group}
        dispose={null}
      >
        {/* Replace character model here */}
        {props.children}
      </group>
    </Suspense>
  );
}
