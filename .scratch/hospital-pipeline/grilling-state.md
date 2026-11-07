# Grilling session state — ĐÃ ĐÓNG (2026-11-07)

Phiên grill-with-docs hoàn tất. Founder trả lời "continue progress" ngày 2026-11-07 sau khi 4 câu hỏi mở được nhắc lại, không bổ sung câu trả lời, nên các mặc định đã ghi trước đó được áp dụng. Mỗi mặc định được ghi rõ trong ADR là "mặc định Chair, founder có thể mở lại".

## Kết quả chốt

- Q13 công nghệ: **three.js + React Three Fiber** (mặc định Chair), fallback ghi nhận Godot 4 web export, loại UE5 Pixel Streaming và Unity web vì ràng buộc $0, client render, kinh nghiệm nhóm. → `docs/adr/0002-engine-threejs-r3f.md`
- Q8 phong cách: **stylized low-poly đầy chi tiết**, không realistic/PBR. → ADR-0001
- Q9 tương tác: **camera tự bám avatar theo pipeline + xoay/zoom**, không WASD. → ADR-0001
- Q14 ADR: viết ngay. → `docs/adr/0001-3d-in-scope-full-detail.md`, `0002-engine-threejs-r3f.md`

## Tài liệu đã cập nhật ngày 2026-11-07

- spec.md: ghi chú nguồn quyết định ở đầu file, đoạn 3D trong Solution, quyết định engine 3D trong Implementation Decisions, stories 31-34, ghi chú testing 3D, Out of Scope sửa (chỉ còn realistic/PBR là out), Further Notes cập nhật điều kiện (2).
- docs/adr/ADR-0001, ADR-0002 (đường dẫn đầy đủ như trên).

## Bước tiếp theo của dự án (ngoài phiên)

- `/to-tickets` hoặc scaffold repo mới; khi scaffold thì chuyển cả thư mục `.scratch/hospital-pipeline/` sang repo đó.
- Spike đầu tiên: một tầng mô hình, đo fps trên Iris Xe thật của ThinkPad P16s trước khi dựng nhiều tầng.
