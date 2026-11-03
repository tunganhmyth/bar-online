# Dàn nhân vật anime của MythMaker

Gồm **2 nhân vật nam, 3 nhân vật nữ** với 5 bộ trang phục riêng. Nhân vật nam
dùng model nam riêng, khác khuôn mặt, tóc và vóc dáng với model nữ.
Mỗi người xem được gán một trong 5 nhân vật theo TikTok ID. Điệu nhảy thường,
tạo hình và kỹ năng là một bộ đi cùng nhau. Chủ sàn chọn bộ nhân vật trong
bảng điều khiển; người xem chọn bằng bình luận hoặc dùng lệnh đổi nhân vật.

| Nhân vật | Tạo hình | Điệu nhảy riêng | Kỹ năng khi nhận quà |
| --- | --- | --- | --- |
| **Sakura** · Nữ dân chơi phố đêm | Tóc hồng, áo khoác hồng ngắn, váy mini tối màu, boots cao và dây chuyền | **Sensual Club** · 128 nhịp: hip eight, shoulder roll, body wave, Single Ladies và footwork nhanh | **Vũ điệu hoa anh đào**: Single Ladies → Gnarly → Sassy, cánh hoa hồng |
| **Yuki** · Nữ công chúa băng | Tóc bạc, vương miện pha lê, váy dạ hội xòe dài xanh băng, bodice, ren và ngọc trai | **Silk Flow** · 128 nhịp: chuyển thân mềm, đường cổ tay, bước chéo, shuffle và Gnarly | **Vương miện băng giá**: Broadway → Single Ladies → Midnight Sun, pha lê và tư thế kết |
| **Akira** · Nam dân chơi cyber | Model nam, tóc ngắn đen, tai nghe, kính, áo khoác tối màu, quần dài, dây chuyền và vòng tay | **Cold Pop** · 128 nhịp: chest pop, lock, heel-toe, đổi gối, bước nhanh và body wave | **Bùng nổ điện quang**: DWG → Shuffle → Woah, tia điện và pose kết |
| **Luna** · Nữ quý tộc ánh trăng | Váy tím sẫm dài, corset dây vàng, áo choàng vai, đá quý và kẹp trăng | **Midnight Vogue** · 128 nhịp: S-line, body roll, đường tay, Latin flow và footwork | **Ngân hà nguyệt vũ**: Single Ladies → Sassy → Broadway, trăng và sao |
| **Hikari** · Nam hoàng tử bình minh | Model nam, tóc vàng, vương miện, lễ phục trắng có đuôi áo, cầu vai vàng, quần dài và áo choàng xanh navy | **Liquid Lock** · 128 nhịp: wave có độ trễ, isolation, khóa thân và bước chân dẻo | **Đôi cánh bình minh**: Blunt → DWG → West Coast, khóa tư thế và đôi cánh ánh kim |

## Vũ đạo sân khấu

Trang phục dùng phom riêng: áo club ôm eo và váy mini xếp nếp cho Sakura;
váy gấm xanh có đường viền/cườm cho Yuki; corset tím và áo choàng vai cho Luna;
áo khoác tối màu, đai chéo và chi tiết kim loại cho Akira; áo đuôi tôm trắng,
ve áo, cầu vai và áo choàng navy cho Hikari. Áo hoodie gốc được ẩn. Thân áo
được skin theo xương hông/ngực để co khi body roll; đuôi áo và váy có chuyển
động phụ nhẹ. Vải có hoa văn/sợi dệt, phối chất liệu satin, da, nhung và kim loại.
Các chi tiết cố định được gộp theo vật liệu và xương, geometry/texture dùng
chung giữa những người mặc cùng bộ để giữ số lượt vẽ thấp.

- Mỗi bài có 16 combo nối tiếp, tổng 128 nhịp, khoảng 54,9 giây ở 140 BPM.
- Phối từ 8–9 bản ghi trên mỗi nhân vật; tổng 17 nguồn chuyển động. Chọn các
  đoạn giàu chuyển động, loại phần đứng chờ. Nữ ưu tiên chuyển động thân/hông;
  nam ưu tiên phối chân/tay và isolation. Các tên pha là nhãn biên đạo của app,
  không phải các cấp độ hay động tác được trích xuất từ Audition.
- Nữ có đường cong hông số 8, ribcage đối nhịp, shoulder roll, body wave có độ
  trễ và đường tay mềm. Nam dùng wave chậm xen chest pop, shoulder hit, lock,
  heel-toe và đổi gối. Cổ tay và các đốt ngón tay chuyển động riêng; nam giữ
  biểu cảm lạnh hơn thay vì cùng cười khi nhận quà.
- Các đoạn footwork có nhấn đổi chân ở nửa nhịp, swivel gót/mũi chân và gối.
  Không ép toàn bộ nhân vật xoay 360° hoặc tự bật lên khi capture không có cú bật.
- Chuyển đoạn có pre-roll 0,5 giây, lọc rung và giới hạn các bước xoay khớp đột
  ngột. Chân trụ được giữ bằng IK hai khớp, tính sẵn khi nạp clip; chân đang
  trên không được thả. Giữ hướng cổ chân của capture để thấy rõ heel/toe pivot.
