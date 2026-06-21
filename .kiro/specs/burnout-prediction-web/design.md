# Design Document — Burnout Prediction Web

## Overview

Aplikasi web burnout prediction programmer adalah sistem multi-layer yang terdiri dari tiga komponen utama yang berjalan secara independen namun saling terhubung:

1. **Frontend** — HTML/CSS/JS Vanilla dengan UI Neubrutalism, di-serve secara statis atau melalui Node.js
2. **Backend (Node.js + Express)** — API utama yang menangani auth, business logic, komunikasi ke Prediction_Service, dan interaksi dengan MongoDB Atlas
3. **Prediction_Service (Python Flask)** — Microservice terisolasi yang menjalankan model XGBoost untuk inferensi burnout

Alur data utama:
- User mengakses frontend → frontend memanggil REST API backend
- Backend memvalidasi JWT, kemudian meneruskan request ke Prediction_Service atau Groq API sesuai kebutuhan
- Semua state persisten disimpan di MongoDB Atlas

Fitur utama yang harus dibangun:
- Auth lengkap: register → OTP email → login → JWT session
- Prediksi burnout dengan 10 fitur input
- Chat LLM dengan RAG berbasis data.json
- Dashboard riwayat + grafik trend
- Ekspor PDF/CSV
- Panel admin statistik
- UI Neubrutalism konsisten di seluruh halaman

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Frontend)                        │
│  frontend/                                                       │
│  ├── pages/         (landing, auth, predict, chat, dashboard)   │
│  ├── css/           (neubrutalism styles)                        │
│  └── js/            (api client, UI logic per halaman)          │
└─────────────────────┬──────────────────────────────────────────┘
                      │ HTTP REST (fetch / XHR)
                      │ JWT via httpOnly cookie
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Node.js + Express)                     │
│  backend/                                                        │
│  ├── routes/        (auth, predict, chat, dashboard, admin)     │
│  ├── controllers/   (logika per domain)                         │
│  ├── middleware/    (authGuard, adminGuard, rateLimiter, cors)  │
│  ├── models/        (Mongoose schemas)                          │
│  ├── services/      (emailService, ragService, exportService)   │
│  ├── utils/         (jwtUtil, otpUtil, hashUtil)                │
│  └── data/          (data.json untuk RAG)                       │
└────────┬──────────────────────────────────┬───────────────────-─┘
         │ HTTP internal                    │ HTTPS external
         ▼                                  ▼
┌────────────────────┐          ┌──────────────────────────┐
│  Prediction_Service │          │   External Services       │
│  (Python Flask)     │          │  ├── Groq API (LLM)       │
│  prediction_service/│          │  ├── Gmail SMTP           │
│  ├── app.py         │          │  └── MongoDB Atlas        │
│  └── models/        │          └──────────────────────────┘
│    (pkl file)       │
└────────────────────┘
```

### Prinsip Arsitektur

- **Separation of concerns**: Setiap layer hanya tahu tentang layer di bawahnya, tidak ada logika bisnis di routes
- **Prediction_Service terisolasi**: Tidak terekspos ke publik, hanya bisa diakses oleh backend via environment variable `PREDICTION_SERVICE_URL`
- **Stateless backend**: Semua state di MongoDB, JWT di httpOnly cookie, tidak ada server-side session
- **RAG in-process**: data.json dimuat sekali ke memory di startup, pencarian dilakukan in-process tanpa dependency eksternal

---

## Components and Interfaces

### Frontend Pages

| Halaman | Path | Akses |
|---|---|---|
| Landing Page | `/` | Publik |
| Register | `/register` | Publik |
| Verifikasi OTP | `/verify` | Publik |
| Login | `/login` | Publik |
| Lupa Password | `/forgot-password` | Publik |
| Reset Password | `/reset-password` | Publik |
| Dashboard | `/dashboard` | Auth |
| Prediksi | `/predict` | Auth |
| Chat | `/chat` | Auth |
| Riwayat | `/history` | Auth |
| Admin | `/admin` | Admin |

### Backend REST API Endpoints

#### Auth Routes (`/api/auth`)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/register` | Registrasi akun baru |
| POST | `/verify-otp` | Verifikasi kode OTP |
| POST | `/resend-otp` | Kirim ulang OTP |
| POST | `/login` | Login, set JWT cookie |
| POST | `/logout` | Hapus JWT cookie |
| POST | `/forgot-password` | Request OTP reset password |
| POST | `/reset-password` | Submit password baru |

