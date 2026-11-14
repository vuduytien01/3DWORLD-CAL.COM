/**
 * KHOA Floor Slice Generator — dollhouse department slices (Lượt 7)
 *
 * Generates specialty floors (default floors 2-3, indices 1-2) as stacked
 * dollhouse slices per the KHOA shape in specs/03-location-data-structure.md
 * (khoa → phòng → kind) and the Lượt 6 notes in map.md: 24×12 m floor,
 * central 3 m corridor, two 4 m room rows, 6 departments (NỘI, CDHA, NGOẠI,
 * MẮT, TMH, RHM), per-kind furniture, two-tier signage (#134E4A hanging /
 * #0F766E wall), plus through-floor stairs and a wall-recessed elevator.
 *
 * Pure data: no renderer import, so unit tests and the AI Guide can consume
 * slices headless. The HTML5 renderer consumes slices via
 * lib/html5-world/floor-plan.ts.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type KhoaRoomKind =
  | "exam"
  | "xray"
  | "ultrasound"
  | "surgery"
  | "ophthalmology"
  | "ent"
  | "dental"
  | "waiting"
  | "reception"
  | "payment"
  | "ward"
  | "nurse-station";

export interface KhoaRoomSpec {
  roomId: string;
  label: string;
  kind: KhoaRoomKind;
  /** Room center in floor-local coordinates (meters) */
  position: Vec2;
  size: { width: number; depth: number };
  /** Door offset relative to room center; lands on the corridor-facing edge */
  doorOffset: Vec2;
  doorWidth: number;
  specialtyNote?: string;
}

export interface KhoaSliceDepartment {
  code: string;
  name: string;
  shortCode: string;
  signageColor: string;
  rooms: readonly KhoaRoomSpec[];
  triageKeywords: readonly string[];
}

export interface SlicePrimitive {
  kind: "box" | "plane";
  role: string;
  /** box: full extents; plane: x = width, y = height, z unused (0) */
  size: Vec3;
  /** Absolute world position; y already includes the floor base elevation */
  position: Vec3;
  /** Euler radians */
  rotation?: Vec3;
  color: string;
}

export interface SliceFurniture {
  roomId: string;
  kind: KhoaRoomKind;
  /** Furniture anchor at floor level */
  position: Vec3;
  /** Direction the room faces (toward the corridor) */
  facing: "north" | "south";
}

export interface SliceSign {
  id: string;
  variant: "dept-hanging" | "room-wall" | "direction-arrow";
  content: string;
  color: string;
  position: Vec3;
  rotation: Vec3;
  size: { x: number; y: number };
}

export interface StairwellSpec {
  /** Slab opening the flight descends through, floor-local coordinates */
  hole: { x0: number; x1: number; z0: number; z1: number };
  steps: number;
  stepRise: number;
  stepDepth: number;
  stepWidth: number;
  floorIndex: number;
  landsOnFloorIndex: number;
}

export interface ElevatorSpec {
  /** Corridor-side face of the shaft doors */
  faceX: number;
  doorZ: number;
  hasShaft: boolean;
  /** Vertical span of the shared shaft box, absolute world Y */
  shaftSpanY: { min: number; max: number } | null;
}

export interface KhoaFloorSlice {
  floorIndex: number;
  /** 1-based display floor (floorIndex + 1) */
  displayFloor: number;
  baseY: number;
  footprint: { width: number; depth: number };
  slabHole: { x0: number; x1: number; z0: number; z1: number } | null;
  departments: readonly KhoaSliceDepartment[];
  sharedRooms: readonly KhoaRoomSpec[];
  primitives: readonly SlicePrimitive[];
  furniture: readonly SliceFurniture[];
  signs: readonly SliceSign[];
  stairwell: StairwellSpec | null;
  elevator: ElevatorSpec;
}

/**
 * Mint Order palette, 8 colors (Lượt 1-2). Floor and wall are the derived
 * large-surface tones #EEF5F2 / #CDEBE3 proven in the Lượt 2 vignette.
 */
/**
 * Per-kind low-poly furniture presets. Offsets are relative to the room
 * center with the back wall on the -z side; buildKhoaFloorSlice mirrors z
 * for rooms facing south. Each part is one box (12 tris) or plane (2 tris).
 */
interface FurniturePart {
  role: string;
  kind: "box" | "plane";
  size: Vec3;
  offset: Vec3;
  /** Plane faces the corridor (rotated with the room) */
  faceCorridor?: boolean;
}

export const MINT_ORDER_SLICE_PALETTE = {
  floor: "#EEF5F2",
  wall: "#CDEBE3",
  primary: "#0F766E",
  primaryDark: "#134E4A",
  accent: "#99F6E4",
  accentLight: "#ECFDF5",
  neutral: "#F8FAFC",
  patient: "#BFDBFE",
} as const;

export const MINT_ORDER_COLORS: readonly string[] = Object.values(MINT_ORDER_SLICE_PALETTE);

export const SLICE_LAYOUT = {
  floorWidth: 24,
  floorDepth: 12,
  floorHeight: 3,
  slabThickness: 0.3,
  wallHeight: 2.7,
  wallThickness: 0.2,
  doorHeight: 2.1,
  corridor: { x0: 1.5, x1: 22.5, z0: 4.5, z1: 7.5 },
  stairHole: { x0: 10.2, x1: 13.8, z0: 4.9, z1: 7.1 },
  stairSteps: 12,
  elevator: { faceX: 2.26, doorZ: 6.0, recessProtrusion: 0.76 },
} as const;

export const SLICE_DEFAULT_FLOORS: readonly [number, number] = [1, 2];

/**
 * The 6 specialty departments of Lượt 6, laid into the 24×12 dollhouse.
 * Codes, names, kinds and triage keywords follow specs/03 GROUND_FLOOR
 * specialty departments; coordinates follow the proven Lượt 6 rows.
 * Room ids are templates — buildKhoaFloorSlice suffixes them per floor.
 */
