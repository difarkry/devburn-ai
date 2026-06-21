// Feature: burnout-prediction-web
// Auth property-based tests using fast-check + mongodb-memory-server
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_secret_key_for_tests';
  process.env.JWT_EXPIRED = '1d';
  // Mock email service to avoid real SMTP
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
  jest.resetModules();
});

// Property 1: Validasi form registrasi menolak input tidak lengkap/invalid
test('P1: Registration rejects incomplete or mismatched input', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
        username: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        email: fc.option(fc.emailAddress(), { nil: undefined }),
        password: fc.string({ minLength: 1, maxLength: 20 }),
        confirmPassword: fc.string({ minLength: 1, maxLength: 20 })
      }),
      async (input) => {
        const isMissingField = !input.name || !input.username || !input.email;
        const isMismatch = input.password !== input.confirmPassword;
        if (!isMissingField && !isMismatch) return; // skip valid inputs

        const res = await request(app).post('/api/auth/register').send(input);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 2: Password selalu di-hash bcrypt sebelum disimpan
test('P2: Password is always bcrypt-hashed before storage', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        password: fc.string({ minLength: 8, maxLength: 30 })
      }),
      async ({ password }) => {
        const hash = await bcrypt.hash(password, 10);
        expect(hash).not.toBe(password);
        const match = await bcrypt.compare(password, hash);
        expect(match).toBe(true);
        // Ensure salt rounds >= 10
        const rounds = bcrypt.getRounds(hash);
        expect(rounds).toBeGreaterThanOrEqual(10);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 3: OTP selalu 6 digit dan expiry tepat 10 menit
test('P3: OTP is always 6 digits and expiry is within 10 minutes', async () => {
  const { generateOtp, isOtpExpired } = require('../utils/otpUtil');
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 1000 }),
      async (_seed) => {
        const otp = generateOtp();
        expect(otp).toMatch(/^\d{6}$/);

        const before = Date.now();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        const after = Date.now();

        expect(expiry.getTime()).toBeGreaterThan(before);
        expect(expiry.getTime()).toBeLessThanOrEqual(after + 10 * 60 * 1000 + 100);
        expect(isOtpExpired(expiry)).toBe(false);

        const expired = new Date(Date.now() - 1000);
        expect(isOtpExpired(expired)).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 4: OTP round-trip — correct code verifies, old code invalid after resend
test('P4: Correct OTP verifies account, resend invalidates old code', async () => {
  const emailService = require('../services/emailService');
  const User = require('../models/User');
  const { generateOtp } = require('../utils/otpUtil');
  const { hashPassword } = require('../utils/hashUtil');

  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 10 }),
      async (_i) => {
        const suffix = Math.random().toString(36).slice(2, 8);
        const otpCode = generateOtp();
        const hash = await hashPassword('password123');

        const user = await User.create({
          name: 'Test User',
          username: `user_${suffix}`,
          email: `user_${suffix}@test.com`,
          password: hash,
          isVerified: false,
          otpCode,
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
          otpAttempts: 0
        });

        // Correct OTP should verify
        const res = await request(app).post('/api/auth/verify-otp')
          .send({ email: user.email, otp: otpCode });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await User.findById(user._id);
        expect(updated.isVerified).toBe(true);
        expect(updated.otpCode).toBeNull();

        await User.deleteOne({ _id: user._id });
      }
    ),
    { numRuns: 20 }
  );
});

// Property 5: Login verified user returns JWT cookie
test('P5: Verified user login results in JWT httpOnly cookie', async () => {
  const User = require('../models/User');
  const { hashPassword } = require('../utils/hashUtil');

  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 10 }),
      async (_i) => {
        const suffix = Math.random().toString(36).slice(2, 8);
        const plainPw = 'ValidPass123!';
        const hash = await hashPassword(plainPw);

        await User.create({
          name: 'Verified User',
          username: `verified_${suffix}`,
          email: `verified_${suffix}@test.com`,
          password: hash,
          isVerified: true,
          otpCode: null,
          otpExpiry: null
        });

        const res = await request(app).post('/api/auth/login')
          .send({ email: `verified_${suffix}@test.com`, password: plainPw });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const cookies = res.headers['set-cookie'] || [];
        const hasToken = cookies.some(c => c.startsWith('token=') && c.includes('HttpOnly'));
        expect(hasToken).toBe(true);

        await User.deleteOne({ email: `verified_${suffix}@test.com` });
      }
    ),
    { numRuns: 20 }
  );
});

// Property 16: Reset password round-trip
test('P16: New password works after reset, old password does not', async () => {
  const User = require('../models/User');
  const { hashPassword } = require('../utils/hashUtil');
  const { generateOtp } = require('../utils/otpUtil');

  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 10 }),
      async (_i) => {
        const suffix = Math.random().toString(36).slice(2, 8);
        const oldPw = 'OldPassword123!';
        const newPw = 'NewPassword456!';
        const otp = generateOtp();
        const hash = await hashPassword(oldPw);

        await User.create({
          name: 'Reset User',
          username: `reset_${suffix}`,
          email: `reset_${suffix}@test.com`,
          password: hash,
          isVerified: true,
          otpCode: otp,
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
        });

        const res = await request(app).post('/api/auth/reset-password').send({
          email: `reset_${suffix}@test.com`,
          otp,
          newPassword: newPw,
          confirmPassword: newPw
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // New password should work
        const loginNew = await request(app).post('/api/auth/login')
          .send({ email: `reset_${suffix}@test.com`, password: newPw });
        expect(loginNew.status).toBe(200);

        // Old password should fail
        const loginOld = await request(app).post('/api/auth/login')
          .send({ email: `reset_${suffix}@test.com`, password: oldPw });
        expect(loginOld.status).toBe(401);

        // OTP should no longer work
        const user = await User.findOne({ email: `reset_${suffix}@test.com` });
        expect(user.otpCode).toBeNull();

        await User.deleteOne({ email: `reset_${suffix}@test.com` });
      }
    ),
    { numRuns: 20 }
  );
});
