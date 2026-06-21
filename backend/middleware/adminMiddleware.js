function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak', code: 'FORBIDDEN' });
  }
  next();
}

module.exports = adminMiddleware;
