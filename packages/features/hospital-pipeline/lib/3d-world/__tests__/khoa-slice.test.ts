/**
 * KHOA Floor Slice — Unit Tests (Lượt 7)
 *
 * Pure-data coverage for khoa-slice.ts (layout, rooms, furniture presets,
 * through-floor stairs + elevator, two-tier signage, Mint Order palette,
 * tris budget).
 */

import { describe, expect, it } from "vitest";
import {
  buildKhoaFloorSlice,
  buildKhoaSlices,
  estimateKhoaSliceTris,
  getKhoaSliceDepartment,
  type KhoaFloorSlice,
  MINT_ORDER_COLORS,
  MINT_ORDER_SLICE_PALETTE,
  SLICE_DEFAULT_FLOORS,
  SLICE_DEPARTMENT_TEMPLATE,
  SLICE_FURNITURE_PRESET_BY_KIND,
  SLICE_LAYOUT,
  validateKhoaFloorSlice,
} from "../khoa-slice";

const primitivesByRole = (slice: KhoaFloorSlice) => {
  const byRole = new Map<string, number>();
  for (const primitive of slice.primitives) {
    byRole.set(primitive.role, (byRole.get(primitive.role) ?? 0) + 1);
  }
  return byRole;
};

describe("SLICE_DEPARTMENT_TEMPLATE — specs/03 KHOA shape", () => {
  it("contains the 6 Lượt-6 departments with Lượt-6 signage color", () => {
    expect(SLICE_DEPARTMENT_TEMPLATE.map((d) => d.code)).toEqual([
      "KHOA_NOI",
      "KHOA_CDHA",
      "KHOA_NGOAI",
      "KHOA_MAT",
      "KHOA_TMH",
      "KHOA_RHM",
    ]);
    for (const dept of SLICE_DEPARTMENT_TEMPLATE) {
      expect(dept.signageColor).toBe("#134E4A");
      expect(dept.triageKeywords.length).toBeGreaterThan(0);
      expect(dept.rooms.length).toBeGreaterThan(0);
    }
  });

  it("maps each department to its specialty room kinds per specs/03", () => {
    const kindsByCode = Object.fromEntries(
      SLICE_DEPARTMENT_TEMPLATE.map((dept) => [dept.code, dept.rooms.map((room) => room.kind)])
    );
    expect(kindsByCode).toEqual({
      KHOA_NOI: ["exam", "exam"],
      KHOA_CDHA: ["xray", "ultrasound"],
      KHOA_NGOAI: ["surgery"],
      KHOA_MAT: ["ophthalmology", "ophthalmology"],
      KHOA_TMH: ["ent"],
      KHOA_RHM: ["dental"],
    });
  });

  it("carries per-room specialty notes for AI guide triage", () => {
    for (const dept of SLICE_DEPARTMENT_TEMPLATE) {
      for (const room of dept.rooms) {
        expect(room.specialtyNote, `${room.roomId} specialtyNote`).toBeTruthy();
        expect(room.doorWidth).toBeGreaterThan(0);
        expect(room.size.depth).toBe(4);
      }
    }
  });
});

