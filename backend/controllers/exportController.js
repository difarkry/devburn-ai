const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { generateCsv, generatePdf } = require('../services/exportService');

async function exportCsv(req, res, next) {
  try {
    const predictions = await Prediction.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    const csv = generateCsv(predictions);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="burnout_history.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

async function exportPdf(req, res, next) {
  try {
    const [predictions, user] = await Promise.all([
      Prediction.find({ userId: req.user.userId }).sort({ createdAt: -1 }),
      User.findById(req.user.userId).select('name')
    ]);
    const pdfBuffer = await generatePdf(predictions, user ? user.name : 'User');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="burnout_history.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportCsv, exportPdf };
