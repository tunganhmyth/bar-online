# MythMaker — TikTok LIVE

## Yêu cầu

- JDK 8; biến môi trường `JAVA_HOME` trỏ đến thư mục JDK.
- Node.js 20 trở lên và npm (máy này đã có Node.js 24).
- Internet để Maven Wrapper tải Maven 3.8.3 và dependencies trong lần đầu.
- Không cần Maven cài riêng hay database.

## Khởi động

Mở PowerShell trong thư mục project:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-local.ps1
```

Script tự chạy `npm ci` ở lần đầu nếu chưa có thư viện TikTok.
Script cũng chạy `npm run build` để đóng gói phần sân khấu Three.js từ
`frontend/club-scene.js` thành `static/js/club-scene.js` trước khi khởi động.
Khi server sẵn sàng, script mở cửa sổ Edge/Chrome riêng cho project với quyền
tự phát nhạc có tiếng. Trong cửa sổ đó, nhập `@username` hoặc link live rồi nhấn
**Kết nối**. Tài khoản phải đang phát LIVE. Nhấn **Ngắt kết nối** để dừng.
Nhấn `Ctrl+C` trong terminal để dừng server.

Nếu server đã chạy, mở riêng cửa sổ tự phát nhạc bằng lệnh này (dùng được
trong cả Git Bash và PowerShell):

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./open-live.ps1
```

Mở tab thường bằng cách gõ `http://localhost:8080/` vẫn có thể bị trình duyệt
chặn phát nhạc có tiếng. Cửa sổ của `open-live.ps1` dùng profile riêng ở
`.run/live-browser` và cờ `--autoplay-policy=no-user-gesture-required`.
Muốn chỉ chạy server, thêm `-NoBrowser` vào lệnh `run-local.ps1`.

Có thể mở `/index/username` để điền sẵn tên kênh.
Thêm `?connect=1` để trang tự gửi yêu cầu kết nối lúc mở.
Ví dụ: `http://localhost:8080/index/ten_kenh?connect=1`.

Nếu cổng 8080 đang được sử dụng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-local.ps1 -Port 8081
```

Profile `local` tắt HTTPS và dùng cổng 8080. Cấu hình HTTPS gốc được giữ
trong `application.yaml`; không cần mật khẩu keystore khi chạy local.

## Kiểm tra và đóng gói

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-local.ps1 -Task test
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-local.ps1 -Task package
```

Lệnh test/package chạy cả test Node.js và test Java. Chạy file JAR từ thư mục
project sau khi đóng gói (trong terminal mới đã nhận `JAVA_HOME`/`PATH`):

