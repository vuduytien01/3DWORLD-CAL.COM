/**
 * World spec data-shape invariants — the exported STEPS / KHOA / SIGN_HOSTS
 * arrays and their lookup maps (lib/3d-world/world-spec.ts).
 *
 * These structures are the package's public data surface (re-exported through
 * lib/3d-world/index.ts and the package root index.ts), so every consumer —
 * renderer overlays, sign hosts, triage lookups — depends on the invariants
 * below: unique stable ids, finite coordinates, floors in range, and lookup
 * maps that cover every entry. The special-room mapping is a domain contract
 * (CDHA rooms get x-ray gantries, RHM rooms get dental chairs), pinned the
 * same way the khoa-slice suite pins its furniture presets.
 */

import { describe, expect, it } from "vitest";
import {
  type FurnitureKind,
  generateSignHostsFromSpec,
  generateStepsFromSpec,
  getDepartment,
  HOSPITAL_WORLD_SPEC,
  KHOA,
  KHOA_BY_CODE,
  type RoomType,
  SIGN_HOSTS,
  SIGN_HOSTS_BY_ID,
  STEP_LOCATION_BY_ID,
  STEPS,
  triageDepartment,
} from "../world-spec";

const ROOM_TYPES: readonly RoomType[] = [
  "consultation",
  "xray",
  "ultrasound",
  "surgery",
  "eye_exam",
  "ent_exam",
  "dental",
  "lab",
  "waiting",
  "reception",
  "payment",
  "admission",
  "elevator_lobby",
  "stairs_lobby",
];

