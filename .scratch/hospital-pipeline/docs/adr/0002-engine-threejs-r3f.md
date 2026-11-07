# Engine 3D là three.js + React Three Fiber

Nhóm 2 người chưa từng dùng engine nào, chỉ rành TS/JS web; ngân sách $0; render client trên iGPU Iris Xe; app chính là Next.js chạy Docker. Với các ràng buộc đó, three.js + React Three Fiber được chọn làm engine 3D: cùng ngôn ngữ với cả codebase, nhúng thẳng vào Next.js, học liệu và cộng đồng lớn nhất trong các lựa chọn, và đã chạy production ở quy mô thật (Charité chạy three.js). Đây là mặc định Chair áp dụng ngày 2026-11-07 khi founder chưa chốt Q13; founder có thể mở lại.

## Considered Options

- **Godot 4 web export (fallback ghi nhận)**: MIT, web export ra WASM+WebGL2 thành static files, learning curve dễ nhất trong nhóm game engine; giữ làm phương án B nếu R3F chạm trần hiệu năng, chi phí chuyển đổi bị giới hạn ở lớp scene.
- **UE5 Pixel Streaming (loại)**: không có WASM export; cần GPU NVIDIA trên server cho mỗi người xem, khoảng $0.5-1.2 USD mỗi giờ stream theo số bên thứ ba tổng hợp trong research/cpp-native-3d.md; vi phạm cả $0 lẫn client render.
- **Unity web (loại)**: WebGPU còn experimental, rủi ro giấy phép khi dự án phình to; không có lợi thế nào bù lại với nhóm chỉ biết TS/JS.
- **Custom C++ + Emscripten (loại)**: khả thi sản xuất (Figma) nhưng dốc học tập cao nhất, và WASM chậm hơn native CPU 1.45-1.55x (Jangda, arXiv:1901.09056) nên không giải được bài toán nào mà three.js trên WebGL2 chưa giải.

## Consequences

- 3D sống trong codebase web, không phải dự án engine riêng; scene 3D đọc trạng thái vé qua API của engine chính.
- Ngân sách hiệu năng trở thành điều kiện kiểm thử: dưới 300 draw calls (khuyến nghị tài liệu three.js/R3F), instancing cho vật thể lặp, texture KTX2, geometry meshopt; spike đầu tiên đo fps trên Iris Xe thật.
- Không có paper benchmark trực tiếp Unity/Unreal web vs native C++; ghi nhận là so sánh mở trong báo cáo đồ án (research/2026-11-06-papers-3d-performance.md). WebGPU đã ship cả 4 trình duyệt lớn (11/2025) và three.js tự fallback WebGL2, nên không phải chọn renderer ngay hôm nay.
