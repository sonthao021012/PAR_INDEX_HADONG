# Hệ thống Quản lý Bộ chỉ số Cải cách Hành chính (PAR INDEX)
### Ủy ban Nhân dân Phường Hội An Đông - TP. Đà Nẵng (Năm 2026)

Ứng dụng web Single Page Application (SPA) chuyên dụng để theo dõi, tự đánh giá chấm điểm và quản lý tài liệu minh chứng gắn với Google Drive theo Bộ tiêu chí Phụ lục II Cải cách hành chính cấp xã, phường (Quyết định số 2072/QĐ-UBND TP. Đà Nẵng).

---

## 🚀 Hướng Dẫn Chạy Trực Tiếp Trên GitHub Pages (Không Cần Cài Đặt Gì)

Ứng dụng được thiết kế hoàn toàn tĩnh (Static SPA) với đường dẫn tương đối (`base: './'`), kết nối trực tiếp với Google Apps Script và Google Drive qua trình duyệt, lưu trữ trạng thái người dùng bằng `localStorage` và tự động đồng bộ thời gian thực.

### 🌟 Cách Tốt Nhất & Nhanh Nhất: Chạy từ thư mục `/docs` (Khuyên dùng)
> **Lưu ý quan trọng**: Khi xuất bản trực tiếp từ AI Studio sang GitHub, nếu trong repo có thư mục `.github/workflows/` thì GitHub sẽ báo lỗi *"Quyền không đủ để đẩy các tệp quy trình làm việc (workflow permissions)"*. Vì vậy, cách chuẩn nhất là triển khai qua thư mục **`/docs`** đã được build sẵn 100%:

1. Xuất bản hoặc đẩy toàn bộ mã nguồn lên GitHub.
2. Trên giao diện GitHub của repository, vào **Settings** → **Pages** (cột menu bên trái).
3. Tại mục **Build and deployment** / **Source**: Chọn **Deploy from a branch**.
4. Tại ô **Branch**: Chọn nhánh **`main`** (hoặc `master`).
5. Tại ô thư mục kế bên: Chọn **`/docs`**.
6. Bấm **Save**.
7. Sau 30 giây, GitHub Pages sẽ kích hoạt đường link website: `https://<ten-tai-khoan>.github.io/<ten-repo>/`. Website hoạt động ngay tức thì 100%!

---

### ⚙️ Cách 2: Tự Động Hóa Với GitHub Actions (Tùy chọn)
Nếu bạn vẫn muốn dùng tính năng tự động build của GitHub Actions:
1. Đẩy mã nguồn lên GitHub bình thường.
2. Trên giao diện web của repository trên GitHub, bấm nút **Add file** → **Create new file**.
3. Nhập đường dẫn tên file: `.github/workflows/deploy.yml`.
4. Dán nội dung sau vào file và bấm **Commit changes**:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main, master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: 'pages'
  cancel-in-progress: false
jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci || npm install
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v4
```
5. Vào **Settings** → **Pages** → Source: chọn **GitHub Actions**.

---

## ⚙️ Cấu Hình Mặc Định Sẵn Có

- **Link Google Apps Script Web App**:
  `https://script.google.com/macros/s/AKfycbxDxwdm-7tirCSzOcyftN0Dvf8H2SkiCdsro9d-OM-i3a7146IBVi-vjHjrJ5P5eNU0qQ/exec`
- **Mật khẩu truy cập cấu hình Apps Script & Drive**:
  `tsvmmm123`
- **Thư mục lưu trữ gốc trên Google Drive**:
  `CCHC_2026_UBND_Phuong_Hoi_An_Dong` (ID: `1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq`)
- **Tài liệu minh chứng thực tế ban đầu trong thư mục gốc**:
  `QD VA PLII CAP XA PHUONG.pdf` (gắn kèm tại tiêu chí I.1.a)
- **Tự động lưu nhật ký thời gian thực**:
  Mỗi khi người dùng cập nhật điểm tự chấm, trạng thái hoặc ghi chú, thay đổi được ghi nhận tức thì vào `localStorage` và đồng bộ vào file nhật ký `Nhat_Ky_Cap_Nhat_CCHC_2026.json` trên Google Drive.

---

## 🛠️ Phát triển cục bộ (Tùy chọn)

Nếu bạn muốn chạy thử nghiệm và sửa đổi trên máy tính cá nhân:
```bash
# Cài đặt thư viện
npm install

# Chạy môi trường phát triển (Dev server)
npm run dev

# Biên dịch ra thư mục dist và docs
npm run build:docs
```
