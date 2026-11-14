/**
 * Hospital demo — Mobile E2E (viewport 390x844, ADR 0003 HTML5 renderer)
 *
 * Verifies the demo works on a phone-sized viewport:
 * - the HTML5 renderer mounts and its canvas layers fill the viewport
 * - the ticket station chip and intro narration render at focus 0
 * - the floor transition lifts focus to floor 2 (seeded via the ?t= seam)
 *
 * The old highlighted-chip / step-HUD assertions have no equivalent: step
 * chips are world labels on the focus ± 1 overlay, and the demo timeline is
 * wall-clock choreography (Rulings B, C, task-6-brief.md).
 */

import { expect, test } from "@playwright/test";

test.describe.configure({ retries: 0 });

/** Window hook the HTML5 renderer exposes for E2E tooling */
interface HospitalTestWindow {
  __HOSPITAL_CAMERA__?: { panX: number; panY: number; zoom: number; focusFloor: number };
}

/** Stable prefixes of the narration beats (lib/demo/demo-script.ts) */
const INTRO_NARRATION_PREFIX = "Xin chào quý thầy cô";
const CONSULTATION_NARRATION_PREFIX = "Được gọi khám, camera đưa chúng ta lên tầng 2";

test.describe("Hospital HTML5 Demo — Mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mounts the HTML5 stage on mobile viewport", async ({ page }) => {
    await page.goto("/hospital-demo", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
      timeout: 45000,
    });

    await expect(page.locator('[data-hospital-ready="true"]')).toBeVisible();

    // Canvas layers fill the 390x844 viewport (position:absolute; inset:0)
    const canvas = page.locator("canvas.html5-canvas").first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(370);
    expect(box?.height).toBeGreaterThan(800);
  });

  test("shows the ticket chip and intro narration on mobile viewport", async ({ page }) => {
    await page.goto("/hospital-demo", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
      timeout: 45000,
    });

    // Ticket station sits on floor 0 — the focus while the intro crane lands
    await page.waitForFunction(
      () => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.focusFloor === 0,
      undefined,
      { timeout: 10000 }
    );
    await expect(page.locator('[data-step="step-ticket"]')).toBeVisible();
    await expect(page.getByText(INTRO_NARRATION_PREFIX)).toBeVisible();
  });

  test("transitions focus to floor 2 when seeded past the consultation approach (?t=40)", async ({
    page,
  }) => {
    // Seed near the queue→consultation approach (t=44-50): the restacked
    // camera target crosses 3m at ~t=47, focusFloor flips 0 → 1; the
    // consultation narration beat fires on action-phase entry at t=50
    await page.goto("/hospital-demo?t=40", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
      timeout: 45000,
    });

    await page.waitForFunction(
      () => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.focusFloor === 0,
      undefined,
      { timeout: 5000 }
    );
    await page.waitForFunction(
      () => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.focusFloor === 1,
      undefined,
      { timeout: 15000 }
    );

    await expect(page.getByText(CONSULTATION_NARRATION_PREFIX)).toBeVisible({ timeout: 20000 });
  });
});
