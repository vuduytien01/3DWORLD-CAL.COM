import { describe, expect, it } from "vitest";
import {
  COS30,
  painterDepth,
  SIN30,
  screenToWorld,
  screenToWorldPlane,
  sortPainters,
  worldToScreen,
} from "../world-to-screen";

const CAMERA = { panX: 100, panY: 50, zoom: 2, focusFloor: 0 };

describe("worldToScreen — oblique iso matrix (ADR 0003)", () => {
  it("projects the XZ plane through (cos30, sin30, -cos30, sin30) plus pan", () => {
    const point = worldToScreen(4, 0, 0, CAMERA);
    expect(point.sx).toBeCloseTo(4 * COS30 * 2 + 100, 9);
    expect(point.sy).toBeCloseTo(4 * SIN30 * 2 + 50, 9);
  });

  it("moves +z down-left and +x down-right, per the fixed matrix", () => {
    const origin = worldToScreen(0, 0, 0, CAMERA);
    const alongX = worldToScreen(1, 0, 0, CAMERA);
    const alongZ = worldToScreen(0, 0, 1, CAMERA);
    expect(alongX.sx).toBeGreaterThan(origin.sx);
    expect(alongX.sy).toBeGreaterThan(origin.sy);
    expect(alongZ.sx).toBeLessThan(origin.sx);
    expect(alongZ.sy).toBeGreaterThan(origin.sy);
  });

  it("projects world Y as a vertical screen offset (up on screen)", () => {
    const ground = worldToScreen(2, 0, 4, CAMERA);
    const raised = worldToScreen(2, 3, 4, CAMERA);
    expect(raised.sx).toBeCloseTo(ground.sx, 9);
    expect(raised.sy).toBeCloseTo(ground.sy - 3 * CAMERA.zoom, 9);
  });

  it("scales with zoom and shifts with pan", () => {
    const far = worldToScreen(10, 0, 0, { panX: 0, panY: 0, zoom: 1, focusFloor: 0 });
    expect(far.sx).toBeCloseTo(10 * COS30, 9);
    expect(far.sy).toBeCloseTo(10 * SIN30, 9);
  });
});

describe("screenToWorld — inverse projection", () => {
  const camera = { panX: 321, panY: -87, zoom: 7.3, focusFloor: 2 };

  it("round-trips worldToScreen on the ground plane", () => {
    const projected = worldToScreen(5, 0, -3, camera);
    const recovered = screenToWorld(projected.sx, projected.sy, camera);
    expect(recovered.x).toBeCloseTo(5, 6);
    expect(recovered.y).toBe(0);
    expect(recovered.z).toBeCloseTo(-3, 6);
  });

  it("round-trips on every floor plane the dollhouse uses", () => {
    const planes = [0, 3, 9, 12, 27];
    const points = [
      { x: 3.5, y: 0, z: 2.5 },
      { x: -8, y: 0, z: 12 },
      { x: 20, y: 0, z: 0 },
      { x: 0, y: 0, z: 78 },
    ];
    for (const planeY of planes) {
      for (const point of points) {
        const projected = worldToScreen(point.x, planeY, point.z, camera);
        const recovered = screenToWorldPlane(projected.sx, projected.sy, camera, planeY);
        expect(recovered.x).toBeCloseTo(point.x, 6);
        expect(recovered.z).toBeCloseTo(point.z, 6);
        expect(recovered.planeY).toBe(planeY);
      }
    }
  });

  it("maps one screen point to different XZ per plane (3→2 loss resolved)", () => {
    const projected = worldToScreen(0, 0, 0, camera);
    const atGround = screenToWorldPlane(projected.sx, projected.sy, camera, 0);
    const atFloor3 = screenToWorldPlane(projected.sx, projected.sy, camera, 9);
    expect(atFloor3.z).toBeGreaterThan(atGround.z);
  });
});

describe("painter order", () => {
  it("keys floors strictly above the previous one", () => {
    expect(painterDepth(0, 24, 78)).toBeLessThan(painterDepth(1, 0, 0));
    expect(painterDepth(8, 24, 12)).toBeLessThan(painterDepth(9, 0, 0));
  });

  it("orders far (small x+z) to near (large x+z) inside one floor", () => {
    expect(painterDepth(0, 2, 2)).toBeLessThan(painterDepth(0, 20, 2));
    expect(painterDepth(0, 2, 2)).toBeLessThan(painterDepth(0, 2, 20));
    // Points with the same x + z sit at the same iso depth.
    expect(painterDepth(0, 2, 20)).toBe(painterDepth(0, 20, 2));
  });

  it("sorts a mixed draw list floor-major, depth-minor", () => {
    const sorted = sortPainters([
      { floorIndex: 1, x: 20, z: 2, tag: "f1-far" },
      { floorIndex: 0, x: 20, z: 2, tag: "f0-near" },
      { floorIndex: 0, x: 2, z: 2, tag: "f0-far" },
      { floorIndex: 2, x: 0, z: 0, tag: "f2" },
      { floorIndex: 0, x: 8, z: 8, tag: "f0-mid" },
    ]);
    expect(sorted.map((item) => item.tag)).toEqual(["f0-far", "f0-mid", "f0-near", "f1-far", "f2"]);
  });

  it("does not mutate the input list", () => {
    const items = [
      { floorIndex: 0, x: 9, z: 0 },
      { floorIndex: 0, x: 0, z: 0 },
    ];
    const sorted = sortPainters(items);
    expect(sorted[0]?.x).toBe(0);
    expect(items[0]?.x).toBe(9);
  });
});
