/**
 * Hospital World — Data Layer Entry Point
 *
 * Exports the renderer-free modules of the hospital world: KHOA slice
 * layout data, the world specification and character pose math.
 * Rendering itself lives in lib/html5-world.
 */

// KHOA floor slices (Lượt 7): dollhouse department slices for floors 2-3
export {
  buildKhoaFloorSlice,
  buildKhoaSlices,
  estimateKhoaSliceTris,
  getKhoaSliceDepartment,
  MINT_ORDER_COLORS,
  MINT_ORDER_SLICE_PALETTE,
  SLICE_DEFAULT_FLOORS,
  SLICE_DEPARTMENT_TEMPLATE,
  SLICE_FURNITURE_PRESET_BY_KIND,
  SLICE_LAYOUT,
  SLICE_SHARED_ROOMS_TEMPLATE,
  validateKhoaFloorSlice,
} from "./khoa-slice";
export type {
  ElevatorSpec,
  KhoaFloorSlice,
  KhoaRoomKind,
  KhoaRoomSpec,
  KhoaSliceDepartment,
  SliceBuildOptions,
  SliceFurniture,
  SlicePrimitive,
  SliceSign,
  SliceTrisEstimate,
  SliceTrisInput,
  StairwellSpec,
} from "./khoa-slice";
// Character pose math (renderer-free; rigs are built per renderer)
export {
  CHARACTER_NODE_NAMES,
  computeIdlePose,
  computeWalkPose,
  resetCharacterRig,
} from "./character-poses";
export type {
  CharacterPoseState,
  PoseRig,
  PoseRigNode,
} from "./character-poses";
// World specification and data structures
export {
  CameraKeyframe,
  DepartmentSpec,
  FurnitureKind,
  generateKhoaFromSpec,
  generateSignHostsFromSpec,
  getDepartment,
  HOSPITAL_WORLD_SPEC,
  KHOA,
  KHOA_BY_CODE,
  LandmarkSpec,
  PaletteSpec,
  PlacementConstraint,
  RegionSpec,
  RoomInstanceSpec,
  RoomSpec,
  RoomType,
  ScatterRecipe,
  SIGN_HOSTS,
  SIGN_HOSTS_BY_ID,
  SignHost,
  triageDepartment,
  WorldSpec,
} from "./world-spec";
export type {
  AtmosphereSpec,
  CameraKeyframe as CameraKeyframeType,
  DepartmentSpec as DepartmentSpecType,
  FurnitureKind as FurnitureKindType,
  KhoaSpec,
  KhoaSpec as KhoaSpecType,
  LandmarkSpec as LandmarkSpecType,
  RegionSpec as RegionSpecType,
  RoomInstanceSpec as RoomInstanceSpecType,
  RoomSpec as RoomSpecType,
  RoomType as RoomTypeType,
  SignHost as SignHostType,
  WorldSpec as WorldSpecType,
} from "./world-spec";
