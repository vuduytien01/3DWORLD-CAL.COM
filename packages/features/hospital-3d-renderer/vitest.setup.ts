import { vi } from "vitest";

// Mock Three.js for testing
vi.mock("three", () => {
  const actual = vi.importActual("three");
  return {
    ...actual,
    WebGLRenderer: vi.fn(() => ({
      info: {
        render: { calls: 0, triangles: 0, points: 0, lines: 0 },
        memory: { geometries: 0, textures: 0 },
        programs: [],
      },
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      setAnimationLoop: vi.fn(),
      render: vi.fn(),
      shadowMap: {
        enabled: false,
        type: 0,
        autoUpdate: true,
        needsUpdate: false,
      },
      getContext: vi.fn(() => ({
        getExtension: vi.fn(() => null),
      })),
      compileAsync: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    })),
    BoxGeometry: vi.fn(() => ({})),
    PlaneGeometry: vi.fn(() => ({})),
    MeshStandardMaterial: vi.fn(() => ({})),
    Mesh: vi.fn(() => ({})),
    Group: vi.fn(() => ({})),
    Vector3: vi.fn(() => ({})),
    Quaternion: vi.fn(() => ({})),
    Euler: vi.fn(() => ({})),
    Matrix4: vi.fn(() => ({})),
    BufferGeometry: vi.fn(() => ({})),
    BufferAttribute: vi.fn(() => ({})),
    InstancedMesh: vi.fn(() => ({})),
    DynamicDrawUsage: 35044,
    PCFShadowMap: 1,
  };
});

// Mock @react-three/fiber
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => children,
  useFrame: vi.fn(),
  useThree: () => ({
    camera: { position: { set: vi.fn() }, fov: 50 },
    gl: { setPixelRatio: vi.fn(), setSize: vi.fn() },
    size: { width: 800, height: 600 },
  }),
  extend: vi.fn(),
  useLoader: vi.fn(),
  useResource: vi.fn(),
}));

// Mock @react-three/drei
vi.mock("@react-three/drei", () => ({
  OrbitControls: ({ children }) => children,
  Html: ({ children }) => children,
  Preload: ({ children }) => children,
  Environment: ({ children }) => children,
  Center: vi.fn(({ children }) => children),
}));

// Mock hospital-pipeline
vi.mock("@calcom/features/hospital-pipeline", () => ({
  useHospitalWorld: vi.fn(() => ({
    slices: [],
    floorHeight: 3,
    layout: {},
  })),
  useFloorSlice: vi.fn(),
  useAllDepartments: vi.fn(),
  SLICE_LAYOUT: {
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
    stairRise: 0.25,
    stairDepth: 0.1833,
    stairWidth: 3.6,
    elevator: { faceX: 2.26, doorZ: 6.0, recessProtrusion: 0.76 },
  },
  SLICE_FURNITURE_PRESET_BY_KIND: {},
  MINT_ORDER_SLICE_PALETTE: {
    floor: "#EEF5F2",
    wall: "#CDEBE3",
    primary: "#0F766E",
    primaryDark: "#134E4A",
    accent: "#99F6E4",
    accentLight: "#ECFDF5",
    neutral: "#F8FAFC",
    patient: "#BFDBFE",
  },
}));