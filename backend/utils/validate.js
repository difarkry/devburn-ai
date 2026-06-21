const FIELD_RANGES = {
  age: { min: 18, max: 80 },
  experience_years: { min: 0, max: 50 },
  daily_work_hours: { min: 1, max: 24 },
  sleep_hours: { min: 1, max: 12 },
  caffeine_intake: { min: 0, max: 20 },
  bugs_per_day: { min: 0, max: 100 },
  commits_per_day: { min: 0, max: 100 },
  meetings_per_day: { min: 0, max: 20 },
  screen_time: { min: 1, max: 24 },
  exercise_hours: { min: 0, max: 12 }
};

/**
 * Validates prediction inputs.
 * @param {object} inputs
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePredictionInputs(inputs) {
  const errors = [];
  for (const [field, { min, max }] of Object.entries(FIELD_RANGES)) {
    if (inputs[field] === undefined || inputs[field] === null || inputs[field] === '') {
      errors.push(`Field "${field}" is required`);
      continue;
    }
    const val = Number(inputs[field]);
    if (isNaN(val)) {
      errors.push(`Field "${field}" must be a number`);
      continue;
    }
    if (val < min || val > max) {
      errors.push(`Field "${field}" must be between ${min} and ${max}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validatePredictionInputs, FIELD_RANGES };
