const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendOtpEmail(email, name, code) {
  await transporter.sendMail({
    from: `"Burnout Predictor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Kode Verifikasi OTP - Burnout Predictor',
    html: `
      <h2>Halo, ${name}!</h2>
      <p>Kode OTP Anda untuk verifikasi akun:</p>
      <h1 style="letter-spacing:8px;">${code}</h1>
      <p>Kode ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
    `
  });
}

async function sendPasswordResetEmail(email, name, code) {
  await transporter.sendMail({
    from: `"Burnout Predictor" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Password - Burnout Predictor',
    html: `
      <h2>Halo, ${name}!</h2>
      <p>Kode OTP untuk reset password Anda:</p>
      <h1 style="letter-spacing:8px;">${code}</h1>
      <p>Kode ini berlaku selama <strong>10 menit</strong>. Jika Anda tidak meminta reset password, abaikan email ini.</p>
    `
  });
}

module.exports = { sendOtpEmail, sendPasswordResetEmail };
