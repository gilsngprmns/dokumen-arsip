# Catatan Keamanan & Optimasi Backend

Dokumen ini merangkum celah keamanan yang ditemukan beserta perbaikan yang
sudah diterapkan pada backend, serta hal yang perlu diperhatikan saat deploy.

## 1. Keamanan (Security)

| # | Celah | Perbaikan |
|---|-------|-----------|
| 1 | **Rate limiter bocor memori** — `buckets` Map tumbuh tanpa batas (DoS). | `middleware/rateLimit.js` kini menyapu bucket kedaluwarsa berkala + jaring pengaman `MAX_BUCKETS`. |
| 2 | **`req.ip` salah di balik proxy** (Cloudflare Tunnel/nginx) sehingga rate limit by-IP tak efektif. | `app.js` mengaktifkan `app.set("trust proxy", 1)`. |
| 3 | **Input tidak divalidasi** — email/username bebas, teks tak berbatas, tanggal/tahun bebas menyebabkan error 500 dari PostgreSQL. | `utils/validators.js` + validasi di semua controller; error menjadi `400` dengan pesan jelas. |
| 4 | **ID non-numeric** dikirim ke PostgreSQL → error 500. | `middleware/validateId.js` (`requireIdParam`) di level route → `400`. |
| 5 | **Upload hanya cek ekstensi** (MIME bisa dipalsukan). | `middleware/uploadMiddleware.js` mencocokkan **ekstensi & MIME**, memastikan folder `uploads` ada. |
| 6 | **`originalname` mentah** disimpan (bisa memuat path traversal/karakter kontrol). | `sanitizeOriginalName()` di `dokumenController.js`. |
| 7 | **Self-lockout** — admin bisa menonaktifkan/menurunkan role akunnya sendiri. | `userController.js` menolak perubahan role & penonaktifan akun sendiri (`isSelf`). |
| 8 | **`file_path` bocor** ke respons API (struktur internal server). | `serializeDokumen()` membuang `file_path` dari respons. |
| 9 | **Tak ada error handler terpusat**; stack trace bisa terkirim ke client. | `middleware/errorHandler.js` — respons aman, logging hanya di server. |
| 10 | **Env tidak divalidasi** — `JWT_SECRET` lemah/pendek bisa lolos ke produksi. | `config/validateEnv.js` (cek wajib + panjang/placeholder secret). |
| 11 | **Tanpa graceful shutdown** (SIGTERM/SIGINT) untuk deploy container. | `server.js` menutup server & pool DB dengan aman. |
| 12 | **Body JSON tanpa batas** eksplisit. | `express.json({ limit: "1mb" })`. |
| 13 | **Header keamanan** tak lengkap. | CORS whitelist + regex, `x-powered-by` dimatikan, security headers, HSTS saat HTTPS. |

## 2. Redundansi / Optimasi (untuk deploy)

- **`adminOnly`** terpusat di `middleware/adminOnly.js` (sebelumnya array
  `[authMiddleware, roleMiddleware("admin")]` diduplikasi di banyak route).
- **`serializeUser`** terpusat di `utils/serializeUser.js` (sebelumnya ada di
  `authController` & `userController`).
- **`canAccessSection`** — digabung dari `canAccessSection` + `canViewDocument`
  yang hampir identik.
- **Filter dokumen** (`getAllDokumen` & `getTrashDokumen`) kini memakai validasi
  yang seragam; ekspresi pagination `$${queryValues.push(...)}` yang rawan bug
  diganti penomoran placeholder yang eksplisit.
- **`engines`** ditambahkan di `package.json` (backend `>=18`, frontend
  `>=20.19` karena Vite 8) agar runtime deploy konsisten.

## 3. Yang perlu diperhatikan saat deploy

- Set **`NODE_ENV=production`** agar `validateEnv` memberlakukan aturan secret
  paling ketat dan error detail tidak dicetak ke log publik.
- Wajib set `JWT_SECRET` yang **panjang & acak** (min. 32 karakter di produksi).
- Untuk banyak instance/replica, ganti rate limiter in-memory dengan store
  bersama (mis. **Redis**) agar limitnya konsisten.
- Sesuaikan `CORS_ORIGINS` / `CORS_ORIGIN_PATTERNS` ke domain produksi.
- Skema DB punya beberapa sumber kebenaran (`schema.sql`, `migrations/`,
  `ensureRoles`/`ensureDocumentRequests`). Pertahankan migration sebagai acuan
  resmi dan jaga `ensure*` tetap sinkron.
