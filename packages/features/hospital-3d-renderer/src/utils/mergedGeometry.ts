import { BufferGeometry, BoxGeometry, PlaneGeometry, MeshStandardMaterial, Mesh, Group, Vector3, Matrix4, BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SLICE_LAYOUT, type KhoaFloorSlice } from "@calcom/features/hospital-pipeline/lib/3d-world";

// Computed stair dimensions from SLICE_LAYOUT
const STAIR_HOLE = SLICE_LAYOUT.stairHole;
const STAIR_WIDTH = STAIR_HOLE.x1 - STAIR_HOLE.x0; // 3.6
const STAIR_DEPTH = (STAIR_HOLE.z1 - STAIR_HOLE.z0) / SLICE_LAYOUT.stairSteps; // 2.2 / 12 = 0.1833...
const STAIR_RISE = SLICE_LAYOUT.floorHeight / SLICE_LAYOUT.stairSteps; // 3 / 12 = 0.25
const STAIR_STEPS = SLICE_LAYOUT.stairSteps;

/**
 * Merge static geometries for performance.
 * Combines multiple BoxGeometry/PlaneGeometry into single BufferGeometry.
 */

export interface MergedGeometryResult {
  geometry: any;
  material: any;
  mesh: any;
}

/**
 * Create merged floor slab geometry for a slice.
 * Handles cutouts for corridor, stair hole, elevator.
 */
export function createMergedFloorSlab(slice: KhoaFloorSlice): BufferGeometry {
  const { floorWidth, floorDepth, slabThickness, corridor, stairHole, elevator } = SLICE_LAYOUT;

  const geometries: BufferGeometry[] = [];

  // Main floor slab
  const mainSlab = new BoxGeometry(
    slice.footprint.width,
    SLICE_LAYOUT.slabThickness,
    slice.footprint.depth
  );
  const slabMatrix = new Matrix4().makeTranslation(0, SLICE_LAYOUT.slabThickness / 2, 0);
  mainSlab.applyMatrix4(slabMatrix);
  geometries.push(mainSlab);

  // Corridor cutout (subtract - we'd use CSG in production)
  // For now, just create corridor floor as separate geometry
  const corridorGeom = new BoxGeometry(
    corridor.x1 - corridor.x0,
    SLICE_LAYOUT.slabThickness + 0.001,
    corridor.z1 - corridor.z0
  );
  const corridorMatrix = new Matrix4().makeTranslation(
    (corridor.x0 + corridor.x1) / 2,
    SLICE_LAYOUT.slabThickness + 0.001,
    (corridor.z0 + corridor.z1) / 2
  );
  corridorGeom.applyMatrix4(corridorMatrix);
  geometries.push(corridorGeom);

  // Merge all geometries
  const merged = mergeGeometries(geometries);
  return merged;
}

/**
 * Create merged wall geometry for a slice.
 * Handles corridor opening and door openings.
 */
export function createMergedWalls(slice: KhoaFloorSlice): BufferGeometry {
  const { wallHeight, wallThickness, corridor, floorWidth, floorDepth } = SLICE_LAYOUT;
  const { footprint } = slice;

  const wallGeometries: BufferGeometry[] = [];

  // Front wall (z = -footprint.depth/2) - with corridor opening
  // We'll create 3 segments: left of corridor, right of corridor, above corridor
  const frontWallLeft = new BoxGeometry(
    (corridor.x0 + footprint.width / 2),
    wallHeight,
    wallThickness
  );
  const frontLeftMatrix = new Matrix4().makeTranslation(
    -(footprint.width / 2) + (corridor.x0 + footprint.width / 2) / 2,
    wallHeight / 2,
    -footprint.depth / 2
  );
  frontWallLeft.applyMatrix4(frontLeftMatrix);
  wallGeometries.push(frontWallLeft);

  const frontWallRight = new BoxGeometry(
    (footprint.width / 2 - corridor.x1),
    wallHeight,
    wallThickness
  );
  const frontRightMatrix = new Matrix4().makeTranslation(
    corridor.x1 + (footprint.width / 2 - corridor.x1) / 2,
    wallHeight / 2,
    -footprint.depth / 2
  );
  frontWallRight.applyMatrix4(frontRightMatrix);
  wallGeometries.push(frontWallRight);

  // Front wall above corridor (lintel)
  const frontWallTop = new BoxGeometry(
    corridor.x1 - corridor.x0,
    wallHeight - SLICE_LAYOUT.doorHeight,
    wallThickness
  );
  const frontTopMatrix = new Matrix4().makeTranslation(
    (corridor.x0 + corridor.x1) / 2,
    SLICE_LAYOUT.slabThickness + SLICE_LAYOUT.doorHeight + (wallHeight - SLICE_LAYOUT.doorHeight) / 2,
    -footprint.depth / 2
  );
  frontWallTop.applyMatrix4(frontTopMatrix);
  wallGeometries.push(frontWallTop);

  // Back wall (z = +footprint.depth/2) - solid
  const backWall = new BoxGeometry(
    footprint.width,
    wallHeight,
    wallThickness
  );
  const backMatrix = new Matrix4().makeTranslation(0, wallHeight / 2, footprint.depth / 2);
  backWall.applyMatrix4(backMatrix);
  wallGeometries.push(backWall);

  // Left wall (x = -footprint.width/2)
  const leftWall = new BoxGeometry(
    wallThickness,
    wallHeight,
    footprint.depth
  );
  const leftMatrix = new Matrix4().makeTranslation(
    -footprint.width / 2,
    wallHeight / 2,
    0
  );
  leftWall.applyMatrix4(leftMatrix);
  wallGeometries.push(leftWall);

  // Right wall (x = +footprint.width/2)
  const rightWall = new BoxGeometry(
    wallThickness,
    wallHeight,
    footprint.depth
  );
  const rightMatrix = new Matrix4().makeTranslation(
    footprint.width / 2,
    wallHeight / 2,
    0
  );
  rightWall.applyMatrix4(rightMatrix);
  wallGeometries.push(rightWall);

  // Merge all wall geometries
  const merged = mergeGeometries(wallGeometries);
  return merged;
}

