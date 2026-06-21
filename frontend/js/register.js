const form = document.getElementById('register-form');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submit-btn');

function showAlert(msg, type = 'error') {
  alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const name = form.name.value.trim();
  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (!name || !username || !email || !password || !confirmPassword) {
    return showAlert('Semua field wajib diisi.');
  }
  if (password !== confirmPassword) {
    return showAlert('Password dan konfirmasi password tidak cocok.');
  }
  if (password.length < 8) {
    return showAlert('Password minimal 8 karakter.');
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mendaftar...';

  try {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password, confirmPassword })
    });

    if (res && res.success) {
      sessionStorage.setItem('verify_email', email);
      window.location.href = 'verify.html';
    } else {
      showAlert(res?.message || 'Registrasi gagal.');
    }
  } catch (err) {
    showAlert('Terjadi kesalahan. Coba lagi.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Daftar Sekarang';
  }
});