const FURNITURE_KINDS: readonly FurnitureKind[] = [
  "exam_bed",
  "xray_gantry",
  "ultrasound_machine",
  "surgical_table",
  "eye_chart",
  "ent_table",
  "dental_chair",
  "lab_analyzer",
  "waiting_bench",
  "reception_counter",
  "payment_counter",
  "hospital_bed",
  "elevator_cabin",
  "stairs_module",
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isFiniteVec3(v: { x: number; y: number; z: number }): boolean {
  return [v.x, v.y, v.z].every(Number.isFinite);
}

describe("HOSPITAL_WORLD_SPEC — 10-floor hospital layout", () => {
  it("declares 10 floors with 3m height and the known footprint", () => {
    expect(HOSPITAL_WORLD_SPEC.world.floorCount).toBe(10);
    expect(HOSPITAL_WORLD_SPEC.world.floorHeight).toBe(3.0);
    expect(HOSPITAL_WORLD_SPEC.world.dimensions).toEqual({ width: 48, depth: 36, height: 30 });
    expect(HOSPITAL_WORLD_SPEC.world.slabThickness).toBe(0.3);
  });

  it("has one region per floor with ids floor-0..floor-9", () => {
    expect(HOSPITAL_WORLD_SPEC.regions).toHaveLength(10);
    const ids = HOSPITAL_WORLD_SPEC.regions.map((r) => r.id);
    expect(ids).toEqual(Array.from({ length: 10 }, (_, i) => `floor-${i}`));
    expect(new Set(ids).size).toBe(10);
  });

  it("camera path times are strictly ascending from 0", () => {
    const times = HOSPITAL_WORLD_SPEC.cameraPath.map((k) => k.time);
    expect(times[0]).toBe(0);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
    for (const keyframe of HOSPITAL_WORLD_SPEC.cameraPath) {
      expect(isFiniteVec3(keyframe.position)).toBe(true);
      expect(isFiniteVec3(keyframe.target)).toBe(true);
      expect(keyframe.fov).toBeGreaterThan(0);
    }
  });

  it("every landmark points at an existing region and carries a position", () => {
    const regionIds = new Set(HOSPITAL_WORLD_SPEC.regions.map((r) => r.id));
    for (const landmark of HOSPITAL_WORLD_SPEC.landmarks) {
      expect(regionIds.has(landmark.regionId)).toBe(true);
      expect(isFiniteVec3(landmark.position)).toBe(true);
    }
  });
});

describe("STEPS — 8 pipeline steps", () => {
  it("has exactly 8 steps with unique ids, all reachable through the lookup map", () => {
    expect(STEPS).toHaveLength(8);
    const ids = STEPS.map((s) => s.stepId);
    expect(new Set(ids).size).toBe(8);
    for (const step of STEPS) {
      expect(STEP_LOCATION_BY_ID.get(step.stepId)).toBe(step);
    }
  });

  it("every step has finite coordinates, a floor in range and a message", () => {
    for (const step of STEPS) {
      expect(isFiniteVec3(step.position)).toBe(true);
      expect(step.floor).toBeGreaterThanOrEqual(0);
      expect(step.floor).toBeLessThanOrEqual(9);
      expect(step.estimatedWait).toBeGreaterThanOrEqual(0);
      expect(step.aiGuideMessage.length).toBeGreaterThan(0);
    }
  });

  it("generateStepsFromSpec reproduces the same 8-step contract", () => {
    const regenerated = generateStepsFromSpec();
    expect(regenerated.map((s) => s.stepId)).toEqual(STEPS.map((s) => s.stepId));
  });
});

describe("KHOA — departments and rooms", () => {
  it("covers the ground departments and every clinical floor", () => {
    const codes = KHOA.map((k) => k.code);
    expect(codes).toContain("TIEPDON");
    expect(codes).toContain("XETNGHIEM");
    expect(codes).toContain("THANHTOAN");
    expect(codes).toContain("NOI_F1");
    expect(codes).toContain("SANKHOA_F9");
    expect(new Set(codes).size).toBe(codes.length);
    expect(KHOA.length).toBeGreaterThan(70);
  });

  it("every department has ≥1 room with valid type and furniture kind", () => {
    for (const dept of KHOA) {
      expect(dept.rooms.length).toBeGreaterThanOrEqual(1);
      expect(dept.signageColor).toMatch(HEX_COLOR);
      expect(isFiniteVec3(dept.worldOrigin)).toBe(true);
      expect(dept.worldOrigin.y).toBeCloseTo(1.5 + dept.floor * 3.0, 6);
      for (const room of dept.rooms) {
        expect(ROOM_TYPES).toContain(room.type);
        expect(FURNITURE_KINDS).toContain(room.furnitureKind);
        expect(isFiniteVec3(room.worldPosition)).toBe(true);
      }
    }
  });

  it("maps special departments to their room kinds (domain contract)", () => {
    const roomTwoType = (deptCode: string): RoomType | undefined =>
      KHOA.find((k) => k.code === deptCode)?.rooms.find((r) => r.id.endsWith("_2"))?.type;

    expect(roomTwoType("CDHA_F1")).toBe("xray");
    expect(roomTwoType("MAT_F1")).toBe("eye_exam");
    expect(roomTwoType("TMH_F1")).toBe("ent_exam");
    expect(roomTwoType("RHM_F1")).toBe("dental");
    expect(roomTwoType("NGOAI_F1")).toBe("surgery");
    expect(roomTwoType("NOI_F1")).toBe("ultrasound");
    expect(roomTwoType("NHIKHOA_F1")).toBe("consultation");
    expect(roomTwoType("SANKHOA_F1")).toBe("ultrasound");
  });

  it("getDepartment matches code + floor exactly", () => {
    expect(getDepartment("NOI_F1", 1)?.code).toBe("NOI_F1");
    expect(getDepartment("NOI_F1", 0)).toBeUndefined();
    expect(getDepartment("TIEPDON", 0)?.code).toBe("TIEPDON");
  });

  it("the lookup map covers every department", () => {
    expect(KHOA_BY_CODE.size).toBe(KHOA.length);
    for (const dept of KHOA) {
      expect(KHOA_BY_CODE.get(dept.code)).toBe(dept);
    }
  });
});

describe("SIGN_HOSTS — signage anchors", () => {
  it("has unique ids covering step chips, dept signs, room signs and arrows", () => {
    const ids = SIGN_HOSTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SIGN_HOSTS_BY_ID.size).toBe(SIGN_HOSTS.length);
    for (const host of SIGN_HOSTS) {
      expect(host.content.length).toBeGreaterThan(0);
      expect(isFiniteVec3(host.position)).toBe(true);
    }
  });

  it("ships one step chip per pipeline step", () => {
    const chipIds = SIGN_HOSTS.filter((s) => s.type === "step-chip").map((s) => s.id);
    expect(chipIds).toEqual(STEPS.map((s) => `step-chip-${s.stepId}`));
  });

  it("ships a pair of direction arrows on every floor", () => {
    const arrows = SIGN_HOSTS.filter((s) => s.type === "direction-arrow");
    expect(arrows.length).toBe(20); // 10 floors × 2 (elevator + stairs)
  });

  it("generateSignHostsFromSpec reproduces the same contract", () => {
    expect(generateSignHostsFromSpec().map((s) => s.id)).toEqual(SIGN_HOSTS.map((s) => s.id));
  });
});

describe("triageDepartment (world keyword map)", () => {
  it("routes symptoms to the expected department families", () => {
    expect(triageDepartment("đau bụng")?.code).toMatch(/^NOI/);
    expect(triageDepartment("chụp X-quang")?.code).toMatch(/^CDHA/);
    expect(triageDepartment("mắt mờ")?.code).toMatch(/^MAT/);
    expect(triageDepartment("đau họng")?.code).toMatch(/^TMH/);
    expect(triageDepartment("nhổ răng")?.code).toMatch(/^RHM/);
  });

  it("falls back to internal medicine for unknown symptoms", () => {
    const fallback = triageDepartment("xyzzy");
    expect(fallback?.code).toMatch(/^NOI/);
    expect(fallback).toBeDefined();
  });
});
