import { describe, expect, it } from "vitest";

import {
  KHOA_UPPER_FLOOR_PLANS,
  UPPER_FLOOR_INDEXES,
  getUpperFloorPlan,
} from "../khoa-upper-floors";
import {
  MINT_ORDER_COLORS,
  MINT_ORDER_SLICE_PALETTE,
  SLICE_LAYOUT,
  type KhoaRoomKind,
  type KhoaRoomSpec,
  type KhoaSliceDepartment,
} from "../../3d-world/khoa-slice";

/** mọi kind hợp lệ — Record này ép file phải liệt kê đủ khi KhoaRoomKind mở rộng */
const KIND_KEYS: Record<KhoaRoomKind, true> = {
  exam: true,
  xray: true,
  ultrasound: true,
  surgery: true,
  ophthalmology: true,
  ent: true,
  dental: true,
  waiting: true,
  reception: true,
  payment: true,
  ward: true,
  "nurse-station": true,
};

function allDepartments(): readonly { floorIndex: number; dept: KhoaSliceDepartment }[] {
  return UPPER_FLOOR_INDEXES.flatMap((floorIndex) =>
    (KHOA_UPPER_FLOOR_PLANS[floorIndex] ?? []).map((dept) => ({ floorIndex, dept })),
  );
}

describe("KHOA upper floors (T-12) — cấu trúc dữ liệu", () => {
  it("đủ 7 tầng 4-10 (floorIndex 3-9), mỗi tầng 3 khoa", () => {
    expect([...UPPER_FLOOR_INDEXES]).toEqual([3, 4, 5, 6, 7, 8, 9]);
    for (const floorIndex of UPPER_FLOOR_INDEXES) {
      const plan = KHOA_UPPER_FLOOR_PLANS[floorIndex];
      expect(plan, `tầng ${floorIndex + 1} thiếu plans`).toBeDefined();
      expect(plan!.length).toBe(3);
    }
  });

  it("mã khoa không trùng trên toàn bệnh viện, trường bắt buộc không rỗng", () => {
    const seen = new Set<string>();
    for (const { floorIndex, dept } of allDepartments()) {
      expect(seen.has(dept.code), `${dept.code} trùng ở tầng ${floorIndex + 1}`).toBe(false);
      seen.add(dept.code);
      expect(dept.name.length).toBeGreaterThan(0);
      expect(dept.shortCode.length).toBeGreaterThan(0);
      expect(dept.triageKeywords.length).toBeGreaterThan(0);
      expect(dept.rooms.length).toBeGreaterThan(0);
    }
  });

  it("signageColor nằm trong palette Mint Order 8 sắc", () => {
    for (const { dept } of allDepartments()) {
      expect(MINT_ORDER_COLORS).toContain(dept.signageColor);
    }
    expect(MINT_ORDER_SLICE_PALETTE.primaryDark).toBe("#134E4A");
  });

  it("mọi kind của phòng thuộc bộ đóng KhoaRoomKind (compile-time exhaustive)", () => {
    for (const { dept } of allDepartments()) {
      for (const roomSpec of dept.rooms) {
        expect(KIND_KEYS[roomSpec.kind]).toBe(true);
      }
    }
  });

  it("buồng nội trú dùng kind 'ward', trạm điều dưỡng dùng 'nurse-station' (research/06)", () => {
    const wards = allDepartments().flatMap(({ dept }) => dept.rooms.filter((r) => r.label.includes("BUỒNG")));
    expect(wards.length).toBeGreaterThanOrEqual(7);
    for (const roomSpec of wards) {
      expect(roomSpec.kind, `${roomSpec.roomId} buồng phải là ward`).toBe("ward");
    }
    const nurseStations = allDepartments().flatMap(({ dept }) =>
      dept.rooms.filter((r) => r.kind === "nurse-station")
    );
    expect(nurseStations.length).toBeGreaterThanOrEqual(1);
    expect(nurseStations[0].label).toContain("ĐIỀU DƯỠNG");
  });
});

describe("KHOA upper floors — grammar hình học SLICE_LAYOUT 24×12", () => {
  function aabb(roomSpec: KhoaRoomSpec) {
    return {
      x0: roomSpec.position.x - roomSpec.size.width / 2,
      x1: roomSpec.position.x + roomSpec.size.width / 2,
      z0: roomSpec.position.z - roomSpec.size.depth / 2,
      z1: roomSpec.position.z + roomSpec.size.depth / 2,
    };
  }

  it("phòng nằm trọn trong sàn 24×12", () => {
    for (const { floorIndex, dept } of allDepartments()) {
      for (const roomSpec of dept.rooms) {
        const box = aabb(roomSpec);
        expect(box.x0, `${roomSpec.roomId} tầng ${floorIndex + 1} tràn trái`).toBeGreaterThanOrEqual(0);
        expect(box.x1, `${roomSpec.roomId} tràn phải`).toBeLessThanOrEqual(SLICE_LAYOUT.floorWidth);
        expect(box.z0).toBeGreaterThanOrEqual(0);
        expect(box.z1).toBeLessThanOrEqual(SLICE_LAYOUT.floorDepth);
      }
    }
  });

  it("không có hai phòng nào chồng lấn trên cùng một tầng", () => {
    for (const floorIndex of UPPER_FLOOR_INDEXES) {
      const rooms = (KHOA_UPPER_FLOOR_PLANS[floorIndex] ?? []).flatMap((d) => [...d.rooms]);
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = aabb(rooms[i]);
          const b = aabb(rooms[j]);
          const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
          expect(overlap, `${rooms[i].roomId} đè ${rooms[j].roomId} ở tầng ${floorIndex + 1}`).toBe(false);
        }
      }
    }
  });

  it("cửa luôn quay về hành lang: hàng bắc mở +z, hàng nam mở −z", () => {
    for (const { dept } of allDepartments()) {
      for (const roomSpec of dept.rooms) {
        if (roomSpec.position.z < SLICE_LAYOUT.corridor.z0) {
          expect(roomSpec.doorOffset.z, `${roomSpec.roomId} cửa sai phía (bắc)`).toBe(2);
        } else if (roomSpec.position.z > SLICE_LAYOUT.corridor.z1) {
          expect(roomSpec.doorOffset.z, `${roomSpec.roomId} cửa sai phía (nam)`).toBe(-2);
        } else {
          throw new Error(`${roomSpec.roomId} nằm giữa hành lang`);
        }
      }
    }
  });

  it("roomId không chứa hậu tố tầng (builder tự thêm -f{idx})", () => {
    for (const { dept } of allDepartments()) {
      for (const roomSpec of dept.rooms) {
        expect(roomSpec.roomId).not.toMatch(/-f\d+$/);
      }
    }
  });

  it("roomId duy nhất trong từng tầng", () => {
    for (const floorIndex of UPPER_FLOOR_INDEXES) {
      const ids = (KHOA_UPPER_FLOOR_PLANS[floorIndex] ?? []).flatMap((d) => d.rooms.map((r) => r.roomId));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("KHOA upper floors — API tiêu thụ", () => {
  it("getUpperFloorPlan trả đúng tầng và undefined ngoài 3-9", () => {
    expect(getUpperFloorPlan(3)?.[0].code).toBe("KHOA_NOI_TH");
    expect(getUpperFloorPlan(9)?.[0].code).toBe("PHONG_HC");
    expect(getUpperFloorPlan(0)).toBeUndefined();
    expect(getUpperFloorPlan(2)).toBeUndefined();
    expect(getUpperFloorPlan(10)).toBeUndefined();
  });
});