describe("buildKhoaFloorSlice — Lượt 6 dollhouse layout", () => {
  it("builds floors 2-3 by default index convention with 24×12 footprint", () => {
    const slice = buildKhoaFloorSlice(1);
    expect(slice.floorIndex).toBe(1);
    expect(slice.displayFloor).toBe(2);
    expect(slice.footprint).toEqual({ width: 24, depth: 12 });
    expect(slice.baseY).toBe(3);
  });

  it("lays out 10 rooms per floor (9 specialty + 1 shared waiting)", () => {
    const slice = buildKhoaFloorSlice(2);
    const deptRoomCount = slice.departments.reduce((sum, dept) => sum + dept.rooms.length, 0);
    expect(deptRoomCount).toBe(9);
    expect(slice.sharedRooms.length).toBe(1);
    expect(slice.sharedRooms[0]?.kind).toBe("waiting");
    expect(slice.sharedRooms[0]?.roomId.endsWith("-f2"), "shared room id suffixed per floor").toBe(true);
  });

  it("auto-generates walls, door frame and panel for every room from coordinates", () => {
    const slice = buildKhoaFloorSlice(1);
    const allRooms = [...slice.departments.flatMap((dept) => [...dept.rooms]), ...slice.sharedRooms];
    expect(allRooms.length).toBe(10);

    const roles = primitivesByRole(slice);
    for (const room of allRooms) {
      for (const prefix of [
        "room-wall-back",
        "room-wall-side-left",
        "room-wall-side-right",
        "room-wall-front-left",
        "room-wall-front-right",
        "door-frame",
        "door-panel",
      ]) {
        expect(roles.get(`${prefix}-${room.roomId}`), `${prefix} for ${room.roomId}`).toBe(1);
      }
    }
  });

  it("installs per-kind furniture presets from the room kind", () => {
    const slice = buildKhoaFloorSlice(1);
    const roles = primitivesByRole(slice);
    const expectations: Array<[string, string]> = [
      ["noi-room-01-f1", "bed-base"],
      ["noi-room-02-f1", "bed-base"],
      ["cdha-xray-f1", "gantry-column"],
      ["cdha-ultrasound-f1", "machine"],
      ["ngoai-surgery-f1", "table-top"],
      ["mat-exam-f1", "desk"],
      ["mat-vision-f1", "desk"],
      ["tmh-exam-f1", "desk"],
      ["rhm-dental-f1", "chair-seat"],
      ["shared-waiting-f1", "bench-seat"],
    ];
    for (const [roomId, part] of expectations) {
      expect(roles.get(`furniture-${part}-${roomId}`), `furniture ${part} in ${roomId}`).toBe(1);
    }

    const furnitureByRoom = new Map(slice.furniture.map((f) => [f.roomId, f.kind]));
    expect(furnitureByRoom.get("cdha-xray-f1")).toBe("xray");
    expect(furnitureByRoom.get("rhm-dental-f1")).toBe("dental");
    expect(furnitureByRoom.get("corridor-reception-f1")).toBe("reception");
  });

  it("ward preset dựng 2 giường + tủ đầu giường + treo dịch truyền; nurse-station có counter + màn hình", () => {
    const wardRoles = SLICE_FURNITURE_PRESET_BY_KIND.ward.map((part) => part.role);
    expect(wardRoles).toContain("bed-base");
    expect(wardRoles).toContain("bed-base-2");
    expect(wardRoles).toContain("nightstand");
    expect(wardRoles).toContain("iv-stand");
    const nurseRoles = SLICE_FURNITURE_PRESET_BY_KIND["nurse-station"].map((part) => part.role);
    expect(nurseRoles).toContain("counter-top");
    expect(nurseRoles).toContain("monitor");
    expect(nurseRoles).toContain("file-shelf");
    const monitor = SLICE_FURNITURE_PRESET_BY_KIND["nurse-station"].find(
      (part) => part.role === "monitor"
    );
    expect(monitor?.kind).toBe("plane");
    expect(monitor?.faceCorridor).toBe(true);
  });

  it("mirrors furniture toward the back wall for south-facing rooms", () => {
    const slice = buildKhoaFloorSlice(1);
    const surgery = slice.primitives.find((p) => p.role === "furniture-table-top-ngoai-surgery-f1");
    // North row room center z = 9.5, back wall side is +z
    expect(surgery?.position.z).toBeCloseTo(9.9, 5);
    const examBed = slice.primitives.find((p) => p.role === "furniture-bed-base-noi-room-01-f1");
    // South row room center z = 2.5, back wall side is -z
    expect(examBed?.position.z).toBeCloseTo(1.5, 5);
  });

  it("renders two-tier signage: 6 hanging (#134E4A) + 10 wall (#0F766E) + 2 arrows", () => {
    const slice = buildKhoaFloorSlice(1);
    const hanging = slice.signs.filter((s) => s.variant === "dept-hanging");
    const wall = slice.signs.filter((s) => s.variant === "room-wall");
    const arrows = slice.signs.filter((s) => s.variant === "direction-arrow");

    expect(hanging.length).toBe(6);
    for (const sign of hanging) {
      expect(sign.color).toBe("#134E4A");
      expect(sign.content).toContain("·");
    }
    expect(wall.length).toBe(10);
    for (const sign of wall) {
      expect(sign.color).toBe("#0F766E");
    }
    expect(arrows.map((s) => s.content)).toEqual(["THANG MÁY", "THANG BỘ"]);
  });

  it("is deterministic for the same floor index", () => {
    expect(buildKhoaFloorSlice(1)).toEqual(buildKhoaFloorSlice(1));
  });

  it("rejects invalid floor indices with a descriptive error", () => {
    expect(() => buildKhoaFloorSlice(-1)).toThrow(/floorIndex/);
    expect(() => buildKhoaFloorSlice(1.5)).toThrow(/floorIndex/);
  });
});

