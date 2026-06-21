const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  otpCode: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  loginAttempts: { type: Number, default: 0 },
  loginLockUntil: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
