/**
 * Patient rig — forward kinematics from the procedural pose math (ADR 0003
 * §Nhân vật). The pose math in `lib/3d-world/character-poses.ts` stays pure
 * and renderer-agnostic; this module supplies the structural skeleton it
 * mutates (plain objects, no three), folds each node's Euler rotation down
 * the hierarchy into 3D joint offsets relative to the feet origin, then
 * projects every joint through `worldToScreen` onto the dynamic canvas.
 */

import {
  CHARACTER_NODE_NAMES,
  type CharacterPoseState,
  computeIdlePose,
  computeWalkPose,
  type PoseRig,
} from "../3d-world/character-poses";
import { type IsometricCamera, type ScreenPoint, worldToScreen } from "./world-to-screen";
import { WALK_STRIDE, WALK_ARM_SWING } from "./motion-tokens";

export interface RigPoint {
  x: number;
  y: number;
  z: number;
}

export interface RigNodeSpec {
  name: string;
  parent: string | null;
  /** Offset from the parent joint in the parent's rest frame, meters. */
  offset: RigPoint;
}

/**
 * One spec per pose node plus the arm tips, parents listed before children.
 * The pose math drives the CHARACTER_NODE_NAMES joints; the hand tips are
 * leaves it never rotates, added so the arm bones have endpoints to swing
 * (leg bones already end at the foot joints). Rest pose stands ~1.65 m:
 * pelvis 0.92, shoulders 1.22, head center 1.52, feet joints 0.04.
 */
export const CHARACTER_SKELETON: readonly RigNodeSpec[] = [
  { name: "root", parent: null, offset: { x: 0, y: 0.92, z: 0 } },
  { name: "spine", parent: "root", offset: { x: 0, y: 0.3, z: 0 } },
  { name: "head", parent: "spine", offset: { x: 0, y: 0.3, z: 0 } },
  { name: "leftThigh", parent: "root", offset: { x: -0.09, y: -0.06, z: 0 } },
  { name: "leftShin", parent: "leftThigh", offset: { x: 0, y: -0.42, z: 0 } },
  { name: "leftFoot", parent: "leftShin", offset: { x: 0, y: -0.4, z: 0 } },
  { name: "rightThigh", parent: "root", offset: { x: 0.09, y: -0.06, z: 0 } },
  { name: "rightShin", parent: "rightThigh", offset: { x: 0, y: -0.42, z: 0 } },
  { name: "rightFoot", parent: "rightShin", offset: { x: 0, y: -0.4, z: 0 } },
  { name: "leftArm", parent: "spine", offset: { x: -0.22, y: -0.06, z: 0 } },
  { name: "rightArm", parent: "spine", offset: { x: 0.22, y: -0.06, z: 0 } },
  { name: "leftHand", parent: "leftArm", offset: { x: 0, y: -0.52, z: 0 } },
  { name: "rightHand", parent: "rightArm", offset: { x: 0, y: -0.52, z: 0 } },
];

/** Parent → child pairs the dynamic canvas strokes as bones. */
export const CHARACTER_BONES: readonly (readonly [string, string])[] = CHARACTER_SKELETON.flatMap(
  (node): Array<readonly [string, string]> => (node.parent ? [[node.parent, node.name]] : [])
);

/** Joint offsets relative to the feet origin (heading applied), meters. */
export type RigPoints = Record<string, RigPoint>;

/** Joint name → screen point of the world-space joint. */
export type RigScreenPoints = Record<string, ScreenPoint>;

type Mat3 = readonly number[];

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function matMul(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = new Array(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

function applyMat(m: Mat3, v: RigPoint): RigPoint {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

/** Three.js Euler "XYZ": R = Rx(x) · Ry(y) · Rz(z). */
function eulerXYZ(rot: { x: number; y: number; z: number }): Mat3 {
  if (rot.x === 0 && rot.y === 0 && rot.z === 0) return IDENTITY;
  const cx = Math.cos(rot.x);
  const sx = Math.sin(rot.x);
  const cy = Math.cos(rot.y);
  const sy = Math.sin(rot.y);
  const cz = Math.cos(rot.z);
  const sz = Math.sin(rot.z);
  const rx: Mat3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const ry: Mat3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rz: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return matMul(rx, matMul(ry, rz));
}

/** Character yaw around the world Y axis (0 faces +Z). */
function eulerY(angle: number): Mat3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

const ZERO_ROTATION = { x: 0, y: 0, z: 0 } as const;

/**
 * Fold pose rotations down the hierarchy: each child's offset sits in its
 * parent's rotated frame, so the joint position is the parent position plus
 * the parent's accumulated rotation applied to the rest offset, and the
 * child's accumulated rotation is parent rotation · local pose rotation.
 */
export function forwardKinematics(pose: CharacterPoseState, headingRad: number): RigPoints {
  const points: RigPoints = {};
  const rotations = new Map<string, Mat3>();
  const heading = eulerY(headingRad);
  for (const spec of CHARACTER_SKELETON) {
    const parentRot = spec.parent ? (rotations.get(spec.parent) ?? heading) : heading;
    rotations.set(spec.name, matMul(parentRot, eulerXYZ(pose.nodes[spec.name] ?? ZERO_ROTATION)));
    const offset = applyMat(parentRot, spec.offset);
    const parentPoint = spec.parent ? (points[spec.parent] ?? { x: 0, y: 0, z: 0 }) : { x: 0, y: 0, z: 0 };
    points[spec.name] = {
      x: parentPoint.x + offset.x,
      y: parentPoint.y + offset.y,
      z: parentPoint.z + offset.z,
    };
  }
  return points;
}

/**
 * Plain pose rig the pose math mutates; the rendered skeleton is built from
 * the returned CharacterPoseState, so the mutated nodes are write-only.
 */
const HEADLESS_RIG_NODES = new Map<string, { rotation: { set(x: number, y: number, z: number): void } }>();
for (const name of CHARACTER_NODE_NAMES) {
  HEADLESS_RIG_NODES.set(name, { rotation: { set() {} } });
}
const HEADLESS_RIG: PoseRig = { getObjectByName: (name) => HEADLESS_RIG_NODES.get(name) };

/** Walk parameters matching the old three scene's PatientAvatar.
 *  Re-exported from motion-tokens for single source of truth. */
export { WALK_STRIDE, WALK_ARM_SWING } from "./motion-tokens";

export interface CharacterPoseInput {
  /** Approach segment → walk cycle; action/outro → idle breath and sway. */
  walking: boolean;
  /** Walk-cycle phase in [0, 1) while walking. */
  walkPhase?: number;
  /** Seconds driving the idle breath/sway cycle while standing. */
  idleTimeS: number;
}

export function sampleCharacterPose(input: CharacterPoseInput): CharacterPoseState {
  if (input.walking) {
    const phase = (((input.walkPhase ?? 0) % 1) + 1) % 1;
    return computeWalkPose(HEADLESS_RIG, phase, { stride: WALK_STRIDE, armSwing: WALK_ARM_SWING });
  }
  return computeIdlePose(HEADLESS_RIG, input.idleTimeS);
}

/** World-space joint projection — the same coordinate module the floors use. */
export function projectCharacterRig(
  localPoints: RigPoints,
  base: { x: number; y: number; z: number },
  camera: IsometricCamera
): RigScreenPoints {
  const screen: RigScreenPoints = {};
  for (const [name, point] of Object.entries(localPoints)) {
    screen[name] = worldToScreen(base.x + point.x, base.y + point.y, base.z + point.z, camera);
  }
  return screen;
}
