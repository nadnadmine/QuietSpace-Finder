# QuietSpace Finder

QuietSpace Finder adalah backend berbasis service untuk membantu pengguna menemukan, menyimpan, melaporkan, dan menerima notifikasi terkait tempat belajar atau bekerja yang nyaman dan tenang. Proyek ini disusun untuk Tugas 9 PPLBS dengan arsitektur API Gateway, beberapa service domain, database terpisah, autentikasi JWT, dan komunikasi asinkron menggunakan RabbitMQ.

## Milestone

| Item | Nilai |
| --- | --- |
| Pertemuan | 9 |
| Versi milestone | `v0.9.0-tugas9` |
| Status | Siap diuji lokal dengan Docker Compose |
| Gateway lokal | `http://localhost:3000` |
| Target deploy | Server LeADS via Git clone |

## Kesesuaian Ketentuan Tugas 9

| Ketentuan | Implementasi di proyek |
| --- | --- |
| API Gateway sebagai satu entry point | `gateway` pada port `3000`, meneruskan request ke service internal |
| Minimal satu service autentikasi | `auth-service` dengan JWT, refresh token, role user, moderator, admin |
| Minimal dua service/domain | `auth-service`, `place-service`, `notification-service` |
| Database service | MySQL dengan database `quietspace_auth`, `quietspace_places`, `quietspace_notifications` |
| Message broker | RabbitMQ untuk event `user.registered`, `user.role_changed`, `place.submitted`, `report.submitted`, dan event lain |
| Consumer asinkron | `notification-worker` menjalankan `php spark rabbitmq:consume` |
| Endpoint dilindungi JWT | Header `Authorization: Bearer <access_token>` pada endpoint user, place write, bookmark, report, dan notification |
| Otorisasi berbasis role | Admin dapat mengubah role dan menonaktifkan user |
| Response JSON konsisten | Format umum `{ message, data, error }` |
| Dokumentasi endpoint | Folder `api-spec/` dan koleksi Postman `postman/QuietSpace Finder.postman_collection.json` |
| Deploy server | Disiapkan untuk clone dan run di LeADS melalui Docker Compose |

## Arsitektur

```text
Client / Postman
      |
      v
API Gateway :3000
      |
      +--> auth-service :3001 --------+
      |                               |
      +--> place-service :3002 -------+--> RabbitMQ :5672 --> notification-worker
      |                               |
      +--> notification-service :80 <--+
                                      |
MySQL :3306 <-------------------------+
```

Service yang berjalan:

| Service | Stack | Port host | Tanggung jawab |
| --- | --- | --- | --- |
| `gateway` | Node.js, Express | `3000` | Routing, CORS, logging, rate limiting, reverse proxy |
| `auth-service` | Node.js, Express, JWT | `3001` | Register, login, refresh, logout, profil user, role admin |
| `place-service` | Node.js, Express | `3002` | Kategori, tempat, rekomendasi, bookmark, laporan kondisi |
| `notification-service` | PHP 8.2, CodeIgniter 4 | `8080` | Inbox notifikasi, preferensi, event log |
| `notification-worker` | PHP CLI | internal | Consumer RabbitMQ |
| `mysql` | MySQL 8 | `3306` | Database seluruh service |
| `rabbitmq` | RabbitMQ 3 management | `5672`, `15672` | Message broker dan dashboard |

## Struktur Repository

```text
.
|-- api-spec/                         # Spesifikasi endpoint per domain
|-- db-init/                          # Script inisialisasi database dari schema service
|-- docs/                             # Dokumentasi tambahan proyek
|-- gateway/                          # API Gateway
|-- postman/                          # Postman collection pengujian
|-- services/
|   |-- auth-service/                 # Auth, JWT, user, role
|   |-- place-service/                # Places, bookmarks, tags, reports
|   `-- notification-service/         # Notification API dan RabbitMQ consumer
|-- docker-compose.yml
`-- README.md
```

## Prasyarat

- Docker Desktop
- Docker Compose v1 (`docker-compose`) atau Compose v2 (`docker compose`)
- Git
- Postman, Insomnia, Thunder Client, atau curl untuk pengujian endpoint

Di PowerShell Windows, jika `npm` diblokir execution policy, gunakan `npm.cmd`.

## Menjalankan Lokal

Dari root project:

```powershell
docker-compose up -d --build
```

Cek status:

```powershell
docker-compose ps
```

Semua container utama harus `Up`:

```text
qs_gateway
qs_auth_service
qs_place_service
qs_notification_service
qs_notification_worker
qs_mysql
qs_rabbitmq
```

