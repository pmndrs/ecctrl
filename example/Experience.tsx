import { Grid, KeyboardControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Physics } from "@react-three/rapier";
import Ecctrl from "../src/Ecctrl";
import Floor from "./Floor";
import Lights from "./Lights";
import Steps from "./Steps";
import Slopes from "./Slopes";
import RoughPlane from "./RoughPlane";
import RigidObjects from "./RigidObjects";
import FloatingPlatform from "./FloatingPlatform";
import DynamicPlatforms from "./DynamicPlatforms";
import ShotCube from "./ShotCube";
import { useControls } from "leva";
import CharacterModel from "./CharacterModel";
import React, { useEffect, useState } from "react";

export default function Experience() {
  /**
   * Delay physics activate
   */
  const [pausedPhysics, setPausedPhysics] = useState(true);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPausedPhysics(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  /**
   * Debug settings
   */
  const { physics, disableControl, disableFollowCam } = useControls("World Settings", {
    physics: false,
    disableControl: false,
    disableFollowCam: false,
  });

  /**
   * Keyboard control preset
   */
  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
    { name: "rightward", keys: ["ArrowRight", "KeyD"] },
    { name: "jump", keys: ["Space"] },
    { name: "run", keys: ["Shift"] },
    { name: "action1", keys: ["1"] },
    { name: "action2", keys: ["2"] },
    { name: "action3", keys: ["3"] },
    { name: "action4", keys: ["KeyF"] },
  ];

  return (
    <>
      <Perf position="top-left" minimal />

      <Grid
        args={[300, 300]}
        sectionColor={"lightgray"}
        cellColor={"gray"}
        position={[0, -0.99, 0]}
        userData={{ camExcludeCollision: true }} // this won't be collide by camera ray
      />

      <Lights />

      <Physics debug={physics} timeStep="vary" paused={pausedPhysics}>
        {/* Keyboard preset */}
        <KeyboardControls map={keyboardMap}>
          {/* Character Control */}
          <Ecctrl
            debug
            animated
            followLight
            springK={2}
            dampingC={0.2}
            autoBalanceSpringK={1.2}
            autoBalanceDampingC={0.04}
            autoBalanceSpringOnY={0.7}
            autoBalanceDampingOnY={0.05}
            disableControl={disableControl}
            disableFollowCam={disableFollowCam}
          >
            {/* Replace your model here */}
            <CharacterModel />
          </Ecctrl>
        </KeyboardControls>

        {/* Rough plan */}
        <RoughPlane />

        {/* Slopes and stairs */}
        <Slopes />

        {/* Small steps */}
        <Steps />

        {/* Rigid body objects */}
        <RigidObjects />

        {/* Floating platform */}
        <FloatingPlatform />

        {/* Dynamic platforms */}
        <DynamicPlatforms />

        {/* Floor */}
        <Floor />

        {/* Shoting cubes */}
        <ShotCube />
      </Physics >
    </>
  );
}
