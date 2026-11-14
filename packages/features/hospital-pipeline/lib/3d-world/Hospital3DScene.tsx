/**
 * Hospital 3D Scene — React Three Fiber Component
 *
 * Renders the procedural 10-floor hospital with:
 * - Camera following patient avatar through pipeline steps
 * - Smooth floor transitions via elevator/stairs
 * - Real-time step updates from AI Guide WebSocket
 * - Performance optimized for Intel Iris Xe (<300 draw calls)
 */

'use client';

// Force React to load first to ensure ReactCurrentOwner is available
// for @react-three/fiber's createRenderer which runs at module evaluation time
import * as React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, Html } from '@react-three/drei';
import {
  STEP_LOCATIONS,
  STEP_LOCATION_BY_ID,
  type StepLocation,
} from '../step-graph/step-locations';
import {
  createHospitalWorld,
} from './hospital-world-generator';
import {
  SLICE_DEFAULT_FLOORS,
  SLICE_LAYOUT,
  buildKhoaFloorSlice,
} from './khoa-slice';
import { getUpperFloorPlan, UPPER_FLOOR_INDEXES } from '../data/khoa-upper-floors';
import { buildKhoaFloorSliceGroup } from './khoa-slice-builder';
import { buildSliceSignsGroup } from './HospitalKhoaSliceScene';
import { createPerfProbe, formatReadout, usePerfReadout } from './perf-probe';

// ============================================================================
// Types
// ============================================================================

export interface PatientState {
  sessionId: string;
  currentStepId: string;
  targetStepId: string | null;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  floor: number;
  targetFloor: number;
  isMoving: boolean;
  progress: number; // 0-1 for current movement
}

// Extend useFrame type for proper typing
declare module '@react-three/fiber' {
  type UseFrameCallback = (state: { clock: THREE.Clock; camera: THREE.Camera; gl: THREE.WebGLRenderer }, delta: number) => void
}

export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  mode: 'follow' | 'orbit' | 'dollhouse';
  floor: number;
}

export interface Hospital3DSceneProps {
  /** Initial patient session ID */
  sessionId?: string;
  /** Initial step ID */
  initialStepId?: string;
  /** WebSocket URL for AI Guide Service */
  wsUrl?: string;
  /** Enable orbit controls for demo */
  enableOrbit?: boolean;
  /** Show debug info */
  debug?: boolean;
  /** Render the KHOA dollhouse slices on floors 2-3 (default on) */
  showUpperFloors?: boolean;
  /** Container className */
  className?: string;
  /** Callback when step changes */
  onStepChange?: (step: StepLocation) => void;
  /** Callback when floor changes */
  onFloorChange?: (floor: number) => void;
}

// ============================================================================
// Patient Avatar Component — L1 Procedural Rig (T-14)
// ============================================================================

import { createCharacterRig } from './character-rig-three';
import {
  computeWalkPose,
  computeIdlePose,
  resetCharacterRig,
} from './character-poses';
import { composeDemoTimeline, type DemoTimeline } from '../demo/demo-timeline';

interface PatientAvatarProps {
  position: THREE.Vector3;
  floor: number;
  isMoving: boolean;
  /** Demo elapsed seconds to drive walk/idle via camera choreography phases */
  elapsedDemoSeconds?: number;
}

// Build demo timeline once for phase lookup
const demoTimeline: DemoTimeline = composeDemoTimeline();

