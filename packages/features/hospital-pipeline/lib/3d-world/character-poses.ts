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
 * Idle pose — breathing nhẹ + weight shift.
 */
export function computeIdlePose(
  rig: PoseRig,
  t: number,
): CharacterPoseState {
  const breath = Math.sin(t * 2) * 0.005; // subtle chest rise
  const sway = Math.sin(t * 0.7) * 0.02; // slow weight shift

  const nodes: CharacterPoseState['nodes'] = {
    root: { x: 0, y: breath, z: sway }, // apply sway to root Z
    spine: { x: breath * 0.5, y: 0, z: sway * 0.5 },
    head: { x: -breath * 0.3, y: sway * 0.3, z: 0 },
    leftThigh: { x: 0, y: 0, z: 0 },
    leftShin: { x: 0, y: 0, z: 0 },
    leftFoot: { x: 0, y: 0, z: 0 },
    rightThigh: { x: 0, y: 0, z: 0 },
    rightShin: { x: 0, y: 0, z: 0 },
    rightFoot: { x: 0, y: 0, z: 0 },
    leftArm: { x: breath * 0.5, y: sway * 0.2, z: 0 },
    rightArm: { x: -breath * 0.5, y: -sway * 0.2, z: 0 },
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