export const SLICE_DEPARTMENT_TEMPLATE: readonly KhoaSliceDepartment[] = [
  {
    code: "KHOA_NOI",
    name: "KHOA NỘI",
    shortCode: "NỘI",
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: [
      {
        roomId: "noi-room-01",
        label: "PHÒNG KHÁM NỘI 01",
        kind: "exam",
        position: { x: 3.5, z: 2.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: 2 },
        doorWidth: 1.0,
        specialtyNote: "khám tổng quát, tim mạch, hô hấp",
      },
      {
        roomId: "noi-room-02",
        label: "PHÒNG KHÁM NỘI 02",
        kind: "exam",
        position: { x: 7.5, z: 2.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: 2 },
        doorWidth: 1.0,
        specialtyNote: "tiêu hóa, nội tiết, thận",
      },
    ],
    triageKeywords: [
      "đau bụng",
      "khó thở",
      "ho",
      "đau ngực",
      "tiểu đường",
      "huyết áp",
      "đau dạ dày",
      "tiêu chảy",
      "táo bón",
      "mệt mỏi",
      "sốt",
    ],
  },
  {
    code: "KHOA_CDHA",
    name: "CHẨN ĐOÁN HÌNH ẢNH",
    shortCode: "CDHA",
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: [
      {
        roomId: "cdha-xray",
        label: "PHÒNG X-QUANG",
        kind: "xray",
        position: { x: 12, z: 2.5 },
        size: { width: 5, depth: 4 },
        doorOffset: { x: 0, z: 2 },
        doorWidth: 1.2,
        specialtyNote: "chụp X-quang ngực, xương, khớp",
      },
      {
        roomId: "cdha-ultrasound",
        label: "PHÒNG SIÊU ÂM",
        kind: "ultrasound",
        position: { x: 16.5, z: 2.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: 2 },
        doorWidth: 1.0,
        specialtyNote: "siêu âm bụng, tim, thai, tuyến giáp",
      },
    ],
    triageKeywords: ["chụp x-quang", "siêu âm", "chụp hình", "x-quang", "chẩn đoán hình ảnh"],
  },
  {
    code: "KHOA_NGOAI",
    name: "KHOA NGOẠI",
    shortCode: "NGOAI",
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: [
      {
        roomId: "ngoai-surgery",
        label: "PHÒNG MỔ",
        kind: "surgery",
        position: { x: 3.5, z: 9.5 },
        size: { width: 6, depth: 4 },
        doorOffset: { x: 0, z: -2 },
        doorWidth: 1.5,
        specialtyNote: "phẫu thuật bụng, ung thư, chấn thương",
      },
    ],
    triageKeywords: ["phẫu thuật", "mổ", "u bụng", "viêm ruột thừa", "chấn thương"],
  },
  {
    code: "KHOA_MAT",
    name: "KHOA MẮT",
    shortCode: "MẮT",
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: [
      {
        roomId: "mat-exam",
        label: "PHÒNG KHÁM MẮT",
        kind: "ophthalmology",
        position: { x: 8.5, z: 9.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: -2 },
        doorWidth: 1.0,
        specialtyNote: "khám mắt, đo thị lực, keo mắt",
      },
      {
        roomId: "mat-vision",
        label: "PHÒNG ĐO THỊ LỰC",
        kind: "ophthalmology",
        position: { x: 12.5, z: 9.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: -2 },
        doorWidth: 1.0,
        specialtyNote: "đo thị lực, định khúc, kiểm tra màu",
      },
    ],
    triageKeywords: ["đau mắt", "mờ mắt", "khó nhìn", "đo thị lực", "kính", "keo mắt", "viêm kết mạc"],
  },
  {
    code: "KHOA_TMH",
    name: "KHOA TAI MŨI HỌNG",
    shortCode: "TMH",
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: [
      {
        roomId: "tmh-exam",
        label: "PHÒNG KHÁM TMH",
        kind: "ent",
        position: { x: 16.5, z: 9.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: -2 },
        doorWidth: 1.0,
        specialtyNote: "tai mũi họng, viêm xoang, điếc",
      },
    ],
    triageKeywords: ["đau tai", "khó nghe", "viêm xoang", "nghẹt mũi", "đau họng", "tiết mũi"],
  },
  {
    code: "KHOA_RHM",
    name: "KHOA RĂNG HÀM MẶT",
    shortCode: "RHM",
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: [
      {
        roomId: "rhm-dental",
        label: "PHÒNG NHA KHOA",
        kind: "dental",
        position: { x: 20.5, z: 9.5 },
        size: { width: 4, depth: 4 },
        doorOffset: { x: 0, z: -2 },
        doorWidth: 1.0,
        specialtyNote: "nha khoa, răng khôn, tăm trám, niềng răng",
      },
    ],
    triageKeywords: ["đau răng", "răng khôn", "tăm trám", "niềng răng", "viêm nha chu", "khó nhai"],
  },
];

/** Shared per-floor room (10th room: 9 specialty + 1 common waiting) */
export const SLICE_SHARED_ROOMS_TEMPLATE: readonly KhoaRoomSpec[] = [
  {
    roomId: "shared-waiting",
    label: "KHU CHỜ CHUNG",
    kind: "waiting",
    position: { x: 20.5, z: 2.5 },
    size: { width: 4, depth: 4 },
    doorOffset: { x: 0, z: 2 },
    doorWidth: 1.5,
  },
];

