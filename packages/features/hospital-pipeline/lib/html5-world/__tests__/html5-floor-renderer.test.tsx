// @vitest-environment jsdom
/**
 * Html5FloorRenderer component tests (test-component, unit level) — the
 * Canvas 2D + DOM overlay renderer in jsdom with a stubbed 2D context.
 *
 * The renderer's observable contract is pinned here: the readiness attribute,
 * two stacked canvases plus the overlay container, focus-floor overlay groups
 * with step chips and aria-labelled room hotspots, the exact four-field perf
 * mirror (no `frames`), the camera + orbit mirrors, the patient marker and
 * reduced-motion entrance stagger. Room clicks are asserted through the
 * onRoomClick callback.
 *
 * rAF is driven by a setTimeout shim so the loop advances deterministically;
 * React act warnings from frames that land outside a wrapped act are expected
 * noise here, not failures.
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraPose } from "../../demo/camera-choreography";
import { Html5FloorRenderer, type Html5PatientState } from "../html5-floor-renderer";

/** A follow shot on the ground floor: target.y 1.5 → focusFloor 0. */
const FLOOR0_POSE: CameraPose = {
  position: { x: -8, y: 5.4, z: -12 },
  target: { x: -8, y: 1.5, z: -12 },
};

interface TestWindow {
  __HOSPITAL_CAMERA__?: { panX: number; panY: number; zoom: number; focusFloor: number };
  __ORBIT_CONTROLS_ENABLED__?: boolean;
  __HOSPITAL_PERF__?: { fps: number; frameMs: number; calls: number; tris: number };
}

const win = window as unknown as TestWindow;

/**
 * Proxy-based 2D context stub: every method is a no-op, property writes are
 * swallowed, measureText returns a width. The ~150-member
 * CanvasRenderingContext2D interface is not worth listing by hand — the
 * renderer only reads measureText back. The cast is deliberate and scoped to
 * this stub.
 */
function createCtxStub(): CanvasRenderingContext2D {
  const target = {
    canvas: null as HTMLCanvasElement | null,
    measureText: (text: string) => ({ width: text.length * 3 }),
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return Reflect.get(obj, prop);
      return () => undefined;
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

beforeAll(() => {
  getContextSpy.mockImplementation(() => createCtxStub());
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  });
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    writable: true,
    value: () => ({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  // Deterministic frame loop: setTimeout shim; cancelAnimationFrame clears it
  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16) as unknown as number
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

afterAll(() => {
  getContextSpy.mockRestore();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  delete win.__HOSPITAL_CAMERA__;
  delete win.__ORBIT_CONTROLS_ENABLED__;
  delete win.__HOSPITAL_PERF__;
});

describe("Html5FloorRenderer", () => {
  it("renders two canvases + overlay container and claims readiness", async () => {
    const { container } = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} />);
    expect(container.querySelectorAll("canvas.html5-canvas")).toHaveLength(2);
    expect(container.querySelector(".html5-overlay")).not.toBeNull();
    // document.fonts is absent in jsdom → the fonts.ready race resolves
    // immediately and readiness flips after the first paint
    await waitFor(() => expect(container.dataset.hospitalReady).toBe("true"));
  });

  it("builds the focus-floor overlay: groups, chips and aria-labelled hotspots", async () => {
    const { container } = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} />);

    await waitFor(() => {
      expect(container.querySelectorAll(".html5-floor-group").length).toBeGreaterThanOrEqual(2);
    });
    const chips = container.querySelectorAll("[data-step]");
    expect(chips.length).toBeGreaterThanOrEqual(2); // floor ± 1, never all 8
    expect(chips.length).toBeLessThan(8);

    const hotspots = container.querySelectorAll("button[data-room]");
    expect(hotspots.length).toBeGreaterThan(0);
    for (const button of hotspots) {
      expect(button.getAttribute("aria-label") ?? "").not.toBe("");
    }
  });

  it("writes the four-field perf mirror, camera mirror and orbit mirror", async () => {
    const { rerender } = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} />);

    await waitFor(() => {
      expect(win.__HOSPITAL_PERF__).toBeDefined();
      expect(Object.keys(win.__HOSPITAL_PERF__ as object).sort()).toEqual([
        "calls",
        "fps",
        "frameMs",
        "tris",
      ]);
      expect(win.__HOSPITAL_CAMERA__).toBeDefined();
      expect(Object.keys(win.__HOSPITAL_CAMERA__ as object).sort()).toEqual([
        "focusFloor",
        "panX",
        "panY",
        "zoom",
      ]);
    });
    expect(win.__ORBIT_CONTROLS_ENABLED__).toBe(false);
    expect(win.__HOSPITAL_CAMERA__?.focusFloor).toBe(0);

    rerender(<Html5FloorRenderer cameraPose={FLOOR0_POSE} enableOrbit />);
    await waitFor(() => expect(win.__ORBIT_CONTROLS_ENABLED__).toBe(true));
  });

  it("shows the patient marker while a patient exists and hides it after", async () => {
    const patient: Html5PatientState = { x: 0, y: 1.5, z: 0 };
    const { container, rerender } = render(
      <Html5FloorRenderer cameraPose={FLOOR0_POSE} patientState={patient} />
    );

    const marker = container.querySelector("[data-patient]") as HTMLElement | null;
    expect(marker).not.toBeNull();
    await waitFor(() => expect((marker as HTMLElement).style.display).toBe("block"));

    rerender(<Html5FloorRenderer cameraPose={FLOOR0_POSE} patientState={null} />);
    await waitFor(() => expect((marker as HTMLElement).style.display).toBe("none"));
  });

  it("fires onRoomClick with the room id when a hotspot is clicked", async () => {
    const onRoomClick = vi.fn();
    const { container } = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} onRoomClick={onRoomClick} />);

    await waitFor(() => {
      expect(container.querySelectorAll("button[data-room]").length).toBeGreaterThan(0);
    });
    const button = container.querySelector("button[data-room]") as HTMLButtonElement;
    fireEvent.click(button);
    expect(onRoomClick).toHaveBeenCalledWith(button.getAttribute("data-room"));
    expect(onRoomClick).toHaveBeenCalledTimes(1);
  });

  it("reduced motion skips the sign entrance stagger; normal motion staggers it", async () => {
    const reduced = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} reducedMotion />);
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(reduced.container.querySelectorAll(".html5-sign--entrance")).toHaveLength(0);

    const normal = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} />);
    await waitFor(() => {
      expect(normal.container.querySelectorAll(".html5-sign--entrance").length).toBeGreaterThan(0);
    });
  });

  it("unmount deletes every window mirror", async () => {
    const { unmount } = render(<Html5FloorRenderer cameraPose={FLOOR0_POSE} />);
    await waitFor(() => expect(win.__HOSPITAL_PERF__).toBeDefined());

    unmount();
    expect(win.__HOSPITAL_PERF__).toBeUndefined();
    expect(win.__HOSPITAL_CAMERA__).toBeUndefined();
    expect(win.__ORBIT_CONTROLS_ENABLED__).toBeUndefined();
  });
});
