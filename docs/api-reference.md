# Ecctrl API and Configuration Guide

This guide documents the public Ecctrl API, exported types, default values, and runtime data available through refs and stores.

The README is the high-level introduction. This file is the reference document for configuration and integration.

## Import Paths

Ecctrl is split into subpath exports so you can import only the systems you use.

```ts
import { Ecctrl } from "ecctrl";
import { EcctrlVehicle, ShapeCastWheel, ThrustPropeller } from "ecctrl/vehicle";
import { Joystick, VirtualButton } from "ecctrl/input";
import { EcctrlAnimationStateController } from "ecctrl/animation";
import { useCustomGravity } from "ecctrl/gravity";
import { EcctrlCameraControls } from "ecctrl/camera";
import { TimeControl } from "ecctrl/time";
import { bakeCurveLUT, evaluateCurveLUT } from "ecctrl/curves";
import { CurveEditorPlugin } from "ecctrl/leva";
```

`ecctrl/all` re-exports every public subpath and is useful for examples or prototypes.

## Package Exports

| Path | Main exports |
| --- | --- |
| `ecctrl` | `Ecctrl`, character types, animation exports, `EcctrlUserDataType` |
| `ecctrl/vehicle` | `EcctrlVehicle`, `ShapeCastWheel`, `ThrustPropeller`, vehicle/wheel/propeller types |
| `ecctrl/input` | `Joystick`, `VirtualButton`, `useJoystickStore`, `useButtonStore` |
| `ecctrl/animation` | `EcctrlAnimationStateController`, animation store, resolver, animation state types |
| `ecctrl/gravity` | `useCustomGravity` |
| `ecctrl/camera` | `EcctrlCameraControls` |
| `ecctrl/time` | `TimeControl` |
| `ecctrl/curves` | `bakeCurveLUT`, `evaluateCurveLUT`, curve types |
| `ecctrl/leva` | `CurveEditorPlugin`, Leva curve editor types |
| `ecctrl/utils` | Shared utility exports |
| `ecctrl/all` | All public exports |

## Common Notes

- Ecctrl components are designed for `@react-three/fiber` and `@react-three/rapier`.
- `Ecctrl` and `EcctrlVehicle` extend Rapier `RigidBodyProps`, so you can pass normal rigid body props such as `position`, `rotation`, `canSleep`, `density`, `gravityScale`, and `userData`.
- Default controller values are tuned for the default Rapier density/mass scale, roughly `density={1}`. If you use much heavier bodies, such as the demo's `density={200}`, suspension, damping, engine power, braking torque, and thrust values need to be scaled up accordingly.
- `ShapeCastWheel` and `ThrustPropeller` accept their underlying R3F `group` props through intersection types.
- `JoystickProps` and `VirtualButtonProps` extend DOM attributes for typing compatibility, but the current components only consume the documented `id`, `label`, and style props.
- Many handle values are live objects stored in refs. For example, `currPos` is a `THREE.Vector3` object that updates over time. Read it directly during `useFrame`; clone it if you need a persistent snapshot.
- `readonly` runtime data is intended for reading. Use setter functions such as `setMovement`, `setTarget`, and `setGear` for control.

## Ecctrl

Import:

```ts
import { Ecctrl, type EcctrlHandle, type EcctrlProps } from "ecctrl";
```

Basic usage:

```tsx
const ecctrl = useRef<EcctrlHandle>(null);

<Ecctrl ref={ecctrl}>
  <CharacterModel />
</Ecctrl>
```

### EcctrlProps

`EcctrlProps` extends `RigidBodyProps`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | `undefined` | Character model or child content inside the rigid body. |
| `debug` | `boolean` | `false` | Shows debug indicators. |
| `enable` | `boolean` | `true` | Runs the controller update loop when true. Set false to skip the whole Ecctrl algorithm. |
| `capsuleHalfHeight` | `number` | `0.3` | Half height of the capsule collider. |
| `capsuleRadius` | `number` | `0.3` | Radius of the capsule collider. |
| `lockForward` | `boolean` | `false` | Locks movement/turning toward the forward direction instead of input direction. Can also be changed with `setLockForward`. |
| `useCustomForward` | `boolean` | `false` | Uses the custom forward vector set by `setForwardDir` instead of camera forward. |
| `useCharacterUpAxis` | `boolean` | `false` | Uses the character local up axis as the movement reference up axis. |
| `enableCustomGravity` | `boolean` | `false` | Reads and applies gravity from `useCustomGravity`. |
| `gravityDirLerpSpeed` | `number` | `6` | Smooth speed for gravity direction/up-axis changes. |
| `maxWalkVel` | `number` | `2` | Target walking speed. |
| `maxRunVel` | `number` | `5` | Target running speed. |
| `accDeltaTime` | `number` | `0.2` | Movement acceleration response factor. |
| `decDeltaTime` | `number` | `0.2` | Deceleration/friction response factor used when damping relative planar velocity on ground. |
| `rejectVelFactor` | `number` | `1` | Rejects sideways velocity while moving. |
| `moveImpulsePointOffset` | `number` | `0.5` | Offset along character Y axis for the movement impulse point. |
| `jumpVel` | `number` | `5` | Upward jump velocity. |
| `jumpDuration` | `number` | `0.1` | Time window where a held jump input is considered active, in seconds. |
| `slopeJumpFactor` | `number` | `0` | Adds slope normal influence to the jump direction. |
| `airDragFactor` | `number` | `0.1` | Movement control strength while not grounded. |
| `slideGripFactor` | `number` | `0.5` | Grip multiplier while sliding on steep slopes. |
| `fallingGravityScale` | `number` | `3` | Gravity scale used while falling. |
| `fallingMaxVel` | `number` | `20` | Maximum falling speed before gravity scale is reduced to zero. |
| `enableToggleRun` | `boolean` | `true` | `true` makes run input toggle run state; `false` makes run input hold-to-run. |
| `groundDetection` | `"shapeCast" \| "rayCast"` | `"shapeCast"` | Ground detection mode. ShapeCast is more robust; RayCast is cheaper. |
| `slopeMaxAngle` | `number` | `Math.PI / 2.5` | Maximum walkable slope angle in radians. |
| `floatHeight` | `number` | `0.2` | Target floating height above ground contact. |
| `rayOriginOffest` | `number` | `-capsuleHalfHeight` | Local Y offset for the ground cast origin. Name keeps current source spelling. |
| `rayHitForgiveness` | `number` | `0.28` | Extra tolerance before losing ground contact. |
| `rayLength` | `number` | `capsuleRadius + 1` | Ground cast length. |
| `rayRadius` | `number` | `capsuleRadius / 2` | ShapeCast ball radius. |
| `springK` | `number` | `80` | Floating spring stiffness. |
| `dampingC` | `number` | `6` | Floating damping coefficient. |
| `autoBalance` | `boolean` | `true` | Applies angular correction to keep the character upright. |
| `autoBalanceSpringK` | `number` | `0.5` | Auto-balance spring stiffness. |
| `autoBalanceDampingC` | `number` | `0.03` | Auto-balance damping. |
| `autoBalanceSpringOnY` | `number` | `0.08` | Auto-balance local Y spring term. |
| `autoBalanceDampingOnY` | `number` | `0.006` | Auto-balance local Y damping term. |
| `followPlatform` | `boolean` | `true` | Subtracts moving/rotating platform velocity from relative movement. |
| `massRatioFallOffCurveData` | `CurveData` | `{ points: [{ x: 0, y: 0, r_out: 0 }, { x: 0.5, y: 0, r_in: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 }] }` | Curve used to reduce counter impulses based on contacted body mass ratio. |
| `applyCounterMass` | `boolean` | `true` | Applies character support force to the standing body. |
| `applyCounterJumpImp` | `boolean` | `true` | Applies downward impulse to the standing body when jumping. |
| `counterJumpImpFactor` | `number` | `1` | Multiplier for jump counter impulse. |
| `applyCounterMoveImp` | `boolean` | `true` | Applies opposite movement impulse to the standing body. |
| `counterMoveImpFactor` | `number` | `1` | Multiplier for movement counter impulse. |

