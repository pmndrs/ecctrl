import { useThree } from "@react-three/fiber";
// import { useRapier } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

export default function useFollowCam(props) {
  const { scene, camera } = useThree();
  // const { rapier, world } = useRapier();

  let originZDis = props.camInitDis;
  const camMaxDis = props.camMaxDis;
  const camMinDis = props.camMinDis;
  const camCollisionOff = 0.7;
  const pivot = useMemo(() => new THREE.Object3D(), []);
  const followCam = useMemo(() => {
    const origin = new THREE.Object3D();
    origin.position.set(0, 0, originZDis);
    return origin;
  }, []);

  /** Camera collison detect setups */
  let smallestDistance = null;
  let cameraDistance = null;
  let intersects = null;
  let intersectObjects = [];
  const cameraRayDir = useMemo(() => new THREE.Vector3(), []);
  const cameraRayOrigin = useMemo(() => new THREE.Vector3(), []);
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const camLerpingPoint = useMemo(() => new THREE.Vector3(), []);
  const camRayCast = new THREE.Raycaster(
    cameraRayOrigin,
    cameraRayDir,
    0,
    -camMaxDis
  );
  // Rapier ray setup (optional)
  // const rayCast = new rapier.Ray(cameraRayOrigin, cameraRayDir);
  // let rayLength = null;
  // let rayHit = null;

  // Mouse move event
  const onDocumentMouseMove = (e) => {
    if (document.pointerLockElement) {
      pivot.rotation.y -= e.movementX * 0.002;
      const vy = followCam.rotation.x + e.movementY * 0.002;

      cameraDistance = followCam.position.length();

      if (vy >= -0.5 && vy <= 1.5) {
        followCam.rotation.x = vy;
        followCam.position.y = -cameraDistance * Math.sin(-vy);
        followCam.position.z = -cameraDistance * Math.cos(-vy);
      }
    }
    return false;
  };

  // Mouse scroll event
  const onDocumentMouseWheel = (e) => {
    if (document.pointerLockElement) {
      const vz = originZDis - e.deltaY * 0.002;
      const vy = followCam.rotation.x + e.movementY * 0.002;

      if (vz >= camMaxDis && vz <= camMinDis) {
        originZDis = vz;
        followCam.position.z = originZDis * Math.cos(-vy);
        followCam.position.y = originZDis * Math.sin(-vy);
      }
    }
    return false;
  };

  // Custom traverse function
  // Prepare intersect objects for camera collision
  function customTraverse(object) {
    // Chekc if the object's userData camExcludeCollision is true
    if (object.userData && object.userData.camExcludeCollision === true) {
      return;
    }

    // Check if the object is a Mesh, and not Text ("InstancedBufferGeometry")
    if (object.isMesh && object.geometry.type !== "InstancedBufferGeometry") {
      intersectObjects.push(object);
    }

    // Recursively traverse child objects
    object.children.forEach((child) => {
      customTraverse(child); // Continue the traversal for all child objects
    });
  }

  const cameraCollisionDetect = (delta) => {
    // Update collision detect ray origin and pointing direction
    // Which is from pivot point to camera position
    cameraRayOrigin.copy(pivot.position);
    camera.getWorldPosition(cameraPosition);
    cameraRayDir.subVectors(cameraPosition, pivot.position);
    // rayLength = cameraRayDir.length();

    // casting ray hit, if object in between character and camera,
    // change the smallestDistance to the ray hit toi
    // otherwise the smallestDistance is same as camera original position (originZDis)
    intersects = camRayCast.intersectObjects(intersectObjects);
    if (intersects.length && intersects[0].distance <= -originZDis) {
      smallestDistance =
        -intersects[0].distance * camCollisionOff < -0.7
          ? -intersects[0].distance * camCollisionOff
          : -0.7;
    } else {
      smallestDistance = originZDis;
    }

    // Rapier ray hit setup (optional)
    // rayHit = world.castRay(rayCast, rayLength + 1, true, null, null, character);
    // if (rayHit && rayHit.toi && rayHit.toi > originZDis) {
    //   smallestDistance = -rayHit.toi + 0.5;
    // } else if (rayHit == null) {
    //   smallestDistance = originZDis;
    // }

    // Update camera next lerping position, and lerp the camera
    camLerpingPoint.set(
      followCam.position.x,
      smallestDistance * Math.sin(-followCam.rotation.x),
      smallestDistance * Math.cos(-followCam.rotation.x)
    );

    followCam.position.lerp(camLerpingPoint, delta * 4); // delta * 2 for rapier ray setup
  };

  // Set camera position to (0,0,0)
  useEffect(() => {
    camera.position.set(0, 0, 0);
  }, []);

  useEffect(() => {
    // Prepare for camera ray intersect objects
    scene.children.forEach((child) => customTraverse(child));

    // Prepare for followCam and pivot point
    followCam.add(camera);
    pivot.add(followCam);

    document.addEventListener("mousemove", onDocumentMouseMove);
    document.addEventListener("mousewheel", onDocumentMouseWheel);
    return () => {
      document.removeEventListener("mousemove", onDocumentMouseMove);
      document.removeEventListener("mousewheel", onDocumentMouseWheel);
    };
  });

  return { pivot, followCam, cameraCollisionDetect };
}
