# 09: E2E tests for timeline interruptibility in HTML5 3D renderer

**What to build:** E2E test coverage verifying smooth seek transitions (400ms easeOut cubic), pause/resume with toast feedback, ArrowLeft/ArrowRight ±5s seek, number keys 1-9 jumping to pipeline steps, Home/End seeking to demo start/end.

**Blocked by:** None

**Status:** DONE (2026-11-17) — 6/6 passed on @calcom/web-edge against the real 3D world on port 3000. Full session ledger: docs/hospital-3d-session-2026-11-17.md

- [x] Write hospital-demo-timeline-interruptibility.e2e.ts covering timeline interruptibility
- [x] Verify tests pass against HTML5 renderer seams
- [x] Dev server unblocked after bun migration

Fixes landed in this ticket:
- Real engine bug found and fixed (spec #13): after a 400ms seek transition completed, paused frames snapped back to the pre-seek wall clock — camera flew away from the target (Home flaky floor 0→1). page.tsx tick now keeps seekTargetRef while paused; Space resume clears it.
- Number-keys assertion switched from zoom (can coincide between stations) to panX/panY delta
- Home test gained a 1000ms settle + re-assert after the smooth-seek lerp
