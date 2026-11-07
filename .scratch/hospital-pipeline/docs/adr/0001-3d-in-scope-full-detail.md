# 3D quay lại scope, bắt buộc trong demo bảo vệ, mức đầy đủ chi tiết

Ngày 2026-11-06 founder nói "chưa cần 3D" và spec ban đầu đưa toàn bộ 3D ra Out of Scope; cùng ngày, muộn hơn, founder đảo ngược trong phiên grill-with-docs: 3D bắt buộc trong demo bảo vệ, mức "đầy đủ chi tiết" kiểu game (nội thất, nhân vật, hoạt ảnh), nhiều tầng nhiều phòng, ngân sách $0, render client trên trình duyệt người xem (ThinkPad P16s Gen 2 Intel, Iris Xe). Quyết định này không suy ra được từ code, vì vậy ghi tại đây: 3D là lớp trình diễn đọc cùng Step Graph, mỗi bước của vé là một chặng đi của avatar, chuyển tầng là một bước trong đồ thị.

## Defaults đã áp dụng (mở lại được)

Founder trả lời "continue progress" ngày 2026-11-07 sau khi 4 câu hỏi mở được nhắc lại, không trả lời thêm, nên các mặc định Chair đã ghi trước đó được áp dụng và gắn nhãn rõ ràng:

- Q8 phong cách: stylized low-poly đầy chi tiết, không realistic/PBR. Lý do: ràng buộc sống còn là sản xuất asset bởi nhóm chưa từng làm 3D với $0, không phải sức mạnh render.
- Q9 tương tác: camera tự bám avatar theo pipeline, kèm xoay/zoom bằng chuột, không điều khiển WASD. Lý do: điều khiển nhân vật là một mini-game phải test, demo bảo vệ cần kịch bản chặt.

## Consequences

- Multi-floor và full-detail là lựa chọn founder đi ngược khuyến nghị 1 tầng của Chair; kỷ luật tối ưu hóa là điều kiện sống còn trên Iris Xe. Bằng chứng: scene tòa nhà web không tối ưu bị block 21.357ms so với 3ms khi tối ưu (Seto, arXiv:2602.23660).
- Bằng chứng domain ghi nhận: không sản phẩm dẫn đường bệnh nhân hàng đầu nào dùng real-time 3D; giá trị khác biệt nằm ở pipeline guidance và landmark, 3D là lớp trình diễn (research/2026-11-06-hospital-3d-domain.md).
- spec.md được sửa theo: Out of Scope bỏ dòng "3D out", thêm stories 31-34, thêm quyết định engine 3D và ghi chú testing 3D.
