# Khảo sát nguồn asset CC0 cho mô phỏng bệnh viện 3D

Ngày: 2026-11-07. Phạm vi: nội thất bệnh viện, thiết bị y tế, nhân vật có animation. Ràng buộc dự án: ngân sách $0, render trên Intel Iris Xe, three.js + R3F, phong cách stylized low-poly.

Chấm độ tin cậy của cả khảo sát: chủ yếu **measured**. Mọi URL dưới đây đều đã được fetch trực tiếp trong phiên này. Trang itch.io lọc CC0 (`/assets-cc0`) trả 403 khi fetch. Trang tìm kiếm Sketchfab dạng web (không phải API) trả về rỗng vì là SPA.

## Kết luận nhanh

Không tồn tại một pack "bệnh viện CC0" hoàn chỉnh ở bất kỳ nguồn nào khảo sát (measured qua các trang fetch bên dưới). Nội thất y tế free có trên itch.io nhưng license là CC-BY hoặc custom, không phải CC0 thuần. Lộ trình khả thi nhất: lấy nền tảng từ Quaternius + Kenney (CC0 thật), và tự dựng phần y tế đặc thù bệnh viện Việt Nam bằng Blender.

---

## 1. Kenney.nl

License toàn bộ asset 3D của Kenney là CC0 (measured, ghi rõ trên từng trang pack).

Định dạng (measured từ trang knowledge base chính thức): Kenney phát hành 3D ở OBJ, FBX và GLB. Trích dẫn "The glTF file format is distributed as GLB in Kenney game assets". GLB được khuyến nghị vì nhỏ hơn FBX. Mỗi pack kèm texture riêng.

URL định dạng: https://kenney.nl/knowledge-base/game-assets-3d/importing-3d-models-into-game-engines

### Furniture Kit
URL: https://kenney.nl/assets/furniture-kit (measured)

- License: CC0 (measured).
- Số lượng: 140 file (measured).
- Nội dung: furniture nội thất, tag gồm table, chair, bed (measured từ trang pack).
- Phát hành 2018, v1.0 (measured).
- Đáp ứng: bàn, ghế, giường cơ bản cho hành lang và phòng khám.
- Thiếu: không có thiết bị y tế nào (measured, trang pack không nhắc medical).

### Building Kit
URL: https://kenney.nl/assets/building-kit (measured)

- License: CC0 (measured).
- Số lượng: 80 file (measured).
- Nội dung: building, structure, house (measured).
- Phát hành 2024, v1.0 (measured).
- Đáp ứng: khung nhà tòa nhà modular cho ngoại thất.
- Thiếu: không có nội thất bên trong, trang pack không liệt kê chi tiết từng mẫu (measured).

### City Kit (Commercial)
URL: https://kenney.nl/assets/city-kit-commercial (measured)

- License: CC0 (measured).
- Số lượng: 50 file, v2.1, 2021 (measured).
- Nội dung: skyscraper và tòa building phố (measured).
- Có model "Sign Hospital" (biển chữ bệnh viện) thuộc pack này (inferred từ kết quả tìm kiếm và listing Poly Pizza, trang pack không liệt kê từng model).

### Kết luận Kenney

