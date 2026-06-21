const form = document.getElementById('login-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');

function showAlert(msg, type = 'error') {
  alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) return showAlert('Email dan password wajib diisi.');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Masuk...';

  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res && res.success) {
      window.location.href = 'dashboard.html';
    } else if (res?.code === 'NOT_VERIFIED') {
      sessionStorage.setItem('verify_email', email);
      showAlert('Akun belum diverifikasi. <a href="verify.html">Verifikasi sekarang</a>.');
    } else {
      showAlert(res?.message || 'Login gagal.');
    }
  } catch (_) {
    showAlert('Terjadi kesalahan. Coba lagi.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});
