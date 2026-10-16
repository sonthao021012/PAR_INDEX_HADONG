import React from 'react';
import { X, BookOpen, CheckCircle, HardDrive, FileText, Award, Layers } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-red-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-amber-400">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-300" />
            <h2 className="text-base sm:text-lg font-bold">
              Hướng Dẫn Sử Dụng Hệ Thống CCHC UBND Phường Hội An Đông
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs sm:text-sm">
          
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
            <h3 className="font-bold text-amber-900 text-sm mb-1">
              Cơ sở pháp lý ban hành:
            </h3>
            <p className="text-slate-700 text-xs leading-relaxed">
              Ứng dụng được xây dựng theo <strong>Quyết định của UBND thành phố Đà Nẵng</strong> về việc ban hành Bộ chỉ số theo dõi đánh giá, xếp hạng kết quả cải cách hành chính (Phụ lục II: Áp dụng đối với UBND các xã, phường, đặc khu).
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm uppercase flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-red-700" />
              1. Cấu trúc thang điểm đánh giá (Tổng 100 điểm + Thưởng/Trừ):
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">I. Chỉ đạo, điều hành CCHC:</span> 27 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">II. Cải cách thể chế:</span> 4 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">III. Cải cách thủ tục hành chính:</span> 11 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">IV. Tổ chức bộ máy hành chính:</span> 9 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">V. Cải cách chế độ công vụ:</span> 12 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">VI. Cải cách tài chính công:</span> 9 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">VII. Chuyển đổi số trong CQNN:</span> 20 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900">VIII. Hiệu quả tác động CCHC:</span> 8 điểm
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 sm:col-span-2">
                <span className="font-bold text-emerald-900">IX.1 Điểm thưởng:</span> Tối đa +10 điểm (Sáng kiến, diễn đàn đối thoại nhân dân, ISO, thu ngân sách...)
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 sm:col-span-2">
                <span className="font-bold text-rose-900">IX.2 Điểm trừ:</span> Tối đa -10 điểm (Trễ hạn không xin lỗi, kỷ luật cán bộ, thiếu trung thực minh chứng...)
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-sm uppercase flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-sky-600" />
              2. Quản lý minh chứng và Tải lên Google Drive:
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
              <li>Mỗi tiêu chí đều có nút <strong>"Chi tiết"</strong> hoặc <strong>"Thêm tệp"</strong> để tải lên tài liệu kiểm chứng (PDF, scan dấu đỏ, ảnh chụp màn hình phần mềm QLVBĐH, ảnh tuyên truyền, video...).</li>
              <li>Tài liệu tải lên được tổ chức tự động vào đúng cây thư mục Google Drive của phường theo từng lĩnh vực.</li>
              <li>Bạn có thể sao chép đoạn mã Google Apps Script từ nút <strong>"Apps Script & Drive"</strong> trên thanh tiêu đề để triển khai vào tài khoản Google Workspace của phường.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-sm uppercase flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              3. Xếp loại cải cách hành chính hàng năm:
            </h3>
            <p className="text-xs text-slate-700">
              • <strong>Xuất sắc</strong>: Đạt từ 90 điểm trở lên.<br />
              • <strong>Tốt</strong>: Đạt từ 80 đến dưới 90 điểm.<br />
              • <strong>Khá</strong>: Đạt từ 70 đến dưới 80 điểm.<br />
              • <strong>Trung bình</strong>: Dưới 70 điểm.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-3.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
