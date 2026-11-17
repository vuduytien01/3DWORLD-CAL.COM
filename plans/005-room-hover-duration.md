# 005 — Increase room hover transition duration 120ms → 150ms

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1 line changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

Room hotspot hover transition at `html5-floor-renderer.tsx:48-49`:

```css
.html5-room-hotspot__content { display: block; width: 100%; height: 100%; transform-origin: center; transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); }
.html5-room-hotspot:hover .html5-room-hotspot__content { transform: scale(1.02); }
```

AUDIT §2 duration budgets: tooltips/small popovers 125–200ms, dropdowns 150–250ms. Room hover is popover-like (reveals department info on click), so 120ms is below the 125ms minimum. 150ms is the correct floor for dropdown/select interactions.

## Target

Change duration from 120ms to 150ms. Keep easing (`cubic-bezier(0.23, 1, 0.32, 1)` matches `easeOut` token).

```css
.html5-room-hotspot__content { display: block; width: 100%; height: 100%; transform-origin: center; transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1); }
```

## Repo conventions to follow

- Easing token `easeOut` from `motion-tokens.ts:11` is `1 - Math.pow(1 - t, 3)` — CSS equivalent is `cubic-bezier(0.23, 1, 0.32, 1)` (already used)
- Room hotspot is the only CSS transition in the renderer — keep it consistent

## Steps

1. **Change line 48**: `transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);` → `transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1);`

## Boundaries

- **Do NOT change** easing curve or `transform-origin: center` (correct for centered scale)
- **Do NOT change** hover scale factor `1.02` (subtle, correct)
- **Do NOT touch** patient marker, floor transition, or rAF loop code

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, hover over any room hotspot
2. **Confirm**: scale animation feels slightly slower, more deliberate (150ms vs 120ms)
3. DevTools Animations panel at 10% speed — verify duration ~150ms
4. No regression on patient marker entrance or floor transitions

### Done when
- Type-check + unit tests pass
- Feel-check confirms 150ms hover duration