# Hospital Pipeline Capstone — Glossary

Ngôn ngữ dùng chung cho dự án đồ án: hệ thống đặt lịch khám + pipeline khám bệnh + AI hướng dẫn + mô phỏng 3D bệnh viện. Định nghĩa ghi tại đây khi thuật ngữ được chốt trong session grilling. (Sẽ chuyển sang repo gốc của dự án khi scaffold.)

## Language

**Step Graph (Đồ thị pipeline)**:
Định nghĩa dạng dữ liệu về pipeline khám của một bệnh viện: các bước là đỉnh, điều kiện rẽ nhánh là cạnh. Một engine duy nhất đọc Step Graph để điều khiển vé, AI guide và 3D.
_Avoid_: workflow, quy trình cứng, flowchart

**Step (Bước)**:
Một đỉnh trong Step Graph. Các loại: TICKET, QUEUE, CONSULTATION, LAB, RE_CONSULT, CONCLUSION, ADMISSION, PAYMENT.
_Avoid_: stage, phase

**STT (Số thứ tự)**:
Số vé xếp hàng của bệnh nhân, cấp theo ngày theo từng bệnh viện.
_Avoid_: ticket number, queue ID

**Wait Estimate (Ước lượng chờ)**:
Con số dự đoán thời gian chờ ở một bước, từ mô hình chờ cấu hình sẵn và được hiệu chỉnh bằng thời gian thực tế quan sát được.
_Avoid_: ETA, thời gian còn lại

**AI Guide (Hướng dẫn viên AI)**:
Trợ lý hội thoại trả lời bệnh nhân bằng tiếng Việt về điều hướng hành chính (đi đâu, đợi bao lâu, chi phí, thanh toán). Không bao giờ tư vấn y khoa.
_Avoid_: chatbot bác sĩ, trợ lý ảo y tế

**Guide Service**:
Dịch vụ phía server duy nhất trả lời mọi tin nhắn của AI Guide, phục vụ nhiều người dùng cùng lúc. Tin nhắn chủ động đi theo template-first, chỉ câu hỏi tự do mới gọi LLM. Chat trên frontend chỉ là bề mặt hiển thị.
_Avoid_: chatbot riêng từng user, gọi LLM trực tiếp từ trình duyệt

**2D Timeline (Tiến trình 2D)**:
Khung hiển thị tiến trình vé dạng danh sách/các bước với trạng thái và ước lượng chờ.
_Avoid_: progress bar

**3D Simulation (Mô phỏng 3D)**:
Biểu diễn thời gian thực, đầy đủ chi tiết của bệnh viện (nội thất, nhân vật, hoạt ảnh) theo quyết định của founder ngày 2026-11-06: bắt buộc có trong demo bảo vệ. Bao quát cả xem tổng thể lẫn nhìn trong phòng. **Cập nhật ADR 0003 (2026-11-14):** mục tiêu trải nghiệm giữ nguyên nhưng bề mặt thi công đổi — renderer Canvas 2D isometric (oblique cố định, hai lớp canvas tĩnh/động) + DOM overlay, không còn mesh three.js/WebGL; "xem tổng thể" = dollhouse đa tầng zoom-out, "nhìn trong phòng" = focusFloor zoom-in. Thuật ngữ mesh (tris đếm thật, PBR, bone skinning) chỉ còn giá trị lịch sử ở design lượt 1-6.
_Avoid_: "bản đồ isometric" dùng như từ đồng nghĩa (isometric là một kiểu view nhẹ hơn, không phải Mô phỏng 3D đầy đủ); "walkthrough" dùng lơ lửng không nói rõ mức tương tác; nói demo "3D WebGL/three.js" khi trình bày bảo vệ

**Ward (Buồng nội trú)**:
Kind phòng nội trú trong `KhoaRoomKind`: giường bệnh + tủ đầu giường + treo dịch truyền, preset dựng trong `packages/features/hospital-pipeline/lib/3d-world/khoa-slice.ts:37,551`; dữ liệu tầng 4-10 dùng thật ở `packages/features/hospital-pipeline/lib/data/khoa-upper-floors.ts:99`. Bổ sung theo TCVN 4470:2012 vì spec 03 ban đầu thiếu kind "phòng bệnh" (swarm/research/06).
_Avoid_: phòng bệnh (kind chính tắc là `ward`), dùng kind `exam` làm mồi cho buồng nội trú

