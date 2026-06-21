document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

(async () => {
  const res = await apiFetch('/admin/stats');

  if (!res) return; // 401 redirects automatically

  if (!res.success) {
    // 403 - not admin
    document.getElementById('admin-content').style.display = 'none';
    document.getElementById('access-denied').style.display = 'block';
    return;
  }

  const { totalUsers, totalPredictions, distribution } = res.data;

  document.getElementById('total-users').textContent = totalUsers;
  document.getElementById('total-predictions').textContent = totalPredictions;

  const levels = ['Low', 'Medium', 'High'];
  const topLevel = levels.reduce((a, b) => (distribution[a] >= distribution[b] ? a : b));
  document.getElementById('top-level').textContent = topLevel;

  const low = distribution.Low || 0;
  const medium = distribution.Medium || 0;
  const high = distribution.High || 0;

  document.getElementById('bar-low').style.width = `${low}%`;
  document.getElementById('bar-medium').style.width = `${medium}%`;
  document.getElementById('bar-high').style.width = `${high}%`;
  document.getElementById('pct-low').textContent = low.toFixed(1);
  document.getElementById('pct-medium').textContent = medium.toFixed(1);
  document.getElementById('pct-high').textContent = high.toFixed(1);
})();
