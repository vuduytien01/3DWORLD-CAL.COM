import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  computeWalkPose,
  computeIdlePose,
  resetCharacterRig,
  CHARACTER_NODE_NAMES,
  type PoseRig,
} from '../character-poses';

/**
 * Node fixture: đủ rotation.set cho applyPoseToRig, giữ x/y/z cho assert.
 * Plain object, không three.
 */
interface FixtureRotation {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): void;
}

interface FixtureNode {
  rotation: FixtureRotation;
}

interface PoseRigFixture {
  rig: PoseRig;
  node(name: string): FixtureNode;
}

function makeFixtureNode(): FixtureNode {
  const rotation: FixtureRotation = {
    x: 0,
    y: 0,
    z: 0,
    set(x: number, y: number, z: number) {
      rotation.x = x;
      rotation.y = y;
      rotation.z = z;
    },
  };
  return { rotation };
}

function makePoseRigFixture(): PoseRigFixture {
  const nodes = new Map<string, FixtureNode>();
  for (const name of CHARACTER_NODE_NAMES) {
    nodes.set(name, makeFixtureNode());
  }
  return {
    rig: {
      getObjectByName: (name) => nodes.get(name),
    },
    node: (name) => {
      const node = nodes.get(name);
      if (!node) throw new Error(`fixture missing node: ${name}`);
      return node;
    },
  };
}

