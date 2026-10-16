import React from 'react';
import { Award, CheckCircle2, TrendingUp, AlertTriangle, FileText, PlusCircle, MinusCircle, Layers } from 'lucide-react';
import { OverallEvaluation, CCHCSection } from '../types/cchc.ts';
import { calculateSectionScore } from '../utils/cchcRules.ts';

interface DashboardSummaryProps {
  evaluation: OverallEvaluation;
  sections: CCHCSection[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
  onOpenDriveEvidenceHub?: () => void;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  evaluation,
  sections,
  activeSectionId,
  onSelectSection,
  onOpenDriveEvidenceHub,
}) => {
  return (
    <div className="space-y-6">
      {/* 4 Primary KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng Điểm CCHC */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng Điểm Tự Chấm</span>
            <div className="p-2 rounded-lg bg-red-50 text-red-700">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{evaluation.finalScore}</span>
            <span className="text-sm font-semibold text-slate-500">/ 100 điểm chuẩn</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Điểm chuẩn: <strong className="text-slate-800">{evaluation.totalBaseScore}/100</strong></span>
            <span className="text-emerald-700 font-semibold">+{evaluation.totalBonusScore} thưởng</span>
            {evaluation.totalPenaltyScore > 0 && (
              <span className="text-rose-700 font-semibold">-{evaluation.totalPenaltyScore} trừ</span>
            )}
          </div>
        </div>

        {/* Card 2: Xếp loại CCHC */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Xếp Loại Dự Kiến</span>
            <div className={`p-2 rounded-lg ${
              evaluation.rankingColor === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
              evaluation.rankingColor === 'blue' ? 'bg-blue-50 text-blue-700' :
              evaluation.rankingColor === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black uppercase ${
              evaluation.rankingColor === 'emerald' ? 'text-emerald-600' :
              evaluation.rankingColor === 'blue' ? 'text-blue-600' :
              evaluation.rankingColor === 'amber' ? 'text-amber-600' : 'text-rose-600'
            }`}>
              Hạng {evaluation.ranking}
            </span>
          </div>
          <p className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500 line-clamp-1">
            {evaluation.finalScore >= 90 ? 'UBND phường Hội An Đông đạt mức Xuất sắc (>= 90đ)' :
             evaluation.finalScore >= 80 ? 'Đạt mức Tốt (>= 80đ)' :
             evaluation.finalScore >= 70 ? 'Đạt mức Khá (>= 70đ)' : 'Cần khắc phục các tiêu chí trễ hạn'}
          </p>
        </div>

        {/* Card 3: Tiến độ hoàn thành */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tiến Độ Tiêu Chí</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{evaluation.completionPercentage}%</span>
            <span className="text-xs text-slate-500">
              ({evaluation.completedCriteriaCount}/{evaluation.totalCriteriaCount} tiêu chí)
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${evaluation.completionPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Card 4: Minh chứng Google Drive & Firebase */}
        <div
          onClick={onOpenDriveEvidenceHub}
          className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 hover:shadow-md hover:border-sky-300 transition cursor-pointer group"
          title="Bấm để mở Trung tâm Quản lý & Nhận diện Minh chứng Google Drive"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-sky-700 transition">Tài Liệu Kiểm Chứng</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-sky-50 group-hover:text-sky-700 transition">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 group-hover:text-sky-700 transition">{evaluation.totalEvidenceCount}</span>
            <span className="text-sm font-semibold text-slate-500">tệp minh chứng</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span className="text-slate-500">Google Drive & Firebase</span>
            <span className="font-bold text-sky-700 group-hover:underline flex items-center gap-1">
              Quản lý & Quét &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* 9 CCHC Sections Progress Breakdown Carousel / Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-red-700" />
            Tiến độ điểm số theo 9 Lĩnh vực CCHC (Bấm vào để lọc nhanh)
          </h2>
          <button
            onClick={() => onSelectSection('ALL')}
            className={`text-xs px-2.5 py-1 rounded font-semibold border transition ${
              activeSectionId === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
            }`}
          >
            Xem tất cả lĩnh vực
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {sections.map((sec) => {
            const currentScore = calculateSectionScore(sec);
            const isSelected = activeSectionId === sec.id;
            const pct = sec.maxScore > 0 ? Math.min(100, Math.round((currentScore / sec.maxScore) * 100)) : 0;
            const isBonus = sec.type === 'bonus';
            const isPenalty = sec.type === 'penalty';

            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`text-left p-3 rounded-lg border transition duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'border-red-600 bg-red-50/50 shadow-sm ring-1 ring-red-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      isBonus ? 'bg-emerald-100 text-emerald-800' :
                      isPenalty ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      Mục {sec.romanNumeral}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {isBonus && '+'}{isPenalty && '-'}{currentScore}/{sec.maxScore}đ
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-slate-700 line-clamp-2 min-h-[32px]" title={sec.title}>
                    {sec.title}
                  </h3>
                </div>

                <div className="mt-2.5">
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${
                        isBonus ? 'bg-emerald-500' :
                        isPenalty ? (currentScore > 0 ? 'bg-rose-500' : 'bg-slate-300') :
                        pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.max(5, pct)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                    <span>{sec.criteria.length} tiêu chí</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
