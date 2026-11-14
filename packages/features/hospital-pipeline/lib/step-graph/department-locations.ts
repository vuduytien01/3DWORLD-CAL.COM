/**
 * Department Locations — KHOA Array (Departments → Rooms → Furniture Kinds)
 *
 * Each department owns a cluster of rooms on a floor. Used for:
 * - Multi-floor navigation (which floor for which specialty)
 * - AI Guide triage: "based on symptoms, you need KHOA NGOAI on floor 3"
 * - Auto-generating walls, doors, signage, furniture from data (no hard-code)
 */

export type RoomKind =
  | 'exam'           // Phòng khám chung — giường khám + ghế bác sĩ
  | 'xray'           // X-quang — gantry + bàn điều khiển
  | 'ultrasound'     // Siêu âm — máy siêu âm + màn hình + giường
  | 'surgery'        // Phẫu thuật — bàn mổ + đèn mổ + máy gây mê
  | 'ophthalmology'  // Mắt — bàn đo thị lực + đèn hốc
  | 'ent'            // Tai mũi họng — bàn khám ENT + kính soi
  | 'dental'         // Răng hàm mặt — ghế nha khoa nghiêng + đèn
  | 'waiting'        // Khu chờ — ghế băng dãy
  | 'reception'      // Tiếp đón — quầy + máy phát vé
  | 'payment';       // Thanh toán — quầy + máy quẹt thẻ

export interface RoomSpec {
  /** Unique room id within department */
  roomId: string;           // e.g. "khoa-ngoai-room-01"

  /** Display name on wall signage */
  label: string;            // e.g. "PHÒNG MỔ 01"

  /** Room kind → determines furniture preset */
  kind: RoomKind;

  /** Room center in department-local coordinates (meters) */
  position: { x: number; z: number };

  /** Room dimensions (meters) */
  size: { width: number; depth: number };

  /** Door position relative to room center (meters) */
  doorOffset: { x: number; z: number };

  /** Door width (meters) */
  doorWidth: number;

  /** Specialist note for AI Guide triage */
  specialtyNote?: string;   // e.g. "chuyên phẫu thuật bụng, ung thư"
}

export interface DepartmentSpec {
  /** Department code (matches signage) */
  code: string;             // e.g. "KHOA_NGOAI"

  /** Full name for signage & AI speech */
  name: string;             // e.g. "KHOA NGOẠI"

  /** Short code for signage chip */
  shortCode: string;        // e.g. "NGOAI"

  /** Department color (Mint Order palette) for signage background */
  signageColor: string;     // e.g. "#134E4A"

  /** Floor index (0 = ground, 1 = floor 2, ...) */
  floor: number;

  /** Department-local origin in world coordinates (meters) */
  worldOrigin: { x: number; z: number };

  /** Corridor width in front of rooms (meters) */
  corridorWidth: number;

  /** Rooms belonging to this department */
  rooms: readonly RoomSpec[];

  /** AI Guide triage keywords → this department */
  triageKeywords: readonly string[];  // e.g. ["đau bụng", "u bụng", "viêm ruột"]
}

