document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

const BADGE = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high' };
const exportCsvBtn = document.getElementById('export-csv');
const exportPdfBtn = document.getElementById('export-pdf');
const deleteAllBtn = document.getElementById('delete-all');

async function loadHistory() {
  const res = await apiFetch('/predict/history');
  if (!res || !res.success) return;
  const history = res.data;

  if (history.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('table-section').style.display = 'none';
    exportCsvBtn.disabled = true;
    exportPdfBtn.disabled = true;
    deleteAllBtn.disabled = true;
    return;
  }

  exportCsvBtn.disabled = false;
  exportCsvBtn.removeAttribute('title');
  exportPdfBtn.disabled = false;
  exportPdfBtn.removeAttribute('title');
  deleteAllBtn.disabled = false;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('table-section').style.display = 'block';

  const tbody = document.getElementById('history-body');
  tbody.innerHTML = history.map(p => `
    <tr>
      <td>${new Date(p.createdAt).toLocaleDateString('id-ID')}</td>
      <td>${p.nama || '—'}</td>
      <td><span class="badge ${BADGE[p.burnout_level] || ''}">${p.burnout_level}</span></td>
      <td>${(p.confidence * 100).toFixed(1)}%</td>
      <td>${p.inputs?.daily_work_hours ?? '—'}</td>
      <td>${p.inputs?.sleep_hours ?? '—'}</td>
      <td>${p.inputs?.caffeine_intake ?? '—'}</td>
      <td>${p.inputs?.bugs_per_day ?? '—'}</td>
      <td>${p.inputs?.meetings_per_day ?? '—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteOne('${p._id}')">Hapus</button></td>
    </tr>
  `).join('');
}

async function deleteOne(id) {
  if (!confirm('Hapus data prediksi ini?')) return;
  const res = await apiFetch(`/predict/history/${id}`, { method: 'DELETE' });
  if (res && res.success) loadHistory();
  else showToast('Gagal menghapus.', 'error');
}

window.deleteOne = deleteOne;

deleteAllBtn.addEventListener('click', async () => {
  if (!confirm('Hapus SEMUA riwayat prediksi?')) return;
  const res = await apiFetch('/predict/history/all', { method: 'DELETE' });
  if (res && res.success) loadHistory();
  else showToast('Gagal menghapus.', 'error');
});

exportCsvBtn.addEventListener('click', async () => {
  const res = await fetch('/api/export/csv', { credentials: 'include' });
  if (!res.ok) return showToast('Gagal mengekspor CSV.', 'error');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'burnout_history.csv'; a.click();
  URL.revokeObjectURL(url);
});

exportPdfBtn.addEventListener('click', async () => {
  const res = await fetch('/api/export/pdf', { credentials: 'include' });
  if (!res.ok) return showToast('Gagal mengekspor PDF.', 'error');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'burnout_history.pdf'; a.click();
  URL.revokeObjectURL(url);
});

loadHistory();
