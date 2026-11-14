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
        Đang tải bối cảnh 3D...
      </div>
    ),
  }
);

// Demo timeline built once — pure data, no DOM, same module-level pattern the
// old WebGL scene used for its internal demo engine.
const demoTimeline = composeDemoTimeline();

/** One sampled demo frame handed to the HTML5 renderer as props. */
interface DemoFrame {
  cameraPose: CameraPose;
  patientState: PatientWalkState | null;
}

const ACCENT = '#134E4A';

/**
 * The three questions the guide's own fallback template suggests first
 * (templates.ts fallback copy): wait time, next direction, cost — all three
 * route to canned templates, never the LLM.
 */
const TEMPLATE_CHIPS: readonly { label: string }[] = [
  { label: 'Chờ bao lâu?' },
  { label: 'Đi đâu?' },
  { label: 'Chi phí bao nhiêu?' },
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

  // ?session= gives each E2E worker its own guide session — parallel init
  // frames on one shared sessionId overwrite each other's state server-side
  const demoSession =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('session')
      : null;
  const hudSessionId = demoSession ?? 'hospital-demo-chat';

  // 10-beat demo narration (lib/demo/demo-script.ts) pushed into the chat
  // HUD as guide bubbles: intro at mount, one bubble when the patient reaches
  // each pipeline step, outro right after the final step beat. Keyed by beat
  // index — intro and outro both carry stepId "".
  const demoScript = useMemo(() => buildDemoScript(), []);
  const narratedBeatsRef = useRef<Set<number>>(new Set());

  // Demo clock state: one sampled frame per tick, skipped when nothing moved
  // (hold segments and idle stations), so React re-renders only during motion
  const [demoFrame, setDemoFrame] = useState<DemoFrame>(() => ({
    cameraPose:
      sampleRestackedPoseAt(demoTimeline.segments, 0) ??
      // Unreachable: the validated 180s choreography always covers t=0
      { position: { x: 0, y: 24, z: -6 }, target: { x: 0, y: 1.5, z: 6 } },
    patientState: patientWalkAt(demoTimeline.stateAt(0)),
  }));
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
  useEffect(() => {
    let rafId = 0;
    let lastSig = '';
    let lastActionStepId = '';
    const startMs = performance.now();
    const tick = () => {
      const elapsedS = Math.min((performance.now() - startMs) / 1000, DEMO_DURATION_S);
      const state = demoTimeline.stateAt(elapsedS);
      const segment = state.cameraSegment;

      if (segment?.phase === 'action' && segment.stepId !== lastActionStepId) {
        lastActionStepId = segment.stepId;
        const label = STEP_LOCATION_BY_ID.get(segment.stepId)?.label ?? segment.stepId;
        console.log('[HospitalDemo] Step changed:', label);
        narrateStep(segment.stepId);
      }

      const patient = patientWalkAt(state);
      const floorIndex = patient ? Math.round(patient.floor) : -1;
      if (patient && floorIndex !== lastFloorRef.current) {
        lastFloorRef.current = floorIndex;
        console.log('[HospitalDemo] Floor changed:', floorIndex + 1);
      }

      const sampled = sampleRestackedPoseAt(demoTimeline.segments, elapsedS);
      const sig = `${segment?.id ?? ''}` +
        `|${sampled?.position.x.toFixed(2)},${sampled?.position.y.toFixed(2)},${sampled?.position.z.toFixed(2)}` +
        `|${patient ? `${patient.x.toFixed(2)},${patient.y.toFixed(2)},${patient.z.toFixed(2)},${patient.headingRad.toFixed(2)},${patient.walking ? patient.walkPhase.toFixed(3) : 'idle'}` : 'hidden'}`;
      if (sampled && sig !== lastSig) {
        lastSig = sig;
        setDemoFrame({
          cameraPose: { position: sampled.position, target: sampled.target },
          patientState: patient,
        });
      }

      if (elapsedS < DEMO_DURATION_S) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [narrateStep]);

  const handleGuideMessage = useCallback((msg: GuideServerMessage) => {
    const id = `guide-${(messageIdRef.current += 1)}`;
    const entry = chatEntryFromServer(msg, id);
    if (entry) setEntries((prev) => pushChatEntry(prev, entry));
  }, []);

  const guide = useGuideWs(undefined, handleGuideMessage);
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
      setDraft('');
    },
    [guide, isOnline]
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
            Đang tải bối cảnh 3D...
          </div>
        }
      >
        <Html5FloorRendererDynamic
          cameraPose={demoFrame.cameraPose}
          patientState={demoFrame.patientState}
          enableOrbit={true}
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
    </main>
  );
}
