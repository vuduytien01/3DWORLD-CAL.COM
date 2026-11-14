/**
 * Template-first routing corpus — measures the real hit rate.
 *
 * The corpus is handwritten realistic patient questions (Vietnamese, with
 * diacritics as patients actually type). "Hit" = routed to the expected
 * template; a case expected to miss counts as correct only when the matcher
 * returns null (→ LLM), and we also verify that miss actually falls back to
 * the LLM stub at the service level.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { matchTemplate, TEMPLATE_IDS } from '../templates';
import { createSession, sessions, type GuideSession } from '../session';
import { handleMessage } from '../handler';

interface CorpusCase {
  msg: string;
  /** Expected template id, or null when the message must miss to the LLM */
  expect: (typeof TEMPLATE_IDS)[number] | null;
  /** For department-direction: expected department code */
  deptCode?: string;
}

const CORPUS: readonly CorpusCase[] = [
  // greeting
  { msg: 'Chào bạn', expect: 'greeting' },
  { msg: 'Xin chào', expect: 'greeting' },
  { msg: 'hello', expect: 'greeting' },
  { msg: 'Chào bệnh viện', expect: 'greeting' },
  { msg: 'Chào anh chị', expect: 'greeting' },
  { msg: 'Hi', expect: 'greeting' },
  { msg: 'Em chào ạ', expect: 'greeting' },
  { msg: 'Chào buổi sáng', expect: 'greeting' },

  // current-status
  { msg: 'menu', expect: 'current-status' },
  { msg: 'giúp', expect: 'current-status' },
  { msg: 'help', expect: 'current-status' },
  { msg: 'Tôi đang ở đâu?', expect: 'current-status' },
  { msg: 'Trạng thái của tôi là gì?', expect: 'current-status' },
  { msg: 'Tôi đang ở bước nào?', expect: 'current-status' },
  { msg: 'status', expect: 'current-status' },
  { msg: 'Tôi đang ở đâu rồi?', expect: 'current-status' },

  // wait-update
  { msg: 'Còn chờ bao lâu?', expect: 'wait-update' },
  { msg: 'Chờ thêm nữa không?', expect: 'wait-update' },
  { msg: 'Bao lâu nữa đến lượt tôi?', expect: 'wait-update' },
  { msg: 'Thời gian chờ thế nào?', expect: 'wait-update' },
  { msg: 'wait', expect: 'wait-update' },
  { msg: 'ETA của tôi?', expect: 'wait-update' },
  { msg: 'Phải chờ bao nhiêu phút?', expect: 'wait-update' },
  { msg: 'Đến lượt tôi chưa?', expect: 'wait-update' },

  // next-step
  { msg: 'Bước tiếp theo là gì?', expect: 'next-step' },
  { msg: 'Tiếp theo đi đâu?', expect: 'next-step' },
  { msg: 'Xong rồi thì làm gì?', expect: 'next-step' },
  { msg: 'next', expect: 'next-step' },
  { msg: 'Sau khi khám xong đi đâu?', expect: 'next-step' },
  { msg: 'Bước sau là gì?', expect: 'next-step' },
  { msg: 'Tôi phải đi đâu tiếp?', expect: 'next-step' },
  { msg: 'Qua phòng nào tiếp?', expect: 'next-step' },

  // department-direction
  { msg: 'Khoa nội ở đâu?', expect: 'department-direction', deptCode: 'KHOA_NOI' },
  { msg: 'Khoa ngoại đi đường nào?', expect: 'department-direction', deptCode: 'KHOA_NGOAI' },
  { msg: 'Khoa mắt ở tầng nào?', expect: 'department-direction', deptCode: 'KHOA_MAT' },
  { msg: 'Phòng khám TMH ở đâu?', expect: 'department-direction', deptCode: 'KHOA_TMH' },
  { msg: 'KHOA_RHM ở đâu?', expect: 'department-direction', deptCode: 'KHOA_RHM' },
  { msg: 'Khoa răng hàm mặt sao đi?', expect: 'department-direction', deptCode: 'KHOA_RHM' },
  { msg: 'Khoa chẩn đoán hình ảnh ở đâu?', expect: 'department-direction', deptCode: 'KHOA_CDHA' },
  { msg: 'Phòng siêu âm ở đâu?', expect: 'department-direction', deptCode: 'KHOA_CDHA' },
  { msg: 'Phòng X-quang ở đâu?', expect: 'department-direction', deptCode: 'KHOA_CDHA' },
  { msg: 'Quầy tiếp đón ở đâu?', expect: 'department-direction', deptCode: 'KHOA_TIEP_DON' },

  // cost-estimate
  { msg: 'Chi phí bao nhiêu?', expect: 'cost-estimate' },
  { msg: 'Giá khám thế nào?', expect: 'cost-estimate' },
  { msg: 'Khám mất bao nhiêu tiền?', expect: 'cost-estimate' },
  { msg: 'cost', expect: 'cost-estimate' },
  { msg: 'Viện phí thế nào?', expect: 'cost-estimate' },
  { msg: 'Khám bệnh hết bao nhiêu?', expect: 'cost-estimate' },
  { msg: 'Bao nhiêu tiền một lần khám?', expect: 'cost-estimate' },
  { msg: 'Giá cả dịch vụ?', expect: 'cost-estimate' },

  // payment-methods
  { msg: 'Thanh toán như thế nào?', expect: 'payment-methods' },
  { msg: 'Trả tiền ở đâu?', expect: 'payment-methods' },
  { msg: 'Có nhận thẻ không?', expect: 'payment-methods' },
  { msg: 'Nhận MOMO không?', expect: 'payment-methods' },
  { msg: 'Chuyển khoản được không?', expect: 'payment-methods' },
  { msg: 'VNPay được không?', expect: 'payment-methods' },
  { msg: 'payment', expect: 'payment-methods' },
  { msg: 'Quẹt thẻ ATM được không?', expect: 'payment-methods' },

  // insurance-info
  { msg: 'BHYT dùng được không?', expect: 'insurance-info' },
  { msg: 'Bảo hiểm y tế thế nào?', expect: 'insurance-info' },
  { msg: 'Bảo hiểm chi trả bao nhiêu?', expect: 'insurance-info' },
  { msg: 'insurance', expect: 'insurance-info' },
  { msg: 'Thẻ bảo hiểm mang gì?', expect: 'insurance-info' },
  { msg: 'BHYT đúng tuyến thế nào?', expect: 'insurance-info' },
  { msg: 'Trái tuyến có được dùng BHYT không?', expect: 'insurance-info' },
  { msg: 'Mức chi trả bảo hiểm?', expect: 'insurance-info' },

  // hospital-info
  { msg: 'Địa chỉ bệnh viện ở đâu?', expect: 'hospital-info' },
  { msg: 'Điện thoại bệnh viện?', expect: 'hospital-info' },
  { msg: 'Bệnh viện mở cửa lúc nào?', expect: 'hospital-info' },
  { msg: 'Giờ làm việc thế nào?', expect: 'hospital-info' },
  { msg: 'Website của bệnh viện?', expect: 'hospital-info' },
  { msg: 'Hotline là số nào?', expect: 'hospital-info' },
  { msg: 'Bệnh viện ở đâu vậy?', expect: 'hospital-info' },
  { msg: 'Cấp cứu có 24/7 không?', expect: 'hospital-info' },

  // must miss → LLM
  { msg: 'Thời tiết hôm nay thế nào?', expect: null },
  { msg: 'Hôm nay ăn món gì ngon?', expect: null },
  { msg: 'Ai viết bài này?', expect: null },
  { msg: 'Đội bóng của tôi thắng chưa?', expect: null },
  { msg: 'Bạn có thể hát được không?', expect: null },
  { msg: 'Bầu trời màu gì vậy?', expect: null },
  { msg: 'Tên đầy đủ của bạn là gì?', expect: null },
  { msg: 'Chính trị thế giới ra sao?', expect: null },
];

