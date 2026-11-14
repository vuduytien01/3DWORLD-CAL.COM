/**
 * Hospital World Specification — 10-floor procedural hospital layout
 *
 * This spec drives threejs-world-generation to create a multi-floor hospital
 * with departments, rooms, corridors, stairs, elevators, and signage.
 * All measurements in meters. Tris budget: ~18k for 10 floors (Intel Iris Xe).
 */

export interface WorldSpec {
  /** Global world parameters */
  world: {
    /** World seed for deterministic generation */
    seed: number;
    /** World dimensions in meters */
    dimensions: { width: number; depth: number; height: number };
    /** Number of floors */
    floorCount: number;
    /** Floor height (floor-to-floor) */
    floorHeight: number;
    /** Ground floor slab thickness */
    slabThickness: number;
  };

  /** Semantic regions (floors are regions) */
  regions: RegionSpec[];

  /** Landmarks with stable IDs for camera path and navigation */
  landmarks: LandmarkSpec[];

  /** Camera path for demo walkthrough */
  cameraPath: CameraKeyframe[];

  /** Atmosphere and lighting shared across all regions */
  atmosphere: AtmosphereSpec;

  /** Asset catalog paths for production tier */
  assetCatalogPaths: string[];
}

export interface RegionSpec {
  /** Stable ID (e.g., "floor-1", "floor-2") */
  id: string;
  /** Display name */
  name: string;
  /** Region center in world space (x, z) */
  center: { x: number; z: number };
  /** Region radius in meters */
  radius: number;
  /** Floor index (0 = ground) */
  floorIndex: number;
  /** Landform operator for terrain */
  landform: LandformSpec;
  /** Color palette for this region (Mint Order) */
  palette: PaletteSpec;
  /** Scatter recipes for furniture, equipment, signage */
  scatter: ScatterRecipe[];
  /** Departments on this floor */
  departments: DepartmentSpec[];
}

export interface LandformSpec {
  /** Operator: "flat" for hospital floors */
  operator: 'flat';
  /** Base elevation for this floor */
  baseElevation: number;
  /** Noise parameters (minimal for hospital) */
  noise?: { scale: number; amplitude: number; octaves: number };
}

export interface RoomInstanceSpec {
  id: string;
  label: string;
  type: RoomType;
  furnitureKind: FurnitureKind;
  worldPosition: { x: number; y: number; z: number };
  doorPosition: number;
  depth?: number;  // Room depth for sign positioning
}

export interface PaletteSpec {
  /** Primary surface colors (Mint Order 8-color) */
  primary: string[];
  /** Accent colors for departments */
  accents: Record<string, string>;
  /** Floor material */
  floor: string;
  /** Wall material */
  wall: string;
  /** Ceiling material */
  ceiling: string;
}

export interface ScatterRecipe {
  /** Recipe ID */
  id: string;
  /** Asset category */
  category: 'furniture' | 'equipment' | 'signage' | 'props' | 'vertical';
  /** Asset keys from catalog */
  assets: string[];
  /** Density per 100m² */
  density: number;
  /** Slope rejection (0 = flat only) */
  slopeLimit: number;
  /** Placement constraints */
  constraints: PlacementConstraint[];
  /** Scale range */
  scaleRange: readonly [number, number];
  /** Rotation range (degrees) */
  rotationRange: readonly [number, number];
}

export interface PlacementConstraint {
  /** Constraint type */
  type: 'near' | 'away' | 'on' | 'inside' | 'align';
  /** Target region, landmark, or asset ID */
  target: string;
  /** Distance in meters */
  distance: number;
  /** For align: axis to align to */
  axis?: 'x' | 'z';
}

export interface DepartmentSpec {
  /** Department code (e.g., "NOI", "CDHA") */
  code: string;
  /** Department name (Vietnamese) */
  name: string;
  /** Short code for signage */
  shortCode: string;
  /** Floor index */
  floor: number;
  /** World-space corridor side: -1 = left, 1 = right */
  corridorSide: -1 | 1;
  /** Corridor position along corridor (0-1) */
  corridorPosition: number;
  /** Room specifications */
  rooms: RoomSpec[];
  /** Signage color (Mint Order) */
  signageColor: string;
  /** Specialty note for AI guide triage */
  specialty: string;
}

export interface RoomSpec {
  /** Room ID within department */
  id: string;
  /** Room label (e.g., "01", "02") */
  label: string;
  /** Room type determines furniture */
  type: RoomType;
  /** Width in meters */
  width: number;
  /** Depth in meters */
  depth: number;
  /** Furniture kind for instancing - use const assertion for literal type */
  furnitureKind: FurnitureKind;
  /** Door position on wall: -1 = left, 0 = center, 1 = right */
  doorPosition: number;
}

