# Dashboard frontend — idle preview

## Branch dan dependency

- Branch aktif untuk pekerjaan ini: `feat/dashboard-page`.
- Dibuat dari commit login `0357e64` pada `feat/login-page`, bukan dari main yang belum memiliki foundation React.
- Ini stacked branch: sebelum login masuk main, review diff dashboard terhadap `feat/login-page`. Setelah login di-merge, perbarui basis PR dengan hati-hati (terutama jika login di-squash).
- Branch dashboard menyertakan commit dasar login. Publikasi dilakukan ke `feat/dashboard-page`, tanpa merge ke `main`.

## Scope

Referensi: PNG Dashboard Welcome / Idle dari Figma. Navbar atas putih sesuai instruksi pengguna (berbeda dari referensi merah), sidebar merah, menu Dashboard expandable dengan anchor AI Chatbot dan Progress Table dalam satu halaman. Anchor menggunakan native hash + smooth scroll, dengan reduced-motion dan offset navbar sticky. Layout mobile memakai toggle sidebar dan tabel horizontal scroll.

Chatbot, lampiran, kirim, notifikasi, serta menu halaman lain disabled; belum ada pencarian AI atau request backend data task. Pada `/dashboard`, nama, role, dan inisial avatar diambil dari sesi Laravel. Pada `/dashboard/preview`, identitas tetap demo. Task selalu diberi label data contoh. Statistik dihitung dari lima baris contoh sehingga tidak menampilkan angka Figma yang tidak cocok dengan isi tabel. Ilustrasi memakai aset login yang sudah tersedia.

## Melihat halaman

Buka **http://localhost/dashboard** setelah login. Route dilindungi middleware auth; tamu diarahkan ke `/login`, sedangkan request JSON tetap mendapat 401. Login berhasil atau sesi aktif di halaman login mengarah otomatis ke dashboard. Preview login tidak melakukan redirect.

**http://localhost/dashboard/preview** tetap tersedia untuk preview statis tanpa autentikasi dan tidak menampilkan identitas pengguna nyata.

`npm run build` sudah menghasilkan aset; Vite tidak diperlukan untuk preview build. Untuk development, restart Vite setelah penambahan entry point `resources/js/dashboard.jsx`.

## Struktur

- `resources/js/pages/dashboard/DashboardApp.jsx`: komponen React layout, menu, chatbot idle, ringkasan dan tabel.
- `resources/js/dashboard.jsx`: entry point React khusus dashboard.
- `resources/css/dashboard.css`: navbar putih, sidebar merah, responsif dan scrolling.
- `resources/views/dashboard.blade.php`: dokumen host minimal, tanpa UI dashboard.
- `routes/web.php`: route `/dashboard/preview`.
- `tests/js/DashboardApp.test.jsx`: tes idle, navigasi anchor, collapse, mobile menu dan isolasi backend.
- `tests/Feature/DashboardPreviewTest.php`: tes host preview Laravel.

## Verifikasi

- 32 tes JavaScript lolos (login, redirect, dashboard dan profil akun).
- Build Vite berhasil; peringatan opsional fontaine tidak memblokir build.
- 8 tes PHP terarah lolos saat integrasi redirect (DashboardPreviewTest + LoginPageTest), 38 assertions. Setelah integrasi profil, 3 tes dashboard dijalankan ulang dan lolos, 11 assertions.
- `git diff --check` lolos.
- Belum dilakukan verifikasi visual browser/pixel-perfect atau pengujian integrasi data dashboard nyata.
