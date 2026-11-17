# 015 — Add department tooltips on room hover

- **Status**: TODO
- **Commit**: 4917e69
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / Missed opportunity
- **Estimated scope**: 1 file, ~30 lines changed (`packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx`)

## Problem

Room hotspots (`.html5-room-hotspot`) show only a border highlight on hover. No department name, room type, or floor info appears. Users can't identify departments without clicking or reading the guide chat.

Per AUDIT §8: "Missed opportunity — rare delight moments... rendered with none of the delight budget they're allowed." A tooltip is a classic, expected affordance.

## Target

Add CSS-only tooltip on room hover:
- **Content**: Department name + room type + floor (e.g., "Nội - Phòng khám - Tầng 1")
- **Position**: Above room hotspot, centered horizontally
- **Animation**: 150ms fade-in (matching room hover duration)
- **Style**: Dark background, white text, rounded, subtle shadow

## Repo conventions to follow

- Room data in `Html5RoomRef` (from `floor-plan.ts`): `roomId`, `deptCode`, `floorIndex`, `label`
- Tooltip text from `room.label` + `deptCode` + floor
- CSS-in-JS in `OVERLAY_CSS` + inline styles on hover
- Use `easeOut` easing (150ms, cubic-bezier(0.23, 1, 0.32, 1))

## Steps

1. **Add tooltip CSS** to `OVERLAY_CSS`:
   ```css
   .html5-room-tooltip { 
     position: absolute; 
     left: 50%; 
     bottom: 100%; 
     transform: translateX(-50%) translateY(-8px); 
     background: rgba(19, 78, 74, 0.95); 
     color: #fff; 
     padding: 4px 10px; 
     border-radius: 4px; 
     font-size: 11px; 
     font-weight: 500; 
     white-space: nowrap; 
     pointer-events: none; 
     opacity: 0; 
     transform: translateX(-50%) translateY(-8px); 
     transition: opacity 150ms cubic-bezier(0.23, 1, 0.32, 1), transform 150ms cubic-bezier(0.23, 1, 0.32, 1); 
     box-shadow: 0 4px 16px rgba(19, 78, 74, 0.3); 
     z-index: 10; 
   }
   .html5-room-hotspot:hover .html5-room-tooltip { 
     opacity: 1; 
     transform: translateX(-50%) translateY(0); 
   }
   ```

2. **Modify room hotspot creation** in `buildOverlay` (lines 357-368) to add tooltip:
   ```ts
   const tooltip = document.createElement("span");
   tooltip.className = "html5-room-tooltip";
   tooltip.textContent = `${room.deptCode} - ${room.label} - Tầng ${room.floorIndex + 1}`;
   button.appendChild(tooltip);
   ```

3. **Ensure tooltip is inside the button** (which has `position: absolute` and `width: 100%; height: 100%`) so positioning works correctly.

## Boundaries

- **Do NOT change** room hover scale animation (already 150ms easeOut)
- **Do NOT change** room click behavior or selected state
- **Do NOT add** JavaScript for tooltip — pure CSS
- **Respect** `reducedMotion` — tooltip still works (no animation)

## Verification

### Mechanical
```bash
cd packages/features/hospital-pipeline && bunx tsc --noEmit
cd packages/features/hospital-pipeline && bunx vitest run
```

### Feel check
1. Run demo, hover over any room
2. **Confirm**: tooltip appears above room with department + room + floor
3. **Confirm**: fade-in matches hover animation (150ms)
4. **Confirm**: tooltip positioned above room, centered
5. **Confirm**: works on all floors, all room types

### Done when
- Type-check + unit tests pass
- Tooltips appear on all room hovers
- No layout shift or interaction blocking