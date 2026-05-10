# Pull Request, Commit, dan Tag Plan

Dokumen ini berisi daftar pull request, commit, dan tag yang disarankan untuk proyek QuietSpace Finder. Folder lokal saat dokumen ini dibuat belum memiliki folder `.git`, sehingga daftar di bawah berfungsi sebagai rencana riwayat Git yang bisa diterapkan setelah repository GitHub dibuat atau setelah `git init`.

## Branch Utama

| Branch | Fungsi |
| --- | --- |
| `main` | Branch stabil untuk milestone yang siap dikumpulkan dan dideploy |
| `develop` | Integrasi fitur sebelum masuk ke `main` |
| `feature/*` | Branch per fitur/service |
| `fix/*` | Branch perbaikan bug |
| `docs/*` | Branch dokumentasi |

Alur yang disarankan:

```bash
git checkout -b develop
git checkout -b feature/api-gateway
git add .
git commit -m "feat(gateway): add express api gateway and routing"
git push origin feature/api-gateway
```

Setelah itu buat pull request dari `feature/api-gateway` ke `develop`. Jika semua fitur Pertemuan 9 stabil, buat pull request dari `develop` ke `main`.

## Daftar Pull Request

### PR 1 - Project Scaffold dan Docker Compose

**Branch:** `feature/project-scaffold`

**Tujuan:** Menyiapkan struktur monorepo, Docker Compose, MySQL, RabbitMQ, dan folder service.

**Isi perubahan:**

- Menambahkan struktur folder `gateway`, `services`, `db-init`, `api-spec`, `postman`, dan `docs`.
- Menambahkan `docker-compose.yml` untuk gateway, auth-service, place-service, notification-service, notification-worker, MySQL, dan RabbitMQ.
- Menambahkan volume `mysql_data` dan `notification_vendor`.

**Commit yang disarankan:**

```text
chore(project): initialize quietspace finder monorepo
chore(docker): add compose stack for gateway services mysql and rabbitmq
chore(db): add database initialization script
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b feature/project-scaffold

git add .gitignore docker-compose.yml db-init
git commit -m "chore(project): initialize quietspace finder monorepo"

git push origin feature/project-scaffold
```

Setelah push, buat pull request:

```text
base: develop
compare: feature/project-scaffold
title: PR 1 - Project Scaffold dan Docker Compose
```

### PR 2 - API Gateway

**Branch:** `feature/api-gateway`

**Tujuan:** Menyediakan satu entry point untuk semua service.

**Isi perubahan:**

- Menambahkan Express Gateway pada port `3000`.
- Menambahkan proxy route untuk `/api/auth`, `/api/users`, `/api/places`, `/api/bookmarks`, `/api/tags`, `/api/reports`, dan `/api/notifications`.
- Menambahkan CORS, Helmet, Morgan logging, request id, rate limiting, dan endpoint `/health`.
- Memperbaiki path rewrite agar upstream menerima path penuh seperti `/api/auth/register`.

**Commit yang disarankan:**

```text
feat(gateway): add express api gateway with service proxy routes
feat(gateway): add health check api metadata logging and rate limits
fix(gateway): preserve api prefixes when forwarding proxy requests
fix(gateway): replace express wildcard routes with method based write limiter
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b feature/api-gateway

git add gateway/package.json gateway/package-lock.json gateway/Dockerfile gateway/index.js gateway/.env.example
git commit -m "feat(gateway): add api gateway routing health and rate limits"

git push origin feature/api-gateway
```

Setelah push, buat pull request:

```text
base: develop
compare: feature/api-gateway
title: PR 2 - API Gateway
```

### PR 3 - Auth Service dan User Management

**Branch:** `feature/auth-service`

**Tujuan:** Membangun service autentikasi, JWT, role, dan profil user.

**Isi perubahan:**

- Menambahkan schema `quietspace_auth`.
- Menambahkan register, login, refresh token, logout, logout-all, dan verify email.
- Menambahkan profil user `/api/users/me`.
- Menambahkan update role admin `PATCH /api/users/:userId/role`.
- Menambahkan soft delete user admin `DELETE /api/users/:userId`.
- Menambahkan validasi body kosong agar error menjadi JSON 400, bukan HTML 500.
- Menambahkan publish event `user.registered` dan `user.role_changed`.

**Commit yang disarankan:**

```text
feat(auth): add jwt registration login refresh and logout endpoints
feat(auth): add email verification and user profile routes
feat(auth): support role assignment for testing users
feat(users): add admin role update endpoint
feat(users): add admin soft delete endpoint
fix(auth): guard empty request bodies in auth controller
fix(auth): add npm scripts required by docker entrypoint
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b feature/auth-service

git add services/auth-service/package.json services/auth-service/package-lock.json services/auth-service/Dockerfile services/auth-service/schema.sql services/auth-service/.env.example
git add services/auth-service/src/db.js services/auth-service/src/index.js
git add services/auth-service/src/config services/auth-service/src/controllers services/auth-service/src/middleware services/auth-service/src/routes services/auth-service/src/utils
git commit -m "feat(auth): add jwt auth user profile and admin management"

git push origin feature/auth-service
```

