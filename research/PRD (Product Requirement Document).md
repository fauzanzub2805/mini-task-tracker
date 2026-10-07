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

# Product Requirements Document - Mini Task Tracker

Penyusun: Fauzan Zub (intern) · 
Repo: `github.com/fauzanzub2805/mini-task-tracker` · 

Revisi ini memuat modul Project, keanggotaan project, RBAC dua lapis, activity feed (audit trail), tingkat prioritas task, dan penyesuaian hubungan undangan dengan akun. Dokumen ini adalah acuan produk; acuan teknisnya ada di `TSD.md`, skemanya di `ER-Diagram.md`, dan batas MVP-nya di `MVP-Scope.md`.

---

**1. Ringkasan Produk**

*1.1 Masalah*

- Proses magang membutuhkan satu tempat untuk menyimpan, mengatur, dan mengumpulkan tugas dari peserta magang kepada mentor. Saat ini penugasan tersebar di percakapan dan tidak punya jejak.

*1.2 Solusi*

- Aplikasi web satu tim berisi project, task di dalam project, komentar, dan catatan aktivitas. Akses dibatasi undangan dan dibedakan per peran.

*1.3 Pengguna*

- Satu tim, satu perusahaan. Tidak ada pendaftaran mandiri. Akun hanya lahir dari undangan yang dikirim ke satu alamat email perusahaan yang unik.

---

**2. Scope MVP**

*2.1 Masuk scope*

- **Registrasi lewat undangan**, login, logout
- **Project**: buat, ubah, lihat daftar, lihat detail
- **Keanggotaan project**: tambah anggota, hapus anggota, tentukan perannya di project itu
- **Task**: buat, ubah, hapus, lihat. Setiap task wajib berada di dalam satu project
- **Tingkat prioritas task**: low, medium, high
- **Filter dan sort task**: berdasarkan status, prioritas, assignee, due date
- **Komentar teks biasa** pada task
- **Activity feed**: aktivitas terbaru pada project dan pada task
- **RBAC**: Admin, Manager, Staff

*2.2 Di luar scope*

- **Multi-tim atau multi-workspace**. Aplikasi melayani tepat satu tim
- **Kanban board**, drag and drop, sinkronisasi realtime
- **Rich text**, lampiran file
- **Notifikasi** (email, push, in-app)
- **Sub-task**, label, milestone, time tracking
- **Edit dan hapus komentar**
- **Reset password**

*2.3 Perubahan dari revisi sebelumnya*

- Task sebelumnya berdiri sendiri. Sekarang task adalah anak dari project, `tasks.project_id` wajib diisi
- Scope sebelumnya menyebut satu role untuk semua user. Sekarang ada tiga role
- **Entitas baru**: `projects`, `project_members`, `activities`, ditambah lima tabel bawaan package RBAC
- Task sekarang memiliki tingkat prioritas, disimpan sebagai tabel master `priorities` yang dirujuk lewat id
- **Revisi 5**: akun tidak lagi menyimpan rujukan ke undangan asalnya. Undangan dan akun dihubungkan lewat alamat email, dan aturan satu undangan satu akun ditegakkan oleh proses registrasi

---

**3. Role dan Aturan Akses**

*3.1 Definisi role*

- **Admin** : penanggung jawab aplikasi. Mengelola undangan dan akun. Melihat dan mengubah seluruh project tanpa perlu menjadi anggota
- **Manager** : kepala project. Boleh membuat project baru. Di dalam project yang dipimpinnya, mengelola anggota, mengubah project, dan menghapus task
- **Staff** : anggota pelaksana. Tidak boleh membuat project. Di dalam project tempat dia terdaftar, boleh membuat dan mengubah task serta berkomentar

*3.2 Dua lapis otorisasi*

Setiap pemeriksaan izin melewati dua pertanyaan yang berbeda, dan keduanya harus lolos.

