# Tasks

## Task List

### Phase 1: Project Setup & Infrastructure

- [x] 1.1 Inisialisasi struktur folder proyek
  - Buat folder: `frontend/pages`, `frontend/css`, `frontend/js`, `backend/routes`, `backend/controllers`, `backend/middleware`, `backend/models`, `backend/services`, `backend/utils`, `backend/data`, `prediction_service/models`
  - Salin `Model_XGB_Burnout_V1.pkl` ke `prediction_service/models/`
  - Buat `backend/data/data.json` dengan minimal 10 entri burnout knowledge base (struktur: section, content, keywords)

- [x] 1.2 Setup backend Node.js + Express
  - `npm init` di folder `backend/`
  - Install dependencies: `express`, `mongoose`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `cors`, `express-rate-limit`, `nodemailer`, `pdfkit`, `dotenv`
  - Install dev dependencies: `jest`, `supertest`, `mongodb-memory-server`, `fast-check`
  - Buat `backend/app.js` (Express setup: cors, cookie-parser, routes, error handler)
  - Buat `backend/server.js` (listen port dari env)
  - Buat `backend/.env` mengacu pada file `env` di root (MONGO_URI, JWT_SECRET, JWT_EXPIRED, EMAIL_USER, EMAIL_PASSWORD, GROQ_API_KEY, GROQ_MODEL, PREDICTION_SERVICE_URL)

- [x] 1.3 Setup Prediction_Service Python Flask
  - Buat `prediction_service/requirements.txt`: `flask`, `xgboost`, `numpy`, `scikit-learn`, `hypothesis`, `pytest`
  - Buat `prediction_service/app.py` dengan struktur dasar Flask (load model saat startup, route `/predict` POST, route `/health` GET)
  - Buat `prediction_service/tests/` folder

- [x] 1.4 Koneksi MongoDB Atlas
  - Buat `backend/utils/db.js` — fungsi koneksi Mongoose ke `MONGO_URI`
  - Panggil koneksi di `backend/server.js` sebelum listen

---

### Phase 2: Data Models & Utilities

- [x] 2.1 Buat Mongoose schema: User
  - `backend/models/User.js`
  - Fields: name, username (unique), email (unique), password, role (default 'user'), isVerified (default false), otpCode, otpExpiry, otpAttempts, loginAttempts, loginLockUntil, timestamps

- [x] 2.2 Buat Mongoose schema: Prediction
  - `backend/models/Prediction.js`
  - Fields: userId (ref User), inputs (object 10 fields), burnout_level, confidence, recommendation, timestamps

- [x] 2.3 Buat Mongoose schema: ChatMessage
  - `backend/models/ChatMessage.js`
  - Fields: userId (ref User), userMessage, assistantResponse, ragConfidence, ragSource, timestamps

- [x] 2.4 Buat utility functions
  - `backend/utils/jwtUtil.js` — `signToken(payload)`, `verifyToken(token)`
  - `backend/utils/otpUtil.js` — `generateOtp()` (6 digit random), `isOtpExpired(expiry)`
  - `backend/utils/hashUtil.js` — `hashPassword(plain)`, `comparePassword(plain, hash)`
  - `backend/utils/validate.js` — validasi prediction inputs (min/max per field)

---

### Phase 3: Auth System (Backend)

- [x] 3.1 Auth Service — Email
  - `backend/services/emailService.js`
  - Nodemailer transporter dengan Gmail SMTP dari env
  - Metode: `sendOtpEmail(email, name, code)`, `sendPasswordResetEmail(email, name, code)`

- [x] 3.2 Auth Controller — Register
  - `backend/controllers/authController.js` fungsi `register`
  - Validasi semua field tidak kosong, password match
  - Cek duplikat email & username
  - Hash password, buat user dengan isVerified=false
  - Generate OTP, simpan ke user, kirim via emailService
  - Rate limit: 5x/IP/15 menit (gunakan express-rate-limit di middleware)

- [x] 3.3 Auth Controller — Verify OTP
  - Fungsi `verifyOtp` di authController
  - Validasi kode OTP terhadap DB, cek expiry
  - Jika benar → isVerified=true, hapus otpCode & otpExpiry
  - Jika salah → increment otpAttempts, return 400
  - Jika expired → return 400 dengan offer resend
  - Rate limit: 5x/akun/15 menit

- [x] 3.4 Auth Controller — Resend OTP
  - Fungsi `resendOtp` di authController
  - Generate OTP baru, timpa kode lama, kirim ulang email

- [x] 3.5 Auth Controller — Login
  - Fungsi `login` di authController
  - Cari user by email, compare password
  - Cek isVerified
  - Jika ok → sign JWT, set httpOnly cookie
  - Rate limit: 5x gagal/akun/15 menit

- [x] 3.6 Auth Controller — Logout
  - Fungsi `logout` — clear cookie JWT

- [x] 3.7 Auth Controller — Forgot & Reset Password
  - `forgotPassword`: cari user by email, generate OTP, kirim email
  - `verifyResetOtp`: validasi OTP
  - `resetPassword`: update password hash, hapus OTP

