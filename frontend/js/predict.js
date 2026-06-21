const form = document.getElementById('predict-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

const FIELDS = {
  age: { min: 18, max: 80 },
  experience_years: { min: 0, max: 50 },
  daily_work_hours: { min: 1, max: 24 },
  sleep_hours: { min: 1, max: 12 },
  caffeine_intake: { min: 0, max: 20 },
  bugs_per_day: { min: 0, max: 100 },
  commits_per_day: { min: 0, max: 100 },
  meetings_per_day: { min: 0, max: 20 },
  screen_time: { min: 1, max: 24 },
  exercise_hours: { min: 0, max: 12 }
};

function showAlert(msg, type = 'error') {
  alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

resetBtn.addEventListener('click', () => {
  form.reset();
  alertBox.innerHTML = '';
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error-field'));
});

const LEVEL_COLORS = { Low: 'card-green', Medium: 'card-yellow', High: 'card-red' };

function showResultModal(d) {
  // Remove existing modal
  const existing = document.getElementById('result-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'result-modal';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
  `;

  const colorClass = LEVEL_COLORS[d.burnout_level] || '';
  const card = document.createElement('div');
  card.className = `card ${colorClass}`;
  card.style.cssText = `
    max-width: 480px; width: 90%; position: relative;
    animation: floatIn 0.25s ease;
  `;
  card.innerHTML = `
    <style>@keyframes floatIn { from { transform: translateY(-30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }</style>
    <button id="close-modal" style="position:absolute;top:12px;right:12px;background:none;border:2px solid #000;width:28px;height:28px;cursor:pointer;font-weight:900;border-radius:2px;">x</button>
    <div class="card-title">Hasil Prediksi</div>
    <p style="font-size: 1.8rem; font-weight: 900; margin-bottom: 8px;">Burnout Level: ${d.burnout_level}</p>
    <p style="margin-bottom: 8px;">Confidence: <strong>${(d.confidence * 100).toFixed(1)}%</strong></p>
    <p style="font-size: 0.9rem; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px;">${d.recommendation}</p>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('close-modal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const inputs = {};
  let hasError = false;

  for (const [field, { min, max }] of Object.entries(FIELDS)) {
    const el = document.getElementById(field);
    const val = parseFloat(el.value);
    el.classList.remove('error-field');
    if (isNaN(val) || val < min || val > max) {
      el.classList.add('error-field');
      hasError = true;
    } else {
      inputs[field] = val;
    }
  }

  if (hasError) return showAlert('Pastikan semua field terisi dengan nilai yang valid.');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';

  try {
    const res = await apiFetch('/predict', {
      method: 'POST',
      body: JSON.stringify({ ...inputs, nama: document.getElementById('nama').value.trim() })
    });

    if (res && res.success) {
      form.reset();
      document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error-field'));
      showResultModal(res.data);
    } else {
      showAlert(res?.message || 'Prediksi gagal.');
    }
  } catch (_) {
    showAlert('Terjadi kesalahan. Coba lagi.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Prediksi Sekarang';
  }
});
