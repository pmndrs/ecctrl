import "./style.css";
import * as THREE from "three"
import { WebGPURenderer } from "three/webgpu";
import ReactDOM from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import Experience from "../example/Experience";
import { Leva } from "leva";
import { Suspense } from "react";
import { Bvh } from "@react-three/drei";
import { Joystick, VirtualButton } from "../src/input";
import { useControlStore } from "./store/useControlStore";
import { ControlHints } from "./ui/ControlHints";
import { InteractionPrompt } from "./ui/InteractionPrompt";
import { CopyrightNotice } from "./ui/CopyrightNotice";
import { useIsTouchDevice } from "./ui/useIsTouchDevice";

const root = ReactDOM.createRoot(document.querySelector("#root")!);

const JoystickControls = () => {
  const activeController = useControlStore(state => state.activeController);
  const isTouchScreen = useIsTouchDevice();
  const buttonLabels = activeController === "ecctrl"
    ? { b1: "Run", b2: "Jump", b4: "Enter" }
    : activeController === "vehicle3"
      ? { b4: "Exit" }
      : { b1: "Rev", b2: "Brake", b3: "Gas", b4: "Exit" };

  return (
    <>
      {isTouchScreen && (
        <>
          <Joystick id="left" joystickWrapperStyle={{ left: '0', bottom: '0' }}/>
          {activeController === "vehicle3" && <Joystick id="right" joystickWrapperStyle={{ right: '0', bottom: '0' }} />}
          {activeController !== "vehicle3" && <VirtualButton id="b1" label={buttonLabels.b1} buttonWrapperStyle={{ right: '100px', bottom: '30px' }} />}
          {activeController !== "vehicle3" && <VirtualButton id="b2" label={buttonLabels.b2} buttonWrapperStyle={{ right: '40px', bottom: activeController === "ecctrl" ? '90px' : '70px' }} />}
          {(activeController === "vehicle1" || activeController === "vehicle2") && <VirtualButton id="b3" label={buttonLabels.b3} buttonWrapperStyle={{ right: '100px', bottom: '110px' }} />}
          <VirtualButton id="b4" label={buttonLabels.b4} buttonWrapperStyle={{ right: '40px', bottom: '200px' }} />
        </>
      )}
    </>
  );
};

root.render(
  <>
    <Leva collapsed />
    <JoystickControls />
    <InteractionPrompt />
    <ControlHints />
    <CopyrightNotice />
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{
        fov: 75,
        near: 0.1,
        far: 1000,
        position: [0, 0, -4],
      }}
    >
      <Suspense fallback={null}>
        <Bvh firstHitOnly >
          <Experience />
        </Bvh>
      </Suspense>
    </Canvas>
  </>
);
