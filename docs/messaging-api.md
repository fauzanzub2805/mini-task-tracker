# Messaging API (Profile > Message)

Semua endpoint berada di bawah middleware `auth` (session cookie web) dan
memakai prefix `/messaging`. Mutasi (`POST`/`DELETE`) dilindungi CSRF Laravel.

Lampiran disimpan di disk privat `local` (`storage/app/private/direct-messages/...`),
tidak pernah lewat `/storage`. Unduhan hanya lewat route ber-otorisasi.

## Endpoint

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/messaging/users?q=` | Cari pengguna lain berdasarkan nama (self dikecualikan). |
| GET | `/messaging/conversations?q=` | Daftar percakapan, terbaru lebih dulu. `q` mencocokkan nama lawan bicara atau isi pesan pada percakapan milik sendiri. |
| GET | `/messaging/users/{user}/messages` | Maksimal 100 pesan terakhir, urut kronologis. |
| POST | `/messaging/users/{user}/messages` | Multipart: `body` (≤4000) dan/atau `attachment` (≤10 MB). |
| POST | `/messaging/users/{user}/read` | Body `through_id`; hanya menandai pesan masuk dengan `id <= through_id`. |
| DELETE | `/messaging/messages/{message}` | Hanya pengirim. Menghapus pesan dan file lampirannya. |
| GET | `/messaging/messages/{message}/attachment` | Unduh lampiran; hanya peserta percakapan. |

Percakapan dengan diri sendiri ditolak `422`.

## Bentuk data

`GET /messaging/users`:

```json
{ "data": [{ "id": 1, "name": "Bob" }] }
```

`GET /messaging/conversations`:

```json
{
  "data": [
    {
      "user": { "id": 2, "name": "Bob" },
      "last_message": "Halo",
      "last_message_at": "2026-10-04T10:00:00+00:00",
      "unread_count": 1,
      "status": "unread"
    }
  ],
  "unread_count": 1
}
```

`status`:

- `unread` (indikator hijau): ada pesan masuk yang belum dibaca.
- `awaiting_reply` (indikator merah): pesan terakhir pada percakapan adalah
  pesan masuk yang sudah dibaca (belum dibalas).
- `null`: tidak ada indikator.

`GET /messaging/users/{user}/messages` dan `POST .../messages`:

```json
{
  "data": {
    "id": 10,
    "sender_id": 1,
    "recipient_id": 2,
    "body": "Halo",
    "created_at": "2026-10-04T10:00:00+00:00",
    "read_at": null,
    "attachment": {
      "name": "laporan.pdf",
      "size": 102400,
      "url": "http://localhost/messaging/messages/10/attachment"
    }
  }
}
```

`attachment` bernilai `null` bila tidak ada lampiran.

`POST .../read`:

```json
{ "data": { "updated": 1, "unread_count": 0 }, "unread_count": 3 }
```

`unread_count` pada `data` adalah sisa pesan belum dibaca pada percakapan itu;
`unread_count` di root adalah total seluruh pesan masuk belum dibaca.

## Ekstensi lampiran yang diizinkan

`pdf`, `txt`, `csv`, `zip`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`,
`png`, `jpg`, `jpeg`, `gif`, `webp`. HTML/SVG/executable ditolak.

## Catatan frontend

- Auto-read memanggil `POST .../read` dengan id pesan masuk terakhir yang sudah
  terlihat (bukan id terbesar yang pernah diterima) agar pesan baru tidak ikut
  terbaca. Ini hanya menjangkau pesan yang termuat pada jendela 100 terbaru.
- Tombol **Tandai percakapan dibaca** memanggil `POST .../read` dengan id
  pesan terbesar yang sedang dimuat, termasuk pesan keluar. Karena filter
  backend hanya menyentuh pesan masuk, batas ini tetap aman sekaligus membersihkan
  pesan masuk lama di luar jendela 100 terbaru. Tindakan ini eksplisit dan tidak
  dijalankan otomatis.
- Polling `GET /messaging/conversations` dan `GET .../messages` setiap 5 detik
  saat tab terlihat; tidak ada websocket.
- Respons GET thread dibuang bila sudah disusul permintaan lebih baru atau
  mutasi (kirim/hapus/tandai baca). Pesan hasil POST digabung berdasarkan `id`
  sehingga polling dan POST tidak membuat duplikat.
- Draft dan lampiran hanya dibersihkan bila isinya masih sama dengan snapshot
  saat dikirim, sehingga teks yang diketik selama POST berjalan tidak hilang.

## Deployment

1. Jalankan migrasi tabel pesan:

   ```bash
   php artisan migrate
   # Laravel Sail
   ./vendor/bin/sail artisan migrate
   ```

2. Tidak perlu `php artisan storage:link`: lampiran memakai disk privat
   `local` (`storage/app/private/direct-messages`) dan diunduh lewat route
   ber-otorisasi.
3. Bangun aset frontend: `npm ci && npm run build`.
4. Tidak ada worker/queue atau websocket yang perlu dijalankan.

## Batasan

- Endpoint pesan hanya mengembalikan **100 pesan terakhir** per percakapan.
  Pesan lebih lama tidak dimuat; gunakan tombol **Tandai percakapan dibaca**
  untuk membersihkan pesan masuk lama yang belum terbaca.
- Lampiran privat tidak dapat diakses lewat URL publik; unduhan selalu melalui
  `GET /messaging/messages/{message}/attachment` dan hanya untuk peserta.
- Pembaruan memakai polling 5 detik, bukan realtime.
- Pencarian memakai kolom `users.name`; belum ada kolom `username` terpisah.
