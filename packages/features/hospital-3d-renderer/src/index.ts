/**
 * @calcom/features/hospital-3d-renderer
 *
 * Three.js / React Three Fiber renderer for the hospital demo.
 * Uses the 3D world data layer from @calcom/features/hospital-pipeline.
 *
 * Performance targets for Intel Iris Xe:
 * - <300 draw calls
 * - ~18k triangles
 * - 60fps @ 1080p
 */

export { Hospital3DScene } from "./components/Hospital3DScene";
export { useHospitalWorld } from "./hooks/useHospitalWorld";
export { useCameraController } from "./hooks/useCameraController";
export { usePerformanceMonitor } from "./hooks/usePerformanceMonitor";

// Re-export types from hospital-pipeline
export type {
  KhoaFloorSlice,
  KhoaSliceDepartment,
  KhoaRoomSpec,
  SlicePrimitive,
  SliceFurniture,
  SliceSign,
  StairwellSpec,
  ElevatorSpec,
  MINT_ORDER_SLICE_PALETTE,
  SLICE_LAYOUT,
  SLICE_DEFAULT_FLOORS,
} from "@calcom/features/hospital-pipeline/lib/3d-world";

export { 
  buildInstancedFurniture, 
  buildAllInstancedFurniture,
  getFurnitureMaterial 
} from "./utils/instancedFurniture";
export { getKTX2Loader, loadKTX2Texture, preloadKTX2Textures, getSupportedCompressedFormat, disposeKTX2Loader } from "./utils/ktx2Loader";
export { getTimer, startPerformanceTracking, getPerformanceMetrics, checkPerformanceTargets, formatBytes } from "./utils/performance";
export { createMergedFloorSlab, createMergedWalls, createCorridorFloor, createStairwellGeometry, createElevatorShaftGeometry } from "./utils/mergedGeometry";