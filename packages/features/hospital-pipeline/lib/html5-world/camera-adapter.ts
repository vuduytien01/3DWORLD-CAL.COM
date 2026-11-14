/**
 * Camera adapter — demo CameraPose → HTML5 isometric camera (ADR 0003).
 *
 * Zoom comes from the position→target distance (station dollies ~4 m give a
 * close follow shot, aerial poses ~25-35 m give the dollhouse zoom-out; the
 * fixed azimuth means intro/outro aerial read as pure zoom-out). Pan places
 * the look-at target at the viewport center. focusFloor comes from target.y
 * treated as absolute dollhouse height — segment poses must arrive restacked
 * onto the floor they belong to (floor N content lives at y = N * 3).
 */

import type { CameraPose, Vec3 } from "../demo/camera-choreography";
import { FLOOR_HEIGHT_M, type IsometricCamera, MAX_FLOOR_INDEX, worldToScreen } from "./world-to-screen";

export interface ViewportSize {
  width: number;
  height: number;
}

/** Viewport assumed when the caller has no live size (headless tests). */
export const REFERENCE_VIEWPORT: ViewportSize = { width: 1280, height: 720 };

/**
 * Station dollies sit ~3.9 m from their target (cameraDollyOffset ≈
 * {2, 1.6, 3}), so a follow shot renders a 4 m room at ~50 px/m; aerial
 * poses 25-35 m away drop to ~6-8 px/m, enough for the 24 m dollhouse.
 */
export const ZOOM_REF_PX = 200;
export const ZOOM_MIN = 2.2;
export const ZOOM_MAX = 140;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function zoomForDistance(distanceM: number): number {
  if (!(distanceM > 0)) return ZOOM_MAX;
  return clamp(ZOOM_REF_PX / distanceM, ZOOM_MIN, ZOOM_MAX);
}

/** Eye level 1.5 m above its own floor: [0,3) → 0, [3,6) → 1, ... */
export function focusFloorForHeight(heightM: number): number {
  return clamp(Math.floor(heightM / FLOOR_HEIGHT_M), 0, MAX_FLOOR_INDEX);
}

export function cameraPoseToIsometric(
  pose: CameraPose,
  viewport: ViewportSize = REFERENCE_VIEWPORT
): IsometricCamera {
  const zoom = zoomForDistance(distance3(pose.position, pose.target));
  const focusFloor = focusFloorForHeight(pose.target.y);
  const centered = worldToScreen(pose.target.x, pose.target.y, pose.target.z, {
    panX: 0,
    panY: 0,
    zoom,
    focusFloor,
  });
  return {
    panX: viewport.width / 2 - centered.sx,
    panY: viewport.height / 2 - centered.sy,
    zoom,
    focusFloor,
  };
}
