# MVP Scope for Mini Task Tracker

**Muhammad Fauzan Zubaedi**

# In Scope (MVP)

- **Autentikasi (Auth):** Login/Register dasar
- **Task Field:** Title, Assignee, Due Date
- **Komentar:** Kolom komentar untuk setiap task/projects
- **Tampilan:** List view, dengan sort dan filter dasar (by status, by assignee, by due date)
- **Platform:** Web

# Out of Scope 

- **SSO (Single Sign-On):** Menyusun layanan login 
- **Priority, labels/tags, custom fields:** Fitur untuk mengatur tingkat prioritas task/project dan pelabelan
- **Rich Text di komentar, mention user (@user), emoji:** Fitur untuk mention rekan/pengguna lain, fitur lain teks, dan penggunaan emoji
- **Timeline:** Tampilan urutan waktu, menampilkan jangka waktu pengerjaan proyek, deadline, dan hal lain yang terkait (Sepertinya akan menggunakan **Gantt-Chart Diagram**)
- **Email & Push Notification**
- **File Attachment**
- **Dashboard Analytics:** Untuk menampilkan grafik kinerja pengerjaan task/project.

# Timeline

**Minggu 1:** 
- Setup project & workflow
- Setup React + Vite, routing page
- Setup prisma + schema 
- Endpoint auth: Register, login, hash password

**Minggu 2: CRUD**
- Endpoint task: Create, Read, Update, Delete (Title, Status, Assignee, Due Date)
- Middleware Auth untuk melindungi endpoint task
- Frontend: List task, form tambah/edit task, connect API

**Minggu 3: Comments + Polish list view**
- Endpoint comment 
- Frontend: tampilan comment di detail task
- Filter dan sort (by status, by assignee, by due date) di frontend dan query backend

**Minggu 4: Testing & Bug Fixing**
- QA seluruh alur: register, login, buat/edit/hapus task, comment
- Menguji edge case: input kosong, error auth, state loading/kosong
- Susun dan merapihkan pesan error dan UX kasar

**Minggu 5-6: Waktu Cadangan/Buffer**
- Waktu cadangan apabila terjadi molor dalam suatu tahapan


