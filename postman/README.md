# Postman — Mini Task Tracker

## Import dan konfigurasi

1. Import `Mini_Task_Tracker.postman_collection.json` dan `Mini_Task_Tracker.postman_environment.json` ke Postman.
2. Pilih environment **Mini Task Tracker - Local**.
3. Pastikan aplikasi dan database lokal berjalan. Untuk Artisan: `php artisan serve`; base URL bawaan `http://localhost:8000`. Untuk Sail biasanya `http://localhost` (sesuaikan APP_PORT), atau gunakan domain Herd milik proyek.
4. Isi `base_url` **tanpa trailing slash dan tanpa `/api`**. Route JSON proyek berada di `routes/web.php`.
5. Isi `admin_email` dan `admin_password`. Nilai contoh `admin@example.com` / `password` sesuai akun demo **jika DemoDataSeeder sudah dijalankan**. Collection tidak membuat akun admin maupun menjalankan migrasi/seeder.

## Autentikasi: session cookie + CSRF

Proyek ini tidak memakai Bearer token. Biarkan Cookie Jar Postman aktif dan Authorization **No Auth** sesuai collection.

Jalankan **01 Ambil session dan CSRF** dahulu. `GET /` mengirim cookie session dan `XSRF-TOKEN`; script menyimpan nilai cookie yang di-decode ke `xsrf_token`. Sebelum POST/PATCH/DELETE, collection mengirim `X-XSRF-TOKEN`. Cookie yang diperbarui saat login/register/logout juga ditangkap otomatis.

Jangan mengubah hostname di tengah alur. Setelah ganti host atau menghapus cookies, ulangi pengambilan CSRF lalu login. Token dan password merupakan nilai lokal sensitif; jangan commit hasil export environment yang sudah digunakan.

## Smoke test dengan Runner

Pilih **hanya folder 01 sampai 05**, jalankan berurutan, satu iterasi untuk awal:

1. Session/CSRF → login admin → profil.
2. Prioritas dan daftar user.
3. Buat, daftar, detail, ubah proyek dan lihat anggota.
4. Buat, filter, detail, ubah task serta tambah/baca komentar.
5. Baca aktivitas proyek dan task.

`current_user_id`, `priority_id`, `project_id`, `task_id`, dan `comment_id` tersimpan otomatis. Tiap request menguji status HTTP. Alur ini membuat data uji baru; gunakan database development, bukan production. Setiap iterasi membuat proyek/task baru. Jangan menjalankan seluruh collection tanpa memilih folder karena ada langkah manual/destruktif.

## Folder opsional (manual)

### 06 — Members

- Dari **Daftar pengguna**, pilih user selain creator proyek lalu isi `member_user_id`. Gunakan pagination jika belum ditemukan.
- Isi `project_role_id` dengan ID role **manager** atau **staff** dari database lokal. ID tidak di-hardcode karena bergantung data database. Tidak tersedia endpoint daftar role.
- Jika perlu melihat ID role tanpa mengubah database: `php artisan tinker`, lalu `\Spatie\Permission\Models\Role::where('guard_name', 'web')->get(['id', 'name']);`.
- Jalankan tambah anggota → ubah role → assign task. Creator otomatis manager; menambah creator lagi menghasilkan 422. Mengulang tambah anggota yang sama juga 422.

### 07 — Invitations / Register

- Login admin; isi `invitation_email` dengan email uji yang belum terdaftar, serta `invitation_role_id` dari role guard web di database.
- **Buat undangan benar-benar mengirim email** sesuai konfigurasi aplikasi. Untuk development, gunakan mail log atau mailbox lokal. Jika `MAIL_MAILER=log`, tautan tersedia di `storage/logs/laravel.log` sesuai logging aplikasi.
- Salin parameter `token` dari tautan email ke `invitation_token`. Token sengaja tidak ada dalam respons API dan berlaku **10 menit**.
- Validasi token → register. Email dan role diambil dari undangan, bukan payload register. Registrasi otomatis mengganti session menjadi user baru; login admin lagi sebelum melanjutkan pengelolaan.
- **Cabut undangan** adalah alternatif register, hanya untuk undangan pending. Jangan jalankan seluruh folder sekaligus. Untuk mengulang registrasi, gunakan email baru.

### 08 — Cleanup

Jalankan hanya untuk ID data uji: hapus task → hapus anggota tambahan (jika pernah ditambahkan) → hapus proyek → logout. Jangan hapus creator atau data penting. Proyek yang masih berisi task tidak bisa dihapus (409).

## Troubleshooting

| Status | Arti / tindakan |
|---|---|
| 401 | Session belum login/kedaluwarsa. Login ulang. |
| 403 | Role atau keanggotaan tidak berhak. Smoke test memakai admin. |
| 404 | ID/token salah, objek sudah dihapus, atau base URL salah. |
| 409 | Proyek masih mempunyai task saat dihapus. |
| 419 | Cookie session/CSRF tidak cocok. Aktifkan Cookie Jar, ambil CSRF lalu login ulang; periksa konfigurasi cookie domain/secure jika masih gagal. |
| 422 | Lihat `errors`: payload invalid, anggota duplikat, assignee bukan anggota, atau undangan tidak usable. |
| 429 | Login/register terkena throttle. Tunggu satu menit, jangan ulang login terlalu cepat. |

## Cakupan dan validasi

Collection mencakup 28 kombinasi method/path endpoint JSON yang dideklarasikan di `routes/web.php`, ditambah GET `/` untuk bootstrap CSRF dan beberapa variasi request. Route health `/up` bukan bagian API bisnis.

File JSON, sintaks script, referensi variabel, dan cakupan route diperiksa secara statis. Belum dilakukan uji HTTP end-to-end pada database/aplikasi berjalan; collection ini tidak mengubah backend.
