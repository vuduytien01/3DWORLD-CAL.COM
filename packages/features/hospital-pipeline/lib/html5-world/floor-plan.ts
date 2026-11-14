/**
 * Floor plan model — builds the stacked HTML5 dollhouse from the existing
 * data layer (ADR 0003 keep-list, no data edits).
 *
 * Floor 0 renders GROUND_FLOOR_DEPARTMENTS (step-graph grammar, corridor
 * along Z). Floors 1-9 render khoa-slice dollhouse slices: floors 1-2 keep
 * the slice default template, floors 3-9 override departments from
 * KHOA_UPPER_FLOOR_PLANS — the same override the R3F scene used. Pipeline
 * stations come from STEP_LOCATIONS, restacked onto their floor's height
 * (step.position.y is floor-local eye level; the stacked dollhouse adds
 * floorIndex * 3). Signage strings are taken verbatim from the data.
 */

import {
  buildKhoaFloorSlice,
  type KhoaRoomSpec,
  MINT_ORDER_SLICE_PALETTE,
  SLICE_LAYOUT,
  type SlicePrimitive,
} from "../3d-world/khoa-slice";
import { getUpperFloorPlan, UPPER_FLOOR_INDEXES } from "../data/khoa-upper-floors";
import type { DepartmentSpec, RoomSpec } from "../step-graph/department-locations";
import { GROUND_FLOOR_DEPARTMENTS } from "../step-graph/department-locations";
import { STEP_LOCATIONS } from "../step-graph/step-locations";
import { FLOOR_HEIGHT_M, type IsometricCamera, screenToWorldPlane } from "./world-to-screen";

export const HTML5_PALETTE = MINT_ORDER_SLICE_PALETTE;

const WALL_THICKNESS = SLICE_LAYOUT.wallThickness;
const WALL_HEIGHT = SLICE_LAYOUT.wallHeight;
const DOOR_HEIGHT = SLICE_LAYOUT.doorHeight;
const SLAB_THICKNESS = SLICE_LAYOUT.slabThickness;

const ROOM_FLOOR_LIFT = 0.025;
const SIGN_LIFT = 2.35;
const DEPT_SIGN_LIFT = 2.9;
const STEP_CHIP_LIFT = 2.2;

export type Html5BoxRole =
  | "slab"
  | "corridor"
  | "wall"
  | "door-frame"
  | "door-panel"
  | "room-floor"
  | "furniture"
  | "stair"
  | "elevator"
  | "other";

export interface Html5BoxItem {
  kind: "box";
  id: string;
  role: Html5BoxRole;
  /** Center in absolute dollhouse coordinates (meters). */
  cx: number;
  cy: number;
  cz: number;
  /** Full extents (meters). */
  sx: number;
  sy: number;
  sz: number;
  color: string;
  floorIndex: number;
  /** Set on room-floor items so the renderer can tint the selected department. */
  deptCode?: string;
}

export type Html5SignVariant = "dept-hanging" | "room-wall" | "direction-arrow" | "step-chip";

export interface Html5SignItem {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  z: number;
  widthM: number;
  heightM: number;
  variant: Html5SignVariant;
  floorIndex: number;
  stepId?: string;
}

