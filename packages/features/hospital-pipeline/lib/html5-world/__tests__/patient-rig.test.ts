import { describe, expect, it } from "vitest";
import {
  CHARACTER_NODE_NAMES,
  computeIdlePose,
  computeWalkPose,
  type PoseRig,
} from "../../3d-world/character-poses";
import {
  CHARACTER_BONES,
  CHARACTER_SKELETON,
  forwardKinematics,
  projectCharacterRig,
  sampleCharacterPose,
  WALK_ARM_SWING,
  WALK_STRIDE,
} from "../patient-rig";
import { type IsometricCamera, worldToScreen } from "../world-to-screen";

/** Plain rig fixture mirroring character-poses.test.ts, for direct pose-math comparisons. */
function makePoseRigFixture(): PoseRig {
  const nodes = new Map<string, { rotation: { set(x: number, y: number, z: number): void } }>();
  for (const name of CHARACTER_NODE_NAMES) {
    nodes.set(name, { rotation: { set() {} } });
  }
  return { getObjectByName: (name) => nodes.get(name) };
}

describe("CHARACTER_SKELETON — structure", () => {
  it("covers every pose node plus the arm tips the pose math does not drive", () => {
    const names = CHARACTER_SKELETON.map((spec) => spec.name);
    for (const name of CHARACTER_NODE_NAMES) {
      expect(names).toContain(name);
    }
    expect(names).toEqual([...CHARACTER_NODE_NAMES, "leftHand", "rightHand"]);
  });

  it("has exactly one root and lists parents before children", () => {
    const indexByName = new Map(CHARACTER_SKELETON.map((spec, index) => [spec.name, index]));
    const roots = CHARACTER_SKELETON.filter((spec) => spec.parent === null);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.name).toBe("root");
    for (const spec of CHARACTER_SKELETON) {
      if (!spec.parent) continue;
      const parentIndex = indexByName.get(spec.parent);
      expect(parentIndex).toBeDefined();
      expect(parentIndex!).toBeLessThan(indexByName.get(spec.name)!);
    }
  });

  it("bones connect each joint to its declared parent", () => {
    expect(CHARACTER_BONES).toHaveLength(CHARACTER_SKELETON.length - 1);
    const parentByName = new Map(CHARACTER_SKELETON.map((spec) => [spec.name, spec.parent]));
    for (const [from, to] of CHARACTER_BONES) {
      expect(parentByName.get(to)).toBe(from);
    }
  });
});

describe("forwardKinematics — rest pose", () => {
  const rest = forwardKinematics(sampleCharacterPose({ walking: false, idleTimeS: 0 }), 0);

  it("stands the skeleton at human heights above the feet origin", () => {
    expect(rest.root!.y).toBeCloseTo(0.92, 6);
    expect(rest.spine!.y).toBeCloseTo(1.22, 6);
    expect(rest.head!.y).toBeCloseTo(1.52, 6);
  });

  it("keeps both feet at floor level", () => {
    expect(Math.abs(rest.leftFoot!.y)).toBeLessThan(0.1);
    expect(Math.abs(rest.rightFoot!.y)).toBeLessThan(0.1);
  });

  it("mirrors the leg columns across the sagittal plane", () => {
    expect(rest.leftThigh!.x).toBeCloseTo(-rest.rightThigh!.x, 6);
    expect(rest.leftFoot!.x).toBeCloseTo(-rest.rightFoot!.x, 6);
    expect(rest.leftHand!.x).toBeCloseTo(-rest.rightHand!.x, 6);
  });
});

describe("forwardKinematics — walk swing", () => {
  const pose = sampleCharacterPose({ walking: true, walkPhase: 0.25, idleTimeS: 0 });
  const walk = forwardKinematics(pose, 0);

  it("swings the feet fore and aft in opposite phase", () => {
    expect(walk.leftFoot!.z).toBeLessThan(-0.1);
    expect(walk.rightFoot!.z).toBeGreaterThan(0.1);
    expect(walk.leftFoot!.z).toBeCloseTo(-walk.rightFoot!.z, 6);
  });

  it("arm tips counter-swing against the legs", () => {
    expect(walk.leftHand!.z).toBeGreaterThan(0.1);
    expect(walk.rightHand!.z).toBeLessThan(-0.1);
    // Not exact mirrors: the spine counter-rotation shifts both arms the same way.
  });
});