#### Prediction Routes (`/api/predict`)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/` | Kirim 10 fitur, dapatkan prediksi |
| GET | `/history` | Ambil riwayat prediksi user |

#### Chat Routes (`/api/chat`)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/` | Kirim pesan, dapatkan jawaban LLM+RAG |
| GET | `/history` | Ambil riwayat chat user |

#### Dashboard Routes (`/api/dashboard`)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` | Summary: total prediksi, prediksi terakhir |

#### Export Routes (`/api/export`)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/csv` | Download CSV riwayat prediksi |
| GET | `/pdf` | Download PDF riwayat prediksi |

#### Admin Routes (`/api/admin`)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/stats` | Statistik: user, prediksi, distribusi burnout |

### Prediction Service API (Internal)

**Base URL**: `http://localhost:5001` (konfigurasi via `PREDICTION_SERVICE_URL`)

| Method | Path | Request Body | Response |
|---|---|---|---|
| POST | `/predict` | `{ age, experience_years, daily_work_hours, sleep_hours, caffeine_intake, bugs_per_day, commits_per_day, meetings_per_day, screen_time, exercise_hours }` | `{ burnout_level, confidence, recommendation }` |
| GET | `/health` | — | `{ status: "ok" }` |

### Service Layer (Backend Internal)

- **emailService**: Nodemailer + Gmail SMTP, metode `sendOtp(email, code)` dan `sendPasswordReset(email, code)`
- **ragService**: Memuat `data.json` saat startup, metode `findRelevantContext(query)` mengembalikan `{ context, confidence, source }`
- **exportService**: Menghasilkan CSV (manual string join) dan PDF (menggunakan `pdfkit`), metode `generateCsv(predictions)` dan `generatePdf(predictions, userName)`
- **predictionClient**: HTTP client ke Prediction_Service, metode `callPredict(features)` dengan error handling jika service down

---

## Data Models

### User (MongoDB — `users` collection)

```js
{
  _id: ObjectId,
  name: String,           // required
  username: String,       // required, unique, lowercase
  email: String,          // required, unique, lowercase
  password: String,       // bcrypt hash
  role: String,           // 'user' | 'admin', default: 'user'
  isVerified: Boolean,    // default: false
  otpCode: String,        // 6-digit code (null jika tidak ada pending OTP)
  otpExpiry: Date,        // expired timestamp OTP
  otpAttempts: Number,    // jumlah percobaan OTP, reset tiap OTP baru
  loginAttempts: Number,  // jumlah login gagal
  loginLockUntil: Date,   // null atau timestamp unlock
  createdAt: Date,
  updatedAt: Date
}
```

### Prediction (MongoDB — `predictions` collection)

```js
{
  _id: ObjectId,
  userId: ObjectId,       // ref: User
  inputs: {
    age: Number,
    experience_years: Number,
    daily_work_hours: Number,
    sleep_hours: Number,
    caffeine_intake: Number,
    bugs_per_day: Number,
    commits_per_day: Number,
    meetings_per_day: Number,
    screen_time: Number,
    exercise_hours: Number
  },
  burnout_level: String,  // 'Low' | 'Medium' | 'High'
  confidence: Number,     // 0.0 – 1.0
  recommendation: String,
  createdAt: Date
}
```