/**
 * Create merged corridor floor geometry
 */
export function createCorridorFloor(): any {
  const { corridor } = SLICE_LAYOUT;
  const geometry = new BoxGeometry(
    corridor.x1 - corridor.x0,
    SLICE_LAYOUT.slabThickness + 0.001,
    corridor.z1 - corridor.z0
  );
  const matrix = new Matrix4().makeTranslation(
    (corridor.x0 + corridor.x1) / 2,
    SLICE_LAYOUT.slabThickness + 0.001,
    (corridor.z0 + corridor.z1) / 2
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

/**
 * Create stairwell geometry (merged steps)
 */
export function createStairwellGeometry(numFloors: number): any {
  const { stairHole, stairSteps, floorHeight, slabThickness } = SLICE_LAYOUT;

  const geometries: any[] = [];
  const stepGeometry = new BoxGeometry(
    STAIR_WIDTH,
    STAIR_RISE,
    STAIR_DEPTH
  );

  const totalSteps = STAIR_STEPS * numFloors;
  const holeCenterX = (stairHole.x0 + stairHole.x1) / 2;
  const holeCenterZ = (stairHole.z0 + stairHole.z1) / 2;
  const baseY = slabThickness;

  for (let i = 0; i < totalSteps; i++) {
    const stepGeom = new BoxGeometry(
      STAIR_WIDTH,
      STAIR_RISE,
      STAIR_DEPTH
    );
    const stepMatrix = new Matrix4().makeTranslation(
      holeCenterX,
      baseY + i * STAIR_RISE + STAIR_RISE / 2,
      holeCenterZ - (stairHole.z1 - stairHole.z0) / 2 + STAIR_DEPTH / 2 + i * STAIR_DEPTH
    );
    stepGeom.applyMatrix4(stepMatrix);
    geometries.push(stepGeom);
  }

  // Railings
  const railingHeight = 1.0;
  const railingThickness = 0.05;

  const leftRailingGeometry = new BoxGeometry(
    railingThickness,
    railingHeight,
    STAIR_DEPTH * STAIR_STEPS * numFloors
  );
  const leftRailingMatrix = new Matrix4().makeTranslation(
    holeCenterX - STAIR_WIDTH / 2 - railingThickness / 2,
    baseY + railingHeight / 2,
    holeCenterZ
  );
  leftRailingGeometry.applyMatrix4(leftRailingMatrix);
  geometries.push(leftRailingGeometry);

  const rightRailingGeometry = leftRailingGeometry.clone();
  const rightRailingMatrix = new Matrix4().makeTranslation(
    holeCenterX + STAIR_WIDTH / 2 + railingThickness / 2,
    baseY + railingHeight / 2,
    holeCenterZ
  );
  rightRailingGeometry.applyMatrix4(rightRailingMatrix);
  geometries.push(rightRailingGeometry);

  const merged = mergeGeometries(geometries);
  return merged;
}

/**
 * Create elevator shaft geometry
 */
export function createElevatorShaftGeometry(numFloors: number): any {
  const { elevator, floorHeight } = SLICE_LAYOUT;

  const geometries: any[] = [];

  // Shaft
  const shaftGeometry = new BoxGeometry(
    2.5,
    floorHeight * numFloors,
    2.0
  );
  const shaftMatrix = new Matrix4().makeTranslation(
    elevator.faceX + 1.25,
    floorHeight * numFloors / 2,
    elevator.doorZ - 1.0
  );
  const shaftGeometryClone = shaftGeometry.clone();
  shaftGeometryClone.applyMatrix4(shaftMatrix);
  geometries.push(shaftGeometryClone);

  // Cabin
  const cabinGeometry = new BoxGeometry(2.0, 2.2, 1.8);
  const cabinMatrix = new Matrix4().makeTranslation(
    elevator.faceX + 1.25,
    floorHeight * 1.5,
    elevator.doorZ - 1.0
  );
  const cabinGeometryClone = cabinGeometry.clone();
  cabinGeometryClone.applyMatrix4(cabinMatrix);
  geometries.push(cabinGeometryClone);

  // Doors
  const doorGeometry = new BoxGeometry(0.05, 2.1, 0.9);
  const leftDoorMatrix = new Matrix4().makeTranslation(
    elevator.faceX + 1.25 - 1.0,
    floorHeight * 1.5,
    elevator.doorZ - 1.0 + 0.05
  );
  const doorClone = doorGeometry.clone();
  doorClone.applyMatrix4(leftDoorMatrix);
  geometries.push(doorClone);

  const rightDoorMatrix = new Matrix4().makeTranslation(
    elevator.faceX + 1.25 + 1.0,
    floorHeight * 1.5,
    elevator.doorZ - 1.0 + 0.05
  );
  const doorClone2 = doorGeometry.clone();
  doorClone2.applyMatrix4(rightDoorMatrix);
  geometries.push(doorClone2);

  const merged = mergeGeometries(geometries);
  return merged;
}

// Remove the duplicate export line - mergedGeometry was just a placeholder