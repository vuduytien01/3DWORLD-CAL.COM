/**
 * Step Locations Tests
 */

import { describe, it, expect } from 'vitest';
import {
  STEP_LOCATIONS,
  STEP_LOCATION_BY_ID,
  STEP_IDS_IN_ORDER,
  getStepLocation,
  type StepLocation,
} from '../step-locations';

describe('Step Locations', () => {
  it('has 8 pipeline steps', () => {
    expect(STEP_LOCATIONS.length).toBe(8);
  });

  it('step IDs are unique', () => {
    const ids = STEP_LOCATIONS.map((s) => s.stepId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Z positions are strictly increasing', () => {
    for (let i = 1; i < STEP_LOCATIONS.length; i++) {
      expect(STEP_LOCATIONS[i].position.z).toBeGreaterThan(STEP_LOCATIONS[i - 1].position.z);
    }
  });

  it('all steps have required fields', () => {
    for (const step of STEP_LOCATIONS) {
      expect(step.stepId).toBeTruthy();
      expect(step.label).toBeTruthy();
      expect(step.labelEn).toBeTruthy();
      expect(step.position.x).toBeDefined();
      expect(step.position.z).toBeDefined();
      expect(step.interactionRadius).toBeGreaterThan(0);
      expect(step.aiGuideMessage).toBeTruthy();
    }
  });

  it('STEP_LOCATION_BY_ID map has all entries', () => {
    expect(STEP_LOCATION_BY_ID.size).toBe(STEP_LOCATIONS.length);
    for (const step of STEP_LOCATIONS) {
      const found = STEP_LOCATION_BY_ID.get(step.stepId);
      expect(found).toBe(step);
    }
  });

  it('STEP_IDS_IN_ORDER matches pipeline sequence', () => {
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

  it('getStepLocation returns correct step', () => {
    const step = getStepLocation('step-ticket');
    expect(step).toBeDefined();
    expect(step?.label).toBe('LẤY VÉ');
  });

  it('getStepLocation returns undefined for unknown ID', () => {
    expect(getStepLocation('unknown')).toBeUndefined();
  });

  it('interaction radii do not excessively overlap', () => {
    for (let i = 0; i < STEP_LOCATIONS.length - 1; i++) {
      const a = STEP_LOCATIONS[i];
      const b = STEP_LOCATIONS[i + 1];
      const dist = Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z);
      expect(dist).toBeGreaterThanOrEqual(a.interactionRadius + b.interactionRadius - 0.5);
    }
  });

  it('all camera dolly offsets are valid if present', () => {
    for (const step of STEP_LOCATIONS) {
      if (step.cameraDollyOffset) {
        expect(typeof step.cameraDollyOffset.x).toBe('number');
        expect(typeof step.cameraDollyOffset.y).toBe('number');
        expect(typeof step.cameraDollyOffset.z).toBe('number');
      }
    }
  });

  it('step-kind enum covers all steps', () => {
    const stepKinds: StepLocation['stepId'][] = [
      'step-ticket',
      'step-queue',
      'step-consultation',
      'step-lab',
      'step-re-consult',
      'step-conclusion',
      'step-admission',
      'step-payment',
    ];
    for (const id of stepKinds) {
      const step = STEP_LOCATIONS.find((s) => s.stepId === id);
      expect(step).toBeDefined();
    }
  });
});