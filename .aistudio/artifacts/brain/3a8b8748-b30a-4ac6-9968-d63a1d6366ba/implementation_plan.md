# Kế hoạch triển khai: Tinh chỉnh nút Lưu, Tích hợp Backup/Restore Google Drive và Tinh gọn Cài Đặt Hệ Thống

## 1. Mục tiêu
1. **Đổi nút "Lưu & Đồng bộ Thiết Bị" thành nút "Lưu"**:
   - Chỉ lưu dữ liệu lên Firebase Firestore và phát đồng bộ thời gian thực sang các máy khác.
   - Không tạo tệp `.json` trong thư mục `LOG` trên Google Drive nữa để tránh lãng phí dung lượng và làm rác thư mục Drive.
   - Kiểm tra và đảm bảo toàn bộ thao tác tải file minh chứng lên Drive đã hoàn tất trước khi cho phép Lưu.
2. **Xây dựng tính năng Sao lưu (Backup) & Khôi phục (Restore) trong "CÀI ĐẶT HỆ THỐNG"**:
   - Nút **"Sao lưu lên Google Drive"**: Tự động tạo tệp `Backup_CCHC_[Năm]_[NgàyGiờ].json` vào thư mục `Backup` trên Google Drive thông qua Google Apps Script.
   - Nút **"Tải bản sao lưu về máy tính"**: Tải tệp JSON về máy dự phòng ngoại tuyến.
   - Tính năng **Khôi phục (Restore)**: Cho phép khôi phục từ danh sách tệp trong thư mục `Backup` trên Google Drive hoặc tải tệp `.json` từ máy tính lên.
3. **Tinh gọn "CÀI ĐẶT HỆ THỐNG"**:
   - Loại bỏ 2 tính năng không cần thiết: *"Dán & Nhận Diện Hàng loạt Link Drive"* và *"Quét thư mục Google drive"*.
   - Giữ lại giao diện quản lý minh chứng trực quan, gọn gàng và dễ sử dụng.

---

## 2. Chi tiết các tệp cần chỉnh sửa

### A. `src/components/CriterionDetailModal.tsx`
- Đổi tên nút thành **"Lưu"** với icon `Save`.
- Thêm bước kiểm tra an toàn:
  - Vô hiệu hóa nút và hiển thị cảnh báo nếu đang trong quá trình tải tệp minh chứng lên Google Drive (`isUploading`).
  - Nếu người dùng đã chọn tệp nhưng chưa bấm "Tải lên", hiển thị nhắc nhở xác nhận trước khi lưu.
- Gọi `onSaveCriterion` để cập nhật tiêu chí và phát đồng bộ Firebase.

### B. `src/App.tsx`
- Cập nhật hàm `syncWithDrive`:
  - Loại bỏ hoàn toàn khối code gọi `uploadFile` cho `Nhat_Ky_Cap_Nhat_CCHC_${year}.json` vào thư mục `LOG` trên Google Drive.
  - Tập trung lưu vào Firebase Firestore, BroadcastChannel và Server Store để đồng bộ tức thì sang các máy khác.
- Thêm handler xử lý Backup lên Google Drive:
  - Tạo tệp `Backup_CCHC_${selectedYear}_${timestamp}.json` gửi lên Google Drive trong thư mục `Backup`.
- Cập nhật handler Restore: Khôi phục dữ liệu từ tệp sao lưu, cập nhật state và đồng bộ sang Firebase.

### C. `src/components/SystemSettingsModal.tsx`
- Loại bỏ 2 sub-tab/chức năng:
  - Bỏ sub-tab `"batch"` (*Dán & Nhận Diện Hàng loạt Link Drive*).
  - Bỏ sub-tab `"scan"` (*Quét thư mục Google drive*).
- Thêm tab/khu vực **"Sao Lưu & Khôi Phục (Backup & Restore)"**:
  - Giao diện thực hiện Sao lưu lên Google Drive (thư mục `Backup`).
  - Giao diện Khôi phục dữ liệu (từ Drive hoặc tệp JSON từ máy tính).
  - Hiển thị lịch sử các bản sao lưu và thông báo trạng thái rõ ràng.

### D. Đồng bộ bản build cho GitHub Pages
- Chạy `npm run build` để cập nhật đồng bộ các thay đổi mới vào thư mục `/docs` cho GitHub Pages.

---

## 3. Các bước kiểm tra & xác minh
1. **Kiểm tra nút "Lưu" trong modal tiêu chí**:
   - Thử sửa điểm và lưu: Xác nhận nút hiển thị chữ **"Lưu"**, lưu thành công lên Firebase, các máy khác nhận được cập nhật, và không sinh file trong thư mục `LOG` trên Drive.
   - Thử chọn file tải lên: Xác nhận khi file chưa upload xong thì nút Lưu bị khóa an toàn.
2. **Kiểm tra tính năng Backup & Restore**:
   - Mở Cài Đặt Hệ Thống > Bấm "Sao lưu lên Google Drive": Xác nhận file sao lưu được tạo với tên theo ngày giờ vào thư mục `Backup`.
   - Thử nghiệm Restore từ file JSON hoặc từ bản sao lưu: Xác nhận dữ liệu được khôi phục chính xác.
3. **Kiểm tra Cài Đặt Hệ Thống**:
   - Xác nhận đã bỏ hoàn toàn "Dán hàng loạt link Drive" và "Quét thư mục Google drive".
