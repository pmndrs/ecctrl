import * as THREE from 'three'
import { useMemo, useRef, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { type GLTF } from 'three-stdlib'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, InstancedRigidBodies, type RapierRigidBody, RigidBody, type InstancedRigidBodyProps, useRapier, BallCollider } from '@react-three/rapier'
import { useCustomGravity } from '../../src/gravity'

type TimeScaleValue = number | RefObject<number>

const readTimeScale = (value: TimeScaleValue) => typeof value === 'number' ? value : value.current

function createInstanceStack({ pos, rows, rowStep, itemStep, startCount, countStep, rotation = [0, 0, 0], scale = [1, 1, 1] }: { pos: [number, number, number]; rows: number; rowStep: [number, number, number]; itemStep: [number, number, number]; startCount: number; countStep: number; rotation?: [number, number, number], scale?: [number, number, number] }): InstancedRigidBodyProps[] {
    const instances: InstancedRigidBodyProps[] = [];
    let currentKey = 0;
    for (let r = 0; r < rows; r++) {
        // 1. Calculate how many items are in this specific row
        const countInRow = startCount + (r * countStep);

        // 2. Calculate the starting position for this row
        //    Start = Origin + (RowIndex * RowStepVector)
        const rowStartX = pos[0] + r * rowStep[0];
        const rowStartY = pos[1] + r * rowStep[1];
        const rowStartZ = pos[2] + r * rowStep[2];

        for (let c = 0; c < countInRow; c++) {
            instances.push({
                key: currentKey++,
                position: [
                    // 3. Calculate position for item in column
                    //    Pos = RowStart + (ColIndex * ItemStepVector)
                    rowStartX + c * itemStep[0],
                    rowStartY + c * itemStep[1],
                    rowStartZ + c * itemStep[2],
                ],
                rotation: rotation,
                scale: scale,
            });
        }
    }
    return instances;
}

