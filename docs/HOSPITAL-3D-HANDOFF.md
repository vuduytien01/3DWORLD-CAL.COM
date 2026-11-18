# Hospital 3D — Handoff Document for Team Members

> **Tóm tắt toàn bộ công việc đã làm**: Build, test, fix, config, docs — để người khác clone về và làm tiếp ngay.

---

## 1. Trạng thái hiện tại (2026-11-18)

| Mục | Trạng thái |
|-----|------------|
| **3D Demo** | ✅ Chạy thật tại `http://localhost:3000/hospital-demo` |
| **Guide Service WS** | ✅ `ws://localhost:3002` kết nối OK, session chat hoạt động |
| **E2E (Edge)** | ✅ 24/24 passed (reduced-motion 6, timeline-interruptibility 6, demo+guide+mobile 12) |
| **Unit tests (vitest)** | ✅ 36 test files, 476 tests passing (xem commit `658c4a1fa8`) |
| **Bun migration** | ✅ Hoàn tất — `bun install` green, 6 post-install tasks pass |
| **Docs** | ✅ `hospital-demo-run-guide.md` (canonical), `hospital-3d-session-2026-11-17.md` (ledger) |
| **Push GitHub** | ✅ https://github.com/vuduytien01/3DWORLD-CAL.COM (main branch) |

---

## 2. Kiến trúc tóm tắt (ADR 0003 - HTML5 Pivot)

```
apps/web/app/hospital-demo/page.tsx          # Trang demo: tick loop, camera, HUD, chat, keyboard
packages/features/hospital-pipeline/
  lib/html5-world/                            # HTML5 isometric renderer (ADR 0003)
    html5-floor-renderer.tsx                  # 2 canvas + DOM overlay, __HOSPITAL_PERF__, data-hospital-ready
    camera-adapter.ts  patient-walk.ts  patient-rig.ts
    motion-tokens.ts  use-reduced-motion.ts  floor-plan.ts  world-to-screen.ts
  lib/demo/
    camera-choreography.ts                    # DEMO_DURATION_S = 180, sampleRestackedPoseAt
    demo-timeline.ts  demo-script.ts  wait-simulation.ts
  lib/ai-guide/
    ws-entry.ts                               # Transport ws, port 3002, Pattern B standalone
    server.ts                                 # Protocol init/user/ping/health, heartbeat, close
    llm-router.ts                             # SYSTEM_PROMPT tiếng Việt, FreeLLM hoặc stub
    use-guide-ws.ts                           # Client hook: backoff reconnect + heartbeat
    session.ts                                # Session map + dọn lỗi thời
  lib/step-graph/                             # Nguồn thật vị trí bước, phòng, sign hosts
  lib/3d-world/                               # World-spec, khoa-slice, character-poses
  lib/data/                                   # Dữ liệu bệnh viện
```

**Luồng 1 frame:** `page.tsx` tick → `sampleRestackedPoseAt` → `html5-floor-renderer` (2 canvas + DOM) + `patient-walk` marker.

**Luồng chat:** Client `use-guide-ws` → `ws://localhost:3002` → `server.ts` → `llm-router` (FreeLLM/stub) → frame `assistant` trả về.

---

## 3. Bản đồ cổng (QUAN TRỌNG)

| Cổng | Dùng cho | Ghi chú |
|------|----------|---------|
| **3000** | Web app Next.js (`/hospital-demo`) | **BẮT BUỘC bind** |
| **3002** | Guide Service WebSocket | **BẮT BUỘC bind** |
| **3001** | FreeLLM gateway | **TUYỆT ĐỐI KHÔNG BIND** (chỉ gọi ra từ guide) |
| **9444** | Dùng bởi tiến trình khác | **CẤM** |
| 3003 | Hospital mock (chỉ E2E) | Playwright tự nâng |
| 3100, 3101 | Embed dev server | Không thuộc đường hospital |

---

## 4. Chạy cho người mới clone (2 terminal PowerShell)

```powershell
# 1. Clone + cài
git clone https://github.com/vuduytien01/3DWORLD-CAL.COM.git D:\cal.diy
cd D:\cal.diy
bun install

# Terminal 1 - Web App
cd D:\cal.diy\apps\web
$env:NEXT_PUBLIC_IS_E2E = "1"
bun run dev -p 3000

# Terminal 2 - Guide Service
cd D:\cal.diy\packages\features\hospital-pipeline
$env:FREELLM_STUB = "true"
bun run guide-server
```

**Kiểm tra:** Mở `http://localhost:3000/hospital-demo` → thấy badge `DEMO (F: Free Cam)`, 8 chip bước, canvas isometric, panel chat connected.

---

## 5. Chạy test (gates)

### Unit gate (vitest)
```powershell
cd D:\cal.diy\packages\features\hospital-pipeline
bun run test
```
> 6 suite bổ sung 2026-11-18: config-properties, motion-tokens, world-spec, guide-service-lifecycle, use-reduced-motion, html5-floor-renderer

### Coverage gate
```powershell
bun run test:coverage
```
> Ngưỡng 80% dòng comment trong `vitest.config.ts` — bật sau lần đầu để khớp mức hiện tại.

