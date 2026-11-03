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
- Có 5 nhân vật anime 3D: **Sakura, Yuki, Akira, Luna, Hikari**. Mỗi nhân vật
  có tạo hình tóc/phụ kiện/trang phục, một bộ động tác và một kỹ năng riêng.
  Gồm **2 nam (Akira, Hikari)** và **3 nữ (Sakura, Yuki, Luna)**, dùng model
  nam/nữ riêng. Trang phục: nữ dân chơi, công chúa, nam dân chơi cyber,
  nữ quý tộc, nam hoàng tử — phân biệt bằng kiểu đồ, không chỉ đổi màu.
  Dùng model anime VRM nền của pixiv với chất liệu MToon. Mỗi người có bài nhảy
  **128 nhịp / 16 combo / khoảng 54,9 giây**, thiết kế ở 140 BPM, phối từ 8–9
  bản motion capture người thật (G1 Moves / Jasmine Coro, CC BY 4.0). Nữ dùng
  hip eight, shoulder roll và body wave; nam dùng wave, pop/lock và isolation.
  Có heel-toe, đổi gối và bước nhanh; cổ tay/ngón tay chuyển động riêng. Chân
  trụ được giữ bằng IK, các đoạn đứng chờ được loại và chuyển đoạn được làm mượt.
  Đây là 5 tạo hình từ hai model nền, không lấy từ
  game. Credits/giấy phép ở `static/models/ATTRIBUTION.md`, định nghĩa ở
  [CHARACTERS.vi.md](CHARACTERS.vi.md).
- Mở sàn sẽ có đúng **1 nhân vật chủ sàn** ở giữa sàn. Nhập tên ở mục
  **Tên chủ sàn** rồi nhấn **Áp dụng**; tên được lưu sau khi khởi động lại
  server và đồng bộ ngay sang tab OBS. Chủ sàn không bị dọn theo thời gian.
- Ô **Tên sàn / bảng hiệu → Áp dụng** đổi đồng thời chữ góc trên và bảng LED
  3D phía sau. Cho phép tên tiếng Việt từ 1–32 ký tự, tự thu nhỏ chữ khi cần.
  Tên được lưu bằng `stageName` trong cài đặt server và đồng bộ sang OBS.
  Sau lần cập nhật có thêm trường này, cần khởi động lại server một lần.
- Chọn tạo hình chủ sàn trong **Nhân vật chủ sàn**. Lựa chọn được lưu cùng tên
  và đồng bộ sang OBS. **Khám phá 5 nhân vật** liệt kê điệu nhảy/kỹ năng.
- Nhấn **Xem thử** để thêm 8 nhân vật mẫu, có nhãn phân biệt. Khi kết nối
  LIVE, chỉ giữ chủ sàn và bắt đầu nhận người xem mới qua bình luận/quà.
- Khi kết nối LIVE: sàn bắt đầu với chủ sàn. Chỉ **bình luận hoặc tặng quà** mới tạo
  nhân vật; vào phòng, tim, follow hoặc chia sẻ không tự đưa người mới lên sàn.
- Bình luận: hiển thị nội dung trên nhân vật; tên và bình luận dùng văn bản thuần.
- Bình luận `đổi đồ`, `doi do`, `đổi nhân vật`: chuyển sang nhân vật tiếp theo.
  Các lệnh `đổi chó` / `đổi cún` cũ vẫn được nhận.
- Bình luận `!sakura`, `!yuki`, `!akira`, `!luna`, `!hikari` hoặc
  `nhân vật <tên>` để chọn nhân vật cụ thể. Người mới được gán nhân vật ổn định
  theo TikTok ID trước khi tự chọn, không phụ thuộc thứ tự lên sàn.
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
- Khi camera quà đến nơi (khoảng 1,1 giây), chỉ người đang được quay sẽ dùng
  động tác kỹ năng và hiệu ứng riêng của nhân vật. Người trong hàng chờ tiếp
  tục nhảy thường. Hết lượt, kỹ năng được dọn và nhân vật nhảy lại bình thường.
  Hiệu ứng có nhịp bung, trình diễn và tan dần: cánh hoa/dải lụa, băng tuyết,
  mạch điện, trăng sao hoặc lông vũ ánh kim tùy nhân vật. Ánh sáng nằm sau/hai
  bên và camera lấy rộng vừa đủ để giữ rõ mặt, trang phục và bảng tên. Dải chữ
  bài hát giảm sáng trong lúc quay cận rồi sáng lại sau lượt.
  Cánh Hikari và cánh trên ba bệ Top dùng lông vũ trắng 3D xếp ba lớp (132 lông
  mỗi đôi), có đường gân, độ cong và nhịp khép/mở nhẹ. Camera cận mở khung vừa
  đủ để không cắt đầu cánh; hình dạng được dựng riêng theo mẫu cánh thiên thần.
  Kỹ năng là chuỗi 12 nhịp gồm accent → technical combo → pose, chạy một lần và
  giữ tư thế kết; không lặp lại đoạn 3,75 giây như bản trước. Khi trở về bài
  thường, pha nhịp được đưa về cùng đồng hồ sân khấu.