Additional `RigidBodyProps` are forwarded to the internal `RigidBody`. Ecctrl also sets fallback values when not provided:

| Rigid body prop | Fallback |
| --- | --- |
| `position` | `[0, 1, 0]` |
| `friction` | `-0.5` |

The default character spring, damping, jump, and balance values assume a normal default-density character. If you increase collider density heavily, retune `springK`, `dampingC`, and balance values with that mass scale in mind.

### MovementInput

```ts
export type MovementInput = {
  forward?: boolean;
  backward?: boolean;
  leftward?: boolean;
  rightward?: boolean;
  joystick?: { x: number; y: number };
  run?: boolean;
  jump?: boolean;
};
```

`setMovement` is partial. Passing only one field updates that field and keeps the previous values for the others.

```tsx
ecctrl.current?.setMovement({ forward: true });
ecctrl.current?.setMovement({ joystick: { x: 0.2, y: 0.8 } });
ecctrl.current?.setMovement({ jump: true });
```

### EcctrlHandle

| Field | Type | Description |
| --- | --- | --- |
| `body` | `RapierRigidBody` | Mutable Rapier body. You can use this for teleporting, impulses, sleeping, etc. |
| `collider` | `RapierCollider` | Character capsule collider. |
| `upAxis` | `THREE.Vector3` | Current character up axis. |
| `gravityDir` | `THREE.Vector3` | Current gravity direction. |
| `gravityMag` | `number` | Current gravity magnitude. |
| `currPos` | `THREE.Vector3` | Current world position. |
| `currQuat` | `THREE.Quaternion` | Current world rotation. |
| `currLinVel` | `THREE.Vector3` | Current linear velocity. |
| `currAngVel` | `THREE.Vector3` | Current angular velocity. |
| `input` | `ReadonlyMovementInput` | Current input state. |
| `inputDir` | `THREE.Vector3` | Normalized movement input direction in world space. |
| `movingDirection` | `THREE.Vector3` | Actual movement direction after slope handling. |
| `relativeVel` | `THREE.Vector3` | Velocity relative to the contacted moving object. |
| `relativeVelOnPlane` | `THREE.Vector3` | Relative velocity projected onto the movement plane. |
| `relativeVelOnUp` | `THREE.Vector3` | Relative velocity projected onto the up axis. |
| `moveImpulse` | `THREE.Vector3` | Last movement impulse applied to the character. |
| `floatingImpulse` | `THREE.Vector3` | Last floating/support impulse. |
| `dragFrictionImpulse` | `THREE.Vector3` | Last drag/friction impulse. |
| `bodyXAxis` | `THREE.Vector3` | Character local X axis in world space. |
| `bodyYAxis` | `THREE.Vector3` | Character local Y axis in world space. |
| `bodyZAxis` | `THREE.Vector3` | Character local Z axis in world space. |
| `standCollider` | `RapierRigidBody \| null` | Rigid body currently below the character. |
| `standPoint` | `THREE.Vector3` | Current standing/support point. |
| `standNormal` | `THREE.Vector3` | Current ground normal. |
| `isOnGround` | `boolean` | Whether the controller considers the character grounded. |
| `isFalling` | `boolean` | Whether the character is currently falling. |
| `isOnPlatform` | `boolean` | Whether the character is on a moving/rotating object. |
| `slopeAngle` | `number` | Forward slope angle in radians. |
| `actualSlopeAngle` | `number` | Actual contacted slope angle in radians. |
| `standFriction` | `number` | Friction value read from the standing collider. |
| `slideFriction` | `number` | Effective slide friction coefficient. |
| `isMoving` | `boolean` | True when movement input direction has length. |
| `moveSpeed` | `number` | Relative planar speed. |
| `verticalSpeed` | `number` | Relative vertical speed along the reference up axis. |
| `runActive` | `boolean` | Current run state after toggle/hold logic. |
| `jumpActive` | `boolean` | Current jump-active state. |
| `lockForward` | `boolean` | Current lock-forward state. |
| `turnOnYQuat` | `THREE.Quaternion` | Platform angular follow rotation. |