- **Lapis 1, boleh aksi apa** : ditentukan oleh peran. Disimpan sebagai data di tabel izin, bukan sebagai kondisi di dalam kode
- **Lapis 2, di project mana** : ditentukan oleh keanggotaan. User yang tidak terdaftar di `project_members` sebuah project tidak melihat project itu sama sekali, apa pun peran globalnya

Admin adalah satu-satunya pengecualian. Admin melewati lapis 2.

*3.3 Peran global dan peran di dalam project*

- **Peran global** melekat pada akun. Peran ini yang menjawab aksi yang tidak terikat pada project mana pun, yaitu membuat project dan mengirim undangan
- **Peran di dalam project** melekat pada baris keanggotaan. Peran ini yang menjawab seluruh aksi di dalam project tersebut
- **Kedua peran boleh berbeda**. Seorang user berperan global Staff dapat ditunjuk sebagai Manager pada satu project tertentu, dan pada project itu dia memegang wewenang Manager
- **Alasan pemisahan** : saat sebuah project belum ada, calon pembuatnya belum menjadi anggota project mana pun. Wewenang membuat project karena itu tidak mungkin berasal dari keanggotaan, dan harus berasal dari peran global

*3.4 Aturan akses yang disepakati*

Aksi yang dinilai dari peran global :

- **Membuat project** : Admin, Manager. Staff tidak boleh
- **Mengirim undangan** : Admin saja
- **Mencabut undangan yang masih pending** : Admin saja

Aksi yang dinilai dari peran di dalam project, untuk project yang bersangkutan :

- **Melihat project dan seluruh isinya** : Manager, Staff. Bukan anggota tidak boleh
- **Mengubah nama dan deskripsi project** : Manager
- **Menghapus project** : Manager
- **Menambah dan menghapus anggota project** : Manager
- **Menentukan peran anggota di dalam project** : Manager
- **Membuat task** : Manager, Staff
- **Mengubah task, termasuk status, prioritas, due date, dan assignee** : Manager, Staff
- **Menghapus task** : Manager
- **Menambah komentar** : Manager, Staff
- **Melihat activity feed project dan task** : Manager, Staff

Admin memiliki seluruh izin di atas pada seluruh project tanpa menjadi anggota.

*3.5 Catatan yang perlu ditegaskan*

- Assignee sebuah task wajib merupakan anggota project task tersebut. Task tidak boleh ditugaskan kepada orang di luar project
- Peran ditegakkan di sisi server pada setiap endpoint. Menyembunyikan tombol di tampilan bukan penegakan izin

---

**4. Modul**

*4.1 Project*

- Project adalah wadah pekerjaan. Setiap task wajib berada di dalam satu project
- **Atribut** : nama, deskripsi opsional, pembuat, waktu dibuat
- **Pembuat project otomatis** menjadi anggota project tersebut dengan peran Manager
- Daftar project yang ditampilkan kepada seorang user hanya berisi project tempat dia terdaftar. Bagi Admin, seluruh project
- Halaman detail project menampilkan daftar task project itu dan panel activity terbaru project itu

*4.2 Keanggotaan project*

- Menghubungkan satu user dengan satu project, beserta perannya di project itu
- Satu user hanya boleh punya satu baris keanggotaan per project
- Dikelola oleh Manager project tersebut, atau oleh Admin

*4.3 Task*

- Milik tepat satu project. Task tanpa project bukan keadaan yang sah
- **Atribut** : judul, deskripsi opsional, status, prioritas, due date opsional, assignee opsional, pembuat
- **Status** : `todo`, `in_progress`, `done`
- **Prioritas** : `low`, `medium`, `high`. Wajib diisi, bawaan `medium` bila tidak dipilih
- Daftar task dapat difilter berdasarkan status, prioritas, dan assignee, serta diurutkan berdasarkan prioritas, due date, atau waktu dibuat
- Urutan prioritas mengikuti tingkatnya, bukan urutan abjad. Sort menurun menampilkan high, medium, lalu low
- Halaman detail task menampilkan komentar dan panel activity terbaru task itu

*4.4 Komentar*

- Teks biasa, menempel pada satu task
- Ditampilkan dari terlama ke terbaru
- Tidak dapat diubah maupun dihapus pada MVP

