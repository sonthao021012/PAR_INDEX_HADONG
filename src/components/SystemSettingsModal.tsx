import React, { useState } from 'react';
import {
  X,
  Settings,
  Calendar,
  HardDrive,
  CloudUpload,
  Github,
  Flame,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  Search,
  Eye,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Link2,
  FolderTree,
  ShieldCheck,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { CCHCSection, ChangeLogEntry, OverallEvaluation, GASConfig, EvidenceFile } from '../types/cchc.ts';
import { generateGoogleAppsScriptCode } from '../utils/cchcRules.ts';
import { sendGasRequest } from '../services/gasClient.ts';
import {
  scanAndAutoMapDriveFiles,
  parseDriveLinksAndFiles,
  batchAttachEvidenceItems,
  extractCriterionCodeFromText,
  type DriveScanResult,
  type ParsedDriveImportItem,
  type ScannedDriveFile,
} from '../services/driveScanner.ts';
import { firebaseConfig } from '../services/firebase.ts';
import { HoiAnDongLogo } from './HoiAnDongLogo.tsx';

export interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'years' | 'evidence' | 'gas' | 'github' | 'firebase';
  availableYears: number[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onCreateNewYear: (newYear: number, mode: 'clean' | 'clone_departments') => void;
  onDeleteYear?: (year: number) => void;
  sections: CCHCSection[];
  changeLog: ChangeLogEntry[];
  evaluation: OverallEvaluation;
  onUpdateSections: (newSections: CCHCSection[], note?: string) => void;
  onRestoreData: (newSections: CCHCSection[], newLogs: ChangeLogEntry[]) => void;
  gasConfig: GASConfig;
  onSaveGasConfig: (config: GASConfig) => void;
  onForceSync: () => Promise<void>;
  onReloadFromDrive: () => Promise<void>;
  isSyncing?: boolean;
  lastSyncTime?: string;
  driveFileId?: string;
  firebaseConnected?: boolean;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'years',
  availableYears,
  selectedYear,
  onSelectYear,
  onCreateNewYear,
  onDeleteYear,
  sections,
  changeLog,
  evaluation,
  onUpdateSections,
  onRestoreData,
  gasConfig,
  onSaveGasConfig,
  onForceSync,
  onReloadFromDrive,
  isSyncing = false,
  lastSyncTime = '',
  driveFileId = '',
  firebaseConnected = true,
}) => {
  const [activeTab, setActiveTab] = useState<'years' | 'evidence' | 'gas' | 'github' | 'firebase'>(initialTab);

  // --- TAB 1: Year Management State ---
  const [newYearInput, setNewYearInput] = useState<number>(() => {
    const maxYear = availableYears && availableYears.length > 0 ? Math.max(...availableYears) : 2026;
    return maxYear + 1;
  });
  const [newYearMode, setNewYearMode] = useState<'clean' | 'clone_departments'>('clean');
  const [yearSuccessMsg, setYearSuccessMsg] = useState<string>('');
  const [yearErrorMsg, setYearErrorMsg] = useState<string>('');

  // --- TAB 2: Drive Evidence State ---
  const [evidenceSubTab, setEvidenceSubTab] = useState<'scan' | 'batch' | 'upload' | 'list'>('batch');
  const [batchInputText, setBatchInputText] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedDriveImportItem[]>([]);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<DriveScanResult | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  // Direct upload in tab 2
  const [uploadCriterionCode, setUploadCriterionCode] = useState<string>('I.1.a');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadBase64, setUploadBase64] = useState<string>('');
  const [uploadDocNumber, setUploadDocNumber] = useState<string>('');
  const [uploadDocNote, setUploadDocNote] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // --- TAB 3: GAS & Connection State ---
  const [webAppUrl, setWebAppUrl] = useState<string>(gasConfig.webAppUrl || '');
  const [folderName, setFolderName] = useState<string>(gasConfig.driveFolderName || 'CCHC_2026_UBND_Phuong_Hoi_An_Dong');
  const [folderId, setFolderId] = useState<string>(gasConfig.driveFolderId || '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq');
  const [gasSubTab, setGasSubTab] = useState<'config' | 'script' | 'guide'>('config');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // --- TAB 4: GitHub Pages & Backup State ---
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Flatten all criteria
  const allCriteriaList = sections.flatMap((sec) =>
    sec.criteria.map((crit) => ({
      code: crit.code,
      title: crit.title,
      sectionRoman: sec.romanNumeral,
      sectionTitle: sec.title,
      maxScore: crit.maxScore,
    }))
  );

  // Flatten all attached evidence
  const allAttachedEvidence = sections.flatMap((sec) =>
    sec.criteria.flatMap((crit) =>
      (crit.evidenceList || []).map((ev) => ({
        ...ev,
        criterionCode: crit.code,
        criterionTitle: crit.title,
        sectionRoman: sec.romanNumeral,
        sectionTitle: sec.title,
      }))
    )
  );

  // Handler: Create New Year
  const handleCreateYear = (e: React.FormEvent) => {
    e.preventDefault();
    setYearErrorMsg('');
    setYearSuccessMsg('');

    if (!newYearInput || newYearInput < 2020 || newYearInput > 2099) {
      setYearErrorMsg('Vui lòng nhập năm hợp lệ từ 2020 đến 2099');
      return;
    }

    if (availableYears.includes(newYearInput)) {
      setYearErrorMsg(`Bản đánh giá năm ${newYearInput} đã tồn tại trong hệ thống!`);
      return;
    }

    onCreateNewYear(newYearInput, newYearMode);
    setYearSuccessMsg(`Đã khởi tạo thành công bản đánh giá CCHC cho năm ${newYearInput}!`);
    setTimeout(() => setYearSuccessMsg(''), 4000);
  };

  // Handler: Scan Drive
  const handleScanDrive = async () => {
    if (!gasConfig.webAppUrl) {
      alert('Vui lòng cấu hình Web App URL trong tab "Google Apps Script" trước khi quét!');
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    try {
      const result = await scanAndAutoMapDriveFiles(gasConfig.webAppUrl, sections);
      setScanResult(result);
    } catch (err: any) {
      setScanResult({
        success: false,
        message: 'Lỗi khi quét Google Drive: ' + (err?.message || 'Lỗi mạng'),
        totalFound: 0,
        newlyMappedCount: 0,
        files: [],
        unmappedFiles: [],
        updatedSections: sections,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Handler: Apply Scanned Files
  const handleApplyScannedFiles = () => {
    if (!scanResult || !scanResult.updatedSections) return;
    onUpdateSections(scanResult.updatedSections, `Đã gắn tự động ${scanResult.newlyMappedCount} minh chứng từ Google Drive vào các tiêu chí`);
    alert(`Đã gán thành công ${scanResult.newlyMappedCount} tệp minh chứng vào các tiêu chí tương ứng và đồng bộ lên hệ thống!`);
  };

  // Handler: Parse batch links
  const handleParseBatch = () => {
    if (!batchInputText.trim()) return;
    const items = parseDriveLinksAndFiles(batchInputText);
    setParsedItems(items);
  };

  // Handler: Apply batch items
  const handleApplyBatch = () => {
    if (parsedItems.length === 0) return;
    const res = batchAttachEvidenceItems(parsedItems, sections);
    onUpdateSections(res.updatedSections, `Đã nhập và gán ${res.attachedCount} link/tệp Drive vào tiêu chí`);
    setBatchSuccessMsg(`Đã gán thành công ${res.attachedCount} tệp minh chứng vào các tiêu chí CCHC!`);
    setBatchInputText('');
    setParsedItems([]);
    setTimeout(() => setBatchSuccessMsg(''), 5000);
  };

  // Handler: Direct file upload
  const handleDirectUploadFile = async () => {
    if (!uploadFileObj || !uploadBase64) {
      alert('Vui lòng chọn tệp tin từ máy tính');
      return;
    }

    if (!gasConfig.webAppUrl) {
      alert('Chưa cấu hình URL Google Apps Script!');
      return;
    }

    setIsUploading(true);
    setUploadMsg(null);

    try {
      const targetCrit = allCriteriaList.find((c) => c.code === uploadCriterionCode);
      const res = await sendGasRequest(gasConfig.webAppUrl, {
        action: 'uploadFile',
        fileName: uploadFileName,
        base64Data: uploadBase64,
        mimeType: uploadFileObj.type || 'application/pdf',
        sectionName: targetCrit ? targetCrit.sectionTitle : 'Chung',
        criterionCode: uploadCriterionCode,
        documentNumber: uploadDocNumber,
        note: uploadDocNote,
      });

      if (res && res.success && res.data) {
        const fileUrl = res.data.viewUrl || res.data.fileUrl;
        const fileId = res.data.fileId;

        const newEvidence: EvidenceFile = {
          id: 'ev-' + Date.now(),
          name: uploadFileName,
          type: uploadFileObj.type.includes('image') ? 'image' : uploadFileObj.type.includes('sheet') ? 'sheet' : 'pdf',
          size: `${(uploadFileObj.size / 1024).toFixed(1)} KB`,
          uploadDate: new Date().toLocaleDateString('vi-VN'),
          url: fileUrl,
          driveUrl: fileUrl,
          driveFileId: fileId,
          documentNumber: uploadDocNumber,
          note: uploadDocNote,
          uploadedBy: 'UBND Phường Hội An Đông',
        };

        const updated = sections.map((sec) => ({
          ...sec,
          criteria: sec.criteria.map((crit) => {
            if (crit.code === uploadCriterionCode) {
              const currentList = [...(crit.evidenceList || []), newEvidence];
              const newScore = crit.selfScore === 0 ? crit.maxScore : crit.selfScore;
              const newStatus = crit.status === 'not_started' ? 'completed' : crit.status;
              return {
                ...crit,
                evidenceList: currentList,
                selfScore: newScore,
                status: newStatus,
              };
            }
            return crit;
          }),
        }));

        onUpdateSections(updated, `Tải lên minh chứng ${uploadFileName} cho tiêu chí ${uploadCriterionCode}`);
        setUploadMsg({ text: `✅ Đã tải tệp lên Google Drive và gán thành công vào tiêu chí ${uploadCriterionCode}!`, isError: false });

        setUploadFileObj(null);
        setUploadFileName('');
        setUploadBase64('');
        setUploadDocNumber('');
        setUploadDocNote('');
      } else {
        setUploadMsg({ text: `❌ Lỗi khi tải lên Google Drive: ${res?.error || res?.message || 'Không thể upload'}`, isError: true });
      }
    } catch (e: any) {
      setUploadMsg({ text: `❌ Lỗi tải lên: ${e?.message || 'Lỗi mạng'}`, isError: true });
    } finally {
      setIsUploading(false);
    }
  };

  // Handler: Test GAS Connection
  const handleTestConnection = async () => {
    if (!webAppUrl) {
      alert('Vui lòng nhập Web App URL');
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await sendGasRequest(webAppUrl, { action: 'testConnection' }, 12000);
      if (res && res.success) {
        setTestResult({
          success: true,
          message: 'Kết nối Google Apps Script & Google Drive thành công!',
          details: res.data || res,
        });
        onSaveGasConfig({
          ...gasConfig,
          webAppUrl,
          driveFolderName: folderName,
          driveFolderId: folderId,
          connected: true,
          lastSync: new Date().toLocaleTimeString('vi-VN'),
        });
      } else {
        setTestResult({
          success: false,
          message: res?.error || res?.message || 'Không thể kết nối đến Web App',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Lỗi kết nối: ' + (err?.message || 'Kiểm tra lại quyền truy cập Anyone trên Google Apps Script'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Copy code helper
  const handleCopyCode = () => {
    const code = generateGoogleAppsScriptCode({ driveFolderName: folderName, driveFolderId: folderId });
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Backup export
  const handleExportBackup = () => {
    const backupData = {
      app: 'CCHC_PAR_INDEX_HOI_AN_DONG',
      year: selectedYear,
      exportedAt: new Date().toISOString(),
      organization: 'Ủy ban nhân dân Phường Hội An Đông - TP. Đà Nẵng',
      evaluation,
      sections,
      changeLog,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `Sao_Luu_CCHC_${selectedYear}_UBND_Hoi_An_Dong_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Backup import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreSuccess(null);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.sections && Array.isArray(parsed.sections)) {
          onRestoreData(parsed.sections, parsed.changeLog || []);
          setRestoreSuccess(`Khôi phục thành công dữ liệu với ${parsed.sections.length} lĩnh vực!`);
        } else {
          setRestoreError('Tệp không đúng định dạng sao lưu CCHC');
        }
      } catch (err) {
        setRestoreError('Không thể đọc tệp sao lưu JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center gap-3">
            <HoiAnDongLogo className="w-11 h-11 shrink-0 drop-shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                  ỦY BAN NHÂN DÂN PHƯỜNG HỘI AN ĐÔNG
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  Quản Trị Hệ Thống
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                CÀI ĐẶT HỆ THỐNG & ĐỒNG BỘ DỮ LIỆU
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unified Tab Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 pt-2 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('years')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t-2 cursor-pointer ${
              activeTab === 'years'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Năm Đánh Giá</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-mono">
              {selectedYear}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t-2 cursor-pointer ${
              activeTab === 'evidence'
                ? 'bg-white text-sky-700 border-sky-600 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <HardDrive className="w-4 h-4 text-sky-600" />
            <span>Minh Chứng Google Drive</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-mono">
              {allAttachedEvidence.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('gas')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t-2 cursor-pointer ${
              activeTab === 'gas'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <CloudUpload className="w-4 h-4 text-emerald-600" />
            <span>Apps Script & Drive</span>
            <span className={`w-2 h-2 rounded-full ${gasConfig.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t-2 cursor-pointer ${
              activeTab === 'github'
                ? 'bg-white text-slate-900 border-slate-800 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Github className="w-4 h-4 text-slate-800" />
            <span>GitHub Pages & Sao Lưu</span>
          </button>

          <button
            onClick={() => setActiveTab('firebase')}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-t-2 cursor-pointer ${
              activeTab === 'firebase'
                ? 'bg-white text-orange-700 border-orange-600 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Flame className="w-4 h-4 text-orange-600 fill-orange-500" />
            <span>Cơ Sở Dữ Liệu Firebase</span>
            <span className={`w-2 h-2 rounded-full ${firebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </button>
        </div>

        {/* Tab Contents Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* ========================================================================= */}
          {/* TAB 1: NĂM ĐÁNH GIÁ (YEAR MANAGEMENT)                                     */}
          {/* ========================================================================= */}
          {activeTab === 'years' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Top Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-bold shadow-md">
                    <span className="text-sm leading-none">{selectedYear}</span>
                    <span className="text-[9px] uppercase tracking-tighter opacity-80">Năm này</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Bản Đánh Giá CCHC Năm {selectedYear}
                      {selectedYear === 2026 && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                          ★ Năm Hiện Hành
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Tổng số tiêu chí: <strong>{evaluation.totalCriteriaCount}</strong> • Điểm tự chấm: <strong>{evaluation.finalScore}đ</strong> • Minh chứng: <strong>{evaluation.totalEvidenceCount} tệp</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 font-medium shadow-2xs">
                    Theo QĐ UBND Thành phố Đà Nẵng
                  </span>
                </div>
              </div>

              {/* List of Available Evaluation Years */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Danh Sách Các Năm Đánh Giá Trong Hệ Thống ({availableYears.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {availableYears.map((year) => {
                    const isCurrentYear = year === selectedYear;
                    const isBaseYear = year === 2026;

                    return (
                      <div
                        key={year}
                        className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                          isCurrentYear
                            ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black font-mono text-slate-900">{year}</span>
                            {isBaseYear && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                                Gốc 2026
                              </span>
                            )}
                          </div>
                          {isCurrentYear && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đang chọn
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500">
                          {isBaseYear ? 'Bộ tiêu chí chính thức UBND Phường Hội An Đông' : `Bản đánh giá độc lập năm ${year}`}
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          {!isCurrentYear ? (
                            <button
                              onClick={() => onSelectYear(year)}
                              className="w-full py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              Chuyển sang năm {year}
                            </button>
                          ) : (
                            <div className="w-full text-center py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg">
                              Đang làm việc trên năm này
                            </div>
                          )}

                          {!isBaseYear && onDeleteYear && (
                            <button
                              onClick={() => {
                                if (confirm(`Bạn có chắc muốn xóa bản đánh giá năm ${year}? Dữ liệu của năm này sẽ bị xóa.`)) {
                                  onDeleteYear(year);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              title={`Xóa bản đánh giá năm ${year}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form: Create New Evaluation Year */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Tạo Bản Đánh Giá Mới Cho Những Năm Tiếp Theo
                    </h4>
                    <p className="text-xs text-slate-500">
                      Khởi tạo bộ tiêu chí CCHC riêng biệt cho năm 2027, 2028,... không ảnh hưởng đến dữ liệu năm 2026.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateYear} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Năm đánh giá mới *
                      </label>
                      <input
                        type="number"
                        min={2020}
                        max={2099}
                        value={newYearInput}
                        onChange={(e) => setNewYearInput(parseInt(e.target.value) || 2027)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        placeholder="VD: 2027"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Phương thức khởi tạo dữ liệu
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2 transition ${
                            newYearMode === 'clean'
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name="yearMode"
                            checked={newYearMode === 'clean'}
                            onChange={() => setNewYearMode('clean')}
                            className="mt-0.5 text-indigo-600"
                          />
                          <div>
                            <div className="font-bold">Khung tiêu chí chuẩn mới</div>
                            <div className="text-[11px] text-slate-500">
                              0 điểm, chưa có minh chứng, chuẩn bị thẩm định năm mới.
                            </div>
                          </div>
                        </label>

                        <label
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2 transition ${
                            newYearMode === 'clone_departments'
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name="yearMode"
                            checked={newYearMode === 'clone_departments'}
                            onChange={() => setNewYearMode('clone_departments')}
                            className="mt-0.5 text-indigo-600"
                          />
                          <div>
                            <div className="font-bold">Kế thừa phân công phòng ban</div>
                            <div className="text-[11px] text-slate-500">
                              Giữ lại đơn vị phụ trách, điểm số và minh chứng đặt lại về 0.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {yearErrorMsg && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{yearErrorMsg}</span>
                    </div>
                  )}

                  {yearSuccessMsg && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{yearSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Khởi tạo bản đánh giá năm {newYearInput}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MINH CHỨNG GOOGLE DRIVE (DRIVE EVIDENCE HUB)                       */}
          {/* ========================================================================= */}
          {activeTab === 'evidence' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Evidence Subtabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setEvidenceSubTab('batch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    evidenceSubTab === 'batch'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Dán & Nhận Diện Hàng Loạt Link Drive</span>
                </button>

                <button
                  onClick={() => setEvidenceSubTab('scan')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    evidenceSubTab === 'scan'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Quét Thư Mục Google Drive</span>
                </button>

                <button
                  onClick={() => setEvidenceSubTab('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    evidenceSubTab === 'upload'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải File Trực Tiếp Lên Drive</span>
                </button>

                <button
                  onClick={() => setEvidenceSubTab('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    evidenceSubTab === 'list'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Danh Sách Minh Chứng ({allAttachedEvidence.length})</span>
                </button>
              </div>

              {/* Subtab 1: Batch paste */}
              {evidenceSubTab === 'batch' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-800 leading-relaxed">
                    💡 <strong>Tính năng nhận diện thông minh:</strong> Bạn chỉ cần sao chép và dán danh sách link Google Drive, tên tệp (ví dụ <code>I.2.b.1_Ke_hoach_CCHC_2026.pdf</code>) hoặc danh sách văn bản vào khung bên dưới. Hệ thống sẽ tự động quét mã tiêu chí và gán vào đúng mục!
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Nội dung dán danh sách tệp hoặc đường dẫn Drive:
                    </label>
                    <textarea
                      value={batchInputText}
                      onChange={(e) => setBatchInputText(e.target.value)}
                      rows={5}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder={`Ví dụ dán các dòng:\nhttps://drive.google.com/file/d/1ab.../view?usp=sharing - I.1.a Kế hoạch CCHC\nI.2.b.1_Bao_cao_cai_cach.pdf https://drive.google.com/open?id=1cd...`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleParseBatch}
                      disabled={!batchInputText.trim()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Nhận diện các mục</span>
                    </button>

                    {parsedItems.length > 0 && (
                      <button
                        onClick={handleApplyBatch}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Gán {parsedItems.length} minh chứng này vào hệ thống</span>
                      </button>
                    )}
                  </div>

                  {batchSuccessMsg && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{batchSuccessMsg}</span>
                    </div>
                  )}

                  {parsedItems.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <div className="bg-slate-100 p-2.5 font-bold text-xs text-slate-700 border-b border-slate-200 flex items-center justify-between">
                        <span>Kết quả nhận diện ({parsedItems.length} mục)</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {parsedItems.map((item, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-sky-700 font-mono px-1.5 py-0.5 rounded bg-sky-50 mr-2">
                                {item.criterionCode || 'Chưa rõ mã'}
                              </span>
                              <span className="font-medium text-slate-800 truncate">{item.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              ID: {item.driveFileId ? `${item.driveFileId.slice(0, 8)}...` : 'Tên tệp'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 2: Drive Auto-scan */}
              {evidenceSubTab === 'scan' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                        Quét Thư Mục Google Drive Của UBND Phường Hội An Đông
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Thư mục: <code>{gasConfig.driveFolderName || 'CCHC_2026_UBND_Phuong_Hoi_An_Dong'}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleScanDrive}
                        disabled={isScanning}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                        <span>{isScanning ? 'Đang quét...' : 'Quét & Nhận diện ngay'}</span>
                      </button>
                    </div>
                  </div>

                  {scanResult && (
                    <div className="space-y-3">
                      <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
                        scanResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <span>{scanResult.message}</span>
                        {scanResult.files && scanResult.files.filter((f) => f.mappedCriterionCode).length > 0 && (
                          <button
                            onClick={handleApplyScannedFiles}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer"
                          >
                            Áp dụng {scanResult.files.filter((f) => f.mappedCriterionCode).length} tệp vào tiêu chí
                          </button>
                        )}
                      </div>

                      {scanResult.files && scanResult.files.filter((f) => f.mappedCriterionCode).length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase">
                              <tr>
                                <th className="p-2.5">Tiêu chí</th>
                                <th className="p-2.5">Tên tệp tìm thấy trên Drive</th>
                                <th className="p-2.5">Xem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {scanResult.files
                                .filter((f) => f.mappedCriterionCode)
                                .map((file, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-bold font-mono text-sky-700">{file.mappedCriterionCode}</td>
                                    <td className="p-2.5 text-slate-800">{file.name}</td>
                                    <td className="p-2.5">
                                      <a
                                        href={file.viewUrl || file.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-600 hover:underline flex items-center gap-1 font-semibold"
                                      >
                                        <ExternalLink className="w-3 h-3" /> Mở
                                      </a>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 3: Direct Upload */}
              {evidenceSubTab === 'upload' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Chọn Tiêu chí đính kèm *
                      </label>
                      <select
                        value={uploadCriterionCode}
                        onChange={(e) => setUploadCriterionCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white"
                      >
                        {allCriteriaList.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} - {c.title.slice(0, 50)}... ({c.maxScore}đ)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Tệp tin từ máy tính *
                      </label>
                      <input
                        type="file"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const f = e.target.files[0];
                            setUploadFileObj(f);
                            setUploadFileName(f.name);
                            const r = new FileReader();
                            r.onload = () => setUploadBase64(r.result as string);
                            r.readAsDataURL(f);
                          }
                        }}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Số / Ký hiệu văn bản
                      </label>
                      <input
                        type="text"
                        value={uploadDocNumber}
                        onChange={(e) => setUploadDocNumber(e.target.value)}
                        placeholder="VD: 15/KH-UBND"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Trích yếu / Ghi chú
                      </label>
                      <input
                        type="text"
                        value={uploadDocNote}
                        onChange={(e) => setUploadDocNote(e.target.value)}
                        placeholder="VD: Kế hoạch CCHC năm 2026 của UBND phường"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {uploadMsg && (
                    <div className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                      uploadMsg.isError ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      <span>{uploadMsg.text}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end">
                    <button
                      onClick={handleDirectUploadFile}
                      disabled={isUploading || !uploadFileObj}
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                      <span>{isUploading ? 'Đang tải lên Drive...' : 'Tải lên Google Drive ngay'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Subtab 4: List all attached evidence */}
              {evidenceSubTab === 'list' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Tìm theo tên file hoặc tiêu chí..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      Tổng cộng: <strong>{allAttachedEvidence.length}</strong> tệp minh chứng
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    {allAttachedEvidence.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Chưa có tài liệu minh chứng nào được gắn vào các tiêu chí.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase">
                          <tr>
                            <th className="p-2.5">Tiêu chí</th>
                            <th className="p-2.5">Tên tài liệu / Văn bản</th>
                            <th className="p-2.5">Số hiệu</th>
                            <th className="p-2.5">Ngày lưu</th>
                            <th className="p-2.5 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allAttachedEvidence
                            .filter(
                              (e) =>
                                !searchFilter ||
                                e.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                e.criterionCode.toLowerCase().includes(searchFilter.toLowerCase())
                            )
                            .map((ev, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold font-mono text-sky-700">{ev.criterionCode}</td>
                                <td className="p-2.5 text-slate-900 font-medium">{ev.name}</td>
                                <td className="p-2.5 text-slate-600 font-mono">{ev.documentNumber || '—'}</td>
                                <td className="p-2.5 text-slate-400">{ev.uploadDate}</td>
                                <td className="p-2.5 text-right">
                                  <a
                                    href={ev.driveUrl || ev.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold inline-flex items-center gap-1 border border-sky-200"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Mở Drive
                                  </a>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: GOOGLE APPS SCRIPT & KẾT NỐI (GAS & DRIVE CONNECTION)               */}
          {/* ========================================================================= */}
          {activeTab === 'gas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* GAS subtabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => setGasSubTab('config')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    gasSubTab === 'config' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cấu Hình & Kiểm Tra Kết Nối
                </button>
                <button
                  onClick={() => setGasSubTab('script')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    gasSubTab === 'script' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Mã Nguồn Apps Script (Phiên Bản Hỗ Trợ Xóa Tệp)</span>
                </button>
              </div>

              {gasSubTab === 'config' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        URL Web App Google Apps Script *
                      </label>
                      <input
                        type="url"
                        value={webAppUrl}
                        onChange={(e) => setWebAppUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Tên Thư Mục Google Drive
                      </label>
                      <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        ID Thư Mục Google Drive (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={folderId}
                        onChange={(e) => setFolderId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                      </button>

                      <button
                        onClick={onForceSync}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                        <span>Lưu toàn bộ lên Drive</span>
                      </button>

                      <button
                        onClick={onReloadFromDrive}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải lại từ Drive</span>
                      </button>
                    </div>

                    {lastSyncTime && (
                      <span className="text-xs text-slate-500 font-medium">
                        Lần lưu gần nhất: <strong>{lastSyncTime}</strong>
                      </span>
                    )}
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                      testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}

              {gasSubTab === 'script' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start justify-between gap-3">
                    <div>
                      <strong>Hướng dẫn kích hoạt tính năng XÓA FILE TRỰC TIẾP TRÊN DRIVE:</strong>
                      <p className="mt-1">
                        Mã Google Apps Script dưới đây đã được tích hợp đầy đủ lệnh <code>deleteFile</code> (chuyển tệp vào thùng rác trên Drive), <code>uploadFile</code>, <code>getDriveFiles</code>, và <code>saveData</code>.
                        Hãy nhấp nút <strong>"Sao chép toàn bộ mã"</strong> và dán đè vào trình soạn thảo Google Apps Script của bạn tại <code>script.google.com</code>, sau đó nhấn <strong>Deploy &gt; Manage deployments &gt; Edit &gt; New version &gt; Deploy</strong>.
                      </p>
                    </div>

                    <button
                      onClick={handleCopyCode}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Đã sao chép!' : 'Sao chép toàn bộ mã'}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[11px] font-mono max-h-80 overflow-y-auto leading-relaxed border border-slate-800">
                      {generateGoogleAppsScriptCode({ driveFolderName: folderName, driveFolderId: folderId })}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: GITHUB PAGES & SAO LƯU (DEPLOY & BACKUP)                           */}
          {/* ========================================================================= */}
          {activeTab === 'github' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/10 text-white border border-white/20">
                    <Github className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Xuất Bản &amp; Hoạt Động Trực Tiếp Trên GitHub Pages</h4>
                    <p className="text-xs text-slate-400">
                      Ứng dụng đã được tối ưu tĩnh 100%, chạy trực tiếp trên GitHub Pages mà không cần bất kỳ máy chủ nào.
                    </p>
                  </div>
                </div>

                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở GitHub</span>
                </a>
              </div>

              {/* Backup & Restore Data section */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-600" />
                  Sao Lưu &amp; Khôi Phục Dữ Liệu Bộ Chỉ Số Năm {selectedYear}
                </h4>
                <p className="text-xs text-slate-600">
                  Tải xuống toàn bộ dữ liệu tự chấm điểm, phân công phòng ban và danh sách tệp minh chứng Google Drive thành tệp JSON để lưu trữ an toàn hoặc chuyển sang máy tính khác.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={handleExportBackup}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất tệp sao lưu JSON năm {selectedYear}</span>
                  </button>

                  <label className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Khôi phục dữ liệu từ file JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>

                {restoreSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{restoreSuccess}</span>
                  </div>
                )}

                {restoreError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>{restoreError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: CƠ SỞ DỮ LIỆU FIREBASE (FIREBASE FIRESTORE SYNC)                    */}
          {/* ========================================================================= */}
          {activeTab === 'firebase' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md">
                    <Flame className="w-6 h-6 fill-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        Firebase Cloud Firestore
                      </h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        firebaseConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${firebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        {firebaseConnected ? 'Đã kết nối trực tuyến' : 'Ngoại tuyến'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Đồng bộ dữ liệu điểm số và tiến độ tự động theo thời gian thực trên mọi máy tính và điện thoại.
                    </p>
                  </div>
                </div>

                <div className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-slate-700 font-semibold shadow-2xs">
                  Project: {firebaseConfig.projectId}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h5 className="font-bold text-xs uppercase text-slate-700">Thông tin cấu hình Firebase</h5>
                  <div className="text-xs space-y-1 font-mono text-slate-600">
                    <div><strong>Project ID:</strong> {firebaseConfig.projectId}</div>
                    <div><strong>Auth Domain:</strong> {firebaseConfig.authDomain}</div>
                    <div><strong>Storage Bucket:</strong> {firebaseConfig.storageBucket}</div>
                    <div><strong>App ID:</strong> {firebaseConfig.appId}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h5 className="font-bold text-xs uppercase text-slate-700">Cơ chế lưu trữ kép</h5>
                  <div className="text-xs text-slate-600 leading-relaxed space-y-1">
                    <p>• <strong>Dữ liệu điểm &amp; tiến độ:</strong> Lưu vào Firestore theo thời gian thực (&lt;500ms phản hồi).</p>
                    <p>• <strong>Tài liệu, tệp, ảnh, video minh chứng:</strong> Lưu trực tiếp trên Google Drive của UBND Phường như yêu cầu.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            * Mọi thay đổi trong Cài đặt Hệ thống được tự động lưu và đồng bộ tức thì
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            Đóng Cài Đặt
          </button>
        </div>

      </div>
    </div>
  );
};