### ChatMessage (MongoDB — `chat_messages` collection)

```js
{
  _id: ObjectId,
  userId: ObjectId,       // ref: User
  userMessage: String,
  assistantResponse: String,
  ragConfidence: Number,  // 0.0 – 1.0
  ragSource: String,      // nama bagian dari data.json, misal: "burnout_causes"
  createdAt: Date
}
```

### data.json Structure (RAG)

```json
[
  {
    "section": "burnout_causes",
    "content": "Burnout programmer biasanya dipicu oleh jam kerja yang tinggi...",
    "keywords": ["jam kerja", "burnout", "kelelahan", "penyebab"]
  },
  {
    "section": "sleep_recommendation",
    "content": "Tidur 7–9 jam per malam sangat penting untuk pemulihan...",
    "keywords": ["tidur", "istirahat", "sleep"]
  }
]
```

Similarity matching menggunakan **keyword overlap scoring**: jumlah keyword yang cocok dibagi total keyword, hasilnya dikalikan 100 menjadi confidence score (0–100).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

Sebelum menulis properti, dilakukan konsolidasi untuk menghilangkan redundansi:

- **2.5 + 12.1** (password hashing): Keduanya menguji bahwa password di-hash bcrypt saat disimpan. Digabung menjadi satu property "Password selalu di-hash sebelum disimpan".
- **3.1 + 3.2** (OTP validation): 3.1 menguji validasi kode, 3.2 menguji efek samping isVerified=true. Keduanya adalah bagian dari flow yang sama, bisa menjadi satu property "OTP round-trip verification".
- **6.7 + 9.1** (prediction persistence + dashboard count): 6.7 memverifikasi data tersimpan, 9.1 memverifikasi aggregation. Sedikit berbeda — dipertahankan terpisah.
- **8.2 + 8.3** (RAG retrieval + response format): Keduanya menguji output dari proses yang sama. Digabung menjadi satu property "RAG retrieval menghasilkan output berformat valid".
- **2.6 + 5.2** (OTP generation): Keduanya menguji bahwa OTP yang digenerate adalah 6 digit dan expiry 10 menit. Digabung menjadi satu property "OTP selalu valid format dan expiry".
- **4.2 + 12.3** (JWT issuance + JWT validation): Satu menguji bahwa JWT dikeluarkan, satu menguji bahwa JWT divalidasi. Berbeda sudut — dipertahankan terpisah.
- **2.2 + 6.3** (input validation): Keduanya menguji validasi input. Lingkup berbeda (form fields vs numeric ranges) — dipertahankan terpisah.

Setelah reflection, property yang dipertahankan:

1. Validasi form registrasi menolak input tidak lengkap/invalid
2. Password selalu di-hash bcrypt sebelum disimpan (menggabungkan 2.5 + 12.1)
3. OTP selalu 6 digit dan expiry tepat 10 menit (menggabungkan 2.6 + 5.2)
4. OTP round-trip: kode yang benar → isVerified=true, kode lama tidak valid setelah resend (menggabungkan 3.1 + 3.2 + 3.5)
5. JWT diterbitkan untuk verified user yang login (4.2)
6. Protected endpoints menolak request tanpa JWT valid (12.3)
7. Input prediksi divalidasi sesuai min/max range (6.3)
8. Prediction response selalu mengandung burnout_level, confidence, recommendation (7.2)
9. Riwayat prediksi tersimpan dan bisa diambil kembali (6.7)
10. Dashboard aggregate akurat sesuai jumlah prediksi (9.1)
11. RAG retrieval menghasilkan output berformat valid dengan confidence dan source (8.2+8.3)
12. Riwayat chat tersimpan per user (8.5)
13. Export CSV round-trip: data yang diekspor bisa diparsing kembali (10.2)
14. Admin stats menampilkan aggregasi yang akurat (11.2)
15. Non-admin user selalu mendapat 403 saat akses panel admin (11.3)
16. Reset password memperbarui hash dan kode lama tidak valid (5.4)

