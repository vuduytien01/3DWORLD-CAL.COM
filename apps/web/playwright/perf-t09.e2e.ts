/**
 * T-09 perf checkpoint — one-command runner for the HTML5 renderer wave.
 *
 * Run on an idle machine (headed Edge, dev server reachable on :3000):
 *   PERF_T09=1 npx playwright test apps/web/playwright/perf-t09.e2e.ts --project=@calcom/web-edge
 *
 * Methodology is mandatory from .scratch/hospital-pipeline/swarm/research/08:
 * - headed Edge on the real GPU. Headless Edge still composites Canvas 2D
 *   through software paths, so a headless number is noise, not a measurement.
 * - >= 60 discarded warm-up frames before sampling: first-paint layout and
 *   font loading are one-time costs, not steady state.
 * - median, never mean. The readout is sampled at frame cadence inside the
 *   page; p95/p99 come from the same samples.
 * - thresholds fps >= 27 and p95 frameMs <= 33.4, inherited from the retired
 *   perf-probe module (deleted in c422780e9b; rationale in swarm/research/08):
 *   30 fps budget with ~10% headroom, 1000/30 rounded up so a 33.35ms jitter
 *   frame does not fail.
 *
 * Every number flows through window.__HOSPITAL_PERF__ (the readout mirror the
 * HTML5 renderer writes per frame) — the test never touches canvas internals.
 * Raw rAF deltas are collected alongside as diagnostics (hitches, raw p95)
 * because the readout is EMA-smoothed and hides single-frame stalls. There is
 * no `frames` counter on the HTML5 mirror; the sample count below is this
 * runner's own bookkeeping.
 *
 * Windows follow observable zoom (Ruling D, task-6-brief.md): the aerial
 * window is zoom < 12 right after ready — seeded with ?t=170 so the clamped
 * 180s clock freezes the camera on the outro aerial pose instead of racing
 * the intro descent — and the follow window is zoom > 30 (station hold) on an
 * unseeded load.
 *
 * calls/tris changed meaning in the HTML5 renderer (boxes drawn / overlay
 * nodes), so their old budgets are gone; the observed min-max is recorded in
 * the JSON line for the quiet-machine drill to set new budgets from.
 *
 * Gated behind PERF_T09=1: measurement beside parallel compiles is
 * meaningless (research/12), so this file never runs with the baseline suite.
 */

import process from "node:process";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.skip(
  process.env.PERF_T09 !== "1",
  "Perf checkpoint is opt-in: run with PERF_T09=1 on an idle machine, headed Edge"
);
// 420s: two cold 150s goto budgets + readiness/zoom waits + measure windows
// (same worst-day budget as demo-record)
test.setTimeout(420_000);
test.describe.configure({ retries: 0 });

/** Research/08 §5 thresholds (originally IRIS_XE_RENDER_BUDGET) */
const FPS_MIN = 27;
const P95_FRAME_MS_MAX = 33.4;

/** research/08 §3: 60-90 frames; 90 ≈ 1.5s at 60Hz, upper bound for margin */
const WARMUP_FRAMES = 90;
/** research/08 §4 + brief: >= 300 frames; 360 ≈ 6s at 60Hz, 12s at 30fps */
const MEASURE_FRAMES = 360;

/** Window hooks the HTML5 renderer exposes for E2E tooling */
interface HospitalTestWindow {
  __HOSPITAL_CAMERA__?: { panX: number; panY: number; zoom: number; focusFloor: number };
  __HOSPITAL_PERF__?: { fps: number; frameMs: number; calls: number; tris: number };
}

/** One measurement window: readout samples at frame cadence + raw rAF deltas */
interface PerfWindowResult {
  mode: "aerial" | "follow";
  samples: number;
  durationMs: number;
  medianFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  fpsFromMedianFrameMs: number;
  rawMedianFrameMs: number;
  rawP95FrameMs: number;
  hitches: number;
  callsMin: number;
  callsMax: number;
  trisMin: number;
  trisMax: number;
}

/** Frame client → Guide Service (frozen, lib/ai-guide/server.ts) */
interface GuideClientFrame {
  type: "init" | "user" | "ping" | "health";
  sessionId?: string;
  content?: string;
}

/**
 * Mock the Guide Service at ws://localhost:3002 (same shape as
 * hospital-demo-guide.e2e.ts). The real service is demo infra that must not
 * gate a checkpoint, and an unmocked socket means reconnect retries burn CPU
 * inside the measurement window — exactly the noise research/08 exists to
 * avoid. Narrow host match keeps the Next.js HMR socket untouched.
 */
