# Hospital 3D — Session Ledger 2026-11-17 (Bun Migration + E2E Unblock + 3D World Live)

> Nguồn lưu trữ an toàn cho phiên làm việc 2026-11-17. File này nằm trong repo
> (`docs/`), KHÔNG nằm trong thư mục temp — an toàn khi tắt máy và dọn temp.
> Bản sao rút gọn cũng có trong ZCode memory (`cal-diy-use-bun-not-yarn.md`).

---

## 1. TRẠNG THÁI CUỐI CÙNG (đã đo, đã verify)

### Sản phẩm 3D world thật ĐANG CHẠY

- `/hospital-demo` trên **port 3000** trả HTTP 200
- `Html5FloorRenderer` mount thật: `data-hospital-ready="true"`, canvas HTML5
  isometric dollhouse, patient marker, step chips (ticket → payment), nhãn "Tầng 0"
- Guide Service WebSocket `ws://localhost:3002` kết nối, tạo session
  `hospital-demo-chat (Bệnh nhân demo, STT: 014)`
- **Port 3001 TUYỆT ĐỐI KHÔNG ĐỤNG** (chủ machine dùng cho FreeLLM) — web và
  web-edge baseURL trỏ 3000, guide WS 3002

### E2E xanh trên Edge (`@calcom/web-edge`, msedge, bun x playwright test)

| Suite | Kết quả |
| --- | --- |
| hospital-demo-reduced-motion.e2e.ts | 6/6 passed |
| hospital-demo-timeline-interruptibility.e2e.ts | 6/6 passed |
| hospital-demo.e2e.ts + hospital-demo-guide.e2e.ts + hospital-demo-mobile.e2e.ts | 12/12 passed |
| **Tổng** | **24/24 passed** |

Lệnh chạy lại:

```bash
# Terminal 1 (không pipe qua head — SIGPIPE giết server)
cd apps/web && NEXT_PUBLIC_IS_E2E=1 bun run dev -p 3000 > /tmp/nextdev.log 2>&1 &

# Terminal 2
NEXT_PUBLIC_IS_E2E=1 bun x playwright test apps/web/playwright/hospital-demo-reduced-motion.e2e.ts apps/web/playwright/hospital-demo-timeline-interruptibility.e2e.ts apps/web/playwright/hospital-demo.e2e.ts apps/web/playwright/hospital-demo-guide.e2e.ts apps/web/playwright/hospital-demo-mobile.e2e.ts --project=@calcom/web-edge --workers=2 --reporter=list
```

### Bun migration hoàn tất

- `bun install` green: cả 6 post-install turbo tasks pass (platform-constants,
  platform-types, platform-enums, platform-utils, app-store-cli, prisma)
- `bun run build` app-store-cli exit 0
- `packageManager: bun@1.2.15` (bun 1.4.4 cài trên máy), bun.lock là lockfile
  duy nhất (yarn.lock + .yarnrc.yml đã xóa khỏi working tree)
- Root resolutions: đã bỏ 5 entry yarn-patch (next-i18next, libphonenumber-js,
  dayjs ×3) — bun không hiểu protocol `patch:`

---

## 2. TOÀN BỘ BUG ĐÃ SỬ (root cause, không phải guard)

### Nhóm A — Bun per-workspace hoisting (khác yarn flat-hoist)

Bun chỉ link đúng `workspace:*` deps mà package khai báo; yarn hoist mọi thứ
lên root `node_modules/` che hết lỗi thiếu khai báo. Đã thêm deps:

- `packages/features`: accept-language-parser 1.5.0, bcp-47-match 2.0.3,
  @googleapis/calendar 9.7.9, @googleapis/oauth2 1.0.7, @otplib/{core,
  plugin-crypto, plugin-thirty-two} 12.0.1, googleapis-common 7.2.0,
  `dub-package: npm:dub@0.61.15`, rrule 2.7.1, short-uuid 4.2.0, uuid 8.3.2,
  `@calcom/prisma: workspace:*`, react 19 peer
