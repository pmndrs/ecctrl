import { Grid, KeyboardControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Physics } from "@react-three/rapier";
import Floor from "./components/Floor";
import Lights from "./components/Lights";
import Steps from "./components/Steps";
import Slopes from "./components/Slopes";
import RoughPlane from "./components/RoughPlane";
import RigidObjects from "./components/RigidObjects";
import FloatingPlatform from "./components/FloatingPlatform";
import DynamicPlatforms from "./components/DynamicPlatforms";
import ShotCube from "./components/ShotCube";
import { useControls } from "leva";
import { Ecctrl } from "../../lib/src";
import { CharacterModel } from "./CharacterModel";

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
    { name: "action4", keys: ["KeyF"] },
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
          <Ecctrl
            debug
            animated
            followLight
            springK={2}
            dampingC={0.2}
            autoBalanceSpringK={1.2}
            autoBalanceDampingC={0.04}
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
      </Physics>
    </>
  );
}
