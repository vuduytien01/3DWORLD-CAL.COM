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
  type ElevatorSpec,
  estimateKhoaSliceTris,
  getKhoaSliceDepartment,
  type KhoaFloorSlice,
  type KhoaRoomKind,
  type KhoaRoomSpec,
  type KhoaSliceDepartment,
  MINT_ORDER_COLORS,
  MINT_ORDER_SLICE_PALETTE,
  SLICE_DEFAULT_FLOORS,
  SLICE_DEPARTMENT_TEMPLATE,
  SLICE_FURNITURE_PRESET_BY_KIND,
  SLICE_LAYOUT,
  SLICE_SHARED_ROOMS_TEMPLATE,
  type SliceBuildOptions,
  type SliceFurniture,
  type SlicePrimitive,
  type SliceSign,
  type SliceTrisEstimate,
  type SliceTrisInput,
  type StairwellSpec,
  validateKhoaFloorSlice,
} from "./khoa-slice";
// Character pose math (renderer-free; rigs are built per renderer)
export {
  CHARACTER_NODE_NAMES,
  type CharacterPoseState,
  computeIdlePose,
  computeWalkPose,
  type PoseRig,
  type PoseRigNode,
  resetCharacterRig,
} from "./character-poses";
// World specification and data structures
export {
  type AtmosphereSpec,
  type AtmosphereSpec as AtmosphereSpecType,
  CameraKeyframe,
  type CameraKeyframe as CameraKeyframeType,
  DepartmentSpec,
  type DepartmentSpec as DepartmentSpecType,
  FurnitureKind,
  type FurnitureKind as FurnitureKindType,
  generateKhoaFromSpec,
  generateSignHostsFromSpec,
  getDepartment,
  HOSPITAL_WORLD_SPEC,
  KHOA,
  KHOA_BY_CODE,
  KhoaSpec,
  type KhoaSpec as KhoaSpecType,
  LandmarkSpec,
  type LandmarkSpec as LandmarkSpecType,
  PaletteSpec,
  PlacementConstraint,
  RegionSpec,
  type RegionSpec as RegionSpecType,
  RoomInstanceSpec,
  type RoomInstanceSpec as RoomInstanceSpecType,
  RoomSpec,
  type RoomSpec as RoomSpecType,
  RoomType,
  type RoomType as RoomTypeType,
  ScatterRecipe,
  SIGN_HOSTS,
  SIGN_HOSTS_BY_ID,
  SignHost,
  type SignHost as SignHostType,
  triageDepartment,
  WorldSpec,
  type WorldSpec as WorldSpecType,
} from "./world-spec";
