import type { CCHCSection, OverallEvaluation, GASConfig } from '../types/cchc.ts';

/**
 * Calculates sum of selfScore for a section while respecting bounds
 */
export function calculateSectionScore(section: CCHCSection): number {
  const sum = section.criteria.reduce((acc, curr) => acc + (curr.selfScore || 0), 0);
  return Number(Math.min(sum, section.maxScore).toFixed(2));
}

/**
 * Calculates overall scores across all sections according to Decision criteria:
 * - Base sections I to VIII: max 100 points
 * - Section IX.1 Bonus: max +10 points
 * - Section IX.2 Penalty: max -10 points
 * - Final Score = BaseScore + BonusScore - PenaltyScore
 */
export function calculateOverallEvaluation(sections: CCHCSection[]): OverallEvaluation {
  let baseScore = 0;
  const maxBase = 100;
  let bonusScore = 0;
  let penaltyScore = 0;
  let totalEvidence = 0;
  let totalCriteria = 0;
  let completedCriteria = 0;

  for (const section of sections) {
    const sScore = calculateSectionScore(section);
    
    if (section.id === 'IX_BONUS') {
      bonusScore = Math.min(sScore, 10);
    } else if (section.id === 'IX_PENALTY') {
      penaltyScore = Math.min(sScore, 10);
    } else {
      baseScore += sScore;
    }

    for (const c of section.criteria) {
      totalCriteria++;
      totalEvidence += c.evidenceList ? c.evidenceList.length : 0;
      if (c.status === 'completed' || c.status === 'outstanding') {
        completedCriteria++;
      }
    }
  }

  // Base score capped at 100
  baseScore = Number(Math.min(baseScore, maxBase).toFixed(2));
  
  // Final score can range between 0 and 110 (100 base + 10 bonus - penalty)
  const rawFinal = baseScore + bonusScore - penaltyScore;
  const finalScore = Number(Math.max(0, rawFinal).toFixed(2));
  const completionPercentage = Number(
    totalCriteria > 0 ? ((completedCriteria / totalCriteria) * 100).toFixed(1) : '0'
  );

  const { ranking, color } = getRankingDetails(finalScore);

  return {
    totalBaseScore: baseScore,
    maxBaseScore: maxBase,
    totalBonusScore: bonusScore,
    totalPenaltyScore: penaltyScore,
    finalScore,
    completionPercentage,
    ranking,
    rankingColor: color,
    totalEvidenceCount: totalEvidence,
    totalCriteriaCount: totalCriteria,
    completedCriteriaCount: completedCriteria,
  };
}

/**
 * Classifies ranking according to administrative reform benchmark standards:
 * - >= 90: Xuất sắc
 * - >= 80: Tốt
 * - >= 70: Khá
 * - < 70: Trung bình / Cần cải thiện
 */
export function getRankingDetails(score: number): { ranking: string; color: string } {
  if (score >= 90) {
    return { ranking: 'Xuất sắc', color: 'emerald' };
  } else if (score >= 80) {
    return { ranking: 'Tốt', color: 'blue' };
  } else if (score >= 70) {
    return { ranking: 'Khá', color: 'amber' };
  } else {
    return { ranking: 'Trung bình', color: 'rose' };
  }
}

/**
 * Validates a single criterion score
 */
export function validateCriterionScore(value: number, maxScore: number): number {
  if (isNaN(value) || value < 0) return 0;
  if (value > maxScore) return maxScore;
  return Number(value.toFixed(2));
}

/**
 * Generates the clean Google Drive folder hierarchy name for a criterion
 */
export function getDriveFolderPath(sectionRoman: string, sectionTitle: string, criterionCode: string): string {
  const sanitize = (text: string) =>
    text
      .replace(/[Đđ]/g, 'D')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 30);

  return `CCHC_HoiAnDong_2026/${sectionRoman}_${sanitize(sectionTitle)}/${criterionCode}`;
}

/**
 * Generates ready-to-use Google Apps Script (.gs) code for UBND Phường Hội An Đông
 * Hỗ trợ upload tệp vào Google Drive, lưu link và ghi nhật ký minh chứng
 */
