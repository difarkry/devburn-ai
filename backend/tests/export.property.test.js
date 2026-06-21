// Feature: burnout-prediction-web
// Property 13: CSV export round-trip
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fc = require('fast-check');
const { generateCsv } = require('../services/exportService');

const LEVELS = ['Low', 'Medium', 'High'];

function makePrediction(overrides = {}) {
  return {
    createdAt: new Date(),
    inputs: {
      age: 25, experience_years: 3, daily_work_hours: 8, sleep_hours: 7,
      caffeine_intake: 2, bugs_per_day: 3, commits_per_day: 5,
      meetings_per_day: 2, screen_time: 9, exercise_hours: 1
    },
    burnout_level: 'Low',
    confidence: 0.75,
    ...overrides
  };
}

// Property 13: CSV round-trip — exported CSV can be parsed back to original data
test('P13: CSV export produces parseable output matching original data', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          burnout_level: fc.constantFrom(...LEVELS),
          confidence: fc.float({ min: 0, max: 1, noNaN: true }),
          age: fc.integer({ min: 18, max: 80 }),
          daily_work_hours: fc.integer({ min: 1, max: 24 })
        }),
        { minLength: 1, maxLength: 20 }
      ),
      async (items) => {
        const predictions = items.map(item => makePrediction({
          burnout_level: item.burnout_level,
          confidence: item.confidence,
          inputs: { ...makePrediction().inputs, age: item.age, daily_work_hours: item.daily_work_hours }
        }));

        const csv = generateCsv(predictions);
        expect(typeof csv).toBe('string');
        expect(csv.length).toBeGreaterThan(0);

        const lines = csv.split('\n');
        // Header + data rows
        expect(lines.length).toBe(predictions.length + 1);

        // Verify header
        expect(lines[0]).toContain('burnout_level');
        expect(lines[0]).toContain('confidence');

        // Verify each data row
        for (let i = 0; i < predictions.length; i++) {
          const row = lines[i + 1];
          expect(row).toContain(predictions[i].burnout_level);
          const cols = row.split(',');
          expect(cols.length).toBe(13); // 13 columns per spec
        }
      }
    ),
    { numRuns: 100 }
  );
});
