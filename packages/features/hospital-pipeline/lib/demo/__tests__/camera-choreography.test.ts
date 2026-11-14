/**
 * Camera Choreography Tests
 */

import { describe, it, expect } from 'vitest';
import { STEP_IDS_IN_ORDER, STEP_LOCATION_BY_ID } from '../../step-graph/step-locations';
import {
  DEMO_DURATION_S,
  MAX_DEAD_GAP_S,
  SEGMENT_SPECS,
  applyEasing,
  buildChoreography,
  getChoreographySummary,
  samplePoseAt,
  validateSegmentSpecs,
  type ChoreographySegment,
} from '../camera-choreography';

const SEGMENTS = buildChoreography();

function poseEquals(actual: ChoreographySegment['from'], expected: ChoreographySegment['from']): boolean {
  return (
    actual.position.x === expected.position.x &&
    actual.position.y === expected.position.y &&
    actual.position.z === expected.position.z &&
    actual.target.x === expected.target.x &&
    actual.target.y === expected.target.y &&
    actual.target.z === expected.target.z
  );
}

describe('Camera Choreography — total duration', () => {
  it('demands a 180s demo clock', () => {
    expect(DEMO_DURATION_S).toBe(180);
  });

  it('segment durations sum to exactly 180s', () => {
    const sum = SEGMENTS.reduce((acc, s) => acc + s.durationS, 0);
    expect(sum).toBe(180);
  });

  it('last segment ends exactly at 180s', () => {
    const last = SEGMENTS[SEGMENTS.length - 1];
    expect(last.endS).toBe(180);
  });

  it('validateSegmentSpecs reports no errors for the shipped specs', () => {
    expect(validateSegmentSpecs()).toEqual([]);
  });

  it('validateSegmentSpecs flags a timeline that drifts off 180s', () => {
    const drift = validateSegmentSpecs([
      { id: 'x', stepId: 'step-ticket', phase: 'action', description: 'd', durationS: 10, easing: 'linear', transition: 'hold' },
    ]);
    expect(drift).toEqual(['durations sum to 10s, expected 180s']);
  });
});

describe('Camera Choreography — step order', () => {
  it('covers the 8 pipeline steps in spec order, each used at least once', () => {
    const unique = [...new Set(SEGMENTS.map((s) => s.stepId))];
    expect(unique).toEqual(STEP_IDS_IN_ORDER);
  });

  it('matches the 8 step ids from spec 03-location-data-structure', () => {
    expect(STEP_IDS_IN_ORDER).toEqual([
      'step-ticket',
      'step-queue',
      'step-consultation',
      'step-lab',
      'step-re-consult',
      'step-conclusion',
      'step-admission',
      'step-payment',
    ]);
  });

  it('never revisits an earlier step after moving on (no backtracking)', () => {
    const firstIndex = new Map<string, number>();
    SEGMENTS.forEach((s, i) => {
      const known = firstIndex.get(s.stepId);
      if (known === undefined) {
        firstIndex.set(s.stepId, i);
      } else {
        expect(i).toBeGreaterThan(known);
      }
    });
  });

  it('starts on step-ticket and closes on step-payment', () => {
    expect(SEGMENTS[0].stepId).toBe('step-ticket');
    expect(SEGMENTS[SEGMENTS.length - 1].stepId).toBe('step-payment');
  });
});

describe('Camera Choreography — no dead gaps', () => {
  it('keeps every consecutive gap at or below the dead-gap budget', () => {
    for (let i = 1; i < SEGMENTS.length; i++) {
      const gap = SEGMENTS[i].startS - SEGMENTS[i - 1].endS;
      expect(gap).toBeLessThanOrEqual(MAX_DEAD_GAP_S);
    }
  });

  it('is fully contiguous: every segment starts where the previous ended', () => {
    expect(SEGMENTS[0].startS).toBe(0);
    for (let i = 1; i < SEGMENTS.length; i++) {
      expect(SEGMENTS[i].startS).toBe(SEGMENTS[i - 1].endS);
    }
  });

  it('summary reports zero violations and a max dead gap of 0s', () => {
    const summary = getChoreographySummary(SEGMENTS);
    expect(summary.deadGapViolations).toEqual([]);
    expect(summary.maxDeadGapS).toBe(0);
  });

  it('summary flags a timeline with a real dead gap', () => {
    const withHole: ChoreographySegment[] = [
      { id: 'a', stepId: 'step-ticket', phase: 'action', description: 'd', startS: 0, endS: 10, durationS: 10, easing: 'linear', transition: 'hold', from: SEGMENTS[0].from, to: SEGMENTS[0].to },
      { id: 'b', stepId: 'step-queue', phase: 'action', description: 'd', startS: 30, endS: 40, durationS: 10, easing: 'linear', transition: 'hold', from: SEGMENTS[0].from, to: SEGMENTS[0].to },
    ];
    const summary = getChoreographySummary(withHole);
    expect(summary.deadGapViolations).toEqual([{ afterSegmentId: 'a', gapS: 20 }]);
    expect(summary.maxDeadGapS).toBe(20);
  });
});