export type RoomType =
  | 'consultation'    // Phòng khám - giường khám
  | 'xray'            // X-quang - gantry + bàn
  | 'ultrasound'      // Siêu âm - máy + màn
  | 'surgery'         // Phẫu thuật - bàn mổ + đèn
  | 'eye_exam'        // Đánh giá thị lực - bàn đo
  | 'ent_exam'        // Tai mũi họng - bàn khám
  | 'dental'          // Răng hàm mặt - ghế răng
  | 'lab'             // Xét nghiệm - máy analyzer
  | 'waiting'         // Chờ - ghế băng
  | 'reception'       // Tiếp đón - quầy + máy vé
  | 'payment'         // Thanh toán - quầy
  | 'admission'       // Nhập viện - giường
  | 'elevator_lobby'  // Sảnh thang máy
  | 'stairs_lobby';   // Sảnh thang bộ

export type FurnitureKind =
  | 'exam_bed'        // Giường khám
  | 'xray_gantry'     // Gantry X-quang
  | 'ultrasound_machine' // Máy siêu âm
  | 'surgical_table'  // Bàn mổ
  | 'eye_chart'       // Bàn đo thị lực
  | 'ent_table'       // Bàn tai mũi họng
  | 'dental_chair'    // Ghế răng
  | 'lab_analyzer'    // Máy xét nghiệm
  | 'waiting_bench'   // Ghế băng 4 chỗ
  | 'reception_counter' // Quầy tiếp đón
  | 'payment_counter' // Quầy thanh toán
  | 'hospital_bed'    // Giường bệnh
  | 'elevator_cabin'  // Thang máy
  | 'stairs_module';  // Thang bộ

export interface LandmarkSpec {
  /** Stable landmark ID */
  id: string;
  /** Landmark type */
  type: 'entrance' | 'reception' | 'elevator' | 'stairs' | 'department' | 'room' | 'waypoint';
  /** World-space position */
  position: { x: number; y: number; z: number };
  /** Associated region ID */
  regionId: string;
  /** Metadata for navigation */
  metadata?: Record<string, unknown>;
}

export interface CameraKeyframe {
  /** Time in seconds */
  time: number;
  /** Camera position */
  position: { x: number; y: number; z: number };
  /** Camera target (look-at) */
  target: { x: number; y: number; z: number };
  /** Field of view in degrees */
  fov: number;
  /** Transition type */
  transition: 'linear' | 'ease' | 'cut';
}

export interface AtmosphereSpec {
  /** Ambient light color and intensity */
  ambient: { color: string; intensity: number };
  /** Directional light (sun) */
  directional: { color: string; intensity: number; position: { x: number; y: number; z: number } };
  /** Hemisphere light */
  hemisphere: { skyColor: string; groundColor: string; intensity: number };
  /** Fog for depth perception */
  fog?: { color: string; near: number; far: number };
  /** Skybox/environment */
  environment?: string;
}

/**
 * Default hospital world specification for 10-floor Vietnamese hospital
 */
