/**
 * Motion tokens — mathematical properties of the shared easing curves plus
 * the locked walk-cycle constants (ADR 0003).
 *
 * The easings are the single source of truth for demo feel; every renderer and
 * choreography consumer imports them. These tests pin the properties every
 * consumer relies on: endpoints, [0,1] range, monotonicity
 * and the easeInOutCubic symmetry the transitions use for camera shots.
 *
 * The walk constants are design tokens: changing them changes the walk feel on
 * purpose. They are pinned the same way the khoa-slice suite pins the Mint
 * Order palette — a deliberate lock, not an implementation accident.
 */

import { describe, expect, it } from "vitest";
import { easings, WALK_ARM_SWING, WALK_CYCLE_HZ, WALK_STRIDE } from "../motion-tokens";

const GRID = Array.from({ length: 21 }, (_, i) => i / 20); // 0, 0.05, …, 1

describe("easings — shared curves", () => {
  it("linear is the identity", () => {
    for (const t of GRID) {
      expect(easings.linear(t)).toBe(t);
    }
  });

  it.each([
    ["easeOut", (t: number) => easings.easeOut(t)],
    ["easeInOutCubic", (t: number) => easings.easeInOutCubic(t)],
    ["easeOutQuart", (t: number) => easings.easeOutQuart(t)],
    ["easeInOutSine", (t: number) => easings.easeInOutSine(t)],
  ] as const)("%s maps 0→0 and 1→1", (_name, fn) => {
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it("every easing stays in [0, 1] across the unit interval", () => {
    for (const fn of Object.values(easings)) {
      for (const t of GRID) {
        expect(fn(t)).toBeGreaterThanOrEqual(0);
        expect(fn(t)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every easing is monotonically non-decreasing (no backward motion)", () => {
    for (const fn of Object.values(easings)) {
      for (let i = 1; i < GRID.length; i++) {
        expect(fn(GRID[i])).toBeGreaterThanOrEqual(fn(GRID[i - 1]));
      }
    }
  });

  it("easeOut(0.5) = 1 − 0.5³ = 0.875", () => {
    expect(easings.easeOut(0.5)).toBeCloseTo(0.875, 10);
  });

  it("easeInOutCubic is symmetric: f(t) + f(1 − t) = 1", () => {
    for (const t of GRID) {
      expect(easings.easeInOutCubic(t) + easings.easeInOutCubic(1 - t)).toBeCloseTo(1, 10);
    }
    expect(easings.easeInOutCubic(0.5)).toBe(0.5);
  });

  it("easeOutQuart(0.5) = 1 − 0.5⁴ = 0.9375", () => {
    expect(easings.easeOutQuart(0.5)).toBeCloseTo(0.9375, 10);
  });

  it("easeInOutSine(0.5) = 0.5", () => {
    expect(easings.easeInOutSine(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe("walk cycle tokens — locked design values", () => {
  it("WALK_CYCLE_HZ = 1.2 (steps per second)", () => {
    expect(WALK_CYCLE_HZ).toBe(1.2);
  });

  it("WALK_STRIDE = 0.9 (world meters per cycle)", () => {
    expect(WALK_STRIDE).toBe(0.9);
  });

  it("WALK_ARM_SWING = 1.3 (arm amplitude factor)", () => {
    expect(WALK_ARM_SWING).toBe(1.3);
  });
});