Kenney không có pack medical hay hospital riêng (inferred từ catalog https://kenney.nl/assets và kết quả tìm kiếm). Đóng góp chính cho dự án là Furniture Kit làm nền nội thất chung và GLB làm định dạng chuẩn.

---

## 2. Quaternius.com

License mọi pack là CC0 (measured trên từng trang pack). Catalog đầy đủ tại https://quaternius.com/ với khoảng 80 pack (measured).

Không có pack bệnh viện hay medical nào trong catalog (measured, đã xem toàn bộ danh sách pack trên trang chủ). Gần nhất là tag "First Aid" trong Survival Pack (measured).

### Universal Base Characters Kit
URL: https://quaternius.com/packs/universalbasecharacters.html (measured)

- License: CC0 (measured).
- Số lượng: 26 model, trong đó 6 base model nhân vật, tỉ lệ Superhero, Regular, Teen, cả nam và nữ (measured).
- Đã rigged humanoid, retargetable, có animation, trung bình khoảng 13k triangle (measured).
- Định dạng: FBX, OBJ, Blend, glTF (measured).
- 20 kiểu tóc mix-and-match, đổi màu da và mắt (measured).
- Đáp ứng: nền tảng nhân vật bệnh nhân và bác sĩ. Đốt trung bình 13k tris nằm trong tầm render của Iris Xe (measured số liệu, đánh giá hiệu năng là inferred).

### Universal Animation Library
URL: https://quaternius.com/packs/universalanimationlibrary.html (measured)

- License: CC0 (measured).
- Số lượng: hơn 120 animation trên universal humanoid rig, retargetable (measured).
- Nội dung có locomotion 8 hướng, jog, sprint, push, crawl, swim, sitting, death (measured, trích từ trang pack).
- Định dạng: FBX, GLB, Blend (measured).
- Đáp ứng: animation đi bộ (walk nằm trong locomotion) và ngồi (cho ghế chờ) cho nhân vật bệnh viện. Đây là mảnh ghép quan trọng nhất vì nhân vật itch.io không có sẵn animation.

### Ultimate Animated Character Pack
URL: https://quaternius.com/packs/ultimatedanimatedcharacter.html (measured)

- License: CC0, 52 model nhân vật có animation (measured).
- Định dạng: FBX, OBJ, Blend (measured). Không có glTF/GLB (measured).
- Trang pack chỉ ghi "many animations!", không liệt kê tên animation (measured).

### Ultimate Furniture Pack
URL: https://quaternius.com/packs/ultimatefurniture.html (measured)

- License: CC0, 20 model đã textured, không animated (measured).
- Nội dung: "Beds, chairs, tables" (measured).
- Định dạng: FBX, OBJ, Blend (measured).

### Kết luận Quaternius

Nguồn tốt nhất cho nhân vật. Base character + Animation Library cho đủ pipeline rig walk idle sit. Nhân vật không mặc áo blouse bác sĩ hay áo bệnh nhân, cần tự làm texture thay màu (inferred, catalog không có pack trang phục y tế).

---

## 3. Poly Pizza

URL: https://poly.pizza/search/hospital (measured)

- Kết quả free cho từ khóa hospital: 7 item (measured). Gồm Hospital và GRADD Hospital Room (Poly by Google), 3 model Ambulance, "15" (Daisuke Takeoka), Sign Hospital (Kenney).
- License không hiển thị ở trang kết quả, phải xem từng model (measured). Bộ lọc license có ở dropdown nhưng không điều khiển được qua URL (measured, thử tham số ?license=CC0 không có tác dụng).
- Trang còn hiện 9 pack bệnh viện trả phí trên Unity Asset Store như LOW POLY WORLD HOSPITAL hay Low Poly Hospital Characters (measured, loại vì tính phí).

Kết luận: Poly Pizza chỉ có vài model lẻ liên quan bệnh viện, không phải pack (measured). Không đáng làm nguồn chính.

---

## 4. Sketchfab

Dữ liệu qua API JSON chính thức (measured).

### Tìm kiếm hospital, downloadable, sắp theo lượt thích
URL: https://api.sketchfab.com/v3/search?type=models&q=hospital&downloadable=true&sort_by=-likeCount&count=24 (measured)

- 18 model đọc được trong kết quả đầu (measured).
- Phần lớn license là CC Attribution hoặc CC Attribution-NonCommercial (measured). Không có model CC0 trong nhóm đầu (measured).
- Các model phòng bệnh nặng về đa giác. Ví dụ Operating Room 334k faces (CC-BY-NC), Hospital Stuff 1.6M faces (CC-BY), St Bartholomew Interior 1.6M faces (measured). Mức này quá nặng cho Iris Xe ở phong cách low-poly (inferred từ số liệu measured).
- Ít model nhẹ hơn: Hospital Bed của loxfear 3,988 faces CC-BY, Apocalyptic Hospital Hallway 19,815 faces CC-BY, Medical X-ray Image Viewer 12,512 faces CC-BY (measured).

### Danh sách license trên API
URL: https://api.sketchfab.com/v3/licenses (measured)

- CC0 có uid là 7c23a1ba438d4306920229c12afcb5f9 (measured).

### Tìm kiếm hospital lọc CC0
URL: https://api.sketchfab.com/v3/search?type=models&q=hospital&downloadable=true&license=cc0 (measured)

- Chỉ có 4 kết quả, toàn tượng tôn giáo kiểu Relief, Crucified Christ, không dùng được (measured).

Kết luận: Sketchfab gần như không có nội dung bệnh viện CC0 (measured). Nội dung bệnh viện tồn tại dưới CC-BY nhưng nặng đa giác và lệch phong cách. Không nên dùng làm nguồn chính cho dự án CC0.

---

## 5. itch.io

Trang gom asset free tag hospital: https://itch.io/game-assets/free/tag-hospital (measured). 33 kết quả, phần lớn là 2D pixel hoặc horror (measured).

URL lọc CC0 `https://itch.io/game-assets/free/tag-hospital/assets-cc0` trả 403 khi fetch (measured), không xác nhận được số lượng.

### Hospital Assets của Atomic Realm
URL: https://atomicrealm.itch.io/hospital-assets (measured)

- 25 model tổng, 18 free, 4 trong PLUS pack giá tối thiểu 1 USD, 3 qua Discord (measured).
- Nội dung free: 3 giường bệnh, máy y tế Machine 1 và 2, khay, đèn treo, chai, thùng rác, mảnh phòng modular gồm tường, cửa, cửa sổ, cột, sàn, tủ (measured). MRI và giường MRI thuộc phần trả phí (measured).
- Đa giác: từ 12 (tường) đến 1,700 (tủ) (measured). Rất nhẹ, phù hợp Iris Xe (inferred từ measured).
- Định dạng: FBX, OBJ, DAE, GLTF, kèm 1 texture 1024 chung và file Blender gốc (measured).
- License: custom, cho dùng thương mại và không thương mại, bắt buộc gắn credit link về atomicrealm.itch.io, cấm bán lại hay phân phối lại (measured, trích từ trang pack). KHÔNG phải CC0 (measured).

### Low Poly Hospital Free của heyheythere
URL: https://heyheythere.itch.io/low-poly-hospital-free (measured)

- 16 prop miễn phí: giường bệnh, rèm ngăn giường (có animation), cửa (animation), đèn đầu giường, tủ đầu giường, drip stand, xe lăn, ghế khách, lò sưởi, đồng hồ, biển WARD 1, sàn và tường modular trên grid 2 m (measured).
- Định dạng: GLB, FBX, OBJ, một file mỗi prop, kèm 1 file blend tổng, texture atlas 2048, addon Godot (measured).
- License: CC BY 4.0, cho phép dùng thương mại, yêu cầu credit (measured). KHÔNG phải CC0.
- Trang ghi rõ có dùng AI hỗ trợ sản xuất (measured).
- Kit đầy đủ 111 prop + 25 máy móc là trả phí (measured).

### LOWHO Free Low Poly Hospital Characters của Standout 7
URL: https://standout7.itch.io/lowho-hospital (measured)

- 3 nhân vật: Doctor.fbx, Nurse.fbx, Patient.fbx, single mesh (measured).
- Rigged cơ bản nhưng KHÔNG có animation nào kèm theo (measured, trang không liệt kê animation và mô tả rig để "custom animations").
- Định dạng FBX, 1 texture chung 256x256, file nén 352 kB (measured).
- License mâu thuẫn trên chính trang: metadata itch.io ghi CC0 v1.0 Universal nhưng phần terms của trang lại là custom (cấm bán lại, cấm dùng train AI, không cần credit) (measured). Cần coi như license custom, không phải CC0 sạch.
- Đáp ứng: ngoại hình bác sĩ y tá bệnh nhân sẵn có. Thiếu animation walk/idle phải tự làm hoặc retarget từ Animation Library của Quaternius (inferred từ hai nguồn measured).

### Khác trong danh sách 33 kết quả

- Low Poly Interiors MegaKit Free Tier của Amano007, 422 prop, 17 phòng, có scenes Godot (measured từ listing, chi tiết nội dung là inferred). Giao diện nội thất chung, có thể tận dụng phòng hành lang.
- Free Modular 3D hospital environment của Madduck và Retro Medical Clinic của spajx123c, 50 prop (measured từ listing, chưa fetch trang chi tiết nên license là guess).
- Phần còn lại chủ yếu 2D pixel và horror PSX (measured).

---

## 6. OpenGameArt

URL đã fetch: https://opengameart.org/content/small-hospital-bed (measured)

- Asset 3D bệnh viện duy nhất tìm thấy qua tìm kiếm: Small Hospital Bed của qubodup, 280 faces / 540 tris, phát hành 2012, license CC-BY 3.0 phải credit hai tác giả (measured).
- Không có pack bệnh viện CC0 nào trên OpenGameArt theo kết quả tìm kiếm (inferred). Các bộ furniture trên OGA là nội thất chung, license CC0 (inferred từ tiêu đề trang kết quả tìm kiếm, chưa fetch từng trang).

Kết luận: OpenGameArt là nguồn phụ, chỉ có 1 asset y tế đơn lẻ và không phải CC0 (measured).

---

## Tổng hợp đáp ứng và thiếu

Bảng đối chiếu với nhu cầu bệnh viện Việt Nam.

| Nhu cầu | Tình trạng | Nguồn gần nhất | Độ tin cậy |
|---|---|---|---|
| Bàn tiếp đón + máy phát vé số | Không có sẵn | Furniture Kit (bàn, ghế) | measured |
| Ghế chờ | Có một phần | Furniture Kit (chair), heyheythere (visitor chair), Quaternius (chairs) | measured |
| Giường bệnh | Đã có | Atomic Realm (3 giường free), heyheythere (beds) | measured |
| Máy xét nghiệm lab | Không có ready-made | Atomic Realm Machine 1 và 2 (máy chung chung) | measured |
| Thang bộ | Chưa xác nhận trong pack nào | Building Kit 80 file nhưng trang không liệt kê chi tiết | guess |
| Thang máy | Không có ở bất kỳ nguồn nào | Không có | measured qua khảo sát các nguồn |
| Biển chỉ dẫn phòng | Một phần, chữ tiếng Anh | Kenney Sign Hospital (inferred), heyheythere WARD 1 sign (measured) | mixed |
| Nhân vật bác sĩ y tá bệnh nhân | Có model, thiếu animation | LOWHO (rigged không anim), Quaternius Base + Animation Library (anim, không trang phục y tế) | measured |

## Danh sách cần tự dựng Blender

1. Bàn tiếp đón kiểu bệnh viện Việt Nam với quầy, máy phát vé số và bảng hiệu. Nền có thể ghép từ Furniture Kit nhưng bàn quầy dài và máy vé phải dựng (inferred từ nội dung pack measured).
2. Máy xét nghiệm (máy lab analyzer với khay mẫu, màn hình). Không pack CC0 nào có (measured).
3. Thang bộ lan can và cabin thang máy. Không nguồn nào khảo sát có (measured).
4. Biển chỉ dẫn phòng bằng tiếng Việt. Dùng plane + texture tự làm là cách rẻ nhất, model nền biển có thể lấy WARD 1 sign của heyheythere (measured) làm tham chiếu hình khối.
5. Ghế chờ liền dãy kiểu phòng chờ VN (ghế băng 3-4 chỗ liền). Các pack chỉ có ghế đơn (measured).
6. Trang phục y tế dạng texture cho nhân vật Quaternius: áo blouse trắng bác sĩ, áo y tá, áo bệnh nhân. Không pack nào CC0 có (measured), làm texture trên base model có sẵn là con đường ít tốn công nhất (inferred).
7. Nếu chọn LOWHO làm nhân vật: bộ animation walk idle sit phải tự làm hoặc retarget, vì pack không kèm (measured).

## Khuyến nghị pipeline

Nền CC0: Furniture Kit (Kenney) cho nội thất chung, Building Kit cho khối nhà, Quaternius Base Characters + Animation Library cho nhân vật có walk idle sit (measured về nội dung, khuyến nghị là inferred).

Phần free license không CC0 nhưng chấp nhận được cho đồ án: Atomic Realm (giường, tường modular, credit link), heyheythere (giường, rèm, cửa, xe lăn, CC BY 4.0), LOWHO (3 nhân vật). Ba nguồn này đều measured và đều yêu cầu credit hoặc ràng buộc redistribution.

Ước lượng khối lượng tự dựng: khoảng 6 đến 8 nhóm asset, mỗi nhóm từ vài prop đến vài texture (inferred từ bảng thiếu).