Methods:

| Method | Signature | Description |
| --- | --- | --- |
| `setMovement` | `(state: MovementInput) => void` | Partially updates character input. |
| `setLockForward` | `(lock: boolean) => void` | Updates `lockForward` at runtime. |
| `setForwardDir` | `(dir: THREE.Vector3) => void` | Sets custom forward direction when `useCustomForward` is true. |

## EcctrlUserDataType

Put this shape on the parent `RigidBody` `userData` to exclude objects from Ecctrl casts. The current cast filter reads `collider.parent()?.userData`, so putting it only on a collider will not affect Ecctrl filtering.

```ts
export interface EcctrlUserDataType {
  ecctrl?: {
    excludeRay?: boolean;
    excludeCharacterRay?: boolean;
    excludeVehicleRay?: boolean;
  };
}
```

| Field | Description |
| --- | --- |
| `excludeRay` | Excludes from both character and vehicle Ecctrl ray/shape queries. |
| `excludeCharacterRay` | Excludes from character ground detection only. |
| `excludeVehicleRay` | Excludes from vehicle wheel ground detection only. |

Example:

```tsx
<RigidBody userData={{ ecctrl: { excludeCharacterRay: true } } satisfies EcctrlUserDataType} />
```

## EcctrlVehicle

Import:

```ts
import {
  EcctrlVehicle,
  type EcctrlVehicleHandle,
  type EcctrlVehicleProps,
  type CarConfigType,
  type DroneConfigType,
  type VehicleInput,
} from "ecctrl/vehicle";
```

`EcctrlVehicle` is the parent controller for wheels and propellers. `ShapeCastWheel` and `ThrustPropeller` register with the nearest vehicle context at runtime.

Vehicle defaults also assume default-density bodies. Heavy example vehicles use much larger wheel spring/damping, engine horsepower, brake torque, and propeller thrust values.

### EcctrlVehicleProps

`EcctrlVehicleProps` extends `RigidBodyProps`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | `undefined` | Collider, visual model, wheels, propellers, or other children. |
| `enable` | `boolean` | `true` | Runs the vehicle update loop when true. Set false to skip the whole vehicle algorithm. |
| `carConfig` | `Partial<CarConfigType>` | `{}` | Car/wheel control config merged with defaults. |
| `droneConfig` | `Partial<DroneConfigType>` | `{}` | Drone/propeller control config merged with defaults. |
| `enableCustomGravity` | `boolean` | `false` | Uses `useCustomGravity` for this vehicle. |
| `gravityDirLerpSpeed` | `number` | `6` | Smooth speed for gravity direction/up-axis changes. |

### VehicleInput

```ts
export type VehicleInput = {
  forward?: boolean;
  backward?: boolean;
  steerLeft?: boolean;
  steerRight?: boolean;
  brake?: boolean;

  throttleUp?: boolean;
  throttleDown?: boolean;
  yawLeft?: boolean;
  yawRight?: boolean;
  pitchForward?: boolean;
  pitchBackward?: boolean;
  rollLeft?: boolean;
  rollRight?: boolean;

  joystickL?: { x: number; y: number };
  joystickR?: { x: number; y: number };
};
```

Car input:

| Field | Meaning |
| --- | --- |
| `forward` / `backward` | Drive demand. |
| `steerLeft` / `steerRight` | Steering demand. |
| `brake` | Brake demand. |
| `joystickL.x` | Steering input. In car control it is subtracted from the digital steer value. |

Drone input:

| Field | Meaning |
| --- | --- |
| `throttleUp` / `throttleDown` | Vertical target input. |
| `yawLeft` / `yawRight` | Yaw input. |
| `pitchForward` / `pitchBackward` | Forward/backward input. |
| `rollLeft` / `rollRight` | Lateral roll input. |
| `joystickL` | Vertical and yaw analog input. |
| `joystickR` | Pitch and roll analog input. |

### CarConfigType

Defaults:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `controlMode` | `"VELOCITY" \| "POSITION"` | `"VELOCITY"` | Reserved car control mode. Current wheel control path uses velocity-style input. |
| `engineHorsepower` | `number` | `6` | Engine horsepower used to compute max engine torque. |
| `engineMaxRPM` | `number` | `6000` | Engine max RPM used for wheel max angular velocity and torque calculation. |
| `gearRatios` | `number[]` | `[10]` | Gear ratios. One value behaves like a fixed-ratio motor setup. |
| `finalDriveRatio` | `number` | `1` | Final drive multiplier. `driveRatio = gearRatios[gearIndex] * finalDriveRatio`. |
| `transmissionMode` | `"auto" \| "manual"` | `"auto"` | Auto shifts between gears when `gearRatios.length > 1`; manual uses `setGear`. |
| `shiftUpRPM` | `number` | `5200` | RPM threshold for auto upshift. |
| `shiftDownRPM` | `number` | `2200` | RPM threshold for auto downshift. |
| `shiftCooldown` | `number` | `0.35` | Seconds to wait after shifting before the next auto shift. |
| `steerRate` | `number` | `Math.PI * 2` | Steering angle change speed. |
| `maxSteerAngle` | `number` | `Math.PI / 6` | Max steering angle in radians. |
| `reverseTorqueScale` | `number` | `1` | Torque scale when reversing. |
| `reverseRPMScale` | `number` | `0.3` | Reverse wheel speed/RPM scale. |
| `engineTorqueCurveData` | `CurveData` | `{ points: [{ x: 0, y: 1, r_out: 0 }, { x: 1, y: 0, r_in: 0 }], samples: 50 }` | Engine torque curve sampled by wheel drive logic. |
| `steerAngleCurveData` | `CurveData` | `{ points: [{ x: 0, y: 1, r_out: 0 }, { x: 0.2, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.4, r_in: 0 }], samples: 50 }` | Speed-based steering angle curve. |