describe('Character L1 procedural poses (T-14)', () => {
  let rig: PoseRig;
  let fixture: PoseRigFixture;

  beforeEach(() => {
    fixture = makePoseRigFixture();
    rig = fixture.rig;
  });

  afterEach(() => {
    resetCharacterRig(rig);
  });

  describe('computeWalkPose', () => {
    it('t=0: chân/tay ở vị trí trung gian (swing = 0)', () => {
      const pose = computeWalkPose(rig, 0);
      // sin(0) = 0 => swing = 0
      expect(pose.nodes.leftThigh.x).toBeCloseTo(0, 5);
      expect(pose.nodes.rightThigh.x).toBeCloseTo(0, 5);
      expect(pose.nodes.leftArm.x).toBeCloseTo(0, 5);
      expect(pose.nodes.rightArm.x).toBeCloseTo(0, 5);
    });

    it('t=0.25: chân trái tới mức swing tối đa dương, chân phải âm (opposite phase)', () => {
      const pose = computeWalkPose(rig, 0.25);
      // sin(π/2) = 1 => swing = π/6 * stride
      expect(pose.nodes.leftThigh.x).toBeGreaterThan(0);
      expect(pose.nodes.rightThigh.x).toBeLessThan(0);
      expect(Math.abs(pose.nodes.leftThigh.x)).toBeCloseTo(Math.abs(pose.nodes.rightThigh.x), 5);
    });

    it('t=0.5: sin(π) = 0 => swing gần 0 (giữa phase)', () => {
      const pose = computeWalkPose(rig, 0.5);
      // sin(π) = 0 => swing gần 0
      expect(Math.abs(pose.nodes.leftThigh.x)).toBeLessThan(0.01);
      expect(Math.abs(pose.nodes.rightThigh.x)).toBeLessThan(0.01);
    });

    it('tay chuyển phase ngược chân (armSwing)', () => {
      const pose = computeWalkPose(rig, 0.25);
      // chân trái swing dương -> tay trái swing âm (opposite)
      expect(pose.nodes.leftThigh.x * pose.nodes.leftArm.x).toBeLessThan(0);
    });

    it('pelvis bob: t=0.25 => y > 0, t=0.75 => y < 0', () => {
      // sin(π/2 * 2) = sin(π) = 0 at t=0.25? Wait: bob = sin(phase * 2) * 0.02
      // phase = t * 2π, so at t=0.25: phase = π/2, bob = sin(π) * 0.02 = 0
      // Actually bob formula uses sin(phase * 2), phase = t * 2π
      // t=0.25: phase = π/2, phase*2 = π, sin(π) = 0
      // t=0.75: phase = 3π/2, phase*2 = 3π, sin(3π) = 0
      // So bob is 0 at both. Test the actual max bob points.
      const poseA = computeWalkPose(rig, 0.125); // phase = π/4, phase*2 = π/2, sin = 1
      const poseB = computeWalkPose(rig, 0.375); // phase = 3π/4, phase*2 = 3π/2, sin = -1
      expect(poseA.nodes.root.y).toBeGreaterThan(0);
      expect(poseB.nodes.root.y).toBeLessThan(0);
    });

    it('deterministic: cùng t cho cùng pose', () => {
      const a = computeWalkPose(rig, 0.37);
      const b = computeWalkPose(makePoseRigFixture().rig, 0.37);
      for (const name of CHARACTER_NODE_NAMES) {
        expect(a.nodes[name].x).toBeCloseTo(b.nodes[name].x, 5);
        expect(a.nodes[name].y).toBeCloseTo(b.nodes[name].y, 5);
        expect(a.nodes[name].z).toBeCloseTo(b.nodes[name].z, 5);
      }
    });

    it('stride param scale swing amplitude', () => {
      const normal = computeWalkPose(rig, 0.25, { stride: 1.0 });
      const double = computeWalkPose(rig, 0.25, { stride: 2.0 });
      expect(Math.abs(double.nodes.leftThigh.x)).toBeCloseTo(Math.abs(normal.nodes.leftThigh.x) * 2, 5);
    });

    it('armSwing param scale arm amplitude', () => {
      const normal = computeWalkPose(rig, 0.25, { armSwing: 1.0 });
      const half = computeWalkPose(rig, 0.25, { armSwing: 0.5 });
      expect(Math.abs(half.nodes.leftArm.x)).toBeCloseTo(Math.abs(normal.nodes.leftArm.x) * 0.5, 5);
    });
  });

  describe('computeIdlePose', () => {
    it('t=0: breath = 0, sway = 0 => rotation gần 0', () => {
      const pose = computeIdlePose(rig, 0);
      for (const name of CHARACTER_NODE_NAMES) {
        expect(pose.nodes[name].x).toBeCloseTo(0, 5);
        expect(pose.nodes[name].y).toBeCloseTo(0, 5);
        expect(pose.nodes[name].z).toBeCloseTo(0, 5);
      }
    });

    it('breath cycle: t=π/4 => chest rise dương', () => {
      const pose = computeIdlePose(rig, Math.PI / 4 / 2); // t where sin(t*2) = 1
      expect(pose.nodes.root.y).toBeGreaterThan(0);
      expect(pose.nodes.spine.x).toBeGreaterThan(0);
    });

    it('sway cycle: slow weight shift side-to-side', () => {
      const pose1 = computeIdlePose(rig, 0);
      // Find t where sin(t * 0.7) ≈ 1: t * 0.7 = π/2 => t = π/2 / 0.7
      const tMax = Math.PI / 2 / 0.7;
      const pose2 = computeIdlePose(rig, tMax);
      expect(pose1.nodes.root.z).toBeCloseTo(0, 5);
      expect(pose2.nodes.root.z).not.toBeCloseTo(0, 3); // shifted
    });

    it('deterministic', () => {
      const a = computeIdlePose(rig, 1.23);
      const b = computeIdlePose(makePoseRigFixture().rig, 1.23);
      for (const name of CHARACTER_NODE_NAMES) {
        expect(a.nodes[name].x).toBeCloseTo(b.nodes[name].x, 5);
        expect(a.nodes[name].y).toBeCloseTo(b.nodes[name].y, 5);
        expect(a.nodes[name].z).toBeCloseTo(b.nodes[name].z, 5);
      }
    });
  });

  describe('resetCharacterRig', () => {
    it('sau walk pose, reset đưa mọi rotation về 0', () => {
      computeWalkPose(rig, 0.25);
      // verify non-zero trước reset
      const before = fixture.node('leftThigh');
      expect(before.rotation.x).not.toBe(0);

      resetCharacterRig(rig);

      for (const name of CHARACTER_NODE_NAMES) {
        const node = fixture.node(name);
        expect(node.rotation.x).toBe(0);
        expect(node.rotation.y).toBe(0);
        expect(node.rotation.z).toBe(0);
      }
    });
  });

  describe('bounds & limits', () => {
    it('walk pose swing không vượt ±π/6 (30°) với stride=1', () => {
      for (let t = 0; t < 1; t += 0.05) {
        const pose = computeWalkPose(rig, t, { stride: 1.0 });
        expect(Math.abs(pose.nodes.leftThigh.x)).toBeLessThanOrEqual(Math.PI / 6 + 0.01);
        expect(Math.abs(pose.nodes.rightThigh.x)).toBeLessThanOrEqual(Math.PI / 6 + 0.01);
      }
    });

    it('idle pose breath amplitude nhỏ (< 0.01 rad)', () => {
      for (let t = 0; t < 10; t += 0.1) {
        const pose = computeIdlePose(rig, t);
        expect(Math.abs(pose.nodes.root.y)).toBeLessThan(0.01);
      }
    });
  });
});
