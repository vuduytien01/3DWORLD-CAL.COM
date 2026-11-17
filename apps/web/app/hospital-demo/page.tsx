/**
 * Hospital Demo Page (ADR 0003 — HTML5 renderer pivot)
 *
 * Renders the multi-floor hospital as an HTML5 isometric dollhouse with:
 * - Camera choreography sampled at the page's wall-clock demo timer
 * - Patient glyph + marker following the demo timeline (patient-walk layer)
 * - AI Guide chat HUD (input + template chips + message list) wired to
 *   lib/ai-guide/use-guide-ws (backoff reconnect + heartbeat, spec 04)
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  useGuideWs,
  chatEntryFromServer,
  pushChatEntry,
  type GuideChatEntry,
  type GuideWsStatus,
} from '@calcom/features/hospital-pipeline/lib/ai-guide/use-guide-ws';
import type { GuideServerMessage } from '@calcom/features/hospital-pipeline/lib/ai-guide/server';
import {
  DEMO_DURATION_S,
  type CameraPose,
} from '@calcom/features/hospital-pipeline/lib/demo/camera-choreography';
import { composeDemoTimeline } from '@calcom/features/hospital-pipeline/lib/demo/demo-timeline';
import {
  patientWalkAt,
  sampleRestackedPoseAt,
  type PatientWalkState,
} from '@calcom/features/hospital-pipeline/lib/html5-world/patient-walk';
import { useReducedMotion } from '@calcom/features/hospital-pipeline/lib/html5-world/use-reduced-motion';
import { STEP_LOCATION_BY_ID } from '@calcom/features/hospital-pipeline/lib/step-graph/step-locations';
import { buildDemoScript } from '@calcom/features/hospital-pipeline/lib/demo/demo-script';

// Client-only dynamic import: evaluated only in the browser after hydration
const Html5FloorRendererDynamic = dynamic(
  () =>
    import('@calcom/features/hospital-pipeline/lib/html5-world/html5-floor-renderer').then(
      (mod) => mod.Html5FloorRenderer
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#EEF5F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#0F766E',
          fontSize: '16px',
        }}
      >
        Đang tải bối cảnh demo...
      </div>
    ),
  }
);

// Demo timeline built once — pure data, no DOM, same module-level pattern the
// old WebGL scene used for its internal demo engine.
const demoTimeline = composeDemoTimeline();

// Quick Tour mode: 6 key beats in 30s (5s each) — highlights reel for fast engagement
const QUICK_TOUR_SEGMENTS: readonly { stepId: string; startS: number; endS: number }[] = [
  { stepId: 'step-ticket', startS: 0, endS: 5 },
  { stepId: 'step-queue', startS: 5, endS: 10 },
  { stepId: 'step-consultation', startS: 10, endS: 15 },
  { stepId: 'step-lab', startS: 15, endS: 20 },
  { stepId: 'step-conclusion', startS: 20, endS: 25 },
  { stepId: 'step-payment', startS: 25, endS: 30 },
];
const QUICK_TOUR_DURATION = 30;

/** One sampled demo frame handed to the HTML5 renderer as props. */
interface DemoFrame {
  cameraPose: CameraPose;
  patientState: PatientWalkState | null;
}

const ACCENT = '#134E4A';
const ROTATE_SPEED = 1.5; // radians per second for free camera rotation

/**
 * The three questions the guide's own fallback template suggests first
 * (templates.ts fallback copy): wait time, next direction, cost — all three
 * route to canned templates, never the LLM.
 */
const TEMPLATE_CHIPS: readonly { label: string }[] = [
  { label: 'Chờ bao lâu?' },
  { label: 'Đi đâu?' },
  { label: 'Chi phí bao nhu?' },
];

const STATUS_LABEL: Record<GuideWsStatus, string> = {
  online: 'Đã kết nối',
  connecting: 'Đang kết nối...',
  reconnecting: 'Đang kết nối lại',
  offline: 'Chưa kết nối',
};

const STATUS_DOT_COLOR: Record<GuideWsStatus, string> = {
  online: '#10B981',
  connecting: '#D97706',
  reconnecting: '#D97706',
  offline: '#DC2626',
};

