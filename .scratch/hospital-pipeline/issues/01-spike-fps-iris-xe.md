# 01 - Spike fps một tầng trên Iris Xe thật

Type: prototype
Status: open
Map: [map.md](../map.md)

## Question

Dựng nhanh một tầng bệnh viện kiểu stylized low-poly, khoảng 10 phòng với nội thất cơ bản và nhân vật placeholder, bằng three.js + React Three Fiber. Layout thô làm placeholder là đủ, không cần floor plan chính thức. Đo fps, thời gian load đầu và RAM trên ThinkPad P16s Gen 2 Intel Iris Xe thật. Kết quả là quyết định giữ R3F hay rơi về Godot 4 web fallback theo docs/adr/0002.

Ticket này HITL, đo trên máy thật của nhóm. Ngưỡng qua hay rớt do founder chốt trước khi đo. Đề xuất Chair: 30 fps ổn định ở 1080p với tab chạy một mình, thời gian load đầu dưới 5 giây.
