import { RigidBody } from "@react-three/rapier";

export default function Steps() {
  return (
    <>
      {/* Small steps */}
      <RigidBody type="fixed" position={[0, -0.9, 5]}>
        <mesh receiveShadow>
          <boxGeometry args={[4, 0.2, 0.2]} />
          <meshStandardMaterial color={"lightpink"} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, -0.9, 6]}>
        <mesh receiveShadow>
          <boxGeometry args={[4, 0.2, 0.2]} />
          <meshStandardMaterial color={"lightpink"} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, -0.9, 7]}>
        <mesh receiveShadow>
          <boxGeometry args={[4, 0.2, 0.2]} />
          <meshStandardMaterial color={"lightpink"} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, -0.9, 8]}>
        <mesh receiveShadow>
          <boxGeometry args={[4, 0.2, 0.2]} />
          <meshStandardMaterial color={"lightpink"} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, -0.9, 11]}>
        <mesh receiveShadow>
          <boxGeometry args={[4, 0.2, 4]} />
          <meshStandardMaterial color={"lightpink"} />
        </mesh>
      </RigidBody>
    </>
  );
}
