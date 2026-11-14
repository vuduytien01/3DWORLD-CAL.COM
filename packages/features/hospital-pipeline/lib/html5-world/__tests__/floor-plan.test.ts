import { describe, expect, it } from "vitest";
import { buildHtml5World } from "../floor-plan";

const world = buildHtml5World();

describe("buildHtml5World — floor stack", () => {
  it("builds floors 0..9: ground + slice floors 1-2 template + 3-9 plans", () => {
    expect(world.floors.length).toBe(10);
    expect(world.maxFloorIndex).toBe(9);
    expect(world.floors.map((floor) => floor.floorIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("stacks floors at baseY = floorIndex * 3", () => {
    for (const floor of world.floors) {
      expect(floor.baseY).toBe(floor.floorIndex * 3);
    }
  });

  it("every floor carries walls, doors, room tints and a slab", () => {
    for (const floor of world.floors) {
      const roles = new Set(floor.boxes.map((item) => item.role));
      expect(roles.has("wall"), `floor ${floor.floorIndex} walls`).toBe(true);
      expect(roles.has("door-frame"), `floor ${floor.floorIndex} door frames`).toBe(true);
      expect(roles.has("door-panel"), `floor ${floor.floorIndex} door panels`).toBe(true);
      expect(roles.has("room-floor"), `floor ${floor.floorIndex} room tints`).toBe(true);
      expect(roles.has("slab"), `floor ${floor.floorIndex} slab`).toBe(true);
      expect(floor.boxes.length).toBeGreaterThan(0);
    }
  });
});

describe("buildHtml5World — ground floor from GROUND_FLOOR_DEPARTMENTS", () => {
  it("places td-reception at its department worldOrigin + room position", () => {
    const room = world.floors[0]?.rooms.find((r) => r.roomId === "td-reception");
    expect(room).toBeDefined();
    expect(room?.xMin).toBeCloseTo(-15, 6);
    expect(room?.xMax).toBeCloseTo(-9, 6);
    expect(room?.zMin).toBeCloseTo(-7, 6);
    expect(room?.zMax).toBeCloseTo(-3, 6);
  });

  it("covers the far end of the corridor strip (payment counter at z≈75)", () => {
    const room = world.floors[0]?.rooms.find((r) => r.roomId === "tt-counter");
    expect(room).toBeDefined();
    expect(room?.zMax).toBeCloseTo(76.5, 6);
    expect(world.floors[0]?.footprint.zMax).toBeGreaterThan(76.5);
  });

  it("signs the ground rooms with their Vietnamese labels", () => {
    const texts = world.floors[0]?.signs.map((sign) => sign.text) ?? [];
    expect(texts).toContain("QUẦY TIẾP ĐÓN");
    expect(texts).toContain("KHOA TIẾP ĐÓN · TĐ");
  });
});

describe("buildHtml5World — slice floors", () => {
  it("suffices floors 1-2 template room ids per floor", () => {
    const floor1Ids = world.floors[1]?.rooms.map((room) => room.roomId) ?? [];
    expect(floor1Ids).toContain("noi-room-01-f1");
    expect(floor1Ids).toContain("shared-waiting-f1");
    const floor2Ids = world.floors[2]?.rooms.map((room) => room.roomId) ?? [];
    expect(floor2Ids).toContain("noi-room-01-f2");
  });

  it("places the floor-3 digestive-medicine rooms from KHOA_UPPER_FLOOR_PLANS", () => {
    const room = world.floors[3]?.rooms.find((r) => r.roomId === "noith-room-01");
    expect(room).toBeDefined();
    expect(room?.xMin).toBeCloseTo(1.5, 6);
    expect(room?.xMax).toBeCloseTo(5.5, 6);
    expect(room?.zMin).toBeCloseTo(0.5, 6);
    expect(room?.zMax).toBeCloseTo(4.5, 6);
    expect(room?.deptCode).toBe("KHOA_NOI_TH");
  });

  it("keeps the floor-3 Vietnamese signage verbatim from the data", () => {
    const texts = world.floors[3]?.signs.map((sign) => sign.text) ?? [];
    expect(texts).toContain("KHOA NỘI TIÊU HÓA · NỘI TH");
    expect(texts).toContain("PHÒNG KHÁM TIÊU HÓA 01");
    expect(texts).toContain("THANG MÁY");
  });

  it("covers all seven upper plan floors 3-9", () => {
    for (const floorIndex of [3, 4, 5, 6, 7, 8, 9]) {
      const floor = world.floors[floorIndex];
      expect(floor, `floor ${floorIndex}`).toBeDefined();
      expect(floor?.rooms.length ?? 0).toBeGreaterThan(0);
    }
    const floor9Texts = world.floors[9]?.signs.map((sign) => sign.text) ?? [];
    expect(floor9Texts).toContain("TRUNG TÂM ĐÀO TẠO - THƯ VIỆN · ĐÀO TẠO");
  });
});

describe("buildHtml5World — room identity invariants", () => {
  it("room ids stay unique across the whole dollhouse", () => {
    const allIds = world.floors.flatMap((floor) => floor.rooms.map((room) => room.roomId));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("every room has a sane rect and label", () => {
    for (const floor of world.floors) {
      for (const room of floor.rooms) {
        expect(room.xMax, room.roomId).toBeGreaterThan(room.xMin);
        expect(room.zMax, room.roomId).toBeGreaterThan(room.zMin);
        expect(room.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildHtml5World — pipeline stations restacked from STEP_LOCATIONS", () => {
  it("puts each station on its data floor with the dollhouse height added", () => {
    const floor0Steps = world.floors[0]?.steps.map((step) => step.stepId) ?? [];
    expect(floor0Steps).toContain("step-ticket");
    const ticket = world.floors[0]?.steps.find((step) => step.stepId === "step-ticket");
    expect(ticket?.y).toBeCloseTo(1.5, 6);
    expect(ticket?.label).toBe("LẤY VÉ");

    const consultation = world.floors[1]?.steps.find((step) => step.stepId === "step-consultation");
    expect(consultation).toBeDefined();
    expect(consultation?.y).toBeCloseTo(4.5, 6);

    const admission = world.floors[2]?.steps.find((step) => step.stepId === "step-admission");
    expect(admission).toBeDefined();
    expect(admission?.y).toBeCloseTo(7.5, 6);
  });

  it("exposes a step chip sign per station (data-step source)", () => {
    const floor0Signs = world.floors[0]?.signs ?? [];
    const chip = floor0Signs.find((sign) => sign.stepId === "step-ticket");
    expect(chip?.text).toBe("LẤY VÉ");
    expect(chip?.variant).toBe("step-chip");
    expect(chip?.y).toBeCloseTo(1.5 + 2.2, 6);
  });

  it("keeps upper plan floors free of pipeline stations", () => {
    expect(world.floors[3]?.steps.length).toBe(0);
    expect(world.floors[9]?.steps.length).toBe(0);
  });
});