async function mockGuideService(page: Page): Promise<void> {
  await page.routeWebSocket(
    (url) => url.protocol === "ws:" && url.host === "localhost:3002",
    (ws) => {
      ws.onMessage((raw) => {
        let frame: GuideClientFrame;
        try {
          frame = JSON.parse(String(raw)) as GuideClientFrame;
        } catch {
          return;
        }
        if (frame.type === "init") {
          ws.send(
            JSON.stringify({
              type: "system",
              content: "Đã kết nối. Chào bạn!",
              sessionId: frame.sessionId ?? "hospital-demo-chat",
              metadata: { stepId: "step-ticket" },
            })
          );
          return;
        }
        if (frame.type === "user") {
          ws.send(
            JSON.stringify({
              type: "assistant",
              content: "mock",
              metadata: { templateId: "fallback", usedLLM: false },
            })
          );
          return;
        }
        if (frame.type === "ping") {
          ws.send(JSON.stringify({ type: "system", content: "pong" }));
        }
      });
    }
  );
}

/** Open the demo page and wait until the HTML5 renderer claims readiness */
async function gotoHospitalDemo(page: Page, query = ""): Promise<void> {
  // First hit on a cold dev server compiles /hospital-demo on the fly; the
  // generous navigation timeout keeps that one-time compile inside the budget
  await page.goto(`/hospital-demo${query}`, { waitUntil: "networkidle", timeout: 150_000 });

  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45_000,
  });
}

/**
 * One measurement window: a warm-up phase of warmupFrames rAF ticks whose
 * samples are discarded, then a measure phase of measureFrames samples of
 * window.__HOSPITAL_PERF__ taken at frame cadence. Raw rAF deltas run the
 * whole time for the hitch count and the unsmoothed p95.
 */