export const HOSPITAL_WORLD_SPEC: WorldSpec = {
  world: {
    seed: 20261107,
    dimensions: { width: 48, depth: 36, height: 30 }, // 10 floors × 3m
    floorCount: 10,
    floorHeight: 3.0,
    slabThickness: 0.3,
  },

  regions: [
    // Ground floor (floor 0) - Main entrance, reception, ticket, queue, lab, payment
    {
      id: 'floor-0',
      name: 'Tầng 1 - Sảnh chính & Xét nghiệm',
      center: { x: 0, z: 0 },
      radius: 20,
      floorIndex: 0,
      landform: { operator: 'flat' as const, baseElevation: 0 },
      palette: {
        primary: ['#EEF5F2', '#CDEBE3', '#0F766E', '#134E4A', '#99F6E4', '#ECFDF5', '#F8FAFC', '#BFDBFE'],
        accents: { 'TICKET': '#0F766E', 'LAB': '#134E4A', 'PAYMENT': '#BFDBFE' },
        floor: '#EEF5F2',
        wall: '#CDEBE3',
        ceiling: '#F8FAFC',
      },
      scatter: [
        {
          id: 'floor0-furniture',
          category: 'furniture' as const,
          assets: ['waiting_bench', 'reception_counter', 'lab_analyzer', 'payment_counter'],
          density: 8,
          slopeLimit: 0,
          constraints: [
            { type: 'near', target: 'reception', distance: 5 } as const,
            { type: 'near', target: 'lab', distance: 3 } as const,
            { type: 'near', target: 'payment', distance: 3 } as const,
          ],
          scaleRange: [1.0, 1.0] as const,
          rotationRange: [0, 0] as const,
        },
        {
          id: 'floor0-signage',
          category: 'signage' as const,
          assets: ['step_chip_ticket', 'step_chip_queue', 'step_chip_lab', 'step_chip_payment', 'dir_elevator', 'dir_stairs'],
          density: 12,
          slopeLimit: 0,
          constraints: [
            { type: 'on', target: 'corridor_walls', distance: 0 } as const,
            { type: 'align', target: 'corridor_centerline', distance: 0, axis: 'z' } as const,
          ],
          scaleRange: [1.0, 1.0] as const,
          rotationRange: [0, 180] as const,
        },
        {
          id: 'floor0-vertical',
          category: 'vertical' as const,
          assets: ['elevator_cabin', 'stairs_module'],
          density: 2,
          slopeLimit: 0,
          constraints: [
            { type: 'near', target: 'elevator_lobby', distance: 1 } as const,
            { type: 'near', target: 'stairs_lobby', distance: 1 } as const,
          ],
          scaleRange: [1.0, 1.0] as const,
          rotationRange: [0, 0] as const,
        },
      ],
      departments: [
        {
          code: 'TIEPDON',
          name: 'Tiếp đón & Lấy vé',
          shortCode: 'TD',
          floor: 0,
          corridorSide: -1,
          corridorPosition: 0.1,
          rooms: [
            { id: 'reception', label: 'TD', type: 'reception', width: 6, depth: 4, furnitureKind: 'reception_counter' as const, doorPosition: 0 },
            { id: 'waiting_main', label: 'XH', type: 'waiting', width: 8, depth: 4, furnitureKind: 'waiting_bench' as const, doorPosition: 0 },
          ],
          signageColor: '#0F766E',
          specialty: 'Tiếp đón bệnh nhân, cấp vé số, hướng dẫn ban đầu',
        },
        {
          code: 'XETNGHIEM',
          name: 'Xét nghiệm',
          shortCode: 'XN',
          floor: 0,
          corridorSide: 1,
          corridorPosition: 0.3,
          rooms: [
            { id: 'lab_main', label: 'XN', type: 'lab', width: 6, depth: 5, furnitureKind: 'lab_analyzer' as const, doorPosition: 0 },
            { id: 'lab_waiting', label: 'XN-CHO', type: 'waiting', width: 4, depth: 3, furnitureKind: 'waiting_bench' as const, doorPosition: 0 },
          ],
          signageColor: '#134E4A',
          specialty: 'Xét nghiệm máu, nước tiểu, sinh hóa, miễn dịch',
        },
        {
          code: 'THANHTOAN',
          name: 'Thanh toán',
          shortCode: 'TT',
          floor: 0,
          corridorSide: -1,
          corridorPosition: 0.9,
          rooms: [
            { id: 'payment_counter', label: 'TT', type: 'payment', width: 5, depth: 3, furnitureKind: 'payment_counter' as const, doorPosition: 0 },
          ],
          signageColor: '#BFDBFE',
          specialty: 'Thu phí khám, xét nghiệm, thuốc, BHYT',
        },
      ],
    },

    // Floors 1-9 (floors 1-9) - Clinical departments
    ...Array.from({ length: 9 }, (_, i) => {
      const floorIndex = i + 1;
      const deptConfigs = [
        { code: 'NOI', name: 'Khoa Nội', shortCode: 'NOI', specialty: 'Nội tổng quát, tim mạch, tiêu hóa, hô hấp', side: -1, pos: 0.15, color: '#0F766E' },
        { code: 'NGOAI', name: 'Khoa Ngoại', shortCode: 'NG', specialty: 'Phẫu thuật tổng quát, chấn thương, tạo hình', side: 1, pos: 0.15, color: '#134E4A' },
        { code: 'CDHA', name: 'Chẩn đoán hình ảnh', shortCode: 'CDHA', specialty: 'X-quang, CT, MRI, siêu âm, Doppler', side: -1, pos: 0.35, color: '#BFDBFE' },
        { code: 'MAT', name: 'Khoa Mắt', shortCode: 'MAT', specialty: 'Khám mắt, đo thị lực, phẫu thuật thủy tinh thể', side: 1, pos: 0.35, color: '#ECFDF5' },
        { code: 'TMH', name: 'Tai Mũi Họng', shortCode: 'TMH', specialty: 'Khám TMH, nội soi, đính chính thanh quản', side: -1, pos: 0.55, color: '#99F6E4' },
        { code: 'RHM', name: 'Răng Hàm Mặt', shortCode: 'RHM', specialty: 'Khám răng, nhổ, trám, niềng, phẫu thuật hàm', side: 1, pos: 0.55, color: '#F8FAFC' },
        { code: 'NHIKHOA', name: 'Nhi khoa', shortCode: 'NK', specialty: 'Khám bệnh nhi, tiêm chủng, theo dõi phát triển', side: -1, pos: 0.75, color: '#CDEBE3' },
        { code: 'SANKHOA', name: 'Sản khoa', shortCode: 'SK', specialty: 'Khám thai, sinh, kế hoạch hóa gia đình', side: 1, pos: 0.75, color: '#EEF5F2' },
      ] as const;

      return {
        id: `floor-${floorIndex}`,
        name: `Tầng ${floorIndex + 1} - Các khoa lâm sàng`,
        center: { x: 0, z: 0 },
        radius: 20,
        floorIndex,
        landform: { operator: 'flat' as const, baseElevation: floorIndex * 3.0 },
        palette: {
          primary: ['#EEF5F2', '#CDEBE3', '#0F766E', '#134E4A', '#99F6E4', '#ECFDF5', '#F8FAFC', '#BFDBFE'],
          accents: Object.fromEntries(deptConfigs.map(d => [d.code, d.color])),
          floor: '#EEF5F2',
          wall: '#CDEBE3',
          ceiling: '#F8FAFC',
        },
        scatter: [
          {
            id: `floor${floorIndex}-furniture`,
            category: 'furniture' as const,
            assets: ['exam_bed', 'xray_gantry', 'ultrasound_machine', 'surgical_table', 'eye_chart', 'ent_table', 'dental_chair', 'waiting_bench'],
            density: 12,
            slopeLimit: 0,
            constraints: [
              { type: 'inside', target: `floor-${floorIndex}`, distance: 0 } as const,
            ],
            scaleRange: [1.0, 1.0] as const,
            rotationRange: [0, 180] as const,
          },
          {
            id: `floor${floorIndex}-signage`,
            category: 'signage' as const,
            assets: deptConfigs.flatMap(d => [
              `dept_${d.code.toLowerCase()}`,
              `room_${d.code.toLowerCase()}_01`,
              `room_${d.code.toLowerCase()}_02`,
              'dir_elevator',
              'dir_stairs',
            ]),
            density: 16,
            slopeLimit: 0,
            constraints: [
              { type: 'on', target: 'corridor_walls', distance: 0 } as const,
              { type: 'align', target: 'corridor_centerline', distance: 0, axis: 'z' } as const,
            ],
            scaleRange: [1.0, 1.0] as const,
            rotationRange: [0, 180] as const,
          },
          {
            id: `floor${floorIndex}-vertical`,
            category: 'vertical' as const,
            assets: ['elevator_cabin', 'stairs_module'],
            density: 2,
            slopeLimit: 0,
            constraints: [
              { type: 'near', target: 'elevator_lobby', distance: 1 } as const,
              { type: 'near', target: 'stairs_lobby', distance: 1 } as const,
            ],
            scaleRange: [1.0, 1.0] as const,
            rotationRange: [0, 0] as const,
          },
        ],
        departments: deptConfigs.map((d, di) => ({
          code: `${d.code}_F${floorIndex}`,
          name: `${d.name} (Tầng ${floorIndex + 1})`,
          shortCode: d.shortCode,
          floor: floorIndex,
          corridorSide: d.side as -1 | 1,
          corridorPosition: d.pos + (di % 2) * 0.02,
          rooms: [
            { id: `room_${d.code.toLowerCase()}_1`, label: '01', type: 'consultation' as const, width: 4, depth: 4, furnitureKind: 'exam_bed' as const, doorPosition: -0.3 },
            { id: `room_${d.code.toLowerCase()}_2`, label: '02', type: getSpecialRoomType(d.code), width: 5, depth: 4, furnitureKind: getSpecialFurnitureKind(d.code), doorPosition: 0.3 },
            { id: `waiting_${d.code.toLowerCase()}`, label: 'CHỜ', type: 'waiting' as const, width: 4, depth: 3, furnitureKind: 'waiting_bench' as const, doorPosition: 0 },
          ],
          signageColor: d.color,
          specialty: d.specialty,
        })),
      };
    }),
  ],

  landmarks: [
    { id: 'main_entrance', type: 'entrance', position: { x: 0, y: 0, z: -18 }, regionId: 'floor-0', metadata: { stepId: 'step-ticket' } },
    { id: 'reception', type: 'reception', position: { x: -8, y: 1.5, z: -12 }, regionId: 'floor-0', metadata: { stepId: 'step-ticket', department: 'TIEPDON' } },
    { id: 'elevator_lobby_0', type: 'elevator', position: { x: 10, y: 1.5, z: 0 }, regionId: 'floor-0', metadata: { connectsTo: 'all' } },
    { id: 'stairs_lobby_0', type: 'stairs', position: { x: -10, y: 1.5, z: 0 }, regionId: 'floor-0', metadata: { connectsTo: 'all' } },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `elevator_lobby_${i}`,
      type: 'elevator' as const,
      position: { x: 10, y: 1.5 + i * 3.0, z: 0 },
      regionId: `floor-${i}`,
      metadata: { connectsTo: 'all', floor: i },
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `stairs_lobby_${i}`,
      type: 'stairs' as const,
      position: { x: -10, y: 1.5 + i * 3.0, z: 0 },
      regionId: `floor-${i}`,
      metadata: { connectsTo: 'all', floor: i },
    })),
  ],

  cameraPath: [
    { time: 0, position: { x: 0, y: 8, z: -25 }, target: { x: 0, y: 1.5, z: -18 }, fov: 60, transition: 'ease' },
    { time: 3, position: { x: -8, y: 2.5, z: -12 }, target: { x: -8, y: 1.5, z: -12 }, fov: 50, transition: 'ease' },
    { time: 6, position: { x: 0, y: 3, z: 0 }, target: { x: 0, y: 1.5, z: 0 }, fov: 55, transition: 'ease' },
    { time: 10, position: { x: 10, y: 4.5, z: 5 }, target: { x: 10, y: 3, z: 0 }, fov: 50, transition: 'ease' },
    { time: 15, position: { x: 0, y: 15, z: 0 }, target: { x: 0, y: 13.5, z: 0 }, fov: 60, transition: 'ease' },
    { time: 20, position: { x: -12, y: 16.5, z: 5 }, target: { x: -8, y: 16.5, z: 0 }, fov: 50, transition: 'ease' },
    { time: 25, position: { x: 0, y: 28, z: 0 }, target: { x: 0, y: 27, z: 0 }, fov: 55, transition: 'ease' },
    { time: 30, position: { x: 0, y: 5, z: 15 }, target: { x: 0, y: 1.5, z: 8 }, fov: 50, transition: 'ease' },
  ],

  atmosphere: {
    ambient: { color: '#F8FAFC', intensity: 0.6 },
    directional: { color: '#FFFFFF', intensity: 1.2, position: { x: 10, y: 20, z: 10 } },
    hemisphere: { skyColor: '#EEF5F2', groundColor: '#CDEBE3', intensity: 0.8 },
    fog: { color: '#EEF5F2', near: 15, far: 50 },
  },

  assetCatalogPaths: [
    'projects/hospital/assets/3d/catalogs/kenney-furniture-kit',
    'projects/hospital/assets/3d/catalogs/kenney-building-kit',
    'projects/hospital/assets/3d/catalogs/quaternius-characters',
    'projects/hospital/assets/3d/catalogs/heyheythere-hospital',
    'projects/hospital/assets/3d/catalogs/atomic-realm-hospital',
  ],
};

