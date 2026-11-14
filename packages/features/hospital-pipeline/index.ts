/**
 * Hospital Pipeline Feature — Public API
 *
 * Main entry point for the hospital 3D pipeline feature.
 * Re-exports all public APIs from step-graph, ai-guide, and 3d-world modules.
 */

// 3D World — Multi-floor hospital simulation
export {
  // World specification
  HOSPITAL_WORLD_SPEC,
  type WorldSpec,
  type RegionSpec,
  type DepartmentSpec as WorldDepartmentSpec,
  type RoomSpec as WorldRoomSpec,
  type SignHost as WorldSignHost,
  type KhoaSpec,
  type RoomInstanceSpec,
  type LandmarkSpec,
  type CameraKeyframe,
  type AtmosphereSpec,
  type PaletteSpec,
  type ScatterRecipe,
  type PlacementConstraint,
  type RoomType as WorldRoomType,
  type FurnitureKind as WorldFurnitureKind,
  KHOA,
  SIGN_HOSTS as WORLD_SIGN_HOSTS,
  KHOA_BY_CODE,
  SIGN_HOSTS_BY_ID,
  generateKhoaFromSpec,
  generateSignHostsFromSpec,
  getDepartment as getWorldDepartment,
  triageDepartment as triageWorldDepartment,
} from './lib/3d-world';

// Step Graph — Location Data Structures
export {
  // Step locations
  type StepLocation,
  type StepKind,
  STEP_LOCATIONS,
  STEP_LOCATION_BY_ID,
  STEP_IDS_IN_ORDER,
  getStepLocation,

  // Department locations
  type RoomSpec,
  type DepartmentSpec,
  type RoomKind,
  GROUND_FLOOR_DEPARTMENTS,
  ALL_FLOOR_DEPARTMENTS,
  getDepartment,
  getDepartmentsOnFloor,
  getSpecialtyDepartments,
  triageDepartment,
  ROOM_KIND_FURNITURE,
  getDepartmentWorldOrigin,

  // Sign hosts
  type SignHost,
  SIGN_HOSTS,
  generateSignHosts,
  getSignHostsForTarget,
  STEP_CHIP_HOSTS,
  DEPT_HANGING_HOSTS,
  ROOM_WALL_HOSTS,
  DIRECTION_ARROW_HOSTS,

  // Validation
  validateStepLocations,
  validateDepartments,
  validateSignHosts,
  validateAll,
} from './lib/step-graph';

// AI Guide Service
export {
  // Session management
  sessions,
  createSession,
  getSession,
  updateSession,
  addTurn,
  deleteSession,
  getAllSessions,
  getSessionCount,
  cleanupStaleSessions,
  type GuideSession,
  type GuideTurn,

  // Templates
  templates,
  matchTemplate,
  getTemplate,
  hasTemplate,
  TEMPLATE_IDS,
  type TemplateResult,
  type TemplateFn,

  // LLM Router
  callLLM,
  checkFreeLLMHealth,
  getFreeLLMInfo,
  type LLMResponse,

  // Main Handler
  handleMessage,
  pushWaitUpdate,
  getSessionInfo,
  getAllSessionsSummary,

  // Location Integration (backend hooks)
  onStepChange,
  onSymptomsDescribed,
  onWaitEstimateUpdate,
  onPipelineComplete,
  getCurrentStepLocation,
  getTriagedDepartment,
  updatePatientSTT,
  updatePatientName,

  // Service metadata
  GUIDE_SERVICE_VERSION,
  DEFAULT_WS_PORT,
  healthCheck,
} from './lib/ai-guide';