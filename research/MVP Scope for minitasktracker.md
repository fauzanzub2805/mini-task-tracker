# MVP Scope for Mini Task Tracker

**Muhammad Fauzan Zubaedi**

**Status: REVISI 5** 

# In Scope (MVP)

- **Akses & Autentikasi (Auth):** Registrasi hanya lewat undangan (token) ke email perusahaan, login, logout. Tidak ada pendaftaran mandiri
- **Role (RBAC):** Admin, Manager, Staff. Peran global pada akun dan peran per-project pada keanggotaan project
- **Project:** Buat, ubah, hapus, lihat daftar dan detail. Hanya Manager (dan Admin) yang dapat membuat project
- **Keanggotaan Project:** Tambah anggota, keluarkan anggota, atur perannya di project tersebut. Staff hanya melihat project tempat ia menjadi anggota
- **Task Field:** Title, Description, Status pengerjaan (Todo, In Progress, Done), Prioritas (Low, Medium, High), Assignee, Due Date. Setiap task wajib berada di dalam satu project
- **Komentar:** Kolom komentar teks biasa untuk setiap task
- **Activity (Audit Trail):** Riwayat aktivitas terbaru pada project dan pada task
- **Tampilan:** List view, dengan sort dan filter dasar (by status, by prioritas, by assignee, by due date)
- **Platform:** Web

# Out of Scope

- **Multi-tim / multi-workspace:** Aplikasi melayani tepat satu tim
- **SSO (Single Sign-On):** Menyusun layanan login
- **Reset password dan remember me**
- **Labels/tags, custom fields:** Fitur pelabelan task/project
- **Rich Text di komentar, mention user (@user), emoji:** Fitur untuk mention rekan/pengguna lain, fitur lain teks, dan penggunaan emoji
- **Edit dan hapus komentar**
- **Kanban view, drag and drop, sinkronisasi realtime**
- **Sub-task, milestone, time tracking**
- **Timeline:** Tampilan urutan waktu, menampilkan jangka waktu pengerjaan proyek, deadline, dan hal lain yang terkait (**Gantt-Chart Diagram**)
- **Email & Push Notification:** Email hanya dipakai untuk mengirim tautan undangan
- **File Attachment**
- **Dashboard Analytics:** Untuk menampilkan grafik kinerja pengerjaan task/project

# Perubahan dari Scope Awal

- Stack berganti dari React + Vite + Prisma menjadi **Laravel + PostgreSQL + Blade/Tailwind/Alpine**, RBAC memakai **spatie/laravel-permission**, hosting di **Render**
- **Masuk scope:** undangan, RBAC tiga peran, modul Project dan keanggotaannya, activity (audit trail), prioritas task
- **Prioritas** sebelumnya out of scope, sekarang masuk scope. Labels/tags dan custom fields tetap out of scope
- Komentar sekarang hanya untuk task, bukan untuk project

# Timeline

**Minggu 1: Setup & Fondasi**
- Setup project Laravel Sail + Docker + PostgreSQL & workflow Git
- Migration 13 tabel sesuai ER Diagram Revisi 5
- Seeder peran & izin, prioritas, dan Admin pertama
- **Endpoint auth**: Undangan, register via token, login, logout, hash password

**Minggu 2: Project & RBAC**
- **Endpoint project**: Create, Read, Update, Delete
- Endpoint keanggotaan project dan Policy otorisasi dua lapis
- **Frontend**: daftar project, form project, kelola anggota

**Minggu 3: Task + Comments**
- **Endpoint task**: Create, Read, Update, Delete (Title, Status, Prioritas, Assignee, Due Date)
- Endpoint comment
- **Frontend**: list task, form tambah/edit task, detail task dengan komentar
- Filter dan sort (by status, by prioritas, by assignee, by due date) di frontend dan query backend

**Minggu 4: Activity, Testing & Bug Fixing**
- Pencatatan dan tampilan activity pada project dan task
- **QA seluruh alur**: undangan, register, login, buat project, tambah anggota, buat/edit/hapus task, comment, activity
- **Menguji edge case**: token kedaluwarsa/terpakai, akses ke project bukan miliknya (403), input kosong, state loading/kosong
- Susun dan merapihkan pesan error dan UX kasar

**Minggu 5-6: Deployment & Waktu Cadangan/Buffer**
- Deploy ke Render (Dockerfile, environment, migrasi pre-deploy)
- Waktu cadangan apabila terjadi molor dalam suatu tahapan
