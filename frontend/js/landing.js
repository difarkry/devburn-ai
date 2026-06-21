// Check auth state and update navbar
(async function () {
  try {
    const res = await apiFetch('/dashboard');
    if (res && res.success) {
      // User is logged in
      const links = document.getElementById('navbar-links');
      links.innerHTML = `
        <li><a href="dashboard.html" class="btn btn-sm btn-secondary">Dashboard</a></li>
        <li><a href="#" id="logout-btn" class="btn btn-sm btn-dark">Logout</a></li>
      `;
      document.getElementById('logout-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await apiFetch('/auth/logout', { method: 'POST' });
        window.location.reload();
      });
    }
  } catch (_) {
    // Not logged in, keep default navbar
  }
})();
