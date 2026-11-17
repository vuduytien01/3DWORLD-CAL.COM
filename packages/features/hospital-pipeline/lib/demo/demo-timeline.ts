/**
 * Composer demo — nối camera-choreography + demo-script + wait-simulation
 * thành MỘT truy vấn trạng thái theo giây, cho HUD trang hospital-demo (T-07)
 * và cho việc ghi video dự phòng. Module thuần, deterministic.
 */

import { buildChoreography, type ChoreographySegment } from "./camera-choreography";
import { buildDemoScript, narrationAt, type DemoBeat, type DemoScript } from "./demo-script";
import { createWaitTimeline, readWaitAt, type WaitStepInput, type WaitSnapshot } from "./wait-simulation";

/** Trạng thái tổng hợp của demo tại một mốc giây */
export interface DemoStateAt {
  /** lời dẫn đang phát (undefined trước intro nếu timeline trống) */
  narration: DemoBeat | undefined;
  /** segment camera đang chiếu */
  cameraSegment: ChoreographySegment | undefined;
  /** trạng thái chờ của bước hiện tại (undefined nếu timeline chờ rỗng) */
  wait: WaitSnapshot | undefined;
  elapsedDemoSeconds: number;
}

export interface DemoTimeline {
  script: DemoScript;
  segments: readonly ChoreographySegment[];
  /** đọc trạng thái tại một mốc giây demo */
  stateAt(elapsedDemoSeconds: number): DemoStateAt;
  /** Programmatic seek: clamps to [0, 180] and returns state at that time. Used by keyboard controls. */
  seek(elapsedDemoSeconds: number): DemoStateAt;
}

const DEMO_WAIT_INPUTS: readonly WaitStepInput[] = [
  { stepId: "step-ticket", waitMinutes: 3 },
  { stepId: "step-queue", waitMinutes: 22 },
  { stepId: "step-consultation", waitMinutes: 8 },
  { stepId: "step-lab", waitMinutes: 15 },
  { stepId: "step-re-consult", waitMinutes: 12 },
  { stepId: "step-conclusion", waitMinutes: 5 },
  { stepId: "step-admission", waitMinutes: 10 },
  { stepId: "step-payment", waitMinutes: 6 },
];

/**
 * Dựng timeline tổng hợp. waitSteps mặc định lấy ước lượng ca sáng của STEP_LOCATIONS
 * (phút thật; wait-simulation nén 30x khi phát). Truyền waitSteps riêng nếu demo
 * muốn kịch bản chờ khác.
 */
export function composeDemoTimeline(waitSteps: readonly WaitStepInput[] = DEMO_WAIT_INPUTS): DemoTimeline {
  const script = buildDemoScript();
  const segments = buildChoreography();
  const waitTimeline = createWaitTimeline(waitSteps);
  const lastSegment = segments[segments.length - 1];

  const clamp = (t: number): number => Math.min(Math.max(t, 0), lastSegment.endS);

  const stateAt = (elapsedDemoSeconds: number): DemoStateAt => {
    // Don't clamp here - let callers handle out-of-bounds (e.g., patientWalkAt expects null segment)
    const t = elapsedDemoSeconds;
    return {
      narration: narrationAt(script, t),
      cameraSegment: segments.find((s) => t >= s.startS && t < s.endS),
      wait: readWaitAt(waitTimeline, t),
      elapsedDemoSeconds: t,
    };
  };

  const seek = (elapsedDemoSeconds: number): DemoStateAt => {
    // seek clamps to valid range for programmatic control
    return stateAt(clamp(elapsedDemoSeconds));
  };

  return {
    script,
    segments,
    stateAt,
    seek,
  };
}
