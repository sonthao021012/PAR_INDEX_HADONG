# Kế hoạch tối ưu hóa: Chỉ cập nhật khi người dùng hoàn thành và đồng bộ đa thiết bị tức thì

## 1. Mục tiêu
- **Chấm dứt việc tự động đồng bộ liên tục (auto-sync / auto-refresh debounce 1.5s)**: Loại bỏ các lệnh gọi Google Apps Script, Google Drive và Firebase Firestore tự động sau mỗi thao tác nhỏ gây giật trang, lặp lại và tiêu hao token/hạn mức mạng.
- **Lưu có kiểm soát theo yêu cầu người dùng**: Dữ liệu chỉ được đóng gói, lưu trữ và phát đi khi người dùng nhấn nút **"Lưu thay đổi"** trong cửa sổ chỉnh sửa tiêu chí (`CriterionDetailModal`), hoặc khi người dùng chủ động bấm **"Đồng bộ ngay"** trên thanh tiêu đề.
- **Đồng bộ thời gian thực sang các máy khác**: Khi một máy nhấn "Lưu", bản ghi mới sẽ được gửi ngay lập tức lên Firebase Firestore và máy chủ chia sẻ; các máy/trang ứng dụng khác đang mở sẽ tự động cập nhật ngay lập tức mà không làm phiền người dùng đang nhập liệu.

---

## 2. Các thay đổi kỹ thuật chi tiết

### A. Loại bỏ Auto-Sync Debounce trong `src/App.tsx`
- **Xóa bỏ hook `useEffect` debounce 1500ms**: Hiện tại hook này tự động kích hoạt `syncWithDrive` mỗi khi `sections` thay đổi, tạo ra các chu kỳ gửi file JSON lên Drive và ghi Firestore liên tục.
- **Chuyển `syncWithDrive` thành hành động có chủ đích**:
  - Được kích hoạt trực tiếp từ `handleSaveCriterion` sau khi người dùng bấm nút Lưu trong `CriterionDetailModal`.
  - Được kích hoạt khi bấm nút "Đồng bộ ngay" (`onSyncNow`) ở Header.
  - Được kích hoạt khi tạo hoặc xóa năm đánh giá trong Cài đặt hệ thống.

### B. Nâng cấp trải nghiệm lưu trong `CriterionDetailModal.tsx`
- Giữ toàn bộ thay đổi (điểm tự chấm, trạng thái, cơ quan chủ trì, ghi chú, đính kèm/xóa minh chứng) trong state nội bộ của Modal.
- Cải tiến nút **"Lưu & Đồng bộ dữ liệu"**:
  - Thiết kế nổi bật, có biểu tượng trực quan và nhãn thể hiện rõ: *Lưu tiêu chí & đồng bộ tức thì sang các máy khác*.
  - Hiển thị chỉ báo trạng thái đang lưu/đồng bộ để người dùng an tâm khi hoàn thành.
  - Sau khi lưu thành công, Modal đóng lại và cập nhật bảng tổng hợp.

### C. Cơ chế đồng bộ đa thiết bị mượt mà (Firebase Firestore & BroadcastChannel)
- Gắn mã nhận diện phiên làm việc (`senderSessionId`) vào mỗi gói tin cập nhật để:
  - Máy thực hiện thao tác lưu: Không bị render lại đột ngột hay nhấp nháy giao diện.
  - Các máy khác cùng mở ứng dụng: Lắng nghe qua Firebase `onSnapshot` / `BroadcastChannel`, nhận dữ liệu mới nhất và cập nhật giao diện mượt mà.
  - Hiển thị thông báo Toast trang nhã: *"Đã nhận dữ liệu mới từ máy khác [Thời gian]"* mà không làm gián đoạn vị trí cuộn trang.

### D. Tối ưu hóa bảng tiêu chí `CriteriaTable.tsx`
- Thao tác chấm điểm nhanh trên bảng tiêu chí sẽ hiển thị thông báo hoặc mở cửa sổ chi tiết để người dùng kiểm tra và lưu tập trung, tránh việc click đổi điểm làm kích hoạt reload ngầm.

---

## 3. Các bước kiểm thử và xác minh
1. **Kiểm tra lưu tiêu chí**:
   - Mở modal tiêu chí bất kỳ (ví dụ I.1.a), thay đổi điểm, thêm ghi chú, đính kèm minh chứng.
   - Xác nhận: Trong quá trình thao tác, hệ thống không gọi API Drive/Firebase hay tự động refresh.
   - Nhấn nút "Lưu thay đổi": Kiểm tra dữ liệu được ghi nhận, lưu vào localStorage, cập nhật Firestore và Drive.
2. **Kiểm tra đồng bộ đa máy / đa tab**:
   - Mở 2 tab trình duyệt cùng lúc.
   - Ở tab 1, chỉnh sửa và bấm nút "Lưu".
   - Xác nhận: Tab 2 nhận được cập nhật tức thì với thông báo rõ ràng, không bị reload trang toàn phần.
3. **Kiểm tra hiệu năng & token**:
   - Đảm bảo không còn vòng lặp tải lại ngầm (idle state hoàn toàn yên tĩnh).
