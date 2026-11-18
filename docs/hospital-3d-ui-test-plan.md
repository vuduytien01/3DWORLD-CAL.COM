# Kế hoạch test UI Hospital 3D (ui-test skill)

Kế hoạch ba vòng của skill ui-test cho trang demo `/hospital-demo`, đã gộp
thành danh sách test đánh số. Một phần được code hoá thành Playwright chạy
được ngay (`apps/web/playwright/hospital-demo-ui-adversarial.e2e.ts`), phần
còn lại là hướng dẫn cho lần chạy agentic bằng `browse` khi anh/chị cho phép
chạy thật. Đối tượng: mọi câu lệnh tham chiếu commit hiện tại trên main.

## Vòng 1 — Chức năng (hành động → kết quả mong đợi)

1. Mở trang → renderer gắn `[data-hospital-ready="true"]`, 2 canvas, overlay
   dựng group tầng focus ± 1.
2. Bấm nút toggle demo → nhãn đổi giữa "🚀 Quick Tour (30s)" và
   "🎬 Full Demo (180s)", trang không chết.
3. Bấm phím số `3` → camera về tầng của bước consultation (floor 1).
4. Nhập câu hỏi khớp template (ví dụ "Xin chào") + Enter → bong bóng user
   hiện, guide trả lời template.
5. Nhấn Space → demo clock tạm dừng, bấm lần nữa → chạy tiếp.
6. Nhấn `Home` → camera về đầu demo.

## Vòng 2 — Đối kháng (bỏ sót gì ở vòng 1)

7. Bấm toggle 3 lần liên tiếp thật nhanh → không crash, renderer còn sống.
8. Bấm phím 1..9 liên tiếp (seek storm) → không wedge renderer, không lỗi.
9. Gửi chat rỗng → không crash, input còn dùng được.
10. Gửi tin 500 ký tự → có phản hồi (stub fallback), không lỗi.
11. Gửi payload dạng `<script>alert(1)</script>` → hiển thị dưới dạng text,
    không có script nào được tạo, không có dialog nào bật.
12. Gửi tin khớp template wait-update / cost-estimate → xem trước đã biết:
    server hiện KHÔNG trả frame (xem KNOWN ISSUE trong
    `guide-service-lifecycle.test.ts`); không tính là lỗi UI.
13. Gõ ký tự đặc biệt vào chat (emoji, ký tự C1) → không crash.

## Vòng 3 — Khoảng trống phủ (a11y, mobile, console, visual)

14. Không có pageerror (ngoại lệ chưa bắt) trong mọi kịch bản scripted.
15. Input chat có accessible name, nút Gửi có tên, hotspot phòng đều có
    `aria-label`.
16. Viewport mobile 390×844 → không tràn ngang.
17. Chỉ có đúng 2 canvas (không có canvas thừa sau các lần chuyển chế độ).
18. Visual: tooltip phòng, badge chế độ, dải chip — đối chiếu bằng mắt khi
    chạy agentic (không code hoá được xác định).

## Danh sách đã gộp và phân nhóm

| # | Test | Group | Trạng thái |
| --- | --- | --- | --- |
| 1 | readiness + 2 canvas + overlay | A | Playwright (ui-load) |
| 4 | chat Enter → reply template | A | Playwright (ui-enter) |
| 6 | Home về đầu demo | A | cần browse agentic |
| 2 | toggle đổi nhãn, không chết | B | Playwright (ui-toggle) |
| 3 | phím 3 → floor 1 | B | Playwright (ui-step3) |
| 7 | toggle nhanh ×3 | B | Playwright (ui-toggle) |
| 8 | seek storm 1..9 | B | Playwright (ui-seekstorm) |
| 9 | submit rỗng | B | Playwright (ui-empty) |
| 10 | 500 ký tự → stub reply | B | Playwright (ui-longmsg) |
| 11 | XSS chat → text thường | B | Playwright (ui-xss) |
| 13 | ký tự đặc biệt chat | B | cần browse agentic |
| 14 | pageerror = 0 mọi kịch bản | C | Playwright (mọi test) |
| 15 | a11y seams (tên, aria-label) | C | Playwright (ui-a11y) |
| 16 | mobile không tràn ngang | C | Playwright (mobile) |
| 17 | đúng 2 canvas | C | Playwright (ui-seekstorm) |
| 18 | visual đối chiếu mắt | C | cần browse agentic |

Group A (chức năng lõi), B (đối kháng), C (khoảng trống). Lần chạy agentic
sau này: Group A ~25 bước, Group B ~40 bước, Group C ~25 bước, mỗi group một
sub-agent với đúng danh sách test của group, không tự khám phá ngoài danh
sách; mọi lỗi phải kèm screenshot vào `.context/ui-test-screenshots/`.

## Chạy phần Playwright (khi anh/chị cho phép)

Cần web app đang chạy trên 3000 (guide service tự nâng qua webServer với
`FREELLM_STUB=true`):

```powershell
bun x playwright test apps/web/playwright/hospital-demo-ui-adversarial.e2e.ts --project=@calcom/web-edge --reporter=list
```

## Ghi chú ràng buộc

- Không hỏi câu wait/cost trong UI suite (template đó bị server nuốt reply —
  bug candidate riêng, đã pin trong lifecycle test).
- Project `@calcom/web-edge` giả lập `prefers-reduced-motion: reduce`, nên
  các test không assert chuyển động mượt; beat nhảy vẫn đủ để xác minh seek.