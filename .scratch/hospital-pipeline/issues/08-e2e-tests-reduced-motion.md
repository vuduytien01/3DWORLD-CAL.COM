# 08: E2E tests for reduced motion support in HTML5 3D renderer

**What to build:** E2E test coverage verifying that prefers-reduced-motion correctly disables walk-cycle animation, skips floor transition crossfades, skips sign entrance staggering, and stops free-camera inertia instantly — Edge only per user constraint (port 3001 forbidden).

**Blocked by:** None

**Status:** DONE (2026-11-17) — 6/6 passed on @calcom/web-edge against the real 3D world on port 3000. Full session ledger: docs/hospital-3d-session-2026-11-17.md

- [x] Write hospital-demo-reduced-motion.e2e.ts covering reduced motion across renderer
- [x] Verify tests pass against HTML5 renderer seams (__HOSPITAL_CAMERA__, __HOSPITAL_PERF__, data attributes)
- [x] Dev server unblocked after bun migration (webServer cwd fix + per-workspace deps)

Fixes landed in this ticket:
- Placeholder `[PERSON_NAME] quý thầy cô` → real intro text "Xin chào quý thầy cô"
- web-edge project emulates `reducedMotion: "reduce"` in playwright.config
- Marker-idle assertion corrected: timeline clock still moves under reduced motion (only walk-cycle freezes per spec #10) — asserts stable marker box instead of frozen position
