# Product Requirements Document Fix

Muhammad Fauzan Zubaedi

**1. Problem Statement**
Dalam berjalannya suatu perusahaan, diperlukan pengelolaan manajemen delegasi pekerjaan berupa projects atau tasks. Pengelolaannya seperti pembagian PIC tugas, prediksi durasi pengerjaan tugas, dan pengaturan tenggat terakhir tugas. Terdapat kebutuhan spesifik terhadap tool ringkas yang menyediakan fungsi inti pengelolaan berbasis *Project* yang membawahi banyak *Task* di dalamnya, lengkap dengan pengaturan Hierarki Peran (Role-Based Access Control) yang ketat dan pencatatan riwayat aktivitas (Audit Trail) demi transparansi tim.

**2. Target User**
Target pengguna adalah tim dengan skala kecil hingga menengah (2-50 orang) yang membutuhkan pelacakan proyek, tugas, dan manajemen delegasi yang ringkas, transparan, dan terstruktur.

**3. Goals & Non-Goals**

- **Goals:** 
  - Hierarki arsitektur berupa Project yang memiliki banyak Task.
  - Autentikasi dan sistem Undangan (Invitation).
  - RBAC tingkat sistem (Admin vs Member) dan tingkat Project (Manager vs Staff).
  - Task dengan keterangan title, status, assignee, due date, dan komentar.
  - Audit Trail (Activity Log) untuk melacak perubahan di tingkat Project maupun Task.
  - List view dengan filter & sort yang berjalan di platform website.
- **Non Goals:** Multi Organization, SSO, rich text/mention user (@), kanban view, file attachment, notifikasi email & push, priority/labels/tags, emoji, dashboard analytics, timeline infografis Gantt-Chart Diagram.

**4. User Stories**

- Sebagai Admin, saya dapat mengundang pengguna baru ke sistem, agar anggota tim perusahaan dapat bergabung secara eksklusif.
- Sebagai Manager, saya dapat membuat Project baru, sehingga tim dapat mulai merencanakan pekerjaan.
- Sebagai Manager, saya dapat menambahkan Staff ke dalam Project, sehingga pembagian tugas menjadi spesifik.
- Sebagai Manager/Staff di dalam project, saya bisa membuat dan mengelola task (title, due date, assignee), sehingga pekerjaan jelas kepemilikannya.
- Sebagai Manager/Staff, saya bisa mengubah status task dan menambahkan komentar, sehingga progres terlihat oleh tim.
- Sebagai Manager/Staff, saya dapat melihat *Activity Log* dari sebuah project dan task, sehingga saya mengetahui siapa yang melakukan perubahan terakhir.
- Sebagai anggota project, saya bisa memfilter task berdasarkan status/assignee dan mengurutkannya, agar saya fokus ke pekerjaan prioritas.

**5. MVP Feature List**

- **P0 (Must):** Register melalui sistem undangan (token), CRUD Project, CRUD Task (berada di dalam project), Role-Based Access Control (Admin/Member & Manager/Staff), Activity Logging (Audit Trail), List view.
- **P1 (Should):** Filter Task by status/assignee, Sort Task by due date, komentar pada Task.
- **P2 (Nice):** Search by title sederhana.

**6. Later Features**
Kanban view, notifikasi in-app, file attachment, multi-workspace, rich text.

**7. Success Criteria**
Parameter sukses dinilai dari apabila user berhasil melakukan alur: Admin mengundang user → User mendaftar → Manager membuat Project → Manager menambahkan Staff → Manager/Staff membuat Task → melakukan interaksi (komentar/status) → Sistem berhasil mencatat aktivitas di menu Audit Trail tanpa error dalam satu urutuan utuh. 