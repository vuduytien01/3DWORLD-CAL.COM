# 017 — Add floor indicator badge (current floor + elevator/stair icons)

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: LOW
- **Category**: Purpose & frequency / Missed opportunity
- **Estimated scope**: 1 file, ~30 lines changed (`apps/web/app/hospital-demo/page.tsx`)

## Problem

Users can't tell which floor they're viewing in the multi-floor dollhouse. The camera `focusFloor` changes during the choreography, but there's no persistent UI indicator.

Per AUDIT §8: "Missed opportunity — spatial orientation cues that don't animate but should."

## Target

Add a floor indicator badge at bottom-right:
- **Current floor**: "Tầng 1" / "Tầng 2" etc.
- **Elevator icon** (🛗) — shows when elevator shaft visible
- **Stair icon** (🚶) — shows when stairs visible
- **Animation**: 300ms slide when floor changes (matches floor transition)

## Repo conventions to follow

- Current floor from `camera.focusFloor` (in `demoFrameRef.current.cameraPose`? No, need to get from renderer)
- Actually, `demoFrameRef.current` doesn't have floor — need to pass from renderer or compute from camera
- Simpler: add floor indicator in renderer, pass to page via `window.__HOSPITAL_FLOOR__` mirror

## Steps

1. **Add floor mirror in renderer** (in `writeMirrors` at line 580):
   ```ts
   win.__HOSPITAL_FLOOR__ = camera ? camera.focusFloor : -1;
   ```

2. **Read floor in page** (in tick effect):
   ```tsx
   const floor = (window as any).__HOSPITAL_FLOOR__ ?? -1;
   ```

3. **Add floor indicator UI** (after progress bar):
   ```tsx
   <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
     <div style={{ background: 'rgba(19,78,74,0.9)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 16px rgba(19,78,74,0.3)', transition: 'transform 300ms cubic-bezier(0.23,1,0.32,1), opacity 300ms ease-out', transform: `translateX(${floor !== lastFloorRef.current ? 50 : 0}px)` }}>
       Tầng {floor + 1}
       {floor > 0 && <span>🛗</span>}
       {floor > 0 && <span>🚶</span>}
     </div>
   </div>
   ```

## Boundaries

- **Do NOT change** floor transition animation (already 300ms)
- **Do NOT change** camera choreography
- **Respect** `reducedMotion` — indicator still works

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, watch floor indicator during choreography
2. **Confirm**: floor number updates when camera changes floor
3. **Confirm**: elevator/stair icons show on floors > 0
4. **Confirm**: 300ms slide animation on floor change
5. **Confirm**: no regression on other UI

### Done when
- Type-check + unit tests pass
- Floor indicator visible and accurate
- Smooth animation on floor change