/**
 * T-13 — Kịch bản lời dẫn demo 3 phút, bám camera-choreography.
 *
 * Cue thời gian SUY từ buildChoreography() (startS của segment đầu mỗi bước)
 * nên lời dẫn không bao giờ lệch camera khi chỉnh choreography. templateId là
 * chuỗi khớp bộ 10 template của lib/ai-guide/templates.ts (hợp đồng chuỗi,
 * không import để tránh dính vào luồng T-02 đang sống).
 */

import { buildChoreography, DEMO_DURATION_S } from "./camera-choreography";

/** Bộ 10 templateId của AI guide (lib/ai-guide/templates.ts) — dùng để validate */
export const AI_GUIDE_TEMPLATE_IDS = [
  "greeting",
  "current-status",
  "wait-update",
  "next-step",
  "department-direction",
  "cost-estimate",
  "payment-methods",
  "insurance-info",
  "hospital-info",
  "fallback",
] as const;

export type AiGuideTemplateId = (typeof AI_GUIDE_TEMPLATE_IDS)[number];

export interface DemoBeat {
  /** rỗng cho intro/outro, ngược lại khớp stepId của camera choreography */
  stepId: string;
  narration: string;
  templateId: AiGuideTemplateId;
  /** giây demo bắt đầu đọc; suy từ startS segment đầu của bước */
  cueS: number;
}

export interface DemoScript {
  beats: readonly DemoBeat[];
  totalDurationS: number;
}

const BEAT_BLUEPRINT: readonly { stepId: string; narration: string; templateId: AiGuideTemplateId }[] = [
  {
    stepId: "",
    narration:
      "Xin chào quý thầy cô và các bạn. Đây là hệ thống đặt lịch khám bệnh 3D của chúng tôi: bệnh nhân đặt vé online, nhận số thứ tự, và được hướng dẫn viên AI dẫn từng bước trong bệnh viện 3D. Mời theo dõi hành trình của bệnh nhân Nguyễn Văn A.",
    templateId: "greeting",
  },
  {
    stepId: "step-ticket",
    narration:
      "Bước đầu tiên: lấy vé tại kiosk sảnh. Bệnh nhân nhập mã đặt lịch, hệ thống in vé kèm số thứ tự và đẩy ngay phiên hướng dẫn AI — căn nhà 3D bên phải là bản đồ trực tiếp của bệnh viện thật.",
    templateId: "current-status",
  },
  {
    stepId: "step-queue",
    narration:
      "Bệnh nhân vào hàng đợi ở khu chờ. AI liên tục cập nhật ước lượng thời gian chờ theo ca thực tế, nên bệnh nhân biết chính xác mình sẽ được gọi khi nào thay vì đứng đoán. Lưu ý: thời gian chờ trong demo được nén 30 lần cho gọn nhịp trình bày.",
    templateId: "wait-update",
  },
  {
    stepId: "step-consultation",
    narration:
      "Được gọi khám, camera đưa chúng ta lên tầng 2 — khoa khám bệnh. AI chỉ đường theo tầng thật: thang bộ bên phải, biển khoa treo màu xanh mint, đến đúng phòng khám nội tổng quát.",
    templateId: "department-direction",
  },
  {
    stepId: "step-lab",
    narration:
      "Bác sĩ chỉ định xét nghiệm. Hệ thống tự chuyển chỉ đường xuống tầng cận lâm sàng, bệnh nhân đi bộ theo hành lang 3D — hướng dẫn cập nhật theo từng bước chân, không cần tự tìm.",
    templateId: "next-step",
  },
  {
    stepId: "step-re-consult",
    narration:
      "Có kết quả, quay lại tái khám với cùng bác sĩ. Lưu ý số thứ tự tái khám ưu tiên hơn, AI ước lượng lại thời gian chờ tức thì dựa trên dữ liệu ca khám của bác sĩ.",
    templateId: "wait-update",
  },
  {
    stepId: "step-conclusion",
    narration:
      "Kết luận bệnh và kê đơn xong, AI tóm tắt chi phí dự kiến từng khoản — khám, xét nghiệm, thuốc — trước khi bệnh nhân xuống quầy, để không ai bất ngờ khi thanh toán.",
    templateId: "cost-estimate",
  },
  {
    stepId: "step-admission",
    narration:
      "Trường hợp cần nhập viện, hệ thống mở quy trình giường bệnh: AI kiểm tra BHYT, đặt buồng theo khoa, và hướng dẫn bệnh nhân lên khu nội trú ở các tầng trên.",
    templateId: "insurance-info",
  },
  {
    stepId: "step-payment",
    narration:
      "Cuối cùng: thanh toán. Bệnh nhân chọn phương thức phù hợp, xác nhận một lần, và nhận hoá đơn điện tử kèm lịch tái khám — toàn bộ hành trình khép lại trong một luồng liên tục.",
    templateId: "payment-methods",
  },
  {
    stepId: "",
    narration:
      "Và đó là toàn bộ hành trình: đặt vé, chờ có ước lượng, khám, xét nghiệm, tái khám, kết luận, nhập viện, thanh toán — một bệnh viện 3D, một trợ lý AI, không lần nào bệnh nhân phải hỏi đường. Xin cảm ơn quý thầy cô.",
    templateId: "hospital-info",
  },
];

/** Dựng kịch bản: intro tại 0 (chiếm approach đầu), lời dẫn bước cue tại segment ACTION, outro tại segment cuối */
export function buildDemoScript(): DemoScript {
  const segments = buildChoreography();
  const actionStart = new Map<string, number>();
  const firstStart = new Map<string, number>();
  for (const seg of segments) {
    if (!firstStart.has(seg.stepId)) firstStart.set(seg.stepId, seg.startS);
    if (seg.phase === "action" && !actionStart.has(seg.stepId)) {
      actionStart.set(seg.stepId, seg.startS);
    }
  }
  const outroCueS = segments.length > 0 ? segments[segments.length - 1].startS : DEMO_DURATION_S - 10;

  const beats = BEAT_BLUEPRINT.map((blueprint) => ({
    ...blueprint,
    cueS:
      blueprint.stepId === ""
        ? blueprint === BEAT_BLUEPRINT[0]
          ? 0
          : outroCueS
        : (actionStart.get(blueprint.stepId) ?? firstStart.get(blueprint.stepId) ?? 0),
  }));

  return { beats, totalDurationS: DEMO_DURATION_S };
}

/** Beat đang phát tại một mốc giây demo (beat gần nhất có cueS <= t) */
export function narrationAt(script: DemoScript, elapsedDemoSeconds: number): DemoBeat | undefined {
  let current: DemoBeat | undefined;
  for (const beat of script.beats) {
    if (beat.cueS <= elapsedDemoSeconds) current = beat;
  }
  return current;
}