/**
 * Map department code to special room type
 */
function getSpecialRoomType(deptCode: string): RoomType {
  const map: Record<string, RoomType> = {
    'CDHA': 'xray',
    'MAT': 'eye_exam',
    'TMH': 'ent_exam',
    'RHM': 'dental',
    'NGOAI': 'surgery',
    'NOI': 'ultrasound',
    'NHIKHOA': 'consultation',
    'SANKHOA': 'ultrasound',
  };
  return map[deptCode] || 'consultation';
}

/**
 * Map department code to special furniture kind
 */
function getSpecialFurnitureKind(deptCode: string): FurnitureKind {
  const map: Record<string, FurnitureKind> = {
    'CDHA': 'xray_gantry',
    'MAT': 'eye_chart',
    'TMH': 'ent_table',
    'RHM': 'dental_chair',
    'NGOAI': 'surgical_table',
    'NOI': 'ultrasound_machine',
    'NHIKHOA': 'exam_bed',
    'SANKHOA': 'ultrasound_machine',
  };
  return map[deptCode] || 'exam_bed';
}

/**
 * Generate STEPS array from world spec (8 pipeline steps with 3D positions + AI messages)
 */
export function generateStepsFromSpec(): StepLocation[] {
  const steps: StepLocation[] = [
    {
      stepId: 'step-ticket',
      label: 'LẤY VÉ',
      labelEn: 'TICKET',
      position: { x: -8, z: -12, y: 1.5 },
      floor: 0,
      aiGuideMessage: 'Chào bạn, hãy đến quầy Tiếp đón lấy vé số. Số vé của bạn sẽ hiển thị trên màn hình.',
      department: 'TIEPDON',
      estimatedWait: 3,
    },
    {
      stepId: 'step-queue',
      label: 'XẾP HÀNG',
      labelEn: 'QUEUE',
      position: { x: -8, z: -6, y: 1.5 },
      floor: 0,
      aiGuideMessage: 'Bạn vui lòng ngồi chờ tại khu vực Xếp hàng. Màn hình sẽ gọi số vé của bạn khi đến lượt.',
      department: 'TIEPDON',
      estimatedWait: 10,
    },
    {
      stepId: 'step-consultation',
      label: 'KHÁM BỆNH',
      labelEn: 'CONSULTATION',
      position: { x: -6, z: 2, y: 1.5 },
      floor: 1, // First clinical floor
      aiGuideMessage: 'Đến lượt bạn rồi. Hãy vào phòng Khám bệnh theo biển chỉ dẫn màu xanh ngọc.',
      department: 'NOI_F1',
      estimatedWait: 15,
    },
    {
      stepId: 'step-lab',
      label: 'XÉT NGHIỆM',
      labelEn: 'LAB',
      position: { x: 8, z: 2, y: 1.5 },
      floor: 0, // Lab on ground floor
      aiGuideMessage: 'Bác sĩ chỉ định xét nghiệm. Hãy xuống tầng 1, phòng Xét nghiệm theo biển màu xanh đậm.',
      department: 'XETNGHIEM',
      estimatedWait: 20,
    },
    {
      stepId: 'step-reconsult',
      label: 'KHÁM LẠI',
      labelEn: 'RE-CONSULT',
      position: { x: -6, z: 8, y: 4.5 },
      floor: 1,
      aiGuideMessage: 'Kết quả xét nghiệm đã sẵn sàng. Quay lại phòng Khám bệnh để bác sĩ xem kết quả.',
      department: 'NOI_F1',
      estimatedWait: 10,
    },
    {
      stepId: 'step-conclusion',
      label: 'KẾT LUẬN',
      labelEn: 'CONCLUSION',
      position: { x: -6, z: 14, y: 4.5 },
      floor: 1,
      aiGuideMessage: 'Bác sĩ đã kết luận. Nếu cần nhập viện, hãy theo hướng dẫn đến khoa liên quan. Nếu không, đi thanh toán.',
      department: 'NOI_F1',
      estimatedWait: 5,
    },
    {
      stepId: 'step-admission',
      label: 'NHẬP VIỆN',
      labelEn: 'ADMISSION',
      position: { x: 6, z: 14, y: 7.5 },
      floor: 2, // Admission on floor 2
      aiGuideMessage: 'Bác sĩ quyết định nhập viện. Hãy đến khoa Nội trú tầng 3, y tá sẽ hướng dẫn thủ tục.',
      department: 'NHIKHOA_F2',
      estimatedWait: 30,
    },
    {
      stepId: 'step-payment',
      label: 'THANH TOÁN',
      labelEn: 'PAYMENT',
      position: { x: -8, z: 16, y: 1.5 },
      floor: 0, // Payment on ground floor
      aiGuideMessage: 'Hoàn tất khám. Hãy về quầy Thanh toán tầng 1. Chấp nhận tiền mặt, thẻ, chuyển khoản, ví điện tử.',
      department: 'THANHTOAN',
      estimatedWait: 5,
    },
  ];
  return steps;
}

