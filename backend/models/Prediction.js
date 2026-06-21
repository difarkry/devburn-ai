const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nama: { type: String, default: '' },
  inputs: {
    age: Number,
    experience_years: Number,
    daily_work_hours: Number,
    sleep_hours: Number,
    caffeine_intake: Number,
    bugs_per_day: Number,
    commits_per_day: Number,
    meetings_per_day: Number,
    screen_time: Number,
    exercise_hours: Number
  },
  burnout_level: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  confidence: { type: Number, required: true },
  recommendation: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Prediction', predictionSchema);
