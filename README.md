# Hotel Booking App

Ứng dụng đặt phòng khách sạn cho ba vai trò `CUSTOMER`, `STAFF`, `ADMIN`, theo bài tập Booking App. Backend sử dụng NestJS, TypeScript, TypeORM và PostgreSQL. Dữ liệu mẫu là dữ liệu giả lập.

## Trạng thái hiện tại

| Hạng mục                                                           | Trạng thái                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| 6 Entity, Enum, Relation, khóa ngoại và CHECK constraint           | Đã có                                                     |
| DataSource, migration khởi tạo và script migration                 | Đã có                                                     |
| Seed Hotel → RoomType → Room                                       | Đã có: 5 khách sạn, 25 loại phòng, 100 phòng              |
| Đăng ký, đăng nhập JWT, xem hồ sơ cá nhân                          | Đã có                                                     |
| JWT 30 phút, băm mật khẩu bằng `PasswordHasher`                    | Đã có                                                     |
| Validation theo thứ tự, trả một thông báo lỗi                      | Đã có                                                     |
| Global Exception Filter                                            | Đã có                                                     |
| Module authorization và thư mục policies                           | Đã có cấu trúc, chưa áp dụng policy nghiệp vụ             |
| Đăng ký, đăng nhập, lấy hồ sơ và cập nhật hồ sơ cá nhân | Người dùng xác nhận đã test bằng Postman |
| Tạo booking, xem booking cá nhân, staff duyệt/từ chối, chủ booking hủy | Đã triển khai; chưa xác nhận test bằng Postman |
| Các API nghiệp vụ còn lại | Xem danh sách bên dưới |
| Swagger, frontend React + TypeScript, Docker Compose               | Chưa triển khai                                           |
| Độ phủ test service ≥ 60%                                          | Mục tiêu của bài tập; chưa xác nhận bằng báo cáo coverage |

Các endpoint booking bên dưới yêu cầu đăng nhập; tạo booking và cập nhật trạng thái áp dụng policy nghiệp vụ. Quyền trong danh sách API **dự kiến** cần được hoàn thiện khi triển khai từng chức năng.

## Cấu trúc thư mục

```text
backend/
  src/
    auth/                 # Controller, Service, DTO, interface và provider JWT
    authorization/        # Module phân quyền; policies dành cho quy tắc nghiệp vụ
    users/                # Đăng ký và hồ sơ cá nhân
    hotels/
    room-types/
    rooms/
    bookings/
    reviews/
    reports/
    common/               # Enum, filter, pipe và validator dùng chung
    config/               # Cấu hình kết nối database của NestJS
    database/
      data-source.ts      # DataSource cho CLI và seed
      migrations/
      seeds/
  test/
frontend/                 # Chưa có mã nguồn ứng dụng
```

## Chạy backend ở local

### 1. Chuẩn bị

- Node.js 24.x và npm; môi trường phát triển đã sử dụng Node.js 24.19.0.
- PostgreSQL đang chạy và có tài khoản được cấp quyền trên database.
- pgAdmin hoặc công cụ PostgreSQL tương đương nếu cần quản lý database.

Các lệnh dưới đây dùng PowerShell. Dùng `npm.cmd` để tránh lỗi PowerShell chặn script `npm.ps1`; trên shell khác có thể dùng `npm`.

```powershell
git clone https://github.com/youngboiseetinh-2602/app_booking.git
cd app_booking/backend
npm.cmd ci
```

Để làm việc trên nhánh hiện tại, chạy `git switch assigment/duy` sau khi clone.

### 2. Cấu hình môi trường

Nếu chưa có `.env`, sao chép file mẫu:

```powershell
Copy-Item .env.example .env
```

Nếu đã có `.env`, giữ nguyên cấu hình riêng và chỉ bổ sung biến còn thiếu.

| Biến          | Ý nghĩa                                    |
| ------------- | ------------------------------------------ |
| `PORT`        | Cổng HTTP; mặc định trong code là `3000`   |
| `DB_HOST`     | Địa chỉ PostgreSQL                         |
| `DB_PORT`     | Cổng PostgreSQL, thường là `5432`          |
| `DB_USERNAME` | Tài khoản kết nối                          |
| `DB_PASSWORD` | Mật khẩu kết nối                           |
| `DB_DATABASE` | Tên database, sử dụng `hotel_booking`      |
| `JWT_SECRET`  | Khóa ký JWT, tối thiểu 32 ký tự ngẫu nhiên |

