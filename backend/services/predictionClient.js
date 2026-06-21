const http = require('http');
const https = require('https');

/**
 * Call the Python prediction service.
 * @param {object} features - 10 numeric feature fields
 * @returns {Promise<{burnout_level: string, confidence: number, recommendation: string}>}
 */
function callPredict(features) {
  return new Promise((resolve, reject) => {
    const serviceUrl = process.env.PREDICTION_SERVICE_URL || 'http://localhost:5001';
    const url = new URL('/predict', serviceUrl);
    const body = JSON.stringify(features);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(parsed.error || 'Prediction service error');
            err.status = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid response from prediction service'));
        }
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      const err = new Error('Layanan prediksi tidak tersedia. Coba lagi nanti.');
      err.status = 503;
      reject(err);
    });

    req.on('error', (e) => {
      console.error('[PredictionClient] Connection error:', e.message, '| URL:', serviceUrl);
      const err = new Error('Layanan prediksi tidak tersedia. Coba lagi nanti.');
      err.status = 503;
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

module.exports = { callPredict };