/** Ground floor (floor 0) — Reception + Queue + Payment + 6 Specialty Departments */
/** Derived from hospital-khoa-floor.html: 24×12m dollhouse, 6 khoa 10 rooms */
export const GROUND_FLOOR_DEPARTMENTS: readonly DepartmentSpec[] = [
  {
    code: 'KHOA_TIEP_DON',
    name: 'KHOA TIẾP ĐÓN',
    shortCode: 'TĐ',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: -12, z: -5 },  // Left of main entrance
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'td-reception',
        label: 'QUẦY TIẾP ĐÓN',
        kind: 'reception',
        position: { x: 0, z: 0 },
        size: { width: 6, depth: 4 },
        doorOffset: { x: 0, z: 2 },  // On front edge (depth=4, half=2)
        doorWidth: 1.2,
      },
      {
        roomId: 'td-ticket-machine',
        label: 'MÁY PHÁT VÉ',
        kind: 'reception',
        position: { x: 3.5, z: 0 },
        size: { width: 2, depth: 2 },
        doorOffset: { x: 0, z: 1 },  // On front edge (depth=2, half=1)
        doorWidth: 0,  // No door, open kiosk
      },
      {
        roomId: 'td-waiting',
        label: 'KHU CHỜ TIẾP ĐÓN',
        kind: 'waiting',
        position: { x: -4, z: 5 },
        size: { width: 8, depth: 4 },
        doorOffset: { x: 0, z: 2 },  // On front edge (depth=4, half=2)
        doorWidth: 1.5,
      },
    ],
    triageKeywords: ['đăng ký', 'lấy vé', 'tiếp đón', 'hỏi đường'],
  },
  {
    code: 'KHOA_NOI',
    name: 'KHOA NỘI',
    shortCode: 'NỘI',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: -12, z: 15 },  // Left corridor, first specialty cluster
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'noi-room-01',
        label: 'PHÒNG KHÁM NỘI 01',
        kind: 'exam',
        position: { x: -6, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 2, z: 0 },  // On right edge (width=4, half=2) - faces corridor
        doorWidth: 1.0,
        specialtyNote: 'khám tổng quát, tim mạch, hô hấp',
      },
      {
        roomId: 'noi-room-02',
        label: 'PHÒNG KHÁM NỘI 02',
        kind: 'exam',
        position: { x: 2, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: -2, z: 0 },  // On left edge (width=4, half=2) - faces corridor
        doorWidth: 1.0,
        specialtyNote: 'tiêu hóa, nội tiết, thận',
      },
    ],
    triageKeywords: [
      'đau bụng', 'khó thở', 'ho', 'đau ngực', 'tiểu đường', 'huyết áp',
      'đau dạ dày', 'tiêu chảy', 'táo bón', 'mệt mỏi', 'sốt',
    ],
  },
  {
    code: 'KHOA_CDHA',
    name: 'CHẨN ĐOÁN HÌNH ẢNH',
    shortCode: 'CDHA',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: -12, z: 35 },  // Left corridor, second cluster
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'cdha-xray',
        label: 'PHÒNG X-QUANG',
        kind: 'xray',
        position: { x: -6, z: 0 },
        size: { width: 5, depth: 4 },
        doorOffset: { x: 2.5, z: 0 },  // On right edge (width=5, half=2.5) - faces corridor
        doorWidth: 1.2,
        specialtyNote: 'chụp X-quang ngực, xương, khớp',
      },
      {
        roomId: 'cdha-ultrasound',
        label: 'PHÒNG SIÊU ÂM',
        kind: 'ultrasound',
        position: { x: 2, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: -2, z: 0 },  // On left edge (width=4, half=2) - faces corridor
        doorWidth: 1.0,
        specialtyNote: 'siêu âm bụng, tim, thai, tuyến giáp',
      },
    ],
    triageKeywords: [
      'chụp x-quang', 'siêu âm', 'chụp hình', 'x-quang', 'chẩn đoán hình ảnh',
    ],
  },
  {
    code: 'KHOA_NGOAI',
    name: 'KHOA NGOẠI',
    shortCode: 'NGOAI',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: -12, z: 55 },  // Left corridor, third cluster
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'ngoai-surgery',
        label: 'PHÒNG MỔ',
        kind: 'surgery',
        position: { x: -6, z: 0 },
        size: { width: 6, depth: 5 },
        doorOffset: { x: 3, z: 0 },  // On right edge (width=6, half=3) - faces corridor
        doorWidth: 1.5,
        specialtyNote: 'phẫu thuật bụng, ung thư, chấn thương',
      },
    ],
    triageKeywords: [
      'phẫu thuật', 'mổ', 'u bụng', 'viêm ruột thừa', 'chấn thương', 'bọc ruột',
    ],
  },
  {
    code: 'KHOA_MAT',
    name: 'KHOA MẮT',
    shortCode: 'MẮT',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: 12, z: 15 },  // Right corridor, first cluster
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'mat-exam',
        label: 'PHÒNG KHÁM MẮT',
        kind: 'ophthalmology',
        position: { x: -6, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: -2, z: 0 },  // On left edge (width=4, half=2) - faces corridor (right side)
        doorWidth: 1.0,
        specialtyNote: 'khám mắt, đo thị lực, keo mắt',
      },
      {
        roomId: 'mat-vision',
        label: 'PHÒNG ĐO THỊ LỰC',
        kind: 'ophthalmology',
        position: { x: 2, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 2, z: 0 },  // On right edge (width=4, half=2) - faces corridor (right side)
        doorWidth: 1.0,
        specialtyNote: 'đo thị lực, định khúc, kiểm tra màu',
      },
    ],
    triageKeywords: [
      'đau mắt', 'mờ mắt', 'khó nhìn', 'đo thị lực', 'kính', 'keo mắt', 'viêm kết mạc',
    ],
  },
  {
    code: 'KHOA_TMH',
    name: 'KHOA TAI MŨI HỌNG',
    shortCode: 'TMH',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: 12, z: 35 },  // Right corridor, second cluster
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'tmh-exam',
        label: 'PHÒNG KHÁM TMH',
        kind: 'ent',
        position: { x: -6, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: -2, z: 0 },  // On left edge (width=4, half=2) - faces corridor (right side)
        doorWidth: 1.0,
        specialtyNote: 'tai mũi họng, viêm xoang, điếc',
      },
    ],
    triageKeywords: [
      'đau tai', 'khó nghe', 'viêm xoang', 'nghẹt mũi', 'đau họng', 'tiết mũi',
    ],
  },
  {
    code: 'KHOA_RHM',
    name: 'KHOA RĂNG HÀM MẶT',
    shortCode: 'RHM',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: 12, z: 55 },  // Right corridor, third cluster
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'rhm-dental',
        label: 'PHÒNG NHA KHOA',
        kind: 'dental',
        position: { x: -6, z: 0 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: -2, z: 0 },  // On left edge (width=4, half=2) - faces corridor (right side)
        doorWidth: 1.0,
        specialtyNote: 'nha khoa, răng khôn, tăm trám, niềng răng',
      },
    ],
    triageKeywords: [
      'đau răng', 'răng khôn', 'tăm trám', 'niềng răng', 'viêm nha chu', 'khó nhai',
    ],
  },
  {
    code: 'KHOA_THANH_TOAN',
    name: 'KHOA THANH TOÁN',
    shortCode: 'TT',
    signageColor: '#134E4A',
    floor: 0,
    worldOrigin: { x: 12, z: 75 },  // Right corridor, end
    corridorWidth: 3,
    rooms: [
      {
        roomId: 'tt-counter',
        label: 'QUẦY THANH TOÁN',
        kind: 'payment',
        position: { x: 0, z: 0 },
        size: { width: 4, depth: 3 },
        doorOffset: { x: 0, z: 1.5 },  // On front edge (depth=3, half=1.5)
        doorWidth: 1.0,
      },
    ],
    triageKeywords: ['thanh toán', 'chi phí', 'hoá đơn', 'bảo hiểm', 'trả tiền'],
  },
] as const;

