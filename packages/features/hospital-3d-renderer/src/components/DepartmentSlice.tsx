"use client";

import { useMemo } from "react";
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, PlaneGeometry, BufferGeometry, InstancedMesh, Matrix4, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SLICE_LAYOUT, SLICE_FURNITURE_PRESET_BY_KIND, MINT_ORDER_SLICE_PALETTE } from "@calcom/features/hospital-pipeline/lib/3d-world";

interface DepartmentSliceProps {
  slices: any[];
}

/**
 * Department slices with rooms and furniture using InstancedMesh for performance.
 * Each furniture kind gets one InstancedMesh with per-instance transforms.
 */
export function DepartmentSlice({ slices }: DepartmentSliceProps) {
  const departmentGroup = useMemo(() => {
    const group = new Group();
    group.name = "Departments";

    for (const slice of slices) {
      for (const dept of slice.departments) {
        const deptGroup = createDepartmentGroup(dept, slice);
        group.add(deptGroup);
      }

      // Shared rooms (waiting, etc.)
      if (slice.sharedRooms) {
        for (const room of slice.sharedRooms) {
          const roomGroup = createRoomGroup(room, slice);
          group.add(roomGroup);
        }
      }
    }

    return group;
  }, [slices]);

  return <group ref={departmentGroup} />;
}

function createDepartmentGroup(dept: any, slice: any) {
  const deptGroup = new Group();
  deptGroup.name = `Dept_${dept.code}_Floor${slice.displayFloor}`;

  for (const room of dept.rooms) {
    const roomGroup = createRoomGroup(room, slice);
    deptGroup.add(roomGroup);
  }

  return deptGroup;
}

function createRoomGroup(room: any, slice: any) {
  const roomGroup = new Group();
  roomGroup.name = `Room_${room.roomId}_Floor${slice.displayFloor}`;

  const { floorHeight, wallHeight, slabThickness } = SLICE_LAYOUT;
  const baseY = slice.baseY + slabThickness;

  // Room volume (for collision/raycasting)
  const roomGeometry = new BoxGeometry(
    room.size.width,
    SLICE_LAYOUT.wallHeight,
    room.size.depth
  );

  const roomMaterial = new MeshStandardMaterial({
    color: 0xF5F5F5,
    roughness: 0.8,
    metalness: 0.0,
    transparent: true,
    opacity: 0.3,
    side: 2, // DoubleSide for interior view
  });

  const roomMesh = new Mesh(roomGeometry, roomMaterial);
  roomMesh.position.set(
    room.position.x,
    baseY + SLICE_LAYOUT.wallHeight / 2,
    room.position.z
  );
  roomMesh.name = `RoomVolume_${room.roomId}`;
  roomMesh.visible = false; // Invisible by default, for collision only

  // Add furniture for this room
  const furniture = createRoomFurniture(room, slice);
  if (furniture) {
    roomGroup.add(furniture);
  }

  // Room signage (handled separately by Signage component)

  return roomGroup;
}

import type { KhoaRoomKind } from "@calcom/features/hospital-pipeline/lib/3d-world";

function createRoomFurniture(room: { kind: KhoaRoomKind; roomId: string; position: { x: number; z: number }; size: { width: number; depth: number } }, slice: any) {
  const preset = SLICE_FURNITURE_PRESET_BY_KIND[room.kind];
  if (!preset || preset.length === 0) return null;

  const furnitureGroup = new Group();
  furnitureGroup.name = `Furniture_${room.roomId}`;

  const baseY = slice.baseY + SLICE_LAYOUT.slabThickness;
  const facingSouth = room.position.z > SLICE_LAYOUT.corridor.z1; // room on south side of corridor

  for (const part of preset) {
    const geometry = part.kind === "box"
      ? new BoxGeometry(part.size.x, part.size.y, part.size.z)
      : new PlaneGeometry(part.size.x, part.size.y);

    const material = new MeshStandardMaterial({
      color: getFurnitureColor(part.role),
      roughness: 0.7,
      metalness: 0.1,
    });

    // For InstancedMesh, we'd collect all instances of the same geometry+material
    // For now, create individual meshes (will optimize to InstancedMesh later)
    const mesh = part.kind === "box"
      ? new Mesh(geometry as BoxGeometry, material)
      : new Mesh(geometry as any, material);

    // Position relative to room center
    let offset = { ...part.offset };
    if (facingSouth && part.faceCorridor) {
      offset.z = -offset.z; // mirror Z for south-facing rooms
    }

    mesh.position.set(
      room.position.x + offset.x,
      baseY + offset.y,
      room.position.z + offset.z
    );

    // Rotate if facing south
    if (facingSouth) {
      mesh.rotation.y = Math.PI;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Furniture_${part.role}_${room.roomId}`;

    furnitureGroup.add(mesh);
  }

  return furnitureGroup;
}

function getFurnitureColor(role: string): string {
  const colors: Record<string, string> = {
    "bed-base": "#8B7355",
    "bed-mattress": "#FFF8DC",
    "bed-pillow": "#FFFFFF",
    "gantry-column": "#555555",
    "gantry-arm": "#444444",
    "exam-table": "#E0E0E0",
    "console": "#333333",
    "machine": "#4A4A4A",
    "screen": "#1A1A2E",
    "exam-bed": "#E8E8E8",
    "desk": "#8B7355",
    "vision-chart": "#FFFFFF",
    "scope-stand": "#333333",
    "scope-head": "#222222",
    "chair-base": "#333333",
    "chair-seat": "#4A4A4A",
    "chair-back": "#333333",
    "table-top": "#CCCCCC",
    "table-column": "#666666",
    "table-base": "#555555",
    "lamp": "#FFD700",
  };
  return colors[role] || "#888888";
}