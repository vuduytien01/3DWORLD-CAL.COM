/**
 * AI Guide Session — Per-patient conversation state
 *
 * Single server handles all concurrent patients. Frontend is thin display only.
 * No LLM calls from browser — all routing happens here.
 */

import type { StepLocation } from '../step-graph/step-locations';
import type { DepartmentSpec } from '../step-graph/department-locations';
import { STEP_LOCATION_BY_ID } from '../step-graph/step-locations';

export interface GuideSession {
  /** Unique session id (UUID) */
  sessionId: string;

  /** Patient display name */
  patientName: string;

  /** Current STT number (queue ticket) */
  stt: string;           // e.g. "014"

  /** Current pipeline step id */
  currentStepId: string; // e.g. "step-queue"

  /** Current step location (from STEP_LOCATIONS) */
  currentStep: StepLocation;

  /** Estimated wait at current step (minutes) */
  waitEstimate: number;

  /** Department patient was triaged to (if any) */
  triagedDepartment?: DepartmentSpec;

  /** Conversation history (last 10 turns for context) */
  history: readonly GuideTurn[];

  /** Session created timestamp */
  createdAt: number;

  /** Last activity timestamp */
  lastActiveAt: number;
}

export interface GuideTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** If assistant: which template was used (for analytics) */
  templateId?: string;
  /** If assistant: whether LLM was called */
  usedLLM: boolean;
}

/** In-memory session store — single process, no Redis needed at this scale */
export const sessions = new Map<string, GuideSession>();

/** Create a new guide session for a patient */
export function createSession(
  sessionId: string,
  patientName: string,
  stt: string,
  initialStepId: string
): GuideSession {
  const step = STEP_LOCATION_BY_ID.get(initialStepId);
  if (!step) throw new Error(`Unknown stepId: ${initialStepId}`);

  const session: GuideSession = {
    sessionId,
    patientName,
    stt,
    currentStepId: initialStepId,
    currentStep: step,
    waitEstimate: 0,
    history: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  sessions.set(sessionId, session);
  return session;
}

/** Get session by ID */
export function getSession(sessionId: string): GuideSession | undefined {
  return sessions.get(sessionId);
}

/** Update session with partial data */
export function updateSession(
  sessionId: string,
  patch: Partial<GuideSession>
): GuideSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  const updated = { ...session, ...patch, lastActiveAt: Date.now() };
  sessions.set(sessionId, updated);
  return updated;
}

/** Add a conversation turn to session history */
export function addTurn(
  sessionId: string,
  turn: GuideTurn
): GuideSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  const history = [...session.history, turn].slice(-10); // keep last 10
  return updateSession(sessionId, { history });
}

/** Delete a session (cleanup) */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/** Get all active sessions (for monitoring) */
export function getAllSessions(): readonly GuideSession[] {
  return Array.from(sessions.values());
}

/** Get session count */
export function getSessionCount(): number {
  return sessions.size;
}

/** Clean up stale sessions (older than maxAgeMs) */
export function cleanupStaleSessions(maxAgeMs: number = 30 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActiveAt > maxAgeMs) {
      sessions.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}