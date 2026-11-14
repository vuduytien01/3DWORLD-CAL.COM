/**
 * Demo record — take 1 of the plan B video fallback (demo-risk-plan.md).
 *
 * Records /hospital-demo for the full 180s camera choreography into a webm.
 * Playwright only flushes the encoder when the page/context closes, so the
 * finally block closes in order and pins the artifact to take1.webm.
 * Gated behind DEMO_RECORD=1: recording adds 15-30% CPU overhead (research/12),
 * so the baseline e2e suite must never pick this up by default.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { type Page, test } from "@playwright/test";

test.skip(
  process.env.DEMO_RECORD !== "1",
  "Opt-in recording: run with DEMO_RECORD=1 on a free dev server (180s hold + GPU load)"
);

test.describe.configure({ retries: 0 });

/** camera-choreography.ts holds DEMO_DURATION_S = 180; +5s lets the outro crane land before flush. */
const DEMO_HOLD_MS = 185_000;

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const TAKE_DIR = path.join(REPO_ROOT, ".scratch", "hospital-pipeline", "demo-takes");
const TAKE_1_PATH = path.join(TAKE_DIR, "take1.webm");

test.setTimeout(420_000);

test("record demo take 1 — full 180s timeline to take1.webm", async ({ browser }) => {
  fs.mkdirSync(TAKE_DIR, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1100, height: 700 },
    recordVideo: { dir: TAKE_DIR, size: { width: 1100, height: 700 } },
  });
  const page = await context.newPage();

  try {
    await page.goto("/hospital-demo", { waitUntil: "networkidle" });
    await waitHtml5Ready(page);

    // timed hold, not a perf assertion — this take may run beside compile agents
    await page.waitForTimeout(DEMO_HOLD_MS);
  } finally {
    const video = page.video();
    await page.close();
    // saveAs blocks until the encoder finishes even though the page already closed
    await video?.saveAs(TAKE_1_PATH);
    await context.close();
  }
});

async function waitHtml5Ready(page: Page): Promise<void> {
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45000,
  });
}