Engine notes:

- `engineMaxTorque = engineHorsepower * 7022 / engineMaxRPM`.
- Drive torque is distributed to registered drive wheels by `driveTorqueWeight`.
- `engineRPM` is estimated from weighted drive wheel RPM times absolute `driveRatio`.

### DroneConfigType

Defaults:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `controlMode` | `"VELOCITY" \| "POSITION"` | `"VELOCITY"` | Drone control mode. |
| `maxYawRate` | `number` | `2` | Max yaw target rate. |
| `maxHorizSpeed` | `number` | `30` | Max horizontal speed target. |
| `maxVertSpeed` | `number` | `8` | Max vertical speed target. |
| `maxTiltAngle` | `number` | `Math.PI / 4` | Max tilt angle used by controller. |
| `airDragFactor` | `number` | `0.2` | Air drag impulse factor. |
| `TILT_P` | `number` | `15` | Tilt proportional gain. |
| `TILT_D` | `number` | `3` | Tilt damping gain. |
| `YAW_POS_P` | `number` | `6` | Yaw position proportional gain in position mode. |
| `YAW_VEL_P` | `number` | `4` | Yaw velocity gain. |
| `VERT_POS_P` | `number` | `9` | Vertical position proportional gain. |
| `VERT_POS_D` | `number` | `7` | Vertical position damping gain. |
| `HORIZ_POS_P` | `number` | `5` | Horizontal position proportional gain. |
| `HORIZ_POS_D` | `number` | `5.5` | Horizontal position damping gain. |
| `HORIZ_VEL_P` | `number` | `1` | Horizontal velocity gain. |
| `VERT_VEL_P` | `number` | `2` | Vertical velocity gain. |

### EcctrlVehicleHandle

| Field | Type | Description |
| --- | --- | --- |
| `body` | `RapierRigidBody` | Mutable Rapier body. |
| `upAxis` | `THREE.Vector3` | Vehicle up axis. |
| `gravityDir` | `THREE.Vector3` | Current gravity direction. |
| `gravityMag` | `number` | Current gravity magnitude. |
| `currPos` | `THREE.Vector3` | Current vehicle position. |
| `currQuat` | `THREE.Quaternion` | Current vehicle rotation. |
| `currLinVel` | `THREE.Vector3` | Current linear velocity. |
| `currAngVel` | `THREE.Vector3` | Current angular velocity. |
| `bodyXAxis` | `THREE.Vector3` | Vehicle local X axis in world space. |
| `bodyYAxis` | `THREE.Vector3` | Vehicle local Y axis in world space. |
| `bodyZAxis` | `THREE.Vector3` | Vehicle local Z axis in world space. |
| `targetPos` | `THREE.Vector3` | Target position for position-based drone control. |
| `targetFwd` | `THREE.Vector3` | Target heading for position-based drone control. |
| `input` | `ReadonlyVehicleInput` | Current vehicle input state. |
| `wheelsInfo` | `WheelsInfoType` | Readonly map of registered wheel info refs. |
| `propellersInfo` | `PropellersInfoType` | Readonly map of registered propeller info refs. |
| `gearIndex` | `number` | Current gear index. |
| `driveRatio` | `number` | Current effective drive ratio. |
| `engineRPM` | `number` | Current estimated engine RPM. |

Methods:

| Method | Signature | Description |
| --- | --- | --- |
| `setMovement` | `(state: VehicleInput) => void` | Partially updates vehicle input. |
| `setTarget` | `(pos?: THREE.Vector3, dir?: THREE.Vector3) => void` | Updates position-mode target position and/or heading. |
| `setGear` | `(gearIndex: number) => void` | Sets manual gear index. Index is clamped to the available gear range. |

### WheelsInfoType And PropellersInfoType

```ts
export type WheelsInfoType = ReadonlyMap<string, React.RefObject<Readonly<WheelInfoType>>>;
export type PropellersInfoType = ReadonlyMap<string, React.RefObject<Readonly<PropellerInfoType>>>;
```

Use these maps for effects, audio, UI, telemetry, and debugging. Do not add/remove entries manually; wheels and propellers register themselves.

## ShapeCastWheel

Import:

```ts
import {
  ShapeCastWheel,
  type ShapeCastWheelProps,
  type WheelInfoType,
} from "ecctrl/vehicle";
```

`ShapeCastWheel` must be rendered inside `EcctrlVehicle`. The forwarded ref is a `THREE.Group`.

### ShapeCastWheelProps

`ShapeCastWheelProps` extends R3F `group` props, so `position`, `rotation`, `scale`, and `id` can be passed normally.

