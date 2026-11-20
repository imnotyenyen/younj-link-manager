# YOUNJ LINK MANAGER

Bản Admin mini gồm đúng 5 khu vực: Dashboard, Quản lý liên kết, Quản lý lượt truy cập, Cài đặt, Nhật ký.

## 1. Yêu cầu
- Tài khoản Cloudflare
- Node.js LTS và npm
- Wrangler CLI (`npm install -g wrangler`)

## 2. Tạo D1 database
```bash
npx wrangler login
npx wrangler d1 create younj-link-manager
```
Lấy `database_id` trong kết quả và thay `REPLACE_WITH_D1_DATABASE_ID` ở `wrangler.toml`.

Áp dụng cấu trúc:
```bash
npx wrangler d1 execute younj-link-manager --remote --file=./schema.sql
```

## 3. Đặt mật khẩu Admin
Chọn mật khẩu mạnh, không dùng mật khẩu ví dụ. Đặt secret:
```bash
npx wrangler secret put ADMIN_PASSWORD
```
Nhập mật khẩu tại dấu nhắc. Không ghi mật khẩu vào `wrangler.toml` hoặc mã nguồn.

## 4. Chạy thử và triển khai
```bash
npx wrangler dev
```
Mở URL localhost do Wrangler cung cấp. Khi sẵn sàng:
```bash
npx wrangler deploy
```

## 5. Sử dụng
- Mở URL Worker, hệ thống chuyển đến `/login`.
- Đăng nhập bằng `ADMIN_PASSWORD`.
- Tạo link ở Quản lý liên kết.
- Link công khai có dạng `https://TEN-WORKER.workers.dev/r/ma-link`.

## Lưu ý kỹ thuật
- D1 lưu link, lượt truy cập, cấu hình và nhật ký. KV không bắt buộc trong bản tối giản này.
- Cookie phiên dùng HttpOnly, Secure, SameSite=Strict và chữ ký HMAC. Phiên hết hạn theo `SESSION_TTL_HOURS`.
- Bản đầu ghi nhận lượt mở link (visit); chưa có khái niệm “vượt thành công” hay KEY vì bạn đã chọn bỏ các chức năng KEY/API.
- Lịch sử lưu tối đa 300 dòng được hiển thị trong Admin; dữ liệu cũ vẫn nằm trong D1.
- Quốc gia lấy từ Cloudflare `CF-IPCountry`; không lưu IP thô để giảm dữ liệu cá nhân.
- Cần bật Cloudflare Access hoặc giới hạn thêm theo IP nếu muốn lớp bảo vệ bổ sung. Dùng mật khẩu Admin mạnh và bật xác thực hai yếu tố cho tài khoản Cloudflare.
- Đây là bản nền tảng cần kiểm thử trên tài khoản Cloudflare của bạn trước khi đưa vào sử dụng thực tế.


## Triển khai bằng iPhone + GitHub (không cần Terminal trên điện thoại)

1. Giải nén ZIP trong ứng dụng Tệp (Files) trên iPhone.
2. Tạo repository GitHub mới, ví dụ `younj-link-manager`.
3. Tải toàn bộ nội dung thư mục `younj-link-manager` lên repository, giữ nguyên cấu trúc `src/worker.js`, `schema.sql`, `wrangler.toml`, `package.json`.
4. Trong Cloudflare Dashboard, vào D1 > chọn database `younj-link-manager` > Console, dán nội dung `schema.sql` và chạy.
5. Trong Cloudflare Workers & Pages, tạo Worker từ GitHub repository (Workers Builds / Connect to Git).
6. Build command: `npm run deploy`. Nếu giao diện yêu cầu build output directory, để trống/không dùng; đây là Worker project.
7. Trong Worker > Settings > Variables and Secrets, thêm secret `ADMIN_PASSWORD` với mật khẩu mạnh. Không commit mật khẩu vào GitHub.
8. Kiểm tra binding D1 tên `DB` có trỏ đúng database ID trong `wrangler.toml`, rồi redeploy.

Nếu Cloudflare yêu cầu build command riêng, dùng `npm run deploy`; `package.json` đã khai báo Wrangler làm devDependency.
