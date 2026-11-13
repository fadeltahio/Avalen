import { t } from './i18n.js';
// Keep missing values missing: Number(null) and Number('') otherwise become zero.
export function chartRecords(records, field) {
  return records.filter((record) => {
    const value = record[field];
    return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function fieldMessage(input, label = 'this field') {
  const value = input.value.trim();
  if (input.required && !value) return t('Please enter {value}.', { value: label.toLowerCase() });
  const validity = input.validity;
  if (validity.typeMismatch) return t('Enter a valid email address, such as you@example.com.');
  if (validity.badInput) return t('Enter a valid number.');
  if (validity.rangeUnderflow) return t('Enter {min} or more.', { min: input.min });
  if (validity.rangeOverflow) return t('Enter {max} or less.', { max: input.max });
  if (validity.stepMismatch) return input.step === '1' ? t('Enter a whole number.') : t('Use increments of {step}.', { step: input.step });
  if (validity.patternMismatch) return t('Please use the requested format.');
  return '';
}

export function programError(program) {
  if (!program.name?.trim()) return t('Give your programme a name.');
  if (!Number.isInteger(Number(program.weeks)) || program.weeks < 1 || program.weeks > 52) return t('Weeks must be a whole number from 1 to 52.');
  if (!program.days.length) return t('Add at least one training day.');
  for (const day of program.days) {
    if (!day.name?.trim() || day.name.length > 70) return t('Give each day a name of 1–70 characters.');
    if (!Number.isInteger(Number(day.minutes)) || day.minutes < 5 || day.minutes > 180) return t('{name}: estimated minutes must be a whole number from 5 to 180.', { name: day.name });
    if (!day.exercises.length) return t('{name}: add at least one exercise.', { name: day.name });
    for (const exercise of day.exercises) {
      for (const [key, label, min, max] of [['sets', 'sets', 1, 20], ['reps', 'reps', 1, 100], ['weight', 'load', 0, 1000], ['rest', 'rest seconds', 0, 600], ['rpe', 'RPE', 1, 10], ['rir', 'reps in reserve', 0, 10]]) {
        const value = exercise[key];
        if (value === '' || !Number.isFinite(Number(value)) || value < min || value > max || (key !== 'weight' && !Number.isInteger(Number(value)))) return t('{name} · {name2}: enter {value} from {min} to {max} for {label}.', { name: day.name, name2: exercise.name, value: key === 'weight' ? 'a number' : 'a whole number', min, max, label });
      }
    }
  }
  return '';
}

export function consistencyState({ workout, scheduled, foodLogged, nutrition, habits = [], values = {}, mode }) {
  if (mode === 'Habits') return habits.length && habits.every(h => Number(values[h.id] || 0) >= h.target) ? 'both' : Object.keys(values).length ? 'partial' : 'none';
  if (mode === 'Training') return workout ? 'both' : 'none';
  if (mode === 'Nutrition') return nutrition ? 'both' : foodLogged ? 'partial' : 'none';
  if (nutrition && (workout || !scheduled)) return 'both';
  if (workout || (foodLogged && !nutrition)) return 'partial';
  return nutrition ? 'nutrition' : 'none';
}

export function latestMeasurement(records, field) {
  return chartRecords(records, field).at(-1) || null;
}