/**
 * Step location with 3D coordinates and AI guide message
 */
export interface StepLocation {
  stepId: string;
  label: string;
  labelEn: string;
  position: { x: number; y: number; z: number };
  floor: number;
  aiGuideMessage: string;
  department: string;
  estimatedWait: number;
}

/**
 * Generate KHOA array from world spec (departments → rooms → furniture kinds)
 */
export function generateKhoaFromSpec(): KhoaSpec[] {
  const khoa: KhoaSpec[] = [];

  // Ground floor departments
  const groundFloorDepts = HOSPITAL_WORLD_SPEC.regions.find(r => r.floorIndex === 0)?.departments || [];
  for (const dept of groundFloorDepts) {
    khoa.push({
      code: dept.code,
      name: dept.name,
      shortCode: dept.shortCode,
      floor: dept.floor,
      worldOrigin: { x: dept.corridorSide * 8, z: dept.corridorPosition * 30 - 15, y: 1.5 },
      signageColor: dept.signageColor,
      specialty: dept.specialty,
      rooms: dept.rooms.map(r => ({
        id: r.id,
        label: r.label,
        type: r.type,
        furnitureKind: r.furnitureKind,
        worldPosition: calculateRoomWorldPosition(dept, r),
        doorPosition: r.doorPosition,
      })),
    });
  }

  // Upper floors (1-9)
  for (let floorIndex = 1; floorIndex < 10; floorIndex++) {
    const floorRegion = HOSPITAL_WORLD_SPEC.regions.find(r => r.floorIndex === floorIndex);
    if (!floorRegion) continue;

    for (const dept of floorRegion.departments) {
      khoa.push({
        code: dept.code,
        name: dept.name,
        shortCode: dept.shortCode,
        floor: dept.floor,
        worldOrigin: { x: dept.corridorSide * 8, z: dept.corridorPosition * 30 - 15, y: 1.5 + floorIndex * 3.0 },
        signageColor: dept.signageColor,
        specialty: dept.specialty,
        rooms: dept.rooms.map(r => ({
          id: r.id,
          label: r.label,
          type: r.type,
          furnitureKind: r.furnitureKind,
          worldPosition: calculateRoomWorldPosition(dept, r, floorIndex),
          doorPosition: r.doorPosition,
        })),
      });
    }
  }

  return khoa;
}

