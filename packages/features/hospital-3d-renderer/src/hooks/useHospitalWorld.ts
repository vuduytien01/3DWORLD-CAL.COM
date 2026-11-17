"use client";

import { useMemo } from "react";
import {
  buildKhoaFloorSlice,
  buildKhoaSlices,
  SLICE_LAYOUT,
  SLICE_DEFAULT_FLOORS,
  type KhoaFloorSlice,
  type KhoaFloorSlice as KhoaFloorSliceType,
} from "@calcom/features/hospital-pipeline/lib/3d-world";

/**
 * Loads and memoizes the 3D hospital world slices.
 * Pure data - no renderer dependencies.
 */
export function useHospitalWorld() {
  const slices = useMemo(() => {
    // Build slices for default floors (1, 2 = indices 1, 2 = 2nd and 3rd floor)
    const result = buildKhoaSlices(SLICE_DEFAULT_FLOORS);
    return result;
  }, []);

  const floorHeight = SLICE_LAYOUT.floorHeight;
  const layout = SLICE_LAYOUT;

  return { slices, floorHeight, layout };
}

/**
 * Get a single floor slice by index
 */
export function useFloorSlice(floorIndex: number) {
  const { slices } = useHospitalWorld();
  return useMemo(() => slices.find((s) => s.floorIndex === floorIndex) ?? null, [slices, floorIndex]);
}

/**
 * Get all departments across all loaded floors
 */
export function useAllDepartments() {
  const { slices } = useHospitalWorld();
  return useMemo(() => {
    const departments = new Map<string, { code: string; name: string; floors: number[] }>();
    for (const slice of slices) {
      for (const dept of slice.departments) {
        const existing = departments.get(dept.code);
        if (existing) {
          existing.floors.push(slice.displayFloor);
        } else {
          departments.set(dept.code, {
            code: dept.code,
            name: dept.name,
            floors: [slice.displayFloor],
          });
        }
      }
    }
    return Array.from(departments.values());
  }, [slices]);
}