export interface Html5RoomRef {
  roomId: string;
  deptCode: string;
  label: string;
  floorIndex: number;
  /** World-space footprint on the floor plane (meters). */
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export interface Html5StepRef {
  stepId: string;
  label: string;
  floorIndex: number;
  /** Station center, restacked onto the dollhouse (y includes the floor). */
  x: number;
  y: number;
  z: number;
}

export interface Html5FloorPlan {
  floorIndex: number;
  baseY: number;
  footprint: { xMin: number; xMax: number; zMin: number; zMax: number };
  boxes: readonly Html5BoxItem[];
  signs: readonly Html5SignItem[];
  rooms: readonly Html5RoomRef[];
  steps: readonly Html5StepRef[];
}

export interface Html5World {
  floors: readonly Html5FloorPlan[];
  maxFloorIndex: number;
}

interface Rect {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

function roomRect(room: KhoaRoomSpec | RoomSpec, originX: number, originZ: number): Rect {
  return {
    xMin: originX + room.position.x - room.size.width / 2,
    xMax: originX + room.position.x + room.size.width / 2,
    zMin: originZ + room.position.z - room.size.depth / 2,
    zMax: originZ + room.position.z + room.size.depth / 2,
  };
}

function pushBox(items: Html5BoxItem[], item: Omit<Html5BoxItem, "kind">): void {
  items.push({ kind: "box", ...item });
}

function roomFloorTint(
  items: Html5BoxItem[],
  rect: Rect,
  baseY: number,
  floorIndex: number,
  roomId: string,
  deptCode: string
): void {
  pushBox(items, {
    id: `room-floor-${roomId}`,
    role: "room-floor",
    cx: (rect.xMin + rect.xMax) / 2,
    cy: baseY + SLAB_THICKNESS / 2 + ROOM_FLOOR_LIFT,
    cz: (rect.zMin + rect.zMax) / 2,
    sx: rect.xMax - rect.xMin,
    sy: 0.05,
    sz: rect.zMax - rect.zMin,
    color: HTML5_PALETTE.accentLight,
    floorIndex,
    deptCode,
  });
}

/**
 * Extruded room walls for a ground-floor room, mirroring khoa-slice pushRoom:
 * full back wall, two side walls, and a front wall split around the door gap
 * with frame + panel. The door sits on the edge `doorSide` points to.
 */
function pushWallsWithDoor(
  items: Html5BoxItem[],
  roomId: string,
  rect: Rect,
  baseY: number,
  floorIndex: number,
  doorAxis: "x" | "z",
  doorSide: 1 | -1,
  doorCenterAlong: number,
  doorWidth: number
): void {
  const wt = WALL_THICKNESS;
  const wh = WALL_HEIGHT;
  const wallColor = HTML5_PALETTE.wall;

  // a = axis the door gap runs along; b = axis the door plane faces.
  const aMin = doorAxis === "z" ? rect.xMin : rect.zMin;
  const aMax = doorAxis === "z" ? rect.xMax : rect.zMax;
  const bMin = doorAxis === "z" ? rect.zMin : rect.xMin;
  const bMax = doorAxis === "z" ? rect.zMax : rect.xMax;
  const aCenter = (aMin + aMax) / 2;
  const bCenter = (bMin + bMax) / 2;
  const frontB = doorSide > 0 ? bMax + wt / 2 : bMin - wt / 2;
  const backB = doorSide > 0 ? bMin - wt / 2 : bMax + wt / 2;

  const place = (
    role: Html5BoxRole,
    label: string,
    alongSpan: number,
    thickness: number,
    height: number,
    aPos: number,
    bPos: number,
    color: string
  ) => {
    pushBox(items, {
      id: `wall-${roomId}-${label}`,
      role,
      cx: doorAxis === "z" ? aPos : bPos,
      cy: baseY + height / 2,
      cz: doorAxis === "z" ? bPos : aPos,
      sx: doorAxis === "z" ? alongSpan : thickness,
      sy: height,
      sz: doorAxis === "z" ? thickness : alongSpan,
      color,
      floorIndex,
    });
  };

  place("wall", "back", aMax - aMin + wt * 2, wt, wh, aCenter, backB, wallColor);
  place("wall", "side-lo", wt, bMax - bMin, wh, aMin - wt / 2, bCenter, wallColor);
  place("wall", "side-hi", wt, bMax - bMin, wh, aMax + wt / 2, bCenter, wallColor);

  if (doorWidth <= 0) {
    place("wall", "front", aMax - aMin + wt * 2, wt, wh, aCenter, frontB, wallColor);
    return;
  }

  const segLo0 = aMin - wt;
  const segLo1 = doorCenterAlong - doorWidth / 2;
  const segHi0 = doorCenterAlong + doorWidth / 2;
  const segHi1 = aMax + wt;
  if (segLo1 - segLo0 > 0.05) {
    place("wall", "front-lo", segLo1 - segLo0, wt, wh, (segLo0 + segLo1) / 2, frontB, wallColor);
  }
  if (segHi1 - segHi0 > 0.05) {
    place("wall", "front-hi", segHi1 - segHi0, wt, wh, (segHi0 + segHi1) / 2, frontB, wallColor);
  }
  place(
    "door-frame",
    "frame",
    doorWidth + 0.1,
    wt + 0.04,
    DOOR_HEIGHT + 0.05,
    doorCenterAlong,
    frontB,
    HTML5_PALETTE.primaryDark
  );
  place(
    "door-panel",
    "panel",
    doorWidth - 0.06,
    0.05,
    DOOR_HEIGHT - 0.05,
    doorCenterAlong,
    frontB,
    HTML5_PALETTE.primary
  );
}

function buildGroundFloor(): Html5FloorPlan {
  const floorIndex = 0;
  const baseY = 0;
  const boxes: Html5BoxItem[] = [];
  const signs: Html5SignItem[] = [];
  const rooms: Html5RoomRef[] = [];

  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;

  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    for (const room of dept.rooms) {
      const rect = roomRect(room, dept.worldOrigin.x, dept.worldOrigin.z);
      xMin = Math.min(xMin, rect.xMin);
      xMax = Math.max(xMax, rect.xMax);
      zMin = Math.min(zMin, rect.zMin);
      zMax = Math.max(zMax, rect.zMax);
      rooms.push({
        roomId: room.roomId,
        deptCode: dept.code,
        label: room.label,
        floorIndex,
        ...rect,
      });
      roomFloorTint(boxes, rect, baseY, floorIndex, room.roomId, dept.code);

      const offset = room.doorOffset;
      const doorAxis: "x" | "z" = Math.abs(offset.x) > Math.abs(offset.z) ? "x" : "z";
      if (room.doorWidth > 0) {
        if (doorAxis === "z") {
          const doorSide: 1 | -1 = offset.z > 0 ? 1 : -1;
          pushWallsWithDoor(
            boxes,
            room.roomId,
            rect,
            baseY,
            floorIndex,
            "z",
            doorSide,
            dept.worldOrigin.x + room.position.x + offset.x,
            room.doorWidth
          );
          signs.push({
            id: `sign-room-${room.roomId}`,
            text: room.label,
            color: HTML5_PALETTE.primary,
            x: dept.worldOrigin.x + room.position.x + offset.x,
            y: baseY + SIGN_LIFT,
            z: (doorSide > 0 ? rect.zMax : rect.zMin) + doorSide * (WALL_THICKNESS / 2 + 0.02),
            widthM: 1.2,
            heightM: 0.35,
            variant: "room-wall",
            floorIndex,
          });
        } else {
          const doorSide: 1 | -1 = offset.x > 0 ? 1 : -1;
          pushWallsWithDoor(
            boxes,
            room.roomId,
            rect,
            baseY,
            floorIndex,
            "x",
            doorSide,
            dept.worldOrigin.z + room.position.z + offset.z,
            room.doorWidth
          );
          signs.push({
            id: `sign-room-${room.roomId}`,
            text: room.label,
            color: HTML5_PALETTE.primary,
            x: (doorSide > 0 ? rect.xMax : rect.xMin) + doorSide * (WALL_THICKNESS / 2 + 0.02),
            y: baseY + SIGN_LIFT,
            z: dept.worldOrigin.z + room.position.z + offset.z,
            widthM: 1.2,
            heightM: 0.35,
            variant: "room-wall",
            floorIndex,
          });
        }
      } else {
        // Open kiosk (doorWidth 0): full front wall, no door, no sign.
        pushWallsWithDoor(
          boxes,
          room.roomId,
          rect,
          baseY,
          floorIndex,
          doorAxis,
          doorAxis === "z" ? (offset.z >= 0 ? 1 : -1) : offset.x >= 0 ? 1 : -1,
          doorAxis === "z" ? dept.worldOrigin.x + room.position.x : dept.worldOrigin.z + room.position.z,
          0
        );
      }
    }

    const centroidX =
      dept.rooms.reduce((sum, room) => sum + dept.worldOrigin.x + room.position.x, 0) / dept.rooms.length;
    signs.push({
      id: `sign-dept-${dept.code}`,
      text: `${dept.name} · ${dept.shortCode}`,
      color: dept.signageColor,
      x: centroidX,
      y: baseY + DEPT_SIGN_LIFT,
      z: dept.worldOrigin.z,
      widthM: 2.0,
      heightM: 0.5,
      variant: "dept-hanging",
      floorIndex,
    });
  }

