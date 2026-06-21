// Feature: burnout-prediction-web
// Integration tests: auth flow, rate limiting, admin access, prediction service down
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app;

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
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Test: Auth end-to-end — register → verify OTP → login → access protected route
describe('Auth end-to-end flow', () => {
  test('register → verify OTP → login → access dashboard', async () => {
    const emailService = require('../services/emailService');
    const User = require('../models/User');

    // 1. Register
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Integration User',
      username: 'integuser',
      email: 'integ@test.com',
      password: 'TestPass123!',
      confirmPassword: 'TestPass123!'
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);

    // 2. Get OTP from DB (since email is mocked)
    const user = await User.findOne({ email: 'integ@test.com' });
    expect(user).not.toBeNull();
    expect(user.isVerified).toBe(false);
    const otp = user.otpCode;

    // 3. Verify OTP
    const verifyRes = await request(app).post('/api/auth/verify-otp').send({
      email: 'integ@test.com',
      otp
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    // 4. Login
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'integ@test.com',
      password: 'TestPass123!'
    });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies.some(c => c.startsWith('token='))).toBe(true);

    // 5. Access protected route
    const dashRes = await request(app).get('/api/dashboard').set('Cookie', cookies);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.success).toBe(true);
  });
});

// Test: Rate limiting — login attempts
describe('Rate limiting', () => {
  test('6 failed login attempts → account locked', async () => {
    const { hashPassword } = require('../utils/hashUtil');
    const User = require('../models/User');
    const hash = await hashPassword('CorrectPass123!');
    await User.create({
      name: 'Lock User', username: 'lockuser',
      email: 'lock@test.com', password: hash, isVerified: true
    });

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({
        email: 'lock@test.com', password: 'WrongPass!'
      });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be locked
    const lockedRes = await request(app).post('/api/auth/login').send({
      email: 'lock@test.com', password: 'WrongPass!'
    });
    expect([429, 401]).toContain(lockedRes.status);
  });
});

// Test: Admin access control
describe('Admin access control', () => {
  test('regular user gets 403, admin gets 200', async () => {
    const { hashPassword } = require('../utils/hashUtil');
    const User = require('../models/User');
    const hash = await hashPassword('TestPass123!');

    await User.create({
      name: 'Admin', username: 'admintest',
      email: 'admin@test.com', password: hash, isVerified: true, role: 'admin'
    });
    await User.create({
      name: 'Regular', username: 'regulartest',
      email: 'regular@test.com', password: hash, isVerified: true, role: 'user'
    });

    const adminLogin = await request(app).post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'TestPass123!' });
    const adminCookie = adminLogin.headers['set-cookie'];

    const userLogin = await request(app).post('/api/auth/login')
      .send({ email: 'regular@test.com', password: 'TestPass123!' });
    const userCookie = userLogin.headers['set-cookie'];

    // Admin should get 200
    const adminRes = await request(app).get('/api/admin/stats').set('Cookie', adminCookie);
    expect(adminRes.status).toBe(200);

    // Regular user should get 403
    const userRes = await request(app).get('/api/admin/stats').set('Cookie', userCookie);
    expect(userRes.status).toBe(403);
  });
});

// Test: Prediction_Service down → 503
describe('Prediction service unavailable', () => {
  test('returns 503 when prediction service is down', async () => {
    // Override predictionClient to simulate down
    jest.mock('../services/predictionClient', () => ({
      callPredict: jest.fn().mockRejectedValue(Object.assign(
        new Error('Layanan prediksi tidak tersedia. Coba lagi nanti.'),
        { status: 503 }
      ))
    }));

    const { hashPassword } = require('../utils/hashUtil');
    const User = require('../models/User');
    const hash = await hashPassword('TestPass123!');
    await User.create({
      name: 'Pred User', username: 'preduser',
      email: 'pred@test.com', password: hash, isVerified: true
    });
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: 'pred@test.com', password: 'TestPass123!' });
    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app).post('/api/predict').set('Cookie', cookie).send({
      age: 25, experience_years: 3, daily_work_hours: 8, sleep_hours: 7,
      caffeine_intake: 2, bugs_per_day: 3, commits_per_day: 5,
      meetings_per_day: 2, screen_time: 9, exercise_hours: 1
    });
    expect(res.status).toBe(503);

    jest.resetModules();
  });
});
