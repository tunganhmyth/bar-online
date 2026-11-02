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
- Chưa kết nối LIVE: 8 nhân vật trong chế độ **Xem thử**, có nhãn phân biệt.
- Khi kết nối LIVE: chuyển sang người xem thật; mỗi người vào phòng có nhân vật riêng.
- Bình luận: hiển thị nội dung trên nhân vật; tên và bình luận dùng văn bản thuần.
- Bình luận `đổi đồ`, `doi do`, `đổi nhân vật`: đổi phối màu nhân vật.
  Các lệnh `đổi chó` / `đổi cún` cũ vẫn được nhận.
- Tim, follow, chia sẻ: nhân vật nhảy và hiện tương tác.
- Quà: camera tiến đến đúng người tặng, giữ góc cận cảnh rồi quay về toàn sàn
  sau khoảng 6,4 giây. Có vòng sáng dưới chân và bảng tên/quà. Combo được gộp;
  hàng chờ tối đa 8 người, người đang được camera quay không bị đẩy khỏi sàn.
- **Thử camera quà** phát hiệu ứng thử, được ghi rõ nhãn trên màn hình.
- Có thể kéo/zoom sân khấu, bật camera xoay chậm, bật/tắt đèn, đổi trang phục
  và chuyển tỷ lệ 9:16 / 16:9 bằng bảng điều khiển.
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
