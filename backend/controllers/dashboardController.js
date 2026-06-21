const Prediction = require('../models/Prediction');

async function getDashboard(req, res, next) {
  try {
    const userId = req.user.userId;

    const total = await Prediction.countDocuments({ userId });
    const recent = await Prediction.find({ userId }).sort({ createdAt: -1 }).limit(30);
    const lastPrediction = recent[0] || null;

    return res.status(200).json({
      success: true,
      data: {
        totalPredictions: total,
        lastPrediction: lastPrediction ? {
          burnout_level: lastPrediction.burnout_level,
          confidence: lastPrediction.confidence,
          createdAt: lastPrediction.createdAt
        } : null,
        history: recent
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
