# Bảng hỏi: tương thích thực tế của demo 3D web với môi trường bảo vệ

**Purpose:** Xác định demo 3D chạy bằng three.js + React Three Fiber (WebGL2, render trên trình duyệt) có chạy ổn trên môi trường chấm thật của khoa hay không, và nhóm có cần chuẩn bị video dự phòng hay mang laptop riêng hay không.

**From:** Nhóm sinh viên thực hiện đồ án (điền tên 2 thành viên trước khi gửi)
**To:** Giảng viên hướng dẫn
**How your answers will be used:** Ghi vào phần rủi ro và kế hoạch demo của tài liệu đồ án; quyết định trực tiếp việc chuẩn bị laptop riêng, video quay sẵn và checklist ngày bảo vệ.

## Context

Đồ án của nhóm là hệ thống đặt lịch khám bệnh kèm mô phỏng 3D bệnh viện. Công nghệ 3D đã chốt là three.js + React Three Fiber, render trên trình duyệt của người xem qua WebGL2, phần backend chạy bằng Docker và demo khởi động bằng một lệnh `docker compose up` trên laptop ThinkPad P16s của nhóm (card đồ họa tích hợp Intel Iris Xe). Nhóm cần các fact thực tế mà thầy/cô biết qua kinh nghiệm ở khoa: máy và trình duyệt ở phòng bảo vệ ra sao, các đồ án trước gặp lỗi gì, và khi demo lỗi kỹ thuật thì quy trình xử lý thế nào. Không cần trả lời lý thuyết về HTML5 hay WebGL, chỉ cần những gì thầy/cô từng thấy.

## How to answer

Khoảng 10 phút, trả lời trực tiếp dưới mỗi câu. Trả lời thiếu một phần vẫn hữu ích, và câu "không chắc" cũng hữu ích: hãy đánh dấu những chỗ không chắc thay vì bỏ qua. Gửi lại trước ngày [điền ngày nhóm cần].

## Môi trường demo bảo vệ

### Cấu hình máy tính ở phòng bảo vệ là gì (CPU, RAM, card đồ họa tích hợp hay rời, tuổi máy)?

_Why this matters: WebGL2 và render 3D phụ thuộc mạnh vào máy, đây là fact quyết định đầu tiên._

>

### Trình duyệt nào được cài sẵn trên máy của khoa (Chrome, Edge, Firefox) và có được cập nhật thường xuyên không?

_Why this matters: phiên bản cũ có thể thiếu WebGL2 hoặc tắt nó mặc định._

>

### Sinh viên có được mang laptop riêng để demo không, và kết nối máy chiếu (HDMI, VGA, adapter) có trở ngại gì không?

_Why this matters: nếu được mang ThinkPad của nhóm thì cấu hình phòng máy không còn là rủi ro._

>

### Có trường hợp nào WebGL hoặc JavaScript bị tắt hoặc chặn trên máy khoa không (chính sách nhóm của hệ thống, phần mềm diệt virus, trình duyệt bị quản lý)?

_Why this matters: khi WebGL không có, demo 3D sẽ không chạy, đây là rủi ro duy nhất mà laptop riêng không giải được nếu demo bắt buộc trên máy khoa._

>

## Kinh nghiệm từ đồ án trước

### Thầy/cô từng chấm hoặc hướng dẫn đồ án nào có demo 3D hoặc WebGL chạy trên web chưa, và kết quả ra sao?

>

### Lỗi demo hay gặp nhất tại phòng bảo vệ là gì (trình duyệt, mạng, trình chiếu, phần mềm chặn)?

_Why this matters: mỗi lỗi nêu ra là một mục trong checklist demo của nhóm._

>

## Chuẩn bị phương án dự phòng

### Theo quy trình của khoa, khi demo lỗi kỹ thuật thì nhóm được xử lý thế nào (chạy lại, dùng video quay sẵn, hay bị trừ điểm)?

_Why this matters: câu này quyết định nhóm có cần quay video dự phòng từ trước hay không._

>

## Anything else?

Ngoài những câu trên, có điều gì về môi trường demo hoặc đồ án trước mà nhóm nên biết nhưng chưa hỏi không?

>
