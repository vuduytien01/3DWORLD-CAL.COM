# 001 — Remove React state update from the rAF tick in the hospital demo page

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Performance — main-thread work inside the frame budget
- **Estimated scope**: 1 file, ~25 lines changed (`apps/web/app/hospital-demo/page.tsx`)

## Problem

The demo clock runs a `requestAnimationFrame` loop inside `HospitalDemoPage` (`page.tsx:304-423`). Every tick it computes the new camera pose and patient state, then calls `setDemoFrame({ cameraPose, patientState })` at `:412-415`. This triggers a React re-render of the page and, through `Html5FloorRendererDynamic`, re-mounts new props into the renderer.

The signature guard at `:410` (`if (sampled && sig !== lastSig)`) means the update only fires when something visibly changed. During hold segments (98 s of the 180 s demo) the guard correctly suppresses the update — zero re-renders. **But during the 14 s intro descent and the 12 s outro aerial, the camera moves every frame, so the guard does not help and the page re-renders at 60 Hz.**

One `setState` per frame = one React render per frame. On a mid-range device the render phase alone can exceed the 16.7 ms / 8 ms budget (120 Hz), and the animation is competing with the canvas draw, the DOM overlay reposition, and the AI Guide HUD. The skill's rule: "Hand-rolled animation that calls `setState` every frame: the component re-renders every 16.7 ms and the render alone blows the budget." (`animation-performance` skill, §React: Don't Animate Through State).

Current code at `page.tsx:410-415`:
```tsx
if (sampled && sig !== lastSig) {
  lastSig = sig;
  setDemoFrame({
    cameraPose: { position: sampled.position, target: sampled.target },
    patientState: patient,
  });
}
```

The renderer (`html5-floor-renderer.tsx:287,463`) already reads `latest.current.cameraPose` and `latest.current.patientState` from a ref that is updated every tick (`latest.current = props` at `:225`). The state is **redundant** — the renderer does not need `demoFrame` as a prop to get the current pose.

## Target

Move `demoFrame` out of React state into a ref that the tick writes and the renderer reads. Keep the signature guard — it is the correct optimization for the hold segments.

```tsx
// page.tsx — new ref replaces demoFrame state
const demoFrameRef = useRef<DemoFrame>({
  cameraPose:
    sampleRestackedPoseAt(demoTimeline.segments, demoStartOffsetS) ??
    { position: { x: 0, y: 24, z: -6 }, target: { x: 0, y: 1.5, z: 6 } },
  patientState: patientWalkAt(demoTimeline.stateAt(demoStartOffsetS)),
});

// Inside the tick — write the ref, no setState
if (sampled && sig !== lastSig) {
  lastSig = sig;
  demoFrameRef.current = {
    cameraPose: { position: sampled.position, target: sampled.target },
    patientState: patient,
  };
}

// Render — read the ref, not state
<Html5FloorRendererDynamic
  cameraPose={demoFrameRef.current.cameraPose}
  patientState={demoFrameRef.current.patientState}
  enableOrbit={true}
  reducedMotion={reducedMotion}
/>
```

The renderer already uses the latest-props pattern (`latest.current = props` at `html5-floor-renderer.tsx:225`), so when the parent re-renders for any *other* reason (HUD chat, camera mode toggle, reduced-motion change), the renderer will pick up the latest values from props. The ref write is instant and does not schedule a render.

## Repo conventions to follow

- **Refs for mutable per-frame data** — see `freeCameraRef` at `page.tsx:112` and `lastFloorRef` at `:258`.
- **Latest-props ref in the renderer** — `html5-floor-renderer.tsx:224-225` (`latest.current = props`) is the pattern to trust.
- **Signature guard stays** — it correctly skips work during hold segments; do not remove it.
- **No new dependencies** — only `useRef` already imported.

## Steps

