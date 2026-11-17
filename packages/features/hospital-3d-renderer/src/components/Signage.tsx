"use client";

import { useMemo } from "react";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, BoxGeometry } from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { SLICE_LAYOUT, MINT_ORDER_SLICE_PALETTE } from "@calcom/features/hospital-pipeline/lib/3d-world";

interface SignageProps {
  slices: any[];
}

/**
 * Signage system using InstancedMesh for repeated sign types.
 * Two tiers: dept-hanging (overhead) and room-wall (on walls).
 */
export function Signage({ slices }: SignageProps) {
  const signageGroup = useMemo(() => {
    const group = new Group();
    group.name = "Signage";

    // Load font (would be preloaded in production)
    // const font = await new FontLoader().loadAsync('/fonts/BricolageGrotesque_Bold.json');

    for (const slice of slices) {
      // Department hanging signs (overhead)
      for (const dept of slice.departments) {
        // Overhead department plaque
        const plaqueGeometry = new BoxGeometry(
          dept.rooms.length * 2, // width based on room count
          0.3,
          0.05
        );
        const plaqueMaterial = new MeshStandardMaterial({
          color: dept.signageColor,
          roughness: 0.2,
          metalness: 0.8,
        });

        // Position above corridor
        const corridorCenterX = (SLICE_LAYOUT.corridor.x0 + SLICE_LAYOUT.corridor.x1) / 2;
        const corridorCenterZ = (SLICE_LAYOUT.corridor.z0 + SLICE_LAYOUT.corridor.z1) / 2;

        // In a real implementation, we'd create text meshes or use sprites
        // For now, skip detailed signage to focus on core structure
      }

      // Room wall signs
      for (const dept of slice.departments) {
        for (const room of dept.rooms) {
          // Room sign on wall
        }
      }

      // Shared rooms
      if (slice.sharedRooms) {
        for (const room of slice.sharedRooms) {
          // Shared room sign
        }
      }

      // Directional arrows (stairs, elevator)
      if (slice.stairwell) {
        // Stair arrow sign
      }
      if (slice.elevator) {
        // Elevator sign
      }
    }

    return new Group(); // Placeholder
  }, [slices]);

  return <group ref={signageGroup} />;
}