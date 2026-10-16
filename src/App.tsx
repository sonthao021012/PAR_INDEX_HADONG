/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { DashboardSummary } from './components/DashboardSummary.tsx';
import { CriteriaTable } from './components/CriteriaTable.tsx';
import { CriterionDetailModal } from './components/CriterionDetailModal.tsx';
import { GoogleDriveIntegrationModal } from './components/GoogleDriveIntegrationModal.tsx';
import { ReportExportModal } from './components/ReportExportModal.tsx';
import { EvidencePreviewModal } from './components/EvidencePreviewModal.tsx';
import { HelpModal } from './components/HelpModal.tsx';
import { PasswordPromptModal } from './components/PasswordPromptModal.tsx';
import { GitHubDeployModal } from './components/GitHubDeployModal.tsx';
import { INITIAL_CCHC_SECTIONS } from './data/cchcDataset.ts';
import { CCHCSection, CCHCSubCriterion, GASConfig, EvidenceFile, ChangeLogEntry } from './types/cchc.ts';
import { calculateOverallEvaluation, validateCriterionScore } from './utils/cchcRules.ts';
import { sendGasRequest, getGasData, saveToLocalServerStore, loadFromLocalServerStore } from './services/gasClient.ts';

const LOCAL_STORAGE_KEY_SECTIONS = 'cchc_hoi_an_dong_sections_2026';
const LOCAL_STORAGE_KEY_CONFIG = 'cchc_hoi_an_dong_gas_config';
const LOCAL_STORAGE_KEY_CHANGELOG = 'cchc_hoi_an_dong_changelog_2026';
const LOCAL_STORAGE_KEY_DRIVE_FILE_ID = 'cchc_hoi_an_dong_drive_file_id';

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec';
const DEFAULT_FOLDER_ID = '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq';

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Sections State with LocalStorage Persistence - preserves all previous user updates
  const [sections, setSections] = useState<CCHCSection[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SECTIONS);
      if (saved) {
        const parsed: CCHCSection[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Không thể đọc dữ liệu từ localStorage:', e);
    }
    return INITIAL_CCHC_SECTIONS;
  });

  // Google Apps Script & Drive Configuration
  const [gasConfig, setGasConfig] = useState<GASConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          webAppUrl: parsed.webAppUrl || DEFAULT_GAS_URL,
          driveFolderId: parsed.driveFolderId || DEFAULT_FOLDER_ID,
          connected: true,
        };
      }
    } catch (e) {
      console.warn('Không thể đọc cấu hình Drive từ localStorage:', e);
    }
    return {
      webAppUrl: DEFAULT_GAS_URL,
      driveFolderId: DEFAULT_FOLDER_ID,
      driveFolderName: 'CCHC_2026_UBND_Phuong_Hoi_An_Dong',
      connected: true,
      autoSync: true,
      lastSync: new Date().toLocaleTimeString('vi-VN'),
    };
  });

  // Real-time Change Log State
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_CHANGELOG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Lỗi đọc changelog từ localStorage:', e);
    }
    return [];
  });

  const [driveFileId, setDriveFileId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY_DRIVE_FILE_ID) || '';
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState<boolean>(false);
  const isInitialMount = useRef<boolean>(true);

  // Computed Evaluation
  const evaluation = useMemo(() => {
    return calculateOverallEvaluation(sections);
  }, [sections]);

  // Real-time synchronization function to Drive & local storage / local server cache
  const syncWithDrive = async (
    currentSections: CCHCSection[],
    currentLogs: ChangeLogEntry[],
    reason: string = 'Tự động lưu thay đổi',
    criterionCode?: string,
    isManual: boolean = false
  ) => {
    setIsSyncing(true);
    try {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      const timestampIso = new Date().toISOString();

      const evaluationSummary = calculateOverallEvaluation(currentSections);

      const stateData = {
        sections: currentSections,
        changeLog: currentLogs.slice(0, 50),
        evaluation: evaluationSummary,
        lastUpdated: timestampIso,
        updatedBy: 'UBND Phường Hội An Đông',
        note: reason,
        criterionCode: criterionCode || 'TOÀN BỘ',
      };

      // 1. Save to local server persistent sync store (if dev server available, silently skipped on GitHub Pages)
      await saveToLocalServerStore(stateData);

      // 2. Save directly into Google Drive via Google Apps Script (uploadFile action)
      if (gasConfig.webAppUrl) {
        try {
          const jsonString = JSON.stringify(stateData, null, 2);
          const base64Data = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonString)));

          // Send uploadFile request: saves Nhat_Ky_Cap_Nhat_CCHC_2026.json directly to Drive
          const uploadRes = await sendGasRequest(gasConfig.webAppUrl, {
            action: 'uploadFile',
            fileName: 'Nhat_Ky_Cap_Nhat_CCHC_2026.json',
            base64Data: base64Data,
            mimeType: 'application/json',
            sectionName: 'Nhat_Ky_He_Thong',
            criterionCode: 'LOG',
            note: reason,
          });

          if (uploadRes && uploadRes.success && uploadRes.data?.fileId) {
            setDriveFileId(uploadRes.data.fileId);
            localStorage.setItem(LOCAL_STORAGE_KEY_DRIVE_FILE_ID, uploadRes.data.fileId);
          }

          // Also attempt syncData action in case Apps Script v2 is deployed
          try {
            await sendGasRequest(gasConfig.webAppUrl, {
              action: 'syncData',
              sections: currentSections,
              evaluation: evaluationSummary,
              note: reason,
              criterionCode: criterionCode || 'TOÀN BỘ',
              updatedBy: 'UBND Phường Hội An Đông',
            });
          } catch (_) {
            // Optional syncData
          }
        } catch (e) {
          console.warn('GAS sync warning:', e);
        }
      }

      setLastSyncTime(timeStr);
      setGasConfig((prev) => ({ ...prev, lastSync: timeStr }));

      // Mark changelog entries as driveSynced
      setChangeLog((prev) =>
        prev.map((entry) => ({ ...entry, driveSynced: true }))
      );
    } catch (err) {
      console.warn('Lỗi đồng bộ:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // On App startup: check for previous user updates from local server store or Drive
  useEffect(() => {
    let isMounted = true;
    const fetchPreviousUpdates = async () => {
      try {
        // 1. Try to fetch from server store first (instant load if dev server running)
        const storeData = await loadFromLocalServerStore();
        if (storeData && storeData.sections && Array.isArray(storeData.sections) && storeData.sections.length > 0) {
          if (isMounted) {
            setSections(storeData.sections);
            if (Array.isArray(storeData.changeLog)) {
              setChangeLog(storeData.changeLog);
            }
            const syncTime = storeData.lastUpdated
              ? new Date(storeData.lastUpdated).toLocaleTimeString('vi-VN')
              : new Date().toLocaleTimeString('vi-VN');
            setLastSyncTime(syncTime);
            return;
          }
        }

        // 2. Also check if there is a saved file in Google Drive via Apps Script
        if (gasConfig.webAppUrl) {
          const gasRes = await sendGasRequest(gasConfig.webAppUrl, { action: 'getData' });
          if (gasRes && gasRes.success && gasRes.data?.sections && Array.isArray(gasRes.data.sections)) {
            if (isMounted) {
              setSections(gasRes.data.sections);
              if (Array.isArray(gasRes.data.changeLog)) {
                setChangeLog(gasRes.data.changeLog);
              }
              setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
            }
          }
        }
      } catch (e) {
        console.warn('Không thể nạp dữ liệu từ remote sync lúc khởi động:', e);
      }
    };

    fetchPreviousUpdates();
    return () => { isMounted = false; };
  }, []);

  // Save changes to localStorage immediately
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SECTIONS, JSON.stringify(sections));
    } catch (e) {
      console.error('Lỗi lưu trữ dữ liệu tiêu chí:', e);
    }
  }, [sections]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(gasConfig));
    } catch (e) {
      console.error('Lỗi lưu cấu hình Google Apps Script:', e);
    }
  }, [gasConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CHANGELOG, JSON.stringify(changeLog));
    } catch (e) {
      console.error('Lỗi lưu changelog vào localStorage:', e);
    }
  }, [changeLog]);

  // Debounced real-time sync to Drive when sections or changeLog are updated
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      syncWithDrive(sections, changeLog, 'Tự động lưu thay đổi theo thời gian thực');
    }, 1500);
    return () => clearTimeout(timer);
  }, [sections]);

  // Manual Reload from Drive handler
  const handleReloadFromDrive = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch from server store if available
      const storeData = await loadFromLocalServerStore();
      if (storeData && storeData.sections && Array.isArray(storeData.sections)) {
        setSections(storeData.sections);
        if (Array.isArray(storeData.changeLog)) {
          setChangeLog(storeData.changeLog);
        }
        setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
        return;
      }

      // 2. If gasConfig is connected, query GAS directly / via proxy
      if (gasConfig.webAppUrl) {
        const data = await sendGasRequest(gasConfig.webAppUrl, { action: 'getData' });
        if (data && data.success && data.data?.sections) {
          setSections(data.data.sections);
          if (Array.isArray(data.data.changeLog)) {
            setChangeLog(data.data.changeLog);
          }
          setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
        }
      }
    } catch (err) {
      console.warn('Lỗi nạp từ Drive:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Selected Section for Filter Carousel
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');

  // Modal States
  const [activeCriterionData, setActiveCriterionData] = useState<{
    criterion: CCHCSubCriterion;
    section: CCHCSection;
  } | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceFile | null>(null);

  // Authentication check for Apps Script & Drive access
  const handleRequestOpenDrive = () => {
    const isAuth = sessionStorage.getItem('cchc_drive_auth') === 'tsvmmm123';
    if (isAuth) {
      setIsDriveModalOpen(true);
    } else {
      setIsPasswordModalOpen(true);
    }
  };

  const handlePasswordSuccess = () => {
    sessionStorage.setItem('cchc_drive_auth', 'tsvmmm123');
    setIsPasswordModalOpen(false);
    setIsDriveModalOpen(true);
  };

  // Quick Score Update
  const handleQuickUpdateScore = (criterionId: string, newScore: number) => {
    let affectedCrit: CCHCSubCriterion | null = null;
    let oldScoreVal = 0;
    let oldStatusVal: any = 'not_started';

    setSections((prevSections) =>
      prevSections.map((sec) => ({
        ...sec,
        criteria: sec.criteria.map((crit) => {
          if (crit.id === criterionId) {
            affectedCrit = crit;
            oldScoreVal = crit.selfScore;
            oldStatusVal = crit.status;

            const validated = validateCriterionScore(newScore, crit.maxScore);
            const newStatus = validated >= crit.maxScore ? 'completed' : validated > 0 ? 'in_progress' : 'not_started';

            return {
              ...crit,
              selfScore: validated,
              status: newStatus,
            };
          }
          return crit;
        }),
      }))
    );

    if (affectedCrit) {
      const crit = affectedCrit as CCHCSubCriterion;
      const validated = validateCriterionScore(newScore, crit.maxScore);
      const newStatus = validated >= crit.maxScore ? 'completed' : validated > 0 ? 'in_progress' : 'not_started';

      const logEntry: ChangeLogEntry = {
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        criterionCode: crit.code,
        criterionTitle: crit.title,
        action: 'Cập nhật điểm tự chấm',
        oldScore: oldScoreVal,
        newScore: validated,
        oldStatus: oldStatusVal,
        newStatus: newStatus,
        note: `Chấm điểm: ${oldScoreVal}đ ➔ ${validated}đ`,
        updatedBy: 'UBND Phường Hội An Đông',
        driveSynced: false,
      };

      setChangeLog((prev) => [logEntry, ...prev.slice(0, 49)]);
    }
  };

  // Full Criterion Save
  const handleSaveCriterion = (updatedCriterion: CCHCSubCriterion) => {
    let oldCrit: CCHCSubCriterion | null = null;

    setSections((prevSections) =>
      prevSections.map((sec) => ({
        ...sec,
        criteria: sec.criteria.map((crit) => {
          if (crit.id === updatedCriterion.id) {
            oldCrit = crit;
            return updatedCriterion;
          }
          return crit;
        }),
      }))
    );

    const logEntry: ChangeLogEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      criterionCode: updatedCriterion.code,
      criterionTitle: updatedCriterion.title,
      action: 'Cập nhật tiến độ & minh chứng',
      oldScore: oldCrit ? (oldCrit as CCHCSubCriterion).selfScore : undefined,
      newScore: updatedCriterion.selfScore,
      oldStatus: oldCrit ? (oldCrit as CCHCSubCriterion).status : undefined,
      newStatus: updatedCriterion.status,
      note: updatedCriterion.notes || `Cập nhật tiến độ: ${updatedCriterion.status}`,
      updatedBy: 'UBND Phường Hội An Đông',
      driveSynced: false,
    };

    setChangeLog((prev) => [logEntry, ...prev.slice(0, 49)]);
  };

  const handleOpenCriterion = (criterion: CCHCSubCriterion, section: CCHCSection) => {
    setActiveCriterionData({ criterion, section });
  };

  const handleQuickUpload = (criterion: CCHCSubCriterion, section: CCHCSection) => {
    setActiveCriterionData({ criterion, section });
  };

  const handleRestoreData = (newSections: CCHCSection[], newLogs: ChangeLogEntry[]) => {
    setSections(newSections);
    setChangeLog(newLogs);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SECTIONS, JSON.stringify(newSections));
      localStorage.setItem(LOCAL_STORAGE_KEY_CHANGELOG, JSON.stringify(newLogs));
    } catch (e) {
      console.warn('Lỗi lưu sau khi khôi phục:', e);
    }
    syncWithDrive(newSections, newLogs, 'Khôi phục từ file sao lưu JSON', undefined, true);
  };

  const handleResetToDefault = () => {
    if (confirm('Khôi phục dữ liệu Bộ chỉ số CCHC UBND Phường Hội An Đông về mặc định ban đầu (Chưa thực hiện, 0 điểm)?')) {
      setSections(INITIAL_CCHC_SECTIONS);
      setChangeLog([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY_SECTIONS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_CHANGELOG);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-red-200">
      {/* Government Navigation & Title Bar */}
      <Header
        evaluation={evaluation}
        gasConfig={gasConfig}
        onOpenDriveModal={handleRequestOpenDrive}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        selectedYear={selectedYear}
        onChangeYear={setSelectedYear}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onSyncNow={() => syncWithDrive(sections, changeLog, 'Lưu thủ công toàn bộ', undefined, true)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        
        {/* KPI Summary Cards & Section Filter */}
        <DashboardSummary
          evaluation={evaluation}
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
        />

        {/* Master Criteria Table */}
        <CriteriaTable
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
          onOpenCriterionModal={handleOpenCriterion}
          onQuickUpdateScore={handleQuickUpdateScore}
          onQuickUpload={handleQuickUpload}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>UBND PHƯỜNG HỘI AN ĐÔNG</strong> — Bộ chỉ số đánh giá, xếp hạng CCHC theo QĐ của UBND thành phố Đà Nẵng
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="text-slate-700 hover:text-slate-950 font-semibold hover:underline"
            >
              Xuất bản GitHub Pages
            </button>
            <span>•</span>
            <button
              onClick={handleRequestOpenDrive}
              className="text-sky-700 hover:underline font-semibold"
            >
              Cấu hình Google Drive & Apps Script
            </button>
            <span>•</span>
            <button
              onClick={handleResetToDefault}
              className="text-slate-500 hover:text-red-700 hover:underline"
            >
              Khôi phục dữ liệu gốc
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PasswordPromptModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handlePasswordSuccess}
      />

      <CriterionDetailModal
        criterion={activeCriterionData?.criterion || null}
        section={activeCriterionData?.section || null}
        gasConfig={gasConfig}
        isOpen={Boolean(activeCriterionData)}
        onClose={() => setActiveCriterionData(null)}
        onSaveCriterion={handleSaveCriterion}
        onPreviewEvidence={(ev) => setPreviewEvidence(ev)}
      />

      <GoogleDriveIntegrationModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        gasConfig={gasConfig}
        onSaveConfig={setGasConfig}
        sections={sections}
        changeLog={changeLog}
        onForceSync={() => syncWithDrive(sections, changeLog, 'Lưu thủ công toàn bộ', undefined, true)}
        onReloadFromDrive={handleReloadFromDrive}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        driveFileId={driveFileId}
      />

      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        sections={sections}
        evaluation={evaluation}
        year={selectedYear}
      />

      <EvidencePreviewModal
        evidence={previewEvidence}
        isOpen={Boolean(previewEvidence)}
        onClose={() => setPreviewEvidence(null)}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <GitHubDeployModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        sections={sections}
        changeLog={changeLog}
        evaluation={evaluation}
        onRestoreData={handleRestoreData}
      />
    </div>
  );
}
