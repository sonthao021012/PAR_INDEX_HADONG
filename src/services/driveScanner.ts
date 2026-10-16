import type { CCHCSection, EvidenceFile } from '../types/cchc.ts';
import { sendGasRequest } from './gasClient.ts';

export interface ScannedDriveFile {
  id: string;
  name: string;
  url: string;
  viewUrl: string;
  size: string;
  date: string;
  folder: string;
  folderPath?: string;
  mimeType?: string;
  mappedCriterionCode?: string;
}

export interface DriveScanResult {
  success: boolean;
  message: string;
  totalFound: number;
  newlyMappedCount: number;
  files: ScannedDriveFile[];
  unmappedFiles: ScannedDriveFile[];
  updatedSections: CCHCSection[];
  error?: string;
  isOldScriptVersion?: boolean;
}

// Trích xuất mã tiêu chí từ tên tệp hoặc đường dẫn thư mục (ví dụ: I.1.a, I.2.b.1, II.2.b, IX.1.c, VIII.1, VII.6, IX.2.đ)
export function extractCriterionCodeFromText(text: string): string | null {
  if (!text) return null;

  // Chuẩn hóa dấu gạch dưới, gạch ngang, dấu ngoặc để tránh bẫy boundary của \b trong regex
  const normalized = text.replace(/[_\[\]\(\)\-]/g, ' ');

  // 1. Tìm các mã 4 phần trước: I.2.b.1, I.6.c.2, I.6.d.1, VII.4.b, VII.1.a...
  const fourPartRegex = /(?:^|\s|[^\w.])(I|VII)\s*\.\s*([0-9]+)\s*\.\s*([a-zđ])\s*\.\s*([0-9]+)(?:\s|[^\w.]|$)/i;
  const m4 = normalized.match(fourPartRegex);
  if (m4) {
    return `${m4[1].toUpperCase()}.${m4[2]}.${m4[3].toLowerCase()}.${m4[4]}`;
  }

  // 2. Tìm các mã 3 phần: I.1.a, II.2.a, III.4.c, IX.1.a, IX.2.đ, VII.1.a, V.6.a...
  const threePartRegex = /(?:^|\s|[^\w.])(IX|VIII|VII|VI|V|IV|III|II|I)\s*\.\s*([0-9]+)\s*\.\s*([a-zđ])(?:\s|[^\w.]|$)/i;
  const m3 = normalized.match(threePartRegex);
  if (m3) {
    return `${m3[1].toUpperCase()}.${m3[2]}.${m3[3].toLowerCase()}`;
  }

  // 3. Tìm các mã 2 phần: I.3, I.8, II.1, II.3, III.2, IV.1, VI.1, VI.3, VII.3, VII.6, VIII.1...
  const twoPartRegex = /(?:^|\s|[^\w.])(IX|VIII|VII|VI|V|IV|III|II|I)\s*\.\s*([0-9]+)(?:\s|[^\w.]|$)/i;
  const m2 = normalized.match(twoPartRegex);
  if (m2) {
    return `${m2[1].toUpperCase()}.${m2[2]}`;
  }

  // 4. Tìm các định dạng viết liền hoặc có tiền tố: TC_I1a, tieuchi-III-2, I_1_a, I-2-b-1, V_6_a
  const altRegex = /(?:^|\s|[^\w.])(?:TC|TIEUCHI)?\s*(IX|VIII|VII|VI|V|IV|III|II|I)\s*([0-9]+)\s*([a-zđ])?\s*([0-9]+)?(?:\s|[^\w.]|$)/i;
  const ma = text.replace(/[_.-]/g, ' ').match(altRegex);
  if (ma && ma[1]) {
    const r = ma[1].toUpperCase();
    const n1 = ma[2];
    const lettr = ma[3] ? ma[3].toLowerCase() : '';
    const n2 = ma[4] || '';
    let res = `${r}.${n1}`;
    if (lettr) res += `.${lettr}`;
    if (n2) res += `.${n2}`;
    return res;
  }

  return null;
}