Wheel suspension defaults target default-density vehicle bodies. For heavier vehicles, increase `springK` and `dampingC`; also retune tire grip, brake torque, and engine power at the vehicle level.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | `undefined` | Visual wheel model. Rendered only when `showWheelModel` is true. |
| `debug` | `boolean` | `false` | Shows wheel debug indicators. |
| `enable` | `boolean` | `true` | Skips wheel update when false. |
| `name` | `string` | `""` | Optional user label copied into `WheelInfoType`. |
| `groundDetection` | `"shapeCast" \| "rayCast"` | `"shapeCast"` | Wheel ground detection mode. |
| `rayShapeR` | `number` | `0.5` | Wheel cast radius. |
| `rayShapeH` | `number` | `0.15` | Half height of the cylinder ShapeCast. |
| `rayLength` | `number` | `0.5` | Suspension/cast travel length. |
| `springK` | `number` | `180` | Suspension spring stiffness. |
| `dampingC` | `number` | `16` | Suspension damping coefficient. |
| `driveInvert` | `boolean` | `false` | Inverts drive direction for this wheel. |
| `driveWheel` | `boolean` | `false` | Marks this wheel as a drive wheel. |
| `driveTorqueWeight` | `number` | `1` | Weight used by `EcctrlVehicle` when distributing engine torque. |
| `steerInvert` | `boolean` | `false` | Inverts steering direction for this wheel. |
| `steerWheel` | `boolean` | `false` | Marks this wheel as a steering wheel. |
| `brakeWheel` | `boolean` | `false` | Marks this wheel as a brake wheel. |
| `maxBrakeTorque` | `number` | `40` | Max brake torque for this wheel. |
| `rollingResistanceCoef` | `number` | `0.007` | Free-rolling resistance coefficient. |
| `lowVelThreshold` | `number` | `0.4` | Low-speed threshold used by tire slip logic. |
| `tireGripFactor` | `number` | `1.5` | Overall tire grip multiplier. |
| `lngFrictionEllipseScale` | `number` | `1` | Longitudinal friction ellipse scale. |
| `latFrictionEllipseScale` | `number` | `1` | Lateral friction ellipse scale. |
| `relaxLngRate` | `number` | `0.05` | Longitudinal tire relaxation rate. |
| `relaxLatRate` | `number` | `0.1` | Lateral tire relaxation rate. |
| `minLngRelaxCoeff` | `number` | `0.3` | Minimum longitudinal relaxation coefficient. |
| `minLatRelaxCoeff` | `number` | `0.3` | Minimum lateral relaxation coefficient. |
| `lngSlipRatioCurveData` | `CurveData` | `{ points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.25, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.7, r_in: 0 }] }` | Longitudinal slip-to-grip curve. |
| `latSlipRatioCurveData` | `CurveData` | `{ points: [{ x: 0, y: 0, r_out: 1.45 }, { x: 0.15, y: 1, r_in: 0, r_out: 0 }, { x: 1, y: 0.9, r_in: 0 }] }` | Lateral slip-to-grip curve. |
| `followPlatform` | `boolean` | `true` | Subtracts contacted moving object velocity when computing wheel slip. |
| `massRatioFallOffCurveData` | `CurveData` | `{ points: [{ x: 0, y: 0.5, r_out: 0 }, { x: 0.5, y: 1, r_out: 0 }, { x: 1, y: 1, r_in: 0 }] }` | Counter impulse mass ratio curve. |
| `applyCounterMass` | `boolean` | `true` | Applies wheel support force to the contacted dynamic body. |
| `applyCounterFriction` | `boolean` | `true` | Applies opposite tire friction to the contacted dynamic body. |
| `showWheelModel` | `boolean` | `true` | Renders `children` as a visual wheel model. |
| `wheelModelDensity` | `number` | `1.5` | Used to estimate wheel model mass/inertia. |
| `wheelModelUpdate` | `boolean` | `true` | Updates visual wheel suspension position and rotation. |
| `wheelModelRadius` | `number` | `0.5` | Visual wheel radius used for model offset. |
| `wheelModelLerpPosRate` | `number` | `10` | Visual suspension position smoothing. |
| `wheelModelReversRotation` | `boolean` | `false` | Reverses visual wheel spin direction. Name keeps current source spelling. |
| `debuggerArrowScale` | `number` | `10` | Scale for debug arrows. |

### WheelInfoType

`WheelInfoType` is exposed through `EcctrlVehicleHandle.wheelsInfo`.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable wheel id. Uses `props.id` or generated UUID. |
| `name` | `string` | Wheel name prop. |
| `enable` | `boolean` | Current enable prop. |
| `debug` | `boolean` | Current debug prop. |
| `rayShapeR`, `rayShapeH`, `rayLength` | `number` | Wheel cast/suspension dimensions. |
| `springK`, `dampingC` | `number` | Suspension config. |
| `steerInvert`, `steerWheel` | `boolean` | Steering config. |
| `driveInvert`, `driveWheel`, `driveTorqueWeight` | `boolean` / `number` | Drive config. |
| `brakeWheel`, `maxBrakeTorque` | `boolean` / `number` | Brake config. |
| `rollingResistanceCoef` | `number` | Rolling resistance config. |
| `lowVelThreshold`, `tireGripFactor` | `number` | Grip config. |
| `lngFrictionEllipseScale`, `latFrictionEllipseScale` | `number` | Friction ellipse scaling. |
| `relaxLngRate`, `relaxLatRate` | `number` | Tire relaxation rates. |
| `minLngRelaxCoeff`, `minLatRelaxCoeff` | `number` | Minimum tire relaxation coefficients. |
| `followPlatform` | `boolean` | Moving platform follow config. |
| `applyCounterMass`, `applyCounterFriction` | `boolean` | Counter impulse config. |
| `showWheelModel`, `wheelModelDensity`, `wheelModelUpdate` | various | Visual model config. |
| `wheelModelRadius`, `wheelModelLerpPosRate`, `wheelModelReversRotation` | various | Visual model config. |
| `debuggerArrowScale` | `number` | Debug arrow scale. |
| `rayPos` | `THREE.Vector3` | Current wheel cast origin. |
| `rayDir` | `THREE.Vector3` | Current cast direction. |
| `rayRot` | `THREE.Quaternion` | Current cast rotation. |
| `rayUpDir` | `THREE.Vector3` | Current wheel up direction. |
| `rayFwdDir` | `THREE.Vector3` | Current wheel forward direction. |
| `rayLeftDir` | `THREE.Vector3` | Current wheel left direction. |
| `floatImp` | `THREE.Vector3` | Current suspension impulse. |
| `rayHit` | `ColliderShapeCastHit \| RayColliderIntersection \| null` | Current cast hit. |
| `rayHitBody` | `RapierRigidBody \| null` | Contacted rigid body. |
| `rayHitPos` | `THREE.Vector3` | Contact point used for tire friction. |
| `rayHitNormal` | `THREE.Vector3` | Contact normal. |
| `rayHitFriciton` | `number` | Contact friction value. Name keeps current source spelling. |
| `rayOriginVel` | `THREE.Vector3` | Velocity at wheel origin. |
| `rayHitPointVel` | `THREE.Vector3` | Velocity at wheel contact point. |
| `isOnPlatform` | `boolean` | Whether the wheel is on a moving object. |
| `lngSlipRatio` | `number` | Longitudinal slip ratio. |
| `latSlipRatio` | `number` | Lateral slip ratio. |
| `slipStrength` | `number` | Combined slip strength. Useful for skid marks, tire smoke, and audio. |
| `lngAxis` | `THREE.Vector3` | Longitudinal friction axis. |
| `latAxis` | `THREE.Vector3` | Lateral friction axis. |
| `lngFricImp` | `THREE.Vector3` | Longitudinal friction impulse applied to vehicle. |
| `latFricImp` | `THREE.Vector3` | Lateral friction impulse applied to vehicle. |
| `effInertia` | `number` | Effective wheel inertia. |
| `supPos` | `THREE.Vector3` | Suspension support point used by vehicle impulse application. |
| `steerAngle` | `number` | Current steering angle. |
| `driveTorque` | `number` | Current drive torque. |
| `brakeTorque` | `number` | Current brake torque. |
| `wheelLinVel` | `number` | Wheel linear speed derived from angular velocity and radius. |
| `wheelAngVel` | `number` | Wheel angular velocity. |
| `setDriveDemand` | `(value: number) => void` | Internal demand setter used by `EcctrlVehicle`. |
| `setBrakeDemand` | `(value: number) => void` | Internal demand setter used by `EcctrlVehicle`. |
| `setSteerDemand` | `(value: number) => void` | Internal demand setter used by `EcctrlVehicle`. |
| `setDriveWheelConfig` | `(value: DriveWheelConfigType) => void` | Internal drive config setter used by `EcctrlVehicle`. |
| `setSteerWheelConfig` | `(value: SteerWheelConfigType) => void` | Internal steer config setter used by `EcctrlVehicle`. |

