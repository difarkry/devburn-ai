// Feature: burnout-prediction-web
// Property 10: Dashboard aggregate accuracy
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app, authCookie, userId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_secret_key_for_tests';
  process.env.JWT_EXPIRED = '1d';

  jest.mock('../services/emailService', () => ({
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
  }));

  await mongoose.connect(process.env.MONGO_URI);
  app = require('../app');

  const { hashPassword } = require('../utils/hashUtil');
  const User = require('../models/User');
  const hash = await hashPassword('TestPass123!');
  const user = await User.create({
    name: 'Dash User', username: 'dashuser',
    email: 'dash@test.com', password: hash, isVerified: true
  });
  userId = user._id;

  const loginRes = await request(app).post('/api/auth/login')
    .send({ email: 'dash@test.com', password: 'TestPass123!' });
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

// Property 10: Dashboard total matches actual prediction count
test('P10: Dashboard total predictions matches actual DB count', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 10 }),
      async (count) => {
        const Prediction = require('../models/Prediction');
        const predictions = Array.from({ length: count }, (_, i) => ({
          userId,
          inputs: { age: 25, experience_years: 3, daily_work_hours: 8, sleep_hours: 7, caffeine_intake: 2, bugs_per_day: 3, commits_per_day: 5, meetings_per_day: 2, screen_time: 9, exercise_hours: 1 },
          burnout_level: ['Low', 'Medium', 'High'][i % 3],
          confidence: 0.7,
          recommendation: 'Test'
        }));
        if (predictions.length > 0) await Prediction.insertMany(predictions);

        const res = await request(app).get('/api/dashboard').set('Cookie', authCookie);
        expect(res.status).toBe(200);
        expect(res.body.data.totalPredictions).toBe(count);

        if (count > 0) {
          expect(res.body.data.lastPrediction).not.toBeNull();
        } else {
          expect(res.body.data.lastPrediction).toBeNull();
        }

        await Prediction.deleteMany({});
      }
    ),
    { numRuns: 30 }
  );
});
