const API_BASE = window.APP_CONFIG?.apiBase || '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (res.status === 401) {
    const publicPages = ['index.html', 'login.html', 'register.html', 'forgot-password.html', 'reset-password.html', 'verify.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (!publicPages.includes(currentPage)) {
      window.location.href = '/pages/login.html';
    }
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

window.apiFetch = apiFetch;
window.showToast = showToast;

// ── Auto logout setelah 20 menit tidak ada aktivitas ─────────────────────────
(function () {
  const IDLE_TIMEOUT = 20 * 60 * 1000; // 20 menit
  const publicPages = ['index.html', 'login.html', 'register.html', 'forgot-password.html', 'reset-password.html', 'verify.html'];
  const currentPage = window.location.pathname.split('/').pop();
  if (publicPages.includes(currentPage)) return; // jangan pasang timer di halaman publik

  let idleTimer;

  async function handleIdle() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    showToast('Sesi berakhir karena tidak ada aktivitas.', 'info');
    setTimeout(() => { window.location.href = '/pages/login.html'; }, 1500);
  }

  function resetTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(handleIdle, IDLE_TIMEOUT);
  }

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(e => {
    document.addEventListener(e, resetTimer, { passive: true });
  });

  resetTimer(); // mulai timer
})();
