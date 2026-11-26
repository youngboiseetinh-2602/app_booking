# Backend — Hotel Booking App

Backend NestJS + TypeORM + PostgreSQL của ứng dụng đặt phòng khách sạn.

Tài liệu đầy đủ nằm trong [README tại thư mục gốc](../README.md), gồm:

- Cấu hình môi trường và cách chạy local.
- Migration và seed dữ liệu mẫu.
- Endpoint đã triển khai, body mẫu và cách test bằng Postman.
- Danh sách API nghiệp vụ cần triển khai và quyền truy cập dự kiến.
- Validation, response lỗi, kiểm thử và các yêu cầu còn lại của bài tập.

Các lệnh thường dùng khi đang ở thư mục `backend`:

```powershell
npm.cmd ci
npm.cmd run start:dev
```

Cần cấu hình `.env` và chuẩn bị schema PostgreSQL theo README chính trước khi chạy.

Kiểm tra mã nguồn:

```powershell
npx.cmd tsc --noEmit
npm.cmd test -- --runInBand
npm.cmd run test:auth
npm.cmd run build
```

Base URL mặc định là `http://localhost:3000`. Hiện có:

| Method | Endpoint          | Truy cập     |
| ------ | ----------------- | ------------ |
| GET    | `/`               | Public       |
| POST   | `/users/register` | Public       |
| POST   | `/auth/login`     | Public       |
| GET    | `/users/me`       | Bearer token |
| PATCH  | `/users/me` | Bearer token |
| POST   | `/bookings` | CUSTOMER |
| GET    | `/bookings/me` | Bearer token |
| PATCH  | `/bookings/:id/status` | STAFF thuộc khách sạn của booking |
| PATCH  | `/bookings/:id/cancel` | Chủ booking |

Người dùng mới xác nhận kiểm thử bằng Postman cho đăng ký, đăng nhập, lấy hồ sơ và cập nhật hồ sơ cá nhân. Các method booking chưa được xác nhận. Chi tiết input, phí hủy và các endpoint còn dự kiến nằm trong README chính.
