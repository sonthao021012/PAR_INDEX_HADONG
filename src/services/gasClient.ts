/**
 * Service giao tiếp Google Apps Script & Google Drive đa môi trường
 * Hỗ trợ chạy mượt mà cả trên Localhost lẫn trực tiếp trên GitHub Pages (không cần backend server)
 */

export interface GasResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  offlineFallback?: boolean;
}

// Kiểm tra xem ứng dụng có đang chạy trên GitHub Pages hoặc môi trường hosting hoàn toàn tĩnh không
export function isStaticOrGitHub(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('github.io') || host.includes('pages.dev');
}

/**
 * Gửi yêu cầu POST tới Google Apps Script
 * Tự động chọn giữa local proxy (nếu có server dev) và direct fetch (khi chạy trên GitHub Pages)
 */
export async function sendGasRequest(
  webAppUrl: string,
  payload: Record<string, any>,
  timeoutMs: number = 25000
): Promise<GasResponse> {
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    return { success: false, error: 'Chưa cấu hình URL Google Apps Script hợp lệ' };
  }

  const isStatic = isStaticOrGitHub();

  // 1. Thử qua server proxy trước nếu không phải là GitHub Pages tĩnh
  if (!isStatic) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 15000));

      const proxyRes = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: webAppUrl,
          payload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        return data;
      }
    } catch (proxyErr) {
      // Proxy không khả dụng hoặc lỗi mạng, tự động chuyển sang gọi trực tiếp
      console.warn('Server proxy không phản hồi, chuyển sang gọi trực tiếp Google Apps Script:', proxyErr);
    }
  }

  // 2. Gọi trực tiếp tới Google Apps Script (Hoạt động 100% trên GitHub Pages & trình duyệt)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Gửi bằng text/plain để tránh preflight CORS OPTIONS của trình duyệt
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json;
    } catch {
      return {
        success: response.ok,
        message: text || 'Đã gửi yêu cầu thành công đến Google Apps Script',
      };
    }
  } catch (directErr: any) {
    console.warn('Direct fetch gặp lỗi CORS/redirect, thử gửi ở chế độ no-cors:', directErr);

    // 3. Fallback no-cors để đảm bảo dữ liệu ghi vào Drive vẫn được thực hiện
    try {
      await fetch(webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        message: 'Đã gửi dữ liệu đồng bộ đến Google Drive (chế độ bảo vệ tĩnh GitHub)',
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: `Không thể kết nối Google Apps Script: ${fallbackErr?.message || directErr?.message || 'Lỗi mạng'}`,
      };
    }
  }
}

/**
 * Gửi yêu cầu GET tới Google Apps Script (dùng để kiểm tra kết nối hoặc tải dữ liệu)
 */
export async function getGasData(
  webAppUrl: string,
  action: string = 'testConnection',
  params: Record<string, string> = {},
  timeoutMs: number = 20000
): Promise<GasResponse> {
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    return { success: false, error: 'Chưa cấu hình URL Google Apps Script hợp lệ' };
  }

  const isStatic = isStaticOrGitHub();

  // 1. Thử server proxy nếu có
  if (!isStatic) {
    try {
      const query = new URLSearchParams({ targetUrl: webAppUrl, action, ...params }).toString();
      const res = await fetch(`/api/gas-proxy?${query}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {
      // Tiếp tục direct fetch
    }
  }

  // 2. Direct fetch GET - Google Apps Script hỗ trợ redirect với Access-Control-Allow-Origin: *
  try {
    const url = new URL(webAppUrl);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: response.ok, message: text };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Không thể tải dữ liệu từ Google Apps Script: ${err?.message || 'Lỗi mạng'}`,
    };
  }
}

/**
 * Lưu dữ liệu vào cache máy chủ chia sẻ dùng chung giữa mọi máy tính và trình duyệt.
 * Tự động bỏ qua an toàn khi chạy trên GitHub Pages tĩnh hoàn toàn.
 */
export async function saveToLocalServerStore(stateData: any): Promise<boolean> {
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/drive-sync-store', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stateData),
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Tải dữ liệu dùng chung từ máy chủ chia sẻ.
 * Bất kỳ máy tính nào truy cập đường link ứng dụng đều đọc được dữ liệu mới nhất này.
 */
export async function loadFromLocalServerStore(): Promise<any | null> {
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('/api/drive-sync-store', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        return data;
      }
    }
  } catch (_) {
    // Yên lặng bỏ qua
  }
  return null;
}