Tạo khóa JWT rồi điền kết quả vào `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Không commit `.env`. File `.env.example` chỉ chứa mẫu cấu hình, không chứa mật khẩu thật.

### 3. Database và migration

Với PostgreSQL mới chưa có database, mở Query Tool của database `postgres` trong pgAdmin và chạy:

```sql
CREATE DATABASE hotel_booking;
```

Từ thư mục `backend`, kiểm tra và chạy các migration còn thiếu:

```powershell
npm.cmd run migration:show
npm.cmd run migration:run
```

Migration khởi tạo hiện có là `1795579620776-InitialSchema.ts`, gồm 6 bảng, 7 khóa ngoại và 5 PostgreSQL Enum. `synchronize` và `migrationsRun` đều tắt trong DataSource; khởi động ứng dụng không tự chạy migration hay tự đồng bộ bảng.

| Script                                                                   | Chức năng                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm.cmd run migration:show`                                             | Xem migration đã/chưa chạy                                                |
| `npm.cmd run migration:generate -- src/database/migrations/TenMigration` | Sinh migration từ chênh lệch Entity và database; cần xem lại file sinh ra |
| `npm.cmd run migration:run`                                              | Áp dụng migration chưa chạy                                               |
| `npm.cmd run migration:revert`                                           | Hoàn tác migration gần nhất                                               |

Không sinh lại migration khởi tạo khi database đã có schema tương ứng. `migration:revert` có thể xóa cấu trúc và dữ liệu do migration đó tạo ra.

### 4. Seed dữ liệu mẫu

Sau khi đã tạo schema:

```powershell
npm.cmd run seed
```

Seed chỉ xử lý Hotel, RoomType, Room trong một transaction. Dữ liệu mẫu gồm 5 khách sạn, mỗi khách sạn 5 loại phòng, mỗi loại 4 phòng: tổng 100 phòng, với 90 `ACTIVE` và 10 `INACTIVE` trên dữ liệu mới. Không seed User, Review hoặc Booking.

Seed có thể chạy lại: chỉ thêm bản ghi còn thiếu, không cập nhật bản ghi đã tồn tại. Nếu số phòng dự kiến đã thuộc loại phòng khác trong cùng khách sạn, seed báo lỗi và rollback. Số lượng trên là bộ dữ liệu mẫu, không phải tổng số bản ghi của database có dữ liệu nghiệp vụ sẵn.

### 5. Khởi động

```powershell
npm.cmd run start:dev
```

Base URL mặc định: `http://localhost:3000`. Nếu đổi `PORT`, sử dụng cổng tương ứng. Các API hiện chưa có tiền tố `/api` hoặc `/v1`.

Để build và chạy bản biên dịch:

```powershell
npm.cmd run build
npm.cmd run start:prod
```

## Endpoint đã triển khai

Mọi đường dẫn trong bảng được nối sau base URL.

| Method | Endpoint          | Truy cập hiện tại | Chức năng                                            |
| ------ | ----------------- | ----------------- | ---------------------------------------------------- |
| GET    | `/`               | Public            | Trả chuỗi kiểm tra ứng dụng đang hoạt động           |
| POST   | `/users/register` | Public            | Đăng ký tài khoản CUSTOMER, mặc định ACTIVE          |
| POST   | `/auth/login`     | Public            | Kiểm tra tài khoản, mật khẩu và cấp JWT              |
| GET    | `/users/me`       | Bearer token      | Lấy đầy đủ hồ sơ cá nhân qua `AuthenticationContext` |
| PATCH  | `/users/me` | Bearer token | Cập nhật hồ sơ cá nhân |
| POST   | `/bookings` | CUSTOMER | Tạo yêu cầu đặt phòng PENDING |
| GET    | `/bookings/me` | Bearer token | Xem booking của chính người đăng nhập |
| PATCH  | `/bookings/:id/status` | STAFF thuộc khách sạn của booking | Duyệt ACCEPT hoặc từ chối CANCEL booking PENDING |
| PATCH  | `/bookings/:id/cancel` | Chủ booking | Hủy booking PENDING hoặc ACCEPT |

### Booking — hướng dẫn kiểm thử bằng Postman

Chưa xác nhận các method booking đã được kiểm thử bằng Postman. Hiện chỉ đăng ký, đăng nhập, lấy hồ sơ và cập nhật hồ sơ cá nhân đã được người dùng xác nhận. Tất cả request booking dùng Authorization → Bearer Token; `:id` là UUID booking.

