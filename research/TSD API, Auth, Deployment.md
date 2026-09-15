# TSD API, Auth, Deployment

Muhammad Fauzan Zubaedi

**1. Endpoint REST**

*1.1 Invitations*

- Post : Mengundang sebuah email perusahaan dengan menyisipkan baris invitations dengan token baru dan expires_at (/invitations)

- Get : Menampilkan daftar undangan, bisa difilter (?status=) (/invitations)

- Get : Memvalidasi token sebelum form registrasi ditampilkan (/invitations/:token)

- Delete : Mencabut undangan yng masih pending 
(status -> 'revoked') (/invitations/:id)

*1.2 Auth*

- Post : Menukrkan token dengan membuat baris user (/auth/register)

- Post : Email + password -> session (/auth/login)

- Post : Mengakhiri session (/auth/logout)

- Get : Mengembalikan dataa user yang sedang login (id, name, email) (/auth/me)

*1.3 Users*

- Get : Daftar anggota tim (id, name, email) (/users)

*1.4 Tasks*

- Get : Dafftar task (status, assignee_id, sort=due_date/created_at, desc)

- Post : Membuat task (/tasks)

- Get : Detail task (/tasks/:id)

- Patch : Mengubah title, description, status, due_date, assignee_id (/tasks/:id)

- Delete : Menghapus task (/tasks/:id)

*1.5 Comments*

- Get : Daftar komentar sebuah task dengan urutan terlama ke terbaru (/tasks/:id/comments)

- Post : Menambah komentar (/tasks/:id/comments)

**2. Auth (Laravel)**

- Email & Password dengan auth bawaan Laravel, yaitu guard (web), session berbasis cookie. 
- Hashing dengan menggunakan Hash, bcrypt.

**3. Deployment**

- Stack : **Laravel + Postgresql**
- Deployment di **Render**