export const SLICE_FURNITURE_PRESET_BY_KIND: Readonly<Record<KhoaRoomKind, readonly FurniturePart[]>> = {
  exam: [
    {
      role: "bed-base",
      kind: "box",
      size: { x: 1.9, y: 0.3, z: 0.8 },
      offset: { x: 0, y: 0.15, z: -1.0 },
    },
    {
      role: "bed-mattress",
      kind: "box",
      size: { x: 1.8, y: 0.15, z: 0.7 },
      offset: { x: 0, y: 0.375, z: -1.0 },
    },
    {
      role: "bed-pillow",
      kind: "box",
      size: { x: 0.4, y: 0.1, z: 0.35 },
      offset: { x: 0, y: 0.5, z: -0.45 },
    },
  ],
  xray: [
    {
      role: "gantry-column",
      kind: "box",
      size: { x: 0.4, y: 2.0, z: 0.4 },
      offset: { x: -1.3, y: 1.0, z: -1.2 },
    },
    {
      role: "gantry-arm",
      kind: "box",
      size: { x: 1.3, y: 0.25, z: 0.3 },
      offset: { x: -0.7, y: 1.85, z: -1.0 },
    },
    {
      role: "exam-table",
      kind: "box",
      size: { x: 1.8, y: 0.15, z: 0.55 },
      offset: { x: 0.7, y: 0.85, z: -0.7 },
    },
    {
      role: "console",
      kind: "box",
      size: { x: 0.9, y: 0.9, z: 0.5 },
      offset: { x: 1.6, y: 0.45, z: -1.3 },
    },
  ],
  ultrasound: [
    {
      role: "machine",
      kind: "box",
      size: { x: 0.6, y: 1.3, z: 0.5 },
      offset: { x: -1.3, y: 0.65, z: -1.3 },
    },
    {
      role: "screen",
      kind: "plane",
      size: { x: 0.55, y: 0.45, z: 0 },
      offset: { x: -1.3, y: 1.3, z: -1.04 },
      faceCorridor: true,
    },
    {
      role: "exam-bed",
      kind: "box",
      size: { x: 1.9, y: 0.5, z: 0.7 },
      offset: { x: 0.8, y: 0.25, z: -0.9 },
    },
  ],
  surgery: [
    {
      role: "table-top",
      kind: "box",
      size: { x: 0.9, y: 0.12, z: 2.0 },
      offset: { x: 0, y: 0.95, z: -0.4 },
    },
    {
      role: "table-column",
      kind: "box",
      size: { x: 0.35, y: 0.9, z: 0.35 },
      offset: { x: 0, y: 0.45, z: -0.4 },
    },
    {
      role: "table-base",
      kind: "box",
      size: { x: 0.7, y: 0.12, z: 0.7 },
      offset: { x: 0, y: 0.06, z: -0.4 },
    },
    {
      role: "lamp",
      kind: "box",
      size: { x: 0.7, y: 0.15, z: 0.7 },
      offset: { x: 0, y: 2.0, z: -0.4 },
    },
  ],
  ophthalmology: [
    {
      role: "desk",
      kind: "box",
      size: { x: 1.4, y: 0.75, z: 0.6 },
      offset: { x: -1.0, y: 0.375, z: -1.3 },
    },
    {
      role: "vision-chart",
      kind: "plane",
      size: { x: 0.6, y: 0.8, z: 0 },
      offset: { x: 0.2, y: 1.6, z: -1.86 },
      faceCorridor: true,
    },
  ],
  ent: [
    {
      role: "desk",
      kind: "box",
      size: { x: 1.2, y: 0.9, z: 0.6 },
      offset: { x: -1.0, y: 0.45, z: -1.3 },
    },
    {
      role: "scope-stand",
      kind: "box",
      size: { x: 0.15, y: 1.6, z: 0.15 },
      offset: { x: 0.3, y: 0.8, z: -1.5 },
    },
    {
      role: "scope-head",
      kind: "box",
      size: { x: 0.25, y: 0.15, z: 0.25 },
      offset: { x: 0.3, y: 1.65, z: -1.5 },
    },
  ],
  dental: [
    {
      role: "chair-base",
      kind: "box",
      size: { x: 0.5, y: 0.5, z: 0.5 },
      offset: { x: 0.4, y: 0.25, z: -0.5 },
    },
    {
      role: "chair-seat",
      kind: "box",
      size: { x: 0.6, y: 0.15, z: 1.5 },
      offset: { x: 0.4, y: 0.65, z: -0.5 },
    },
    {
      role: "chair-back",
      kind: "box",
      size: { x: 0.6, y: 0.9, z: 0.15 },
      offset: { x: 0.4, y: 1.05, z: -1.3 },
    },
    {
      role: "lamp",
      kind: "box",
      size: { x: 0.45, y: 0.12, z: 0.45 },
      offset: { x: -0.6, y: 1.9, z: -1.2 },
    },
  ],
  waiting: [
    {
      role: "bench-seat",
      kind: "box",
      size: { x: 2.4, y: 0.08, z: 0.45 },
      offset: { x: 0, y: 0.45, z: -1.4 },
    },
    {
      role: "bench-back",
      kind: "box",
      size: { x: 2.4, y: 0.5, z: 0.08 },
      offset: { x: 0, y: 0.78, z: -1.62 },
    },
    {
      role: "bench-legs",
      kind: "box",
      size: { x: 2.3, y: 0.4, z: 0.3 },
      offset: { x: 0, y: 0.2, z: -1.4 },
    },
  ],
  reception: [
    {
      role: "counter",
      kind: "box",
      size: { x: 1.8, y: 1.1, z: 0.5 },
      offset: { x: 0, y: 0.55, z: 0 },
    },
    {
      role: "ticket-machine",
      kind: "box",
      size: { x: 0.35, y: 0.45, z: 0.25 },
      offset: { x: 0.5, y: 1.325, z: 0 },
    },
  ],
  payment: [
    {
      role: "counter",
      kind: "box",
      size: { x: 1.5, y: 1.1, z: 0.6 },
      offset: { x: 0, y: 0.55, z: 0 },
    },
  ],
  ward: [
    {
      role: "bed-base",
      kind: "box",
      size: { x: 0.8, y: 0.3, z: 1.9 },
      offset: { x: -1.1, y: 0.15, z: -0.85 },
    },
    {
      role: "bed-mattress",
      kind: "box",
      size: { x: 0.7, y: 0.15, z: 1.8 },
      offset: { x: -1.1, y: 0.375, z: -0.85 },
    },
    {
      role: "bed-pillow",
      kind: "box",
      size: { x: 0.5, y: 0.1, z: 0.35 },
      offset: { x: -1.1, y: 0.5, z: -1.55 },
    },
    {
      role: "bed-base-2",
      kind: "box",
      size: { x: 0.8, y: 0.3, z: 1.9 },
      offset: { x: 0.3, y: 0.15, z: -0.85 },
    },
    {
      role: "bed-mattress-2",
      kind: "box",
      size: { x: 0.7, y: 0.15, z: 1.8 },
      offset: { x: 0.3, y: 0.375, z: -0.85 },
    },
    {
      role: "bed-pillow-2",
      kind: "box",
      size: { x: 0.5, y: 0.1, z: 0.35 },
      offset: { x: 0.3, y: 0.5, z: -1.55 },
    },
    {
      role: "nightstand",
      kind: "box",
      size: { x: 0.5, y: 0.5, z: 0.45 },
      offset: { x: 1.3, y: 0.25, z: -1.5 },
    },
    {
      role: "iv-stand",
      kind: "box",
      size: { x: 0.12, y: 1.5, z: 0.12 },
      offset: { x: -1.1, y: 0.75, z: 0.2 },
    },
  ],
  "nurse-station": [
    {
      role: "counter-top",
      kind: "box",
      size: { x: 2.2, y: 0.08, z: 0.6 },
      offset: { x: 0, y: 0.75, z: -1.3 },
    },
    {
      role: "counter-body",
      kind: "box",
      size: { x: 2.2, y: 0.7, z: 0.5 },
      offset: { x: 0, y: 0.35, z: -1.35 },
    },
    {
      role: "monitor",
      kind: "plane",
      size: { x: 0.5, y: 0.35, z: 0 },
      offset: { x: -0.5, y: 1.15, z: -1.1 },
      faceCorridor: true,
    },
    {
      role: "chair",
      kind: "box",
      size: { x: 0.45, y: 0.45, z: 0.45 },
      offset: { x: 0.5, y: 0.225, z: -0.7 },
    },
    {
      role: "file-shelf",
      kind: "box",
      size: { x: 0.8, y: 1.4, z: 0.35 },
      offset: { x: 1.5, y: 0.7, z: -1.6 },
    },
  ],
};

