# Hướng dẫn chạy và demo Hospital 3D (ADR 0003)

Tài liệu chuẩn duy nhất để chạy, trình diễn và bàn giao trang demo 3D bệnh viện.
Mọi câu lệnh và con số dưới đây đối chiếu với code tại commit hiện tại trên main.
Cập nhật lần cuối: 2026-11-18. Nguồn lịch sử phiên làm việc:
[docs/hospital-3d-session-2026-11-17.md](./hospital-3d-session-2026-11-17.md).

Trang demo là `apps/web/app/hospital-demo/page.tsx`, không cần database, không cần
đăng nhập. Sản phẩm gồm hai tiến trình: web app Next.js ở cổng 3000 và Guide
Service WebSocket ở cổng 3002.

## Bản đồ cổng

| Cổng | Dùng cho | Ghi chú |
| --- | --- | --- |
| 3000 | Web app Next.js (`/hospital-demo`) | Bắt buộc cho demo và E2E |
| 3002 | Guide Service WebSocket | Trang tự kết nối `ws://localhost:3002` |
| 3001 | FreeLLM gateway | **Chỉ là đích GỌI RA từ guide service. TUYỆT ĐỐI KHÔNG BIND.** |
| 9444 | Dùng bởi tiến trình khác trên máy | **TUYỆT ĐỐI KHÔNG BIND** |
| 3003 | Hospital mock server (chỉ E2E) | Playwright tự nâng, `reuseExistingServer` |
| 3100, 3101 | Embed dev server | Không thuộc đường hospital |

Quy tắc công cụ: chỉ dùng bun (và vlt, deno khi phù hợp). Cấm yarn, npm, npx,
pnpm trong mọi lệnh của repo này.

## Chạy sản phẩm

Mở hai cửa sổ PowerShell. Cú pháp trong guide này là cú pháp PowerShell:
biến môi trường đặt bằng `$env:`, mỗi lệnh một dòng. KHÔNG dán cú pháp Git Bash
(`VAR=1 lệnh`, `&` cuối lệnh, `/tmp`) vào PowerShell, nó không chạy.

Terminal 1, web app:

```powershell
cd D:\cal.diy\apps\web
$env:NEXT_PUBLIC_IS_E2E = "1"
bun run dev -p 3000
```

Chạy foreground và giữ cửa sổ mở, Ctrl+C để dừng. Sau khi lệnh vào, server cần
khoảng 40 giây trước khi nhận request đầu (turbo copy-static mất ~11 giây rồi
Next mới boot). Đã đo: request đầu tới `/hospital-demo` trả HTTP 200 tại poll
thứ 4, mỗi poll cách nhau 10 giây.

Terminal 2, Guide Service:

```powershell
cd D:\cal.diy\packages\features\hospital-pipeline
$env:FREELLM_STUB = "true"
bun run guide-server
```

Dòng log chuẩn: `[WS] Guide service listening on ws://localhost:3002`.
`FREELLM_STUB=true` cho guide trả lời stub cục bộ, không gọi mạng. Nếu máy đã
chạy FreeLLM thật trên 3001 thì bỏ biến này và đặt `FREELLM_API_KEY`.

Chạy nền nếu muốn giữ log trong cửa sổ:

```powershell
Start-Job -Name guide -ScriptBlock { Set-Location D:\cal.diy\packages\features\hospital-pipeline; $env:FREELLM_STUB = "true"; bun run guide-server }
Receive-Job guide -Keep
Stop-Job guide; Remove-Job guide
```

Job sống trong cửa sổ PowerShell tạo nó, đóng cửa sổ là job chết.

Chạy bằng Docker cũng được: `docker compose up guide` từ thư mục gốc.
File `docker-compose.yml` định nghĩa service `guide` (image `oven/bun:1`, mount
cả repo, cổng 3002, `FREELLM_STUB=true`, healthcheck ping WebSocket).

Nếu làm việc trong Git Bash thay vì PowerShell, lệnh tương ứng:

