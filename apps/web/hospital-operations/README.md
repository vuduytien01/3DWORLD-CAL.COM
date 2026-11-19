# Mốc tuần 1 · Đặt lịch và tiếp nhận tại bệnh viện

Ứng dụng chạy cùng repo bằng Bun trên cổng riêng, mặc định là 3010. Màn hình mô hình nhập trực tiếp renderer HTML5 và tọa độ sảnh, khu chờ, phòng khám từ phần Duy Tiến đã bàn giao.

## Chạy với Cal.diy

Trong một phiên Cal.diy dành cho thử nghiệm, thiết lập một loại lịch **Khám Nội tổng quát** có một bác sĩ, thời lượng 30 phút và múi giờ **Asia/Ho_Chi_Minh**. Chọn ngày hôm nay còn chỗ để thử tiếp nhận. Tạo khóa API cho tài khoản sở hữu lịch và chuẩn bị dịch vụ API v2 cùng cơ sở dữ liệu với web Cal.diy.

Từ thư mục gốc, cấu hình các biến trên terminal chạy ứng dụng.

| Biến | Giá trị |
| --- | --- |
| HOSPITAL_STAFF_KEY | Mã truy cập quầy do người chạy đặt riêng |
| HOSPITAL_CAL_API_ORIGIN | Địa chỉ dịch vụ API v2, ví dụ http://127.0.0.1:5555 |
| HOSPITAL_CAL_API_KEY | Khóa đọc lịch của tài khoản demo |
| HOSPITAL_CAL_EVENT_TYPE_ID | ID loại lịch khám demo |
| HOSPITAL_CAL_BOOKING_URL | URL trang chọn ngày và giờ của loại lịch |
| HOSPITAL_DB_PATH | Đường dẫn tệp SQLite thử nghiệm, mặc định lưu trong bộ nhớ |

~~~powershell
bun run apps/web/hospital-operations/server.mts
~~~

Mở http://127.0.0.1:3010 để vào trang đặt lịch. Sau khi đặt, đối chiếu trên màn hình **Bookings** của Cal.diy rồi mở http://127.0.0.1:3010/staff với mã truy cập quầy. Màn hình tiếp nhận lấy lịch đã xác nhận trong ngày theo loại lịch. Thao tác **Tiếp nhận** đối chiếu lại với API trước khi cấp số. Tiếp nhận lại cùng một lịch giữ nguyên số lượt.

Bệnh nhân mở liên kết theo dõi do quầy gửi. Liên kết ghép được một lần trong ngày. Sau khi ghép, trình duyệt đó có thể quét QR tại sảnh hoặc khu chờ để cập nhật vị trí. Dùng nút tương ứng nếu đang thao tác bằng máy tính. Nút **Phòng khám 01** chuyển góc nhìn lên tầng 1. Vị trí hiển thị lấy từ mốc xác nhận gần nhất.

Để thử từ điện thoại, đặt HOSPITAL_PUBLIC_URL là địa chỉ điện thoại có thể truy cập và chạy qua môi trường thử nghiệm tin cậy. Mặc định localhost chỉ dùng được trên máy chạy. HOSPITAL_HOST và HOSPITAL_PORT điều chỉnh địa chỉ lắng nghe khi cần.

## Demo bằng dữ liệu minh họa

Khi trình bày trên máy chỉ có sẵn Bun và dependency của web, chạy tuần tự các lệnh PowerShell sau.

~~~powershell
$env:HOSPITAL_MODE = "demo"
$env:HOSPITAL_STAFF_KEY = Read-Host "Nhập mã quầy dùng cho ca demo"
bun run apps/web/hospital-operations/server.mts
~~~

Nhãn **Dữ liệu minh họa** xuất hiện trên giao diện. Đặt lịch ở một trong ba khung giờ mẫu, mở quầy để kiểm tra lịch vừa đặt và tiếp nhận. Sau đó mở trang theo dõi, xác nhận lần lượt sảnh và khu chờ, rồi mở tầng của phòng khám. Chế độ này lưu lịch thử trong SQLite cục bộ. Các bước xác minh với Cal.diy dùng cấu hình ở mục trên.

Mẫu bàn giao tuần 1 gồm hai ảnh đặt lịch và tiếp nhận, cùng đoạn quay mô hình chuyển từ tầng 0 lên tầng 1. Hướng dẫn chạy riêng mô hình gốc nằm trong [tài liệu demo của Duy Tiến](../../../docs/hospital-demo-run-guide.md).