These internal setters are exposed because wheel info is read from live refs, but they are not recommended for user code. Prefer `EcctrlVehicleHandle.setMovement`, `setGear`, and vehicle config props.

### DriveWheelConfigType

```ts
export type DriveWheelConfigType = {
  maxDriveTorque: number;
  maxWheelAngVel: number;
  engineTorqueCurve: CurveLUT;
  reverseTorqueScale: number;
  reverseRPMScale: number;
  driveRatio: number;
};
```

### SteerWheelConfigType

```ts
export type SteerWheelConfigType = {
  steerAngleCurve: CurveLUT;
  steerRate: number;
  maxSteerAngle: number;
  maxWheelAngVel: number;
};
```

## ThrustPropeller

Import:

```ts
import {
  ThrustPropeller,
  type ThrustPropellerProps,
  type PropellerInfoType,
} from "ecctrl/vehicle";
```

`ThrustPropeller` must be rendered inside `EcctrlVehicle`. The forwarded ref is a `THREE.Group`.

Propeller thrust defaults target light/default-density bodies. Heavy drones need proportionally larger `maxThrust` and may need retuned drone PD gains.

### ThrustPropellerProps

`ThrustPropellerProps` extends R3F `group` props.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | `undefined` | Visual propeller model. |
| `debug` | `boolean` | `true` | Shows thrust/torque debug indicators. |
| `enable` | `boolean` | `true` | Skips propeller update when false. |
| `name` | `string` | `""` | Optional user label copied into `PropellerInfoType`. |
| `maxThrust` | `number` | `500` | Max thrust force potential. |
| `torqueRatio` | `number` | `0.6` | Reaction torque strength relative to thrust. |
| `invertThrust` | `boolean` | `false` | Inverts thrust direction. |
| `invertTorque` | `boolean` | `false` | Inverts reaction torque direction. |
| `showPropellerModel` | `boolean` | `true` | Renders children as propeller model. |
| `propellerModelUpdate` | `boolean` | `true` | Updates visual propeller spin. |
| `propellerModelMaxSpin` | `number` | `50` | Max visual spin speed. |
| `propellerModelLerpSpinRate` | `number` | `10` | Spin smoothing rate. |
| `debuggerScale` | `number` | `1` | Size scale for static debug indicators. |
| `debuggerArrowScale` | `number` | `35` | Size scale for thrust/torque arrows. |

### PropellerInfoType

`PropellerInfoType` is exposed through `EcctrlVehicleHandle.propellersInfo`.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable propeller id. Uses `props.id` or generated UUID. |
| `name` | `string` | Propeller name prop. |
| `enable` | `boolean` | Current enable prop. |
| `debug` | `boolean` | Current debug prop. |
| `maxThrust` | `number` | Max thrust config. |
| `torqueRatio` | `number` | Reaction torque config. |
| `invertThrust` | `boolean` | Thrust inversion config. |
| `invertTorque` | `boolean` | Torque inversion config. |
| `thrustPos` | `THREE.Vector3` | Local thrust position in vehicle space. |
| `thrustDir` | `THREE.Vector3` | Local thrust direction in vehicle space. |
| `thrustPot` | `THREE.Vector3` | Local max thrust potential. |
| `torqueDir` | `THREE.Vector3` | Local reaction torque direction. |
| `torquePot` | `THREE.Vector3` | Local total torque potential, including leverage and reaction torque. |
| `worldThrustPos` | `THREE.Vector3` | World-space thrust position after mixer output. |
| `worldThrustDir` | `THREE.Vector3` | World-space thrust direction after mixer output. |
| `worldTorqueDir` | `THREE.Vector3` | World-space torque direction after mixer output. |
| `thrustImpulse` | `THREE.Vector3` | Actual thrust impulse applied this frame. |
| `torqueImpulse` | `THREE.Vector3` | Actual torque impulse applied this frame. |
| `finalThrottle` | `number` | Mixer output throttle for this propeller. |
| `throttle` | `number` | Current local throttle value used by model/debug update. |
| `setThrottle` | `(value: number) => void` | Sets local throttle value, clamped to `[0, 1]`. Vehicle mixer also uses this. |
| `lx`, `ly`, `lz` | `number` | Local linear thrust potential components. |
| `ax`, `ay`, `az` | `number` | Local angular torque potential components. |