describe('Template-first corpus hit rate', () => {
  let session: GuideSession;

  beforeEach(() => {
    sessions.clear();
    session = createSession('corpus-sid', 'Nguyễn Văn A', '014', 'step-queue');
  });

  it('every matcher-reachable template has at least one corpus case', () => {
    const matcherReachable = TEMPLATE_IDS.filter((id) => id !== 'fallback');
    for (const id of matcherReachable) {
      const cases = CORPUS.filter((c) => c.expect === id);
      expect(cases.length, `template ${id} has no corpus case`).toBeGreaterThan(0);
    }
  });

  it('routes >90% of the corpus to the expected template (or correct miss)', async () => {
    let correct = 0;
    const failures: string[] = [];
    let templateRouted = 0;
    let templateExpected = 0;

    for (const { msg, expect: expected, deptCode } of CORPUS) {
      const match = matchTemplate(msg, session);
      const routedId = match?.templateId ?? null;

      if (expected !== null) {
        templateExpected++;
        if (routedId === expected) templateRouted++;
      }

      const ok = routedId === expected;
      if (ok) {
        correct++;
      } else {
        failures.push(
          `"${msg}" expected=${expected ?? 'null'} got=${routedId ?? 'null'}`
        );
      }

      if (deptCode !== undefined) {
        expect(match?.args.deptCode, `"${msg}" department`).toBe(deptCode);
      }
    }

    // Misses must really fall back to the LLM stub, not silently route
    const missCases = CORPUS.map((c, i) => ({ msg: c.msg, i })).filter(
      ({ i }) => CORPUS[i].expect === null
    );
    for (const { msg, i } of missCases) {
      sessions.clear();
      const sid = `miss-${i}`;
      createSession(sid, 'Miss', '099', 'step-queue');
      const res = await handleMessage(sid, msg);
      expect(res.usedLLM, `"${msg}" should hit the LLM fallback`).toBe(true);
      expect(res.content).toContain('[STUB]');
    }

    const hitRate = correct / CORPUS.length;
    const templateHitRate = templateExpected > 0 ? templateRouted / templateExpected : 1;

    if (failures.length > 0) {
      console.error(`[corpus] failures:\n${failures.join('\n')}`);
    }
    console.error(
      `[corpus] overall=${(hitRate * 100).toFixed(1)}% (${correct}/${CORPUS.length}), ` +
        `template-routing=${(templateHitRate * 100).toFixed(1)}% (${templateRouted}/${templateExpected})`
    );

    expect(templateHitRate).toBeGreaterThan(0.9);
    expect(hitRate).toBeGreaterThanOrEqual(0.9);
  });
});
