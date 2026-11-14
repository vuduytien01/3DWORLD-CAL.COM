/**
 * AI Guide Service — Public API
 *
 * Single entry point for all Guide Service functionality.
 * Frontend imports from here. Backend imports from here.
 */

// Session management
export {
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
} from './session';

// Templates
export {
  templates,
  matchTemplate,
  getTemplate,
  hasTemplate,
  TEMPLATE_IDS,
  type TemplateResult,
  type TemplateFn,
} from './templates';

// LLM Router
export {
  callLLM,
  checkFreeLLMHealth,
  getFreeLLMInfo,
  type LLMResponse,
} from './llm-router';

// Main Handler
export {
  handleMessage,
  pushWaitUpdate,
  getSessionInfo,
  getAllSessionsSummary,
} from './handler';

// Location Integration (backend hooks)
export {
  onStepChange,
  onSymptomsDescribed,
  onWaitEstimateUpdate,
  onPipelineComplete,
  getCurrentStepLocation,
  getTriagedDepartment,
  updatePatientSTT,
  updatePatientName,
} from './location-integration';

// Triage (boundary over step-graph keyword scoring + upper-floor plans)
export {
  triageDepartment,
  triageDepartmentAcrossFloors,
  type TriageResult,
  type UpperFloorDepartment,
} from './triage';

// WebSocket protocol (dependency-inverted transport)
export {
  attachGuideService,
  createConnectionHandler,
  type GuideClientMessage,
  type GuideConnectionHandle,
  type GuideServerMessage,
  type GuideServiceHandle,
  type GuideSocketLike,
  type GuideSocketServerLike,
  type GuideTransportOptions,
} from './server';

// Re-export location data types for convenience
export {
  type StepLocation,
  type StepKind,
  STEP_LOCATIONS,
  STEP_LOCATION_BY_ID,
  STEP_IDS_IN_ORDER,
  getStepLocation,
} from '../step-graph/step-locations';

export {
  type RoomSpec,
  type DepartmentSpec,
  type RoomKind,
  GROUND_FLOOR_DEPARTMENTS,
  ALL_FLOOR_DEPARTMENTS,
  getDepartment,
  getDepartmentsOnFloor,
  getSpecialtyDepartments,
  ROOM_KIND_FURNITURE,
  getDepartmentWorldOrigin,
} from '../step-graph/department-locations';

export {
  type SignHost,
  SIGN_HOSTS,
  generateSignHosts,
  getSignHostsForTarget,
  STEP_CHIP_HOSTS,
  DEPT_HANGING_HOSTS,
  ROOM_WALL_HOSTS,
  DIRECTION_ARROW_HOSTS,
} from '../step-graph/sign-hosts';

/** Guide Service version */
export const GUIDE_SERVICE_VERSION = '1.0.0';

/** Default WebSocket port */
export const DEFAULT_WS_PORT = 3002;

/** Health check endpoint */
export async function healthCheck(): Promise<{
  status: 'ok' | 'degraded';
  version: string;
  sessions: number;
  freellm: { url: string; stubMode: boolean; healthy: boolean };
}> {
  const { checkFreeLLMHealth, getFreeLLMInfo } = await import('./llm-router');
  const { getSessionCount } = await import('./session');

  const freellmInfo = getFreeLLMInfo();
  const freellmHealthy = await checkFreeLLMHealth();

  return {
    status: freellmHealthy ? 'ok' : 'degraded',
    version: GUIDE_SERVICE_VERSION,
    sessions: getSessionCount(),
    freellm: {
      url: freellmInfo.url,
      stubMode: freellmInfo.stubMode,
      healthy: freellmHealthy,
    },
  };
}