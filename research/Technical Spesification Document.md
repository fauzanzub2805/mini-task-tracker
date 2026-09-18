# Technical Specification Document Fix - Mini Task Tracker

Muhammad Fauzan Zubaedi

**1. Pemilihan Stack**

- Framework Backend : **Laravel**
- Bahasa Pemrograman : **PHP**
- Database : **Postgresql**
- ORM/Query : **Migration bawaan Laravel**
- Frontend : **Blade + Tailwind CSS + Alpine.js** 
- Hosting : **Render**

**2. Data Model**

*2.1 Access Rule & RBAC*
- Aplikasi melayani satu tim secara tertutup. Pendaftaran hanya melalui token undangan.
- Terdapat Role Sistem: **Admin** (Mengelola sistem/undangan) dan **Member** (Pengguna biasa).
- Terdapat Role Aplikasi/Project: **Manager** (Bisa membuat project, menambah staff, membuat/mengelola task) dan **Staff** (Hanya bisa membuat/mengelola task di project tempat ia ditugaskan).

*2.2 Entity*
Diperluas menjadi 7 entitas utama:
1. `invitations`
2. `users`
3. `projects`
4. `project_members`
5. `tasks`
6. `comments`
7. `activities` (Audit Trail)

A. **invitations**
- id: BIGSERIAL, PK
- email: VARCHAR(255), UNIQUE
- token: VARCHAR(64), UNIQUE
- invited_by_id: BIGINT, FK → users.id
- status: VARCHAR(16)
- expires_at: TIMESTAMPTZ
- accepted_at: TIMESTAMPTZ, NULL
- created_at: TIMESTAMPTZ

B. **users**
- id: BIGSERIAL, PK
- invitation_id: BIGINT, FK → invitations.id, UNIQUE
- name: VARCHAR(100)
- email: VARCHAR(255), UNIQUE
- password_hash: VARCHAR(255)
- system_role: VARCHAR(20) (Admin/Member)
- app_role: VARCHAR(20) (Manager/Staff)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

C. **projects**
- id: BIGSERIAL, PK
- name: VARCHAR(200)
- description: TEXT, NULL
- created_by_id: BIGINT, FK → users.id
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

D. **project_members**
- id: BIGSERIAL, PK
- project_id: BIGINT, FK → projects.id
- user_id: BIGINT, FK → users.id
- role: VARCHAR(20) (Manager/Staff)
- joined_at: TIMESTAMPTZ

E. **tasks**
- id: BIGSERIAL, PK
- project_id: BIGINT, FK → projects.id
- title: VARCHAR(200)
- description: TEXT, NULL
- status: VARCHAR(16)
- due_date: DATE, NULL
- assignee_id: BIGINT, FK → users.id, NULL
- created_by_id: BIGINT, FK → users.id
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

F. **comments**
- id: BIGSERIAL, PK
- task_id: BIGINT, FK → tasks.id
- author_id: BIGINT, FK → users.id
- body: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

G. **activities (Audit Trail)**
- id: BIGSERIAL, PK
- project_id: BIGINT, FK → projects.id, NULL
- task_id: BIGINT, FK → tasks.id, NULL
- user_id: BIGINT, FK → users.id
- action: VARCHAR(100)
- description: TEXT, NULL
- created_at: TIMESTAMPTZ

*2.3 Relasi*
- users.invitation_id - invitations.id (1:1)
- invitations.invited_by_id > users.id (N:1)
- projects.created_by_id > users.id (N:1)
- project_members.project_id > projects.id (N:1)
- project_members.user_id > users.id (N:1)
- tasks.project_id > projects.id (N:1) - Task adalah anak dari Project
- tasks.assignee_id > users.id (N:1)
- tasks.created_by_id > users.id (N:1)
- comments.task_id > tasks.id (N:1)
- comments.author_id > users.id (N:1)
- activities.project_id > projects.id (N:1, Opsional)
- activities.task_id > tasks.id (N:1, Opsional)
- activities.user_id > users.id (N:1)

**3. API Sketch (Modifikasi)**

*3.1 Auth & Invitations*
- (Sama seperti dasar, namun validasi Middleware: Hanya `Admin` yang bisa POST/DELETE `/invitations`)

*3.2 Projects*
- `GET /projects`: Daftar project (berdasarkan membership user).
- `POST /projects`: Membuat project (Hanya user dengan `app_role` = Manager).
- `GET /projects/:id`: Detail project dan metrics.
- `POST /projects/:id/members`: Menambah staff (Hanya Manager).

*3.3 Tasks (Scoped by Project)*
- `GET /projects/:id/tasks`: List task dalam project.
- `POST /projects/:id/tasks`: Membuat task (Bisa oleh Staff/Manager dalam project).
- `PATCH /tasks/:id`: Mengubah atribut task.
- `DELETE /tasks/:id`: Menghapus task.

*3.4 Activities (Audit Trail)*
- `GET /projects/:id/activities`: Mengambil riwayat aktivitas tingkat project.
- `GET /tasks/:id/activities`: Mengambil riwayat aktivitas spesifik task.

**4. Authentication & RBAC Middleware**
Menggunakan Laravel Middleware untuk validasi peran:
- `CheckSystemRole`: Memastikan *Admin* atau *Member*.
- `CheckProjectMembership`: Memvalidasi eksistensi user di tabel `project_members` sebelum mengakses resources dari project tersebut.
- *Hooks/Observer*: Digunakan di Laravel (`ProjectObserver`, `TaskObserver`) untuk secara otomatis meng-insert data ke tabel `activities` saat *event* (created, updated, deleted) terpicu.

**5. Deployment Plan**
- Tetap menggunakan Render (sesuai TSD awal).
- Command pre-deploy akan menjalankan migrasi untuk skema yang sudah diperluas ini.

**6. Risks & Open Questions**
- *Polymorphic vs Concrete Relation:* Pada tabel `activities`, pendekatan concrete (kolom `project_id` & `task_id` opsional) dipilih dibanding *Polymorphic M-to-M* agar struktur dan performa join SQL tetap optimal untuk MVP.