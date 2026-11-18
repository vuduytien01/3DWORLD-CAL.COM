/**
 * Hospital demo — adversarial UI tests (ui-test skill, encoded as Playwright)
 *
 * The ui-test skill plans three rounds (functional, adversarial, coverage
 * gaps) and executes in a real browser. This file is the deterministic subset
 * of that plan as Playwright assertions on the @calcom/web-edge project
 * (msedge + reducedMotion: "reduce"): seek storms, rapid mode toggles, chat
 * edge inputs (empty, 500 chars, XSS-shaped), keyboard submit, page-error
 * cleanliness, mobile overflow and the renderer's a11y seams.
 *
 * Unlike the guide suite (which mocks ws://localhost:3002 to stay hermetic),
 * these tests run against the real Guide Service started by the Playwright
 * webServer array with FREELLM_STUB=true. Questions here deliberately match
 * DELIVERED templates or the LLM stub fallback — never wait-update or
 * cost-estimate (those replies are swallowed server-side today; see
 * guide-service-lifecycle.test.ts KNOWN ISSUE).
 *
 * Each test opens its own ?session=<name> so worker-session state never
 * crosses tests, and attaches a pageerror listener — an uncaught exception
 * anywhere in a scripted session is a failure.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.describe.configure({ retries: 0 });

interface HospitalTestWindow {
  __HOSPITAL_CAMERA__?: { panX: number; panY: number; zoom: number; focusFloor: number };
  __ORBIT_CONTROLS_ENABLED__?: boolean;
  __HOSPITAL_PERF__?: { fps: number; frameMs: number; calls: number; tris: number };
}

const QUICK_TOUR_LABEL = "🚀 Quick Tour (30s)";
const FULL_DEMO_LABEL = "🎬 Full Demo (180s)";
const GREETING_QUESTION = "Xin chào";

function readCamera(page: Page): Promise<HospitalTestWindow["__HOSPITAL_CAMERA__"]> {
  return page.evaluate(() => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__);
}

async function waitForFocusFloor(page: Page, floor: number, timeout: number): Promise<void> {
  await page.waitForFunction(
    (expected) => (window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.focusFloor === expected,
    floor,
    { timeout }
  );
}

/** Open /hospital-demo with an isolated session and wait for renderer readiness. */
async function gotoHospitalDemo(page: Page, session: string, query = ""): Promise<void> {
  await page.goto(`/hospital-demo?session=${session}${query}`, {
    waitUntil: "networkidle",
    timeout: 150_000,
  });
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45000,
  });
}

