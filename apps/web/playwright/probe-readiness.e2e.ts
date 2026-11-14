/**
 * Diagnostic probe for the HTML5 hospital demo (ADR 0003).
 *
 * Dumps the renderer's real seams into the console so a failing environment
 * can be read straight from the output: readiness attribute, camera/orbit/
 * perf mirrors, overlay node counts, and any console or page errors. Saves a
 * full-page screenshot next to the other hospital-pipeline scratch artifacts.
 * The old WebGL probe is structurally dead here — the first canvas on the
 * page holds a 2D context, so getContext("webgl2") on it returns null.
 */

import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

test.describe.configure({ retries: 0 });

interface HospitalTestWindow {
  __HOSPITAL_CAMERA__?: { panX: number; panY: number; zoom: number; focusFloor: number };
  __ORBIT_CONTROLS_ENABLED__?: boolean;
  __HOSPITAL_PERF__?: { fps: number; frameMs: number; calls: number; tris: number };
}

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCREENSHOT_PATH = path.join(REPO_ROOT, ".scratch", "hospital-pipeline", "probe-screenshot.png");

test("probe HTML5 readiness conditions", async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`PAGEERROR: ${error.message.slice(0, 300)}`);
  });

  await page.goto("/hospital-demo", { waitUntil: "networkidle", timeout: 150_000 });

  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45000,
  });

  const probe = await page.evaluate(() => {
    const stage = document.querySelector("[data-hospital-ready]");
    const w = window as unknown as HospitalTestWindow;
    return {
      ready: stage?.getAttribute("data-hospital-ready") ?? null,
      canvasCount: document.querySelectorAll("canvas.html5-canvas").length,
      camera: w.__HOSPITAL_CAMERA__ ?? null,
      orbit: w.__ORBIT_CONTROLS_ENABLED__ ?? null,
      perf: w.__HOSPITAL_PERF__ ?? null,
      floorGroups: document.querySelectorAll("[data-floor]").length,
      stepChips: document.querySelectorAll("[data-step]").length,
      roomHotspots: document.querySelectorAll("[data-room]").length,
      patientMarkers: document.querySelectorAll("[data-patient]").length,
    };
  });

  console.log("PROBE:", JSON.stringify(probe, null, 2));
  console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));

  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`SCREENSHOT: ${SCREENSHOT_PATH}`);
});