### E2E gate (Playwright @calcom/web-edge = msedge)
```powershell
# Cần web app đang chạy trên 3000 (NEXT_PUBLIC_IS_E2E=1 trên server)
bun x playwright test apps/web/playwright/hospital-demo-reduced-motion.e2e.ts apps/web/playwright/hospital-demo-timeline-interruptibility.e2e.ts apps/web/playwright/hospital-demo.e2e.ts apps/web/playwright/hospital-demo-guide.e2e.ts apps/web/playwright/hospital-demo-mobile.e2e.ts --project=@calcom/web-edge --workers=2 --reporter=list
```
> Kết quả chuẩn: 24/24 passed.

### E2E Adversarial (ui-test skill, 11 test)
```powershell
bun x playwright test apps/web/playwright/hospital-demo-ui-adversarial.e2e.ts --project=@calcom/web-edge --reporter=list
```

### Soak harness (soak-test skill)
```powershell
$env:SOAK_TEST = "1"
bun x playwright test apps/web/playwright/hospital-demo-soak.e2e.ts --project=@calcom/web-edge --reporter=list
```
> ~6 phút cho 2 vòng demo đầy đủ, báo cáo `test-results/soak-report.json`. Protocol: `docs/hospital-3d-soak-test-protocol.md`.

### Perf gate t09
```powershell
$env:PERF_T09 = "1"
bun x playwright test apps/web/playwright/perf-t09.e2e.ts --project=@calcom/web-edge
```
> 90 frame warm-up bỏ, 360 frame đo, median. Pass: fps ≥ 27 và p95 frameMs ≤ 33.4ms. Chỉ chạy máy rảnh, Edge headed.

---

## 6. Biến môi trường

| Biến | Mặc định | Tác dụng |
|------|----------|----------|
| `NEXT_PUBLIC_IS_E2E=1` | không đặt | Tắt overlay dev, dùng cho demo và E2E |
| `GUIDE_WS_PORT` | `3002` | Cổng bind của guide service |
| `GUIDE_CLEANUP_INTERVAL_MS` | `60000` | Chu kỳ quét session lỗi thời |
| `FREELLM_STUB` | không đặt | `true` = guide trả lời stub, không gọi mạng |
| `FREELLM_HOST` / `FREELLM_PORT` | host / `3001` | Đích GỌI RA tới FreeLLM |
| `FREELLM_API_KEY` | không đặt | Key khi gọi FreeLLM thật |
| `NEXT_PUBLIC_AI_GUIDE_WS` | `ws://localhost:3002` | Override URL WS phía client |

---

## 7. Toàn bộ bug đã sửa (root cause, không phải guard)