const PatientAvatar: React.FC<PatientAvatarProps> = ({
  position,
  isMoving,
  elapsedDemoSeconds = 0,
}) => {
  const rigRef = useRef<THREE.Group | null>(null);
  const { camera } = useThree();

  // Initialize rig on mount
  useEffect(() => {
    const rig = createCharacterRig();
    rigRef.current = rig;
    return () => {
      if (rigRef.current) {
        resetCharacterRig(rigRef.current);
        rigRef.current = null;
      }
    };
  }, []);

  // Animation driven by demo timeline phase
  useFrame(({ clock }) => {
    if (!rigRef.current) return;

    const rig = rigRef.current;
    const time = clock.getElapsedTime();

    // Sync rig position with patient position
    rig.position.set(position.x, position.y, position.z);

    // Determine phase from camera choreography
    const demoState = demoTimeline.stateAt(elapsedDemoSeconds);
    const phase = demoState.cameraSegment?.phase ?? 'action';
    const isApproach = phase === 'approach';

    // Walk pose during approach segments, idle otherwise
    if (isApproach && isMoving) {
      // Use demo time as walk phase (cycles every ~1s)
      const walkPhase = (elapsedDemoSeconds * 1.2) % 1; // stride ~1.2 steps/sec
      computeWalkPose(rig, walkPhase, { stride: 0.9, armSwing: 1.3 });
    } else {
      // Idle pose with subtle breathing/sway
      computeIdlePose(rig, time);
    }

    // Face camera slightly (yaw only)
    const direction = new THREE.Vector3()
      .subVectors(camera.position, rig.position)
      .normalize();
    const targetYaw = Math.atan2(direction.x, direction.z);
    rig.rotation.y = THREE.MathUtils.lerp(rig.rotation.y, targetYaw, 0.08);
  });

  // Render the procedural rig as a group with meshes attached to each bone
  if (!rigRef.current) return null;

  return (
    <group ref={rigRef} position={position}>
      {/* Pelvis (root) - capsule body */}
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.3, 1.0, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Head attached to spine/head node position */}
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color={0xF8FAFC} roughness={0.8} metalness={0} />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={0x134E4A} roughness={0.9} metalness={0} />
      </mesh>

      {/* Left thigh */}
      <mesh position={[-0.08, -0.1, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.12, 0.35, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Left shin */}
      <mesh position={[-0.08, -0.5, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.1, 0.35, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Left foot */}
      <mesh position={[-0.08, -0.85, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.08, 0.3]} />
        <meshStandardMaterial color={0x134E4A} roughness={0.8} metalness={0} />
      </mesh>

      {/* Right thigh */}
      <mesh position={[0.08, -0.1, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.12, 0.35, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Right shin */}
      <mesh position={[0.08, -0.5, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.1, 0.35, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Right foot */}
      <mesh position={[0.08, -0.85, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.08, 0.3]} />
        <meshStandardMaterial color={0x134E4A} roughness={0.8} metalness={0} />
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.18, 1.25, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.08, 0.45, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.18, 1.25, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.08, 0.45, 4, 8]} />
        <meshStandardMaterial color={0xBFDBFE} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Patient label */}
      <Html position={[0, 1.9, 0]} center>
        <div style={{
          background: 'rgba(15, 118, 110, 0.9)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          fontFamily: '"Bricolage Grotesque", sans-serif',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          Bệnh nhân
        </div>
      </Html>
    </group>
  );
};

// ============================================================================
// Floor Indicator Component
// ============================================================================

interface FloorIndicatorProps {
  currentFloor: number;
  targetFloor: number | null;
  isTransitioning: boolean;
}

const FloorIndicator: React.FC<FloorIndicatorProps> = ({ currentFloor, targetFloor, isTransitioning }) => {
  return (
    <Html
      position={[-22, 2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      transform={true}
      sprite
    >
      <div style={{
        background: 'rgba(15, 118, 110, 0.95)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '12px',
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontSize: '16px',
        fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        border: '2px solid rgba(153, 246, 228, 0.3)',
        minWidth: '140px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>🏥</span>
          <div style={{ textAlign: 'left' }}>
            <div>Tầng {currentFloor + 1}</div>
            {isTransitioning && targetFloor !== null && (
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                {targetFloor > currentFloor
                  ? `→ Đang lên tầng ${targetFloor + 1}`
                  : `→ Đang xuống tầng ${targetFloor + 1}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </Html>
  );
};

// ============================================================================
// Step Progress Indicator
// ============================================================================

interface StepProgressProps {
  currentStep: StepLocation;
  allSteps: readonly StepLocation[];
}

const StepProgress: React.FC<StepProgressProps> = ({ currentStep, allSteps }) => {
  const currentIndex = allSteps.findIndex(s => s.stepId === currentStep.stepId);

  return (
    <Html
      position={[0, 2.5, -20]}
      rotation={[-Math.PI / 2, 0, 0]}
      transform={true}
      sprite
    >
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        padding: '12px 16px',
        borderRadius: '12px',
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontSize: '13px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '1px solid rgba(15, 118, 110, 0.2)',
        minWidth: '280px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#0F766E',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px',
          }}>
            {currentIndex + 1}
          </div>
          <div style={{ fontWeight: 600, color: '#0F766E' }}>
            {currentStep.label} ({currentStep.labelEn})
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
          {allSteps.map((step, i) => (
            <div
              key={step.stepId}
              style={{
                flex: '0 0 auto',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                background: i <= currentIndex ? '#ECFDF5' : '#F1F5F9',
                color: i <= currentIndex ? '#0F766E' : '#94A3B8',
                border: i === currentIndex ? '2px solid #0F766E' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {step.label}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E0EDE8', fontSize: '12px', color: '#134E4A' }}>
          <strong>Ước lượng chờ: </strong>{currentStep.estimatedWait} phút
        </div>
      </div>
    </Html>
  );
};

// ============================================================================
// Camera Controller Component
// ============================================================================

interface CameraControllerProps {
  patientPosition: THREE.Vector3;
  patientFloor: number;
  targetPosition: THREE.Vector3;
  targetFloor: number;
  isMoving: boolean;
  progress: number;
  mode: 'follow' | 'orbit' | 'dollhouse';
  enableOrbit: boolean;
}

const CameraController: React.FC<CameraControllerProps> = ({
  patientPosition,
  patientFloor,
  targetPosition,
  targetFloor,
  isMoving,
  progress,
  mode,
  enableOrbit,
}) => {
  const { camera } = useThree();
  const cameraRef = useRef(camera);
  const targetRef = useRef(new THREE.Vector3());
  const lerpFactor = 0.08;

  useFrame(({ clock: _clock }) => {
    // Expose camera state for E2E tests / debug tooling
    const globalWindow = window as unknown as {
      __THREE_CAMERA_POSITION__?: { x: number; y: number; z: number };
      __ORBIT_CONTROLS_ENABLED__?: boolean;
    };
    globalWindow.__THREE_CAMERA_POSITION__ = {
      x: cameraRef.current.position.x,
      y: cameraRef.current.position.y,
      z: cameraRef.current.position.z,
    };
    globalWindow.__ORBIT_CONTROLS_ENABLED__ = mode === 'orbit';

    if (mode === 'orbit' && enableOrbit) return; // Let OrbitControls handle it

    // Calculate target position based on mode
    let desiredPosition: THREE.Vector3;
    let desiredTarget: THREE.Vector3;

    if (mode === 'dollhouse') {
      // Dollhouse view - overview of all floors
      desiredPosition = new THREE.Vector3(0, 35, 40);
      desiredTarget = new THREE.Vector3(0, 15, 0);
    } else {
      // Follow mode - camera follows patient
      const patientY = patientPosition.y;
      const offset = new THREE.Vector3(8, 6, 8); // Behind and above

      if (isMoving && targetFloor !== patientFloor) {
        // Transitioning floors - interpolate
        const currentPos = new THREE.Vector3().lerpVectors(patientPosition, targetPosition, progress);
        const currentFloorY = THREE.MathUtils.lerp(patientFloor * 3 + 1.5, targetFloor * 3 + 1.5, progress);
        desiredPosition = currentPos.clone().add(offset);
        desiredPosition.y = currentFloorY + offset.y;
        desiredTarget = currentPos.clone();
        desiredTarget.y = currentFloorY;
      } else {
        desiredPosition = patientPosition.clone().add(offset);
        desiredPosition.y = patientY + offset.y;
        desiredTarget = patientPosition.clone();
        desiredTarget.y = patientY;
      }
    }

    // Smooth camera movement
    cameraRef.current.position.lerp(desiredPosition, lerpFactor);
    targetRef.current.lerp(desiredTarget, lerpFactor);
    cameraRef.current.lookAt(targetRef.current);
  });

  return null; // This component doesn't render anything
};

// ============================================================================
// Hospital Scene Component (renders inside Canvas)
// ============================================================================

interface HospitalSceneProps {
  patientState: PatientState;
  cameraState: CameraState;
  onFloorChange: (floor: number) => void;
  hospitalScene: THREE.Group | null;
  floorGroups: THREE.Group[];
}

const HospitalScene: React.FC<HospitalSceneProps> = ({
  patientState,
  cameraState,
  onFloorChange,
  hospitalScene,
  floorGroups,
}) => {
  // Toggle floor visibility based on camera mode
  useFrame(() => {
    if (cameraState.mode === 'dollhouse') {
      // Show all floors in dollhouse mode
      floorGroups.forEach((floorGroup) => {
        floorGroup.visible = true;
        floorGroup.traverse(child => {
          if (child instanceof THREE.Mesh) child.visible = true;
        });
      });
    } else {
      // Show only current floor ±1 for context
      floorGroups.forEach((floorGroup, floorIndex) => {
        const shouldShow = Math.abs(floorIndex - patientState.floor) <= 1;
        floorGroup.visible = shouldShow;
        floorGroup.traverse(child => {
          if (child instanceof THREE.Mesh) child.visible = shouldShow;
        });
      });
    }

    // Notify floor change
    if (patientState.floor !== cameraState.floor) {
      onFloorChange(patientState.floor);
    }

    // E2E seam (research/20): exact floor counts without pixel probes
    (window as unknown as Record<string, unknown>).__HOSPITAL_DOLLHOUSE__ = {
      mode: cameraState.mode,
      floorCount: floorGroups.length,
      visibleCount: floorGroups.filter((g) => g.visible).length,
    };
  });

// Render the hospital scene
  if (!hospitalScene) return null;

  // Use stable scene ID for primitive keys — ensures same key across StrictMode double-render
  const sceneKey = hospitalSceneRef.current?.uuid ?? hospitalScene.uuid;

  return (
    <group>
      <group dispose={null}>
        {hospitalScene.children.map((child, i) => (
          <primitive key={`${sceneKey}-${i}`} object={child} dispose={null} />
        ))}
      </group>
    </group>
  );
};

// ============================================================================
// Lighting Setup
// ============================================================================

const HospitalLighting: React.FC = () => {
  return (
    <>
      {/* Ambient */}
      <ambientLight color="#F8FAFC" intensity={0.6} />

      {/* Main directional light (sun) */}
      <directionalLight
        color="#FFFFFF"
        intensity={1.2}
        position={[10, 20, 10]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      />

      {/* Hemisphere light for fill */}
      <primitive
        object={new THREE.HemisphereLight(0xEEF5F2, 0xCDEBE3, 0.8)}
        dispose={null}
      />

      {/* Accent lights for key areas */}
      <directionalLight
        color="#99F6E4"
        intensity={0.3}
        position={[-10, 15, -10]}
        castShadow={false}
      />
    </>
  );
};

// ============================================================================
// Fog for depth perception
// ============================================================================

const HospitalFog: React.FC = () => {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog(0xEEF5F2, 15, 50);
    scene.background = new THREE.Color(0xEEF5F2);
  }, []);

  return null;
};

// ============================================================================
// Perf Probe Host — feeds window.__HOSPITAL_PERF__ (fps / calls / tris)
// ============================================================================

const PerfProbeHost: React.FC = () => {
  const probe = useMemo(() => createPerfProbe(), []);
  useEffect(() => () => probe.detach(), [probe]);

  useFrame(({ gl }) => {
    probe.sample(performance.now(), gl.info);
  });

  return null;
};

// ============================================================================
// Main Hospital3DScene Component
// ============================================================================

export const Hospital3DScene: React.FC<Hospital3DSceneProps> = ({
  sessionId = 'demo-session',
  initialStepId = 'step-ticket',
  wsUrl = 'ws://localhost:3002',
  enableOrbit = true,
  debug = false,
  showUpperFloors = true,
  className = '',
  onStepChange,
  onFloorChange,
}) => {
  // Perf readout for the debug panel (polled, never blocks the render loop)
  const perfReadout = usePerfReadout();

  // Patient state
  const [patientState, setPatientState] = useState<PatientState>({
    sessionId,
    currentStepId: initialStepId,
    targetStepId: null,
    position: new THREE.Vector3(-8, 1.5, -12),
    targetPosition: new THREE.Vector3(-8, 1.5, -12),
    floor: 0,
    targetFloor: 0,
    isMoving: false,
    progress: 0,
  });

  // Camera state
  const [cameraState, setCameraState] = useState<CameraState>({
    position: new THREE.Vector3(0, 8, 25),
    target: new THREE.Vector3(-8, 1.5, -12),
    mode: 'follow',
    floor: 0,
  });

  // Connection state
  const [connected, setConnected] = useState(false);
  const [_ws, setWs] = useState<WebSocket | null>(null);

  // Refs for animation control and mounted state
  const animationRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const patientStateRef = useRef(patientState);
  // Demo elapsed time (wall-clock since mount) for camera choreography sync
  const demoTimeRef = useRef(0);
  const [demoElapsedSeconds, setDemoElapsedSeconds] = useState(0);

  // Reset mounted ref on mount (handles StrictMode double-mount)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep patientStateRef in sync
  useEffect(() => {
    patientStateRef.current = patientState;
  }, [patientState]);

  // Demo elapsed time: advance wall-clock seconds for camera choreography phase sync
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = () => {
      demoTimeRef.current = (performance.now() - start) / 1000;
      setDemoElapsedSeconds(demoTimeRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Hospital world state (scene + floor groups)
  const [hospitalScene, setHospitalScene] = useState<THREE.Group | null>(null);
  const [floorGroups, setFloorGroups] = useState<THREE.Group[]>([]);

  // Initialize hospital world — memoized to ensure stable UUID across StrictMode double-render
  const hospitalSceneRef = useRef<THREE.Group | null>(null);
  const floorGroupsRef = useRef<THREE.Group[]>([]);

  useEffect(() => {
    if (!hospitalSceneRef.current) {
      const { scene, generator } = createHospitalWorld();
      hospitalSceneRef.current = scene;
      floorGroupsRef.current = generator.getFloorGroups();
      setHospitalScene(scene);
      setFloorGroups(generator.getFloorGroups());
    }
  }, []);

  // KHOA dollhouse slices (floors 2-10, T-09 + T-12): solids + CanvasTexture signs per
  // floor. Slice positions are absolute (y = floorIndex * 3), while the
  // generator floorGroups already carry position.y = floorIndex * 3, so each
  // mount group compensates with a negative offset before landing in
  // floorGroups[floorIndex] to inherit the per-floor visibility logic.
  // Floors 1-2 (display 2-3): default departments; Floors 3-9 (display 4-10): override departments from khoa-upper-floors.
  const sliceMounts = useMemo(() => {
    // Build all floor slices 1-9 (display floors 2-10)
    const defaultFloors = SLICE_DEFAULT_FLOORS; // [1, 2]
    const upperFloors = UPPER_FLOOR_INDEXES; // [3,4,5,6,7,8,9]
    const allFloorIndices: readonly number[] = [...defaultFloors, ...upperFloors];

    return allFloorIndices.map((floorIndex) => {
      // Use override departments for upper floors (3-9)
      const departments = upperFloors.includes(floorIndex as typeof upperFloors[number])
        ? getUpperFloorPlan(floorIndex)
        : undefined; // undefined -> uses default template in buildKhoaFloorSlice

      const slice = buildKhoaFloorSlice(floorIndex, { departments });
      const solids = buildKhoaFloorSliceGroup(slice);
      const signs = buildSliceSignsGroup([slice]);
      const group = new THREE.Group();
      group.name = `khoa-slice-mount-f${slice.floorIndex}`;
      group.position.y = -slice.floorIndex * SLICE_LAYOUT.floorHeight;
      group.add(solids, signs.group);
      return { floorIndex: slice.floorIndex, group, disposeSigns: signs.dispose };
    });
  }, []);

  useEffect(() => {
    if (!showUpperFloors) return;
    for (const mount of sliceMounts) {
      const host = floorGroups[mount.floorIndex];
      if (host && mount.group.parent !== host) {
        host.add(mount.group);
      }
    }
    // Textures are kept alive across re-mounts (StrictMode double-invoke);
    // the scene lives for the page lifetime like the generator meshes.
    return () => {
      for (const mount of sliceMounts) {
        mount.group.parent?.remove(mount.group);
      }
    };
  }, [showUpperFloors, floorGroups, sliceMounts]);

  // Test seam for Playwright: exact per-floor visibility without pixel heuristics
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__HOSPITAL_FLOOR_GROUPS__ = floorGroups;
    return () => {
      delete (window as unknown as Record<string, unknown>).__HOSPITAL_FLOOR_GROUPS__;
    };
  }, [floorGroups]);

  // Current step data
  const currentStep = useMemo(() => STEP_LOCATION_BY_ID.get(patientState.currentStepId), [patientState.currentStepId]);

  // Initialize WebSocket connection to AI Guide Service
  useEffect(() => {
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      if (!mountedRef.current) return;
      console.log('[Hospital3DScene] Connected to AI Guide Service');
      setConnected(true);

      // Initialize session
      websocket.send(JSON.stringify({
        type: 'init',
        sessionId,
        patientName: 'Bệnh nhân demo',
        stt: '001',
        initialStepId,
      }));
    };

    websocket.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (err) {
        console.error('[Hospital3DScene] WS message parse error:', err);
      }
    };

    websocket.onclose = () => {
      if (!mountedRef.current) return;
      console.log('[Hospital3DScene] Disconnected from AI Guide Service');
      setConnected(false);
    };

    websocket.onerror = (err) => {
      if (!mountedRef.current) return;
      console.error('[Hospital3DScene] WS error:', err);
    };

    return () => {
      // Cancel any pending animation frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      websocket.close();
    };
  }, [wsUrl, sessionId, initialStepId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'system':
        if (msg.metadata?.stepId) {
          advanceToStep(msg.metadata.stepId);
        }
        break;
      case 'assistant':
        // AI guide response - could trigger UI updates
        break;
      case 'health':
        break;
    }
  }, []);

  // Cancel any pending animation
  const cancelAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Advance patient to a new step
  const advanceToStep = useCallback((stepId: string) => {
    const step = STEP_LOCATION_BY_ID.get(stepId);
    if (!step) return;

    // Capture start position BEFORE state update
    const startPos = patientStateRef.current.position.clone();
    const startFloor = patientStateRef.current.floor;

    setPatientState(prev => ({
      ...prev,
      currentStepId: stepId,
      targetStepId: stepId,
      targetPosition: new THREE.Vector3(step.position.x, step.position.y, step.position.z),
      targetFloor: step.floor,
      isMoving: true,
      progress: 0,
    }));

    // Animate movement with explicit start position
    animateMovement(step, startPos, startFloor);
  }, []);

  // Animate patient movement to target
  const animateMovement = useCallback((targetStep: StepLocation, startPos: THREE.Vector3, startFloor: number) => {
    // Cancel any existing animation
    cancelAnimation();

    const duration = 3000; // 3 seconds
    const startTime = Date.now();
    const targetPos = new THREE.Vector3(targetStep.position.x, targetStep.position.y, targetStep.position.z);
    const targetFloor = targetStep.floor;

    const animate = () => {
      if (!mountedRef.current) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Eased progress
      const easedProgress = 1 - (1 - progress) ** 3;

      // Interpolate position
      const currentPos = startPos.clone().lerp(targetPos, easedProgress);

      // Interpolate floor height during vertical transition
      let currentFloor = startFloor;
      if (startFloor !== targetFloor) {
        currentFloor = Math.round(THREE.MathUtils.lerp(startFloor, targetFloor, easedProgress));
      }

      console.log('[Hospital3DScene] animate:', { progress: easedProgress, currentFloor, targetFloor, startFloor });

      // Update state directly - React 18 auto-batches, but we need to ensure it processes
      setPatientState(prev => {
        const newState = {
          ...prev,
          position: currentPos,
          floor: currentFloor,
          progress: easedProgress,
          isMoving: progress < 1,
        };
        console.log('[Hospital3DScene] setPatientState floor:', newState.floor);
        return newState;
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        if (!mountedRef.current) return;
        setPatientState(prev => ({
          ...prev,
          position: targetPos,
          floor: targetFloor,
          isMoving: false,
          progress: 1,
        }));
        onStepChange?.(targetStep);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [cancelAnimation, onStepChange]);

  // Keyboard controls for demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Chat HUD fields must not drive the patient/camera while typing
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const steps = Array.from(STEP_LOCATION_BY_ID.values());
      const currentIndex = steps.findIndex(s => s.stepId === patientStateRef.current.currentStepId);

      switch (e.key) {
        case 'ArrowRight':
        case 'n':
          if (currentIndex < steps.length - 1) {
            advanceToStep(steps[currentIndex + 1].stepId);
          }
          break;
        case 'ArrowLeft':
        case 'p':
          if (currentIndex > 0) {
            advanceToStep(steps[currentIndex - 1].stepId);
          }
          break;
        case 'd':
          setCameraState(prev => ({
            ...prev,
            mode: prev.mode === 'dollhouse' ? 'follow' : 'dollhouse',
          }));
          break;
        case 'o':
          setCameraState(prev => ({
            ...prev,
            mode: prev.mode === 'orbit' ? 'follow' : 'orbit',
          }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advanceToStep]);

  // Render debug info
  const debugInfo = debug && (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: '#99F6E4',
      padding: '12px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 100,
      minWidth: '200px',
    }}>
      <div><strong>Hospital 3D Debug</strong></div>
      <div>Connected: {connected ? '✅' : '❌'}</div>
      <div>Perf: {perfReadout ? formatReadout(perfReadout) : 'đang đo…'}</div>
      <div>Step: {patientState.currentStepId}</div>
      <div>Floor: {patientState.floor + 1}</div>
      <div>Position: ({patientState.position.x.toFixed(1)}, {patientState.position.y.toFixed(1)}, {patientState.position.z.toFixed(1)})</div>
      <div>Moving: {patientState.isMoving ? 'Yes' : 'No'}</div>
      <div>Camera: {cameraState.mode}</div>
      <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.7 }}>
        Controls: ←/→ or P/N to navigate steps<br />
        D: Toggle dollhouse view<br />
        O: Toggle orbit mode
      </div>
    </div>
  );

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 8, 25], fov: 55 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        shadows={true}
        style={{ touchAction: 'none' }}
      >
        <HospitalLighting />
        <HospitalFog />
        <PerfProbeHost />
        <HospitalScene
          patientState={patientState}
          cameraState={cameraState}
          onFloorChange={(floor) => {
            setCameraState(prev => ({ ...prev, floor }));
            onFloorChange?.(floor);
          }}
          hospitalScene={hospitalScene}
          floorGroups={floorGroups}
        />

        {/* Patient Avatar */}
        <PatientAvatar
          position={patientState.position}
          floor={patientState.floor}
          isMoving={patientState.isMoving}
          elapsedDemoSeconds={demoElapsedSeconds}
        />

        {/* Camera Controller */}
        <CameraController
          patientPosition={patientState.position}
          patientFloor={patientState.floor}
          targetPosition={patientState.targetPosition}
          targetFloor={patientState.targetFloor || patientState.floor}
          isMoving={patientState.isMoving}
          progress={patientState.progress}
          mode={cameraState.mode}
          enableOrbit={enableOrbit}
        />

        {/* Orbit Controls for demo */}
        {enableOrbit && cameraState.mode === 'orbit' && (
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={80}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        )}

        {/* Floor Indicator */}
        <FloorIndicator
          currentFloor={patientState.floor}
          targetFloor={patientState.targetFloor ?? null}
          isTransitioning={patientState.isMoving && patientState.targetFloor !== patientState.floor}
        />

        {/* Step Progress */}
        {currentStep && (
          <StepProgress
            currentStep={currentStep}
            allSteps={STEP_LOCATIONS}
          />
        )}
      </Canvas>

      {debugInfo}

      {/* Legend / Controls hint */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        background: 'rgba(255,255,255,0.95)',
        padding: '10px 16px',
        borderRadius: '8px',
        fontFamily: '"Bricolage Grotesque", sans-serif',
        fontSize: '12px',
        color: '#134E4A',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        border: '1px solid rgba(15, 118, 110, 0.15)',
        zIndex: 50,
      }}>
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>🏥 Bệnh viện 3D Demo</div>
        <div style={{ opacity: 0.7 }}>← → hoặc P/N: Chuyển bước | D: Tổng quan | O: Xoay camera</div>
        {currentStep && (
          <div style={{ marginTop: '4px', fontWeight: 500 }}>
            Bước: {currentStep.label} • Tầng {patientState.floor + 1} • Chờ ~{currentStep.estimatedWait} phút
          </div>
        )}
      </div>
    </div>
  );
};

export default Hospital3DScene;