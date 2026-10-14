# Frontend — migrasi halaman login ke React

## Stack dan batas migrasi

Sesuai revisi mentor, frontend aktif sekarang **React + Tailwind CSS + Vite**, menggantikan Blade/Alpine untuk tampilan dan interaksi. Backend tetap Laravel dengan sesi cookie dan CSRF. Tidak menggunakan token localStorage, Inertia, atau server frontend terpisah.

Blade masih digunakan hanya sebagai dokumen HTML host: meta, aset Vite, mount point React, dan data awal yang di-encode aman. Form, branding, pesan error, dan panel sukses seluruhnya dirender React. Template welcome bawaan Laravel tidak digunakan oleh route aplikasi.

UI sudah disusun berdasarkan tujuh PNG Sign In Page dari Figma: gradasi kuning-merah, kartu dua kolom, branding Rekayasa, form, spinner, dan notifikasi. Ilustrasi dipotong dari PNG sumber ke `public/images/login-illustration.png`; bukan screenshot seluruh halaman. Font masih Instrument Sans karena metadata font Figma tidak tersedia. Dashboard, project/task UI, dan halaman undangan belum termasuk.

### Preview skenario Figma

Buka `/login?preview=signin`, lalu gunakan navigasi preview untuk memilih `loading`, `wrong-password`, `account-not-found`, `otp`, `otp-loading`, `wrong-token`, atau `success`. Semua preview diberi label dan tidak memanggil autentikasi atau mengubah sesi server. Input/tombol OTP belum aktif, tanpa pengiriman atau verifikasi kode. Google disabled. Administrator membuka petunjuk kontak umum, karena alamat kontak belum disediakan.

`/login` tetap merupakan login nyata email/password. Error kredensial nyata tetap generik (backend tidak membedakan akun tidak ditemukan dan password salah). Login sukses nyata tidak melewati OTP palsu. Panel sukses akhir merupakan pelengkap implementasi karena PNG sumber hanya menunjukkan sukses kredensial sebelum OTP.

## Struktur

| File | Fungsi |
|---|---|
| `resources/js/app.jsx` | Mount React dengan createRoot dan StrictMode |
| `resources/js/pages/login/LoginApp.jsx` | Komponen branding, form, panel sukses |
| `resources/js/pages/login/useLogin.js` | Hook state, fetch login/logout, validasi, loading, countdown |
| `resources/js/pages/login/loginCore.js` | Helper validasi, CSRF, terjemahan error |
| `resources/css/app.css` | Tailwind dengan pemindaian JSX |
| `resources/views/layouts/guest.blade.php` | Dokumen HTML minimal, Vite dan React Refresh |
| `resources/views/auth/login.blade.php` | Mount point dan JSON bootstrap, tanpa form |
| `app/Http/Controllers/LoginPageController.php` | Menyiapkan identitas pengguna dari sesi |
| `vite.config.js` | Laravel, React, Tailwind dan font |
| `vitest.config.js` | Tes React dengan jsdom |

## Alur

`GET /login` → Laravel mengirim HTML host + data awal → React merender UI → `POST /auth/login` dengan JSON/CSRF/cookie same-origin → panel sukses atau error.

Fitur: validasi kosong/format email, tampilkan password, cegah submit ganda, penanganan 422/419/429/server/jaringan, countdown, sesi aktif saat reload, logout. Logout memakai cookie XSRF terbaru lalu reload untuk mendapatkan status sesi sebenarnya (termasuk jika request gagal). Tidak ada registrasi publik atau remember me.

## Menjalankan di localhost

Dengan Docker Desktop aktif dan konfigurasi database proyek sudah siap:

```bash
cd ~/mini-task-tracker
./vendor/bin/sail up -d
./vendor/bin/sail npm install
./vendor/bin/sail npm run dev -- --host 0.0.0.0
```

Buka **http://localhost/login** (atau port APP_PORT jika diubah). Biarkan terminal Vite terbuka. Restart Vite lama setelah migrasi karena entry point dan plugin berubah.

Alternatif tanpa dev server: hentikan Vite dengan Ctrl+C, lalu `./vendor/bin/sail npm run build`. Jangan biarkan file `public/hot` menunjuk dev server yang sudah mati.

Gunakan akun lokal yang sudah dibuat. Jangan jalankan `migrate:fresh` pada database aplikasi. UI membutuhkan JavaScript aktif.

## Verifikasi migrasi

- `npm test`: **25 tes lolos**, mencakup helper, interaksi React, serta isolasi preview dari autentikasi.
- `npm run build`: **berhasil**, ada peringatan opsional fontaine (bukan kegagalan).
- Tes PHP terarah lewat Sail dengan database `testing`: **9 tes / 39 assertions lolos**, termasuk host HTML, encoding bootstrap aman, sesi aktif, kontrak JSON login, root redirect, serta kompatibilitas error API.

Tes DOM tidak menggantikan demo browser sungguhan. Pemeriksaan visual desktop/mobile dan alur login browser end-to-end belum dilakukan. Kesamaan pixel-perfect belum diverifikasi; seluruh aplikasi belum teruji.

## Narasi untuk mentor

“Frontend login sudah dimigrasikan ke React dan Tailwind, dengan Laravel tetap menangani autentikasi. Blade hanya menjadi host HTML untuk memuat React, bukan tempat menulis UI. Form, state, validasi, loading, dan error sekarang dikelola React. Build, 15 tes JavaScript, serta 9 tes PHP terarah lolos. Berikutnya verifikasi visual di browser dan penyesuaian desain Figma.”

Perubahan belum di-commit atau di-push.
