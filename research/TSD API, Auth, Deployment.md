# Technical Spesification Document - Mini Task Tracker

Penyusun: Fauzan Zub 
Repo: `github.com/fauzanzub2805/mini-task-tracker` 

**Status: REVISI 5** Dokumen tunggal yang menggabungkan TSD Data Model, TSD API/Auth/Deployment, dan TSD lengkap. Revisi ini memuat modul Project, keanggotaan project, RBAC dua lapis, activity feed, tingkat prioritas task, dan penghapusan `users.invitation_id`. Acuan produk ada di `PRD.md`, skema lengkap ada di `ER-Diagram.md` dan Lampiran bagian 8.

*Perubahan Revisi 5*

- **Kolom `users.invitation_id` dihapus** beserta relasi R1 dan index UNIQUE-nya. Lihat 2.3, 4.9, dan 7.12
- **Admin pertama** dibuat langsung oleh seeder, tanpa baris undangan bootstrap. Lihat 4.10
- **Tabel bawaan spatie** mengikuti struktur default package. Lihat 2.2 I
- **Session dan cache** tidak memakai driver database, karena tabel `sessions` dan `cache` tidak termasuk 13 tabel ERD. Lihat 4.4 dan 6.3
- **Urutan migration** ditambahkan. Lihat 6.4
- **Search by title** ditambahkan sebagai query param ?q= pada daftar task. Lihat 3.6 dan 7.13

---

**1. Pemilihan Stack**

- **Framework Backend** : **Laravel**
- **Bahasa Pemrograman** : **PHP**
- **Database** : **PostgreSQL**
- **ORM/Query** : **Migration bawaan Laravel**
- **Frontend** : **Blade + Tailwind CSS + Alpine.js**
- **Hosting** : **Render**
- **RBAC** : **spatie/laravel-permission v8**

*1.1 Alasan penambahan package RBAC*

- Mentor meminta peran disimpan sebagai relasi ke id, bukan kolom varchar, dan izin disimpan sebagai tabel, bukan kondisi di dalam kode. Package ini persis memenuhi keduanya
- Package menyediakan lima tabel dan seluruh logika pemeriksaan izin, sehingga tidak ada skema RBAC yang perlu dirancang sendiri
- Package terintegrasi dengan Gate dan Policy bawaan Laravel, sehingga pemeriksaan tetap ditulis dengan `authorize()` seperti biasa

*1.2 Fitur package yang sengaja tidak dipakai*

- **Fitur teams** tidak diaktifkan. Fitur ini memerlukan konfigurasi sebelum migration pertama, middleware khusus yang wajib didaftarkan sebelum `SubstituteBindings`, dan pemanggilan `unsetRelation()` secara manual setiap kali project aktif berganti. Kelalaian pada langkah terakhir menghasilkan jawaban izin yang diam-diam salah karena membaca cache project sebelumnya. Biaya kesalahannya terlalu besar untuk MVP
- Sebagai gantinya, pembatasan per-project ditangani tabel `project_members` milik aplikasi dan diperiksa lewat Policy. Lihat 4.7
- **Wildcard permission** tidak dipakai. Nama izin ditulis lengkap satu per satu
- **Permission langsung ke user** tidak dipakai. Seluruh izin mengalir lewat peran

---

**2. Data Model**

*2.1 Access Rule*

- Aplikasi melayani satu tim, tidak ada pendaftaran mandiri. Akun hanya bisa dibuat dengan menukarkan undangan yang dikirim ke satu alamat email perusahaan yang unik
- **Aturan di atas ditegakkan di lapisan aplikasi**, yaitu di transaksi registrasi, karena tabel users tidak menyimpan rujukan ke undangan. Lihat 4.9 dan 7.12
- Setiap task wajib berada di dalam satu project. Task tanpa project bukan keadaan yang sah
- Akses ke sebuah project ditentukan oleh keanggotaan, bukan oleh peran global. Bukan anggota berarti tidak punya akses, kecuali Admin

*2.2 Entity*

Empat entitas lama, empat entitas baru, dan lima tabel bawaan package.

Milik aplikasi :

1. **invitations**
2. **users**
3. **projects**
4. **project_members**
5. **tasks**
6. **comments**
7. **activities**
8. **priorities**

Bawaan package spatie/laravel-permission, dibuat oleh migration package dan tidak diubah manual :

9. **roles**
10. **permissions**
11. **role_has_permissions**
12. **model_has_roles**
13. **model_has_permissions**

A. **invitations**

- **id** : BIGSERIAL, PK
- **email** : VARCHAR(255), NOT NULL, UNIQUE. Disimpan secara lowercase, satu baris per alamat
- **token** : VARCHAR(64), NOT NULL, UNIQUE. Rahasia pada link undangan yaitu ≥32 byte dari CSPRNG
- **invited_by_id** : BIGINT, FK → users.id, NULL. Selalu diisi dari user yang sedang login. Menjadi NULL hanya bila akun pengundang dihapus
- **role_id** : BIGINT, FK → roles.id, NOT NULL. Peran global yang akan diberikan saat undangan ditukarkan
- **status** : VARCHAR(16), NOT NULL DEFAULT 'pending', nilai yang diizinkan: pending, accepted, revoked, ditegakkan dengan CHECK
- **expires_at** : TIMESTAMPTZ, NOT NULL
- **accepted_at** : TIMESTAMPTZ, NULL. Jejak audit kapan token ditukarkan
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

Kolom `role_id` baru pada revisi ini. Peran ditentukan saat mengundang, bukan setelah akun jadi, supaya tidak ada jeda ketika akun sudah hidup tetapi belum berperan.

B. **users**

- **id** : BIGSERIAL, PK
- **name** : VARCHAR(100), NOT NULL
- **email** : VARCHAR(255), NOT NULL, UNIQUE. Disalin dari invitations.email saat registrasi, lowercase
- **password_hash** : VARCHAR(255), NOT NULL
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()
- **updated_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