*4.5 Activity (audit trail)*

- Mencatat aktivitas seluruh pihak, bukan hanya aktivitas si pembaca
- Ditampilkan di dua tempat. Pada halaman project, seluruh aktivitas project itu termasuk aktivitas task di dalamnya. Pada halaman task, hanya aktivitas task itu
- **Catatan bersifat hanya-tambah**. Tidak ada endpoint untuk mengubah atau menghapus catatan aktivitas
- **Aktivitas yang dicatat** : project dibuat, project diubah, anggota ditambahkan, anggota dihapus, task dibuat, task diubah, status task berubah, prioritas task berubah, assignee task berubah, task dihapus, komentar ditambahkan
- Setiap catatan menyimpan pelaku, jenis aksi, project terkait, task terkait bila ada, dan waktu kejadian

*4.6 Undangan dan autentikasi*

- **Wewenang mengirim undangan** dipegang Admin saja, menutup pertanyaan terbuka 6.2 pada TSD sebelumnya
- Undangan berisi token acak dan tanggal kedaluwarsa. Akun lahir hanya dengan menukarkan token yang masih berlaku
- **Email akun diambil dari baris undangan**, bukan dari isian formulir. Alamat email inilah yang menghubungkan akun dengan undangan asalnya
- **Satu undangan menghasilkan paling banyak satu akun**
- **Registrasi lewat undangan** adalah satu-satunya jalan membuat akun. Satu-satunya pengecualian adalah akun Admin pertama yang dibuat oleh seeder saat aplikasi dipasang

---

**5. User Flow**

*5.1 Bergabung ke aplikasi*

1. **Admin** membuka halaman undangan, memasukkan satu alamat email perusahaan, dan memilih peran global calon anggota
2. **Sistem** membuat baris undangan berisi token acak dan tanggal kedaluwarsa, lalu mengirim tautan registrasi
3. **Calon anggota** membuka tautan. Sistem memeriksa token, status, dan kedaluwarsa
4. **Calon anggota** mengisi nama dan password. Dalam satu transaksi, akun dibuat, peran global ditetapkan, dan undangan ditandai terpakai
5. **Anggota baru** masuk ke aplikasi dan melihat daftar project kosong sampai dia dimasukkan ke sebuah project

*5.2 Manager membuka project dan menyusun tim*

1. **Manager** menekan buat project, mengisi nama dan deskripsi
2. **Sistem** menyimpan project, mencatat pembuatnya sebagai anggota berperan Manager, dan menulis aktivitas project dibuat
3. **Manager** membuka tab anggota, memilih user dari daftar anggota tim, dan menentukan perannya di project ini sebagai Manager atau Staff
4. **Sistem** menyimpan keanggotaan dan menulis aktivitas anggota ditambahkan
5. Sejak saat itu project tersebut muncul di daftar project milik anggota baru

*5.3 Staff mengerjakan task*

1. **Staff** membuka project yang memuat namanya, lalu menekan buat task
2. **Staff** mengisi judul, deskripsi, prioritas, due date, dan assignee. Daftar assignee hanya berisi anggota project ini
3. **Sistem** menyimpan task dan menulis aktivitas task dibuat
4. **Staff** mengubah status task menjadi sedang dikerjakan. Sistem menulis aktivitas status berubah berisi nilai lama dan nilai baru
5. **Staff** menambahkan komentar. Sistem menulis aktivitas komentar ditambahkan
6. Seluruh langkah di atas muncul pada panel activity halaman task, dan ikut muncul pada panel activity halaman project

*5.4 Manager menutup pekerjaan*

1. **Manager** membuka halaman project dan membaca panel activity untuk melihat perkembangan tanpa membuka satu per satu task
2. **Manager** menyaring daftar task berdasarkan status untuk melihat yang belum selesai, lalu mengurutkannya berdasarkan prioritas agar task high tampil paling atas
3. **Manager** menghapus task yang batal. Staff tidak menemukan tombol ini karena tidak memiliki izinnya
4. **Sistem** menulis aktivitas task dihapus. Catatan ini tetap ada meskipun task-nya sudah tidak ada