## Custom Gravity

Import:

```ts
import { useCustomGravity, type CustomGravityState } from "ecctrl/gravity";
```

### CustomGravityState

```ts
export interface CustomGravityState {
  gravityField: (pos: THREE.Vector3) => THREE.Vector3;
  setGravityField: (fn: (pos: THREE.Vector3) => THREE.Vector3) => void;
  applyGravityField: (body: RapierRigidBody, timeStep: number) => void;
}
```

| Field | Description |
| --- | --- |
| `gravityField` | Function that receives a world position and returns gravity vector at that position. Default returns `(0, -9.81, 0)`. |
| `setGravityField` | Replaces the gravity field function. For per-frame changes, keep the function stable and update refs read by the function. |
| `applyGravityField` | Applies gravity impulse to a body using `gravityField(body.translation()) * body.mass() * body.gravityScale() * timeStep`. Sleeping bodies are skipped. |

Example:

```tsx
const setGravityField = useCustomGravity((state) => state.setGravityField);
const center = useRef(new THREE.Vector3(0, 20, 0));
const gravity = useMemo(() => new THREE.Vector3(), []);

useEffect(() => {
  setGravityField((pos) => {
    return gravity.subVectors(center.current, pos).normalize().multiplyScalar(9.81);
  });
}, [setGravityField, gravity]);
```

## EcctrlCameraControls

Import:

```ts
import {
  EcctrlCameraControls,
  type EcctrlCameraControlsHandle,
} from "ecctrl/camera";
```

`EcctrlCameraControls` wraps Drei `CameraControls` and accepts `CameraControlsProps`.

Additional handle method:

| Method | Signature | Description |
| --- | --- | --- |
| `setUp` | `(newUp: THREE.Vector3) => void` | Updates the camera control up axis for custom gravity scenes. |

## TimeControl

Import:

```ts
import { TimeControl, type TimeControlProps } from "ecctrl/time";
```

Use `TimeControl` with `<Physics paused>` when you want manual physics stepping.

```tsx
const timeScale = useRef(1);

<Physics paused>
  <TimeControl timeScale={timeScale} maxDelta={1 / 30} />
</Physics>
```

### TimeControlProps

```ts
type TimeControlValue = number | RefObject<number>;
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `paused` | `boolean` | `false` | Skips manual stepping when true. |
| `timeScale` | `number \| RefObject<number>` | `1` | Multiplier applied to physics delta. Values `<= 0` stop stepping. |
| `maxDelta` | `number \| RefObject<number>` | `1 / 30` | Clamps large frame deltas before stepping. |

## Input Components

Import:

```ts
import {
  Joystick,
  VirtualButton,
  useJoystickStore,
  useButtonStore,
} from "ecctrl/input";
```

### Joystick

`JoystickProps` extends `React.HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | `"default"` in store | Store id for this joystick. |
| `joystickMaxRadius` | `number` | `50` | Max knob movement radius in pixels. |
| `joystickWrapperStyle` | `React.CSSProperties` | fixed 200x200 circle area | Overrides wrapper style. |
| `joystickBaseStyle` | `React.CSSProperties` | 100x100 circular base | Overrides base style. |
| `joystickKnobStyle` | `React.CSSProperties` | 70x70 circular knob | Overrides knob style. |

Store:

```ts
export interface JoystickState {
  active: boolean;
  x: number;
  y: number;
}

export interface JoystickStoreState {
  joysticks: Record<string, JoystickState>;
  setJoystick: (x: number, y: number, id?: string) => void;
  resetJoystick: (id?: string) => void;
}
```

Joystick output is normalized to roughly `[-1, 1]`.

### VirtualButton

`VirtualButtonProps` extends `React.HTMLAttributes<HTMLDivElement>`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Button id used in `useButtonStore`. |
| `label` | `string` | `undefined` | Text displayed on the button cap. |
| `buttonWrapperStyle` | `React.CSSProperties` | fixed 60x60 circular area | Overrides wrapper style. |
| `buttonCapStyle` | `React.CSSProperties` | 45x45 circular cap | Overrides cap style. |

Store:

```ts
export interface ButtonStoreState {
  buttons: Record<string, boolean>;
  setButtonActive: (id: string, active: boolean) => void;
  resetAllButtons: () => void;
}
```

## Animation State

Import:

```ts
import {
  EcctrlAnimationStateController,
  resolveEcctrlAnimationState,
  useEcctrlAnimationStore,
  type EcctrlAnimationState,
  type EcctrlAnimationStateContext,
  type EcctrlAnimationStateResolver,
} from "ecctrl/animation";
```

### EcctrlAnimationState

```ts
export type EcctrlAnimationState =
  | "IDLE"
  | "WALK"
  | "RUN"
  | "JUMP_START"
  | "JUMP_IDLE"
  | "JUMP_FALL"
  | "JUMP_LAND";
```

### EcctrlAnimationStateControllerProps

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `ecctrl` | `RefObject<EcctrlHandle \| null>` | required | Character controller ref to read. |
| `enabled` | `boolean` | `true` | Skips animation state updates when false. |
| `resolver` | `EcctrlAnimationStateResolver` | `resolveEcctrlAnimationState` | Custom state resolver. |
| `onChange` | `(state, context) => void` | `undefined` | Called when resolved state changes. |