/** All floors — ground floor + 9 identical upper floors (for 10-floor hospital per ADR-0001) */
export function generateAllFloors(): readonly DepartmentSpec[] {
  const floors: DepartmentSpec[] = [...GROUND_FLOOR_DEPARTMENTS];

  // Floors 1-9: replicate specialty departments (NO reception/payment)
  for (let f = 1; f <= 9; f++) {
    const specialtyDepts = GROUND_FLOOR_DEPARTMENTS.filter(
      (d) => !['KHOA_TIEP_DON', 'KHOA_THANH_TOAN'].includes(d.code)
    );

    for (const dept of specialtyDepts) {
      floors.push({
        ...dept,
        floor: f,
        worldOrigin: {
          x: dept.worldOrigin.x,
          z: dept.worldOrigin.z + f * 100,  // 100m vertical separation per floor
        },
      });
    }
  }

  return floors;
}

export const ALL_FLOOR_DEPARTMENTS = generateAllFloors();

/** Lookup by department code + floor */
export function getDepartment(
  code: string,
  floor: number
): DepartmentSpec | undefined {
  return ALL_FLOOR_DEPARTMENTS.find(
    (d) => d.code === code && d.floor === floor
  );
}

/** Get all departments on a specific floor */
export function getDepartmentsOnFloor(floor: number): readonly DepartmentSpec[] {
  return ALL_FLOOR_DEPARTMENTS.filter((d) => d.floor === floor);
}

/** Get specialty departments only (no admin) */
export function getSpecialtyDepartments(floor: number = 0): readonly DepartmentSpec[] {
  return getDepartmentsOnFloor(floor).filter(
    (d) => !['KHOA_TIEP_DON', 'KHOA_THANH_TOAN'].includes(d.code)
  );
}

/** AI Guide triage: given symptoms text, return best-matching department */
export function triageDepartment(symptoms: string): DepartmentSpec | undefined {
  const lower = symptoms.toLowerCase();
  let best: { dept: DepartmentSpec; score: number } | null = null;

  for (const dept of GROUND_FLOOR_DEPARTMENTS) {
    let score = 0;
    for (const kw of dept.triageKeywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > (best?.score ?? 0)) best = { dept, score };
  }

  return best?.dept;
}

/** Room kind to furniture preset mapping (for 3D scene generation) */
export const ROOM_KIND_FURNITURE: Record<RoomKind, readonly string[]> = {
  exam: ['exam-bed', 'doctor-chair', 'stool'],
  xray: ['xray-gantry', 'control-panel', 'lead-screen'],
  ultrasound: ['ultrasound-machine', 'monitor', 'exam-bed'],
  surgery: ['surgery-table', 'surgery-light', 'anesthesia-machine', 'instrument-table'],
  ophthalmology: ['vision-chart', 'slit-lamp', 'phoropter', 'patient-chair'],
  ent: ['ent-chair', 'otoscope', 'endoscope-tower', 'light-source'],
  dental: ['dental-chair', 'dental-light', 'delivery-unit', 'assistant-stool'],
  waiting: ['bench-seat-3', 'bench-seat-2', 'queue-display'],
  reception: ['reception-desk', 'ticket-kiosk', 'queue-display', 'staff-chair'],
  payment: ['payment-counter', 'card-reader', 'receipt-printer', 'staff-chair'],
};

/** Department code to world origin for quick lookup */
export function getDepartmentWorldOrigin(code: string, floor: number): { x: number; z: number } | undefined {
  const dept = getDepartment(code, floor);
  return dept?.worldOrigin;
}