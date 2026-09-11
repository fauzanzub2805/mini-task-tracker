# Product Requirements Document

Muhammad Fauzan Zubaedi

**1. Problem Statement**

- Dalam berjalannya suatu perusahaan, diperlukan pengelolaan manajemen delegasi pekerjaan berupa projects atau tasks. Pengelolaannya seperti pembagian PIC tugas, prediksi durasi pengerjaan tugas, dan pengaturan tenggat terakhir tugas. Terdapat kebutuhan yang spesifik seperti tool ringkas yang cukup menyediakan inti fungsional saja, semudah menyusun dan membuat task, assign, atur tenggat, dan lacak status proses pengerjaan task.

**2. Target User**

- Targer pengguna adalah tim dengan skala kecil hingga menengah (2-50 orang) yang membutuhkan pelacakan tugas dan pengelolaan manajemen delegasi pekerjaan yang ringkas. 

**3. Goals & Non-Goals**

- **Goals:** Workspace, autentikasi dasar, task dengan keterangan title, status, assignee, due date, komentar, list view dengan filter & sort, dan dapat berjalan di platform website.
- **Non Goals:** Multi Organization, SSO, rich text/mention user (@), kanban view, notifikasi, file attachment, notifikasi email & push, priority/labels/tags, emoji, dashboard analytics, timeline dengan infografis **Gantt-Chart Diagram**.

**4. User Stories**

- Sebagai user baru, saya bisa mendaftar akun, sehingga saya bisa mengakses tracker dengan aman.
- Sebagai anggota tim, saya bisa membuat task dengan title, due date, dan assignee, sehingga pekerjaan jelas kepemilikannya.
- Sebagai anggota tim, saya bisa mengubah status task, sehingga progres terlihat oleh tim.
- Sebagai anggota tim, saya bisa menambahkan komentar di task, sehingga konteks/update tidak hilang.
- Sebagai anggota tim, saya bisa memfilter task berdasarkan status/assignee, sehingga saya fokus ke pekerjaan relevan.
- Sebagai anggota tim, saya bisa mengurutkan task berdasarkan due date, sehingga saya tahu prioritas.

**5. MVP Feature List**

- **P0 (Must):** Register/login, CRUD task, field title/status/assignee/due date, list view, filter by status. 
- **P1 (Should):** Sort by due date, filter by assignee, komentar.
- **P2 (Nice):** Search by title sederhana.

**6. Later Features**

Kanban view, notifikasi, file attachment, multi-workspace, SSO, rich text.

**7. Success Criteria**

Parameter sukses dinilai dari apabila user berhasil melakukan : register → buat task → assign → komentar → tandai selesai, tanpa error, dalam satu alur utuh. 