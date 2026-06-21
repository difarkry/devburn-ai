const form = document.getElementById('forgot-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');

function showAlert(msg, type = 'error') {
  alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';
  const email = document.getElementById('email').value.trim();
  if (!email) return showAlert('Email wajib diisi.');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengirim...';
  try {
    const res = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (res && res.success) {
      sessionStorage.setItem('reset_email', email);
      showAlert('Kode OTP telah dikirim ke email kamu.', 'success');
      setTimeout(() => { window.location.href = 'reset-password.html'; }, 1500);
    } else {
      showAlert(res?.message || 'Gagal mengirim kode OTP.');
    }
  } catch (_) {
    showAlert('Terjadi kesalahan.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirim Kode OTP';
  }
});
