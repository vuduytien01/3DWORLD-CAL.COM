import { InstancedMesh, Matrix4, BufferGeometry, BufferAttribute, MeshStandardMaterial, BoxGeometry, PlaneGeometry, Vector3, Quaternion, Euler, DynamicDrawUsage } from "three";
import { SLICE_LAYOUT, SLICE_FURNITURE_PRESET_BY_KIND, type KhoaRoomKind, type KhoaFloorSlice } from "@calcom/features/hospital-pipeline/lib/3d-world";

interface FurniturePart {
  role: string;
  kind: "box" | "plane";
  size: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
  faceCorridor?: boolean;
}

interface InstancedPartResult {
  mesh: InstancedMesh;
  instanceMap: Map<string, number[]>;
}

/**
 * Build InstancedMesh for all furniture of a given kind across all rooms.
 * Returns a map of part role -> InstancedPartResult
 */
export function buildInstancedFurniture(
  slices: KhoaFloorSlice[],
  furnitureKind: KhoaRoomKind
): Map<string, InstancedPartResult> | null {
  const preset = SLICE_FURNITURE_PRESET_BY_KIND[furnitureKind] as readonly FurniturePart[];
  if (!preset || preset.length === 0) return null;

  const corridor = SLICE_LAYOUT.corridor;
  const slabThickness = SLICE_LAYOUT.slabThickness;

  // Group instances by part role
  const partInstances = new Map<string, Array<{
    matrix: Matrix4;
    roomId: string;
  }>>();

  for (const slice of slices) {
    const baseY = slice.baseY + slabThickness;

    // Department rooms
    for (const dept of slice.departments) {
      for (const room of dept.rooms) {
        if (room.kind !== furnitureKind) continue;

        const facingSouth = room.position.z > corridor.z1;
        const roomCenterX = room.position.x;
        const roomCenterZ = room.position.z;

        for (let partIndex = 0; partIndex < preset.length; partIndex++) {
          const part = preset[partIndex];

          // Calculate world position for each instance
          let offset = { ...part.offset };
          if (facingSouth && part.faceCorridor) {
            offset.z = -offset.z;
          }

          const worldX = roomCenterX + offset.x;
          const worldY = baseY + offset.y;
          const worldZ = roomCenterZ + offset.z;

          // Create transformation matrix
          const matrix = new Matrix4();
          const position = new Vector3(worldX, worldY, worldZ);
          const quaternion = new Quaternion();
          if (facingSouth) {
            quaternion.setFromEuler(new Euler(0, Math.PI, 0));
          }
          const scale = new Vector3(1, 1, 1);
          matrix.compose(position, quaternion, scale);

          if (!partInstances.has(part.role)) {
            partInstances.set(part.role, []);
          }
          partInstances.get(part.role)!.push({
            matrix,
            roomId: room.roomId,
          });
        }
      }
    }

    // Shared rooms
    if (slice.sharedRooms) {
      for (const room of slice.sharedRooms) {
        if (room.kind !== furnitureKind) continue;

        const facingSouth = room.position.z > corridor.z1;
        const roomCenterX = room.position.x;
        const roomCenterZ = room.position.z;

        for (let partIndex = 0; partIndex < preset.length; partIndex++) {
          const part = preset[partIndex];
          let offset = { ...part.offset };
          if (facingSouth && part.faceCorridor) {
            offset.z = -offset.z;
          }

          const worldX = roomCenterX + offset.x;
          const worldY = baseY + offset.y;
          const worldZ = roomCenterZ + offset.z;

          const matrix = new Matrix4();
          const position = new Vector3(worldX, worldY, worldZ);
          const quaternion = new Quaternion();
          if (facingSouth) {
            quaternion.setFromEuler(new Euler(0, Math.PI, 0));
          }
          const scale = new Vector3(1, 1, 1);
          matrix.compose(position, quaternion, scale);

          if (!partInstances.has(part.role)) {
            partInstances.set(part.role, []);
          }
          partInstances.get(part.role)!.push({
            matrix,
            roomId: room.roomId,
          });
        }
      }
    }
  }

  // Create InstancedMesh for each part
  const results = new Map<string, InstancedPartResult>();

  for (const [role, instances] of Array.from(partInstances.entries())) {
    if (instances.length === 0) continue;

    // Find the part definition
    const partDef = preset.find(p => p.role === role);
    if (!partDef) continue;

    // Create geometry based on part kind
    let geometry: BufferGeometry;
    if (partDef.kind === "box") {
      geometry = new BoxGeometry(partDef.size.x, partDef.size.y, partDef.size.z);
    } else {
      geometry = new PlaneGeometry(partDef.size.x, partDef.size.y);
    }

    // Create InstancedMesh
    const mesh = new InstancedMesh(geometry, getFurnitureMaterial(role), instances.length);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    // Set matrices
    const instanceMap = new Map<string, number[]>();
    for (let i = 0; i < instances.length; i++) {
      mesh.setMatrixAt(i, instances[i].matrix);
      
      // Build roomId -> indices map
      if (!instanceMap.has(instances[i].roomId)) {
        instanceMap.set(instances[i].roomId, []);
      }
      instanceMap.get(instances[i].roomId)!.push(i);
    }
    mesh.instanceMatrix.needsUpdate = true;

    results.set(role, { mesh, instanceMap });
  }

  return results.size > 0 ? results : null;
}

/**
 * Build InstancedMesh for ALL furniture kinds across all slices.
 * Returns a map of furnitureKind -> Map of part role -> InstancedPartResult
 */
export function buildAllInstancedFurniture(slices: KhoaFloorSlice[]): Map<KhoaRoomKind, Map<string, InstancedPartResult>> {
  const allResults = new Map<KhoaRoomKind, Map<string, InstancedPartResult>>();
  
  const furnitureKinds: KhoaRoomKind[] = [
    "exam", "xray", "ultrasound", "surgery", "ophthalmology", "ent", 
    "dental", "waiting", "reception", "payment", "ward", "nurse-station"
  ];

  for (const kind of furnitureKinds) {
    const result = buildInstancedFurniture(slices, kind);
    if (result && result.size > 0) {
      allResults.set(kind, result);
    }
  }

  return allResults;
}

/**
 * Create material for furniture part
 */
export function getFurnitureMaterial(role: string): MeshStandardMaterial {
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
    "bench-seat": "#CCCCCC",
    "bench-back": "#CCCCCC",
    "bench-legs": "#555555",
    "counter": "#8B7355",
    "ticket-machine": "#333333",
    "bed-base-2": "#8B7355",
    "bed-mattress-2": "#FFF8DC",
    "bed-pillow-2": "#FFFFFF",
    "nightstand": "#8B7355",
    "iv-stand": "#FFD700",
    "counter-top": "#FFF8DC",
    "counter-body": "#8B7355",
    "monitor": "#1A1A2E",
    "chair": "#333333",
    "file-shelf": "#8B7355",
  };

  return new MeshStandardMaterial({
    color: colors[role] || "#888888",
    roughness: 0.7,
    metalness: 0.1,
  });
}