/**
 * Hospital demo — HTML5 renderer E2E (ADR 0003)
 *
 * The WebGL seams are gone: the page mounts the HTML5 isometric renderer
 * (Canvas 2D + DOM overlay) and drives a 180s wall-clock choreography. These
 * tests exercise the renderer's real DOM seams:
 * - readiness: [data-hospital-ready="true"] (claimed after first paint +
 *   document.fonts.ready, html5-floor-renderer.tsx)
 * - mirrors: window.__HOSPITAL_CAMERA__ {panX, panY, zoom, focusFloor},
 *   window.__ORBIT_CONTROLS_ENABLED__, window.__HOSPITAL_PERF__
 *   {fps, frameMs, calls, tris} — there is no `frames` counter
 * - overlay: [data-floor] floor groups, [data-step] station chips,
 *   [data-room] hotspots, [data-patient] marker
 * - narration beats pushed into the AI Guide chat HUD
 *
 * R1-R4 pin the readiness / mirror / camera / overlay invariants (Ruling F,
 * task-6-brief.md). The old keyboard-, step-HUD- and pixel-snapshot tests have
 * no equivalent on this page (Rulings A, C, E): step chips are world labels,
 * not progress, and the demo timeline is wall-clock only. Tests that need a
 * specific choreography moment seed it with ?t=<seconds> (Ruling B seam).
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.describe.configure({ retries: 0 });

/** Window hooks the HTML5 renderer exposes for E2E tooling */
interface HospitalTestWindow {
  __HOSPITAL_CAMERA__?: { panX: number; panY: number; zoom: number; focusFloor: number };
  __ORBIT_CONTROLS_ENABLED__?: boolean;
  __HOSPITAL_PERF__?: { fps: number; frameMs: number; calls: number; tris: number };
}

/** Stable prefix of the intro narration beat (lib/demo/demo-script.ts beat 0) */
const INTRO_NARRATION_PREFIX = "Xin chào quý thầy cô";

/** Stable prefix of the consultation beat — fired on action-phase entry at t=50s */
const CONSULTATION_NARRATION_PREFIX = "Được gọi khám, camera đưa chúng ta lên tầng 2";

/** Open the demo page and wait until the HTML5 renderer claims readiness */
async function gotoHospitalDemo(page: Page, query = ""): Promise<void> {
  await page.goto(`/hospital-demo${query}`, { waitUntil: "networkidle", timeout: 150_000 });
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45000,
  });
}

function readCamera(page: Page): Promise<HospitalTestWindow["__HOSPITAL_CAMERA__"]> {
  return page.evaluate(() => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__);
}

function waitForFocusFloor(page: Page, floor: number, timeout: number): Promise<void> {
  return page.waitForFunction(
    (expected) => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.focusFloor === expected,
    floor,
    { timeout }
  );
}

