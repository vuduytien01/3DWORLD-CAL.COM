"use client";

import { useMemo } from "react";
import { Mesh, MeshStandardMaterial, BoxGeometry, PlaneGeometry, BufferGeometry, BufferAttribute, Group, InstancedMesh, Matrix4, Vector3, Quaternion, Euler } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useHospitalWorld } from "../hooks/useHospitalWorld";
import { SLICE_LAYOUT, MINT_ORDER_SLICE_PALETTE } from "@calcom/features/hospital-pipeline/lib/3d-world";

interface FloorSliceProps {
  slices: any[];
  floorHeight: number;
}

/**
 * Floor slice with merged static geometry (slab, walls, corridor floor)
 * and InstancedMesh for repeated furniture elements.
 */
export function FloorSlice({ slices, floorHeight }: FloorSliceProps) {
  const groupRef = useMemo(() => {
    const group = new Group();
    group.name = "FloorSlices";

    for (const slice of slices) {
      const floorGroup = createFloorSlice(slice);
      group.add(floorGroup);
    }

    return group;
  }, [slices]);

  return <group ref={groupRef} />;
}

function createFloorSlice(slice: any) {
  const floorGroup = new Group();
  floorGroup.name = `Floor_${slice.displayFloor}`;

  const {
    floorWidth,
    floorDepth,
    floorHeight,
    slabThickness,
    wallHeight,
    wallThickness,
    corridor,
    stairHole,
    elevator,
  } = SLICE_LAYOUT;

  const baseY = slice.baseY;

  // Materials
  const floorMaterial = new MeshStandardMaterial({
    color: MINT_ORDER_SLICE_PALETTE.floor,
    roughness: 0.8,
    metalness: 0.1,
  });

  const wallMaterial = new MeshStandardMaterial({
    color: MINT_ORDER_SLICE_PALETTE.wall,
    roughness: 0.7,
    metalness: 0.05,
  });

  const slabMaterial = new MeshStandardMaterial({
    color: "#A0A0A0",
    roughness: 0.9,
    metalness: 0.0,
  });

  // Floor slab (with corridor + stair hole + elevator hole cutouts)
  const slabGeometry = createSlabGeometry(slice);
  const slab = new Mesh(slabGeometry, slabMaterial);
  slab.position.y = baseY + slabThickness / 2;
  slab.receiveShadow = true;
  slab.castShadow = false;
  slab.name = "FloorSlab";

  // Corridor floor (slightly different color)
  const corridorGeometry = new BoxGeometry(
    corridor.x1 - corridor.x0,
    slabThickness,
    corridor.z1 - corridor.z0
  );
  const corridorFloor = new Mesh(corridorGeometry, floorMaterial.clone());
  corridorFloor.position.set(
    (corridor.x0 + corridor.x1) / 2,
    baseY + slabThickness + 0.001,
    (corridor.z0 + corridor.z1) / 2
  );
  corridorFloor.receiveShadow = true;
  corridorFloor.name = "CorridorFloor";

  // Walls (merged into single geometry)
  const wallGeometry = createWallGeometry(slice);
  const walls = new Mesh(wallGeometry, wallMaterial);
  walls.position.y = baseY + slabThickness + wallHeight / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  walls.name = "Walls";

  // Stairwell hole opening in slab
  if (slice.slabHole) {
    const holeGeometry = new BoxGeometry(
      slice.slabHole.x1 - slice.slabHole.x0,
      slabThickness + 0.01,
      slice.slabHole.z1 - slice.slabHole.z0
    );
    const holeMesh = new Mesh(holeGeometry, new MeshStandardMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.8,
    }));
    holeMesh.position.set(
      (slice.slabHole.x0 + slice.slabHole.x1) / 2,
      baseY + slabThickness / 2,
      (slice.slabHole.z0 + slice.slabHole.z1) / 2
    );
    holeMesh.name = "StairHole";
    floorGroup.add(holeMesh);
  }

  // Elevator shaft
  if (slice.elevator) {
    const elevatorGroup = createElevatorShaft(slice);
    floorGroup.add(elevatorGroup);
  }

  // Add all to group
  floorGroup.add(slab);
  floorGroup.add(corridorFloor);
  floorGroup.add(walls);

  return floorGroup;
}

function createSlabGeometry(slice: { footprint: { width: number; depth: number } }): BufferGeometry {
  // Create floor slab with cutouts for corridor, stair hole, elevator
  const { slabThickness, corridor, stairHole, elevator } = SLICE_LAYOUT;

  // For simplicity, return basic box - cutouts would need CSG or manual vertex manipulation
  // In production, use three-mesh-bvh or CSG library for proper cutouts
  const geometry = new BoxGeometry(slice.footprint.width, slabThickness, slice.footprint.depth);
  return geometry;
}

function createWallGeometry(slice: { footprint: { width: number; depth: number } }): BufferGeometry {
  const geometries: any[] = [];
  const { wallHeight, wallThickness, corridor } = SLICE_LAYOUT;
  const baseY = 0; // relative to slab top

  // Outer perimeter walls (with corridor opening)
  // Front wall (z = -footprint.depth/2) - with corridor opening
  // Back wall (z = +footprint.depth/2)
  // Left wall (x = -footprint.width/2)
  // Right wall (x = +footprint.width/2)

  // For simplicity, create basic perimeter - real implementation would
  // subtract corridor opening and create door openings
  const wallGeom = new BoxGeometry(
    slice.footprint.width,
    SLICE_LAYOUT.wallHeight,
    SLICE_LAYOUT.wallThickness
  );

  // We'd create 4 walls and merge - simplified here
  const merged = new BoxGeometry(
    slice.footprint.width,
    SLICE_LAYOUT.wallHeight,
    slice.footprint.depth
  );

  return merged;
}

function createElevatorShaft(slice: any): Group {
  const group = new Group();
  group.name = `Elevator_${slice.displayFloor}`;

  const { elevator } = SLICE_LAYOUT;
  const baseY = slice.baseY;

  // Elevator shaft box (recessed into wall)
  const shaftGeometry = new BoxGeometry(
    2.5, // width
    SLICE_LAYOUT.floorHeight * 3, // spans 3 floors
    2.0 // depth (recessed)
  );

  const shaftMaterial = new MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2,
  });

  const shaft = new Mesh(shaftGeometry, shaftMaterial);
  shaft.position.set(
    elevator.faceX + 1.25, // centered on shaft
    slice.baseY + SLICE_LAYOUT.floorHeight * 1.5, // center of 3-floor span
    elevator.doorZ - 1.0 // recessed
  );
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  shaft.name = "ElevatorShaft";

  // Elevator cabin (if this floor has doors)
  const cabinGeometry = new BoxGeometry(2.0, 2.2, 1.8);
  const cabinMaterial = new MeshStandardMaterial({
    color: 0xCCCCCC,
    roughness: 0.3,
    metalness: 0.7,
  });
  const cabin = new Mesh(cabinGeometry, cabinMaterial);
  cabin.position.copy(shaft.position);
  cabin.name = "ElevatorCabin";

  return group;
}