/**
 * Script to validate connectivity between backend and Prediction_Service.
 * Run with: node backend/scripts/checkPredictionService.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const https = require('https');

const serviceUrl = process.env.PREDICTION_SERVICE_URL || 'http://localhost:5001';

function checkHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL('/health', serviceUrl);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.get(`${serviceUrl}/health`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout: Prediction_Service did not respond within 5s'));
    });

    req.on('error', (err) => {
      reject(new Error(`Connection failed: ${err.message}`));
    });
  });
}

(async () => {
  console.log(`Checking Prediction_Service at ${serviceUrl}/health ...`);
  try {
    const result = await checkHealth();
    if (result.status === 200 && result.body.status === 'ok') {
      console.log('✅ Prediction_Service is UP and healthy.');
    } else {
      console.error(`❌ Unexpected response: HTTP ${result.status}`, result.body);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    console.log('\nMake sure the Prediction_Service is running:');
    console.log('  cd prediction_service && python app.py');
    process.exit(1);
  }
})();