const FURNITURE_COLORS: Readonly<Record<string, string>> = {
  "bed-base": MINT_ORDER_SLICE_PALETTE.neutral,
  "bed-mattress": MINT_ORDER_SLICE_PALETTE.patient,
  "bed-pillow": MINT_ORDER_SLICE_PALETTE.accentLight,
  "gantry-column": MINT_ORDER_SLICE_PALETTE.primaryDark,
  "gantry-arm": MINT_ORDER_SLICE_PALETTE.accent,
  "exam-table": MINT_ORDER_SLICE_PALETTE.neutral,
  console: MINT_ORDER_SLICE_PALETTE.primary,
  machine: MINT_ORDER_SLICE_PALETTE.neutral,
  screen: MINT_ORDER_SLICE_PALETTE.accent,
  "exam-bed": MINT_ORDER_SLICE_PALETTE.patient,
  "table-top": MINT_ORDER_SLICE_PALETTE.neutral,
  "table-column": MINT_ORDER_SLICE_PALETTE.primaryDark,
  "table-base": MINT_ORDER_SLICE_PALETTE.primaryDark,
  lamp: MINT_ORDER_SLICE_PALETTE.accentLight,
  desk: MINT_ORDER_SLICE_PALETTE.neutral,
  "vision-chart": MINT_ORDER_SLICE_PALETTE.accentLight,
  "scope-stand": MINT_ORDER_SLICE_PALETTE.primaryDark,
  "scope-head": MINT_ORDER_SLICE_PALETTE.accent,
  "chair-base": MINT_ORDER_SLICE_PALETTE.primaryDark,
  "chair-seat": MINT_ORDER_SLICE_PALETTE.patient,
  "chair-back": MINT_ORDER_SLICE_PALETTE.patient,
  "bench-seat": MINT_ORDER_SLICE_PALETTE.neutral,
  "bench-back": MINT_ORDER_SLICE_PALETTE.neutral,
  "bench-legs": MINT_ORDER_SLICE_PALETTE.primaryDark,
  counter: MINT_ORDER_SLICE_PALETTE.neutral,
  "ticket-machine": MINT_ORDER_SLICE_PALETTE.primary,
  "bed-base-2": MINT_ORDER_SLICE_PALETTE.neutral,
  "bed-mattress-2": MINT_ORDER_SLICE_PALETTE.patient,
  "bed-pillow-2": MINT_ORDER_SLICE_PALETTE.accentLight,
  nightstand: MINT_ORDER_SLICE_PALETTE.neutral,
  "iv-stand": MINT_ORDER_SLICE_PALETTE.primary,
  "counter-top": MINT_ORDER_SLICE_PALETTE.accentLight,
  "counter-body": MINT_ORDER_SLICE_PALETTE.primary,
  monitor: MINT_ORDER_SLICE_PALETTE.accent,
  chair: MINT_ORDER_SLICE_PALETTE.primaryDark,
  "file-shelf": MINT_ORDER_SLICE_PALETTE.neutral,
};

export interface SliceBuildOptions {
  /** Descending flight + slab hole; default true for floorIndex >= 1 */
  withStairwell?: boolean;
  /** Shared shaft box; set on the lowest floor of a multi-floor build */
  withElevatorShaft?: boolean;
  /** Absolute Y span of the shared shaft box when withElevatorShaft */
  elevatorShaftSpanY?: { min: number; max: number };
  /** Override departments for this floor (e.g. upper floors 4-10 from khoa-upper-floors) */
  departments?: readonly KhoaSliceDepartment[];
}

function departmentsForFloor(floorIndex: number): KhoaSliceDepartment[] {
  return SLICE_DEPARTMENT_TEMPLATE.map((dept) => ({
    ...dept,
    rooms: dept.rooms.map((room) => ({
      ...room,
      roomId: `${room.roomId}-f${floorIndex}`,
    })),
  }));
}

function sharedRoomsForFloor(floorIndex: number): KhoaRoomSpec[] {
  return SLICE_SHARED_ROOMS_TEMPLATE.map((room) => ({
    ...room,
    roomId: `${room.roomId}-f${floorIndex}`,
  }));
}

function box(
  primitives: SlicePrimitive[],
  role: string,
  size: Vec3,
  position: Vec3,
  color: string,
  rotation?: Vec3
): void {
  primitives.push({ kind: "box", role, size, position, color, rotation });
}

function plane(
  primitives: SlicePrimitive[],
  role: string,
  width: number,
  height: number,
  position: Vec3,
  color: string,
  rotation?: Vec3
): void {
  primitives.push({
    kind: "plane",
    role,
    size: { x: width, y: height, z: 0 },
    position,
    color,
    rotation,
  });
}

