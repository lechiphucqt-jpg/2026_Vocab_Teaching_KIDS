# 🎓 Tiếng Anh Thầy Phúc — Hệ Sinh Thái Giảng Dạy Tiếng Anh Tương Tác

Ứng dụng web EdTech toàn diện dành cho giáo viên và học sinh tiểu học (6–9 tuổi, chuẩn Cambridge Young Learners / Starters). Ứng dụng kết hợp giữa kiến trúc **Local-First (IndexedDB)** và **Google Gemini AI** để tối ưu hóa việc dạy và học từ vựng tiếng Anh.

---

## 🌟 Các Tính Năng Nổi Bật Đã Được Triển Khai

### 1. 📊 Xuất Bài Giảng & Học Liệu In Ấn (Materials Studio)
- **Xuất Slide PowerPoint (.pptx) 1-Click**: Tự động đóng gói toàn bộ chủ đề bài học thành slide thuyết trình 16:9 chuẩn màu thương hiệu, chữ to rõ cho học sinh quan sát từ xa, kèm ghi chú giảng dạy.
- **In Phiếu Bài Tập (A4 Worksheet/PDF)**: Định dạng sẵn 3 phần bài tập: Nối từ (Matching), Điền chữ cái khuyết, Viết câu ví dụ và Bảng đáp án (Answer Key) cho giáo viên chấm bài.
- **In Bộ Thẻ Flashcard Cầm Tay (A4 Cutting Guide)**: Lưới in 4-6 thẻ/trang có ký hiệu kéo cắt, in trên giấy bìa cứng làm giáo cụ trực tiếp trên lớp.
- **Xuất Ngân hàng câu hỏi Moodle LMS (.xml)**: Tương thích hoàn toàn với hệ thống E-Learning Moodle, nạp trực tiếp câu hỏi trắc nghiệm & nối từ vào đề thi.
- **Chia sẻ link học tập & Mã QR**: Phụ huynh và học sinh có thể quét mã QR để mở bài học ôn tập tại nhà trên điện thoại hoặc máy tính bảng.

### 2. 🤖 Trợ Lý Gemini AI & Chẩn Đoán Âm Học (AI Coach & Studio)
- **AI Pronunciation Coach**: Phân tích chi tiết âm đuôi (ending sound), nguyên âm và trọng âm của trẻ; đưa ra lời nhận xét sư phạm dễ thương và bài tập khắc phục bằng tiếng Việt.
- **Gấu Buddy Trợ Giảng AI**: Trò chuyện nhập vai giao tiếp (Mini Roleplay) vui nhộn cùng trẻ theo từ vựng đang học.
- **Soạn Bài Bằng AI (AI Auto-Deck Generator)**: Giáo viên chỉ cần nhập chủ đề (VD: *Động vật biển, Đồ dùng học tập, Thể thao*) -> Gemini tự động sinh toàn bộ từ vựng, phiên âm IPA, giải nghĩa, câu ví dụ và hình vẽ vector SVG sắc nét.
- **Quản lý Model & Fallback tự động**: Hỗ trợ `gemini-3-flash-preview` (Default), `gemini-3-pro-preview`, `gemini-2.5-flash` kèm cơ chế tự động chuyển model dự phòng khi quá tải (429).

### 3. 🎮 Đấu Trường Lớp Học (Versus Mode 5 Games)
- **Lật bài trí nhớ (Memory Flip)**: Luyện trí nhớ kết hợp hình và chữ.
- **Nối từ siêu tốc (Word Match)**: Nối nhanh từ vựng với hình ảnh.
- **Đuổi hình bắt chữ (Word Scramble)**: Sắp xếp các ô chữ cái thành từ đúng.
- **Bắn bong bóng từ vựng (Bubble Pop)**: Nghe phát âm và bấm nổ bong bóng từ vựng trước khi bóng bay mất.
- **Đua xe Grand Prix (Classroom Race)**: Thi đua đối kháng Đội A vs Đội B, mỗi câu trả lời đúng xe sẽ tăng tốc về đích nhận cúp vàng.
- **Hiệu ứng pháo hoa & hạt ăn mừng (Canvas Confetti Engine)**: Kích hoạt rực rỡ khi học sinh chiến thắng hoặc đạt 5 sao.

### 4. 📈 Báo Cáo Tiến Độ & Vườn Hoa Tri Thức (Progress Analytics)
- **Bản đồ 4 Kỹ Năng (SVG Radar Chart)**: Đánh giá đồng thời Nghe (Listening), Nhận diện (Reading), Phát âm (Speaking) và Phản xạ (Reflex).
- **Vườn hoa từ vựng (Knowledge Bloom Garden)**: Trực quan hóa từng từ vựng dưới dạng nụ hoa/bông hoa nở rộ; nhắc nhở tưới nước cho các từ lâu chưa ôn tập (Spaced Repetition).
- **Bảng thi đua Đội A vs Đội B**: Thống kê điểm số tích lũy qua các ván đấu lớp học.

### 5. 🎨 Cá Nhân Hóa Thương Hiệu & Local-First (IndexedDB)
- Tuỳ chỉnh tên thương hiệu giáo viên, khẩu hiệu lớp học, tải lên logo riêng.
- Toàn bộ dữ liệu bài giảng, âm thanh ghi âm và ảnh cắt từ sách giáo khoa được lưu trong IndexedDB của trình duyệt, không lo mất mạng.
- Xuất & Nhập gói dữ liệu bài giảng đầy đủ (`.json`) để chuyển đổi giữa các máy tính.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Yêu Cầu Tiên Quyết
- [Node.js](https://nodejs.org/) (khuyên dùng phiên bản 18 hoặc 20 trở lên)

### Các Bước Thực Hiện
1. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
2. Khởi chạy máy chủ phát triển cục bộ:
   ```bash
   npm run dev
   ```
3. Mở trình duyệt tại địa chỉ: `http://localhost:3000`

---

## 🔑 Hướng Dẫn Cấu Hình Gemini API Key

1. Truy cập vào cổng **Google AI Studio**: [https://aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)
2. Đăng nhập tài khoản Google và bấm **"Create API key"**.
3. Mở ứng dụng, bấm vào nút **Settings (API Key)** với dòng chữ đỏ *"Lấy API key để sử dụng app"* trên thanh điều hướng đầu trang.
4. Dán API key vào ô và bấm **"Lưu Cấu Hình"**. Key sẽ được lưu an toàn trong trình duyệt (`localStorage`) của bạn.

---

## 🌐 Triển Khai Lên Vercel (Deployment)

Dự án đã được cấu hình sẵn file `vercel.json` để xử lý SPA routing trên Vercel:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Chỉ cần đẩy mã nguồn lên GitHub và kết nối kho lưu trữ với Vercel, ứng dụng sẽ tự động build và xuất bản online!
