const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, verifyOtp, resendOtp, login, logout, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController');

const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, message: 'Terlalu banyak percobaan registrasi. Coba lagi setelah 15 menit.', code: 'RATE_LIMIT' } });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, message: 'Terlalu banyak percobaan OTP. Coba lagi setelah 15 menit.', code: 'RATE_LIMIT' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi setelah 15 menit.', code: 'RATE_LIMIT' } });

router.post('/register', registerLimiter, register);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', require('../middleware/authMiddleware'), (req, res) => {
  res.json({ success: true, userId: req.user.userId, role: req.user.role });
});
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
