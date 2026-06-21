const { verifyToken } = require('../utils/jwtUtil');

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login kembali', code: 'UNAUTHORIZED' });
  }
  try {
    const decoded = verifyToken(token);
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login kembali', code: 'UNAUTHORIZED' });
  }
}

module.exports = authMiddleware;