export default function HospitalDemoPage() {
  // HUD chat state — pure helpers from use-guide-ws keep this list capped
  const [entries, setEntries] = useState<GuideChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const messageIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Camera mode: 'demo' = 180s choreography, 'free' = WASD free camera
  const [cameraMode, setCameraMode] = useState<'demo' | 'free'>('demo');
  // Free camera state (world meters)
  const freeCameraRef = useRef({ position: { x: 0, y: 10, z: -15 }, target: { x: 0, y: 0, z: 0 }, pitch: -0.5, yaw: 0 });

  // ?session= gives each E2E worker its own guide session — parallel init
  // frames on one shared sessionId overwrite each other's state server-side
  const demoSession =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('session')
      : null;
  const hudSessionId = demoSession ?? 'hospital-demo-chat';

  // E2E seam: ?t=<seconds> seeds the demo clock so a test can land directly in
  // a segment (floor hop at t=44) instead of waiting out the 180s wall clock.
  // No param → 0 → behavior unchanged. Clamped into [0, DEMO_DURATION_S].
  const demoStartOffsetS = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const raw = new URLSearchParams(window.location.search).get('t');
    const parsed = raw === null ? 0 : Number.parseFloat(raw);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), DEMO_DURATION_S) : 0;
  }, []);

  // Reduced motion: when prefers-reduced-motion: reduce, demo clock jumps to key beats
  const reducedMotion = useReducedMotion();

  // Keyboard controls for demo timeline (spec #13)
  const seekTargetRef = useRef<number | null>(null);
  const isPausedRef = useRef(false);
  const seekTransitionRef = useRef<{ from: number; to: number; startMs: number; durationMs: number } | null>(null);

  // Free camera controls (WASD + mouse-like keyboard)
  const keysPressedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keys when body is focused (not typing in chat input)
      if (document.activeElement !== document.body) return;

      // Toggle camera mode with 'F' key
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        setCameraMode(prev => prev === 'demo' ? 'free' : 'demo');
        // When switching to free mode, initialize free camera from current demo camera
        if (cameraMode === 'demo') {
          // freeCameraRef will be synced in the tick effect
        }
        return;
      }

      // Demo mode keyboard controls (spec #13)
      if (cameraMode === 'demo') {
        let newSeekTarget: number | null = null;
        let pauseToggle = false;

        switch (event.key) {
          case ' ':
            event.preventDefault();
            pauseToggle = true;
            break;
          case 'ArrowLeft':
            event.preventDefault();
            newSeekTarget = Math.max(0, (seekTargetRef.current ?? demoStartOffsetS + (performance.now() - performance.now()) / 1000) - 5);
            break;
          case 'ArrowRight':
            event.preventDefault();
            newSeekTarget = Math.min(DEMO_DURATION_S, (seekTargetRef.current ?? demoStartOffsetS + (performance.now() - performance.now()) / 1000) + 5);
            break;
          case 'Home':
            event.preventDefault();
            newSeekTarget = 0;
            break;
          case 'End':
            event.preventDefault();
            newSeekTarget = DEMO_DURATION_S;
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            event.preventDefault();
            // Jump to pipeline step N (1=ticket, 2=queue, 3=consultation, etc.)
            const stepIndex = parseInt(event.key, 10) - 1;
            const actionSegments = demoTimeline.segments.filter(s => s.phase === 'action');
            if (actionSegments[stepIndex]) {
              newSeekTarget = actionSegments[stepIndex].startS;
            }
            break;
          default:
            return;
        }

        if (pauseToggle) {
          isPausedRef.current = !isPausedRef.current;
          showToast(isPausedRef.current ? '⏸ Tạm dừng' : '▶ Tiếp tục');
          if (!isPausedRef.current) {
            // Resume: clear seek target so wall clock takes over
            seekTargetRef.current = null;
          }
        }

        if (newSeekTarget !== null) {
          isPausedRef.current = true;
          // Smooth seek: use a transition instead of instant jump
          // Compute current elapsed time from wall clock
          const currentWallClockS = demoStartOffsetS + (performance.now() - performance.now()) / 1000;
          seekTargetRef.current = newSeekTarget;
          seekTransitionRef.current = {
            from: demoTimeline.stateAt(currentWallClockS).elapsedDemoSeconds,
            to: newSeekTarget,
            startMs: performance.now(),
            durationMs: 400, // 400ms smooth transition
          };
        }
        return;
      }

      // Free mode: track WASD + Q/E for up/down
      const movementKeys = new Set(['w', 'a', 's', 'd', 'q', 'e', 'W', 'A', 'S', 'D', 'Q', 'E']);
      if (movementKeys.has(event.key)) {
        event.preventDefault();
        keysPressedRef.current.add(event.key.toLowerCase());
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const movementKeys = new Set(['w', 'a', 's', 'd', 'q', 'e', 'W', 'A', 'S', 'D', 'Q', 'E']);
      if (movementKeys.has(event.key)) {
        keysPressedRef.current.delete(event.key.toLowerCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [demoTimeline, demoStartOffsetS, cameraMode]);

  // Guide WebSocket must be declared before any callback that references it
  // (useCallback dependency arrays are evaluated at render time — TDZ otherwise)
  const handleGuideMessage = useCallback((msg: GuideServerMessage) => {
    const id = `guide-${(messageIdRef.current += 1)}`;
    const entry = chatEntryFromServer(msg, id);
    if (entry) setEntries((prev) => pushChatEntry(prev, entry));
  }, []);

  const guide = useGuideWs(undefined, handleGuideMessage);

  // Toggle between Quick Tour (30s) and Full Demo (180s)
  const toggleDemoMode = useCallback(() => {
    const newMode = demoModeRef.current === 'quick' ? 'full' : 'quick';
    demoModeRef.current = newMode;
    isPausedRef.current = false;
    seekTargetRef.current = null;
    // Note: startMs is captured in the tick effect closure, so mode switch resets on next tick
    // Re-send init to guide with new mode
    if (guide.status === 'online') {
      guide.send({ type: 'init', sessionId: hudSessionId, patientName: 'Bệnh nhân demo', stt: '014', initialStepId: 'step-ticket' });
    }
  }, [guide, guide.status, hudSessionId]);

  // Hide hint bar on first interaction
  const hideHint = useCallback(() => {
    hintVisibleRef.current = false;
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
  }, []);

  // Toast system for celebration feedback
  interface Toast { id: number; text: string; x?: number; y?: number; }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((text: string, x?: number, y?: number) => {
    if (reducedMotion) {
      const id = ++toastIdRef.current;
      setToasts(prev => [...prev, { id, text, x, y }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 1500);
      return;
    }
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-2), { id, text, x, y }]); // max 3 toasts
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000); // 300ms in + 1500ms + 300ms out
  }, [reducedMotion]);

  // 10-beat demo narration (lib/demo/demo-script.ts) pushed into the chat
  // HUD as guide bubbles: intro at mount, one bubble when the patient reaches
  // each pipeline step, outro right after the final step beat. Keyed by beat
  // index — intro and outro both carry stepId "".
  const demoScript = useMemo(() => buildDemoScript(), []);
  const narratedBeatsRef = useRef<Set<number>>(new Set());

  // Demo clock state: one sampled frame per tick, skipped when nothing moved
  // (hold segments and idle stations). Stored in a ref so the rAF tick can write
  // without scheduling a React render; the renderer reads latest.current.props.
  const demoFrameRef = useRef<DemoFrame>({
    cameraPose:
      sampleRestackedPoseAt(demoTimeline.segments, demoStartOffsetS) ??
      // Unreachable: the validated 180s choreography always covers t=0
      { position: { x: 0, y: 24, z: -6 }, target: { x: 0, y: 1.5, z: 6 } },
    patientState: patientWalkAt(demoTimeline.stateAt(demoStartOffsetS)),
  });

  // Quick Tour / Full Demo mode
  const demoModeRef = useRef<'quick' | 'full' | 'paused'>('quick');
  const hintVisibleRef = useRef(true);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const velocityRef = useRef<{ x: number; z: number; y: number } | null>(null);
  const DAMPING = 0.92; // per-frame velocity decay
  const STOP_THRESHOLD = 0.01; // velocity below this stops completely

  // Step progress indicator state
  const [stepProgress, setStepProgress] = useState<{ currentStep: number; segmentProgress: number }>({ currentStep: 0, segmentProgress: 0 });

  // Floor indicator state
  const lastFloorRef = useRef(-1);

  const pushNarration = useCallback((text: string) => {
    const id = `narration-${(messageIdRef.current += 1)}`;
    setEntries((prev) => pushChatEntry(prev, { id, role: 'guide', text, at: Date.now() }));
  }, []);

  const narrateStep = useCallback(
    (stepId: string) => {
      const beats = demoScript.beats;
      const beatIndex = beats.findIndex((b) => b.stepId !== '' && b.stepId === stepId);
      if (beatIndex < 0 || narratedBeatsRef.current.has(beatIndex)) return;
      narratedBeatsRef.current.add(beatIndex);
      pushNarration(beats[beatIndex].narration);

      const lastStepIndex = beats.reduce((last, b, i) => (b.stepId !== '' ? i : last), -1);
      if (beatIndex !== lastStepIndex) return;
      const outroIndex = beats.findIndex((b) => b.stepId === '' && b.cueS > 0);
      if (outroIndex >= 0 && !narratedBeatsRef.current.has(outroIndex)) {
        narratedBeatsRef.current.add(outroIndex);
        pushNarration(beats[outroIndex].narration);
      }
    },
    [demoScript, pushNarration]
  );

  // Demo clock: wall-clock seconds since mount drive the same 180s choreography
  // the old WebGL scene ran internally. Restacked poses (y += 3*floor baked in)
  // and patient walk states feed the HTML5 renderer through props; the
  // renderer's own rAF loop redraws between ticks. Narration fires on
  // action-phase entry per step — the beat timing demo-script.ts uses for cueS.
  // When reducedMotion is true, clock jumps to segment boundaries instead of
  // accumulating wall-clock time (spec #10).
  // Keyboard controls (spec #13): seekTargetRef and isPausedRef are set by keydown handler.
  // Free camera mode: WASD + Q/E move position, ArrowUp/Down adjust pitch, ArrowLeft/Right adjust yaw
  useEffect(() => {
    let rafId = 0;
    let lastSig = '';
    let lastActionStepId = '';
    const startMs = performance.now();
    let lastFreeUpdateMs = performance.now();
    const tick = () => {
      if (cameraMode === 'free') {
        // Free camera: velocity-based movement with damping for inertia feel
        const now = performance.now();
        const dt = (now - lastFreeUpdateMs) / 1000; // seconds
        lastFreeUpdateMs = now;

        const ACCELERATION = 40; // meters per second²

        const cam = freeCameraRef.current;
        const keys = keysPressedRef.current;

        // Initialize velocity ref if not exists
        if (!velocityRef.current) {
          velocityRef.current = { x: 0, z: 0, y: 0 };
        }
        const vel = velocityRef.current;

        // Forward/backward (W/S) - accelerate along yaw direction
        if (keys.has('w')) {
          vel.x += Math.sin(cam.yaw) * ACCELERATION * dt;
          vel.z += Math.cos(cam.yaw) * ACCELERATION * dt;
        }
        if (keys.has('s')) {
          vel.x -= Math.sin(cam.yaw) * ACCELERATION * dt;
          vel.z -= Math.cos(cam.yaw) * ACCELERATION * dt;
        }
        // Strafe left/right (A/D) - perpendicular to yaw
        if (keys.has('a')) {
          vel.x -= Math.cos(cam.yaw) * ACCELERATION * dt;
          vel.z += Math.sin(cam.yaw) * ACCELERATION * dt;
        }
        if (keys.has('d')) {
          vel.x += Math.cos(cam.yaw) * ACCELERATION * dt;
          vel.z -= Math.sin(cam.yaw) * ACCELERATION * dt;
        }
        // Up/down (Q/E)
        if (keys.has('q')) {
          vel.y += ACCELERATION * dt;
        }
        if (keys.has('e')) {
          vel.y -= ACCELERATION * dt;
        }

        // Damping: reduce velocity each frame (inertia feel)
        if (!reducedMotion) {
          vel.x *= DAMPING;
          vel.z *= DAMPING;
          vel.y *= DAMPING;
        } else {
          // Reduced motion: no inertia, instant stop
          vel.x = 0;
          vel.z = 0;
          vel.y = 0;
        }

        // Stop threshold: prevent infinite tiny drift
        if (Math.abs(vel.x) < STOP_THRESHOLD) vel.x = 0;
        if (Math.abs(vel.z) < STOP_THRESHOLD) vel.z = 0;
        if (Math.abs(vel.y) < STOP_THRESHOLD) vel.y = 0;

        // Apply velocity to position
        cam.position.x += vel.x * dt;
        cam.position.z += vel.z * dt;
        cam.position.y += vel.y * dt;

        // Arrow keys for pitch/yaw rotation
        if (keys.has('arrowup')) {
          cam.pitch = Math.min(cam.pitch + ROTATE_SPEED * dt, Math.PI / 2 - 0.1);
        }
        if (keys.has('arrowdown')) {
          cam.pitch = Math.max(cam.pitch - ROTATE_SPEED * dt, -Math.PI / 2 + 0.1);
        }
        if (keys.has('arrowleft')) {
          cam.yaw -= ROTATE_SPEED * dt;
        }
        if (keys.has('arrowright')) {
          cam.yaw += ROTATE_SPEED * dt;
        }

        // Compute target from pitch/yaw
        const distance = 5; // look-at distance
        cam.target.x = cam.position.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * distance;
        cam.target.y = cam.position.y + Math.sin(cam.pitch) * distance;
        cam.target.z = cam.position.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * distance;

const sig = `free|${cam.position.x.toFixed(2)},${cam.position.y.toFixed(2)},${cam.position.z.toFixed(2)}|${cam.target.x.toFixed(2)},${cam.target.y.toFixed(2)},${cam.target.z.toFixed(2)}`;
        if (sig !== lastSig) {
          lastSig = sig;
          demoFrameRef.current = {
            cameraPose: { position: cam.position, target: cam.target },
            patientState: patientWalkAt(demoTimeline.stateAt(0)), // keep patient at start or hide
          };
        }
      } else {
        // Demo mode: supports Quick Tour (30s) and Full Demo (180s)
        let elapsedS: number;
        const mode = demoModeRef.current;
        const wallClockS = demoStartOffsetS + (performance.now() - startMs) / 1000;

        if (mode === 'quick') {
          // Quick Tour: 30s highlights, 6× speed through key segments, no holds
          const quickProgress = Math.min(wallClockS / QUICK_TOUR_DURATION, 1);
          if (quickProgress >= 1) {
            // Quick Tour complete: pause at end
            demoModeRef.current = 'paused';
            isPausedRef.current = true;
            elapsedS = QUICK_TOUR_DURATION;
          } else {
            // Map 0-1 progress to the 6 segment windows
            const segmentIndex = Math.min(Math.floor(quickProgress * QUICK_TOUR_SEGMENTS.length), QUICK_TOUR_SEGMENTS.length - 1);
            const seg = QUICK_TOUR_SEGMENTS[segmentIndex];
            const localProgress = (quickProgress * QUICK_TOUR_SEGMENTS.length) % 1;
            elapsedS = seg.startS + localProgress * (seg.endS - seg.startS);
          }
        } else {
          // Full Demo: existing 180s logic
          // Handle smooth seek transitions
          if (seekTransitionRef.current) {
            const transition = seekTransitionRef.current;
            const progress = Math.min((performance.now() - transition.startMs) / transition.durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOut cubic
            elapsedS = transition.from + (transition.to - transition.from) * eased;
            if (progress >= 1) {
              seekTransitionRef.current = null;
              isPausedRef.current = true; // Pause at target
              // Keep the target so paused frames hold here instead of
              // snapping back to the pre-seek wall clock (spec #13)
              seekTargetRef.current = transition.to;
            }
          }
          // Keyboard controls take priority: if paused and seekTargetRef is set, use it
          else if (isPausedRef.current && seekTargetRef.current !== null) {
            elapsedS = seekTargetRef.current;
          } else if (reducedMotion) {
            // Reduced motion: jump to segment boundaries, respect pause state
            if (isPausedRef.current) {
              // Hold at current segment boundary
              const state = demoTimeline.stateAt(wallClockS);
              const segment = state.cameraSegment;
              elapsedS = segment ? segment.endS : DEMO_DURATION_S;
            } else {
              // Auto-advance to next segment boundary
              const state = demoTimeline.stateAt(Math.min(wallClockS, DEMO_DURATION_S));
              const segment = state.cameraSegment;
              elapsedS = segment ? segment.endS : DEMO_DURATION_S;
            }
          } else if (isPausedRef.current) {
            // Paused: hold current time
            elapsedS = demoTimeline.stateAt(wallClockS).elapsedDemoSeconds;
          } else {
            // Normal wall-clock progression
            elapsedS = Math.min(wallClockS, DEMO_DURATION_S);
          }
        }

        const state = demoTimeline.stateAt(elapsedS);
        const segment = state.cameraSegment;

        // Update step progress indicator
        const actionSegments = demoTimeline.segments.filter(s => s.phase === 'action');
        const currentActionIndex = actionSegments.findIndex(s => s.stepId === segment?.stepId);
        if (currentActionIndex >= 0) {
          const seg = actionSegments[currentActionIndex];
          const segProgress = (elapsedS - seg.startS) / seg.durationS;
          setStepProgress({ currentStep: currentActionIndex, segmentProgress: Math.max(0, Math.min(1, segProgress)) });
        }

        if (segment?.phase === 'action' && segment.stepId !== lastActionStepId) {
          lastActionStepId = segment.stepId;
          narrateStep(segment.stepId);
        }

        const patient = patientWalkAt(state);
        const floorIndex = patient ? Math.round(patient.floor) : -1;
        if (patient && floorIndex !== lastFloorRef.current) {
          lastFloorRef.current = floorIndex;
        }

        const sampled = sampleRestackedPoseAt(demoTimeline.segments, elapsedS);
        const sig = `${segment?.id ?? ''}` +
          `|${sampled?.position.x.toFixed(2)},${sampled?.position.y.toFixed(2)},${sampled?.position.z.toFixed(2)}` +
          `|${patient ? `${patient.x.toFixed(2)},${patient.y.toFixed(2)},${patient.z.toFixed(2)},${patient.headingRad.toFixed(2)},${patient.walking ? patient.walkPhase.toFixed(3) : 'idle'}` : 'hidden'}`;
        if (sampled && sig !== lastSig) {
          lastSig = sig;
          demoFrameRef.current = {
            cameraPose: { position: sampled.position, target: sampled.target },
            patientState: patient,
          };
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [narrateStep, demoStartOffsetS, reducedMotion, demoTimeline, cameraMode]);

  // Hint bar auto-hide: 10s or first interaction
  useEffect(() => {
    hintTimeoutRef.current = setTimeout(() => { hintVisibleRef.current = false; }, 10000);
    const hideHint = () => { hintVisibleRef.current = false; if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current); };
    window.addEventListener('keydown', hideHint, { once: true });
    window.addEventListener('click', hideHint, { once: true });
    return () => { if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current); window.removeEventListener('keydown', hideHint); window.removeEventListener('click', hideHint); };
  }, []);

  const isOnline = guide.status === 'online';

  // Greet the session once the socket is open; server answers with a
  // system welcome frame plus the init ack metadata
  useEffect(() => {
    if (guide.status === 'online') {
      guide.send({
        type: 'init',
        sessionId: hudSessionId,
        patientName: 'Bệnh nhân demo',
        stt: '014',
        initialStepId: 'step-ticket',
      });
    }
  }, [guide.status, guide.send, hudSessionId]);

  // Intro narration lands at mount; step narration fires on action-phase entry
  // (10s or later), so this bubble is always first
  useEffect(() => {
    const introIndex = demoScript.beats.findIndex((b) => b.stepId === '' && b.cueS === 0);
    if (introIndex < 0 || narratedBeatsRef.current.has(introIndex)) return;
    narratedBeatsRef.current.add(introIndex);
    pushNarration(demoScript.beats[introIndex].narration);
  }, [demoScript, pushNarration]);

  // Keep the newest bubble in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, guide.status]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !isOnline) return;
      const id = `user-${(messageIdRef.current += 1)}`;
      setEntries((prev) => pushChatEntry(prev, { id, role: 'user', text: trimmed, at: Date.now() }));
      guide.send({ type: 'user', content: trimmed });
      showToast('💬 Đã gửi');
      setDraft('');
    },
    [guide, isOnline, showToast]
  );

  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#EEF5F2',
        position: 'relative',
      }}
    >
      {/* Camera mode indicator */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 50,
        pointerEvents: 'none',
        background: 'rgba(19, 78, 74, 0.9)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'monospace',
        fontWeight: 600,
      }}>
        {cameraMode === 'demo' ? 'DEMO (F: Free Cam)' : 'FREE CAM (F: Demo)'}
      </div>

      {/* Demo mode toggle: Quick Tour (30s) ↔ Full Demo (180s) */}
      <button
        onClick={toggleDemoMode}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 50,
          padding: '8px 12px',
          background: ACCENT,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(19, 78, 74, 0.3)',
          transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(19, 78, 74, 0.4)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(19, 78, 74, 0.3)'; }}
      >
        {demoModeRef.current === 'quick' ? '🎬 Full Demo (180s)' : '🚀 Quick Tour (30s)'}
      </button>

      {/* Step progress indicator — visual timeline of 8 pipeline steps */}
      <div style={{
        position: 'absolute',
        top: 50,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        gap: 8,
        background: 'rgba(255,255,255,0.9)',
        padding: '8px 12px',
        borderRadius: 8,
        boxShadow: '0 2px 16px rgba(19,78,74,0.2)'
      }}>
        {demoTimeline.segments.filter(s => s.phase === 'action').map((seg, i) => (
          <div
            key={seg.stepId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              opacity: i <= stepProgress.currentStep ? 1 : 0.4
            }}
            onClick={() => { seekTargetRef.current = demoTimeline.segments.filter(s => s.phase === 'action')[i].startS; isPausedRef.current = true; }}
          >
            <div style={{ width: 40, height: 4, background: i < stepProgress.currentStep ? ACCENT : i === stepProgress.currentStep ? ACCENT : '#E5E7EB', borderRadius: 2, position: 'relative' }}>
              {i === stepProgress.currentStep && (
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${stepProgress.segmentProgress * 100}%`, background: ACCENT, borderRadius: 2, transition: 'width 100ms linear' }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: i <= stepProgress.currentStep ? ACCENT : '#9CA3AF', whiteSpace: 'nowrap' }}>{seg.stepId.replace('step-', '')}</span>
          </div>
        ))}
      </div>

      <Suspense
        fallback={
          <div
            style={{
              width: '100vw',
              height: '100vh',
              background: '#EEF5F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Đang tải bối cảnh demo...
          </div>
        }
      >
        <Html5FloorRendererDynamic
          cameraPose={demoFrameRef.current.cameraPose}
          patientState={demoFrameRef.current.patientState}
          enableOrbit={true}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      {/* AI Guide chat HUD — the panel shares the bottom-left corner with the
          scene's interactive layer, so z-60 keeps it above and clickable
          (probe: elementFromPoint at the Gửi button previously hit the hint). */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60 }}>
        <div
          style={{
            pointerEvents: 'auto',
            position: 'absolute',
            left: 16,
            bottom: 16,
            width: 320,
            maxHeight: '58vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#FFFFFF',
            border: `2px solid ${ACCENT}`,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(19, 78, 74, 0.25)',
            fontFamily: 'sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* Header: title + live connection status */}
          <div
            style={{
              padding: '10px 12px',
              background: ACCENT,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>Trợ lý AI Hướng dẫn</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: STATUS_DOT_COLOR[guide.status],
                  display: 'inline-block',
                }}
              />
              {STATUS_LABEL[guide.status]}
              {guide.status === 'reconnecting' && guide.attempt > 0 ? ` (lần ${guide.attempt})` : ''}
            </span>
          </div>

          {/* Message list — user + guide bubbles */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              minHeight: 120,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {entries.length === 0 && (
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                {isOnline
                  ? 'Hỏi trợ lý về hướng đường, thủ tục hoặc chi phí. Hoặc chọn một câu gợi ý bên dưới.'
                  : 'AI Guide chưa kết nối — chạy Guide Service (ws://localhost:3002) rồi trang sẽ tự kết nối lại.'}
              </div>
            )}
            {entries.map((entry) => {
              const isUser = entry.role === 'user';
              const isError = entry.flavor === 'error';
              const isSystem = entry.flavor === 'system';
              return (
                <div
                  key={entry.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '6px 10px',
                    borderRadius: 10,
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    ...(isUser
                      ? { background: ACCENT, color: '#FFFFFF', borderBottomRightRadius: 3 }
                      : isError
                        ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', borderBottomLeftRadius: 3 }
                        : isSystem
                          ? { background: '#F0FDFA', color: '#134E4A', border: '1px solid #99F6E4', borderBottomLeftRadius: 3 }
                          : { background: '#F1F5F9', color: '#0F172A', borderBottomLeftRadius: 3 }),
                  }}
                >
                  {entry.text}
                </div>
              );
            })}
          </div>

          {/* Template chips — dimmed while the guide service is not reachable */}
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', flexWrap: 'wrap', flexShrink: 0 }}>
            {TEMPLATE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => submit(chip.label)}
                disabled={!isOnline}
                style={{
                  flex: '1 1 auto',
                  padding: '5px 8px',
                  fontSize: 11,
                  borderRadius: 999,
                  border: `1px solid ${ACCENT}`,
                  background: isOnline ? '#F0FDFA' : '#E5E7EB',
                  color: isOnline ? ACCENT : '#9CA3AF',
                  cursor: isOnline ? 'pointer' : 'not-allowed',
                  opacity: isOnline ? 1 : 0.6,
                  fontFamily: 'inherit',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px', flexShrink: 0 }}>
            <input
              value={draft}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') submit(draft);
              }}
              placeholder={isOnline ? 'Nhập câu hỏi...' : 'Chưa kết nối AI Guide'}
              aria-label="Nhập câu hỏi cho trợ lý AI"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #99F6E4',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={() => submit(draft)}
              disabled={!isOnline}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                border: 'none',
                background: isOnline ? ACCENT : '#E5E7EB',
                color: isOnline ? '#FFFFFF' : '#9CA3AF',
                cursor: isOnline ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      </div>

      {/* Control hint bar — auto-hides after 10s or first interaction */}
      {hintVisibleRef.current && (
        <div
          onClick={hideHint}
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(19, 78, 74, 0.95)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 24px rgba(19, 78, 74, 0.3)',
            cursor: 'pointer',
            transition: 'opacity 200ms ease-out',
          }}
        >
          Space: Tạm dừng | ← →: ±5s | 1-9: Bước | F: Tự do
        </div>
      )}

      {/* Celebration toasts */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            position: 'absolute',
            top: toast.y !== undefined ? toast.y : 60,
            left: toast.x !== undefined ? toast.x : '50%',
            zIndex: 80,
            background: 'rgba(19, 78, 74, 0.95)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 24px rgba(19, 78, 74, 0.3)',
            opacity: reducedMotion ? 1 : 0,
            transform: toast.x !== undefined
              ? `translateX(-50%) ${reducedMotion ? 'translateY(0)' : 'translateY(-10px)'}`
              : `${reducedMotion ? 'translateY(0)' : 'translateY(-10px)'}`,
            transition: reducedMotion ? 'none' : 'opacity 300ms cubic-bezier(0.23, 1, 0.32, 1), transform 300ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          {toast.text}
        </div>
      ))}

      {/* Floor indicator badge — shows current floor with elevator/stair icons */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        <div
          style={{
            background: 'rgba(19, 78, 74, 0.9)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 16px rgba(19, 78, 74, 0.3)',
            transition: 'transform 300ms cubic-bezier(0.23, 1, 0.32, 1), opacity 300ms ease-out',
            transform: `translateX(${lastFloorRef.current !== -1 ? 0 : 50}px)`,
            opacity: lastFloorRef.current !== -1 ? 1 : 0,
          }}
        >
          Tầng {lastFloorRef.current + 1}
          {lastFloorRef.current > 0 && <span>🛗</span>}
          {lastFloorRef.current > 0 && <span>🚶</span>}
        </div>
      </div>

    </main>
  );
}
