import React from 'react';
import { X, ExternalLink, HardDrive, FileText, Image as ImageIcon, Calendar, Tag, User } from 'lucide-react';
import { EvidenceFile } from '../types/cchc.ts';

interface EvidencePreviewModalProps {
  evidence: EvidenceFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidencePreviewModal: React.FC<EvidencePreviewModalProps> = ({
  evidence,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !evidence) return null;

  const isImage = evidence.type === 'image' || evidence.url.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)$/i.test(evidence.name);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-300">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{evidence.name}</h3>
              <p className="text-[11px] text-slate-400">Xem trước tài liệu kiểm chứng CCHC</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50">
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <span className="text-slate-400 flex items-center gap-1 text-[11px]"><Tag className="w-3 h-3" /> Số văn bản:</span>
              <p className="font-bold text-slate-800">{evidence.documentNumber || 'Không có'}</p>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1 text-[11px]"><Calendar className="w-3 h-3" /> Ngày ban hành:</span>
              <p className="font-bold text-slate-800">{evidence.issueDate || evidence.uploadDate}</p>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1 text-[11px]"><HardDrive className="w-3 h-3" /> Lưu trữ:</span>
              <p className="font-bold text-sky-700">Google Drive</p>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1 text-[11px]"><User className="w-3 h-3" /> Đơn vị:</span>
              <p className="font-bold text-slate-800 truncate">{evidence.uploadedBy || 'UBND Phường'}</p>
            </div>
          </div>

          {evidence.note && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
              <strong>Trích yếu nội dung:</strong> {evidence.note}
            </div>
          )}

          {/* Visual Preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white min-h-[300px] flex items-center justify-center p-2">
            {isImage ? (
              <img
                src={evidence.url}
                alt={evidence.name}
                className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            ) : (
              <div className="text-center py-12 px-4 space-y-3">
                <FileText className="w-16 h-16 text-sky-600 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">{evidence.name}</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tài liệu văn bản định dạng {evidence.type.toUpperCase()} được lưu trữ an toàn trên Google Drive của phường.
                </p>
                <a
                  href={evidence.driveUrl || evidence.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Mở xem toàn văn trên Google Drive</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white p-3.5 border-t border-slate-200 flex items-center justify-between">
          <a
            href={evidence.driveUrl || evidence.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Đường dẫn gốc trên Google Drive</span>
          </a>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
