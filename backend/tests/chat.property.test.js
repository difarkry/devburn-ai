// Feature: burnout-prediction-web
// Property 12: Chat history round-trip
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, app, authCookie;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test_secret_key_for_tests';
  process.env.JWT_EXPIRED = '1d';
  process.env.RAG_PATH = require('path').join(__dirname, '../data/data.json');

  jest.mock('../services/emailService', () => ({
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
  }));

  // Mock Groq API call inside chatController by intercepting https
  jest.mock('https', () => {
    const actual = jest.requireActual('https');
    return {
      ...actual,
      request: jest.fn((opts, cb) => {
        const mockResponse = {
          statusCode: 200,
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify({ choices: [{ message: { content: 'Mock AI response' } }] }));
            if (event === 'end') handler();
          },
          headers: { 'content-type': 'application/json' }
        };
        cb(mockResponse);
        return { setTimeout: jest.fn(), on: jest.fn(), write: jest.fn(), end: jest.fn() };
      })
    };
  });

  await mongoose.connect(process.env.MONGO_URI);
  app = require('../app');

  const { hashPassword } = require('../utils/hashUtil');
  const User = require('../models/User');
  const hash = await hashPassword('TestPass123!');
  await User.create({
    name: 'Chat User', username: 'chatuser',
    email: 'chat@test.com', password: hash, isVerified: true
  });
  const loginRes = await request(app).post('/api/auth/login')
    .send({ email: 'chat@test.com', password: 'TestPass123!' });
  authCookie = loginRes.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const ChatMessage = require('../models/ChatMessage');
  await ChatMessage.deleteMany({});
});

// Property 12: Chat messages are stored and retrievable per user
test('P12: Chat messages are stored and retrievable per user', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
        { minLength: 1, maxLength: 5 }
      ),
      async (messages) => {
        for (const msg of messages) {
          await request(app).post('/api/chat')
            .set('Cookie', authCookie)
            .send({ message: msg });
        }

        const histRes = await request(app).get('/api/chat/history')
          .set('Cookie', authCookie);
        expect(histRes.status).toBe(200);
        expect(histRes.body.success).toBe(true);
        expect(histRes.body.data.length).toBeGreaterThanOrEqual(messages.length);

        for (const record of histRes.body.data) {
          expect(record).toHaveProperty('userMessage');
          expect(record).toHaveProperty('assistantResponse');
          expect(record).toHaveProperty('ragConfidence');
          expect(typeof record.ragConfidence).toBe('number');
        }

        const ChatMessage = require('../models/ChatMessage');
        await ChatMessage.deleteMany({});
      }
    ),
    { numRuns: 20 }
  );
});
