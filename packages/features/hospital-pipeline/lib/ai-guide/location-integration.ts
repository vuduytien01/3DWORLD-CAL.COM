/**
 * Location Integration — Hooks connecting backend pipeline engine to Guide Service
 *
 * Backend calls these when patient advances in pipeline or describes symptoms.
 * Guide Service pushes updates to frontend via WebSocket.
 */

import { STEP_LOCATION_BY_ID } from '../step-graph/step-locations';
import {
  triageDepartmentAcrossFloors,
  type DepartmentSpec,
  type UpperFloorDepartment,
} from './triage';
import { updateSession, addTurn, getSession } from './session';
import { pushWaitUpdate } from './handler';
import { templates } from './templates';

/** Called when patient's step changes (from backend pipeline engine) */
export function onStepChange(
  sessionId: string,
  newStepId: string,
  newWaitEstimate: number
): void {
  const session = getSession(sessionId);
  if (!session) return;

  const newStep = STEP_LOCATION_BY_ID.get(newStepId);
  if (!newStep) {
    console.warn(`[Location Integration] Unknown stepId: ${newStepId} for session ${sessionId}`);
    return;
  }

  updateSession(sessionId, {
    currentStepId: newStepId,
    currentStep: newStep,
    waitEstimate: newWaitEstimate,
  });

  // Proactive notification to patient
  pushWaitUpdate(sessionId, newWaitEstimate);
}

/** Called when patient describes symptoms (triage) */
export function onSymptomsDescribed(
  sessionId: string,
  symptoms: string
): DepartmentSpec | UpperFloorDepartment | undefined {
  const dept = triageDepartmentAcrossFloors(symptoms);
  if (!dept) {
    console.log(`[Triage] No department matched for symptoms: "${symptoms}"`);
    return undefined;
  }

  const session = getSession(sessionId);
  if (!session) return undefined;

  if ('displayFloor' in dept) {
    // Upper khoa are not in ALL_FLOOR_DEPARTMENTS, so the department-direction
    // template's getDepartment lookup cannot resolve them; compose the reply
    // from the same pure plan data. templateId stays 'department-direction'
    // so analytics still bucket it as a direction message. Drop the stale
    // ground triage — the latest triage wins and session storage is ground-only.
    updateSession(sessionId, { triagedDepartment: undefined });
    const content =
      `${dept.name} (${dept.shortCode}) ở tầng ${dept.displayFloor}. ` +
      `Phòng: ${dept.roomLabels.join(', ')}.`;
    addTurn(sessionId, {
      role: 'assistant',
      content,
      timestamp: Date.now(),
      templateId: 'department-direction',
      usedLLM: false,
    });
    console.log(`[Triage] session=${sessionId} symptoms="${symptoms}" → ${dept.code} (tầng ${dept.displayFloor}, floorIndex ${dept.floorIndex})`);
    return dept;
  }

  updateSession(sessionId, { triagedDepartment: dept });

  // Auto-reply with department direction
  const result = templates['department-direction'](session, {
    deptCode: dept.code,
    floor: String(dept.floor),
  });
  addTurn(sessionId, {
    role: 'assistant',
    content: result.content,
    timestamp: Date.now(),
    templateId: result.templateId,
    usedLLM: false,
  });

  console.log(`[Triage] session=${sessionId} symptoms="${symptoms}" → ${dept.code} (floor ${dept.floor})`);
  return dept;
}

/** Called when wait estimate is updated by queue system */
export async function onWaitEstimateUpdate(
  sessionId: string,
  newEstimate: number
): Promise<void> {
  await pushWaitUpdate(sessionId, newEstimate);
}

/** Called when patient completes payment (end of pipeline) */
export function onPipelineComplete(
  sessionId: string
): void {
  const session = getSession(sessionId);
  if (!session) return;

  // Send completion message
  const result = templates['next-step'](session, {});
  addTurn(sessionId, {
    role: 'assistant',
    content: result.content,
    timestamp: Date.now(),
    templateId: result.templateId,
    usedLLM: false,
  });

  // Mark session as completed (could add a flag to session)
  console.log(`[Pipeline Complete] session=${sessionId}`);
}

/** Get current step location for a session (for 3D scene sync) */
export function getCurrentStepLocation(sessionId: string): {
  stepId: string;
  position: { x: number; z: number };
  label: string;
} | null {
  const session = getSession(sessionId);
  if (!session) return null;

  return {
    stepId: session.currentStepId,
    position: session.currentStep.position,
    label: session.currentStep.label,
  };
}

/** Get triaged department for a session */
export function getTriagedDepartment(sessionId: string): DepartmentSpec | undefined {
  const session = getSession(sessionId);
  return session?.triagedDepartment;
}

/** Update patient's STT number */
export function updatePatientSTT(sessionId: string, newSTT: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;

  updateSession(sessionId, { stt: newSTT });
  return true;
}

/** Update patient name */
export function updatePatientName(sessionId: string, newName: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;

  updateSession(sessionId, { patientName: newName });
  return true;
}