### EcctrlAnimationStateContext

| Field | Type | Description |
| --- | --- | --- |
| `handle` | `EcctrlHandle` | Current character handle. |
| `isOnGround` | `boolean` | Current grounded state. |
| `wasOnGround` | `boolean` | Previous grounded state. |
| `isFalling` | `boolean` | Current falling state. |
| `isMoving` | `boolean` | Current movement input state. |
| `runActive` | `boolean` | Current run state. |
| `jumpActive` | `boolean` | Current jump-active state. |

Default resolver behavior:

| Condition | State |
| --- | --- |
| `jumpActive && wasOnGround` | `JUMP_START` |
| `isOnGround && !wasOnGround` | `JUMP_LAND` |
| `isOnGround && !isMoving` | `IDLE` |
| `isOnGround && isMoving && runActive` | `RUN` |
| `isOnGround && isMoving && !runActive` | `WALK` |
| `!isOnGround && isFalling` | `JUMP_FALL` |
| `!isOnGround && !isFalling` | `JUMP_IDLE` |

### useEcctrlAnimationStore

```ts
export interface EcctrlAnimationStoreState {
  animationState: EcctrlAnimationState;
  setAnimationState: (animationState: EcctrlAnimationState) => void;
}
```

`setAnimationState` ignores duplicate state values.

## Curve LUTs

Import:

```ts
import {
  bakeCurveLUT,
  evaluateCurveLUT,
  type CurvePoint,
  type CurveData,
  type CurveLUT,
} from "ecctrl/curves";
```

### Types

```ts
export type CurvePoint = {
  x: number;
  y: number;
  r_in?: number;
  r_out?: number;
  w_in?: number;
  w_out?: number;
};

export type CurveData = {
  points: CurvePoint[];
  samples?: number;
};

export type CurveLUT = {
  lut: Float32Array;
  xMin: number;
  xMax: number;
  samples: number;
};
```

| Field | Description |
| --- | --- |
| `x` | Input coordinate. Points are sorted by x before baking. |
| `y` | Output coordinate. |
| `r_in` | Incoming tangent angle in radians. |
| `r_out` | Outgoing tangent angle in radians. |
| `w_in` | Incoming tangent weight. `0` blends to linear segment, `1` uses user tangent. |
| `w_out` | Outgoing tangent weight. `0` blends to linear segment, `1` uses user tangent. |
| `samples` | LUT sample count. Default is `50` when not specified by caller code. |

### Functions

| Function | Signature | Description |
| --- | --- | --- |
| `bakeCurveLUT` | `(points: CurvePoint[], samples = 50) => CurveLUT` | Sorts points by x and bakes a weighted cubic Hermite curve into a `Float32Array`. Requires at least two points. |
| `evaluateCurveLUT` | `(x: number, curve: CurveLUT) => number` | Samples the LUT with linear interpolation. Values outside `[xMin, xMax]` clamp to the end samples. |

## Leva CurveEditorPlugin

Import:

```ts
import {
  CurveEditorPlugin,
  type CurveInput,
  type CurveSettings,
} from "ecctrl/leva";
```

`CurveEditorPlugin` is optional and requires `leva`.

### CurveInput

```ts
type RangeSetting = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  pad?: number;
};

type LevaNum = number | RangeSetting;

export type CurveInput = {
  points?: CurvePoint[] | {
    x: LevaNum;
    y: LevaNum;
    r_in?: LevaNum;
    r_out?: LevaNum;
    w_in?: LevaNum;
    w_out?: LevaNum;
  }[];
  samples?: LevaNum;
};
```

Defaults:

| Field | Default |
| --- | --- |
| `points` | `[{ x: 0, y: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 }]` |
| `samples` | `50` |

Normalized editor ranges:

| Field | Min | Max | Step |
| --- | --- | --- | --- |
| `samples` | `2` | `500` | `1` |
| `x` | `0` | `1` | `0.01` |
| `y` | `0` | `1` | `0.01` |
| `r_in` / `r_out` | `-Math.PI / 2` | `Math.PI / 2` | `0.01` |
| `w_in` / `w_out` | `0` | `3` | `0.01` |

Endpoint behavior:

- First point does not expose `r_in` or `w_in`.
- Last point does not expose `r_out` or `w_out`.
- Stale endpoint tangent values are removed during sanitization.

## Runtime Integration Patterns

### Reading Character State For Gameplay

```tsx
useFrame(() => {
  const c = ecctrl.current;
  if (!c) return;

  if (c.isOnGround && c.moveSpeed > 0.1) {
    // Footstep, dust, UI, gameplay logic, etc.
  }
});
```

### Reading Wheel State For Effects

```tsx
useFrame(() => {
  const vehicleHandle = vehicle.current;
  if (!vehicleHandle) return;

  for (const wheel of vehicleHandle.wheelsInfo.values()) {
    const w = wheel.current;
    if (!w.rayHit) continue;

    if (w.slipStrength > 1) {
      // Skid marks, tire smoke, tire audio.
    }
  }
});
```

### Reading Propeller Output For Effects

```tsx
useFrame(() => {
  const vehicleHandle = vehicle.current;
  if (!vehicleHandle) return;

  for (const propeller of vehicleHandle.propellersInfo.values()) {
    const p = propeller.current;
    const throttle = p.finalThrottle;
    const thrust = p.thrustImpulse.length();
  }
});
```

### Driving Input Without Drei

```tsx
useFrame(() => {
  ecctrl.current?.setMovement({
    forward: input.forward,
    leftward: input.left,
    rightward: input.right,
    jump: input.jump,
  });

  vehicle.current?.setMovement({
    forward: input.drive,
    steerLeft: input.left,
    steerRight: input.right,
    brake: input.brake,
  });
});
```

## Version Notes

This document targets `ecctrl@2.0.0`.
