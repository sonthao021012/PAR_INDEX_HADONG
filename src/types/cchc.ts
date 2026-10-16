export type CriterionStatus = 'not_started' | 'in_progress' | 'completed' | 'outstanding';

export interface EvidenceFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'doc' | 'sheet' | 'link';
  size?: string;
  uploadDate: string;
  url: string; // Base64 data URL or external Google Drive view URL
  driveFileId?: string;
  driveUrl?: string;
  documentNumber?: string; // Số/Ký hiệu văn bản (VD: 15/KH-UBND)
  issueDate?: string;      // Ngày ban hành (VD: 15/01/2026)
  note?: string;           // Trích yếu/Ghi chú minh chứng
  uploadedBy?: string;     // Cán bộ cập nhật
}

export interface CCHCSubCriterion {
  id: string;
  code: string;
  title: string;
  maxScore: number;
  selfScore: number;
  officialScore?: number;
  status: CriterionStatus;
  department: string;
  deadline?: string;
  scoringGuide: string;
  notes?: string;
  evidenceList: EvidenceFile[];
}

export interface CCHCSection {
  id: string;
  romanNumeral: string;
  title: string;
  maxScore: number;
  isBonusOrPenalty?: boolean;
  type?: 'base' | 'bonus' | 'penalty';
  criteria: CCHCSubCriterion[];
}

export interface GASConfig {
  webAppUrl: string;
  driveFolderId: string;
  driveFolderName: string;
  connected: boolean;
  lastSync?: string;
  autoSync: boolean;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  criterionCode: string;
  criterionTitle: string;
  action: string;
  oldScore?: number;
  newScore: number;
  oldStatus?: CriterionStatus;
  newStatus: CriterionStatus;
  note?: string;
  updatedBy: string;
  driveSynced: boolean;
}

export interface DriveRealFile {
  id: string;
  name: string;
  size?: string;
  uploadDate: string;
  driveUrl: string;
  viewUrl: string;
  folder: string;
  criterionCode?: string;
  isRealDoc: boolean;
}

export interface OverallEvaluation {
  totalBaseScore: number;
  maxBaseScore: number;
  totalBonusScore: number;
  totalPenaltyScore: number;
  finalScore: number;
  completionPercentage: number;
  ranking: string;
  rankingColor: string;
  totalEvidenceCount: number;
  totalCriteriaCount: number;
  completedCriteriaCount: number;
}
