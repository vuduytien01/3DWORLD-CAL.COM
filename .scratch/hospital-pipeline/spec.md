# Spec: Hệ thống đặt lịch khám + pipeline khám bệnh + AI hướng dẫn lộ trình (đồ án, nhóm 2 người)

Status: ready-for-agent

Quyết định nguồn: hội đồng Roast Room ngày 2026-11-06, phán quyết GO với phương án "C-plus" (xem [verdict.md](../../sessions/2026-11-06-hospital-3d-booking-direction/verdict.md) và [draft-resolution.md](../../sessions/2026-11-06-hospital-3d-booking-direction/draft-resolution.md)). Cập nhật của founder cùng ngày, muộn hơn: **3D quay lại scope** — bắt buộc trong demo bảo vệ, mức đầy đủ chi tiết, nhiều tầng, $0 (xem [ADR-0001](docs/adr/0001-3d-in-scope-full-detail.md)). Mục Solution, Implementation Decisions, User Stories (31-34), Testing Decisions và Out of Scope bên dưới đã được sửa theo quyết định đó.

Đối tượng triển khai: dự án standalone mới (repo riêng), không phải code trong repo cal.diy này. Spec được lưu tại đây theo quy ước issue tracker local markdown; khi scaffold repo riêng thì di chuyển thư mục này sang repo mới.

## Problem Statement

Bệnh nhân đi khám ở bệnh viện Việt Nam thường lạc lối trong quy trình: không biết sau khi lấy vé thì phải chờ bao lâu, khám ở phòng nào, khi được chỉ định xét nghiệm thì đi đâu, có cần khám lại không, ở đâu nhận kết luận, có phải nhập viện không, và nếu có thì phải tìm tiếp ở đâu, cuối cùng thanh toán ở đâu với những phương thức nào. Mỗi bệnh viện có pipeline khám khác nhau, nên thông tin này không thể cứng hóa cho một bệnh viện duy nhất.

Về phía nhóm làm đồ án: 2 sinh viên cần một sản phẩm demo thuyết phục cho hội đồng chấm, chạy được trọn vẹn từ một lệnh, có tính năng AI thật (gọi được API AI), và triển khai bằng Docker. Không có khách hàng bệnh viện thật; "người dùng" thực tế của sản phẩm là hội đồng chấm và người demo.

## Solution

Một web app standalone với lõi là **step-graph engine**: pipeline khám của từng bệnh viện được định nghĩa dạng dữ liệu (đồ thị các bước: lấy vé, xếp hàng, khám, xét nghiệm, khám lại, kết luận, nhập viện, thanh toán, kèm phòng, điều kiện rẽ nhánh, mô hình chờ, chi phí, phương thức thanh toán). Một engine duy nhất điều khiển: trạng thái vé, số thứ tự (STT) và vị trí hàng đợi, ước lượng thời gian chờ, rẽ nhánh theo điều kiện thực tế (có xét nghiệm, cần khám lại, bác sĩ chỉ định nhập viện hay không), và ngữ cảnh dẫn đường cho AI guide.

AI guide gọi một API OpenAI-compatible (mặc định trỏ vào FreeLLM gateway self-hosted đã có trong Docker stack của nhóm) và trả lời bệnh nhân bằng tiếng Việt: đi đâu tiếp, phòng số mấy, đợi bao lâu, hết bao nhiêu, thanh toán ở đâu và bằng cách nào. Guide chỉ điều hướng hành chính, không tư vấn y khoa, và có phương án dự phòng bằng câu trả lời mẫu khi API AI chậm hoặc lỗi.

Giao diện 2D: form đặt vé, trang vé với timeline tiến trình hiển thị từng bước kèm trạng thái và thời gian chờ ước tính, khung chat AI, console cho nhân viên (gọi vé, cập nhật trạng thái, ghi kết quả xét nghiệm, ghi kết luận, xác nhận thanh toán), và trình chỉnh pipeline cho quản trị viên.

