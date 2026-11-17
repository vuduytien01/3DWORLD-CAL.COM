/**
 * Camera Choreography — 3-minute demo camera timeline over the 8 pipeline steps.
 *
 * Pure data + functions, no three.js import, so vitest runs headless and the
 * renderer can consume the same timeline later. Camera poses derive from
 * STEP_LOCATIONS (position + cameraDollyOffset) to keep step-locations.ts the
 * single source of truth for "where is step X".
 */

import { STEP_LOCATIONS, STEP_LOCATION_BY_ID } from '../step-graph/step-locations';
import { easings, type EasingName } from '../html5-world/motion-tokens';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

// Re-export EasingName from motion-tokens for consistency
export type { EasingName } from '../html5-world/motion-tokens';

export type TransitionName = 'hold' | 'dolly' | 'crane';

export type ShotPhase = 'approach' | 'action' | 'outro';

export interface SegmentSpec {
  id: string;
  stepId: string;
  phase: ShotPhase;
  description: string;
  durationS: number;
  easing: EasingName;
  transition: TransitionName;
  fromPoseOverride?: CameraPose;
  toPoseOverride?: CameraPose;
}

export interface ChoreographySegment {
  id: string;
  stepId: string;
  phase: ShotPhase;
  description: string;
  startS: number;
  endS: number;
  durationS: number;
  easing: EasingName;
  transition: TransitionName;
  from: CameraPose;
  to: CameraPose;
}

export interface SampledPose {
  segmentId: string;
  stepId: string;
  position: Vec3;
  target: Vec3;
}

export interface DeadGapViolation {
  afterSegmentId: string;
  gapS: number;
}

export interface ChoreographySummary {
  segmentCount: number;
  totalDurationS: number;
  stepSequence: readonly string[];
  maxDeadGapS: number;
  deadGapViolations: readonly DeadGapViolation[];
}

/** Demo wall clock: 3 minutes exactly. */
export const DEMO_DURATION_S = 180;

/** Any uncovered timeline stretch longer than this is a dead gap. */
export const MAX_DEAD_GAP_S = 1;

// Easing functions imported from motion-tokens (single source of truth)
const EASINGS = easings;

const INTRO_AERIAL_POSE: CameraPose = {
  position: { x: 0, y: 24, z: -6 },
  target: { x: 0, y: 1.5, z: 6 },
};

const OUTRO_AERIAL_POSE: CameraPose = {
  position: { x: 0, y: 30, z: 18 },
  target: { x: 0, y: 0, z: 15.5 },
};

/**
 * One entry per camera beat. Approaches inherit the previous segment's end pose
 * so the whole 180s reads as one continuous dolly with no jump cuts. Durations
 * must sum to DEMO_DURATION_S — enforced by validateSegmentSpecs and the tests.
 */
export const SEGMENT_SPECS: readonly SegmentSpec[] = [
  {
    id: 'intro-aerial-to-ticket',
    stepId: 'step-ticket',
    phase: 'approach',
    description: 'Aerial dollhouse drops down to the ticket counter, establishing the corridor.',
    durationS: 10,
    easing: 'easeInOutSine',
    transition: 'crane',
    fromPoseOverride: INTRO_AERIAL_POSE,
  },
  {
    id: 'ticket-action',
    stepId: 'step-ticket',
    phase: 'action',
    description: 'Close-up on the patient taking a queue ticket at the reception counter.',
    durationS: 14,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'ticket-to-queue',
    stepId: 'step-queue',
    phase: 'approach',
    description: 'Dolly along the waiting chairs to the queue display.',
    durationS: 6,
    easing: 'easeInOutCubic',
    transition: 'dolly',
  },
  {
    id: 'queue-action',
    stepId: 'step-queue',
    phase: 'action',
    description: 'Hold on the waiting area while the queue number is called.',
    durationS: 14,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'queue-to-consultation',
    stepId: 'step-consultation',
    phase: 'approach',
    description: 'Dolly to exam room 01 as the patient walks in.',
    durationS: 6,
    easing: 'easeInOutCubic',
    transition: 'dolly',
  },
  {
    id: 'consultation-action',
    stepId: 'step-consultation',
    phase: 'action',
    description: 'Doctor consults the patient in exam room 01.',
    durationS: 14,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'consultation-to-lab',
    stepId: 'step-lab',
    phase: 'approach',
    description: 'Dolly down the corridor to the lab room.',
    durationS: 6,
    easing: 'easeInOutCubic',
    transition: 'dolly',
  },
  {
    id: 'lab-action',
    stepId: 'step-lab',
    phase: 'action',
    description: 'Nurse draws the blood sample in the lab.',
    durationS: 14,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'lab-to-re-consult',
    stepId: 'step-re-consult',
    phase: 'approach',
    description: 'Dolly to exam room 02 with results in hand.',
    durationS: 6,
    easing: 'easeInOutCubic',
    transition: 'dolly',
  },
  {
    id: 're-consult-action',
    stepId: 'step-re-consult',
    phase: 'action',
    description: 'Doctor reviews lab results in exam room 02.',
    durationS: 12,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 're-consult-to-conclusion',
    stepId: 'step-conclusion',
    phase: 'approach',
    description: 'Dolly across to the conclusion desk on the right side.',
    durationS: 6,
    easing: 'easeInOutCubic',
    transition: 'dolly',
  },
  {
    id: 'conclusion-action',
    stepId: 'step-conclusion',
    phase: 'action',
    description: 'Doctor hands over the conclusion and paperwork.',
    durationS: 12,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'conclusion-to-admission',
    stepId: 'step-admission',
    phase: 'approach',
    description: 'Crane up to the admission ward bed.',
    durationS: 8,
    easing: 'easeInOutSine',
    transition: 'crane',
  },
  {
    id: 'admission-action',
    stepId: 'step-admission',
    phase: 'action',
    description: 'Nurse settles the patient into the ward bed.',
    durationS: 12,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'admission-to-payment',
    stepId: 'step-payment',
    phase: 'approach',
    description: 'Dolly back along the corridor to the payment counter.',
    durationS: 8,
    easing: 'easeInOutCubic',
    transition: 'dolly',
  },
  {
    id: 'payment-action',
    stepId: 'step-payment',
    phase: 'action',
    description: 'Patient pays at the counter and receives the receipt.',
    durationS: 12,
    easing: 'linear',
    transition: 'hold',
  },
  {
    id: 'outro-aerial',
    stepId: 'step-payment',
    phase: 'outro',
    description: 'Pull back to the full aerial view of the corridor to close the demo.',
    durationS: 20,
    easing: 'easeInOutSine',
    transition: 'crane',
    toPoseOverride: OUTRO_AERIAL_POSE,
  },
];

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Station camera: dolly offset from the step data, looking at the station itself. */
function stationCameraPose(step: (typeof STEP_LOCATIONS)[number]): CameraPose {
  const offset = step.cameraDollyOffset ?? { x: 2, y: 1.6, z: 3 };
  return {
    position: {
      x: step.position.x + offset.x,
      y: step.position.y + offset.y,
      z: step.position.z + offset.z,
    },
    target: { x: step.position.x, y: step.position.y, z: step.position.z },
  };
}