---

### Property 1: Validasi Registrasi Menolak Input Invalid

*For any* kombinasi input registrasi di mana minimal satu field kosong atau password tidak cocok dengan confirm password, Auth_Service SHALL menolak request dan tidak membuat user baru di database.

**Validates: Requirements 2.2**

---

### Property 2: Password Selalu Di-hash Sebelum Disimpan

*For any* password yang dikirimkan saat registrasi, nilai yang tersimpan di database SHALL bukan plaintext, dapat diverifikasi dengan `bcrypt.compare()`, dan menggunakan salt rounds minimal 10.

**Validates: Requirements 2.5, 12.1**

---

### Property 3: OTP Selalu 6 Digit dan Expiry Tepat 10 Menit

*For any* event yang membuat OTP baru (registrasi, resend, forgot password), kode yang tersimpan SHALL selalu terdiri dari tepat 6 digit numerik, dan `otpExpiry` SHALL selalu berada dalam rentang `(now, now + 10 menit]`.

**Validates: Requirements 2.6, 5.2**

---

### Property 4: OTP Round-Trip — Kode Benar Memverifikasi, Kode Lama Tidak Valid Setelah Resend

*For any* user yang baru melakukan registrasi atau resend OTP, mengirimkan kode OTP yang benar SHALL mengubah `isVerified` menjadi `true`. Setelah resend, kode OTP sebelumnya SHALL tidak lagi valid untuk verifikasi.

**Validates: Requirements 3.1, 3.2, 3.5**

---

### Property 5: Login Verified User Menghasilkan JWT di httpOnly Cookie

*For any* user dengan `isVerified = true` yang mengirimkan kredensial yang benar, Auth_Service SHALL menghasilkan JWT yang valid dan menyimpannya di httpOnly cookie pada response.

**Validates: Requirements 4.2**

---

### Property 6: Protected Endpoints Menolak Request Tanpa JWT Valid

*For any* request ke endpoint yang dilindungi (predict, chat, dashboard, history, admin) yang tidak membawa JWT atau membawa JWT yang tidak valid/kedaluwarsa, sistem SHALL mengembalikan HTTP status 401.

**Validates: Requirements 12.3, 6.1, 6.8, 8.1, 9.1**

---

### Property 7: Validasi Range Input Prediksi

*For any* kombinasi nilai input prediksi, input di mana minimal satu field berada di luar batas yang ditentukan SHALL ditolak dengan HTTP 400. Input di mana semua field berada dalam range yang valid SHALL diterima.

Batas valid:
- age: 18–80, experience_years: 0–50, daily_work_hours: 1–24, sleep_hours: 1–12
- caffeine_intake: 0–20, bugs_per_day: 0–100, commits_per_day: 0–100
- meetings_per_day: 0–20, screen_time: 1–24, exercise_hours: 0–12

**Validates: Requirements 6.3**

---

### Property 8: Prediction_Service Selalu Mengembalikan Response Berformat Valid

*For any* valid feature vector dengan 10 nilai numerik dalam range yang diizinkan, Prediction_Service SHALL mengembalikan response dengan `burnout_level` ∈ {Low, Medium, High}, `confidence` ∈ [0.0, 1.0], dan `recommendation` sebagai string non-kosong.

**Validates: Requirements 7.2, 7.5**

---

### Property 9: Riwayat Prediksi Tersimpan dan Dapat Diambil Kembali

*For any* prediksi yang berhasil dilakukan oleh user, semua data prediksi (timestamp, 10 nilai input, burnout_level, confidence) SHALL tersimpan di database dan dapat diambil kembali secara utuh melalui history endpoint.

**Validates: Requirements 6.7**

---

### Property 10: Dashboard Aggregate Akurat Sesuai Data Aktual

