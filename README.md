# BurnoutPredictor

Aplikasi web prediksi burnout programmer berbasis Machine Learning (XGBoost) dengan fitur chat AI menggunakan RAG + Groq LLM.

## Fitur

- Registrasi & login dengan verifikasi OTP via email
- Prediksi burnout (Low / Medium / High) berbasis 10 parameter kebiasaan kerja
- Chat AI tentang burnout dengan konteks RAG dari knowledge base
- Dashboard & riwayat prediksi per user
- Export riwayat ke CSV / PDF
- Admin panel (statistik user & distribusi burnout)

## Struktur Proyek

```
├── backend/              Node.js + Express API
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── data/             Knowledge base (RAG)
├── frontend/             HTML/CSS/JS Vanilla (Neubrutalism UI)
│   ├── pages/
│   ├── js/
│   └── css/
└── prediction_service/   Python Flask ML service (XGBoost)
    ├── models/           File model .pkl
    └── tests/
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas account
- Akun Groq (untuk LLM API key)

## Setup Lokal

### 1. Clone repo

```bash
git clone https://github.com/difarkry/devburn-ai.git
cd burnout-predictor
```

### 2. Buat file `.env` di folder `backend/`

```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
JWT_EXPIRED=1d
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your_app_password
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
PREDICTION_SERVICE_URL=http://localhost:5001
PORT=3000
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. Jalankan Prediction Service (Python)

```bash
cd prediction_service
pip install -r requirements.txt
python app.py
# Jalan di http://localhost:5001
```

### 4. Jalankan Backend (Node.js)

```bash
cd backend
npm install
npm start
# Jalan di http://localhost:3000
```

### 5. Buka Frontend

```
http://localhost:3000/pages/index.html
```

## Menjalankan Tests

```bash
# Backend
cd backend
npm test

# Prediction Service
cd prediction_service
pytest tests/ -v
```

## Deploy

Lihat panduan lengkap di bagian deploy:
- **Prediction Service** → Render.com (Python)
- **Backend** → Render.com (Node.js)
- **Frontend** → Vercel

Setelah deploy, update `frontend/js/config.js` dengan URL backend yang sudah di-deploy:

```js
window.APP_CONFIG = {
  apiBase: 'https://YOUR-BACKEND.onrender.com/api'
};
```

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS (Neubrutalism UI) |
| Backend | Node.js, Express, JWT, bcrypt |
| Database | MongoDB Atlas (Mongoose) |
| ML Service | Python, Flask, XGBoost, scikit-learn |
| LLM | Groq API (llama-3.3-70b-versatile) |
| Email | Nodemailer (Gmail SMTP) |

## Disclaimer

Aplikasi ini bukan alat diagnosis medis. Hasil prediksi hanya berbasis data dan tidak menggantikan saran profesional kesehatan mental.

Model bisa didownload di G-Drive : https://drive.google.com/file/d/1YBUtUF8jSifJfjRBkU9FsSjOfW-36uNE/view?usp=sharing
Link website-nya : devburn-ai.vercel.app
