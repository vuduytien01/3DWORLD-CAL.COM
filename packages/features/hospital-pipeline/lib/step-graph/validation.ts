/**
 * Validation — Build-time checks for location data integrity
 *
 * Runs at build time to catch data errors early.
 * In CI: throws on any validation failure.
 */

import { STEP_LOCATIONS, STEP_LOCATION_BY_ID } from './step-locations';
import { GROUND_FLOOR_DEPARTMENTS, ALL_FLOOR_DEPARTMENTS } from './department-locations';
import { SIGN_HOSTS } from './sign-hosts';
import process from "node:process";

export function validateStepLocations(): string[] {
  const errors: string[] = [];

  // 1. All stepIds unique
  const ids = STEP_LOCATIONS.map((s) => s.stepId);
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate stepId in STEP_LOCATIONS');
  }

  // 2. Z positions strictly increasing (pipeline order)
  for (let i = 1; i < STEP_LOCATIONS.length; i++) {
    if (STEP_LOCATIONS[i].position.z <= STEP_LOCATIONS[i - 1].position.z) {
      errors.push(
        `Step ${STEP_LOCATIONS[i].stepId} z (${STEP_LOCATIONS[i].position.z}) ` +
        `not > previous z (${STEP_LOCATIONS[i - 1].position.z})`
      );
    }
  }

  // 3. All stepIds exist in StepLocationById map
  for (const step of STEP_LOCATIONS) {
    if (!STEP_LOCATION_BY_ID.has(step.stepId)) {
      errors.push(`Step ${step.stepId} not found in STEP_LOCATION_BY_ID map`);
    }
  }

  // 4. Interaction radii don't overlap excessively
  for (let i = 0; i < STEP_LOCATIONS.length - 1; i++) {
    const a = STEP_LOCATIONS[i];
    const b = STEP_LOCATIONS[i + 1];
    const dist = Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z);
    if (dist < a.interactionRadius + b.interactionRadius - 0.5) {
      errors.push(
        `Steps ${a.stepId} and ${b.stepId} interaction zones overlap (dist=${dist.toFixed(2)})`
      );
    }
  }

  // 5. All steps have valid camera dolly offsets if provided
  for (const step of STEP_LOCATIONS) {
    if (step.cameraDollyOffset) {
      const { x, y, z } = step.cameraDollyOffset;
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
        errors.push(`Step ${step.stepId} cameraDollyOffset has invalid values`);
      }
    }
  }

  return errors;
}

export function validateDepartments(): string[] {
  const errors: string[] = [];

  // 1. Room positions within department bounds
  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    const halfW = 12;  // Department half-width (24m total / 2)
    const halfD = 50;  // Approx department depth

    for (const room of dept.rooms) {
      if (Math.abs(room.position.x) > halfW || Math.abs(room.position.z) > halfD) {
        errors.push(
          `Room ${room.roomId} in ${dept.code} out of bounds: ` +
          `(${room.position.x}, ${room.position.z})`
        );
      }
    }
  }

  // 2. Door positions on room perimeter
  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    for (const room of dept.rooms) {
      const hw = room.size.width / 2;
      const hd = room.size.depth / 2;
      const dx = room.doorOffset.x;
      const dz = room.doorOffset.z;

      const onEdge =
        Math.abs(Math.abs(dx) - hw) < 0.01 ||
        Math.abs(Math.abs(dz) - hd) < 0.01;

      if (!onEdge && room.doorWidth > 0) {
        errors.push(
          `Room ${room.roomId} door not on perimeter: offset=(${dx}, ${dz}) ` +
          `room half-size=(${hw}, ${hd})`
        );
      }
    }
  }

  // 3. Department codes unique per floor
  for (let floor = 0; floor <= 9; floor++) {
    const deptsOnFloor = ALL_FLOOR_DEPARTMENTS.filter((d) => d.floor === floor);
    const codes = deptsOnFloor.map((d) => d.code);
    if (new Set(codes).size !== codes.length) {
      errors.push(`Duplicate department codes on floor ${floor}`);
    }
  }

  // 4. All specialty departments have triage keywords
  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    if (dept.triageKeywords.length === 0 && !['KHOA_TIEP_DON', 'KHOA_THANH_TOAN'].includes(dept.code)) {
      errors.push(`Specialty department ${dept.code} has no triageKeywords`);
    }
  }

  // 5. Signage colors are valid hex
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    if (!hexColorRegex.test(dept.signageColor)) {
      errors.push(`Department ${dept.code} has invalid signageColor: ${dept.signageColor}`);
    }
  }

  return errors;
}

export function validateSignHosts(): string[] {
  const errors: string[] = [];

  // 1. All sign host IDs unique
  const ids = SIGN_HOSTS.map((h) => h.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate sign host ID');
  }

  // 2. Step chip hosts reference valid steps
  for (const host of SIGN_HOSTS.filter((h) => h.variant === 'step-chip')) {
    if (!STEP_LOCATION_BY_ID.has(host.targetId)) {
      errors.push(`Step-chip sign host ${host.id} references unknown stepId: ${host.targetId}`);
    }
  }

  // 3. Department hanging signs reference valid departments
  for (const host of SIGN_HOSTS.filter((h) => h.variant === 'dept-hanging')) {
    const found = GROUND_FLOOR_DEPARTMENTS.some((d) => d.code === host.targetId);
    if (!found) {
      errors.push(`Dept-hanging sign host ${host.id} references unknown department: ${host.targetId}`);
    }
  }

  // 4. Room wall signs reference valid rooms
  for (const host of SIGN_HOSTS.filter((h) => h.variant === 'room-wall')) {
    const [deptCode, roomId] = host.targetId.split('/');
    const dept = GROUND_FLOOR_DEPARTMENTS.find((d) => d.code === deptCode);
    if (!dept) {
      errors.push(`Room-wall sign host ${host.id} references unknown department: ${deptCode}`);
    } else {
      const room = dept.rooms.find((r) => r.roomId === roomId);
      if (!room) {
        errors.push(`Room-wall sign host ${host.id} references unknown room: ${roomId} in ${deptCode}`);
      }
    }
  }

  // 5. Transforms have valid numbers
  for (const host of SIGN_HOSTS) {
    const { position, rotation, scale } = host.transform;
    const allValues = [
      position.x, position.y, position.z,
      rotation.x, rotation.y, rotation.z,
      scale.x, scale.y
    ];
    for (const val of allValues) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        errors.push(`Sign host ${host.id} has invalid transform value: ${val}`);
        break;
      }
    }
  }

  return errors;
}

export function validateAll(): string[] {
  return [
    ...validateStepLocations(),
    ...validateDepartments(),
    ...validateSignHosts(),
  ];
}

// Run at build time
const allErrors = validateAll();
if (allErrors.length > 0) {
  console.error('[Location Data] Validation failed:', allErrors);
  // In CI: throw new Error(`Location data validation failed: ${allErrors.join('; ')}`)
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    throw new Error(`Location data validation failed: ${allErrors.join('; ')}`);
  }
} else {
  console.log('[Location Data] All validations passed ✓');
}