async function measureWindow(
  page: Page,
  mode: "aerial" | "follow",
  warmupFrames: number,
  measureFrames: number
): Promise<PerfWindowResult> {
  return page.evaluate(
    ({ mode, warmupFrames, measureFrames }) =>
      new Promise<PerfWindowResult>((resolve, reject) => {
        const readout = () => (window as unknown as HospitalTestWindow).__HOSPITAL_PERF__;
        if (!readout()) {
          reject(new Error("window.__HOSPITAL_PERF__ missing — HTML5 renderer not mounted"));
          return;
        }
        // Nearest-rank percentile; median is the p50
        const percentile = (values: number[], p: number) => {
          const sorted = [...values].sort((a, b) => a - b);
          const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
          return sorted[idx];
        };
        let phase: "warmup" | "measure" = "warmup";
        let phaseCount = 0;
        let lastNow: number | null = null;
        let windowStart = 0;
        const fpsSamples: number[] = [];
        const frameMsSamples: number[] = [];
        const rawDeltas: number[] = [];
        const callsSamples: number[] = [];
        const trisSamples: number[] = [];
        const tick = (now: number) => {
          const read = readout();
          if (!read) {
            reject(new Error("window.__HOSPITAL_PERF__ disappeared mid-window"));
            return;
          }
          if (lastNow !== null) {
            const dt = now - lastNow;
            // A tab switch or long stall fabricates a huge dt; drop beyond 1s
            if (dt > 0 && dt < 1000) rawDeltas.push(dt);
          }
          lastNow = now;
          phaseCount += 1;
          if (phase === "measure") {
            fpsSamples.push(read.fps);
            frameMsSamples.push(read.frameMs);
            callsSamples.push(read.calls);
            trisSamples.push(read.tris);
            if (fpsSamples.length >= measureFrames) {
              const rawMedian = percentile(rawDeltas, 50);
              const rawP95 = percentile(rawDeltas, 95);
              // profile.mjs definition: hitch = dt > max(2×median, median+8ms)
              const hitchLimit = Math.max(2 * rawMedian, rawMedian + 8);
              const medianFrameMs = percentile(frameMsSamples, 50);
              resolve({
                mode,
                samples: fpsSamples.length,
                durationMs: now - windowStart,
                medianFps: percentile(fpsSamples, 50),
                medianFrameMs,
                p95FrameMs: percentile(frameMsSamples, 95),
                p99FrameMs: percentile(frameMsSamples, 99),
                fpsFromMedianFrameMs: Number((1000 / medianFrameMs).toFixed(1)),
                rawMedianFrameMs: Number(rawMedian.toFixed(2)),
                rawP95FrameMs: Number(rawP95.toFixed(2)),
                hitches: rawDeltas.filter((dt) => dt > hitchLimit).length,
                callsMin: Math.min(...callsSamples),
                callsMax: Math.max(...callsSamples),
                trisMin: Math.min(...trisSamples),
                trisMax: Math.max(...trisSamples),
              });
              return;
            }
          } else if (phaseCount >= warmupFrames) {
            phase = "measure";
            phaseCount = 0;
            windowStart = now;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { mode, warmupFrames, measureFrames }
  );
}

test("T-09: aerial + follow đạt ngưỡng perf (fps >= 27, p95 frameMs <= 33.4ms)", async ({ page }) => {
  await mockGuideService(page);

  // Liveness: at least two frames sampled (fps leaves 0 at frame two). The
  // 2D canvases have no renderer string to gate on — a software-composited
  // run still draws, so the honest guard is that the loop is alive at all.
  const assertPerfAlive = async (): Promise<void> => {
    await page.waitForFunction(
      () => ((window as unknown as HospitalTestWindow).__HOSPITAL_PERF__?.fps ?? 0) > 0,
      undefined,
      { timeout: 30_000 }
    );
  };

  // AERIAL — zoom < 12 after ready. ?t=170 lands on the outro crane with the
  // clock clamping at 180s, so the camera freezes on the aerial pose and the
  // window cannot race the intro descent out of the aerial regime
  await gotoHospitalDemo(page, "?t=170");
  await assertPerfAlive();
  await page.waitForFunction(
    () => ((window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.zoom ?? Infinity) < 12,
    undefined,
    { timeout: 15_000 }
  );
  const aerial = await measureWindow(page, "aerial", WARMUP_FRAMES, MEASURE_FRAMES);

  // FOLLOW — zoom > 30 on an unseeded load: the intro crane reaches the
  // ticket station hold around t≈9-10s and the zoom stays in the follow
  // regime through the station holds that follow it
  await gotoHospitalDemo(page);
  await assertPerfAlive();
  await page.waitForFunction(
    () => ((window as unknown as HospitalTestWindow).__HOSPITAL_CAMERA__?.zoom ?? 0) > 30,
    undefined,
    { timeout: 30_000 }
  );
  const follow = await measureWindow(page, "follow", WARMUP_FRAMES, MEASURE_FRAMES);

  // Hard gates. Failure messages carry every measured number so the report
  // writes itself from the assertion output alone
  expect(
    aerial.medianFps,
    `aerial: median fps ${aerial.medianFps} < ${FPS_MIN} | p95 frameMs ${aerial.p95FrameMs}ms, ` +
      `median frameMs ${aerial.medianFrameMs}ms, ${aerial.samples} samples / ${Math.round(aerial.durationMs)}ms, ` +
      `calls ${aerial.callsMin}-${aerial.callsMax}, tris ${aerial.trisMin}-${aerial.trisMax}, ` +
      `hitches ${aerial.hitches}, raw p95 ${aerial.rawP95FrameMs}ms`
  ).toBeGreaterThanOrEqual(FPS_MIN);
  expect(
    aerial.p95FrameMs,
    `aerial: p95 frameMs ${aerial.p95FrameMs}ms > ${P95_FRAME_MS_MAX}ms | median fps ${aerial.medianFps}, ` +
      `median frameMs ${aerial.medianFrameMs}ms, ${aerial.samples} samples, hitches ${aerial.hitches}`
  ).toBeLessThanOrEqual(P95_FRAME_MS_MAX);
  expect(
    follow.medianFps,
    `follow: median fps ${follow.medianFps} < ${FPS_MIN} | p95 frameMs ${follow.p95FrameMs}ms, ` +
      `median frameMs ${follow.medianFrameMs}ms, ${follow.samples} samples / ${Math.round(follow.durationMs)}ms, ` +
      `calls ${follow.callsMin}-${follow.callsMax}, tris ${follow.trisMin}-${follow.trisMax}, ` +
      `hitches ${follow.hitches}, raw p95 ${follow.rawP95FrameMs}ms`
  ).toBeGreaterThanOrEqual(FPS_MIN);
  expect(
    follow.p95FrameMs,
    `follow: p95 frameMs ${follow.p95FrameMs}ms > ${P95_FRAME_MS_MAX}ms | median fps ${follow.medianFps}, ` +
      `median frameMs ${follow.medianFrameMs}ms, ${follow.samples} samples, hitches ${follow.hitches}`
  ).toBeLessThanOrEqual(P95_FRAME_MS_MAX);

  // Single-line JSON — paste this verbatim into swarm/reports/perf-t09.md.
  // calls = boxes drawn on the static layer, tris = overlay nodes; new budget
  // ceilings are decided from these observed values on a quiet machine
  console.log(
    `PERF_T09_JSON: ${JSON.stringify({
      date: "2026-11-14",
      renderer: "html5-canvas2d",
      thresholds: { fpsMin: FPS_MIN, p95FrameMsMax: P95_FRAME_MS_MAX },
      warmupFrames: WARMUP_FRAMES,
      aerial,
      follow,
      pass: true,
    })}`
  );
});