- [x] 3.8 Auth Routes
  - `backend/routes/authRoutes.js`
  - Mount semua auth endpoints ke `/api/auth`

---

### Phase 4: Middleware

- [x] 4.1 Auth middleware (JWT guard)
  - `backend/middleware/authMiddleware.js`
  - Baca JWT dari httpOnly cookie
  - Verify dengan `jwtUtil.verifyToken()`
  - Attach `req.user` (userId, role)
  - Return 401 jika tidak valid

- [x] 4.2 Admin middleware (role guard)
  - `backend/middleware/adminMiddleware.js`
  - Cek `req.user.role === 'admin'`
  - Return 403 jika bukan admin

- [x] 4.3 Global error handler middleware
  - `backend/middleware/errorHandler.js`
  - Catch semua error, format response `{ success, message, code }`

---

### Phase 5: Prediction Feature (Backend)

- [x] 5.1 Prediction client service
  - `backend/services/predictionClient.js`
  - `callPredict(features)` — HTTP POST ke `PREDICTION_SERVICE_URL/predict`
  - Timeout 10 detik
  - Error handling jika service down → throw 503

- [x] 5.2 Prediction controller
  - `backend/controllers/predictController.js`
  - Fungsi `predict`: validasi input ranges, call predictionClient, simpan ke Prediction collection, return result
  - Fungsi `getHistory`: ambil semua prediksi user sorted by date desc

- [x] 5.3 Prediction routes
  - `backend/routes/predictRoutes.js`
  - POST `/` → predict (auth middleware)
  - GET `/history` → getHistory (auth middleware)
  - Mount ke `/api/predict`

- [x] 5.4 Prediction_Service Flask app
  - `prediction_service/app.py` — implementasi lengkap
  - Load model XGBoost dari `MODELS_DIR/Model_XGB_Burnout_V1.pkl`
  - POST `/predict`: parse JSON, validasi 10 field numerik, run model, return burnout_level + confidence + recommendation
  - Rekomendasi: Low → tips jaga keseimbangan, Medium → saran perbaikan, High → saran kurangi beban
  - GET `/health`: return `{"status": "ok"}`
  - Return 400 untuk input invalid/tidak lengkap

---

### Phase 6: LLM Chat + RAG (Backend)

- [x] 6.1 RAG Service
  - `backend/services/ragService.js`
  - Load `data.json` ke memory saat module pertama kali di-require
  - Fungsi `findRelevantContext(query)` — keyword overlap scoring
  - Return: `{ context, confidence (0-100), source }` atau `{ context: null, confidence: 0, source: null }`

- [x] 6.2 Chat controller
  - `backend/controllers/chatController.js`
  - Fungsi `sendMessage`:
    - Cari konteks via ragService
    - Jika confidence >= 40 → sertakan context ke Groq API prompt
    - Jika confidence < 40 → langsung return fallback message
    - Simpan record ke ChatMessage collection
    - Return response + ragConfidence + ragSource
  - Fungsi `getChatHistory`: ambil riwayat chat user

- [x] 6.3 Chat routes
  - `backend/routes/chatRoutes.js`
  - POST `/` → sendMessage (auth middleware)
  - GET `/history` → getChatHistory (auth middleware)
  - Mount ke `/api/chat`

---

### Phase 7: Dashboard, Export, Admin (Backend)

- [x] 7.1 Dashboard controller
  - `backend/controllers/dashboardController.js`
  - GET `/`: return total prediksi, prediksi terakhir (burnout_level, confidence, date), daftar riwayat 30 terbaru

- [x] 7.2 Export service
  - `backend/services/exportService.js`
  - `generateCsv(predictions)` — buat string CSV dengan header + rows
  - `generatePdf(predictions, userName)` — buat PDF dengan pdfkit, sertakan disclaimer

- [x] 7.3 Export controller & routes
  - `backend/controllers/exportController.js` — GET csv, GET pdf
  - `backend/routes/exportRoutes.js` — mount ke `/api/export` (auth middleware)

- [x] 7.4 Admin controller & routes
  - `backend/controllers/adminController.js`
  - GET `/stats`: aggregate total users, total predictions, distribusi burnout_level (persentase)
  - `backend/routes/adminRoutes.js` — mount ke `/api/admin` (auth + admin middleware)

- [x] 7.5 Dashboard & admin routes mounting
  - `backend/routes/dashboardRoutes.js` — GET `/` (auth middleware), mount ke `/api/dashboard`
  - Mount semua routes di `backend/app.js`

---

### Phase 8: Frontend — Base & Auth Pages

- [x] 8.1 Base layout & Neubrutalism CSS
  - `frontend/css/main.css` — variabel warna, font (bold/mono), shadow offset hitam tebal, border solid hitam, background warna solid (kuning/merah/biru muda)
  - `frontend/css/components.css` — button, input, card, navbar, toast notification styles (Neubrutalism)
  - `frontend/js/api.js` — wrapper fetch dengan base URL, handle 401 redirect

