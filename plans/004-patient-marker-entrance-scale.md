# 004 — Fix patient marker entrance: scale(0.8) → scale(0.95)

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, 3 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

Patient marker entrance animation at `html5-floor-renderer.tsx:515-517` uses `scale(0.8) → 1` over 200ms:

```tsx
const entranceProgress = Math.min((performance.now() - entranceStartMs) / 200, 1);
const scale = 0.8 + 0.2 * entranceProgress;
const opacity = entranceProgress;
patientMarker.style.transform = `translate(${point.sx.toFixed(1)}px, ${point.sy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
patientMarker.style.opacity = opacity.toFixed(3);
```

AUDIT §3: "Never `scale(0)` — nothing in the real world appears from nothing. Target: `scale(0.9–0.97)` + `opacity: 0`." `scale(0.8)` is below the 0.9 floor, making the marker appear from a compressed state that feels unnatural for a medical demo.

## Target

Change entrance scale from `0.8 → 1.0` to `0.95 → 1.0`. Keep 200ms duration and opacity fade.

```tsx
const entranceProgress = Math.min((performance.now() - entranceStartMs) / 200, 1);
const scale = 0.95 + 0.05 * entranceProgress;  // 0.95 → 1.0
const opacity = entranceProgress;
patientMarker.style.transform = `translate(${point.sx.toFixed(1)}px, ${point.sy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
patientMarker.style.opacity = opacity.toFixed(3);
```

## Repo conventions to follow

- Motion tokens in `motion-tokens.ts` — no entrance easing token exists yet; this is a one-off value
- CSS `transform` + `opacity` only (composite-only) — already correct
- Entrance animation driven in `drawDynamic` via `performance.now()` — keep this pattern

## Steps

1. **Change line 516**: `const scale = 0.8 + 0.2 * entranceProgress;` → `const scale = 0.95 + 0.05 * entranceProgress;`
2. **Verify** the marker still fades in (opacity 0→1) and scales up naturally
3. **No other changes** — duration, opacity, transform structure unchanged

## Boundaries

- **Do NOT change** entrance duration (200ms) or opacity curve
- **Do NOT change** `entranceStartMs` tracking logic at lines 254-256, 469
- **Do NOT touch** floor transition animation (lines 375-417) or room hover (lines 48-49)

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo (`yarn dev` → `/hospital-demo`)
2. Watch patient marker appear at ~14s (first action segment)
3. **Confirm**: marker scales from 95% to 100% (barely perceptible scale, mostly opacity fade)
4. **Confirm**: no "pop" from tiny size — feels like fading in, not growing from nothing
5. DevTools Animations panel at 10% speed — verify scale goes 0.95→1.0, not 0.8→1.0

### Done when
- Type-check + unit tests pass
- Feel-check confirms natural entrance
- No regression on floor transition or room hover