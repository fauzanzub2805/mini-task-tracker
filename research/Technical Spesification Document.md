# Technical Spesification Document - Mini Task Tracker

Muhammad Fauzan Zubaedi

**1. Pemilihan Stack**

- Framework Backend : **Laravel**
- Bahasa Pemrograman : **PHP**
- Database : **Postgresql**
- ORM/Query : **Migration bawaan Laravel**
- Frontend : **Blade + Tailwind CSS + Alpine.js** 
- Hosting : **Render**

**2. Data Model**

*2.1 Access Rule*

- Aplikasi melayani satu tim, tidak ada pendaftaran mandiri. Akun hanya bisa dibuat dengan menukarkan undangan yang dikirim ke satu alamat email perusahaan yang unik.

*2.2 Entity*

4 entitas :

1. invitations
2. users
3. tasks
4. comments

A. **invitations**

- invitations 
- id : BIGSERIAL, PK
- email : VARCHAR(255), NOT NULL, UNIQUE. Disimpan secara lowercase, satu baris per alamat
- token : VARCHAR(64), NOT NULL, UNIQUE. Rahasia pada link undangan yairu ≥32 byte dari CSPRNG.
- invited_by_id : BIGINT, FK → users.id, NULL hanya untuk baris bootstrap
- status : VARCHAR(16), NOT NULL DEFAULT 'pending', nilai yang diizinkan: pending, accepted, revoked, ditegakkan dengan CHECK
- expires_at :TIMESTAMPTZ, NOT NULL 
- accepted_at : TIMESTAMPTZ, NULL. jejak audit kapan token ditukarkan
- created_at : TIMESTAMPTZ, NOT NULL DEFAULT now()

B. users

- id : BIGSERIAL, PK
- invitation_id : BIGINT, FK → invitations.id, NOT NULL, UNIQUE.
- name : VARCHAR(100), NOT NULL
- email : VARCHAR(255), NOT NULL, UNIQUE.
- password_hash : VARCHAR(255), NOT NULL.
- created_at : TIMESTAMPTZ, NOT NULL DEFAULT now()
- updated_at : IMESTAMPTZ, NOT NULL DEFAULT now()

C. tasks

- id : BIGSERIAL, PK
- title : VARCHAR(200), NOT NULL
- description : TEXT, NULL. Teks biasa
- status : VARCHAR(16), NOT NULL DEFAULT 'todo', nilai yang diizinkan: todo, in_progress, done
- due_date : DATE, NULL. Tanggal kalender, bukan instan waktu
- assignee_id : BIGINT, FK → users.id, NULL. Task tanpa assignee adalah state yang sah
- created_by_id : BIGINT, FK → users.id, NOT NULL. Terpisah dari assignee
- created_at : TIMESTAMPTZ, NOT NULL DEFAULT now(). Kunci sort default list view
- updated_at : TIMESTAMPTZ, NOT NULL DEFAULT now()

D. comments

- id : BIGSERIAL, PK
- task_id : BIGINT, FK → tasks.id, NOT NULL
- author_id : BIGINT, FK → users.id, NOT NULL
- body : TEXT, NOT NULL
- created_at : TIMESTAMPTZ, NOT NULL DEFAULT now()
- updated_at : TIMESTAMPTZ, NOT NULL DEFAULT now()

*2.3 Relasi*

- R1 : invitations → users, kardinalitas 1:1, FK users.invitation_id (UNIQUE), tidak opsional, ON DELETE RESTRICT. Undangan yang menghasilkan akun adalah jejak audit
- R2 : users → invitations, kardinalitas 1:N, FK invitations.invited_by_id, opsional (NULL pada baris bootstrap), ON DELETE SET NULL. Menghapus pengundang tidak boleh menghapus riwayat undangan
- R3 : users → tasks, kardinalitas 1:N, FK tasks.assignee_id, opsional (task boleh tanpa assignee), ON DELETE SET NULL. Menghapus user tidak boleh menghapus pekerjaannya
- R4 : users → tasks, kardinalitas 1:N, FK tasks.created_by_id, tidak opsional, ON DELETE RESTRICT. Memblokir penghapusan user yang masih punya task
- R5 : tasks → comments, kardinalitas 1:N, FK comments.task_id, tidak opsional, ON DELETE CASCADE. Komentar sebuah task ikut terhapus bersamanya
- R6 : users → comments, kardinalitas 1:N, FK comments.author_id, tidak opsional, ON DELETE RESTRICT. Menjaga riwayat komentar tetap bisa disusunn.


*2.4 Index*

- invitations : UNIQUE (email). Satu catatan undangan per alamat
- invitations : UNIQUE (token). Jalur lookup halaman registrasi
- invitations : (status, expires_at). Daftar undangan aktif dan cleanup
- users : UNIQUE (email). Lookup login
- users : UNIQUE (invitation_id). Menegakkan satu undangan → satu akun
- tasks : (status), (assignee_id), (due_date). Tiga index terpisah untuk tiap filter/sort di list view
- comments : (task_id, created_at). Memuat komentar satu task terurut


**3. API Sketch**

*3.1 Invitations*

- POST /invitations : mengundang email perusahaan, menyisipkan baris invitations baru. Perlu login
- GET /invitations : daftar undangan, bisa difilter ?status=. Perlu login
- GET /invitations/:token : memvalidasi token sebelum form registrasi ditampilkan. Tidak perlu login
- DELETE /invitations/:id : mencabut undangan yang masih pending. Perlu login, kondisional 

*3.2 Auth*

- POST /auth/register : menukar token menjadi baris users baru. Tidak perlu login
- POST /auth/login : email + password menjadi session. Tidak perlu login
- POST /auth/logout : mengakhiri session. Perlu login
- GET /auth/me : mengembalikan data user yang sedang login. Perlu login

