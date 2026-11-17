# 010 — Add celebration toasts for key actions

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: HIGH (retention: addresses Quick Diagnostic Row 4)
- **Category**: Missed opportunity / Accessibility (celebration = habit wiring)
- **Estimated scope**: 1 file, ~60 lines changed (`apps/web/app/hospital-demo/page.tsx`)

## Problem

B=MAP Quick Diagnostic Row 4: "Is there immediate feedback after key actions?" — **FAIL** (-1.5 points). No celebration means no habit wiring. The demo has three high-frequency user actions with zero feedback:

1. **Space press** (pause/resume) — no visual confirmation
2. **Room click** — no feedback beyond border color change
3. **Template chip click** — sends message but no confirmation

Per AUDIT §4 (Tiny Habits): "Celebration: an immediate positive emotion that wires the habit. Repetition alone isn't enough — you need the feeling of success."

## Target

Add a lightweight toast system that appears near the action source, animates in/out with `easeOut` (300ms), and auto-dismisses after 1.5s. Three toast types:

| Trigger | Toast Text | Position |
|---------|------------|----------|
| Space (pause) | "⏸ Tạm dừng" | Top-center, near mode toggle |
| Space (resume) | "▶ Tiếp tục" | Top-center |
| Room click | "🏥 Phòng khám [Tên khoa]" | Near room hotspot (screen coords) |
| Template chip click | "💬 Đã gửi" | Near chip button |

**Animation**: 300ms `easeOut` (from motion-tokens) — `translateY(-10px) opacity 0 → translateY(0) opacity 1` entrance, reverse exit. Max 3 toasts stacked.

## Repo conventions to follow

- Easing: `easeOut` from `motion-tokens.ts` (cubic-bezier(0.23, 1, 0.32, 1))
- Duration: 300ms entrance, 300ms exit, 1500ms display
- Position: absolute, stacked top-center with 8px gap
- Reduced motion: instant show/hide, no animation
- No new dependencies — pure React + CSS-in-JS

## Steps

1. **Add toast state** at line 276 (after hint refs):
   ```tsx
   interface Toast { id: number; text: string; x?: number; y?: number; }
   const [toasts, setToasts] = useState<Toast[]>([]);
   const toastIdRef = useRef(0);
   ```

2. **Add `showToast` helper** (after `hideHint` at line 260):
   ```tsx
   const showToast = useCallback((text: string, x?: number, y?: number) => {
     if (reducedMotion) {
       // Instant show/hide for reduced motion
       const id = ++toastIdRef.current;
       setToasts(prev => [...prev, { id, text, x, y }]);
       setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 1500);
       return;
     }
     const id = ++toastIdRef.current;
     setToasts(prev => [...prev, { id, text, x, y }]);
     setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000); // 300ms in + 1500ms + 300ms out
   }, [reducedMotion]);
   ```

3. **Wire Space key** (in `handleKeyDown` at line 205):
   ```tsx
   if (pauseToggle) {
     isPausedRef.current = !isPausedRef.current;
     showToast(isPausedRef.current ? '⏸ Tạm dừng' : '▶ Tiếp tục');
     if (!isPausedRef.current) seekTargetRef.current = null;
   }
   ```

4. **Wire room click** (in `onStageClick` at line 589 in renderer — need to pass callback from page):
   - Add `onRoomToast?: (roomId: string, deptCode: string, x: number, y: number) => void` to `Html5FloorRendererProps`
   - In page: pass `onRoomToast={(id, dept, x, y) => showToast(`🏥 Phòng khám ${dept}`, x, y)}`
   - In renderer: call `latest.current.onRoomToast?.(roomId, deptCode, point.sx, point.sy)` on click

5. **Wire template chip click** (in `submit` at line 526):
   ```tsx
   const submit = useCallback((text: string) => {
     ...
     guide.send({ type: 'user', content: trimmed });
     showToast('💬 Đã gửi');
     setDraft('');
   }, [guide, isOnline, showToast]);
   ```

6. **Add toast render** in page JSX (after hint bar, before `</main>`):
   ```tsx
   {toasts.map((toast) => (
     <div
       key={toast.id}
       style={{
         position: 'absolute',
         top: toast.y ?? 60,
         left: toast.x ?? '50%',
         transform: toast.x ? 'translateX(-50%)' : 'translateX(-50%)',
         zIndex: 80,
         background: 'rgba(19, 78, 74, 0.95)',
         color: '#fff',
         padding: '8px 16px',
         borderRadius: 8,
         fontSize: 12,
         fontWeight: 500,
         whiteSpace: 'nowrap',
         backdropFilter: 'blur(4px)',
         boxShadow: '0 4px 24px rgba(19, 78, 74, 0.3)',
         opacity: 0,
         transform: 'translateY(-10px)',
         transition: 'opacity 300ms cubic-bezier(0.23, 1, 0.32, 1), transform 300ms cubic-bezier(0.23, 1, 0.32, 1)',
       }}
       onAnimationEnd={() => {}} // trigger reflow
     >
       {toast.text}
     </div>
   ))}
   ```
   Note: Use CSS keyframes or requestAnimationFrame to trigger entrance animation. Simpler: set initial styles via ref, then requestAnimationFrame to apply animated styles.

## Boundaries

- **Do NOT change** existing keyboard controls or mode toggle
- **Do NOT add** new dependencies
- **Respect** `reducedMotion` — instant show/hide, no animation
- **Max 3 toasts** stacked — older ones push up
- **Room click** requires passing callback through renderer props

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, press **Space** → "⏸ Tạm dừng" / "▶ Tiếp tục" appears top-center, animates in, auto-dismisses
2. Click a **room** → "🏥 Phòng khám [Tên khoa]" appears near click, animates in
3. Click a **template chip** → "💬 Đã gửi" appears near chip
4. **Reduced motion** → toasts appear/disappear instantly, no animation
5. **Stacking** → multiple toasts stack with 8px gap, max 3 visible
6. **No interference** with existing UI (mode toggle, hint bar, guide HUD)

### Done when
- Type-check + unit tests pass
- All 4 toast triggers work with correct text/position
- Animations use `easeOut` 300ms from motion-tokens
- Reduced motion respected
- No regressions on existing features