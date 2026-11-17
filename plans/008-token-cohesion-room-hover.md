# 008 — Room hover easing: reference motion-tokens easeOut

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, 1 line changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

Room hover easing at `html5-floor-renderer.tsx:48` is hardcoded:

```css
.html5-room-hotspot__content { display: block; width: 100%; height: 100%; transform-origin: center; transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1); }
```

The cubic-bezier `cubic-bezier(0.23, 1, 0.32, 1)` exactly matches `easeOut` from `motion-tokens.ts:11` (`1 - Math.pow(1 - t, 3)`). AUDIT §7: "Five hand-typed cubic-beziers that almost match is a consolidation finding." The easing should reference the token convention.

Since this is CSS-in-JS string, we can't directly import the TS token. Options:
1. Add a CSS custom property `--ease-out` defined from the token
2. Add a comment with the token name for maintainability
3. Define easing constants in a shared CSS module

Option 2 is minimal and fits the codebase (no CSS custom properties currently used).

## Target

Add a comment documenting the token source:

```css
.html5-room-hotspot__content { display: block; width: 100%; height: 100%; transform-origin: center; transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1); /* easeOut from motion-tokens.ts */ }
```

## Repo conventions to follow

- Motion tokens live in `motion-tokens.ts` — single source of truth for easings
- CSS-in-JS strings can't import TS, so comment is the convention
- Camera choreography already imports `EasingName` and uses string names — consistent

## Steps

1. **Change line 48**: append comment `/* easeOut from motion-tokens.ts */` after the transition declaration

## Boundaries

- **Do NOT change** the easing value or duration
- **Do NOT add** CSS custom properties or new files
- **Do NOT touch** any other animation code

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
- No visual change — this is a documentation fix
- Code review: comment correctly identifies the token

### Done when
- Type-check + unit tests pass
- Comment added and accurate