```bash
cd /d/cal.diy/apps/web && NEXT_PUBLIC_IS_E2E=1 bun run dev -p 3000 &
cd /d/cal.diy/packages/features/hospital-pipeline && FREELLM_STUB=true bun run guide-server &
```

### Kiểm tra đã sống

Mở `http://localhost:3000/hospital-demo`. Các dấu hiệu đúng:

- Badge góc trái trên: `DEMO (F: Free Cam)`
- Nút góc phải trên: `🚀 Quick Tour (30s)` hoặc `🎬 Full Demo (180s)`
- Dải 8 chip bước giữa trên, badge tầng dưới phải
- Canvas isometric dollhouse với marker bệnh nhân đang đi
- Panel chat trạng thái kết nối; server log in
  `[WS] Session created: hospital-demo-chat (...)`
- DevTools: phần tử stage có `[data-hospital-ready="true"]` (đặt true sau lần
  vẽ đầu)

Nếu guide chưa chạy, trang hiện
`AI Guide chưa kết nối — chạy Guide Service (ws://localhost:3002)` và tự
reconnect khi server lên.

## Điều khiển demo

Phím chỉ ăn khi focus ở body, không phải ô chat.

| Phím | Hành động |
| --- | --- |
| `Space` | Tạm dừng hoặc tiếp tục demo clock |
| `←` `→` | Tua lùi hoặc tiến 5 giây |
| `Home` | Về đầu demo |
| `End` | Nhảy tới cuối demo |
| `1` đến `9` | Nhảy tới bước pipeline thứ N trong timeline |
| `F` | Đổi camera demo ↔ free cam |
| `Enter` (trong ô chat) | Gửi câu hỏi cho AI Guide |

Free cam: `W` `A` `S` `D` di chuyển, `Q` `E` lên xuống, mũi tên lên xuống chỉnh
pitch, mũi tên trái phải chỉnh yaw.

## Tham số URL

| Tham số | Tác dụng |
| --- | --- |
| `?t=<giây>` | Seed demo clock vào giây chỉ định, giới hạn 0..180. Ví dụ `?t=170` đứng ngay pose aerial outro, `?t=44` là floor hop |
| `?session=<tên>` | Tách session guide riêng (E2E dùng để tránh ghi đè trạng thái giữa các worker) |

## Hai chế độ trình diễn

Nút góc phải trên đổi giữa Quick Tour 30 giây và Full Demo 180 giây
(`DEMO_DURATION_S = 180` trong `lib/demo/camera-choreography.ts`). Timeline full
gồm 8 bước pipeline: ticket, queue, consultation, và tiếp tới payment.

Reduced motion: trang đọc `prefers-reduced-motion` của hệ điều hành. Khi bật,
demo clock nhảy theo beat thay vì trượt mượt, walk-cycle của marker đóng băng,
toast hiện tức thời. Dự án E2E `@calcom/web-edge` giả lập chế độ này qua
`reducedMotion: "reduce"` trong `playwright.config.ts`.

## Kịch bản demo 5 phút (defense day)

1. Mở trang với Full Demo, để intro chạy khoảng 30 giây. Camera hạ từ aerial vào
   sảnh tầng 0.
2. Hỏi guide 2 câu trong panel chat, ví dụ "Phòng khám nội ở tầng nào?" và
   "Thời gian chờ hiện tại bao lâu?". Guide trả lời tiếng Việt, chỉ về đường,
   chờ và thủ tục, từ chối câu hỏi y khoa.
3. `Space` dừng, bấm `1` rồi `4` nhảy giữa các bước, chứng minh timeline
   interruptible. `Home` về đầu, đợi 1 giây để settle.
4. Bấm `F` sang free cam, bay bằng WASD xem tầng 1, bấm `F` quay lại demo.
5. Kết thúc bằng `?t=170` trên thanh URL để đứng ở pose aerial toàn cảnh.

Nếu phòng trình chiếu yếu GPU, nói trước reduced motion như một tính năng
accessibility, không phải lỗi.

## Chạy kiểm thử

