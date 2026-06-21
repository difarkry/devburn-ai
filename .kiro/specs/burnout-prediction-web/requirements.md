# Requirements Document

## Introduction

Aplikasi web prediksi burnout programmer berbasis machine learning yang memungkinkan pengguna mengisi form data kebiasaan kerja dan mendapatkan prediksi tingkat burnout (Low/Medium/High). Aplikasi dilengkapi dengan fitur autentikasi lengkap, chatbot berbasis LLM (Groq) dengan RAG, dashboard riwayat prediksi, panel admin, dan ekspor data. UI menggunakan gaya Neubrutalism. Backend utama menggunakan Node.js/Express, model prediksi menggunakan Python Flask, dan database menggunakan MongoDB Atlas.

## Glossary

- **System**: Aplikasi web burnout prediction secara keseluruhan
- **Auth_Service**: Komponen yang menangani registrasi, login, verifikasi OTP, dan manajemen sesi JWT
- **Prediction_Service**: Komponen Python Flask yang menjalankan model XGBoost untuk prediksi burnout
- **Chat_Service**: Komponen yang mengelola interaksi LLM (Groq API) dengan RAG dari data.json
- **User**: Pengguna terdaftar yang telah melewati verifikasi OTP
- **Admin**: Pengguna dengan role `admin` yang dapat melihat statistik sistem
- **OTP**: Kode verifikasi satu kali pakai yang dikirim via email, berlaku 10 menit
- **RAG**: Retrieval-Augmented Generation — teknik pencarian konteks dari data.json untuk memperkaya jawaban LLM
- **Burnout_Level**: Hasil klasifikasi tingkat burnout: Low, Medium, atau High
- **Confidence**: Nilai probabilitas prediksi model dalam bentuk persentase (0–100%)
- **isVerified**: Status boolean pada dokumen User yang menandakan email telah diverifikasi via OTP
- **JWT**: JSON Web Token yang digunakan sebagai token sesi pengguna setelah login
- **Dashboard**: Halaman ringkasan data prediksi pengguna yang terautentikasi

---

## Requirements

### Requirement 1: Landing Page

**User Story:** As a visitor, I want to see a landing page that explains the application, so that I can understand the purpose of the app before registering.

#### Acceptance Criteria

1. THE System SHALL menampilkan halaman landing yang berisi Navbar, Hero section, penjelasan burnout programmer, daftar fitur aplikasi, dan tombol navigasi ke halaman Login dan Daftar.
2. WHEN visitor belum login, THE Navbar SHALL menampilkan tombol "Login" dan "Daftar".
3. WHEN visitor sudah login, THE Navbar SHALL menampilkan nama pengguna dan tombol "Dashboard".
4. THE System SHALL menampilkan disclaimer bahwa aplikasi ini bukan alat diagnosis medis dan hanya berbasis prediksi data.

---

### Requirement 2: Registrasi Akun

**User Story:** As a visitor, I want to register a new account, so that I can access the prediction and chat features.

#### Acceptance Criteria

1. THE Auth_Service SHALL menyediakan form registrasi dengan field: nama, username, email, password, dan confirm password.
2. WHEN visitor mengirimkan form registrasi, THE Auth_Service SHALL memvalidasi bahwa semua field tidak kosong dan password cocok dengan confirm password.
3. WHEN email yang dimasukkan sudah terdaftar, THE Auth_Service SHALL mengembalikan pesan error "Email sudah digunakan".
4. WHEN username yang dimasukkan sudah terdaftar, THE Auth_Service SHALL mengembalikan pesan error "Username sudah digunakan".
5. WHEN registrasi berhasil divalidasi, THE Auth_Service SHALL menyimpan akun dengan status `isVerified = false` dan password yang di-hash menggunakan bcrypt.
6. WHEN registrasi berhasil, THE Auth_Service SHALL mengirim kode OTP 6 digit ke email pengguna dengan masa berlaku 10 menit.
7. THE Auth_Service SHALL membatasi maksimal 5 percobaan registrasi per IP dalam 15 menit (rate limiting).

