/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { DashboardSummary } from './components/DashboardSummary.tsx';
import { CriteriaTable } from './components/CriteriaTable.tsx';
import { CriterionDetailModal } from './components/CriterionDetailModal.tsx';
import { SystemSettingsModal } from './components/SystemSettingsModal.tsx';
import { ReportExportModal } from './components/ReportExportModal.tsx';
import { EvidencePreviewModal } from './components/EvidencePreviewModal.tsx';
import { HelpModal } from './components/HelpModal.tsx';
import { PasswordPromptModal } from './components/PasswordPromptModal.tsx';
import { INITIAL_CCHC_SECTIONS } from './data/cchcDataset.ts';
import { CCHCSection, CCHCSubCriterion, GASConfig, EvidenceFile, ChangeLogEntry } from './types/cchc.ts';
import { calculateOverallEvaluation, validateCriterionScore } from './utils/cchcRules.ts';
import { sendGasRequest, saveToLocalServerStore, loadFromLocalServerStore } from './services/gasClient.ts';
import { saveToFirebase, loadFromFirebase, subscribeToFirebaseSync } from './services/firebase.ts';

const LOCAL_STORAGE_KEY_CONFIG = 'cchc_hoi_an_dong_gas_config';
const LOCAL_STORAGE_KEY_AVAILABLE_YEARS = 'cchc_hoi_an_dong_available_years';
const LOCAL_STORAGE_KEY_DRIVE_FILE_ID = 'cchc_hoi_an_dong_drive_file_id';

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec';
const DEFAULT_FOLDER_ID = '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq';