Unit gate, chạy trong package pipeline (đường dẫn tuyệt đối, an toàn từ bất kỳ
thư mục nào):

```powershell
cd D:\cal.diy\packages\features\hospital-pipeline
bun run test
```

Lần chạy đầy đủ gần nhất 2026-11-14: toàn bộ pass. Sau bất kỳ sửa nào vào
`page.tsx` hoặc `lib/`, chạy lại và so số test với lần trước, không được mất.
`bun run test` chạy luôn 6 suite bổ sung viết 2026-11-18: config-properties
(ràng buộc biến môi trường GUIDE_WS_PORT / GUIDE_CLEANUP_INTERVAL_MS /
FREELLM_* và giới hạn payload 1009), motion-tokens (easing + token khoá),
world-spec (bất biến dữ liệu STEPS/KHOA/SIGN_HOSTS), guide-service-lifecycle
(vòng đời hội thoại qua ws thật + KNOWN ISSUE deliverRegistry nuốt reply
wait/cost), use-reduced-motion và html5-floor-renderer (2 file này tự bật jsdom
qua pragma, không cần cấu hình thêm).

Coverage gate: `bun run test:coverage` (reporter text + json-summary + lcov,
provider v8, `@vitest/coverage-v8` đã là devDep). Ngưỡng 80% dòng được để
comment trong `vitest.config.ts`: bật sau lần chạy đầu để khớp mức hiện tại,
rồi giữ bật cho mọi thay đổi sau.

E2E gate trên Edge. Cần web app ở cổng 3000 đang chạy từ bước trước (biến
`NEXT_PUBLIC_IS_E2E` đã đặt trên tiến trình server, phía playwright không cần
đặt lại); Playwright tự nâng guide 3002 và mock 3003, và tái dùng server có sẵn.
Chạy trong PowerShell, một dòng lệnh:

```powershell
bun x playwright test apps/web/playwright/hospital-demo-reduced-motion.e2e.ts apps/web/playwright/hospital-demo-timeline-interruptibility.e2e.ts apps/web/playwright/hospital-demo.e2e.ts apps/web/playwright/hospital-demo-guide.e2e.ts apps/web/playwright/hospital-demo-mobile.e2e.ts --project=@calcom/web-edge --workers=2 --reporter=list
```

Kết quả chuẩn: 24/24 passed (reduced-motion 6, timeline-interruptibility 6,
demo + guide + mobile 12). Project `@calcom/web-edge` dùng channel `msedge`,
cần Edge đã cài trên máy.

E2E đối kháng (ui-test skill, 11 test: seek storm, toggle nhanh, chat rỗng /
500 ký tự / XSS, a11y, mobile overflow). Chạy riêng vì cần guide thật:

```powershell
bun x playwright test apps/web/playwright/hospital-demo-ui-adversarial.e2e.ts --project=@calcom/web-edge --reporter=list
```

Soak harness (soak-test skill): mặc định không chạy, bật bằng biến `SOAK_TEST`
như mẫu PERF_T09. Chạy trên máy rảnh, ~6 phút cho 2 vòng demo đầy đủ; báo cáo
ghi vào `test-results/soak-report.json`. Chi tiết và protocol thủ công 1h nằm
ở `docs/hospital-3d-soak-test-protocol.md`:

```powershell
$env:SOAK_TEST = "1"
bun x playwright test apps/web/playwright/hospital-demo-soak.e2e.ts --project=@calcom/web-edge --reporter=list
```

Perf gate t09, chỉ đo trên máy rảnh, Edge headed, không chạy build song song
cùng lúc (số đo cạnh compile là nhiễu). File test tự đọc biến `PERF_T09`, đặt
trước khi chạy:

```powershell
$env:PERF_T09 = "1"
bun x playwright test apps/web/playwright/perf-t09.e2e.ts --project=@calcom/web-edge
```

