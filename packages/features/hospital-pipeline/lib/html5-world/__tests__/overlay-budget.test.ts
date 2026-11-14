import { describe, expect, it } from "vitest";
import { buildHtml5World, countOverlayNodes, overlayFloorRange } from "../floor-plan";

const world = buildHtml5World();

/** ADR 0003: at most ~300 DOM nodes at any moment (focus floor ± 1 only). */
const OVERLAY_NODE_BUDGET = 300;

describe("overlayFloorRange — focus ± 1 clamped", () => {
  it("keeps the focus floor and one neighbor on each side", () => {
    expect(overlayFloorRange(5, world.maxFloorIndex)).toEqual([4, 5, 6]);
    expect(overlayFloorRange(3, world.maxFloorIndex)).toEqual([2, 3, 4]);
  });

  it("clamps at the ground floor", () => {
    expect(overlayFloorRange(0, world.maxFloorIndex)).toEqual([0, 1]);
    expect(overlayFloorRange(-2, world.maxFloorIndex)).toEqual([0, 1]);
  });

  it("clamps at the top floor", () => {
    expect(overlayFloorRange(9, world.maxFloorIndex)).toEqual([8, 9]);
    expect(overlayFloorRange(15, world.maxFloorIndex)).toEqual([8, 9]);
  });
});

describe("overlay node budget", () => {
  it("stays under 300 nodes for every focus floor of the demo", () => {
    for (let focus = 0; focus <= world.maxFloorIndex; focus++) {
      const nodes = countOverlayNodes(world, focus);
      expect(nodes, `focus floor ${focus}`).toBeLessThanOrEqual(OVERLAY_NODE_BUDGET);
    }
  });

  it("counts group divs, signage, hotspots and step chips", () => {
    const floor = world.floors[0];
    const expected =
      2 +
      (world.floors[0]?.rooms.length ?? 0) +
      (world.floors[1]?.rooms.length ?? 0) +
      (world.floors[0]?.signs.length ?? 0) +
      (world.floors[1]?.signs.length ?? 0) +
      (world.floors[0]?.steps.length ?? 0) +
      (world.floors[1]?.steps.length ?? 0);
    expect(countOverlayNodes(world, 0)).toBe(expected);
    expect(floor?.signs.length).toBeGreaterThan(0);
  });

  it("never includes floors outside the focus ± 1 range", () => {
    // Floor 9 signage stays canvas-dimmed while the camera sits on the ground.
    const range = overlayFloorRange(0, world.maxFloorIndex);
    expect(range).not.toContain(9);
  });
});
