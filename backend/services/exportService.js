const PDFDocument = require('pdfkit');

const CSV_HEADERS = ['tanggal', 'nama', 'age', 'experience_years', 'daily_work_hours', 'sleep_hours', 'caffeine_intake', 'bugs_per_day', 'commits_per_day', 'meetings_per_day', 'screen_time', 'exercise_hours', 'burnout_level', 'confidence'];

function generateCsv(predictions) {
  const rows = predictions.map(p => [
    new Date(p.createdAt).toISOString(),
    `"${p.nama || ''}"`,
    p.inputs.age,
    p.inputs.experience_years,
    p.inputs.daily_work_hours,
    p.inputs.sleep_hours,
    p.inputs.caffeine_intake,
    p.inputs.bugs_per_day,
    p.inputs.commits_per_day,
    p.inputs.meetings_per_day,
    p.inputs.screen_time,
    p.inputs.exercise_hours,
    p.burnout_level,
    p.confidence
  ].join(','));

  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

function generatePdf(predictions, userName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Riwayat Prediksi Burnout', { align: 'center' });
    doc.fontSize(12).text(`Nama: ${userName}`, { align: 'left' });
    doc.moveDown();

    doc.fontSize(10);
    predictions.forEach((p, i) => {
      const nama = p.nama ? ` | Nama: ${p.nama}` : '';
      doc.text(`${i + 1}. ${new Date(p.createdAt).toLocaleDateString('id-ID')}${nama} — Burnout: ${p.burnout_level} (${(p.confidence * 100).toFixed(1)}%)`);
      doc.text(`   Jam kerja: ${p.inputs.daily_work_hours}, Tidur: ${p.inputs.sleep_hours}, Kafein: ${p.inputs.caffeine_intake}, Bug: ${p.inputs.bugs_per_day}, Rapat: ${p.inputs.meetings_per_day}`);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.fontSize(8).fillColor('gray')
      .text('DISCLAIMER: Data ini bukan diagnosis medis. Ini hanya hasil prediksi berbasis data dan tidak menggantikan saran profesional kesehatan.', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateCsv, generatePdf };