---

### Requirement 3: Verifikasi OTP

**User Story:** As a registered user, I want to verify my email via OTP, so that I can activate my account and access the app.

#### Acceptance Criteria

1. WHEN pengguna mengirimkan kode OTP, THE Auth_Service SHALL memvalidasi kode tersebut terhadap kode yang tersimpan di database untuk akun yang bersangkutan.
2. WHEN kode OTP benar dan belum kedaluwarsa, THE Auth_Service SHALL mengubah status `isVerified` menjadi `true` dan mengarahkan pengguna ke halaman login.
3. WHEN kode OTP salah, THE Auth_Service SHALL mengembalikan pesan error "Kode OTP salah".
4. WHEN kode OTP sudah kedaluwarsa (lebih dari 10 menit), THE Auth_Service SHALL mengembalikan pesan error "Kode OTP sudah kedaluwarsa" dan menawarkan opsi kirim ulang.
5. WHEN pengguna meminta kirim ulang OTP, THE Auth_Service SHALL membuat kode OTP baru, menginvalidasi kode lama, dan mengirim kode baru ke email pengguna.
6. THE Auth_Service SHALL membatasi maksimal 5 percobaan verifikasi OTP per akun dalam 15 menit (rate limiting).

---

### Requirement 4: Login

**User Story:** As a verified user, I want to log in with my credentials, so that I can access the prediction and chat features.

#### Acceptance Criteria

1. THE Auth_Service SHALL menyediakan form login dengan field email dan password.
2. WHEN pengguna mengirimkan form login dengan kredensial yang benar dan `isVerified = true`, THE Auth_Service SHALL menghasilkan JWT dan menyimpannya di httpOnly cookie dengan durasi sesuai `JWT_EXPIRED`.
3. WHEN pengguna mengirimkan form login dengan email atau password yang salah, THE Auth_Service SHALL mengembalikan pesan error "Email atau password salah".
4. WHEN pengguna mencoba login dengan akun yang memiliki `isVerified = false`, THE Auth_Service SHALL mengembalikan pesan error "Akun belum diverifikasi" dan menawarkan opsi kirim ulang OTP.
5. THE Auth_Service SHALL membatasi maksimal 5 percobaan login yang gagal per akun dalam 15 menit (rate limiting).
6. WHEN pengguna memilih logout, THE Auth_Service SHALL menghapus JWT dari cookie dan mengakhiri sesi.

---

### Requirement 5: Lupa Password

**User Story:** As a user, I want to reset my password via email, so that I can regain access if I forget my password.

#### Acceptance Criteria

1. THE Auth_Service SHALL menyediakan halaman "Lupa Password" dengan field input email.
2. WHEN pengguna mengirimkan email yang terdaftar, THE Auth_Service SHALL mengirim kode OTP reset password ke email tersebut dengan masa berlaku 10 menit.
3. WHEN pengguna memasukkan kode OTP yang benar, THE Auth_Service SHALL menampilkan form input password baru dan konfirmasi password.
4. WHEN pengguna mengirimkan password baru yang valid (minimal 8 karakter), THE Auth_Service SHALL memperbarui password dengan hash bcrypt baru dan menginvalidasi kode OTP.
5. IF email yang dimasukkan tidak terdaftar, THEN THE Auth_Service SHALL mengembalikan pesan error "Email tidak ditemukan".

---

### Requirement 6: Prediksi Burnout

**User Story:** As a verified user, I want to input my work habits and receive a burnout prediction, so that I can assess my burnout risk level.

#### Acceptance Criteria

