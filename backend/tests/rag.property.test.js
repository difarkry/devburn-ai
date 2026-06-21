// Feature: burnout-prediction-web
// Property 11: RAG retrieval output format
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');

// Set RAG_PATH to actual data file
process.env.RAG_PATH = require('path').join(__dirname, '../data/data.json');

test('P11: RAG findRelevantContext always returns valid format', async () => {
  const { findRelevantContext } = require('../services/ragService');

  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 0, maxLength: 200 }),
      async (query) => {
        const result = findRelevantContext(query);
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('context');

        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);

        if (result.source !== null) {
          expect(typeof result.source).toBe('string');
          expect(result.source.length).toBeGreaterThan(0);
        }
        if (result.context !== null) {
          expect(typeof result.context).toBe('string');
        }
      }
    ),
    { numRuns: 100 }
  );
});