test.describe("Hospital HTML5 Demo", () => {
  test("R1: readiness claim + mirror lifecycle", async ({ page }) => {
    await gotoHospitalDemo(page);

    // The ready attribute flips false → true after the first static paint and
    // document.fonts.ready; the locator only matches once it has flipped
    const stage = page.locator('[data-hospital-ready="true"]');
    await expect(stage).toBeVisible();

    // The renderer paints through two stacked 2D canvases (static + dynamic)
    await expect(page.locator("canvas.html5-canvas")).toHaveCount(2);

    // The stage fills the 1280x720 default viewport
    const box = await stage.boundingBox();
    expect(box?.width).toBeGreaterThan(1200);
    expect(box?.height).toBeGreaterThan(680);

    // Mirrors are written per rAF frame; orbit stays on (page passes
    // enableOrbit={true}) and fps leaves 0 at the second sampled frame
    await page.waitForFunction(
      () => {
        const w = window as unknown as HospitalTestWindow;
        return (
          !!w.__HOSPITAL_CAMERA__ &&
          !!w.__HOSPITAL_PERF__ &&
          w.__ORBIT_CONTROLS_ENABLED__ === true &&
          w.__HOSPITAL_PERF__.fps > 0
        );
      },
      undefined,
      { timeout: 10000 }
    );

    const camera = await readCamera(page);
    expect(camera).toBeTruthy();
    expect(Object.keys(camera as object).sort()).toEqual(["focusFloor", "panX", "panY", "zoom"]);
    const zoom = (camera as { zoom: number }).zoom;
    expect(zoom).toBeGreaterThanOrEqual(2.2);
    expect(zoom).toBeLessThanOrEqual(140);
  });

  test("R2: camera mirror tracks the aerial→follow arc (?t=)", async ({ page }) => {
    // Aerial regime read from the outro crane: the clock clamps at 180s, so
    // the camera freezes on the outro aerial pose (~30m → zoom ≈ 6.6 px/m)
    // and the < 12 read cannot race the intro descent under parallel load
    await gotoHospitalDemo(page, "?t=170");
    const aerial = await readCamera(page);
    expect(aerial).toBeTruthy();
    expect(aerial?.zoom).toBeLessThan(12);
    expect(aerial?.focusFloor).toBe(0);

    // Follow regime from the intro descent: the crane reaches the ticket
    // station hold (~3.9m → zoom ≈ 51 px/m) around t≈9-10s
    await gotoHospitalDemo(page, "?t=0");
    await page.waitForFunction(
      () => ((window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.zoom ?? 0) > 30,
      undefined,
      { timeout: 20000 }
    );
    const follow = await readCamera(page);
    expect(follow).toBeTruthy();
    expect(follow?.zoom).toBeGreaterThan(30);
    expect(follow?.focusFloor).toBe(0);

    // Aerial pan (building centered) and follow pan (ticket station centered)
    // are different shots — the mirror moved with the camera
    const panDelta =
      Math.abs((follow?.panX ?? 0) - (aerial?.panX ?? 0)) +
      Math.abs((follow?.panY ?? 0) - (aerial?.panY ?? 0));
    expect(panDelta).toBeGreaterThan(10);
  });

  test("R3: overlay budget at focus 0", async ({ page }) => {
    await gotoHospitalDemo(page);
    await waitForFocusFloor(page, 0, 10000);

    // Focus floor ± 1, clamped (floor-plan.ts overlayFloorRange): 2 groups at
    // focus 0, never more than 3 anywhere
    const floorGroups = await page.locator("[data-floor]").count();
    expect(floorGroups).toBeGreaterThanOrEqual(2);
    expect(floorGroups).toBeLessThanOrEqual(3);

    // Step chips are world labels on the overlay floors only — some subset,
    // never all 8 stations at once
    const chips = await page.locator("[data-step]").count();
    expect(chips).toBeGreaterThanOrEqual(2);
    expect(chips).toBeLessThan(8);

    // Exactly one patient marker, shown while a timeline segment is active
    await expect(page.locator("[data-patient]")).toHaveCount(1);
    await expect(page.locator("[data-patient]")).toBeVisible();
  });

  test("R4: station chips step-ticket + step-queue visible at focus 0", async ({ page }) => {
    await gotoHospitalDemo(page);
    await waitForFocusFloor(page, 0, 10000);

    await expect(page.locator('[data-step="step-ticket"]')).toBeVisible();
    await expect(page.locator('[data-step="step-queue"]')).toBeVisible();
  });

  test("shows intro narration and the patient marker at the ticket station", async ({ page }) => {
    await gotoHospitalDemo(page);

    await expect(page.getByText(INTRO_NARRATION_PREFIX)).toBeVisible();
    await expect(page.locator("[data-patient]")).toBeVisible();
    await waitForFocusFloor(page, 0, 10000);
  });

  test("floor transition lifts focus to floor 2 (?t=40)", async ({ page }) => {
    // Seed near the queue→consultation approach (t=44-50): the restacked
    // camera target crosses 3m at ~t=47, focusFloor flips 0 → 1; the
    // consultation narration beat fires on action-phase entry at t=50
    await gotoHospitalDemo(page, "?t=40");
    await waitForFocusFloor(page, 0, 5000);
    await waitForFocusFloor(page, 1, 15000);

    await expect(page.getByText(CONSULTATION_NARRATION_PREFIX)).toBeVisible({ timeout: 20000 });
  });

  test("renders guide status label and observability mirrors", async ({ page }) => {
    await gotoHospitalDemo(page);

    // The debug panel is gone; the guide status label is the surviving
    // connection readout and must render whatever state the socket is in
    const statusLabel = page
      .getByText("Đã kết nối", { exact: true })
      .or(page.getByText("Đang kết nối...", { exact: true }))
      .or(page.getByText(/Đang kết nối lại( \(lần \d+\))?/))
      .or(page.getByText("Chưa kết nối", { exact: true }));
    await expect(statusLabel.first()).toBeVisible({ timeout: 30000 });

    await page.waitForFunction(
      () => ((window as unknown as HospitalTestWindow).__HOSPITAL_PERF__?.fps ?? 0) > 0,
      undefined,
      { timeout: 10000 }
    );
    await waitForFocusFloor(page, 0, 10000);
    const orbit = await page.evaluate(
      () => (window as unknown as HospitalTestWindow).__ORBIT_CONTROLS_ENABLED__
    );
    expect(orbit).toBe(true);
  });
});

test.describe("Hospital HTML5 Demo — Responsive", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test("renders correctly on mobile viewport", async ({ page }) => {
    await gotoHospitalDemo(page);
    await expect(page.locator('[data-hospital-ready="true"]')).toBeVisible();

    // The canvas layers fill the 375x667 viewport (position:absolute; inset:0)
    const canvas = page.locator("canvas.html5-canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect(box?.height).toBeGreaterThan(500);
  });
});
