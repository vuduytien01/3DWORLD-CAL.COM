# 007 — Add room hotspot press feedback (scale 0.98, 100ms)

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: LOW
- **Category**: Missed opportunity / Physicality & origin
- **Estimated scope**: 1 file, ~5 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

Room hotspot (`.html5-room-hotspot`) has hover feedback (`scale(1.02)`) and selected state (border color), but **no press feedback**. AUDIT §3: "Press feedback: `transform: scale(0.97)` on `:active` with `transition: transform 160ms ease-out`. Keep it subtle (0.95–0.98)." A clickable room should give immediate tactile response.

## Target

Add `:active` state to `.html5-room-hotspot__content` (the inner wrapper that already handles hover scale):

```css
.html5-room-hotspot__content { 
  display: block; 
  width: 100%; 
  height: 100%; 
  transform-origin: center; 
  transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1); 
}
.html5-room-hotspot:hover .html5-room-hotspot__content { transform: scale(1.02); }
.html5-room-hotspot:active .html5-room-hotspot__content { transform: scale(0.98); }
```

Note: `:active` on the button propagates to the inner wrapper via the existing structure. The `transition` already covers all `transform` changes.

## Repo conventions to follow

- Press scale 0.98 is within AUDIT §3 range (0.95–0.98)
- Uses existing `transition` on `__content` — no new transition needed
- `transform-origin: center` already correct for centered press
- Matches AUDIT §3 press feedback guidance

## Steps

1. **Add at line 50** (after hover rule): `.html5-room-hotspot:active .html5-room-hotspot__content { transform: scale(0.98); }`

## Boundaries

- **Do NOT change** hover scale (1.02) or selected state (border color)
- **Do NOT add** new transition — reuse existing 150ms easeOut on `__content`
- **Do NOT touch** patient marker, floor transition, or rAF loop

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, click and hold on any room hotspot
2. **Confirm**: subtle scale down to 98% while pressed, springs back on release
3. DevTools Animations panel — verify `:active` state triggers scale(0.98)
4. No interference with hover (1.02) or selected state
5. Works with keyboard (Space/Enter) if focusable

### Done when
- Type-check + unit tests pass
- Feel-check confirms press feedback
- No regression on hover or selection