*For any* jumlah N prediksi yang dimiliki user, dashboard SHALL menampilkan total prediksi = N, dan prediksi terakhir SHALL sesuai dengan prediksi paling baru berdasarkan timestamp.

**Validates: Requirements 9.1**

---

### Property 11: RAG Retrieval Menghasilkan Output Berformat Valid

*For any* string query yang dikirimkan ke `ragService.findRelevantContext()`, output SHALL selalu mengandung `confidence` ∈ [0, 100], dan `source` sebagai string non-kosong atau null bila tidak ada konteks.

**Validates: Requirements 8.2, 8.3**

---

### Property 12: Riwayat Chat Tersimpan Per User

*For any* pesan chat yang berhasil dikirimkan oleh user, record percakapan yang mencakup `userMessage`, `assistantResponse`, `ragConfidence`, dan `ragSource` SHALL tersimpan di database dan dapat diambil kembali oleh user yang sama.

**Validates: Requirements 8.5**

---

### Property 13: Export CSV Round-Trip

*For any* daftar riwayat prediksi user, file CSV yang dihasilkan SHALL dapat diparsing kembali menjadi baris data yang identik dengan data asli, mencakup semua 10 nilai input, burnout_level, confidence, dan timestamp.

**Validates: Requirements 10.2**

---

### Property 14: Admin Stats Menampilkan Aggregasi Akurat

*For any* state database dengan jumlah user U dan prediksi P yang terdistribusi dalam kategori Low/Medium/High, admin stats endpoint SHALL mengembalikan total_users = U, total_predictions = P, dan distribusi persentase yang benar.

**Validates: Requirements 11.2**

---

### Property 15: Non-Admin User Selalu Mendapat 403 di Admin Endpoints

*For any* request ke `/api/admin/*` yang membawa JWT dari user dengan role `user` (bukan `admin`), sistem SHALL selalu mengembalikan HTTP status 403.

**Validates: Requirements 11.3**

---

### Property 16: Reset Password Memperbarui Hash dan Invalidasi Kode Lama

*For any* user yang berhasil melakukan reset password dengan password baru yang valid, password baru SHALL dapat digunakan untuk login, password lama SHALL tidak dapat digunakan untuk login, dan kode OTP reset SHALL tidak valid lagi.

**Validates: Requirements 5.4**

---

## Error Handling

### Backend Error Strategy

Semua error di-handle menggunakan middleware terpusat `errorHandler` yang mengembalikan response JSON dengan format konsisten:

```json
{
  "success": false,
  "message": "Deskripsi error yang user-friendly",
  "code": "ERROR_CODE"
}
```

### Error Categories

| Skenario | HTTP Status | Pesan |
|---|---|---|
| Input validation gagal | 400 | Field-specific error messages |
| JWT tidak ada / tidak valid | 401 | "Sesi tidak valid, silakan login kembali" |
| JWT valid tapi role tidak cukup | 403 | "Akses ditolak" |
| Resource tidak ditemukan | 404 | "Data tidak ditemukan" |
| Rate limit tercapai | 429 | "Terlalu banyak percobaan, coba lagi setelah X menit" |
| Prediction_Service down | 503 | "Layanan prediksi tidak tersedia. Coba lagi nanti." |
| Groq API error | 503 | "Layanan chat sedang tidak tersedia. Coba lagi nanti." |
| Server internal error | 500 | "Terjadi kesalahan server" |

### Prediction_Service Error Handling

- Backend memanggil Prediction_Service dengan timeout 10 detik
- Jika timeout atau connection refused → return 503 ke client
- Prediction_Service sendiri return 400 untuk input invalid dengan pesan deskriptif field mana yang salah

### Groq API Error Handling

- Timeout 30 detik untuk panggilan LLM
- Jika Groq API gagal → return fallback message tanpa error ke user, log error server-side
- Rate limit Groq → queue atau return 503

### OTP Security