- Các nhân vật dùng chung pha nhịp của sân khấu, lệch nhau theo combo.
- Kỹ năng quà gồm 3 pha trong 12 nhịp, chạy một lần và giữ tư thế kết.

## Luồng kích hoạt kỹ năng

1. Quà tạo lượt camera cho đúng người tặng. Nhân vật tiếp tục nhảy thường lúc
   camera đang tiến lại; những người khác và người đang xếp hàng vẫn nhảy thường.
2. Sau khoảng 1,1 giây, camera tới nơi: chuyển mượt từ điệu nhảy sang động tác
   kỹ năng của nhân vật đó, đồng thời bật hiệu ứng riêng quanh chính người đó.
3. Combo quà được gộp vào lượt hiện tại. Một kiểu nhân vật không có quyền dùng
   kỹ năng của kiểu khác; nhiều người cùng kiểu cũng không cùng kích hoạt.
4. Hết lượt camera, quay lại điệu nhảy thường, dọn hiệu ứng và thực hiện lượt
   tiếp theo. Xóa người, dọn sàn hoặc hủy camera cũng dọn hiệu ứng tương ứng.

Hiệu ứng có ba pha: bung nhẹ khi camera tới → trình diễn → tan dần khi camera
rời. Sakura có dải lụa/cánh hoa hồng; Yuki có nhánh băng, lăng kính và bông
tuyết; Akira có mạch điện và vệt năng lượng; Luna có trăng lưỡi liềm, quỹ đạo
và sao; Hikari có cánh thiên thần trắng 3D gồm 132 lông vũ xếp ba lớp, có gân
lông, bề mặt cong và ánh vàng nhẹ tại gốc. Cánh có khớp khép/mở và nhịp vẫy
nhẹ. Ánh sáng đặt sau/hai
bên, có kiểm tra chiều sâu để khuôn mặt không bị che. Camera quà lấy rộng vừa
đủ để thấy trang phục và cánh, đèn chân/viền dùng màu riêng của nhân vật.

Góc cận thường/Top chỉ dùng viền sáng nhẹ sau khi camera tới, không kích hoạt
kỹ năng quà. Dải bài hát phía sau giảm sáng tạm thời khi đang quay cận rồi
sáng trở lại khi camera rời, nội dung bài và vị trí phát không thay đổi.

## Chọn nhân vật

- Chủ sàn: **Sân khấu của bạn → Nhân vật chủ sàn**, lưu trên server và đồng bộ OBS.
- Người xem: `!sakura`, `!yuki`, `!akira`, `!luna`, `!hikari`.
- Cũng nhận `nhân vật yuki`, `nhan vat yuki` và tương tự cho tên khác.
- `đổi đồ` / `đổi nhân vật` chuyển sang bộ tiếp theo trong 5 bộ.
- **Thử camera quà** dùng cùng luồng kỹ năng, có nhãn xem thử.

## Tài nguyên và triển khai

5 bộ dùng hai model nền riêng: nữ `VRM1_Constraint_Twist_Sample` và nam
`HairSample_Male` của pixiv. Tạo hình thay đổi bằng tóc, trang phục và phụ kiện
3D gắn theo xương. Giấy phép gốc và nguồn ghi trong
`src/main/resources/static/models/ATTRIBUTION.md`.

`frontend/anime-characters.js` chứa cấu hình 5 bộ, vật liệu MToon và tạo hình.
`frontend/character-effects.js` tạo dải sáng, sprite cánh hoa/tuyết/sao bằng
canvas, vòng sáng và hiệu ứng cận cảnh; không tải thêm ảnh ngoài.
`frontend/feather-wings.js` dựng cánh lông vũ 3D riêng, dùng chung cho kỹ năng
Hikari và ba bệ Top. Mỗi đôi dùng hai lượt vẽ instanced, chia sẻ geometry và
texture gân lông; khớp cánh/vật liệu độc lập. Góc cận lấy rộng hơn để giữ trọn
cánh trong khung dọc; cánh Top vẫn hiển thị khi được camera vinh danh.
`frontend/character-costumes.js` tạo 5 kiểu trang phục.
`frontend/dance-motions.js` chuyển motion capture sang bộ xương anime và tạo
clip nhảy/kỹ năng; `dance-foot-ik.js` giữ chân trụ, `dance-hands.js` điều khiển
các đốt ngón tay. `scripts/prepare-stage-combos.mjs` chọn và ghép đoạn;
`scripts/choreography-style.mjs` thêm các lớp chuyển động riêng theo phong cách.
Các capture G1 Moves do Jasmine Coro biểu diễn; nguồn và giấy phép nằm ở
`static/animations/ATTRIBUTION.md`.
Model, texture, clip và geometry nền
được tái sử dụng; mỗi người có skeleton, mixer và vật liệu riêng. Chỉ có một
bộ hiệu ứng kỹ năng hoạt động cho lượt camera quà hiện tại.
