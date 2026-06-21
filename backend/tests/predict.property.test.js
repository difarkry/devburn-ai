// Feature: burnout-prediction-web
// Prediction property-based tests
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app, authCookie;

const VALID_INPUT = {
  age: 28, experience_years: 5, daily_work_hours: 9, sleep_hours: 7,
  caffeine_intake: 2, bugs_per_day: 5, commits_per_day: 8,
  meetings_per_day: 3, screen_time: 10, exercise_hours: 0.5
};

const FIELD_RANGES = {
  age: [18, 80], experience_years: [0, 50], daily_work_hours: [1, 24],
  sleep_hours: [1, 12], caffeine_intake: [0, 20], bugs_per_day: [0, 100],
  commits_per_day: [0, 100], meetings_per_day: [0, 20], screen_time: [1, 24],
  exercise_hours: [0, 12]
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_secret_key_for_tests';
  process.env.JWT_EXPIRED = '1d';

  jest.mock('../services/emailService', () => ({
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
  }));

  // Mock prediction client
  jest.mock('../services/predictionClient', () => ({
    callPredict: jest.fn().mockResolvedValue({
      burnout_level: 'Medium',
      confidence: 0.75,
      recommendation: 'Test recommendation'
    })
  }));

  await mongoose.connect(process.env.MONGO_URI);
  app = require('../app');

  // Create and login a verified user
  const { hashPassword } = require('../utils/hashUtil');
  const User = require('../models/User');
  const hash = await hashPassword('TestPass123!');
  await User.create({
    name: 'Test User', username: 'testpreduser',
    email: 'pred@test.com', password: hash, isVerified: true
  });
  const loginRes = await request(app).post('/api/auth/login')
    .send({ email: 'pred@test.com', password: 'TestPass123!' });
  authCookie = loginRes.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const Prediction = require('../models/Prediction');
  await Prediction.deleteMany({});
});

// Property 6: Protected endpoints return 401 without valid JWT
test('P6: Predict and history endpoints return 401 without JWT', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('/api/predict', '/api/predict/history', '/api/dashboard', '/api/chat/history'),
      async (endpoint) => {
        const method = endpoint === '/api/predict' ? 'post' : 'get';
        const res = await request(app)[method](endpoint).send(VALID_INPUT);
        expect(res.status).toBe(401);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 7: Range validation rejects out-of-bound inputs
test('P7: Prediction input validation rejects out-of-range values', async () => {
  const fields = Object.keys(FIELD_RANGES);
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: fields.length - 1 }),
      fc.boolean(),
      async (fieldIdx, tooHigh) => {
        const field = fields[fieldIdx];
        const [min, max] = FIELD_RANGES[field];
        const invalidVal = tooHigh ? max + 1 : min - 1;
        const invalidInput = { ...VALID_INPUT, [field]: invalidVal };

        const res = await request(app).post('/api/predict')
          .set('Cookie', authCookie)
          .send(invalidInput);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 9: Prediction history round-trip
test('P9: Saved predictions are retrievable from history', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      async (count) => {
        // Make N predictions
        for (let i = 0; i < count; i++) {
          await request(app).post('/api/predict')
            .set('Cookie', authCookie)
            .send(VALID_INPUT);
        }

        const histRes = await request(app).get('/api/predict/history')
          .set('Cookie', authCookie);
        expect(histRes.status).toBe(200);
        expect(histRes.body.success).toBe(true);
        expect(histRes.body.data.length).toBeGreaterThanOrEqual(count);

        const Prediction = require('../models/Prediction');
        await Prediction.deleteMany({});
      }
    ),
    { numRuns: 20 }
  );
});
