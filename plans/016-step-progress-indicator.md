# 016 — Add step progress indicator (visual timeline of 8 pipeline steps)

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / Missed opportunity
- **Estimated scope**: 1 file, ~40 lines changed (`apps/web/app/hospital-demo/page.tsx`)

## Problem

The demo has 8 pipeline steps (ticket → queue → consultation → lab → conclusion → admission → payment). Users have no visual indication of:
- Current step
- Progress through the pipeline
- Time remaining in current segment

The only indicators are: step narration in chat, step chips in overlay (small), and keyboard 1-9 jumps.

Per AUDIT §8: "Missed opportunity — spatial/sequential progress cues that don't animate but should."

## Target

Add a visual step progress bar at top of demo:
- **8 segments** (one per pipeline step)
- **Current segment highlighted** with animation
- **Completed steps** shown with checkmark
- **Current position** within segment (progress bar within segment)
- **Clickable** — click segment to jump (like keyboard 1-9)

## Repo conventions to follow

- Step data from `demoTimeline.segments` (8 action segments)
- Current step from `state.cameraSegment.stepId`
- Progress within segment from `state.elapsedDemoSeconds - segment.startS`
- Colors from `ACCENT` (`#134E4A`) and `HTML5_PALETTE`

## Steps

1. **Add progress bar state** in `HospitalDemoPage` (after `lastFloorRef`):
   ```tsx
   const [stepProgress, setStepProgress] = useState({ currentStep: 0, segmentProgress: 0 });
   ```

2. **Update in tick effect** (after `patient` calculation):
   ```tsx
   const actionSegments = demoTimeline.segments.filter(s => s.phase === 'action');
   const currentActionIndex = actionSegments.findIndex(s => s.stepId === segment?.stepId);
   if (currentActionIndex >= 0) {
     const seg = actionSegments[currentActionIndex];
     const segProgress = (elapsedS - seg.startS) / seg.durationS;
     setStepProgress({ currentStep: currentActionIndex, segmentProgress: Math.max(0, Math.min(1, segProgress)) });
   }
   ```

3. **Add progress bar UI** in render (after camera mode indicator):
   ```tsx
   <div style={{ position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', gap: 8, background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: 8, boxShadow: '0 2px 16px rgba(19,78,74,0.2)' }}>
     {actionSegments.map((seg, i) => (
       <div key={seg.stepId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: i <= stepProgress.currentStep ? 1 : 0.4 }} onClick={() => { seekTargetRef.current = actionSegments[i].startS; isPausedRef.current = true; }}>
         <div style={{ width: 40, height: 4, background: i < stepProgress.currentStep ? ACCENT : i === stepProgress.currentStep ? ACCENT : '#E5E7EB', borderRadius: 2, position: 'relative' }}>
           {i === stepProgress.currentStep && (
             <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${stepProgress.segmentProgress * 100}%`, background: ACCENT, borderRadius: 2, transition: 'width 100ms linear' }} />
           )}
         </div>
         <span style={{ fontSize: 10, fontWeight: 600, color: i <= stepProgress.currentStep ? ACCENT : '#9CA3AF', whiteSpace: 'nowrap' }}>{seg.stepId.replace('step-', '')}</span>
       </div>
     ))}
   </div>
   ```

## Boundaries

- **Do NOT change** existing keyboard controls (1-9 still work)
- **Do NOT change** step narration or guide integration
- **Respect** `reducedMotion` — progress bar still works, no animation issues

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, observe top progress bar
2. **Confirm**: 8 segments visible, current highlighted
3. **Confirm**: segment progress fills during action phase
4. **Confirm**: click segment jumps to that step (pauses demo)
5. **Confirm**: completed steps show checkmark/filled

### Done when
- Type-check + unit tests pass
- Progress bar visible and accurate
- Clickable segments work
- No regression on existing controls