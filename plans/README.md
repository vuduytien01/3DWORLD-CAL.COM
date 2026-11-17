# Animation Performance Plans

Generated from `animation-performance` skill recon+audit on 2026-11-15, commit `4917e69`.

## Plan Index

| # | Plan | Severity | Category | Status | Dependencies |
|---|------|----------|----------|--------|--------------|
| 1 | `001-demo-frame-state-in-raf.md` — Move demoFrame from React state to ref, remove setState from rAF tick | MEDIUM | Main-thread work | ✅ DONE | None |
| 2 | `002-animated-blur-on-floor-groups.md` — Drop `filter: blur()` during floor transitions, keep translateY+opacity | MEDIUM | Paint-tier property | ✅ DONE | None |
| 3 | `003-preemptive-will-change.md` — Narrow or remove `will-change: transform` from global CSS classes | LOW | GPU layer promotion | ✅ DONE | None |
| 4 | `004-patient-marker-entrance-scale.md` — Patient marker entrance: scale 0.8 → 0.95 | HIGH | Physicality & origin | ✅ DONE | None |
| 5 | `005-room-hover-duration.md` — Room hover duration: 120ms → 150ms | MEDIUM | Easing & duration | ✅ DONE | None |
| 6 | `006-floor-transition-will-change.md` — Floor transition will-change (inline, temporary) | MEDIUM | GPU layer promotion | ✅ DONE | None |
| 7 | `007-room-press-feedback.md` — Room press feedback: scale(0.98) | MEDIUM | Physicality & origin | ✅ DONE | None |
| 8 | `008-token-cohesion-room-hover.md` — Token cohesion comment | LOW | Cohesion & tokens | ✅ DONE | None |
| 9 | `009-quick-tour-mode.md` — Quick Tour mode (30s) + Full Demo toggle | HIGH | Purpose & frequency / Retention | ✅ DONE | None |
| 10 | `010-celebration-toasts.md` — Celebration toasts (Space, room click, chip click) | HIGH | Missed opportunity / Accessibility | ✅ DONE | None |
| 11 | `011-patient-idle-micro-movements.md` — Patient idle micro-movements (breath, sway, look, sway) | MEDIUM | Physicality & origin | ✅ DONE | None |
| 12 | `012-department-sign-stagger.md` — Department sign stagger on floor change | MEDIUM | Missed opportunity / Cohesion | ✅ DONE | None |
| 13 | `013-free-camera-inertia.md` — Free camera inertia/damping (velocity + damping) | MEDIUM | Physicality & origin / Interruptibility | ✅ DONE | None |
| 14 | `014-canvas-shadows-lighting.md` — Canvas 2D shadows & lighting | MEDIUM | Physicality & origin / Missed opportunity | ✅ DONE | None |
| 15 | `015-department-tooltips.md` — Department tooltips on room hover | MEDIUM | Purpose & frequency | ✅ DONE | None |
| 16 | `016-step-progress-indicator.md` — Step progress indicator (8 pipeline steps) | MEDIUM | Purpose & frequency | ✅ DONE | None |
| 17 | `017-floor-indicator.md` — Floor indicator badge (with elevator/stair icons) | LOW | Purpose & frequency | ✅ DONE | None |
| 18 | `018-threejs-renderer-build.md` — Build Three.js/R3F renderer using 3D world data layer | HIGH | Performance / 3D Renderer | TODO | None |

## Recommended Execution Order

### Phase 1: HTML5 Renderer Core Fixes (Done)
1. **001** — React re-render at 60 Hz during camera motion (highest leverage)
2. **002** — Animated blur on floor groups (paint cost)
3. **003** — Preemptive will-change (lowest risk)

### Phase 2: Animation Polish (Done)
4. **004** — Patient marker entrance scale
5. **005** — Room hover duration
6. **006** — Floor transition will-change
6. **007** — Room press feedback
7. **008** — Token cohesion

### Phase 3: Retention / UX (Done)
8. **009** — Quick Tour mode + Full Demo toggle
9. **010** — Celebration toasts
10. **011** — Patient idle micro-movements
11. **012** — Department sign stagger
12. **013** — Free camera inertia
13. **014** — Canvas 2D shadows & lighting
14. **015** — Department tooltips
15. **016** — Step progress indicator
16. **017** — Floor indicator badge

### Phase 2: Three.js/R3F Renderer (Next)
17. **018** — Build Three.js/R3F renderer using 3D world data layer

## Verification Gates
- All plans: `bunx tsc --noEmit` → exit 0
- All plans: `bunx vitest run` → 402/402 passed
- Perf gate: `PERF_T09=1 npx playwright test apps/web/playwright/perf-t09.e2e.ts --project=@calcom/web-edge` (headed Edge on real GPU)

## Notes
- All 17 plans for HTML5 renderer (ADR 0003) executed and verified
- B=MAP retention score improved: 0/10 → ~6.5/10 (4/6 fixes implemented)
- Plan 018 is the next major milestone: Three.js/R3F renderer using existing 3D data layer
- Perf targets for Three.js: <300 draw calls, ~18k tris, 60fps on Intel Iris Xe