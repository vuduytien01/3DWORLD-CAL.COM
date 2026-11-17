/**
 * Motion tokens — centralized easing curves and walk cycle constants
 * for the HTML5 hospital demo (ADR 0003).
 *
 * Single source of truth for all motion feel parameters. Consumers import
 * from here instead of duplicating formulas or magic numbers.
 */

export const easings = {
  linear: (t: number): number => t,
  easeOut: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutQuart: (t: number): number => 1 - Math.pow(1 - t, 4),
  easeInOutSine: (t: number): number => (1 - Math.cos(Math.PI * t)) / 2,
} as const;

export type EasingName = keyof typeof easings;

/**
 * Walk cycle constants shared between patient-walk.ts and patient-rig.ts.
 * Tuning the walk feel only requires changing these values.
 */
export const WALK_CYCLE_HZ = 1.2;
export const WALK_STRIDE = 0.9;
export const WALK_ARM_SWING = 1.3;