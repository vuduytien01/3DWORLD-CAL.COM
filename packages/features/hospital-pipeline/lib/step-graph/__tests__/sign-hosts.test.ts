/**
 * Sign Hosts Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SIGN_HOSTS,
  generateSignHosts,
  getSignHostsForTarget,
  STEP_CHIP_HOSTS,
  DEPT_HANGING_HOSTS,
  ROOM_WALL_HOSTS,
  DIRECTION_ARROW_HOSTS,
  type SignHost,
} from '../sign-hosts';
import { STEP_LOCATIONS } from '../step-locations';
import { GROUND_FLOOR_DEPARTMENTS } from '../department-locations';

describe('Sign Hosts', () => {
  it('generates hosts from steps and departments', () => {
    const hosts = generateSignHosts();
    expect(hosts.length).toBeGreaterThan(0);
  });

  it('SIGN_HOSTS export matches generated', () => {
    const generated = generateSignHosts();
    expect(SIGN_HOSTS.length).toBe(generated.length);
  });

  it('all host IDs are unique', () => {
    const ids = SIGN_HOSTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('step-chip hosts match STEP_LOCATIONS count', () => {
    expect(STEP_CHIP_HOSTS.length).toBe(STEP_LOCATIONS.length);
  });

  it('dept-hanging hosts match GROUND_FLOOR_DEPARTMENTS count', () => {
    expect(DEPT_HANGING_HOSTS.length).toBe(GROUND_FLOOR_DEPARTMENTS.length);
  });

  it('room-wall hosts match rooms with doors', () => {
    let expectedCount = 0;
    for (const dept of GROUND_FLOOR_DEPARTMENTS) {
      for (const room of dept.rooms) {
        if (room.doorWidth > 0) expectedCount++;
      }
    }
    expect(ROOM_WALL_HOSTS.length).toBe(expectedCount);
  });

  it('direction arrow hosts exist', () => {
    expect(DIRECTION_ARROW_HOSTS.length).toBeGreaterThan(0);
  });

  it('all hosts have required transform fields', () => {
    for (const host of SIGN_HOSTS) {
      expect(host.id).toBeTruthy();
      expect(host.transform).toBeDefined();
      expect(host.transform.position).toBeDefined();
      expect(host.transform.rotation).toBeDefined();
      expect(host.transform.scale).toBeDefined();
      expect(typeof host.transform.position.x).toBe('number');
      expect(typeof host.transform.position.y).toBe('number');
      expect(typeof host.transform.position.z).toBe('number');
      expect(typeof host.transform.rotation.x).toBe('number');
      expect(typeof host.transform.rotation.y).toBe('number');
      expect(typeof host.transform.rotation.z).toBe('number');
      expect(typeof host.transform.scale.x).toBe('number');
      expect(typeof host.transform.scale.y).toBe('number');
    }
  });

  it('step-chip hosts reference valid steps', () => {
    for (const host of STEP_CHIP_HOSTS) {
      expect(host.targetType).toBe('step');
      expect(host.variant).toBe('step-chip');
      // Check that stepId exists in STEP_LOCATIONS
      const step = STEP_LOCATIONS.find((s) => s.stepId === host.targetId);
      expect(step).toBeDefined();
    }
  });

  it('dept-hanging hosts reference valid departments', () => {
    for (const host of DEPT_HANGING_HOSTS) {
      expect(host.targetType).toBe('department');
      expect(host.variant).toBe('dept-hanging');
      const dept = GROUND_FLOOR_DEPARTMENTS.find((d) => d.code === host.targetId);
      expect(dept).toBeDefined();
    }
  });

  it('room-wall hosts reference valid rooms', () => {
    for (const host of ROOM_WALL_HOSTS) {
      expect(host.targetType).toBe('department');
      expect(host.variant).toBe('room-wall');
      const [deptCode, roomId] = host.targetId.split('/');
      const dept = GROUND_FLOOR_DEPARTMENTS.find((d) => d.code === deptCode);
      expect(dept).toBeDefined();
      if (dept) {
        const room = dept.rooms.find((r) => r.roomId === roomId);
        expect(room).toBeDefined();
      }
    }
  });

  it('direction arrows have flipU for left arrows', () => {
    const leftArrows = DIRECTION_ARROW_HOSTS.filter((h) => h.flipU === true);
    const rightArrows = DIRECTION_ARROW_HOSTS.filter((h) => h.flipU === false || h.flipU === undefined);
    expect(leftArrows.length).toBeGreaterThan(0);
    expect(rightArrows.length).toBeGreaterThan(0);
  });

  it('getSignHostsForTarget filters correctly', () => {
    const stepHosts = getSignHostsForTarget('step', 'step-ticket');
    expect(stepHosts.length).toBe(1);
    expect(stepHosts[0].variant).toBe('step-chip');

    const deptHosts = getSignHostsForTarget('department', 'KHOA_NOI');
    expect(deptHosts.length).toBeGreaterThanOrEqual(1);
  });

  it('sign host positions are at reasonable heights', () => {
    for (const host of SIGN_HOSTS) {
      const { y } = host.transform.position;
      // Signs should be at human-readable heights (0.5m to 3m)
      expect(y).toBeGreaterThanOrEqual(0.5);
      expect(y).toBeLessThanOrEqual(3.0);
    }
  });

  it('step-chip hosts are positioned near their steps', () => {
    for (const host of STEP_CHIP_HOSTS) {
      const step = STEP_LOCATIONS.find((s) => s.stepId === host.targetId);
      if (step) {
        // X offset should be -2.5 from step position
        expect(host.transform.position.x).toBeCloseTo(step.position.x - 2.5, 1);
        // Z should match step position
        expect(host.transform.position.z).toBeCloseTo(step.position.z, 1);
      }
    }
  });

  it('dept-hanging signs are positioned at department corridor center', () => {
    for (const host of DEPT_HANGING_HOSTS) {
      const dept = GROUND_FLOOR_DEPARTMENTS.find((d) => d.code === host.targetId);
      if (dept) {
        expect(host.transform.position.x).toBeCloseTo(dept.worldOrigin.x, 1);
        expect(host.transform.position.z).toBeCloseTo(dept.worldOrigin.z + 2, 1);
        expect(host.transform.position.y).toBeCloseTo(2.2, 1);
      }
    }
  });
});