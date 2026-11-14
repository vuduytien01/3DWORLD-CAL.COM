import { describe, expect, it } from "vitest";
import { cameraPoseToIsometric } from "../camera-adapter";
import { buildHtml5World, findRoomAtScreen } from "../floor-plan";
import { worldToScreen } from "../world-to-screen";

const world = buildHtml5World();

function cameraLookingAt(target: { x: number; y: number; z: number }) {
  return cameraPoseToIsometric({
    position: { x: target.x + 2, y: target.y + 1.6, z: target.z + 3 },
    target,
  });
}

describe("findRoomAtScreen — world rect compare per floor plane", () => {
  it("hits the ground room whose rect contains the inverse-projected point", () => {
    const camera = cameraLookingAt({ x: -12, y: 1.5, z: -5 });
    const center = worldToScreen(-12, 0, -5, camera);
    const hit = findRoomAtScreen(center.sx, center.sy, world, camera);
    expect(hit?.roomId).toBe("td-reception");
    expect(hit?.floorIndex).toBe(0);
  });

  it("hits a floor-3 slice room through its own floor plane", () => {
    const camera = cameraLookingAt({ x: 3.5, y: 10.5, z: 2.5 });
    const center = worldToScreen(3.5, 9, 2.5, camera);
    const hit = findRoomAtScreen(center.sx, center.sy, world, camera);
    expect(hit?.roomId).toBe("noith-room-01");
    expect(hit?.deptCode).toBe("KHOA_NOI_TH");
  });

  it("returns null for points off the dollhouse", () => {
    const camera = cameraLookingAt({ x: 0, y: 1.5, z: 0 });
    const far = worldToScreen(-500, 0, -500, camera);
    expect(findRoomAtScreen(far.sx, far.sy, world, camera)).toBeNull();
  });

  it("resolves on the focus-floor plane only, so upper planes cannot leak in", () => {
    // A screen point aimed at the ground re-inverse-projects into unrelated
    // rooms on higher planes; the hit-test stays on the focus plane.
    const groundCamera = cameraLookingAt({ x: -12, y: 1.5, z: -5 });
    const center = worldToScreen(-12, 0, -5, groundCamera);
    const hit = findRoomAtScreen(center.sx, center.sy, world, groundCamera);
    expect(hit?.floorIndex).toBe(0);
    expect(hit?.roomId).toBe("td-reception");

    const upperRoom = findRoomAtScreen(center.sx, center.sy, world, groundCamera, 5);
    expect(upperRoom?.roomId).not.toBe("td-reception");
  });
});

describe("hit-test vs DOM hotspot rect — same projection source", () => {
  it("the projected room bounding box contains the projected center", () => {
    const camera = cameraLookingAt({ x: -12, y: 1.5, z: -5 });
    const corners = [
      worldToScreen(-15, 0, -7, camera),
      worldToScreen(-9, 0, -7, camera),
      worldToScreen(-9, 0, -3, camera),
      worldToScreen(-15, 0, -3, camera),
    ];
    const center = worldToScreen(-12, 0, -5, camera);
    const minX = Math.min(...corners.map((c) => c.sx));
    const maxX = Math.max(...corners.map((c) => c.sx));
    const minY = Math.min(...corners.map((c) => c.sy));
    const maxY = Math.max(...corners.map((c) => c.sy));
    expect(center.sx).toBeGreaterThanOrEqual(minX);
    expect(center.sx).toBeLessThanOrEqual(maxX);
    expect(center.sy).toBeGreaterThanOrEqual(minY);
    expect(center.sy).toBeLessThanOrEqual(maxY);
  });

  it("canvas hit-test and rect agree on which room a center selects", () => {
    const camera = cameraLookingAt({ x: 3.5, y: 10.5, z: 2.5 });
    const center = worldToScreen(3.5, 9, 2.5, camera);
    const hit = findRoomAtScreen(center.sx, center.sy, world, camera);
    const rectRoom = world.floors[3]?.rooms.find((room) => room.roomId === "noith-room-01");
    expect(hit?.roomId).toBe(rectRoom?.roomId);
  });
});