Mô phỏng 3D (bắt buộc trong demo, ADR-0001): bệnh viện dựng bằng three.js + React Three Fiber (ADR-0002), phong cách stylized low-poly đầy chi tiết (nội thất, nhân vật, hoạt ảnh), nhiều tầng với nhiều phòng mỗi tầng. Camera tự bám avatar của bệnh nhân đi theo pipeline từng bước, kèm xoay/zoom bằng chuột; chuyển tầng (cầu thang/thang máy) là một bước trong Step Graph. Asset từ nguồn free (CC0: Kenney, Quaternius) cộng Blender, tất cả $0. Toàn hệ thống chạy bằng `docker compose up`.

## User Stories

Bệnh nhân:

1. As a bệnh nhân, I want to chọn bệnh viện và chuyên khoa/bác sĩ rồi lấy vé khám với số STT, so that tôi có chỗ chính thức trong hàng đợi mà không cần đến sớm xếp hàng tại quầy
2. As a bệnh nhân, I want to see vị trí hàng đợi hiện tại của mình (còn bao nhiêu người phía trước), so that tôi biết mình sắp đến lượt khi nào
3. As a bệnh nhân, I want to see ước lượng thời gian chờ ở từng bước, so that tôi biết đợi bao lâu và sắp xếp thời gian
4. As a bệnh nhân, I want to see bước hiện tại của mình kèm phòng/khoa cần đến, so that tôi biết phải đi đâu ngay bây giờ
5. As a bệnh nhân, I want AI guide trả lời bằng tiếng Việt câu hỏi "tôi nên đi đâu tiếp, phòng số mấy", so that tôi không bị lạc trong bệnh viện
6. As a bệnh nhân, I want AI guide cho biết chi phí của từng bước, so that tôi chuẩn bị đủ tiền
7. As a bệnh nhân, I want khi bác sĩ chỉ định xét nghiệm thì hệ thống tự thêm bước xét nghiệm kèm phòng lab vào hành trình của tôi, so that tôi được dẫn tới đúng nơi mà không cần hỏi lại
8. As a bệnh nhân, I want khi kết quả xét nghiệm sẵn sàng thì biết rõ có cần khám lại hay không, so that tôi không bỏ sót bước nào
9. As a bệnh nhân, I want bước kết luận của bác sĩ hiển thị rõ địa điểm và trạng thái, so that tôi nhận kết luận đúng chỗ
10. As a bệnh nhân, I want khi được chỉ định nhập viện thì AI guide chỉ tiếp khoa/phòng liên quan và những gì cần chuẩn bị, so that tôi không bị rơi giữa quy trình
11. As a bệnh nhân, I want khi không cần nhập viện thì hành trình chuyển thẳng sang bước thanh toán, so that tôi kết thúc chuyến khám nhanh
12. As a bệnh nhân, I want bước thanh toán hiển thị địa điểm thu ngân và các phương thức bệnh viện nhận (tiền mặt, chuyển khoản, ví điện tử theo cấu hình), so that tôi không bất ngờ khi thanh toán
13. As a bệnh nhân, I want xem lại toàn bộ hành trình của vé dạng timeline (từng bước với thời gian thực tế), so that tôi có hồ sơ đầy đủ cho chuyến khám
14. As a bệnh nhân, I want hủy vé của mình, so that khi kế hoạch thay đổi, hàng đợi không bị nghẽn bởi vé chết
15. As a bệnh nhân, I want AI guide vẫn trả lời được (bằng câu mẫu) khi API AI chậm hoặc lỗi, so that tôi không bao giờ ở lại không có hướng dẫn
16. As a bệnh nhân, I want AI guide chỉ điều hướng hành chính và không bao giờ tư vấn y khoa hay chỉ định thuốc, so that thông tin tôi nhận luôn nằm trong phạm vi an toàn

Nhân viên bệnh viện:

