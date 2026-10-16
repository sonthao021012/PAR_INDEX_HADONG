import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { CCHCSection, ChangeLogEntry, OverallEvaluation } from '../types/cchc.ts';

// Cấu hình Firebase của UBND Phường Hội An Đông do người dùng cung cấp
export const firebaseConfig = {
  apiKey: "AIzaSyB0v99cSqsAFCeEzso3UbIC_cQBqPuodNQ",
  authDomain: "bau-cu-hoi-an-dong.firebaseapp.com",
  projectId: "bau-cu-hoi-an-dong",
  storageBucket: "bau-cu-hoi-an-dong.firebasestorage.app",
  messagingSenderId: "736515363687",
  appId: "1:736515363687:web:aa1dc997087d0a4e3315c2",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isInitialized = false;

export function initFirebase(): { app: FirebaseApp; db: Firestore } | null {
  try {
    if (!isInitialized) {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(app);
      isInitialized = true;
    }
    return { app: app!, db: db! };
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase:', error);
    return null;
  }
}

export interface FirebaseSyncPayload {
  sections: CCHCSection[];
  changeLog?: ChangeLogEntry[];
  evaluation?: OverallEvaluation;
  lastUpdated?: string;
  lastUpdatedTimestamp?: number;
  updatedBy?: string;
  criterionCode?: string;
  note?: string;
}

const FIRESTORE_COLLECTION = 'cchc_sync';
const FIRESTORE_DOC_ID = 'phuong_hoi_an_dong';

/**
 * Lưu toàn bộ dữ liệu CCHC (điểm, tiến độ, danh sách minh chứng Drive) lên Firebase Firestore theo thời gian thực
 */
export async function saveToFirebase(payload: FirebaseSyncPayload): Promise<boolean> {
  try {
    const fb = initFirebase();
    if (!fb || !fb.db) return false;

    const docRef = doc(fb.db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    const dataToSave = {
      sections: payload.sections,
      changeLog: payload.changeLog ? payload.changeLog.slice(0, 50) : [],
      evaluation: payload.evaluation || null,
      lastUpdated: payload.lastUpdated || new Date().toISOString(),
      lastUpdatedTimestamp: payload.lastUpdatedTimestamp || Date.now(),
      updatedBy: payload.updatedBy || 'UBND Phường Hội An Đông',
      criterionCode: payload.criterionCode || 'TOÀN BỘ',
      note: payload.note || 'Đồng bộ thời gian thực qua Firebase',
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return true;
  } catch (error) {
    console.error('Lỗi lưu dữ liệu lên Firebase Firestore:', error);
    return false;
  }
}

/**
 * Đọc dữ liệu ban đầu từ Firebase Firestore khi khởi động ứng dụng
 */
export async function loadFromFirebase(): Promise<FirebaseSyncPayload | null> {
  try {
    const fb = initFirebase();
    if (!fb || !fb.db) return null;

    const docRef = doc(fb.db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as FirebaseSyncPayload;
      return data;
    }
    return null;
  } catch (error) {
    console.error('Lỗi đọc dữ liệu từ Firebase Firestore:', error);
    return null;
  }
}

/**
 * Lắng nghe thay đổi dữ liệu theo THỜI GIAN THỰC từ Firebase Firestore giữa các máy tính khác nhau
 * Bất kỳ máy nào thay đổi điểm, đính kèm minh chứng Drive hay cập nhật tiến độ, các máy khác nhận được ngay lập tức (<500ms)
 */
export function subscribeToFirebaseSync(
  onData: (data: FirebaseSyncPayload) => void,
  onError?: (error: Error) => void
): Unsubscribe | null {
  try {
    const fb = initFirebase();
    if (!fb || !fb.db) return null;

    const docRef = doc(fb.db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as FirebaseSyncPayload;
          onData(data);
        }
      },
      (error) => {
        console.warn('Lỗi kết nối thời gian thực Firebase Firestore:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Không thể thiết lập lắng nghe Firebase:', error);
    if (onError && error instanceof Error) onError(error);
    return null;
  }
}
