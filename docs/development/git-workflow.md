# Alur branch frontend

## Prinsip

- `main`: kode yang sudah direview, diuji, dan siap digunakan.
- Satu feature branch untuk satu halaman atau lingkup fitur yang jelas.
- Foundation, UI, integrasi backend, dan pengujian dikerjakan sebagai commit terpisah di feature branch terkait, bukan branch terpisah untuk setiap tahap.
- Push pekerjaan ke feature branch terlebih dahulu. Masukkan ke `main` melalui Pull Request setelah final, bukan push langsung ke `main`.
- Jangan commit `.env`, kredensial, `node_modules`, `vendor`, atau log/sesi agen `.pi-workflow`.

## Pembagian branch

| Branch | Lingkup |
|---|---|
| `feat/login-page` | Foundation React/Vite pertama, UI Sign In, integrasi autentikasi Laravel, preview skenario Figma, tes dan dokumentasi |
| `feat/dashboard-page` | Layout dan data dashboard, loading/error/empty states, tes |
| `feat/projects-page` | Daftar project, pencarian/filter/pagination sesuai kebutuhan backend, tes |
| `feat/project-detail-page` | Detail project dan navigasi terkait, integrasi serta tes |
| `feat/tasks-page` | Halaman task, integrasi serta tes |

Branch selain login merupakan rencana; buat saat pengerjaannya dimulai, dari `main` terbaru setelah dependency sebelumnya di-merge. Foundation lintas halaman selanjutnya dapat memakai `feat/frontend-foundation` jika merupakan pekerjaan mandiri. Jangan menggandakan foundation React yang sudah masuk melalui login.

## Struktur commit yang disarankan

Pada `feat/login-page`, kelompokkan perubahan berdasarkan diff yang benar-benar tersedia:

1. `feat(frontend): set up React and Vite foundation`
2. `feat(login): implement Figma sign-in UI and isolated previews`
3. `feat(login): integrate Laravel session authentication`
4. `test(login): cover authentication states and preview isolation`
5. `docs(login): document setup and feature scope`

Urutan ini panduan, bukan riwayat yang sudah dibuat. Beberapa perubahan saling bergantung; jangan memaksakan pemisahan yang menghasilkan commit rusak. Gunakan staging per file/hunk dan periksa `git diff --cached` sebelum commit. Hindari `git add .` tanpa review karena working tree juga berisi artefak agen.

## Alur publikasi

Setelah commit disetujui dan dibuat:

```bash
git push -u origin feat/login-page
```

Buat Pull Request dengan base `main` dan compare `feat/login-page`. Deskripsikan:
- Foundation dan komponen yang ditambahkan.
- Integrasi backend dan batas scope.
- Hasil pengujian, screenshot desktop/mobile, serta hal yang belum diverifikasi.
- OTP hanya preview dan Google belum aktif.

Merge setelah review dan pengujian diterima. Tidak melakukan commit, push, atau merge otomatis hanya karena branch sudah dibuat.

Untuk halaman berikutnya, pastikan working tree bersih dan fitur sebelumnya sudah di-merge:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/dashboard-page
```

Perubahan yang belum di-commit masih berada di working tree, bukan snapshot branch. Commit dahulu sebelum berpindah ke pekerjaan lain; jangan memakai reset/clean untuk berpindah branch.
