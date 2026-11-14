/**
 * AI Guide Templates — Template-first message catalog
 *
 * Design principle: Every administrative question maps to a template.
 * Templates are TypeScript functions — type-safe, testable, no string interpolation bugs.
 * LLM is safety net only (<10% of messages).
 */

import type { GuideSession } from './session';
import { STEP_LOCATION_BY_ID } from '../step-graph/step-locations';
import { getDepartment, GROUND_FLOOR_DEPARTMENTS, type DepartmentSpec } from '../step-graph/department-locations';

/**
 * Normalize Vietnamese text for keyword matching: lowercase, strip diacritics,
 * map đ→d, underscores→spaces. "Khoa NỘI" and "khoa noi" and "KHOA_NOI" all
 * become "khoa noi".
 */
function normalizeVi(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/_/g, ' ')
    .trim();
}

/** Longest first so "khoa tai mui hong" wins over shorter labels */
const DEPARTMENT_TRIGGERS: readonly { dept: DepartmentSpec; trigger: string }[] =
  GROUND_FLOOR_DEPARTMENTS.flatMap((dept) => {
    const triggers = [dept.name, dept.code, ...dept.rooms.map((r) => r.label)];
    return triggers.map((t) => ({
      dept,
      // Drop trailing room numbers so "PHÒNG KHÁM NỘI 01" also matches "phòng khám nội"
      trigger: normalizeVi(t).replace(/\s+\d+$/, ''),
    }));
  })
    .filter(({ trigger }) => trigger.length > 0)
    .sort((a, b) => b.trigger.length - a.trigger.length);

/** Find the department whose name/code/room label appears in the message */
function findDepartmentInMessage(msg: string): DepartmentSpec | undefined {
  const normalized = normalizeVi(msg);
  return DEPARTMENT_TRIGGERS.find(({ trigger }) => normalized.includes(trigger))?.dept;
}

/** Template result */
export interface TemplateResult {
  content: string;
  templateId: string;
}

/** Template function signature */
export type TemplateFn = (session: GuideSession, args: Record<string, string>) => TemplateResult;

/** All available templates */
export const templates: Record<string, TemplateFn> = {
  /** Greeting when patient first opens chat */
  'greeting': (session, _args) => ({
    templateId: 'greeting',
    content:
      `Chào ${session.patientName}, tôi là hướng dẫn viên AI của bệnh viện. ` +
      `Số vé của bạn: ${session.stt}. Bạn đang ở: ${session.currentStep.label}. ` +
      `Ước lượng chờ: ${session.waitEstimate} phút. ` +
      `Bạn muốn hỏi gì về hướng đường, thủ tục, hoặc chi phí?`,
  }),

  /** Current step status */
  'current-status': (session, _args) => ({
    templateId: 'current-status',
    content:
      `Bạn đang ở bước: ${session.currentStep.label} (${session.currentStep.labelEn}). ` +
      `Số vé: ${session.stt}. Ước lượng chờ: ${session.waitEstimate} phút. ` +
      `${session.currentStep.aiGuideMessage}`,
  }),

  /** Wait time update (pushed proactively or on request) */
  'wait-update': (session, args) => ({
    templateId: 'wait-update',
    content:
      `Cập nhật thời gian chờ: còn khoảng ${args.estimate || session.waitEstimate} phút ` +
      `tại ${session.currentStep.label}. Tôi sẽ thông báo khi đến lượt bạn.`,
  }),

  /** Navigation to next step */
  'next-step': (session) => {
    const steps = Array.from(STEP_LOCATION_BY_ID.values());
    const idx = steps.findIndex((s) => s.stepId === session.currentStepId);
    const next = steps[idx + 1];
    if (!next) {
      return {
        templateId: 'next-step',
        content: `Bạn đã hoàn tất quy trình khám. Cảm ơn bạn đã tin dùng bệnh viện!`,
      };
    }
    return {
      templateId: 'next-step',
      content:
        `Bước tiếp theo: ${next.label} (${next.labelEn}). ` +
        `${next.aiGuideMessage}`,
    };
  },

  /** Department direction (from triage) */
  'department-direction': (_session, args) => {
    const deptCode = args.deptCode;
    const floor = args.floor ? parseInt(args.floor, 10) : 0;
    const dept = getDepartment(deptCode, floor);
    if (!dept) {
      return {
        templateId: 'department-direction',
        content: `Xin lỗi, tôi không tìm thấy thông tin khoa ${deptCode}.`,
      };
    }
    return {
      templateId: 'department-direction',
      content:
        `${dept.name} (${dept.shortCode}) ở tầng ${floor}, ` +
        `hành lang ${dept.worldOrigin.x < 0 ? 'trái' : 'phải'}. ` +
        `Theo dõi biển chỉ dẫn màu ${dept.signageColor} treo giữa hành lang. ` +
        `Phòng khám: ${dept.rooms.map((r) => r.label).join(', ')}.`,
    };
  },

  /** Cost estimate */
  'cost-estimate': () => ({
    templateId: 'cost-estimate',
    content:
      `Chi phí khám bệnh thường khoảng 100.000–300.000 VNĐ tùy khoa. ` +
      `Xét nghiệm, chụp X-quang, siêu âm tính riêng. ` +
      `Bảo hiểm y tế giảm 80–100% tùy đối tượng. ` +
      `Chi tiết xin hỏi quầy THANH TOÁN khi hoàn tất.`,
  }),

  /** Payment methods */
  'payment-methods': () => ({
    templateId: 'payment-methods',
    content:
      `Bệnh viện chấp nhận: tiền mặt, thẻ ATM/Visa/Mastercard, ` +
      `chuyển khoản, ví điện tử (Momo, ZaloPay, VNPay). ` +
      `Quầy THANH TOÁN hỗ trợ tất cả hình thức.`,
  }),

  /** Insurance info */
  'insurance-info': () => ({
    templateId: 'insurance-info',
    content:
      `Mang thẻ BHYT và CMND/CCCD gốc. ` +
      `Đúng tuyến: BHYT chi trả 80–100%. ` +
      `Trái tuyến: cần giấy giới thiệu, chi trả theo quy định. ` +
      `Quầy THANH TOÁN sẽ kiểm tra và áp dụng.`,
  }),

  /** General hospital info */
  'hospital-info': () => ({
    templateId: 'hospital-info',
    content:
      `Bệnh viện đa khoa mở cửa 7:00–19:00 các ngày làm việc. ` +
      `Cấp cứu 24/7. Địa chỉ: [Địa chỉ bệnh viện]. ` +
      `Điện thoại: [Số điện thoại]. Website: [Website].`,
  }),

  /** Fallback for unrecognized questions */
  'fallback': (_session, args) => ({
    templateId: 'fallback',
    content:
      `Xin lỗi, tôi chưa hiểu câu hỏi "${args.question}". ` +
      `Bạn có thể hỏi: "Chờ bao lâu?", "Đi đâu?", "Chi phí bao nhiêu?", ` +
      `"Thanh toán như thế nào?", "BHYT thế nào?", "Khoa nào?".`,
  }),
};

/**
 * Template matcher — keyword routing over diacritic-normalized text, no LLM needed.
 * Order matters: specific intents first, generic navigation, then greeting,
 * and null (→ LLM) last.
 */
export function matchTemplate(
  userMessage: string,
  _session: GuideSession
): { templateId: string; args: Record<string, string> } | null {
  const msg = normalizeVi(userMessage);

  // Explicit commands
  if (msg === 'menu' || msg === 'giup' || msg === 'help') {
    return { templateId: 'current-status', args: {} };
  }

  // Department direction — full name / code / room label, before payment/wait
  // so "khoa ngoại đi đâu" and "quầy thanh toán ở đâu" route to directions
  const dept = findDepartmentInMessage(msg);
  if (dept) {
    return {
      templateId: 'department-direction',
      args: { deptCode: dept.code, floor: String(dept.floor) },
    };
  }

  // Insurance (before cost: BHYT questions mention money)
  if (/(bao hiem|bhyt|insurance)/.test(msg)) {
    return { templateId: 'insurance-info', args: {} };
  }

  // Payment (before cost: "trả tiền" and "thẻ" are payment intents;
  // \bthe\b alone is excluded — "có thể" would false-positive)
  if (/(thanh toan|tra tien|payment|\batm\b|nhan the|quet the|the atm|the ngan hang|vnpay|momo|zalopay|chuyen khoan)/.test(msg)) {
    return { templateId: 'payment-methods', args: {} };
  }

  // Wait time (before cost: "phải chờ bao nhiêu phút" is a wait question)
  if (/(\bcho\b|cho doi|bao lau|den luot|\bwait\b|\beta\b)/.test(msg)) {
    return { templateId: 'wait-update', args: {} };
  }

  // Cost
  if (/(chi phi|vien phi|\bgia\b|\btien\b|cost|price|bao nhieu)/.test(msg)) {
    return { templateId: 'cost-estimate', args: {} };
  }

  // Current status (before next-step: "tôi đang ở đâu" ≠ "đi đâu")
  if (/(trang thai|\bstatus\b|\bmenu\b|dang o|toi o dau)/.test(msg)) {
    return { templateId: 'current-status', args: {} };
  }

  // Hospital info (before next-step: "bệnh viện ở đâu" is the address)
  if (/(dia chi|dien thoai|website|hotline|mo cua|gio lam viec|cap cuu|benh vien o dau)/.test(msg)) {
    return { templateId: 'hospital-info', args: {} };
  }

  // Next step / generic navigation
  if (/(tiep theo|buoc sau|buoc tiep|\bnext\b|di dau|phong nao|xong roi|qua dau|o dau)/.test(msg)) {
    return { templateId: 'next-step', args: {} };
  }

  // Greeting last — "chào bạn, chi phí bao nhiêu?" already routed to cost above
  if (/(\bchao\b|xin chao|hello|\bhi\b|\balo\b)/.test(msg)) {
    return { templateId: 'greeting', args: {} };
  }

  return null; // → LLM fallback
}

/** All template IDs in order */
export const TEMPLATE_IDS = [
  'greeting',
  'current-status',
  'wait-update',
  'next-step',
  'department-direction',
  'cost-estimate',
  'payment-methods',
  'insurance-info',
  'hospital-info',
  'fallback',
] as const;

/** Check if a template ID exists */
export function hasTemplate(templateId: string): boolean {
  return templateId in templates;
}

/** Get template by ID */
export function getTemplate(templateId: string): TemplateFn | undefined {
  return templates[templateId];
}