describe("forwardKinematics — heading rotation", () => {
  it("yaw π/2 maps every joint (x, y, z) → (z, y, −x)", () => {
    const pose = sampleCharacterPose({ walking: true, walkPhase: 0.25, idleTimeS: 0 });
    const facingZ = forwardKinematics(pose, 0);
    const facingX = forwardKinematics(pose, Math.PI / 2);
    for (const name of CHARACTER_NODE_NAMES) {
      const a = facingZ[name]!;
      const b = facingX[name]!;
      expect(b.x).toBeCloseTo(a.z, 9);
      expect(b.y).toBeCloseTo(a.y, 9);
      expect(b.z).toBeCloseTo(-a.x, 9);
    }
  });

  it("idle heading 0 keeps the +Z corridor convention", () => {
    const idle = forwardKinematics(sampleCharacterPose({ walking: false, idleTimeS: 0 }), 0);
    expect(idle.head!.x).toBeCloseTo(0, 9);
    expect(idle.head!.z).toBeCloseTo(0, 9);
  });
});

describe("sampleCharacterPose — walk/idle switch matches the pose math", () => {
  it("walking delegates to computeWalkPose with the scene stride", () => {
    const sampled = sampleCharacterPose({ walking: true, walkPhase: 0.25, idleTimeS: 0 });
    const direct = computeWalkPose(makePoseRigFixture(), 0.25, {
      stride: WALK_STRIDE,
      armSwing: WALK_ARM_SWING,
    });
    for (const name of CHARACTER_NODE_NAMES) {
      expect(sampled.nodes[name]!.x).toBeCloseTo(direct.nodes[name]!.x, 9);
      expect(sampled.nodes[name]!.y).toBeCloseTo(direct.nodes[name]!.y, 9);
      expect(sampled.nodes[name]!.z).toBeCloseTo(direct.nodes[name]!.z, 9);
    }
  });

  it("idle delegates to computeIdlePose on the idle clock", () => {
    const sampled = sampleCharacterPose({ walking: false, idleTimeS: 3.7 });
    const direct = computeIdlePose(makePoseRigFixture(), 3.7);
    for (const name of CHARACTER_NODE_NAMES) {
      expect(sampled.nodes[name]!.x).toBeCloseTo(direct.nodes[name]!.x, 9);
      expect(sampled.nodes[name]!.y).toBeCloseTo(direct.nodes[name]!.y, 9);
      expect(sampled.nodes[name]!.z).toBeCloseTo(direct.nodes[name]!.z, 9);
    }
  });

  it("defaults the walk phase to 0 when the timeline omits it", () => {
    const sampled = sampleCharacterPose({ walking: true, idleTimeS: 0 });
    const direct = computeWalkPose(makePoseRigFixture(), 0, {
      stride: WALK_STRIDE,
      armSwing: WALK_ARM_SWING,
    });
    expect(sampled.nodes.leftThigh!.x).toBeCloseTo(direct.nodes.leftThigh!.x, 9);
  });
});

describe("projectCharacterRig — worldToScreen projection", () => {
  const camera: IsometricCamera = { panX: 500, panY: 400, zoom: 50, focusFloor: 0 };
  const base = { x: 10, y: 6, z: 20 };
  const screen = projectCharacterRig(
    forwardKinematics(sampleCharacterPose({ walking: false, idleTimeS: 0 }), 0),
    base,
    camera
  );

  it("projects each joint through the shared coordinate module", () => {
    const expected = worldToScreen(10, 6 + 1.52, 20, camera);
    expect(screen.head!.sx).toBeCloseTo(expected.sx, 9);
    expect(screen.head!.sy).toBeCloseTo(expected.sy, 9);
  });

  it("puts the head above the pelvis on screen", () => {
    expect(screen.head!.sy).toBeLessThan(screen.root!.sy);
  });

  it("keeps every bone endpoint finite across a full walk cycle", () => {
    for (let phase = 0; phase < 1; phase += 0.05) {
      const points = projectCharacterRig(
        forwardKinematics(sampleCharacterPose({ walking: true, walkPhase: phase, idleTimeS: 0 }), 0.7),
        base,
        camera
      );
      for (const name of CHARACTER_NODE_NAMES) {
        expect(Number.isFinite(points[name]!.sx)).toBe(true);
        expect(Number.isFinite(points[name]!.sy)).toBe(true);
      }
    }
  });
});
