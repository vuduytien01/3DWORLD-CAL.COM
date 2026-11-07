# Map: Kế hoạch lớp 3D cho đồ án đặt lịch khám

Label: wayfinder:map
Charted: 2026-11-07

## Destination

Bản kế hoạch lớp 3D hoàn chỉnh. Spike fps đã đo trên Iris Xe thật, dữ liệu vị trí trong Step Graph chốt, kiến trúc scene và camera chốt, kế hoạch asset chốt, và kiến trúc AI guide chịu tải nhiều người dùng chốt. Xong khi nhóm vào code thật mà không còn gì phải quyết.

## Notes

- Ràng buộc cứng. Ngân sách $0. Render client trên Intel Iris Xe của ThinkPad P16s Gen 2 Intel 16GB. Triển khai Docker bằng một lệnh docker compose up. Bắt buộc gọi AI API qua FreeLLM gateway tự host :3001, OpenAI-compatible, có stub mode cho test.
- Engine chốt three.js + React Three Fiber theo docs/adr/0002. 3D in scope full-detail nhiều tầng theo docs/adr/0001. Đọc spec.md, GLOSSARY.md và research/ trước khi làm bất kỳ ticket nào.
- Founder ghi rõ ngày 2026-11-07. Đặt lịch hẹn xong vào 3D để được AI agent chat dẫn lộ trình khám. Một agent phục vụ nhiều người dùng nên thiết kế sao không quá tải là mối quan tâm thiết kế số một của effort này.
- Bảng hỏi GVHD (to-questionnaire-html5-compatibility.md) chờ founder điền tên và gửi. Câu trả lời nuôi kế hoạch demo ngày bảo vệ, không chặn ticket nào trong map này.
- Điều kiện hội đồng còn nợ founder. Giờ làm thật mỗi tuần mỗi người, ngày bảo vệ, rubric chấm.
- Skill cho từng loại ticket. research gọi skill research. prototype gọi skill prototype. grilling gọi skill grilling cùng skill domain-modeling.

## Decisions so far

- **Asset survey CC0 (2026-11-07).** Không có pack bệnh viện CC0 hoàn chỉnh ở nguồn nào khảo sát. Nền CC0 là Kenney Furniture Kit và Building Kit cho nội thất cùng khối nhà, và Quaternius Base Characters cùng Animation Library cho nhân vật có walk và sit. Nội dung bệnh viện thật trên itch.io không phải CC0, license là CC-BY hoặc custom. Sketchfab lọc CC0 cho từ khóa hospital chỉ ra model vô dụng. Phải tự dựng Blender khoảng 6 đến 8 nhóm gồm bàn tiếp đón với máy phát vé, máy xét nghiệm, thang bộ và thang máy, biển chỉ dẫn tiếng Việt, ghế băng dãy, texture trang phục y tế. Kết quả đầy đủ: [research/2026-11-07-asset-survey-cc0.md](research/2026-11-07-asset-survey-cc0.md)

## Not yet specified

- Kịch bản demo 3 phút, camera choreography từng bước. Phụ thuộc kết quả spike và floor plan.
- Kế hoạch rủi ro demo ngày bảo vệ, laptop riêng hay máy khoa, video dự phòng, checklist. Chờ câu trả lời bảng hỏi GVHD.
- Mức hoạt ảnh nhân vật (đi, idle) bao nhiêu là đủ. Phụ thuộc asset survey.
- Cách mô phỏng thời gian chờ trong demo, thời gian thật hay nén hay nút thủ công. Thuộc cụm kịch bản demo.

## Out of scope

- Spike head-to-head engine tự xây vs adapter Cal.diy (điều kiện 3 hội đồng). Effort riêng, không nằm trên đường đi của lớp 3D.
- Backend hệ đặt lịch chi tiết. Spec.md chính lo, map này chỉ chốt phần dữ liệu mà 3D và AI guide cần.
