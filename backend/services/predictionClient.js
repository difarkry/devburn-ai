const { predict: xgbPredict } = require('./xgbInference');

// Feature order expected by the model
const MODEL_FEATURES = ['daily_work_hours', 'bugs_per_day', 'meetings_per_day', 'caffeine_intake', 'sleep_hours'];

const BURNOUT_LABELS = { 0: 'Low', 1: 'Medium', 2: 'High' };

const RECOMMENDATIONS = {
  Low: 'Burnout Anda rendah. Pertahankan keseimbangan kerja-hidup yang baik, jaga pola tidur dan olahraga rutin.',
  Medium: 'Burnout Anda sedang. Pertimbangkan untuk mengurangi jam kerja, tingkatkan waktu istirahat, dan bicarakan dengan tim tentang beban kerja.',
  High: 'Burnout Anda tinggi. Segera kurangi beban kerja, ambil cuti jika memungkinkan, dan pertimbangkan konsultasi dengan profesional kesehatan mental.'
};

/**
 * Run prediction locally using pure JS XGBoost inference.
 * No Python service needed — works on Vercel serverless.
 * @param {object} features - input fields from user
 * @returns {{ burnout_level: string, confidence: number, recommendation: string }}
 */
async function callPredict(features) {
  const featureVector = MODEL_FEATURES.map(f => Number(features[f]));
  const { classIndex, probabilities } = xgbPredict(featureVector);

  const burnout_level = BURNOUT_LABELS[classIndex] || 'Medium';
  const confidence = Math.round(probabilities[classIndex] * 10000) / 10000;

  return {
    burnout_level,
    confidence,
    recommendation: RECOMMENDATIONS[burnout_level]
  };
}

module.exports = { callPredict };