function pushSlab(
  primitives: SlicePrimitive[],
  baseY: number,
  slabHole: { x0: number; x1: number; z0: number; z1: number } | null
): void {
  const { floorWidth, floorDepth, slabThickness } = SLICE_LAYOUT;
  const y = baseY - slabThickness / 2;
  const slabColor = MINT_ORDER_SLICE_PALETTE.floor;
  if (!slabHole) {
    box(
      primitives,
      "slab",
      { x: floorWidth, y: slabThickness, z: floorDepth },
      { x: floorWidth / 2, y, z: floorDepth / 2 },
      slabColor
    );
    return;
  }
  const holeW = slabHole.x1 - slabHole.x0;
  box(
    primitives,
    "slab-hole-west",
    { x: slabHole.x0, y: slabThickness, z: floorDepth },
    { x: slabHole.x0 / 2, y, z: floorDepth / 2 },
    slabColor
  );
  box(
    primitives,
    "slab-hole-east",
    {
      x: floorWidth - slabHole.x1,
      y: slabThickness,
      z: floorDepth,
    },
    {
      x: (floorWidth + slabHole.x1) / 2,
      y,
      z: floorDepth / 2,
    },
    slabColor
  );
  box(
    primitives,
    "slab-hole-north",
    {
      x: holeW,
      y: slabThickness,
      z: floorDepth - slabHole.z1,
    },
    {
      x: (slabHole.x0 + slabHole.x1) / 2,
      y,
      z: (slabHole.z1 + floorDepth) / 2,
    },
    slabColor
  );
  box(
    primitives,
    "slab-hole-south",
    { x: holeW, y: slabThickness, z: slabHole.z0 },
    {
      x: (slabHole.x0 + slabHole.x1) / 2,
      y,
      z: slabHole.z0 / 2,
    },
    slabColor
  );
}

function pushCorridorFloor(
  primitives: SlicePrimitive[],
  baseY: number,
  slabHole: { x0: number; x1: number; z0: number; z1: number } | null
): void {
  const { corridor } = SLICE_LAYOUT;
  const width = corridor.x1 - corridor.x0;
  const depth = corridor.z1 - corridor.z0;
  const y = baseY + 0.025;
  const color = MINT_ORDER_SLICE_PALETTE.floor;
  if (!slabHole) {
    box(
      primitives,
      "corridor-floor",
      { x: width, y: 0.05, z: depth },
      { x: (corridor.x0 + corridor.x1) / 2, y, z: (corridor.z0 + corridor.z1) / 2 },
      color
    );
    return;
  }
  box(
    primitives,
    "corridor-floor-west",
    { x: slabHole.x0 - corridor.x0, y: 0.05, z: depth },
    { x: (corridor.x0 + slabHole.x0) / 2, y, z: (corridor.z0 + corridor.z1) / 2 },
    color
  );
  box(
    primitives,
    "corridor-floor-east",
    { x: corridor.x1 - slabHole.x1, y: 0.05, z: depth },
    { x: (slabHole.x1 + corridor.x1) / 2, y, z: (corridor.z0 + corridor.z1) / 2 },
    color
  );
}

function pushCorridorEndWalls(primitives: SlicePrimitive[], baseY: number): void {
  const { corridor, wallHeight } = SLICE_LAYOUT;
  const color = MINT_ORDER_SLICE_PALETTE.wall;
  // East end closes the corridor
  box(
    primitives,
    "corridor-end-east",
    { x: 0.2, y: wallHeight, z: corridor.z1 - corridor.z0 },
    { x: corridor.x1 + 0.1, y: baseY + wallHeight / 2, z: (corridor.z0 + corridor.z1) / 2 },
    color
  );
  // West end: elevator opening spans z 4.9-7.1, two slivers close the rest
  box(
    primitives,
    "corridor-end-west-south",
    { x: 0.2, y: wallHeight, z: SLICE_LAYOUT.stairHole.z0 - corridor.z0 },
    { x: corridor.x0 + 0.1, y: baseY + wallHeight / 2, z: (corridor.z0 + SLICE_LAYOUT.stairHole.z0) / 2 },
    color
  );
  box(
    primitives,
    "corridor-end-west-north",
    { x: 0.2, y: wallHeight, z: corridor.z1 - SLICE_LAYOUT.stairHole.z1 },
    { x: corridor.x0 + 0.1, y: baseY + wallHeight / 2, z: (SLICE_LAYOUT.stairHole.z1 + corridor.z1) / 2 },
    color
  );
}

