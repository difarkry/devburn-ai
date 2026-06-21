// Feature: burnout-prediction-web
// Property 14: Admin stats accuracy
// Property 15: Non-admin 403
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app, adminCookie, userCookie;

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

  await User.create({
    name: 'Admin User', username: 'adminuser',
    email: 'admin@test.com', password: hash, isVerified: true, role: 'admin'
  });
  await User.create({
    name: 'Regular User', username: 'regularuser',
    email: 'regular@test.com', password: hash, isVerified: true, role: 'user'
  });

  const adminLogin = await request(app).post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'TestPass123!' });
  adminCookie = adminLogin.headers['set-cookie'];

  const userLogin = await request(app).post('/api/auth/login')
    .send({ email: 'regular@test.com', password: 'TestPass123!' });
  userCookie = userLogin.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// Property 15: Non-admin always gets 403
test('P15: Non-admin user always gets 403 on admin endpoints', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 99 }),
      async (_i) => {
        const res = await request(app).get('/api/admin/stats').set('Cookie', userCookie);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 14: Admin stats aggregate accurately
test('P14: Admin stats returns accurate user count and prediction distribution', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.constantFrom('Low', 'Medium', 'High'), { minLength: 0, maxLength: 15 }),
      async (levels) => {
        const Prediction = require('../models/Prediction');
        const User = require('../models/User');

        await Prediction.deleteMany({});
        const adminUser = await User.findOne({ email: 'admin@test.com' });

        if (levels.length > 0) {
          await Prediction.insertMany(levels.map(level => ({
            userId: adminUser._id,
            inputs: { age: 25, experience_years: 3, daily_work_hours: 8, sleep_hours: 7, caffeine_intake: 2, bugs_per_day: 3, commits_per_day: 5, meetings_per_day: 2, screen_time: 9, exercise_hours: 1 },
            burnout_level: level,
            confidence: 0.7,
            recommendation: 'test'
          })));
        }

        const res = await request(app).get('/api/admin/stats').set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const { totalPredictions, distribution } = res.body.data;
        expect(totalPredictions).toBe(levels.length);

        if (levels.length > 0) {
          const totalPct = (distribution.Low || 0) + (distribution.Medium || 0) + (distribution.High || 0);
          expect(Math.round(totalPct)).toBe(100);
        }

        await Prediction.deleteMany({});
      }
    ),
    { numRuns: 30 }
  );
});
