import * as THREE from "three";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { Ecctrl, EcctrlAnimationStateController, type EcctrlHandle } from "../src";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "../src/camera";
import { useButtonStore, useJoystickStore } from "../src/input";
import { EcctrlVehicle, ShapeCastWheel, ThrustPropeller, type DroneConfigType, type EcctrlVehicleHandle } from "../src/vehicle";
import { CurveEditorPlugin } from "../src/leva";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useCallback, useState, useMemo, useLayoutEffect, type RefObject } from "react";
import { button, useControls, folder } from "leva";
import AnimatedCharacterModel from "./AnimatedCharacterModel";
import { BallCollider, CuboidCollider, CylinderCollider, MeshCollider } from "@react-three/rapier";
import { CapsuleCahracterModel } from "./CapsuleCharacterModel";
import { type GLTF } from 'three-stdlib'
import { useControlStore } from "./store/useControlStore";

type EcctrlWrapperProps = {
    paused?: boolean;
    timeScale?: number | RefObject<number>;
}

export default function EcctrlWrapper({ paused = false, timeScale = 1 }: EcctrlWrapperProps) {
    /**
     * Three.js scene reference
     */
    const scene = useThree((state) => state.scene)

    /**
     * Active controller state
     */
    // const [activeController, setActiveController] = useState("ecctrl") // ecctrl, vehicle1, vehicle2, vehicle3
    const activeController = useControlStore(state => state.activeController);
    const setActiveController = useControlStore(state => state.setActiveController);
    const setVehicleAccessTarget = useControlStore(state => state.setVehicleAccessTarget);

    /**
     * Ecctrl controller preset
     */
    const ecctrlRef = useRef<EcctrlHandle | null>(null);
    const ecctrlInitPosition = useMemo(() => new THREE.Vector3(0, 3, -60), [])
    const [respawnPos, setRespawnPos] = useState(ecctrlInitPosition)
    const [respawnRot, setRespawnRot] = useState(new THREE.Euler(0, 0, 0))

    /**
     * Ecctrl vehicle controller preset
     */
    // Vehicle 1
    const vehicle1Ref = useRef<EcctrlVehicleHandle | null>(null);
    const ableToAccessVehicle1 = useRef(false)
    const vehicle1InitPosition = useMemo(() => new THREE.Vector3(5, 2, -60), [])
    const vehicle1InitRotation = useMemo(() => new THREE.Vector3(0, 0, 0), [])
    // Vehicle 2
    const vehicle2Ref = useRef<EcctrlVehicleHandle | null>(null);
    const ableToAccessVehicle2 = useRef(false)
    const vehicle2InitPosition = useMemo(() => new THREE.Vector3(-5, 2, -60), [])
    const vehicle2InitRotation = useMemo(() => new THREE.Vector3(0, 0, 0), [])
    // Vehicle 3
    const vehicle3Ref = useRef<EcctrlVehicleHandle | null>(null);
    const ableToAccessVehicle3 = useRef(false)
    const vehicle3InitPosition = useMemo(() => new THREE.Vector3(0, 3, -55), [])
    const vehicle3InitRotation = useMemo(() => new THREE.Vector3(0, Math.PI, 0), [])

    const updateVehicleAccessTarget = useCallback(() => {
        if (activeController !== "ecctrl") {
            setVehicleAccessTarget(null);
            return;
        }

        if (ableToAccessVehicle1.current) {
            setVehicleAccessTarget({ controller: "vehicle1", label: "Vehicle 1" });
        } else if (ableToAccessVehicle2.current) {
            setVehicleAccessTarget({ controller: "vehicle2", label: "Vehicle 2" });
        } else if (ableToAccessVehicle3.current) {
            setVehicleAccessTarget({ controller: "vehicle3", label: "Drone" });
        } else {
            setVehicleAccessTarget(null);
        }
    }, [activeController, setVehicleAccessTarget])

    useEffect(() => () => setVehicleAccessTarget(null), [setVehicleAccessTarget])

    /**
     * Vehicle models GLTF
     */
    const vehicleModels = useGLTF('/vehicles.glb') as unknown as GLTFResult
    vehicleModels.materials.GridTexture.side = THREE.FrontSide;

    /**
     * Character exit transform calculation function
     */
    const playerExitPos = useRef<THREE.Vector3>(new THREE.Vector3())
    const playerExitRot = useRef<THREE.Euler>(new THREE.Euler())
    const exitZAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const exitXAxis = useRef<THREE.Vector3>(new THREE.Vector3())
    const exitMatrix = useRef<THREE.Matrix4>(new THREE.Matrix4())
    const computeExitTransform = useCallback((vehicleBody: EcctrlVehicleHandle, exitDirection: THREE.Vector3, exitLength: number) => {
        playerExitPos.current.copy(vehicleBody.currPos).addScaledVector(exitDirection, exitLength);
        const upAxis = vehicleBody.upAxis;
        exitZAxis.current.copy(vehicleBody.bodyZAxis).projectOnPlane(upAxis).normalize();
        exitXAxis.current.crossVectors(upAxis, exitZAxis.current);
        exitMatrix.current.makeBasis(exitXAxis.current, upAxis, exitZAxis.current);
        playerExitRot.current.setFromRotationMatrix(exitMatrix.current, "YXZ");
    }, [])

    /**
     * Character enter/exit vehicle function
     */
    const handleVehicleAccess = useCallback(() => {
        // ENTERING A VEHICLE
        if (activeController === "ecctrl") {
            if (ableToAccessVehicle1.current) {
                console.log("Entering Vehicle 1");
                setActiveController("vehicle1");
                setVehicleAccessTarget(null);
                ableToAccessVehicle1.current = false;
            } else if (ableToAccessVehicle2.current) {
                console.log("Entering Vehicle 2");
                setActiveController("vehicle2");
                setVehicleAccessTarget(null);
                ableToAccessVehicle2.current = false;
            } else if (ableToAccessVehicle3.current) {
                console.log("Entering Vehicle 3");
                setActiveController("vehicle3");
                setVehicleAccessTarget(null);
                ableToAccessVehicle3.current = false;
            }
            return;
        }

        // EXITING A VEHICLE
        switch (activeController) {
            case "vehicle1":
                if (vehicle1Ref.current) {
                    console.log(`Exiting Vehicle 1`);
                    computeExitTransform(vehicle1Ref.current, vehicle1Ref.current.bodyXAxis, 1.5);
                    setRespawnPos(playerExitPos.current);
                    setRespawnRot(playerExitRot.current);
                    setActiveController("ecctrl");
                    setVehicleAccessTarget(null);
                }
                break;
            case "vehicle2":
                if (vehicle2Ref.current) {
                    console.log(`Exiting Vehicle 2`);
                    computeExitTransform(vehicle2Ref.current, vehicle2Ref.current.bodyXAxis, 1.5);
                    setRespawnPos(playerExitPos.current);
                    setRespawnRot(playerExitRot.current);
                    setActiveController("ecctrl");
                    setVehicleAccessTarget(null);
                }
                break;
            case "vehicle3":
                if (vehicle3Ref.current) {
                    console.log(`Exiting Vehicle 3`);
                    computeExitTransform(vehicle3Ref.current, vehicle3Ref.current.upAxis, 1.5);
                    setRespawnPos(playerExitPos.current);
                    setRespawnRot(playerExitRot.current);
                    setActiveController("ecctrl");
                    setVehicleAccessTarget(null);
                }
                break;
        }
    }, [activeController, computeExitTransform, setActiveController, setVehicleAccessTarget]);

    /**
     * Ecctrl camera controller preset
     */
    const cameraUp = useRef<THREE.Vector3>(new THREE.Vector3());
    const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3());
    const cameraControlsRef = useRef<EcctrlCameraControlsHandle>(null);
    const cameraCurrDir = useRef<THREE.Vector3>(new THREE.Vector3());
    const cameraFinalDir = useRef<THREE.Vector3>(new THREE.Vector3());
    const cameraTurnCrossAxis = useRef<THREE.Vector3>(new THREE.Vector3());
    const cameraCollisionMeshes = useRef<THREE.Mesh[]>([]);
    useLayoutEffect(() => {
        const testMapGroup = scene.getObjectByName("TestMapGroup")
        if (!testMapGroup) return
        const meshes: THREE.Mesh[] = []
        testMapGroup.traverse((obj) => { if ((obj as THREE.Mesh).isMesh && !(obj as any).isInstancedMesh && !((obj as any).name === "logo")) meshes.push(obj as THREE.Mesh) })
        cameraCollisionMeshes.current = meshes
    }, [scene])

    /**
     * keyboard controls setup
     */
    const [subscribeKeys, getKeys] = useKeyboardControls()

    /**
     * Susctribe to keyboard store changes
     * Update control state when interact key change
     */
    useEffect(() => {
        const unsubscribeAccess = subscribeKeys(
            (state) => state.F,
            (value) => { if (value) handleVehicleAccess() }
        )
        return unsubscribeAccess;
    }, [handleVehicleAccess]);

    /**
     * Subscribe to joystick store changes
     * Update joystick state when joystickX/Y changes
     */
    const joystickLState = useRef({ x: 0, y: 0 });
    const joystickRState = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const unsubscribeJoystick = useJoystickStore.subscribe(
            (state) => state.joysticks.left,
            (joystick) => {
                if (!joystick) return
                joystickLState.current.x = joystick.x
                joystickLState.current.y = joystick.y
            }
        );
        return unsubscribeJoystick;
    }, []);
    useEffect(() => {
        const unsubscribeJoystick = useJoystickStore.subscribe(
            (state) => state.joysticks.right,
            (joystick) => {
                if (!joystick) return
                joystickRState.current.x = joystick.x
                joystickRState.current.y = joystick.y
            }
        );
        return unsubscribeJoystick;
    }, []);

    /**
     * Subscribe to button store changes
     */
    const buttonState = useRef({ b1: false, b2: false, b3: false });
    useEffect(() => {
        const unsubscribeButtons = useButtonStore.subscribe((({ buttons }) => {
            buttonState.current.b1 = buttons.b1;
            buttonState.current.b2 = buttons.b2;
            buttonState.current.b3 = buttons.b3;
        }))
        return unsubscribeButtons
    }, [])
    useEffect(() => {
        const unsubscribeButtons = useButtonStore.subscribe((({ buttons }) => {
            if (buttons.b4) handleVehicleAccess();
        }))
        return unsubscribeButtons
    }, [handleVehicleAccess]);

    /**
     * Character sleep function
     */
    const sleepCharacter = useCallback(() => {
        const body = ecctrlRef.current?.body;
        if (!body) return;
        if (document.visibilityState === "hidden") {
            body.sleep();
        } else {
            setTimeout(() => body.wakeUp(), 1000);
        }
    }, [])

    /**
     * Vehicle sleep function
     */
    const sleepVehicle = useCallback(() => {
        const body = vehicle1Ref.current?.body;
        if (!body) return;
        if (document.visibilityState === "hidden") {
            body.sleep();
        } else {
            setTimeout(() => body.wakeUp(), 1000);
        }
    }, [])

    /**
     * Event listeners
     */
    useEffect(() => {
        const handleVisibilityChange = () => {
            sleepCharacter()
            sleepVehicle()
        }
        window.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("visibilitychange", handleVisibilityChange);
        }
    }, [])

    /**
     * Debug settings
     */
    // Camera debug settings
    const { followPlayer, smoothTime } = useControls(
        "Camera Settings",
        {
            followPlayer: true,
            smoothTime: { value: 0.1, step: 0.01, min: 0, max: 1 },
            CameraLock: button(() => { cameraControlsRef.current?.lockPointer() }),
            FirstPerson: button(() => { cameraControlsRef.current?.dolly(cameraControlsRef.current.distance - 0.02, true) }),
        },
        { collapsed: true }
    );
    // Ecctrl settings
    const { groundDetection: ecctrlGroundDetection, animatedCharacter, ...EcctrlDebugSettings } = useControls(
        "Ecctrl Settings",
        {
            ResetPlayer: button(() => {
                ecctrlRef.current?.body.setTranslation({ x: ecctrlInitPosition.x, y: ecctrlInitPosition.y, z: ecctrlInitPosition.z }, true);
                ecctrlRef.current?.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            }),
            animatedCharacter: true,
            debug: true,
            enable: true,
            canSleep: true,

            Collider: folder({
                density: { value: 200, step: 1, min: 1, max: 1000 },
                capsuleHalfHeight: { value: 0.3, step: 0.01, min: 0.2, max: 1 },
                capsuleRadius: { value: 0.3, step: 0.01, min: 0.3, max: 0.7 },
            }, { collapsed: true }),

            ForwardDir: folder({
                toggleLockForward: button(() => ecctrlRef.current?.setLockForward(!ecctrlRef.current?.lockForward!)),
                useCameraForward: true,
                useCharacterUpForForward: false,
            }, { collapsed: true }),

            CustomeG: folder({
                enableCustomGravity: true,
                gravityDirLerpSpeed: { value: 6, step: 0.01, min: 0, max: 20 },
            }, { collapsed: true }),

            Movement: folder({
                maxWalkVel: { value: 1.1, step: 0.01, min: 0, max: 30 },
                maxRunVel: { value: 5.5, step: 0.01, min: 0, max: 30 },
                accDeltaTime: { value: 0.2, step: 0.01, min: 0, max: 1 },
                decDeltaTime: { value: 0.2, step: 0.01, min: 0, max: 1 },
                rejectVelFactor: { value: 1, step: 0.01, min: 0, max: 10 },
                moveImpulsePointOffset: { value: 0, step: 0.01, min: -1, max: 1 },
                jumpVel: { value: 6, step: 0.01, min: 0, max: 20 },
                jumpDuration: { value: 0.1, step: 0.01, min: 0, max: 0.5 },
                slopeJumpFactor: { value: 0, step: 0.01, min: 0, max: 1 },
                airDragFactor: { value: 0.1, step: 0.01, min: 0, max: 1 },
                slideGripFactor: { value: 0.5, step: 0.01, min: 0, max: 1 },
                liftGripFactor: { value: 0.16, step: 0.01, min: 0, max: 1 },
                fallingGravityScale: { value: 3, step: 0.01, min: 0, max: 20 },
                fallingMaxVel: { value: 20, step: 0.01, min: 0, max: 100 },
                enableToggleRun: true,
            }, { collapsed: true }),

            Floating: folder({
                groundDetection: { value: "shapeCast" as "shapeCast" | "rayCast", options: ["shapeCast", "rayCast"] as const },
                slopeMaxAngle: { value: 1, step: 0.01, min: 0.01, max: Math.PI / 2 },
                floatHeight: { value: 0.3, step: 0.01, min: 0, max: 5 },
                rayOriginOffest: { value: -0.35, step: 0.01, min: -1, max: 1 },
                rayHitForgiveness: { value: 0.3, step: 0.01, min: 0, max: 1 },
                rayLength: { value: 1.3, step: 0.01, min: 0, max: 5 },
                rayRadius: { value: 0.15, step: 0.01, min: 0, max: 0.5 },
                springK: { value: 6400, step: 0.01, min: 0, max: 10000 },
                dampingC: { value: 860, step: 0.01, min: 0, max: 2000 },
            }, { collapsed: true }),

            Balance: folder({
                autoBalance: true,
                autoBalanceSpringK: { value: 50, step: 0.01, min: 0, max: 200 },
                autoBalanceDampingC: { value: 3, step: 0.01, min: 0, max: 50 },
                autoBalanceSpringOnY: { value: 8, step: 0.01, min: 0, max: 200 },
                autoBalanceDampingOnY: { value: 0.76, step: 0.01, min: 0, max: 50 },
            }, { collapsed: true }),

            Platform: folder({
                followPlatform: true,
                massRatioFallOffCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0, r_out: 0 }, { x: 0.5, y: 0, r_in: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 },],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                applyCounterMass: true,
                applyCounterJumpImp: true,
                counterJumpImpFactor: { value: 1, step: 0.01, min: 0, max: 5 },
                applyCounterMoveImp: true,
                counterMoveImpFactor: { value: 1, step: 0.01, min: 0, max: 5 },
            }, { collapsed: true })
        },
        { collapsed: true }
    );
    // Vehicle 1 debug settings
    const EcctrlVehicle1Settings = useControls(
        "Vehicle 1 Body Settings",
        {
            Flip: button(() => {
                if (!vehicle1Ref.current) return
                const rotZ180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
                vehicle1Ref.current.body.setRotation(vehicle1Ref.current.currQuat.multiply(rotZ180), true);
            }),
            enable: true,
            canSleep: true,
            position: { value: [vehicle1InitPosition.x, vehicle1InitPosition.y, vehicle1InitPosition.z], step: 0.1 },
            rotation: { value: [vehicle1InitRotation.x, vehicle1InitRotation.y, vehicle1InitRotation.z], step: 0.1 },
            CustomeG: folder({
                enableCustomGravity: true,
                gravityDirLerpSpeed: { value: 6, step: 0.01, min: 0, max: 20 },
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const EcctrlVehicle1CarConfig = useControls(
        "Vehicle 1 Body Settings",
        {
            CarControl: folder({
                engineHorsepower: { value: 600, step: 1, min: 0, max: 2000 },
                engineMaxRPM: { value: 6000, step: 100, min: 500, max: 12000 },
                finalDriveRatio: { value: 1, step: 0.1, min: 0.1, max: 10 },
                transmissionMode: { value: "auto" as "auto" | "manual", options: ["auto", "manual"] as const },
                shiftUpRPM: { value: 5200, step: 100, min: 500, max: 12000 },
                shiftDownRPM: { value: 2200, step: 100, min: 500, max: 12000 },
                shiftCooldown: { value: 0.35, step: 0.01, min: 0, max: 2 },
                steerRate: { value: Math.PI * 2, step: 0.01, min: 0, max: Math.PI * 8 },
                maxSteerAngle: { value: Math.PI / 6, step: 0.01, min: 0, max: Math.PI / 2 },
                reverseTorqueScale: { value: 1, step: 0.01, min: 0, max: 2 },
                reverseRPMScale: { value: 0.5, step: 0.01, min: 0, max: 1 },
                engineTorqueCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 1, r_out: 0 }, { x: 1, y: 0, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                steerAngleCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 1, r_out: 0 }, { x: 0.2, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.4, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const EcctrlVehicle1WheelSettings = useControls(
        "Vehicle 1 Wheel Settings",
        {
            Layout: folder({
                offset: { value: { x: 0.9, y: 0, z: 1.8 }, step: 0.01 },
            }, { collapsed: true }),
            ShapeCast: folder({
                groundDetection: { value: "shapeCast" as "shapeCast" | "rayCast", options: ["shapeCast", "rayCast"] as const },
                rayShapeR: { value: 0.5, step: 0.01, min: 0, max: 2 },
                rayShapeH: { value: 0.15, step: 0.01, min: 0, max: 2 },
                rayLength: { value: 0.5, step: 0.01 },
                springK: { value: 38000, step: 100, min: 0, max: 100000 },
                dampingC: { value: 4000, step: 100, min: 0, max: 20000 },
            }, { collapsed: true }),
            Brake: folder({
                maxBrakeTorque: { value: 3000, step: 10, min: 0, max: 10000 },
                rollingResistanceCoef: { value: 0.007, step: 0.001, min: 0, max: 0.1 },
            }, { collapsed: true }),
            Friction: folder({
                lowVelThreshold: { value: 0.4, step: 0.01, min: 0, max: 10 },
                tireGripFactor: { value: 1.3, step: 0.01, min: 0, max: 5 },
                lngFrictionEllipseScale: { value: 1, step: 0.01, min: 0, max: 3 },
                latFrictionEllipseScale: { value: 1, step: 0.01, min: 0, max: 3 },
                relaxLngRate: { value: 0.05, step: 0.001, min: 0.001, max: 0.1 },
                relaxLatRate: { value: 0.1, step: 0.001, min: 0.001, max: 0.1 },
                minLngRelaxCoeff: { value: 0.3, step: 0.01, min: 0, max: 1 },
                minLatRelaxCoeff: { value: 0.3, step: 0.01, min: 0, max: 1 },
                lngSlipRatioCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.25, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.7, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                latSlipRatioCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.15, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.9, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
            }, { collapsed: true }),
            MovingPlatform: folder({
                followPlatform: true,
                massRatioFallOffCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0.5, r_out: 0 }, { x: 0.5, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                applyCounterMass: true,
                applyCounterFriction: true,
            }, { collapsed: true }),
            Model: folder({
                showWheelModel: true,
                wheelModelDensity: { value: 100, step: 1, min: 0, max: 500 },
                wheelModelUpdate: true,
                wheelModelRadius: { value: 0.5, step: 0.01, min: 0.1, max: 2 },
                wheelModelLerpPosRate: { value: 10, step: 0.1, min: 0, max: 50 },
                wheelModelReversRotation: false,
            }, { collapsed: true }),
            Debugger: folder({
                debug: true,
                debuggerArrowScale: { value: 0.02, step: 0.001, min: 0, max: 1 },
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const { offset: vehicle1WheelOffset, ...EcctrlVehicle1WheelProps } = EcctrlVehicle1WheelSettings
    // Vehicle 2 debug settings
    const EcctrlVehicle2Settings = useControls(
        "Vehicle 2 Body Settings",
        {
            Flip: button(() => {
                if (!vehicle2Ref.current) return
                const rotZ180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
                vehicle2Ref.current.body.setRotation(vehicle2Ref.current.currQuat.multiply(rotZ180), true);
            }),
            enable: true,
            canSleep: true,
            position: { value: [vehicle2InitPosition.x, vehicle2InitPosition.y, vehicle2InitPosition.z], step: 0.1 },
            rotation: { value: [vehicle2InitRotation.x, vehicle2InitRotation.y, vehicle2InitRotation.z], step: 0.1 },
            CustomeG: folder({
                enableCustomGravity: true,
                gravityDirLerpSpeed: { value: 6, step: 0.01, min: 0, max: 20 },
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const EcctrlVehicle2CarConfig = useControls(
        "Vehicle 2 Body Settings",
        {
            CarControl: folder({
                engineHorsepower: { value: 600, step: 1, min: 0, max: 2000 },
                engineMaxRPM: { value: 6000, step: 100, min: 500, max: 12000 },
                finalDriveRatio: { value: 1, step: 0.1, min: 0.1, max: 10 },
                transmissionMode: { value: "auto" as "auto" | "manual", options: ["auto", "manual"] as const },
                shiftUpRPM: { value: 5200, step: 100, min: 500, max: 12000 },
                shiftDownRPM: { value: 2200, step: 100, min: 500, max: 12000 },
                shiftCooldown: { value: 0.35, step: 0.01, min: 0, max: 2 },
                steerRate: { value: Math.PI * 2, step: 0.01, min: 0, max: Math.PI * 8 },
                maxSteerAngle: { value: Math.PI / 6, step: 0.01, min: 0, max: Math.PI / 2 },
                reverseTorqueScale: { value: 1, step: 0.01, min: 0, max: 2 },
                reverseRPMScale: { value: 0.5, step: 0.01, min: 0, max: 1 },
                engineTorqueCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 1, r_out: 0 }, { x: 1, y: 0, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                steerAngleCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 1, r_out: 0 }, { x: 0.2, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.4, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const EcctrlVehicle2WheelSettings = useControls(
        "Vehicle 2 Wheel Settings",
        {
            Layout: folder({
                offset: { value: { x: 0.85, y: 0, z: 1.5 }, step: 0.01 },
            }, { collapsed: true }),
            ShapeCast: folder({
                groundDetection: { value: "shapeCast" as "shapeCast" | "rayCast", options: ["shapeCast", "rayCast"] as const },
                rayShapeR: { value: 0.5, step: 0.01, min: 0, max: 2 },
                rayShapeH: { value: 0.15, step: 0.01, min: 0, max: 2 },
                rayLength: { value: 0.5, step: 0.01 },
                springK: { value: 25000, step: 100, min: 0, max: 100000 },
                dampingC: { value: 3200, step: 100, min: 0, max: 20000 },
            }, { collapsed: true }),
            Brake: folder({
                frontMaxBrakeTorque: { value: 2600, step: 10, min: 0, max: 10000 },
                rearMaxBrakeTorque: { value: 1800, step: 10, min: 0, max: 10000 },
                rollingResistanceCoef: { value: 0.007, step: 0.001, min: 0, max: 0.1 },
            }, { collapsed: true }),
            Friction: folder({
                lowVelThreshold: { value: 0.4, step: 0.01, min: 0, max: 10 },
                tireGripFactor: { value: 1.3, step: 0.01, min: 0, max: 5 },
                lngFrictionEllipseScale: { value: 1, step: 0.01, min: 0, max: 3 },
                latFrictionEllipseScale: { value: 1, step: 0.01, min: 0, max: 3 },
                relaxLngRate: { value: 0.05, step: 0.001, min: 0.001, max: 0.1 },
                relaxLatRate: { value: 0.1, step: 0.001, min: 0.001, max: 0.1 },
                minLngRelaxCoeff: { value: 0.3, step: 0.01, min: 0, max: 1 },
                minLatRelaxCoeff: { value: 0.3, step: 0.01, min: 0, max: 1 },
                lngSlipRatioCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.25, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.7, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                latSlipRatioCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.15, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.9, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
            }, { collapsed: true }),
            MovingPlatform: folder({
                followPlatform: true,
                massRatioFallOffCurveData: CurveEditorPlugin({
                    points: [{ x: 0, y: 0.5, r_out: 0 }, { x: 0.5, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 }],
                    samples: { value: 50, min: 2, max: 500, step: 1 },
                }),
                applyCounterMass: true,
                applyCounterFriction: true,
            }, { collapsed: true }),
            Model: folder({
                showWheelModel: true,
                wheelModelDensity: { value: 100, step: 1, min: 0, max: 500 },
                wheelModelUpdate: true,
                wheelModelRadius: { value: 0.5, step: 0.01, min: 0.1, max: 2 },
                wheelModelLerpPosRate: { value: 10, step: 0.1, min: 0, max: 50 },
                wheelModelReversRotation: false,
            }, { collapsed: true }),
            Debugger: folder({
                debug: true,
                debuggerArrowScale: { value: 0.02, step: 0.001, min: 0, max: 1 },
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const { offset: vehicle2WheelOffset, frontMaxBrakeTorque: vehicle2FrontMaxBrakeTorque, rearMaxBrakeTorque: vehicle2RearMaxBrakeTorque, ...EcctrlVehicle2WheelProps } = EcctrlVehicle2WheelSettings
    // Vehicle 3 debug settings
    const EcctrlVehicle3Settings = useControls(
        "Vehicle 3 Body Settings",
        {
            Flip: button(() => {
                if (!vehicle3Ref.current) return
                const rotZ180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
                vehicle3Ref.current.body.setRotation(vehicle3Ref.current.currQuat.multiply(rotZ180), true);
            }),
            enable: true,
            canSleep: true,
            position: { value: [vehicle3InitPosition.x, vehicle3InitPosition.y, vehicle3InitPosition.z], step: 0.1 },
            rotation: { value: [vehicle3InitRotation.x, vehicle3InitRotation.y, vehicle3InitRotation.z], step: 0.1 },
            CustomeG: folder({
                enableCustomGravity: true,
                gravityDirLerpSpeed: { value: 6, step: 0.01, min: 0, max: 20 },
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const [EcctrlVehicle3DroneConfig, setDroneConfig] = useControls(
        "Vehicle 3 Body Settings",
        () => ({
            DroneControl: folder({
                controlMode: { value: "POSITION", options: ["VELOCITY", "POSITION"] },
                maxYawRate: { value: 2, step: 0.01, min: 0, max: 10 },
                maxHorizSpeed: { value: 20, step: 0.01, min: 0, max: 50 },
                maxVertSpeed: { value: 8, step: 0.01, min: 0, max: 50 },
                maxTiltAngle: { value: Math.PI / 4, step: 0.01, min: 0, max: Math.PI / 4 },
                airDragFactor: { value: 0.2, step: 0.01, min: 0, max: 1 },
                TILT_P: { value: 15, step: 0.1, min: 0, max: 30 },
                TILT_D: { value: 3, step: 0.1, min: 0, max: 30 },
                YAW_P: { value: 4, step: 0.01, min: 0, max: 10 },
                VERT_POS_P: { value: 900, step: 0.1, min: 0, max: 1000 },
                VERT_POS_D: { value: 700, step: 0.1, min: 0, max: 1000 },
                HORIZ_POS_P: { value: 500, step: 0.1, min: 0, max: 1000 },
                HORIZ_POS_D: { value: 550, step: 0.1, min: 0, max: 1000 },
                HORIZ_VEL_P: { value: 1, step: 0.1, min: 0, max: 30 },
                VERT_VEL_P: { value: 2, step: 0.1, min: 0, max: 30 },
            }, { collapsed: true }),
        }), { collapsed: true }
    )
    const EcctrlVehicle3PropellerSettings = useControls(
        "Vehicle 3 Propeller Settings",
        {
            Layout: folder({
                offset: { value: { x: 1, y: -0.15, z: 1 }, step: 0.01 },
            }, { collapsed: true }),
            Thrust: folder({
                maxThrust: { value: 5000, step: 0.1, min: 0, max: 10000 },
                torqueRatio: { value: 0.6, step: 0.01, min: 0, max: 1 },
            }, { collapsed: true }),
            Model: folder({
                showPropellerModel: true,
                propellerModelUpdate: true,
                propellerModelMaxSpin: { value: 50, step: 0.1, min: 0, max: 200 },
                propellerModelLerpSpinRate: { value: 10, step: 0.1, min: 0, max: 50 },
            }, { collapsed: true }),
            Debugger: folder({
                debug: true,
                debuggerScale: { value: 1, step: 0.01, min: 0, max: 5 },
                debuggerArrowScale: { value: 5, step: 0.01, min: 0, max: 50 },
            }, { collapsed: true }),
        }, { collapsed: true }
    )
    const { offset: vehicle3PropellerOffset, ...EcctrlVehicle3PropellerProps } = EcctrlVehicle3PropellerSettings

    /**
     * Optional:
     * Active drone position control mode when character takes off from drone,
     * Active drone velocity control mode when character takes on drone
     */
    useEffect(() => { vehicle3Ref.current?.setTarget(vehicle3InitPosition, new THREE.Vector3(0, 0, 1)) }, [vehicle3InitPosition])
    useEffect(() => {
        if (!vehicle3Ref.current) return
        if (activeController === "ecctrl" && EcctrlVehicle3DroneConfig.controlMode === "VELOCITY") {
            vehicle3Ref.current.setTarget(vehicle3Ref.current.currPos, vehicle3Ref.current.bodyZAxis);
            setDroneConfig({ controlMode: "POSITION" });
        } else if (activeController === "vehicle3" && EcctrlVehicle3DroneConfig.controlMode === "POSITION") {
            setDroneConfig({ controlMode: "VELOCITY" });
        }
    }, [activeController])

    /**
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     * 
     */

    useFrame((state, delta) => {
        /**
         * Getting all the useful keys from useKeyboardControls
         */
        const keys = getKeys()

        /**
         * Toggle controller state
         * Player get in/off from vehicles
         */
        switch (activeController) {
            case "ecctrl":
                if (ecctrlRef.current && ecctrlRef.current.body) {
                    if (ecctrlRef.current.currPos.lengthSq() > 0) {
                        // Update camera follow target
                        cameraTarget.current.copy(ecctrlRef.current.currPos).addScaledVector(ecctrlRef.current.bodyYAxis, 0.5)
                        // Update camera up direction
                        cameraUp.current.copy(ecctrlRef.current.upAxis)
                    }

                    // Update character movement based on keyPress/joystick/virtualButton
                    ecctrlRef.current.setMovement({
                        forward: keys.W || keys.Up,
                        backward: keys.S || keys.Down,
                        leftward: keys.A || keys.Left,
                        rightward: keys.D || keys.Right,
                        joystick: joystickLState.current,
                        run: keys.Shift || buttonState.current.b1,
                        jump: keys.Space || buttonState.current.b2,
                    })
                }
                break;
            case "vehicle1":
                if (vehicle1Ref.current && vehicle1Ref.current.body) {
                    // Update camera follow target
                    cameraTarget.current.copy(vehicle1Ref.current.currPos).addScaledVector(vehicle1Ref.current.bodyYAxis, 0.5)
                    // Update camera up direction
                    cameraUp.current.copy(vehicle1Ref.current.upAxis)

                    // Update vehicle 1 movement based on keyPress/joystick/virtualButton
                    vehicle1Ref.current.setMovement({
                        forward: keys.W || keys.Up || buttonState.current.b3,
                        backward: keys.S || keys.Down || buttonState.current.b1,
                        steerLeft: keys.A || keys.Left,
                        steerRight: keys.D || keys.Right,
                        joystickL: joystickLState.current,
                        brake: keys.Space || buttonState.current.b2,
                    })
                }
                break;
            case "vehicle2":
                if (vehicle2Ref.current && vehicle2Ref.current.body) {
                    // Update camera follow target
                    cameraTarget.current.copy(vehicle2Ref.current.currPos).addScaledVector(vehicle2Ref.current.bodyYAxis, 0.5)
                    // Update camera up direction
                    cameraUp.current.copy(vehicle2Ref.current.upAxis)

                    // Update vehicle 2 movement based on keyPress/joystick/virtualButton
                    vehicle2Ref.current.setMovement({
                        forward: keys.W || keys.Up || buttonState.current.b3,
                        backward: keys.S || keys.Down || buttonState.current.b1,
                        steerLeft: keys.A || keys.Left,
                        steerRight: keys.D || keys.Right,
                        joystickL: joystickLState.current,
                        brake: keys.Space || buttonState.current.b2,
                    })
                }
                break;
            case "vehicle3":
                if (vehicle3Ref.current && vehicle3Ref.current.body) {
                    // Update camera follow target
                    cameraTarget.current.copy(vehicle3Ref.current.currPos).addScaledVector(vehicle3Ref.current.bodyYAxis, 0.5)
                    // Update camera up direction
                    cameraUp.current.copy(vehicle3Ref.current.upAxis)

                    // Update vehicle 3 movement based on keyPress/joystick/virtualButton
                    vehicle3Ref.current.setMovement({
                        throttleUp: keys.W,
                        throttleDown: keys.S,
                        yawLeft: keys.A,
                        yawRight: keys.D,
                        pitchForward: keys.Up,
                        pitchBackward: keys.Down,
                        rollLeft: keys.Left,
                        rollRight: keys.Right,
                        joystickL: joystickLState.current,
                        joystickR: joystickRState.current,
                    })
                }
                break;
            default:
                cameraTarget.current.set(0, 0, 0)
                cameraUp.current.set(0, 1, 0)
                break;
        }

        // Update camera follow target and up direction
        if (cameraControlsRef.current && followPlayer) {
            // Move camera pivot to target position
            cameraControlsRef.current.moveTo(cameraTarget.current.x, cameraTarget.current.y, cameraTarget.current.z, true)
            // Lerp camera up direction
            state.camera.up.lerp(cameraUp.current, 0.1);
            // Update camera controls up direction
            cameraControlsRef.current.setUp(state.camera.up)
        }

        /**
         * Optional:
         * Durning ecctrl character control mode
         * Camera rotation to align with platform rotate direction
         */
        if (activeController === "ecctrl" && ecctrlRef.current && ecctrlRef.current.isOnPlatform && cameraControlsRef.current && followPlayer) {
            // Get current camera direction projected on character horizontal plane
            state.camera.getWorldDirection(cameraCurrDir.current).projectOnPlane(cameraUp.current).normalize();
            // Apply character turnOnYQuat to get final desired camera direction
            cameraFinalDir.current.copy(cameraCurrDir.current).applyQuaternion(ecctrlRef.current.turnOnYQuat)
            // Calculate rotation angle and sign between current and final direction
            cameraTurnCrossAxis.current.crossVectors(cameraCurrDir.current, cameraFinalDir.current);
            let dot = THREE.MathUtils.clamp(cameraCurrDir.current.dot(cameraFinalDir.current), -1, 1);
            if (Math.abs(dot) < 1e-10) dot = 0 // prevent dot=-0
            const angle = Math.atan2(cameraTurnCrossAxis.current.dot(cameraUp.current), dot);
            // Apply rotation to camera controls
            cameraControlsRef.current.rotate(angle, 0, true)
        }

        /**
         * Optional:
         * Durning vehicle control mode
         * If camera is not in action, camera rotation to align with vehicle body direction
         */
        if (activeController !== "ecctrl" && cameraControlsRef.current && followPlayer) {
            // Get reference to active vehicle
            let vehicleRef;
            if (activeController === "vehicle1") vehicleRef = vehicle1Ref;
            else if (activeController === "vehicle2") vehicleRef = vehicle2Ref;
            else vehicleRef = vehicle3Ref;

            // Apply camera rotation only if camera is not in action
            if (vehicleRef.current && cameraControlsRef.current.currentAction === 0) {
                // Get current camera direction projected on vehicle horizontal plane
                state.camera.getWorldDirection(cameraCurrDir.current).projectOnPlane(cameraUp.current).normalize();
                // Get target camera direction, aligned with vehicle body direction
                cameraFinalDir.current.copy(vehicleRef.current.bodyZAxis).projectOnPlane(cameraUp.current).normalize()
                // Calculate rotation angle and sign between current and final direction
                cameraTurnCrossAxis.current.crossVectors(cameraCurrDir.current, cameraFinalDir.current);
                let dot = THREE.MathUtils.clamp(cameraCurrDir.current.dot(cameraFinalDir.current), -1, 1);
                if (Math.abs(dot) < 1e-10) dot = 0 // prevent dot=-0
                const angle = Math.atan2(cameraTurnCrossAxis.current.dot(cameraUp.current), dot);
                // Apply rotation to camera controls
                cameraControlsRef.current.rotate(angle * 5 * delta, 0, true)
            }
        }

        /**
         * Optional:
         * Coastal World liked camera rotation 
         */
        // if (keys.Right) cameraControlsRef.current?.rotate(-0.05, 0, true);
        // if (keys.Left) cameraControlsRef.current?.rotate(0.05, 0, true);

    })

    return (
        <>
            {/* Camera controls */}
            <EcctrlCameraControls ref={cameraControlsRef} makeDefault minPolarAngle={0.1} maxPolarAngle={Math.PI - 0.1} smoothTime={smoothTime} colliderMeshes={cameraCollisionMeshes.current} />

            {/* Ecctrl character controls*/}
            {activeController === "ecctrl" && <Ecctrl
                ref={ecctrlRef}
                {...EcctrlDebugSettings}
                groundDetection={ecctrlGroundDetection}
                enable={!paused && EcctrlDebugSettings.enable}
                position={respawnPos}
                rotation={respawnRot}
                userData={{ ecctrl: { excludeVehicleRay: true } }}
            >
                {animatedCharacter && <EcctrlAnimationStateController ecctrl={ecctrlRef} enabled={!paused && EcctrlDebugSettings.enable} />}
                {animatedCharacter
                    ? <AnimatedCharacterModel paused={paused || !EcctrlDebugSettings.enable} timeScale={timeScale} />
                    : <CapsuleCahracterModel position={[0, -0.6, 0]} />
                }
            </Ecctrl>}

            {/* Ecctrl vehicle controls */}
            {/* Vehicle 1 */}
            <EcctrlVehicle ref={vehicle1Ref} {...EcctrlVehicle1Settings} carConfig={EcctrlVehicle1CarConfig} enable={!paused && EcctrlVehicle1Settings.enable} >
                {/* Body collider */}
                <CuboidCollider args={[1, 0.4, 2.4]} position={[0, 0.1, 0]} density={200} />
                <mesh castShadow receiveShadow geometry={vehicleModels.nodes.VehicleBody1.geometry} material={vehicleModels.materials.GridTexture} position={[0, 0.1, 0]} />
                {/* <MeshCollider type="hull" >
                    <mesh castShadow receiveShadow geometry={vehicleModels.nodes.VehicleBody1.geometry} material={vehicleModels.materials.GridTexture} position={[0, 0.1, 0]} />
                </MeshCollider> */}

                {/* Shape cast wheels */}
                <ShapeCastWheel {...EcctrlVehicle1WheelProps} enable={!paused} steerWheel brakeWheel driveWheel
                    position={[vehicle1WheelOffset.x, vehicle1WheelOffset.y, vehicle1WheelOffset.z]} >
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                <ShapeCastWheel {...EcctrlVehicle1WheelProps} enable={!paused} steerWheel brakeWheel driveWheel
                    position={[-vehicle1WheelOffset.x, vehicle1WheelOffset.y, vehicle1WheelOffset.z]}>
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                <ShapeCastWheel {...EcctrlVehicle1WheelProps} enable={!paused} driveWheel brakeWheel
                    position={[vehicle1WheelOffset.x, vehicle1WheelOffset.y, -vehicle1WheelOffset.z]} >
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                <ShapeCastWheel {...EcctrlVehicle1WheelProps} enable={!paused} driveWheel brakeWheel
                    position={[-vehicle1WheelOffset.x, vehicle1WheelOffset.y, -vehicle1WheelOffset.z]} >
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>

                {/* Interactive sensor */}
                <CylinderCollider sensor args={[0.4, 1.5]} position={[0, 0.1, 0]} mass={0}
                    onIntersectionEnter={(e) => {
                        if (e.colliderObject && e.colliderObject.name === "character-capsule-collider") {
                            ableToAccessVehicle1.current = true;
                            updateVehicleAccessTarget();
                        }
                    }}
                    onIntersectionExit={(e) => {
                        if (e.colliderObject && e.colliderObject.name === "character-capsule-collider") {
                            ableToAccessVehicle1.current = false;
                            updateVehicleAccessTarget();
                        }
                    }}
                />
            </EcctrlVehicle >

            {/* Vehicle 2 */}
            < EcctrlVehicle ref={vehicle2Ref} {...EcctrlVehicle2Settings} carConfig={EcctrlVehicle2CarConfig} enable={!paused && EcctrlVehicle2Settings.enable} >
                {/* Body collider */}
                <CuboidCollider args={[0.8, 0.17, 1]} position={[0, 0.5, -0.6]} density={100} />
                <CuboidCollider args={[1, 0.3, 2.4]} position={[0, 0, 0]} density={200} />
                <mesh castShadow receiveShadow geometry={vehicleModels.nodes.VehicleBody4.geometry} material={vehicleModels.materials.GridTexture} position={[0, -0.3, -0.7]} />
                {/* <MeshCollider type="hull">
                    <mesh castShadow receiveShadow geometry={vehicleModels.nodes.VehicleBody4.geometry} material={vehicleModels.materials.GridTexture} position={[0, -0, 0.3]} />
                </MeshCollider> */}

                {/* Shape cast wheels */}
                <ShapeCastWheel {...EcctrlVehicle2WheelProps} enable={!paused} steerWheel brakeWheel driveWheel
                    maxBrakeTorque={vehicle2FrontMaxBrakeTorque}
                    position={[vehicle2WheelOffset.x, vehicle2WheelOffset.y, vehicle2WheelOffset.z]} >
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                <ShapeCastWheel {...EcctrlVehicle2WheelProps} enable={!paused} steerWheel brakeWheel driveWheel
                    maxBrakeTorque={vehicle2FrontMaxBrakeTorque}
                    position={[-vehicle2WheelOffset.x, vehicle2WheelOffset.y, vehicle2WheelOffset.z]}>
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                <ShapeCastWheel {...EcctrlVehicle2WheelProps} enable={!paused} brakeWheel driveWheel driveTorqueWeight={2}
                    maxBrakeTorque={vehicle2RearMaxBrakeTorque}
                    position={[vehicle2WheelOffset.x, vehicle2WheelOffset.y, -vehicle2WheelOffset.z]} >
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                <ShapeCastWheel {...EcctrlVehicle2WheelProps} enable={!paused} brakeWheel driveWheel driveTorqueWeight={2}
                    maxBrakeTorque={vehicle2RearMaxBrakeTorque}
                    position={[-vehicle2WheelOffset.x, vehicle2WheelOffset.y, -vehicle2WheelOffset.z]} >
                    <mesh castShadow geometry={vehicleModels.nodes.R05Wheel.geometry} material={vehicleModels.materials.GridTexture} rotation={[0, 0, Math.PI / 2]} />
                </ShapeCastWheel>
                {/* Interactive sensor */}
                <CylinderCollider sensor args={[0.3, 1.5]} mass={0}
                    onIntersectionEnter={(e) => {
                        if (e.colliderObject && e.colliderObject.name === "character-capsule-collider") {
                            ableToAccessVehicle2.current = true;
                            updateVehicleAccessTarget();
                        }
                    }}
                    onIntersectionExit={(e) => {
                        if (e.colliderObject && e.colliderObject.name === "character-capsule-collider") {
                            ableToAccessVehicle2.current = false;
                            updateVehicleAccessTarget();
                        }
                    }}
                />
            </EcctrlVehicle >

            {/* Vehicle 3 */}
            < EcctrlVehicle ref={vehicle3Ref} {...EcctrlVehicle3Settings} droneConfig={EcctrlVehicle3DroneConfig as Partial<DroneConfigType>} enable={!paused && EcctrlVehicle3Settings.enable} >
                {/* Body collider */}
                <CuboidCollider args={[0.4, 0.2, 1.5]} density={200} />
                <CylinderCollider args={[0.05, 0.65]} position={[1, -0.15, 1]} density={200} />
                <CylinderCollider args={[0.05, 0.65]} position={[1, -0.15, -1]} density={200} />
                <CylinderCollider args={[0.05, 0.65]} position={[-1, -0.15, 1]} density={200} />
                <CylinderCollider args={[0.05, 0.65]} position={[-1, -0.15, -1]} density={200} />
                <mesh castShadow receiveShadow geometry={vehicleModels.nodes.VehicleBody3.geometry} material={vehicleModels.materials.GridTexture} />

                {/* Propellers */}
                <ThrustPropeller {...EcctrlVehicle3PropellerProps} enable={!paused} invertTorque position={[vehicle3PropellerOffset.x, vehicle3PropellerOffset.y, vehicle3PropellerOffset.z]}>
                    <mesh castShadow geometry={vehicleModels.nodes.R065Propeller.geometry} material={vehicleModels.materials.GridTexture} />
                </ThrustPropeller>
                <ThrustPropeller {...EcctrlVehicle3PropellerProps} enable={!paused} position={[-vehicle3PropellerOffset.x, vehicle3PropellerOffset.y, vehicle3PropellerOffset.z]}>
                    <mesh castShadow geometry={vehicleModels.nodes.R065Propeller.geometry} material={vehicleModels.materials.GridTexture} />
                </ThrustPropeller>
                <ThrustPropeller {...EcctrlVehicle3PropellerProps} enable={!paused} position={[vehicle3PropellerOffset.x, vehicle3PropellerOffset.y, -vehicle3PropellerOffset.z]}>
                    <mesh castShadow geometry={vehicleModels.nodes.R065Propeller.geometry} material={vehicleModels.materials.GridTexture} />
                </ThrustPropeller>
                <ThrustPropeller {...EcctrlVehicle3PropellerProps} enable={!paused} invertTorque position={[-vehicle3PropellerOffset.x, vehicle3PropellerOffset.y, -vehicle3PropellerOffset.z]}>
                    <mesh castShadow geometry={vehicleModels.nodes.R065Propeller.geometry} material={vehicleModels.materials.GridTexture} />
                </ThrustPropeller>

                {/* Interactive sensor */}
                <BallCollider sensor args={[1]} mass={0}
                    onIntersectionEnter={(e) => {
                        if (e.colliderObject && e.colliderObject.name === "character-capsule-collider") {
                            ableToAccessVehicle3.current = true;
                            updateVehicleAccessTarget();
                        }
                    }}
                    onIntersectionExit={(e) => {
                        if (e.colliderObject && e.colliderObject.name === "character-capsule-collider") {
                            ableToAccessVehicle3.current = false;
                            updateVehicleAccessTarget();
                        }
                    }}
                />
            </EcctrlVehicle >
        </>
    )
}

useGLTF.preload('/vehicles.glb')

type GLTFResult = GLTF & {
    nodes: {
        R05Wheel: THREE.Mesh
        VehicleBody1: THREE.Mesh
        VehicleBody2: THREE.Mesh
        R05Propeller: THREE.Mesh
        R065Propeller: THREE.Mesh
        VehicleBody3: THREE.Mesh
        VehicleBody4: THREE.Mesh
    }
    materials: {
        GridTexture: THREE.MeshStandardMaterial
    }
}