17. As a lễ tân, I want gọi vé tiếp theo và cập nhật trạng thái vé (đang khám, hoàn thành, bỏ qua), so that hàng đợi và ước lượng chờ luôn phản ánh thực tế
18. As a kỹ thuật viên xét nghiệm, I want đánh dấu kết quả xét nghiệm đã sẵn sàng, so that pipeline tự rẽ nhánh sang khám lại hoặc kết luận
19. As a bác sĩ, I want ghi kết luận và quyết định nhập viện (có/không) kèm ghi chú, so that các bước tiếp theo tự sinh đúng theo pipeline
20. As a thu ngân, I want xác nhận thanh toán kèm phương thức đã sử dụng, so that vé được đóng đúng trạng thái và có bằng chứng thanh toán
21. As a nhân viên, I want một dashboard hàng đợi theo phòng với trạng thái từng vé, so that tôi điều phối được luồng bệnh nhân

Quản trị viên:

22. As a quản trị viên, I want tạo và sửa pipeline khám của từng bệnh viện dạng step graph (bước, phòng, điều kiện rẽ nhánh, mô hình chờ, chi phí), so that mỗi bệnh viện có quy trình riêng mà không cần sửa code
23. As a quản trị viên, I want quản lý phòng/khoa của bệnh viện, so that dữ liệu dẫn đường khớp thực tế
24. As a quản trị viên, I want cấu hình các phương thức thanh toán cho từng bệnh viện, so that bước thanh toán phản chiếu đúng thực tế của bệnh viện đó
25. As a quản trị viên, I want xem thống kê thời gian chờ thực tế theo từng bước, so that mô hình chờ được hiệu chỉnh dần theo dữ liệu thật

Nhà phát triển và hội đồng chấm:

26. As a developer, I want chạy toàn hệ thống bằng một lệnh `docker compose up`, so that demo không phụ thuộc vào máy ai cài gì
27. As a developer, I want cấu hình AI bằng biến môi trường (base URL và key, chuẩn OpenAI-compatible), so that trỏ được vào FreeLLM gateway đã có hoặc bất kỳ provider nào khác
28. As a developer, I want chế độ AI stub trong môi trường test, so that test không tốn tiền, không flaky và chạy được trong CI
29. As a hội đồng chấm, I want một kịch bản demo end-to-end: đặt vé, đi qua đủ các nhánh pipeline, AI dẫn đường, thanh toán, so that tính trọn vẹn của đồ án được chứng minh trong vài phút
30. As a developer, I want một bản demo chạy được mỗi thứ Sáu, so that tiến độ luôn có bằng chứng sống (điều kiện của hội đồng)

Trải nghiệm 3D (bổ sung ngày 2026-11-07 khi 3D quay lại scope):

31. As a bệnh nhân, I want nhìn bệnh viện trong không gian 3D với avatar đứng đúng phòng của bước hiện tại, so that tôi hình dung được phải đi đâu mà không cần tưởng tượng từ chữ
32. As a bệnh nhân, I want camera tự bám avatar di chuyển theo từng bước pipeline kèm xoay và zoom, so that tôi không phải điều khiển nhân vật và không bỏ sót chặng
33. As a bệnh nhân, I want thấy chuyển tầng qua cầu thang hoặc thang máy khi bước kế tiếp ở tầng khác, so that hành trình nhiều tầng vẫn liền mạch
34. As a người demo, I want cảnh 3D chạy mượt trên laptop Intel Iris Xe của nhóm, so that demo bảo vệ không bị drop frame trước hội đồng

## Implementation Decisions

