import { describe, expect, it } from "vitest";

import { buildChoreography, DEMO_DURATION_S } from "../camera-choreography";
import { AI_GUIDE_TEMPLATE_IDS, buildDemoScript, narrationAt } from "../demo-script";

describe("Demo script (T-13) — cấu trúc", () => {
  const script = buildDemoScript();
  const choreography = buildChoreography();

  it("đủ 10 beat: intro + 8 bước + outro, khớp thứ tự bước của choreography", () => {
    expect(script.beats.length).toBe(10);
    const choreoSteps = [...new Set(choreography.map((s) => s.stepId))];
    const scriptSteps = script.beats.filter((b) => b.stepId !== "").map((b) => b.stepId);
    expect(scriptSteps).toEqual(choreoSteps);
    expect(scriptSteps.length).toBe(8);
  });

  it("cue monotonic tăng và nằm trong 180s", () => {
    let prev = -1;
    for (const beat of script.beats) {
      expect(beat.cueS).toBeGreaterThan(prev);
      expect(beat.cueS).toBeGreaterThanOrEqual(0);
      expect(beat.cueS).toBeLessThan(script.totalDurationS);
      prev = beat.cueS;
    }
    expect(script.totalDurationS).toBe(DEMO_DURATION_S);
    expect(script.totalDurationS).toBe(180);
  });

  it("mọi templateId thuộc bộ 10 template của AI guide", () => {
    for (const beat of script.beats) {
      expect(AI_GUIDE_TEMPLATE_IDS).toContain(beat.templateId);
    }
  });

  it("mỗi lời dẫn đủ dài để đọc nhịp ~10 giây (>= 60 ký tự)", () => {
    for (const beat of script.beats) {
      expect(beat.narration.length, `lời dẫn "${beat.stepId}" quá ngắn`).toBeGreaterThanOrEqual(60);
    }
  });
});

describe("Demo script — phát theo thời gian", () => {
  const script = buildDemoScript();

  it("t=0 phát intro; giữa chừng phát beat gần nhất; cuối phát outro", () => {
    expect(narrationAt(script, 0)?.templateId).toBe("greeting");
    const mid = narrationAt(script, 90);
    expect(mid).toBeDefined();
    const last = narrationAt(script, 179.9);
    expect(last?.templateId).toBe("hospital-info");
    expect(mid?.cueS).toBeLessThanOrEqual(90);
  });

  it("trước cue đầu không phát gì (an toàn khi timeline rỗng)", () => {
    const empty = { beats: [], totalDurationS: 180 };
    expect(narrationAt(empty, 10)).toBeUndefined();
  });

  it("deterministic: dựng hai lần ra cùng kịch bản", () => {
    expect(buildDemoScript()).toEqual(script);
  });
});
