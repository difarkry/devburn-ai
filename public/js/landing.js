// Check auth state and update navbar — no redirect on failure
(async function () {
  try {
    const res = await fetch(`${window.APP_CONFIG?.apiBase || '/api'}/auth/me`, {
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        const links = document.getElementById('navbar-links');
        links.innerHTML = `
          <li><a href="dashboard.html" class="btn btn-sm btn-secondary">Dashboard</a></li>
          <li><a href="#" id="logout-btn" class="btn btn-sm btn-dark">Logout</a></li>
        `;
        document.getElementById('logout-btn').addEventListener('click', async (e) => {
          e.preventDefault();
          await fetch(`${window.APP_CONFIG?.apiBase || '/api'}/auth/logout`, {
            method: 'POST', credentials: 'include'
          });
          window.location.reload();
        });
      }
    }
    // If 401 or any error — just keep default Login/Daftar navbar, no redirect
  } catch (_) {}
})();
