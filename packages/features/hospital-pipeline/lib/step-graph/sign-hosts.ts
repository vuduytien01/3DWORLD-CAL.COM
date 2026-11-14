/**
 * Sign Hosts — Signage Anchor Points
 *
 * Maps each signage plane to its host object (wall, ceiling-hung, floor-standing)
 * so CanvasTexture can be applied at the correct transform.
 *
 * Used by: 3D Scene renderer, Vignette, Walkthrough demos
 */

import { STEP_LOCATIONS } from './step-locations';
import { GROUND_FLOOR_DEPARTMENTS } from './department-locations';

export interface SignHost {
  /** Unique id */
  id: string;

  /** Which step/department this sign belongs to */
  targetType: 'step' | 'department' | 'direction';
  targetId: string;  // stepId or department.code

  /** Signage variant */
  variant: 'step-chip' | 'dept-hanging' | 'room-wall' | 'direction-arrow';

  /** World transform of the sign plane center */
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };  // Euler radians
    scale: { x: number; y: number };               // Plane size in meters
  };

  /** UV flip for arrows (left/right) */
  flipU?: boolean;
}

/** Auto-generated from STEP_LOCATIONS + DEPARTMENTS at build time */
export function generateSignHosts(): readonly SignHost[] {
  const hosts: SignHost[] = [];

  // Step chips (wall-mounted at each station)
  for (const step of STEP_LOCATIONS) {
    hosts.push({
      id: `sign-step-${step.stepId}`,
      targetType: 'step',
      targetId: step.stepId,
      variant: 'step-chip',
      transform: {
        position: { x: step.position.x - 2.5, y: 1.8, z: step.position.z },
        rotation: { x: -Math.PI / 2, y: 0, z: 0 },
        scale: { x: 1.0, y: 0.25 },
      },
    });
  }

  // Department hanging signs (center of corridor, above head)
  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    hosts.push({
      id: `sign-dept-${dept.code}`,
      targetType: 'department',
      targetId: dept.code,
      variant: 'dept-hanging',
      transform: {
        position: {
          x: dept.worldOrigin.x,
          y: 2.2,
          z: dept.worldOrigin.z + 2,
        },
        rotation: { x: -Math.PI / 2, y: 0, z: 0 },
        scale: { x: 2.0, y: 0.5 },
      },
    });

    // Room wall signs (on door frame)
    for (const room of dept.rooms) {
      if (room.doorWidth > 0) {
        hosts.push({
          id: `sign-room-${room.roomId}`,
          targetType: 'department',
          targetId: `${dept.code}/${room.roomId}`,
          variant: 'room-wall',
          transform: {
            position: {
              x: dept.worldOrigin.x + room.position.x + room.doorOffset.x,
              y: 1.5,
              z: dept.worldOrigin.z + room.position.z + room.doorOffset.z,
            },
            rotation: { x: 0, y: Math.PI / 2, z: 0 },
            scale: { x: 0.4, y: 0.4 },
          },
        });
      }
    }
  }

  // Direction arrows (intersections)
  const dirPositions = [
    { x: 0, z: 10, label: 'straight' },
    { x: 0, z: 30, label: 'straight' },
    { x: -9, z: 15, label: 'left' },
    { x: 9, z: 15, label: 'right' },
  ];

  for (const dp of dirPositions) {
    hosts.push({
      id: `sign-dir-${dp.label}-${dp.z}`,
      targetType: 'direction',
      targetId: `dir-${dp.label}-${dp.z}`,
      variant: 'direction-arrow',
      transform: {
        position: { x: dp.x, y: 1.8, z: dp.z },
        rotation: { x: -Math.PI / 2, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5 },
      },
      flipU: dp.label === 'left',
    });
  }

  return hosts;
}

export const SIGN_HOSTS = generateSignHosts();

/** Lookup sign hosts by target */
export function getSignHostsForTarget(targetType: SignHost['targetType'], targetId: string): readonly SignHost[] {
  return SIGN_HOSTS.filter((h) => h.targetType === targetType && h.targetId === targetId);
}

/** Get all step-chip hosts */
export const STEP_CHIP_HOSTS = SIGN_HOSTS.filter((h) => h.variant === 'step-chip');

/** Get all department hanging sign hosts */
export const DEPT_HANGING_HOSTS = SIGN_HOSTS.filter((h) => h.variant === 'dept-hanging');

/** Get all room wall sign hosts */
export const ROOM_WALL_HOSTS = SIGN_HOSTS.filter((h) => h.variant === 'room-wall');

/** Get all direction arrow hosts */
export const DIRECTION_ARROW_HOSTS = SIGN_HOSTS.filter((h) => h.variant === 'direction-arrow');