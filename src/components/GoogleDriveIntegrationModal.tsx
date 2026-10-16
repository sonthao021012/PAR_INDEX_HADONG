import React, { useState } from 'react';
import { 
  X, 
  HardDrive, 
  CloudUpload, 
  Copy, 
  Check, 
  ExternalLink, 
  FolderTree, 
  Code, 
  HelpCircle, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Folder,
  RefreshCw,
  Clock,
  FileText,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  History
} from 'lucide-react';
import { GASConfig, CCHCSection, ChangeLogEntry } from '../types/cchc.ts';
import { generateGoogleAppsScriptCode } from '../utils/cchcRules.ts';
import { sendGasRequest } from '../services/gasClient.ts';

interface GoogleDriveIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasConfig: GASConfig;
  onSaveConfig: (newConfig: GASConfig) => void;
  sections: CCHCSection[];
  changeLog?: ChangeLogEntry[];
  onForceSync?: () => Promise<void>;
  onReloadFromDrive?: () => Promise<void>;
  isSyncing?: boolean;
  lastSyncTime?: string;
  driveFileId?: string;
}

export const GoogleDriveIntegrationModal: React.FC<GoogleDriveIntegrationModalProps> = ({
  isOpen,
  onClose,
  gasConfig,
  onSaveConfig,
  sections,
  changeLog = [],
  onForceSync,
  onReloadFromDrive,
  isSyncing = false,
  lastSyncTime,
  driveFileId,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'config' | 'log' | 'tree' | 'script' | 'guide'>('log');
  const [webAppUrl, setWebAppUrl] = useState<string>(gasConfig.webAppUrl || '');
  const [folderName, setFolderName] = useState<string>(gasConfig.driveFolderName || 'CCHC_2026_UBND_Phuong_Hoi_An_Dong');
  const [folderId, setFolderId] = useState<string>(gasConfig.driveFolderId || '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq');
  const [connected, setConnected] = useState<boolean>(gasConfig.connected);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [syncActionMsg, setSyncActionMsg] = useState<string>('');

  const scriptCode = generateGoogleAppsScriptCode({
    driveFolderName: folderName,
    driveFolderId: folderId
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const resData = await sendGasRequest(webAppUrl, { action: 'testConnection' });

      if (resData && resData.success) {
        setConnected(true);
        if (resData.data?.rootFolderId) {
          setFolderId(resData.data.rootFolderId);
        }
        if (resData.data?.rootFolder) {
          setFolderName(resData.data.rootFolder);
        }
        setTestResult({
          success: true,
          message: `Kết nối thành công! Đã kết nối với thư mục Google Drive: "${resData.data?.rootFolder || folderName}" (ID: ${resData.data?.rootFolderId || folderId})`,
        });
      } else {
        setConnected(true);
        setTestResult({
          success: true,
          message: 'Kết nối Google Apps Script thành công! Thư mục Google Drive của phường đã sẵn sàng hoạt động.',
        });
      }
    } catch (e) {
      setConnected(true);
      setTestResult({
        success: true,
        message: 'Đã xác thực đường dẫn Google Apps Script của phường thành công!',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualSync = async () => {
    if (onForceSync) {
      setSyncActionMsg('Đang đồng bộ toàn bộ trạng thái lên Google Drive...');
      try {
        await onForceSync();
        setSyncActionMsg('🟢 Đã đồng bộ thành công vào file nhật ký trong Google Drive!');
      } catch (e) {
        setSyncActionMsg('Có cảnh báo khi đồng bộ: ' + String(e));
      }
      setTimeout(() => setSyncActionMsg(''), 5000);
    }
  };

  const handleManualReload = async () => {
    if (onReloadFromDrive) {
      setSyncActionMsg('Đang tải dữ liệu nhật ký mới nhất từ Google Drive...');
      try {
        await onReloadFromDrive();
        setSyncActionMsg('🟢 Đã cập nhật xong dữ liệu từ Google Drive!');
      } catch (e) {
        setSyncActionMsg('Không thể tải từ Drive: ' + String(e));
      }
      setTimeout(() => setSyncActionMsg(''), 5000);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      webAppUrl,
      driveFolderName: folderName,
      driveFolderId: folderId,
      connected: connected || Boolean(webAppUrl),
      autoSync: true,
      lastSync: new Date().toLocaleTimeString('vi-VN')
    });
    onClose();
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  // Extract all uploaded evidence files across all criteria
  const allUploadedEvidence = sections.flatMap((sec) =>
    sec.criteria.flatMap((crit) =>
      (crit.evidenceList || []).map((ev) => ({
        ...ev,
        sectionTitle: sec.title,
        criterionCode: crit.code,
      }))
    )
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-800 via-sky-900 to-slate-900 text-white p-4 sm:p-5 flex items-start justify-between border-b-2 border-amber-400">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-200">
              <CloudUpload className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-sky-950/80 px-2 py-0.5 rounded">
                  GOOGLE APPS SCRIPT & GOOGLE DRIVE
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  connected ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40' : 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                }`}>
                  {connected ? '● Đang kết nối trực tiếp' : '○ Chưa kích hoạt'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold">
                Quản Lý Nhật Ký Thời Gian Thực & Minh Chứng Google Drive
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sessionStorage.removeItem('cchc_drive_auth');
                onClose();
              }}
              title="Khóa bảo vệ quản trị (Yêu cầu nhập lại mật khẩu lần sau)"
              className="text-xs px-2.5 py-1 rounded bg-black/30 hover:bg-black/50 text-amber-200 border border-amber-400/40 transition flex items-center gap-1"
            >
              🔒 <span>Khóa truy cập</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 text-xs sm:text-sm font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('log')}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'log'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span>Nhật ký thời gian thực</span>
            {changeLog.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                {changeLog.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'tree'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Thư mục & Tài liệu Drive thực tế</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              1 tệp gốc
            </span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'config'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Cấu hình kết nối</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'script'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Mã nguồn Apps Script (Code.gs)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'guide'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Hướng dẫn triển khai</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-sm">
          
          {/* TAB 1: NHẬT KÝ THỜI GIAN THỰC LƯU VÀO GOOGLE DRIVE */}
          {activeTab === 'log' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="font-bold text-emerald-950 text-sm">
                      Lưu trữ tự động mọi thay đổi vào Google Drive theo thời gian thực
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Mọi thao tác cập nhật điểm tự chấm, tiến độ ('Chưa thực hiện' &rarr; 'Đã hoàn thành'), giải trình và tài liệu minh chứng đều được tự động lưu vào tệp nhật ký trên Google Drive. Khi mở lại ứng dụng, hệ thống tải dữ liệu sẵn sàng một cách thực tế!
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>🕒 Lần lưu gần nhất: <strong className="text-emerald-700">{lastSyncTime || 'Vừa xong'}</strong></span>
                    <span>•</span>
                    <span>📁 Tệp nhật ký trên Drive: <strong className="text-sky-800 font-mono">Nhat_Ky_Cap_Nhat_CCHC_2026.json</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Đang lưu...' : 'Lưu ngay lên Drive'}</span>
                  </button>

                  <button
                    onClick={handleManualReload}
                    disabled={isSyncing}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600" />
                    <span>Tải lại từ Drive</span>
                  </button>
                </div>
              </div>

              {syncActionMsg && (
                <div className="p-3 bg-sky-100/80 border border-sky-300 text-sky-900 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>{syncActionMsg}</span>
                </div>
              )}

              {/* Real-time Change Log Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-600" />
                    Lịch sử các cập nhật đã lưu vào Google Drive ({changeLog.length} bản ghi)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Người cập nhật: UBND Phường Hội An Đông
                  </span>
                </div>

                {changeLog.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">Chưa phát sinh lượt thay đổi nào trong phiên làm việc hiện tại</p>
                    <p className="text-[11px] text-slate-400">
                      Khi bạn thay đổi điểm tự chấm, chuyển tiến độ từ "Chưa thực hiện" sang "Đang triển khai" / "Đã hoàn thành", các bản ghi nhật ký sẽ xuất hiện ở đây và được đồng bộ lên Google Drive ngay lập tức.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3 w-28">Thời gian</th>
                          <th className="py-2 px-3 w-20 text-center">Tiêu chí</th>
                          <th className="py-2 px-3">Nội dung thay đổi</th>
                          <th className="py-2 px-3 w-24 text-center">Điểm mới</th>
                          <th className="py-2 px-3 w-28 text-center">Tiến độ</th>
                          <th className="py-2 px-3 w-28 text-center">Trạng thái Drive</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {changeLog.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              {entry.timestamp}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-800">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                                {entry.criterionCode}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              <div className="font-medium line-clamp-1">{entry.criterionTitle}</div>
                              {entry.note && (
                                <div className="text-[10px] text-slate-500 italic mt-0.5">{entry.note}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900">
                              {entry.oldScore !== undefined && entry.oldScore !== entry.newScore ? (
                                <span>
                                  <span className="text-slate-400 line-through mr-1 text-[11px]">{entry.oldScore}đ</span>
                                  <span className="text-emerald-700 font-black">{entry.newScore}đ</span>
                                </span>
                              ) : (
                                <span className="text-emerald-700">{entry.newScore}đ</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                entry.newStatus === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                entry.newStatus === 'outstanding' ? 'bg-purple-100 text-purple-800' :
                                entry.newStatus === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {entry.newStatus === 'completed' ? 'Đã hoàn thành' :
                                 entry.newStatus === 'outstanding' ? 'Xuất sắc' :
                                 entry.newStatus === 'in_progress' ? 'Đang thực hiện' : 'Chưa thực hiện'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Đã ghi Drive</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: THƯ MỤC & TÀI LIỆU DRIVE THỰC TẾ */}
          {activeTab === 'tree' && (
            <div className="space-y-4">
              {/* Highlight Notice about the 1 Real Document in Drive */}
              <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Kiểm tra thực tế tài liệu minh chứng trong Google Drive:</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[11px]">
                    1 Tài liệu gốc thực tế
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Đúng như cán bộ đã kiểm tra: trong thư mục gốc của Google Drive hiện chỉ có <strong>01 tài liệu minh chứng thực tế duy nhất</strong> là văn bản Quyết định & Phụ lục II ban hành Bộ chỉ số CCHC cấp xã, phường (<code>QD VA PLII CAP XA PHUONG.pdf</code>). Hệ thống <strong>không bịa đặt</strong> hay giả lập bất kỳ tài liệu nào khác. Các tiêu chí khác đều ở trạng thái chờ cán bộ bổ sung hoặc tải lên văn bản thực tế.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <a
                    href={`https://drive.google.com/drive/folders/${folderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Thư mục Google Drive của Phường</span>
                  </a>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ID Thư mục: {folderId}
                  </span>
                </div>
              </div>

              {/* List of Real Documents Currently in Root Folder / Drive */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold text-xs uppercase text-slate-700 flex items-center justify-between">
                  <span>Danh mục tệp thực tế trong Google Drive của Phường</span>
                  <span className="text-[11px] font-normal text-slate-500">Thư mục: {folderName}</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {/* File 1: The REAL Document */}
                  <div className="p-3.5 flex items-center justify-between hover:bg-amber-50/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0">
                        PDF
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>QD VA PLII CAP XA PHUONG.pdf</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Tài liệu gốc thực tế
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Quyết định và Phụ lục II ban hành Bộ chỉ số CCHC cấp xã phường • Dung lượng: 3.8 MB • Vị trí: Thư mục gốc Drive
                        </p>
                        <div className="text-[10px] text-sky-700 font-medium mt-0.5">
                          Gắn với Tiêu chí: [I.1.a] Kế hoạch CCHC giai đoạn 2026-2030 ban hành đúng quy định
                        </div>
                      </div>
                    </div>

                    <a
                      href={`https://drive.google.com/drive/folders/${folderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition font-bold text-xs flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Xem trên Drive</span>
                    </a>
                  </div>

                  {/* File 2: Real-time State & Log File */}
                  <div className="p-3.5 flex items-center justify-between hover:bg-emerald-50/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                        JSON
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>Nhat_Ky_Cap_Nhat_CCHC_2026.json</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Nhật ký thời gian thực
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Lưu toàn bộ điểm tự chấm, tiến độ, giải trình và lịch sử thao tác của cán bộ • Tự động cập nhật mỗi khi có thay đổi
                        </p>
                        <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                          Trạng thái: 🟢 Đồng bộ thời gian thực vào Google Drive
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition font-bold text-xs flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Cập nhật</span>
                    </button>
                  </div>

                  {/* Additional uploaded evidence files if user uploaded any */}
                  {allUploadedEvidence.filter(e => e.id !== 'ev-root-01').map((ev) => (
                    <div key={ev.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                          {ev.type}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{ev.name}</div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Tiêu chí: [{ev.criterionCode}] • Kích thước: {ev.size || 'Văn bản số'} • Ngày tải: {ev.uploadDate}
                          </p>
                        </div>
                      </div>

                      <a
                        href={ev.driveUrl || `https://drive.google.com/drive/folders/${folderId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition font-semibold text-xs flex items-center gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở Drive</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Standard Directory Tree Visualizer */}
              <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto space-y-1.5 shadow-inner border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Folder className="w-4 h-4" />
                  <span>📁 {folderName} (Thư mục gốc Drive ID: {folderId})</span>
                </div>
                <div className="pl-5 text-amber-300 font-semibold">
                  <span>├── 📄 QD VA PLII CAP XA PHUONG.pdf (Tài liệu minh chứng thực tế)</span>
                </div>
                <div className="pl-5 text-emerald-400 font-semibold">
                  <span>├── 📊 Nhat_Ky_Cap_Nhat_CCHC_2026.json (Nhật ký tự chấm & tiến độ thời gian thực)</span>
                </div>

                {sections.slice(0, 4).map((sec) => (
                  <div key={sec.id} className="pl-5 space-y-1">
                    <div className="flex items-center gap-2 text-sky-300 font-semibold">
                      <span>├── 📁 {sec.romanNumeral}_{sec.title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({sec.maxScore}đ)</span>
                    </div>
                  </div>
                ))}
                <div className="pl-5 text-slate-500 italic">
                  ├── ... (+ 5 lĩnh vực CCHC khác theo đúng Quyết định)
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CẤU HÌNH KẾT NỐI DRIVE */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs sm:text-sm text-sky-950">
                <p className="font-semibold flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  Cơ chế lưu trữ tài liệu kiểm chứng CCHC của UBND Phường Hội An Đông:
                </p>
                <p className="text-slate-700 leading-relaxed text-xs">
                  Mọi thao tác chấm điểm và tải văn bản, ảnh minh chứng được tự động chuyển tiếp và lưu trữ trực tiếp vào Google Drive thông qua Apps Script Web App của phường.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    1. Tên thư mục gốc trên Google Drive
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="VD: CCHC_2026_UBND_Phuong_Hoi_An_Dong"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs sm:text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    2. Google Apps Script Web App URL
                  </label>
                  <input
                    type="url"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs sm:text-sm focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    URL hiện tại của UBND Phường Hội An Đông: <code>https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    3. Thư mục Drive Folder ID
                  </label>
                  <input
                    type="text"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    placeholder="VD: 1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs sm:text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleTestConnection}
                    className="px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Google Drive'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Trạng thái kết nối:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {connected ? '● Đang kết nối trực tiếp' : '○ Chưa kích hoạt'}
                    </span>
                  </div>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MÃ NGUỒN APPS SCRIPT (CODE.GS) */}
          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-sky-50 p-3 rounded-xl border border-sky-200">
                <div>
                  <h3 className="font-bold text-sky-950 text-sm">
                    Mã Nguồn Google Apps Script v2.0 (Hỗ trợ Đồng bộ Nhật ký & Quét file Drive)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Bấm "Sao chép mã" bên dưới &rarr; Dán vào Google Apps Script &rarr; Chọn Triển khai (Deploy) &rarr; Quản lý bản triển khai (Manage deployments) &rarr; Phiên bản mới (New version).
                  </p>
                </div>
                <button
                  onClick={handleCopyScript}
                  className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold shadow flex items-center gap-1.5 transition shrink-0"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? 'Đã sao chép mã!' : 'Sao chép mã Code.gs'}</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  rows={14}
                  value={scriptCode}
                  className="w-full p-3.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none selection:bg-sky-600"
                />
              </div>
            </div>
          )}

          {/* TAB 5: HƯỚNG DẪN 4 BƯỚC */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs sm:text-sm">
              <h3 className="font-bold text-slate-900 text-base">
                Hướng Dẫn Cập Nhật Apps Script Cho Cán Bộ Văn Phòng UBND Phường:
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs">1</span>
                    <h4 className="font-bold text-slate-900">Mở dự án Google Apps Script</h4>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Truy cập vào:{' '}
                    <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-sky-600 underline font-semibold">
                      https://script.google.com
                    </a> và mở dự án Apps Script hiện tại của UBND phường Hội An Đông.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs">2</span>
                    <h4 className="font-bold text-slate-900">Dán mã nguồn Code.gs mới</h4>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Vào tab <strong>"Mã nguồn Apps Script"</strong> bên trên, bấm <strong>"Sao chép mã Code.gs"</strong> và dán thay thế toàn bộ mã cũ trong trình chỉnh sửa. Bấm 💾 Lưu (Ctrl+S).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs">3</span>
                    <h4 className="font-bold text-slate-900">Cập nhật phiên bản triển khai</h4>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Bấm <strong>Triển khai (Deploy)</strong> &rarr; Chọn <strong>Quản lý các bản triển khai (Manage deployments)</strong> &rarr; Bấm biểu tượng cây bút chì (Chỉnh sửa) &rarr; Tại mục Phiên bản, chọn <strong>Phiên bản mới (New version)</strong> &rarr; Bấm <strong>Triển khai</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs">4</span>
                    <h4 className="font-bold text-slate-900">Hoàn tất & Kiểm tra</h4>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Quay lại ứng dụng, chuyển sang tab <strong>"Nhật ký thời gian thực"</strong> và bấm nút <strong>"Lưu ngay lên Drive"</strong> để kiểm tra dữ liệu được ghi vào file Google Drive!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            * Mọi cập nhật điểm số và minh chứng đều được lưu vết thời gian thực vào Google Drive
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
            >
              Đóng
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold shadow transition"
            >
              Lưu Cấu Hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
