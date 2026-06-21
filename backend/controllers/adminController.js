const User = require('../models/User');
const Prediction = require('../models/Prediction');

async function getStats(req, res, next) {
  try {
    const [totalUsers, totalPredictions, distribution] = await Promise.all([
      User.countDocuments(),
      Prediction.countDocuments(),
      Prediction.aggregate([
        { $group: { _id: '$burnout_level', count: { $sum: 1 } } }
      ])
    ]);

    const distMap = { Low: 0, Medium: 0, High: 0 };
    for (const d of distribution) {
      if (d._id in distMap) distMap[d._id] = d.count;
    }

    const distPercentage = {};
    for (const level of ['Low', 'Medium', 'High']) {
      distPercentage[level] = totalPredictions > 0
        ? parseFloat(((distMap[level] / totalPredictions) * 100).toFixed(2))
        : 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalPredictions,
        distribution: distPercentage
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats };
