/**
 * Step Locations — Pipeline Steps → 3D World Coordinates
 *
 * Single source of truth for where each pipeline step maps in the 3D corridor.
 * Used by: 3D Scene, AI Guide, Demo Script, Step Graph Engine.
 */

export type StepKind =
  | 'TICKET'
  | 'QUEUE'
  | 'CONSULTATION'
  | 'LAB'
  | 'RE_CONSULT'
  | 'CONCLUSION'
  | 'ADMISSION'
  | 'PAYMENT';

export interface StepLocation {
  /** Step Graph node id — matches StepGraph.steps[].id */
  stepId: string;

  /** Human label shown on signage & UI chips */
  label: string;           // e.g. "LẤY VÉ", "XẾP HÀNG"

  /** Short English label for signage chip */
  labelEn: string;         // e.g. "TICKET", "QUEUE"

  /** 3D world coordinates of the station center (meters) */
  position: { x: number; y: number; z: number };  // y = height (0 = floor, 1.6 = eye level)

  /** Radius of the station interaction zone (meters) */
  interactionRadius: number;

  /** AI Guide message template when patient arrives at this station */
  aiGuideMessage: string;  // e.g. "Chào bạn, đây là quầy LẤY VÉ. Vui lòng lấy số STT..."

  /** Optional: override camera dolly offset when camera follows patient here */
  cameraDollyOffset?: { x: number; y: number; z: number };

  /** Optional: which department cluster this step belongs to (for multi-floor) */
  departmentCluster?: string;  // e.g. "KHOA_NGOAI", "KHOA_NOI"

  /** Floor index (0 = ground) */
  floor: number;

  /** Estimated wait time at this step (minutes) — for demo UI */
  estimatedWait: number;
}

/** Coordinate system:
 * - Origin (0, 0, 0) = center of reception counter (ground level)
 * - Corridor runs along +Z axis (south → north)
 * - +X = right side of corridor (patient's right when walking forward)
 * - Y = height (0 = floor, 1.6 = eye level, 2.6 = ceiling)
 * - Units = meters
 */

/** Ordered by pipeline sequence (TICKET → PAYMENT) */
export const STEP_LOCATIONS: readonly StepLocation[] = [
  {
    stepId: 'step-ticket',
    label: 'LẤY VÉ',
    labelEn: 'TICKET',
    position: { x: -7.5, y: 1.5, z: -2.0 },   // Reception counter left side
    interactionRadius: 1.5,
    aiGuideMessage:
      'Chào bạn, đây là quầy LẤY VÉ. Vui lòng lấy số STT tại máy phát vé hoặc nhờ nhân viên hỗ trợ. Số vé của bạn sẽ hiển thị trên màn hình xếp hàng.',
    cameraDollyOffset: { x: 2, y: 1.6, z: 3 },
    floor: 0,
    estimatedWait: 3,
  },
  {
    stepId: 'step-queue',
    label: 'XẾP HÀNG',
    labelEn: 'QUEUE',
    position: { x: -7.5, y: 1.5, z: 3.0 },    // Waiting chairs + queue display
    interactionRadius: 2.0,
    aiGuideMessage:
      'Bạn đang ở khu vực XẾP HÀNG. Hãy ngồi chờ tại ghế và theo dõi màn hình hiển thị số vé. Khi số vé của bạn được gọi, hãy đến phòng khám tương ứng.',
    cameraDollyOffset: { x: 2, y: 1.6, z: 3 },
    floor: 0,
    estimatedWait: 10,
  },
  {
    stepId: 'step-consultation',
    label: 'KHÁM',
    labelEn: 'CONSULT',
    position: { x: 0, y: 1.5, z: 8.0 },       // Exam room 01
    interactionRadius: 1.2,
    aiGuideMessage:
      'Số vé của bạn đã được gọi. Vui lòng vào PHÒNG KHÁM 01. Bác sĩ sẽ tiếp nhận bạn ngay.',
    cameraDollyOffset: { x: 1.5, y: 1.6, z: 2 },
    floor: 1,
    estimatedWait: 15,
  },
  {
    stepId: 'step-lab',
    label: 'XÉT NGHIỆM',
    labelEn: 'LAB',
    position: { x: 0, y: 1.5, z: 13.0 },      // Lab room
    interactionRadius: 1.2,
    aiGuideMessage:
      'Bác sĩ đã chỉ định xét nghiệm. Vui lòng đến PHÒNG XÉT NGHIỆM lấy máu/xét nghiệm. Y tá sẽ hướng dẫn bạn.',
    cameraDollyOffset: { x: 1.5, y: 1.6, z: 2 },
    floor: 0,
    estimatedWait: 20,
  },
  {
    stepId: 'step-re-consult',
    label: 'KHÁM LẠI',
    labelEn: 'RE-CONSULT',
    position: { x: 0, y: 1.5, z: 18.0 },      // Exam room 02
    interactionRadius: 1.2,
    aiGuideMessage:
      'Kết quả xét nghiệm đã sẵn sàng. Vui lòng vào PHÒNG KHÁM 02 để bác sĩ khám lại và kết luận.',
    cameraDollyOffset: { x: 1.5, y: 1.6, z: 2 },
    floor: 1,
    estimatedWait: 10,
  },
  {
    stepId: 'step-conclusion',
    label: 'KẾT LUẬN',
    labelEn: 'CONCLUSION',
    position: { x: 7.5, y: 1.5, z: 23.0 },    // Conclusion desk
    interactionRadius: 1.0,
    aiGuideMessage:
      'Bác sĩ đã kết luận. Vui lòng đến quầy KẾT LUẬN để nhận đơn thuốc, chỉ định nhập viện hoặc hẹn tái khám.',
    cameraDollyOffset: { x: -1.5, y: 1.6, z: 2 },
    floor: 1,
    estimatedWait: 5,
  },
  {
    stepId: 'step-admission',
    label: 'NHẬP VIỆN',
    labelEn: 'ADMISSION',
    position: { x: 7.5, y: 1.5, z: 28.0 },    // Admission ward bed
    interactionRadius: 1.5,
    aiGuideMessage:
      'Bác sĩ chỉ định nhập viện. Vui lòng đến quầy NHẬP VIỆN để hoàn tất thủ tục. Y tá sẽ dẫn bạn đến giường bệnh.',
    cameraDollyOffset: { x: -1.5, y: 1.6, z: 2 },
    floor: 2,
    estimatedWait: 30,
  },
  {
    stepId: 'step-payment',
    label: 'THANH TOÁN',
    labelEn: 'PAYMENT',
    position: { x: -7.5, y: 1.5, z: 33.0 },   // Payment counter (back near reception)
    interactionRadius: 1.5,
    aiGuideMessage:
      'Quá trình khám đã hoàn tất. Vui lòng đến quầy THANH TOÁN để thanh toán chi phí. Cảm ơn bạn đã tin dùng bệnh viện.',
    cameraDollyOffset: { x: 2, y: 1.6, z: 3 },
    floor: 0,
    estimatedWait: 5,
  },
] as const;

/** Quick lookup by stepId */
export const STEP_LOCATION_BY_ID: ReadonlyMap<string, StepLocation> = new Map(
  STEP_LOCATIONS.map((s) => [s.stepId, s])
);

/** Helper to get step by ID with type safety */
export function getStepLocation(stepId: string): StepLocation | undefined {
  return STEP_LOCATION_BY_ID.get(stepId);
}

/** All step IDs in pipeline order */
export const STEP_IDS_IN_ORDER: readonly string[] = STEP_LOCATIONS.map((s) => s.stepId);