1. WHILE pengguna memiliki status `isVerified = true` dan sesi JWT valid, THE System SHALL mengizinkan akses ke halaman prediksi.
2. THE System SHALL menampilkan form prediksi dengan 10 field input: `age`, `experience_years`, `daily_work_hours`, `sleep_hours`, `caffeine_intake`, `bugs_per_day`, `commits_per_day`, `meetings_per_day`, `screen_time`, dan `exercise_hours`.
3. THE System SHALL memvalidasi setiap field input dengan batasan nilai minimum dan maksimum sebagai berikut:
   - `age`: 18–80
   - `experience_years`: 0–50
   - `daily_work_hours`: 1–24
   - `sleep_hours`: 1–12
   - `caffeine_intake`: 0–20
   - `bugs_per_day`: 0–100
   - `commits_per_day`: 0–100
   - `meetings_per_day`: 0–20
   - `screen_time`: 1–24
   - `exercise_hours`: 0–12
4. THE System SHALL menyediakan tombol reset form yang mengosongkan semua field input.
5. WHEN pengguna mengirimkan form yang valid, THE System SHALL mengirim data ke Prediction_Service dan menampilkan hasil berupa: Burnout_Level (Low/Medium/High), nilai Confidence dalam persen, dan rekomendasi singkat berbasis hasil prediksi.
6. WHEN Prediction_Service tidak dapat diakses, THE System SHALL menampilkan pesan error "Layanan prediksi tidak tersedia. Coba lagi nanti."
7. WHEN prediksi berhasil, THE System SHALL menyimpan riwayat prediksi ke database yang mencakup: timestamp, nilai 10 field input, Burnout_Level, dan nilai Confidence.
8. IF pengguna mengakses halaman prediksi tanpa sesi JWT yang valid, THEN THE System SHALL mengarahkan pengguna ke halaman login.

---

### Requirement 7: Layanan Prediksi (Python Flask)

**User Story:** As the system, I want a dedicated Python service to run the ML model, so that burnout predictions are accurate and isolated from the main backend.

#### Acceptance Criteria

1. THE Prediction_Service SHALL memuat model XGBoost dari `MODEL_PATH` saat inisialisasi.
2. WHEN Prediction_Service menerima request POST dengan 10 nilai fitur numerik yang valid, THE Prediction_Service SHALL mengembalikan `burnout_level` (Low/Medium/High) dan nilai `confidence` (0.0–1.0).
3. WHEN input yang diterima tidak lengkap atau mengandung nilai non-numerik, THE Prediction_Service SHALL mengembalikan response error dengan HTTP status 400 dan pesan deskriptif.
4. THE Prediction_Service SHALL hanya dapat diakses dari Node.js backend (tidak terekspos langsung ke publik).
5. THE Prediction_Service SHALL mengembalikan rekomendasi singkat berdasarkan Burnout_Level: "Low" → tips menjaga keseimbangan, "Medium" → saran perbaikan kebiasaan, "High" → saran segera kurangi beban kerja.

---

### Requirement 8: LLM Chat dengan RAG

**User Story:** As a verified user, I want to chat with an AI assistant about burnout, so that I can get personalized information and advice.

#### Acceptance Criteria

1. WHILE pengguna memiliki sesi JWT yang valid, THE Chat_Service SHALL mengizinkan akses ke fitur chat.
2. WHEN pengguna mengirim pesan, THE Chat_Service SHALL mencari konteks relevan dari `RAG_PATH` (data.json) menggunakan similarity matching dan menyertakannya sebagai konteks ke Groq API.
3. WHEN konteks relevan ditemukan, THE Chat_Service SHALL mengembalikan jawaban beserta nilai Confidence RAG (0–100%) dan nama bagian sumber dari data.json.
4. WHEN tidak ada konteks yang cukup relevan ditemukan (Confidence RAG < 40%), THE Chat_Service SHALL memberikan jawaban fallback: "Maaf, saya tidak menemukan informasi yang cukup relevan. Silakan konsultasikan dengan profesional kesehatan."
5. THE Chat_Service SHALL menyimpan riwayat percakapan per User di database, mencakup: pesan pengguna, jawaban sistem, Confidence RAG, dan sumber data.
6. THE Chat_Service SHALL menggunakan model `llama-3.3-70b-versatile` via Groq API dengan `GROQ_API_KEY` dari environment variable.
7. IF Groq API tidak dapat diakses, THEN THE Chat_Service SHALL mengembalikan pesan error "Layanan chat sedang tidak tersedia. Coba lagi nanti."

