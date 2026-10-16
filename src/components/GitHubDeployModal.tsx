import React, { useState } from 'react';
import {
  X,
  Github,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  FolderCheck,
  Zap,
  Download,
  Upload,
  ShieldCheck,
  AlertCircle,
  FileCode,
  Globe,
} from 'lucide-react';
import { CCHCSection, ChangeLogEntry, OverallEvaluation } from '../types/cchc';

interface GitHubDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: CCHCSection[];
  changeLog: ChangeLogEntry[];
  evaluation: OverallEvaluation;
  onRestoreData: (newSections: CCHCSection[], newLogs: ChangeLogEntry[]) => void;
}

export const GitHubDeployModal: React.FC<GitHubDeployModalProps> = ({
  isOpen,
  onClose,
  sections,
  changeLog,
  evaluation,
  onRestoreData,
}) => {
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAction(id);
    setTimeout(() => setCopiedAction(null), 2000);
  };

  // Xuất sao lưu toàn bộ dữ liệu ra file JSON
  const handleExportBackup = () => {
    const backupData = {
      app: 'CCHC_PAR_INDEX_HOI_AN_DONG',
      version: '2026.1',
      exportedAt: new Date().toISOString(),
      organization: 'Ủy ban nhân dân Phường Hội An Đông - TP. Đà Nẵng',
      evaluation,
      sections,
      changeLog,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SaoLuu_CCHC_2026_PhuongHoiAnDong_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Nhập khôi phục dữ liệu từ file JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    setRestoreSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          const importedLogs = Array.isArray(parsed.changeLog) ? parsed.changeLog : [];
          onRestoreData(parsed.sections, importedLogs);
          setRestoreSuccess(
            `Đã khôi phục thành công ${parsed.sections.length} lĩnh vực và ${importedLogs.length} mục nhật ký!`
          );
        } else {
          setRestoreError('Tệp sao lưu không đúng định dạng chuẩn CCHC!');
        }
      } catch (err: any) {
        setRestoreError(`Lỗi đọc tệp JSON: ${err?.message || 'Không hợp lệ'}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center text-white shadow-inner">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Chạy Ứng Dụng Trực Tiếp Trên GitHub
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Zero Install
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Xuất bản lên GitHub Pages mà không cần bất kỳ cài đặt nào trên GitHub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Status highlight banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-emerald-200 text-sm">
                Ứng dụng đã được tối ưu hóa 100% cho GitHub Pages!
              </div>
              <p className="text-slate-300 leading-relaxed">
                Đường dẫn tương đối <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">base: './'</code> đã được thiết lập,
                giao tiếp trực tiếp với Google Apps Script qua trình duyệt, lưu trữ thời gian thực với LocalStorage và tự động đồng bộ Google Drive. Không cần máy chủ backend NodeJS!
              </p>
            </div>
          </div>

          {/* 2 Deployment Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Pre-built docs/ folder - Recommended for Instant Zero-Permission Deploy */}
            <div className="p-5 rounded-xl bg-slate-800/80 border-2 border-emerald-500/50 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <FolderCheck className="w-4 h-4" /> Cách 1: Xuất Bản Qua /docs (Khuyên Dùng Nhất)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    Không Bị Lỗi Quyền • Chạy Ngay
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mb-2">Chạy từ thư mục /docs đã build sẵn</h3>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  Thư mục <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">docs/</code> đã được biên dịch hoàn chỉnh đầy đủ file tĩnh. 
                  Không chứa tệp workflow nên <strong>xuất bản từ AI Studio lên GitHub thành công 100%</strong> mà không gặp lỗi phân quyền!
                </p>
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5 font-mono">
                  <div className="text-emerald-400 font-semibold"># 3 bước kích hoạt trên GitHub:</div>
                  <div>1. Vào repo trên GitHub → <strong>Settings</strong> → <strong>Pages</strong></div>
                  <div>2. Tại <strong>Source</strong>: chọn <strong>Deploy from a branch</strong></div>
                  <div>3. Branch: chọn <strong>main</strong>, Folder: chọn <strong>/docs</strong> → Bấm <strong>Save</strong></div>
                  <div className="text-emerald-300 font-semibold pt-1">✅ Website hoạt động ngay tức thì!</div>
                </div>
              </div>
            </div>

            {/* Option 2: GitHub Actions */}
            <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> Cách 2: Tự Động Hóa (GitHub Actions)
                  </span>
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-medium">
                    Tùy chọn nâng cao
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mb-2">Tạo File Workflow Trực Tiếp Trên GitHub</h3>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  Nếu bạn muốn dùng GitHub Actions tự động build mỗi khi push code mà không bị lỗi cấp quyền AI Studio, bạn chỉ cần tạo file workflow trực tiếp trên web GitHub.
                </p>
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5 font-mono">
                  <div className="text-sky-400 font-semibold"># Cách thêm không bị lỗi:</div>
                  <div>1. Trên GitHub web, bấm <strong>Add file</strong> → <strong>Create new file</strong></div>
                  <div>2. Đặt tên: <code>.github/workflows/deploy.yml</code></div>
                  <div>3. Dán mã mẫu (có thể xem trong README.md) và bấm <strong>Commit</strong></div>
                  <div>4. Vào <strong>Settings</strong> → <strong>Pages</strong> → Source: <strong>GitHub Actions</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Backup & Restore Data section */}
          <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Sao Lưu & Khôi Phục Dữ Liệu Khi Chạy Trên GitHub Pages
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Lưu trữ an toàn trên thiết bị & Drive
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Dù chạy trên GitHub Pages, mọi cập nhật chấm điểm và tiến độ của bạn đều được tự động lưu trong trình duyệt và đồng bộ lên Google Drive. Bạn cũng có thể xuất file sao lưu JSON bất cứ lúc nào để chuyển sang máy tính khác:
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow transition"
              >
                <Download className="w-4 h-4" />
                Xuất file sao lưu toàn bộ (.json)
              </button>

              <label className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Nhập khôi phục từ file (.json)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

            {restoreSuccess && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            {restoreError && (
              <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}
          </div>

          {/* Quick Config Reference */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              Thông tin cấu hình bảo vệ đã tích hợp sẵn:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
              <div>
                • Mật khẩu quản trị Apps Script & Drive: <strong className="text-amber-300 font-mono">tsvmmm123</strong>
              </div>
              <div>
                • Thư mục Google Drive: <strong className="text-white font-mono">CCHC_2026_UBND_Phuong_Hoi_An_Dong</strong>
              </div>
              <div className="sm:col-span-2 truncate">
                • Link Apps Script:{' '}
                <span className="text-sky-300 font-mono text-[11px]">
                  https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Sẵn sàng chạy trên mọi tên miền GitHub Pages</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