Tidak ada kolom peran di tabel ini. Peran global disimpan pada `model_has_roles`, karena package menyimpan relasi peran secara polimorfik, bukan sebagai foreign key pada tabel user.

Tidak ada pula kolom rujukan ke undangan. Sampai Revisi 4, kolom `invitation_id` NOT NULL UNIQUE menjadi gerbang di tingkat basis data. Pada Revisi 5 kolom itu dihapus. Undangan asal sebuah akun ditelusuri lewat kesamaan email, karena invitations.email dan users.email sama-sama UNIQUE dan sama-sama lowercase. Konsekuensinya dicatat di 7.12.

C. **projects**

- **id** : BIGSERIAL, PK
- **name** : VARCHAR(200), NOT NULL
- **description** : TEXT, NULL. Teks biasa
- **created_by_id** : BIGINT, FK → users.id, NOT NULL. Pembuat project
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()
- **updated_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

D. **project_members**

- **id** : BIGSERIAL, PK
- **project_id** : BIGINT, FK → projects.id, NOT NULL
- **user_id** : BIGINT, FK → users.id, NOT NULL
- **role_id** : BIGINT, FK → roles.id, NOT NULL. Peran user di dalam project ini, boleh berbeda dari peran globalnya
- **joined_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()
- UNIQUE (project_id, user_id). Satu user hanya punya satu baris keanggotaan per project

Tabel inilah yang menjawab pertanyaan di project mana. Kolom `role_id` menunjuk ke tabel peran yang sama dengan peran global, sehingga daftar peran hanya ada satu dan daftar izinnya juga satu.

E. **tasks**

- **id** : BIGSERIAL, PK
- **project_id** : BIGINT, FK → projects.id, NOT NULL. Task wajib punya induk
- **title** : VARCHAR(200), NOT NULL
- **description** : TEXT, NULL. Teks biasa
- **status** : VARCHAR(16), NOT NULL DEFAULT 'todo', nilai yang diizinkan: todo, in_progress, done
- **priority_id** : SMALLINT, FK → priorities.id, NOT NULL. Bawaan medium, ditetapkan di sisi aplikasi
- **due_date** : DATE, NULL. Tanggal kalender, bukan instan waktu
- **assignee_id** : BIGINT, FK → users.id, NULL. Task tanpa assignee adalah state yang sah
- **created_by_id** : BIGINT, FK → users.id, NOT NULL. Terpisah dari assignee
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now(). Kunci sort default list view
- **updated_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

Aturan bahwa assignee wajib anggota project ditegakkan di Form Request, bukan di basis data. Menegakkannya di basis data memerlukan foreign key gabungan ke `project_members`, yang berarti menduplikasi `project_id` di dalamnya dan menambah rumit tanpa manfaat sepadan pada MVP.

F. **comments**

- **id** : BIGSERIAL, PK
- **task_id** : BIGINT, FK → tasks.id, NOT NULL
- **author_id** : BIGINT, FK → users.id, NOT NULL
- **body** : TEXT, NOT NULL
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()
- **updated_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

G. **activities**

- **id** : BIGSERIAL, PK
- **project_id** : BIGINT, FK → projects.id, NOT NULL. Setiap aktivitas selalu berada di bawah satu project
- **task_id** : BIGINT, FK → tasks.id, NULL. Diisi bila aktivitas menyangkut satu task tertentu
- **user_id** : BIGINT, FK → users.id, NOT NULL. Pelaku
- **action** : VARCHAR(50), NOT NULL. Nilai yang dipakai: project.created, project.updated, project.member_added, project.member_removed, task.created, task.updated, task.status_changed, task.priority_changed, task.assigned, task.deleted, comment.created
- **description** : TEXT, NULL. Kalimat siap tampil, contoh: mengubah status dari todo ke in_progress
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

Tidak ada kolom `updated_at`. Catatan audit tidak pernah diubah, dan ketiadaan kolomnya membuat sifat itu terbaca langsung dari skema.

Pada rancangan awal, `project_id` dibuat nullable. Kolom ini dijadikan NOT NULL karena setiap task sudah pasti berada di bawah satu project, sehingga aktivitas task pun selalu punya project. Keuntungannya, feed project cukup satu query yaitu seluruh baris dengan `project_id` tersebut, tanpa perlu menggabungkan lewat tabel task.

H. **priorities**

- **id** : SMALLSERIAL, PK
- **name** : VARCHAR(20), NOT NULL, UNIQUE. Nilai awal: low, medium, high
- **level** : SMALLINT, NOT NULL, UNIQUE. Urutan tingkat: low 1, medium 2, high 3. Kolom inilah yang dipakai untuk sort
- **created_at** : TIMESTAMPTZ, NOT NULL DEFAULT now()

Dibuat sebagai tabel master, bukan VARCHAR dengan CHECK seperti status. Alasannya dua. Pertama, konsisten dengan arahan mentor bahwa data berjenis master dirujuk lewat id. Kedua, VARCHAR yang diurutkan mengikuti abjad sehingga menghasilkan high, low, medium, sedangkan kolom level memberi urutan yang benar. Menambah tingkat baru seperti urgent cukup satu baris, tanpa migration.

Nilai bawaan medium tidak dipasang sebagai DEFAULT di basis data, karena DEFAULT pada foreign key bergantung pada id hasil seeder yang bisa berbeda antar-lingkungan. Nilai bawaan ditetapkan di Form Request dengan mencari baris bernama medium.

I. **Tabel bawaan package**

