# Storm Digital Store

Website resmi Storm Digital Store — toko akun premium dengan checkout otomatis.

## Versi saat ini: v2 (dinamis)
- Katalog produk dinamis dari database (PostgreSQL) — fallback mode demo tanpa database
- Pembeli TAMU: tanpa login/daftar. Saat pesan cukup isi nama + email / nomor telepon
  (catatan pengiriman); akun dikirim otomatis setelah pembayaran lunas
  (tampil di halaman sukses + salinan ke email bila mengisi email)
- Pembayaran QRIS via BTZ PayGate (pola sama dengan bot Telegram @arkdgstorebot:
  buat tagihan -> polling status -> stok dikunci -> akun terkirim)
- Panel admin di `/admin`: login username + password, tambah produk
  (kategori selalu "Akun Premium"), kelola stok, aktif/nonaktif, hapus,
  lihat transaksi + omzet

## Pengaturan di Vercel (Environment Variables, diisi owner di dashboard)
- `DATABASE_URL` — dari integrasi Neon (Storage/Marketplace), otomatis bila terhubung
- `BTZ_API_KEY` — API key BTZ PayGate (sama dengan bot)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` — login panel admin
- Email (pilih satu): `RESEND_API_KEY` + `MAIL_FROM`, atau SMTP
  `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` + `MAIL_FROM`
Tanpa variabel di atas, situs berjalan mode demo / pembayaran nonaktif
(sama seperti bot bila key BTZ kosong).

## Struktur
- `index.html` — etalase + checkout + cek pesanan (JavaScript vanilla)
- `admin.html` — panel admin
- `api/` — fungsi serverless Vercel (katalog, checkout, status, admin)
- `lib/` — db.js (Postgres/demo), btz.js, auth.js, mail.js

Hosting: Vercel, kode di GitHub (ginomas21/storm-digital-store).