- **Thử camera quà** phát hiệu ứng thử, được ghi rõ nhãn trên màn hình.
- Chọn 8 chế độ camera: **Toàn sàn, Chính diện, Chéo trái, Chéo phải,
  Từ trên cao, Xoay chậm, Cận cảnh nhân vật, Hỗn hợp tự động**. Hỗn hợp đổi
  giữa 6 góc thường mỗi 5 giây, xen cận cảnh Top khi có người tặng quà; chuyển
  cảnh mượt và không dùng góc từ trên đầu xuống.
  Cận cảnh lần lượt quay từng người. Camera tự động và kéo chuột đều giới hạn
  ở cung phía trước sân khấu để không đi ra sau tường.
  Camera quà luôn được ưu tiên; sau đó tiếp tục chế độ đã chọn. Nút
  **Góc máy toàn sàn** hủy hàng chờ quà và trở về góc ban đầu.
- Trong **Hỗn hợp tự động**, nếu có người trong Top quà, sau mỗi 3 góc thường
  camera xen một lượt cận cảnh tại bàn DJ (vẫn 5 giây/góc). Các lượt này xoay
  lần lượt Top 1 → Top 2 → Top 3, chỉ chọn vị trí đang có nhân vật. Bảng tên
  người đang được quay được làm nổi bật; các bảng Top khác tạm ẩn để dễ nhìn.
  Quà mới vẫn ngắt lượt vinh danh để quay người vừa tặng. Sau khi xử lý quà,
  camera tiếp tục hỗn hợp và giữ lượt Top kế tiếp. Thay người trong hạng hoặc
  xóa bảng xếp hạng sẽ cập nhật đối tượng/fallback, không quay vào bệ trống.
- Các góc cố định cho phép kéo/zoom; xoay chậm, cận cảnh và hỗn hợp tự điều
  khiển camera. Có thể bật/tắt đèn, đổi trang phục và chọn 9:16 / 16:9.
- Nút **Đèn laser** bật/tắt riêng 36 tia laser đa sắc quét hình quạt. Cài đặt
  được lưu và đồng bộ sang OBS, độc lập với nút đèn sân khấu. Bán kính tia
  đã giảm từ 0,014 xuống 0,004667 (còn 1/3).
- Tên chủ sàn và chế độ camera dùng chung trên server, lưu ở
  `data/stage-settings.json` (không đưa lên Git). API:
  `GET /api/stage/settings`, `PUT /api/stage/settings` với `hostName` hoặc
  `stageName`, `hostCharacter`, `cameraMode` hoặc `laserEnabled` (boolean); thay đổi được đồng bộ qua SSE. Cần khởi động lại server sau
  khi cập nhật bản code có API mới này.
- Nhạc nền **FOREVER ONE LOVE #2 · DARKD x DAVID SEA** (M4A) tự phát và lặp
  lại khi hết bài. Tên file có dấu `#` được mã hóa khi tạo URL. Nếu trình duyệt chặn tự phát
  có âm thanh, nhấn **Bật nhạc** hoặc tương tác với trang một lần để bắt đầu;
  nút này xuất hiện cả trong chế độ OBS.
- Trong **Đang phát → Chọn bài nhạc**, có 5 lựa chọn: FOREVER ONE LOVE #2,
  HƠN BẤT CỨ AI 2026, KẾT THÚC VÀ CHIA TAY 2026, NGÀY NÀY NĂM ẤY và
  NONSTOP VINAHOUSE 2025. Chọn bài mới sẽ phát từ đầu và tự lặp lại bài đó.
  Cả MP3 và M4A đều dùng trực tiếp. Bài chọn được lưu ở `musicTrack` trong
  cài đặt sân khấu, giữ qua lần mở lại và đồng bộ tên bài sang các tab/OBS;
  vị trí phát và âm lượng vẫn riêng cho từng trình duyệt. Đổi camera/tên sàn
  không phát lại nhạc từ đầu. Cần khởi động lại server sau khi cập nhật để
  bật mục chọn bài.