export function validateSegmentSpecs(specs: readonly SegmentSpec[] = SEGMENT_SPECS): readonly string[] {
  const errors: string[] = [];
  let total = 0;
  for (const spec of specs) {
    if (!STEP_LOCATION_BY_ID.has(spec.stepId)) {
      errors.push(`${spec.id}: unknown stepId "${spec.stepId}"`);
    }
    if (!(spec.durationS > 0)) {
      errors.push(`${spec.id}: durationS must be positive, got ${spec.durationS}`);
    }
    if (!(spec.easing in EASINGS)) {
      errors.push(`${spec.id}: unknown easing "${spec.easing}"`);
    }
    total += spec.durationS;
  }
  if (total !== DEMO_DURATION_S) {
    errors.push(`durations sum to ${total}s, expected ${DEMO_DURATION_S}s`);
  }
  return errors;
}

export function buildChoreography(): readonly ChoreographySegment[] {
  const errors = validateSegmentSpecs();
  if (errors.length > 0) {
    throw new Error(`Invalid camera choreography specs: ${errors.join('; ')}`);
  }

  const segments: ChoreographySegment[] = [];
  let cursorS = 0;
  let previousPose: CameraPose | null = null;

  for (const spec of SEGMENT_SPECS) {
    const step = STEP_LOCATION_BY_ID.get(spec.stepId);
    if (!step) {
      throw new Error(`Unknown stepId "${spec.stepId}" in segment ${spec.id}`);
    }
    const stationPose = stationCameraPose(step);
    const from = spec.fromPoseOverride ?? previousPose ?? stationPose;
    const to = spec.toPoseOverride ?? stationPose;

    segments.push({
      id: spec.id,
      stepId: spec.stepId,
      phase: spec.phase,
      description: spec.description,
      startS: cursorS,
      endS: cursorS + spec.durationS,
      durationS: spec.durationS,
      easing: spec.easing,
      transition: spec.transition,
      from,
      to,
    });
    cursorS += spec.durationS;
    previousPose = to;
  }

  return segments;
}

export function getChoreographySummary(segments: readonly ChoreographySegment[]): ChoreographySummary {
  const stepSequence: string[] = [];
  for (const segment of segments) {
    if (stepSequence[stepSequence.length - 1] !== segment.stepId) {
      stepSequence.push(segment.stepId);
    }
  }

  let maxDeadGapS = 0;
  const deadGapViolations: DeadGapViolation[] = [];
  for (let i = 1; i < segments.length; i++) {
    const gapS = segments[i].startS - segments[i - 1].endS;
    maxDeadGapS = Math.max(maxDeadGapS, gapS);
    if (gapS > MAX_DEAD_GAP_S) {
      deadGapViolations.push({ afterSegmentId: segments[i - 1].id, gapS });
    }
  }

  return {
    segmentCount: segments.length,
    totalDurationS: segments[segments.length - 1]?.endS ?? 0,
    stepSequence,
    maxDeadGapS,
    deadGapViolations,
  };
}

/** Headless frame sampler: renderer feeds t (seconds) and moves its camera accordingly. */
export function samplePoseAt(
  segments: readonly ChoreographySegment[],
  timeS: number
): SampledPose | null {
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment || timeS < 0 || timeS > lastSegment.endS) {
    return null;
  }

  let segment = segments.find((s) => timeS >= s.startS && timeS <= s.endS);
  if (!segment) {
    segment = lastSegment;
  }

  const rawProgress = segment.durationS === 0 ? 1 : (timeS - segment.startS) / segment.durationS;
  const eased = segment.transition === 'hold' ? 0 : EASINGS[segment.easing](clamp01(rawProgress));

  return {
    segmentId: segment.id,
    stepId: segment.stepId,
    position: lerpVec3(segment.from.position, segment.to.position, eased),
    target: lerpVec3(segment.from.target, segment.to.target, eased),
  };
}

export function applyEasing(name: EasingName, t: number): number {
  return EASINGS[name](clamp01(t));
}