**Nurse station (Trạm điều dưỡng)**:
Kind phòng trạm điều dưỡng của khoa nội trú: counter + màn hình, preset trong `packages/features/hospital-pipeline/lib/3d-world/khoa-slice.ts:38,601`. Mỗi khoa có ít nhất một trạm (dữ liệu thật ở `packages/features/hospital-pipeline/lib/data/khoa-upper-floors.ts:124`, test ép điều kiện này ở `lib/data/__tests__/khoa-upper-floors.test.ts:76-86`, theo TCVN 4470:2012 — swarm/research/06).
_Avoid_: quầy y tế, reception

**__HOSPITAL_CAMERA__ / __ORBIT_CONTROLS_ENABLED__ / __HOSPITAL_PERF__ (Seam E2E HTML5)**:
Bộ mirror window của renderer HTML5 thay thế `canvas[data-engine^="three"]` + `__HOSPITAL_DOLLHOUSE__`/`__HOSPITAL_FLOOR_GROUPS__` (chết sau Task 5 cùng Hospital3DScene.tsx). Set mỗi frame tại `packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer.tsx:432-448`, delete trong cleanup tại `:526-528`: `__HOSPITAL_CAMERA__ = { panX, panY, zoom, focusFloor }` (map từ CameraPose qua camera-adapter), `__ORBIT_CONTROLS_ENABLED__` giữ tên engine-agnostic, `__HOSPITAL_PERF__ = { fps, frameMs, calls = số box vẽ, tris = số node overlay }` — KHÔNG có field `frames` (Task 6 adjudication D). DOM seams cùng file: `[data-hospital-ready]` (`:537` init "false", `:507-518` markReady sau first paint + fonts.ready), `[data-floor]` `:323`, `[data-step]` `:330`, `[data-room]` `:341`, `[data-patient]` `:251`. E2E Edge-only `--project=@calcom/web-edge`.
_Avoid_: assert field `frames`, pixel baseline (đã xoá theo Ruling A), heuristic tris, data-testid gắn lên mesh WebGL

**ws-entry / guide-server (Entrypoint Guide Service :3002)**:
Entry chạy thật duy nhất của Guide Service: `packages/features/hospital-pipeline/lib/ai-guide/ws-entry.ts` wiring WebSocketServer thật với port từ env `GUIDE_WS_PORT` (mặc định 3002), tự khởi động qua `import.meta.main` và tắt sạch qua SIGINT/SIGTERM. Chạy một lệnh ngày bảo vệ bằng script `"guide-server"` trong `packages/features/hospital-pipeline/package.json:7` (`bun run lib/ai-guide/ws-entry.ts`); đây là nơi duy nhất gọi `startGuideService` với transport thật ngoài stub/test.
_Avoid_: mở Guide WS trên :3001 (chỉ dành cho FreeLLM gateway), hardcode port thay vì đọc `GUIDE_WS_PORT`

**FREELLM_STUB**:
Biến môi trường bật chế độ stub của llm-router: câu hỏi tự do trả theo template, không gọi FreeLLM gateway :3001; đọc MỘT LẦN lúc import module (`packages/features/hospital-pipeline/lib/ai-guide/llm-router.ts:32`). Là mặc định khuyến nghị cho ngày bảo vệ (template-first phủ 100% corpus — swarm/research/18), set sẵn trong vitest (`packages/features/hospital-pipeline/vitest.config.ts:10`) và trong webServer E2E chạy ws-entry (`playwright.config.ts:40-48`).
_Avoid_: bật LLM thật không có key (gateway trả 401 Invalid API key)

**FREEZE day (Ngày đóng băng demo)**:
Mốc chốt trước bảo vệ (khuyến nghị 48h) mà từ đó không thêm dependency, không đổi code, chỉ giữ bản chạy tốt đã đóng dấu (screenshot + git stash label). Chỉ định trong `.scratch/hospital-pipeline/demo-risk-plan.md:7,31`, thực thi qua ticket T-16 freeze + drill + video (`.scratch/hospital-pipeline/swarm/BOARD.md`).
_Avoid_: sửa "nhỏ" sau mốc freeze, freeze mà không đóng dấu bản chạy tốt

**HMR-flake (Kết quả E2E fail do HMR/hạ tầng dưới tải)**:
Phân loại kết quả E2E: fail do dev server HMR/turbopack rung khi nhiều agent compile song song (treo newContext/newPage) chứ không phải bug sản phẩm — sóng 3 chẩn đoán 3/14 test đều INFRA như vậy (swarm/LOG.md:48). Fail lặp deterministic trên server sạch, không tải thì KHÔNG phải flaky (`swarm/reports/e2e-smoke-wave3.md:29`, `swarm/reports/e2e-mobile-edge-wave4.md:34`); mock hermetic không đụng socket HMR :3000 là cách né (`apps/web/playwright/hospital-demo-guide.e2e.ts:65`).
_Avoid_: đổ cho bug sản phẩm trước khi phân loại INFRA vs thật