export function TestMap({ paused = false, timeScale = 1, ...props }: ThreeElements['group'] & { paused?: boolean; timeScale?: TimeScaleValue }) {
    // Map models GLTF
    const { nodes, materials } = useGLTF('/testMap.glb') as unknown as GLTFResult
    materials.GridTexture.side = THREE.FrontSide;

    // Create material variants
    const materialColors = ["#cce", "#dcf", "#bcc", "#bcf", "#fce", "#bbe"];
    const variantMaterials = useMemo(() => {
        return materialColors.map(color => {
            const mat = materials.GridTexture.clone();
            mat.color = new THREE.Color(color);
            return mat;
        });
    }, [materials]);

    /**
     * Instanced object setup
     */
    const strip01Instances = useMemo(() => createInstanceStack({ pos: [-26, 0, -27], rotation: [0, Math.PI / 2, 0], rows: 2, startCount: 11, countStep: 0, rowStep: [-1, 0, 4], itemStep: [-2, 0, 0] }), [])
    const strip02Instances = useMemo(() => createInstanceStack({ pos: [-26, 0, -35], rotation: [0, Math.PI / 2, 0], rows: 1, startCount: 11, countStep: 0, rowStep: [0, 0, 0], itemStep: [-2, 0, 0] }), [])
    const strip03Instances = useMemo(() => createInstanceStack({ pos: [-26, 0, -45], rotation: [Math.PI / 2, Math.PI / 4, Math.PI / 2], rows: 1, startCount: 11, countStep: 0, rowStep: [0, 0, 0], itemStep: [-2, 0, 0] }), [])
    const strip04Instances = useMemo(() => createInstanceStack({ pos: [-26, 0, -55], rotation: [0, Math.PI / 2, 0], rows: 1, startCount: 11, countStep: 0, rowStep: [0, 0, 0], itemStep: [-2, 0, 0] }), [])
    const cubeInstances = useMemo(() => createInstanceStack({ pos: [-35.5, 0.5, 110], rows: 7, startCount: 7, countStep: -1, rowStep: [-0.75, 1, 0], itemStep: [-1.5, 0, 0], }), []);
    const ballInstances = useMemo(() => createInstanceStack({ pos: [40, 1, 110], rows: 5, startCount: 1, countStep: 1, rowStep: [-1.05, 0, 1.8], itemStep: [2.1, 0, 0], }), []);
    const blockInstances = useMemo(() => createInstanceStack({ pos: [-40, 3, 115], rows: 1, startCount: 6, countStep: 0, rowStep: [0, 0, 0], itemStep: [0, 0, 3], }), []);

    /**
     * Dynamic object setup
     */
    const { world } = useRapier();
    const applyGravityField = useCustomGravity((state) => state.applyGravityField)
    const seesawRef = useRef<RapierRigidBody>(null)
    const cubeInstancesRef = useRef<RapierRigidBody[]>(null)
    const ballInstancesRef = useRef<RapierRigidBody[]>(null)
    const blockInstancesRef = useRef<RapierRigidBody[]>(null)

    /**
     * Kinematic object setup
     */
    const platform01Ref = useRef<RapierRigidBody>(null)
    const platform02Ref = useRef<RapierRigidBody>(null)
    const platform02RotationQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const barRef = useRef<RapierRigidBody>(null)
    const barRotationQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const ballRef = useRef<RapierRigidBody>(null)
    const ballRotationQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const diskRef = useRef<RapierRigidBody>(null)
    const diskRotationQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const pillarJumpRef = useRef<RapierRigidBody>(null)
    const pillarJumpRotationQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
    const mapTime = useRef(0)

    // Static rotation axes
    const xRotationAxies = new THREE.Vector3(1, 0, 0)
    const yRotationAxies = new THREE.Vector3(0, 1, 0)
    const zRotationAxies = new THREE.Vector3(0, 0, 1)

    useFrame((_, delta) => {
        if (paused) return;

        mapTime.current += Math.min(delta, 1 / 30) * Math.max(0, readTimeScale(timeScale));
        const time = mapTime.current;

        /**
         * Update kinematic platforms/objects
         */
        if (platform01Ref.current) {
            const t = time / 4
            const s = 0.5 * Math.sin(t) + 0.5
            const z = 30 * Math.pow(s, 15) * (16 - 15 * s) - 55
            const n = 0.5 * Math.sin(t - 3) + 0.5
            const y = 10 * Math.pow(n, 15) * (16 - 15 * n)
            platform01Ref.current.setNextKinematicTranslation({ x: 45, y: y, z: z })
        }
        if (platform02Ref.current) {
            platform02Ref.current.setNextKinematicTranslation({ x: 25, y: 0, z: 15 * (Math.sin(-time / 4) + 1) - 55 })
            platform02Ref.current.setNextKinematicRotation(platform02RotationQuat.current.setFromAxisAngle(yRotationAxies, time * 0.2))
        }
        if (barRef.current) barRef.current.setNextKinematicRotation(barRotationQuat.current.setFromAxisAngle(zRotationAxies, time * 0.2))
        if (ballRef.current) ballRef.current.setNextKinematicRotation(ballRotationQuat.current.setFromAxisAngle(yRotationAxies, time * -0.2))
        if (diskRef.current) diskRef.current.setNextKinematicRotation(diskRotationQuat.current.setFromAxisAngle(yRotationAxies, time * -0.2))
        if (pillarJumpRef.current) pillarJumpRef.current.setNextKinematicRotation(pillarJumpRotationQuat.current.setFromAxisAngle(yRotationAxies, time * 0.2))

        /**
         * Update dynamic objects gravity
         */
        if (seesawRef.current) applyGravityField(seesawRef.current, world.timestep)
        if (cubeInstancesRef.current) cubeInstancesRef.current.forEach(body => applyGravityField(body, world.timestep))
        if (ballInstancesRef.current) ballInstancesRef.current.forEach(body => applyGravityField(body, world.timestep))
        if (blockInstancesRef.current) blockInstancesRef.current.forEach(body => applyGravityField(body, world.timestep))
    })

    return (
        <group {...props} dispose={null}>
            {/* Fixed base floor */}
            <RigidBody type='fixed' colliders={false} position={[0, -1, 0]}>
                <CuboidCollider args={[80, 1, 110]} />
                <CylinderCollider args={[1, 80]} position={[0, 0, 110]} />
                <CylinderCollider args={[1, 80]} position={[0, 0, -110]} />
                <CylinderCollider args={[1, 80]} position={[0, 102, 110]} />
                <mesh receiveShadow geometry={nodes.BaseFloor.geometry} material={variantMaterials[0]} />
                <mesh receiveShadow geometry={nodes.R80Disk.geometry} material={variantMaterials[0]} position={[0, 102, 110]} />
            </RigidBody>

            {/* Fixed friction floor */}
            <RigidBody type='fixed' friction={0}>
                <mesh receiveShadow geometry={nodes.Box24X24.geometry} material={variantMaterials[2]} position={[-35, 0, -75]} />
            </RigidBody>
            <RigidBody type='fixed' friction={-0.4}>
                <mesh receiveShadow geometry={nodes.Box24X24.geometry} material={variantMaterials[3]} position={[-35, 0, -105]} />
            </RigidBody>

            {/* Fixed hull items */}
            <RigidBody type='fixed' colliders="hull" >
                {/* Ramps */}
                <mesh receiveShadow geometry={nodes.Ramp10.geometry} material={variantMaterials[1]} position={[35, 0, -75]} />
                <mesh receiveShadow geometry={nodes.Ramp20.geometry} material={variantMaterials[1]} position={[35, 0, -85]} />
                <mesh receiveShadow geometry={nodes.Ramp30.geometry} material={variantMaterials[1]} position={[35, 0, -95]} />
                <mesh receiveShadow geometry={nodes.Ramp45.geometry} material={variantMaterials[1]} position={[35, 0, -105]} />
            </RigidBody>

            {/* Fixed trimesh items */}
            <RigidBody type='fixed' colliders='trimesh' >
                {/* Track */}
                <mesh receiveShadow geometry={nodes.Track.geometry} material={variantMaterials[1]} />

                {/* Ramp jumps */}
                <mesh receiveShadow geometry={nodes.RampJump.geometry} material={variantMaterials[1]} position={[-25, 0, 0]} />
                <mesh receiveShadow geometry={nodes.RampJump.geometry} material={variantMaterials[1]} position={[25, 0, 0]} rotation-y={Math.PI} />
                <mesh receiveShadow geometry={nodes.RampU.geometry} material={variantMaterials[1]} position={[0, 0, -135]} />

                {/* Pillar */}
                <mesh receiveShadow geometry={nodes.Pillar10X100.geometry} material={variantMaterials[0]} position={[0, 50, 110]} />
            </RigidBody>

            {/* Fixed instanced strips */}
            <InstancedRigidBodies instances={strip01Instances} type='fixed' colliders='hull'>
                <instancedMesh args={[nodes.Trip05X4.geometry, variantMaterials[1], strip01Instances.length]} count={strip01Instances.length} frustumCulled={false} />
            </InstancedRigidBodies>
            <InstancedRigidBodies instances={strip02Instances} type='fixed' colliders='cuboid'>
                <instancedMesh args={[nodes.Box05X8.geometry, variantMaterials[1], strip02Instances.length]} count={strip02Instances.length} frustumCulled={false} />
            </InstancedRigidBodies>
            <InstancedRigidBodies instances={strip03Instances} type='fixed' colliders='cuboid'>
                <instancedMesh args={[nodes.Box05X8.geometry, variantMaterials[1], strip03Instances.length]} count={strip03Instances.length} frustumCulled={false} />
            </InstancedRigidBodies>
            <InstancedRigidBodies instances={strip04Instances} type='fixed' colliders='hull'>
                <instancedMesh args={[nodes.HalfCylinder03X8.geometry, variantMaterials[1], strip04Instances.length]} count={strip04Instances.length} frustumCulled={false} />
            </InstancedRigidBodies>

            {/* Kinematic platform 01 */}
            <RigidBody ref={platform01Ref} type='kinematicPosition'>
                <mesh castShadow receiveShadow geometry={nodes.Box10X10.geometry} material={variantMaterials[1]} />
            </RigidBody>

            {/* Kinematic platform 02 */}
            <RigidBody ref={platform02Ref} type='kinematicPosition'>
                <mesh receiveShadow geometry={nodes.Box10X10.geometry} material={variantMaterials[1]} />
            </RigidBody>

            {/* Kinematic rotating bar */}
            <RigidBody ref={barRef} type='kinematicPosition' colliders={false} position={[35, -4, -40]}>
                <CylinderCollider args={[20, 5]} rotation={[Math.PI / 2, 0, 0]} />
                <mesh receiveShadow geometry={nodes.Cylinder5X40.geometry} material={variantMaterials[1]} />
            </RigidBody>

            {/* Kinematic rotating ball */}
            <RigidBody ref={ballRef} type='kinematicPosition' colliders={false} position={[0, 20, 0]}>
                <BallCollider args={[10]} />
                <mesh receiveShadow geometry={nodes.R10Ball.geometry} material={variantMaterials[1]} />
                <mesh receiveShadow geometry={nodes.Logo.geometry} material={variantMaterials[5]} material-transparent={true} material-opacity={0.8} name='logo' />
            </RigidBody>

            {/* Kinematic rotating trimesh */}
            <RigidBody ref={diskRef} type='kinematicPosition' colliders="trimesh" >
                <mesh receiveShadow geometry={nodes.CircleStair.geometry} material={variantMaterials[1]} />
                <mesh receiveShadow geometry={nodes.CircleSlope.geometry} material={variantMaterials[1]} position={[0, 11.5, 0]} rotation-x={Math.PI} />
            </RigidBody>

            {/* Kinematic rotating pillar jumps */}
            <RigidBody ref={pillarJumpRef} type='kinematicPosition' colliders="trimesh" position={[0, 50, 110]}>
                <mesh receiveShadow geometry={nodes.PillarJumps.geometry} material={variantMaterials[1]} />
            </RigidBody>

            {/* Dynamic seesaw */}
            <RigidBody ref={seesawRef} colliders={false} position={[0, 0, 145]} rotation={[0, 0, 8 * Math.PI / 180]} >
                <CuboidCollider args={[20, 0.25, 5]} position={[0, 3.25, 0]} density={200} />
                <CylinderCollider args={[5, 1.5]} position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} density={200} />
                <mesh castShadow receiveShadow geometry={nodes.Seesaw.geometry} material={variantMaterials[4]} />
            </RigidBody>

            {/* Dynamic instanced objects */}
            <InstancedRigidBodies ref={cubeInstancesRef} instances={cubeInstances} density={200}>
                <instancedMesh castShadow receiveShadow args={[nodes.Box1X1.geometry, variantMaterials[4], cubeInstances.length]} count={cubeInstances.length} frustumCulled={false} />
            </InstancedRigidBodies>
            <InstancedRigidBodies ref={ballInstancesRef} instances={ballInstances} colliders='ball' density={200}>
                <instancedMesh castShadow receiveShadow args={[nodes.R1Ball.geometry, variantMaterials[4], ballInstances.length]} count={ballInstances.length} frustumCulled={false} />
            </InstancedRigidBodies>
            <InstancedRigidBodies ref={blockInstancesRef} instances={blockInstances} density={200}>
                <instancedMesh castShadow receiveShadow args={[nodes.Box4X6.geometry, variantMaterials[4], blockInstances.length]} count={blockInstances.length} frustumCulled={false} />
            </InstancedRigidBodies>
        </group>
    )
}

useGLTF.preload('/testMap.glb')

type GLTFResult = GLTF & {
    nodes: {
        RampJump: THREE.Mesh
        Box10X10: THREE.Mesh
        CircleSlope: THREE.Mesh
        CircleStair: THREE.Mesh
        Box05X8: THREE.Mesh
        HalfCylinder03X8: THREE.Mesh
        Ramp20: THREE.Mesh
        Ramp45: THREE.Mesh
        Ramp30: THREE.Mesh
        Ramp10: THREE.Mesh
        R10Ball: THREE.Mesh
        Logo: THREE.Mesh
        Cylinder5X40: THREE.Mesh
        Box24X24: THREE.Mesh
        RampU: THREE.Mesh
        Track: THREE.Mesh
        BaseFloor: THREE.Mesh
        Trip05X4: THREE.Mesh
        Pillar10X100: THREE.Mesh
        R80Disk: THREE.Mesh
        Box1X1: THREE.Mesh
        Box4X6: THREE.Mesh
        Seesaw: THREE.Mesh
        R1Ball: THREE.Mesh
        PillarJumps: THREE.Mesh
    }
    materials: {
        GridTexture: THREE.MeshStandardMaterial
    }
}