- [x] 8.2 Landing Page
  - `frontend/pages/index.html`
  - Sections: Navbar (cek JWT untuk tampil nama/dashboard atau login/daftar), Hero, Penjelasan burnout, Fitur aplikasi, CTA, Disclaimer footer
  - `frontend/js/landing.js` — logic cek auth state untuk navbar

- [x] 8.3 Halaman Register
  - `frontend/pages/register.html` — form 5 field + submit
  - `frontend/js/register.js` — client-side validation, POST `/api/auth/register`, redirect ke verify

- [x] 8.4 Halaman Verifikasi OTP
  - `frontend/pages/verify.html` — input 6 digit OTP + tombol resend
  - `frontend/js/verify.js` — POST `/api/auth/verify-otp`, countdown resend, POST `/api/auth/resend-otp`

- [x] 8.5 Halaman Login
  - `frontend/pages/login.html` — form email + password + link lupa password
  - `frontend/js/login.js` — POST `/api/auth/login`, redirect ke dashboard

- [x] 8.6 Halaman Lupa Password & Reset
  - `frontend/pages/forgot-password.html` + `frontend/pages/reset-password.html`
  - `frontend/js/forgot-password.js` + `frontend/js/reset-password.js`

---

### Phase 9: Frontend — App Pages

- [x] 9.1 Halaman Prediksi
  - `frontend/pages/predict.html` — form 10 field numerik + tombol Reset + Submit
  - Client-side validation (min/max per field)
  - `frontend/js/predict.js` — POST `/api/predict`, tampilkan hasil (Burnout_Level, Confidence, Rekomendasi) dalam card Neubrutalism

- [x] 9.2 Halaman Chat
  - `frontend/pages/chat.html` — chat UI (daftar pesan, input field, tombol send)
  - Tampilkan confidence RAG dan sumber di bawah setiap jawaban
  - `frontend/js/chat.js` — POST `/api/chat`, GET `/api/chat/history`, render chat

- [x] 9.3 Halaman Dashboard
  - `frontend/pages/dashboard.html` — card total prediksi, card prediksi terakhir, tabel riwayat terbaru
  - `frontend/js/dashboard.js` — GET `/api/dashboard`, render data

- [x] 9.4 Halaman History
  - `frontend/pages/history.html` — tabel lengkap riwayat prediksi, tombol Export CSV & PDF
  - `frontend/js/history.js` — GET `/api/predict/history`, GET `/api/export/csv`, GET `/api/export/pdf`

- [x] 9.5 Halaman Admin
  - `frontend/pages/admin.html` — card total users, total prediksi, pie/bar chart distribusi burnout
  - `frontend/js/admin.js` — GET `/api/admin/stats`, render statistik

---

### Phase 10: Property-Based Tests

- [x] 10.1 Auth property tests (Node.js)
  - `backend/tests/auth.property.test.js`
  - Implementasi Property 1: validasi form registrasi
  - Implementasi Property 2: password bcrypt hash
  - Implementasi Property 3: OTP format dan expiry
  - Implementasi Property 4: OTP round-trip
  - Implementasi Property 5: login → JWT cookie
  - Implementasi Property 16: reset password round-trip
  - Gunakan `fast-check` + `mongodb-memory-server`
  - Minimum 100 iterasi per property

- [x] 10.2 Prediction property tests (Node.js backend)
  - `backend/tests/predict.property.test.js`
  - Implementasi Property 6: protected endpoints 401
  - Implementasi Property 7: range validation input prediksi
  - Implementasi Property 9: riwayat prediksi round-trip
  - Mock `predictionClient` untuk testing terisolasi

- [x] 10.3 RAG & Chat property tests
  - `backend/tests/rag.property.test.js` — Property 11: RAG output format
  - `backend/tests/chat.property.test.js` — Property 12: chat history round-trip
  - Mock Groq API client

- [x] 10.4 Dashboard, Export, Admin property tests
  - `backend/tests/dashboard.property.test.js` — Property 10: dashboard aggregate akurat
  - `backend/tests/export.property.test.js` — Property 13: CSV round-trip
  - `backend/tests/admin.property.test.js` — Property 14: admin stats akurat, Property 15: non-admin 403

- [x] 10.5 Prediction_Service property tests (Python)
  - `prediction_service/tests/test_predict.py`
  - Implementasi Property 8: output format valid (burnout_level, confidence range, recommendation non-empty)
  - Gunakan `hypothesis` + `pytest`
  - Minimum 100 iterasi

---

### Phase 11: Integration Tests & Final Wiring

- [x] 11.1 Backend integration tests
  - Test auth end-to-end: register → verify OTP → login → access protected route
  - Test rate limiting: 6 percobaan login gagal → 429
  - Test admin access control: user biasa → 403, admin → 200
  - Test Prediction_Service down → 503 response

- [x] 11.2 Validasi koneksi Prediction_Service ke backend
  - Pastikan backend bisa memanggil Prediction_Service di lokal
  - Test health check `/health`

- [x] 11.3 Final frontend-backend wiring check
  - Pastikan semua fetch di frontend menggunakan path API yang benar
  - Pastikan redirect setelah login/logout benar
  - Pastikan halaman auth-protected redirect ke login jika tidak ada JWT