Setelah push, buat pull request:

```text
base: develop
compare: feature/auth-service
title: PR 3 - Auth Service dan User Management
```

### PR 4 - Place Service, Bookmark, Tag, dan Report

**Branch:** `feature/place-service`

**Tujuan:** Membangun domain tempat, kategori, bookmark, tag, dan laporan kondisi tempat.

**Isi perubahan:**

- Menambahkan schema `quietspace_places`.
- Menambahkan endpoint daftar kategori, daftar tempat, detail tempat, rekomendasi, dan tambah tempat.
- Menambahkan bookmark user.
- Menambahkan tag.
- Menambahkan laporan tempat dan vote helpful.
- Menambahkan publish event `place.submitted` dan `report.submitted`.

**Commit yang disarankan:**

```text
feat(places): add place category listing detail and recommendation endpoints
feat(places): add authenticated place submission
feat(bookmarks): add bookmark create list and delete endpoints
feat(reports): add condition report and helpful vote endpoints
fix(places): add npm scripts required by docker entrypoint
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b feature/place-service

git add services/place-service/package.json services/place-service/package-lock.json services/place-service/Dockerfile services/place-service/schema.sql services/place-service/.env.example
git add services/place-service/src/db.js services/place-service/src/index.js
git add services/place-service/src/controllers services/place-service/src/middleware services/place-service/src/routes services/place-service/src/utils
git commit -m "feat(places): add places bookmarks tags and reports service"

git push origin feature/place-service
```

Setelah push, buat pull request:

```text
base: develop
compare: feature/place-service
title: PR 4 - Place Service, Bookmark, Tag, dan Report
```

### PR 5 - Notification Service dan RabbitMQ Worker

**Branch:** `feature/notification-service`

**Tujuan:** Membangun service notifikasi dan consumer event RabbitMQ.

**Isi perubahan:**

- Menambahkan CodeIgniter 4 notification-service.
- Menambahkan schema `quietspace_notifications`.
- Menambahkan inbox notifikasi, preferensi, mark read, read all, delete notification, dan event logs.
- Menambahkan JWT filter untuk endpoint notification.
- Menambahkan `notification-worker` untuk consume queue `user_events` dan `place_events`.
- Memperbaiki volume `vendor` agar dependency Composer tidak tertimpa bind mount.
- Memperbaiki loop worker RabbitMQ agar idle timeout tidak dianggap crash.

**Commit yang disarankan:**

```text
feat(notifications): add codeigniter notification api
feat(notifications): add jwt protected preferences and event log endpoints
feat(worker): add rabbitmq consumer for user and place events
fix(docker): preserve composer vendor directory with named volume
fix(worker): handle rabbitmq idle timeout and heartbeat cleanly
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b feature/notification-service

git add services/notification-service/composer.json services/notification-service/composer.lock services/notification-service/Dockerfile services/notification-service/schema.sql services/notification-service/spark services/notification-service/.env.example
git add services/notification-service/app services/notification-service/public
git add services/notification-service/writable/.htaccess services/notification-service/writable/index.html
git add services/notification-service/writable/cache/index.html services/notification-service/writable/debugbar/index.html services/notification-service/writable/logs/index.html services/notification-service/writable/session/index.html services/notification-service/writable/uploads/index.html
git commit -m "feat(notifications): add notification api and rabbitmq worker"

git push origin feature/notification-service
```

Setelah push, buat pull request:

```text
base: develop
compare: feature/notification-service
title: PR 5 - Notification Service dan RabbitMQ Worker
```

### PR 6 - API Spec dan Postman Collection

**Branch:** `docs/api-spec-postman`

**Tujuan:** Menyediakan dokumentasi endpoint dan koleksi pengujian.

**Isi perubahan:**

- Menambahkan spesifikasi endpoint di `api-spec/`.
- Menambahkan Postman collection `QuietSpace Finder.postman_collection.json`.
- Menambahkan contoh request register, login, profile, notifications, places, bookmarks, reports, admin, cleanup, dan health check.

**Commit yang disarankan:**

```text
docs(api): add endpoint specifications for all services
docs(postman): add quietspace finder postman collection
docs(examples): add request samples for auth places reports and notifications
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b docs/api-spec-postman

git add api-spec postman
git commit -m "docs(api): add api specs and postman collection"

git push origin docs/api-spec-postman
```

Setelah push, buat pull request:

```text
base: develop
compare: docs/api-spec-postman
title: PR 6 - API Spec dan Postman Collection
```

### PR 7 - Dokumentasi Milestone Tugas 9

**Branch:** `docs/tugas9-readme`

**Tujuan:** Menyelaraskan README dengan ketentuan tugas, Postman collection, dan rencana deploy.

**Isi perubahan:**

