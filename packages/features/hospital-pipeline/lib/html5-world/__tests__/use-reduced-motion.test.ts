// @vitest-environment jsdom
/**
 * useReducedMotion hook — SSR-safe prefers-reduced-motion detection
 * (ADR 0003, reduced-motion spec #10).
 *
 * The hook must follow the system setting at mount, react to setting changes
 * and never leak listeners after unmount. matchMedia is stubbed so both
 * states and the change event are controllable; the test asserts observable
 * behavior only (the returned boolean and the query string it probes).
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "../use-reduced-motion";

interface FakeMql {
  matches: boolean;
  listeners: Array<(event: { matches: boolean }) => void>;
  addEventListener(type: string, handler: (event: { matches: boolean }) => void): void;
  removeEventListener(type: string, handler: (event: { matches: boolean }) => void): void;
}

function makeMql(initial: boolean): FakeMql {
  const mql: FakeMql = {
    matches: initial,
    listeners: [],
    addEventListener(_type, handler) {
      mql.listeners.push(handler);
    },
    removeEventListener(_type, handler) {
      mql.listeners = mql.listeners.filter((h) => h !== handler);
    },
  };
  return mql;
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

let mql: FakeMql;

beforeEach(() => {
  mql = makeMql(false);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => {
      expect(query).toBe(REDUCE_QUERY);
      return mql;
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReducedMotion", () => {
  it("returns false when the system does not request reduced motion", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when the system requests reduced motion", () => {
    mql = makeMql(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reacts to a setting change while mounted", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      for (const handler of mql.listeners) handler({ matches: true });
    });
    expect(result.current).toBe(true);

    act(() => {
      for (const handler of mql.listeners) handler({ matches: false });
    });
    expect(result.current).toBe(false);
  });

  it("removes the change listener on unmount", () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(mql.listeners.length).toBe(1);

    unmount();
    expect(mql.listeners).toHaveLength(0);
  });
});
