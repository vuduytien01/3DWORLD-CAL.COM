# 009 — Add Quick Tour mode (30s) + Full Demo button

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: HIGH
- **Category**: Purpose & frequency / Retention (Time bottleneck)
- **Estimated scope**: 1 file, ~80 lines changed (`apps/web/app/hospital-demo/page.tsx`)

## Problem

The hospital demo is a 180s passive experience with no "do" action until keyboard controls (undiscoverable). B=MAP diagnosis: Time=1 (180s mandatory), Mental Effort=2 (discover controls), Non-Routine=1 (unfamiliar isometric dollhouse). Score 0/10 — core action below Action Line at all motivation.

**Starter Step needed**: Shrink core action from 180s → 30s highlights reel. Quick Tour auto-plays on load; Full Demo behind a button.

## Target

Add a `demoMode` state with three values: `'quick' | 'full' | 'paused'`. Quick Tour hits 6 key beats in 30s (5s each): ticket → queue → consultation → lab → conclusion → payment. Full Demo is the existing 180s choreography. A toggle button switches between them.

**UI changes**:
- Top-right: "🚀 Quick Tour" / "🎬 Full Demo" button (switches mode)
- Bottom hint bar (auto-hides after 10s or first interaction): `Space: Tạm dừng | ← →: ±5s | 1-9: Bước | F: Tự do`
- Quick Tour uses segment boundaries at key steps; no hold segments

**Logic**:
- `demoMode: 'quick'` → `elapsedS` progresses 6× faster through selected segments, skips holds
- `demoMode: 'full'` → existing 180s logic
- Button click toggles mode, resets to start of selected mode

## Repo conventions to follow

- State in refs for rAF loop (`demoModeRef`, `hintVisibleRef`)
- Keyboard controls already use `isPausedRef`, `seekTargetRef` — extend pattern
- Narration beats from `demoScript` — reuse existing `pushNarration`
- Reduced motion already handled — Quick Tour respects `reducedMotion`

## Steps

1. **Add state** at line 260 (after `lastFloorRef`):
   ```tsx
   const demoModeRef = useRef<'quick' | 'full' | 'paused'>('quick');
   const hintVisibleRef = useRef(true);
   const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   ```

2. **Add Quick Tour segment map** (after `demoTimeline` at line 66):
   ```tsx
   const QUICK_TOUR_SEGMENTS: readonly { stepId: string; startS: number; endS: number }[] = [
     { stepId: 'step-ticket', startS: 0, endS: 5 },
     { stepId: 'step-queue', startS: 5, endS: 10 },
     { stepId: 'step-consultation', startS: 10, endS: 15 },
     { stepId: 'step-lab', startS: 15, endS: 20 },
     { stepId: 'step-conclusion', startS: 20, endS: 25 },
     { stepId: 'step-payment', startS: 25, endS: 30 },
   ];
   const QUICK_TOUR_DURATION = 30;
   ```

3. **Add mode toggle handler** (after `handleKeyUp` at line 233):
   ```tsx
   const toggleDemoMode = useCallback(() => {
     const newMode = demoModeRef.current === 'quick' ? 'full' : 'quick';
     demoModeRef.current = newMode;
     isPausedRef.current = false;
     seekTargetRef.current = null;
     startMs = performance.now(); // reset wall clock
     // Re-send init to guide with new mode
     if (guide.status === 'online') {
       guide.send({ type: 'init', sessionId: hudSessionId, patientName: 'Bệnh nhân demo', stt: '014', initialStepId: newMode === 'quick' ? 'step-ticket' : 'step-ticket' });
     }
   }, [guide, guide.status, hudSessionId]);
   ```

4. **Modify tick effect** (line 295-424) to read `demoModeRef.current`:
   - Quick mode: progress through `QUICK_TOUR_SEGMENTS` at 6× speed, no holds
   - Full mode: existing logic
   - Both respect `reducedMotion` (jump to segment boundaries)

5. **Add UI** in render (after camera mode toggle at line 500):
   ```tsx
   <button
     onClick={toggleDemoMode}
     style={{ position: 'absolute', top: 16, right: 16, zIndex: 50, padding: '8px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
   >
     {demoModeRef.current === 'quick' ? '🎬 Full Demo (180s)' : '🚀 Quick Tour (30s)'}
   </button>
   ```

6. **Add hint bar** (before closing `</main>` at line 670):
   ```tsx
   {hintVisibleRef.current && (
     <div
       style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(19, 78, 74, 0.95)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 11, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}
       onClick={() => { hintVisibleRef.current = false; if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current); }}
     >
       Space: Tạm dừng | ← →: ±5s | 1-9: Bước | F: Tự do
     </div>
   )}
   ```

7. **Auto-hide hint** in `useEffect` at line 295:
   ```tsx
   hintTimeoutRef.current = setTimeout(() => { hintVisibleRef.current = false; }, 10000);
   // Clear on first interaction (keydown, click)
   const hideHint = () => { hintVisibleRef.current = false; if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current); };
   window.addEventListener('keydown', hideHint, { once: true });
   window.addEventListener('click', hideHint, { once: true });
   ```

## Boundaries

- **Do NOT change** existing 180s choreography or segment definitions
- **Do NOT change** keyboard controls (Space, ←/→, 1-9, F) — they work in both modes
- **Do NOT change** reduced-motion logic — Quick Tour respects it
- **Do NOT change** narration/guide integration — reuses existing beats

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo (`yarn dev` → `/hospital-demo`)
2. **Quick Tour auto-starts** (30s) — verify 6 beats in 30s, no holds
3. **Click toggle** → Full Demo (180s) loads from start
4. **Hint bar** visible → auto-hides after 10s or first keystroke/click
5. **Space/←/→/1-9/F** work in both modes
6. **Reduced motion** → Quick Tour jumps to segment boundaries
7. **Guide narration** fires at correct beats in both modes

### Done when
- Type-check + unit tests pass
- Quick Tour 30s / Full Demo 180s both work
- Hint bar auto-hides and dismisses on interaction
- Toggle resets demo to start of selected mode