describe('Camera Choreography — segment data integrity', () => {
  it('every segment has positive duration', () => {
    for (const segment of SEGMENTS) {
      expect(segment.durationS).toBeGreaterThan(0);
      expect(segment.endS - segment.startS).toBe(segment.durationS);
    }
  });

  it('every segment has finite camera poses', () => {
    for (const segment of SEGMENTS) {
      for (const pose of [segment.from, segment.to]) {
        for (const v of [pose.position, pose.target]) {
          expect(Number.isFinite(v.x)).toBe(true);
          expect(Number.isFinite(v.y)).toBe(true);
          expect(Number.isFinite(v.z)).toBe(true);
        }
      }
    }
  });

  it('every segment uses a known easing and transition', () => {
    const easings = new Set(['linear', 'easeInOutCubic', 'easeOutQuart', 'easeInOutSine']);
    const transitions = new Set(['hold', 'dolly', 'crane']);
    for (const segment of SEGMENTS) {
      expect(easings.has(segment.easing)).toBe(true);
      expect(transitions.has(segment.transition)).toBe(true);
    }
  });

  it('action shots hold a static camera on the station pose derived from step data', () => {
    for (const segment of SEGMENTS) {
      if (segment.phase !== 'action') continue;
      const step = STEP_LOCATION_BY_ID.get(segment.stepId);
      expect(step).toBeDefined();
      const offset = step!.cameraDollyOffset ?? { x: 2, y: 1.6, z: 3 };
      const expected: ChoreographySegment['from'] = {
        position: {
          x: step!.position.x + offset.x,
          y: step!.position.y + offset.y,
          z: step!.position.z + offset.z,
        },
        target: { x: step!.position.x, y: step!.position.y, z: step!.position.z },
      };
      expect(poseEquals(segment.from, expected)).toBe(true);
      expect(poseEquals(segment.to, expected)).toBe(true);
    }
  });

  it('approach shots end on the station pose so the action shot starts exactly there', () => {
    for (let i = 0; i < SEGMENTS.length; i++) {
      const approach = SEGMENTS[i];
      if (approach.phase !== 'approach') continue;
      const action = SEGMENTS[i + 1];
      expect(action.phase).toBe('action');
      expect(poseEquals(approach.to, action.from)).toBe(true);
    }
  });

  it('all 8 steps appear in the shipped spec data', () => {
    const covered = new Set(SEGMENT_SPECS.map((s) => s.stepId));
    expect(covered.size).toBe(8);
  });
});

describe('Camera Choreography — easing + sampler', () => {
  it('easings map 0 to 0 and 1 to 1 and are monotonic', () => {
    const names = ['linear', 'easeInOutCubic', 'easeOutQuart', 'easeInOutSine'] as const;
    for (const name of names) {
      expect(applyEasing(name, 0)).toBe(0);
      expect(applyEasing(name, 1)).toBe(1);
      let prev = 0;
      for (let step = 1; step <= 100; step++) {
        const v = applyEasing(name, step / 100);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('samples the first pose at t=0', () => {
    const pose = samplePoseAt(SEGMENTS, 0);
    expect(pose?.segmentId).toBe(SEGMENTS[0].id);
    expect(pose?.position).toEqual(SEGMENTS[0].from.position);
    expect(pose?.target).toEqual(SEGMENTS[0].from.target);
  });

  it('samples the last pose at t=180', () => {
    const last = SEGMENTS[SEGMENTS.length - 1];
    const pose = samplePoseAt(SEGMENTS, 180);
    expect(pose?.segmentId).toBe(last.id);
    expect(pose?.position).toEqual(last.to.position);
    expect(pose?.target).toEqual(last.to.target);
  });

  it('midway through a dolly segment lands between its endpoints on every axis', () => {
    const dolly = SEGMENTS.find((s) => s.transition === 'dolly')!;
    const midway = samplePoseAt(SEGMENTS, dolly.startS + dolly.durationS / 2)!;
    expect(midway.segmentId).toBe(dolly.id);
    expect(midway.position.x).toBeGreaterThanOrEqual(Math.min(dolly.from.position.x, dolly.to.position.x));
    expect(midway.position.x).toBeLessThanOrEqual(Math.max(dolly.from.position.x, dolly.to.position.x));
    expect(midway.position.y).toBeGreaterThanOrEqual(Math.min(dolly.from.position.y, dolly.to.position.y));
    expect(midway.position.y).toBeLessThanOrEqual(Math.max(dolly.from.position.y, dolly.to.position.y));
    expect(midway.position.z).toBeGreaterThanOrEqual(Math.min(dolly.from.position.z, dolly.to.position.z));
    expect(midway.position.z).toBeLessThanOrEqual(Math.max(dolly.from.position.z, dolly.to.position.z));
  });

  it('holds the from pose through a hold segment', () => {
    const hold = SEGMENTS.find((s) => s.transition === 'hold')!;
    const pose = samplePoseAt(SEGMENTS, hold.startS + hold.durationS / 2)!;
    expect(pose.position).toEqual(hold.from.position);
  });

  it('returns null outside the 0..180s window', () => {
    expect(samplePoseAt(SEGMENTS, -0.1)).toBeNull();
    expect(samplePoseAt(SEGMENTS, 180.1)).toBeNull();
  });
});
