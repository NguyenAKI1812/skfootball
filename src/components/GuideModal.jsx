import React, { useState } from 'react';
import { X, BookOpen, Gavel, Sparkles, ArrowLeftRight, Trophy, Globe } from 'lucide-react';

export default function GuideModal({ onClose }) {
  const [tab, setTab] = useState('auction'); // 'auction' | 'chem' | 'match'

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide uppercase">HƯỚNG DẪN CHƠI FOOTBALL AUCTION 1V1</h3>
            <p className="text-xs text-slate-400">Luật đấu giá theo lượt, chỉ số CHEM, đổi vị trí và thi đấu</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-950 rounded-2xl p-1 mb-4 border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setTab('auction')}
            className={`flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'auction' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Cách chơi & Đấu giá</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('chem')}
            className={`flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'chem' ? 'bg-emerald-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>CHEM & Đổi vị trí</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('match')}
            className={`flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'match' ? 'bg-cyan-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Trận đấu & Online</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 space-y-3 text-xs md:text-sm text-slate-200 leading-relaxed">
          {tab === 'auction' && (
            <>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-display text-base font-extrabold text-amber-400 uppercase flex items-center gap-2">
                  <Gavel className="w-4 h-4" /> 1. Mục tiêu & Ngân sách 1000M €
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Mỗi HLV có <strong className="text-amber-300">1000M €</strong> để xây dựng đội hình 11 cầu thủ qua <strong className="text-white">11 vòng đấu</strong> (1 GK, 4 DF, 3 MF, 3 FW).</li>
                  <li>Vòng 1 cần cả 2 HLV bấm <strong className="text-emerald-400">Sẵn sàng</strong> để bắt đầu; từ vòng 2 trở đi hệ thống tự động tiếp tục.</li>
                  <li>Người thắng đấu giá nhận cầu thủ <strong className="text-amber-300">Tier 1 (Huyền thoại / Siêu sao)</strong> và bị trừ tiền; người thua nhận miễn phí cầu thủ <strong className="text-slate-200">Tier 2 (Role Player)</strong> cùng tuyến.</li>
                </ul>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-display text-base font-extrabold text-emerald-400 uppercase">
                  2. Đấu giá xoay tua theo lượt
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Hai HLV <strong className="text-white">xoay tua đi trước</strong> qua từng vòng (Vòng 1 HLV 1 đi trước, Vòng 2 HLV 2 đi trước...).</li>
                  <li>Khi đến lượt của bạn (huy hiệu <strong className="text-amber-300">ĐẾN LƯỢT</strong>), bấm các nút <strong className="text-emerald-300">+10M</strong>, <strong className="text-emerald-300">+25M</strong>, <strong className="text-emerald-300">+50M</strong> hoặc <strong className="text-amber-300">MAX</strong> để cộng dồn mức giá mong muốn ở thanh bên dưới.</li>
                  <li>Mỗi lần bấm nút cộng tiền, đồng hồ sẽ <strong className="text-cyan-300">tạm ngừng chạy 1 giây</strong> để bạn kịp chọn tiếp.</li>
                  <li>Bấm <strong className="text-emerald-400">XÁC NHẬN</strong> để chốt giá và chuyển lượt sang đối thủ.</li>
                  <li>Bấm <strong className="text-rose-400">PASS</strong> (hoặc hết giờ lượt) sẽ kết thúc vòng ngay lập tức và đối thủ thắng cầu thủ Tier 1.</li>
                </ul>
              </div>
            </>
          )}

          {tab === 'chem' && (
            <>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-display text-base font-extrabold text-cyan-400 uppercase flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 1. Chỉ số CHEM (Chemistry - Ăn ý) là gì?
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li><strong className="text-cyan-300">CHEM</strong> đo mức độ gắn kết và hiệu quả phối hợp của toàn đội hình (tối đa 100).</li>
                  <li>Đội có CHEM cao sẽ phối hợp mượt hơn, kiểm soát bóng tốt hơn và tăng sức mạnh tổng thể khi vào trận Chung kết.</li>
                  <li>CHEM được cộng thêm khi các cầu thủ trong đội có <strong className="text-white">cùng CLB</strong> hoặc <strong className="text-white">cùng Quốc gia</strong>, và xếp đúng vị trí sở trường.</li>
                </ul>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-display text-base font-extrabold text-rose-400 uppercase flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" /> 2. Đổi vị trí & Phạt lệch vị trí
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Sau khi đủ 11/11 cầu thủ, bạn có <strong className="text-amber-300">30 giây</strong> để sắp xếp lại đội hình trên sân (cả 2 bấm Sẵn sàng sẽ vào trận ngay).</li>
                  <li>Bấm chọn 2 cầu thủ <strong className="text-white">cùng tuyến</strong> trên sân đội mình để hoán đổi vị trí (hàng tiền vệ có thể chọn giữa <strong className="text-emerald-300">CAM</strong> hoặc <strong className="text-emerald-300">CDM</strong>).</li>
                  <li><strong className="text-rose-400">Lưu ý phạt lệch vị trí:</strong> Xếp sai vị trí gốc (ví dụ <strong className="text-rose-300">LW ↔ RW</strong>, <strong className="text-rose-300">CAM ↔ CDM</strong>, <strong className="text-rose-300">LB ↔ RB</strong>) sẽ bị trừ <strong className="text-rose-400">-1 OVR</strong> và <strong className="text-rose-400">-3 CHEM</strong> mỗi cầu thủ lệch!</li>
                </ul>
              </div>
            </>
          )}

          {tab === 'match' && (
            <>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-display text-base font-extrabold text-amber-400 uppercase flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> 1. Trận Chung Kết Siêu Cúp 1v1
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Kết quả trận đấu dựa trên <strong className="text-amber-300">OVR trung bình</strong>, <strong className="text-cyan-300">CHEM</strong>, sức mạnh hàng công (tăng tỉ lệ ghi bàn) kết hợp yếu tố bất ngờ để trận đấu luôn kịch tính.</li>
                  <li>Trong 90 phút có các tình huống nổi bật: Bàn thắng (kèm tên cầu thủ kiến tạo), Cứu thua, Cản phá, Cột dọc/Xà ngang, Thẻ vàng và Thẻ đỏ.</li>
                  <li>Nếu hòa sau 90 phút, hai đội bước vào loạt <strong className="text-amber-300">đá luân lưu 11m</strong> phân định thắng thua.</li>
                </ul>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-display text-base font-extrabold text-emerald-400 uppercase flex items-center gap-2">
                  <Globe className="w-4 h-4" /> 2. Chơi Online 2 người qua mạng
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Bấm nút <strong className="text-sky-400">Chơi Online</strong> ở góc trên → <strong className="text-emerald-400">Tạo Tài Khoản</strong> (hoặc Đăng nhập) và đặt tên hiển thị (có thể đổi bất kỳ lúc nào).</li>
                  <li>Người 1 bấm <strong className="text-emerald-400">Tạo Phòng</strong> để lấy mã 6 ký tự hoặc bấm <strong className="text-white">Copy link</strong> gửi cho bạn bè.</li>
                  <li>Người 2 nhập mã phòng (hoặc mở link mời) để <strong className="text-rose-400">Vào Phòng</strong>. Trên màn hình của mỗi người, đội của bạn luôn ở <strong className="text-emerald-400">bên trái (màu xanh)</strong> và đối thủ ở <strong className="text-rose-400">bên phải (màu đỏ)</strong>.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-colors"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
