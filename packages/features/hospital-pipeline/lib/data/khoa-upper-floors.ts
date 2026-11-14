/**
 * T-12 — Dữ liệu thuần KHOA tầng 4-10 (floorIndex 3-9) cho lượt 7 đa tầng.
 *
 * Dữ liệu thuần, KHÔNG build geometry: mỗi tầng 3 khoa bám grammar hình học
 * của SLICE_LAYOUT (24×12 m, hành lang giữa z 4.5-7.5, hàng bắc z 2.5 mở cửa
 * +z, hàng nam z 9.5 mở cửa −z, phòng sâu 4 m). Bên tiêu thụ (S2', T-09) nối
 * plans này vào buildKhoaFloorSlice qua departments override; đến lúc đó id
 * phòng ở đây là template — builder tự hậu tố `-f{floorIndex}`.
 *
 * Kind dùng bộ đóng KhoaRoomKind của khoa-slice: buồng nội trú dùng kind
 * 'ward' riêng (2 giường + tủ đầu giường + treo dịch truyền) và trạm điều
 * dưỡng dùng 'nurse-station' theo research/06 (TCVN 4470:2012).
 */

import { MINT_ORDER_SLICE_PALETTE, type KhoaRoomKind, type KhoaRoomSpec, type KhoaSliceDepartment } from "../3d-world/khoa-slice";

export const UPPER_FLOOR_INDEXES = [3, 4, 5, 6, 7, 8, 9] as const;

/** Hàng phòng theo SLICE_LAYOUT: tâm z và hướng cửa về hành lang */
const ROWS = {
  north: { z: 2.5, doorOffset: { x: 0, z: 2 } },
  south: { z: 9.5, doorOffset: { x: 0, z: -2 } },
} as const;

type RowName = keyof typeof ROWS;

interface RoomSeed {
  id: string;
  label: string;
  kind: KhoaRoomKind;
  /** Tâm x (m); các slot rời rạc: 3.5, 7.5, 12, 16.5 */
  x: number;
  row: RowName;
  width?: number;
  doorWidth?: number;
  note?: string;
}

const ROOM_DEPTH = 4;

/** Ep kê khai kiểu: buộc file này phải liệt kê đủ mọi kind khi KhoaRoomKind mở rộng */
const KIND_COVERAGE: Record<KhoaRoomKind, true> = {
  exam: true,
  xray: true,
  ultrasound: true,
  surgery: true,
  ophthalmology: true,
  ent: true,
  dental: true,
  waiting: true,
  reception: true,
  payment: true,
  ward: true,
  "nurse-station": true,
};

function room(seed: RoomSeed): KhoaRoomSpec {
  const row = ROWS[seed.row];
  return {
    roomId: seed.id,
    label: seed.label,
    kind: seed.kind,
    position: { x: seed.x, z: row.z },
    size: { width: seed.width ?? 4, depth: ROOM_DEPTH },
    doorOffset: row.doorOffset,
    doorWidth: seed.doorWidth ?? 1.0,
    specialtyNote: seed.note,
  };
}

function khoa(
  code: string,
  name: string,
  shortCode: string,
  seeds: readonly RoomSeed[],
  keywords: readonly string[],
): KhoaSliceDepartment {
  void KIND_COVERAGE;
  return {
    code,
    name,
    shortCode,
    signageColor: MINT_ORDER_SLICE_PALETTE.primaryDark,
    rooms: seeds.map(room),
    triageKeywords: keywords,
  };
}

/**
 * 7 tầng nội dung theo mô hình bệnh viện đa khoa Việt Nam:
 * 4-7 nội trú, 8 cận lâm sàng, 9-10 hành chính. Số liệu layout là đề xuất
 * demo — R1' research/06 sẽ tinh chỉnh theo tiêu chuẩn khi có.
 */