function pushRoom(
  primitives: SlicePrimitive[],
  furniture: SliceFurniture[],
  signs: SliceSign[],
  room: KhoaRoomSpec,
  baseY: number
): void {
  const { wallThickness: wt, wallHeight: wh, doorHeight: dh } = SLICE_LAYOUT;
  const { x: cx, z: cz } = room.position;
  const halfW = room.size.width / 2;
  const halfD = room.size.depth / 2;
  const doorAtNorth = room.doorOffset.z > 0;
  const wallColor = MINT_ORDER_SLICE_PALETTE.wall;
  const backZ = doorAtNorth ? cz - halfD - wt / 2 : cz + halfD + wt / 2;
  const frontZ = doorAtNorth ? cz + halfD + wt / 2 : cz - halfD - wt / 2;

  box(
    primitives,
    `room-wall-back-${room.roomId}`,
    { x: room.size.width + wt * 2, y: wh, z: wt },
    { x: cx, y: baseY + wh / 2, z: backZ },
    wallColor
  );
  box(
    primitives,
    `room-wall-side-left-${room.roomId}`,
    { x: wt, y: wh, z: room.size.depth },
    { x: cx - halfW - wt / 2, y: baseY + wh / 2, z: cz },
    wallColor
  );
  box(
    primitives,
    `room-wall-side-right-${room.roomId}`,
    { x: wt, y: wh, z: room.size.depth },
    { x: cx + halfW + wt / 2, y: baseY + wh / 2, z: cz },
    wallColor
  );

  if (room.doorWidth > 0) {
    const doorX = cx + room.doorOffset.x;
    const segL0 = cx - halfW - wt;
    const segL1 = doorX - room.doorWidth / 2;
    const segR0 = doorX + room.doorWidth / 2;
    const segR1 = cx + halfW + wt;
    if (segL1 - segL0 > 0.05) {
      box(
        primitives,
        `room-wall-front-left-${room.roomId}`,
        { x: segL1 - segL0, y: wh, z: wt },
        { x: (segL0 + segL1) / 2, y: baseY + wh / 2, z: frontZ },
        wallColor
      );
    }
    if (segR1 - segR0 > 0.05) {
      box(
        primitives,
        `room-wall-front-right-${room.roomId}`,
        { x: segR1 - segR0, y: wh, z: wt },
        { x: (segR0 + segR1) / 2, y: baseY + wh / 2, z: frontZ },
        wallColor
      );
    }
    box(
      primitives,
      `door-frame-${room.roomId}`,
      { x: room.doorWidth + 0.1, y: dh + 0.05, z: wt + 0.04 },
      { x: doorX, y: baseY + (dh + 0.05) / 2, z: frontZ },
      MINT_ORDER_SLICE_PALETTE.primaryDark
    );
    box(
      primitives,
      `door-panel-${room.roomId}`,
      { x: room.doorWidth - 0.06, y: dh - 0.05, z: 0.05 },
      {
        x: doorX,
        y: baseY + dh / 2 + 0.025,
        z: frontZ + (doorAtNorth ? 0.03 : -0.03),
      },
      MINT_ORDER_SLICE_PALETTE.primary
    );
    signs.push({
      id: `room-${room.roomId}`,
      variant: "room-wall",
      content: room.label,
      color: MINT_ORDER_SLICE_PALETTE.primary,
      position: {
        x: doorX,
        y: baseY + 2.35,
        z: frontZ + (doorAtNorth ? wt / 2 + 0.02 : -(wt / 2 + 0.02)),
      },
      rotation: { x: 0, y: doorAtNorth ? 0 : Math.PI, z: 0 },
      size: { x: 1.2, y: 0.35 },
    });
  } else {
    box(
      primitives,
      `room-wall-front-${room.roomId}`,
      { x: room.size.width + wt * 2, y: wh, z: wt },
      { x: cx, y: baseY + wh / 2, z: frontZ },
      wallColor
    );
  }

  const mirror = room.doorOffset.z < 0;
  const rotY = doorAtNorth ? 0 : Math.PI;
  for (const part of SLICE_FURNITURE_PRESET_BY_KIND[room.kind]) {
    const position: Vec3 = {
      x: cx + part.offset.x,
      y: baseY + part.offset.y,
      z: cz + (mirror ? -part.offset.z : part.offset.z),
    };
    if (part.kind === "box") {
      box(
        primitives,
        `furniture-${part.role}-${room.roomId}`,
        part.size,
        position,
        FURNITURE_COLORS[part.role] ?? MINT_ORDER_SLICE_PALETTE.neutral
      );
    } else {
      plane(
        primitives,
        `furniture-${part.role}-${room.roomId}`,
        part.size.x,
        part.size.y,
        position,
        FURNITURE_COLORS[part.role] ?? MINT_ORDER_SLICE_PALETTE.neutral,
        { x: 0, y: rotY, z: 0 }
      );
    }
  }
  furniture.push({
    roomId: room.roomId,
    kind: room.kind,
    position: { x: cx, y: baseY, z: cz },
    facing: doorAtNorth ? "north" : "south",
  });
}

function pushReceptionCorner(
  primitives: SlicePrimitive[],
  furniture: SliceFurniture[],
  floorIndex: number,
  baseY: number
): void {
  const roomId = `corridor-reception-f${floorIndex}`;
  const position: Vec3 = { x: 21.6, y: baseY, z: 5.6 };
  for (const part of SLICE_FURNITURE_PRESET_BY_KIND.reception) {
    box(
      primitives,
      `furniture-${part.role}-${roomId}`,
      part.size,
      {
        x: position.x + part.offset.x,
        y: baseY + part.offset.y,
        z: position.z + part.offset.z,
      },
      FURNITURE_COLORS[part.role] ?? MINT_ORDER_SLICE_PALETTE.neutral
    );
  }
  furniture.push({
    roomId,
    kind: "reception",
    position,
    facing: "south",
  });
}