// Nhận diện tiêu chí theo từ khóa nội dung văn bản khi tên tệp không ghi rõ mã số tiêu chí
export function matchCriterionByKeywords(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  if (lower.includes('phụ lục ii') || lower.includes('phu luc ii') || lower.includes('plii') || lower.includes('bộ chỉ số')) {
    return 'I.1.a';
  }
  if (lower.includes('kế hoạch cchc giai đoạn') || lower.includes('2026-2030')) {
    return 'I.1.a';
  }
  if (lower.includes('kế hoạch cchc hằng năm') || lower.includes('kế hoạch cchc năm') || lower.includes('kh cchc 2026')) {
    return 'I.2.a';
  }
  if (lower.includes('kiểm tra cchc') || lower.includes('tổ kiểm tra công vụ') || lower.includes('khắc phục sau kiểm tra')) {
    return 'I.4.b';
  }
  if (lower.includes('báo cáo cchc trực tuyến') || lower.includes('báo cáo cchc quý') || lower.includes('báo cáo cchc 6 tháng')) {
    return 'I.5.a';
  }
  if (lower.includes('tuyên truyền cchc') || lower.includes('infographic') || lower.includes('tờ rơi cchc') || lower.includes('video cchc')) {
    return 'I.6.c.2';
  }
  if (lower.includes('cuộc thi') && (lower.includes('cchc') || lower.includes('chuyển đổi số'))) {
    return 'I.6.d.1';
  }
  if (lower.includes('sáng kiến') || lower.includes('giải pháp mới')) {
    return 'I.8';
  }
  if (lower.includes('rà soát văn bản') || lower.includes('văn bản qppl') || lower.includes('vbqppl')) {
    return 'II.1';
  }
  if (lower.includes('kiểm soát tthc') || lower.includes('báo cáo tthc')) {
    return 'III.1.a';
  }
  if (lower.includes('camera') || lower.includes('ioc')) {
    return 'VII.6';
  }
  if (lower.includes('khảo sát hài lòng') || lower.includes('sipas') || lower.includes('khaosathailong')) {
    return 'III.4.a';
  }
  if (lower.includes('biên chế') || lower.includes('vị trí việc làm') || lower.includes('đề án vtvl')) {
    return 'V.1.a';
  }
  if (lower.includes('quy chế chi tiêu nội bộ') || lower.includes('chi tiêu nội bộ')) {
    return 'VI.3';
  }
  if (lower.includes('dự toán ngân sách') || lower.includes('quyết toán ngân sách')) {
    return 'VI.1';
  }
  if (lower.includes('chữ ký số') || lower.includes('ký số') || lower.includes('qlvbdh')) {
    return 'VII.1.a';
  }
  if (lower.includes('số hóa hồ sơ') || lower.includes('phần mềm chuyên ngành')) {
    return 'VII.4.b';
  }
  if (lower.includes('một cửa') || lower.includes('hồ sơ tthc đúng hạn') || lower.includes('trả kết quả')) {
    return 'III.2';
  }
  if (lower.includes('đối thoại') || lower.includes('gặp gỡ nhân dân')) {
    return 'IX.1.a';
  }

  return null;
}

export interface ParsedDriveImportItem {
  id: string;
  name: string;
  url: string;
  driveFileId: string;
  criterionCode?: string;
  note?: string;
}

/**
 * Phân tích chuỗi văn bản hoặc danh sách link Google Drive mà người dùng dán vào
 * Hỗ trợ các dạng:
 * - https://drive.google.com/file/d/1abc.../view
 * - https://drive.google.com/open?id=1abc...
 * - Tên tệp kèm link: "I.1.a_Quyet_dinh.pdf - https://drive.google.com/..."
 */