- Mengupdate `README.md` dengan arsitektur service, cara run, endpoint utama, contoh request, event RabbitMQ, dan deploy LeADS.
- Menambahkan dokumen PR, commit, dan tag plan.
- Menentukan tag milestone `v0.9.0-tugas9`.

**Commit yang disarankan:**

```text
docs(readme): align project documentation with tugas 9 requirements
docs(git): add pull request commit and tag plan
docs(deploy): add leads deployment workflow
```

**Command siap copy paste:**

```bash
git checkout develop
git checkout -b docs/tugas9-readme

git add README.md docs/pull-requests-commits-tags.md
git commit -m "docs(readme): document tugas 9 milestone deploy and git workflow"

git push origin docs/tugas9-readme
```

Setelah push, buat pull request:

```text
base: develop
compare: docs/tugas9-readme
title: PR 7 - Dokumentasi Milestone Tugas 9
```

## Commit Final yang Disarankan

Jika ingin membuat commit langsung dari kondisi proyek saat ini, urutan praktisnya:

```bash
git add docker-compose.yml gateway services db-init api-spec postman README.md docs
git commit -m "feat: complete tugas 9 service backend milestone"
```

Jika ingin lebih rapi, gunakan commit bertahap:

```bash
git add docker-compose.yml db-init
git commit -m "chore(docker): configure compose stack and database init"

git add gateway
git commit -m "feat(gateway): add api gateway routing health and rate limits"

git add services/auth-service
git commit -m "feat(auth): add jwt auth user profile and admin management"

git add services/place-service
git commit -m "feat(places): add places bookmarks tags and reports service"

git add services/notification-service
git commit -m "feat(notifications): add notification api and rabbitmq worker"

git add api-spec postman
git commit -m "docs(api): add api specs and postman collection"

git add README.md docs/pull-requests-commits-tags.md
git commit -m "docs(readme): document tugas 9 milestone deploy and git workflow"
```

## Tag Milestone

Tag yang direkomendasikan untuk Tugas 9:

```text
v0.9.0-tugas9
```

Alasan:

- `0.9.0` menandai backend service milestone sebelum fitur lanjutan Pertemuan 10.
- `tugas9` jelas untuk checkpoint akademik.
- Format ini bisa dilanjutkan dengan `v0.10.0-tugas10`, `v0.11.0-tugas11`, dan seterusnya.

Perintah membuat tag:

```bash
git checkout main
git pull origin main
git tag -a v0.9.0-tugas9 -m "Milestone Tugas 9: QuietSpace Finder Service Backend"
git push origin v0.9.0-tugas9
```

Jika tag perlu diganti sebelum dikumpulkan:

```bash
git tag -d v0.9.0-tugas9
git push origin :refs/tags/v0.9.0-tugas9
git tag -a v0.9.0-tugas9 -m "Milestone Tugas 9: QuietSpace Finder Service Backend"
git push origin v0.9.0-tugas9
```

## Release Note untuk GitHub

Judul release:

```text
v0.9.0-tugas9 - QuietSpace Finder Service Backend
```

Isi release:

```markdown
## Ringkasan

Milestone Tugas 9 PPLBS untuk backend QuietSpace Finder berbasis service.

## Fitur

- API Gateway sebagai single entry point.
- Auth service dengan JWT, refresh token, role user/moderator/admin, profile, dan admin user management.
- Place service untuk places, categories, recommendations, bookmarks, tags, dan reports.
- Notification service CodeIgniter 4 dengan preferences, inbox, read status, dan event logs.
- RabbitMQ sebagai message broker dengan notification worker.
- MySQL sebagai database untuk seluruh service.
- Docker Compose untuk menjalankan seluruh stack.
- Postman collection untuk pengujian endpoint.

## Cara Run

```bash
docker-compose up -d --build
curl http://localhost:3000/health
```

## Tag

`v0.9.0-tugas9`
```

## Deploy LeADS dari Git Clone

Urutan di server:

```bash
ssh -p 8989 mahasiswa@103.147.92.134
git clone <URL_REPOSITORY_GITHUB> QuietSpace-Finder
cd QuietSpace-Finder
docker-compose up -d --build
docker-compose ps
curl http://localhost:3000/health
```

Jika repository private, pastikan server sudah punya akses:

- gunakan GitHub HTTPS token, atau
- tambahkan SSH key server ke GitHub account/repository.

## Checklist Sebelum Push

- [ ] Pastikan `.env` produksi tidak berisi secret yang tidak boleh dipublikasikan.
- [ ] Pastikan `node_modules`, `vendor`, `writable/debugbar`, dan log tidak ikut commit.
- [ ] Jalankan `docker-compose up -d --build`.
- [ ] Jalankan `docker-compose ps` dan pastikan semua container `Up`.
- [ ] Test `GET /health`.
- [ ] Import Postman collection dan test flow register, login, create place, report, notification, logout.
- [ ] Merge ke `main`.
- [ ] Buat tag `v0.9.0-tugas9`.
