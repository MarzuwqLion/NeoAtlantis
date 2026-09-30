/**
 * Camera geometry shared by the simulation and the renderer. The simulation
 * needs the visible width at a given depth to keep fighters on screen and to
 * stop enemies attacking from off-screen; the renderer builds its camera from
 * exactly the same numbers.
 */
import { CAMERA } from '../data/tuning';

const DEG = Math.PI / 180;
const PITCH = CAMERA.pitch * DEG;
const SIN_P = Math.sin(PITCH);
const COS_P = Math.cos(PITCH);
const TAN_HALF_FOV = Math.tan((CAMERA.fovY * DEG) / 2);

/** Camera position (relative to camera centre x) and look-at point. */
export const CAMERA_OFFSET = {
  y: CAMERA.lookAtY + CAMERA.distance * SIN_P,
  z: CAMERA.lookAtZ + CAMERA.distance * COS_P,
  lookY: CAMERA.lookAtY,
  lookZ: CAMERA.lookAtZ,
};

/** Half of the visible width (x) at depth z and height y. */
export function viewHalfWidthAt(z: number, y = 1): number {
  const depth = (CAMERA_OFFSET.z - z) * COS_P + (CAMERA_OFFSET.y - y) * SIN_P;
  return depth * TAN_HALF_FOV * CAMERA.aspect;
}

/** Half width at the look-at depth; used for camera scroll limits. */
export const VIEW_HALF_WIDTH = viewHalfWidthAt(CAMERA.lookAtZ, CAMERA.lookAtY);

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function sign(v: number): -1 | 0 | 1 {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
