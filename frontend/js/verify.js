const email = sessionStorage.getItem('verify_email') || '';
document.getElementById('email-display').textContent = email || '(email tidak diketahui)';

const form = document.getElementById('verify-form');
const alertBox = document.getElementById('alert-box');
const verifyBtn = document.getElementById('verify-btn');
const resendBtn = document.getElementById('resend-btn');
const countdown = document.getElementById('countdown');

function showAlert(msg, type = 'error') {
  alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

// Countdown timer for resend
let seconds = 60;
const timer = setInterval(() => {
  seconds--;
  countdown.textContent = seconds;
  if (seconds <= 0) {
    clearInterval(timer);
    resendBtn.disabled = false;
    resendBtn.textContent = 'Kirim Ulang OTP';
  }
}, 1000);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const otp = document.getElementById('otp').value.trim();
  if (!otp || otp.length !== 6) return showAlert('Masukkan kode OTP 6 digit.');

  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Memverifikasi...';
  try {
    const res = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
    if (res && res.success) {
      showAlert('Akun berhasil diverifikasi! Mengarahkan ke login...', 'success');
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    } else {
      showAlert(res?.message || 'Verifikasi gagal.');
    }
  } catch (_) {
    showAlert('Terjadi kesalahan.');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verifikasi';
  }
});

resendBtn.addEventListener('click', async () => {
  resendBtn.disabled = true;
  try {
    const res = await apiFetch('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (res && res.success) {
      showAlert('Kode OTP baru telah dikirim.', 'success');
      // Reset countdown
      seconds = 60;
      countdown.textContent = seconds;
      resendBtn.textContent = `Kirim Ulang OTP (${seconds}s)`;
      const t = setInterval(() => {
        seconds--;
        countdown.textContent = seconds;
        if (seconds <= 0) { clearInterval(t); resendBtn.textContent = 'Kirim Ulang OTP'; resendBtn.disabled = false; }
      }, 1000);
    } else {
      showAlert(res?.message || 'Gagal mengirim ulang OTP.');
      resendBtn.disabled = false;
    }
  } catch (_) {
    showAlert('Terjadi kesalahan.');
    resendBtn.disabled = false;
  }
});