- `packages/lib`: react-i18next 12.3.1, zod 3.25.76, @calcom/prisma ws,
  @otplib/* 12.0.1, short-uuid 4.2.0
- `packages/prisma`: pg 8.16.0 (index.ts import Pool)
- `packages/app-store`: @calcom/prisma ws, @googleapis/oauth2 1.0.7,
  @otplib/* 12.0.1, googleapis-common 7.2.0, rrule 2.7.1, short-uuid 4.2.0
- `apps/web`: @trpc/{client,react-query,server} 11.0.0-next-beta.222,
  react-inlinesvg 4.1.3
- `packages/types`: zod 3.25.76 (AppMetaSchema.ts)
- `packages/app-store-cli`: @calcom/types ws, lodash 4.18.1; spawnSync
  yarn→bun trong build.ts; execSync yarn→bun trong core.ts
- `packages/platform/*`: @calcom/tsconfig ws, @jest/types 29.6.3,
  @types/luxon 3.4.2; npx→bun x
- root devDeps: @calcom/lib ws, dotenv 16.4.5, **@playwright/test pin
  1.57.0** (bun add không pin version đã kéo 1.65.1 → 2 bản copy song song
  crash "Requiring @playwright/test second time")

### Nhóm B — Module graph

1. **Vòng phụ thuộc platform enums ↔ types**: chuyển
   `PLATFORM_PERMISSION` type về `packages/platform/constants/permissions.ts`
   (nơi `PERMISSIONS` const sống). Graph một chiều: constants → {enums,
   types} → utils. `types/permissions.ts` giờ re-export để giữ compat.
2. **Self-import platform-types**: `get-bookings.output.ts` → relative
   `../../../index`.
3. **2 bản copy `@trpc/react-query`** (hai store hash khác nhau = hai React
   Context = lỗi "Unable to find tRPC Context" trong WebPushProvider):
   web copy peer-resolve react@19.2.8, packages/trpc copy react@19.2.4 (stale
   lockfile). Fix: pin react + react-dom 19.2.8 làm devDeps của
   packages/trpc → cả hai link cùng một store hash.
4. **Turbopack không resolve deep-subpath self-reference**
   (`@calcom/features/auth/lib/identityProviders` v.v.): Node/Turbopack
   KHÔNG probe extension `.ts` qua exports wildcard map. Fix hiệu quả:
   **tsconfig paths trong apps/web** — `"@calcom/features/*":
   ["../../packages/features/*"]`, `"@calcom/app-store/*":
   ["../../packages/app-store/*"]`, `"@calcom/web/*": ["./*"]`.
   (Exports wildcard `"./*": "./*"` đã thêm vào features + app-store — vô hại
   nhưng không đủ.)
5. **Prisma enum generator trên bun/Windows**: provider là
   `node ./run-enum-generator.cjs` trong schema.prisma (bare name và
   relative .js/.cjs đều ENOENT).
6. **embed-core cycle TDZ** (`Cannot access 'embedStore' before
   initialization`): shim `src/embed-iframe-init.ts` (đã xóa) tạo vòng
   import. File thật nằm ở package root
   `packages/embeds/embed-core/embed-iframe-init.ts`; import đúng từ
   `src/sdk-event.ts` là relative `../embed-iframe-init`.
7. **playwright webServer spawn exit 1**: thiếu `cwd` — lệnh `bun run next
   dev` chạy ở repo root. Fix: `cwd: path.join(__dirname, "apps/web")`.
8. **@calcom/web thiếu @calcom/web/* path** cho self-import
   (`@calcom/web/components/...`) — đã thêm tsconfig paths.

### Nhóm C — Bug thật trong code app

1. **TDZ crash trang 3D** (`Cannot access 'guide' before initialization`,
   page.tsx:277): `toggleDemoMode` useCallback deps tham chiếu `guide`
   khai báo sau nó ~300 dòng (dependency array được đánh giá NGAY lúc
   render). Fix: dời `handleGuideMessage` + `const guide = useGuideWs(...)`
   lên trước `toggleDemoMode`.
2. **Seek không bám sau khi dừng** (bug engine spec #13): sau transition
   400ms hoàn tất, `isPaused=true` nhưng frame kế rơi vào nhánh
   "Paused: hold wallClockS" → elapsed quay về gốc seed cũ → camera bay về
   vị trí cũ (Home flaky floor 0→1). Fix trong page.tsx tick loop:
   transition-complete giữ `seekTargetRef.current = transition.to`, nhánh
   paused+target KHÔNG consume (bỏ `= null`) → paused frame bám target đến
   khi Space resume clear nó.
3. **web-edge thiếu emulate reduced-motion**: thêm `reducedMotion: "reduce"`
   vào use{} của project web-edge trong playwright.config.

### Nhóm D — Test defect (không phải bug app)

1. reduced-motion suite còn placeholder `[PERSON_NAME] quý thầy cô` → text
   thật "Xin chào quý thầy cô".
2. Test marker-idle mâu thuẫn chính spec #10 của nó (timeline clock vẫn chạy
   theo segment boundary dưới reduced motion, chỉ walk-cycle bị freeze) →
   đổi assertion: marker box ổn định (width/height), không assert vị trí
   đứng yên.
3. Number-keys assertion bằng zoom (zoom có thể trùng giữa các station) →
   đổi sang panX/panY delta assertion.
4. Home flaky do seek-hold bug nhóm C.2 — đã vá engine, thêm settle check
   1000ms + re-assert.

---

## 3. FILE ĐÃ THAY ĐỔI TRONG PHIÊN NÀY (chưa commit)

Code app:
- `apps/web/app/hospital-demo/page.tsx` — TDZ fix + seek-hold fix
- `packages/embeds/embed-core/src/sdk-event.ts` — relative import root init file
- `packages/platform/constants/permissions.ts` — thêm PLATFORM_PERMISSION type
- `packages/platform/enums/permissions.ts`, `packages/platform/utils/permissions.ts` — import từ constants
- `packages/platform/types/permissions.ts` — re-export
- `packages/platform/types/bookings/2024-08-13/outputs/get-bookings.output.ts` — bỏ self-import
- `packages/i18n/providers.tsx` (mới) + `packages/i18n/package.json` — export providers
- `apps/web/app/AppRouterI18nProvider.tsx`, `apps/web/app/CustomI18nProvider.tsx` — re-export từ i18n (phá cycle lib→web)
- `packages/lib/hooks/useLocale.ts` — import providers từ @calcom/i18n

Deps (package.json): packages/{features,lib,prisma,app-store,trpc,types,
app-store-cli,ui,coss-ui,embeds/embed-react,platform/constants,platform/enums,
platform/types,platform/utils,i18n}, apps/web, apps/docs,
packages/platform/examples/base, root.

Config:
- `playwright.config.ts` — webServer cwd fix, port 3000 cho web/web-edge,
  hospital-mock project (file mock đã xóa, project entry còn — có thể dọn),
  reducedMotion: "reduce" cho web-edge
- `apps/web/tsconfig.json` — paths @calcom/features/*, @calcom/app-store/*, @calcom/web/*
- `packages/embeds/embed-core/tsconfig.json` — đã revert về gốc
- `packages/prisma/schema.prisma` — provider `node ./run-enum-generator.cjs`
- `package.json` (root) — scripts bun, packageManager bun, resolutions bỏ
  yarn patches, @playwright/test 1.57.0, @calcom/lib + dotenv devDeps
- `.yarnrc.yml`, `yarn.lock`, `.yarn/releases` — đã xóa (bun.lock thay thế)

Test:
- `apps/web/playwright/hospital-demo-reduced-motion.e2e.ts` — text thật,
  marker box assertion
- `apps/web/playwright/hospital-demo-timeline-interruptibility.e2e.ts` —
  settle check Home, pan-delta number-keys
- Đã xóa artifact tạm: `hospital-demo-mock.html`, `hospital-demo.html`,
  `hospital-mock-server.js`, `hospital-server.js`, `verify-mock-server.js`,
  `simple-hospital-test.js`, `apps/web/playwright/hospital-demo-mock.e2e.ts`,
  `apps/web/playwright/debug-hospital.e2e.ts`

✅ **ĐÃ COMMIT (2026-11-18) — 10 commits trên main:**
- `144585d7b7 fix(hospital-demo)` — TDZ + seek-hold (kèm xoá yarn.lock + untrack .yarn/ vì đã staged trước đó)
- `91914721c0 fix(platform)` — phá vòng enums↔types qua constants
- `2ccf1cb435 fix(embed-core)` — import relative embed-iframe-init
- `a0497626b6 fix(i18n)` — tách providers sang @calcom/i18n
- `1a4b48ed2a chore(deps)` — bun per-workspace deps + bun.lock + packageManager bun@1.4.4 + React 19.2.8 / Next 16.4.6
- `7f7c8e2caf chore(config)` — playwright cwd/ports 3000+3002 + tsconfig paths + schema.prisma `node ./run-enum-generator.cjs` + .husky/lint-staged sang bun + scripts `bun --cwd`
- `4573e00e30 test(hospital-demo)` — 2 suite E2E mới (reduced-motion, timeline-interruptibility)
- `223a271752 feat(hospital-pipeline)` — HTML5 leftovers (motion-tokens, use-reduced-motion, hospital-3d-renderer, plans/)
- `80f38b47d4 docs(hospital-3d)` — ledger này + tickets 08/09 DONE
- `7ade835cf6 chore` — .gitignore (.mimosa/, nul, test-jsx*, test-proper*)

---

## 4. HƯỚNG TIẾP THEO (roadmap)

1. **Commit các thay đổi** (danh sách commit gợi ý ở mục 3) — ưu tiên cao
   nhất trước khi làm việc khác.
2. **Chạy unit gate**: `bunx vitest run` trong packages/features/hospital-pipeline
   để xác nhận 402/402 (hoặc 426) không regression sau các sửa page.tsx.
3. **Perf gate t09**: chạy `perf-t09.e2e.ts` để xác nhận ≥27fps / ≤33.4ms
   trên máy thật sau khi thêm reduced-motion emulate.
4. **Dọn nốt yarn refs còn sót**: playwright.config.ts embed paths
   (`yarn workspace @calcom/embed-core/react dev`, port 3100/3101 — không
   nằm trong đường test hospital); `packages/platform/enums` test script jest.
5. **Hospital-mock project entry** trong playwright.config.ts: file mock test
   đã xóa, entry project `@calcom/hospital-mock` còn sót — dọn khi làm dàn
   config.
6. **Type-check restore**: `bun run type-check:ci --force` vẫn fail ở trpc
   build (baseline đã biết); theo dõi sau khi deps ổn định.
7. **Defense-day drill** (từ ledger cũ 2026-11-14, vẫn còn hiệu lực):
   không `git clean`/clone trước khi commit F1; xóa debug residue trước
   freeze drill; Guide Service phải chạy trên ws://localhost:3002;
   `__HOSPITAL_PERF__={fps,frameMs,calls=box,tris=overlayNode}` (KHÔNG có
   frames); cameraPose qua `sampleRestackedPoseAt`.

### Kế hoạch từ ledger cũ (2026-11-14) còn mở

- Task 6 review + minor-fix batch code-side (1)-(4) → Task 7 final review
- Ledger `.superpowers/sdd/2026-11-14-html5-pivot/` vẫn là nguồn thật cho
  pivot HTML5 (ADR 0003 `56040bbffe`, các task commit đã liệt kê trong
  memory `hospital-3d-testing-status`)
- map.md tại `.scratch/hospital-pipeline/map.md` — lưu ý `.scratch` có thể
  bị dọn theo cache cleanup; các ticket 06-07 còn blocked

---

## 5. DỌN TEMP — ĐƯỢC PHÉP (sau khi đọc xong file này)

An toàn để xóa (regenerated hoặc rác):
- `apps/web/.next/` — build cache, regeneration tự động
- `test-results/` (root) — artifact playwright đã xem xong
- `.turbo/cache/`, `.vite/`, `.vite-temp/`
- `.mimosa/` (các thư mục .mimosa rải rác) — scan outputs
- `packages/features/hospital-pipeline/coverage/`
- `node_modules/.old_modules-*/` — rác bun install failed cũ (chiếm nhiều GB)
- Thư mục rác malformed ở root: `D:cal.diypackagesfeatureshospital-pipelinelib3d-world/`
- File rác root: `nul`, `test-jsx.tsx`, `test-jsx-tsconfig.json`,
  `test-proper.tsx`, `test-proper-tsconfig.json` (đã xác nhận là scratch test)
- Log tạm trong `%TEMP%`: `zcode-bash-*` logs, `/tmp/nextdev*.log`
- Bunx/npx caches trong `AppData\Local\Temp`

TUYỆT ĐỐI KHÔNG XÓA:
- `.env`, `.env.appStore` (credentials — chỉ đọc từ env)
- `bun.lock`
- `node_modules/` (trừ `.old_modules-*`)
- Toàn bộ file source đã sửa ở mục 3
- `.superpowers/`, `agents/`, `plans/`, `docs/`, `.github/`
- `.scratch/hospital-pipeline/` (issues + ledger cũ) — trừ khi đã chắc chắn
  cần bản sao
- Thư mục memory ZCode: `C:\Users\tien2004\.zcode\cli\memories\`
- Docker volumes/containers nếu đang dùng DB hospital demo