Phương pháp và ngưỡng nằm trong header của `perf-t09.e2e.ts`: 90 frame warm-up
bị bỏ, 360 frame đo, lấy median. Ngưỡng pass: fps >= 27 và p95 frameMs <= 33.4
ms. Số liệu chảy qua `window.__HOSPITAL_PERF__` với dạng
`{ fps, frameMs, calls, tris }`, KHÔNG có trường `frames`; calls và tris nghĩa
là số box vẽ và số node overlay. Lưu ý nhỏ: header file này còn ghi lệnh `npx`,
đã nằm trong danh sách dọn yarn-ref còn sót.

## Biến môi trường

| Biến | Giá trị mặc định | Tác dụng |
| --- | --- | --- |
| `NEXT_PUBLIC_IS_E2E=1` | không đặt | Tắt overlay dev, dùng cho demo và E2E |
| `GUIDE_WS_PORT` | `3002` | Cổng bind của guide service |
| `GUIDE_CLEANUP_INTERVAL_MS` | `60000` | Chu kỳ quét session lỗi thời |
| `FREELLM_STUB` | không đặt | `true` = guide trả lời stub, không gọi mạng |
| `FREELLM_HOST` / `FREELLM_PORT` | host / `3001` | Đích GỌI RA tới FreeLLM, không phải cổng bind |
| `FREELLM_API_KEY` | không đặt | Key gửi kèm khi gọi FreeLLM thật |
| `NEXT_PUBLIC_AI_GUIDE_WS` | `ws://localhost:3002` | Override URL WebSocket phía client |

## Tuyệt đối không

- Không dùng yarn, npm, npx, pnpm. Chỉ bun (và vlt, deno khi phù hợp).
- Không bind cổng 3001 và 9444. 3001 chỉ tồn tại như đích gọi ra của guide
  service; `FREELLM_STUB=true` thì không chạm mạng nào.
- Không commit `.env`, `.env.appStore`, không sửa `*.generated.ts` tay.
- Không `git clean`, không clone đè thư mục đang có commit chưa đẩy.

## Xử lý sự cố

| Hiện tượng | Nguyên nhân và cách xử lý |
| --- | --- |
| `The term 'NEXT_PUBLIC_IS_E2E=1' is not recognized` | Đã dán cú pháp Git Bash vào PowerShell. Đặt `$env:TEN_BIEN = "1"` ở một dòng rồi chạy lệnh ở dòng kế tiếp |
| `Cannot find path 'D:\cal.diy\apps\web\packages\...'` | Đã `cd` tương đối từ nhầm thư mục. Dùng đường dẫn tuyệt đối `D:\cal.diy\...` đúng như guide |
| Có Job nền "Running" nhưng không server nào sống | Job tạo bằng `&` cuối lệnh giữ được một lệnh sai cú pháp. Dọn: `Get-Job \| Stop-Job; Get-Job \| Remove-Job`, rồi chạy lại foreground theo guide |
| Cổng 3000 hoặc 3002 bị tiến trình cũ chiếm | `Get-NetTCPConnection -LocalPort 3000 \| Select-Object OwningProcess` để tìm PID, rồi `Stop-Process -Id <pid>` |
| Dev server chết giữa chừng | Trong Git Bash đã pipe qua `head`. Chạy lại, redirect ra file log |
| Chat báo chưa kết nối | Guide service chưa chạy trên 3002. Chạy terminal 2, trang tự reconnect. Đổi cổng thì đặt `NEXT_PUBLIC_AI_GUIDE_WS` |
| Chat trả lời lỗi khi gửi câu | Guide chạy nhưng không có `FREELLM_STUB=true` và FreeLLM 3001 không phản hồi. Thêm biến stub hoặc bật FreeLLM |
| Trang trắng hoặc không ready | Xem terminal 1 có lỗi compile. Sau khi sửa, đợi `[data-hospital-ready="true"]`. Lần đầu server cần ~40 giây |
| Sau `bun install` trang Compile lỗi lạ | Restart mọi dev server đang chạy. Bun linker isolated thay cả cây node_modules, tiến trình cũ giữ module cũ |
| E2E fail ngay không mở được trang | Web app chưa chạy trên 3000, hoặc Edge chưa cài (channel `msedge`) |
| Biome trong pre-commit báo lỗi platform binary | Kiểm tra không còn file `.pnp.cjs`, `.yarn/` sót trong repo; `packageManager` trong root `package.json` phải là `bun@1.4.4` |
| Prisma generate lỗi enum | Provider đúng là `node ./run-enum-generator.cjs` trong `packages/prisma/schema.prisma` |