- `POST /bookings`: body gồm `roomId`, `guestCount`, `startTime`, `endTime`. Server lấy userId từ context, kiểm tra phòng/loại phòng/khách sạn hoạt động, sức chứa và lịch trùng. Tổng tiền tính theo số giờ làm tròn lên nhân giá theo giờ; booking mới có trạng thái `PENDING`.
- `GET /bookings/me`: không cần body, chỉ trả booking của người đăng nhập; chưa có booking trả `404`.
- `PATCH /bookings/:id/status`: body `{"status":"ACCEPT"}` hoặc `{"status":"CANCEL"}`. Chỉ staff được phân công đúng khách sạn được xử lý booking `PENDING`; từ chối không thu phí hủy.
- `PATCH /bookings/:id/cancel`: không cần body. Kiểm tra `booking.userId` bằng ID từ context; khác chủ trả `403`, không tìm thấy trả `404`. `PENDING` miễn phí; `ACCEPT` tính `Math.round(totalPrice * 30 / 100)`. Lưu `CANCEL`, `cancellationFee`, `cancelledAt` và trả DTO booking; booking đã `CANCEL` hoặc `EXPIRED` trả `409`.

Tạo booking khóa phòng để chống đặt trùng. Duyệt và hủy booking khóa bản ghi booking trong transaction để tránh cập nhật đồng thời. Phí hủy hiện được ghi nhận vào booking, chưa có xử lý thu tiền/hoàn tiền. Tỷ lệ 30% được đặt trong hằng số của service, chưa tạo bảng chính sách riêng.

### Đăng ký

```http
POST /users/register
Content-Type: application/json
```

```json
{
  "username": "duy123",
  "password": "12345678",
  "fullName": "Nguyễn Hữu Duy",
  "email": "duy123@example.com",
  "phone": "0901234567"
}
```

Thành công: HTTP `201`, body là chuỗi `đăng kí thành công`.

- Username dài 3–50 ký tự; password dài 8–128 ký tự.
- Full name tối đa 100 ký tự; email đúng định dạng, tối đa 255 ký tự.
- Phone tùy chọn, cho phép `null`, tối đa 15 ký tự; nếu gửi chuỗi thì không được rỗng.
- Không nhận `role`, `status`, `hotelId` hay `passwordHash` từ người đăng ký.
- Mật khẩu `123456` chưa đủ 8 ký tự nên không đăng ký được với validation hiện tại.