*5.5 Jalur yang ditolak*

- **Staff menekan buat project** : tombol tidak ditampilkan, dan bila endpoint dipanggil langsung sistem membalas 403
- **Anggota membuka tautan project yang tidak memuat namanya** : sistem membalas 403, bukan 404, dan tidak membocorkan isi project
- **Anggota menugaskan task kepada orang di luar project** : validasi menolak dengan 422

---

**6. Acceptance Criteria**

- Task tidak dapat dibuat tanpa project. Percobaan menyimpan task tanpa project ditolak di lapisan basis data, bukan hanya di lapisan aplikasi
- Staff yang memanggil endpoint pembuatan project menerima 403
- User yang bukan anggota sebuah project tidak melihat project itu di daftar dan menerima 403 saat membuka detailnya
- Admin melihat seluruh project tanpa terdaftar sebagai anggota mana pun
- User berperan global Staff yang ditunjuk sebagai Manager pada satu project dapat mengelola anggota pada project itu, dan tetap tidak dapat membuat project baru
- Setiap aksi pada daftar di bagian 4.5 menghasilkan tepat satu baris aktivitas
- Panel activity project memuat aktivitas task di dalamnya. Panel activity task hanya memuat aktivitas task tersebut
- **Tidak ada endpoint** yang dapat mengubah atau menghapus baris aktivitas
- Menambah satu peran baru cukup dengan menambah baris pada tabel peran dan tabel relasi izin, tanpa mengubah kode otorisasi
- Task tidak dapat disimpan tanpa prioritas. Task yang dibuat tanpa memilih prioritas tersimpan sebagai `medium`
- Sort berdasarkan prioritas menghasilkan urutan high, medium, low, bukan urutan abjad
- Menambah satu tingkat prioritas baru cukup dengan menambah baris pada tabel prioritas, tanpa migration
- Token undangan yang sudah terpakai, dicabut, atau kedaluwarsa ditolak saat registrasi
- Satu token yang ditukarkan dua kali, termasuk secara bersamaan, hanya menghasilkan satu akun
- Tidak ada halaman atau endpoint yang membuat akun tanpa token undangan

---

**7. Open Questions**

*7.1 Nasib task saat project dihapus* Pilihannya menghapus seluruh task beserta komentarnya, atau memblokir penghapusan project yang masih berisi task. Usulan sementara adalah memblokir, karena penghapusan berantai memusnahkan pekerjaan tanpa peringatan.

*7.2 Nasib catatan aktivitas saat project dihapus* Audit trail yang ikut terhapus bersama objeknya kehilangan sebagian nilainya. Perlu dipastikan ke Aril apakah catatan harus bertahan setelah project hilang.

*7.3 Kedalaman isi catatan aktivitas* Saat ini setiap baris hanya menyimpan jenis aksi dan keterangan singkat. Bila Aril menginginkan nilai sebelum dan sesudah untuk setiap perubahan, dibutuhkan satu kolom tambahan bertipe JSON.

*7.4 Peran global bawaan untuk undangan* Perlu dipastikan apakah Admin memilih peran global saat mengundang, atau semua undangan menghasilkan Staff dan peran dinaikkan belakangan.

*7.5 Jumlah Admin* Belum ditentukan apakah Admin boleh lebih dari satu, dan apakah Admin boleh menurunkan peran Admin lain.

*7.6 Menonaktifkan anggota* Belum ada mekanisme menonaktifkan akun. Menghapus user terhalang oleh aturan integritas data pada task dan komentar.

*7.7 Wewenang mengubah prioritas* Saat ini prioritas ikut izin mengubah task, sehingga Staff boleh mengubahnya. Perlu dipastikan ke Aril apakah prioritas hanya boleh ditentukan Manager.

*7.8 Jumlah tingkat prioritas* Perlu dipastikan apakah tiga tingkat sudah cukup, atau dibutuhkan tingkat `urgent`.