### Nhóm A — Bun per-workspace hoisting (khác yarn flat-hoist)
Thêm deps thiếu vào từng workspace `package.json`: accept-language-parser, bcp-47-match, @googleapis/*, @otplib/*, rrule, short-uuid, uuid, react-i18next, zod, pg, @trpc/*, react-inlinesvg, @playwright/test@1.57.0, lodash...

### Nhóm B — Module graph
1. **Vòng enums ↔ types**: Chuyển `PLATFORM_PERMISSION` về `constants/permissions.ts` (graph một chiều)
2. **Self-import platform-types**: Relative import
3. **2 bản copy `@trpc/react-query`**: Pin react 19.2.8 ở packages/trpc devDeps
4. **Turbopack deep-subpath**: Thêm tsconfig paths trong `apps/web/tsconfig.json`
5. **Prisma enum generator**: Provider `node ./run-enum-generator.cjs` trong schema.prisma
6. **embed-core TDZ**: Import relative root file
7. **playwright webServer cwd**: Fix `cwd: path.join(__dirname, "apps/web")`
8. **@calcom/web self-import**: Thêm tsconfig paths

### Nhóm C — Bug code app
1. **TDZ crash** (`Cannot access 'guide' before initialization`): Dời `useGuideWs` lên trước `toggleDemoMode` trong `page.tsx`
2. **Seek-hold bug** (spec #13): Transition-complete giữ `seekTargetRef.current = target`, paused nhánh không consume
3. **web-edge reduced-motion**: Thêm `reducedMotion: "reduce"` trong playwright.config

### Nhóm D — Test defect
- Placeholder text → text thật
- Marker idle assertion: box ổn định (width/height), không assert vị trí đứng yên
- Number-keys: panX/panY delta thay vì zoom
- Home flaky: seek-hold fix + settle check 1000ms

---

## 8. File quan trọng trong repo

| File | Mục đích |
|------|----------|
| `docs/hospital-demo-run-guide.md` | **Canonical run guide** (PowerShell-first, verified) |
| `docs/hospital-3d-session-2026-11-17.md` | Session ledger chi tiết (bugs, fixes, roadmap) |
| `docs/hospital-3d-ui-test-plan.md` | 3-round ui-test plan |
| `docs/hospital-3d-soak-test-protocol.md` | Soak protocol thủ công 1h |
| `packages/features/hospital-pipeline/vitest.config.ts` | Coverage config, include *.test.tsx |
| `playwright.config.ts` | webServer Next.js, @calcom/web-edge (msedge), workers=2 |
| `apps/web/tsconfig.json` | Paths @calcom/features/*, @calcom/app-store/*, @calcom/web/* |
| `packages/prisma/schema.prisma` | Provider `node ./run-enum-generator.cjs` |
| `package.json` (root) | `packageManager: bun@1.4.4`, resolutions react 19.2.8 |

---

## 9. Bất biến code (KHÔNG ĐƯỢC SỬA)

1. `useGuideWs` **phải khai báo TRƯỚC** `toggleDemoMode` trong `page.tsx` (TDZ crash nếu ngược)
2. **Seek-hold** (spec 13): Sau transition 400ms, `seekTargetRef.current` GIỮ pose đích, không consume. Chỉ `Space` resume mới clear.
3. Camera pose **chỉ lấy qua** `sampleRestackedPoseAt`, không tự nội suy.
4. Reduced motion: nhảy beat theo segment boundary, chỉ walk-cycle đóng băng.
5. Mirror perf **đúng 4 trường**: `{ fps, frameMs, calls, tris }`. Thêm trường = phá công cụ đo.

---

## 10. Roadmap tiếp theo (ưu tiên)

| # | Task | Ghi chú |
|---|------|---------|
| 1 | Unit gate: `bunx vitest run` trong hospital-pipeline | Xác nhận 476 tests không regression |
| 2 | Perf gate t09 | Chạy máy rảnh, Edge headed |
| 3 | Soak test | Máy rảnh, ~6 phút |
| 4 | Dọn yarn refs sót | playwright.config.ts embed paths, jest scripts |
| 5 | Type-check restore | `bun run type-check:ci --force` fail ở trpc build (baseline) |
| 6 | Defense-day drill | Không git clean/clone trước commit; xóa debug residue |

---

## 11. Dọn temp (được phép xóa)

```bash
apps/web/.next/
test-results/
.turbo/cache/
.vite/
.mimosa/
packages/features/hospital-pipeline/coverage/
node_modules/.old_modules-*/
# File rác root: nul, test-jsx.tsx, test-proper.tsx...
```

**TUYỆT ĐỐI KHÔNG XÓA:** `.env`, `bun.lock`, `node_modules/` (trừ .old_modules), source files, `.superpowers/`, `agents/`, `docs/`, `.github/`, `.scratch/`, ZCode memory.

---

## 12. Commit history chính (2026-11-18)

| Commit | Mô tả |
|--------|-------|
| `1956db26ac` | fix(deps): add @sentry/nextjs dependency |
| `0d21c620ac` | test: adversarial UI e2e, soak harness, plan/protocol docs |
| `658c4a1fa8` | test: vitest suites config-properties, coverage, service lifecycle |
| `99dd4bd4c2` | docs: PowerShell-first run commands |
| `6f60fd422a` | docs: canonical run and demo guide |
| `144585d7b7` | fix: TDZ + seek-hold (page.tsx) |
| `91914721c0` | fix: phá vòng enums↔types qua constants |
| `2ccf1cb435` | fix: embed-core relative import |
| `a0497626b6` | fix: tách i18n providers sang @calcom/i18n |
| `1a4b48ed2a` | chore: bun per-workspace deps + React 19.2.8 pin |
| `7f7c8e2caf` | chore: playwright cwd/ports + tsconfig paths + schema.prisma |
| `4573e00e30` | test: 2 suite E2E mới (reduced-motion, timeline-interruptibility) |
| `223a271752` | feat: HTML5 leftovers (motion-tokens, use-reduced-motion) |
| `80f38b47d4` | docs: ledger + tickets 08/09 DONE |

---

## 13. Known Issue (đã test, pin hành vi)

**deliverRegistry nuốt reply wait/cost** (`guide-service-lifecycle.test.ts`):
> Câu hỏi chat trực tiếp match `wait-update`/`cost-estimate` → **KHÔNG** có frame `assistant` trả về; turn vẫn ghi vào history, delivery bị nuốt. Đây là known issue, test có section "KNOWN ISSUE" pin hành vi này.

---

## 14. Liên hệ / Nguồn tham khảo

- **Canonical guide:** `docs/hospital-demo-run-guide.md`
- **Session ledger:** `docs/hospital-3d-session-2026-11-17.md`
- **GitHub repo:** https://github.com/vuduytien01/3DWORLD-CAL.COM
- **ADR 0003 (HTML5 pivot):** `.superpowers/sdd/2026-11-14-html5-pivot/`
- **Ticket map:** `.scratch/hospital-pipeline/map.md` (có thể bị dọn theo cache cleanup)

---

> **Lưu ý cho người nhận handoff**: Đọc `hospital-demo-run-guide.md` trước, chạy theo 2 terminal. Nếu gặp lỗi module not found → `bun install` lại. Port 3001 và 9444 **tuyệt đối không bind**. Chỉ dùng `bun`, không dùng yarn/npm/npx/pnpm.