### Đăng nhập

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "username": "duy123",
  "password": "12345678"
}
```

Thành công: HTTP `200`.

```json
{
  "accessToken": "<JWT được cấp>",
  "expiresIn": 1800,
  "tokenType": "Bearer"
}
```

JWT có hạn 30 phút. Hiện không cấp refresh token. Mật khẩu được kiểm tra bằng `PasswordHasher` của `@nestjs/authentication`; tài khoản INACTIVE không đăng nhập được.

### Lấy hồ sơ cá nhân

```http
GET /users/me
Authorization: Bearer <accessToken>
```

Không gửi body, user ID hoặc query parameter. Trong Postman chọn đúng **GET**, Authorization → Bearer Token, và Body → none.

Service lấy người dùng từ `AuthenticationContext`, tương tự vai trò của `SecurityContextHolder` bên Java, rồi truy vấn thông tin mới nhất theo ID từ context. Không sử dụng ID do client gửi.

Thành công: HTTP `200`, dữ liệu theo `UserResponeDto`:

```json
{
  "id": "<UUID người dùng>",
  "username": "duy123",
  "fullName": "Nguyễn Hữu Duy",
  "email": "duy123@example.com",
  "phone": "0901234567",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "hotelId": null
}
```

Không trả `password`, `passwordHash` hoặc các Relation.

## Các endpoint cần triển khai tiếp

Các bảng dưới đây là **đề xuất API theo yêu cầu bài tập**, chưa phải route có sẵn. Query parameter, request/response DTO và policy cần được hoàn thiện cùng từng chức năng.

### Tài khoản

| Method | Endpoint dự kiến | Quyền dự kiến | Chức năng                                                                           |
| ------ | ---------------- | ------------- | ----------------------------------------------------------------------------------- |
| GET    | `/users`         | ADMIN         | Danh sách/lọc tài khoản theo role, status, hotelId                                  |
| GET    | `/users/:id`     | ADMIN         | Chi tiết tài khoản, không trả mật khẩu/hash                                         |
| PATCH  | `/users/:id`     | ADMIN         | Quản lý trạng thái, vai trò và khách sạn của STAFF; giữ CHECK role/hotelId          |

### Khách sạn, loại phòng và phòng

| Method | Endpoint dự kiến                | Quyền dự kiến                 | Chức năng                                                                                           |
| ------ | ------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/hotels`                       | Public                        | Danh sách, tìm theo tên/thành phố, phân trang                                                       |
| GET    | `/hotels/:id`                   | Public                        | Chi tiết khách sạn và chính sách hủy                                                                |
| POST   | `/hotels`                       | ADMIN                         | Tạo khách sạn                                                                                       |
| PATCH  | `/hotels/:id`                   | ADMIN; STAFF của khách sạn đó | Cập nhật thông tin, trạng thái, chính sách hủy                                                      |
| GET    | `/hotels/:hotelId/room-types`   | Public                        | Danh sách/lọc loại phòng theo sức chứa, giá theo giờ                                                |
| GET    | `/room-types/:id`               | Public                        | Chi tiết loại phòng                                                                                 |
| GET    | `/room-types/:id/availability`  | Public                        | Kiểm tra phòng trống theo startTime, endTime, guestCount; trả số phòng trống và các lựa chọn roomId |
| POST   | `/hotels/:hotelId/room-types`   | ADMIN; STAFF của khách sạn đó | Tạo loại phòng                                                                                      |
| PATCH  | `/room-types/:id`               | ADMIN; STAFF của khách sạn đó | Cập nhật mô tả, sức chứa, giá, isActive                                                             |
| GET    | `/room-types/:roomTypeId/rooms` | ADMIN; STAFF của khách sạn đó | Quản lý danh sách phòng cụ thể                                                                      |
| POST   | `/room-types/:roomTypeId/rooms` | ADMIN; STAFF của khách sạn đó | Tạo phòng, không trùng tên trong cùng khách sạn                                                     |
| PATCH  | `/rooms/:id`                    | ADMIN; STAFF của khách sạn đó | Sửa tên phòng hoặc ACTIVE/INACTIVE                                                                  |

Số phòng và số phòng trống được tính từ Room và Booking, không thêm cột lưu riêng. Không lưu BOOKED/OCCUPIED vào RoomStatus. Ưu tiên vô hiệu hóa thay vì xóa dữ liệu đang được tham chiếu bởi khóa ngoại RESTRICT.

### Booking