- **roles** : id BIGSERIAL PK, name VARCHAR(255), guard_name VARCHAR(255), created_at dan updated_at TIMESTAMP. UNIQUE (name, guard_name)
- **permissions** : id BIGSERIAL PK, name VARCHAR(255), guard_name VARCHAR(255), created_at dan updated_at TIMESTAMP. UNIQUE (name, guard_name)
- **role_has_permissions** : permission_id, role_id. PK gabungan
- **model_has_roles** : role_id, model_type, model_id. PK gabungan, index (model_id, model_type). Inilah tempat peran global user disimpan
- **model_has_permissions** : permission_id, model_type, model_id. PK gabungan, index (model_id, model_type). Dibuat package, tidak dipakai pada MVP

Struktur kelima tabel ini mengikuti migration bawaan package tanpa diedit. Keputusan ini diambil karena mengedit migration package menambah pekerjaan setiap kali package diperbarui, sedangkan perbedaan panjang VARCHAR dan zona waktu pada tabel master peran tidak berdampak pada MVP.

Isi `roles` : admin, manager, staff. Isi `permissions` : lihat 4.6. Keduanya diisi lewat seeder, bukan lewat input pengguna.

*2.3 Relasi*

- **R1** : dihapus pada Revisi 5 bersama kolom users.invitation_id. Nomor relasi lain tidak digeser supaya rujukan lama tetap berlaku
- **R2** : users → invitations, kardinalitas 1:N, FK invitations.invited_by_id, opsional, ON DELETE SET NULL. Menghapus pengundang tidak boleh menghapus riwayat undangan
- **R3** : roles → invitations, kardinalitas 1:N, FK invitations.role_id, tidak opsional, ON DELETE RESTRICT. Peran yang masih dirujuk undangan tidak boleh dihapus
- **R4** : users → projects, kardinalitas 1:N, FK projects.created_by_id, tidak opsional, ON DELETE RESTRICT. Memblokir penghapusan user yang masih tercatat sebagai pembuat project
- **R5** : projects → project_members, kardinalitas 1:N, FK project_members.project_id, tidak opsional, ON DELETE CASCADE. Keanggotaan tidak punya arti tanpa project-nya
- **R6** : users → project_members, kardinalitas 1:N, FK project_members.user_id, tidak opsional, ON DELETE CASCADE. Menghapus user berarti mencabut keanggotaannya
- **R7** : roles → project_members, kardinalitas 1:N, FK project_members.role_id, tidak opsional, ON DELETE RESTRICT. Peran yang masih dipakai tidak boleh dihapus
- **R8** : projects → tasks, kardinalitas 1:N, FK tasks.project_id, tidak opsional, ON DELETE RESTRICT. Project yang masih berisi task tidak bisa dihapus, sehingga pekerjaan tidak lenyap berantai tanpa peringatan. Lihat 7.4
- **R9** : users → tasks, kardinalitas 1:N, FK tasks.assignee_id, opsional, ON DELETE SET NULL. Menghapus user tidak boleh menghapus pekerjaannya
- **R10** : users → tasks, kardinalitas 1:N, FK tasks.created_by_id, tidak opsional, ON DELETE RESTRICT
- **R11** : tasks → comments, kardinalitas 1:N, FK comments.task_id, tidak opsional, ON DELETE CASCADE
- **R12** : users → comments, kardinalitas 1:N, FK comments.author_id, tidak opsional, ON DELETE RESTRICT. Menjaga riwayat komentar tetap bisa ditelusuri
- **R13** : projects → activities, kardinalitas 1:N, FK activities.project_id, tidak opsional, ON DELETE CASCADE
- **R14** : tasks → activities, kardinalitas 1:N, FK activities.task_id, opsional, ON DELETE SET NULL. Catatan bahwa sebuah task pernah dihapus harus tetap ada setelah task-nya hilang, sehingga relasinya dikosongkan, bukan barisnya dihapus
- **R15** : users → activities, kardinalitas 1:N, FK activities.user_id, tidak opsional, ON DELETE RESTRICT. Audit trail tanpa pelaku tidak ada gunanya
- **R16** : roles → model_has_roles → users, kardinalitas N:N, dikelola package. Menyimpan peran global setiap user
- **R17** : roles → role_has_permissions → permissions, kardinalitas N:N, dikelola package. Inilah tabel izin yang diminta mentor
- **R18** : priorities → tasks, kardinalitas 1:N, FK tasks.priority_id, tidak opsional, ON DELETE RESTRICT. Tingkat prioritas yang masih dipakai task tidak boleh dihapus

*2.4 Index*

- **invitations** : UNIQUE (email). Satu catatan undangan per alamat
- **invitations** : UNIQUE (token). Jalur lookup halaman registrasi
- **invitations** : (status, expires_at). Daftar undangan aktif dan cleanup
- **users** : UNIQUE (email). Lookup login
- **projects** : (created_by_id)
- **project_members** : UNIQUE (project_id, user_id). Menegakkan satu keanggotaan per user per project
- **project_members** : (user_id). Menjawab project apa saja milik user ini, dijalankan pada hampir setiap halaman
- **tasks** : (project_id, status). Daftar task satu project dengan filter status, dua kebutuhan yang selalu muncul bersamaan
- **tasks** : (assignee_id), (due_date), (priority_id). Filter dan sort pada list view
- **comments** : (task_id, created_at). Memuat komentar satu task terurut
- **priorities** : UNIQUE (name), UNIQUE (level). Satu nama dan satu urutan per tingkat
- **activities** : (project_id, created_at). Feed project, terbaru di atas
- **activities** : (task_id, created_at). Feed task, terbaru di atas

Kolom foreign key tidak otomatis ter-index di PostgreSQL sehingga harus dideklarasikan sendiri.

---

**3. API Sketch**

*3.1 Invitations*

- **POST /invitations** : mengundang email perusahaan beserta peran globalnya. Izin invitation.create
- **GET /invitations** : daftar undangan, bisa difilter ?status=. Izin invitation.view
- **GET /invitations/:token** : memvalidasi token sebelum form registrasi ditampilkan. Tidak perlu login
- **DELETE /invitations/:id** : mencabut undangan yang masih pending. Izin invitation.revoke

