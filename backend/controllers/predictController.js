const Prediction = require('../models/Prediction');
const { callPredict } = require('../services/predictionClient');
const { validatePredictionInputs } = require('../utils/validate');

async function predict(req, res, next) {
  try {
    const { valid, errors } = validatePredictionInputs(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: errors.join(', '), code: 'VALIDATION_ERROR' });
    }

    const inputs = {
      age: Number(req.body.age),
      experience_years: Number(req.body.experience_years),
      daily_work_hours: Number(req.body.daily_work_hours),
      sleep_hours: Number(req.body.sleep_hours),
      caffeine_intake: Number(req.body.caffeine_intake),
      bugs_per_day: Number(req.body.bugs_per_day),
      commits_per_day: Number(req.body.commits_per_day),
      meetings_per_day: Number(req.body.meetings_per_day),
      screen_time: Number(req.body.screen_time),
      exercise_hours: Number(req.body.exercise_hours)
    };

    let result;
    try {
      result = await callPredict(inputs);
    } catch (err) {
      return res.status(503).json({ success: false, message: 'Layanan prediksi tidak tersedia. Coba lagi nanti.', code: 'SERVICE_UNAVAILABLE' });
    }

    const prediction = await Prediction.create({
      userId: req.user.userId,
      nama: req.body.nama || '',
      inputs,
      burnout_level: result.burnout_level,
      confidence: result.confidence,
      recommendation: result.recommendation
    });

    return res.status(200).json({
      success: true,
      data: {
        _id: prediction._id,
        burnout_level: result.burnout_level,
        confidence: result.confidence,
        recommendation: result.recommendation,
        createdAt: prediction.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const predictions = await Prediction.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: predictions });
  } catch (err) {
    next(err);
  }
}

async function deleteHistory(req, res, next) {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Prediction.deleteMany({ userId: req.user.userId });
      return res.status(200).json({ success: true, message: 'Semua riwayat prediksi dihapus.' });
    }
    const pred = await Prediction.findOneAndDelete({ _id: id, userId: req.user.userId });
    if (!pred) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    return res.status(200).json({ success: true, message: 'Riwayat prediksi dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { predict, getHistory, deleteHistory };