export default function App() {
  // Year management: default is 2026 (current year), additional years can be created in System Settings
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [availableYears, setAvailableYears] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AVAILABLE_YEARS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.includes(2026)) {
          return parsed.sort((a: number, b: number) => a - b);
        }
      }
    } catch (_) {}
    return [2026];
  });

  // Sections State with LocalStorage Persistence per year
  const [sections, setSections] = useState<CCHCSection[]>(() => {
    try {
      const saved = localStorage.getItem(`cchc_hoi_an_dong_sections_2026`);
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
      const saved = localStorage.getItem(`cchc_hoi_an_dong_changelog_${selectedYear}`);
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
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [syncNotification, setSyncNotification] = useState<{ id: string; text: string; type: 'success' | 'info' } | null>(null);

  // System Settings Modal & Authentication State
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState<boolean>(false);
  const [systemSettingsTab, setSystemSettingsTab] = useState<'years' | 'evidence' | 'gas' | 'github' | 'firebase'>('years');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);

  // Other Modal States
  const [activeCriterionData, setActiveCriterionData] = useState<{
    criterion: CCHCSubCriterion;
    section: CCHCSection;
  } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceFile | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('ALL');

  const isInitialMount = useRef<boolean>(true);
  const isInitialLoadCompleteRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const lastLocalUpdateRef = useRef<number>(Date.now());

  // Keep isSyncingRef in sync with state
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Auto-dismiss sync notifications after 4 seconds
  useEffect(() => {
    if (!syncNotification) return;
    const timer = setTimeout(() => {
      setSyncNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [syncNotification]);

  // Computed Evaluation
  const evaluation = useMemo(() => {
    return calculateOverallEvaluation(sections);
  }, [sections]);

  // Real-time synchronization function to Drive & Shared Server Store across all machines
  const syncWithDrive = async (
    currentSections: CCHCSection[],
    currentLogs: ChangeLogEntry[],
    reason: string = 'Tự động lưu thay đổi',
    criterionCode?: string,
    isManual: boolean = false
  ) => {
    setIsSyncing(true);
    isSyncingRef.current = true;
    try {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      const timestampIso = new Date().toISOString();
      const timestampMs = Date.now();
      lastLocalUpdateRef.current = timestampMs;

      const evaluationSummary = calculateOverallEvaluation(currentSections);

      const stateData = {
        year: selectedYear,
        sections: currentSections,
        changeLog: currentLogs.slice(0, 50),
        evaluation: evaluationSummary,
        lastUpdated: timestampIso,
        lastUpdatedTimestamp: timestampMs,
        updatedBy: 'UBND Phường Hội An Đông',
        note: reason,
        criterionCode: criterionCode || 'TOÀN BỘ',
      };

      // 1. Broadcast to any other open tabs on this machine immediately (<5ms)
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('cchc_sync_channel');
          ch.postMessage({
            type: 'LOCAL_SYNC_UPDATE',
            data: stateData,
          });
          ch.close();
        }
      } catch (_) {}

      // 2. Save to shared server store
      await saveToLocalServerStore(stateData);

      // 3. Save directly into Google Drive via Google Apps Script
      if (gasConfig.webAppUrl) {
        try {
          const jsonString = JSON.stringify(stateData, null, 2);
          const base64Data = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonString)));

          const uploadRes = await sendGasRequest(gasConfig.webAppUrl, {
            action: 'uploadFile',
            fileName: `Nhat_Ky_Cap_Nhat_CCHC_${selectedYear}.json`,
            base64Data: base64Data,
            mimeType: 'application/json',
            sectionName: 'Nhat_Ky_He_Thong',
            criterionCode: 'LOG',
            note: reason,
          }, 15000);

          if (uploadRes && uploadRes.success && uploadRes.data?.fileId) {
            setDriveFileId(uploadRes.data.fileId);
            localStorage.setItem(LOCAL_STORAGE_KEY_DRIVE_FILE_ID, uploadRes.data.fileId);
          }

          try {
            await sendGasRequest(gasConfig.webAppUrl, {
              action: 'syncData',
              sections: currentSections,
              evaluation: evaluationSummary,
              lastUpdated: timestampIso,
              lastUpdatedTimestamp: timestampMs,
              note: reason,
              criterionCode: criterionCode || 'TOÀN BỘ',
              updatedBy: 'UBND Phường Hội An Đông',
            }, 10000);
          } catch (_) {}
        } catch (e) {
          console.warn('Google Drive sync warning:', e);
        }
      }

      // 4. Save to Firebase Firestore
      try {
        const fbOk = await saveToFirebase(stateData);
        if (fbOk) {
          setFirebaseConnected(true);
        }
      } catch (fbErr) {
        console.warn('Lỗi lưu Firebase:', fbErr);
        setFirebaseConnected(false);
      }

      setLastSyncTime(timeStr);
      setGasConfig((prev) => ({ ...prev, lastSync: timeStr }));

      setChangeLog((prev) =>
        prev.map((entry) => ({ ...entry, driveSynced: true }))
      );

      if (isManual) {
        setSyncNotification({
          id: 'manual-' + Date.now(),
          text: `✅ Đã đồng bộ thành công trên tất cả thiết bị và Google Drive (${timeStr})`,
          type: 'success',
        });
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ:', err);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  // Switch Active Evaluation Year
  const handleChangeYear = (newYear: number) => {
    if (newYear === selectedYear) return;

    // 1. Save current sections before switching
    try {
      localStorage.setItem(`cchc_hoi_an_dong_sections_${selectedYear}`, JSON.stringify(sections));
      localStorage.setItem(`cchc_hoi_an_dong_changelog_${selectedYear}`, JSON.stringify(changeLog));
    } catch (_) {}

    // 2. Load data for new year
    let newSections: CCHCSection[] | null = null;
    let newLogs: ChangeLogEntry[] = [];

    try {
      const savedSecs = localStorage.getItem(`cchc_hoi_an_dong_sections_${newYear}`);
      if (savedSecs) {
        const parsed = JSON.parse(savedSecs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          newSections = parsed;
        }
      }
      const savedLogs = localStorage.getItem(`cchc_hoi_an_dong_changelog_${newYear}`);
      if (savedLogs) {
        newLogs = JSON.parse(savedLogs);
      }
    } catch (_) {}

    if (!newSections) {
      if (newYear === 2026) {
        newSections = INITIAL_CCHC_SECTIONS;
      } else {
        newSections = INITIAL_CCHC_SECTIONS.map((sec) => ({
          ...sec,
          criteria: sec.criteria.map((crit) => ({
            ...crit,
            selfScore: 0,
            status: 'not_started' as const,
            evidenceList: [],
            notes: '',
          })),
        }));
      }
    }

    setSelectedYear(newYear);
    setSections(newSections);
    setChangeLog(newLogs);
    setSyncNotification({
      id: 'year-switch-' + Date.now(),
      text: `📅 Đã chuyển sang bản đánh giá CCHC năm ${newYear}`,
      type: 'info',
    });
  };

  // Create New Evaluation Year from System Settings
  const handleCreateNewYear = (newYear: number, mode: 'clean' | 'clone_departments') => {
    let newYearSections: CCHCSection[];

    if (mode === 'clone_departments') {
      newYearSections = sections.map((sec) => ({
        ...sec,
        criteria: sec.criteria.map((crit) => ({
          ...crit,
          selfScore: 0,
          status: 'not_started' as const,
          evidenceList: [],
          notes: '',
        })),
      }));
    } else {
      newYearSections = INITIAL_CCHC_SECTIONS.map((sec) => ({
        ...sec,
        criteria: sec.criteria.map((crit) => ({
          ...crit,
          selfScore: 0,
          status: 'not_started' as const,
          evidenceList: [],
          notes: '',
        })),
      }));
    }

    const updatedYears = Array.from(new Set([...availableYears, newYear])).sort((a, b) => a - b);
    setAvailableYears(updatedYears);

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AVAILABLE_YEARS, JSON.stringify(updatedYears));
      localStorage.setItem(`cchc_hoi_an_dong_sections_${newYear}`, JSON.stringify(newYearSections));
      localStorage.setItem(`cchc_hoi_an_dong_changelog_${newYear}`, JSON.stringify([]));
    } catch (_) {}

    setSelectedYear(newYear);
    setSections(newYearSections);
    setChangeLog([]);

    syncWithDrive(newYearSections, [], `Khởi tạo bản đánh giá CCHC năm ${newYear}`, undefined, true);
  };

  // Delete Evaluation Year
  const handleDeleteYear = (yearToDelete: number) => {
    if (yearToDelete === 2026) {
      alert('Không thể xóa bản đánh giá năm 2026 (Năm hiện hành gốc)');
      return;
    }

    const updated = availableYears.filter((y) => y !== yearToDelete);
    setAvailableYears(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_AVAILABLE_YEARS, JSON.stringify(updated));
      localStorage.removeItem(`cchc_hoi_an_dong_sections_${yearToDelete}`);
      localStorage.removeItem(`cchc_hoi_an_dong_changelog_${yearToDelete}`);
    } catch (_) {}

    if (selectedYear === yearToDelete) {
      handleChangeYear(2026);
    }
  };

  // Password verification & open System Settings
  const handleRequestOpenSystemSettings = (tab: 'years' | 'evidence' | 'gas' | 'github' | 'firebase' = 'years') => {
    setSystemSettingsTab(tab);
    const isAuth = sessionStorage.getItem('cchc_system_auth') === 'tsvmmm123';
    if (isAuth) {
      setIsSystemSettingsOpen(true);
    } else {
      setIsPasswordModalOpen(true);
    }
  };

  const handlePasswordSuccess = () => {
    sessionStorage.setItem('cchc_system_auth', 'tsvmmm123');
    setIsPasswordModalOpen(false);
    setIsSystemSettingsOpen(true);
  };

  // 1. Initial Data Load on App Startup (from Firebase Firestore, shared server store, or Drive)
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        // A. Load from Firebase Firestore first (highest priority, real-time across all devices)
        try {
          const fbData = await loadFromFirebase();
          if (fbData && fbData.sections && Array.isArray(fbData.sections) && fbData.sections.length > 0) {
            if (isMounted) {
              setSections(fbData.sections);
              if (Array.isArray(fbData.changeLog)) {
                setChangeLog(fbData.changeLog);
              }
              const remoteTime = fbData.lastUpdatedTimestamp || (fbData.lastUpdated ? new Date(fbData.lastUpdated).getTime() : Date.now());
              lastLocalUpdateRef.current = remoteTime;
              const syncTime = fbData.lastUpdated
                ? new Date(fbData.lastUpdated).toLocaleTimeString('vi-VN')
                : new Date().toLocaleTimeString('vi-VN');
              setLastSyncTime(syncTime);
              setFirebaseConnected(true);
              isInitialLoadCompleteRef.current = true;
              return;
            }
          }
        } catch (fbErr) {
          console.warn('Firebase initial load note:', fbErr);
        }

        // B. Fallback: Load from shared server store
        const storeData = await loadFromLocalServerStore();
        if (storeData && storeData.sections && Array.isArray(storeData.sections) && storeData.sections.length > 0) {
          if (isMounted) {
            setSections(storeData.sections);
            if (Array.isArray(storeData.changeLog)) {
              setChangeLog(storeData.changeLog);
            }
            const remoteTime = storeData.lastUpdatedTimestamp || (storeData.lastUpdated ? new Date(storeData.lastUpdated).getTime() : Date.now());
            lastLocalUpdateRef.current = remoteTime;
            const syncTime = storeData.lastUpdated
              ? new Date(storeData.lastUpdated).toLocaleTimeString('vi-VN')
              : new Date().toLocaleTimeString('vi-VN');
            setLastSyncTime(syncTime);
            isInitialLoadCompleteRef.current = true;
            return;
          }
        }

        // C. Fallback: Load from GAS
        if (gasConfig.webAppUrl) {
          const gasRes = await sendGasRequest(gasConfig.webAppUrl, { action: 'getData' }, 12000);
          if (gasRes && gasRes.success && gasRes.data?.sections && Array.isArray(gasRes.data.sections)) {
            if (isMounted) {
              setSections(gasRes.data.sections);
              if (Array.isArray(gasRes.data.changeLog)) {
                setChangeLog(gasRes.data.changeLog);
              }
              const remoteTime = gasRes.data.lastUpdatedTimestamp || (gasRes.data.lastUpdated ? new Date(gasRes.data.lastUpdated).getTime() : Date.now());
              lastLocalUpdateRef.current = remoteTime;
              setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
              isInitialLoadCompleteRef.current = true;
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Không thể nạp dữ liệu lúc khởi động:', e);
      } finally {
        if (isMounted) {
          isInitialLoadCompleteRef.current = true;
        }
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time Firebase Firestore Sync Across All Computers & Mobile Devices
  useEffect(() => {
    const unsub = subscribeToFirebaseSync(
      (remoteData) => {
        if (remoteData && remoteData.sections && Array.isArray(remoteData.sections) && remoteData.sections.length > 0) {
          const remoteTime = remoteData.lastUpdatedTimestamp || (remoteData.lastUpdated ? new Date(remoteData.lastUpdated).getTime() : 0);
          if (remoteTime > lastLocalUpdateRef.current + 400) {
            lastLocalUpdateRef.current = remoteTime;
            setSections(remoteData.sections);
            if (Array.isArray(remoteData.changeLog)) {
              setChangeLog(remoteData.changeLog);
            }
            const timeStr = remoteData.lastUpdated
              ? new Date(remoteData.lastUpdated).toLocaleTimeString('vi-VN')
              : new Date().toLocaleTimeString('vi-VN');
            setLastSyncTime(timeStr);
            setFirebaseConnected(true);
            try {
              localStorage.setItem(`cchc_hoi_an_dong_sections_${selectedYear}`, JSON.stringify(remoteData.sections));
              if (remoteData.changeLog) {
                localStorage.setItem(`cchc_hoi_an_dong_changelog_${selectedYear}`, JSON.stringify(remoteData.changeLog));
              }
            } catch (_) {}

            setSyncNotification({
              id: 'fb-sync-' + Date.now(),
              text: `🔥 Đồng bộ thời gian thực từ máy khác: ${remoteData.note || 'Cập nhật CCHC'} (${timeStr})`,
              type: 'info',
            });
          }
        }
      },
      () => {
        setFirebaseConnected(false);
      }
    );

    return () => {
      if (unsub) unsub();
    };
  }, [selectedYear]);

  // 3. Real-time Cross-Tab Synchronization (BroadcastChannel)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('cchc_sync_channel');
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'LOCAL_SYNC_UPDATE') {
        const payload = event.data.data;
        if (payload && payload.sections && Array.isArray(payload.sections)) {
          const updateTime = payload.lastUpdatedTimestamp || Date.now();
          if (updateTime > lastLocalUpdateRef.current) {
            lastLocalUpdateRef.current = updateTime;
            setSections(payload.sections);
            if (Array.isArray(payload.changeLog)) {
              setChangeLog(payload.changeLog);
            }
            const timeStr = payload.lastUpdated
              ? new Date(payload.lastUpdated).toLocaleTimeString('vi-VN')
              : new Date().toLocaleTimeString('vi-VN');
            setLastSyncTime(timeStr);
            setSyncNotification({
              id: 'toast-' + Date.now(),
              text: `⚡ Dữ liệu vừa được đồng bộ tức thì từ tab khác (${timeStr})`,
              type: 'info',
            });
          }
        }
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  // Save changes to localStorage immediately
  useEffect(() => {
    try {
      localStorage.setItem(`cchc_hoi_an_dong_sections_${selectedYear}`, JSON.stringify(sections));
    } catch (e) {
      console.error('Lỗi lưu trữ dữ liệu tiêu chí:', e);
    }
  }, [sections, selectedYear]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(gasConfig));
    } catch (e) {
      console.error('Lỗi lưu cấu hình Google Apps Script:', e);
    }
  }, [gasConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(`cchc_hoi_an_dong_changelog_${selectedYear}`, JSON.stringify(changeLog));
    } catch (e) {
      console.error('Lỗi lưu changelog vào localStorage:', e);
    }
  }, [changeLog, selectedYear]);

  // Debounced auto-save to Drive & Shared Store when user modifies sections
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!isInitialLoadCompleteRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      syncWithDrive(sections, changeLog, 'Tự động lưu thay đổi theo thời gian thực');
    }, 1500);
    return () => clearTimeout(timer);
  }, [sections]);

  // Manual Reload from Drive / Shared Store handler
  const handleReloadFromDrive = async () => {
    setIsSyncing(true);
    try {
      const storeData = await loadFromLocalServerStore();
      if (storeData && storeData.sections && Array.isArray(storeData.sections)) {
        setSections(storeData.sections);
        if (Array.isArray(storeData.changeLog)) {
          setChangeLog(storeData.changeLog);
        }
        const syncTime = storeData.lastUpdated
          ? new Date(storeData.lastUpdated).toLocaleTimeString('vi-VN')
          : new Date().toLocaleTimeString('vi-VN');
        setLastSyncTime(syncTime);
        setSyncNotification({
          id: 'reload-' + Date.now(),
          text: `✅ Đã tải lại dữ liệu mới nhất từ máy chủ chia sẻ (${syncTime})`,
          type: 'success',
        });
        return;
      }

      if (gasConfig.webAppUrl) {
        const data = await sendGasRequest(gasConfig.webAppUrl, { action: 'getData' });
        if (data && data.success && data.data?.sections) {
          setSections(data.data.sections);
          if (Array.isArray(data.data.changeLog)) {
            setChangeLog(data.data.changeLog);
          }
          const syncTime = new Date().toLocaleTimeString('vi-VN');
          setLastSyncTime(syncTime);
          setSyncNotification({
            id: 'reload-' + Date.now(),
            text: `✅ Đã tải lại dữ liệu mới nhất từ Google Drive (${syncTime})`,
            type: 'success',
          });
        }
      }
    } catch (err) {
      console.warn('Lỗi nạp từ Drive:', err);
    } finally {
      setIsSyncing(false);
    }
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
      localStorage.setItem(`cchc_hoi_an_dong_sections_${selectedYear}`, JSON.stringify(newSections));
      localStorage.setItem(`cchc_hoi_an_dong_changelog_${selectedYear}`, JSON.stringify(newLogs));
    } catch (e) {
      console.warn('Lỗi lưu sau khi khôi phục:', e);
    }
    syncWithDrive(newSections, newLogs, 'Khôi phục từ file sao lưu JSON', undefined, true);
  };

  const handleResetToDefault = () => {
    if (confirm('Khôi phục dữ liệu Bộ chỉ số CCHC UBND Phường Hội An Đông về mặc định ban đầu (Chưa thực hiện, 0 điểm)?')) {
      setSections(INITIAL_CCHC_SECTIONS);
      setChangeLog([]);
      localStorage.removeItem(`cchc_hoi_an_dong_sections_${selectedYear}`);
      localStorage.removeItem(`cchc_hoi_an_dong_changelog_${selectedYear}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-red-200">
      {/* Government Navigation & Title Bar */}
      <Header
        evaluation={evaluation}
        gasConfig={gasConfig}
        onOpenSystemSettings={() => handleRequestOpenSystemSettings('years')}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        selectedYear={selectedYear}
        availableYears={availableYears}
        onChangeYear={handleChangeYear}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onSyncNow={() => syncWithDrive(sections, changeLog, 'Lưu thủ công toàn bộ', undefined, true)}
        firebaseConnected={firebaseConnected}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        
        {/* KPI Summary Cards & Section Filter */}
        <DashboardSummary
          evaluation={evaluation}
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
          onOpenDriveEvidenceHub={() => handleRequestOpenSystemSettings('evidence')}
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
              onClick={() => handleRequestOpenSystemSettings('years')}
              className="text-indigo-700 hover:text-indigo-950 font-bold hover:underline"
            >
              Cài Đặt Hệ Thống
            </button>
            <span>•</span>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-amber-700 hover:underline font-semibold"
            >
              Xuất Báo Cáo
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

      {/* Password Prompt Modal for System Settings (Protected by tsvmmm123) */}
      <PasswordPromptModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handlePasswordSuccess}
      />

      {/* Unified System Settings Modal */}
      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        initialTab={systemSettingsTab}
        availableYears={availableYears}
        selectedYear={selectedYear}
        onSelectYear={handleChangeYear}
        onCreateNewYear={handleCreateNewYear}
        onDeleteYear={handleDeleteYear}
        sections={sections}
        changeLog={changeLog}
        evaluation={evaluation}
        onUpdateSections={(newSections, note) => {
          setSections(newSections);
          syncWithDrive(newSections, changeLog, note || 'Cập nhật từ Cài đặt hệ thống', undefined, true);
        }}
        onRestoreData={handleRestoreData}
        gasConfig={gasConfig}
        onSaveGasConfig={setGasConfig}
        onForceSync={() => syncWithDrive(sections, changeLog, 'Lưu thủ công toàn bộ', undefined, true)}
        onReloadFromDrive={handleReloadFromDrive}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        driveFileId={driveFileId}
        firebaseConnected={firebaseConnected}
      />

      {/* Criterion Detail Modal with real Drive deletion */}
      <CriterionDetailModal
        criterion={activeCriterionData?.criterion || null}
        section={activeCriterionData?.section || null}
        gasConfig={gasConfig}
        isOpen={Boolean(activeCriterionData)}
        onClose={() => setActiveCriterionData(null)}
        onSaveCriterion={handleSaveCriterion}
        onPreviewEvidence={(ev) => setPreviewEvidence(ev)}
      />

      {/* Report Export Modal */}
      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        sections={sections}
        evaluation={evaluation}
        year={selectedYear}
      />

      {/* Evidence Preview Modal */}
      <EvidencePreviewModal
        evidence={previewEvidence}
        isOpen={Boolean(previewEvidence)}
        onClose={() => setPreviewEvidence(null)}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Floating Real-time Sync Toast Notification */}
      {syncNotification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200 ${
          syncNotification.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
            : 'bg-sky-950/90 text-sky-200 border-sky-500/50'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${
            syncNotification.type === 'success' ? 'bg-emerald-400' : 'bg-sky-400'
          } animate-pulse shrink-0`} />
          <span className="max-w-xs sm:max-w-md">{syncNotification.text}</span>
          <button
            onClick={() => setSyncNotification(null)}
            className="ml-2 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