function calculateRoomWorldPosition(dept: DepartmentSpec, room: RoomSpec, floorIndex: number = 0): { x: number; y: number; z: number } {
  const corridorX = dept.corridorSide * 8;
  const corridorZ = dept.corridorPosition * 30 - 15;
  const roomOffsetX = dept.corridorSide * (room.width / 2 + 1.5); // 1.5m from corridor
  const roomOffsetZ = (dept.rooms.indexOf(room) - 1) * 5; // Stagger along corridor

  return {
    x: corridorX + roomOffsetX,
    y: 1.5 + floorIndex * 3.0,
    z: corridorZ + roomOffsetZ,
  };
}

export interface KhoaSpec {
  code: string;
  name: string;
  shortCode: string;
  floor: number;
  worldOrigin: { x: number; y: number; z: number };
  signageColor: string;
  specialty: string;
  rooms: RoomInstanceSpec[];
}

export interface RoomInstanceSpec {
  id: string;
  label: string;
  type: RoomType;
  furnitureKind: FurnitureKind;
  worldPosition: { x: number; y: number; z: number };
  doorPosition: number;
}

/**
 * Generate SIGN_HOSTS from world spec (transform anchors for signage planes)
 */
export function generateSignHostsFromSpec(): SignHost[] {
  const hosts: SignHost[] = [];

  // Step chips (pipeline steps)
  const steps = generateStepsFromSpec();
  for (const step of steps) {
    hosts.push({
      id: `step-chip-${step.stepId}`,
      type: 'step-chip',
      position: { x: step.position.x, y: step.position.y + 2.2, z: step.position.z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 2, y: 0.5, z: 0.1 },
      content: step.label,
      color: getStepColor(step.stepId),
    });
  }

  // Department hanging signs
  const khoa = generateKhoaFromSpec();
  for (const dept of khoa) {
    hosts.push({
      id: `dept-hanging-${dept.code}`,
      type: 'dept-hanging',
      position: { x: dept.worldOrigin.x, y: dept.worldOrigin.y + 2.5, z: dept.worldOrigin.z },
      rotation: { x: -Math.PI / 6, y: 0, z: 0 }, // Tilt down for readability
      scale: { x: 3, y: 1.5, z: 0.1 },
      content: `${dept.name} (${dept.shortCode})`,
      color: dept.signageColor,
    });

    // Room wall signs
    for (const room of dept.rooms) {
      const roomDepth = room.depth ?? 4; // Default 4m if not specified
      hosts.push({
        id: `room-wall-${room.id}`,
        type: 'room-wall',
        position: {
          x: room.worldPosition.x + room.doorPosition * 1.5,
          y: room.worldPosition.y + 1.0,
          z: room.worldPosition.z + (room.doorPosition < 0 ? -roomDepth / 2 : roomDepth / 2),
        },
        rotation: { x: 0, y: room.doorPosition < 0 ? Math.PI / 2 : -Math.PI / 2, z: 0 },
        scale: { x: 1.5, y: 0.4, z: 0.05 },
        content: `${room.label}`,
        color: '#0F766E',
      });
    }
  }

  // Direction arrows (elevator, stairs)
  for (let floor = 0; floor < 10; floor++) {
    hosts.push(
      {
        id: `dir-elevator-${floor}`,
        type: 'direction-arrow',
        position: { x: 10, y: 2.0 + floor * 3.0, z: -3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 0.1 },
        content: 'THANG MÁY ↑',
        color: '#134E4A',
      },
      {
        id: `dir-stairs-${floor}`,
        type: 'direction-arrow',
        position: { x: -10, y: 2.0 + floor * 3.0, z: -3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 0.1 },
        content: 'THANG BỘ ↑',
        color: '#134E4A',
      }
    );
  }

  return hosts;
}