describe("kết cấu xuyên tầng — stairs + elevator", () => {
  const [sliceFloor1, sliceFloor2] = buildKhoaSlices(SLICE_DEFAULT_FLOORS);

  it("stacks floors 2-3 (indices 1-2) in order", () => {
    expect(sliceFloor1?.floorIndex).toBe(1);
    expect(sliceFloor2?.floorIndex).toBe(2);
    expect(sliceFloor2?.displayFloor).toBe(3);
  });

  it("cuts the stair hole only in the upper slab at the corridor center", () => {
    expect(sliceFloor1?.slabHole).toBeNull();
    expect(sliceFloor1?.stairwell).toBeNull();
    expect(sliceFloor2?.slabHole).toEqual(SLICE_LAYOUT.stairHole);
    expect(sliceFloor2?.stairwell).not.toBeNull();
    expect(sliceFloor2?.stairwell?.landsOnFloorIndex).toBe(1);
  });

  it("splits the corridor floor around the hole on the stairwell slice", () => {
    const roles2 = primitivesByRole(sliceFloor2!);
    expect(roles2.get("corridor-floor-west")).toBe(1);
    expect(roles2.get("corridor-floor-east")).toBe(1);
    expect(roles2.has("corridor-floor")).toBe(false);

    const roles1 = primitivesByRole(sliceFloor1!);
    expect(roles1.get("corridor-floor")).toBe(1);
  });

  it("builds the slab with 4 boxes around the hole on the stairwell slice", () => {
    const roles2 = primitivesByRole(sliceFloor2!);
    expect(roles2.get("slab")).toBeUndefined();
    expect(roles2.get("slab-hole-west")).toBe(1);
    expect(roles2.get("slab-hole-east")).toBe(1);
    expect(roles2.get("slab-hole-north")).toBe(1);
    expect(roles2.get("slab-hole-south")).toBe(1);

    const roles1 = primitivesByRole(sliceFloor1!);
    expect(roles1.get("slab")).toBe(1);
  });

  it("descends 12 steps from the upper floor to the lower floor level", () => {
    const stairwell = sliceFloor2?.stairwell;
    expect(stairwell?.steps).toBe(12);
    expect(stairwell?.stepRise).toBeCloseTo(0.25, 5);

    const stepYs = sliceFloor2!.primitives
      .filter((p) => p.role.startsWith("stair-step-"))
      .map((p) => p.position.y)
      .sort((a, b) => b - a);
    expect(stepYs.length).toBe(12);
    expect(stepYs[0]).toBeCloseTo(6 - 0.15, 5);
    expect(stepYs[11]).toBeCloseTo(6 - 0.15 - 11 * 0.25, 5);
    expect(stepYs[11]).toBeGreaterThan(3);
  });

  it("guards the hole with 3 rails, a handrail and a lower-floor landing", () => {
    const roles = primitivesByRole(sliceFloor2!);
    expect(roles.get("stair-hole-rail-north")).toBe(1);
    expect(roles.get("stair-hole-rail-south")).toBe(1);
    expect(roles.get("stair-hole-rail-west")).toBe(1);
    expect(roles.get("stair-handrail")).toBe(1);
    expect(roles.get("stair-landing")).toBe(1);

    const landing = sliceFloor2!.primitives.find((p) => p.role === "stair-landing");
    expect(landing?.position.y).toBeCloseTo(3.025, 5);
    expect(landing?.position.x).toBeLessThan(SLICE_LAYOUT.stairHole.x0);
  });

  it("recesses the elevator with doors on every floor and one shared shaft", () => {
    expect(sliceFloor1?.elevator.hasShaft).toBe(true);
    expect(sliceFloor1?.elevator.shaftSpanY).toEqual({ min: 3, max: 9 });
    expect(sliceFloor2?.elevator.hasShaft).toBe(false);

    for (const slice of [sliceFloor1!, sliceFloor2!]) {
      const roles = primitivesByRole(slice);
      expect(roles.get("elevator-door-left")).toBe(1);
      expect(roles.get("elevator-door-right")).toBe(1);
      expect(roles.get("elevator-panel")).toBe(1);
    }
    const roles1 = primitivesByRole(sliceFloor1!);
    expect(roles1.get("elevator-shaft")).toBe(1);
    const roles2 = primitivesByRole(sliceFloor2!);
    expect(roles2.get("elevator-shaft")).toBeUndefined();
  });

  it("gives every floor in the set a stairwell whose neighbor is included", () => {
    const slices = buildKhoaSlices([1, 2, 3]);
    expect(slices.map((s) => s.stairwell !== null)).toEqual([false, true, true]);
  });

  it("dedupes and sorts floors, rejecting invalid sets", () => {
    const slices = buildKhoaSlices([2, 1, 1]);
    expect(slices.map((s) => s.floorIndex)).toEqual([1, 2]);
    expect(() => buildKhoaSlices([])).toThrow(/at least one floor/);
    expect(() => buildKhoaSlices([-2])).toThrow(/integers >= 0/);
    expect(() => buildKhoaSlices([1.5])).toThrow(/integers >= 0/);
  });
});

