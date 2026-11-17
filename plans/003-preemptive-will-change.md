# 003 — Narrow or remove preemptive `will-change: transform`

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: LOW
- **Category**: Performance — GPU layer promotion without measured need
- **Estimated scope**: 1 file, ~3 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

The renderer's embedded CSS (at `:41`, `:44`, `:50`) declares `will-change: transform` on three global classes:

```css
.html5-sign { ... will-change: transform; }
.html5-chip { ... will-change: transform; }
.html5-patient-marker { ... will-change: transform; }
```

The `animation-performance` skill rule: "**Add `will-change` only once you see the shift or measured dropped frames.** Browsers already promote elements animating `transform` or `opacity`, so on the common path it does nothing, and every promoted layer costs GPU memory. Put it on the element that animates, never on `*` or large containers."

All three elements *do* animate `transform` via inline styles set every frame (signs/chips via `repositionOverlay`, patient marker in `drawDynamic`). So the promotion is **legitimate in principle** — but it is **preemptive** (no measured shift or dropped frames triggered its addition) and **over-broad**:

1. **Global class selectors** promote every matching element for the lifetime of the page, including signs/chips on floors that are currently off-screen and culled by the overlay floor range (`overlayFloorRange` at `html5-floor-renderer.tsx:300,332`).
2. **No 1 px hand-off shift was observed** in testing — the skill says to add `will-change` only *after* seeing it.
3. **The renderer already repositions via inline `transform`** — the browser will auto-promote these layers on first animation anyway. `will-change` only avoids the one-time promotion hand-off, which costs a single frame, not the steady state.

## Target

**Option A (preferred):** Remove all three `will-change: transform` declarations from the CSS block. The browser will promote layers on first animation frame, which is the correct lazy behavior.

```css
/* Before */
.html5-sign { position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform; text-shadow: 0 1px 2px rgba(248, 250, 252, 0.9); }
.html5-chip { position: absolute; left: 0; top: 0; padding: 2px 8px; border-radius: 9999px; background: #134E4A; color: #F8FAFC; font-size: 11px; font-weight: 600; white-space: nowrap; will-change: transform; }
.html5-patient-marker { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 9999px; background: #BFDBFE; border: 1.5px solid #0F766E; will-change: transform; }

/* After */
.html5-sign { position: absolute; left: 0; top: 0; white-space: nowrap; text-shadow: 0 1px 2px rgba(248, 250, 252, 0.9); }
.html5-chip { position: absolute; left: 0; top: 0; padding: 2px 8px; border-radius: 9999px; background: #134E4A; color: #F8FAFC; font-size: 11px; font-weight: 600; white-space: nowrap; }
.html5-patient-marker { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 9999px; background: #BFDBFE; border: 1.5px solid #0F766E; }
```

**Option B (if a shift is observed during testing):** Move `will-change` inline onto the specific elements that animate, only when they animate. For the patient marker (10 px dot) and active signs/chips (overlay floor range ±1), set `element.style.willChange = "transform"` in `buildOverlay`/`drawDynamic`, and clear it after the animation ends. This is more surgical but adds JS complexity. Choose Option A unless a shift is measured.

## Repo conventions to follow

- **Lazy promotion** — let the browser promote on first animation frame.
- **No global `will-change`** — skill rule.
- **No new dependencies** — CSS-only removal.

## Steps

1. **Remove `will-change: transform;`** from `.html5-sign` at `html5-floor-renderer.tsx:41`.
2. **Remove `will-change: transform;`** from `.html5-chip` at `:44`.
3. **Remove `will-change: transform;`** from `.html5-patient-marker` at `:50`.

## Boundaries

- **Do NOT change** the inline `transform` assignments in `repositionOverlay` (`:437`, `:451`) or `drawDynamic` (`:517`) — those are the actual animations and must stay.
- **Do NOT change** the `transform-origin: center` or `transition` on `.html5-room-hotspot__content` (`:48-:49`) — that is a CSS transition on hover, correctly off the main thread, and does not use `will-change`.
- **Do NOT touch** any other CSS in the `OVERLAY_CSS` constant.

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. **Run the demo** on a mid-range device or throttled Chrome (CPU 4x slowdown).
2. **Watch the first frame of each animation type**:
   - Floor signs/chips repositioning when the camera moves (every frame during intro/outro, on floor changes).
   - Patient marker appearing and following the patient.
   - Room hotspot hover scale (CSS transition).
3. **Look for a 1 px shift** at the exact moment an element starts animating — a sudden jump in position at frame 1 of the animation. This is the promotion hand-off that `will-change` would have avoided.
4. **If NO shift is observed** — the fix is correct; browser auto-promotion is seamless.
5. **If a shift IS observed** — revert this plan (Option A) and implement Option B: set `style.willChange = "transform"` inline on the animating elements only, cleared after the animation.
6. **DevTools Performance panel** — record during intro descent; confirm no "Composite Layers" spikes or GPU memory growth from permanent layer promotion.
7. **Perf gate** (`PERF_T09=1`) — must still pass.

### Done when
- Type-check and unit tests pass.
- Manual feel-check on a throttled device confirms no 1 px hand-off shift on animation start.
- Perf gate passes.
- If a shift appears, this plan is reverted and Option B is implemented instead (new plan file).