import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Paperclip, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Upload, 
  ExternalLink,
  Sparkles,
  Layers,
  Building2,
  HardDrive
} from 'lucide-react';
import { CCHCSection, CCHCSubCriterion, CriterionStatus } from '../types/cchc.ts';
import { DEPARTMENTS_LIST } from '../data/cchcDataset.ts';

interface CriteriaTableProps {
  sections: CCHCSection[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
  onOpenCriterionModal: (criterion: CCHCSubCriterion, section: CCHCSection) => void;
  onQuickUpdateScore: (criterionId: string, newScore: number) => void;
  onQuickUpload: (criterion: CCHCSubCriterion, section: CCHCSection) => void;
}

export const CriteriaTable: React.FC<CriteriaTableProps> = ({
  sections,
  activeSectionId,
  onSelectSection,
  onOpenCriterionModal,
  onQuickUpdateScore,
  onQuickUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('Tất cả bộ phận');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [hasEvidenceFilter, setHasEvidenceFilter] = useState<string>('all');

  // Filter criteria list
  const filteredItems = useMemo(() => {
    let result: { criterion: CCHCSubCriterion; section: CCHCSection }[] = [];

    const targetSections = activeSectionId === 'ALL'
      ? sections
      : sections.filter((s) => s.id === activeSectionId);

    for (const sec of targetSections) {
      for (const crit of sec.criteria) {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = crit.code.toLowerCase().includes(q);
          const matchTitle = crit.title.toLowerCase().includes(q);
          const matchGuide = crit.scoringGuide.toLowerCase().includes(q);
          const matchDept = crit.department.toLowerCase().includes(q);
          if (!matchCode && !matchTitle && !matchGuide && !matchDept) continue;
        }

        // Department filter
        if (selectedDept !== 'Tất cả bộ phận' && crit.department !== selectedDept) {
          continue;
        }

        // Status filter
        if (selectedStatus !== 'all' && crit.status !== selectedStatus) {
          continue;
        }

        // Evidence filter
        if (hasEvidenceFilter === 'has_evidence' && (!crit.evidenceList || crit.evidenceList.length === 0)) {
          continue;
        }
        if (hasEvidenceFilter === 'no_evidence' && crit.evidenceList && crit.evidenceList.length > 0) {
          continue;
        }

        result.push({ criterion: crit, section: sec });
      }
    }

    return result;
  }, [sections, activeSectionId, searchQuery, selectedDept, selectedStatus, hasEvidenceFilter]);

  const getStatusBadge = (status: CriterionStatus) => {
    switch (status) {
      case 'outstanding':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" /> Xuất sắc
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Đã hoàn thành
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" /> Đang triển khai
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <AlertCircle className="w-3 h-3 text-slate-400" /> Chưa thực hiện
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Filter and search toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã tiêu chí (I.1, VII.2), tên nội dung, văn bản..."
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Department selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                {DEPARTMENTS_LIST.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Status selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả tiến độ</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="outstanding">Xuất sắc</option>
                <option value="in_progress">Đang triển khai</option>
                <option value="not_started">Chưa thực hiện</option>
              </select>
            </div>

            {/* Evidence filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={hasEvidenceFilter}
                onChange={(e) => setHasEvidenceFilter(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">Minh chứng (Tất cả)</option>
                <option value="has_evidence">Đã có minh chứng</option>
                <option value="no_evidence">Chưa có minh chứng</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search Result count banner */}
        <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
          <span>
            Hiển thị <strong>{filteredItems.length}</strong> tiêu chí
            {activeSectionId !== 'ALL' && (
              <> thuộc lĩnh vực <strong className="text-red-700">{activeSectionId}</strong></>
            )}
            {searchQuery && <> với từ khóa "<strong>{searchQuery}</strong>"</>}
          </span>

          {(searchQuery || selectedDept !== 'Tất cả bộ phận' || selectedStatus !== 'all' || hasEvidenceFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDept('Tất cả bộ phận');
                setSelectedStatus('all');
                setHasEvidenceFilter('all');
              }}
              className="text-red-700 hover:text-red-800 font-semibold underline text-xs"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table listing */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
              <th className="py-3 px-3.5 w-24 text-center">Mã số</th>
              <th className="py-3 px-4 min-w-[320px]">Nội dung Bộ Chỉ số CCHC</th>
              <th className="py-3 px-3 w-28 text-center">Điểm chuẩn</th>
              <th className="py-3 px-3 w-32 text-center">Điểm tự chấm</th>
              <th className="py-3 px-3 w-36 text-center">Tiến độ</th>
              <th className="py-3 px-3 w-44">Bộ phận phụ trách</th>
              <th className="py-3 px-3 w-36 text-center">Minh chứng Drive</th>
              <th className="py-3 px-3 w-28 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-400" />
                    <p className="font-semibold text-slate-700">Không tìm thấy tiêu chí nào phù hợp</p>
                    <p className="text-xs text-slate-400">Hãy thử thay đổi điều kiện tìm kiếm hoặc chọn "Tất cả lĩnh vực"</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map(({ criterion, section }, idx) => {
                const isPenalty = section.type === 'penalty';
                const isBonus = section.type === 'bonus';
                const hasEvidence = criterion.evidenceList && criterion.evidenceList.length > 0;

                return (
                  <tr
                    key={criterion.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Code */}
                    <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-700">
                      <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs">
                        {criterion.code}
                      </span>
                    </td>

                    {/* Title & Guide snippet */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 group-hover:text-red-800 transition-colors cursor-pointer"
                        onClick={() => onOpenCriterionModal(criterion, section)}
                      >
                        {criterion.title}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                        {criterion.scoringGuide}
                      </div>
                      {criterion.deadline && (
                        <div className="mt-1 inline-flex items-center text-[10px] text-amber-700 font-medium">
                          Hạn chót: {criterion.deadline}
                        </div>
                      )}
                    </td>

                    {/* Max score */}
                    <td className="py-3 px-3 text-center font-semibold text-slate-600">
                      {isPenalty ? `-${criterion.maxScore}` : isBonus ? `+${criterion.maxScore}` : criterion.maxScore}đ
                    </td>

                    {/* Self score with quick inline input */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center justify-center">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={criterion.maxScore}
                          value={criterion.selfScore}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            onQuickUpdateScore(criterion.id, val);
                          }}
                          className={`w-18 px-2 py-1 text-center font-bold text-xs rounded border transition shadow-2xs ${
                            criterion.selfScore >= criterion.maxScore && !isPenalty
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black'
                              : isPenalty && criterion.selfScore > 0
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-white text-slate-900 border-slate-300 focus:ring-1 focus:ring-red-500'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-3 text-center">
                      {getStatusBadge(criterion.status)}
                    </td>

                    {/* Department */}
                    <td className="py-3 px-3 text-slate-600 text-xs font-medium">
                      <span className="line-clamp-2" title={criterion.department}>
                        {criterion.department}
                      </span>
                    </td>

                    {/* Evidence Google Drive Badge */}
                    <td className="py-3 px-3 text-center">
                      {hasEvidence ? (
                        <div className="inline-flex flex-col items-center gap-1">
                          <button
                            onClick={() => onOpenCriterionModal(criterion, section)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold hover:bg-sky-100 transition shadow-2xs"
                            title="Bấm để xem các tài liệu minh chứng đã lưu trên Google Drive"
                          >
                            <HardDrive className="w-3.5 h-3.5 text-sky-600" />
                            <span>{criterion.evidenceList.length} tệp</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onQuickUpload(criterion, section)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-700 hover:bg-sky-50 px-2 py-1 rounded border border-dashed border-slate-300 transition"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Thêm tệp</span>
                        </button>
                      )}
                    </td>

                    {/* Action button */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenCriterionModal(criterion, section)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-red-700 text-white hover:bg-red-800 transition shadow-2xs flex items-center gap-1"
                          title="Cập nhật chi tiết & tải minh chứng"
                        >
                          <span>Chi tiết</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