describe("Mint Order palette — 8 sắc đồng bộ", () => {
  it("exposes exactly the 8 locked Mint Order colors", () => {
    expect(MINT_ORDER_COLORS).toHaveLength(8);
    expect([...MINT_ORDER_COLORS].sort()).toEqual(
      ["#EEF5F2", "#CDEBE3", "#0F766E", "#134E4A", "#99F6E4", "#ECFDF5", "#F8FAFC", "#BFDBFE"].sort()
    );
  });

  it("derives floor and wall from the Lượt-2 tones", () => {
    expect(MINT_ORDER_SLICE_PALETTE.floor).toBe("#EEF5F2");
    expect(MINT_ORDER_SLICE_PALETTE.wall).toBe("#CDEBE3");
  });

  it("keeps every primitive color inside the 8-color palette", () => {
    const slices = buildKhoaSlices(SLICE_DEFAULT_FLOORS);
    for (const slice of slices) {
      for (const primitive of slice.primitives) {
        expect(
          MINT_ORDER_COLORS.includes(primitive.color),
          `${primitive.role} color ${primitive.color}`
        ).toBe(true);
      }
    }
  });
});

describe("estimateKhoaSliceTris — ngân sách ≤2.5k tris/tầng", () => {
  const slices = buildKhoaSlices(SLICE_DEFAULT_FLOORS);
  const estimate = estimateKhoaSliceTris(slices);

  it("stays within 2500 tris per floor slice", () => {
    expect(estimate.perFloor["1"]).toBeLessThanOrEqual(2500);
    expect(estimate.perFloor["2"]).toBeLessThanOrEqual(2500);
  });

  it("sums per-floor counts into the total", () => {
    const sum = Object.values(estimate.perFloor).reduce((acc, n) => acc + n, 0);
    expect(estimate.total).toBe(sum);
    expect(estimate.total).toBeGreaterThan(0);
  });

  it("counts 12 tris per box, 2 per plane and 2 per sign", () => {
    const mini = estimateKhoaSliceTris([
      {
        floorIndex: 0,
        primitives: [
          {
            kind: "box",
            role: "probe-box",
            size: { x: 1, y: 1, z: 1 },
            position: { x: 0, y: 0, z: 0 },
            color: "#EEF5F2",
          },
          {
            kind: "plane",
            role: "probe-plane",
            size: { x: 1, y: 1, z: 0 },
            position: { x: 0, y: 0, z: 0 },
            color: "#134E4A",
          },
        ],
        signs: [
          {
            id: "probe-sign",
            variant: "room-wall",
            content: "PHÒNG",
            color: "#0F766E",
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            size: { x: 1, y: 0.3 },
          },
        ],
      },
    ]);
    expect(mini.total).toBe(12 + 2 + 2);
  });
});

