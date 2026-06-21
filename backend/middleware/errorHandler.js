// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Terjadi kesalahan server';
  const code = err.code || 'INTERNAL_ERROR';
  res.status(status).json({ success: false, message, code });
}

module.exports = errorHandler;
