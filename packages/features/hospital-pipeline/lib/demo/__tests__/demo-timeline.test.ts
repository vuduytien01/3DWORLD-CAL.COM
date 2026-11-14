import { describe, expect, it } from "vitest";

import { composeDemoTimeline } from "../demo-timeline";

describe("Demo timeline composer — tổng hợp 3 module", () => {
  const timeline = composeDemoTimeline();

  it("t=0: intro greeting, camera segment đầu, wait của step-ticket đang chờ", () => {
    const state = timeline.stateAt(0);
    expect(state.narration?.templateId).toBe("greeting");
    expect(state.cameraSegment?.stepId).toBe("step-ticket");
    expect(state.wait?.stepId).toBe("step-ticket");
    expect(state.wait?.state).toBe("waiting");
    expect(state.wait?.minutesRemaining).toBe(3);
  });

  it("giữa demo (90s): cả ba trục đều có trạng thái hợp lệ", () => {
    const state = timeline.stateAt(90);
    expect(state.narration).toBeDefined();
    expect(state.cameraSegment).toBeDefined();
    expect(state.wait).toBeDefined();
    expect(state.narration!.cueS).toBeLessThanOrEqual(90);
    expect(state.cameraSegment!.startS).toBeLessThanOrEqual(90);
    expect(state.cameraSegment!.endS).toBeGreaterThan(90);
  });

  it("cuối demo (179s): outro hospital-info, wait called", () => {
    const state = timeline.stateAt(179);
    expect(state.narration?.templateId).toBe("hospital-info");
    expect(state.wait?.state).toBe("called");
  });

  it("kịch bản chờ riêng được nhận vào (secondsPerMinute của wait-simulation vẫn 30x mặc định)", () => {
    const custom = composeDemoTimeline([{ stepId: "step-ticket", waitMinutes: 60, queuePosition: 7 }]);
    expect(custom.stateAt(0).wait?.minutesRemaining).toBe(60);
    expect(custom.stateAt(0).wait?.queuePosition).toBe(7);
  });

  it("deterministic: dựng hai lần, cùng trạng thái tại 45s", () => {
    expect(composeDemoTimeline().stateAt(45)).toEqual(composeDemoTimeline().stateAt(45));
  });
});