*3.2 Auth*

- **POST /auth/register** : menukar token menjadi baris users baru sekaligus menetapkan peran globalnya. Tidak perlu login
- **POST /auth/login** : email + password menjadi session. Tidak perlu login
- **POST /auth/logout** : mengakhiri session. Perlu login
- **GET /auth/me** : mengembalikan data user yang sedang login beserta peran globalnya. Perlu login

Body register: { token, name, password } tanpa field email dan tanpa field peran. Keduanya disalin dari baris undangan di dalam transaksi.

*3.3 Users*

- **GET /users** : daftar anggota tim, hanya id, name, email, peran global. Perlu login

Dipakai untuk memilih calon anggota project. Tidak ada POST /users karena akun lahir lewat register, dan tidak ada DELETE /users/:id karena aturan RESTRICT pada R10 dan R12.

*3.4 Projects*

- **GET /projects** : daftar project. Hanya berisi project tempat pemanggil terdaftar, kecuali Admin yang menerima seluruhnya
- **POST /projects** : membuat project. Dinilai dari peran global, izin project.create. Pembuat otomatis dicatat sebagai anggota berperan manager dalam transaksi yang sama
- **GET /projects/:id** : detail project. Izin project.view pada project tersebut
- **PATCH /projects/:id** : mengubah name dan description. Izin project.update pada project tersebut
- **DELETE /projects/:id** : menghapus project. Izin project.delete pada project tersebut. Gagal bila masih ada task, sesuai R8

*3.5 Project Members*

- **GET /projects/:id/members** : daftar anggota beserta perannya di project ini. Izin project.view
- **POST /projects/:id/members** : menambah anggota, body { user_id, role_id }. Izin project.member.manage
- **PATCH /projects/:id/members/:userId** : mengubah peran anggota di project ini. Izin project.member.manage
- **DELETE /projects/:id/members/:userId** : mengeluarkan anggota. Izin project.member.manage

*3.6 Tasks*

- **GET /projects/:id/tasks** : daftar task satu project, query param ?q=, ?status=, ?priority_id=, ?assignee_id=, ?sort=priority|due_date|created_at, ?order=asc|desc. Izin task.view
- **POST /projects/:id/tasks** : membuat task di project ini. Izin task.create
- **GET /tasks/:id** : detail task. Izin task.view pada project induknya
- **PATCH /tasks/:id** : mengubah title, description, status, priority_id, due_date, assignee_id. Izin task.update
- **DELETE /tasks/:id** : menghapus task, komentarnya ikut terhapus sesuai R11. Izin task.delete

Sort priority dilakukan dengan join ke priorities dan mengurutkan berdasarkan level, bukan berdasarkan priority_id, karena id hasil seeder tidak menjamin urutan tingkat.

**Search by title** (P2) memakai ?q= dan berlaku di dalam satu project saja. Pencocokan dilakukan dengan `ILIKE '%…%'` pada kolom title sehingga tidak membedakan huruf besar dan kecil. Karakter `%` dan `_` dari input di-escape agar dibaca sebagai teks biasa, bukan wildcard. Nilai ?q= dipangkas spasinya, maksimal 100 karakter, dan bila kosong diabaikan. Pencarian bisa digabung dengan filter dan sort lain. Tidak ada index baru untuk kolom title, sehingga ERD tidak berubah. Lihat 7.13.

Task selalu dibuat lewat jalur project agar induknya tidak mungkin kosong. Setelah task ada, id-nya sudah unik secara global sehingga endpoint detail tidak perlu lagi menyebut project.

*3.7 Comments*

- **GET /tasks/:id/comments** : daftar komentar, terlama ke terbaru. Izin task.view
- **POST /tasks/:id/comments** : menambah komentar, body { body }. Izin comment.create

Sengaja tidak ada PATCH/DELETE komentar, sesuai scope.

*3.8 Activities*

- **GET /projects/:id/activities** : aktivitas terbaru project ini termasuk aktivitas seluruh task di dalamnya, terbaru di atas. Izin activity.view
- **GET /tasks/:id/activities** : aktivitas terbaru task ini saja. Izin activity.view

Tidak ada POST, PATCH, maupun DELETE. Baris aktivitas hanya lahir sebagai efek samping aksi lain, sehingga tidak ada cara memalsukan maupun menghapus jejak lewat API.

*3.9 Priorities*

- **GET /priorities** : daftar tingkat prioritas terurut berdasarkan level, untuk mengisi pilihan pada form task. Perlu login

Tidak ada POST, PATCH, maupun DELETE. Tingkat prioritas diisi lewat seeder.

*3.10 Konvensi*

- **Validasi** lewat Form Request, error dibalas 422
- **Gagal otorisasi** dibalas 403, bukan 404, termasuk saat user membuka project yang bukan miliknya. Isi project tidak ikut terbawa di balasan
- **Respons** dibentuk lewat API Resource, bukan model mentah
- **Endpoint daftar** dipaginasi, default 25 per halaman. Untuk activity feed default 20

---

**4. Authentication dan Authorization**

*4.1 Keputusan autentikasi*

- **Email + password** menggunakan auth bawaan Laravel: guard web, session berbasis cookie, hashing lewat Hash::make. Bukan magic link, bukan token API

*4.2 Library*

- **Hashing** : Illuminate\Support\Facades\Hash, bawaan framework, bisa diganti argon2id tanpa mengubah kode
- **Login/session** : guard web bawaan, Auth::attempt(), middleware auth
- **Scaffolding UI (opsional)** : Laravel Breeze, Blade + Tailwind + Alpine
- **Otorisasi** : spatie/laravel-permission v8, dipadukan dengan Gate dan Policy bawaan
- **CSRF, enkripsi cookie, rate limit login** : bawaan framework