export function generateGoogleAppsScriptCode(config?: Partial<GASConfig>): string {
  const rootFolderName = config?.driveFolderName || 'CCHC_2026_UBND_Phuong_Hoi_An_Dong';
  
  return `/**
 * Google Apps Script - Quản lý & Đồng bộ Thời gian thực Minh chứng CCHC UBND Phường Hội An Đông
 * Web App URL: https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec
 */

const ROOT_FOLDER_NAME = "${rootFolderName}";
const ROOT_FOLDER_ID = "${config?.driveFolderId || ''}";
const DATA_FILE_NAME = "Du_Lieu_CCHC_2026_Phuong_Hoi_An_Dong.json";
const LOG_SHEET_NAME = "Nhat_Ky_Minh_Chung_CCHC_2026";

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "status";
    
    if (action === "getData" || action === "loadData") {
      const data = loadDataFromStorage();
      return responseSuccess(data);
    }

    if (action === "getDriveFiles" || action === "scanDrive" || action === "scanFiles") {
      const files = scanDriveFiles();
      return responseSuccess({ files: files, totalFiles: files.length });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Google Apps Script CCHC Hội An Đông đang hoạt động bình thường!",
      rootFolder: ROOT_FOLDER_NAME,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return responseError(err.toString());
  }
}

function doPost(e) {
  try {
    let postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter || {};
    }
    const action = postData.action || "uploadFile";
    
    if (action === "testConnection") {
      const rootFolder = getOrCreateRootFolder();
      const files = scanDriveFiles();
      return responseSuccess({
        connected: true,
        rootFolder: rootFolder.getName(),
        rootFolderId: rootFolder.getId(),
        realFileCount: files.length,
        files: files
      });
    }

    // QUÉT TẤT CẢ FILE THỰC TẾ TRONG THƯ MỤC DRIVE
    if (action === "getDriveFiles" || action === "scanDrive" || action === "scanFiles") {
      const files = scanDriveFiles();
      return responseSuccess({ files: files, totalFiles: files.length });
    }

    // LƯU MỌI THAY ĐỔI (ĐIỂM, TIẾN ĐỘ, MINH CHỨNG) VÀO DRIVE THEO THỜI GIAN THỰC
    if (action === "syncData" || action === "saveData") {
      const sections = postData.sections;
      const evaluation = postData.evaluation || {};
      const note = postData.note || "Đồng bộ thay đổi thời gian thực";
      const criterionCode = postData.criterionCode || "TOÀN BỘ";
      const updatedBy = postData.updatedBy || "UBND Phường Hội An Đông";

      if (!sections) {
        return responseError("Không có dữ liệu sections để đồng bộ!");
      }

      // 1. Lưu vào tệp JSON trong thư mục gốc Google Drive
      const rootFolder = getOrCreateRootFolder();
      saveDataToFile(rootFolder, {
        sections: sections,
        evaluation: evaluation,
        lastUpdated: new Date().toISOString(),
        updatedBy: updatedBy
      });

      // 2. Lưu vào PropertiesService để truy xuất tức thì
      PropertiesService.getScriptProperties().setProperty("cchc_sections_json", JSON.stringify(sections));
      PropertiesService.getScriptProperties().setProperty("cchc_last_sync", new Date().toISOString());

      // 3. Ghi nhật ký vào Google Sheets trong Drive
      logUpdateToSheet(rootFolder, {
        criterionCode: criterionCode,
        actionType: "Cập nhật tiến độ & điểm",
        note: note,
        scoreSummary: (evaluation.finalScore || 0) + "đ (" + (evaluation.ranking || "") + ")",
        updatedBy: updatedBy,
        date: new Date()
      });

      return responseSuccess({
        synced: true,
        timestamp: new Date().toISOString(),
        message: "Đã lưu toàn bộ thay đổi vào file nhật ký trong Google Drive!"
      });
    }

    // TẢI LẠI DỮ LIỆU ĐÃ LƯU TỪ GOOGLE DRIVE
    if (action === "getData" || action === "loadData") {
      const data = loadDataFromStorage();
      return responseSuccess(data);
    }

    // QUÉT TẤT CẢ FILE THỰC TẾ TRONG THƯ MỤC DRIVE
    if (action === "getDriveFiles") {
      const files = scanDriveFiles();
      return responseSuccess({ files: files });
    }

    // TẢI FILE / ẢNH MINH CHỨNG LÊN GOOGLE DRIVE
    if (action === "uploadFile") {
      const fileName = postData.fileName || "minh_chung_cchc_" + new Date().getTime();
      const base64Data = postData.base64Data;
      const mimeType = postData.mimeType || "application/pdf";
      const sectionName = postData.sectionName || "Chung";
      const criterionCode = postData.criterionCode || "TieuChi";
      const documentNumber = postData.documentNumber || "";
      const note = postData.note || "";

      if (!base64Data) {
        return responseError("Không tìm thấy dữ liệu base64 của tệp!");
      }

      const rootFolder = getOrCreateRootFolder();
      let targetFolder = rootFolder;
      if (sectionName === "Backup") {
        targetFolder = getOrCreateSubFolder(rootFolder, "Backup");
      } else {
        const sectionFolder = getOrCreateSubFolder(rootFolder, sectionName);
        targetFolder = criterionCode ? getOrCreateSubFolder(sectionFolder, criterionCode) : sectionFolder;
      }

      const rawBase64 = base64Data.indexOf(",") > -1 ? base64Data.split(",")[1] : base64Data;
      const decodedBytes = Utilities.base64Decode(rawBase64);
      const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
      const driveFile = targetFolder.createFile(blob);
      
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      logUploadToSheet(rootFolder, {
        fileName: fileName,
        fileUrl: driveFile.getUrl(),
        fileId: driveFile.getId(),
        criterionCode: criterionCode || "BACKUP",
        documentNumber: documentNumber,
        note: note,
        uploadDate: new Date()
      });

      return responseSuccess({
        fileId: driveFile.getId(),
        fileUrl: driveFile.getUrl(),
        downloadUrl: driveFile.getDownloadUrl(),
        viewUrl: "https://drive.google.com/file/d/" + driveFile.getId() + "/view?usp=sharing",
        fileName: fileName,
        folderPath: ROOT_FOLDER_NAME + " > " + (sectionName === "Backup" ? "Backup" : (sectionName + " > " + criterionCode))
      });
    }

    // LẤY DANH SÁCH BẢN SAO LƯU TRONG THƯ MỤC BACKUP
    if (action === "getBackupFiles") {
      const rootFolder = getOrCreateRootFolder();
      const backupFolder = getOrCreateSubFolder(rootFolder, "Backup");
      const files = backupFolder.getFiles();
      const backupList = [];
      while (files.hasNext()) {
        const f = files.next();
        if (f.getName().indexOf(".json") > -1) {
          backupList.push({
            id: f.getId(),
            name: f.getName(),
            size: (f.getSize() / 1024).toFixed(1) + " KB",
            date: Utilities.formatDate(f.getDateCreated(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
            viewUrl: "https://drive.google.com/file/d/" + f.getId() + "/view?usp=sharing"
          });
        }
      }
      return responseSuccess({ files: backupList });
    }

    // ĐỌC NỘI DUNG TỆP SAO LƯU TỪ GOOGLE DRIVE
    if (action === "readBackupFile") {
      const fileId = postData.fileId;
      if (!fileId) return responseError("Thiếu mã tệp fileId!");
      const file = DriveApp.getFileById(fileId);
      const content = file.getBlob().getDataAsString();
      return responseSuccess({ content: content, fileName: file.getName() });
    }
    }

    // XÓA FILE MINH CHỨNG TRÊN GOOGLE DRIVE (CHUYỂN VÀO THÙNG RÁC)
    if (action === "deleteFile" || action === "trashFile") {
      const fileId = postData.fileId;
      const fileName = postData.fileName;
      let fileDeleted = false;
      let message = "";

      if (fileId && typeof fileId === "string" && fileId.trim().length > 5) {
        try {
          const file = DriveApp.getFileById(fileId.trim());
          file.setTrashed(true);
          fileDeleted = true;
          message = "Đã chuyển tệp '" + file.getName() + "' vào thùng rác trên Google Drive thành công";
        } catch (err) {
          message = "Không tìm thấy hoặc không xóa được file theo ID trên Drive: " + err.toString();
        }
      }

      if (!fileDeleted && fileName && typeof fileName === "string" && fileName.trim().length > 0) {
        try {
          const rootFolder = getOrCreateRootFolder();
          const files = rootFolder.searchFiles("title = '" + fileName.trim().replace(/'/g, "\\'") + "' and trashed = false");
          while (files.hasNext()) {
            const f = files.next();
            f.setTrashed(true);
            fileDeleted = true;
          }
          if (fileDeleted) {
            message = "Đã tìm thấy và chuyển tệp '" + fileName + "' vào thùng rác Google Drive";
          } else {
            message = "Không tìm thấy tệp có tên '" + fileName + "' trong thư mục Drive";
          }
        } catch (err) {
          message = "Lỗi khi tìm kiếm tệp để xóa: " + err.toString();
        }
      }

      return responseSuccess({
        deleted: fileDeleted,
        fileId: fileId,
        fileName: fileName,
        message: message
      });
    }

    return responseError("Hành động không hợp lệ: " + action);
  } catch (error) {
    return responseError(error.toString());
  }
}

function getOrCreateRootFolder() {
  if (ROOT_FOLDER_ID && ROOT_FOLDER_ID.trim().length > 5) {
    try {
      return DriveApp.getFolderById(ROOT_FOLDER_ID.trim());
    } catch(errId) {
      Logger.log("Không mở được folder theo ID, chuyển sang tìm theo tên: " + errId.toString());
    }
  }
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const cleanName = subFolderName.replace(/[\\\\/:*?"<>|]/g, "_");
  const folders = parentFolder.getFoldersByName(cleanName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(cleanName);
}

function saveDataToFile(rootFolder, dataObj) {
  try {
    const files = rootFolder.getFilesByName(DATA_FILE_NAME);
    const content = JSON.stringify(dataObj, null, 2);
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(content);
    } else {
      rootFolder.createFile(DATA_FILE_NAME, content, "application/json");
    }
  } catch(e) {
    Logger.log("Lỗi ghi file JSON: " + e.toString());
  }
}

function loadDataFromStorage() {
  try {
    // 1. Thử đọc từ PropertiesService trước
    const cached = PropertiesService.getScriptProperties().getProperty("cchc_sections_json");
    if (cached) {
      return { sections: JSON.parse(cached), source: "cache" };
    }
    // 2. Thử đọc từ file JSON trong thư mục Drive
    const rootFolder = getOrCreateRootFolder();
    const files = rootFolder.getFilesByName(DATA_FILE_NAME);
    if (files.hasNext()) {
      const content = files.next().getBlob().getDataAsString();
      return JSON.parse(content);
    }
  } catch (e) {
    Logger.log("Lỗi nạp dữ liệu: " + e.toString());
  }
  return null;
}

function scanDriveFiles(targetFolder, currentPath) {
  const fileList = [];
  try {
    const root = targetFolder || getOrCreateRootFolder();
    const path = currentPath || root.getName();

    // 1. Quét tệp trong thư mục hiện tại
    const rootFiles = root.getFiles();
    while (rootFiles.hasNext()) {
      const f = rootFiles.next();
      if (f.getName() === DATA_FILE_NAME || f.getName() === LOG_SHEET_NAME) continue;
      fileList.push({
        id: f.getId(),
        name: f.getName(),
        url: f.getUrl(),
        viewUrl: "https://drive.google.com/file/d/" + f.getId() + "/view?usp=sharing",
        size: (f.getSize() / 1024).toFixed(1) + " KB",
        date: Utilities.formatDate(f.getDateCreated(), "GMT+7", "yyyy-MM-dd"),
        folder: root.getName(),
        folderPath: path,
        mimeType: f.getMimeType()
      });
    }

    // 2. Đệ quy quét tất cả thư mục con (bất kể độ sâu)
    const subFolders = root.getFolders();
    while (subFolders.hasNext()) {
      const sub = subFolders.next();
      const subFiles = scanDriveFiles(sub, path + " > " + sub.getName());
      for (var i = 0; i < subFiles.length; i++) {
        fileList.push(subFiles[i]);
      }
    }
  } catch (e) {
    Logger.log("Lỗi quét tệp: " + e.toString());
  }
  return fileList;
}

function logUploadToSheet(rootFolder, data) {
  try {
    const ss = getOrCreateSheet(rootFolder);
    const sheet = ss.getActiveSheet();
    sheet.appendRow([
      Utilities.formatDate(data.uploadDate, "GMT+7", "yyyy-MM-dd HH:mm:ss"),
      "TẢI LÊN MINH CHỨNG",
      data.criterionCode,
      data.documentNumber,
      data.fileName,
      data.fileUrl,
      data.note
    ]);
  } catch(e) {
    Logger.log("Lỗi ghi nhật ký upload: " + e.toString());
  }
}

function logUpdateToSheet(rootFolder, data) {
  try {
    const ss = getOrCreateSheet(rootFolder);
    const sheet = ss.getActiveSheet();
    sheet.appendRow([
      Utilities.formatDate(data.date, "GMT+7", "yyyy-MM-dd HH:mm:ss"),
      data.actionType,
      data.criterionCode,
      "-",
      data.scoreSummary,
      data.note,
      data.updatedBy
    ]);
  } catch(e) {
    Logger.log("Lỗi ghi nhật ký update: " + e.toString());
  }
}

function getOrCreateSheet(rootFolder) {
  const files = rootFolder.getFilesByName(LOG_SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  const ss = SpreadsheetApp.create(LOG_SHEET_NAME);
  const initialFile = DriveApp.getFileById(ss.getId());
  rootFolder.addFile(initialFile);
  DriveApp.getRootFolder().removeFile(initialFile);
  
  const sheet = ss.getActiveSheet();
  sheet.appendRow([
    "Thời gian", "Hoạt động", "Mã Tiêu chí", "Số ký hiệu văn bản", "Tên tệp / Điểm số", "Đường dẫn Drive / Ghi chú", "Người thực hiện"
  ]);
  sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#e0f2fe");
  return ss;
}

function responseSuccess(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function responseError(msg) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: msg
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
}

