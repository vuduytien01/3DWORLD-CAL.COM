# 002 — Drop animated `filter: blur()` during floor transitions

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Performance — paint-tier property on full-width layer
- **Estimated scope**: 1 file, ~12 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

During a floor transition (spec #17), the renderer animates both outgoing and incoming floor groups for 300 ms. At `html5-floor-renderer.tsx:400` and `:406` it sets:

```tsx
// Outgoing floor
group.style.filter = `blur(${2 * eased}px)`;
// Incoming floor
group.style.filter = `blur(${2 * (1 - eased)}px)`;
```

The floor group has `position: absolute; inset: 0` (full viewport width/height). `filter: blur()` is a paint-tier property — every frame the browser must repaint the entire overlay area at the current blur radius. At 2 px max radius this is the cheap end of blur, but:

1. It is not composite-only (`transform`/`opacity` are).
2. Safari prices blur hardest among browsers.
3. The transition runs while the camera is also moving (the floor change is triggered by the camera choreography), so paint work competes with the canvas draw and DOM reposition.
3. The skill's rule: "Keep animated `blur()` under 20 px; 2–5 px is enough to soften a crossfade" — we are at the minimum, so the fix is to drop the blur entirely and keep the crossfade via `translateY` + `opacity` only.

Current code at `html5-floor-renderer.tsx:395-410`:
```tsx
if (floorTransitionDirection && floorTransitionStartMs > 0) {
  const progress = Math.min((performance.now() - floorTransitionStartMs) / 300, 1);
  const eased = 1 - Math.pow(1 - progress, 3); // easeOut cubic
  const overlayFloors = overlay.querySelectorAll(".html5-floor-group");
  overlayFloors.forEach((group) => {
    const floorIndex = parseInt(group.dataset.floor ?? "-1", 10);
    if (floorIndex === prevFocusFloor) {
      const translateY = -100 * eased;
      group.style.transform = `translateY(${translateY}%)`;
      group.style.opacity = (1 - eased).toFixed(3);
      group.style.filter = `blur(${2 * eased}px)`;
    } else if (floorIndex === camera.focusFloor) {
      const translateY = 100 * (1 - eased);
      group.style.transform = `translateY(${translateY}%)`;
      group.style.opacity = eased.toFixed(3);
      group.style.filter = `blur(${2 * (1 - eased)}px)`;
    } else {
      group.style.transform = "translateY(0)";
      group.style.opacity = "1";
      group.style.filter = "none";
    }
  });
  ...
}
```

## Target

Remove the two `filter` assignments and the reset. Keep `translateY` + `opacity` — the crossfade remains, just without the blur mask.

```tsx
// After: only transform + opacity
if (floorIndex === prevFocusFloor) {
  const translateY = -100 * eased;
  group.style.transform = `translateY(${translateY}%)`;
  group.style.opacity = (1 - eased).toFixed(3);
  // No filter
} else if (floorIndex === camera.focusFloor) {
  const translateY = 100 * (1 - eased);
  group.style.transform = `translateY(${translateY}%)`;
  group.style.opacity = eased.toFixed(3);
  // No filter
} else {
  group.style.transform = "translateY(0)";
  group.style.opacity = "1";
  // No filter
}
```

The transition complete block at `:416-418` already resets `transform`/`opacity`/`filter` to baseline — the `filter = "none"` line becomes a no-op and can be removed or left (harmless).

## Repo conventions to follow

- **`transform`/`opacity` only for UI animation** — skill rule #1.
- **Crossfade with `translateY(100%)` + `opacity`** — already the pattern here; the blur was an additive mask.
- **No new dependencies** — pure CSS property removal.

## Steps

1. **Remove the outgoing-floor `filter` line** at `html5-floor-renderer.tsx:400`.
2. **Remove the incoming-floor `filter` line** at `:406`.
3. **Remove the `else` branch `filter = "none"`** at `:410` (optional — leaving it does no harm, but keeping the branch symmetric is cleaner).
4. **Verify the transition complete reset** at `:416-418` still resets `transform`/`opacity`/`filter="none"` — the `filter` line is now redundant but harmless; leave it or delete it.

## Boundaries

- **Do NOT change** the easing (`easeOut` cubic), duration (300 ms), or `translateY` percentages — the spatial explanation of the floor jump stays identical.
- **Do NOT change** the floor-group DOM structure or the transition trigger logic (camera `focusFloor` change detection at `:378`).
- **Do NOT touch** the patient marker entrance animation (`entranceStartMs` at `:256`, `:514-:518`) — it uses `scale` + `opacity`, no blur.
- **Do NOT touch** the room hotspot hover transition (`:48-:49`) — it is CSS-only and correct.

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. **Run the demo**, trigger a floor transition (wait for the choreography to change floors, or use keyboard `1-9` to jump steps which changes `focusFloor`).
2. **Watch the crossfade** — outgoing floor should slide up and fade, incoming should slide up from below and fade in.
3. **Confirm no visual regression** — the crossfade should still feel like a spatial transition, just without the subtle blur "mask" during the middle of the crossfade.
4. **DevTools Performance panel** during transition — confirm no paint spikes (green bars) from `filter`; the only per-frame work should be `transform`/`opacity` composite.
5. **Toggle `prefers-reduced-motion`** — transition should be instant (jump to segment boundary) per spec #10; no animation at all.

### Done when
- Type-check and unit tests pass.
- Manual feel-check confirms crossfade still explains the spatial jump.
- Perf gate (`PERF_T09=1`) still passes (blur removal can only help frame time).