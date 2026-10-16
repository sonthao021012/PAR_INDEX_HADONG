import { ShieldCheck, CloudUpload, Printer, Download, HelpCircle, HardDrive, Sparkles, RefreshCw, CheckCircle2, Github } from 'lucide-react';
import { OverallEvaluation, GASConfig } from '../types/cchc.ts';

interface HeaderProps {
  evaluation: OverallEvaluation;
  gasConfig: GASConfig;
  onOpenDriveModal: () => void;
  onOpenReportModal: () => void;
  onOpenHelpModal: () => void;
  onOpenGitHubModal?: () => void;
  selectedYear: number;
  onChangeYear: (year: number) => void;
  isSyncing?: boolean;
  lastSyncTime?: string;
  onSyncNow?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  evaluation,
  gasConfig,
  onOpenDriveModal,
  onOpenReportModal,
  onOpenHelpModal,
  onOpenGitHubModal,
  selectedYear,
  onChangeYear,
  isSyncing = false,
  lastSyncTime = '',
  onSyncNow,
}) => {
  return (
    <header className="bg-gradient-to-r from-red-800 via-red-900 to-slate-900 text-white shadow-xl border-b-4 border-amber-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Top bar with government administrative badge */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-red-700/60">
          <div className="flex items-center space-x-3.5">
            {/* National emblem simulation badge */}
            <div className="w-12 h-12 rounded-full bg-amber-400 p-0.5 shadow-md flex items-center justify-center shrink-0 border-2 border-amber-300">
              <div className="w-full h-full rounded-full bg-red-700 flex flex-col items-center justify-center text-amber-300">
                <span className="text-xl font-bold leading-none">★</span>
                <span className="text-[7px] font-black uppercase tracking-tighter">VIỆT NAM</span>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-semibold text-amber-300">
                  ỦY BAN NHÂN DÂN PHƯỜNG HỘI AN ĐÔNG
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-red-950/70 text-amber-200 border border-amber-500/40 font-mono">
                  TP. ĐÀ NẴNG
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                HỆ THỐNG QUẢN LÝ BỘ CHỈ SỐ CẢI CÁCH HÀNH CHÍNH (PAR INDEX)
              </h1>
            </div>
          </div>

          {/* Quick status & Year toggle */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center bg-black/30 rounded-lg p-1 border border-white/10">
              <span className="text-xs text-slate-300 px-2 font-medium">Năm đánh giá:</span>
              {[2026, 2025].map((year) => (
                <button
                  key={year}
                  onClick={() => onChangeYear(year)}
                  className={`text-xs px-2.5 py-1 rounded font-semibold transition ${
                    selectedYear === year
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Real-time Google Drive Sync Pill & Sync Button */}
            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-xs">
              <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
              <span className="text-[11px] text-slate-300 font-medium">
                {isSyncing ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Đang lưu Drive...
                  </span>
                ) : lastSyncTime ? (
                  <span className="text-emerald-300">Đã lưu Drive: {lastSyncTime}</span>
                ) : (
                  <span className="text-slate-300">Đồng bộ Drive</span>
                )}
              </span>
              {onSyncNow && (
                <button
                  onClick={onSyncNow}
                  title="Đồng bộ ngay với Google Drive"
                  disabled={isSyncing}
                  className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Google Drive Status badge button */}
            <button
              onClick={onOpenDriveModal}
              title="Quản lý kết nối Google Drive và Google Apps Script"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                gasConfig.connected
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900/80'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{gasConfig.connected ? 'Google Drive: Đã kết nối' : 'Cấu hình Google Drive'}</span>
              <span className={`w-2 h-2 rounded-full ${gasConfig.connected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            </button>
          </div>
        </div>

        {/* Action bar and summary strip */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-200">
            <span className="bg-red-800/80 px-2.5 py-1 rounded-md border border-red-600/50 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              Bộ chỉ số Phụ lục II (QĐ UBND TP Đà Nẵng)
            </span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300">
              Tổng số tiêu chí: <strong className="text-white">{evaluation.totalCriteriaCount}</strong>
            </span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300">
              Minh chứng đã lưu: <strong className="text-amber-300">{evaluation.totalEvidenceCount}</strong> tệp
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenGitHubModal && (
              <button
                onClick={onOpenGitHubModal}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
                title="Hướng dẫn & Tiện ích chạy trực tiếp trên GitHub Pages"
              >
                <Github className="w-3.5 h-3.5 text-white" />
                <span>GitHub Pages</span>
              </button>
            )}

            <button
              onClick={onOpenDriveModal}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Apps Script & Drive
            </button>

            <button
              onClick={onOpenReportModal}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Xuất Báo cáo Tự chấm
            </button>

            <button
              onClick={onOpenHelpModal}
              title="Hướng dẫn sử dụng"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
              aria-label="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
