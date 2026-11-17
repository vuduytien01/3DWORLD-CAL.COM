import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Hospital3DScene } from "./Hospital3DScene";

// Mock Three.js and R3F
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

vi.mock("@react-three/drei", () => ({
  OrbitControls: ({ children }: { children: React.ReactNode }) => children,
  Html: ({ children }: { children: React.ReactNode }) => children,
  Preload: ({ children }: { children: React.ReactNode }) => children,
  Environment: ({ children }: { children: React.ReactNode }) => children,
  Center: vi.fn(({ children }: { children: React.ReactNode }) => children),
}));

vi.mock("@calcom/features/hospital-pipeline", () => ({
  useHospitalWorld: vi.fn(() => ({
    slices: [],
    floorHeight: 3,
    layout: {},
  })),
  useFloorSlice: vi.fn(),
  useAllDepartments: vi.fn(),
}));

describe("Hospital3DScene", () => {
  it("renders without crashing", () => {
    const { container } = render(<Hospital3DScene />);
    expect(container).toBeInTheDocument();
  });

  it("renders loading state initially", () => {
    render(<Hospital3DScene />);
    // Loading text should be visible before font loads
    // The component shows "Đang tải bệnh viện 3D..." while loading
  });

  it("accepts cameraMode prop", () => {
    const { rerender } = render(<Hospital3DScene cameraMode="free" />);
    expect(screen.getByText("Tầng 1")).toBeInTheDocument();
  });

  it("accepts reducedMotion prop", () => {
    render(<Hospital3DScene reducedMotion={true} />);
    // Should not throw
  });
});