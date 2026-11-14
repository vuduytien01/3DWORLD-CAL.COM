import { describe, expect, it } from 'vitest';

import {
  createWaitTimeline,
  formatWaitEstimate,
  readWaitAt,
  type WaitStepInput,
} from '../wait-simulation';

const DEMO_STEPS: WaitStepInput[] = [
  { stepId: 'checkin', waitMinutes: 5 },
  { stepId: 'queue', waitMinutes: 20 },
  { stepId: 'vital-sign', waitMinutes: 10 },
];

describe('Wait simulation — timeline', () => {
  it('lên lịch tuần tự: bước sau bắt đầu khi bước trước được gọi', () => {
    const timeline = createWaitTimeline(DEMO_STEPS, { secondsPerMinute: 2 });
    expect(timeline.map((e) => e.stepId)).toEqual(['checkin', 'queue', 'vital-sign']);
    expect(timeline[0].startDemoSeconds).toBe(0);
    expect(timeline[0].calledDemoSeconds).toBe(10); // 5 phút * 2s
    expect(timeline[1].startDemoSeconds).toBe(10);
    expect(timeline[1].calledDemoSeconds).toBe(50); // + 20 phút * 2s
    expect(timeline[2].calledDemoSeconds).toBe(70); // + 10 phút * 2s
  });

  it('STT tăng dần từ mặc định 101 và nhận giá trị truyền vào', () => {
    const timeline = createWaitTimeline(DEMO_STEPS);
    expect(timeline.map((e) => e.queuePosition)).toEqual([101, 102, 103]);
    const custom = createWaitTimeline([{ stepId: 'x', waitMinutes: 1, queuePosition: 42 }]);
    expect(custom[0].queuePosition).toBe(42);
  });

  it('chặn secondsPerMinute <= 0 (tránh nén vô nghĩa)', () => {
    expect(() => createWaitTimeline(DEMO_STEPS, { secondsPerMinute: 0 })).toThrow();
    expect(() => createWaitTimeline(DEMO_STEPS, { secondsPerMinute: -2 })).toThrow();
  });

  it('timeline rỗng → đọc bất kỳ mốc nào đều undefined', () => {
    expect(readWaitAt([], 0)).toBeUndefined();
  });
});

describe('Wait simulation — đọc trạng thái', () => {
  const timeline = createWaitTimeline(DEMO_STEPS, { secondsPerMinute: 2 });

  it('đầu bước: full wait, state waiting', () => {
    const snap = readWaitAt(timeline, 0);
    expect(snap).toMatchObject({ stepId: 'checkin', minutesRemaining: 5, state: 'waiting' });
  });

  it('giữa chờ: minutesRemaining giảm tuyến tính với hệ số nén', () => {
    const snap = readWaitAt(timeline, 5); // nửa chờ checkin (10s tổng)
    expect(snap).toMatchObject({ stepId: 'checkin', minutesRemaining: 2.5, state: 'waiting' });
  });

  it('hết chờ đúng lúc: sang bước kế, mốc cuối timeline là called', () => {
    expect(readWaitAt(timeline, 10)).toMatchObject({ stepId: 'queue', state: 'waiting' });
    // mốc 49.9s: vẫn trong chờ queue (gọi lúc 50)
    const beforeCall = readWaitAt(timeline, 49.9);
    expect(beforeCall?.stepId).toBe('queue');
    // mốc 70s (hết timeline): bước cuối called, còn lại 0 phút
    expect(readWaitAt(timeline, 70)).toMatchObject({ stepId: 'vital-sign', state: 'called', minutesRemaining: 0 });
  });

  it('overshoot quá timeline neo vào bước cuối với state called', () => {
    expect(readWaitAt(timeline, 999)).toMatchObject({ stepId: 'vital-sign', state: 'called', minutesRemaining: 0 });
  });

  it('deterministic: cùng input hai lần ra cùng kết quả', () => {
    const a = readWaitAt(timeline, 37);
    const b = readWaitAt(createWaitTimeline(DEMO_STEPS, { secondsPerMinute: 2 }), 37);
    expect(a).toEqual(b);
  });
});

describe('Wait simulation — format hiển thị', () => {
  const timeline = createWaitTimeline(DEMO_STEPS, { secondsPerMinute: 2 });

  it('waiting → mẫu "Ước lượng chờ: ~X phút" khớp copy AI guide', () => {
    expect(formatWaitEstimate(readWaitAt(timeline, 0)!)).toBe('Ước lượng chờ: ~5 phút');
    expect(formatWaitEstimate(readWaitAt(timeline, 5)!)).toBe('Ước lượng chờ: ~3 phút');
  });

  it('called → báo vào ngay (gồm bước waitMinutes = 0 và overshoot cuối timeline)', () => {
    const zero = createWaitTimeline([{ stepId: 'lucky', waitMinutes: 0 }]);
    expect(formatWaitEstimate(readWaitAt(zero, 0)!)).toBe('Đến lượt bạn — vào ngay');
    expect(formatWaitEstimate(readWaitAt(timeline, 999)!)).toBe('Đến lượt bạn — vào ngay');
  });
});
