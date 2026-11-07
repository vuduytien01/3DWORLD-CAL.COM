# 04 - Kiến trúc AI guide chịu tải nhiều người dùng

Type: grilling
Status: open
Map: [map.md](../map.md)

## Question

Một gateway LLM (:3001) phục vụ mọi phiên chat của nhiều người dùng. Thiết kế sao không quá tải. Tách tầng deterministic (step graph + template câu) khỏi LLM chỉ dùng cho câu trả lời tự nhiên, phiên stateless, giới hạn token, cache theo bước, hàng đợi khi gateway bận. Cả quyết định text chat hay voice, và guardrail chỉ dẫn lộ trình không tư vấn y khoa. Đây là mối quan tâm thiết kế founder nêu rõ ngày 2026-11-07.