Cek health:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/health
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health
Invoke-WebRequest -UseBasicParsing http://localhost:3002/health
Invoke-WebRequest -UseBasicParsing http://localhost:8080
```

Dashboard RabbitMQ:

```text
URL      : http://localhost:15672
Username : guest
Password : guest
```

Melihat log:

```powershell
docker-compose logs -f gateway
docker-compose logs -f auth-service
docker-compose logs -f place-service
docker-compose logs -f notification-service
docker-compose logs -f notification-worker
docker-compose logs -f rabbitmq
```

Menghentikan service:

```powershell
docker-compose down
```

Reset database dan volume:

```powershell
docker-compose down -v
docker-compose up -d --build
```

## Environment

Service memakai file `.env` di masing-masing folder:

```text
gateway/.env
services/auth-service/.env
services/place-service/.env
services/notification-service/.env
```

Variabel penting:

| Variabel | Keterangan |
| --- | --- |
| `PORT` | Port internal service |
| `JWT_SECRET` | Secret untuk signing JWT, harus sama pada service yang memverifikasi token |
| `JWT_ACCESS_EXPIRES` | Masa berlaku access token |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Konfigurasi database Node.js |
| `RABBITMQ_URL` | URL koneksi RabbitMQ untuk service Node.js |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASS` | Koneksi RabbitMQ untuk CodeIgniter worker |

Untuk deploy publik, jangan commit secret produksi. Gunakan `.env` khusus server.

## Format Response

Response sukses dan gagal mengikuti struktur umum:

```json
{
  "message": "string",
  "data": {},
  "error": null
}
```

Contoh error:

```json
{
  "message": "Validation failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": "email and password are required"
  }
}
```

## Autentikasi dan Role

Login menghasilkan `access_token` dan `refresh_token`.

Header untuk endpoint yang dilindungi:

```text
Authorization: Bearer <access_token>
Content-Type: application/json
```

Role yang tersedia:

```text
user
moderator
admin
```

Untuk memperoleh `access_token_admin`, register user dengan `role: "admin"`, lalu login.

```http
POST /api/auth/register
```

```json
{
  "username": "admin_nadia",
  "email": "admin.nadia@example.com",
  "password": "nadianad07",
  "display_name": "Admin Nadia",
  "role": "admin"
}
```

```http
POST /api/auth/login
```

```json
{
  "email": "admin.nadia@example.com",
  "password": "nadianad07"
}
```

## Endpoint Utama

Endpoint lengkap dapat diuji melalui `postman/QuietSpace Finder.postman_collection.json`.

### Gateway

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/health` | Health check gateway dan service |
| GET | `/api` | Informasi routing API |

### Authentication & User Account

| Method | Endpoint | Auth | Keterangan |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Register user, mendukung role untuk pengujian |
| POST | `/api/auth/verify-email` | No | Verifikasi email menggunakan token |
| POST | `/api/auth/login` | No | Login dan mendapatkan token |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/logout` | Yes | Logout satu sesi |
| POST | `/api/auth/logout-all` | Yes | Logout semua sesi |
| GET | `/api/users/me` | Yes | Detail profil user |
| PATCH | `/api/users/me` | Yes | Edit profil user |
| PATCH | `/api/users/:userId/role` | Admin | Ubah role user |
| DELETE | `/api/users/:userId` | Admin | Soft delete/nonaktifkan user |

### Place, Bookmark, Tag, Report

| Method | Endpoint | Auth | Keterangan |
| --- | --- | --- | --- |
| GET | `/api/places/categories` | No | Daftar kategori tempat |
| GET | `/api/places` | No | Daftar tempat |
| GET | `/api/places/recommendations` | No | Rekomendasi tempat |
| GET | `/api/places/:placeId` | No | Detail tempat |
| POST | `/api/places` | Yes | Tambah tempat |
| GET | `/api/bookmarks` | Yes | Daftar bookmark user |
| POST | `/api/bookmarks/:placeId` | Yes | Tambah bookmark |
| DELETE | `/api/bookmarks/:placeId` | Yes | Hapus bookmark |
| GET | `/api/tags` | No | Daftar tag |
| POST | `/api/places/:placeId/reports` | Yes | Buat laporan kondisi tempat |
| GET | `/api/places/:placeId/reports` | No | Daftar laporan tempat |
| GET | `/api/reports/:reportId` | No | Detail laporan |
| POST | `/api/reports/:reportId/vote` | Yes | Vote helpful/tidak helpful |
| DELETE | `/api/reports/:reportId` | Yes | Hapus laporan |

### Notifications

| Method | Endpoint | Auth | Keterangan |
| --- | --- | --- | --- |
| GET | `/api/notifications` | Yes | Daftar notifikasi user |
| GET | `/api/notifications/preferences` | Yes | Preferensi dan tipe notifikasi |
| PATCH | `/api/notifications/preferences` | Yes | Ubah preferensi notifikasi |
| PATCH | `/api/notifications/:notificationId/read` | Yes | Tandai satu notifikasi sebagai read |
| PATCH | `/api/notifications/read-all` | Yes | Tandai semua notifikasi sebagai read |
| GET | `/api/notifications/event-logs` | Yes | Daftar event yang diproses |
| DELETE | `/api/notifications/:notificationId` | Yes | Hapus notifikasi |

