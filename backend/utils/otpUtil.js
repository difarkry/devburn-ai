function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isOtpExpired(expiry) {
  if (!expiry) return true;
  return new Date() > new Date(expiry);
}

module.exports = { generateOtp, isOtpExpired };