Sanctum tidak dipakai karena tidak ada klien lintas-origin atau mobile.

*4.3 Alasan*

- Framework sudah menyediakan hashing, session, CSRF, dan rate limiting sejak instalasi
- users.password_hash sudah dikunci di ER diagram, magic-link berarti membongkar kolom itu
- Alur undangan sudah bergantung pada email, login sebaiknya tidak ikut bergantung padanya juga
- Peran dan izin adalah data, bukan kode. Menambah peran baru cukup menambah baris, tanpa menyentuh logika otorisasi

*4.4 Keputusan turunan*

- **Session driver cookie**. Driver file hilang tiap redeploy karena filesystem Render ephemeral, sedangkan driver database membutuhkan tabel sessions yang tidak termasuk ERD
- **Kolom password_hash**, bukan password. Pada model User: override `getAuthPassword()` dan `getAuthPasswordName()` agar mengembalikan password_hash, masukkan ke `$hidden`, dan cast hashed
- **Migration bawaan Laravel** yang tidak ada di ERD dihapus atau ditulis ulang: kolom email_verified_at dan remember_token, tabel password_reset_tokens, sessions, cache, cache_locks, jobs, job_batches, failed_jobs. Akibatnya tidak ada fitur remember me
- **Rute registrasi bawaan Breeze** wajib dimatikan dan diganti versi yang menuntut token undangan valid
- **Model User** memakai trait HasRoles dari package
- **guard_name** seluruh peran dan izin diisi 'web', konsisten dengan guard yang dipakai

*4.5 Dua lapis otorisasi*

Setiap pemeriksaan melewati dua pertanyaan berbeda.

- **Lapis 1**, boleh aksi apa. Dijawab tabel role_has_permissions
- **Lapis 2**, di project mana. Dijawab tabel project_members

Pembagian kewenangannya:

- Aksi yang tidak terikat project, yaitu project.create dan seluruh aksi undangan, dinilai dari peran global user. Pemeriksaannya `$user->can('project.create')`
- Seluruh aksi di dalam sebuah project dinilai dari peran user di project itu, bukan dari peran globalnya. Peran diambil dari `project_members.role_id`, lalu izinnya diperiksa langsung pada model Role. Bentuknya `$projectRole?->hasPermissionTo('task.delete')`
- User yang tidak punya baris keanggotaan pada sebuah project tidak memiliki peran di sana, sehingga seluruh pemeriksaan bernilai salah

Alasan project.create dinilai dari peran global: saat sebuah project belum ada, calon pembuatnya belum menjadi anggota project mana pun, sehingga wewenang itu tidak mungkin bersumber dari keanggotaan.

Konsekuensi yang disengaja: seorang user berperan global staff dapat ditunjuk sebagai manager pada satu project dan memegang wewenang penuh di sana, sambil tetap tidak dapat membuat project baru.

*4.6 Daftar izin*

Disimpan sebagai baris pada tabel permissions, diisi lewat seeder.

- project.view, project.create, project.update, project.delete
- project.member.manage
- task.view, task.create, task.update, task.delete
- comment.create
- activity.view
- invitation.view, invitation.create, invitation.revoke

Pemetaan ke peran pada tabel role_has_permissions:

- **admin** : seluruh izin di atas
- **manager** : project.view, project.create, project.update, project.delete, project.member.manage, task.view, task.create, task.update, task.delete, comment.create, activity.view
- **staff** : project.view, task.view, task.create, task.update, comment.create, activity.view

Perhatikan bahwa satu baris peran dipakai untuk dua keperluan sekaligus. Saat dibaca sebagai peran global, hanya izin project.create dan izin undangan yang berlaku. Saat dibaca sebagai peran di dalam project, hanya izin selain keduanya yang berlaku. Pemisahan ini ditegakkan oleh Policy, bukan oleh dua kumpulan peran terpisah.

*4.7 Penegakan di dalam kode*

- **Admin dilewatkan** lebih dulu lewat `Gate::before`, sehingga tidak perlu didaftarkan sebagai anggota project mana pun
- Setiap pemeriksaan di dalam project ditulis sebagai Policy, yaitu ProjectPolicy, TaskPolicy, dan CommentPolicy, lalu dipanggil dengan `$this->authorize()` di controller
- **Model User** menyediakan satu metode pembantu yang mengembalikan Role user pada sebuah project, atau null bila bukan anggota. Seluruh Policy memanggil metode yang sama, sehingga aturan keanggotaan hanya ditulis di satu tempat
- Daftar project dan daftar task disaring lewat query scope berbasis keanggotaan, bukan disaring setelah diambil. Menyaring setelah pengambilan membuat paginasi salah hitung
- Menyembunyikan tombol di Blade bukan penegakan izin, hanya pelengkap tampilan

*4.8 Cache izin*

- **Package menyimpan cache izin** secara agresif. Setiap perubahan peran atau izin lewat query langsung, bukan lewat metode package, wajib diikuti pembersihan cache
- Seeder wajib memanggil `forgetCachedPermissions()` di awal, karena tanpa itu proses seeding bisa gagal tanpa pesan kesalahan

*4.9 Alur Registrasi*

1. **Admin** mengundang email perusahaan beserta peran globalnya, baris invitations dibuat dengan token dan expires_at baru. Pembuatan ditolak bila email sudah terdaftar di users
2. **Undangan** membuka /register?token=… , aplikasi memvalidasi token, status, dan kedaluwarsa
3. **Undangan** mengirim nama + password. Dalam satu transaksi: baca baris undangan berdasarkan token dengan `lockForUpdate()` (SELECT … FOR UPDATE), periksa ulang status pending dan expires_at, insert users dengan email dari undangan bukan dari form, tetapkan peran global sesuai invitations.role_id lewat `assignRole()`, lalu set status accepted dan accepted_at
4. Penguncian baris pada langkah 3 mencegah dua penukaran bersamaan atas token yang sama. Pertahanan terakhirnya adalah UNIQUE pada users.email: undangan kedua untuk alamat yang sama tetap tidak bisa menghasilkan akun kedua
5. Registrasi adalah satu-satunya jalur di aplikasi yang membuat baris users. Rute registrasi bawaan starter kit dimatikan, dan tidak ada endpoint POST /users