export function parseDriveLinksAndFiles(rawText: string): ParsedDriveImportItem[] {
  if (!rawText) return [];

  const lines = rawText.split('\n');
  const results: ParsedDriveImportItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Tìm kiếm Google Drive file ID
    // Dạng 1: /file/d/FILE_ID/
    // Dạng 2: id=FILE_ID
    // Dạng 3: /folders/FOLDER_ID
    let fileId = '';
    const m1 = line.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
    const m2 = line.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    const m3 = line.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);

    if (m1) {
      fileId = m1[1];
    } else if (m2) {
      fileId = m2[1];
    } else if (m3) {
      fileId = m3[1];
    }

    // Tách tên tệp nếu có (ví dụ phần đứng trước hoặc sau link)
    let extractedName = '';
    const cleanLineWithoutUrl = line.replace(/https?:\/\/[^\s]+/g, '').replace(/[-–—]/g, ' ').trim();
    if (cleanLineWithoutUrl) {
      extractedName = cleanLineWithoutUrl;
    }

    if (!fileId && !extractedName) continue;

    const finalId = fileId || 'manual-drive-' + Math.random().toString(36).slice(2, 9);
    const finalUrl = fileId
      ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
      : line.startsWith('http') ? line : `https://drive.google.com/drive/search?q=${encodeURIComponent(extractedName)}`;

    const code = extractCriterionCodeFromText(line) || matchCriterionByKeywords(line) || undefined;

    results.push({
      id: 'import-' + finalId,
      name: extractedName || (fileId ? `Tài liệu Drive (${fileId.slice(0, 8)}...)` : 'Minh chứng Google Drive'),
      url: finalUrl,
      driveFileId: fileId,
      criterionCode: code,
      note: 'Nhập từ liên kết Google Drive',
    });
  }

  return results;
}