## Contoh Request

### Register

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json
```

```json
{
  "username": "nadjsmne",
  "email": "ndajsmne@gmail.com",
  "password": "nadianad07",
  "display_name": "Nadia Jasmine Aulia",
  "role": "user"
}
```

### Login

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json
```

```json
{
  "email": "ndajsmne@gmail.com",
  "password": "nadianad07"
}
```

### Tambah Place

```http
POST http://localhost:3000/api/places
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "name": "Perpustakaan Kota Bandung",
  "category_id": 1,
  "description": "Tempat belajar yang tenang dengan area baca, meja kerja, dan akses Wi-Fi.",
  "address": "Jl. Seram No. 2, Citarum, Bandung Wetan",
  "city": "Bandung",
  "province": "Jawa Barat",
  "country_code": "ID",
  "latitude": -6.9009,
  "longitude": 107.6139,
  "google_place_id": null,
  "website_url": "https://dispusip.bandung.go.id",
  "phone": "0224231921",
  "cover_image_url": null,
  "tag_ids": [1, 2, 3],
  "opening_hours": [
    {
      "day_of_week": 1,
      "open_time": "08:00",
      "close_time": "16:00",
      "is_closed": false
    }
  ]
}
```

### Logout

```http
POST http://localhost:3000/api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "refresh_token": "<refresh_token_dari_login>"
}
```

## Event RabbitMQ

Event dikirim ke queue RabbitMQ saat ada operasi penting.

| Event | Publisher | Queue | Consumer |
| --- | --- | --- | --- |
| `user.registered` | `auth-service` | `user_events` | `notification-worker` |
| `user.role_changed` | `auth-service` | `user_events` | `notification-worker` |
| `place.submitted` | `place-service` | `place_events` | `notification-worker` |
| `report.submitted` | `place-service` | `place_events` | `notification-worker` |

Envelope event:

```json
{
  "event_id": "uuid-v4",
  "event_type": "user.registered",
  "source_service": "auth-service",
  "payload": {}
}
```

## Dokumentasi API

Spesifikasi per domain:

| File | Isi |
| --- | --- |
| `api-spec/gateway.md` | Gateway, health, routing |
| `api-spec/auth.md` | Register, login, refresh, logout, OAuth, verifikasi email |
| `api-spec/users.md` | Profil, role, status user |
| `api-spec/places.md` | Places, kategori, rekomendasi, moderasi |
| `api-spec/bookmarks-tags.md` | Bookmark dan tag |
| `api-spec/reports.md` | Laporan kondisi tempat dan vote |
| `api-spec/notifications.md` | Inbox notifikasi, preferensi, event logs |

Postman collection:

```text
postman/QuietSpace Finder.postman_collection.json
```

## Deploy ke Server LeADS

Server sesuai ketentuan:

```bash
ssh -p 8989 mahasiswa@103.147.92.134
```

Alur deploy dari GitHub:

```bash
ssh -p 8989 mahasiswa@103.147.92.134
git clone <URL_REPOSITORY_GITHUB> QuietSpace-Finder
cd QuietSpace-Finder
cp gateway/.env.example gateway/.env
cp services/auth-service/.env.example services/auth-service/.env
cp services/place-service/.env.example services/place-service/.env
cp services/notification-service/.env.example services/notification-service/.env
docker-compose up -d --build
docker-compose ps
```

Jika file `.env.example` belum dibuat, siapkan `.env` secara manual di server berdasarkan daftar variabel pada bagian Environment.

Setelah deploy, pastikan port yang dibuka/dipakai server sesuai kebijakan LeADS. Minimal service dapat dicek dari server:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api
```

Jika akses publik melalui reverse proxy disediakan, arahkan domain/path publik ke gateway port `3000`.

## Git, Branch, Pull Request, dan Tag

Dokumen rencana PR, commit, dan tag ada di:

```text
docs/pull-requests-commits-tags.md
```

Rekomendasi tag milestone Tugas 9:

```text
v0.9.0-tugas9
```

Alasan: proyek masih berlanjut ke Pertemuan 10 dan seterusnya, sehingga versi `0.9.0` menandai checkpoint sebelum fitur lanjutan. Untuk Pertemuan 10 dapat memakai `v0.10.0-tugas10`.

Perintah tag setelah commit final Tugas 9:

```bash
git tag -a v0.9.0-tugas9 -m "Milestone Tugas 9: service backend QuietSpace Finder"
git push origin v0.9.0-tugas9
```

## Catatan Pengembangan Berikutnya

- Tambahkan `.env.example` untuk setiap service agar deploy dari GitHub lebih aman.
- Lengkapi test otomatis atau collection runner untuk endpoint utama.
- Perbaiki warning deprecated `php-amqplib` pada PHP 8.2 dengan upgrade dependency.
- Tambahkan CI/CD sederhana setelah repository GitHub stabil.