*4.10 Bootstrapping akun pertama*

- **Seeder membuat akun Admin pertama** secara langsung, lalu menetapkan peran admin lewat `assignRole('admin')`. Email dan password awal diambil dari environment variable, bukan ditulis di kode
- Karena users tidak lagi mewajibkan undangan, baris undangan bootstrap tidak diperlukan lagi. Akun ini adalah satu-satunya akun yang tidak lahir dari undangan
- **Seeder bersifat idempoten**: bila email Admin sudah ada, seeder tidak membuat akun kedua

---

**5. Pencatatan Activity**

*5.1 Kapan baris ditulis*

- **Satu aksi menghasilkan tepat satu baris**. Aksi yang dicatat adalah sebelas nilai action pada entitas G
- Penulisan terjadi di dalam transaksi yang sama dengan aksinya. Bila aksi gagal, catatannya ikut batal, sehingga tidak ada jejak untuk peristiwa yang tidak pernah terjadi

*5.2 Di mana kodenya diletakkan*

- **Satu service kecil** yang dipanggil dari controller setelah aksi berhasil. Bukan model event, karena sebagian aksi seperti penambahan anggota menyentuh lebih dari satu model dan tetap harus menghasilkan satu baris saja
- **Pelaku** diambil dari user yang sedang login, tidak pernah dari isian permintaan

*5.3 Cara membaca*

- **Feed project** : seluruh baris dengan project_id tersebut, diurutkan created_at menurun. Sudah termasuk aktivitas task karena setiap aktivitas task juga menyimpan project_id-nya
- **Feed task** : baris dengan task_id tersebut, diurutkan created_at menurun

*5.4 Sifat hanya-tambah*

- **Tidak ada endpoint** yang mengubah atau menghapus baris aktivitas
- **Tidak ada kolom updated_at**
- Menghapus task mengosongkan task_id pada baris aktivitasnya, tetapi barisnya tetap ada sesuai R14

---

**6. Deployment Plan**

*6.1 Keputusan*

- **Render**, web service berbasis Docker. PHP tidak termasuk runtime yang dideteksi otomatis sehingga aplikasi harus di-containerize. Free tier: 512 MB RAM, mati setelah 15 menit idle, 750 instance-hour per bulan. Postgres 1 GB, kedaluwarsa 30 hari, tenggang 14 hari, tanpa backup
- **Railway tidak dipilih**. Tidak ada free tier berkelanjutan, hanya kredit percobaan sekali pakai
- **Vercel tidak dipilih**. Berorientasi serverless dan frontend, tidak punya runtime PHP resmi, dan sudah tidak mengoperasikan produk database sendiri

*6.2 Langkah Deployment*