| Method | Endpoint dự kiến       | Quyền dự kiến                           | Chức năng                                                          |
| ------ | ---------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/bookings/:id`        | Chủ booking; STAFF của khách sạn; ADMIN | Xem chi tiết booking                                               |
| GET    | `/bookings`            | STAFF của khách sạn; ADMIN              | Quản lý/lọc booking theo trạng thái, khoảng thời gian              |

Các phần booking còn cần triển khai:

- API xem chi tiết và quản lý/lọc booking theo quyền trong bảng trên.
- Quy định thời gian giữ chỗ PENDING, trạng thái nào giữ phòng và tác vụ chuyển booking hết hạn sang EXPIRED. Thời gian giữ chỗ không mặc nhiên bằng hạn JWT.
- Dùng đúng Enum hiện có: PENDING, ACCEPT, CANCEL, EXPIRED; chưa bổ sung trạng thái REJECTED.

### Báo cáo

| Method | Endpoint dự kiến            | Quyền dự kiến              | Chức năng                                             |
| ------ | --------------------------- | -------------------------- | ----------------------------------------------------- |
| GET    | `/reports/bookings/summary` | STAFF của khách sạn; ADMIN | Thống kê số booking theo trạng thái, khoảng thời gian |
| GET    | `/reports/bookings/monthly` | STAFF của khách sạn; ADMIN | Thống kê booking theo tháng/năm                       |

STAFF phải được giới hạn dữ liệu theo hotelId trong tài khoản; không được đổi query hotelId để truy cập khách sạn khác. ADMIN có thể chọn phạm vi khách sạn.

### Review — mở rộng theo Entity hiện có

| Method | Endpoint dự kiến           | Quyền dự kiến     | Chức năng                                            |
| ------ | -------------------------- | ----------------- | ---------------------------------------------------- |
| GET    | `/hotels/:hotelId/reviews` | Public            | Danh sách đánh giá khách sạn                         |
| POST   | `/hotels/:hotelId/reviews` | CUSTOMER          | Tạo đánh giá, lấy userId từ context; starRate từ 1–5 |
| PATCH  | `/reviews/:id`             | Chủ review; ADMIN | Sửa đánh giá                                         |
| DELETE | `/reviews/:id`             | Chủ review; ADMIN | Xóa đánh giá                                         |

Hiện chưa đặt ràng buộc mỗi người chỉ đánh giá một lần. Điều kiện đã lưu trú và các quy tắc bổ sung cần được xác định trước khi áp dụng.

### Swagger

Dự kiến cung cấp Swagger UI tại `GET /docs` với mô tả DTO, response lỗi và Bearer authentication. Hiện chưa có endpoint này và chưa cài cấu hình Swagger.

## Validation và response lỗi

Đăng ký và đăng nhập kiểm tra theo thứ tự: không rỗng → kiểu dữ liệu → độ dài → định dạng → field ngoài danh sách cho phép. Mỗi request validation sai chỉ trả một thông báo dạng chuỗi.

Ví dụ login thiếu password:

```json
{
  "statusCode": 400,
  "message": "Mật khẩu không được để trống",
  "path": "/auth/login",
  "timestamp": "2026-11-25T08:00:00.000Z"
}
```

| HTTP | Trường hợp                                                                               |
| ---- | ---------------------------------------------------------------------------------------- |
| 400  | Dữ liệu sai hoặc có field không được phép                                                |
| 401  | Sai thông tin đăng nhập, token thiếu/sai/hết hạn, tài khoản không hoạt động              |
| 403  | Policy được áp dụng từ chối quyền thao tác                                               |
| 404  | Route không tồn tại; lỗi tài nguyên cần được xử lý khi bổ sung API nghiệp vụ             |
| 409  | Username hoặc email đã tồn tại                                                           |
| 500  | Lỗi ngoài dự kiến; client chỉ nhận `Internal server error`, chi tiết ghi log phía server |

Filter giữ mã HTTP, thêm path và timestamp UTC; giữ `errorCode` của thư viện khi có. Đây là xử lý HTTP, không thay thế xử lý lỗi khi ứng dụng khởi động hoặc CLI thất bại.

## Kiểm tra

Chạy từ thư mục `backend`:

```powershell
npx.cmd tsc --noEmit
npm.cmd test -- --runInBand
npm.cmd run test:auth
npm.cmd run build
```

`test:auth` kiểm tra HTTP với JWT thật, `AuthenticationContext` và Repository mô phỏng; không truy cập PostgreSQL. Các test gồm đăng ký, đăng nhập, hồ sơ cá nhân, validation, lỗi HTTP và policy dùng riêng trong test.

Đo độ phủ bằng `npm.cmd run test:cov`; yêu cầu bài tập là độ phủ service ≥ 60%, cần đánh giá báo cáo thực tế thay vì suy ra từ số test. Script `test:e2e` có sẵn từ scaffold nhưng chưa xác nhận chạy trên database thật.

## Các phần còn lại của bài tập

- Triển khai API nghiệp vụ và policy kiểm tra cả vai trò lẫn quyền sở hữu/phạm vi khách sạn.
- Hoàn thiện xử lý hết hạn booking; mở rộng chính sách hủy khi có yêu cầu cấu hình riêng.
- Xây dựng frontend React + TypeScript: danh sách/tìm kiếm, chi tiết, đặt phòng, lịch sử và trang quản trị STAFF.
- Bổ sung Swagger, test service và báo cáo coverage.
- Bổ sung Dockerfile, Docker Compose và hướng dẫn chạy toàn bộ hệ thống; hiện chưa có lệnh Compose dùng được trong repo.

## Làm việc qua Pull Request

Tạo nhánh tính năng, commit và mở PR để review trước khi merge. Mô tả PR cần nêu chức năng thay đổi, cách kiểm tra, ảnh hưởng tới database nếu có, phần do AI hỗ trợ sinh và cách người thực hiện đã kiểm tra phần đó theo yêu cầu bài tập.

Không commit `.env`, token thật, mật khẩu, `node_modules` hoặc `dist`. Chỉ chạy migration/seed khi chủ động muốn cập nhật database của môi trường đang kết nối.