---

### Requirement 9: Dashboard Pengguna

**User Story:** As a verified user, I want to see a summary dashboard of my prediction history, so that I can track my burnout trend over time.

#### Acceptance Criteria

1. WHILE pengguna memiliki sesi JWT yang valid, THE System SHALL menampilkan dashboard dengan data: total jumlah prediksi, hasil prediksi terakhir (Burnout_Level dan Confidence), dan grafik atau daftar riwayat Burnout_Level dari waktu ke waktu.
2. THE System SHALL menampilkan riwayat prediksi lengkap dalam tabel yang mencakup kolom: tanggal, ringkasan input, Burnout_Level, dan Confidence.
3. WHEN pengguna belum memiliki riwayat prediksi, THE System SHALL menampilkan pesan "Belum ada riwayat prediksi. Mulai prediksi pertamamu!" dan tombol menuju halaman prediksi.

---

### Requirement 10: Ekspor Riwayat Prediksi

**User Story:** As a verified user, I want to export my prediction history, so that I can keep a personal record of my burnout data.

#### Acceptance Criteria

1. THE System SHALL menyediakan tombol ekspor di halaman riwayat prediksi dengan pilihan format PDF dan CSV.
2. WHEN pengguna memilih ekspor CSV, THE System SHALL menghasilkan file CSV yang berisi semua kolom riwayat prediksi: tanggal, 10 nilai input, Burnout_Level, dan Confidence.
3. WHEN pengguna memilih ekspor PDF, THE System SHALL menghasilkan file PDF yang berisi tabel riwayat prediksi dengan header dan disclaimer bahwa data ini bukan diagnosis medis.
4. WHEN pengguna tidak memiliki riwayat prediksi, THE System SHALL menonaktifkan tombol ekspor dan menampilkan tooltip "Tidak ada data untuk diekspor".

---

### Requirement 11: Panel Admin

**User Story:** As an admin, I want to view system statistics, so that I can monitor application usage and burnout trends.

#### Acceptance Criteria

1. WHILE pengguna memiliki role `admin` dan sesi JWT valid, THE System SHALL mengizinkan akses ke panel admin.
2. THE System SHALL menampilkan statistik: total jumlah User terdaftar, total prediksi yang dilakukan, dan distribusi Burnout_Level (persentase Low/Medium/High dari semua prediksi).
3. IF pengguna tanpa role `admin` mencoba mengakses panel admin, THEN THE System SHALL mengembalikan HTTP status 403 dan mengarahkan ke halaman dashboard.
4. THE System SHALL menampilkan data statistik yang diagregasi dan tidak menampilkan data sensitif pengguna seperti password, token, atau detail pribadi.

---

### Requirement 12: Keamanan dan Proteksi Akses

**User Story:** As the system, I want to enforce security measures, so that user data and access are protected.

#### Acceptance Criteria

1. THE Auth_Service SHALL meng-hash semua password menggunakan bcrypt dengan salt rounds minimal 10 sebelum disimpan ke database.
2. THE System SHALL menyimpan JWT di httpOnly cookie untuk mencegah akses dari JavaScript browser.
3. THE System SHALL memvalidasi JWT pada setiap request ke endpoint yang dilindungi sebelum memproses request tersebut.
4. WHEN JWT tidak valid atau kedaluwarsa, THE System SHALL mengembalikan HTTP status 401 dan mengarahkan pengguna ke halaman login.
5. THE System SHALL mengimplementasikan CORS yang membatasi origin yang diizinkan hanya dari domain frontend yang terdaftar.