1. Dockerfile berbasis image nginx + php-fpm dengan PHP ≥ 8.3
2. .dockerignore mengecualikan .env, vendor, node_modules, storage/*.key
3. Paksa HTTPS di AppServiceProvider saat APP_ENV=production
4. Buat PostgreSQL di Render, salin Internal Database URL
5. Buat Web Service dengan environment Docker, isi env: DATABASE_URL, DB_CONNECTION=pgsql, APP_KEY, APP_ENV=production, APP_DEBUG=false, LOG_CHANNEL=stderr, SESSION_DRIVER=cookie, CACHE_STORE=file
6. Pre-Deploy Command: php artisan migrate --force
7. Deploy script menjalankan composer install --no-dev, php artisan config:cache, php artisan route:cache

*6.3 Konsekuensi Filesystem Ephemeral*

- **Session** : SESSION_DRIVER=cookie. Bukan file karena ephemeral, bukan database karena tabel sessions tidak ada di ERD
- **Log** : LOG_CHANNEL=stderr
- **Cache** : CACHE_STORE=file. Isinya boleh hilang saat redeploy karena hanya cache, termasuk cache izin milik package yang akan dibangun ulang otomatis
- **Queue** : QUEUE_CONNECTION=sync untuk MVP

*6.4 Urutan migration dan seeder*

Migration :

1. Tabel bawaan spatie : roles, permissions, role_has_permissions, model_has_roles, model_has_permissions
2. **users**
3. **invitations**, karena menunjuk ke users.id dan roles.id
4. **priorities**
5. **projects**, project_members, tasks, comments, activities

Tidak ada lagi FK melingkar antara invitations dan users, sehingga tidak perlu migration susulan untuk menambah FK.

Seeder :

- **Seeder peran dan izin** berjalan pertama, karena Admin pertama dan setiap undangan menunjuk ke roles
- **Seeder prioritas** wajib berjalan sebelum task pertama dibuat, karena tasks.priority_id tidak boleh kosong
- **Seeder Admin pertama** berjalan setelah seeder peran. Lihat 4.10
- **Seeder ini bersifat idempoten** dan ikut dijalankan pada setiap deploy, sehingga penambahan izin baru di masa depan otomatis tersebar ke production

*6.5 Rencana Tahapan*

- **Selama pengembangan**: web service gratis + Postgres gratis
- **Sebelum live di tasktracker.rekayasa.io**: pindahkan database ke tier berbayar Render agar tidak kedaluwarsa

---

**7. Risks dan Open Questions**

*7.1 Reset password belum masuk scope* Auth berbasis password memunculkan kebutuhan lupa password. Butuh tabel password_reset_tokens dan kompatibilitas dengan penamaan password_hash.

*7.2 Domain email perusahaan* Perlu dipastikan domain yang divalidasi, dan disepakati bahwa daftarnya disimpan di config aplikasi, bukan sebagai CHECK constraint yang menuntut migration setiap kali domain bertambah.

*7.3 Penyedia email transaksional* Tanpa ini alur undangan tidak dapat diimplementasikan, sehingga menjadi penghambat pertama saat coding dimulai.

*7.4 Penghapusan project yang masih berisi task* Saat ini diblokir lewat RESTRICT pada R8. Alternatifnya menghapus berantai seluruh task dan komentarnya. Perlu keputusan Aril karena ini menyangkut kehilangan data.

*7.5 Umur catatan aktivitas* Saat ini catatan ikut terhapus bila project-nya dihapus, sesuai R13. Bila audit trail harus bertahan melewati penghapusan project, kolom project_id perlu dijadikan nullable dengan SET NULL, dengan konsekuensi feed kehilangan induknya.

*7.6 Kedalaman isi catatan aktivitas* Kolom description menyimpan kalimat jadi. Bila dibutuhkan nilai sebelum dan sesudah yang dapat dikueri, perlu satu kolom bertipe JSONB. Belum dimasukkan karena belum diminta.

*7.7 Jumlah Admin dan penurunan peran* Belum ditentukan apakah Admin boleh lebih dari satu dan apakah Admin boleh menurunkan peran Admin lain. Tanpa aturan, ada kemungkinan aplikasi kehilangan seluruh Admin-nya.

*7.8 Menonaktifkan anggota* Belum ada mekanisme menonaktifkan akun, sementara menghapus user terhalang RESTRICT pada R10, R12, dan R15. Praktis berarti anggota yang keluar hanya bisa dicabut keanggotaannya dari seluruh project.

*7.9 Status revoked pada undangan* Endpoint DELETE /invitations/:id kini menghasilkan status ini, sehingga pertanyaan terbuka dari revisi sebelumnya tertutup. Perlu dikonfirmasi bahwa undangan yang sudah accepted tidak dapat dicabut.

*7.10 Peran global bawaan saat mengundang* Perlu dipastikan apakah Admin memilih peran saat mengundang, seperti yang diasumsikan dokumen ini lewat invitations.role_id, atau seluruh undangan menghasilkan staff dan peran dinaikkan belakangan.

*7.11 Wewenang mengubah prioritas* Prioritas saat ini ikut izin task.update sehingga Staff boleh mengubahnya. Bila Aril menginginkan hanya Manager, dibutuhkan izin terpisah task.priority.update.

*7.12 Gerbang undangan di lapisan aplikasi* Sejak users.invitation_id dihapus, basis data tidak lagi menjamin bahwa setiap akun berasal dari undangan. Seed script, perintah tinker, atau INSERT manual dapat membuat akun tanpa undangan. Mitigasinya: registrasi menjadi satu-satunya jalur pembuat akun, tidak ada endpoint POST /users, rute registrasi starter kit dimatikan, dan feature test memastikan registrasi tanpa token yang sah selalu gagal. Penelusuran undangan asal bergantung pada email, sehingga bila kelak ada fitur ganti email, hubungan itu terputus. MVP tidak memiliki fitur ganti email.


*7.13 Performa search by title* Pencarian ILIKE dengan wildcard di depan tidak dapat memakai index B-tree biasa, sehingga PostgreSQL memindai task. Dampaknya kecil pada MVP karena query selalu dibatasi satu project lewat index (project_id, status). Bila jumlah task per project kelak besar, dibutuhkan ekstensi pg_trgm beserta index GIN pada tasks.title, yang berarti perubahan ERD.

---

**8. Lampiran: ER Diagram (DBML Revisi 5)**

```dbml
// ============================================================
// Mini Task Tracker - ER Diagram (Revisi 5)
// Paste ke https://dbdiagram.io
// ============================================================

// ---------- MILIK APLIKASI ----------

Table invitations {
  id            bigserial    [primary key]
  email         varchar(255) [not null, unique, note: 'email perusahaan, lowercase']
  token         varchar(64)  [not null, unique, note: 'rahasia CSPRNG pada link undangan']
  invited_by_id bigint       [null, note: 'pengundang. Menjadi NULL bila akun pengundang dihapus (SET NULL)']
  role_id       bigint       [not null, note: 'peran global yang diberikan saat token ditukarkan']
  status        varchar(16)  [not null, default: 'pending', note: 'pending | accepted | revoked']
  expires_at    timestamptz  [not null]
  accepted_at   timestamptz  [null]
  created_at    timestamptz  [not null, default: `now()`]

  indexes {
    (status, expires_at)
  }
}

Table users {
  id            bigserial    [primary key]
  name          varchar(100) [not null]
  email         varchar(255) [not null, unique, note: 'disalin dari invitations.email saat registrasi, lowercase']
  password_hash varchar(255) [not null]
  created_at    timestamptz  [not null, default: `now()`]
  updated_at    timestamptz  [not null, default: `now()`]

  Note: 'Tidak ada kolom peran dan tidak ada rujukan ke undangan. Peran global di model_has_roles. Undangan asal ditelusuri lewat email.'
}

Table projects {
  id            bigserial    [primary key]
  name          varchar(200) [not null]
  description   text         [null]
  created_by_id bigint       [not null]
  created_at    timestamptz  [not null, default: `now()`]
  updated_at    timestamptz  [not null, default: `now()`]

  indexes {
    created_by_id
  }
}

Table project_members {
  id         bigserial   [primary key]
  project_id bigint      [not null]
  user_id    bigint      [not null]
  role_id    bigint      [not null, note: 'peran di dalam project ini, boleh beda dari peran global']
  joined_at  timestamptz [not null, default: `now()`]

  indexes {
    (project_id, user_id) [unique]
    user_id
  }

  Note: 'Lapis 2 otorisasi: menjawab "di project mana".'
}

Table tasks {
  id            bigserial    [primary key]
  project_id    bigint       [not null, note: 'task wajib punya induk project']
  title         varchar(200) [not null]
  description   text         [null]
  status        varchar(16)  [not null, default: 'todo', note: 'todo | in_progress | done']
  priority_id   smallint     [not null, note: 'bawaan medium, ditetapkan di Form Request']
  due_date      date         [null]
  assignee_id   bigint       [null, note: 'wajib anggota project, divalidasi di Form Request']
  created_by_id bigint       [not null]
  created_at    timestamptz  [not null, default: `now()`]
  updated_at    timestamptz  [not null, default: `now()`]

  indexes {
    (project_id, status)
    assignee_id
    due_date
    priority_id
  }
}

Table comments {
  id         bigserial   [primary key]
  task_id    bigint      [not null]
  author_id  bigint      [not null]
  body       text        [not null]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  indexes {
    (task_id, created_at)
  }
}

Table activities {
  id          bigserial   [primary key]
  project_id  bigint      [not null, note: 'setiap aktivitas selalu di bawah satu project']
  task_id     bigint      [null, note: 'diisi bila aktivitas menyangkut satu task']
  user_id     bigint      [not null, note: 'pelaku']
  action      varchar(50) [not null, note: 'project.created | project.updated | project.member_added | project.member_removed | task.created | task.updated | task.status_changed | task.priority_changed | task.assigned | task.deleted | comment.created']
  description text        [null, note: 'kalimat siap tampil']
  created_at  timestamptz [not null, default: `now()`]

  indexes {
    (project_id, created_at)
    (task_id, created_at)
  }

  Note: 'Hanya-tambah. Tanpa updated_at, tanpa endpoint ubah/hapus.'
}

Table priorities {
  id         smallserial [primary key]
  name       varchar(20) [not null, unique, note: 'low | medium | high']
  level      smallint    [not null, unique, note: 'urutan tingkat: low 1, medium 2, high 3. Dipakai untuk sort']
  created_at timestamptz [not null, default: `now()`]

  Note: 'Tabel master prioritas. Diisi lewat seeder.'
}

// ---------- BAWAAN PACKAGE spatie/laravel-permission ----------
// Dibuat oleh migration package, struktur bawaan dipertahankan. Jangan diubah manual.

Table roles {
  id         bigserial    [primary key]
  name       varchar(255) [not null, note: 'admin | manager | staff']
  guard_name varchar(255) [not null, note: 'web']
  created_at timestamp
  updated_at timestamp

  indexes {
    (name, guard_name) [unique]
  }
}

Table permissions {
  id         bigserial    [primary key]
  name       varchar(255) [not null, note: 'project.view | project.create | project.update | project.delete | project.member.manage | task.view | task.create | task.update | task.delete | comment.create | activity.view | invitation.view | invitation.create | invitation.revoke']
  guard_name varchar(255) [not null, note: 'web']
  created_at timestamp
  updated_at timestamp

  indexes {
    (name, guard_name) [unique]
  }
}

Table role_has_permissions {
  permission_id bigint [not null]
  role_id       bigint [not null]

  indexes {
    (permission_id, role_id) [pk]
  }

  Note: 'Lapis 1 otorisasi: menjawab "boleh aksi apa". Tabel izin yang diminta mentor.'
}

Table model_has_roles {
  role_id    bigint       [not null]
  model_type varchar(255) [not null, note: 'App\\Models\\User']
  model_id   bigint       [not null]

  indexes {
    (role_id, model_id, model_type) [pk]
    (model_id, model_type)
  }

  Note: 'Peran global setiap user disimpan di sini, bukan sebagai kolom di users.'
}

Table model_has_permissions {
  permission_id bigint       [not null]
  model_type    varchar(255) [not null]
  model_id      bigint       [not null]

  indexes {
    (permission_id, model_id, model_type) [pk]
    (model_id, model_type)
  }

  Note: 'Dibuat package. Tidak dipakai pada MVP, semua izin lewat peran.'
}

// ---------- RELASI ----------
// R1  dihapus pada Revisi 5 (users.invitation_id tidak ada lagi)
Ref: invitations.invited_by_id >? users.id                // R2  ON DELETE SET NULL
Ref: invitations.role_id > roles.id                       // R3  ON DELETE RESTRICT
Ref: projects.created_by_id > users.id                    // R4  ON DELETE RESTRICT
Ref: project_members.project_id > projects.id             // R5  ON DELETE CASCADE
Ref: project_members.user_id > users.id                   // R6  ON DELETE CASCADE
Ref: project_members.role_id > roles.id                   // R7  ON DELETE RESTRICT
Ref: tasks.project_id > projects.id                       // R8  ON DELETE RESTRICT
Ref: tasks.assignee_id >? users.id                        // R9  ON DELETE SET NULL
Ref: tasks.created_by_id > users.id                       // R10 ON DELETE RESTRICT
Ref: comments.task_id > tasks.id                          // R11 ON DELETE CASCADE
Ref: comments.author_id > users.id                        // R12 ON DELETE RESTRICT
Ref: activities.project_id > projects.id                  // R13 ON DELETE CASCADE
Ref: activities.task_id >? tasks.id                       // R14 ON DELETE SET NULL
Ref: activities.user_id > users.id                        // R15 ON DELETE RESTRICT
Ref: model_has_roles.role_id > roles.id                   // R16 ON DELETE CASCADE
Ref: model_has_roles.model_id > users.id                  // R16 polimorfik, tanpa FK sebenarnya
Ref: role_has_permissions.role_id > roles.id              // R17 ON DELETE CASCADE
Ref: role_has_permissions.permission_id > permissions.id  // R17 ON DELETE CASCADE
Ref: model_has_permissions.permission_id > permissions.id // ON DELETE CASCADE
Ref: tasks.priority_id > priorities.id                    // R18 ON DELETE RESTRICT
```
