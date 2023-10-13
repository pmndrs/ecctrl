import "./style.css";
import ReactDOM from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import Experience from "../example/Experience";
import { Leva } from "leva";

const root = ReactDOM.createRoot(document.querySelector("#root"));

root.render(
  <>
    <Leva collapsed />
    <Canvas
      shadows
      camera={{
        fov: 65,
        near: 0.1,
        far: 1000,
      }}
      onPointerDown={(e) => {
        (e.target as HTMLCanvasElement).requestPointerLock();
      }}
    >
      <Experience />
    </Canvas>
  </>
);
