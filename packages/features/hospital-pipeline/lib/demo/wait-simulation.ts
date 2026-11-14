/**
 * T-06 — Mô phỏng thời gian chờ cho demo 3 phút.
 *
 * Quyết định thiết kế (chốt mục "Not yet specified" của map.md): demo KHÔNG chạy
 * thời gian thật (chờ 20-60 phút là vô dụng trước ban giám khảo). Mặc định NÉN
 * thời gian 30x (2 giây demo = 1 phút chờ), có timeScale để presenter đổi 1:1
 * hoặc tua nhanh. Module thuần, deterministic, không đụng DOM/three.js.
 */

/** Dữ liệu chờ đầu vào cho một bước trong pipeline (khớp shape waitEstimate của STEP_LOCATIONS) */
export interface WaitStepInput {
  /** id bước pipeline, vd "checkin" | "queue" | "vital-sign" */
  stepId: string;
  /** ước lượng chờ thật (phút) — nguồn: waitEstimate trong STEP_LOCATIONS */
  waitMinutes: number;
  /** số STT tại thời điểm bắt đầu bước (tuỳ chọn, mặc định suy từ thứ tự) */
  queuePosition?: number;
}

export type WaitState = 'waiting' | 'called';

/** Trạng thái chờ của một bước tại một mốc thời gian demo */
export interface WaitSnapshot {
  stepId: string;
  /** phút chờ còn lại (thời gian thực mô phỏng, đã làm tròn 1 chữ số thập phân) */
  minutesRemaining: number;
  /** STT hiện tại của bệnh nhân */
  queuePosition: number;
  /** giây demo đã trôi qua tính từ đầu timeline */
  elapsedDemoSeconds: number;
  state: WaitState;
}

/** Mốc đã lên lịch của một bước: đủ để scrub/xem trước mà không cần chạy đồng hồ */
export interface WaitTimelineEntry {
  stepId: string;
  waitMinutes: number;
  queuePosition: number;
  /** giây demo khi bước bắt đầu */
  startDemoSeconds: number;
  /** giây demo khi bước được gọi (start + waitMinutes * secondsPerMinute) */
  calledDemoSeconds: number;
}

export interface WaitTimelineOptions {
  /**
   * hệ số nén: bao nhiêu giây demo ứng với 1 phút chờ thật.
   * Mặc định 2 (nén 30x) để một chờ 20 phút chơi trong 40 giây, vừa kịch bản 180s.
   * Đặt 60 để chạy thời gian thật 1:1.
   */
  secondsPerMinute?: number;
  /** STT bắt đầu, mặc định 101 (khớp session.stt của AI guide) */
  startingQueuePosition?: number;
}

const DEFAULT_SECONDS_PER_MINUTE = 2;
const DEFAULT_STARTING_QUEUE = 101;

/** Lên lịch toàn bộ chuỗi chờ của demo theo thứ tự các bước */
export function createWaitTimeline(
  steps: readonly WaitStepInput[],
  options: WaitTimelineOptions = {},
): WaitTimelineEntry[] {
  const secondsPerMinute = options.secondsPerMinute ?? DEFAULT_SECONDS_PER_MINUTE;
  if (secondsPerMinute <= 0) {
    throw new Error(`secondsPerMinute phải > 0, nhận ${secondsPerMinute}`);
  }
  let cursor = 0;
  let queue = options.startingQueuePosition ?? DEFAULT_STARTING_QUEUE;
  return steps.map((step) => {
    const called = cursor + step.waitMinutes * secondsPerMinute;
    const entry: WaitTimelineEntry = {
      stepId: step.stepId,
      waitMinutes: step.waitMinutes,
      queuePosition: step.queuePosition ?? queue,
      startDemoSeconds: cursor,
      calledDemoSeconds: called,
    };
    // mỗi bước tiêu tốn đúng khoảng chờ của nó; bước tiếp theo bắt đầu khi bước này được gọi
    cursor = called;
    queue += 1;
    return entry;
  });
}

/** Đọc trạng thái chờ tại một mốc giây demo — pure, deterministic */
export function readWaitAt(
  timeline: readonly WaitTimelineEntry[],
  elapsedDemoSeconds: number,
): WaitSnapshot | undefined {
  const idx = timeline.findIndex((e) => elapsedDemoSeconds < e.calledDemoSeconds);
  const anchor = idx >= 0 ? timeline[idx] : timeline[timeline.length - 1];
  if (!anchor) return undefined;
  // quá hết timeline: neo vào bước cuối, chờ đã gọi xong
  const pastEnd = idx < 0;
  const span = anchor.calledDemoSeconds - anchor.startDemoSeconds || 1;
  const minutesRemainingRaw = pastEnd ? 0 : ((anchor.calledDemoSeconds - elapsedDemoSeconds) / span) * anchor.waitMinutes;
  const state: WaitState = pastEnd || anchor.waitMinutes === 0 ? 'called' : 'waiting';
  return {
    stepId: anchor.stepId,
    minutesRemaining: Math.round(minutesRemainingRaw * 10) / 10,
    queuePosition: anchor.queuePosition,
    elapsedDemoSeconds,
    state,
  };
}

/** Chuỗi hiển thị cho AI guide / HUD, khớp mẫu "Ước lượng chờ: X phút" */
export function formatWaitEstimate(snapshot: WaitSnapshot): string {
  if (snapshot.state === 'called') return 'Đến lượt bạn — vào ngay';
  const minutes = Math.ceil(snapshot.minutesRemaining);
  return `Ước lượng chờ: ~${minutes} phút`;
}
