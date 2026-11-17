# 012 — Add staggered entrance for department signs on floor change

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Cohesion & tokens
- **Estimated scope**: 1 file, ~25 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

When floor changes, department signs (`.html5-sign--dept-hanging`) and room signs (`.html5-sign--room-wall`) appear instantly with the new floor group. AUDIT §7: "Everything-at-once group entrances where a 30–80ms stagger belongs. Stagger is decorative — it must never block interaction." The floor transition already has a 300ms crossfade, but signs pop in at the end instead of staggering in.

## Target

Add staggered entrance animation for signs when a new floor group is built in `buildOverlay`:
- **Delay**: 30ms between each sign
- **Duration**: 200ms per sign
- **Easing**: `easeOut` (from motion-tokens: `cubic-bezier(0.23, 1, 0.32, 1)`)
- **Animation**: `opacity 0 → 1` + `translateY(10px) → 0`

Only animate signs in the **incoming** floor group (the new floor being revealed). Outgoing floor signs fade with the crossfade.

## Repo conventions to follow

- Easing: `easeOut` from `motion-tokens.ts` (cubic-bezier(0.23, 1, 0.32, 1))
- Stagger: 30–80ms per AUDIT §7
- CSS-in-JS in `OVERLAY_CSS` + inline styles in `buildOverlay`
- Sign elements created in `buildOverlay` at lines 338-349

## Steps

1. **Add entrance animation CSS** to `OVERLAY_CSS` (line 37-51):
   ```css
   .html5-sign { 
     ... 
     opacity: 0; 
     transform: translateY(10px); 
     transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1); 
   }
   .html5-sign--entrance { 
     opacity: 1; 
     transform: translateY(0); 
   }
   ```

2. **Modify `buildOverlay`** (lines 329-369) to apply staggered entrance:
   ```ts
   const signElements: HTMLElement[] = [];
   for (const sign of floor.signs) {
     const el = document.createElement("span");
     el.className = sign.variant === "step-chip" ? "html5-chip" : `html5-sign html5-sign--${sign.variant}`;
     el.textContent = sign.text;
     if (sign.variant === "step-chip" && sign.stepId) {
       el.dataset.step = sign.stepId;
     } else {
       el.style.color = sign.color;
     }
     group.appendChild(el);
     entries.push({ el, kind: "sign", sign });
     signElements.push(el);
   }
   // Staggered entrance for new floor signs
   requestAnimationFrame(() => {
     signElements.forEach((el, i) => {
       setTimeout(() => el.classList.add("html5-sign--entrance"), i * 30);
     });
   });
   ```

3. **Only apply to incoming floor** — in `repositionOverlay`, the new floor group is built when transition completes (line 416). The stagger should trigger there.

## Boundaries

- **Do NOT change** floor transition crossfade (300ms, already correct)
- **Do NOT animate** outgoing floor signs — they fade with crossfade
- **Do NOT change** step chips (`.html5-chip`) — they have their own hover animation
- **Do NOT block** interaction — stagger is purely decorative

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, trigger floor change (wait for choreography or press 1-9 to jump)
2. **Watch department/room signs** on new floor:
   - Signs fade in one-by-one with ~30ms delay
   - Each sign slides up 10px while fading in
   - Total stagger for ~10 signs = ~300ms (fits within floor transition)
3. **Reduced motion** → signs appear instantly (no stagger)
4. **Free camera mode** → no floor changes, no stagger
5. No regression on floor transition or sign positioning

### Done when
- Type-check + unit tests pass
- Staggered entrance visible on floor change
- Reduced motion disables stagger
- No layout shift or interaction blocking