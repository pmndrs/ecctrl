import { KeyboardControls, StatsGl } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import Lights from "./Lights";
import { useControls } from "leva";
import { useEffect, useRef } from "react";
import { GravityField } from "./GravityField";
import { useCustomGravity } from "../src/gravity";
import { TimeControl } from "../src/time";
import EcctrlWrapper from "./EcctrlWrapper";
import { TestMap } from "./map/TestMap";

export default function Experience() {
  /**
   * Custom gravity field
   */
  const { gravityField } = GravityField();
  const setGravityField = useCustomGravity((state) => state.setGravityField)
  useEffect(() => setGravityField(gravityField), [gravityField, setGravityField])

  /**
   * Keyboard control preset
   */
  // Keymap for ecctrl character
  const EcctrlKeyboardMap = [
    { name: "W", keys: ["KeyW"] },
    { name: "S", keys: ["KeyS"] },
    { name: "A", keys: ["KeyA"] },
    { name: "D", keys: ["KeyD"] },
    { name: "Space", keys: ["Space"] },
    { name: "Shift", keys: ["Shift"] },
    { name: "F", keys: ["KeyF"] },
    { name: "Up", keys: ["ArrowUp"] },
    { name: "Down", keys: ["ArrowDown"] },
    { name: "Left", keys: ["ArrowLeft"] },
    { name: "Right", keys: ["ArrowRight"] },
  ];

  /**
   * Debug settings
   */
  const timeScale = useRef(1)
  const [{ pausedPhysics, physicsDebug, physicsGravity }, setWorldSettings] = useControls(
    "World Settings",
    () => ({
      physicsDebug: false,
      pausedPhysics: true,
      physicsGravity: { value: [0, 0, 0] },
      slowMotion: {
        value: timeScale.current,
        min: 0.01,
        max: 1,
        step: 0.01,
        onChange: (value) => { timeScale.current = value },
      },
    }),
    { collapsed: true }
  );

  /**
   * Delay physics activate
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setWorldSettings({ pausedPhysics: false });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [setWorldSettings]);

  return (
    <>
      <StatsGl className="performanceStats" />

      <Lights />

      {/* Keep Physics paused because TimeControl manually steps Rapier. */}
      <Physics debug={physicsDebug} timeStep="vary" gravity={physicsGravity} paused>

        {/* Slow motion control */}
        <TimeControl paused={pausedPhysics} timeScale={timeScale} />

        <KeyboardControls map={EcctrlKeyboardMap}>
          {/* Ecctrl controller wrapper, include: camera control, vehicle control, animation control  */}
          <EcctrlWrapper paused={pausedPhysics} timeScale={timeScale} />
        </KeyboardControls>

        {/* Testing map */}
        <TestMap name="TestMapGroup" paused={pausedPhysics} timeScale={timeScale} />
      </Physics>
    </>
  );
}
