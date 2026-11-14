import { describe, expect, it } from "vitest";
import { STEP_LOCATIONS } from "../../step-graph/step-locations";
import {
  cameraPoseToIsometric,
  focusFloorForHeight,
  REFERENCE_VIEWPORT,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomForDistance,
} from "../camera-adapter";
import { worldToScreen } from "../world-to-screen";

/** Station pose for one step, restacked onto the stacked dollhouse. */
function stationPose(step: (typeof STEP_LOCATIONS)[number]) {
  const offset = step.cameraDollyOffset ?? { x: 2, y: 1.6, z: 3 };
  return {
    position: {
      x: step.position.x + offset.x,
      y: step.position.y + step.floor * 3 + offset.y,
      z: step.position.z + offset.z,
    },
    target: { x: step.position.x, y: step.position.y + step.floor * 3, z: step.position.z },
  };
}

const INTRO_AERIAL_POSE = {
  position: { x: 0, y: 24, z: -6 },
  target: { x: 0, y: 1.5, z: 6 },
};

const OUTRO_AERIAL_POSE = {
  position: { x: 0, y: 30, z: 18 },
  target: { x: 0, y: 0, z: 15.5 },
};

describe("cameraPoseToIsometric — focusFloor from target.y", () => {
  it("maps every pipeline station onto its own floor", () => {
    for (const step of STEP_LOCATIONS) {
      const camera = cameraPoseToIsometric(stationPose(step));
      expect(camera.focusFloor).toBe(step.floor);
    }
  });

  it("aerial poses focus the ground the dollhouse stands on", () => {
    expect(cameraPoseToIsometric(INTRO_AERIAL_POSE).focusFloor).toBe(0);
    expect(cameraPoseToIsometric(OUTRO_AERIAL_POSE).focusFloor).toBe(0);
  });
});

describe("cameraPoseToIsometric — zoom from position-target distance", () => {
  it("follow segments zoom in far more than the aerial dollhouse", () => {
    const follow = cameraPoseToIsometric(stationPose(STEP_LOCATIONS[0]!));
    const intro = cameraPoseToIsometric(INTRO_AERIAL_POSE);
    expect(follow.zoom).toBeGreaterThan(20);
    expect(intro.zoom).toBeLessThan(10);
    expect(intro.zoom).toBeGreaterThan(ZOOM_MIN);
  });

  it("the outro aerial zooms out further than the intro aerial", () => {
    const intro = cameraPoseToIsometric(INTRO_AERIAL_POSE);
    const outro = cameraPoseToIsometric(OUTRO_AERIAL_POSE);
    expect(outro.zoom).toBeLessThan(intro.zoom);
  });

  it("clamps zoom to the demo-readable range", () => {
    expect(zoomForDistance(0.0001)).toBe(ZOOM_MAX);
    expect(zoomForDistance(1e6)).toBe(ZOOM_MIN);
    expect(zoomForDistance(0)).toBe(ZOOM_MAX);
  });
});

describe("cameraPoseToIsometric — pan centers the look-at target", () => {
  it("projects the target to the viewport center", () => {
    const viewport = { width: 800, height: 600 };
    const camera = cameraPoseToIsometric(stationPose(STEP_LOCATIONS[2]!), viewport);
    const target = stationPose(STEP_LOCATIONS[2]!).target;
    const projected = worldToScreen(target.x, target.y, target.z, camera);
    expect(projected.sx).toBeCloseTo(viewport.width / 2, 6);
    expect(projected.sy).toBeCloseTo(viewport.height / 2, 6);
  });

  it("falls back to the reference viewport so the mapping stays headless", () => {
    const camera = cameraPoseToIsometric(stationPose(STEP_LOCATIONS[0]!));
    const projected = worldToScreen(0, 0, 0, camera);
    expect(camera.panX).not.toBe(0);
    expect(REFERENCE_VIEWPORT.width).toBeGreaterThan(0);
    expect(Number.isFinite(projected.sx)).toBe(true);
  });
});

describe("focusFloorForHeight — eye level belongs to its own floor", () => {
  it("floors are 3 m bands: [0,3) → 0, [3,6) → 1, [6,9) → 2", () => {
    expect(focusFloorForHeight(1.5)).toBe(0);
    expect(focusFloorForHeight(4.5)).toBe(1);
    expect(focusFloorForHeight(7.5)).toBe(2);
    expect(focusFloorForHeight(2.99)).toBe(0);
    expect(focusFloorForHeight(3.01)).toBe(1);
  });

  it("clamps to the built floor range", () => {
    expect(focusFloorForHeight(-2)).toBe(0);
    expect(focusFloorForHeight(27)).toBe(9);
    expect(focusFloorForHeight(999)).toBe(9);
  });
});
