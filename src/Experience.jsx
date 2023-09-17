import { Grid, KeyboardControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Physics } from "@react-three/rapier";
import CharacterController from "./CharacterController.jsx";
import Floor from "../example/Floor.jsx";
import Lights from "../example/Lights.jsx";
import Steps from "../example/Steps.jsx";
import Slopes from "../example/Slopes.jsx";
import RoughPlane from "../example/RoughPlane.jsx";
import RigidObjects from "../example/RigidObjects.jsx";
import FloatingPlatform from "../example/FloatingPlatform.jsx";
import DynamicPlatforms from "../example/DynamicPlatforms.jsx";
import ShotCube from "../example/ShotCube";
import { useControls } from "leva";
import CharacterModel from "./CharacterModel.jsx";

export default function Experience() {
  /**
   * Debug settings
   */
  const { physics } = useControls("World Settings", {
    physics: false,
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
    { name: "trigger", keys: ["KeyF"] },
  ];

  return (
    <>
      <Perf position="top-left" />

      <Grid
        args={[300, 300]}
        sectionColor={"lightgray"}
        cellColor={"gray"}
        position={[0, -0.99, 0]}
        userData={{ camExcludeCollision: true }} // this won't be collide by camera ray
      />

      <Lights />

      <Physics debug={physics} timeStep="vary">
        {/* Keyboard preset */}
        <KeyboardControls map={keyboardMap}>
          {/* Character Control */}
          <CharacterController>
            {/* Replace your model here */}
            <CharacterModel />
          </CharacterController>
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
      </Physics>
    </>
  );
}
