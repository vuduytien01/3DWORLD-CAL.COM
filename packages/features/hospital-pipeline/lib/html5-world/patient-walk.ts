/**
 * Patient walk — maps the demo timeline onto the HTML5 dollhouse (ADR 0003).
 *
 * Two pure queries feed the renderer props from one timeline read:
 * - `patientWalkAt` turns a `DemoStateAt` (demo-timeline stateAt(), read-only)
 *   into the patient's world position: approach segments walk the patient from
 *   the previous pipeline station to the segment's station (STEP_LOCATIONS is
 *   the only source of positions), action/outro segments stand idle at the
 *   station. Walk and idle both come out deterministic in demo seconds, so the
 *   mapping is headless-testable.
 * - `sampleRestackedPoseAt` is the restacked `samplePoseAt`: choreography
 *   heights are LOCAL eye levels (y = 1.5 on every floor), while the stacked
 *   dollhouse lives at y = 3 * floor — the Task 2 restack ruling. Feeding raw
 *   poses into the camera adapter would focus every follow segment on floor 0.
 */

import {
  applyEasing,
  type CameraPose,
  type ChoreographySegment,
  type SampledPose,
  samplePoseAt,
} from "../demo/camera-choreography";
import type { DemoStateAt } from "../demo/demo-timeline";
import { STEP_LOCATION_BY_ID, STEP_LOCATIONS } from "../step-graph/step-locations";
import { FLOOR_HEIGHT_M } from "./world-to-screen";

/** Walk-cycle rate the old three scene used (~1.2 strides per second). */
export const WALK_CYCLE_HZ = 1.2;

export interface PatientWalkState {
  /** Feet position in world meters. */
  x: number;
  z: number;
  /** Restacked world height of the floor plane under the feet. */
  y: number;
  /**
   * Continuous floor elevation in floor units — integer while standing at a
   * station, fractional mid-walk while the patient rides the floor transition.
   */
  floor: number;
  /** Facing yaw in radians (atan2(dx, dz) convention, 0 = +Z corridor axis). */
  headingRad: number;
  /** True on approach segments (walk pose), false on action/outro (idle pose). */
  walking: boolean;
  /** Walk-cycle phase in [0, 1); advances with demo time only while walking. */
  walkPhase: number;
}

const STEP_INDEX_BY_ID: ReadonlyMap<string, number> = new Map(
  STEP_LOCATIONS.map((step, index) => [step.stepId, index])
);

function idleHeadingRad(stepIndex: number): number {
  const previous = STEP_LOCATIONS[stepIndex - 1];
  const step = STEP_LOCATIONS[stepIndex];
  if (!previous || !step) return 0;
  return Math.atan2(step.position.x - previous.position.x, step.position.z - previous.position.z);
}

/**
 * Patient state at one demo timeline read. Returns null when no segment is
 * active (before the intro, after the outro) or the segment references an
 * unknown station — the renderer hides the patient for null.
 */
export function patientWalkAt(state: DemoStateAt): PatientWalkState | null {
  const segment = state.cameraSegment;
  if (!segment) return null;
  const step = STEP_LOCATION_BY_ID.get(segment.stepId);
  const stepIndex = STEP_INDEX_BY_ID.get(segment.stepId);
  if (!step || stepIndex === undefined) return null;

  // Approach segments walk the patient from the previous pipeline station;
  // the intro approach has no origin, so the patient already waits at the
  // ticket counter (same convention as the old scene's isMoving flag).
  const fromStep = stepIndex > 0 ? STEP_LOCATIONS[stepIndex - 1] : undefined;
  if (segment.phase === "approach" && fromStep) {
    const raw = segment.durationS === 0 ? 1 : (state.elapsedDemoSeconds - segment.startS) / segment.durationS;
    const progress = segment.transition === "hold" ? 0 : applyEasing(segment.easing, raw);
    const dx = step.position.x - fromStep.position.x;
    const dz = step.position.z - fromStep.position.z;
    const floor = fromStep.floor + (step.floor - fromStep.floor) * progress;
    return {
      x: fromStep.position.x + dx * progress,
      y: floor * FLOOR_HEIGHT_M,
      z: fromStep.position.z + dz * progress,
      floor,
      headingRad: Math.atan2(dx, dz),
      walking: true,
      walkPhase: (state.elapsedDemoSeconds * WALK_CYCLE_HZ) % 1,
    };
  }

  return {
    x: step.position.x,
    y: step.floor * FLOOR_HEIGHT_M,
    z: step.position.z,
    floor: step.floor,
    headingRad: idleHeadingRad(stepIndex),
    walking: false,
    walkPhase: 0,
  };
}

function restackPose(pose: CameraPose, floor: number): CameraPose {
  return {
    position: { ...pose.position, y: pose.position.y + floor * FLOOR_HEIGHT_M },
    target: { ...pose.target, y: pose.target.y + floor * FLOOR_HEIGHT_M },
  };
}

/**
 * `samplePoseAt` with every height restacked onto the dollhouse. A segment's
 * end pose belongs to its own step's floor; an inherited start pose belongs to
 * the previous segment's step, and an intro start with no predecessor sits on
 * its own step's floor. Same segment matching and null window as
 * `samplePoseAt`, so renderer and demo HUD cannot disagree at boundaries.
 */
export function sampleRestackedPoseAt(
  segments: readonly ChoreographySegment[],
  timeS: number
): SampledPose | null {
  const restacked = segments.map((segment, index) => {
    const stepFloor = STEP_LOCATION_BY_ID.get(segment.stepId)?.floor ?? 0;
    const previous = segments[index - 1];
    const fromFloor = previous ? (STEP_LOCATION_BY_ID.get(previous.stepId)?.floor ?? 0) : stepFloor;
    return {
      ...segment,
      from: restackPose(segment.from, fromFloor),
      to: restackPose(segment.to, stepFloor),
    };
  });
  return samplePoseAt(restacked, timeS);
}