describe("validateKhoaFloorSlice — specs/03 validation rules", () => {
  it("passes for every slice of the default floor set", () => {
    const slices = buildKhoaSlices(SLICE_DEFAULT_FLOORS);
    for (const slice of slices) {
      const errors = validateKhoaFloorSlice(slice);
      expect(errors, errors.join("; ")).toEqual([]);
    }
  });

  it("flags primitives outside the footprint and doors off the perimeter", () => {
    const slice = buildKhoaFloorSlice(1);
    const broken: KhoaFloorSlice = {
      ...slice,
      primitives: [
        ...slice.primitives,
        {
          kind: "box",
          role: "out-of-bounds-probe",
          size: { x: 1, y: 1, z: 1 },
          position: { x: 99, y: slice.baseY + 1, z: 6 },
          color: "#EEF5F2",
        },
      ],
      sharedRooms: [
        {
          ...slice.sharedRooms[0]!,
          doorOffset: { x: 0, z: 1.3 },
        },
      ],
    };
    const errors = validateKhoaFloorSlice(broken);
    expect(errors.some((e) => e.includes("out-of-bounds-probe"))).toBe(true);
    expect(errors.some((e) => e.includes("door not on perimeter"))).toBe(true);
  });
});

describe("getKhoaSliceDepartment — code + floor lookup", () => {
  const slices = buildKhoaSlices(SLICE_DEFAULT_FLOORS);

  it("returns the department matching code and floor", () => {
    const dept = getKhoaSliceDepartment(slices, "KHOA_NGOAI", 2);
    expect(dept?.name).toBe("KHOA NGOẠI");
    expect(dept?.rooms[0]?.roomId).toBe("ngoai-surgery-f2");
  });

  it("returns undefined for mismatched floor or unknown code", () => {
    expect(getKhoaSliceDepartment(slices, "KHOA_NGOAI", 0)).toBeUndefined();
    expect(getKhoaSliceDepartment(slices, "KHOA_ABC", 1)).toBeUndefined();
  });
});

describe("buildKhoaFloorSlice — departments override (T-12 wire)", () => {
  it("uses override departments when provided, keeps other defaults", () => {
    const customDept = {
      code: "KHOA_TEST",
      name: "KHOA TEST",
      shortCode: "TEST",
      signageColor: "#134E4A",
      rooms: [
        {
          roomId: "test-room-01",
          label: "PHÒNG TEST",
          kind: "exam" as const,
          position: { x: 5, z: 2.5 },
          size: { width: 4, depth: 4 },
          doorOffset: { x: 0, z: 2 },
          doorWidth: 1.0,
          specialtyNote: "test department",
        },
      ],
      triageKeywords: ["test"],
    };

    const slice = buildKhoaFloorSlice(5, { departments: [customDept] });
    expect(slice.floorIndex).toBe(5);
    expect(slice.displayFloor).toBe(6);
    expect(slice.departments).toHaveLength(1);
    expect(slice.departments[0]?.code).toBe("KHOA_TEST");
    // override departments used directly (no floor suffix auto-added)
    expect(slice.departments[0]?.rooms[0]?.roomId).toBe("test-room-01");
    expect(slice.stairwell).not.toBeNull(); // default withStairwell for floorIndex >= 1
    expect(slice.sharedRooms.length).toBeGreaterThan(0); // default shared rooms still present
  });

  it("override departments does not affect original template", () => {
    const customDept = {
      code: "KHOA_TEST2",
      name: "KHOA TEST2",
      shortCode: "TEST2",
      signageColor: "#134E4A",
      rooms: [],
      triageKeywords: [],
    };

    buildKhoaFloorSlice(1, { departments: [customDept] });
    const defaultSlice = buildKhoaFloorSlice(1);
    expect(defaultSlice.departments.length).toBe(6); // original 6 departments unchanged
    expect(defaultSlice.departments[0]?.code).toBe("KHOA_NOI");
  });
});
