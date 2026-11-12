# ⚽ Football Auction 1v1 - Đấu Giá Cầu Thủ Huyền Thoại

Game đấu giá cầu thủ bóng đá 1v1 đối kháng trực tiếp (Local hoặc Online P2P qua WebRTC) với đội hình chiến thuật chuẩn 11 vị trí.

![Game Banner](public/vite.svg)

## 🌟 Tính Năng Nổi Bật

- **Đấu giá kịch tính 1v1**: 2 Huấn luyện viên tranh giành các Siêu sao & Huyền thoại thế giới (Tier 1: Zidane, Messi, Ronaldo, Ronaldinho, Maldini, Buffon,...).
- **Hộp bí ẩn cho người thua**: Người thua lượt đấu giá không ra về tay trắng mà nhận miễn phí 1 cầu thủ đóng thế Tier 2 (Maguire, Antony, Richarlison, Cucurella,...).
- **Quy tắc phân bổ chuẩn 11 vị trí**:
  - `1 GK`: Thủ môn (chỉ xuất hiện đúng 1 lần trong 11 vòng draft).
  - `4 DF`: Hậu vệ (LB, LCB, RCB, RB).
  - `3 MF`: Tiền vệ (CM trái, CM phải, và vị trí linh hoạt CAM / CDM).
  - `3 FW`: Tiền đạo (LW, ST, RW).
  - *Cơ chế CAM / CDM tương hỗ*: Khi xếp cầu thủ vào CAM thì ô CDM tự ẩn và ngược lại. Có thể tráo đổi linh hoạt giữa các vị trí cùng tuyến.
- **Chế độ chơi Online qua mạng**:
  - Tạo phòng & nhận Room Code hoặc link trực tiếp (`?room=ROOM_ID`).
  - Kết nối P2P thời gian thực qua WebRTC (PeerJS), không cần cài đặt phức tạp.
- **Tùy chỉnh Huấn Luyện Viên**: Đổi tên HLV và chọn Avatar cá tính.
- **Trận cầu Siêu Cúp 90 phút**: Sau khi hoàn thành 11 vòng đấu giá, 2 đội bước vào trận đấu mô phỏng thời gian thực với bình luận trực tiếp và loạt sút luân lưu Penalty nếu hòa.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

1. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

2. Khởi chạy máy chủ phát triển (Development Server):
   ```bash
   npm run dev
   ```
   Mở trình duyệt tại: `http://localhost:5173`

3. Đóng gói cho môi trường Production:
   ```bash
   npm run build
   ```

---

## 🌐 Triển Khai Lên Vercel (Deploy to Vercel)

Dự án đã được cấu hình sẵn file `vercel.json` hỗ trợ định tuyến SPA (Single Page Application).

### Cách 1: Triển khai qua Vercel Dashboard (Khuyên dùng)
1. Đẩy mã nguồn lên GitHub repository: [NguyenAKI1812/skfootball](https://github.com/NguyenAKI1812/skfootball.git).
2. Đăng nhập vào [vercel.com](https://vercel.com).
3. Bấm **"Add New..."** ➜ **"Project"**.
4. Chọn repository **`NguyenAKI1812/skfootball`** và nhấn **Import**.
5. Giữ nguyên cấu hình mặc định:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Nhấn nút **"Deploy"**. Vercel sẽ tự động build và cung cấp đường link truy cập công khai (ví dụ `https://skfootball.vercel.app`).

### Cách 2: Triển khai bằng Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: React 19, Vite 8, Tailwind CSS v4
- **Real-time Online**: PeerJS (WebRTC P2P DataConnection), BroadcastChannel API
- **Hiệu ứng & Âm thanh**: Canvas Confetti, Web Audio API Sound Synthesizer, Lucide React Icons
