"use client";

import { useMemo, useRef, useEffect } from "react";
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, SphereGeometry, CapsuleGeometry, SkinnedMesh, Skeleton, Bone, AnimationMixer, AnimationClip, AnimationAction } from "three";

interface PatientAvatarProps {
  patientState?: {
    x: number;
    y: number;
    z: number;
    headingRad?: number;
    walking?: boolean;
    walkPhase?: number;
  } | null;
  reducedMotion?: boolean;
}

/**
 * Patient avatar with L1 procedural animations (walk/idle).
 * Uses simple procedural rig (no skinning) for performance.
 */
export function PatientAvatar({ patientState, reducedMotion = false }: PatientAvatarProps) {
  const avatarGroup = useMemo(() => {
    if (!patientState) return new Group();

    const group = new Group();
    group.name = "PatientAvatar";

    // Body parts (simple capsules/boxes for performance)
    const bodyMaterial = new MeshStandardMaterial({
      color: 0xBFDBFE,
      roughness: 0.7,
      metalness: 0.1,
    });

    const skinMaterial = new MeshStandardMaterial({
      color: 0xF5D0C0,
      roughness: 0.8,
      metalness: 0.0,
    });

    const clothesMaterial = new MeshStandardMaterial({
      color: 0x4A90D9,
      roughness: 0.8,
      metalness: 0.1,
    });

    // Torso
    const torsoGeometry = new CapsuleGeometry(0.25, 0.6, 4, 8);
    const torso = new Mesh(torsoGeometry, clothesMaterial);
    torso.position.y = 1.0;
    torso.castShadow = true;
    torso.receiveShadow = true;
    torso.name = "Torso";

    // Head
    const headGeometry = new SphereGeometry(0.18, 16, 12);
    const head = new Mesh(headGeometry, skinMaterial);
    head.position.y = 1.55;
    head.castShadow = true;
    head.receiveShadow = true;
    head.name = "Head";

    // Arms (left and right)
    const armGeometry = new CapsuleGeometry(0.08, 0.55, 4, 8);
    const leftArm = new Mesh(armGeometry, skinMaterial);
    leftArm.position.set(-0.35, 1.1, 0);
    leftArm.rotation.z = Math.PI / 2;
    leftArm.castShadow = true;
    leftArm.name = "LeftArm";

    const rightArm = new Mesh(armGeometry, skinMaterial);
    rightArm.position.set(0.35, 1.1, 0);
    rightArm.rotation.z = -Math.PI / 2;
    rightArm.castShadow = true;
    rightArm.name = "RightArm";

    // Legs
    const legGeometry = new CapsuleGeometry(0.12, 0.7, 4, 8);
    const leftLeg = new Mesh(legGeometry, clothesMaterial);
    leftLeg.position.set(-0.15, 0.4, 0);
    leftLeg.castShadow = true;
    leftLeg.name = "LeftLeg";

    const rightLeg = new Mesh(legGeometry, clothesMaterial);
    rightLeg.position.set(0.15, 0.4, 0);
    rightLeg.castShadow = true;
    rightLeg.name = "RightLeg";

    // Add to group
    const bodyGroup = new Group();
    bodyGroup.add(torso);
    bodyGroup.add(head);
    bodyGroup.add(leftArm);
    bodyGroup.add(rightArm);
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    group.add(bodyGroup);

    // Store references for animation
    (group as any).bodyParts = {
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bodyGroup,
    };

    return group;
  }, []);

  // Animation loop
  useEffect(() => {
    if (!patientState || reducedMotion) return;

    let animationId: number;
    const bodyParts = (avatarGroup as any).bodyParts;
    if (!bodyParts) return;

    const animate = (time: number) => {
      if (!patientState.walking) {
        // Idle animation
        const time = performance.now() * 0.001;
        const breath = Math.sin(time * 2) * 0.02;
        const sway = Math.sin(time * 0.7) * 0.03;

        if (bodyParts.torso) {
          bodyParts.torso.position.y = 1.0 + breath;
          bodyParts.torso.rotation.z = sway * 0.3;
        }
        if (bodyParts.head) {
          bodyParts.head.position.y = 1.55 + breath * 0.5;
          bodyParts.head.rotation.y = sway * 0.2;
        }
        if (bodyParts.leftArm) {
          bodyParts.leftArm.rotation.x = sway * 0.5;
        }
        if (bodyParts.rightArm) {
          bodyParts.rightArm.rotation.x = -sway * 0.5;
        }
      } else {
        // Walk animation
        const phase = (patientState.walkPhase ?? 0) * Math.PI * 2;
        const stride = Math.sin(phase) * 0.6; // leg swing
        const armSwing = Math.sin(phase + Math.PI) * 0.8; // opposite arm swing
        const bob = Math.sin(phase * 2) * 0.03; // body bob

        if (bodyParts.torso) {
          bodyParts.torso.position.y = 1.0 + bob;
          bodyParts.torso.rotation.x = -stride * 0.1;
        }
        if (bodyParts.head) {
          bodyParts.head.position.y = 1.55 + bob;
        }
        if (bodyParts.leftLeg) {
          bodyParts.leftLeg.rotation.x = stride;
          bodyParts.leftLeg.position.y = 0.4 - Math.abs(stride) * 0.2;
        }
        if (bodyParts.rightLeg) {
          bodyParts.rightLeg.rotation.x = -stride;
          bodyParts.rightLeg.position.y = 0.4 - Math.abs(stride) * 0.2;
        }
        if (bodyParts.leftArm) {
          bodyParts.leftArm.rotation.x = -armSwing * 0.5;
        }
        if (bodyParts.rightArm) {
          bodyParts.rightArm.rotation.x = armSwing * 0.5;
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate(0);
    return () => cancelAnimationFrame(animationId);
  }, [patientState, reducedMotion]);

  // Position and rotation update
  useEffect(() => {
    if (!patientState) return;

    avatarGroup.position.set(
      patientState.x,
      patientState.y,
      patientState.z
    );

    if (patientState.headingRad !== undefined) {
      avatarGroup.rotation.y = patientState.headingRad;
    }
  }, [patientState]);

  return <group ref={avatarGroup} />;
}