// Di Vercel, frontend dan backend di-deploy di domain yang sama
// sehingga API_BASE cukup /api (relative URL tetap works)
// Kalau deploy terpisah, ganti dengan URL backend penuh:
// window.APP_CONFIG = { apiBase: 'https://your-backend.vercel.app/api' };
window.APP_CONFIG = {
  apiBase: '/api'
};