```powershell
java -jar .\target\XiuGou-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

Giữ thư mục `bridge/`, `package.json`, `package-lock.json` và dependencies
Node bên cạnh project khi chạy JAR. Spring Boot tự quản lý tiến trình connector;
không cần tự chạy thêm server Node hay mở cổng thứ hai.

Nếu server đang được chạy nền trong lần thiết lập này, xem PID ở
`.run/server.pid`, log ở `.run/server.log` và `.run/server-error.log`.
Dừng server nền trước khi chạy lại bằng lệnh:

```powershell
Stop-Process -Id (Get-Content .\.run\server.pid)
```

## Tương tác và OBS

- Sàn đen 3D với ô viền neon hồng/xanh, đèn quét chuyển động, loa và tường LED.
- Nhân vật người 3D có skeleton và animation nhảy; 8 phối màu tóc/trang phục.
  Model nền là HVGirl (Babylon.js Assets), được chỉnh tỷ lệ và vật liệu lúc chạy.
  Credits và giấy phép ở `static/models/ATTRIBUTION.md`.
- Mở sàn sẽ có đúng **1 nhân vật chủ sàn** ở giữa sàn. Nhập tên ở mục
  **Tên chủ sàn** rồi nhấn **Áp dụng**; tên được lưu sau khi khởi động lại
  server và đồng bộ ngay sang tab OBS. Chủ sàn không bị dọn theo thời gian.
- Nhấn **Xem thử** để thêm 8 nhân vật mẫu, có nhãn phân biệt. Khi kết nối
  LIVE, chỉ giữ chủ sàn và bắt đầu nhận người xem mới qua bình luận/quà.
- Khi kết nối LIVE: sàn bắt đầu trống. Chỉ **bình luận hoặc tặng quà** mới tạo
  nhân vật; vào phòng, tim, follow hoặc chia sẻ không tự đưa người mới lên sàn.
- Bình luận: hiển thị nội dung trên nhân vật; tên và bình luận dùng văn bản thuần.
- Bình luận `đổi đồ`, `doi do`, `đổi nhân vật`: đổi phối màu nhân vật.
  Các lệnh `đổi chó` / `đổi cún` cũ vẫn được nhận.
- Tim, follow, chia sẻ: chỉ nhân vật đã có trên sàn mới nhảy và hiện tương tác.
- Sau **10 phút không tương tác**, nhân vật tự rời sàn; bình luận, quà hoặc
  tương tác của người đã trên sàn sẽ gia hạn thời gian. Cả nhãn tên, animation,
  bộ đếm và hàng chờ camera đều được dọn. Thời gian tính theo đồng hồ thực,
  kể cả khi tab/OBS không render. Tắt LIVE/ngắt kết nối sẽ dọn người xem,
  giữ lại nhân vật chủ sàn.
- TikTok không đảm bảo sự kiện rời phòng cho từng người. Vì vậy đây là dọn theo
  thời gian không tương tác, không phải xác nhận người đó đã thoát LIVE;
  người vẫn xem nhưng im lặng đủ 10 phút cũng sẽ được dọn.
  Tham khảo: https://ttlc.docs.isaackogan.com/guides/room-data/
- Quà: camera tiến đến đúng người tặng, giữ góc cận cảnh rồi trở về chế độ đã chọn
  sau khoảng 6,4 giây. Có vòng sáng dưới chân và bảng tên/quà. Combo được gộp;
  hàng chờ tối đa 8 người, người đang được camera quay không bị đẩy khỏi sàn.
- **Thử camera quà** phát hiệu ứng thử, được ghi rõ nhãn trên màn hình.
- Chọn 8 chế độ camera: **Toàn sàn, Chính diện, Chéo trái, Chéo phải,
  Từ trên cao, Xoay chậm, Cận cảnh nhân vật, Hỗn hợp tự động**. Hỗn hợp đổi
  giữa 6 góc mỗi 5 giây, chuyển cảnh mượt và không dùng góc từ trên đầu xuống.
  Cận cảnh lần lượt quay từng người. Camera tự động và kéo chuột đều giới hạn
  ở cung phía trước sân khấu để không đi ra sau tường.
  Camera quà luôn được ưu tiên; sau đó tiếp tục chế độ đã chọn. Nút
  **Góc máy toàn sàn** hủy hàng chờ quà và trở về góc ban đầu.
- Các góc cố định cho phép kéo/zoom; xoay chậm, cận cảnh và hỗn hợp tự điều
  khiển camera. Có thể bật/tắt đèn, đổi trang phục và chọn 9:16 / 16:9.
- Nút **Đèn laser** bật/tắt riêng 36 tia laser đa sắc quét hình quạt. Cài đặt
  được lưu và đồng bộ sang OBS, độc lập với nút đèn sân khấu.
- Tên chủ sàn và chế độ camera dùng chung trên server, lưu ở
  `data/stage-settings.json` (không đưa lên Git). API:
  `GET /api/stage/settings`, `PUT /api/stage/settings` với `hostName` hoặc
  `cameraMode` hoặc `laserEnabled` (boolean); thay đổi được đồng bộ qua SSE. Cần khởi động lại server sau
  khi cập nhật bản code có API mới này.
- Nhạc nền Vinahouse tự phát và lặp lại khi hết bài. Nếu trình duyệt chặn tự phát
  có âm thanh, nhấn **Bật nhạc** hoặc tương tác với trang một lần để bắt đầu;
  nút này xuất hiện cả trong chế độ OBS.
- Giới hạn 30 nhân vật 3D, tối đa 30 FPS và DPR 1,5 để giữ trang nhẹ.
  Thêm `?quality=low` để bỏ hậu kỳ bloom trên máy yếu.

Kết nối kênh trong trang điều khiển trước, sau đó thêm OBS Browser Source:
**http://localhost:8080/?obs=1**, kích thước **1080 × 1920** (dọc, theo ảnh mẫu).
Nếu cần khung ngang, dùng **http://localhost:8080/?obs=1&layout=wide**,
kích thước **1920 × 1080**.
Các tab dùng chung kênh TikTok của server; tab OBS tự nhận tương tác mới.

Sau khi cập nhật code, tải lại trang điều khiển và Browser Source trong OBS
để cùng áp dụng luật lên sàn mới.

Kiểm tra quy tắc lên sàn/dọn người (cần server local đang chạy và Microsoft Edge):

```powershell
npm.cmd run test:presence
```

Test sử dụng sự kiện và thời gian giả lập trong trình duyệt riêng, không thay
đổi kết nối TikTok đang chạy.

Kiểm tra camera, lưu tên và đồng bộ OBS: chạy một server thử ở cổng 8081 với
`--stage.settings-file=.run/preview-stage-settings.json`, rồi dùng
`npm.cmd run test:camera`. Test dùng API cài đặt thật trên server thử,
khôi phục cài đặt sau khi chạy và không kết nối TikTok.

## Phần kết nối được lấy từ đâu

`bridge/live-bridge.mjs` chuyển phần kết nối từ project
`tiktok-live-temple-rpc-main/server.js`: dùng cùng `TikTokLiveConnection`,
`WebcastEvent`, `ControlEvent`, cách lấy thông tin người xem và các sự kiện
chat/member/like/gift/follow/share. Dependency được chốt ở phiên bản `2.5.0`,
trùng phiên bản cài trong project nguồn.

Luồng dữ liệu: TikTok → connector Node.js → Spring Boot → SSE → sàn nhảy.
Lệnh kết nối/ngắt kết nối đi qua `POST /api/live/connect` và
`POST /api/live/disconnect`; trạng thái ở `GET /api/live/state`;
sự kiện ở `GET /api/live/events`.

Khác với code nguồn, không phát lại dữ liệu cũ lúc vừa kết nối, tránh tạo
nhân vật từ bình luận đã qua. Khi lỗi, trạng thái và thông báo hiển thị trên
trang; có thể nhấn Kết nối để thử lại. Đường dẫn chia sẻ chỉ được chuyển hướng
trong miền TikTok. Không còn gọi API Bilibili hoặc cần `decode.js`.

Connector phụ thuộc vào dịch vụ TikTok và dịch vụ ký kết nối của thư viện.
Nếu tài khoản offline, mạng lỗi hoặc dịch vụ ký giới hạn yêu cầu, trang sẽ báo
lỗi thực tế. Chỉ có thể xác nhận luồng LIVE thật khi thử với một kênh đang phát.

Tài liệu thư viện: https://github.com/zerodytrash/TikTok-Live-Connector