Body register: { token, name, password } — tanpa field email. Email disalin dari baris undangan di dalam transaksi.

*3.3 Users*

- GET /users : daftar anggota tim, hanya id, name, email. Perlu login

Dibutuhkan karena tasks.assignee_id adalah FK ke users.id. Tidak ada POST /users (lewat register) dan tidak ada DELETE /users/:id karena RESTRICT pada R4 dan R6.

*3.4 Tasks*

- GET /tasks : daftar task, query param ?status=, ?assignee_id=, ?sort=due_date|created_at, ?order=asc|desc
- POST /tasks : membuat task
- GET /tasks/:id : detail task
- PATCH /tasks/:id : mengubah title, description, status, due_date, assignee_id
- DELETE /tasks/:id : menghapus task, komentarnya ikut terhapus sesuai R5

*3.5 Comments*

- GET /tasks/:id/comments : daftar komentar, terlama ke terbaru
- POST /tasks/:id/comments : menambah komentar, body { body }

Sengaja tidak ada PATCH/DELETE komentar — scope hanya menyebut "komentar teks biasa" (lihat 6.5).

*3.6 Konvensi*

- Validasi lewat Form Request, error dibalas 422
- Respons dibentuk lewat API Resource, bukan model mentah
- GET /tasks dipaginasi, default 25 per halaman

**4. Authentication**

*4.1 Keputusan*

- Email + password menggunakan auth bawaan Laravel: guard web, session berbasis cookie, hashing lewat Hash::make (bcrypt default). Bukan magic link, bukan token API

*4.2 Library*

- Hashing : Illuminate\Support\Facades\Hash, bawaan framework, bisa diganti argon2id tanpa mengubah kode
- Login/session : guard web bawaan, Auth::attempt(), middleware auth
- Scaffolding UI (opsional) : Laravel Breeze — Blade + Tailwind + Alpine
- CSRF, enkripsi cookie, rate limit login : bawaan framework, tanpa paket tambahan

Sanctum tidak dipakai karena tidak ada klien lintas-origin atau mobile.

*4.3 Alasan*

- Framework sudah menyediakan hashing, session, CSRF, dan rate limiting sejak instalasi
- users.password_hash sudah dikunci di ER diagram; magic-link berarti membongkar kolom itu
- Alur undangan sudah bergantung pada email; login sebaiknya tidak ikut bergantung padanya juga
- Sesuai scope: research/scope.md menyebut "basic auth (login/register, one role)"

*4.4 Keputusan Turunan*

- Session driver database, karena filesystem Render ephemeral dan driver file akan menghapus session tiap redeploy
- Kolom password_hash, bukan password. Set pada model User:
  protected $authPasswordName = 'password_hash';
  protected $hidden = ['password_hash'];
  protected $casts = ['password_hash' => 'hashed'];
- Rute registrasi bawaan Breeze wajib dimatikan dan diganti versi yang menuntut token undangan valid

*4.5 Alur Registrasi*

1. User yang sudah login mengundang email perusahaan → baris invitations dibuat dengan token dan expires_at baru
2. Undangan membuka /register?token=… → aplikasi memvalidasi token
3. Undangan mengirim nama + password → dalam satu transaksi: insert users (email dari undangan, bukan dari form), lalu set status = 'accepted'
4. UNIQUE pada users.invitation_id adalah pertahanan terakhir terhadap penukaran ganda

**5. Deployment Plan**

*5.1 Keputusan*

- Render (web service berbasis Docker) dipilih. PHP tidak termasuk runtime yang dideteksi otomatis, jadi aplikasi harus di-containerize. Render mendukung ini resmi lewat panduan dan repo contoh Laravel + PostgreSQL miliknya sendiri. Free tier: 512 MB RAM, mati setelah 15 menit idle, 750 instance-hour/bulan. Postgres 1 GB, kedaluwarsa 30 hari, tenggang 14 hari, tanpa backup
- Railway tidak dipilih. Tidak ada free tier berkelanjutan, hanya kredit percobaan sekali pakai
- Vercel tidak dipilih. Berorientasi serverless/frontend, tidak punya runtime PHP resmi, dan sudah tidak mengoperasikan produk database sendiri

*5.2 Langkah Deployment*

1. Dockerfile berbasis image nginx + php-fpm dengan PHP ≥ 8.3
2. .dockerignore mengecualikan .env, vendor, node_modules, storage/*.key
3. Paksa HTTPS di AppServiceProvider saat APP_ENV=production
4. Buat PostgreSQL di Render, salin Internal Database URL
5. Buat Web Service dengan environment Docker, isi env: DATABASE_URL, DB_CONNECTION=pgsql, APP_KEY, APP_ENV=production, APP_DEBUG=false, LOG_CHANNEL=stderr, SESSION_DRIVER=database
6. Pre-Deploy Command: php artisan migrate --force
7. Deploy script menjalankan composer install --no-dev, php artisan config:cache, php artisan route:cache

*5.3 Konsekuensi Filesystem Ephemeral*

- Session → driver database, bukan file
- Log → LOG_CHANNEL=stderr
- Cache → driver database
- Queue → QUEUE_CONNECTION=sync untuk MVP

*5.4 Rencana Tahapan*

- Selama pengembangan: web service gratis + Postgres 
- Sebelum live di tasktracker.rekayasa.io: pindahkan database ke Render

**6. Risks & Open Questions**

*6.1 Reset password belum masuk scope*
Auth berbasis password memunculkan kebutuhan "lupa password". Butuh tabel password_reset_tokens dan kompatibilitas dengan penamaan password_hash.

*6.2 Siapa yang boleh mengirim undangan*
Scope menetapkan satu role, jadi saat ini semua user bisa mengundang.

*6.3 Domain email perusahaan*