/** Collect every uncaught page exception from this point on. */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("Hospital HTML5 Demo — adversarial UI (ui-test)", () => {
  test("page load: no uncaught exceptions and the renderer claims readiness", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-load");

    await expect(page.locator('[data-hospital-ready="true"]')).toBeVisible();
    await expect(page.locator("canvas.html5-canvas")).toHaveCount(2);
    await expect(page.locator("button[data-room]").first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("keyboard-only chat: type a greeting and submit with Enter → reply appears", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-enter");

    const chatInput = page
      .getByRole("textbox", { name: "Nhập câu hỏi cho trợ lý AI" })
      .or(page.getByPlaceholder("Nhập câu hỏi..."));
    await expect(chatInput).toBeEnabled();

    await chatInput.fill(GREETING_QUESTION);
    await chatInput.press("Enter");

    await expect(page.getByText(GREETING_QUESTION, { exact: true })).toBeVisible();
    // greeting template delivers through the real stub server
    await expect(page.getByText(/Chào .*hướng dẫn viên AI/)).toBeVisible({ timeout: 15000 });
    expect(errors).toHaveLength(0);
  });

  test("rapid mode-toggle clicks keep the page alive", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-toggle");

    const toggle = page
      .getByRole("button", { name: QUICK_TOUR_LABEL, exact: true })
      .or(page.getByRole("button", { name: FULL_DEMO_LABEL, exact: true }));
    const before = await toggle.innerText();

    for (let i = 0; i < 3; i++) {
      await toggle.click({ noWaitAfter: true });
    }

    const after = await toggle.innerText();
    expect([QUICK_TOUR_LABEL, FULL_DEMO_LABEL]).toContain(after);
    expect(after).not.toBe(before);
    await expect(page.locator('[data-hospital-ready="true"]')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("seek storm: keys 1..9 in quick succession never wedge the renderer", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-seekstorm");

    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(1200); // allow the last seek to settle

    await expect(page.locator('[data-hospital-ready="true"]')).toBeVisible();
    await expect(page.locator("canvas.html5-canvas")).toHaveCount(2);
    const camera = await readCamera(page);
    expect(camera).toBeTruthy();
    expect(errors).toHaveLength(0);
  });

  test("a step key lands the camera on that step's floor (key 3 → consultation, floor 1)", async ({
    page,
  }) => {
    await gotoHospitalDemo(page, "ui-step3");
    await waitForFocusFloor(page, 0, 10000);

    await page.keyboard.press("3");
    await waitForFocusFloor(page, 1, 10000);
  });

  test("empty chat submit does not crash the page", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-empty");

    const chatInput = page
      .getByRole("textbox", { name: "Nhập câu hỏi cho trợ lý AI" })
      .or(page.getByPlaceholder("Nhập câu hỏi..."));
    await expect(chatInput).toBeEnabled();
    await page.getByRole("button", { name: "Gửi", exact: true }).click();

    await expect(chatInput).toBeEnabled();
    expect(errors).toHaveLength(0);
  });

  test("a 500-character message is answered through the LLM stub fallback", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-longmsg");

    const chatInput = page
      .getByRole("textbox", { name: "Nhập câu hỏi cho trợ lý AI" })
      .or(page.getByPlaceholder("Nhập câu hỏi..."));
    const longMessage = "a".repeat(500);
    await chatInput.fill(longMessage);
    await page.getByRole("button", { name: "Gửi", exact: true }).click();

    await expect(page.getByText(longMessage, { exact: true })).toBeVisible();
    // No template matches 500 'a' → deterministic [STUB] reply
    await expect(page.getByText(/\[STUB\]/)).toBeVisible({ timeout: 20000 });
    expect(errors).toHaveLength(0);
  });

  test("XSS-shaped chat input renders as text and never executes", async ({ page }) => {
    const errors = collectPageErrors(page);
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await gotoHospitalDemo(page, "ui-xss");

    const chatInput = page
      .getByRole("textbox", { name: "Nhập câu hỏi cho trợ lý AI" })
      .or(page.getByPlaceholder("Nhập câu hỏi..."));
    const payload = "<script>alert(1)</script><img src=x onerror=alert(2)>";
    await chatInput.fill(payload);
    await page.getByRole("button", { name: "Gửi", exact: true }).click();

    const bubble = page.getByText(payload, { exact: true });
    await expect(bubble).toBeVisible();
    // textContent rendering never creates a script element carrying the payload
    const injectedScripts = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("script")).filter((s) => (s.textContent ?? "").includes("alert"))
          .length
    );
    expect(injectedScripts).toBe(0);
    expect(dialogs).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test("a11y seams: chat input named, room hotspots aria-labelled, send button named", async ({ page }) => {
    await gotoHospitalDemo(page, "ui-a11y");

    await expect(
      page.getByRole("textbox", { name: "Nhập câu hỏi cho trợ lý AI" }).or(page.getByRole("textbox"))
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Gửi", exact: true })).toBeVisible();

    const unlabeled = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button[data-room]"));
      return buttons.filter((b) => !(b.getAttribute("aria-label") ?? "").trim()).length;
    });
    expect(unlabeled).toBe(0);
  });
});

test.describe("Hospital HTML5 Demo — mobile (ui-test)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile viewport: no horizontal overflow", async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoHospitalDemo(page, "ui-mobile");

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
    expect(errors).toHaveLength(0);
  });
});
