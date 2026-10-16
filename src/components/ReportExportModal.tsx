import React, { useRef } from 'react';
import { X, Printer, Download, Copy, Check, FileSpreadsheet, Building2, HardDrive } from 'lucide-react';
import { CCHCSection, OverallEvaluation } from '../types/cchc.ts';
import { calculateSectionScore } from '../utils/cchcRules.ts';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: CCHCSection[];
  evaluation: OverallEvaluation;
  year: number;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  sections,
  evaluation,
  year,
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = React.useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'BÁO CÁO TỰ ĐÁNH GIÁ BỘ CHỈ SỐ CẢI CÁCH HÀNH CHÍNH NĂM ' + year + '\n';
    csv += 'ĐƠN VỊ: ỦY BAN NHÂN DÂN PHƯỜNG HỘI AN ĐÔNG - TP ĐÀ NẴNG\n\n';
    csv += 'STT/Mã,Nội dung tiêu chí,Điểm chuẩn,Điểm tự chấm,Bộ phận phụ trách,Tiến độ,Số lượng minh chứng,Đường dẫn Drive minh chứng\n';

    sections.forEach((sec) => {
      csv += `"${sec.romanNumeral}","${sec.title.replace(/"/g, '""')}","${sec.maxScore}","${calculateSectionScore(sec)}","","","",""\n`;
      sec.criteria.forEach((crit) => {
        const driveLinks = (crit.evidenceList || []).map(e => e.driveUrl || e.url).join(' ; ');
        csv += `"${crit.code}","${crit.title.replace(/"/g, '""')}","${crit.maxScore}","${crit.selfScore}","${crit.department}","${crit.status}","${crit.evidenceList?.length || 0}","${driveLinks}"\n`;
      });
    });

    csv += `\n"TỔNG ĐIỂM CHUẨN (I-VIII)","","100","${evaluation.totalBaseScore}","","","",""\n`;
    csv += `"ĐIỂM THƯỞNG (IX.1)","","10","+${evaluation.totalBonusScore}","","","",""\n`;
    csv += `"ĐIỂM TRỪ (IX.2)","","10","-${evaluation.totalPenaltyScore}","","","",""\n`;
    csv += `"TỔNG ĐIỂM XẾP HẠNG","","","${evaluation.finalScore}","XẾP LOẠI: ${evaluation.ranking}","","",""\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_CCHC_${year}_UBND_Phuong_Hoi_An_Dong.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (reportRef.current) {
      navigator.clipboard.writeText(reportRef.current.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold">
              Báo Cáo Tự Đánh Giá, Chấm Điểm Chỉ Số CCHC Năm {year}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Báo Cáo</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel / CSV</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Content */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 flex-1 text-slate-900 text-sm bg-white" ref={reportRef}>
          
          {/* Government Formal Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-4 border-slate-300">
            <div className="text-center sm:text-left">
              <p className="text-xs uppercase font-semibold text-slate-700">ỦY BAN NHÂN DÂN PHƯỜNG HỘI AN ĐÔNG</p>
              <p className="text-xs uppercase font-bold text-slate-900">BAN CHỈ ĐẠO CẢI CÁCH HÀNH CHÍNH</p>
              <div className="w-24 h-0.5 bg-slate-400 mx-auto sm:mx-0 mt-1"></div>
              <p className="text-[11px] text-slate-500 mt-1 italic">Số: ...... /BC-UBND</p>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-xs font-bold uppercase text-slate-900 tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="text-xs font-bold text-slate-800">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-36 h-0.5 bg-slate-400 mx-auto sm:ml-auto mt-1"></div>
              <p className="text-[11px] text-slate-500 mt-1 italic">Hội An Đông, ngày ..... tháng ..... năm {year}</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center space-y-1.5 py-2">
            <h1 className="text-lg sm:text-xl font-bold uppercase text-slate-900">
              BÁO CÁO
            </h1>
            <p className="text-base font-bold uppercase text-slate-800">
              KẾT QUẢ TỰ ĐÁNH GIÁ, CHẤM ĐIỂM XẾP HẠNG CẢI CÁCH HÀNH CHÍNH NĂM {year}
            </p>
            <p className="text-xs text-slate-600 italic">
              (Ban hành kèm theo Quyết định Bộ chỉ số theo dõi đánh giá CCHC của UBND TP. Đà Nẵng)
            </p>
          </div>

          {/* Synthesis Stats Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-slate-600 font-medium">Điểm chuẩn (Mục I - VIII):</p>
              <p className="text-xl font-black text-slate-900">{evaluation.totalBaseScore} / 100đ</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">Điểm thưởng (Mục IX.1):</p>
              <p className="text-xl font-black text-emerald-700">+{evaluation.totalBonusScore}đ</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">Điểm trừ (Mục IX.2):</p>
              <p className="text-xl font-black text-rose-700">-{evaluation.totalPenaltyScore}đ</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">Tổng điểm tự chấm:</p>
              <p className="text-xl font-black text-red-700">{evaluation.finalScore}đ ({evaluation.ranking})</p>
            </div>
          </div>

          {/* Full Detailed Breakdown Table */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm uppercase">
              BẢNG TỔNG HỢP CHI TIẾT TỪNG TIÊU CHÍ VÀ TÀI LIỆU KIỂM CHỨNG GOOGLE DRIVE:
            </h3>

            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2 w-16 text-center border-r border-slate-300">STT/Mã</th>
                    <th className="p-2 border-r border-slate-300">Nội dung Bộ Chỉ số</th>
                    <th className="p-2 w-16 text-center border-r border-slate-300">Điểm chuẩn</th>
                    <th className="p-2 w-18 text-center border-r border-slate-300">Tự chấm</th>
                    <th className="p-2 w-32 border-r border-slate-300">Bộ phận chủ trì</th>
                    <th className="p-2 w-48">Tài liệu minh chứng (Google Drive)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {sections.map((sec) => (
                    <React.Fragment key={sec.id}>
                      <tr className="bg-slate-100 font-bold text-slate-900">
                        <td className="p-2 text-center border-r border-slate-300 font-mono">{sec.romanNumeral}</td>
                        <td className="p-2 border-r border-slate-300 uppercase">{sec.title}</td>
                        <td className="p-2 text-center border-r border-slate-300">{sec.maxScore}</td>
                        <td className="p-2 text-center border-r border-slate-300 text-red-700 font-black">{calculateSectionScore(sec)}</td>
                        <td className="p-2 border-r border-slate-300">UBND Phường</td>
                        <td className="p-2 text-[11px] text-slate-600">Thư mục Drive: {sec.romanNumeral}</td>
                      </tr>
                      {sec.criteria.map((crit) => (
                        <tr key={crit.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center border-r border-slate-300 font-mono text-[11px] text-slate-600">
                            {crit.code}
                          </td>
                          <td className="p-2 border-r border-slate-300">
                            <div className="font-semibold text-slate-800">{crit.title}</div>
                            {crit.notes && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5">* Giải trình: {crit.notes}</div>
                            )}
                          </td>
                          <td className="p-2 text-center border-r border-slate-300 font-medium">{crit.maxScore}</td>
                          <td className="p-2 text-center border-r border-slate-300 font-bold text-slate-900">{crit.selfScore}</td>
                          <td className="p-2 border-r border-slate-300 text-slate-600">{crit.department}</td>
                          <td className="p-2">
                            {crit.evidenceList && crit.evidenceList.length > 0 ? (
                              <div className="space-y-1">
                                {crit.evidenceList.map((e) => (
                                  <div key={e.id} className="text-[11px] flex items-center gap-1 text-sky-700">
                                    <HardDrive className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{e.name}</span>
                                    {e.documentNumber && <span className="font-mono text-[10px] text-slate-500">({e.documentNumber})</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Chưa đính kèm</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Administrative Signatures */}
          <div className="pt-8 flex flex-col sm:flex-row justify-between items-start text-xs text-slate-700 gap-8">
            <div>
              <p className="font-bold uppercase text-slate-900 mb-1">Nơi nhận:</p>
              <p>- Sở Nội vụ thành phố Đà Nẵng;</p>
              <p>- UBND thành phố Đà Nẵng;</p>
              <p>- Thường trực Đảng ủy, HĐND phường;</p>
              <p>- Các ban ngành, bộ phận chuyên môn;</p>
              <p>- Lưu: VT, BCĐ CCHC.</p>
            </div>

            <div className="text-center sm:text-right sm:pr-8">
              <p className="font-bold uppercase text-slate-900">TM. ỦY BAN NHÂN DÂN PHƯỜNG HỘI AN ĐÔNG</p>
              <p className="font-bold text-slate-800">CHỦ TỊCH</p>
              <p className="text-[11px] text-slate-400 italic my-12">(Ký, ghi rõ họ tên và đóng dấu)</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            * Nhấn "In Báo Cáo" để tạo bản in A4 hoặc xuất sang file PDF gửi Sở Nội vụ.
          </span>
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
