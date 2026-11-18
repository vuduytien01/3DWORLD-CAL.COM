/**
 * Hospital demo — soak harness (soak-test skill, automated subset)
 *
 * The soak skill's full protocol is a human observation run (30m to hours)
 * documented in docs/hospital-3d-soak-test-protocol.md. This file is the
 * machine half of the same protocol: it replays full-demo cycles against a
 * real browser and samples the leak signals at fixed checkpoints — DOM node
 * count, heap (performance.memory), the four-field perf mirror and canvas
 * count — then fails on accumulation that a short test cannot see:
 *
 *   - DOM node count that keeps rising (3+ consecutive rising checkpoints and
 *     > 15% over baseline) → repeated overlay rebuilds leak nodes
 *   - heap > 20% over baseline → page or worker leak candidate
 *   - sustained fps < 15 → renderer degradation over time
 *   - canvas count ≠ 2 or readiness lost → structural breakage
 *
 * Guarded by SOAK_TEST=1 (the PERF_T09 pattern): the file is a no-op in the
 * regular gate and only runs when the operator asks for an endurance pass on
 * an idle machine. Run with:  $env:SOAK_TEST = "1"  before the playwright
 * command; port 3000 must already serve /hospital-demo.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.describe.configure({ retries: 0 });

interface SoakSample {
  label: string;
  atMs: number;
  heap: number | null;
  domNodes: number;
  canvases: number;
  ready: boolean;
  fps: number | null;
  frameMs: number | null;
  tris: number | null;
}

interface SoakReport {
  runAt: string;
  sampleIntervalMs: number;
  cycles: number;
  samples: SoakSample[];
  verdicts: string[];
}

const SOAK_MINUTES = Number(process.env.SOAK_MINUTES ?? "6");
const SAMPLE_INTERVAL_MS = 60_000;
const FULL_DEMO_MS = 180_000;
const CYCLES = 2;

async function gotoHospitalDemo(page: Page, session: string): Promise<void> {
  await page.goto(`/hospital-demo?session=${session}&t=0`, { waitUntil: "networkidle", timeout: 150_000 });
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45000,
  });
}

async function sample(page: Page, label: string): Promise<SoakSample> {
  return page.evaluate((l) => {
    const w = window as unknown as {
      __HOSPITAL_PERF__?: { fps: number; frameMs: number; calls: number; tris: number };
    };
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      label: l,
      atMs: Date.now(),
      heap: mem?.usedJSHeapSize ?? null,
      domNodes: document.getElementsByTagName("*").length,
      canvases: document.querySelectorAll("canvas.html5-canvas").length,
      ready: document.querySelector('[data-hospital-ready="true"]') !== null,
      fps: w.__HOSPITAL_PERF__?.fps ?? null,
      frameMs: w.__HOSPITAL_PERF__?.frameMs ?? null,
      tris: w.__HOSPITAL_PERF__?.tris ?? null,
    };
  }, label);
}

function analyze(samples: SoakSample[]): string[] {
  const verdicts: string[] = [];
  if (samples.length < 2) {
    return ["not enough samples"];
  }

  const baselineDom = samples[0].domNodes;
  let worstDom = baselineDom;
  let risingRun = 0;
  let maxRisingRun = 0;
  let prevDom = baselineDom;
  for (const s of samples.slice(1)) {
    worstDom = Math.max(worstDom, s.domNodes);
    risingRun = s.domNodes > prevDom ? risingRun + 1 : 0;
    maxRisingRun = Math.max(maxRisingRun, risingRun);
    prevDom = s.domNodes;
  }
  const domGrowth = baselineDom > 0 ? (worstDom - baselineDom) / baselineDom : 0;

  const firstHeap = samples[0].heap;
  const lastHeap = samples[samples.length - 1].heap;
  const heapGrowth = firstHeap && lastHeap && firstHeap > 0 ? (lastHeap - firstHeap) / firstHeap : 0;

  const lowFps = samples.filter((s) => s.fps !== null && s.fps < 15).length;

  if (domGrowth > 0.15 && maxRisingRun >= 3) {
    verdicts.push(
      `DOM accumulation: +${(domGrowth * 100).toFixed(1)}% over baseline, longest rising run ${maxRisingRun}`
    );
  }
  if (heapGrowth > 0.2) {
    verdicts.push(`heap growth +${(heapGrowth * 100).toFixed(1)}% over baseline`);
  }
  if (lowFps > 0) {
    verdicts.push(`${lowFps} sample(s) below 15 fps`);
  }
  return verdicts;
}

test("soak: full-demo cycles without DOM/heap accumulation", async ({ page }) => {
  test.skip(!process.env.SOAK_TEST, "soak requires SOAK_TEST=1 (docs/hospital-3d-soak-test-protocol.md)");
  test.setTimeout(SOAK_MINUTES * 60_000 + 5 * 60_000);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const samples: SoakSample[] = [];
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    await gotoHospitalDemo(page, `soak-${cycle}`);
    samples.push(await sample(page, `cycle-${cycle}-start`));
    const cycleEndsAt = Date.now() + FULL_DEMO_MS;
    while (Date.now() < cycleEndsAt) {
      await page.waitForTimeout(SAMPLE_INTERVAL_MS);
      samples.push(await sample(page, `cycle-${cycle}-t=${Math.round((cycleEndsAt - Date.now()) / 1000)}s`));
    }
  }

  const verdicts = analyze(samples);
  const report: SoakReport = {
    runAt: new Date().toISOString(),
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    cycles: CYCLES,
    samples,
    verdicts,
  };
  const reportPath = path.join(process.cwd(), "test-results", "soak-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const last = samples[samples.length - 1];
  console.log(
    `[soak] samples=${samples.length} dom=${last.domNodes} heap=${last.heap} fps=${last.fps} verdicts=${JSON.stringify(verdicts)}`
  );

  // Hard structural invariants hold every checkpoint
  for (const s of samples) {
    expect(s.ready, `ready at ${s.label}`).toBe(true);
    expect(s.canvases, `canvas count at ${s.label}`).toBe(2);
  }
  expect(pageErrors, "no uncaught page exceptions").toHaveLength(0);
  expect(verdicts, `soak verdicts: ${JSON.stringify(verdicts)} — see ${reportPath}`).toHaveLength(0);
});
