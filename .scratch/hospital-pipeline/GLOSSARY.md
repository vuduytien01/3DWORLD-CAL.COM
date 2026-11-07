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

**2D Timeline (Tiến trình 2D)**:
Khung hiển thị tiến trình vé dạng danh sách/các bước với trạng thái và ước lượng chờ.
_Avoid_: progress bar

**3D Simulation (Mô phỏng 3D)**:
Biểu diễn thời gian thực, đầy đủ chi tiết của bệnh viện trong không gian 3D (nội thất, nhân vật, hoạt ảnh) theo quyết định của founder ngày 2026-11-06: bắt buộc có trong demo bảo vệ. Bao quát cả xem tổng thể lẫn nhìn trong phòng.
_Avoid_: "bản đồ isometric" dùng như từ đồng nghĩa (isometric là một kiểu view nhẹ hơn, không phải Mô phỏng 3D đầy đủ); "walkthrough" dùng lơ lửng không nói rõ mức tương tác
