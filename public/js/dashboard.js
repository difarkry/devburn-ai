document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

const BADGE = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high' };

(async () => {
  const res = await apiFetch('/dashboard');
  if (!res || !res.success) return;

  const { totalPredictions, lastPrediction, history } = res.data;

  document.getElementById('total-predictions').textContent = totalPredictions;

  if (!lastPrediction || totalPredictions === 0) {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('history-section').style.display = 'none';
    document.getElementById('last-level').textContent = '—';
    document.getElementById('last-confidence').textContent = '—';
    return;
  }

  document.getElementById('last-level').textContent = lastPrediction.burnout_level;
  document.getElementById('last-confidence').textContent = `${(lastPrediction.confidence * 100).toFixed(1)}%`;

  const tbody = document.getElementById('history-body');
  tbody.innerHTML = history.map(p => `
    <tr>
      <td>${new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
      <td><span class="badge ${BADGE[p.burnout_level] || ''}">${p.burnout_level}</span></td>
      <td>${(p.confidence * 100).toFixed(1)}%</td>
      <td>${p.inputs?.daily_work_hours ?? '—'} jam</td>
      <td>${p.inputs?.sleep_hours ?? '—'} jam</td>
    </tr>
  `).join('');
})();
