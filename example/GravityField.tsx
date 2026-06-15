import * as THREE from "three"
import { useCallback, useRef } from "react"

const CUSTOM_GRAVITY_VALUE = 9.81

const SPHERE_ZONE_X = 0
const SPHERE_ZONE_Y = 20
const SPHERE_ZONE_Z = 0
const SPHERE_ZONE_RADIUS = 15
const SPHERE_ZONE_RADIUS_SQ = SPHERE_ZONE_RADIUS * SPHERE_ZONE_RADIUS

const CYLINDER_ZONE_X = 0
const CYLINDER_ZONE_Z = 110
const CYLINDER_ZONE_RADIUS = 20
const CYLINDER_ZONE_RADIUS_SQ = CYLINDER_ZONE_RADIUS * CYLINDER_ZONE_RADIUS
const CYLINDER_ZONE_Y_MIN = 0
const CYLINDER_ZONE_Y_MAX = 100
const CYLINDER_BOTTOM_RIM_Y = 10
const CYLINDER_TOP_RIM_Y = 90
const CYLINDER_RIM_EPSILON = 1e-8

export const GravityField = () => {
    const gravityDir = useRef<THREE.Vector3>(new THREE.Vector3())
    const cylinderTempVec = useRef(new THREE.Vector3())

    const gravityField = useCallback((objectPos: THREE.Vector3) => {
        // ZONE 1: Sphere
        const sDxSigned = SPHERE_ZONE_X - objectPos.x
        const sDySigned = SPHERE_ZONE_Y - objectPos.y
        const sDzSigned = SPHERE_ZONE_Z - objectPos.z
        const sDxAbs = Math.abs(sDxSigned)
        const sDyAbs = Math.abs(sDySigned)
        const sDzAbs = Math.abs(sDzSigned)
        if (sDxAbs < SPHERE_ZONE_RADIUS && sDyAbs < SPHERE_ZONE_RADIUS && sDzAbs < SPHERE_ZONE_RADIUS) {
            const sDistSq = sDxSigned * sDxSigned + sDySigned * sDySigned + sDzSigned * sDzSigned
            if (sDistSq < SPHERE_ZONE_RADIUS_SQ) {
                return gravityDir.current
                    .set(sDxSigned, sDySigned, sDzSigned)
                    .normalize()
                    .multiplyScalar(CUSTOM_GRAVITY_VALUE)
            }
        }

        // ZONES 2, 3, 4: Cylinder stack
        const cDxSigned = objectPos.x - CYLINDER_ZONE_X
        const cDzSigned = objectPos.z - CYLINDER_ZONE_Z
        const cDxAbs = Math.abs(cDxSigned)
        const cDzAbs = Math.abs(cDzSigned)
        // Quick AABB for the whole vertical pillar (Radius 20, Height 0-100)
        if (cDxAbs < CYLINDER_ZONE_RADIUS && cDzAbs < CYLINDER_ZONE_RADIUS && objectPos.y >= CYLINDER_ZONE_Y_MIN && objectPos.y <= CYLINDER_ZONE_Y_MAX) {
            const distSq = (cDxSigned * cDxSigned) + (cDzSigned * cDzSigned)
            if (distSq < CYLINDER_ZONE_RADIUS_SQ) {
                // ZONE 2: Bottom Rim
                if (objectPos.y < CYLINDER_BOTTOM_RIM_Y) {
                    const rimScale = distSq > CYLINDER_RIM_EPSILON ? CYLINDER_ZONE_RADIUS / Math.sqrt(distSq) : 0
                    cylinderTempVec.current.set(
                        CYLINDER_ZONE_X + cDxSigned * rimScale,
                        CYLINDER_BOTTOM_RIM_Y,
                        CYLINDER_ZONE_Z + cDzSigned * rimScale
                    )
                    return gravityDir.current.subVectors(objectPos, cylinderTempVec.current).normalize().multiplyScalar(CUSTOM_GRAVITY_VALUE)
                }
                // ZONE 3: Middle zone
                if (objectPos.y >= CYLINDER_BOTTOM_RIM_Y && objectPos.y < CYLINDER_TOP_RIM_Y) {
                    cylinderTempVec.current.set(CYLINDER_ZONE_X, objectPos.y, CYLINDER_ZONE_Z)
                    return gravityDir.current.subVectors(cylinderTempVec.current, objectPos).normalize().multiplyScalar(CUSTOM_GRAVITY_VALUE)
                }
                // ZONE 4: Top Rim
                if (objectPos.y >= CYLINDER_TOP_RIM_Y) {
                    const rimScale = distSq > CYLINDER_RIM_EPSILON ? CYLINDER_ZONE_RADIUS / Math.sqrt(distSq) : 0
                    cylinderTempVec.current.set(
                        CYLINDER_ZONE_X + cDxSigned * rimScale,
                        CYLINDER_TOP_RIM_Y,
                        CYLINDER_ZONE_Z + cDzSigned * rimScale
                    )
                    return gravityDir.current.subVectors(objectPos, cylinderTempVec.current).normalize().multiplyScalar(CUSTOM_GRAVITY_VALUE)
                }
            }
        }

        // Default fallback
        return gravityDir.current.set(0, objectPos.y > 50 ? CUSTOM_GRAVITY_VALUE : -CUSTOM_GRAVITY_VALUE, 0)
    }, [])

    return { gravityField }
}
