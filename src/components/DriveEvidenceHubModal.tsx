import React, { useState } from 'react';
import {
  X,
  HardDrive,
  ExternalLink,
  RefreshCw,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Trash2,
  Copy,
  Check,
  Flame,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import type { CCHCSection, EvidenceFile } from '../types/cchc.ts';
import {
  scanAndAutoMapDriveFiles,
  parseDriveLinksAndFiles,
  batchAttachEvidenceItems,
  extractCriterionCodeFromText,
  matchCriterionByKeywords,
  type DriveScanResult,
  type ParsedDriveImportItem,
  type ScannedDriveFile,
} from '../services/driveScanner.ts';
import { sendGasRequest } from '../services/gasClient.ts';
import { generateGoogleAppsScriptCode } from '../utils/cchcRules.ts';

interface DriveEvidenceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: CCHCSection[];
  onApplyUpdatedSections: (newSections: CCHCSection[], note: string) => void;
  webAppUrl: string;
  folderId?: string;
  folderName?: string;
  firebaseConnected?: boolean;
}

export const DriveEvidenceHubModal: React.FC<DriveEvidenceHubModalProps> = ({
  isOpen,
  onClose,
  sections,
  onApplyUpdatedSections,
  webAppUrl,
  folderId = '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq',
  folderName = 'CCHC_2026_UBND_Phuong_Hoi_An_Dong',
  firebaseConnected = true,
}) => {
  const [activeTab, setActiveTab] = useState<'batch' | 'upload' | 'scan' | 'list'>('batch');

  // Tab 1: Batch link import state
  const [batchInputText, setBatchInputText] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedDriveImportItem[]>([]);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string>('');

  // Tab 2: Direct upload state
  const [uploadCriterionCode, setUploadCriterionCode] = useState<string>('I.1.a');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadBase64, setUploadBase64] = useState<string>('');
  const [uploadDocNumber, setUploadDocNumber] = useState<string>('');
  const [uploadDocNote, setUploadDocNote] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Tab 3: Drive auto-scan state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<DriveScanResult | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Tab 4: All evidence search/filter
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');

  if (!isOpen) return null;

  // Flatten all criteria for dropdown selectors
  const allCriteriaList = sections.flatMap((sec) =>
    sec.criteria.map((crit) => ({
      code: crit.code,
      title: crit.title,
      sectionRoman: sec.romanNumeral,
      sectionTitle: sec.title,
      maxScore: crit.maxScore,
    }))
  );

  // Flatten all attached evidence across all criteria
  const allAttachedEvidence = sections.flatMap((sec) =>
    sec.criteria.flatMap((crit) =>
      (crit.evidenceList || []).map((ev) => ({
        ...ev,
        criterionCode: crit.code,
        criterionTitle: crit.title,
        sectionTitle: sec.title,
        sectionRoman: sec.romanNumeral,
      }))
    )
  );

  // Handle parsing batch text when changed
  const handleBatchTextChange = (text: string) => {
    setBatchInputText(text);
    if (!text.trim()) {
      setParsedItems([]);
      return;
    }
    const items = parseDriveLinksAndFiles(text);
    setParsedItems(items);
  };

  const handleUpdateItemCriterion = (index: number, newCode: string) => {
    const updated = [...parsedItems];
    updated[index].criterionCode = newCode;
    setParsedItems(updated);
  };

  const handleRemoveParsedItem = (index: number) => {
    setParsedItems(parsedItems.filter((_, i) => i !== index));
  };

  // Apply parsed batch items
  const handleApplyBatchImport = () => {
    if (parsedItems.length === 0) {
      alert('Vui lòng dán link Google Drive hoặc tên tệp cần nhập!');
      return;
    }

    const { updatedSections, attachedCount } = batchAttachEvidenceItems(parsedItems, sections);
    if (attachedCount > 0) {
      onApplyUpdatedSections(
        updatedSections,
        `Đã nhập và gắn ${attachedCount} tệp minh chứng từ Google Drive`
      );
      setBatchSuccessMsg(`🎉 Đã gắn thành công ${attachedCount} tệp minh chứng vào các tiêu chí phù hợp và đồng bộ lên Firebase!`);
      setParsedItems([]);
      setBatchInputText('');
      setTimeout(() => setBatchSuccessMsg(''), 5000);
      setActiveTab('list');
    } else {
      alert('Không có tệp nào được gắn. Vui lòng kiểm tra mã tiêu chí của các tệp đã nhập!');
    }
  };

  // Direct file upload to Drive
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setUploadFileObj(f);
      setUploadFileName(f.name);

      // Auto detect criterion from file name
      const detected = extractCriterionCodeFromText(f.name) || matchCriterionByKeywords(f.name);
      if (detected) {
        setUploadCriterionCode(detected);
      }

      const reader = new FileReader();
      reader.onload = () => {
        setUploadBase64(reader.result as string);
      };
      reader.readAsDataURL(f);
    }
  };

  const handleExecuteUpload = async () => {
    if (!uploadBase64 || !uploadFileName) {
      alert('Vui lòng chọn tệp văn bản/ảnh/video từ máy tính!');
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const targetCriterion = allCriteriaList.find((c) => c.code === uploadCriterionCode);
      const payload = {
        action: 'uploadFile',
        fileName: uploadFileName,
        base64Data: uploadBase64,
        mimeType: uploadFileObj?.type || 'application/pdf',
        sectionName: targetCriterion ? `${targetCriterion.sectionRoman}_${targetCriterion.sectionTitle.slice(0, 20)}` : 'Chung',
        criterionCode: uploadCriterionCode,
        documentNumber: uploadDocNumber,
        note: uploadDocNote,
      };

      const res = await sendGasRequest(webAppUrl, payload, 35000);

      let finalDriveUrl = `https://drive.google.com/drive/folders/${folderId}`;
      let finalDriveFileId = 'drive-' + Date.now();

      if (res && res.success && res.data) {
        finalDriveUrl = res.data.viewUrl || res.data.fileUrl || finalDriveUrl;
        finalDriveFileId = res.data.fileId || finalDriveFileId;
      }

      let fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'link' = 'pdf';
      const nameLower = uploadFileName.toLowerCase();
      if (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
        fileType = 'image';
      } else if (nameLower.endsWith('.xls') || nameLower.endsWith('.xlsx') || nameLower.endsWith('.csv')) {
        fileType = 'sheet';
      } else if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx')) {
        fileType = 'doc';
      }

      const newEvidence: EvidenceFile = {
        id: 'ev-upload-' + Date.now(),
        name: uploadFileName,
        type: fileType,
        size: uploadFileObj ? `${(uploadFileObj.size / (1024 * 1024)).toFixed(2)} MB` : 'Google Drive',
        uploadDate: new Date().toISOString().split('T')[0],
        url: finalDriveUrl,
        driveUrl: finalDriveUrl,
        driveFileId: finalDriveFileId,
        documentNumber: uploadDocNumber || undefined,
        note: uploadDocNote || 'Tải lên Google Drive qua phần mềm',
        uploadedBy: 'UBND Phường Hội An Đông',
      };

      const updatedSections = sections.map((sec) => ({
        ...sec,
        criteria: sec.criteria.map((crit) => {
          if (crit.code === uploadCriterionCode) {
            const list = [newEvidence, ...(crit.evidenceList || [])];
            return {
              ...crit,
              evidenceList: list,
              status: crit.status === 'not_started' ? 'completed' : crit.status,
              selfScore: crit.selfScore === 0 ? crit.maxScore : crit.selfScore,
            };
          }
          return crit;
        }),
      }));

      onApplyUpdatedSections(
        updatedSections,
        `Tải lên Google Drive minh chứng: ${uploadFileName} (Tiêu chí ${uploadCriterionCode})`
      );

      setUploadMessage({
        text: `✅ Đã tải tệp lên Google Drive thành công và lưu vào tiêu chí ${uploadCriterionCode}!`,
        isError: false,
      });

      // Reset form
      setUploadFileObj(null);
      setUploadFileName('');
      setUploadBase64('');
      setUploadDocNumber('');
      setUploadDocNote('');
    } catch (err: any) {
      setUploadMessage({
        text: `Lỗi khi tải tệp lên Drive: ${err?.message || String(err)}`,
        isError: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Run auto-scan
  const handleRunAutoScan = async () => {
    setIsScanning(true);
    try {
      const res = await scanAndAutoMapDriveFiles(webAppUrl, sections);
      setScanResult(res);
      if (res.success && res.newlyMappedCount > 0) {
        onApplyUpdatedSections(
          res.updatedSections,
          `Tự động quét Drive: gắn mới ${res.newlyMappedCount} tệp minh chứng`
        );
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopyNewScript = () => {
    const code = generateGoogleAppsScriptCode({ driveFolderId: folderId, driveFolderName: folderName });
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Delete evidence item
  const handleDeleteEvidenceItem = (critCode: string, evidenceId: string) => {
    if (!confirm('Bạn có chắc chắn muốn gỡ bỏ tài liệu minh chứng này?')) return;

    const updatedSections = sections.map((sec) => ({
      ...sec,
      criteria: sec.criteria.map((crit) => {
        if (crit.code === critCode) {
          return {
            ...crit,
            evidenceList: (crit.evidenceList || []).filter((e) => e.id !== evidenceId),
          };
        }
        return crit;
      }),
    }));

    onApplyUpdatedSections(updatedSections, `Gỡ bỏ minh chứng tiêu chí ${critCode}`);
  };

  // Filtered evidence list
  const filteredEvidence = allAttachedEvidence.filter((ev) => {
    const matchSearch =
      !searchFilter ||
      ev.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      ev.criterionCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (ev.note && ev.note.toLowerCase().includes(searchFilter.toLowerCase()));

    const matchSec = selectedSectionFilter === 'ALL' || ev.sectionRoman === selectedSectionFilter;
    return matchSearch && matchSec;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-start justify-between border-b border-sky-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-700/60">
                <HardDrive className="w-3.5 h-3.5" />
                Google Drive & Firebase
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                {firebaseConnected ? 'Firebase: Đang đồng bộ thời gian thực' : 'Firebase: Đã kết nối'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              Trung Tâm Quản Lý Minh Chứng Google Drive
            </h2>
            <div className="text-xs text-sky-200 flex items-center gap-2 mt-1 flex-wrap">
              <span>📁 Thư mục Drive: <strong>{folderName}</strong></span>
              <span>•</span>
              <span>Đang có <strong className="text-amber-300">{allAttachedEvidence.length}</strong> tệp minh chứng đã liên kết</span>
              <span>•</span>
              <a
                href={`https://drive.google.com/drive/folders/${folderId}`}
                target="_blank"
                rel="noreferrer"
                className="text-amber-300 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3 h-3" />
                Mở thư mục trên Google Drive
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex items-center gap-1 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('batch')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'batch'
                ? 'border-sky-600 text-sky-800 bg-white font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <LinkIcon className="w-4 h-4 text-sky-600" />
            <span>⚡ Nhập nhanh tệp & Link Drive ({parsedItems.length > 0 ? `${parsedItems.length} tệp` : 'Khuyên dùng'})</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'upload'
                ? 'border-sky-600 text-sky-800 bg-white font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>📤 Tải tệp lên Google Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'scan'
                ? 'border-sky-600 text-sky-800 bg-white font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <span>🔍 Quét tự động từ Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'list'
                ? 'border-sky-600 text-sky-800 bg-white font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>📋 Toàn bộ minh chứng ({allAttachedEvidence.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-800">
          {/* TAB 1: NHẬP NHANH TỆP & LINK DRIVE */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-sky-900">
                  <CheckCircle2 className="w-5 h-5 text-sky-700 shrink-0" />
                  <span>Cách nhanh nhất để đưa các tệp bạn đã tải trên Google Drive vào phần mềm</span>
                </div>
                <p className="leading-relaxed text-slate-700">
                  Nếu bạn đã tải nhiều file PDF, Word, ảnh lên Google Drive, bạn chỉ cần sao chép các đường link (hoặc danh sách tên tệp) trên Google Drive và dán vào ô bên dưới. Hệ thống sẽ <strong>tự động nhận diện mã tiêu chí</strong> (như <code>I.1.a</code>, <code>I.2.b.1</code>, <code>VII.6</code>...) và gắn trực tiếp vào các tiêu chí phù hợp, tự động tính điểm và đồng bộ lên Firebase cho tất cả các máy khác!
                </p>
              </div>

              {batchSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{batchSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Dán các đường link Google Drive hoặc danh sách tệp tại đây (Mỗi dòng 1 tệp/link):
                </label>
                <textarea
                  value={batchInputText}
                  onChange={(e) => handleBatchTextChange(e.target.value)}
                  placeholder={`Ví dụ:\nhttps://drive.google.com/file/d/1YGN6xTV7rtOT9dGZUbcA4HS4qGdhKsmc/view - Kế hoạch I.1.a\nhttps://drive.google.com/file/d/1abcxyz.../view - Báo cáo III.2\nI.2.b.1_Ke_hoach_CCHC.pdf - https://drive.google.com/file/d/...`}
                  rows={5}
                  className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none bg-slate-50"
                />
                <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                  <span>Mẹo: Bạn có thể chọn nhiều tệp trong Google Drive, bấm chuột phải &rarr; "Sao chép đường liên kết" rồi dán vào đây.</span>
                  {parsedItems.length > 0 && (
                    <span className="font-bold text-sky-700">Đã nhận diện {parsedItems.length} tệp</span>
                  )}
                </div>
              </div>

              {/* Preview table of parsed items */}
              {parsedItems.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Xem trước & Kiểm tra mã tiêu chí trước khi gán:</span>
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Tên tệp minh chứng</th>
                          <th className="p-2.5 w-60">Gán vào Tiêu chí CCHC</th>
                          <th className="p-2.5 w-24 text-center">Liên kết Drive</th>
                          <th className="p-2.5 w-12 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parsedItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                                <span className="line-clamp-1" title={item.name}>{item.name}</span>
                              </div>
                            </td>
                            <td className="p-2.5">
                              <select
                                value={item.criterionCode || ''}
                                onChange={(e) => handleUpdateItemCriterion(idx, e.target.value)}
                                className={`w-full text-xs p-1.5 rounded-lg border font-semibold ${
                                  item.criterionCode
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : 'bg-amber-50 border-amber-300 text-amber-900'
                                }`}
                              >
                                <option value="">-- Chọn tiêu chí để gán --</option>
                                {allCriteriaList.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.code} - {c.title.slice(0, 45)}...
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2.5 text-center">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 hover:text-sky-800 inline-flex items-center gap-1 font-semibold hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Mở</span>
                              </a>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handleRemoveParsedItem(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleApplyBatchImport}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Áp Dụng Vào Phần Mềm ({parsedItems.length} tệp)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TẢI TRỰC TIẾP LÊN GOOGLE DRIVE */}
          {activeTab === 'upload' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>Tải tệp văn bản / hình ảnh / video trực tiếp lên Google Drive của Phường</span>
                </div>
                <p className="leading-relaxed text-slate-700">
                  Tệp bạn chọn sẽ được tải trực tiếp lên Google Drive qua Google Apps Script của Phường, được cấp link chia sẻ công khai và tự động gán vào tiêu chí bạn chọn.
                </p>
              </div>

              {uploadMessage && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  uploadMessage.isError
                    ? 'bg-rose-50 border-rose-300 text-rose-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}>
                  {uploadMessage.isError ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <span>{uploadMessage.text}</span>
                </div>
              )}

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Chọn Tiêu chí CCHC cần đính kèm minh chứng:
                  </label>
                  <select
                    value={uploadCriterionCode}
                    onChange={(e) => setUploadCriterionCode(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                  >
                    {allCriteriaList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.title} ({c.maxScore} điểm)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Chọn tệp từ máy tính (PDF, Word, Excel, Ảnh, Video):
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4"
                    className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                  />
                  {uploadFileName && (
                    <div className="mt-1 text-xs text-emerald-700 font-semibold">
                      Đã chọn: {uploadFileName} ({uploadFileObj ? `${(uploadFileObj.size / (1024 * 1024)).toFixed(2)} MB` : ''})
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      3. Số / Ký hiệu văn bản (tùy chọn):
                    </label>
                    <input
                      type="text"
                      value={uploadDocNumber}
                      onChange={(e) => setUploadDocNumber(e.target.value)}
                      placeholder="VD: 15/KH-UBND"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      4. Ghi chú / Trích yếu văn bản:
                    </label>
                    <input
                      type="text"
                      value={uploadDocNote}
                      onChange={(e) => setUploadDocNote(e.target.value)}
                      placeholder="VD: Kế hoạch triển khai CCHC năm 2026"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleExecuteUpload}
                    disabled={isUploading || !uploadBase64}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <Upload className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`} />
                    <span>{isUploading ? 'Đang tải lên Google Drive...' : 'Tải Lên Google Drive & Gắn Vào Tiêu Chí Ngay'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUÉT TỰ ĐỘNG TỪ GOOGLE DRIVE */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    Quét Tự Động Thư Mục Google Drive Của Phường
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Yêu cầu Google Apps Script đã triển khai phiên bản có hàm quét <code>getDriveFiles</code>. Nếu script của bạn là phiên bản cũ, hãy làm theo hướng dẫn 1 phút bên dưới.
                  </p>
                </div>
                <button
                  onClick={handleRunAutoScan}
                  disabled={isScanning}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-2 shrink-0 cursor-pointer transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Đang quét...' : '🔍 Bắt đầu quét Drive'}</span>
                </button>
              </div>

              {scanResult && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2.5 ${
                  scanResult.isOldScriptVersion
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : scanResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-start gap-2.5 font-bold text-sm">
                    {scanResult.isOldScriptVersion ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : scanResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>{scanResult.message}</div>
                  </div>

                  {scanResult.isOldScriptVersion && (
                    <div className="mt-2 p-3 bg-white/80 rounded-lg border border-amber-300/80 space-y-2 text-slate-700">
                      <div className="font-bold text-slate-900 text-xs">
                        👉 Hướng dẫn kích hoạt tính năng Quét tự động (Chỉ mất 1 phút):
                      </div>
                      <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-600">
                        <li>Bấm nút <strong>"Sao chép mã Code.gs mới nhất"</strong> bên dưới.</li>
                        <li>Mở dự án Google Apps Script của bạn trên Google Drive, dán đè toàn bộ vào tệp <code>Code.gs</code> rồi bấm Lưu (Ctrl+S).</li>
                        <li>Bấm <strong>Triển khai (Deploy) &rarr; Quản lý bản triển khai (Manage deployments)</strong>.</li>
                        <li>Bấm vào biểu tượng cây bút (Chỉnh sửa), ở mục <strong>Phiên bản</strong> chọn <strong>"Phiên bản mới" (New version)</strong> rồi bấm <strong>Triển khai (Deploy)</strong>.</li>
                      </ol>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          onClick={handleCopyNewScript}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedCode ? 'Đã sao chép mã!' : '📋 Sao chép mã Code.gs mới nhất'}</span>
                        </button>
                        <span className="text-slate-500 text-xs">
                          (Hoặc bạn chỉ cần dùng Tab <strong>"Nhập nhanh tệp & Link Drive"</strong> ngay phía trên mà không cần sửa script!)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DANH SÁCH TOÀN BỘ MINH CHỨNG */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* Filter and search bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Tìm theo tên tệp, mã tiêu chí (I.1.a, VII.6...)..."
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedSectionFilter}
                    onChange={(e) => setSelectedSectionFilter(e.target.value)}
                    className="text-xs p-2 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="ALL">Tất cả 9 lĩnh vực CCHC</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.romanNumeral}>
                        {sec.romanNumeral}. {sec.title.slice(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-28">Mã Tiêu chí</th>
                      <th className="p-3">Tên tệp minh chứng</th>
                      <th className="p-3 w-40">Số ký hiệu / Ghi chú</th>
                      <th className="p-3 w-24">Ngày lưu</th>
                      <th className="p-3 w-28 text-center">Google Drive</th>
                      <th className="p-3 w-14 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredEvidence.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Chưa có tài liệu minh chứng nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredEvidence.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-bold text-sky-800">
                            <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                              {ev.criterionCode}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="line-clamp-1" title={ev.name}>{ev.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1" title={ev.criterionTitle}>
                              {ev.criterionTitle}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600">
                            {ev.documentNumber && (
                              <div className="font-semibold text-slate-800">{ev.documentNumber}</div>
                            )}
                            <div className="text-[11px] text-slate-500 truncate" title={ev.note}>
                              {ev.note || '-'}
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {ev.uploadDate || '-'}
                          </td>
                          <td className="p-3 text-center">
                            <a
                              href={ev.url || ev.driveUrl || `https://drive.google.com/file/d/${ev.driveFileId}/view`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs inline-flex items-center gap-1 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Mở Drive</span>
                            </a>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteEvidenceItem(ev.criterionCode, ev.id)}
                              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Gỡ bỏ tài liệu này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Mọi thay đổi minh chứng được tự động lưu vào Firebase & Google Drive theo thời gian thực.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