## Bản đồ code cho maintainer

```
apps/web/app/hospital-demo/page.tsx        # trang demo: tick loop, camera, HUD, chat, keyboard
packages/features/hospital-pipeline/
  lib/html5-world/                          # renderer HTML5 isometric (ADR 0003)
    html5-floor-renderer.tsx                # 2 canvas + overlay DOM, __HOSPITAL_PERF__, data-hospital-ready
    camera-adapter.ts  patient-walk.ts  patient-rig.ts
    motion-tokens.ts  use-reduced-motion.ts  floor-plan.ts  world-to-screen.ts
  lib/demo/
    camera-choreography.ts                  # DEMO_DURATION_S = 180, sampleRestackedPoseAt
    demo-timeline.ts  demo-script.ts  wait-simulation.ts
  lib/ai-guide/
    ws-entry.ts                             # transport `ws`, cổng 3002, Pattern B standalone
    server.ts                               # protocol init/user/ping/health, heartbeat, close
    llm-router.ts                           # SYSTEM_PROMPT tiếng Việt, FreeLLM hoặc stub
    use-guide-ws.ts                         # client hook: backoff reconnect + heartbeat
    session.ts                              # session map + dọn lỗi thời
  lib/step-graph/                           # nguồn thật vị trí bước, phòng, sign hosts
  lib/3d-world/                             # world-spec, khoa-slice, character-poses
  lib/data/                                 # dữ liệu bệnh viện
```

Luồng dữ liệu một frame: `page.tsx` tick theo wall-clock seed (hoặc `?t=`,
hoặc seek của phím) lấy pose qua `sampleRestackedPoseAt`, đưa vào
`html5-floor-renderer`; renderer vẽ static canvas, dynamic canvas và overlay
DOM; layer `patient-walk` đặt marker bệnh nhân theo segment hiện tại.

Luồng chat một câu hỏi: client `use-guide-ws` gửi frame `user` qua 3002,
`server.ts` nhận, `llm-router` trả lời từ FreeLLM hoặc stub, frame `assistant`
trả về và vào message list.

Bất biến cần giữ khi sửa code:

1. `useGuideWs` phải được khai báo TRƯỚC `toggleDemoMode` trong `page.tsx`.
   Dependency array của `useCallback` đánh giá ngay lúc render, khai báo sau là
   TDZ crash `Cannot access 'guide' before initialization`.
2. Seek-hold (spec 13): sau transition seek 400ms hoàn tất và `isPaused`,
   `seekTargetRef.current` phải GIỮ pose đích, không consume. Chỉ `Space`
   resume mới clear. Xóa nhánh này là camera bay ngược về seed cũ.
3. Camera pose chỉ lấy qua `sampleRestackedPoseAt`, không tự nội suy.
4. Reduced motion nhảy beat theo segment boundary, chỉ walk-cycle đóng băng.
   Test assert marker box ổn định, không assert vị trí đứng yên.
5. Mirror perf có đúng 4 trường `{ fps, frameMs, calls, tris }`. Thêm trường
   là phá công cụ đo.

Tài liệu nền: ledger phiên 2026-11-17 trong `docs/`, pivot HTML5 tại
`.superpowers/sdd/2026-11-14-html5-pivot/`, map ticket tại
`.scratch/hospital-pipeline/map.md` (có thể bị dọn theo cache cleanup).

---

## Handoff cho team mới

Xem **[HOSPITAL-3D-HANDOFF.md](./HOSPITAL-3D-HANDOFF.md)** — tóm tắt toàn bộ build, test, fix, config, roadmap, known issues, commit history để người mới clone về làm tiếp ngay.