  const pad = 2;
  const footprint = { xMin: xMin - pad, xMax: xMax + pad, zMin: zMin - pad, zMax: zMax + pad };

  pushBox(boxes, {
    id: "ground-slab",
    role: "slab",
    cx: (footprint.xMin + footprint.xMax) / 2,
    cy: baseY - SLAB_THICKNESS / 2,
    cz: (footprint.zMin + footprint.zMax) / 2,
    sx: footprint.xMax - footprint.xMin,
    sy: SLAB_THICKNESS,
    sz: footprint.zMax - footprint.zMin,
    color: HTML5_PALETTE.floor,
    floorIndex,
  });
  // Open walkable spine between the two room rows; room tints land on top of it.
  pushBox(boxes, {
    id: "ground-corridor",
    role: "corridor",
    cx: 0,
    cy: baseY + SLAB_THICKNESS / 2 + ROOM_FLOOR_LIFT,
    cz: (footprint.zMin + footprint.zMax) / 2,
    sx: 10,
    sy: 0.05,
    sz: footprint.zMax - footprint.zMin,
    color: HTML5_PALETTE.accent,
    floorIndex,
  });

  return { floorIndex, baseY, footprint, boxes, signs, rooms, steps: [] };
}

function roleForPrimitive(role: string): Html5BoxRole {
  if (role.startsWith("slab")) return "slab";
  if (role.startsWith("corridor")) return "corridor";
  if (role.startsWith("room-wall")) return "wall";
  if (role.startsWith("door-frame")) return "door-frame";
  if (role.startsWith("door-panel")) return "door-panel";
  if (role.startsWith("furniture")) return "furniture";
  if (role.startsWith("stair")) return "stair";
  if (role.startsWith("elevator")) return "elevator";
  return "other";
}

function primitiveToBox(primitive: SlicePrimitive, floorIndex: number): Html5BoxItem {
  // Planes are flat panels; approximate as thin boxes so one draw path serves
  // both. A plane rotated ±90° around Y runs its width along Z.
  const rotY = primitive.rotation?.y ?? 0;
  const rotated = Math.abs(Math.abs(rotY) - Math.PI / 2) < 0.01;
  const isPlane = primitive.kind === "plane";
  const thickness = 0.06;
  return {
    kind: "box",
    id: primitive.role,
    role: roleForPrimitive(primitive.role),
    cx: primitive.position.x,
    cy: primitive.position.y,
    cz: primitive.position.z,
    sx: isPlane ? (rotated ? thickness : primitive.size.x) : primitive.size.x,
    sy: primitive.size.y,
    sz: isPlane ? (rotated ? primitive.size.x : thickness) : primitive.size.z,
    color: primitive.color,
    floorIndex,
  };
}

function buildSliceFloor(floorIndex: number): Html5FloorPlan {
  const departments = UPPER_FLOOR_INDEXES.includes(floorIndex as (typeof UPPER_FLOOR_INDEXES)[number])
    ? getUpperFloorPlan(floorIndex)
    : undefined;
  const slice = buildKhoaFloorSlice(floorIndex, { departments });

  const boxes = slice.primitives.map((p) => primitiveToBox(p, floorIndex));
  const signs: Html5SignItem[] = slice.signs.map((sign) => ({
    id: sign.id,
    text: sign.content,
    color: sign.color,
    x: sign.position.x,
    y: sign.position.y,
    z: sign.position.z,
    widthM: sign.size.x,
    heightM: sign.size.y,
    variant: sign.variant,
    floorIndex,
  }));
  const rooms: Html5RoomRef[] = [];
  for (const dept of slice.departments) {
    for (const room of dept.rooms) {
      const rect = roomRect(room, 0, 0);
      rooms.push({
        roomId: room.roomId,
        deptCode: dept.code,
        label: room.label,
        floorIndex,
        ...rect,
      });
      roomFloorTint(boxes, rect, slice.baseY, floorIndex, room.roomId, dept.code);
    }
  }
  for (const room of slice.sharedRooms) {
    const rect = roomRect(room, 0, 0);
    rooms.push({
      roomId: room.roomId,
      deptCode: "",
      label: room.label,
      floorIndex,
      ...rect,
    });
    roomFloorTint(boxes, rect, slice.baseY, floorIndex, room.roomId, "");
  }

  return {
    floorIndex,
    baseY: slice.baseY,
    footprint: { xMin: 0, xMax: slice.footprint.width, zMin: 0, zMax: slice.footprint.depth },
    boxes,
    signs,
    rooms,
    steps: [],
  };
}

function buildStepRefs(): readonly Html5StepRef[] {
  return STEP_LOCATIONS.map((step) => ({
    stepId: step.stepId,
    label: step.label,
    floorIndex: step.floor,
    x: step.position.x,
    y: step.position.y + step.floor * FLOOR_HEIGHT_M,
    z: step.position.z,
  }));
}

/** Floors 1-2 keep the slice template; 3-9 take the upper-floor plan overrides. */
function sliceFloorIndexes(): readonly number[] {
  const indexes: number[] = [];
  const maxUpper = Math.max(...UPPER_FLOOR_INDEXES);
  for (let i = 1; i <= maxUpper; i++) indexes.push(i);
  return indexes;
}

export function buildHtml5World(): Html5World {
  const floors: Html5FloorPlan[] = [buildGroundFloor()];
  for (const floorIndex of sliceFloorIndexes()) {
    floors.push(buildSliceFloor(floorIndex));
  }

  const steps = buildStepRefs();
  for (const floor of floors) {
    const floorSteps = steps.filter((s) => s.floorIndex === floor.floorIndex);
    (floor.steps as Html5StepRef[]).push(...floorSteps);
    for (const step of floorSteps) {
      (floor.signs as Html5SignItem[]).push({
        id: `step-chip-${step.stepId}`,
        text: step.label,
        color: HTML5_PALETTE.primaryDark,
        x: step.x,
        y: step.y + STEP_CHIP_LIFT,
        z: step.z,
        widthM: 2.0,
        heightM: 0.5,
        variant: "step-chip",
        floorIndex: floor.floorIndex,
        stepId: step.stepId,
      });
    }
  }

  return { floors, maxFloorIndex: floors.length - 1 };
}

/** Focus floor ± 1, clamped to the built floors (ADR overlay budget rule). */
export function overlayFloorRange(focusFloor: number, maxFloorIndex: number): readonly number[] {
  const focus = Math.min(Math.max(Math.floor(focusFloor), 0), maxFloorIndex);
  const lo = Math.max(0, focus - 1);
  const hi = Math.min(maxFloorIndex, focus + 1);
  const range: number[] = [];
  for (let i = lo; i <= hi; i++) range.push(i);
  return range;
}

export function countOverlayNodes(world: Html5World, focusFloor: number): number {
  return overlayFloorRange(focusFloor, world.maxFloorIndex).reduce((sum, floorIndex) => {
    const floor = world.floors[floorIndex];
    if (!floor) return sum;
    return sum + 1 + floor.rooms.length + floor.signs.length + floor.steps.length;
  }, 0);
}

/**
 * Canvas-space hit-test: inverse-project the point onto ONE floor plane —
 * the focus floor by default — and compare the world rect (four comparisons).
 * Restricting to a single plane is what keeps this exact: the same screen
 * point inverse-projects into unrelated rooms on every other floor plane.
 */
export function findRoomAtScreen(
  sx: number,
  sy: number,
  world: Html5World,
  camera: IsometricCamera,
  floorIndex: number = camera.focusFloor
): Html5RoomRef | null {
  const floor = world.floors[floorIndex];
  if (!floor) return null;
  const point = screenToWorldPlane(sx, sy, camera, floor.baseY);
  return (
    floor.rooms.find(
      (room) => point.x >= room.xMin && point.x <= room.xMax && point.z >= room.zMin && point.z <= room.zMax
    ) ?? null
  );
}