- **Kiến trúc standalone (C-plus)**: xây mới, không dùng Cal.diy làm backbone đặt lịch. Lý do hội đồng chốt: domain shape của Cal.diy là lịch hẹn họp, không phải vé STT với mô hình chờ; nó chỉ phủ 1 trong 8 bước được chấm; 588 migrations là gánh nặng cho nhóm 2 người. Cal.diy chỉ còn cơ hội là nhà cung cấp bước lấy vé qua adapter dưới 200 dòng, và chỉ nếu spike thẩm định (xem Further Notes) thắng.
- **Step graph là dữ liệu, engine là bộ máy duy nhất**: pipeline mỗi bệnh viện là một đồ thị bước, định nghĩa bằng JSON có version. Các loại bước: TICKET (lấy vé), QUEUE (xếp hàng), CONSULTATION (khám), LAB (xét nghiệm), RE_CONSULT (khám lại), CONCLUSION (bác sĩ kết luận), ADMISSION (nhập viện), PAYMENT (thanh toán). Mỗi bước mang: phòng/khoa thực hiện, điều kiện đi vào, mô hình chờ, chi phí. Cạnh giữa các bước mang điều kiện rẽ nhánh: có chỉ định xét nghiệm, kết quả đã sẵn sàng, cần khám lại, bác sĩ quyết định nhập viện hay không, và nhánh mặc định. Thêm loại bước mới là dữ liệu mới, không phải code mới.
- **Số thứ tự (STT)**: cấp theo ngày theo bệnh viện, reset mỗi ngày; vé mang số STT, trạng thái và lịch sử bước append-only với timestamp.
- **Ước lượng thời gian chờ**: tính từ mô hình chờ cấu hình sẵn, được hiệu chỉnh bằng trung bình động của thời gian thực tế quan sát được theo từng bước/phòng; hiển thị live trên trang vé.
- **AI guide**: client OpenAI-compatible, endpoint và key cấu hình bằng biến môi trường; system prompt được lắp từ trạng thái vé hiện tại, định nghĩa pipeline, và ước lượng chờ; hội thoại gắn với vé; guardrail cấm tư vấn y khoa; fallback template khi API lỗi hoặc timeout.
- **Engine 3D: three.js + React Three Fiber (ADR-0002, ngày 2026-11-07)**: render client trên trình duyệt người xem, nhúng thẳng vào Next.js, cùng ngôn ngữ TS/JS của nhóm. Fallback ghi nhận: Godot 4 web export. UE5 Pixel Streaming và Unity web bị loại vì ràng buộc $0, client render và kinh nghiệm nhóm. Ngân sách hiệu năng: dưới 300 draw calls, instancing cho vật thể lặp, texture KTX2, geometry meshopt; camera tự bám avatar theo pipeline, không WASD; scene 3D đọc trạng thái vé qua API của engine chính.
- **Ràng buộc cứng được đáp ứng**: toàn bộ chạy trong Docker Compose (web Next.js, API Node, Postgres); AI gọi qua API OpenAI-compatible. FreeLLM gateway đã có trong stack hiện tại của nhóm, được nối qua biến môi trường, không định nghĩa lại trong compose.
- **Auth đơn giản**: email/password với ba vai trò patient, staff, admin. Đủ cho đồ án, không SSO.
- **Quyết định đến từ hội đồng, không phải từ prototype code**: mọi con số về thời gian (engine trong 1 tuần, spike 15 giờ) là giả thuyết cần test, xem Further Notes.

## Testing Decisions

- **Hai seam, theo chốt của founder ngày 2026-11-06**:
  1. **HTTP API của engine** (seam chính): test chạy trong Docker Compose với Postgres thật, phủ toàn bộ hành vi domain: lấy vé và cấp STT, chuyển bước, các nhánh điều kiện (có xét nghiệm, cần khám lại, nhập viện có/không), ước lượng chờ, bước thanh toán với phương thức, và endpoint AI guide với LLM ở chế độ stub qua biến môi trường.
  2. **E2E qua trình duyệt (Playwright)**: luồng chính duy nhất: đặt vé → theo dõi tiến trình timeline → hỏi AI (stub) → nhân viên advance bước → thanh toán. Không viết E2E cho mọi nhánh; nhánh hiếm test ở seam API.