1. **Replace `useState` with `useRef` for `demoFrame`** at `page.tsx:252-260`.
   - Change `const [demoFrame, setDemoFrame] = useState<DemoFrame>(...)` to `const demoFrameRef = useRef<DemoFrame>(...)` with the same initializer.
   - Remove the `setDemoFrame` identifier from scope.

2. **Update the tick write site** at `page.tsx:410-415`.
   - Replace `setDemoFrame({ ... })` with `demoFrameRef.current = { ... }`.
   - Keep the `if (sampled && sig !== lastSig)` guard and `lastSig = sig` assignment exactly.

3. **Update the free-camera branch** at `page.tsx:360-365`.
   - Replace `setDemoFrame({ cameraPose: ..., patientState: null })` with `demoFrameRef.current = { cameraPose: ..., patientState: null }`.

4. **Update the render site** at `page.tsx:519-522`.
   - Change `cameraPose={demoFrame.cameraPose}` to `cameraPose={demoFrameRef.current.cameraPose}`.
   - Change `patientState={demoFrame.patientState}` to `patientState={demoFrameRef.current.patientState}`.

5. **Delete the unused `setDemoFrame` from the effect deps** at `page.tsx:423`.
   - The `useEffect` dependency array is `[narrateStep, demoStartOffsetS, reducedMotion, demoTimeline, cameraMode]`; `setDemoFrame` is not listed, so no change needed. (This step is a verification — confirm the array does not reference the removed state setter.)

## Boundaries

- **Do NOT touch** the renderer (`html5-floor-renderer.tsx`). It already reads from `latest.current` and is compatible with either props or ref reads.
- **Do NOT change** the signature computation (`sig` string, `lastSig`, `patient`, `sampled`). It is the correct guard for hold segments.
- **Do NOT change** the `reducedMotion` branch at `page.tsx:375-383` — it computes `elapsedS` differently but still writes the same frame shape; just write the ref instead of calling `setDemoFrame`.
- **Do NOT add** a `useMemo` or `useCallback` around the ref read in JSX — reading a ref in render is instant and always returns the current value.
- **Do NOT change** the initial value computation (it uses the same pure functions: `sampleRestackedPoseAt`, `patientWalkAt`, `demoTimeline.stateAt`).

## Verification

### Mechanical
```bash
# Type-check the package
cd packages/features/hospital-pipeline && bunx tsc --noEmit
# Unit tests (unchanged — no logic altered)
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. **Run the demo** (`yarn dev` → `http://localhost:3000/hospital-demo`) on a mid-range laptop or throttled Chrome DevTools (CPU 4x slowdown).
2. **Watch the intro descent (first 14 s)** — the camera moves smoothly toward the ticket counter.
3. **Open DevTools Performance panel**, record 10 s during the intro descent.
4. **Confirm**:
   - No React render spikes (yellow bars) at 60 Hz — the `HospitalDemoPage` should not re-render during the intro descent.
   - Frame time ≤ 16.7 ms (60 Hz) or ≤ 8 ms (120 Hz) on the timeline.
   - The `drawDynamic` and `repositionOverlay` still run every frame (they are the intended per-frame work).
5. **Toggle `prefers-reduced-motion`** (Rendering panel) → confirm the demo clock still jumps to segment boundaries and the patient marker snaps, no regressions.
6. **Switch to free camera (F key)** → fly around; confirm the camera follows the mouse without frame drops.
7. **Hold segments (middle 98 s)** — the page is idle; the signature guard means zero ref writes, zero React renders. Verify by leaving the tab open and checking the Performance panel shows no activity.

### Done when
- `bunx tsc --noEmit` exits 0.
- `bunx vitest run` exits with 402/402 passed (or the current gate count).
- DevTools recording during the intro descent shows **no `HospitalDemoPage` re-renders** at frame cadence — the only per-frame work is canvas draw + DOM reposition.
- The perf gate (`PERF_T09=1 npx playwright test apps/web/playwright/perf-t09.e2e.ts --project=@calcom/web-edge`) still passes on a quiet machine.