/**
 * AI Guide Triage — department routing from symptoms text
 *
 * Boundary for the Guide Service. Ground-floor matching per spec 03 lives in
 * step-graph/department-locations.ts and is re-exported untouched. Floors 4-10
 * come from the pure plans in data/khoa-upper-floors.ts (T-12): their khoa
 * carry triageKeywords but are not DepartmentSpec instances (no worldOrigin,
 * ward/nurse-station room kinds), so routing returns them as an
 * UpperFloorDepartment snapshot with the display floor (floorIndex + 1).
 * This module is the single import point for AI Guide code, so Guide modules
 * never reach into step-graph or 3d-world directly for triage.
 */

import {
  GROUND_FLOOR_DEPARTMENTS,
  type DepartmentSpec,
} from '../step-graph/department-locations';
import { KHOA_UPPER_FLOOR_PLANS, UPPER_FLOOR_INDEXES } from '../data/khoa-upper-floors';
import type { KhoaSliceDepartment } from '../3d-world/khoa-slice';

export {
  triageDepartment,
  type DepartmentSpec,
} from '../step-graph/department-locations';

/**
 * A khoa on floors 4-10 (floorIndex 3-9) returned by triage. Pure data
 * snapshot from KHOA_UPPER_FLOOR_PLANS — no geometry is built here.
 */
export interface UpperFloorDepartment {
  readonly code: string;
  readonly name: string;
  readonly shortCode: string;
  readonly signageColor: string;
  /** 0-based slice index of the floor this khoa sits on (3-9) */
  readonly floorIndex: number;
  /** Human-readable floor (floorIndex + 1, i.e. tầng 4-10) */
  readonly displayFloor: number;
  readonly roomLabels: readonly string[];
  readonly triageKeywords: readonly string[];
}

/** Triage result: a ground-floor DepartmentSpec or an upper-floor snapshot */
export type TriageResult = DepartmentSpec | UpperFloorDepartment;

function toUpperFloorDepartment(
  khoa: KhoaSliceDepartment,
  floorIndex: number
): UpperFloorDepartment {
  return {
    code: khoa.code,
    name: khoa.name,
    shortCode: khoa.shortCode,
    signageColor: khoa.signageColor,
    floorIndex,
    displayFloor: floorIndex + 1,
    roomLabels: khoa.rooms.map((room) => room.label),
    triageKeywords: khoa.triageKeywords,
  };
}

/**
 * Triage across all floors: spec 03 keyword scoring (lowercase substring
 * count) over the ground floor first, then upper plans by floorIndex 3-9.
 * Strict `>` keeps the earlier candidate, so a keyword claimed by both a
 * ground khoa and an upper khoa keeps routing to tầng 1 and an upper khoa
 * wins only when it scores strictly higher (e.g. "siêu âm tim" beats the
 * ground imaging khoa) or nothing on the ground floor matched.
 */
export function triageDepartmentAcrossFloors(symptoms: string): TriageResult | undefined {
  const lower = symptoms.toLowerCase();
  let best: { result: TriageResult; score: number } | null = null;

  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    let score = 0;
    for (const kw of dept.triageKeywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > (best?.score ?? 0)) best = { result: dept, score };
  }

  for (const floorIndex of UPPER_FLOOR_INDEXES) {
    for (const khoa of KHOA_UPPER_FLOOR_PLANS[floorIndex] ?? []) {
      let score = 0;
      for (const kw of khoa.triageKeywords) {
        if (lower.includes(kw.toLowerCase())) score++;
      }
      if (score > (best?.score ?? 0)) {
        best = { result: toUpperFloorDepartment(khoa, floorIndex), score };
      }
    }
  }

  return best?.result;
}
