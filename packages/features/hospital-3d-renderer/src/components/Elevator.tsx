"use client";

import { useMemo } from "react";
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, CylinderGeometry, Group as ThreeGroup } from "three";
import { SLICE_LAYOUT, MINT_ORDER_SLICE_PALETTE } from "@calcom/features/hospital-pipeline/lib/3d-world";

interface ElevatorProps {
  slices: any[];
  floorHeight: number;
}

/**
 * Elevator shaft with cabins, doors, and call buttons.
 * Wall-recessed design per SLICE_LAYOUT.
 */
export function Elevator({ slices, floorHeight }: ElevatorProps) {
  const elevatorGroup = useMemo(() => {
    const group = new Group();
    group.name = "Elevator";

    const elevatorSlice = slices.find(s => s.elevator);
    if (!elevatorSlice) return group;

    const elevatorGroup = new Group();
    elevatorGroup.name = "ElevatorSystem";

    const { elevator } = SLICE_LAYOUT;
    const baseY = elevatorSlice.baseY;

    // Elevator shaft (spans all floors)
    const shaftHeight = floorHeight * SLICE_LAYOUT.floorHeight / SLICE_LAYOUT.slabThickness; // spans all floors
    const shaftGeometry = new BoxGeometry(
      2.5, // width
      floorHeight * 3, // 3 floors
      2.0 // depth (recessed)
    );

    const shaftMaterial = new MeshStandardMaterial({
      color: 0x2A2A2A,
      roughness: 0.8,
      metalness: 0.2,
    });

    const shaft = new Mesh(shaftGeometry, shaftMaterial);
    shaft.position.set(
      elevator.faceX + 1.25,
      elevatorSlice.baseY + floorHeight * 1.5,
      elevator.doorZ - 1.0
    );
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    shaft.name = "ElevatorShaft";

    // Elevator cabin
    const cabinGeometry = new BoxGeometry(2.0, 2.2, 1.8);
    const cabinMaterial = new MeshStandardMaterial({
      color: 0xCCCCCC,
      roughness: 0.3,
      metalness: 0.7,
    });
    const cabin = new Mesh(cabinGeometry, cabinMaterial);
    cabin.position.copy(shaft.position);
    cabin.name = "ElevatorCabin";
    cabin.castShadow = true;
    cabin.receiveShadow = true;

    // Elevator doors (left + right)
    const doorGeometry = new BoxGeometry(0.05, 2.1, 0.9);
    const doorMaterial = new MeshStandardMaterial({
      color: 0xCCCCCC,
      roughness: 0.2,
      metalness: 0.8,
    });

    const leftDoor = new Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(
      elevator.faceX + 1.25 - 1.0, // left of center
      shaft.position.y,
      elevator.doorZ - 1.0 + 0.05
    );
    leftDoor.name = "ElevatorLeftDoor";

    const rightDoor = new Mesh(doorGeometry.clone(), doorMaterial);
    rightDoor.position.set(
      elevator.faceX + 1.25 + 1.0, // right of center
      shaft.position.y,
      elevator.doorZ - 1.0 + 0.05
    );
    rightDoor.name = "ElevatorRightDoor";

    // Call buttons on each floor
    const buttonGroup = new Group();
    buttonGroup.name = "ElevatorButtons";

    const buttonMaterial = new MeshStandardMaterial({
      color: MINT_ORDER_SLICE_PALETTE.primaryDark,
      emissive: MINT_ORDER_SLICE_PALETTE.primaryDark,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.8,
    });

    const buttonGeometry = new CylinderGeometry(0.08, 0.08, 0.02, 16);

    for (let floor = 0; floor < 3; floor++) {
      const y = SLICE_LAYOUT.slabThickness + floor * floorHeight + 1.1; // button height
      const button = new Mesh(buttonGeometry, buttonMaterial);
      button.position.set(
        elevator.faceX + 2.5,
        y,
        elevator.doorZ - 1.0 + 0.03
      );
      button.scale.set(0.5, 0.5, 0.5);
      button.name = `CallButton_Floor${floor + 1}`;
      button.castShadow = true;
      buttonGroup.add(button);
    }

    // Floor indicators
    const indicatorGroup = new Group();
    indicatorGroup.name = "FloorIndicators";

    for (let floor = 0; floor < 3; floor++) {
      const y = baseY + floor * floorHeight + floorHeight / 2;
      const indicatorGeometry = new BoxGeometry(0.6, 0.3, 0.05);
      const indicatorMaterial = new MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xFFD700,
        emissiveIntensity: 1.0,
        roughness: 0.1,
        metalness: 0.9,
      });
      const indicator = new Mesh(indicatorGeometry, indicatorMaterial);
      indicator.position.set(
        elevator.faceX + 2.5,
        y,
        elevator.doorZ - 1.0 + 0.03
      );
      indicator.name = `FloorIndicator_${floor + 1}`;
      indicatorGroup.add(indicator);
    }

    return group;
  }, [slices, floorHeight]);

  return <group ref={elevatorGroup} />;
}