- Mặt trước bục DJ có **dải LED chạy tên bài và nghệ sĩ** từ phải sang trái.
  Dải chữ thuộc không gian 3D nên đi theo góc camera; đổi bài sẽ cập nhật ngay
  trên sân khấu và OBS. Chữ dài chạy vòng để đọc hết tên, không bị cắt cố định.
- Giới hạn 30 nhân vật trên sàn và thêm tối đa 3 nhân vật vinh danh tại bàn DJ,
  tối đa 30 FPS và DPR 1,5 để giữ trang nhẹ.
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

`npm.cmd run test:characters` kiểm tra cả 5 kỹ năng, chọn nhân vật bằng bình
luận, lưu lựa chọn chủ sàn, hàng chờ và việc kết thúc kỹ năng. Cũng dùng server
thử 8081 và khôi phục lựa chọn ban đầu sau khi chạy.

`npm.cmd run test:motions` kiểm tra dữ liệu vũ đạo, nối vòng và giữ chân trụ.
`npm.cmd run test:wings` dùng server thử 8086 để kiểm tra cánh Hikari, ba bệ Top,
khung hình dọc, dọn hiệu ứng sau quà và dọn bệ trống; không thay đổi LIVE.
`npm.cmd run test:top-camera` dùng dữ liệu xếp hạng/quà giả lập riêng trong
trình duyệt trên server thử 8086, kiểm tra đủ 3 lượt Top, ưu tiên quà mới,
thay người trong hạng và bỏ qua bảng trống; không thay đổi kết nối LIVE.
`npm.cmd run test:rig` dùng server thử ở cổng 8086 (có thể đổi bằng
`SCENE_BASE_URL`) để tải cả hai model VRM, kiểm tra 10 clip sau khi retarget:
khớp hợp lệ, không nhảy góc đột ngột ở đầu gối/cổ chân và bài thường nối vòng.
Test này không thay đổi cài đặt hay kết nối TikTok.

## Top 3 người tặng quà trên bàn DJ

- Ba bệ DJ nằm phía sau sàn: **Top 1 ở giữa và cao nhất**, Top 2 bên trái,
  Top 3 bên phải. Có nhân vật anime đang nhảy, vương miện/hiệu ứng vinh danh,
  bàn DJ neon và bảng tên kèm danh hiệu: **Top 1 Cơ Trưởng**, **Top 2 Cơ Phó**,
  **Top 3 Tiếp viên**. Danh hiệu thay dòng xu ở sân khấu và danh sách Top;
  điểm quà vẫn được giữ để tính thứ hạng. Nhân vật dùng đúng lựa chọn của người
  tặng qua bình luận `!sakura`, `!yuki`, `!akira`, `!luna`, `!hikari` hoặc đổi đồ.
- Xếp hạng theo **tổng giá trị quà (xu)** nhận từ lúc connector kết nối vào phiên
  LIVE. Quà combo chỉ cộng phần tăng thêm; không nhân số lượng lần thứ hai.
  Nếu bằng xu, ưu tiên số lượng quà, sau đó người tặng trước. Quà không có dữ
  liệu xu vẫn ghi nhận số lượng, không tự quy đổi thành xu.
- Server giữ bảng xếp hạng trong bộ nhớ và phát snapshot qua SSE cho mọi tab/OBS.
  Tải lại trang vẫn có đủ Top 3, không phát lại quà hay tạo thêm người trên sàn.
  Ngắt rồi nối lại cùng phòng giữ điểm; chuyển kênh/phòng LIVE mới hoặc khởi động
  lại server bắt đầu bảng mới. Không lấy được lịch sử quà trước lúc kết nối.
- Nhân vật trên bệ DJ là bản vinh danh, không tính vào số người trên sàn. Người
  xem hết 10 phút không tương tác vẫn bị dọn khỏi sàn; thành tích Top được giữ.
  Khi chưa có quà, bàn DJ để trống. Nút **Xem thử sân khấu** hiển thị ba mẫu có
  nhãn **XEM THỬ**, không thay đổi điểm thật.
- Xem dữ liệu qua `GET /api/live/top-gifters`; bảng điều khiển có mục **Top quà tặng**.
  Cần khởi động lại server sau khi cập nhật bản có API này, rồi refresh OBS.

Kiểm tra toàn luồng với server thử riêng ở cổng 8085, dùng
`--tiktok.script=src/test/resources/fake-tiktok-worker.mjs` và
`--stage.settings-file=.run/preview-top3-settings.json`. Chạy
`npm.cmd run test:top-gifters` (hoặc đặt `SCENE_BASE_URL` trỏ tới server thử).
Test dùng dữ liệu quà giả lập, kiểm tra cộng combo, vượt hạng, nhân vật và OBS;
không chạy với server LIVE ở cổng 8080.

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
