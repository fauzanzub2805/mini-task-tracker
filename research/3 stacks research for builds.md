# 3 stacks research for Mini Task Tracker

Muhammad Fauzan Zubaedi

**Kebutuhan Proyek**

Sebagai fungisnya, Mini task tracker butuh tiga hal inti: 
- CRUD (create/read/update/delete task)
- Autentikasi user (login, session/token)
- Database relasional sederhana untuk menyimpan task dan user. 

**Kriteria Penilaian**

- Learning curve untuk pemula
- Kualitas dokumentasi dan tutorial
- Kemampuan stack menutupi kebutuhan (CRUD + auth + DB) 
- Tingkat penggunaannya di publik

# 1. Next.js + Prisma + PostgreSQL

**Learning curve:** Sedang sampai tinggi. Perlu memahami React dulu, lalu App
Router Next.js, lalu skema dan migration Prisma. Tidak memiliki Autentikasi bawaan, sehingga  harus tambah library seperti Auth.js/NextAuth, jadi ada satu lapisan konsep lagi yang harus dipelajari terpisah dari framework utamanya.

**Docs & tutorial:** Sangat bagus, Dokumentasi Next.js dan Prisma termasuk
yang paling rapi dan modern di industri, dengan banyak contoh dan komunitas
besar yang aktif menulis tutorial.

**Cakupan kebutuhan:** CRUD dan koneksi DB kuat berkat Prisma (type-safe
query, migration otomatis), tapi auth tetap perlu potongan tambahan di luar
paket inti.

**Tingkat penggunaan kerja:** Ekosistem React masih yang terbesar di web, sekitar 39,5% developer profesional memakainya menurut Stack Overflow Developer Survey
2025 dan Next.js jadi pilihan default untuk tim yang React-first, dengan kolam talent dan lowongan yang besar.

**Ringkasan pro/kontra:**
- Pro: DX modern, type safety kuat lewat Prisma, satu bahasa (JS/TS) untuk
  frontend dan backend, hiring pool besar.
- Kontra: Infranya bertumpuk (React + App Router + Prisma + auth eksternal)
  
# 2. Node.js/Express + PostgreSQL (frontend HTML/JS atau React terpisah)

**Learning curve:** Paling manual dari ketiganya. Routing, query SQL (raw
atau lewat query builder seperti Knex), hashing password, dan session/JWT
semuanya dirakit sendiri. Paling banyak melatih pemahaman fundamental, tapi
paling lambat untuk sampai ke versi yang benar-benar "jalan".

**Docs & tutorial:** Dokumentasi resmi Express sengaja tipis (Express memang
unopinionated by design), sehingga sebagian besar panduan datang dari pihak
ketiga dengan kualitas yang bervariasi.

**Cakupan kebutuhan:** Semua bisa dicapai, tapi tidak ada yang bawaan — auth,
validasi, dan struktur project semuanya keputusan sendiri.

**Tingkat penggunaan kerja:** Node.js adalah teknologi web yang paling banyak dipakai secara umum (48,7% developer pada survei Stack Overflow 2025).

**Ringkasan pro/kontra:**
- Pro: Paling fleksibel, paling banyak melatih fundamental (cocok dengan
  prinsip "pahami dulu sebelum pakai framework besar"), Node/Express tetap
  banyak muncul di lowongan kerja.
- Kontra: Paling lambat untuk mencapai CRUD+auth+DB yang lengkap, dokumentasi
  auth/DB tersebar di banyak library berbeda, resiko celah keamanan lebih
  tinggi karena semua ditulis manual.

# 3. Django + PostgreSQL

**Learning curve:** Perlu pemahaman lebih lanjut pada Python dan pola MTV (Model-Template-View) Django. Apabila telah paham pola dasarnya, maka seperti auth, admin panel, dan ORM semuanya sudah tersedia, sehingga total konsep baru yang harus dipelajari lebih sedikit dibanding merakit sendiri stack lain.

**Docs & tutorial:** Termasuk salah satu dokumentasi resmi terbaik di
industri. 

**Tingkat penggunaan kerja:** Lebih niche dibanding ekosistem JS, tapi permintaannya stabil dan cenderung datang dari perusahaan yang membangun produk jangka panjang, bukan sekadar ikut tren. Beberapa analisis 2026 malah menyebut
Django sebagai pilihan tercepat untuk MVP ketika model data dan admin panel
penting, sesuai untuk kebutuhan mini-task-tracker.

**Ringkasan pro/kontra:**
- Pro: auth + admin + ORM bawaan (paling sedikit infrastruktur yang harus disambung
  sendiri), dokumentasi resmi ramah untuk pengguna pemula/umum
- Kontra: bahasa/pola berbeda (Python + MTV) 


## Keputusan Akhir

**Pilihan: Django + PostgreSQL.**

