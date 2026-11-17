"use client";

import { useMemo } from "react";
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, CylinderGeometry, BufferGeometry } from "three";
import { SLICE_LAYOUT, MINT_ORDER_SLICE_PALETTE } from "@calcom/features/hospital-pipeline/lib/3d-world";

interface StairwellProps {
  slices: any[];
  floorHeight: number;
}

/**
 * Stairwell with steps and railings.
 * Spans multiple floors through the slab hole.
 */
export function Stairwell({ slices, floorHeight }: StairwellProps) {
  const stairwellGroup = useMemo(() => {
    const group = new Group();
    group.name = "Stairwell";

    // Find slice with stair hole
    const stairSlice = slices.find(s => s.slabHole);
    if (!stairSlice) return group;

    const { stairHole, slabThickness, wallHeight, stairSteps, floorHeight } = SLICE_LAYOUT;
    const baseY = stairSlice.baseY;

    const hole = stairSlice.slabHole!;
    const holeWidth = hole.x1 - hole.x0;
    const holeDepth = hole.z1 - hole.z0;
    const holeCenterX = (hole.x0 + hole.x1) / 2;
    const holeCenterZ = (hole.z0 + hole.z1) / 2;

    // Computed stair dimensions (from khoa-slice.ts logic)
    const stepCount = stairSteps;
    const stepRise = floorHeight / stairSteps; // 3 / 12 = 0.25
    const stepWidth = stairHole.x1 - stairHole.x0; // 3.6
    const stepDepth = (stairHole.z1 - stairHole.z0) / stairSteps; // 2.2 / 12 = 0.1833...

    const numFloors = floorHeight / slabThickness; // 3
    const totalHeight = floorHeight * numFloors;

    const stairGroup = new Group();
    stairGroup.name = "StairFlight";

    const stairMaterial = new MeshStandardMaterial({
      color: 0x8B7355,
      roughness: 0.8,
      metalness: 0.1,
    });

    const railingMaterial = new MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.3,
    });

    const holeCenterXPos = (hole.x0 + hole.x1) / 2;
    const holeCenterZPos = (hole.z0 + hole.z1) / 2;

    // Steps (spiral or straight - here straight along Z axis)
    for (let i = 0; i < stepCount * numFloors; i++) {
      const stepHeight = i * stepRise;
      const stepZ = holeCenterZPos - (holeDepth / 2) + stepDepth / 2 + i * stepDepth;

      const stepGeometry = new BoxGeometry(stepWidth, stepRise, stepDepth);
      const stepMaterial = new MeshStandardMaterial({
        color: 0x8B7355,
        roughness: 0.8,
        metalness: 0.1,
      });

      const step = new Mesh(stepGeometry, stairMaterial);
      step.position.set(
        holeCenterXPos,
        baseY + slabThickness + stepHeight + stepRise / 2,
        stepZ
      );
      step.castShadow = true;
      step.receiveShadow = true;
      step.name = `Step_${i}`;
      // Add to group
    }

    // Railings
    const railingHeight = 1.0;
    const railingThickness = 0.05;

    // Left railing
    const leftRailingGeometry = new BoxGeometry(railingThickness, railingHeight, stepDepth * stepCount * numFloors);
    const leftRailing = new Mesh(leftRailingGeometry, railingMaterial);
    leftRailing.position.set(
      holeCenterXPos - stepWidth / 2 - railingThickness / 2,
      baseY + slabThickness + railingHeight / 2,
      holeCenterZPos
    );
    leftRailing.castShadow = true;

    // Right railing
    const rightRailing = new Mesh(leftRailingGeometry.clone(), leftRailing.material);
    rightRailing.position.set(
      holeCenterXPos + stepWidth / 2 + railingThickness / 2,
      baseY + slabThickness + railingHeight / 2,
      holeCenterZPos
    );
    rightRailing.castShadow = true;

    return group;
  }, [slices, floorHeight]);

  return <group ref={stairwellGroup} />;
}