function pushSigns(
  signs: SliceSign[],
  departments: readonly KhoaSliceDepartment[],
  floorIndex: number,
  baseY: number
): void {
  for (const dept of departments) {
    const centerX = dept.rooms.reduce((sum, room) => sum + room.position.x, 0) / dept.rooms.length;
    signs.push({
      id: `dept-${dept.code}-f${floorIndex}`,
      variant: "dept-hanging",
      content: `${dept.name} · ${dept.shortCode}`,
      color: dept.signageColor,
      position: { x: centerX, y: baseY + 2.2, z: 6.0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      size: { x: 2.0, y: 0.5 },
    });
  }
  signs.push({
    id: `dir-elevator-f${floorIndex}`,
    variant: "direction-arrow",
    content: "THANG MÁY",
    color: MINT_ORDER_SLICE_PALETTE.primaryDark,
    position: { x: 3.2, y: baseY + 1.8, z: 6.0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    size: { x: 0.55, y: 0.55 },
  });
  signs.push({
    id: `dir-stairs-f${floorIndex}`,
    variant: "direction-arrow",
    content: "THANG BỘ",
    color: MINT_ORDER_SLICE_PALETTE.primaryDark,
    position: { x: 9.2, y: baseY + 1.8, z: 6.0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    size: { x: 0.55, y: 0.55 },
  });
}

function pushStairwell(primitives: SlicePrimitive[], floorIndex: number, baseY: number): StairwellSpec {
  const { stairHole, stairSteps, floorHeight } = SLICE_LAYOUT;
  const steps = stairSteps;
  const stepWidth = stairHole.z1 - stairHole.z0;
  const run = stairHole.x1 - stairHole.x0;
  const stepDepth = run / steps;
  const stepRise = floorHeight / steps;
  const stepColor = MINT_ORDER_SLICE_PALETTE.neutral;
  const railColor = MINT_ORDER_SLICE_PALETTE.primaryDark;

  for (let i = 0; i < steps; i++) {
    box(
      primitives,
      `stair-step-${i}`,
      { x: stepDepth, y: 0.3, z: stepWidth },
      {
        x: stairHole.x1 - stepDepth / 2 - i * stepDepth,
        y: baseY - 0.15 - i * stepRise,
        z: (stairHole.z0 + stairHole.z1) / 2,
      },
      stepColor
    );
  }

  // Handrail follows the descent slope (east end at floor level)
  const railLength = Math.sqrt(run * run + floorHeight * floorHeight);
  box(
    primitives,
    "stair-handrail",
    { x: railLength, y: 0.07, z: 0.07 },
    {
      x: (stairHole.x0 + stairHole.x1) / 2,
      y: baseY - floorHeight / 2 + 0.9,
      z: stairHole.z0 + 0.03,
    },
    railColor,
    { x: 0, y: 0, z: Math.atan2(floorHeight, run) }
  );

  // Guard rails around the hole: north, south, west (east stays open for entry)
  box(
    primitives,
    "stair-hole-rail-north",
    { x: stairHole.x1 - stairHole.x0, y: 0.9, z: 0.06 },
    {
      x: (stairHole.x0 + stairHole.x1) / 2,
      y: baseY + 0.45,
      z: stairHole.z1 + 0.03,
    },
    railColor
  );
  box(
    primitives,
    "stair-hole-rail-south",
    { x: stairHole.x1 - stairHole.x0, y: 0.9, z: 0.06 },
    {
      x: (stairHole.x0 + stairHole.x1) / 2,
      y: baseY + 0.45,
      z: stairHole.z0 - 0.03,
    },
    railColor
  );
  box(
    primitives,
    "stair-hole-rail-west",
    { x: 0.06, y: 0.9, z: stairHole.z1 - stairHole.z0 },
    {
      x: stairHole.x0 - 0.03,
      y: baseY + 0.45,
      z: (stairHole.z0 + stairHole.z1) / 2,
    },
    railColor
  );

  // Landing pad at the flight bottom, just west of the hole
  box(
    primitives,
    "stair-landing",
    { x: 0.9, y: 0.05, z: stepWidth },
    {
      x: stairHole.x0 - 0.45,
      y: baseY - floorHeight + 0.025,
      z: (stairHole.z0 + stairHole.z1) / 2,
    },
    MINT_ORDER_SLICE_PALETTE.floor
  );

  return {
    hole: { ...stairHole },
    steps,
    stepRise,
    stepDepth,
    stepWidth,
    floorIndex,
    landsOnFloorIndex: floorIndex - 1,
  };
}

function pushElevator(
  primitives: SlicePrimitive[],
  baseY: number,
  withShaft: boolean,
  shaftSpanY: { min: number; max: number } | null
): void {
  const { elevator } = SLICE_LAYOUT;
  const doorColor = MINT_ORDER_SLICE_PALETTE.accent;
  for (const side of [-1, 1] as const) {
    box(
      primitives,
      `elevator-door-${side < 0 ? "left" : "right"}`,
      { x: 0.06, y: 2.1, z: 0.72 },
      {
        x: elevator.faceX + 0.03,
        y: baseY + 1.05,
        z: elevator.doorZ + side * 0.37,
      },
      doorColor
    );
  }
  box(
    primitives,
    "elevator-panel",
    { x: 0.08, y: 1.4, z: 0.24 },
    { x: elevator.faceX + 0.07, y: baseY + 1.25, z: elevator.doorZ - 0.85 },
    MINT_ORDER_SLICE_PALETTE.primary
  );
  if (withShaft && shaftSpanY) {
    box(
      primitives,
      "elevator-shaft",
      {
        x: elevator.faceX,
        y: shaftSpanY.max - shaftSpanY.min,
        z: SLICE_LAYOUT.stairHole.z1 - SLICE_LAYOUT.stairHole.z0,
      },
      {
        x: elevator.faceX / 2,
        y: (shaftSpanY.min + shaftSpanY.max) / 2,
        z: elevator.doorZ,
      },
      MINT_ORDER_SLICE_PALETTE.primaryDark
    );
  }
}

export function buildKhoaFloorSlice(floorIndex: number, opts: SliceBuildOptions = {}): KhoaFloorSlice {
  if (!Number.isInteger(floorIndex) || floorIndex < 0) {
    throw new Error(`buildKhoaFloorSlice: floorIndex must be an integer >= 0, got ${floorIndex}`);
  }

  const baseY = floorIndex * SLICE_LAYOUT.floorHeight;
  const primitives: SlicePrimitive[] = [];
  const furniture: SliceFurniture[] = [];
  const signs: SliceSign[] = [];

  const departments = opts.departments ?? departmentsForFloor(floorIndex);
  const sharedRooms = sharedRoomsForFloor(floorIndex);
  const hasStairwell = opts.withStairwell ?? floorIndex >= 1;
  const slabHole = hasStairwell ? { ...SLICE_LAYOUT.stairHole } : null;

  pushSlab(primitives, baseY, slabHole);
  pushCorridorFloor(primitives, baseY, slabHole);
  pushCorridorEndWalls(primitives, baseY);

  for (const dept of departments) {
    for (const room of dept.rooms) {
      pushRoom(primitives, furniture, signs, room, baseY);
    }
  }
  for (const room of sharedRooms) {
    pushRoom(primitives, furniture, signs, room, baseY);
  }
  pushReceptionCorner(primitives, furniture, floorIndex, baseY);
  pushSigns(signs, departments, floorIndex, baseY);

  const stairwell = hasStairwell ? pushStairwell(primitives, floorIndex, baseY) : null;

  const withShaft = opts.withElevatorShaft ?? false;
  const shaftSpanY = opts.elevatorShaftSpanY ?? null;
  pushElevator(primitives, baseY, withShaft, shaftSpanY);

  return {
    floorIndex,
    displayFloor: floorIndex + 1,
    baseY,
    footprint: { width: SLICE_LAYOUT.floorWidth, depth: SLICE_LAYOUT.floorDepth },
    slabHole,
    departments,
    sharedRooms,
    primitives,
    furniture,
    signs,
    stairwell,
    elevator: {
      faceX: SLICE_LAYOUT.elevator.faceX,
      doorZ: SLICE_LAYOUT.elevator.doorZ,
      hasShaft: withShaft && shaftSpanY !== null,
      shaftSpanY: withShaft && shaftSpanY ? { ...shaftSpanY } : null,
    },
  };
}

/**
 * Build a stacked multi-floor slice set. The lowest floor carries the shared
 * elevator shaft; stairwells (hole + descending flight) sit on the top floor
 * and on every floor whose lower neighbor is included in the set.
 */
export function buildKhoaSlices(floorIndices: readonly number[]): KhoaFloorSlice[] {
  const floors = [...new Set(floorIndices)].sort((a, b) => a - b);
  if (floors.length === 0) {
    throw new Error("buildKhoaSlices: at least one floor index is required");
  }
  for (const floor of floors) {
    if (!Number.isInteger(floor) || floor < 0) {
      throw new Error(`buildKhoaSlices: floor indices must be integers >= 0, got ${floor}`);
    }
  }

  const { floorHeight } = SLICE_LAYOUT;
  const minFloor = floors[0] ?? 0;
  const maxFloor = floors[floors.length - 1] ?? 0;
  const shaftSpanY = {
    min: minFloor * floorHeight,
    max: maxFloor * floorHeight + floorHeight,
  };

  const stairFloors = new Set(floors.filter((f) => floors.includes(f - 1)));
  stairFloors.add(maxFloor);

  return floors.map((floorIndex) =>
    buildKhoaFloorSlice(floorIndex, {
      withStairwell: stairFloors.has(floorIndex),
      withElevatorShaft: floorIndex === minFloor,
      elevatorShaftSpanY: shaftSpanY,
    })
  );
}

const TRIS_BY_PRIMITIVE_KIND: Readonly<Record<SlicePrimitive["kind"], number>> = { box: 12, plane: 2 };
const SIGN_TRIS = 2;

export interface SliceTrisInput {
  floorIndex: number;
  primitives: readonly SlicePrimitive[];
  signs: readonly SliceSign[];
}

export interface SliceTrisEstimate {
  total: number;
  perFloor: Record<string, number>;
}

/**
 * Deterministic upper-bound triangle estimate: every box primitive renders
 * as BoxGeometry (12 tris), every plane and sign as PlaneGeometry (2 tris).
 * The R3F builder emits exactly one mesh per primitive/sign, so this count
 * matches renderer.info.render.triangles at runtime (modulo instancing).
 */
export function estimateKhoaSliceTris(slices: readonly SliceTrisInput[]): SliceTrisEstimate {
  const perFloor: Record<string, number> = {};
  let total = 0;
  for (const slice of slices) {
    let count = 0;
    for (const primitive of slice.primitives) {
      count += TRIS_BY_PRIMITIVE_KIND[primitive.kind];
    }
    count += slice.signs.length * SIGN_TRIS;
    perFloor[String(slice.floorIndex)] = count;
    total += count;
  }
  return { total, perFloor };
}

/**
 * Layout invariants per specs/03 validation rules: primitives stay inside
 * the footprint (stairs may descend one floor below their own base), doors
 * sit on room perimeters, signage tiers are complete.
 */
export function validateKhoaFloorSlice(slice: KhoaFloorSlice): string[] {
  const errors: string[] = [];
  const { floorWidth, floorDepth, floorHeight } = SLICE_LAYOUT;
  const margin = 0.6;
  const minY = slice.baseY - floorHeight - 0.2;
  const maxY = slice.baseY + SLICE_LAYOUT.wallHeight + 0.1;

  slice.primitives.forEach((p, i) => {
    const label = `primitive[${i}] ${p.role}`;
    if (p.position.x < -margin || p.position.x > floorWidth + margin) {
      errors.push(`${label} x out of bounds: ${p.position.x}`);
    }
    if (p.position.z < -margin || p.position.z > floorDepth + margin) {
      errors.push(`${label} z out of bounds: ${p.position.z}`);
    }
    // The shared elevator shaft box spans the whole slice stack, so its
    // center sits above any single floor's ceiling; x/z bounds still apply.
    if (p.role !== "elevator-shaft" && (p.position.y < minY || p.position.y > maxY)) {
      errors.push(`${label} y out of bounds: ${p.position.y}`);
    }
  });

  const allRooms: KhoaRoomSpec[] = [
    ...slice.departments.flatMap((dept) => [...dept.rooms]),
    ...slice.sharedRooms,
  ];
  for (const room of allRooms) {
    const halfW = room.size.width / 2;
    const halfD = room.size.depth / 2;
    const onEdge =
      Math.abs(Math.abs(room.doorOffset.x) - halfW) < 0.01 ||
      Math.abs(Math.abs(room.doorOffset.z) - halfD) < 0.01;
    if (!onEdge && room.doorWidth > 0) {
      errors.push(
        `room ${room.roomId} door not on perimeter: offset=(${room.doorOffset.x}, ${room.doorOffset.z})`
      );
    }
    if (room.doorWidth > room.size.width) {
      errors.push(`room ${room.roomId} door wider than room: ${room.doorWidth}`);
    }
    if (
      room.position.x - halfW < 0 ||
      room.position.x + halfW > floorWidth ||
      room.position.z - halfD < 0 ||
      room.position.z + halfD > floorDepth
    ) {
      errors.push(`room ${room.roomId} out of floor bounds`);
    }
  }

  const hangingSigns = slice.signs.filter((s) => s.variant === "dept-hanging");
  if (hangingSigns.length !== slice.departments.length) {
    errors.push(
      `expected one hanging sign per department, got ${hangingSigns.length} for ${slice.departments.length}`
    );
  }
  const roomWallSigns = slice.signs.filter((s) => s.variant === "room-wall");
  if (roomWallSigns.length !== allRooms.length) {
    errors.push(`expected one wall sign per room, got ${roomWallSigns.length} for ${allRooms.length}`);
  }
  for (const sign of slice.signs) {
    if (!MINT_ORDER_COLORS.includes(sign.color)) {
      errors.push(`sign ${sign.id} color outside Mint Order: ${sign.color}`);
    }
  }

  return errors;
}

/** Exact code + floor lookup over a built slice set */
export function getKhoaSliceDepartment(
  slices: readonly KhoaFloorSlice[],
  code: string,
  floorIndex: number
): KhoaSliceDepartment | undefined {
  return slices.find((s) => s.floorIndex === floorIndex)?.departments.find((dept) => dept.code === code);
}