export const KHOA_UPPER_FLOOR_PLANS: Readonly<Record<number, readonly KhoaSliceDepartment[]>> = {
  3: [
    khoa("KHOA_NOI_TH", "KHOA NỘI TIÊU HÓA", "NỘI TH", [
      { id: "noith-room-01", label: "PHÒNG KHÁM TIÊU HÓA 01", kind: "exam", x: 3.5, row: "north", note: "nội soi dạ dày, đại tràng" },
      { id: "noith-room-02", label: "PHÒNG KHÁM TIÊU HÓA 02", kind: "exam", x: 7.5, row: "north", note: "gan mật, tụy" },
      { id: "noith-ward-01", label: "BUỒNG NỘI TRÚ 401", kind: "ward", x: 3.5, row: "south", note: "6 giường nội trú" },
    ], ["đau bụng", "ợ chua", "tiêu chảy", "nội soi"]),
    khoa("KHOA_NOI_HH", "KHOA NỘI HÔ HẤP", "NỘI HH", [
      { id: "noihh-room-01", label: "PHÒNG KHÁM HÔ HẤP 01", kind: "exam", x: 12, row: "north", note: "đo hô hấp ký" },
      { id: "noihh-room-02", label: "PHÒNG KHÁM HÔ HẤP 02", kind: "exam", x: 16.5, row: "north", note: "hen suyễn, COPD" },
      { id: "noihh-ward-01", label: "BUỒNG NỘI TRÚ 402", kind: "ward", x: 7.5, row: "south", note: "6 giường nội trú" },
    ], ["ho", "khó thở", "hen", "phế quản"]),
    khoa("KHOA_NOI_TM", "KHOA NỘI TIM MẠCH", "NỘI TM", [
      { id: "noitm-room-01", label: "PHÒNG KHÁM TIM MẠCH 01", kind: "exam", x: 12, row: "south", note: "đo ECG, huyết áp" },
      { id: "noitm-room-02", label: "PHÒNG KHÁM TIM MẠCH 02", kind: "exam", x: 16.5, row: "south", note: "sau nhồi máu" },
    ], ["đau ngực", "huyết áp", "tim đập nhanh", "ECG"]),
  ],
  4: [
    khoa("KHOA_NGOAI_TQ", "KHOA NGOẠI TỔNG QUÁT", "NGOẠI TQ", [
      { id: "ngoaitq-op-01", label: "PHÒNG MỔ TỔNG QUÁT 01", kind: "surgery", x: 3.5, row: "north", doorWidth: 1.2, note: "bàn mổ chính (4×4 demo)" },
      { id: "ngoaitq-room-01", label: "PHÒNG KHÁM NGOẠI 01", kind: "exam", x: 7.5, row: "north", note: "thăm khám sau mổ" },
      { id: "ngoaitq-ward-01", label: "BUỒNG NỘI TRÚ 501", kind: "ward", x: 3.5, row: "south", note: "6 giường nội trú" },
    ], ["đau bụng cấp", "thoát vị", "u bướu", "phẫu thuật"]),
    khoa("KHOA_NGOAI_TK", "KHOA NGOẠI THẦN KINH", "NGOẠI TK", [
      { id: "ngoaitk-room-01", label: "PHÒNG KHÁM THẦN KINH 01", kind: "exam", x: 12, row: "north", note: "chấn thương sọ não" },
      { id: "ngoaitk-room-02", label: "PHÒNG KHÁM THẦN KINH 02", kind: "exam", x: 16.5, row: "north", note: "đau dây thần kinh" },
    ], ["đau đầu", "chấn thương sọ não", "chấn thương đầu", "sọ não", "co giật"]),
    khoa("KHOA_NGOAI_TN", "KHOA NGOẠI TIẾT NIỆU", "NGOẠI TN", [
      { id: "ngoaitn-room-01", label: "PHÒNG KHÁM TIẾT NIỆU 01", kind: "exam", x: 7.5, row: "south", note: "sỏi thận, tiết niệu" },
      { id: "ngoaitn-ward-01", label: "BUỒNG NỘI TRÚ 502", kind: "ward", x: 12, row: "south", note: "4 giường nội trú" },
      { id: "ngoaitn-nurse-01", label: "TRẠM ĐIỀU DƯỠNG NGOẠI", kind: "nurse-station", x: 16.5, row: "south", note: "trạm điều dưỡng khối ngoại" },
    ], ["sỏi thận", "tiểu buốt", "đái tháo đường"]),
  ],
  5: [
    khoa("KHOA_SAN", "KHOA SẢN", "SẢN", [
      { id: "san-room-01", label: "PHÒNG KHÁM SẢN 01", kind: "exam", x: 3.5, row: "north", note: "thai kỳ, siêu âm thai" },
      { id: "san-room-02", label: "PHÒNG KHÁM SẢN 02", kind: "ultrasound", x: 7.5, row: "north", width: 4, note: "siêu âm 4D" },
      { id: "san-ward-01", label: "BUỒNG SẢN PHỤ 601", kind: "ward", x: 3.5, row: "south", note: "4 giường" },
    ], ["thai", "siêu âm thai", "sản phụ"]),
    khoa("KHOA_NHI", "KHOA NHI", "NHI", [
      { id: "nhi-room-01", label: "PHÒNG KHÁM NHI 01", kind: "exam", x: 12, row: "north", note: "khám nhi tổng quát" },
      { id: "nhi-room-02", label: "PHÒNG KHÁM NHI 02", kind: "exam", x: 16.5, row: "north", note: "dinh dưỡng trẻ em" },
      { id: "nhi-ward-01", label: "BUỒNG NỘI TRÚ NHI 602", kind: "ward", x: 7.5, row: "south", note: "6 giường, phụ huynh đồng hành" },
    ], ["trẻ sốt", "chậm tăng cân", "tiêm chủng"]),
    khoa("KHOA_DA", "KHOA DA LIỄU", "DA LIỄU", [
      { id: "da-room-01", label: "PHÒNG KHÁM DA LIỄU 01", kind: "exam", x: 12, row: "south", note: "vẩy nến, dị ứng" },
      { id: "da-room-02", label: "PHÒNG THỦ THUẬT DA", kind: "exam", x: 16.5, row: "south", note: "đốt laser, sinh thiết" },
    ], ["mẩn ngứa", "vẩy nến", "dị ứng", "mụn"]),
  ],
  6: [
    khoa("KHOA_PHCN", "KHOA PHỤC HỒI CHỨC NĂNG", "PHCN", [
      { id: "phcn-room-01", label: "PHÒNG VẬT LÝ TRỊ LIỆU", kind: "exam", x: 3.5, row: "north", note: "điện xung, sóng ngắn" },
      { id: "phcn-room-02", label: "PHÒNG TẬP PHỤC HỒI", kind: "exam", x: 7.5, row: "north", note: "bàn tập, xe tập đi" },
      { id: "phcn-room-03", label: "PHÒNG KHÁM PHCN", kind: "exam", x: 3.5, row: "south", note: "đánh giá chức năng" },
    ], ["tập phục hồi", "đau cột sống", "sau đột quỵ"]),
    khoa("KHOA_DD", "KHOA DINH DƯỠNG", "DINH DƯỠNG", [
      { id: "dd-room-01", label: "PHÒNG KHÁM DINH DƯỠNG", kind: "exam", x: 12, row: "north", note: "đo cơ thể, tư vấn" },
      { id: "dd-room-02", label: "PHÒNG TƯ VẤN TIỀNG TIỆT", kind: "exam", x: 16.5, row: "north", note: "tiểu đường, béo phì" },
    ], ["dinh dưỡng", "béo phì", "giảm cân"]),
    khoa("KHOA_VIP", "KHOA NỘI TRÚ VIP", "VIP", [
      { id: "vip-room-01", label: "BUỒNG VIP 701", kind: "ward", x: 12, row: "south", width: 4, note: "1 giường, kèm người nhà" },
      { id: "vip-room-02", label: "BUỒNG VIP 702", kind: "ward", x: 16.5, row: "south", width: 4, note: "2 giường cao cấp" },
    ], ["phòng vip", "nội trú cao cấp"]),
  ],
  7: [
    khoa("KHOA_CDHA_CT", "CĐHA CT-MRI TẦNG 8", "CT-MRI", [
      { id: "cdhact-ct-01", label: "PHÒNG CT SCANNER", kind: "xray", x: 3.5, row: "north", doorWidth: 1.4, note: "máy CT 64 dãy (4×4 demo)" },
      { id: "cdhact-mri-01", label: "PHÒNG MRI", kind: "xray", x: 7.5, row: "north", doorWidth: 1.4, note: "máy MRI 1.5T (4×4 demo)" },
      { id: "cdhact-read-01", label: "PHÒNG ĐỌC CHỤP", kind: "exam", x: 3.5, row: "south", note: "bác sĩ đọc kết quả" },
    ], ["chụp ct", "mri", "cộng hưởng từ"]),
    khoa("KHOA_CDHASA", "KHOA SIÊU ÂM", "SIÊU ÂM", [
      { id: "cdhasa-us-01", label: "PHÒNG SIÊU ÂM TỔNG QUÁT", kind: "ultrasound", x: 12, row: "north", note: "bụng, tử cung" },
      { id: "cdhasa-us-02", label: "PHÒNG SIÊU ÂM TIM", kind: "ultrasound", x: 16.5, row: "north", note: "siêu âm tim màu" },
      { id: "cdhasa-us-03", label: "PHÒNG SIÊU ÂM TĨNH MẠCH", kind: "ultrasound", x: 7.5, row: "south", note: "doppler mạch" },
    ], ["siêu âm", "doppler", "siêu âm tim"]),
    khoa("KHOA_XN", "KHOA XÉT NGHIỆM", "XÉT NGHIỆM", [
      { id: "xn-room-01", label: "PHÒNG LẤY MÁU", kind: "exam", x: 12, row: "south", note: "lấy mẫu bệnh phẩm" },
      { id: "xn-room-02", label: "PHÒNG SINH HÓA MÁU", kind: "exam", x: 16.5, row: "south", note: "máy phân tích tự động" },
    ], ["xét nghiệm", "lấy máu", "sinh hóa"]),
  ],
  8: [
    khoa("PHONG_QLCL", "PHÒNG QUẢN LÝ CHẤT LƯỢNG", "QLCL", [
      { id: "qlcl-room-01", label: "VĂN PHÒNG QLCL", kind: "reception", x: 3.5, row: "north", note: "tiếp nhận phản hồi" },
      { id: "qlcl-room-02", label: "PHÒNG HỒ SƠ BỆNH ÁN", kind: "reception", x: 7.5, row: "north", note: "lưu trữ bệnh án" },
    ], ["phản hồi", "khiếu nại", "bệnh án"]),
    khoa("PHONG_KHTH", "PHÒNG KẾ HOẠCH TỔNG HỢP", "KHTH", [
      { id: "khth-room-01", label: "VĂN PHÒNG KẾ HOẠCH", kind: "reception", x: 12, row: "north", note: "xếp lịch khám, giường" },
      { id: "khth-room-02", label: "PHÒNG THỐNG KÊ", kind: "reception", x: 16.5, row: "north", note: "báo cáo y tế" },
      { id: "khth-room-03", label: "BỘ PHẬN TÀI CHÍNH NỘI BỘ", kind: "payment", x: 3.5, row: "south", note: "quyết toán nội bộ" },
    ], ["xếp lịch", "thống kê", "báo cáo"]),
    khoa("PHONG_CNTT", "PHÒNG CÔNG NGHỆ THÔNG TIN", "CNTT", [
      { id: "cntt-room-01", label: "PHÒNG MÁY CHỦ", kind: "reception", x: 7.5, row: "south", note: "hệ thống HIS" },
      { id: "cntt-room-02", label: "VĂN PHÒNG CNTT", kind: "reception", x: 12, row: "south", note: "hỗ trợ kỹ thuật" },
    ], ["hệ thống", "mạng", "phần mềm"]),
  ],
  9: [
    khoa("PHONG_HC", "PHÒNG HÀNH CHÍNH QUẢN TRỊ", "HÀNH CHÍNH", [
      { id: "hc-room-01", label: "VĂN PHÒNG QUẢN TRỊ", kind: "reception", x: 3.5, row: "north", note: "hành chính, nhân sự" },
      { id: "hc-room-02", label: "PHÒNG TỔ CHỨC CÁN BỘ", kind: "reception", x: 7.5, row: "north", note: "đào tạo nội bộ" },
    ], ["hành chính", "nhân sự", "giấy tờ"]),
    khoa("PHONG_HT", "HỘI TRƯỜNG - TƯ VẤN", "HỘI TRƯỜNG", [
      { id: "ht-room-01", label: "HỘI TRƯỜNG BỆNH VIỆN", kind: "waiting", x: 12, row: "north", note: "họp, hội thảo y khoa (4×4 demo)" },
      { id: "ht-room-02", label: "PHÒNG HỘI CHẨN", kind: "waiting", x: 16.5, row: "north", note: "hội chẩn liên khoa" },
    ], ["hội thảo", "hội chẩn", "họp"]),
    khoa("PHONG_DT", "TRUNG TÂM ĐÀO TẠO - THƯ VIỆN", "ĐÀO TẠO", [
      { id: "dt-room-01", label: "PHÒNG ĐÀO TẠO Y KHOA", kind: "reception", x: 12, row: "south", note: "lớp học sinh viên y" },
      { id: "dt-room-02", label: "THƯ VIỆN Y KHOA", kind: "waiting", x: 16.5, row: "south", note: "tài liệu, tra cứu" },
    ], ["đào tạo", "thực tập", "thư viện"]),
  ],
};

/** Lấy plans của một tầng trên; trả undefined cho tầng không thuộc 4-10 */
export function getUpperFloorPlan(floorIndex: number): readonly KhoaSliceDepartment[] | undefined {
  return KHOA_UPPER_FLOOR_PLANS[floorIndex];
}
