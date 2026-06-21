const form = document.getElementById('reset-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');
const email = sessionStorage.getItem('reset_email') || '';

function showAlert(msg, type = 'error') {
  alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const otp = document.getElementById('otp').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!otp || otp.length !== 6) return showAlert('Masukkan kode OTP 6 digit.');
  if (!newPassword || newPassword.length < 8) return showAlert('Password minimal 8 karakter.');
  if (newPassword !== confirmPassword) return showAlert('Password tidak cocok.');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mereset...';
  try {
    const res = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword, confirmPassword })
    });
    if (res && res.success) {
      showAlert('Password berhasil direset. Mengarahkan ke login...', 'success');
      sessionStorage.removeItem('reset_email');
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    } else {
      showAlert(res?.message || 'Reset password gagal.');
    }
  } catch (_) {
    showAlert('Terjadi kesalahan.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Reset Password';
  }
});