export async function scanAndAutoMapDriveFiles(
  webAppUrl: string,
  currentSections: CCHCSection[]
): Promise<DriveScanResult> {
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    return {
      success: false,
      message: 'Chưa cấu hình URL Google Apps Script hợp lệ',
      totalFound: 0,
      newlyMappedCount: 0,
      files: [],
      unmappedFiles: [],
      updatedSections: currentSections,
      error: 'Chưa cấu hình URL Google Apps Script',
    };
  }

  try {
    // 1. Gọi lệnh getDriveFiles tới Google Apps Script
    const res = await sendGasRequest(webAppUrl, { action: 'getDriveFiles' }, 20000);

    let rawFiles: any[] = [];
    let isOldScript = false;

    if (res && res.success && res.data?.files && Array.isArray(res.data.files)) {
      rawFiles = res.data.files;
    } else if (res && res.error && res.error.includes('Hành động không hợp lệ')) {
      // Script cũ trên Google chưa cập nhật getDriveFiles, thử gọi testConnection
      isOldScript = true;
      const testRes = await sendGasRequest(webAppUrl, { action: 'testConnection' }, 15000);
      if (testRes && testRes.success && testRes.data?.files && Array.isArray(testRes.data.files)) {
        rawFiles = testRes.data.files;
      }
    }

    if (rawFiles.length === 0) {
      return {
        success: !isOldScript,
        message: isOldScript
          ? 'Google Apps Script hiện tại trên Google của bạn là phiên bản cũ, chưa có hàm quét tự động Drive (getDriveFiles). Vui lòng cập nhật mã script Code.gs mới và Triển khai phiên bản mới để tự động nhận diện toàn bộ tệp minh chứng trên Drive!'
          : 'Không tìm thấy tệp minh chứng nào trong thư mục Google Drive của Phường.',
        totalFound: 0,
        newlyMappedCount: 0,
        files: [],
        unmappedFiles: [],
        updatedSections: currentSections,
        isOldScriptVersion: isOldScript,
      };
    }

    // 2. Chuyển đổi tệp thô sang định dạng ScannedDriveFile
    const scannedFiles: ScannedDriveFile[] = rawFiles.map((f: any) => ({
      id: f.id || 'f-' + Math.random().toString(36).slice(2, 8),
      name: f.name || 'Tài liệu không tên',
      url: f.url || `https://drive.google.com/file/d/${f.id}/view?usp=sharing`,
      viewUrl: f.viewUrl || `https://drive.google.com/file/d/${f.id}/view?usp=sharing`,
      size: f.size || 'Google Drive',
      date: f.date || new Date().toISOString().split('T')[0],
      folder: f.folder || 'Google Drive',
      folderPath: f.folderPath || f.folder || '',
      mimeType: f.mimeType || 'application/pdf',
    }));

    // 3. Tự động nhận diện và ghép tệp vào tiêu chí
    let newlyMappedCount = 0;
    const unmapped: ScannedDriveFile[] = [];

    // Tạo bản sao sâu của sections để cập nhật
    const updatedSections: CCHCSection[] = JSON.parse(JSON.stringify(currentSections));

    for (const file of scannedFiles) {
      // Tìm mã tiêu chí từ tên tệp hoặc đường dẫn thư mục, hoặc qua từ khóa nội dung
      const matchedCode =
        extractCriterionCodeFromText(file.name) ||
        extractCriterionCodeFromText(file.folderPath || file.folder) ||
        matchCriterionByKeywords(file.name) ||
        matchCriterionByKeywords(file.folderPath || file.folder);

      file.mappedCriterionCode = matchedCode || undefined;

      if (!matchedCode) {
        unmapped.push(file);
        continue;
      }

      // Tìm tiêu chí tương ứng trong sections
      let targetCriterion: any = null;
      for (const sec of updatedSections) {
        for (const crit of sec.criteria) {
          if (crit.code.toUpperCase() === matchedCode.toUpperCase()) {
            targetCriterion = crit;
            break;
          }
        }
        if (targetCriterion) break;
      }

      if (targetCriterion) {
        // Kiểm tra xem tệp đã tồn tại trong evidenceList chưa
        const alreadyExists = targetCriterion.evidenceList?.some(
          (ev: EvidenceFile) => ev.driveFileId === file.id || ev.name === file.name
        );

        if (!alreadyExists) {
          let fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'link' = 'pdf';
          const lower = file.name.toLowerCase();
          if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
            fileType = 'image';
          } else if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
            fileType = 'sheet';
          } else if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
            fileType = 'doc';
          }

          const newEvidence: EvidenceFile = {
            id: 'ev-drive-' + file.id,
            name: file.name,
            type: fileType,
            size: file.size,
            uploadDate: file.date,
            url: file.viewUrl,
            driveUrl: file.viewUrl,
            driveFileId: file.id,
            uploadedBy: 'Google Drive Sync',
            note: `Tự động quét từ Google Drive (${file.folderPath || file.folder})`,
          };

          if (!targetCriterion.evidenceList) {
            targetCriterion.evidenceList = [];
          }
          targetCriterion.evidenceList.push(newEvidence);

          // Nếu tiêu chí đang ở trạng thái chưa thực hiện, tự động chuyển sang Đã hoàn thành hoặc Đang thực hiện
          if (targetCriterion.status === 'not_started') {
            targetCriterion.status = 'completed';
            if (targetCriterion.selfScore === 0) {
              targetCriterion.selfScore = targetCriterion.maxScore;
            }
          }

          newlyMappedCount++;
        }
      } else {
        unmapped.push(file);
      }
    }

    return {
      success: true,
      message: `Đã quét thành công ${scannedFiles.length} tệp trên Google Drive. Tự động gán ${newlyMappedCount} tệp vào các tiêu chí phù hợp!`,
      totalFound: scannedFiles.length,
      newlyMappedCount,
      files: scannedFiles,
      unmappedFiles: unmapped,
      updatedSections,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi kết nối khi quét Google Drive: ${err?.message || 'Không xác định'}`,
      totalFound: 0,
      newlyMappedCount: 0,
      files: [],
      unmappedFiles: [],
      updatedSections: currentSections,
      error: String(err),
    };
  }
}

/**
 * Gán thủ công một tệp từ Drive vào một tiêu chí cụ thể
 */
export function manuallyAttachDriveFileToCriterion(
  file: ScannedDriveFile,
  criterionCode: string,
  sections: CCHCSection[]
): CCHCSection[] {
  return sections.map((sec) => ({
    ...sec,
    criteria: sec.criteria.map((crit) => {
      if (crit.code.toUpperCase() === criterionCode.toUpperCase()) {
        const alreadyExists = crit.evidenceList?.some(
          (ev) => ev.driveFileId === file.id || ev.name === file.name
        );
        if (alreadyExists) return crit;

        let fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'link' = 'pdf';
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          fileType = 'image';
        } else if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
          fileType = 'sheet';
        } else if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
          fileType = 'doc';
        }

        const newEvidence: EvidenceFile = {
          id: 'ev-manual-' + file.id,
          name: file.name,
          type: fileType,
          size: file.size,
          uploadDate: file.date,
          url: file.viewUrl,
          driveUrl: file.viewUrl,
          driveFileId: file.id,
          uploadedBy: 'UBND Phường Hội An Đông',
          note: `Đính kèm từ Google Drive (${file.folderPath || file.folder})`,
        };

        const updatedEvList = [newEvidence, ...(crit.evidenceList || [])];
        const newScore = crit.selfScore === 0 ? crit.maxScore : crit.selfScore;
        const newStatus = crit.status === 'not_started' ? ('completed' as const) : crit.status;
        return {
          ...crit,
          evidenceList: updatedEvList,
          selfScore: newScore,
          status: newStatus,
        };
      }
      return crit;
    }),
  }));
}

/**
 * Gán hàng loạt danh sách tệp / link Drive vào các tiêu chí tương ứng
 */
export function batchAttachEvidenceItems(
  items: ParsedDriveImportItem[],
  sections: CCHCSection[]
): { updatedSections: CCHCSection[]; attachedCount: number } {
  let attachedCount = 0;
  const sectionsCopy: CCHCSection[] = JSON.parse(JSON.stringify(sections));

  for (const item of items) {
    if (!item.criterionCode) continue;

    for (const sec of sectionsCopy) {
      for (const crit of sec.criteria) {
        if (crit.code.toUpperCase() === item.criterionCode.toUpperCase()) {
          const alreadyExists = crit.evidenceList?.some(
            (ev) => (item.driveFileId && ev.driveFileId === item.driveFileId) || ev.url === item.url || ev.name === item.name
          );

          if (!alreadyExists) {
            let fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'link' = 'pdf';
            const lower = item.name.toLowerCase();
            if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
              fileType = 'image';
            } else if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
              fileType = 'sheet';
            } else if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
              fileType = 'doc';
            } else if (!lower.includes('.')) {
              fileType = 'link';
            }

            const newEvidence: EvidenceFile = {
              id: 'ev-batch-' + (item.driveFileId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
              name: item.name,
              type: fileType,
              size: 'Google Drive',
              uploadDate: new Date().toISOString().split('T')[0],
              url: item.url,
              driveUrl: item.url,
              driveFileId: item.driveFileId,
              uploadedBy: 'UBND Phường Hội An Đông',
              note: item.note || 'Nhập từ Google Drive',
            };

            if (!crit.evidenceList) {
              crit.evidenceList = [];
            }
            crit.evidenceList.unshift(newEvidence);

            if (crit.status === 'not_started') {
              crit.status = 'completed';
              if (crit.selfScore === 0) {
                crit.selfScore = crit.maxScore;
              }
            }
            attachedCount++;
          }
        }
      }
    }
  }

  return { updatedSections: sectionsCopy, attachedCount };
}