function getStepColor(stepId: string): string {
  const colors: Record<string, string> = {
    'step-ticket': '#0F766E',
    'step-queue': '#134E4A',
    'step-consultation': '#0F766E',
    'step-lab': '#134E4A',
    'step-reconsult': '#BFDBFE',
    'step-conclusion': '#ECFDF5',
    'step-admission': '#99F6E4',
    'step-payment': '#BFDBFE',
  };
  return colors[stepId] || '#0F766E';
}

export interface SignHost {
  id: string;
  type: 'step-chip' | 'dept-hanging' | 'room-wall' | 'direction-arrow';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  content: string;
  color: string;
}

/**
 * Export all generated data structures for use by 3D scene and AI Guide
 */
export const STEPS = generateStepsFromSpec();
export const KHOA = generateKhoaFromSpec();
export const SIGN_HOSTS = generateSignHostsFromSpec();

// Lookup maps for fast access
export const STEP_LOCATION_BY_ID = new Map(STEPS.map(s => [s.stepId, s]));
export const KHOA_BY_CODE = new Map(KHOA.map(k => [k.code, k]));
export const SIGN_HOSTS_BY_ID = new Map(SIGN_HOSTS.map(s => [s.id, s]));

/**
 * Get department by code and floor (for AI guide triage)
 */
