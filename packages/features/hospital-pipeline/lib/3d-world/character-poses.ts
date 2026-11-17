/**
 * T-14 — Character L1 procedural poses (walk / idle) for patient avatar.
 *
 * Pose math thuần, không phụ thuộc renderer: thao tác trên PoseRig —
 * tra node theo tên rồi rotation.set theo trục local. HTML5 renderer dựng
 * rig riêng (lib/html5-world/patient-rig.ts) khớp cùng CHARACTER_NODE_NAMES.
 *
 * Cấu trúc phân cấp (pose math chỉ cần rotation local trên từng node):
 * - root (pelvis)
 *   - spine
 *     - head
 *   - leftThigh
 *     - leftShin
 *       - leftFoot
 *   - rightThigh
 *     - rightShin
 *       - rightFoot
 *   - leftArm
 *   - rightArm
 */

import { easings } from '../html5-world/motion-tokens';

/** Node pose tối thiểu mà pose math thao tác: rotation Euler theo trục local. */
export interface PoseRigNode {
  rotation: {
    set(x: number, y: number, z: number): void;
  };
}

/** Hình rig tối thiểu cho pose math: tra node theo tên, không ràng buộc renderer. */
export interface PoseRig {
  getObjectByName(name: string): PoseRigNode | undefined;
}

/** Bộ 9 node tên chuẩn để test deterministic tìm kiếm */
export const CHARACTER_NODE_NAMES = [
  'root',      // pelvis
  'spine',
  'head',
  'leftThigh',
  'leftShin',
  'leftFoot',
  'rightThigh',
  'rightShin',
  'rightFoot',
  'leftArm',
  'rightArm',
] as const;

/** Trạng thái pose tại khung t ∈ [0, 1] */
export interface CharacterPoseState {
  /** Góc rotation (radian) của từng node theo trục local X/Y/Z */
  nodes: Record<string, { x: number; y: number; z: number }>;
}

/**
 * Walk pose — t ∈ [0, 1] là phase bước (0=giãn, 0.5=đối diện).
 * Swing ±30° (≈0.52 rad) tại chân/tay, pelvis bob nhẹ ±2cm.
 */
export function computeWalkPose(
  rig: PoseRig,
  t: number,
  options: { stride?: number; speed?: number; armSwing?: number } = {},
): CharacterPoseState {
  const { stride = 0.8, armSwing = 1.0 } = options;
  const phase = (t * Math.PI * 2) % (Math.PI * 2);
  const swing = Math.sin(phase) * (Math.PI / 6) * stride; // ±30° * stride
  const bob = Math.sin(phase * 2) * 0.02 * stride; // pelvis vertical bob
  const armSwingAngle = Math.sin(phase + Math.PI) * (Math.PI / 4) * armSwing; // opposite phase

  const nodes: CharacterPoseState['nodes'] = {};

  // Pelvis bob (vertical)
  nodes.root = { x: 0, y: bob, z: 0 };

  // Spine slight counter-rotation
  nodes.spine = { x: -swing * 0.1, y: 0, z: 0 };

  // Head stable
  nodes.head = { x: 0, y: 0, z: 0 };

  // Legs: opposite phase
  nodes.leftThigh = { x: swing, y: 0, z: 0 };
  nodes.leftShin = { x: -swing * 0.5, y: 0, z: 0 };
  nodes.leftFoot = { x: swing * 0.2, y: 0, z: 0 };

  nodes.rightThigh = { x: -swing, y: 0, z: 0 };
  nodes.rightShin = { x: swing * 0.5, y: 0, z: 0 };
  nodes.rightFoot = { x: -swing * 0.2, y: 0, z: 0 };

  // Arms: opposite to legs
  nodes.leftArm = { x: armSwingAngle, y: 0, z: 0 };
  nodes.rightArm = { x: -armSwingAngle, y: 0, z: 0 };

  // Apply to rig (mutates for rendering)
  applyPoseToRig(rig, nodes);

  return { nodes };
}

/**
 * Idle pose — breathing nhẹ + weight shift + micro-movements (breath, weight shift, head look).
 */
export function computeIdlePose(
  rig: PoseRig,
  t: number,
): CharacterPoseState {
  // Base breathing and sway
  const breath = Math.sin(t * 2) * 0.005; // subtle chest rise
  const sway = Math.sin(t * 0.7) * 0.02; // slow weight shift

  // Micro-movements with easeInOutSine for natural easing
  // Phase shifted by -PI/2 so at t=0 all micro-movements are 0 (easeInOutSine(0) = 0)
  // Breathing: chest rise/fall at 0.3 Hz
  const breathPhase = (t * 0.6 * Math.PI - Math.PI / 2) % (Math.PI * 2);
  const breathEased = easings.easeInOutSine((Math.sin(breathPhase) + 1) / 2);
  const breathMicro = breath * breathEased;

  // Weight shift: hips sway at 0.15 Hz
  const swayPhase = (t * 0.3 * Math.PI - Math.PI / 2) % (Math.PI * 2);
  const swayEased = easings.easeInOutSine((Math.sin(swayPhase) + 1) / 2);
  const swayMicro = sway * swayEased * 0.5;

  // Head micro-movement: occasional look around at 0.2 Hz
  const lookPhase = (t * 0.4 * Math.PI - Math.PI / 2) % (Math.PI * 2);
  const lookEased = easings.easeInOutSine((Math.sin(lookPhase) + 1) / 2);
  const lookMicro = 0.01 * lookEased;

  // Spine micro-sway at 0.1 Hz
  const spinePhase = (t * 0.2 * Math.PI - Math.PI / 2) % (Math.PI * 2);
  const spineEased = easings.easeInOutSine((Math.sin(spinePhase) + 1) / 2);
  const spineMicro = 0.01 * spineEased;

  const nodes: CharacterPoseState['nodes'] = {
    root: { x: 0, y: breath + breathMicro, z: sway + swayMicro }, // breathing + weight shift
    spine: { x: (breath + breathMicro) * 0.5, y: 0, z: (sway + swayMicro) * 0.5 + spineMicro },
    head: { x: -(breath + breathMicro) * 0.3, y: sway * 0.3 + lookMicro, z: 0 },
    leftThigh: { x: 0, y: 0, z: 0 },
    leftShin: { x: 0, y: 0, z: 0 },
    leftFoot: { x: 0, y: 0, z: 0 },
    rightThigh: { x: 0, y: 0, z: 0 },
    rightShin: { x: 0, y: 0, z: 0 },
    rightFoot: { x: 0, y: 0, z: 0 },
    leftArm: { x: (breath + breathMicro) * 0.5, y: (sway + swayMicro) * 0.2, z: 0 },
    rightArm: { x: -(breath + breathMicro) * 0.5, y: -(sway + swayMicro) * 0.2, z: 0 },
  };

  applyPoseToRig(rig, nodes);
  return { nodes };
}

/** Gán rotation nodes vào rig (mutates). */
function applyPoseToRig(
  rig: PoseRig,
  nodes: CharacterPoseState['nodes'],
): void {
  for (const [name, rot] of Object.entries(nodes)) {
    const node = rig.getObjectByName(name);
    if (node) {
      node.rotation.set(rot.x, rot.y, rot.z);
    }
  }
}

/** Reset rig về pose mặc định (tất cả rotation = 0). */
export function resetCharacterRig(rig: PoseRig): void {
  for (const name of CHARACTER_NODE_NAMES) {
    const node = rig.getObjectByName(name);
    if (node) node.rotation.set(0, 0, 0);
  }
}
