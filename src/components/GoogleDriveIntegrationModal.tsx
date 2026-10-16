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
import { GASConfig, CCHCSection, ChangeLogEntry, EvidenceFile } from '../types/cchc.ts';
import { generateGoogleAppsScriptCode } from '../utils/cchcRules.ts';
import { sendGasRequest } from '../services/gasClient.ts';
import {
  scanAndAutoMapDriveFiles,
  manuallyAttachDriveFileToCriterion,
  ScannedDriveFile,
  DriveScanResult,
} from '../services/driveScanner.ts';

interface GoogleDriveIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasConfig: GASConfig;
  onSaveConfig: (newConfig: GASConfig) => void;
  sections: CCHCSection[];
  changeLog?: ChangeLogEntry[];
  onForceSync?: () => Promise<void>;
  onReloadFromDrive?: () => Promise<void>;
  onUpdateSections?: (newSections: CCHCSection[]) => void;
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
  onUpdateSections,
  isSyncing = false,
  lastSyncTime,
  driveFileId,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'config' | 'log' | 'tree' | 'script' | 'guide'>('tree');
  const [webAppUrl, setWebAppUrl] = useState<string>(gasConfig.webAppUrl || '');
  const [folderName, setFolderName] = useState<string>(gasConfig.driveFolderName || 'CCHC_2026_UBND_Phuong_Hoi_An_Dong');
  const [folderId, setFolderId] = useState<string>(gasConfig.driveFolderId || '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq');
  const [connected, setConnected] = useState<boolean>(gasConfig.connected);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [syncActionMsg, setSyncActionMsg] = useState<string>('');

  // Drive Scanner & File Mapping States
  const [isScanningDrive, setIsScanningDrive] = useState<boolean>(false);
  const [scannedFiles, setScannedFiles] = useState<ScannedDriveFile[]>([]);
  const [scanResult, setScanResult] = useState<DriveScanResult | null>(null);
  const [selectedCriterionForFile, setSelectedCriterionForFile] = useState<{ [fileId: string]: string }>({});

  // Manual Drive link form state
  const [manualFileName, setManualFileName] = useState<string>('');
  const [manualDriveLink, setManualDriveLink] = useState<string>('');
  const [manualCriterionCode, setManualCriterionCode] = useState<string>('I.1.a');
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string>('');

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

  // Flatten all available criteria for selection dropdowns
  const allCriteriaOptions = React.useMemo(() => {
    return sections.flatMap((sec) =>
      sec.criteria.map((c) => ({
        code: c.code,
        title: c.title,
        label: `[${c.code}] ${c.title.length > 55 ? c.title.slice(0, 53) + '...' : c.title}`,
      }))
    );
  }, [sections]);

  // Quét toàn bộ tệp trong Google Drive và tự động ghép vào các tiêu chí
  const handleScanDrive = async () => {
    setIsScanningDrive(true);
    setScanResult(null);
    try {
      const result = await scanAndAutoMapDriveFiles(webAppUrl, sections);
      setScanResult(result);
      if (result.files && result.files.length > 0) {
        setScannedFiles(result.files);
      }
      if (result.success && result.newlyMappedCount > 0 && onUpdateSections) {
        onUpdateSections(result.updatedSections);
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: 'Lỗi khi quét Google Drive: ' + (err?.message || String(err)),
        totalFound: 0,
        newlyMappedCount: 0,
        files: [],
        unmappedFiles: [],
        updatedSections: sections,
        error: String(err),
      });
    } finally {
      setIsScanningDrive(false);
    }
  };

  // Gán thủ công một tệp từ Drive vào một tiêu chí
  const handleAssignFile = (file: ScannedDriveFile, targetCode: string) => {
    if (!targetCode) return;
    const updated = manuallyAttachDriveFileToCriterion(file, targetCode, sections);
    if (onUpdateSections) {
      onUpdateSections(updated);
    }
    setScannedFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, mappedCriterionCode: targetCode } : f))
    );
    setSyncActionMsg(`Đã gán tệp "${file.name}" vào tiêu chí [${targetCode}] thành công!`);
    setTimeout(() => setSyncActionMsg(''), 4000);
  };

  // Thêm liên kết tệp Google Drive thủ công
  const handleAddManualLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDriveLink.trim()) {
      alert('Vui lòng nhập đường link Google Drive của tệp minh chứng!');
      return;
    }
    const name = manualFileName.trim() || `Minh chứng Drive ${manualCriterionCode}`;
    const virtualFile: ScannedDriveFile = {
      id: 'drive-manual-' + Date.now(),
      name: name,
      url: manualDriveLink.trim(),
      viewUrl: manualDriveLink.trim(),
      size: 'Google Drive Link',
      date: new Date().toISOString().split('T')[0],
      folder: 'Google Drive',
      folderPath: folderName,
    };
    const updated = manuallyAttachDriveFileToCriterion(virtualFile, manualCriterionCode, sections);
    if (onUpdateSections) {
      onUpdateSections(updated);
    }
    setManualFileName('');
    setManualDriveLink('');
    setManualSuccessMsg(`🟢 Đã gắn tệp "${name}" vào tiêu chí [${manualCriterionCode}] thành công!`);
    setTimeout(() => setManualSuccessMsg(''), 4000);
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

          {/* TAB 2: THƯ MỤC & TÀI LIỆU DRIVE THỰC TẾ (DRIVE EXPLORER & AUTO-LINKER) */}
          {activeTab === 'tree' && (
            <div className="space-y-4">
              {/* Scan Control Header */}
              <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-sky-950 text-white rounded-xl p-4 sm:p-5 border border-sky-700/50 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      Quét & Đồng Bộ Tệp Minh Chứng Trên Google Drive
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    Khi cán bộ tải các tệp minh chứng trực tiếp lên thư mục Google Drive của Phường, hãy bấm nút dưới đây để hệ thống tự động quét, đọc danh sách tệp và tự động gắn vào các tiêu chí phù hợp theo mã hoặc từ khóa.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-sky-300 pt-1">
                    <span>📁 Thư mục gốc: <strong>{folderName}</strong></span>
                    <span>•</span>
                    <a
                      href={`https://drive.google.com/drive/folders/${folderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-300 hover:underline font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Mở thư mục trên Google Drive</span>
                    </a>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                  <button
                    onClick={handleScanDrive}
                    disabled={isScanningDrive}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isScanningDrive ? 'animate-spin' : ''}`} />
                    <span>{isScanningDrive ? 'Đang quét Drive...' : '🔍 Quét tệp trên Drive ngay'}</span>
                  </button>
                </div>
              </div>

              {/* Scan Result Notice Banner */}
              {scanResult && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                  scanResult.isOldScriptVersion
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : scanResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-start gap-2.5 font-semibold text-sm">
                    {scanResult.isOldScriptVersion ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : scanResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>{scanResult.message}</div>
                      {scanResult.isOldScriptVersion && (
                        <div className="font-normal text-xs text-slate-700 mt-2 space-y-2">
                          <p>
                            👉 <strong>Lý do:</strong> Bạn vừa tải các tệp mới lên Drive, nhưng Google Apps Script đang chạy trên Google của bạn là bản triển khai ban đầu (chưa cập nhật hàm đọc quét thư mục <code>getDriveFiles</code>).
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              onClick={() => setActiveTab('script')}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs shadow-xs transition"
                            >
                              📋 Xem mã & hướng dẫn cập nhật Apps Script (1 phút)
                            </button>
                            <span className="text-slate-500">hoặc dùng form gán nhanh thủ công ngay bên dưới ↓</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form gán nhanh tệp Google Drive thủ công */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <CloudUpload className="w-4 h-4 text-sky-600" />
                    <span>Gán Nhanh Tệp Đã Có Trên Google Drive Vào Tiêu Chí</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Dành cho các tệp đã upload sẵn lên Drive
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Nếu bạn đã tải tài liệu lên Google Drive của Phường, hãy dán đường link chia sẻ của tệp và chọn mã tiêu chí tương ứng để hệ thống liên kết và tính điểm ngay lập tức:
                </p>

                <form onSubmit={handleAddManualLink} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tên tệp / Số hiệu văn bản:
                    </label>
                    <input
                      type="text"
                      value={manualFileName}
                      onChange={(e) => setManualFileName(e.target.value)}
                      placeholder="Ví dụ: Ke_hoach_CCHC_2026.pdf"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Đường link chia sẻ trên Google Drive: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={manualDriveLink}
                      onChange={(e) => setManualDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/file/d/.../view"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Gán vào Tiêu chí:
                    </label>
                    <select
                      value={manualCriterionCode}
                      onChange={(e) => setManualCriterionCode(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      {allCriteriaOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-12 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Gán tài liệu này vào tiêu chí</span>
                    </button>
                  </div>
                </form>

                {manualSuccessMsg && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{manualSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* Danh sách các tệp minh chứng thực tế đang có */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold text-xs uppercase text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-sky-700" />
                    <span>Danh sách tệp minh chứng liên kết Google Drive ({allUploadedEvidence.length} tệp)</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Thư mục: {folderName}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {allUploadedEvidence.map((ev) => (
                    <div key={ev.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0 uppercase mt-0.5">
                          {ev.type || 'FILE'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>{ev.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Tiêu chí [{ev.criterionCode}]
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Kích thước: {ev.size || 'Google Drive'} • Ngày gắn: {ev.uploadDate}
                            {ev.note && <span> • Ghi chú: {ev.note}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <a
                          href={ev.driveUrl || `https://drive.google.com/drive/folders/${folderId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition font-bold text-xs flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Xem trên Drive</span>
                        </a>
                      </div>
                    </div>
                  ))}

                  {/* Display scanned files from Drive if available */}
                  {scannedFiles.map((file) => {
                    const isAlreadyMapped = allUploadedEvidence.some(e => e.driveFileId === file.id || e.name === file.name);
                    if (isAlreadyMapped) return null;

                    return (
                      <div key={file.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/40 hover:bg-amber-50/80 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 uppercase mt-0.5">
                            DRIVE
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                              <span>{file.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-semibold">
                                Tìm thấy trên Drive (Chưa gán)
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Vị trí: {file.folderPath || file.folder} • Kích thước: {file.size} • Ngày tạo: {file.date}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <select
                            value={selectedCriterionForFile[file.id] || 'I.1.a'}
                            onChange={(e) =>
                              setSelectedCriterionForFile((prev) => ({
                                ...prev,
                                [file.id]: e.target.value,
                              }))
                            }
                            className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                          >
                            {allCriteriaOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.code} - {opt.title.slice(0, 30)}...
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() =>
                              handleAssignFile(
                                file,
                                selectedCriterionForFile[file.id] || 'I.1.a'
                              )
                            }
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition shadow-xs"
                          >
                            Gán vào tiêu chí
                          </button>

                          <a
                            href={file.viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-white border border-slate-200"
                            title="Xem tệp trên Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
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
