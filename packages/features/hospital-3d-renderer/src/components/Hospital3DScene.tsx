"use client";

import React, { Suspense, useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, Html } from "@react-three/drei";
import { useHospitalWorld } from "../hooks/useHospitalWorld";
import { useCameraController } from "../hooks/useCameraController";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";
import { LightingSetup } from "./LightingSetup";
import { FloorSlice } from "./FloorSlice";
import { DepartmentSlice } from "./DepartmentSlice";
import { Stairwell } from "./Stairwell";
import { Elevator } from "./Elevator";
import { Signage } from "./Signage";
import { PatientAvatar } from "./PatientAvatar";

interface Hospital3DSceneProps {
  /** Camera mode: 'demo' = choreographed, 'free' = orbit/follow */
  cameraMode?: "demo" | "free" | "follow";
  /** Current patient state from demo timeline */
  patientState?: {
    x: number;
    y: number;
    z: number;
    headingRad?: number;
    walking?: boolean;
    walkPhase?: number;
  } | null;
  /** When true, skips walk-cycle phase and snaps camera to target instantly (prefers-reduced-motion) */
  reducedMotion?: boolean;
  /** Callback when floor changes */
  onFloorChange?: (floor: number) => void;
  /** Enable debug performance overlay */
  debug?: boolean;
}

export function Hospital3DScene({
  cameraMode = "demo",
  patientState = null,
  reducedMotion = false,
  onFloorChange,
  debug = false,
}: Hospital3DSceneProps) {
  const { slices, floorHeight, layout } = useHospitalWorld();
  const cameraController = useCameraController({
    mode: cameraMode,
    patientState,
    reducedMotion,
    onFloorChange,
  });
  const { stats, enabled: perfEnabled } = usePerformanceMonitor({ enabled: debug });

  const [ready, setReady] = useState(false);

  // Preload assets
  useEffect(() => {
    // Trigger font/texture loading
    document.fonts.ready.then(() => setReady(true));
    const timeout = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(timeout);
  }, []);

  // Format performance stats for display
  const formatStats = (s: any) =>
    `${s.fps}fps · ${s.frameMs}ms · ${s.drawCalls}draw · ${s.triangles}tris`;

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#EEF5F2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            color: "#0F766E",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Đang tải bệnh viện 3D...
        </div>
      )}

      <Canvas
        camera={{ position: [0, 10, -15], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        shadows={true}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = 1; // PCFShadowMap
          gl.shadowMap.autoUpdate = false; // freeze for static scenery
        }}
        onPointerMissed={(e) => {
          cameraController.setTarget(null);
        }}
        style={{ position: "absolute", inset: 0, display: ready ? "block" : "none" }}
      >
        <Suspense fallback={null}>
          <LightingSetup />
          <FloorSlice slices={slices} floorHeight={floorHeight} />
          <DepartmentSlice slices={slices} />
          <Stairwell slices={slices} floorHeight={floorHeight} />
          <Elevator slices={slices} floorHeight={floorHeight} />
          <Signage slices={slices} />
          <PatientAvatar patientState={patientState} reducedMotion={reducedMotion} />
          <OrbitControls
            ref={cameraController.orbitRef}
            enablePan={cameraMode === "free"}
            enableZoom={cameraMode === "free"}
            enableRotate={cameraMode === "free"}
            enableDamping={true}
            dampingFactor={0.05}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2 - 0.1}
            minDistance={5}
            maxDistance={80}
            target={cameraController.target.current}
          />
        </Suspense>

        {perfEnabled && <Html as="div" style={{ position: "absolute", bottom: 10, right: 10, zIndex: 100 }}>{formatStats(stats)}</Html>}
      </Canvas>

      <Html
        as="div"
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "rgba(19, 78, 74, 0.9)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 16px rgba(19, 78, 74, 0.3)",
          }}
        >
          Tầng {cameraController.currentFloor + 1}
          {cameraController.currentFloor > 0 && <span>🛗</span>}
          {cameraController.currentFloor > 0 && <span>🚶</span>}
        </div>
      </Html>
    </div>
  );
}