- **Test tốt là test khẳng định hành vi bên ngoài**: nội dung API response và trạng thái hiển thị trên UI, không assert cấu trúc nội bộ hay truy vấn DB. Test không phụ thuộc AI thật, không phụ thuộc dữ liệu cứng ngoài seed.
- **3D trong kiểm thử (ngày 2026-11-07)**: phần test được là dữ liệu bước điều khiển cảnh, tức đổi bước vé thì avatar đổi phòng và camera đổi chặng; kiểm ở seam API (trạng thái) và một smoke Playwright đơn giản (cảnh 3D mount và bắt đầu render, không đo fps). Chất lượng hình và độ mượt đánh giá thủ công trên ThinkPad P16s trước mỗi demo, không đưa vào CI. Spike đầu tiên đo fps trên Iris Xe thật với một tầng mô hình.
- **Prior art**: repo mới, chưa có prior art. Chọn Vitest cho API test và Playwright cho E2E; một seed script làm fixture chung cho cả hai seam.

## Out of Scope

- **Phong cách 3D realistic/PBR**: mô phỏng 3D đã quay lại scope (bắt buộc trong demo, xem ADR-0001) nhưng giới hạn ở stylized low-poly đầy chi tiết; không đuổi chất liệu PBR chân thực, không animation cấp AAA, không mua asset trả tiền. Founder có thể mở lại nếu demo sau này cho thấy stylized không đủ ghi điểm.
- **Cal.diy làm backbone đặt lịch**: chỉ còn giá trị nếu spike thẩm định (adapter dưới 200 dòng) thắng engine tự xây; mặc định là bỏ.
- **Xử lý tiền thật**: bước thanh toán chỉ ghi nhận địa điểm, phương thức và trạng thái; không tích hợp gateway thanh toán, không di chuyển tiền.
- **Quản lý giường bệnh chi tiết**: bước nhập viện chỉ dẫn đường và ghi nhận quyết định của bác sĩ; không quản lý giường, không phân khoa nội trú sâu.
- **Tuân thủ y tế thực địa**: HIPAA/BAA, ký số, tích hợp HIS thật — ngoài phạm vi đồ án.
- **Telehealth/video call**: đã tách riêng trong kế hoạch Cal.diy của nhóm, không nằm trong sản phẩm này.
- **Mobile app, đa ngôn ngữ** ngoài tiếng Việt (tiếng Anh tùy chọn ở UI admin), báo cáo BI sâu.

## Further Notes

- **Điều kiện của hội đồng vẫn còn hiệu lực và cần thực thi**: (1) ngày thứ 2: nộp số giờ làm thật mỗi tuần mỗi người và ngày bảo vệ; nếu tổng dưới 8 giờ/tuần/người thì cắt quy mô xuống timeline 2D tối giản; (2) ngày thứ 3: có bảng rubric hoặc demo điểm cao năm trước; câu hỏi 3D đã chốt vào scope theo ADR-0001 nên điều kiện mở lại này đã hoàn thành sứ mệnh; (3) ngày 2 đến 14: spike head-to-head — engine tự xây đặt một vé STT thật từ đầu đến cuối trong Docker (thời lượng mục tiêu 15 giờ) song song với thẩm định adapter Cal.diy dưới 200 dòng, kẻ thua chết; (4) mỗi thứ Sáu: một bản demo chạy được từ `docker compose up`.
- **Thứ tự cắt khi thiếu thời gian** (viết ra trước tuần 3, theo Buffett): engine → AI guide → views → polish.
- **Hồ sơ quyết định đầy đủ**: thư mục [sessions/2026-11-06-hospital-3d-booking-direction/](../../sessions/2026-11-06-hospital-3d-booking-direction/) chứa brief (brief.md), sáu thẻ tranh luận 3 vòng (round-1.md, round-2.md, round-3.md), dự thảo nghị quyết (draft-resolution.md) và phán quyết (verdict.md). Tất cả trích dẫn trong thẻ đã được đối chiếu với brain của từng nhân vật.
- **Issue tracker**: chưa cấu hình chính thức cho repo này. Muốn dây tracker đầy đủ (GitHub hoặc local markdown chính thức), chạy `/setup-matt-pocock-skills` một lần.
