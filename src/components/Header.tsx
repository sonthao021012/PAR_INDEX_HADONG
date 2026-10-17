import React from 'react';
import { ShieldCheck, Printer, HelpCircle, HardDrive, RefreshCw, Flame, Settings, Lock } from 'lucide-react';
import { OverallEvaluation, GASConfig } from '../types/cchc.ts';
import { HoiAnDongLogo } from './HoiAnDongLogo.tsx';

interface HeaderProps {
  evaluation: OverallEvaluation;
  gasConfig: GASConfig;
  onOpenSystemSettings: () => void;
  onOpenReportModal: () => void;
  onOpenHelpModal: () => void;
  selectedYear: number;
  availableYears: number[];
  onChangeYear: (year: number) => void;
  isSyncing?: boolean;
  lastSyncTime?: string;
  onSyncNow?: () => void;
  firebaseConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  evaluation,
  gasConfig,
  onOpenSystemSettings,
  onOpenReportModal,
  onOpenHelpModal,
  selectedYear,
  availableYears = [2026],
  onChangeYear,
  isSyncing = false,
  lastSyncTime = '',
  onSyncNow,
  firebaseConnected = true,
}) => {
  return (
    <header className="bg-gradient-to-r from-red-800 via-red-900 to-slate-900 text-white shadow-xl border-b-4 border-amber-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Top bar with government administrative badge */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-red-700/60">
          <div className="flex items-center space-x-3.5">
            {/* Logo UBND Phường Hội An Đông */}
            <HoiAnDongLogo className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-lg hover:scale-105 transition-transform duration-200" />
            
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

          {/* Quick status & Year display */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            {/* Evaluation Year: shows 2026 as active base year, or switcher if user created next years */}
            <div className="flex items-center bg-black/40 rounded-lg p-1 border border-amber-500/40 text-xs">
              <span className="text-xs text-slate-300 px-2 font-medium">Năm đánh giá:</span>
              {availableYears.length <= 1 ? (
                <span className="text-xs px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold shadow-xs">
                  2026 (Hiện hành)
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => onChangeYear(year)}
                      className={`text-xs px-2 py-1 rounded font-semibold transition cursor-pointer ${
                        selectedYear === year
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {year} {year === 2026 ? '(Hiện hành)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Firebase Real-time Firestore Sync Badge */}
            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-orange-500/30 text-xs">
              <span className={`w-2 h-2 rounded-full ${firebaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-[11px] text-orange-200 font-semibold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                <span>{firebaseConnected ? 'Firebase: Trực tuyến' : 'Firebase: Ngoại tuyến'}</span>
              </span>
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
                  <span className="text-emerald-300">Đã lưu: {lastSyncTime}</span>
                ) : (
                  <span className="text-slate-300">Đồng bộ Drive</span>
                )}
              </span>
              {onSyncNow && (
                <button
                  onClick={onSyncNow}
                  title="Đồng bộ ngay với Google Drive"
                  disabled={isSyncing}
                  className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
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
            <button
              onClick={onOpenSystemSettings}
              className="bg-amber-950/80 hover:bg-amber-900/80 px-2.5 py-1 rounded-md border border-amber-500/50 text-amber-200 font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Mở Quản lý minh chứng Google Drive trong Cài đặt Hệ thống"
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>Minh chứng đã lưu: <strong className="text-amber-300">{evaluation.totalEvidenceCount}</strong> tệp</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Unified System Settings button - Password Protected */}
            <button
              onClick={onOpenSystemSettings}
              className="flex items-center gap-1.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white border border-indigo-400/60 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition cursor-pointer group"
              title="Quản lý Minh chứng Drive, GitHub Pages, Apps Script & Tạo năm đánh giá mới (Yêu cầu mật khẩu)"
            >
              <Settings className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-45 transition-transform" />
              <span>CÀI ĐẶT HỆ THỐNG</span>
              <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Print / Export Report button */}
            <button
              onClick={onOpenReportModal}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Xuất Báo cáo Tự chấm
            </button>

            {/* Help Button */}
            <button
              onClick={onOpenHelpModal}
              title="Hướng dẫn sử dụng"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
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