export function getDepartment(code: string, floor: number): KhoaSpec | undefined {
  return KHOA.find(k => k.code === code && k.floor === floor);
}

/**
 * Triage department from symptoms (simplified keyword matching)
 */
export function triageDepartment(symptoms: string): KhoaSpec | undefined {
  const lower = symptoms.toLowerCase();

  const keywordMap: Record<string, string[]> = {
    'NOI': ['đau bụng', 'đau ngực', 'khó thở', 'ho', 'sốt', 'tiêu chảy', 'buồn nôn', 'mệt', 'chóng mặt', 'huyết áp', 'tim', 'phổi', 'dạ dày', 'gan', 'thận'],
    'NGOAI': ['vết thương', 'gãy xương', 'bong gân', 'chấn thương', 'phẫu thuật', 'ụng thư', 'u', 'khoại', 'sưng', 'chảy máu'],
    'CDHA': ['chụp', 'x-quang', 'ct', 'mri', 'siêu âm', 'đoán hình ảnh', 'scan'],
    'MAT': ['mắt', 'nhìn kém', 'đau mắt', 'mờ mắt', 'đục thủy tinh thể', 'glaucoma', 'cận thị', 'viễn thị'],
    'TMH': ['tai', 'mũi', 'họng', 'đau họng', 'khó nuốt', 'nghẹt mũi', 'viêm xoang', 'điếc', 'nghe kém'],
    'RHM': ['răng', 'đau răng', 'sâu răng', 'nhổ răng', 'trám', 'niềng', 'chân răng', 'nha khoa'],
    'NHIKHOA': ['con', 'bé', 'trẻ', 'tiêm chủng', 'sốt trẻ', 'ho trẻ', 'phát triển', 'khám sơ sinh'],
    'SANKHOA': ['thai', 'mang thai', 'sản', 'đẻ', 'khám thai', 'siêu âm thai', 'kéo thai'],
  };

  for (const [deptCode, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(k => lower.includes(k))) {
      // Return first matching department (ground floor preferred for demo)
      return KHOA.find(k => k.code.startsWith(deptCode));
    }
  }

  // Default to Internal Medicine
  return KHOA.find(k => k.code.startsWith('NOI'));
}