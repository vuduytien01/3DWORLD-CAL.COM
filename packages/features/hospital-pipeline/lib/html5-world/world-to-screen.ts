/**
 * World-to-screen — the single coordinate module for the HTML5 dollhouse.
 *
 * Fixed oblique isometric projection (ADR 0003): the XZ ground plane goes
 * through the standard iso matrix (cos30, sin30, -cos30, sin30) and world Y
 * (floor elevation / object height) projects as a vertical screen offset.
 * Both Canvas 2D layers and the DOM overlay position everything through this
 * module, so the whole coordinate pipeline is testable headless.
 */

export interface IsometricCamera {
  /** Screen-space pan in CSS px, applied after projection. */
  panX: number;
  panY: number;
  /** Screen px per world meter. */
  zoom: number;
  /** Floor index the camera looks at (0 = ground). */
  focusFloor: number;
}

export interface ScreenPoint {
  sx: number;
  sy: number;
}

export interface WorldPlanePoint {
  x: number;
  z: number;
  /** World height the inverse projection assumed (a 3→2 map needs one). */
  planeY: number;
}

/** cos(30°) — iso screen slope of the world X axis. */
export const COS30 = Math.cos(Math.PI / 6);
/** sin(30°) = 0.5 — iso screen slope of the world Z axis. */
export const SIN30 = 0.5;
/** One world-Y meter maps to one screen meter before zoom (classic iso). */
export const HEIGHT_SCALE = 1;

/** Floor-to-floor distance; slice baseY = floorIndex * FLOOR_HEIGHT_M. */
export const FLOOR_HEIGHT_M = 3;
export const MAX_FLOOR_INDEX = 9;

export function worldToScreen(x: number, y: number, z: number, camera: IsometricCamera): ScreenPoint {
  return {
    sx: (x - z) * COS30 * camera.zoom + camera.panX,
    sy: ((x + z) * SIN30 - y * HEIGHT_SCALE) * camera.zoom + camera.panY,
  };
}

/**
 * Inverse projection onto the horizontal world plane at `planeY`. Hit-testing
 * always runs against a known floor plane, which resolves the 3→2 loss.
 */
export function screenToWorldPlane(
  sx: number,
  sy: number,
  camera: IsometricCamera,
  planeY: number
): WorldPlanePoint {
  const px = (sx - camera.panX) / camera.zoom;
  const py = (sy - camera.panY) / camera.zoom;
  const a = px / COS30;
  const b = (py + planeY * HEIGHT_SCALE) / SIN30;
  // x - z = a and x + z = b
  return { x: (a + b) / 2, z: (b - a) / 2, planeY };
}

/** Inverse projection onto the ground plane (world Y = 0). */
export function screenToWorld(
  sx: number,
  sy: number,
  camera: IsometricCamera
): { x: number; y: number; z: number } {
  const point = screenToWorldPlane(sx, sy, camera, 0);
  return { x: point.x, y: 0, z: point.z };
}

/**
 * Painter's-order key: lower floors always draw first (they sit strictly
 * below the next floor on screen), and inside one floor the iso depth
 * (x + z) orders far → near. Ground-floor x + z stays well under 1e6.
 */
export function painterDepth(floorIndex: number, x: number, z: number): number {
  return floorIndex * 1_000_000 + (x + z);
}

export interface PainterSortable {
  floorIndex: number;
  x: number;
  z: number;
}

/** Stable far-to-near ordering for draw items. */
export function sortPainters<T extends PainterSortable>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => painterDepth(a.floorIndex, a.x, a.z) - painterDepth(b.floorIndex, b.x, b.z)
  );
}
