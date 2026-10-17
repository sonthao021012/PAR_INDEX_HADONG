import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  ExternalLink, 
  CheckCircle, 
  HardDrive, 
  AlertCircle,
  FileSpreadsheet,
  Link2,
  Calendar,
  Save,
  Eye,
  Plus,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { CCHCSubCriterion, CCHCSection, EvidenceFile, CriterionStatus, GASConfig } from '../types/cchc.ts';
import { validateCriterionScore, getDriveFolderPath } from '../utils/cchcRules.ts';
import { sendGasRequest, deleteDriveEvidenceFile, extractDriveFileId } from '../services/gasClient.ts';

interface CriterionDetailModalProps {
  criterion: CCHCSubCriterion | null;
  section: CCHCSection | null;
  gasConfig: GASConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveCriterion: (updatedCriterion: CCHCSubCriterion) => Promise<void> | void;
  onPreviewEvidence: (evidence: EvidenceFile) => void;
}

export const CriterionDetailModal: React.FC<CriterionDetailModalProps> = ({
  criterion,
  section,
  gasConfig,
  isOpen,
  onClose,
  onSaveCriterion,
  onPreviewEvidence,
}) => {
  if (!isOpen || !criterion || !section) return null;

  const [selfScore, setSelfScore] = useState<number>(criterion.selfScore);
  const [status, setStatus] = useState<CriterionStatus>(criterion.status);
  const [department, setDepartment] = useState<string>(criterion.department);
  const [notes, setNotes] = useState<string>(criterion.notes || '');
  const [evidenceList, setEvidenceList] = useState<EvidenceFile[]>(criterion.evidenceList || []);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Upload Form State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [docNumber, setDocNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>('');
  const [docNote, setDocNote] = useState<string>('');
  const [customDriveUrl, setCustomDriveUrl] = useState<string>('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    driveUrl?: string;
  } | null>(null);
  const [unuploadedWarning, setUnuploadedWarning] = useState<string | null>(null);

  const isPenalty = section.type === 'penalty';
  const isBonus = section.type === 'bonus';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFileObj(file);
      setUploadFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddEvidence = async () => {
    if (!uploadFileName && !customDriveUrl) {
      alert('Vui lòng chọn tệp tải lên hoặc dán đường dẫn Google Drive!');
      return;
    }

    setIsUploading(true);

    try {
      let finalDriveUrl = customDriveUrl;
      let finalDriveFileId = 'drive-' + Date.now();
      const folderPath = getDriveFolderPath(section.romanNumeral, section.title, criterion.code);

      // Call Google Apps Script Web App (either via local proxy or direct fetch)
      if (gasConfig.webAppUrl && fileBase64) {
        try {
          const payload = {
            action: 'uploadFile',
            fileName: uploadFileName,
            base64Data: fileBase64,
            mimeType: selectedFileObj?.type || 'application/pdf',
            sectionName: `${section.romanNumeral}_${section.title.slice(0, 20)}`,
            criterionCode: criterion.code,
            documentNumber: docNumber,
            note: docNote,
          };

          // Use multi-environment sendGasRequest (proxy in dev, direct in GitHub Pages)
          const resData = await sendGasRequest(gasConfig.webAppUrl, payload);

          if (resData && resData.success && resData.data) {
            finalDriveUrl = resData.data.viewUrl || resData.data.fileUrl;
            finalDriveFileId = resData.data.fileId || finalDriveFileId;
          }
        } catch (err) {
          console.warn('Upload qua Apps Script gặp cảnh báo mạng, lưu trữ tệp và gắn liên kết Drive:', err);
        }
      }

      // If no custom Drive URL was provided and no upload result, format standard Drive search link
      if (!finalDriveUrl) {
        finalDriveUrl = gasConfig.driveFolderId
          ? `https://drive.google.com/drive/folders/${gasConfig.driveFolderId}`
          : `https://drive.google.com/drive/search?q=${encodeURIComponent(criterion.code)}`;
      }

      // Determine file type
      let type: 'pdf' | 'image' | 'doc' | 'sheet' | 'link' = 'pdf';
      const nameLower = uploadFileName.toLowerCase();
      if (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
        type = 'image';
      } else if (nameLower.endsWith('.xls') || nameLower.endsWith('.xlsx') || nameLower.endsWith('.csv')) {
        type = 'sheet';
      } else if (nameLower.endsWith('.doc') || nameLower.endsWith('.docx')) {
        type = 'doc';
      } else if (customDriveUrl && !selectedFileObj) {
        type = 'link';
      }

      const newEvidence: EvidenceFile = {
        id: 'ev-' + Date.now(),
        name: uploadFileName || `Minh chứng ${criterion.code}`,
        type,
        size: selectedFileObj ? `${(selectedFileObj.size / (1024 * 1024)).toFixed(2)} MB` : 'Google Drive Link',
        uploadDate: new Date().toISOString().split('T')[0],
        url: fileBase64 || finalDriveUrl,
        driveUrl: finalDriveUrl,
        driveFileId: finalDriveFileId,
        documentNumber: docNumber || undefined,
        issueDate: issueDate || undefined,
        note: docNote || undefined,
        uploadedBy: 'UBND Phường Hội An Đông'
      };

      const updated = [newEvidence, ...evidenceList];
      setEvidenceList(updated);

      const newStatus = status === 'not_started' ? 'completed' : status;
      const newScore = selfScore === 0 ? criterion.maxScore : selfScore;
      setStatus(newStatus);
      setSelfScore(newScore);

      // Tự động lưu và đồng bộ ngay lập tức vào tiêu chí để không bị mất khi đóng modal
      onSaveCriterion({
        ...criterion,
        selfScore: validateCriterionScore(newScore, criterion.maxScore),
        status: newStatus,
        department,
        notes,
        evidenceList: updated,
      });

      setUploadSuccessMsg('✅ Đã lưu và gắn minh chứng thành công vào tiêu chí (Đã đồng bộ thời gian thực)!');
      setTimeout(() => setUploadSuccessMsg(''), 4000);

      // Reset form
      setUploadFileName('');
      setSelectedFileObj(null);
      setFileBase64('');
      setDocNumber('');
      setIssueDate('');
      setDocNote('');
      setCustomDriveUrl('');
      setShowAddForm(false);
    } catch (error) {
      console.error(error);
      alert('Có lỗi khi xử lý tệp: ' + String(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    const target = evidenceList.find((item: EvidenceFile) => item.id === id);
    if (!target) return;

    const fileId = target.driveFileId || extractDriveFileId(target.driveUrl) || extractDriveFileId(target.url);
    const driveName = target.name;

    const confirmMsg = fileId || target.driveUrl
      ? `Bạn có chắc chắn muốn xóa minh chứng "${driveName}"?\n\nHệ thống sẽ:\n1. Xóa minh chứng khỏi tiêu chí ${criterion.code}.\n2. Gửi yêu cầu xóa và chuyển tệp vào thùng rác trên Google Drive.`
      : `Bạn có chắc chắn muốn xóa minh chứng "${driveName}" khỏi tiêu chí ${criterion.code}?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setDeletingId(id);
    setDeleteFeedback(null);

    let driveNotice = '';
    const fileUrlToView = target.driveUrl || target.url;

    // Gửi lệnh xóa file thực tế trên Google Drive qua Google Apps Script
    if (gasConfig.webAppUrl) {
      try {
        const delRes = await deleteDriveEvidenceFile(target, gasConfig.webAppUrl);
        if (delRes.deleted) {
          driveNotice = `✅ Đã xóa tệp "${driveName}" và chuyển vào thùng rác trên Google Drive thành công!`;
        } else if (delRes.notSupportedInScript) {
          driveNotice = `ℹ️ Đã xóa thông tin minh chứng khỏi tiêu chí thành công.\n⚠️ Lưu ý: Phiên bản Apps Script hiện tại trên Drive của bạn chưa cập nhật hàm "deleteFile". Bạn hãy vào "CÀI ĐẶT HỆ THỐNG" để cập nhật mã Apps Script mới nhất, hoặc nhấp vào link tệp để xóa thủ công trên Drive.`;
        } else {
          driveNotice = `ℹ️ Đã xóa thông tin khỏi tiêu chí. (${delRes.message})`;
        }
      } catch (err: any) {
        driveNotice = `ℹ️ Đã xóa thông tin khỏi tiêu chí. (Chưa thể kết nối Drive để xóa tệp)`;
      }
    }

    const updated = evidenceList.filter((item: EvidenceFile) => item.id !== id);
    setEvidenceList(updated);
    setDeletingId(null);

    if (driveNotice) {
      setDeleteFeedback({
        type: driveNotice.startsWith('✅') ? 'success' : 'warning',
        message: driveNotice,
        driveUrl: fileUrlToView,
      });
      setTimeout(() => {
        setDeleteFeedback(null);
      }, 9000);
    }
  };

  const executeFinalSave = async () => {
    setIsSaving(true);
    setUnuploadedWarning(null);
    try {
      const validated = validateCriterionScore(selfScore, criterion.maxScore);
      await onSaveCriterion({
        ...criterion,
        selfScore: validated,
        status,
        department,
        notes,
        evidenceList,
      });
      onClose();
    } catch (err) {
      console.error('Lỗi lưu tiêu chí:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    // 1. Kiểm tra nếu đang có tệp đang tải lên Google Drive
    if (isUploading) {
      setUnuploadedWarning('Hệ thống đang tải tệp minh chứng lên Google Drive. Vui lòng đợi hoàn tất trước khi bấm Lưu!');
      return;
    }

    // 2. Kiểm tra nếu người dùng đã chọn tệp nhưng chưa bấm tải lên
    if (showAddForm && (selectedFileObj || customDriveUrl.trim())) {
      setUnuploadedWarning('Bạn đang có tệp minh chứng đã chọn nhưng chưa bấm "Tải lên Google Drive". Hãy bấm nút Tải lên Google Drive trước, hoặc bấm "Bỏ qua & Lưu" nếu không cần tệp này.');
      return;
    }

    await executeFinalSave();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 text-white p-4 sm:p-5 flex items-start justify-between border-b-2 border-amber-500">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 bg-red-950/70 px-2 py-0.5 rounded border border-amber-500/30">
                {section.romanNumeral}. {section.title}
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono font-bold">
                MÃ: {criterion.code}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight">
              {criterion.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-sm">
          
          {/* Section 1: Hướng dẫn chấm điểm từ Quyết định */}
          <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Quy định chấm điểm & Điều kiện đạt điểm (Theo QĐ UBND TP. Đà Nẵng)
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              {criterion.scoringGuide}
            </p>
            {criterion.deadline && (
              <div className="mt-2 text-xs font-semibold text-red-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Thời hạn hoàn thành theo quy định: {criterion.deadline}
              </div>
            )}
          </div>

          {/* Section 2: Form Tự chấm điểm & Trạng thái */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Điểm chuẩn tối đa
              </label>
              <div className="px-3 py-2 bg-slate-200/80 rounded-lg font-bold text-slate-700 text-sm">
                {isPenalty ? `-${criterion.maxScore}` : isBonus ? `+${criterion.maxScore}` : criterion.maxScore} điểm
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Điểm đơn vị tự chấm
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max={criterion.maxScore}
                value={selfScore}
                onChange={(e) => setSelfScore(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Tiến độ thực hiện
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CriterionStatus)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-red-500"
              >
                <option value="completed">Đã hoàn thành</option>
                <option value="outstanding">Xuất sắc</option>
                <option value="in_progress">Đang triển khai</option>
                <option value="not_started">Chưa thực hiện</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Bộ phận / Cán bộ chủ trì thực hiện
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="VD: Văn phòng - Thống kê, Tư pháp - Hộ tịch..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Ghi chú giải trình tự đánh giá
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nêu tóm tắt kết quả thực hiện, số liệu kiểm tra hoặc cơ sở chấm điểm..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Section 3: Quản lý File & Ảnh Minh Chứng (Lưu trên Google Drive) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Tài Liệu Kiểm Chứng & Minh Chứng (Google Drive)
                </h3>
                <span className="bg-sky-100 text-sky-800 text-xs px-2 py-0.5 rounded-full font-bold">
                  {evidenceList.length} tệp
                </span>
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{showAddForm ? 'Đóng form tải lên' : 'Tải lên File / Ảnh mới'}</span>
              </button>
            </div>

            {uploadSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {/* Upload / Add Form */}
            {showAddForm && (
              <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-200 space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-sky-950 uppercase tracking-wider flex items-center justify-between">
                  <span>Tải tệp minh chứng vào thư mục Google Drive:</span>
                  <span className="text-[11px] font-mono text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded">
                    {getDriveFolderPath(section.romanNumeral, section.title, criterion.code)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      1. Chọn File hoặc Ảnh từ máy (PDF, Scan dấu đỏ, Ảnh chụp màn hình, Docx, Excel):
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileChange}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                    />
                    {uploadFileName && (
                      <p className="mt-1 text-slate-600 font-mono text-[11px]">
                        Tệp đã chọn: <strong className="text-slate-800">{uploadFileName}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Hoặc dán trực tiếp Liên kết Google Drive / Thư mục Drive:
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="url"
                        value={customDriveUrl}
                        onChange={(e) => setCustomDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/file/d/... hoặc folder..."
                        className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      2. Số / Ký hiệu văn bản:
                    </label>
                    <input
                      type="text"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="VD: 89/KH-UBND, 12/BC-UBND, Trang TTĐT..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      3. Ngày ban hành văn bản:
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      4. Trích yếu nội dung văn bản minh chứng:
                    </label>
                    <input
                      type="text"
                      value={docNote}
                      onChange={(e) => setDocNote(e.target.value)}
                      placeholder="VD: Kế hoạch triển khai công tác CCHC năm 2026 của UBND phường Hội An Đông"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleAddEvidence}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Đang tải lên Drive...' : 'Lưu minh chứng vào Drive'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Delete Feedback Banner */}
            {deleteFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2.5 animate-in fade-in duration-200 ${
                  deleteFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {deleteFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium whitespace-pre-line">{deleteFeedback.message}</p>
                    {deleteFeedback.driveUrl && deleteFeedback.type !== 'success' && (
                      <a
                        href={deleteFeedback.driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-sky-700 underline mt-1.5 hover:text-sky-900"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở vị trí tệp trên Google Drive để kiểm tra / xóa</span>
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setDeleteFeedback(null)}
                  className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Evidence List */}
            {evidenceList.length === 0 ? (
              <div className="text-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">Chưa có tài liệu kiểm chứng đính kèm</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Theo quy định của UBND TP, các tiêu chí cần có tài liệu minh chứng lưu trên Drive để đoàn thẩm định chấm điểm.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {evidenceList.map((ev: EvidenceFile) => (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-sky-300 transition gap-2 shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0 mt-0.5">
                        {ev.type === 'image' ? <ImageIcon className="w-4 h-4" /> :
                         ev.type === 'sheet' ? <FileSpreadsheet className="w-4 h-4" /> :
                         <FileText className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                            {ev.name}
                          </h4>
                          {ev.documentNumber && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200">
                              Số: {ev.documentNumber}
                            </span>
                          )}
                          {ev.issueDate && (
                            <span className="text-[10px] text-slate-500">
                              Ngày: {ev.issueDate}
                            </span>
                          )}
                        </div>
                        {ev.note && (
                          <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                            {ev.note}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-mono">
                          <span>{ev.size || 'Google Drive'}</span>
                          <span>•</span>
                          <span>Cập nhật: {ev.uploadDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => onPreviewEvidence(ev)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
                        title="Xem trước tài liệu / ảnh"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem</span>
                      </button>

                      <a
                        href={ev.driveUrl || ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 transition flex items-center gap-1 border border-sky-200 cursor-pointer"
                        title="Mở tài liệu trên Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Drive</span>
                      </a>

                      <button
                        onClick={() => handleDeleteEvidence(ev.id)}
                        disabled={deletingId === ev.id}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                        title="Xóa minh chứng này khỏi tiêu chí và Google Drive"
                      >
                        {deletingId === ev.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Unuploaded Warning Banner */}
        {unuploadedWarning && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs text-amber-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium">{unuploadedWarning}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={() => setUnuploadedWarning(null)}
                className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 transition cursor-pointer"
              >
                Đóng
              </button>
              {showAddForm && (selectedFileObj || customDriveUrl.trim()) && !isUploading && (
                <button
                  onClick={executeFinalSave}
                  className="px-3 py-1 rounded-md bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition cursor-pointer shadow-xs"
                >
                  Bỏ qua tệp &amp; Lưu ngay
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Bấm nút <strong>"Lưu"</strong> để cập nhật dữ liệu lên Firebase và đồng bộ thời gian thực sang các máy khác.</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              Đóng
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Lưu dữ liệu lên Firebase và cập nhật tức thì sang các máy khác"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Đang lưu...</span>
                </>
              ) : isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Đang tải minh chứng...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>Lưu</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