- OTP disimpan sebagai plaintext di DB (6 digit, bukan data sensitif tinggi)
- Setelah verifikasi berhasil, `otpCode` dan `otpExpiry` di-set null
- Setelah resend, kode lama langsung ditimpa

---

## Testing Strategy

### Dual Testing Approach

Kombinasi **unit/integration tests** dan **property-based tests** untuk coverage komprehensif.

### Property-Based Testing

Library yang digunakan: **fast-check** (JavaScript/Node.js) untuk backend, **hypothesis** (Python) untuk Prediction_Service.

Setiap property test dikonfigurasi minimum **100 iterasi**. Setiap test di-tag dengan komentar mengacu pada property di dokumen ini:

```
// Feature: burnout-prediction-web, Property N: <property_text>
```

**Property tests yang akan diimplementasikan** (sesuai Correctness Properties):

| Property | File Test | Library |
|---|---|---|
| P1: Validasi form registrasi | `backend/tests/auth.property.test.js` | fast-check |
| P2: Password bcrypt hash | `backend/tests/auth.property.test.js` | fast-check |
| P3: OTP format dan expiry | `backend/tests/auth.property.test.js` | fast-check |
| P4: OTP round-trip | `backend/tests/auth.property.test.js` | fast-check |
| P5: Login → JWT cookie | `backend/tests/auth.property.test.js` | fast-check |
| P6: Protected endpoints 401 | `backend/tests/auth.property.test.js` | fast-check |
| P7: Range validation prediksi | `backend/tests/predict.property.test.js` | fast-check |
| P8: Prediction_Service output format | `prediction_service/tests/test_predict.py` | hypothesis |
| P9: Riwayat prediksi round-trip | `backend/tests/predict.property.test.js` | fast-check |
| P10: Dashboard aggregate | `backend/tests/dashboard.property.test.js` | fast-check |
| P11: RAG retrieval output | `backend/tests/rag.property.test.js` | fast-check |
| P12: Chat history round-trip | `backend/tests/chat.property.test.js` | fast-check |
| P13: CSV export round-trip | `backend/tests/export.property.test.js` | fast-check |
| P14: Admin stats aggregate | `backend/tests/admin.property.test.js` | fast-check |
| P15: Non-admin 403 | `backend/tests/admin.property.test.js` | fast-check |
| P16: Reset password round-trip | `backend/tests/auth.property.test.js` | fast-check |

### Unit / Integration Tests

- **Auth flow**: Test register → verify OTP → login → logout sebagai sequence
- **Rate limiting**: Verifikasi 5 percobaan gagal → 429 pada percobaan ke-6
- **Prediction_Service**: Test dengan input invalid (field hilang, non-numerik)
- **RAG fallback**: Query tidak relevan → confidence < 40% → fallback response
- **Export PDF**: Verifikasi Content-Type `application/pdf` dan response non-empty
- **Admin access control**: User biasa → 403, Admin user → 200

### Smoke Tests (Manual / CI)

- Landing page menampilkan semua elemen yang diperlukan
- Form registrasi memiliki semua 5 field
- Disclaimer ada di landing page
- Export PDF menghasilkan file valid

### Test Database

Gunakan MongoDB in-memory (`mongodb-memory-server`) untuk semua backend tests agar tidak mempengaruhi data Atlas production.

### Prediction_Service Testing

Gunakan **pytest + hypothesis** untuk property tests:
```python
# Feature: burnout-prediction-web, Property 8: Prediction_Service output format valid
@given(st.fixed_dictionaries({
    'age': st.floats(18, 80),
    'experience_years': st.floats(0, 50),
    ...
}))
def test_predict_output_format(features):
    response = client.post('/predict', json=features)
    assert response.status_code == 200
    assert response.json['burnout_level'] in ['Low', 'Medium', 'High']
    assert 0.0 <= response.json['confidence'] <= 1.0
    assert len(response.json['recommendation']) > 0
```
