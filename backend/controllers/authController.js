const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/hashUtil');
const { generateOtp, isOtpExpired } = require('../utils/otpUtil');
const { signToken } = require('../utils/jwtUtil');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, username, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!name || !username || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi', code: 'VALIDATION_ERROR' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password dan konfirmasi password tidak cocok', code: 'VALIDATION_ERROR' });
    }

    // Check duplicates
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email sudah digunakan', code: 'EMAIL_EXISTS' });
    }
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan', code: 'USERNAME_EXISTS' });
    }

    const hashed = await hashPassword(password);
    const otpCode = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      name,
      username,
      email,
      password: hashed,
      isVerified: false,
      otpCode,
      otpExpiry,
      otpAttempts: 0
    });

    await sendOtpEmail(user.email, user.name, otpCode);

    return res.status(201).json({ success: true, message: 'Registrasi berhasil. Silakan cek email untuk kode OTP.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email dan kode OTP wajib diisi', code: 'VALIDATION_ERROR' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan', code: 'NOT_FOUND' });
    }

    if (isOtpExpired(user.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang OTP.', code: 'OTP_EXPIRED' });
    }

    if (user.otpCode !== otp) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Kode OTP salah', code: 'OTP_INVALID' });
    }

    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await user.save();

    return res.status(200).json({ success: true, message: 'Akun berhasil diverifikasi. Silakan login.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email wajib diisi', code: 'VALIDATION_ERROR' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan', code: 'NOT_FOUND' });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Akun sudah terverifikasi', code: 'ALREADY_VERIFIED' });
    }

    const otpCode = generateOtp();
    user.otpCode = otpCode;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, user.name, otpCode);

    return res.status(200).json({ success: true, message: 'Kode OTP baru telah dikirim ke email Anda.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi', code: 'VALIDATION_ERROR' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email atau password salah', code: 'INVALID_CREDENTIALS' });
    }

    // Check lock
    if (user.loginLockUntil && new Date() < new Date(user.loginLockUntil)) {
      return res.status(429).json({ success: false, message: 'Akun terkunci sementara. Coba lagi setelah 15 menit.', code: 'ACCOUNT_LOCKED' });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.loginLockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ success: false, message: 'Email atau password salah', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Akun belum diverifikasi. Silakan cek email Anda.', code: 'NOT_VERIFIED' });
    }

    // Reset login attempts
    user.loginAttempts = 0;
    user.loginLockUntil = null;
    await user.save();

    const token = signToken({ userId: user._id, role: user.role });
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ success: true, message: 'Login berhasil', user: { name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax'
    });
    return res.status(200).json({ success: true, message: 'Logout berhasil' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email wajib diisi', code: 'VALIDATION_ERROR' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email tidak ditemukan', code: 'NOT_FOUND' });
    }

    const otpCode = generateOtp();
    user.otpCode = otpCode;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    await sendPasswordResetEmail(user.email, user.name, otpCode);

    return res.status(200).json({ success: true, message: 'Kode OTP reset password telah dikirim ke email Anda.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-reset-otp
async function verifyResetOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email dan kode OTP wajib diisi', code: 'VALIDATION_ERROR' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan', code: 'NOT_FOUND' });
    }
    if (isOtpExpired(user.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'Kode OTP sudah kedaluwarsa', code: 'OTP_EXPIRED' });
    }
    if (user.otpCode !== otp) {
      return res.status(400).json({ success: false, message: 'Kode OTP salah', code: 'OTP_INVALID' });
    }

    return res.status(200).json({ success: true, message: 'OTP valid. Silakan masukkan password baru.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi', code: 'VALIDATION_ERROR' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password tidak cocok', code: 'VALIDATION_ERROR' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password minimal 8 karakter', code: 'VALIDATION_ERROR' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan', code: 'NOT_FOUND' });
    }
    if (isOtpExpired(user.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'Kode OTP sudah kedaluwarsa', code: 'OTP_EXPIRED' });
    }
    if (user.otpCode !== otp) {
      return res.status(400).json({ success: false, message: 'Kode OTP salah', code: 'OTP_INVALID' });
    }

    user.password = await hashPassword(newPassword);
    user.otpCode = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password berhasil diperbarui. Silakan login.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyOtp, resendOtp, login, logout, forgotPassword, verifyResetOtp, resetPassword };
